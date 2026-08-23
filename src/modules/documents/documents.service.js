// Document business logic: title defaults/limits, folder-ownership checks,
// the star/recent side-effects, and the soft-delete/restore/purge lifecycle.
const pool = require('../../infra/postgres/pool.js');
const DocumentRepository = require('./document.repository.js');
const FolderRepository = require('../folders/folder.repository.js');
const { ForbiddenError, NotFoundError } = require('../../common/errors.js');

const documentRepository = new DocumentRepository(pool);
const folderRepository = new FolderRepository(pool);

function toSafeDocument(doc) {
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
  };
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
  if (shared === 'true') return { documents: [], nextCursor: null };

  const { rows, nextCursor } = await documentRepository.list({
    ownerId,
    folderId,
    starred: starred === 'true',
    q,
    sort,
    cursor,
    limit,
  });
  return { documents: rows.map(toSafeDocument), nextCursor };
}

async function listTrash(ownerId) {
  const { rows } = await documentRepository.list({ ownerId, trashed: true, limit: 100 });
  return rows.map(toSafeDocument);
}

async function listRecent(ownerId) {
  const rows = await documentRepository.listRecent(ownerId);
  return rows.map(toSafeDocument);
}

async function getById(ownerId, id) {
  const doc = await assertOwned(ownerId, id);
  await documentRepository.touchRecent(ownerId, id);
  return toSafeDocument(doc);
}

async function create(ownerId, { title, folderId }) {
  await assertFolderOwned(ownerId, folderId);
  const doc = await documentRepository.create({
    title: title?.trim() || 'Untitled',
    owner_id: ownerId,
    folder_id: folderId || null,
    last_edited_by: ownerId,
  });
  return toSafeDocument({ ...doc, starred: false });
}

async function update(ownerId, id, { title, folderId, starred }) {
  await assertOwned(ownerId, id);

  const patch = {};
  if (title !== undefined) patch.title = title.trim() || 'Untitled';
  if (folderId !== undefined) {
    await assertFolderOwned(ownerId, folderId);
    patch.folder_id = folderId;
  }
  if (Object.keys(patch).length > 0) {
    patch.last_edited_at = new Date();
    patch.last_edited_by = ownerId;
    patch.updated_at = new Date();
    await documentRepository.update(id, patch);
  }

  if (starred === true) await documentRepository.star(ownerId, id);
  if (starred === false) await documentRepository.unstar(ownerId, id);

  const updated = await assertOwned(ownerId, id);
  return toSafeDocument(updated);
}

async function duplicate(ownerId, id) {
  await assertOwned(ownerId, id);
  const doc = await documentRepository.duplicate(id, ownerId);
  return toSafeDocument({ ...doc, starred: false });
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
