// Sharing business logic: invite (existing user vs. pending email invite),
// role changes, revoke, and link-share upsert. Every mutation that changes
// someone's access publishes a live event so an active session for that
// user gets downgraded/ejected in place (see sync.gateway.js's subscription
// to the same channel) -- the PRD's "live downgrade" requirement, not just
// a REST-side rule.
const pool = require('../../infra/postgres/pool.js');
const UserRepository = require('../users/user.repository.js');
const PermissionRepository = require('./permission.repository.js');
const LinkShareRepository = require('./link-share.repository.js');
const { sendMail } = require('../../infra/mail/mailer.js');
const pubsub = require('../../infra/redis/pubsub.js');
const { ValidationError, NotFoundError } = require('../../common/errors.js');

const userRepository = new UserRepository(pool);
const permissionRepository = new PermissionRepository(pool);
const linkShareRepository = new LinkShareRepository(pool);

const CLIENT_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

function permissionChannel(documentId) {
  return `doc:${documentId}:permission`;
}

// Published whenever a specific user's access to a document changes.
// sync.gateway.js/room-manager.js subscribe to this per open room and
// downgrade or eject that user's live connection(s) accordingly. `role` is
// null for a revoke.
async function publishPermissionChange(documentId, userId, role) {
  await pubsub.publish(permissionChannel(documentId), Buffer.from(JSON.stringify({ userId, role })));
}

async function list(documentId) {
  const [permissions, linkShare] = await Promise.all([
    permissionRepository.listForDocument(documentId),
    linkShareRepository.findByDocument(documentId),
  ]);
  return { permissions, linkShare };
}

async function invite(document, inviter, { email, role }) {
  if (email.toLowerCase() === inviter.email.toLowerCase()) {
    throw new ValidationError({ email: 'You already own this document' });
  }

  const existingUser = await userRepository.findByEmail(email);
  const permission = existingUser
    ? await permissionRepository.upsertForUser(document.id, existingUser.id, role)
    : await permissionRepository.upsertForEmail(document.id, email, role);

  const docUrl = `${CLIENT_ORIGIN}/documents/${document.id}`;
  await sendMail({
    to: email,
    subject: `${inviter.name || inviter.email} shared "${document.title}" with you on Verso`,
    html: existingUser
      ? `<p>${inviter.name || inviter.email} gave you ${role} access to "${document.title}".</p><p><a href="${docUrl}">${docUrl}</a></p>`
      : `<p>${inviter.name || inviter.email} shared "${document.title}" with you on Verso. Sign up with this email to get access.</p><p><a href="${CLIENT_ORIGIN}/signup">${CLIENT_ORIGIN}/signup</a></p>`,
  });

  if (existingUser) await publishPermissionChange(document.id, existingUser.id, role);

  return existingUser ? { ...permission, user_email: existingUser.email, user_name: existingUser.name } : permission;
}

async function changeRole(document, permissionId, role) {
  const [existing] = (await permissionRepository.listForDocument(document.id)).filter((p) => p.id === permissionId);
  if (!existing) throw new NotFoundError('Permission not found');

  const updated = existing.user_id
    ? await permissionRepository.upsertForUser(document.id, existing.user_id, role)
    : await permissionRepository.upsertForEmail(document.id, existing.invited_email, role);

  if (existing.user_id) await publishPermissionChange(document.id, existing.user_id, role);

  return { ...updated, user_email: existing.user_email, user_name: existing.user_name };
}

async function revoke(document, permissionId) {
  const [existing] = (await permissionRepository.listForDocument(document.id)).filter((p) => p.id === permissionId);
  if (!existing) throw new NotFoundError('Permission not found');

  await permissionRepository.removeById(document.id, permissionId);
  if (existing.user_id) await publishPermissionChange(document.id, existing.user_id, null);
}

async function upsertLinkShare(document, { enabled, role, expiresAt }) {
  await linkShareRepository.getOrCreate(document.id);
  return linkShareRepository.update(document.id, { enabled, role, expiresAt: expiresAt ? new Date(expiresAt) : null });
}

module.exports = { list, invite, changeRole, revoke, upsertLinkShare };
