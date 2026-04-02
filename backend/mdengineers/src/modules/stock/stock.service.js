const db         = require('../../config/db');
const mastersSvc = require('../masters/masters.service');

const computeAmounts = (quantity, rate, gst_rate) => {
  const sales_amount = parseFloat((quantity * rate).toFixed(2));
  const gst_amount   = parseFloat((sales_amount * gst_rate / 100).toFixed(2));
  const total_amount = parseFloat((sales_amount + gst_amount).toFixed(2));
  return { sales_amount, gst_amount, total_amount };
};

const getCurrentStock = async (chemical_id) => {
  const { rows } = await db.query(
    `SELECT COALESCE(
       SUM(CASE WHEN entry_type = 'purchase'   THEN quantity ELSE 0 END) -
       SUM(CASE WHEN entry_type = 'usage'      THEN quantity ELSE 0 END),
     0) AS current_stock
     FROM stock_datewise_entry
     WHERE chemical_id = $1`,
    [chemical_id]
  );
  return parseFloat(rows[0].current_stock) || 0;
};

const getEntryById = async (id) => {
  const { rows } = await db.query(
    `SELECT s.*, c.name AS chemical_name, c.unit AS chemical_unit,
            u.name AS entered_by_name
     FROM stock_datewise_entry s
     JOIN chemicals_master c ON s.chemical_id = c.id
     JOIN users u ON s.entered_by = u.id
     WHERE s.id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Entry not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const createEntry = async (entryData, userId) => {
  const {
    date, chemical_id, entry_type, quantity, quantity_unit,
    use_master_rate = true, rate_override_reason, remark,
  } = entryData;

  const chemical = await mastersSvc.getById(chemical_id);

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

  const stockBefore = await getCurrentStock(chemical_id);

  if (entry_type === 'usage' && quantity > stockBefore) {
    const err = new Error(
      `Insufficient stock for ${chemical.name}. Available: ${stockBefore} ${chemical.unit}`
    );
    err.statusCode = 400;
    throw err;
  }

  const stockAfter = entry_type === 'purchase'
    ? stockBefore + parseFloat(quantity)
    : stockBefore - parseFloat(quantity);

  const { sales_amount, gst_amount, total_amount } =
    computeAmounts(quantity, rate, chemical.gst_rate);

  const { rows } = await db.query(
    `INSERT INTO stock_datewise_entry
       (date, chemical_id, entry_type, quantity, quantity_unit,
        rate, rate_unit, rate_source, rate_override_reason,
        stock_before, stock_after, gst_amount, total_amount,
        sales_amount, remark, entered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING id`,
    [
      date, chemical_id, entry_type, quantity, quantity_unit,
      rate, rate_unit, rate_source, rate_override_reason || null,
      stockBefore, stockAfter, gst_amount, total_amount,
      sales_amount, remark || null, userId,
    ]
  );

  return getEntryById(rows[0].id);
};

const createBulkEntry = async ({ date, entries }, userId) => {
  const saved  = [];
  const errors = [];

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
      total_sales_amount: saved.reduce((s, e) => s + parseFloat(e.sales_amount || 0), 0).toFixed(2),
      total_gst:          saved.reduce((s, e) => s + parseFloat(e.gst_amount   || 0), 0).toFixed(2),
      grand_total:        saved.reduce((s, e) => s + parseFloat(e.total_amount  || 0), 0).toFixed(2),
    },
  };
};

const getByDate = async (date) => {
  const { rows: entries } = await db.query(
    `SELECT s.id, s.date,
            TO_CHAR(s.date, 'Day') AS day_of_week,
            s.entry_type, s.quantity, s.quantity_unit,
            s.rate, s.rate_unit, s.rate_source,
            s.stock_before, s.stock_after,
            s.sales_amount, s.gst_amount, s.total_amount,
            s.remark, s.created_at,
            c.id AS chemical_id, c.name AS chemical_name, c.unit,
            u.name AS entered_by_name
     FROM stock_datewise_entry s
     JOIN chemicals_master c ON s.chemical_id = c.id
     JOIN users u ON s.entered_by = u.id
     WHERE s.date = $1
     ORDER BY s.created_at ASC`,
    [date]
  );

  const totals = entries.reduce(
    (acc, e) => {
      acc.total_entries++;
      acc.total_sales  += parseFloat(e.sales_amount || 0);
      acc.total_gst    += parseFloat(e.gst_amount   || 0);
      acc.grand_total  += parseFloat(e.total_amount  || 0);
      return acc;
    },
    { total_entries: 0, total_sales: 0, total_gst: 0, grand_total: 0 }
  );

  Object.keys(totals).forEach(k => {
    if (k !== 'total_entries') totals[k] = parseFloat(totals[k].toFixed(2));
  });

  return { date, entries, day_total: totals };
};

const getByDateRange = async (from, to) => {
  const { rows } = await db.query(
    `SELECT date,
            TO_CHAR(date, 'Day') AS day_of_week,
            COUNT(*) AS entries_count,
            SUM(sales_amount) AS total_sales,
            SUM(gst_amount)   AS total_gst,
            SUM(total_amount) AS total_amount
     FROM stock_datewise_entry
     WHERE date BETWEEN $1 AND $2
     GROUP BY date
     ORDER BY date ASC`,
    [from, to]
  );
  return rows;
};

const getMonthlySummary = async (month, year) => {
  const { rows: datewise } = await db.query(
    `SELECT date,
            TO_CHAR(date, 'Day') AS day_of_week,
            COUNT(*) AS entries_count,
            SUM(sales_amount) AS total_sales,
            SUM(gst_amount)   AS total_gst,
            SUM(total_amount) AS total_amount
     FROM stock_datewise_entry
     WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2
     GROUP BY date
     ORDER BY date ASC`,
    [month, year]
  );

  const { rows: chemwise } = await db.query(
    `SELECT c.id AS chemical_id, c.name AS chemical_name, c.unit,
            SUM(CASE WHEN s.entry_type='purchase' THEN s.quantity ELSE 0 END) AS total_purchased,
            SUM(CASE WHEN s.entry_type='usage'    THEN s.quantity ELSE 0 END) AS total_used,
            SUM(s.sales_amount) AS total_sales_amount,
            SUM(s.gst_amount)   AS total_gst,
            SUM(s.total_amount) AS total_amount,
            COUNT(*) AS entry_count
     FROM stock_datewise_entry s
     JOIN chemicals_master c ON s.chemical_id = c.id
     WHERE EXTRACT(MONTH FROM s.date) = $1 AND EXTRACT(YEAR FROM s.date) = $2
     GROUP BY c.id, c.name, c.unit
     ORDER BY c.name ASC`,
    [month, year]
  );

  const { rows: totals } = await db.query(
    `SELECT COUNT(*) AS total_entries,
            SUM(sales_amount) AS total_sales_amount,
            SUM(gst_amount)   AS total_gst,
            SUM(total_amount) AS grand_total
     FROM stock_datewise_entry
     WHERE EXTRACT(MONTH FROM date) = $1 AND EXTRACT(YEAR FROM date) = $2`,
    [month, year]
  );

  return {
    month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
    year:  parseInt(year),
    date_wise_summary:     datewise,
    chemical_wise_summary: chemwise,
    monthly_totals:        totals[0],
  };
};

const getChemicalHistory = async (chemical_id, page = 1, per_page = 20) => {
  await mastersSvc.getById(chemical_id);
  const offset = (page - 1) * per_page;

  const { rows } = await db.query(
    `SELECT s.id, s.date, TO_CHAR(s.date,'Day') AS day_of_week,
            s.entry_type, s.quantity, s.quantity_unit,
            s.rate, s.rate_source, s.stock_before, s.stock_after,
            s.sales_amount, s.gst_amount, s.total_amount,
            s.remark, u.name AS entered_by
     FROM stock_datewise_entry s
     JOIN users u ON s.entered_by = u.id
     WHERE s.chemical_id = $1
     ORDER BY s.date DESC, s.created_at DESC
     LIMIT $2 OFFSET $3`,
    [chemical_id, per_page, offset]
  );

  const { rows: countRows } = await db.query(
    'SELECT COUNT(*) AS total FROM stock_datewise_entry WHERE chemical_id = $1',
    [chemical_id]
  );

  const total = parseInt(countRows[0].total);
  return {
    history:    rows,
    pagination: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
  };
};

const recalculateStockChain = async (client, chemical_id, from_date) => {
  const { rows: entries } = await client.query(
    `SELECT id, entry_type, quantity
     FROM stock_datewise_entry
     WHERE chemical_id = $1 AND date >= $2
     ORDER BY date ASC, created_at ASC`,
    [chemical_id, from_date]
  );

  if (!entries.length) return;

  const { rows: prev } = await client.query(
    `SELECT COALESCE(
       SUM(CASE WHEN entry_type='purchase' THEN quantity ELSE 0 END) -
       SUM(CASE WHEN entry_type='usage'    THEN quantity ELSE 0 END),
     0) AS stock_before_date
     FROM stock_datewise_entry
     WHERE chemical_id = $1 AND date < $2`,
    [chemical_id, from_date]
  );

  let runningStock = parseFloat(prev[0].stock_before_date) || 0;

  for (const entry of entries) {
    const stock_before = runningStock;
    const stock_after  = entry.entry_type === 'purchase'
      ? runningStock + parseFloat(entry.quantity)
      : runningStock - parseFloat(entry.quantity);

    await client.query(
      'UPDATE stock_datewise_entry SET stock_before = $1, stock_after = $2 WHERE id = $3',
      [stock_before, stock_after, entry.id]
    );

    runningStock = stock_after;
  }
};

const updateEntry = async (id, fields, userId) => {
  const existing = await getEntryById(id);

  if (fields.chemical_id || fields.entered_by) {
    const err = new Error('chemical_id and entered_by cannot be changed.');
    err.statusCode = 400;
    throw err;
  }

  const newQuantity  = parseFloat(fields.quantity  ?? existing.quantity);
  const newEntryType = fields.entry_type            ?? existing.entry_type;
  const newDate      = fields.date                  ?? existing.date;
  const newRate      = parseFloat(fields.rate       ?? existing.rate);
  const newRemark    = fields.remark                ?? existing.remark;

  const changes = [];
  if (fields.quantity   !== undefined) changes.push({ field: 'quantity',   old: existing.quantity,   newVal: fields.quantity });
  if (fields.rate       !== undefined) changes.push({ field: 'rate',       old: existing.rate,       newVal: fields.rate });
  if (fields.entry_type !== undefined) changes.push({ field: 'entry_type', old: existing.entry_type, newVal: fields.entry_type });
  if (fields.date       !== undefined) changes.push({ field: 'date',       old: existing.date,       newVal: fields.date });
  if (fields.remark     !== undefined) changes.push({ field: 'remark',     old: existing.remark,     newVal: fields.remark });

  if (!changes.length) {
    const err = new Error('No changes detected');
    err.statusCode = 400;
    throw err;
  }

  const chemical     = await mastersSvc.getById(existing.chemical_id);
  const sales_amount = parseFloat((newQuantity * newRate).toFixed(2));
  const gst_amount   = parseFloat((sales_amount * chemical.gst_rate / 100).toFixed(2));
  const total_amount = parseFloat((sales_amount + gst_amount).toFixed(2));

  const recalcFromDate = fields.date
    ? [existing.date, fields.date].sort()[0]
    : existing.date;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE stock_datewise_entry
       SET quantity             = $1,
           entry_type           = $2,
           date                 = $3,
           rate                 = $4,
           rate_source          = $5,
           rate_override_reason = $6,
           sales_amount         = $7,
           gst_amount           = $8,
           total_amount         = $9,
           remark               = $10,
           updated_at           = NOW()
       WHERE id = $11`,
      [
        newQuantity, newEntryType, newDate, newRate,
        fields.rate !== undefined ? 'override' : existing.rate_source,
        fields.rate_override_reason ?? existing.rate_override_reason,
        sales_amount, gst_amount, total_amount, newRemark, id,
      ]
    );

    await recalculateStockChain(client, existing.chemical_id, recalcFromDate);

    for (const c of changes) {
      await client.query(
        `INSERT INTO stock_entry_edit_log
           (entry_id, field_changed, old_value, new_value, changed_by, change_reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, c.field, String(c.old), String(c.newVal), userId, fields.change_reason || null]
      );
    }

    await client.query('COMMIT');
    return getEntryById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deleteEntry = async (id, userId, reason) => {
  const existing = await getEntryById(id);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO stock_entry_edit_log
         (entry_id, field_changed, old_value, new_value, changed_by, change_reason)
       VALUES ($1, 'DELETED', $2, 'DELETED', $3, $4)`,
      [id, JSON.stringify(existing), userId, reason || 'No reason provided']
    );

    await client.query('DELETE FROM stock_datewise_entry WHERE id = $1', [id]);
    await recalculateStockChain(client, existing.chemical_id, existing.date);

    await client.query('COMMIT');
    return { id: parseInt(id), deleted: true, chemical_name: existing.chemical_name };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getEditLog = async (entry_id) => {
  const { rows } = await db.query(
    `SELECT l.id, l.field_changed, l.old_value, l.new_value,
            l.change_reason, l.changed_at, u.name AS changed_by
     FROM stock_entry_edit_log l
     JOIN users u ON l.changed_by = u.id
     WHERE l.entry_id = $1
     ORDER BY l.changed_at DESC`,
    [entry_id]
  );
  return rows;
};

module.exports = {
  createEntry, createBulkEntry, getEntryById,
  getByDate, getByDateRange, getMonthlySummary,
  getChemicalHistory, updateEntry, deleteEntry, getEditLog,
};