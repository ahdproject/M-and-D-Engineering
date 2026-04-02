const svc          = require('./employees.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const getAll    = asyncHandler(async (req, res) => {
  const data = await svc.getAll(req.query.include_inactive === 'true');
  return ApiResponse.success(res, { employees: data, total: data.length });
});

const getById   = asyncHandler(async (req, res) => {
  const data = await svc.getById(req.params.id);
  return ApiResponse.success(res, data);
});

const create    = asyncHandler(async (req, res) => {
  const data = await svc.create(req.body);
  return ApiResponse.created(res, data, 'Employee created');
});

const update    = asyncHandler(async (req, res) => {
  const data = await svc.update(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Employee updated');
});

const setSalaryConfig = asyncHandler(async (req, res) => {
  const data = await svc.setSalaryConfig(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Salary config saved');
});

const getSalaryConfig = asyncHandler(async (req, res) => {
  const data = await svc.getSalaryConfig(req.params.id);
  return ApiResponse.success(res, { history: data });
});

module.exports = { getAll, getById, create, update, setSalaryConfig, getSalaryConfig };