// Health module: wires the /health route to its controller.
const express = require('express');
const { checkHealth } = require('./health.controller.js');

const router = express.Router();
router.get('/', checkHealth);

module.exports = router;
