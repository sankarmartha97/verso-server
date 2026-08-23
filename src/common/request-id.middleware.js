// Assigns a request id used by both logging and the error envelope.
const { randomUUID } = require('node:crypto');

function requestId(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

module.exports = requestId;
