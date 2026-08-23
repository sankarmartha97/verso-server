// Documents module: wires /documents routes behind auth + validation.
// Static sub-paths (/trash, /recent) are registered before the /:id param
// route so they aren't swallowed as an id.
const express = require('express');
const jwtAuth = require('../../common/jwt-auth.middleware.js');
const validate = require('../../common/validate.middleware.js');
const controller = require('./documents.controller.js');
const {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
} = require('../../contracts/schemas/document.schema.js');

const router = express.Router();
router.use(jwtAuth);

router.get('/', validate(listDocumentsQuerySchema, 'query'), controller.list);
router.post('/', validate(createDocumentSchema), controller.create);
router.get('/trash', controller.listTrash);
router.get('/recent', controller.listRecent);
router.get('/:id', controller.getById);
router.patch('/:id', validate(updateDocumentSchema), controller.update);
router.post('/:id/duplicate', controller.duplicate);
router.delete('/:id', controller.remove);
router.post('/:id/restore', controller.restore);
router.delete('/:id/purge', controller.purge);

module.exports = router;
