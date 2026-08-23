// Auth module: wires /auth/* routes to validation, rate limiting, and the controller.
const express = require('express');
const validate = require('../../common/validate.middleware.js');
const rateLimit = require('../../common/rate-limit.middleware.js');
const controller = require('./auth.controller.js');
const {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  requestResetSchema,
  resetSchema,
} = require('../../contracts/schemas/auth.schema.js');

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: 'auth' });

const router = express.Router();

router.post('/signup', authRateLimit, validate(signupSchema), controller.signup);
router.post('/login', authRateLimit, validate(loginSchema), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', controller.logout);
router.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmail);
router.post('/request-reset', authRateLimit, validate(requestResetSchema), controller.requestReset);
router.post('/reset', validate(resetSchema), controller.reset);

module.exports = router;
