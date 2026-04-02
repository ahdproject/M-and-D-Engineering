const bcrypt    = require('bcryptjs');
const db        = require('../../config/db');
const jwtConfig = require('../../config/jwt');
const logger    = require('../../config/logger');

const login = async ({ email, password }) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.is_active,
            r.name AS role, r.id AS role_id
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1`,
    [email]
  );

  if (!rows.length) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const user = rows[0];

  if (!user.is_active) {
    const err = new Error('Your account has been deactivated. Contact admin.');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  const { rows: permissions } = await db.query(
    `SELECT module, can_view, can_edit
     FROM user_permissions
     WHERE user_id = $1`,
    [user.id]
  );

  const tokenPayload = { id: user.id, email: user.email, role: user.role };
  const accessToken  = jwtConfig.generateAccessToken(tokenPayload);
  const refreshToken = jwtConfig.generateRefreshToken(tokenPayload);

  await db.query(
    'UPDATE users SET last_login = NOW() WHERE id = $1',
    [user.id]
  );

  logger.info(`User logged in: ${user.email} (${user.role})`);

  return {
    token:         accessToken,
    refresh_token: refreshToken,
    expires_in:    '24h',
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
      permissions: permissions.reduce((acc, p) => {
        acc[p.module] = { can_view: !!p.can_view, can_edit: !!p.can_edit };
        return acc;
      }, {}),
    },
  };
};

const refreshToken = async ({ refresh_token }) => {
  try {
    const decoded = jwtConfig.verifyRefreshToken(refresh_token);

    const { rows } = await db.query(
      `SELECT u.id, u.email, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.id]
    );

    if (!rows.length) {
      const err = new Error('User not found');
      err.statusCode = 401;
      throw err;
    }

    const user     = rows[0];
    const newToken = jwtConfig.generateAccessToken({
      id: user.id, email: user.email, role: user.role,
    });

    return { token: newToken, expires_in: '24h' };
  } catch (err) {
    if (!err.statusCode) {
      err.message    = 'Invalid or expired refresh token';
      err.statusCode = 401;
    }
    throw err;
  }
};

const getProfile = async (userId) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.last_login, u.created_at,
            r.name AS role
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId]
  );

  if (!rows.length) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const { rows: permissions } = await db.query(
    `SELECT module, can_view, can_edit FROM user_permissions WHERE user_id = $1`,
    [userId]
  );

  return {
    ...rows[0],
    permissions: permissions.reduce((acc, p) => {
      acc[p.module] = { can_view: !!p.can_view, can_edit: !!p.can_edit };
      return acc;
    }, {}),
  };
};

module.exports = { login, refreshToken, getProfile };