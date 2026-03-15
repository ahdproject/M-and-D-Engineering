const { Pool } = require('pg');
const env     = require('./env');
const logger  = require('./logger');

const pool = new Pool({
  host:               env.db.host,
  port:               env.db.port,
  user:               env.db.user,
  password:           env.db.password,
  database:           env.db.name,
  ssl:                false,
  connectionTimeoutMillis: 10000,
});

pool.connect()
  .then(() => {
    logger.info(`✅ PostgreSQL connected — ${env.db.name} @ ${env.db.host}`);
  })
  .catch(err => {
    logger.error(`❌ PostgreSQL connection failed: ${err.message}`);
    process.exit(1);
  });

module.exports = pool;
