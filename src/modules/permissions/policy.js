// The single place that knows the PRD's capability table (§3.4). Everything
// that authorizes a document action -- REST guards and the sync WebSocket
// gateway alike -- calls can() against a role resolved here, so the two
// surfaces can never drift out of sync with each other.
const pool = require('../../infra/postgres/pool.js');
const PermissionRepository = require('./permission.repository.js');

const permissionRepository = new PermissionRepository(pool);

// 'owner' is never stored in the permissions table -- documents.owner_id is
// the single source of truth for it, resolved below in resolveRole().
const CAPABILITIES = {
  view: ['owner', 'editor', 'commenter', 'viewer'],
  edit: ['owner', 'editor'],
  comment: ['owner', 'editor', 'commenter'],
  share: ['owner'],
  delete: ['owner'],
  manageLink: ['owner'],
  export: ['owner', 'editor', 'commenter', 'viewer'],
};

function can(role, action) {
  const allowed = CAPABILITIES[action];
  if (!allowed) throw new Error(`Unknown permission action: ${action}`);
  return !!role && allowed.includes(role);
}

// Resolves the caller's effective role on a document row (needs at least
// `id` and `owner_id`). Returns null when the caller has no access at all.
async function resolveRole(userId, doc) {
  if (doc.owner_id === userId) return 'owner';
  const grant = await permissionRepository.findForUser(doc.id, userId);
  return grant ? grant.role : null;
}

module.exports = { can, resolveRole, CAPABILITIES, permissionRepository };
