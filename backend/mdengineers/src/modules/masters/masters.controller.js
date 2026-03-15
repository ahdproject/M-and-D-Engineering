const svc          = require('./masters.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const getAll      = asyncHandler(async (req, res) => {
  const data = await svc.getAll({ include_inactive: req.query.include_inactive === 'true' });
  return ApiResponse.success(res, { chemicals: data, total: data.length });
});

const getById     = asyncHandler(async (req, res) => {
  const data = await svc.getById(req.params.id);
  return ApiResponse.success(res, data);
});

const create      = asyncHandler(async (req, res) => {
  const data = await svc.create(req.body);
  return ApiResponse.created(res, data, 'Chemical added to master');
});

const update      = asyncHandler(async (req, res) => {
  const data = await svc.update(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Chemical updated');
});

const updateRate  = asyncHandler(async (req, res) => {
  const data = await svc.updateRate(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, `Rate updated for chemical`);
});

const getRateHistory = asyncHandler(async (req, res) => {
  const data = await svc.getRateHistory(req.params.id);
  return ApiResponse.success(res, { history: data });
});

const getRateOnDate  = asyncHandler(async (req, res) => {
  const data = await svc.getRateOnDate(req.params.id, req.query.date);
  return ApiResponse.success(res, data);
});

module.exports = { getAll, getById, create, update, updateRate, getRateHistory, getRateOnDate };