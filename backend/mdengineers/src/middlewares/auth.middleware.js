const { verifyAccessToken } = require('../config/jwt');
const ApiResponse            = require('../utils/apiResponse');
const db                     = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'No token provided');
    }

    const token   = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.is_active, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return ApiResponse.unauthorized(res, 'User not found or deactivated');
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Token expired');
    }
    return ApiResponse.unauthorized(res, 'Invalid token');
  }
};

module.exports = { authenticate };