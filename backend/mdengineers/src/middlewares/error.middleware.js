const logger      = require('../config/logger');
const ApiResponse = require('../utils/apiResponse');

const errorMiddleware = (err, req, res, next) => {
  logger.error(`${req.method} ${req.originalUrl} — ${err.message}`, err);

  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    return ApiResponse.error(res, 'Record already exists', 409);
  }

  // MySQL foreign key constraint
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return ApiResponse.error(res, 'Referenced record not found', 422);
  }

  // Joi validation (if thrown manually)
  if (err.isJoi) {
    return ApiResponse.validationError(
      res,
      err.details.map(d => d.message)
    );
  }

  const statusCode = err.statusCode || 500;
  const message    = err.statusCode ? err.message : 'Internal server error';

  return ApiResponse.error(res, message, statusCode);
};

module.exports = { errorMiddleware };