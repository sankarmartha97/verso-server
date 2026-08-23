// Folder business logic: depth guard (max 6), duplicate-name handling
// (append " (2)"), ownership checks, and cycle prevention on move.
const pool = require('../../infra/postgres/pool.js');
const FolderRepository = require('./folder.repository.js');
const { ForbiddenError, NotFoundError, ValidationError } = require('../../common/errors.js');

const folderRepository = new FolderRepository(pool);
const MAX_DEPTH = 6;

function toSafeFolder(folder) {
  return {
    id: folder.id,
    name: folder.name,
    parentId: folder.parent_id,
    ownerId: folder.owner_id,
    createdAt: folder.created_at,
  };
}

async function assertOwned(ownerId, folderId) {
  const folder = await folderRepository.findById(folderId);
  if (!folder) throw new NotFoundError('Folder not found');
  if (folder.owner_id !== ownerId) throw new ForbiddenError('Not your folder');
  return folder;
}

async function depthOf(folderId) {
  let depth = 0;
  let current = folderId;
  while (current) {
    const folder = await folderRepository.findById(current);
    if (!folder) break;
    depth += 1;
    current = folder.parent_id;
    if (depth > MAX_DEPTH + 1) break; // safety valve against corrupt data
  }
  return depth;
}

async function assertNotDescendant(folderId, candidateAncestorId) {
  let current = candidateAncestorId;
  while (current) {
    if (current === folderId) {
      throw new ValidationError({ parentId: ['Cannot move a folder into its own descendant'] });
    }
    const folder = await folderRepository.findById(current);
    current = folder ? folder.parent_id : null;
  }
}

async function uniquifyName(ownerId, parentId, name, excludeId) {
  const siblings = (await folderRepository.findSiblings(ownerId, parentId)).filter(
    (folder) => folder.id !== excludeId,
  );
  const taken = new Set(siblings.map((folder) => folder.name));
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n += 1;
  return `${name} (${n})`;
}

async function list(ownerId) {
  const folders = await folderRepository.findByOwner(ownerId);
  return folders.map(toSafeFolder);
}

async function create(ownerId, { name, parentId }) {
  let depth = 0;
  if (parentId) {
    const parent = await assertOwned(ownerId, parentId);
    depth = (await depthOf(parent.id)) + 1;
    if (depth > MAX_DEPTH) {
      throw new ValidationError({ parentId: [`Folders can nest at most ${MAX_DEPTH} levels deep`] });
    }
  }

  const uniqueName = await uniquifyName(ownerId, parentId || null, name);
  const folder = await folderRepository.create({
    name: uniqueName,
    parent_id: parentId || null,
    owner_id: ownerId,
  });
  return toSafeFolder(folder);
}

async function update(ownerId, id, { name, parentId }) {
  const folder = await assertOwned(ownerId, id);
  const patch = {};

  if (parentId !== undefined && parentId !== folder.parent_id) {
    if (parentId) {
      const parent = await assertOwned(ownerId, parentId);
      await assertNotDescendant(id, parent.id);
      const depth = (await depthOf(parent.id)) + 1;
      if (depth > MAX_DEPTH) {
        throw new ValidationError({ parentId: [`Folders can nest at most ${MAX_DEPTH} levels deep`] });
      }
    }
    patch.parent_id = parentId || null;
  }

  if (name !== undefined && name !== folder.name) {
    patch.name = await uniquifyName(
      ownerId,
      patch.parent_id !== undefined ? patch.parent_id : folder.parent_id,
      name,
      id,
    );
  }

  if (Object.keys(patch).length === 0) return toSafeFolder(folder);
  const updated = await folderRepository.update(id, patch);
  return toSafeFolder(updated);
}

async function remove(ownerId, id) {
  await assertOwned(ownerId, id);
  await folderRepository.delete(id);
}

module.exports = { list, create, update, remove };
