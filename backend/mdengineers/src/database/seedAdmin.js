require('dotenv').config();
const bcrypt = require('bcryptjs');
const db     = require('../config/db');

const seed = async () => {
  try {
    const hash = await bcrypt.hash('Admin@123', 12);

    await db.query(
      'INSERT INTO users (name, email, password_hash, role_id) VALUES ($1, $2, $3, $4)',
      ['Admin', 'admin@mdengineers.com', hash, 1]
    );

    console.log('✅ Admin user created successfully');
    console.log('📧 Email:    admin@mdengineers.com');
    console.log('🔑 Password: Admin@123');
    process.exit(0);
  } catch (err) {
    if (err.code === '23505') {
      console.log('⚠️  Admin user already exists — skipping');
      process.exit(0);
    }
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

seed();