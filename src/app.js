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
const uploadsModule = require('./modules/uploads/uploads.module.js');
const permissionsModule = require('./modules/permissions/permissions.module.js');
const jwtAuth = require('./common/jwt-auth.middleware.js');
const validate = require('./common/validate.middleware.js');
const { searchQuerySchema } = require('./contracts/schemas/document.schema.js');

const app = express();

app.use(requestId);
// CORS_ORIGIN is comma-separated so dev can allow both localhost and a LAN
// IP (e.g. for cross-device testing) at once -- the cors package needs an
// array, not a single string, to match against more than one origin.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/health', healthModule);
app.use('/auth', authModule);
app.use('/', usersModule);
app.use('/folders', foldersModule);
app.use('/documents', documentsModule);
app.use('/documents', permissionsModule);
app.get('/search', jwtAuth, validate(searchQuerySchema, 'query'), documentsController.search);
app.use('/uploads', uploadsModule);

app.use(errorHandler);

module.exports = app;
