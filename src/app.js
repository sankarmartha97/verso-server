// Root app assembly: middleware + module wiring (replaces app.module.js).
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const requestId = require('./common/request-id.middleware.js');
const errorHandler = require('./common/error-handler.middleware.js');
const healthModule = require('./modules/health/health.module.js');
const authModule = require('./modules/auth/auth.module.js');
const usersModule = require('./modules/users/users.module.js');
const foldersModule = require('./modules/folders/folders.module.js');
const documentsModule = require('./modules/documents/documents.module.js');
const documentsController = require('./modules/documents/documents.controller.js');
const jwtAuth = require('./common/jwt-auth.middleware.js');
const validate = require('./common/validate.middleware.js');
const { searchQuerySchema } = require('./contracts/schemas/document.schema.js');

const app = express();

app.use(requestId);
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/health', healthModule);
app.use('/auth', authModule);
app.use('/', usersModule);
app.use('/folders', foldersModule);
app.use('/documents', documentsModule);
app.get('/search', jwtAuth, validate(searchQuerySchema, 'query'), documentsController.search);

app.use(errorHandler);

module.exports = app;
