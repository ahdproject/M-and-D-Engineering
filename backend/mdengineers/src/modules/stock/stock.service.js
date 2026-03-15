const db          = require('../../config/db');
const mastersSvc  = require('../masters/masters.service');

// ─── helpers ─────────────────────────────────────────────────────────────────

const computeAmounts = (quantity, rate, gst_rate) => {
  const sales_amount = parseFloat((quantity * rate).toFixed(2));
  const gst_amount   = parseFloat((sales_amount * gst_rate / 100).toFixed(2));
  const total_amount = parseFloat((sales_amount + gst_amount).toFixed(2));
  return { sales_amount, gst_amount, total_amount };
};

const getCurrentStock = async (chemical_id) => {
  const [rows] = await db.query(
    `SELECT COALESCE(
       SUM(CASE WHEN entry_type IN ('purchase') THEN quantity ELSE 0 END) -
       SUM(CASE WHEN entry_type = 'usage' THEN quantity ELSE 0 END),
     0) AS current_stock
     FROM stock_datewise_entry
     WHERE chemical_id = ?`,
    [chemical_id]
  );
  return parseFloat(rows[0].current_stock) || 0;
};

/**
 * Recalculates stock_before and stock_after for all entries
 * of a chemical on or after a given date.
 * Called after any edit that changes quantity, entry_type, or date.
 */
const recalculateStockChain = async (conn, chemical_id, from_date) => {
  // Fetch all entries for this chemical from the affected date onwards
  // ordered by date + created_at to preserve entry order within same day
  const [entries] = await conn.query(
    `SELECT id, entry_type, quantity
     FROM stock_datewise_entry
     WHERE chemical_id = ? AND date >= ?
     ORDER BY date ASC, created_at ASC`,
    [chemical_id, from_date]
  );

  if (!entries.length) return;

  // Get the stock level just before from_date
  const [prev] = await conn.query(
    `SELECT COALESCE(
       SUM(CASE WHEN entry_type = 'purchase'   THEN quantity ELSE 0 END) -
       SUM(CASE WHEN entry_type = 'usage'      THEN quantity ELSE 0 END) +
       SUM(CASE WHEN entry_type = 'adjustment' THEN quantity ELSE 0 END),
     0) AS stock_before_date
     FROM stock_datewise_entry
     WHERE chemical_id = ? AND date < ?`,
    [chemical_id, from_date]
  );

  let runningStock = parseFloat(prev[0].stock_before_date) || 0;

  // Walk through each entry and update stock_before / stock_after
  for (const entry of entries) {
    const stock_before = runningStock;
    let   stock_after;

    if (entry.entry_type === 'purchase') {
      stock_after = runningStock + parseFloat(entry.quantity);
    } else if (entry.entry_type === 'usage') {
      stock_after = runningStock - parseFloat(entry.quantity);
    } else {
      // adjustment — can be positive or negative, treat as absolute set
      stock_after = parseFloat(entry.quantity);
    }

    await conn.query(
      `UPDATE stock_datewise_entry
       SET stock_before = ?, stock_after = ?
       WHERE id = ?`,
      [stock_before, stock_after, entry.id]
    );

    runningStock = stock_after;
  }
};
// ─── single entry ─────────────────────────────────────────────────────────────

