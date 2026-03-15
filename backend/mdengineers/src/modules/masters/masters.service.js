const db = require('../../config/db');

const getAll = async ({ include_inactive = false } = {}) => {
  const [rows] = await db.query(
    `SELECT id, name, unit, default_rate, hsn_code, gst_rate, is_active, created_at
     FROM chemicals_master
     ${include_inactive ? '' : 'WHERE is_active = 1'}
     ORDER BY name ASC`
  );
  return rows;
};

const getById = async (id) => {
  const [rows] = await db.query(
    'SELECT * FROM chemicals_master WHERE id = ?', [id]
  );
  if (!rows.length) {
    const err = new Error('Chemical not found');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
};

const create = async ({ name, unit, default_rate, hsn_code = '9988', gst_rate = 18 }) => {
  const [result] = await db.query(
    `INSERT INTO chemicals_master (name, unit, default_rate, hsn_code, gst_rate)
     VALUES (?, ?, ?, ?, ?)`,
    [name, unit, default_rate, hsn_code, gst_rate]
  );
  return getById(result.insertId);
};

const update = async (id, fields) => {
  await getById(id); // throws if not found
  const allowed = ['name', 'unit', 'hsn_code', 'gst_rate', 'is_active'];
  const updates = Object.entries(fields)
    .filter(([k]) => allowed.includes(k))
    .map(([k, v]) => ({ k, v }));

  if (!updates.length) {
    const err = new Error('No valid fields to update');
    err.statusCode = 400;
    throw err;
  }

  const setClause = updates.map(u => `${u.k} = ?`).join(', ');
  const values    = [...updates.map(u => u.v), id];
  await db.query(`UPDATE chemicals_master SET ${setClause} WHERE id = ?`, values);
  return getById(id);
};

const updateRate = async (id, { new_rate, effective_from, reason }, changedBy) => {
  const chemical = await getById(id);
  const old_rate = chemical.default_rate;

  const conn = await require('../../config/db').getConnection();
  try {
    await conn.beginTransaction();

    // Close previous rate history record
    await conn.query(
      `UPDATE chemical_rate_history
       SET effective_to = DATE_SUB(?, INTERVAL 1 DAY)
       WHERE chemical_id = ? AND effective_to IS NULL`,
      [effective_from, id]
    );

    // Insert new rate history
    await conn.query(
      `INSERT INTO chemical_rate_history
         (chemical_id, old_rate, new_rate, effective_from, reason, changed_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, old_rate, new_rate, effective_from, reason, changedBy]
    );

    // Update master
    await conn.query(
      'UPDATE chemicals_master SET default_rate = ? WHERE id = ?',
      [new_rate, id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return {
    chemical_id:    id,
    chemical_name:  chemical.name,
    unit:           chemical.unit,
    old_rate,
    new_rate,
    effective_from,
    reason,
  };
};

const getRateHistory = async (id) => {
  await getById(id);
  const [rows] = await db.query(
    `SELECT h.id, h.old_rate, h.new_rate, h.effective_from, h.effective_to,
            h.reason, h.changed_at, u.name AS changed_by
     FROM chemical_rate_history h
     JOIN users u ON h.changed_by = u.id
     WHERE h.chemical_id = ?
     ORDER BY h.effective_from DESC`,
    [id]
  );
  return rows;
};

const getRateOnDate = async (id, date) => {
  const [rows] = await db.query(
    `SELECT new_rate, effective_from, effective_to
     FROM chemical_rate_history
     WHERE chemical_id = ? AND effective_from <= ?
     ORDER BY effective_from DESC
     LIMIT 1`,
    [id, date]
  );

  if (!rows.length) {
    const chemical = await getById(id);
    return {
      rate: chemical.default_rate,
      source: 'master_default',
      valid_from: null,
    };
  }

  return {
    rate:        rows[0].new_rate,
    source:      'rate_history',
    valid_from:  rows[0].effective_from,
    valid_to:    rows[0].effective_to,
  };
};

module.exports = {
  getAll, getById, create, update,
  updateRate, getRateHistory, getRateOnDate
};