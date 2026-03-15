const router   = require('express').Router();
const ctrl     = require('./auth.controller');
const { validate, loginSchema, refreshSchema } = require('./auth.validation');
const { authenticate } = require('../../middlewares/auth.middleware');

// POST /api/auth/login
router.post('/login',   validate(loginSchema),   ctrl.login);

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), ctrl.refresh);

// GET  /api/auth/profile   — requires token
router.get('/profile',  authenticate,            ctrl.getProfile);

// POST /api/auth/logout    — requires token
router.post('/logout',  authenticate,            ctrl.logout);

module.exports = router;