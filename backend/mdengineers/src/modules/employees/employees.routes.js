const router = require('express').Router();
const ctrl   = require('./employees.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requireRole }       = require('../../middlewares/role.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const { validate, createEmployeeSchema, updateEmployeeSchema, salaryConfigSchema } = require('./employees.validation');

router.use(authenticate);

router.get(  '/',                        ctrl.getAll);
router.get(  '/:id',                     ctrl.getById);
router.post( '/',    requireRole('admin','manager'), validate(createEmployeeSchema), ctrl.create);
router.put(  '/:id', requireRole('admin','manager'), validate(updateEmployeeSchema), ctrl.update);

// Salary config
router.post( '/:id/salary-config', requireRole('admin','manager'), validate(salaryConfigSchema), ctrl.setSalaryConfig);
router.get(  '/:id/salary-config', ctrl.getSalaryConfig);

module.exports = router;