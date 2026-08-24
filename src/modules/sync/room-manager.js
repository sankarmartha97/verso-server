// In-memory Y.Doc rooms, one per open document, plus membership. Postgres is
// the durable source of truth (via yjs-persistence.service), so a room is
// just a warm cache: hydrated on first join, discarded when the last client
// leaves. Every server instance that has a room open for a given document
// stays in sync with every other one via Redis pub/sub.
const Y = require('yjs');
const { Awareness } = require('y-protocols/awareness');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const yjsPersistence = require('./yjs-persistence.service.js');
const syncRepository = require('./sync.repository.js');
const pubsub = require('../../infra/redis/pubsub.js');
const policy = require('../permissions/policy.js');

const REDIS_ORIGIN = 'redis';
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_PERMISSION = 4; // 2 and 3 are y-websocket's own messageAuth/messageQueryAwareness -- avoid colliding

const rooms = new Map();

function syncChannel(documentId) {
  return `doc:${documentId}:sync`;
}

function awarenessChannel(documentId) {
  return `doc:${documentId}:awareness`;
}

function permissionChannel(documentId) {
  return `doc:${documentId}:permission`;
}

// Awareness always seeds a local entry for its own clientID on construction
// (an empty {} state) -- fine for a real client representing itself, but this
// Awareness instance represents the *room*, not a user, so that entry is
// phantom presence noise every joining client would otherwise see relayed
// back to them. Clearing it immediately matches the reference y-websocket
// server's pattern.
function createRoomAwareness(ydoc) {
  const awareness = new Awareness(ydoc);
  awareness.setLocalState(null);
  return awareness;
}

async function getOrCreateRoom(documentId) {
  if (rooms.has(documentId)) return rooms.get(documentId);

  const { ydoc, lastUpdateId, snapshotBaselineId } = await yjsPersistence.loadDoc(documentId);

  const room = {
    documentId,
    ydoc,
    awareness: createRoomAwareness(ydoc),
    clients: new Set(),
    clientAwarenessIds: new Map(), // ws -> Set<number> of awareness clientIDs it owns
    lastUpdateId,
    snapshotBaselineId,
  };
  rooms.set(documentId, room);

  // Every subsequent local edit lands here (via Y.applyUpdate(ydoc, update, ws)
  // in sync.gateway.js) as well as every redis-relayed edit from other nodes
  // (via Y.applyUpdate(ydoc, update, REDIS_ORIGIN) below) -- one place to
  // decide what "an update happened" means for persistence + fan-out.
  room.ydoc.on('update', (update, origin) => {
    if (origin === REDIS_ORIGIN || origin === 'persistence') {
      broadcastToLocalClients(room, encodeSyncUpdate(update), null);
      return;
    }

    (async () => {
      const id = await syncRepository.appendUpdate(documentId, Buffer.from(update), origin?.userId || null);
      room.lastUpdateId = id;
      await pubsub.publish(syncChannel(documentId), Buffer.from(update));
      broadcastToLocalClients(room, encodeSyncUpdate(update), origin);
      room.snapshotBaselineId = await yjsPersistence.compactIfNeeded(
        documentId,
        room.ydoc,
        room.lastUpdateId,
        room.snapshotBaselineId,
      );
    })().catch((err) => console.error(`sync persist failed for ${documentId}:`, err));
  });

  room.awareness.on('update', ({ added, updated, removed }, origin) => {
    const changed = added.concat(updated, removed);
    const update = awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed);

    if (origin !== REDIS_ORIGIN && origin) {
      // Track which awareness clientIDs belong to this WS connection so they
      // can be cleared out when it disconnects.
      let ids = room.clientAwarenessIds.get(origin);
      if (!ids) {
        ids = new Set();
        room.clientAwarenessIds.set(origin, ids);
      }
      added.concat(updated).forEach((id) => ids.add(id));
      removed.forEach((id) => ids.delete(id));

      pubsub.publish(awarenessChannel(documentId), Buffer.from(update)).catch(() => {});
    }

    broadcastToLocalClients(room, encodeAwarenessMessage(update), origin === REDIS_ORIGIN ? null : origin);
  });

  await pubsub.subscribe(syncChannel(documentId), (buffer) => {
    Y.applyUpdate(room.ydoc, buffer, REDIS_ORIGIN);
  });
  await pubsub.subscribe(awarenessChannel(documentId), (buffer) => {
    awarenessProtocol.applyAwarenessUpdate(room.awareness, buffer, REDIS_ORIGIN);
  });
  await pubsub.subscribe(permissionChannel(documentId), (buffer) => {
    const { userId, role } = JSON.parse(buffer.toString());
    applyPermissionChange(room, userId, role);
  });

  return room;
}

// Live enforcement of a permission change (invite/change/revoke) for
// whichever of that user's connections are open on THIS server instance --
// every instance with the room open runs this independently off the same
// Redis message, so it's correct regardless of which node the affected
// user is connected to. A role that no longer carries view access ejects
// the connection outright; anything else just updates ws.role in place and
// tells the client so it can flip to read-only without reconnecting.
function applyPermissionChange(room, userId, role) {
  for (const client of room.clients) {
    if (client.userId !== userId) continue;

    if (!policy.can(role, 'view')) {
      client.close(4403, 'Access revoked');
      continue;
    }

    client.role = role;
    if (client.readyState === client.OPEN) client.send(encodePermissionMessage(role));
  }
}

function addClient(room, ws) {
  room.clients.add(ws);
}

async function removeClient(room, ws) {
  room.clients.delete(ws);

  const ids = room.clientAwarenessIds.get(ws);
  if (ids && ids.size > 0) {
    awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(ids), null);
  }
  room.clientAwarenessIds.delete(ws);

  if (room.clients.size === 0) {
    rooms.delete(room.documentId);
    await pubsub.unsubscribe(syncChannel(room.documentId));
    await pubsub.unsubscribe(awarenessChannel(room.documentId));
    await pubsub.unsubscribe(permissionChannel(room.documentId));
  }
}

function broadcastToLocalClients(room, encodedMessage, exceptOrigin) {
  for (const client of room.clients) {
    if (client === exceptOrigin) continue;
    if (client.readyState === client.OPEN) client.send(encodedMessage);
  }
}

function encodeSyncUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  encoding.writeVarUint(encoder, 2); // y-protocols/sync messageYjsUpdate subtype
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

function encodeAwarenessMessage(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

function encodePermissionMessage(role) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_PERMISSION);
  encoding.writeVarString(encoder, JSON.stringify({ role }));
  return encoding.toUint8Array(encoder);
}

module.exports = { getOrCreateRoom, addClient, removeClient };
