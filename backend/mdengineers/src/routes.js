const router = require('express').Router();

router.use('/auth',       require('./modules/auth/auth.routes'));
router.use('/users',      require('./modules/users/users.routes'));
router.use('/masters/chemicals', require('./modules/masters/masters.routes'));
router.use('/stock',      require('./modules/stock/stock.routes'));
router.use('/employees',  require('./modules/employees/employees.routes'));
router.use('/attendance', require('./modules/attendance/attendance.routes'));
router.use('/loans',      require('./modules/loans/loans.routes'));
router.use('/salary',     require('./modules/salary/salary.routes'));
router.use('/expenses',   require('./modules/expenses/expenses.routes'));

module.exports = router;


module.exports = router;