const svc          = require('./expenses.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse  = require('../../utils/apiResponse');

// ─── Categories ──────────────────────────────────────────────────────────────
const getCategories   = asyncHandler(async (req, res) => {
  const data = await svc.getCategories(req.query.type);
  return ApiResponse.success(res, { categories: data, total: data.length });
});

const createCategory  = asyncHandler(async (req, res) => {
  const data = await svc.createCategory(req.body);
  return ApiResponse.created(res, data, 'Category created');
});

// ─── Cash Expenses ────────────────────────────────────────────────────────────
const createCashExpense = asyncHandler(async (req, res) => {
  const data = await svc.createCashExpense(req.body, req.user.id);
  return ApiResponse.created(res, data, 'Cash expense recorded');
});

const createBulkCashExpense = asyncHandler(async (req, res) => {
  const data = await svc.createBulkCashExpense(req.body, req.user.id);
  return ApiResponse.created(res, data, `${data.saved_count} expenses recorded`);
});

const getCashExpenses = asyncHandler(async (req, res) => {
  const data = await svc.getCashExpenses(req.query);
  return ApiResponse.success(res, { expenses: data, total: data.length });
});

const getMonthlyCashSummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlyCashSummary(month, year);
  return ApiResponse.success(res, data);
});

const updateCashExpense = asyncHandler(async (req, res) => {
  const data = await svc.updateCashExpense(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Expense updated');
});

const deleteCashExpense = asyncHandler(async (req, res) => {
  const data = await svc.deleteCashExpense(req.params.id);
  return ApiResponse.success(res, data, 'Expense deleted');
});

// ─── Utility Bills ────────────────────────────────────────────────────────────
const createUtilityBill = asyncHandler(async (req, res) => {
  const data = await svc.createUtilityBill(req.body, req.user.id);
  return ApiResponse.created(res, data, 'Utility bill saved');
});

const getUtilityBills = asyncHandler(async (req, res) => {
  const data = await svc.getUtilityBills(req.query);
  return ApiResponse.success(res, { bills: data, total: data.length });
});

const markUtilityPaid = asyncHandler(async (req, res) => {
  const data = await svc.markUtilityPaid(req.params.id, req.body, req.user.id);
  return ApiResponse.success(res, data, 'Bill marked as paid');
});

// ─── Vendor Expenses ──────────────────────────────────────────────────────────
const createVendorExpense = asyncHandler(async (req, res) => {
  const data = await svc.createVendorExpense(req.body, req.user.id);
  return ApiResponse.created(res, data, 'Vendor expense recorded');
});

const getVendorExpenses = asyncHandler(async (req, res) => {
  const data = await svc.getVendorExpenses(req.query);
  return ApiResponse.success(res, { expenses: data, total: data.length });
});

const getMonthlyVendorSummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlyVendorSummary(month, year);
  return ApiResponse.success(res, { month, year, vendors: data });
});

const updateVendorExpense = asyncHandler(async (req, res) => {
  const data = await svc.updateVendorExpense(req.params.id, req.body);
  return ApiResponse.success(res, data, 'Vendor expense updated');
});

const deleteVendorExpense = asyncHandler(async (req, res) => {
  const data = await svc.deleteVendorExpense(req.params.id);
  return ApiResponse.success(res, data, 'Vendor expense deleted');
});

// ─── Cash Received ────────────────────────────────────────────────────────────
const recordCashReceived = asyncHandler(async (req, res) => {
  const data = await svc.recordCashReceived(req.body, req.user.id);
  return ApiResponse.created(res, data, 'Cash received recorded');
});

const getCashReceived = asyncHandler(async (req, res) => {
  const data = await svc.getCashReceived(req.query);
  return ApiResponse.success(res, { records: data, total: data.length });
});

// ─── Balance ──────────────────────────────────────────────────────────────────
const setOpeningBalance = asyncHandler(async (req, res) => {
  const data = await svc.setOpeningBalance(req.body, req.user.id);
  return ApiResponse.success(res, data, 'Opening balance set');
});

const getCashBalance = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getCashBalance(month, year);
  return ApiResponse.success(res, data);
});

// ─── Monthly Summary ──────────────────────────────────────────────────────────
const getMonthlySummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  if (!month || !year) return ApiResponse.error(res, 'month and year required', 400);
  const data = await svc.getMonthlySummary(month, year);
  return ApiResponse.success(res, data);
});

module.exports = {
  getCategories, createCategory,
  createCashExpense, createBulkCashExpense,
  getCashExpenses, getMonthlyCashSummary,
  updateCashExpense, deleteCashExpense,
  createUtilityBill, getUtilityBills, markUtilityPaid,
  createVendorExpense, getVendorExpenses,
  getMonthlyVendorSummary, updateVendorExpense, deleteVendorExpense,
  recordCashReceived, getCashReceived,
  setOpeningBalance, getCashBalance,
  getMonthlySummary,
};
