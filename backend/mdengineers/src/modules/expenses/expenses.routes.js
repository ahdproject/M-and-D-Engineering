const router = require('express').Router();
const ctrl   = require('./expenses.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requireRole }       = require('../../middlewares/role.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const {
  validate,
  cashExpenseSchema, bulkCashExpenseSchema,
  utilityBillSchema, markUtilityPaidSchema,
  vendorExpenseSchema, cashReceivedSchema,
  openingBalanceSchema, updateExpenseSchema,
} = require('./expenses.validation');

router.use(authenticate);
router.use(requirePermission('cash_expense', 'view'));

// ─── Summary
router.get('/summary',             ctrl.getMonthlySummary);

// ─── Categories
router.get( '/categories',         ctrl.getCategories);
router.post('/categories',         requireRole('admin','manager'), ctrl.createCategory);

// ─── Cash Expenses
router.post('/cash',               requirePermission('cash_expense','edit'), validate(cashExpenseSchema),      ctrl.createCashExpense);
router.post('/cash/bulk',          requirePermission('cash_expense','edit'), validate(bulkCashExpenseSchema),  ctrl.createBulkCashExpense);
router.get( '/cash',               ctrl.getCashExpenses);
router.get( '/cash/monthly-summary', ctrl.getMonthlyCashSummary);
router.put( '/cash/:id',           requirePermission('cash_expense','edit'), validate(updateExpenseSchema),    ctrl.updateCashExpense);
router.delete('/cash/:id',         requireRole('admin','manager'),                                             ctrl.deleteCashExpense);

// ─── Utility Bills
router.post('/utility',            requirePermission('cash_expense','edit'), validate(utilityBillSchema),      ctrl.createUtilityBill);
router.get( '/utility',            ctrl.getUtilityBills);
router.patch('/utility/:id/paid',  requirePermission('cash_expense','edit'), validate(markUtilityPaidSchema),  ctrl.markUtilityPaid);

// ─── Vendor Expenses
router.post('/vendor',             requirePermission('cash_expense','edit'), validate(vendorExpenseSchema),    ctrl.createVendorExpense);
router.get( '/vendor',             ctrl.getVendorExpenses);
router.get( '/vendor/summary',     ctrl.getMonthlyVendorSummary);
router.put( '/vendor/:id',         requirePermission('cash_expense','edit'),                                   ctrl.updateVendorExpense);
router.delete('/vendor/:id',       requireRole('admin','manager'),                                             ctrl.deleteVendorExpense);

// ─── Cash Received
router.post('/cash-received',      requirePermission('cash_expense','edit'), validate(cashReceivedSchema),     ctrl.recordCashReceived);
router.get( '/cash-received',      ctrl.getCashReceived);

// ─── Cash Balance
router.post('/balance/opening',    requireRole('admin','manager'), validate(openingBalanceSchema),             ctrl.setOpeningBalance);
router.get( '/balance',            ctrl.getCashBalance);

module.exports = router;
