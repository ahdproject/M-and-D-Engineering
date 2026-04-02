const db = require('../../config/db');

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const getCurrentBalance = async (month, year) => {
  const { rows } = await db.query(
    `SELECT balance_after
     FROM cash_balance_log
     WHERE month = $1 AND year = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [month, year]
  );

  if (rows.length) return parseFloat(rows[0].balance_after);

  // Check carry forward from last month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;

  const { rows: prev } = await db.query(
    `SELECT balance_after
     FROM cash_balance_log
     WHERE month = $1 AND year = $2
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [prevMonth, prevYear]
  );

  return prev.length ? parseFloat(prev[0].balance_after) : 0;
};

const logBalance = async (client, {
  date, type, reference_type, reference_id,
  amount, balance_after, note, entered_by
}) => {
  await client.query(
    `INSERT INTO cash_balance_log
       (date, type, reference_type, reference_id, amount, balance_after, note, entered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [date, type, reference_type, reference_id, amount, balance_after, note, entered_by]
  );
};

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

const getCategories = async (type = null) => {
  const { rows } = await db.query(
    `SELECT * FROM expense_categories
     WHERE is_active = true ${type ? 'AND type = $1' : ''}
     ORDER BY type, name`,
    type ? [type] : []
  );
  return rows;
};

const createCategory = async ({ name, type, description }) => {
  const { rows } = await db.query(
    `INSERT INTO expense_categories (name, type, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET type = $2, is_active = true
     RETURNING *`,
    [name, type, description || null]
  );
  return rows[0];
};

// ─── CASH EXPENSES ────────────────────────────────────────────────────────────

const createCashExpense = async (data, userId) => {
  const { date, category_id, amount, description, payment_mode, receipt_no } = data;
  const month = new Date(date).getMonth() + 1;
  const year  = new Date(date).getFullYear();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO cash_expenses
         (date, category_id, amount, description, payment_mode, receipt_no, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [date, category_id, amount, description || null, payment_mode || 'cash', receipt_no || null, userId]
    );

    const expense = rows[0];

    // Only log balance for cash payments
    if (payment_mode === 'cash' || !payment_mode) {
      const currentBalance = await getCurrentBalance(month, year);
      const newBalance     = parseFloat((currentBalance - amount).toFixed(2));

      await logBalance(client, {
        date, type: 'expense', reference_type: 'cash_expense',
        reference_id: expense.id, amount, balance_after: newBalance,
        note: description, entered_by: userId,
      });
    }

    await client.query('COMMIT');
    return getExpenseById(expense.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const createBulkCashExpense = async ({ date, entries }, userId) => {
  const saved  = [];
  const errors = [];

  for (const entry of entries) {
    try {
      const result = await createCashExpense({ ...entry, date }, userId);
      saved.push(result);
    } catch (err) {
      errors.push({ category_id: entry.category_id, error: err.message });
    }
  }

  return {
    date,
    saved_count: saved.length,
    error_count: errors.length,
    entries:     saved,
    errors,
    total_amount: saved.reduce((s, e) => s + parseFloat(e.amount), 0).toFixed(2),
  };
};

const getExpenseById = async (id) => {
  const { rows } = await db.query(
    `SELECT ce.*, ec.name AS category_name, ec.type AS category_type,
            u.name AS entered_by_name
     FROM cash_expenses ce
     JOIN expense_categories ec ON ce.category_id = ec.id
     JOIN users u ON ce.entered_by = u.id
     WHERE ce.id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Expense not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const getCashExpenses = async ({ month, year, category_id, date } = {}) => {
  const conditions = [];
  const params     = [];

  if (month) { params.push(month); conditions.push(`ce.month = $${params.length}`); }
  if (year)  { params.push(year);  conditions.push(`ce.year  = $${params.length}`); }
  if (date)  { params.push(date);  conditions.push(`ce.date  = $${params.length}`); }
  if (category_id) { params.push(category_id); conditions.push(`ce.category_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT ce.*, ec.name AS category_name, ec.type AS category_type,
            u.name AS entered_by_name
     FROM cash_expenses ce
     JOIN expense_categories ec ON ce.category_id = ec.id
     JOIN users u ON ce.entered_by = u.id
     ${where}
     ORDER BY ce.date DESC, ce.created_at DESC`,
    params
  );
  return rows;
};

const getMonthlyCashSummary = async (month, year) => {
  const { rows: byCat } = await db.query(
    `SELECT ec.name AS category, ec.type,
            COUNT(*) AS entry_count,
            SUM(ce.amount) AS total_amount
     FROM cash_expenses ce
     JOIN expense_categories ec ON ce.category_id = ec.id
     WHERE ce.month = $1 AND ce.year = $2
     GROUP BY ec.id, ec.name, ec.type
     ORDER BY total_amount DESC`,
    [month, year]
  );

  const { rows: total } = await db.query(
    `SELECT COUNT(*) AS total_entries,
            SUM(amount) AS total_amount,
            SUM(CASE WHEN payment_mode = 'cash' THEN amount ELSE 0 END) AS cash_total,
            SUM(CASE WHEN payment_mode = 'bank' THEN amount ELSE 0 END) AS bank_total
     FROM cash_expenses
     WHERE month = $1 AND year = $2`,
    [month, year]
  );

  return { month, year, by_category: byCat, totals: total[0] };
};

const updateCashExpense = async (id, fields, userId) => {
  await getExpenseById(id);
  const allowed = ['amount', 'description', 'date', 'payment_mode', 'receipt_no'];
  const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));

  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  await db.query(
    `UPDATE cash_expenses SET ${setClause}, updated_at = NOW() WHERE id = $${updates.length + 1}`,
    [...updates.map(([, v]) => v), id]
  );
  return getExpenseById(id);
};

const deleteCashExpense = async (id) => {
  const expense = await getExpenseById(id);
  await db.query('DELETE FROM cash_expenses WHERE id = $1', [id]);
  return { id: parseInt(id), deleted: true, category: expense.category_name };
};

// ─── UTILITY BILLS ────────────────────────────────────────────────────────────

const createUtilityBill = async (data, userId) => {
  const { bill_type, amount, bill_date, due_date, month, year, bill_no, remarks } = data;

  const { rows } = await db.query(
    `INSERT INTO utility_bills
       (bill_type, amount, bill_date, due_date, month, year, bill_no, remarks, entered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (bill_type, month, year)
     DO UPDATE SET amount = $2, bill_date = $3, due_date = $4,
                   bill_no = $7, remarks = $8, entered_by = $9
     RETURNING *`,
    [bill_type, amount, bill_date, due_date || null, month, year, bill_no || null, remarks || null, userId]
  );
  return rows[0];
};

const getUtilityBills = async ({ month, year } = {}) => {
  const conditions = [];
  const params     = [];

  if (month) { params.push(month); conditions.push(`month = $${params.length}`); }
  if (year)  { params.push(year);  conditions.push(`year  = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT ub.*, u.name AS entered_by_name,
            p.name AS paid_by_name
     FROM utility_bills ub
     JOIN users u ON ub.entered_by = u.id
     LEFT JOIN users p ON ub.paid_by = p.id
     ${where}
     ORDER BY ub.bill_date DESC`,
    params
  );
  return rows;
};

const markUtilityPaid = async (id, { paid_on }, paidBy) => {
  const { rows: existing } = await db.query('SELECT * FROM utility_bills WHERE id = $1', [id]);
  if (!existing.length) {
    const err = new Error('Utility bill not found');
    err.statusCode = 404;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE utility_bills
     SET is_paid = true, paid_on = $1, paid_by = $2
     WHERE id = $3 RETURNING *`,
    [paid_on, paidBy, id]
  );
  return rows[0];
};

// ─── VENDOR EXPENSES ──────────────────────────────────────────────────────────

const createVendorExpense = async (data, userId) => {
  const { vendor_name, amount, date, purpose, payment_mode, reference_no } = data;

  const { rows } = await db.query(
    `INSERT INTO vendor_expenses
       (vendor_name, amount, date, purpose, payment_mode, reference_no, entered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [vendor_name, amount, date, purpose || null, payment_mode || 'cash', reference_no || null, userId]
  );
  return rows[0];
};

const getVendorExpenses = async ({ month, year } = {}) => {
  const conditions = [];
  const params     = [];

  if (month) { params.push(month); conditions.push(`ve.month = $${params.length}`); }
  if (year)  { params.push(year);  conditions.push(`ve.year  = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT ve.*, u.name AS entered_by_name
     FROM vendor_expenses ve
     JOIN users u ON ve.entered_by = u.id
     ${where}
     ORDER BY ve.date DESC`,
    params
  );
  return rows;
};

const getMonthlyVendorSummary = async (month, year) => {
  const { rows } = await db.query(
    `SELECT vendor_name,
            COUNT(*) AS entry_count,
            SUM(amount) AS total_amount
     FROM vendor_expenses
     WHERE month = $1 AND year = $2
     GROUP BY vendor_name
     ORDER BY total_amount DESC`,
    [month, year]
  );
  return rows;
};

const updateVendorExpense = async (id, fields) => {
  const { rows: existing } = await db.query('SELECT * FROM vendor_expenses WHERE id = $1', [id]);
  if (!existing.length) {
    const err = new Error('Vendor expense not found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = ['vendor_name', 'amount', 'date', 'purpose', 'payment_mode', 'reference_no'];
  const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
  if (!updates.length) {
    const err = new Error('No valid fields');
    err.statusCode = 400;
    throw err;
  }

  const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  const { rows } = await db.query(
    `UPDATE vendor_expenses SET ${setClause}, updated_at = NOW()
     WHERE id = $${updates.length + 1} RETURNING *`,
    [...updates.map(([, v]) => v), id]
  );
  return rows[0];
};

const deleteVendorExpense = async (id) => {
  const { rows } = await db.query('SELECT * FROM vendor_expenses WHERE id = $1', [id]);
  if (!rows.length) {
    const err = new Error('Vendor expense not found');
    err.statusCode = 404;
    throw err;
  }
  await db.query('DELETE FROM vendor_expenses WHERE id = $1', [id]);
  return { id: parseInt(id), deleted: true };
};

// ─── CASH RECEIVED ────────────────────────────────────────────────────────────

const recordCashReceived = async (data, userId) => {
  const { date, amount, source, bill_no, notes } = data;
  const month = new Date(date).getMonth() + 1;
  const year  = new Date(date).getFullYear();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO cash_received
         (date, amount, source, bill_no, notes, entered_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [date, amount, source || null, bill_no || null, notes || null, userId]
    );

    const record         = rows[0];
    const currentBalance = await getCurrentBalance(month, year);
    const newBalance     = parseFloat((currentBalance + parseFloat(amount)).toFixed(2));

    await logBalance(client, {
      date, type: 'received', reference_type: 'cash_received',
      reference_id: record.id, amount, balance_after: newBalance,
      note: source, entered_by: userId,
    });

    await client.query('COMMIT');
    return { ...record, balance_after: newBalance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getCashReceived = async ({ month, year } = {}) => {
  const conditions = [];
  const params     = [];

  if (month) { params.push(month); conditions.push(`cr.month = $${params.length}`); }
  if (year)  { params.push(year);  conditions.push(`cr.year  = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await db.query(
    `SELECT cr.*, u.name AS entered_by_name
     FROM cash_received cr
     JOIN users u ON cr.entered_by = u.id
     ${where}
     ORDER BY cr.date DESC`,
    params
  );
  return rows;
};

// ─── OPENING BALANCE ─────────────────────────────────────────────────────────

const setOpeningBalance = async ({ month, year, amount, note }, userId) => {
  const date = new Date(year, month - 1, 1).toISOString().split('T')[0];

  // Check if opening balance already set
  const { rows: existing } = await db.query(
    `SELECT id FROM cash_balance_log
     WHERE month = $1 AND year = $2 AND type = 'opening'`,
    [month, year]
  );

  if (existing.length) {
    // Update existing
    const { rows } = await db.query(
      `UPDATE cash_balance_log
       SET amount = $1, balance_after = $1, note = $2
       WHERE month = $3 AND year = $4 AND type = 'opening'
       RETURNING *`,
      [amount, note || 'Opening balance', month, year]
    );
    return rows[0];
  }

  const { rows } = await db.query(
    `INSERT INTO cash_balance_log
       (date, type, reference_type, amount, balance_after, note, entered_by)
     VALUES ($1, 'opening', 'manual', $2, $2, $3, $4)
     RETURNING *`,
    [date, amount, note || 'Opening balance', userId]
  );
  return rows[0];
};

// ─── CASH BALANCE & SUMMARY ──────────────────────────────────────────────────

const getCashBalance = async (month, year) => {
  const balance = await getCurrentBalance(month, year);

  const { rows: log } = await db.query(
    `SELECT * FROM cash_balance_log
     WHERE month = $1 AND year = $2
     ORDER BY created_at ASC, id ASC`,
    [month, year]
  );

  return { month, year, current_balance: balance, ledger: log };
};

// ─── MONTHLY EXPENSES SUMMARY ────────────────────────────────────────────────
const getMonthlySummary = async (month, year) => {
  // Cash expenses total
  const { rows: cashTotal } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM cash_expenses WHERE month = $1 AND year = $2`,
    [month, year]
  );

  // Utility bills total
  const { rows: utilityTotal } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM utility_bills WHERE month = $1 AND year = $2`,
    [month, year]
  );

  // Vendor expenses total
  const { rows: vendorTotal } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM vendor_expenses WHERE month = $1 AND year = $2`,
    [month, year]
  );

  // Cash received total
  const { rows: receivedTotal } = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM cash_received WHERE month = $1 AND year = $2`,
    [month, year]
  );

  // Category breakdown
  const { rows: byCategory } = await db.query(
    `SELECT ec.name AS category, ec.type,
            COUNT(*) AS entries,
            SUM(ce.amount) AS total
     FROM cash_expenses ce
     JOIN expense_categories ec ON ce.category_id = ec.id
     WHERE ce.month = $1 AND ce.year = $2
     GROUP BY ec.id, ec.name, ec.type
     ORDER BY total DESC`,
    [month, year]
  );

  // Vendor breakdown
  const { rows: byVendor } = await db.query(
    `SELECT vendor_name, COUNT(*) AS entries, SUM(amount) AS total
     FROM vendor_expenses
     WHERE month = $1 AND year = $2
     GROUP BY vendor_name
     ORDER BY total DESC`,
    [month, year]
  );

  // Utility breakdown
  const { rows: utilityList } = await db.query(
    `SELECT bill_type, amount, is_paid, paid_on
     FROM utility_bills
     WHERE month = $1 AND year = $2`,
    [month, year]
  );

  const cashExp     = parseFloat(cashTotal[0].total);
  const utilityExp  = parseFloat(utilityTotal[0].total);
  const vendorExp   = parseFloat(vendorTotal[0].total);
  const totalExp    = parseFloat((cashExp + utilityExp + vendorExp).toFixed(2));
  const cashRecvd   = parseFloat(receivedTotal[0].total);
  const balance     = await getCurrentBalance(month, year);

  return {
    month, year,
    summary: {
      cash_expenses:   cashExp,
      utility_bills:   utilityExp,
      vendor_expenses: vendorExp,
      total_expenses:  totalExp,
      cash_received:   cashRecvd,
      current_balance: balance,
    },
    breakdowns: {
      by_category: byCategory,
      by_vendor:   byVendor,
      utilities:   utilityList,
    },
  };
};

module.exports = {
  // Categories
  getCategories, createCategory,

  // Cash Expenses
  createCashExpense, createBulkCashExpense,
  getExpenseById, getCashExpenses,
  getMonthlyCashSummary, updateCashExpense, deleteCashExpense,

  // Utility Bills
  createUtilityBill, getUtilityBills, markUtilityPaid,

  // Vendor Expenses
  createVendorExpense, getVendorExpenses,
  getMonthlyVendorSummary, updateVendorExpense, deleteVendorExpense,

  // Cash Received
  recordCashReceived, getCashReceived,

  // Balance
  setOpeningBalance, getCashBalance,

  // Summary
  getMonthlySummary,
};
