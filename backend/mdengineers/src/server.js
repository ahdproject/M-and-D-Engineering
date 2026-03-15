const app    = require('./app');
const env    = require('./config/env');
const logger = require('./config/logger');

// Ensure DB connection on boot
require('./config/db');

const server = app.listen(env.port, () => {
  logger.info(`🚀 M&D Engineers ERP running on port ${env.port} [${env.nodeEnv}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled rejection: ${err.message}`);
  server.close(() => process.exit(1));
});