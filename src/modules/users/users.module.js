// Users module: wires GET /me behind the JWT auth guard.
const express = require('express');
const jwtAuth = require('../../common/jwt-auth.middleware.js');
const { getMe } = require('./users.controller.js');

const router = express.Router();
router.get('/me', jwtAuth, getMe);

module.exports = router;
