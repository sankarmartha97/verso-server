// JWT signing/verification for access + refresh tokens, and the shared
// sha256 hashing used for refresh-token-at-rest and email verify/reset tokens.
const jwt = require('jsonwebtoken');
const { createHash, randomBytes } = require('node:crypto');

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function signRefreshToken(sessionId, userId) {
  return jwt.sign({ sub: userId, sid: sessionId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
  REFRESH_TOKEN_TTL_MS,
};
