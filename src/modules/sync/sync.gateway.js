// WebSocket message handling for one connection: auth -> join room -> sync
// handshake -> relay y-protocols/sync + awareness messages per the standard
// message-type-byte protocol (wire-compatible with the y-websocket client).
// Authorization goes through permissions/policy.js -- the same module the
// REST routes use -- so a role change is enforced identically on both
// surfaces, and an incoming write is rejected here (not just hidden by the
// client's UI) if the connection's role doesn't carry edit capability.
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const pool = require('../../infra/postgres/pool.js');
const DocumentRepository = require('../documents/document.repository.js');
const policy = require('../permissions/policy.js');
const { verifyAccessToken } = require('../auth/token.service.js');
const roomManager = require('./room-manager.js');

const documentRepository = new DocumentRepository(pool);

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

async function authenticate(documentId, token) {
  if (!token) return null;

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }

  const doc = await documentRepository.findById(documentId);
  if (!doc || doc.is_deleted) return null;

  const role = await policy.resolveRole(payload.sub, doc);
  if (!policy.can(role, 'view')) return null;

  return { userId: payload.sub, role };
}

function sendSyncStep1(ws, ydoc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, ydoc);
  ws.send(encoding.toUint8Array(encoder));
}

function sendAwarenessStates(ws, awareness) {
  const states = awareness.getStates();
  if (states.size === 0) return;

  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(states.keys())),
  );
  ws.send(encoding.toUint8Array(encoder));
}

// A sync message's second varUint (its y-protocols/sync subtype) tells apart
// a read (step1: "here's my state vector") from a write (step2/update:
// "here's content to merge in"). Peeked from a fresh decoder over the same
// buffer so the real dispatch below still reads from byte zero.
function isSyncWrite(data) {
  const peek = decoding.createDecoder(data);
  decoding.readVarUint(peek); // outer message type, already known to be MESSAGE_SYNC
  const subtype = decoding.readVarUint(peek);
  return subtype === 1 || subtype === 2; // messageYjsSyncStep2 | messageYjsUpdate
}

function handleMessage(ws, room, data) {
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MESSAGE_SYNC: {
      if (isSyncWrite(data) && !policy.can(ws.role, 'edit')) return; // defense in depth: the client UI already blocks this
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, ws);
      if (encoding.length(encoder) > 1) ws.send(encoding.toUint8Array(encoder));
      break;
    }
    case MESSAGE_AWARENESS:
      awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), ws);
      break;
  }
}

async function handleConnection(ws, documentId, token) {
  const auth = await authenticate(documentId, token);
  if (!auth) {
    ws.close(4401, 'Unauthorized');
    return;
  }
  ws.userId = auth.userId;
  ws.role = auth.role;

  const room = await roomManager.getOrCreateRoom(documentId);
  roomManager.addClient(room, ws);

  sendSyncStep1(ws, room.ydoc);
  sendAwarenessStates(ws, room.awareness);

  ws.on('message', (data) => {
    try {
      handleMessage(ws, room, data);
    } catch (err) {
      console.error(`sync message error for ${documentId}:`, err);
    }
  });

  ws.on('close', () => {
    roomManager.removeClient(room, ws);
  });
}

module.exports = { handleConnection };
