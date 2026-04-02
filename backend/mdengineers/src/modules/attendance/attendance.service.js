const db = require('../../config/db');

// ─── Mark attendance for multiple employees on a date ────────────────────────
const markAttendance = async ({ date, records }, markedBy) => {
  const saved  = [];
  const errors = [];

  for (const rec of records) {
    try {
      const { rows } = await db.query(
        `INSERT INTO attendance_daily
           (employee_id, date, status, check_in, check_out,
            actual_hours, overtime_hours, ot_remark, marked_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (employee_id, date)
         DO UPDATE SET
           status         = EXCLUDED.status,
           check_in       = EXCLUDED.check_in,
           check_out      = EXCLUDED.check_out,
           actual_hours   = EXCLUDED.actual_hours,
           overtime_hours = EXCLUDED.overtime_hours,
           ot_remark      = EXCLUDED.ot_remark,
           marked_by      = EXCLUDED.marked_by,
           updated_at     = NOW()
         RETURNING *`,
        [
          rec.employee_id, date, rec.status,
          rec.check_in     || null,
          rec.check_out    || null,
          rec.actual_hours || 0,
          rec.overtime_hours || 0,
          rec.ot_remark    || null,
          markedBy,
        ]
      );
      saved.push(rows[0]);
    } catch (err) {
      errors.push({ employee_id: rec.employee_id, error: err.message });
    }
  }

  return {
    date,
    saved_count:  saved.length,
    error_count:  errors.length,
    records:      saved,
    errors,
    summary: {
      present:  saved.filter(r => r.status === 'present').length,
      absent:   saved.filter(r => r.status === 'absent').length,
      half_day: saved.filter(r => r.status === 'half_day').length,
      leave:    saved.filter(r => r.status === 'leave').length,
    },
  };
};

// ─── Get attendance for a specific date ──────────────────────────────────────
const getByDate = async (date) => {
  const { rows } = await db.query(
    `SELECT a.*, e.name AS employee_name, e.designation
     FROM attendance_daily a
     JOIN employees e ON a.employee_id = e.id
     WHERE a.date = $1
     ORDER BY e.name ASC`,
    [date]
  );
  return rows;
};

// ─── Get monthly attendance for one employee ─────────────────────────────────
const getMonthlyForEmployee = async (employeeId, month, year) => {
  const { rows } = await db.query(
    `SELECT a.*, e.name AS employee_name
     FROM attendance_daily a
     JOIN employees e ON a.employee_id = e.id
     WHERE a.employee_id = $1
       AND EXTRACT(MONTH FROM a.date) = $2
       AND EXTRACT(YEAR  FROM a.date) = $3
     ORDER BY a.date ASC`,
    [employeeId, month, year]
  );

  const summary = rows.reduce(
    (acc, r) => {
      acc.total_days++;
      acc[r.status]       = (acc[r.status] || 0) + 1;
      acc.total_hours    += parseFloat(r.actual_hours   || 0);
      acc.total_overtime += parseFloat(r.overtime_hours || 0);
      return acc;
    },
    { total_days:0, present:0, absent:0, half_day:0, leave:0, holiday:0, total_hours:0, total_overtime:0 }
  );

  return { month, year, employee_id: employeeId, records: rows, summary };
};

// ─── Get monthly attendance for ALL employees ─────────────────────────────────
const getMonthlyAll = async (month, year) => {
  const { rows } = await db.query(
    `SELECT
       e.id AS employee_id, e.name AS employee_name, e.designation,
       COUNT(*)                                                          AS total_days,
       COUNT(*) FILTER (WHERE a.status = 'present')                     AS present,
       COUNT(*) FILTER (WHERE a.status = 'absent')                      AS absent,
       COUNT(*) FILTER (WHERE a.status = 'half_day')                    AS half_day,
       COUNT(*) FILTER (WHERE a.status = 'leave')                       AS leave,
       COALESCE(SUM(a.actual_hours),   0)                               AS total_hours,
       COALESCE(SUM(a.overtime_hours), 0)                               AS total_overtime
     FROM employees e
     LEFT JOIN attendance_daily a
       ON a.employee_id = e.id
       AND EXTRACT(MONTH FROM a.date) = $1
       AND EXTRACT(YEAR  FROM a.date) = $2
     WHERE e.is_active = true
     GROUP BY e.id, e.name, e.designation
     ORDER BY e.name ASC`,
    [month, year]
  );
  return rows;
};

// ─── Add / update overtime for a specific employee + date ─────────────────────
const addOvertime = async ({ employee_id, date, overtime_hours, ot_remark }, markedBy) => {
  const { rows: existing } = await db.query(
    'SELECT id FROM attendance_daily WHERE employee_id = $1 AND date = $2',
    [employee_id, date]
  );

  if (!existing.length) {
    const err = new Error('No attendance record found for this employee on this date. Mark attendance first.');
    err.statusCode = 404;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE attendance_daily
     SET overtime_hours = $1, ot_remark = $2, marked_by = $3, updated_at = NOW()
     WHERE employee_id = $4 AND date = $5
     RETURNING *`,
    [overtime_hours, ot_remark, markedBy, employee_id, date]
  );

  return rows[0];
};

// ─── Update single attendance record ─────────────────────────────────────────
const updateRecord = async (id, fields, updatedBy) => {
  const { rows: existing } = await db.query(
    'SELECT * FROM attendance_daily WHERE id = $1', [id]
  );
  if (!existing.length) {
    const err = new Error('Attendance record not found');
    err.statusCode = 404;
    throw err;
  }

  const allowed = ['status','check_in','check_out','actual_hours','overtime_hours','ot_remark'];
  const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  const values    = [...updates.map(([, v]) => v), updatedBy, id];
  const { rows }  = await db.query(
    `UPDATE attendance_daily
     SET ${setClause}, marked_by = $${updates.length + 1}, updated_at = NOW()
     WHERE id = $${updates.length + 2}
     RETURNING *`,
    values
  );
  return rows[0];
};

module.exports = {
  markAttendance, getByDate,
  getMonthlyForEmployee, getMonthlyAll,
  addOvertime, updateRecord,
};