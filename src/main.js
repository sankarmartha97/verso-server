// Bootstrap: load + validate .env, create the Express app, start listening.
// Uses a raw http.Server (rather than app.listen) so the sync module's
// WebSocket upgrade handler can share the same port as the REST API.
require('dotenv').config();
require('./config/env.js');
const http = require('node:http');
const app = require('./app.js');
const { ensureBucket } = require('./infra/storage/s3.js');
const { attachSyncModule } = require('./modules/sync/sync.module.js');

const port = process.env.PORT || 3000;

ensureBucket().catch((err) => console.warn('ensureBucket failed:', err.message));

const server = http.createServer(app);
attachSyncModule(server);

server.listen(port, () => {
  console.log(`verso-server listening on :${port}`);
});
