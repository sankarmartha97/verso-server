// Express middleware factory: loads the document named by req.params[idParam],
// resolves the caller's role via policy.resolveRole, and 403s unless
// policy.can(role, action) -- the REST half of "everything authorizes through
// policy.js" (the WS gateway does the equivalent for the sync socket).
// Attaches req.document (raw DB row) and req.role for the controller to use,
// so it never has to re-fetch or re-resolve either.
const pool = require('../../infra/postgres/pool.js');
const DocumentRepository = require('../documents/document.repository.js');
const { NotFoundError, ForbiddenError } = require('../../common/errors.js');
const policy = require('./policy.js');

const documentRepository = new DocumentRepository(pool);

function requireRole(action, idParam = 'id') {
  return async function rolesGuard(req, res, next) {
    const doc = await documentRepository.findById(req.params[idParam]);
    if (!doc || doc.is_deleted) throw new NotFoundError('Document not found');

    const role = await policy.resolveRole(req.user.id, doc);
    if (!policy.can(role, action)) throw new ForbiddenError('You do not have access to this document');

    req.document = doc;
    req.role = role;
    next();
  };
}

module.exports = { requireRole };
