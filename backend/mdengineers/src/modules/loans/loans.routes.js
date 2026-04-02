const router = require('express').Router();
const ctrl   = require('./loans.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requireRole }       = require('../../middlewares/role.middleware');
const { validate, createLoanSchema, cancelLoanSchema, waiveEmiSchema } = require('./loans.validation');

router.use(authenticate);

// ✅ Specific routes FIRST — before any /:id routes
router.post( '/',                           requireRole('admin','manager'), validate(createLoanSchema), ctrl.create);
router.get(  '/pending-emis',               ctrl.getPendingEmis);
router.get(  '/employee/:employee_id',      ctrl.getByEmployee);

// ✅ EMI route must be before /:id
router.patch('/emi/:emi_id/waive',          requireRole('admin'), validate(waiveEmiSchema), ctrl.waiveEmi);

// ✅ Generic /:id routes LAST
router.get(  '/',                           ctrl.getAll);
router.get(  '/:id',                        ctrl.getById);
router.patch('/:id/cancel',                 requireRole('admin'), validate(cancelLoanSchema), ctrl.cancel);

module.exports = router;