// Document request validators.
const { z } = require('zod');

const createDocumentSchema = z.object({
  title: z.string().max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
});

const listDocumentsQuerySchema = z.object({
  folderId: z.string().uuid().optional(),
  starred: z.enum(['true', 'false']).optional(),
  shared: z.enum(['true', 'false']).optional(),
  q: z.string().max(200).optional(),
  sort: z.enum(['lastEdited', 'title']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = {
  createDocumentSchema,
  updateDocumentSchema,
  listDocumentsQuerySchema,
  searchQuerySchema,
};
