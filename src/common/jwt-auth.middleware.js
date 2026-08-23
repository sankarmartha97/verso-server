// Verifies the Authorization: Bearer access token and attaches req.user.
const { AuthError } = require('./errors.js');
const { verifyAccessToken } = require('../modules/auth/token.service.js');

function jwtAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AuthError('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new AuthError('Invalid or expired access token'));
  }
}

module.exports = jwtAuth;
