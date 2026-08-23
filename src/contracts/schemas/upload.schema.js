// Upload request validators. Images only for now (types png/jpeg/gif/webp,
// max 20MB per the PRD). SVG excluded until a sanitizer is in place -- SVGs
// can carry executable script content.
const { z } = require('zod');

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 20 * 1024 * 1024;

const signUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(ALLOWED_TYPES),
  size: z.number().int().positive().max(MAX_SIZE_BYTES),
});

module.exports = { signUploadSchema, ALLOWED_TYPES, MAX_SIZE_BYTES };
