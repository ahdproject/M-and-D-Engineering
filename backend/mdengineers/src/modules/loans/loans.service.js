const db = require('../../config/db');

// ─── Helper: generate EMI schedule ───────────────────────────────────────────
const generateEmiSchedule = (loanId, employeeId, startDate, tenureMonths, emiAmount) => {
  const schedule = [];
  const start    = new Date(startDate);

  for (let i = 0; i < tenureMonths; i++) {
    const d     = new Date(start.getFullYear(), start.getMonth() + i, 1);
    schedule.push({
      loan_id:     loanId,
      employee_id: employeeId,
      emi_number:  i + 1,
      due_month:   d.getMonth() + 1,
      due_year:    d.getFullYear(),
      emi_amount:  emiAmount,
    });
  }
  return schedule;
};

// ─── Create loan ──────────────────────────────────────────────────────────────
const createLoan = async ({ employee_id, loan_amount, tenure_months, deduction_start, purpose }, approvedBy) => {

  // Check employee exists
  const { rows: emp } = await db.query('SELECT id, name FROM employees WHERE id = $1', [employee_id]);
  if (!emp.length) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }

  // Check for existing active loan
  const { rows: existing } = await db.query(
    "SELECT id FROM loans WHERE employee_id = $1 AND status = 'active'",
    [employee_id]
  );
  if (existing.length) {
    const err = new Error('Employee already has an active loan. Close it before creating a new one.');
    err.statusCode = 400;
    throw err;
  }

  // Auto-calculate EMI (simple equal division — no interest as per requirement)
  const emi_amount  = parseFloat((loan_amount / tenure_months).toFixed(2));
  const outstanding = loan_amount;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert loan
    const { rows } = await client.query(
      `INSERT INTO loans
         (employee_id, loan_amount, tenure_months, emi_amount,
          deduction_start, purpose, outstanding, approved_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [employee_id, loan_amount, tenure_months, emi_amount,
       deduction_start, purpose || null, outstanding, approvedBy]
    );

    const loan = rows[0];

    // Generate and insert EMI schedule
    const schedule = generateEmiSchedule(
      loan.id, employee_id, deduction_start, tenure_months, emi_amount
    );

    for (const emi of schedule) {
      await client.query(
        `INSERT INTO loan_emi_schedule
           (loan_id, employee_id, emi_number, due_month, due_year, emi_amount)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [emi.loan_id, emi.employee_id, emi.emi_number, emi.due_month, emi.due_year, emi.emi_amount]
      );
    }

    await client.query('COMMIT');

    return {
      ...loan,
      employee_name: emp[0].name,
      emi_schedule: schedule,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── Get all loans ────────────────────────────────────────────────────────────
const getAllLoans = async ({ status, employee_id } = {}) => {
  let query = `
    SELECT l.*, e.name AS employee_name, e.designation,
           u.name AS approved_by_name
    FROM loans l
    JOIN employees e ON l.employee_id = e.id
    JOIN users u ON l.approved_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    params.push(status);
    query += ` AND l.status = $${params.length}`;
  }
  if (employee_id) {
    params.push(employee_id);
    query += ` AND l.employee_id = $${params.length}`;
  }

  query += ' ORDER BY l.created_at DESC';
  const { rows } = await db.query(query, params);
  return rows;
};

// ─── Get single loan with full EMI schedule ───────────────────────────────────
const getLoanById = async (id) => {
  const { rows } = await db.query(
    `SELECT l.*, e.name AS employee_name, e.designation,
            u.name AS approved_by_name
     FROM loans l
     JOIN employees e ON l.employee_id = e.id
     JOIN users u ON l.approved_by = u.id
     WHERE l.id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Loan not found');
    err.statusCode = 404;
    throw err;
  }

  const { rows: schedule } = await db.query(
    `SELECT * FROM loan_emi_schedule
     WHERE loan_id = $1
     ORDER BY emi_number ASC`,
    [id]
  );

  return { ...rows[0], emi_schedule: schedule };
};

