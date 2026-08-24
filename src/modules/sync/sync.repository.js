// Raw queries over document_updates/document_snapshots -- not a BaseRepository
// entity, since this is an append-only log + periodic snapshots, not simple
// id-keyed CRUD.
const pool = require('../../infra/postgres/pool.js');

async function appendUpdate(documentId, update, originUserId) {
  const { rows } = await pool.query(
    'INSERT INTO document_updates (document_id, update, origin) VALUES ($1, $2, $3) RETURNING id',
    [documentId, update, originUserId || null],
  );
  return rows[0].id;
}

async function listUpdatesSince(documentId, sinceId = 0) {
  const { rows } = await pool.query(
    'SELECT id, update FROM document_updates WHERE document_id = $1 AND id > $2 ORDER BY id ASC',
    [documentId, sinceId],
  );
  return rows;
}

async function countUpdatesSince(documentId, sinceId = 0) {
  const { rows } = await pool.query(
    'SELECT count(*)::int AS count FROM document_updates WHERE document_id = $1 AND id > $2',
    [documentId, sinceId],
  );
  return rows[0].count;
}

async function latestSnapshot(documentId) {
  const { rows } = await pool.query(
    'SELECT state, last_update_id FROM document_snapshots WHERE document_id = $1 ORDER BY last_update_id DESC LIMIT 1',
    [documentId],
  );
  return rows[0] || null;
}

async function saveSnapshot(documentId, state, lastUpdateId) {
  await pool.query(
    'INSERT INTO document_snapshots (document_id, state, last_update_id) VALUES ($1, $2, $3)',
    [documentId, state, lastUpdateId],
  );
}

async function pruneUpdatesUpTo(documentId, lastUpdateId) {
  await pool.query('DELETE FROM document_updates WHERE document_id = $1 AND id <= $2', [
    documentId,
    lastUpdateId,
  ]);
}

module.exports = {
  appendUpdate,
  listUpdatesSince,
  countUpdatesSince,
  latestSnapshot,
  saveSnapshot,
  pruneUpdatesUpTo,
};
