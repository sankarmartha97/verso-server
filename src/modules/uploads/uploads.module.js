// Uploads module: wires POST /uploads/sign behind auth + validation.
const express = require('express');
const jwtAuth = require('../../common/jwt-auth.middleware.js');
const validate = require('../../common/validate.middleware.js');
const controller = require('./uploads.controller.js');
const { signUploadSchema } = require('../../contracts/schemas/upload.schema.js');

const router = express.Router();
router.use(jwtAuth);

router.post('/sign', validate(signUploadSchema), controller.sign);

module.exports = router;
