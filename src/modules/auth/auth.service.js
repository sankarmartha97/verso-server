// Auth business logic: signup, login, refresh rotation + reuse detection,
// logout, email verification, password reset. Controllers stay thin; this is
// where the rules live.
const argon2 = require('argon2');
const pool = require('../../infra/postgres/pool.js');
const UserRepository = require('../users/user.repository.js');
const { toSafeUser } = UserRepository;
const SessionRepository = require('./session.repository.js');
const PermissionRepository = require('../permissions/permission.repository.js');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
  REFRESH_TOKEN_TTL_MS,
} = require('./token.service.js');
const { sendMail } = require('../../infra/mail/mailer.js');
const { AuthError, ConflictError, NotFoundError } = require('../../common/errors.js');

const userRepository = new UserRepository(pool);
const sessionRepository = new SessionRepository(pool);
const permissionRepository = new PermissionRepository(pool);

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1h
const CLIENT_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

async function createSession(userId, meta) {
  const placeholder = hashToken(randomToken());
  const session = await sessionRepository.create({
    user_id: userId,
    refresh_token_hash: placeholder,
    user_agent: meta.userAgent || null,
    ip: meta.ip || null,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  const refreshToken = signRefreshToken(session.id, userId);
  await sessionRepository.update(session.id, { refresh_token_hash: hashToken(refreshToken) });

  return refreshToken;
}

async function issueTokens(user, meta) {
  const accessToken = signAccessToken(user);
  const refreshToken = await createSession(user.id, meta);
  return { accessToken, refreshToken };
}

async function signup({ email, password, name }, meta) {
  const existing = await userRepository.findByEmail(email);
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const verifyToken = randomToken();

  const user = await userRepository.create({
    email,
    password_hash: passwordHash,
    name,
    email_verify_token_hash: hashToken(verifyToken),
    email_verify_expires_at: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
  });

  try {
    await sendMail({
      to: user.email,
      subject: 'Verify your Verso account',
      html: `<p>Welcome to Verso. Verify your email:</p><p><a href="${CLIENT_ORIGIN}/verify-email?token=${verifyToken}">${CLIENT_ORIGIN}/verify-email?token=${verifyToken}</a></p>`,
    });
  } catch (err) {
    // Account creation shouldn't fail because the mail provider is down or
    // unconfigured -- login doesn't check email_verified, so this is
    // non-blocking by design; the user just won't have gotten the email.
    console.error('signup: failed to send verification email', err);
  }

  // Any documents shared to this email address before the account existed
  // (a pending invite, permissions.user_id NULL) become real grants now.
  await permissionRepository.resolvePendingInvites(user.id, user.email);

  const tokens = await issueTokens(user, meta);
  return { user: toSafeUser(user), ...tokens };
}

async function login({ email, password }, meta) {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new AuthError('Invalid email or password');

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) throw new AuthError('Invalid email or password');

  const tokens = await issueTokens(user, meta);
  return { user: toSafeUser(user), ...tokens };
}

async function refresh(refreshToken, meta) {
  if (!refreshToken) throw new AuthError('No refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AuthError('Invalid or expired refresh token');
  }

  const session = await sessionRepository.findById(payload.sid);
  if (!session) {
    // Session gone (already logged out or already rotated away) but the token
    // still verifies -- possible reuse of a stale token. Revoke everything for
    // this user as a precaution.
    await sessionRepository.deleteAllForUser(payload.sub);
    throw new AuthError('Session no longer valid');
  }

  if (session.refresh_token_hash !== hashToken(refreshToken)) {
    // Token verifies and the session exists, but the hash doesn't match the
    // current one on file -- this is a rotated-out token being replayed.
    // Treat as theft: revoke every session for this user.
    await sessionRepository.deleteAllForUser(payload.sub);
    throw new AuthError('Refresh token reuse detected; all sessions revoked');
  }

  const user = await userRepository.findById(payload.sub);
  if (!user) throw new AuthError('User no longer exists');

  const newRefreshToken = signRefreshToken(session.id, user.id);
  await sessionRepository.update(session.id, {
    refresh_token_hash: hashToken(newRefreshToken),
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    user_agent: meta.userAgent || session.user_agent,
    ip: meta.ip || session.ip,
  });

  return { accessToken: signAccessToken(user), refreshToken: newRefreshToken };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  try {
    const payload = verifyRefreshToken(refreshToken);
    await sessionRepository.delete(payload.sid);
  } catch {
    // Already invalid/expired -- nothing to clean up.
  }
}

async function verifyEmail({ token }) {
  const user = await userRepository.findByEmailVerifyTokenHash(hashToken(token));
  if (!user) throw new NotFoundError('Verification link is invalid or has expired');

  await userRepository.update(user.id, {
    email_verified: true,
    email_verify_token_hash: null,
    email_verify_expires_at: null,
  });
}

async function requestReset({ email }) {
  const user = await userRepository.findByEmail(email);
  if (!user) return; // no user-enumeration: succeed silently either way

  const resetToken = randomToken();
  await userRepository.update(user.id, {
    reset_token_hash: hashToken(resetToken),
    reset_token_expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your Verso password',
      html: `<p>Reset your password:</p><p><a href="${CLIENT_ORIGIN}/reset-password?token=${resetToken}">${CLIENT_ORIGIN}/reset-password?token=${resetToken}</a></p>`,
    });
  } catch (err) {
    // Matches the no-user-enumeration contract above: this endpoint always
    // succeeds from the caller's perspective, mail provider issues included.
    console.error('requestReset: failed to send reset email', err);
  }
}

async function reset({ token, password }) {
  const user = await userRepository.findByResetTokenHash(hashToken(token));
  if (!user) throw new NotFoundError('Reset link is invalid or has expired');

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await userRepository.update(user.id, {
    password_hash: passwordHash,
    reset_token_hash: null,
    reset_token_expires_at: null,
  });

  // Invalidate other sessions on password change.
  await sessionRepository.deleteAllForUser(user.id);
}

module.exports = { signup, login, refresh, logout, verifyEmail, requestReset, reset };
