const db = require('../../config/db');

const getAll = async (include_inactive = false) => {
  const { rows } = await db.query(
    `SELECT e.id, e.name, e.phone, e.designation, e.joining_date,
            e.is_active, e.created_at,
            sc.hourly_rate, sc.default_daily_hours, sc.overtime_multiplier
     FROM employees e
     LEFT JOIN salary_config sc ON sc.employee_id = e.id AND sc.is_active = true
     ${include_inactive ? '' : 'WHERE e.is_active = true'}
     ORDER BY e.name ASC`
  );
  return rows;
};

const getById = async (id) => {
  const { rows } = await db.query(
    `SELECT e.*, sc.hourly_rate, sc.default_daily_hours,
            sc.overtime_multiplier, sc.effective_from AS salary_from
     FROM employees e
     LEFT JOIN salary_config sc ON sc.employee_id = e.id AND sc.is_active = true
     WHERE e.id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('Employee not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const create = async ({ name, phone, designation, joining_date }) => {
  const { rows } = await db.query(
    `INSERT INTO employees (name, phone, designation, joining_date)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, phone || null, designation || null, joining_date || null]
  );
  return getById(rows[0].id);
};

const update = async (id, fields) => {
  await getById(id);
  const allowed = ['name', 'phone', 'designation', 'joining_date', 'is_active'];
  const updates = Object.entries(fields).filter(([k]) => allowed.includes(k));
  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }
  const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  await db.query(
    `UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = $${updates.length + 1}`,
    [...updates.map(([, v]) => v), id]
  );
  return getById(id);
};

const setSalaryConfig = async (employeeId, config, setBy) => {
  await getById(employeeId);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Deactivate old config
    await client.query(
      'UPDATE salary_config SET is_active = false WHERE employee_id = $1',
      [employeeId]
    );

    // Insert new config
    const { rows } = await client.query(
      `INSERT INTO salary_config
         (employee_id, default_daily_hours, hourly_rate, overtime_multiplier, effective_from, set_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        employeeId,
        config.default_daily_hours,
        config.hourly_rate,
        config.overtime_multiplier || 1.5,
        config.effective_from,
        setBy,
      ]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getSalaryConfig = async (employeeId) => {
  const { rows } = await db.query(
    `SELECT * FROM salary_config
     WHERE employee_id = $1
     ORDER BY effective_from DESC`,
    [employeeId]
  );
  return rows;
};

module.exports = { getAll, getById, create, update, setSalaryConfig, getSalaryConfig };