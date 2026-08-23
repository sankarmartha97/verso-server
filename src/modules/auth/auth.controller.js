const authService = require('./auth.service.js');

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function requestMeta(req) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
}

async function signup(req, res) {
  const { user, accessToken, refreshToken } = await authService.signup(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, accessToken });
}

async function login(req, res) {
  const { user, accessToken, refreshToken } = await authService.login(req.body, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.json({ user, accessToken });
}

async function refresh(req, res) {
  const { accessToken, refreshToken } = await authService.refresh(
    req.cookies[REFRESH_COOKIE],
    requestMeta(req),
  );
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken });
}

async function logout(req, res) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  res.status(204).end();
}

async function verifyEmail(req, res) {
  await authService.verifyEmail(req.body);
  res.json({ success: true });
}

async function requestReset(req, res) {
  await authService.requestReset(req.body);
  res.json({ success: true });
}

async function reset(req, res) {
  await authService.reset(req.body);
  res.json({ success: true });
}

module.exports = { signup, login, refresh, logout, verifyEmail, requestReset, reset };
