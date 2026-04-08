const router   = require('express').Router();
const ctrl     = require('./salary.controller');
const multer   = require('multer');
const { authenticate }      = require('../../middlewares/auth.middleware');
const { requireRole }       = require('../../middlewares/role.middleware');
const { requirePermission } = require('../../middlewares/processAccess.middleware');
const { validate, computeSalarySchema, markPaidSchema } = require('./salary.validation');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/)) cb(null, true);
    else cb(new Error('Only .xlsx or .xls files are allowed'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.use(authenticate);

// ✅ POST must be before GET /:id patterns
router.post('/compute',                   requireRole('admin','manager'), validate(computeSalarySchema), ctrl.compute);
router.post('/upload-payroll',            requireRole('admin','manager'), upload.single('file'), ctrl.uploadPayroll);
router.get( '/payroll-imports',           requirePermission('salary','view'), ctrl.getPayrollImports);
router.get( '/payroll',                   requirePermission('salary','view'), ctrl.getMonthlyPayroll);
router.get( '/employee/:employee_id',     requirePermission('salary','view'), ctrl.getEmployeeSalary);
router.patch('/:id/mark-paid',            requireRole('admin','manager'), validate(markPaidSchema), ctrl.markPaid);
router.get( '/loan-repayments/:loan_id',  requirePermission('salary','view'), ctrl.getLoanRepayments);

module.exports = router;