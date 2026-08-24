// Loads a document's Yjs state from Postgres (snapshot + updates since) and
// compacts the update log into a fresh snapshot once it grows past a
// threshold -- the server-side mirror of the y-indexeddb pattern from Phase 3.
const Y = require('yjs');
const syncRepository = require('./sync.repository.js');

const COMPACTION_THRESHOLD = 200;

async function loadDoc(documentId) {
  const ydoc = new Y.Doc();
  const snapshot = await syncRepository.latestSnapshot(documentId);
  let sinceId = 0;

  if (snapshot) {
    Y.applyUpdate(ydoc, snapshot.state, 'persistence');
    sinceId = Number(snapshot.last_update_id);
  }

  const updates = await syncRepository.listUpdatesSince(documentId, sinceId);
  Y.transact(
    ydoc,
    () => {
      for (const row of updates) {
        Y.applyUpdate(ydoc, row.update, 'persistence');
      }
    },
    'persistence',
  );

  const lastUpdateId = updates.length > 0 ? Number(updates[updates.length - 1].id) : sinceId;
  return { ydoc, lastUpdateId, snapshotBaselineId: sinceId };
}

async function compactIfNeeded(documentId, ydoc, lastUpdateId, sinceId) {
  const count = await syncRepository.countUpdatesSince(documentId, sinceId);
  if (count < COMPACTION_THRESHOLD) return sinceId;

  const state = Y.encodeStateAsUpdate(ydoc);
  await syncRepository.saveSnapshot(documentId, state, lastUpdateId);
  await syncRepository.pruneUpdatesUpTo(documentId, lastUpdateId);
  return lastUpdateId;
}

module.exports = { loadDoc, compactIfNeeded, COMPACTION_THRESHOLD };
