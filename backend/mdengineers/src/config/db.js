const mysql  = require('mysql2/promise');
const env    = require('./env');
const logger = require('./logger');

const pool = mysql.createPool({
  host:               env.db.host,
  port:               env.db.port,
  user:               env.db.user,
  password:           env.db.password,
  database:           env.db.name,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+05:30',
  dateStrings:        true,
});

pool.getConnection()
  .then(conn => {
    logger.info(`✅ MySQL connected — ${env.db.name} @ ${env.db.host}`);
    conn.release();
  })
  .catch(err => {
    logger.error(`❌ MySQL connection failed: ${err.message}`);
    process.exit(1);
  });

module.exports = pool;