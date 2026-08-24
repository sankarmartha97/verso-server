// Document business logic: title defaults/limits, folder-ownership checks,
// the star/recent side-effects, and the soft-delete/restore/purge lifecycle.
// Access is now role-based (Phase 5) rather than strictly owner-only --
// every read/write path resolves the caller's role via permissions/policy.js
// and checks the matching capability, so REST and the sync WebSocket (which
// goes through the same policy module) can never enforce different rules.
const pool = require('../../infra/postgres/pool.js');
const DocumentRepository = require('./document.repository.js');
const FolderRepository = require('../folders/folder.repository.js');
const PermissionRepository = require('../permissions/permission.repository.js');
const policy = require('../permissions/policy.js');
const { ForbiddenError, NotFoundError } = require('../../common/errors.js');

const documentRepository = new DocumentRepository(pool);
const folderRepository = new FolderRepository(pool);
const permissionRepository = new PermissionRepository(pool);

function toSafeDocument(doc, role) {
  return {
    id: doc.id,
    title: doc.title,
    ownerId: doc.owner_id,
    folderId: doc.folder_id,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    lastEditedAt: doc.last_edited_at,
    lastEditedBy: doc.last_edited_by,
    isDeleted: doc.is_deleted,
    deletedAt: doc.deleted_at,
    starred: doc.starred ?? false,
    role: role || 'owner',
  };
}

// Loads a document by id (no owner filter, `starred` computed for this
// specific caller) and checks they have at least `action` capability on it
// -- the shared entry point every non-owner-only method below goes through.
async function loadForUser(userId, id, action) {
  const doc = await documentRepository.findByIdWithStarred(id, userId);
  if (!doc || doc.is_deleted) throw new NotFoundError('Document not found');

  const role = await policy.resolveRole(userId, doc);
  if (!policy.can(role, action)) throw new ForbiddenError('You do not have access to this document');

  return { doc, role };
}

async function assertOwned(ownerId, id) {
  const doc = await documentRepository.findByIdForOwner(id, ownerId);
  if (!doc) throw new NotFoundError('Document not found');
  return doc;
}

async function assertFolderOwned(ownerId, folderId) {
  if (!folderId) return;
  const folder = await folderRepository.findById(folderId);
  if (!folder) throw new NotFoundError('Folder not found');
  if (folder.owner_id !== ownerId) throw new ForbiddenError('Not your folder');
}

async function list(ownerId, { folderId, starred, shared, q, sort, cursor, limit }) {
  if (shared === 'true') {
    const rows = await permissionRepository.listSharedWithUser(ownerId, { limit: limit ? Number(limit) : 50 });
    return { documents: rows.map((row) => toSafeDocument(row, row.permission_role)), nextCursor: null };
  }

  const { rows, nextCursor } = await documentRepository.list({
    ownerId,
    folderId,
    starred: starred === 'true',
    q,
    sort,
    cursor,
    limit,
  });
  return { documents: rows.map((row) => toSafeDocument(row, 'owner')), nextCursor };
}

async function listTrash(ownerId) {
  const { rows } = await documentRepository.list({ ownerId, trashed: true, limit: 100 });
  return rows.map((row) => toSafeDocument(row, 'owner'));
}

async function listRecent(ownerId) {
  const rows = await documentRepository.listRecent(ownerId);
  return rows.map((row) => toSafeDocument(row, 'owner'));
}

async function getById(userId, id) {
  const { doc, role } = await loadForUser(userId, id, 'view');
  await documentRepository.touchRecent(userId, id);
  return toSafeDocument(doc, role);
}

async function create(ownerId, { title, folderId }) {
  await assertFolderOwned(ownerId, folderId);
  const doc = await documentRepository.create({
    title: title?.trim() || 'Untitled',
    owner_id: ownerId,
    folder_id: folderId || null,
    last_edited_by: ownerId,
  });
  return toSafeDocument({ ...doc, starred: false }, 'owner');
}

async function update(userId, id, { title, folderId, starred }) {
  const { doc, role } = await loadForUser(userId, id, starred !== undefined ? 'view' : 'edit');

  const patch = {};
  if (title !== undefined) {
    if (!policy.can(role, 'edit')) throw new ForbiddenError('You do not have edit access to this document');
    patch.title = title.trim() || 'Untitled';
  }
  if (folderId !== undefined) {
    // Folder moves are owner-only: folders aren't shared in this app, so a
    // collaborator has nowhere of their own to move a shared doc into.
    if (role !== 'owner') throw new ForbiddenError('Only the owner can move this document');
    await assertFolderOwned(userId, folderId);
    patch.folder_id = folderId;
  }
  if (Object.keys(patch).length > 0) {
    patch.last_edited_at = new Date();
    patch.last_edited_by = userId;
    patch.updated_at = new Date();
    await documentRepository.update(id, patch);
  }

  if (starred === true) await documentRepository.star(userId, id);
  if (starred === false) await documentRepository.unstar(userId, id);

  const updated = await documentRepository.findByIdWithStarred(id, userId);
  return toSafeDocument(updated, role);
}

async function duplicate(userId, id) {
  await loadForUser(userId, id, 'view');
  const doc = await documentRepository.duplicate(id, userId);
  return toSafeDocument({ ...doc, starred: false }, 'owner');
}

async function remove(ownerId, id) {
  await assertOwned(ownerId, id);
  await documentRepository.softDelete(id);
}

async function restore(ownerId, id) {
  await assertOwned(ownerId, id);
  await documentRepository.restore(id);
}

async function purge(ownerId, id) {
  await assertOwned(ownerId, id);
  await documentRepository.delete(id);
}

module.exports = {
  list,
  listTrash,
  listRecent,
  getById,
  create,
  update,
  duplicate,
  remove,
  restore,
  purge,
};