// ─── Get loans for an employee ────────────────────────────────────────────────
const getLoansByEmployee = async (employeeId) => {
  const { rows } = await db.query(
    `SELECT l.*, u.name AS approved_by_name
     FROM loans l
     JOIN users u ON l.approved_by = u.id
     WHERE l.employee_id = $1
     ORDER BY l.created_at DESC`,
    [employeeId]
  );

  // Attach EMI schedules
  for (const loan of rows) {
    const { rows: schedule } = await db.query(
      `SELECT * FROM loan_emi_schedule
       WHERE loan_id = $1 ORDER BY emi_number ASC`,
      [loan.id]
    );
    loan.emi_schedule = schedule;
  }

  return rows;
};

// ─── Get pending EMIs for a month (used by salary computation) ─────────────────
const getPendingEmisForMonth = async (month, year) => {
  const { rows } = await db.query(
    `SELECT les.*, l.loan_amount, l.outstanding,
            e.name AS employee_name
     FROM loan_emi_schedule les
     JOIN loans l ON les.loan_id = l.id
     JOIN employees e ON les.employee_id = e.id
     WHERE les.due_month = $1
       AND les.due_year  = $2
       AND les.status    = 'pending'
       AND l.status      = 'active'
     ORDER BY les.employee_id ASC`,
    [month, year]
  );
  return rows;
};

// ─── Cancel loan ──────────────────────────────────────────────────────────────
const cancelLoan = async (id, { cancel_reason }, cancelledBy) => {
  const loan = await getLoanById(id);

  if (loan.status !== 'active') {
    const err = new Error(`Cannot cancel a loan with status: ${loan.status}`);
    err.statusCode = 400;
    throw err;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE loans
       SET status = 'cancelled', cancelled_by = $1,
           cancelled_at = NOW(), cancel_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [cancelledBy, cancel_reason, id]
    );

    // Cancel all pending EMIs
    await client.query(
      `UPDATE loan_emi_schedule
       SET status = 'waived'
       WHERE loan_id = $1 AND status = 'pending'`,
      [id]
    );

    await client.query('COMMIT');
    return getLoanById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── Waive a specific EMI ─────────────────────────────────────────────────────
const waiveEmi = async (emiId, { waive_reason }, waivedBy) => {
  const { rows } = await db.query(
    'SELECT * FROM loan_emi_schedule WHERE id = $1',
    [emiId]
  );
  if (!rows.length) {
    const err = new Error('EMI not found');
    err.statusCode = 404;
    throw err;
  }
  if (rows[0].status !== 'pending') {
    const err = new Error(`EMI is already ${rows[0].status}`);
    err.statusCode = 400;
    throw err;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE loan_emi_schedule
       SET status = 'waived', waived_by = $1, waive_reason = $2
       WHERE id = $3`,
      [waivedBy, waive_reason, emiId]
    );

    // Reduce outstanding on loan
    await client.query(
      `UPDATE loans
       SET outstanding = outstanding - $1,
           total_paid  = total_paid  + $1,
           updated_at  = NOW()
       WHERE id = $2`,
      [rows[0].emi_amount, rows[0].loan_id]
    );

    // Check if all EMIs are done — auto-complete loan
    const { rows: pending } = await client.query(
      `SELECT COUNT(*) AS cnt FROM loan_emi_schedule
       WHERE loan_id = $1 AND status = 'pending'`,
      [rows[0].loan_id]
    );

    if (parseInt(pending[0].cnt) === 0) {
      await client.query(
        "UPDATE loans SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [rows[0].loan_id]
      );
    }

    await client.query('COMMIT');
    return { emi_id: emiId, waived: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  createLoan, getAllLoans, getLoanById,
  getLoansByEmployee, getPendingEmisForMonth,
  cancelLoan, waiveEmi,
};