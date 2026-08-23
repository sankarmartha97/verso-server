// Folder request validators.
const { z } = require('zod');

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().nullable().optional(),
});

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

module.exports = { createFolderSchema, updateFolderSchema };
