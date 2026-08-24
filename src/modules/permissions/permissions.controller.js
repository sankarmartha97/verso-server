// Sharing endpoints: access list, invite by email, change/revoke role,
// link-share. All gated by roles.guard.js's requireRole('share') --
// owner-only per the PRD's capability table -- so every handler here can
// assume req.document/req.role are already resolved and authorized.
const pool = require('../../infra/postgres/pool.js');
const UserRepository = require('../users/user.repository.js');
const permissionsService = require('./permissions.service.js');

const userRepository = new UserRepository(pool);

function toPermissionDTO(row) {
  return {
    id: row.id,
    userId: row.user_id,
    invitedEmail: row.invited_email,
    role: row.role,
    name: row.user_name || null,
    email: row.user_email || row.invited_email,
    avatarUrl: row.user_avatar_url || null,
    pending: !row.user_id,
    createdAt: row.created_at,
  };
}

function toLinkShareDTO(row) {
  if (!row) return null;
  return {
    enabled: row.enabled,
    role: row.role,
    token: row.token,
    expiresAt: row.expires_at,
  };
}

async function list(req, res) {
  const { permissions, linkShare } = await permissionsService.list(req.document.id);
  res.json({
    permissions: permissions.map(toPermissionDTO),
    linkShare: toLinkShareDTO(linkShare),
  });
}

async function invite(req, res) {
  const inviter = await userRepository.findById(req.user.id);
  const permission = await permissionsService.invite(req.document, inviter, req.body);
  res.status(201).json({ permission: toPermissionDTO(permission) });
}

async function changeRole(req, res) {
  const permission = await permissionsService.changeRole(req.document, req.params.permissionId, req.body.role);
  res.json({ permission: toPermissionDTO(permission) });
}

async function revoke(req, res) {
  await permissionsService.revoke(req.document, req.params.permissionId);
  res.status(204).end();
}

async function upsertLinkShare(req, res) {
  const linkShare = await permissionsService.upsertLinkShare(req.document, req.body);
  res.json({ linkShare: toLinkShareDTO(linkShare) });
}

module.exports = { list, invite, changeRole, revoke, upsertLinkShare };
