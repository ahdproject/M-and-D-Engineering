const bcrypt = require('bcryptjs');
const db     = require('../../config/db');
const env    = require('../../config/env');

const createUser = async ({ name, email, password, role_id, permissions }) => {
  // Check duplicate
  const [existing] = await db.query(
    'SELECT id FROM users WHERE email = ?', [email]
  );
  if (existing.length) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, env.bcryptRounds);

  const [result] = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES (?, ?, ?, ?)`,
    [name, email, password_hash, role_id]
  );

  const userId = result.insertId;

  // Insert permissions
  if (permissions && permissions.length) {
    const permValues = permissions.map(p => [userId, p.module, p.can_view ?? true, p.can_edit ?? false]);
    await db.query(
      `INSERT INTO user_permissions (user_id, module, can_view, can_edit) VALUES ?`,
      [permValues]
    );
  }

  return getById(userId);
};

const getAll = async () => {
  const [users] = await db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
            r.name AS role
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ORDER BY u.created_at DESC`
  );

  const [allPerms] = await db.query(
    `SELECT user_id, module, can_view, can_edit FROM user_permissions`
  );

  return users.map(u => ({
    ...u,
    permissions: allPerms
      .filter(p => p.user_id === u.id)
      .reduce((acc, p) => {
        acc[p.module] = { can_view: !!p.can_view, can_edit: !!p.can_edit };
        return acc;
      }, {}),
  }));
};

const getById = async (id) => {
  const [rows] = await db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
            r.name AS role, r.id AS role_id
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const [perms] = await db.query(
    `SELECT module, can_view, can_edit FROM user_permissions WHERE user_id = ?`,
    [id]
  );

  return {
    ...rows[0],
    permissions: perms.reduce((acc, p) => {
      acc[p.module] = { can_view: !!p.can_view, can_edit: !!p.can_edit };
      return acc;
    }, {}),
  };
};

const updatePermissions = async (id, { permissions, is_active }) => {
  // Check user exists
  const [rows] = await db.query('SELECT id FROM users WHERE id = ?', [id]);
  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (typeof is_active !== 'undefined') {
    await db.query('UPDATE users SET is_active = ? WHERE id = ?', [is_active, id]);
  }

  if (permissions && permissions.length) {
    // Upsert permissions
    const permValues = permissions.map(p => [id, p.module, p.can_view, p.can_edit]);
    await db.query(
      `INSERT INTO user_permissions (user_id, module, can_view, can_edit)
       VALUES ?
       ON DUPLICATE KEY UPDATE can_view = VALUES(can_view), can_edit = VALUES(can_edit)`,
      [permValues]
    );
  }

  return getById(id);
};

const deactivate = async (id, requesterId) => {
  if (parseInt(id) === requesterId) {
    const err = new Error('Cannot deactivate your own account');
    err.statusCode = 400;
    throw err;
  }
  await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  return { id: parseInt(id), is_active: false };
};

module.exports = { createUser, getAll, getById, updatePermissions, deactivate };