const router = require('express').Router();
const ctrl   = require('./stock.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');

// ✅ All three schemas imported
const {
  validate,
  singleEntrySchema,
  bulkEntrySchema,
  updateEntrySchema,
} = require('./stock.validation');

router.use(authenticate);
router.use(requirePermission('stock', 'view'));

// Data entry
router.post(  '/entry',                    requirePermission('stock', 'edit'), validate(singleEntrySchema), ctrl.create);
router.post(  '/entry/bulk',               requirePermission('stock', 'edit'), validate(bulkEntrySchema),   ctrl.createBulk);
router.put(   '/entry/:id',                requirePermission('stock', 'edit'), validate(updateEntrySchema), ctrl.update);
router.delete('/entry/:id',                requirePermission('stock', 'edit'), ctrl.remove);
router.get(   '/entry/:id',                ctrl.getById);
router.get(   '/entry/:id/log',            ctrl.getEditLog);

// Queries
router.get('/date',                        ctrl.getByDate);
router.get('/date-range',                  ctrl.getDateRange);
router.get('/monthly',                     ctrl.getMonthly);
router.get('/chemical/:chemical_id/history', ctrl.getChemicalHistory);

module.exports = router;