// Folders module: wires /folders routes behind auth + validation.
const express = require('express');
const jwtAuth = require('../../common/jwt-auth.middleware.js');
const validate = require('../../common/validate.middleware.js');
const controller = require('./folders.controller.js');
const { createFolderSchema, updateFolderSchema } = require('../../contracts/schemas/folder.schema.js');

const router = express.Router();
router.use(jwtAuth);

router.get('/', controller.list);
router.post('/', validate(createFolderSchema), controller.create);
router.patch('/:id', validate(updateFolderSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
