const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const logger = require('../src/config/logger');

const runMigration = async () => {
  const client = await db.connect();
  try {
    const sqlPath = path.join(__dirname, '../sql/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    logger.info('Running database migration...');
    await client.query(sql);
    logger.info('✅ Migration completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
  }
};

runMigration();
