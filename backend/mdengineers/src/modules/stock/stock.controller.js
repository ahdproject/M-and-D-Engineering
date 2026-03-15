const svc          = require('./stock.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const create      = asyncHandler(async (req, res) => {
  const data = await svc.createEntry(req.body, req.user.id);
  return ApiResponse.created(res, data, 'Stock entry saved');
});

const createBulk  = asyncHandler(async (req, res) => {
  const data = await svc.createBulkEntry(req.body, req.user.id);
  return ApiResponse.created(res, data, `${data.saved_count} entries saved`);
});

const getById     = asyncHandler(async (req, res) => {
  const data = await svc.getEntryById(req.params.id);
  return ApiResponse.success(res, data);
});

const getByDate   = asyncHandler(async (req, res) => {
  if (!req.query.date) return ApiResponse.error(res, 'date query param required', 400);
  const data = await svc.getByDate(req.query.date);
  return ApiResponse.success(res, data);
});

const getDateRange = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return ApiResponse.error(res, 'from and to dates required', 400);
  const data = await svc.getByDateRange(from, to);
  return ApiResponse.success(res, { from, to, data });
});

const getMonthly  = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlySummary(month, year);
  return ApiResponse.success(res, data);
});

const getChemicalHistory = asyncHandler(async (req, res) => {
  const { page = 1, per_page = 20 } = req.query;
  const data = await svc.getChemicalHistory(req.params.chemical_id, parseInt(page), parseInt(per_page));
  return ApiResponse.paginated(res, data.history, data.pagination);
});

const update = asyncHandler(async (req, res) => {
  const data = await svc.updateEntry(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Entry updated. Stock chain recalculated.');
});

const remove = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) return ApiResponse.error(res, 'reason is required for deletion', 400);
  const data = await svc.deleteEntry(req.params.id, req.user.id, reason);
  return ApiResponse.success(res, data, 'Entry deleted. Stock chain recalculated.');
});

const getEditLog = asyncHandler(async (req, res) => {
  const data = await svc.getEditLog(req.params.id);
  return ApiResponse.success(res, { entry_id: req.params.id, log: data, total: data.length });
});

module.exports = {
  create, createBulk, getById,
  getByDate, getDateRange, getMonthly,
  getChemicalHistory, update, remove, getEditLog,
};