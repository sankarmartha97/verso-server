// Root app assembly: middleware + module wiring (replaces app.module.js).
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const requestId = require('./common/request-id.middleware.js');
const errorHandler = require('./common/error-handler.middleware.js');
const healthModule = require('./modules/health/health.module.js');
const authModule = require('./modules/auth/auth.module.js');
const usersModule = require('./modules/users/users.module.js');

const app = express();

app.use(requestId);
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/health', healthModule);
app.use('/auth', authModule);
app.use('/', usersModule);

app.use(errorHandler);

module.exports = app;
