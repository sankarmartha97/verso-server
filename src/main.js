// Bootstrap: load + validate .env, create the Express app, start listening.
require('dotenv').config();
require('./config/env.js');
const app = require('./app.js');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`verso-server listening on :${port}`);
});
