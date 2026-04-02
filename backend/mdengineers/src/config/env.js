require('dotenv').config();

const env = {
  port:    process.env.PORT        || 8000,
  nodeEnv: process.env.NODE_ENV    || 'development',
  db: {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || 'devonpostgresql5',
    name:     process.env.DB_NAME     || 'Raut',
  },
  jwt: {
    secret:         process.env.JWT_SECRET            || 'fallback_secret',
    expiresIn:      process.env.JWT_EXPIRES_IN         || '24h',
    refreshSecret:  process.env.JWT_REFRESH_SECRET     || 'fallback_refresh',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
};

module.exports = env;