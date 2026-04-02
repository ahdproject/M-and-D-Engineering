const { Pool } = require('pg');
const env      = require('./env');
const logger   = require('./logger');

const pool = new Pool({
  host:     env.db.host,
  port:     env.db.port,
  user:     env.db.user,
  password: env.db.password,
  database: env.db.name,
  max:      10,
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 2000,
});

pool.connect()
  .then(client => {
    logger.info(`✅ PostgreSQL connected — ${env.db.name} @ ${env.db.host}`);
    client.release();
  })
  .catch(err => {
    logger.error(`❌ PostgreSQL connection failed: ${err.message}`);
    process.exit(1);
  });

module.exports = pool;