// Auth request validators. Source of truth — copied into the client via
// scripts/export-contracts.mjs + verso-client/scripts/pull-contracts.mjs.
//
// Password policy: min length 10 per the PRD. The PRD also calls for a zxcvbn
// strength check; deferred (large wordlist dependency, not blocking Phase 1).
const { z } = require('zod');

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().min(1).max(200),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const requestResetSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(10),
});

module.exports = {
  signupSchema,
  loginSchema,
  verifyEmailSchema,
  requestResetSchema,
  resetSchema,
};
