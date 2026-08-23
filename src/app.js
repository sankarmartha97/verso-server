// Root app assembly: middleware + module wiring (replaces app.module.js).
const express = require('express');
const cors = require('cors');
const healthModule = require('./modules/health/health.module.js');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.use('/health', healthModule);

module.exports = app;
