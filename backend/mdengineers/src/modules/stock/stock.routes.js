const router = require('express').Router();
const ctrl   = require('./stock.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const { validate, singleEntrySchema, bulkEntrySchema } = require('./stock.validation');

router.use(authenticate);
router.use(requirePermission('stock', 'view'));

// Data entry
router.post('/entry',         requirePermission('stock','edit'), validate(singleEntrySchema), ctrl.create);
router.post('/entry/bulk',    requirePermission('stock','edit'), validate(bulkEntrySchema),   ctrl.createBulk);
router.put(   '/entry/:id',         requirePermission('stock','edit'),
              validate(updateEntrySchema), ctrl.update);

router.delete('/entry/:id',         requirePermission('stock','edit'), ctrl.remove);

router.get(   '/entry/:id/log',     requirePermission('stock','view'), ctrl.getEditLog);

// Queries
router.get('/date',           ctrl.getByDate);           // ?date=2025-12-04
router.get('/date-range',     ctrl.getDateRange);         // ?from=&to=
router.get('/monthly',        ctrl.getMonthly);           // ?month=12&year=2025
router.get('/chemical/:chemical_id/history', ctrl.getChemicalHistory);

module.exports = router;