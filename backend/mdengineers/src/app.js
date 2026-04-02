const express   = require('express');
const cors      = require('cors');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const routes    = require('./routes');
const { errorMiddleware } = require('./middlewares/error.middleware');
const logger    = require('./config/logger');

const app = express();

app.use(cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(morgan('dev'));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      1000,
  message:  { success: false, message: 'Too many requests' },
}));

app.get('/health', (req, res) =>
  res.json({ success: true, message: 'M&D Engineers ERP API running', timestamp: new Date() })
);

app.use('/api', routes);

// ✅ Express 5 fix — no bare * allowed
app.use('/{*splat}', (req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
);

app.use(errorMiddleware);

module.exports = app;