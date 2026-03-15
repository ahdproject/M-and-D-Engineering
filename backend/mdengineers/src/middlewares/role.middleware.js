const ApiResponse = require('../utils/apiResponse');

/**
 * Usage: requireRole('admin')  or  requireRole('admin', 'manager')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return ApiResponse.unauthorized(res);
  }
  if (!roles.includes(req.user.role)) {
    return ApiResponse.forbidden(
      res,
      `This action requires role: ${roles.join(' or ')}`
    );
  }
  next();
};

module.exports = { requireRole };