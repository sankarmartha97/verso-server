// Attaches the raw WebSocket server to an existing HTTP server, routed by
// upgrade path -- not an Express router, since Express never sees these
// connections after the protocol switch.
const { WebSocketServer } = require('ws');
const url = require('node:url');
const gateway = require('./sync.gateway.js');

function attachSyncModule(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    const match = pathname.match(/^\/sync\/([0-9a-f-]{36})$/i);
    if (!match) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, match[1], query.token);
    });
  });

  wss.on('connection', (ws, documentId, token) => {
    gateway.handleConnection(ws, documentId, token).catch((err) => {
      console.error(`sync connection error for ${documentId}:`, err);
      ws.close(1011, 'Internal error');
    });
  });

  return wss;
}

module.exports = { attachSyncModule };
