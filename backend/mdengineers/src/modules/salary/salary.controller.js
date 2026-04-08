const svc          = require('./salary.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

const compute  = asyncHandler(async (req, res) => {
  const data = await svc.computeMonthly(req.body, req.user.id);
  return ApiResponse.created(res, data, `Salary computed for ${data.processed} employees`);
});

const getMonthlyPayroll = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlyPayroll(month, year);
  return ApiResponse.success(res, { month, year, payroll: data, total: data.length });
});

const getEmployeeSalary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getEmployeeSalary(req.params.employee_id, month, year);
  return ApiResponse.success(res, data);
});

const markPaid = asyncHandler(async (req, res) => {
  const data = await svc.markPaid(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Salary marked as paid');
});

const getLoanRepayments = asyncHandler(async (req, res) => {
  const data = await svc.getLoanRepaymentHistory(req.params.loan_id);
  return ApiResponse.success(res, { repayments: data, total: data.length });
});

const getPayrollImports = asyncHandler(async (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const data = await svc.getPayrollImports(parseInt(limit), parseInt(offset));
  return ApiResponse.success(res, data);
});

// ─── NEW ─────────────────────────────────────────────────────────────────────
const uploadPayroll = asyncHandler(async (req, res) => {
  if (!req.file) return ApiResponse.error(res, 'No file uploaded', 400);
  const data = await svc.importFromExcel(req.file.buffer, req.user.id);
  return ApiResponse.created(res, data, `Imported ${data.imported} records from Excel`);
});

module.exports = { compute, getMonthlyPayroll, getEmployeeSalary, markPaid, getLoanRepayments, getPayrollImports, uploadPayroll };