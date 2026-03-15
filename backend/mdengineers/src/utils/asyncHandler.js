/**
 * Wraps async route handlers — eliminates try/catch boilerplate
 * Passes errors to Express error middleware automatically
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;