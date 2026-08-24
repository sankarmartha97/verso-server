// WebSocket message handling for one connection: auth -> join room -> sync
// handshake -> relay y-protocols/sync + awareness messages per the standard
// message-type-byte protocol (wire-compatible with the y-websocket client).
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const pool = require('../../infra/postgres/pool.js');
const { verifyAccessToken } = require('../auth/token.service.js');
const roomManager = require('./room-manager.js');

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

  const { rows } = await pool.query(
    'SELECT 1 FROM documents WHERE id = $1 AND owner_id = $2 AND is_deleted = false',
    [documentId, payload.sub],
  );
  if (rows.length === 0) return null;

  return payload.sub;
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

function handleMessage(ws, room, data) {
  const decoder = decoding.createDecoder(data);
  const messageType = decoding.readVarUint(decoder);

  switch (messageType) {
    case MESSAGE_SYNC: {
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
  const userId = await authenticate(documentId, token);
  if (!userId) {
    ws.close(4401, 'Unauthorized');
    return;
  }
  ws.userId = userId;

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
