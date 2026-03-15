const jwt = require('jsonwebtoken');
const env = require('./env');

const generateAccessToken = (payload) =>
  jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshExpires });

const verifyAccessToken = (token) =>
  jwt.verify(token, env.jwt.secret);

const verifyRefreshToken = (token) =>
  jwt.verify(token, env.jwt.refreshSecret);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};