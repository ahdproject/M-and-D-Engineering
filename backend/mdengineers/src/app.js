const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const routes       = require('./routes');
const { errorMiddleware } = require('./middlewares/error.middleware');
const logger       = require('./config/logger');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin:      process.env.FRONTEND_URL || '*',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE'],
}));

// Rate limiting — 100 requests per 15 mins per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { success: false, message: 'Too many requests, try again later' },
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Health check
app.get('/health', (req, res) =>
  res.json({ success: true, message: 'M&D Engineers ERP API running', timestamp: new Date() })
);

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

// Global error handler
app.use(errorMiddleware);

module.exports = app;