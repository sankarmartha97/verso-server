// Bootstrap: load + validate .env, create the Express app, start listening.
require('dotenv').config();
require('./config/env.js');
const app = require('./app.js');
const { ensureBucket } = require('./infra/storage/s3.js');

const port = process.env.PORT || 3000;

ensureBucket().catch((err) => console.warn('ensureBucket failed:', err.message));

app.listen(port, () => {
  console.log(`verso-server listening on :${port}`);
});
