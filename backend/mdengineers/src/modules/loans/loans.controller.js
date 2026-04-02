const svc          = require('./loans.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const create    = asyncHandler(async (req, res) => {
  const data = await svc.createLoan(req.body, req.user.id);
  return ApiResponse.created(res, data, 'Loan created with EMI schedule');
});

const getAll    = asyncHandler(async (req, res) => {
  const data = await svc.getAllLoans(req.query);
  return ApiResponse.success(res, { loans: data, total: data.length });
});

const getById   = asyncHandler(async (req, res) => {
  const data = await svc.getLoanById(req.params.id);
  return ApiResponse.success(res, data);
});

const getByEmployee = asyncHandler(async (req, res) => {
  const data = await svc.getLoansByEmployee(req.params.employee_id);
  return ApiResponse.success(res, { loans: data, total: data.length });
});

const getPendingEmis = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getPendingEmisForMonth(month, year);
  return ApiResponse.success(res, { month, year, pending_emis: data, total: data.length });
});

const cancel    = asyncHandler(async (req, res) => {
  const data = await svc.cancelLoan(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Loan cancelled');
});

const waiveEmi  = asyncHandler(async (req, res) => {
  const data = await svc.waiveEmi(req.params.emi_id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'EMI waived');
});

module.exports = { create, getAll, getById, getByEmployee, getPendingEmis, cancel, waiveEmi };