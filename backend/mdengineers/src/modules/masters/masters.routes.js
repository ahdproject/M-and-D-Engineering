const router = require('express').Router();
const ctrl   = require('./masters.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requireRole }       = require('../../middlewares/role.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const { validate, createChemicalSchema, updateRateSchema } = require('./masters.validation');

router.use(authenticate);

router.get( '/',                    requirePermission('masters','view'),  ctrl.getAll);
router.get( '/:id',                 requirePermission('masters','view'),  ctrl.getById);
router.post('/',  requireRole('admin','manager'), validate(createChemicalSchema), ctrl.create);
router.put( '/:id', requireRole('admin','manager'), ctrl.update);

// Rate management
router.put(  '/:id/rate',          requireRole('admin','manager'), validate(updateRateSchema), ctrl.updateRate);
router.get(  '/:id/rate-history',  requirePermission('masters','view'),  ctrl.getRateHistory);
router.get(  '/:id/rate-on-date',  requirePermission('masters','view'),  ctrl.getRateOnDate);

module.exports = router;