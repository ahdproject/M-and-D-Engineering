const db       = require('../../config/db');
const loansSvc = require('../loans/loans.service');
const XLSX     = require('xlsx');

// ─── Compute salary for one employee ──────────────────────────────────────────────
const computeForEmployee = async (client, employeeId, month, year, computedBy) => {

  // 1. Get salary config
  const { rows: configs } = await client.query(
    `SELECT * FROM salary_config
     WHERE employee_id = $1 AND is_active = true
     LIMIT 1`,
    [employeeId]
  );

  if (!configs.length) {
    throw new Error(`No salary config found for employee ID ${employeeId}. Set hourly rate first.`);
  }

  const config = configs[0];

  // 2. Get attendance for this month
  const { rows: attendance } = await client.query(
    `SELECT status, actual_hours, overtime_hours
     FROM attendance_daily
     WHERE employee_id = $1
       AND EXTRACT(MONTH FROM date) = $2
       AND EXTRACT(YEAR  FROM date) = $3`,
    [employeeId, month, year]
  );

  // 3. Calculate attendance stats
  const stats = attendance.reduce(
    (acc, a) => {
      if (a.status === 'present')   { acc.present++;   acc.total_hours    += parseFloat(a.actual_hours   || config.default_daily_hours); acc.total_overtime += parseFloat(a.overtime_hours || 0); }
      if (a.status === 'half_day')  { acc.half_day++;  acc.total_hours    += parseFloat(a.actual_hours   || config.default_daily_hours / 2); }
      if (a.status === 'absent')    acc.absent++;
      if (a.status === 'leave')     acc.leave_days++;
      if (a.status === 'holiday')   acc.holiday++;
      return acc;
    },
    { present:0, absent:0, half_day:0, leave_days:0, holiday:0, total_hours:0, total_overtime:0 }
  );

  // 4. Calculate salary components
  const base_salary   = parseFloat((stats.total_hours    * config.hourly_rate).toFixed(2));
  const overtime_pay  = parseFloat((stats.total_overtime * config.hourly_rate * config.overtime_multiplier).toFixed(2));
  const gross_salary  = parseFloat((base_salary + overtime_pay).toFixed(2));

  // 5. Get loan deduction for this month
  const { rows: pendingEmis } = await client.query(
    `SELECT les.id AS emi_id, les.emi_amount, les.loan_id
     FROM loan_emi_schedule les
     JOIN loans l ON les.loan_id = l.id
     WHERE les.employee_id = $1
       AND les.due_month   = $2
       AND les.due_year    = $3
       AND les.status      = 'pending'
       AND l.status        = 'active'`,
    [employeeId, month, year]
  );

  const loan_deduction = pendingEmis.reduce((sum, e) => sum + parseFloat(e.emi_amount), 0);
  const net_salary     = parseFloat(Math.max(0, gross_salary - loan_deduction).toFixed(2));

  // 6. Upsert salary record
  const { rows: salaryRows } = await client.query(
    `INSERT INTO salary_monthly
       (employee_id, month, year,
        working_days, present_days, absent_days, half_days, leave_days,
        total_default_hours, total_overtime_hours,
        base_salary, overtime_pay, gross_salary,
        loan_deduction, net_salary,
        computed_by, computed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
     ON CONFLICT (employee_id, month, year)
     DO UPDATE SET
       working_days         = EXCLUDED.working_days,
       present_days         = EXCLUDED.present_days,
       absent_days          = EXCLUDED.absent_days,
       half_days            = EXCLUDED.half_days,
       leave_days           = EXCLUDED.leave_days,
       total_default_hours  = EXCLUDED.total_default_hours,
       total_overtime_hours = EXCLUDED.total_overtime_hours,
       base_salary          = EXCLUDED.base_salary,
       overtime_pay         = EXCLUDED.overtime_pay,
       gross_salary         = EXCLUDED.gross_salary,
       loan_deduction       = EXCLUDED.loan_deduction,
       net_salary           = EXCLUDED.net_salary,
       computed_by          = EXCLUDED.computed_by,
       computed_at          = NOW()
     RETURNING *`,
    [
      employeeId, month, year,
      attendance.length,
      stats.present,
      stats.absent,
      stats.half_day,
      stats.leave_days,
      parseFloat(stats.total_hours.toFixed(1)),
      parseFloat(stats.total_overtime.toFixed(1)),
      base_salary, overtime_pay, gross_salary,
      loan_deduction, net_salary,
      computedBy,
    ]
  );

  const salaryRecord = salaryRows[0];

  // 7. Mark EMIs as deducted and update loan
  for (const emi of pendingEmis) {
    // Mark EMI as deducted
    await client.query(
      `UPDATE loan_emi_schedule
       SET status = 'deducted', deducted_from = $1, deducted_on = NOW()
       WHERE id = $2`,
      [salaryRecord.id, emi.emi_id]
    );

    // Log repayment
    await client.query(
      `INSERT INTO loan_repayment_log
         (loan_id, emi_id, employee_id, amount, month, year, deducted_from, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [emi.loan_id, emi.emi_id, employeeId, emi.emi_amount, month, year, salaryRecord.id, computedBy]
    );

    // Update loan outstanding and total_paid
    await client.query(
      `UPDATE loans
       SET total_paid  = total_paid  + $1,
           outstanding = outstanding - $1,
           updated_at  = NOW()
       WHERE id = $2`,
      [emi.emi_amount, emi.loan_id]
    );

    // Auto-complete loan if all EMIs done
    const { rows: remaining } = await client.query(
      `SELECT COUNT(*) AS cnt FROM loan_emi_schedule
       WHERE loan_id = $1 AND status = 'pending'`,
      [emi.loan_id]
    );

    if (parseInt(remaining[0].cnt) === 0) {
      await client.query(
        "UPDATE loans SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [emi.loan_id]
      );
    }
  }

  return {
    ...salaryRecord,
    emi_deductions: pendingEmis,
  };
};

// ─── Compute salary for month (all or specific employees) ─────────────────────
const computeMonthly = async ({ month, year, employee_ids }, computedBy) => {
  let employees;

  if (employee_ids && employee_ids.length) {
    const { rows } = await db.query(
      'SELECT id, name FROM employees WHERE id = ANY($1) AND is_active = true',
      [employee_ids]
    );
    employees = rows;
  } else {
    const { rows } = await db.query(
      'SELECT id, name FROM employees WHERE is_active = true ORDER BY name'
    );
    employees = rows;
  }

  if (!employees.length) {
    const err = new Error('No active employees found');
    err.statusCode = 404;
    throw err;
  }

  const results = [];
  const errors  = [];

  const client  = await db.connect();
  try {
    await client.query('BEGIN');

    for (const emp of employees) {
      try {
        const result = await computeForEmployee(client, emp.id, month, year, computedBy);
        results.push({ employee_id: emp.id, employee_name: emp.name, ...result });
      } catch (err) {
        errors.push({ employee_id: emp.id, employee_name: emp.name, error: err.message });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const totals = results.reduce(
    (acc, r) => {
      acc.total_gross   += parseFloat(r.gross_salary   || 0);
      acc.total_loan    += parseFloat(r.loan_deduction || 0);
      acc.total_net     += parseFloat(r.net_salary     || 0);
      acc.total_ot_pay  += parseFloat(r.overtime_pay   || 0);
      return acc;
    },
    { total_gross:0, total_loan:0, total_net:0, total_ot_pay:0 }
  );

  return {
    month, year,
    processed:    results.length,
    errors_count: errors.length,
    totals: {
      total_gross_salary:  parseFloat(totals.total_gross.toFixed(2)),
      total_loan_deduction: parseFloat(totals.total_loan.toFixed(2)),
      total_net_salary:    parseFloat(totals.total_net.toFixed(2)),
      total_overtime_pay:  parseFloat(totals.total_ot_pay.toFixed(2)),
    },
    payroll: results,
    errors,
  };
};

// ─── Get payroll for a month ──────────────────────────────────────────────────
const getMonthlyPayroll = async (month, year) => {
  const { rows } = await db.query(
    `SELECT sm.*, e.name AS employee_name, e.designation,
            u.name AS computed_by_name
     FROM salary_monthly sm
     JOIN employees e ON sm.employee_id = e.id
     LEFT JOIN users u ON sm.computed_by = u.id
     WHERE sm.month = $1 AND sm.year = $2
     ORDER BY e.name ASC`,
    [month, year]
  );
  return rows;
};

// ─── Get salary for one employee ──────────────────────────────────────────────
const getEmployeeSalary = async (employeeId, month, year) => {
  const { rows } = await db.query(
    `SELECT sm.*, e.name AS employee_name,
            u.name AS computed_by_name
     FROM salary_monthly sm
     JOIN employees e ON sm.employee_id = e.id
     LEFT JOIN users u ON sm.computed_by = u.id
     WHERE sm.employee_id = $1 AND sm.month = $2 AND sm.year = $3`,
    [employeeId, month, year]
  );

  if (!rows.length) {
    const err = new Error('Salary not computed yet for this employee and month');
    err.statusCode = 404;
    throw err;
  }

  // Get loan deduction breakdown
  const { rows: repayments } = await db.query(
    `SELECT lrl.*, les.emi_number, l.loan_amount, l.tenure_months
     FROM loan_repayment_log lrl
     JOIN loan_emi_schedule les ON lrl.emi_id  = les.id
     JOIN loans l ON lrl.loan_id = l.id
     WHERE lrl.employee_id = $1 AND lrl.month = $2 AND lrl.year = $3`,
    [employeeId, month, year]
  );

  return { ...rows[0], loan_repayments: repayments };
};

// ─── Mark salary as paid ──────────────────────────────────────────────────────
const markPaid = async (id, { paid_on, remarks }, paidBy) => {
  const { rows: existing } = await db.query(
    'SELECT * FROM salary_monthly WHERE id = $1', [id]
  );
  if (!existing.length) {
    const err = new Error('Salary record not found');
    err.statusCode = 404;
    throw err;
  }
  if (existing[0].is_paid) {
    const err = new Error('Salary already marked as paid');
    err.statusCode = 400;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE salary_monthly
     SET is_paid = true, paid_on = $1, paid_by = $2, remarks = $3
     WHERE id = $4
     RETURNING *`,
    [paid_on, paidBy, remarks || null, id]
  );

  return rows[0];
};

// ─── Get repayment history for a loan ────────────────────────────────────────
const getLoanRepaymentHistory = async (loanId) => {
  const { rows } = await db.query(
    `SELECT lrl.*, les.emi_number, e.name AS employee_name, u.name AS recorded_by_name
     FROM loan_repayment_log lrl
     JOIN loan_emi_schedule les ON lrl.emi_id   = les.id
     JOIN employees e           ON lrl.employee_id = e.id
     LEFT JOIN users u          ON lrl.recorded_by = u.id
     WHERE lrl.loan_id = $1
     ORDER BY lrl.recorded_at ASC`,
    [loanId]
  );
  return rows;
};

// ─── Excel Column → DB field mapping ─────────────────────────────────────────
const EXCEL_TO_DB = {
  'Employee ID':                'employee_excel_id',
  'Employee Name':              'employee_name',
  'Department':                 'department',
  'Designation':                'designation',
  'Full Day':                   'full_day',
  'Half Day':                   'half_day',
  'Off Days':                   'off_days',
  'Paid Leave':                 'paid_leave',
  'Paid Days':                  'paid_days',
  'Unpaid Days':                'unpaid_days',
  'Daily Wage':                 'daily_wage',
  'Gross Wages':                'gross_wages',
  'Earned Wages':               'earned_wages',
  'Other Earnings':             'other_earnings',
  'Overtime':                   'overtime',
  'Extras':                     'extras',
  'Gross Earnings':             'gross_earnings',
  'Statutory Compliance':       'statutory_compliance',
  'Penalities':                 'penalties',
  'Loan & Advance':             'loan_advance',
  'Other Deductions':           'other_deductions',
  'Finalized Amount':           'finalized_amount',
  'Basic Salary':               'basic_salary',
  'Dearness Allowance':         'dearness_allowance',
  'House Rent Allowance':       'house_rent_allowance',
  'Transportation Allowance':   'transportation_allowance',
  'Residual Pay':               'residual_pay',
  'Gross Income':               'gross_income',
  'Total Other Earnings':       'total_other_earnings',
  'Provident Fund':             'provident_fund',
  'ESIC Amount':                'esic_amount',
  'Professional Tax':           'professional_tax',
  'Labour Welfare Fund':        'labour_welfare_fund',
  'Total Statutory Compliance': 'total_statutory_compliance',
  'Esic':                       'esic_deduction',
  'Total Deductions':           'total_deductions',
  'Bank Name':                  'bank_name',
  'IFSC Code':                  'ifsc_code',
  'Bank Account No':            'bank_account_no',
  'Bank Branch Name':           'bank_branch_name',
  'Account Type':               'account_type',
};

// ─── Import payroll data from uploaded Excel buffer ───────────────────────────
const importFromExcel = async (buffer, uploadedBy) => {
  const workbook  = XLSX.read(buffer, { type: 'buffer' });
  const sheet     = workbook.Sheets[workbook.SheetNames[0]];
  const rows      = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (!rows.length) throw Object.assign(new Error('Excel file is empty'), { statusCode: 400 });

  const client = await db.connect();
  let imported = 0;
  const errors = [];

  try {
    await client.query('BEGIN');

    for (const row of rows) {
      // Map excel columns to db fields
      const mapped = {};
      for (const [excelKey, dbKey] of Object.entries(EXCEL_TO_DB)) {
        mapped[dbKey] = row[excelKey] ?? null;
      }

      // Try to match employee by name
      const { rows: empRows } = await client.query(
        `SELECT id FROM employees WHERE LOWER(name) = LOWER($1) AND is_active = true LIMIT 1`,
        [mapped.employee_name]
      );

      const employee_id = empRows[0]?.id || null;

      await client.query(
        `INSERT INTO payroll_import (
          employee_id, employee_excel_id, employee_name, department, designation,
          full_day, half_day, off_days, paid_leave, paid_days, unpaid_days,
          daily_wage, gross_wages, earned_wages, other_earnings, overtime, extras,
          gross_earnings, statutory_compliance, penalties, loan_advance,
          other_deductions, finalized_amount, basic_salary, dearness_allowance,
          house_rent_allowance, transportation_allowance, residual_pay,
          gross_income, total_other_earnings, provident_fund, esic_amount,
          professional_tax, labour_welfare_fund, total_statutory_compliance,
          esic_deduction, total_deductions, bank_name, ifsc_code,
          bank_account_no, bank_branch_name, account_type, uploaded_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,
          $33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43
        )`,
        [
          employee_id, mapped.employee_excel_id, mapped.employee_name,
          mapped.department, mapped.designation, mapped.full_day, mapped.half_day,
          mapped.off_days, mapped.paid_leave, mapped.paid_days, mapped.unpaid_days,
          mapped.daily_wage, mapped.gross_wages, mapped.earned_wages,
          mapped.other_earnings, mapped.overtime, mapped.extras,
          mapped.gross_earnings, mapped.statutory_compliance, mapped.penalties,
          mapped.loan_advance, mapped.other_deductions, mapped.finalized_amount,
          mapped.basic_salary, mapped.dearness_allowance, mapped.house_rent_allowance,
          mapped.transportation_allowance, mapped.residual_pay, mapped.gross_income,
          mapped.total_other_earnings, mapped.provident_fund, mapped.esic_amount,
          mapped.professional_tax, mapped.labour_welfare_fund,
          mapped.total_statutory_compliance, mapped.esic_deduction,
          mapped.total_deductions, mapped.bank_name, mapped.ifsc_code,
          mapped.bank_account_no, mapped.bank_branch_name, mapped.account_type,
          uploadedBy,
        ]
      );
      imported++;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { imported, errors };
};

// ─── Get payroll imports history ──────────────────────────────────────────────
const getPayrollImports = async (limit = 100, offset = 0) => {
  const { rows } = await db.query(
    `SELECT pi.*, u.name AS uploaded_by_name, e.name AS employee_name
     FROM payroll_import pi
     LEFT JOIN users u ON pi.uploaded_by = u.id
     LEFT JOIN employees e ON pi.employee_id = e.id
     ORDER BY pi.uploaded_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  const { rows: countRows } = await db.query(
    'SELECT COUNT(*) AS total FROM payroll_import'
  );

  return {
    imports: rows,
    total: parseInt(countRows[0].total),
    limit,
    offset,
  };
};

module.exports = {
  computeMonthly, getMonthlyPayroll,
  getEmployeeSalary, markPaid,
  getLoanRepaymentHistory,
  importFromExcel,
  getPayrollImports,
};