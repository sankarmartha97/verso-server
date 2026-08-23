// Bootstrap: load .env, create the Express app, start listening.
require('dotenv').config();
const app = require('./app.js');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`verso-server listening on :${port}`);
});
