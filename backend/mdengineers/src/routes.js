const router = require('express').Router();

router.use('/auth',    require('./modules/auth/auth.routes'));
router.use('/users',   require('./modules/users/users.routes'));
router.use('/masters/chemicals', require('./modules/masters/masters.routes'));
router.use('/stock',   require('./modules/stock/stock.routes'));

// Placeholder — add as you build each module
// router.use('/attendance',   require('./modules/attendance/attendance.routes'));
// router.use('/salary',       require('./modules/salary/salary.routes'));
// router.use('/cash-expense', require('./modules/cashExpense/cashExpense.routes'));
// router.use('/pl',           require('./modules/pl/pl.routes'));
// router.use('/work-orders',  require('./modules/workOrders/workOrders.routes'));

module.exports = router;