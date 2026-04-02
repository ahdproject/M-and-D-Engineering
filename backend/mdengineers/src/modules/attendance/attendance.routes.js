const router = require('express').Router();
const ctrl   = require('./attendance.controller');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const { validate, markAttendanceSchema, updateAttendanceSchema, addOvertimeSchema } = require('./attendance.validation');

router.use(authenticate);
router.use(requirePermission('attendance', 'view'));

router.post('/',                    requirePermission('attendance','edit'), validate(markAttendanceSchema),   ctrl.mark);
router.get( '/date',                ctrl.getByDate);
router.get( '/monthly',             ctrl.getMonthlyAll);
router.get( '/employee/:employee_id/monthly', ctrl.getMonthlyEmployee);
router.post('/overtime',            requirePermission('attendance','edit'), validate(addOvertimeSchema), ctrl.addOvertime);
router.put( '/:id',                 requirePermission('attendance','edit'), validate(updateAttendanceSchema), ctrl.updateRecord);

module.exports = router;