const ApiResponse = require('../utils/apiResponse');
const db          = require('../config/db');

const requirePermission = (module, action = 'view') => async (req, res, next) => {
  try {
    if (!req.user) return ApiResponse.unauthorized(res);
    if (req.user.role === 'admin') return next();

    const { rows } = await db.query(
      `SELECT can_view, can_edit
       FROM user_permissions
       WHERE user_id = $1 AND module = $2`,
      [req.user.id, module]
    );

    if (!rows.length) {
      return ApiResponse.forbidden(res, `No access to module: ${module}`);
    }

    const perm = rows[0];
    if (action === 'view' && !perm.can_view) {
      return ApiResponse.forbidden(res, `No view access to: ${module}`);
    }
    if (action === 'edit' && !perm.can_edit) {
      return ApiResponse.forbidden(res, `No edit access to: ${module}`);
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requirePermission };