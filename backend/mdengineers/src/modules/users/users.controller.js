const usersService = require('./users.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const create = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body);
  return ApiResponse.created(res, user, 'User created successfully');
});

const getAll = asyncHandler(async (req, res) => {
  const users = await usersService.getAll();
  return ApiResponse.success(res, { users, total: users.length });
});

const getById = asyncHandler(async (req, res) => {
  const user = await usersService.getById(req.params.id);
  return ApiResponse.success(res, user);
});

const updatePermissions = asyncHandler(async (req, res) => {
  const user = await usersService.updatePermissions(req.params.id, req.body);
  return ApiResponse.success(res, user, 'Permissions updated');
});

const deactivate = asyncHandler(async (req, res) => {
  const result = await usersService.deactivate(req.params.id, req.user.id);
  return ApiResponse.success(res, result, 'User deactivated');
});

module.exports = { create, getAll, getById, updatePermissions, deactivate };