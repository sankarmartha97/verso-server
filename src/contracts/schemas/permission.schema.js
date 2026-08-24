// Sharing/permissions request validators.
const { z } = require('zod');

const shareableRole = z.enum(['editor', 'commenter', 'viewer']);

const inviteSchema = z.object({
  email: z.string().email(),
  role: shareableRole,
});

const changeRoleSchema = z.object({
  role: shareableRole,
});

const linkShareSchema = z.object({
  enabled: z.boolean(),
  role: shareableRole,
  expiresAt: z.string().datetime().nullable().optional(),
});

module.exports = {
  shareableRole,
  inviteSchema,
  changeRoleSchema,
  linkShareSchema,
};
