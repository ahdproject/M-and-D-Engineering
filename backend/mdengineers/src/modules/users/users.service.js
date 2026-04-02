const bcrypt = require('bcryptjs');
const db     = require('../../config/db');
const env    = require('../../config/env');

const getById = async (id) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
            r.name AS role, r.id AS role_id
     FROM users u JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );
  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { rows: perms } = await db.query(
    `SELECT module, can_view, can_edit FROM user_permissions WHERE user_id = $1`,
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

const createUser = async ({ name, email, password, role_id, permissions }) => {
  const { rows: existing } = await db.query(
    'SELECT id FROM users WHERE email = $1', [email]
  );
  if (existing.length) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    throw err;
  }

  const password_hash = await bcrypt.hash(password, env.bcryptRounds);

  const { rows } = await db.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, email, password_hash, role_id]
  );

  const userId = rows[0].id;

  if (permissions && permissions.length) {
    for (const p of permissions) {
      await db.query(
        `INSERT INTO user_permissions (user_id, module, can_view, can_edit)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, module)
         DO UPDATE SET can_view = $3, can_edit = $4`,
        [userId, p.module, p.can_view ?? true, p.can_edit ?? false]
      );
    }
  }

  return getById(userId);
};

const getAll = async () => {
  const { rows: users } = await db.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
            r.name AS role
     FROM users u
     JOIN roles r ON u.role_id = r.id
     ORDER BY u.created_at DESC`
  );

  const { rows: allPerms } = await db.query(
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

const updatePermissions = async (id, { permissions, is_active }) => {
  const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [id]);
  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  if (typeof is_active !== 'undefined') {
    await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
  }

  if (permissions && permissions.length) {
    for (const p of permissions) {
      await db.query(
        `INSERT INTO user_permissions (user_id, module, can_view, can_edit)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, module)
         DO UPDATE SET can_view = $3, can_edit = $4`,
        [id, p.module, p.can_view, p.can_edit]
      );
    }
  }

  return getById(id);
};

const deactivate = async (id, requesterId) => {
  if (parseInt(id) === requesterId) {
    const err = new Error('Cannot deactivate your own account');
    err.statusCode = 400;
    throw err;
  }
  await db.query('UPDATE users SET is_active = false WHERE id = $1', [id]);
  return { id: parseInt(id), is_active: false };
};

module.exports = { createUser, getAll, getById, updatePermissions, deactivate };