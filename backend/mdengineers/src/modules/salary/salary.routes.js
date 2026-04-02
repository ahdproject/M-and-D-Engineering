const router = require('express').Router();
const ctrl   = require('./salary.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requireRole }       = require('../../middlewares/role.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const { validate, computeSalarySchema, markPaidSchema } = require('./salary.validation');

router.use(authenticate);

// ✅ POST must be before GET /:id patterns
router.post('/compute',                   requireRole('admin','manager'), validate(computeSalarySchema), ctrl.compute);
router.get( '/payroll',                   requirePermission('salary','view'), ctrl.getMonthlyPayroll);
router.get( '/employee/:employee_id',     requirePermission('salary','view'), ctrl.getEmployeeSalary);
router.patch('/:id/mark-paid',            requireRole('admin','manager'), validate(markPaidSchema), ctrl.markPaid);
router.get( '/loan-repayments/:loan_id',  requirePermission('salary','view'), ctrl.getLoanRepayments);

module.exports = router;