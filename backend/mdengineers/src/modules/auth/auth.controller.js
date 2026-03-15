const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return ApiResponse.success(res, result, 'Login successful');
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refreshToken(req.body);
  return ApiResponse.success(res, result, 'Token refreshed');
});

const getProfile = asyncHandler(async (req, res) => {
  const profile = await authService.getProfile(req.user.id);
  return ApiResponse.success(res, profile);
});

const logout = asyncHandler(async (req, res) => {
  // Client discards token — stateless JWT logout
  // For token blacklisting, add Redis later
  return ApiResponse.success(res, {}, 'Logged out successfully');
});

module.exports = { login, refresh, getProfile, logout };