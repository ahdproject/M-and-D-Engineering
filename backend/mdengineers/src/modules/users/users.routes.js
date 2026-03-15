const router = require('express').Router();
const ctrl   = require('./users.controller');
const { authenticate }     = require('../../middlewares/auth.middleware');
const { requireRole }      = require('../../middlewares/role.middleware');
const { requirePermission }= require('../../middlewares/processAccess.middleware');
const { validate, createUserSchema, updatePermissionsSchema } = require('./users.validation');

router.use(authenticate);

// Only admin can manage users
router.post(  '/',           requireRole('admin'), validate(createUserSchema),         ctrl.create);
router.get(   '/',           requireRole('admin'),                                     ctrl.getAll);
router.get(   '/:id',        requireRole('admin'),                                     ctrl.getById);
router.patch( '/:id/permissions', requireRole('admin'), validate(updatePermissionsSchema), ctrl.updatePermissions);
router.delete('/:id',        requireRole('admin'),                                     ctrl.deactivate);

module.exports = router;