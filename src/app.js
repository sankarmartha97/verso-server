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

// Render (like most PaaS) puts the app behind a reverse proxy, so the socket's
// remote address is always the proxy's, not the client's. Without this,
// req.ip is the same for every request, which collapses the per-IP rate
// limiter below into one shared bucket across all users.
app.set('trust proxy', 1);

app.use(requestId);
// When CORS_ORIGIN is unset or '*', reflect the request Origin back so that
// credentialed requests (credentials: 'include') are not blocked by browsers
// — they reject Access-Control-Allow-Origin: * with credentials. In
// production, set CORS_ORIGIN to the exact client origin to lock it down.
const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.trim() !== '*'
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
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