const createEntry = async (entryData, userId) => {
  const {
    date, chemical_id, entry_type, quantity, quantity_unit,
    use_master_rate = true, rate_override_reason, remark,
  } = entryData;

  // 1. Fetch chemical
  const chemical = await mastersSvc.getById(chemical_id);

  // 2. Resolve rate
  let rate, rate_unit, rate_source;
  if (use_master_rate) {
    const rateInfo = await mastersSvc.getRateOnDate(chemical_id, date);
    rate        = rateInfo.rate;
    rate_source = 'master';
  } else {
    if (!entryData.rate) {
      const err = new Error('Rate is required when use_master_rate is false');
      err.statusCode = 400;
      throw err;
    }
    rate        = entryData.rate;
    rate_source = 'override';
  }
  rate_unit = entryData.rate_unit || `per ${chemical.unit}`;

  // 3. Stock validation for usage
  const stockBefore = await getCurrentStock(chemical_id);
  if (entry_type === 'usage' && quantity > stockBefore) {
    const err = new Error(
      `Insufficient stock for ${chemical.name}. Available: ${stockBefore} ${chemical.unit}`
    );
    err.statusCode = 400;
    throw err;
  }

  const stockAfter = entry_type === 'purchase'
    ? stockBefore + quantity
    : stockBefore - quantity;

  // 4. Compute GST amounts
  const { sales_amount, gst_amount, total_amount } =
    computeAmounts(quantity, rate, chemical.gst_rate);

  // 5. Insert
  const [result] = await db.query(
    `INSERT INTO stock_datewise_entry
       (date, chemical_id, entry_type, quantity, quantity_unit,
        rate, rate_unit, rate_source, rate_override_reason,
        stock_before, stock_after, gst_amount, total_amount,
        remark, entered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      date, chemical_id, entry_type, quantity, quantity_unit,
      rate, rate_unit, rate_source, rate_override_reason || null,
      stockBefore, stockAfter, gst_amount, total_amount,
      remark || null, userId,
    ]
  );

  return getEntryById(result.insertId);
};

// ─── bulk entry ───────────────────────────────────────────────────────────────

const createBulkEntry = async ({ date, entries }, userId) => {
  const saved   = [];
  const errors  = [];

  for (const entry of entries) {
    try {
      const result = await createEntry({ ...entry, date }, userId);
      saved.push(result);
    } catch (err) {
      errors.push({ chemical_id: entry.chemical_id, error: err.message });
    }
  }

  return {
    date,
    total_requested: entries.length,
    saved_count:     saved.length,
    error_count:     errors.length,
    entries:         saved,
    errors,
    summary: {
      total_sales_amount: saved.reduce((s, e) => s + parseFloat(e.sales_amount), 0).toFixed(2),
      total_gst:          saved.reduce((s, e) => s + parseFloat(e.gst_amount),   0).toFixed(2),
      grand_total:        saved.reduce((s, e) => s + parseFloat(e.total_amount),  0).toFixed(2),
    },
  };
};

// ─── queries ──────────────────────────────────────────────────────────────────

const getEntryById = async (id) => {
  const [rows] = await db.query(
    `SELECT s.*, c.name AS chemical_name, c.unit AS chemical_unit,
            u.name AS entered_by_name
     FROM stock_datewise_entry s
     JOIN chemicals_master c ON s.chemical_id = c.id
     JOIN users u ON s.entered_by = u.id
     WHERE s.id = ?`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Entry not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const getByDate = async (date) => {
  const [entries] = await db.query(
    `SELECT s.id, s.date, s.day_of_week, s.entry_type,
            s.quantity, s.quantity_unit, s.rate, s.rate_unit, s.rate_source,
            s.stock_before, s.stock_after,
            s.sales_amount, s.gst_amount, s.total_amount,
            s.remark, s.created_at,
            c.id AS chemical_id, c.name AS chemical_name, c.unit,
            u.name AS entered_by_name
     FROM stock_datewise_entry s
     JOIN chemicals_master c ON s.chemical_id = c.id
     JOIN users u ON s.entered_by = u.id
     WHERE s.date = ?
     ORDER BY s.created_at ASC`,
    [date]
  );

  const totals = entries.reduce(
    (acc, e) => {
      acc.total_entries++;
      acc.total_sales   += parseFloat(e.sales_amount  || 0);
      acc.total_gst     += parseFloat(e.gst_amount    || 0);
      acc.grand_total   += parseFloat(e.total_amount  || 0);
      return acc;
    },
    { total_entries: 0, total_sales: 0, total_gst: 0, grand_total: 0 }
  );

  Object.keys(totals).forEach(k => {
    if (typeof totals[k] === 'number' && k !== 'total_entries') {
      totals[k] = parseFloat(totals[k].toFixed(2));
    }
  });

  return { date, day_of_week: entries[0]?.day_of_week, entries, day_total: totals };
};

const getByDateRange = async (from, to) => {
  const [entries] = await db.query(
    `SELECT s.date, s.day_of_week,
            COUNT(*) AS entries_count,
            SUM(s.sales_amount) AS total_sales,
            SUM(s.gst_amount)   AS total_gst,
            SUM(s.total_amount) AS total_amount
     FROM stock_datewise_entry s
     WHERE s.date BETWEEN ? AND ?
     GROUP BY s.date, s.day_of_week
     ORDER BY s.date ASC`,
    [from, to]
  );
  return entries;
};

const getMonthlySummary = async (month, year) => {
  // Date-wise breakdown
  const [datewise] = await db.query(
    `SELECT s.date, s.day_of_week,
            COUNT(*)            AS entries_count,
            SUM(s.sales_amount) AS total_sales,
            SUM(s.gst_amount)   AS total_gst,
            SUM(s.total_amount) AS total_amount
     FROM stock_datewise_entry s
     WHERE s.month = ? AND s.year = ?
     GROUP BY s.date, s.day_of_week
     ORDER BY s.date ASC`,
    [month, year]
  );

  // Chemical-wise breakdown
  const [chemwise] = await db.query(
    `SELECT c.id AS chemical_id, c.name AS chemical_name, c.unit,
            SUM(CASE WHEN s.entry_type='purchase' THEN s.quantity ELSE 0 END) AS total_purchased,
            SUM(CASE WHEN s.entry_type='usage'    THEN s.quantity ELSE 0 END) AS total_used,
            SUM(s.sales_amount)  AS total_sales_amount,
            SUM(s.gst_amount)    AS total_gst,
            SUM(s.total_amount)  AS total_amount,
            COUNT(*)             AS entry_count
     FROM stock_datewise_entry s
     JOIN chemicals_master c ON s.chemical_id = c.id
     WHERE s.month = ? AND s.year = ?
     GROUP BY c.id, c.name, c.unit
     ORDER BY c.name ASC`,
    [month, year]
  );

  // Monthly totals
  const [totals] = await db.query(
    `SELECT COUNT(*) AS total_entries,
            SUM(sales_amount) AS total_sales_amount,
            SUM(gst_amount)   AS total_gst,
            SUM(total_amount) AS grand_total,
            SUM(CASE WHEN entry_type='purchase' THEN quantity ELSE 0 END) AS total_purchased_kgs
     FROM stock_datewise_entry
     WHERE month = ? AND year = ?`,
    [month, year]
  );

  return {
    month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
    year:  parseInt(year),
    date_wise_summary:    datewise,
    chemical_wise_summary: chemwise,
    monthly_totals: totals[0],
  };
};

const getChemicalHistory = async (chemical_id, page = 1, per_page = 20) => {
  await mastersSvc.getById(chemical_id);
  const offset = (page - 1) * per_page;

  const [rows] = await db.query(
    `SELECT s.id, s.date, s.day_of_week, s.entry_type,
            s.quantity, s.quantity_unit, s.rate, s.rate_source,
            s.stock_before, s.stock_after,
            s.sales_amount, s.gst_amount, s.total_amount,
            s.remark, u.name AS entered_by
     FROM stock_datewise_entry s
     JOIN users u ON s.entered_by = u.id
     WHERE s.chemical_id = ?
     ORDER BY s.date DESC, s.created_at DESC
     LIMIT ? OFFSET ?`,
    [chemical_id, per_page, offset]
  );

  const [[{ total }]] = await db.query(
    'SELECT COUNT(*) AS total FROM stock_datewise_entry WHERE chemical_id = ?',
    [chemical_id]
  );

  return {
    history: rows,
    pagination: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
  };
};

const updateEntry = async (id, fields, userId) => {
  // 1. Fetch existing entry
  const existing = await getEntryById(id);

  const {
    quantity,
    rate,
    entry_type,
    date,
    remark,
    rate_override_reason,
    change_reason,  // mandatory for audit
  } = fields;

  // 2. Validate: chemical_id and entered_by cannot be changed
  if (fields.chemical_id || fields.entered_by) {
    const err = new Error(
      'chemical_id and entered_by cannot be changed. Delete this entry and create a new one.'
    );
    err.statusCode = 400;
    throw err;
  }

  // 3. Determine which fields are actually changing
  const changes = [];

  if (quantity   !== undefined && parseFloat(quantity) !== parseFloat(existing.quantity))
    changes.push({ field: 'quantity',   old: existing.quantity,   newVal: quantity });

  if (rate       !== undefined && parseFloat(rate) !== parseFloat(existing.rate))
    changes.push({ field: 'rate',       old: existing.rate,       newVal: rate });

  if (entry_type !== undefined && entry_type !== existing.entry_type)
    changes.push({ field: 'entry_type', old: existing.entry_type, newVal: entry_type });

  if (date       !== undefined && date !== existing.date)
    changes.push({ field: 'date',       old: existing.date,       newVal: date });

  if (remark     !== undefined && remark !== existing.remark)
    changes.push({ field: 'remark',     old: existing.remark,     newVal: remark });

  if (!changes.length) {
    const err = new Error('No changes detected — all values are the same as existing entry');
    err.statusCode = 400;
    throw err;
  }

  // 4. Validate usage quantity against available stock (if quantity/entry_type changing)
  const newQuantity   = parseFloat(quantity   ?? existing.quantity);
  const newEntryType  = entry_type            ?? existing.entry_type;
  const newDate       = date                  ?? existing.date;
  const newRate       = parseFloat(rate       ?? existing.rate);

  if (newEntryType === 'usage') {
    // Stock available just before this entry's date (excluding this entry itself)
    const [prevStock] = await db.query(
      `SELECT COALESCE(
         SUM(CASE WHEN entry_type='purchase'   THEN quantity ELSE 0 END) -
         SUM(CASE WHEN entry_type='usage'      THEN quantity ELSE 0 END),
       0) AS available
       FROM stock_datewise_entry
       WHERE chemical_id = ? AND (date < ? OR (date = ? AND id < ?))`,
      [existing.chemical_id, newDate, newDate, id]
    );

    const available = parseFloat(prevStock[0].available);
    if (newQuantity > available) {
      const err = new Error(
        `Cannot set usage to ${newQuantity} ${existing.chemical_unit}. ` +
        `Only ${available} ${existing.chemical_unit} available before this date.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // 5. Recalculate amounts if rate or quantity changed
  const chemical    = await mastersSvc.getById(existing.chemical_id);
  const sales_amount = parseFloat((newQuantity * newRate).toFixed(2));
  const gst_amount   = parseFloat((sales_amount * chemical.gst_rate / 100).toFixed(2));
  const total_amount = parseFloat((sales_amount + gst_amount).toFixed(2));

  // 6. Perform update inside a transaction
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Determine earliest affected date for recalculation
    // If date changed, recalculate from whichever is earlier (old or new date)
    const recalcFromDate = date
      ? [existing.date, date].sort()[0]
      : existing.date;

    // Apply the field updates
    await conn.query(
      `UPDATE stock_datewise_entry
       SET quantity              = ?,
           entry_type            = ?,
           date                  = ?,
           rate                  = ?,
           rate_source           = ?,
           rate_override_reason  = ?,
           sales_amount          = ?,
           gst_amount            = ?,
           total_amount          = ?,
           remark                = ?
       WHERE id = ?`,
      [
        newQuantity,
        newEntryType,
        newDate,
        newRate,
        rate !== undefined ? 'override' : existing.rate_source,
        rate_override_reason ?? existing.rate_override_reason,
        sales_amount,
        gst_amount,
        total_amount,
        remark ?? existing.remark,
        id,
      ]
    );

    // Recalculate stock chain from earliest affected date
    await recalculateStockChain(conn, existing.chemical_id, recalcFromDate);

    // Write audit log for each changed field
    const auditRows = changes.map(c => [
      id, c.field, String(c.old), String(c.newVal), userId, change_reason || null
    ]);

    if (auditRows.length) {
      await conn.query(
        `INSERT INTO stock_entry_edit_log
           (entry_id, field_changed, old_value, new_value, changed_by, change_reason)
         VALUES ?`,
        [auditRows]
      );
    }

    await conn.commit();

    return getEntryById(id);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const deleteEntry = async (id, userId, reason) => {
  const existing = await getEntryById(id);

  // Block deletion if entry is linked to a completed work order
  if (existing.work_order_id) {
    const [wo] = await db.query(
      'SELECT status FROM work_orders WHERE id = ?',
      [existing.work_order_id]
    );
    if (wo.length && ['completed', 'billed'].includes(wo[0].status)) {
      const err = new Error(
        'Cannot delete an entry linked to a completed/billed work order. ' +
        'Use adjustment entry instead.'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Log deletion in audit
    await conn.query(
      `INSERT INTO stock_entry_edit_log
         (entry_id, field_changed, old_value, new_value, changed_by, change_reason)
       VALUES (?, 'DELETED', ?, 'DELETED', ?, ?)`,
      [id, JSON.stringify(existing), userId, reason || 'No reason provided']
    );

    // Delete the entry
    await conn.query('DELETE FROM stock_datewise_entry WHERE id = ?', [id]);

    // Recalculate all entries after this date for this chemical
    await recalculateStockChain(conn, existing.chemical_id, existing.date);

    await conn.commit();

    return { id: parseInt(id), deleted: true, chemical_name: existing.chemical_name };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

const getEditLog = async (entry_id) => {
  const [rows] = await db.query(
    `SELECT l.id, l.field_changed, l.old_value, l.new_value,
            l.change_reason, l.changed_at,
            u.name AS changed_by
     FROM stock_entry_edit_log l
     JOIN users u ON l.changed_by = u.id
     WHERE l.entry_id = ?
     ORDER BY l.changed_at DESC`,
    [entry_id]
  );
  return rows;
};
module.exports = {
  createEntry, createBulkEntry, getEntryById,
  getByDate, getByDateRange, getMonthlySummary,
  getChemicalHistory, updateEntry, deleteEntry,
};