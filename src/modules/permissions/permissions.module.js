// Sharing routes, mounted at /documents alongside documents.module.js.
// Every route is owner-only (requireRole('share'), per the PRD's capability
// table) -- keyed by permission row id rather than userId (the PRD's own
// route sketch uses :userId, but that can't address a still-pending,
// not-yet-signed-up invite, which only has an invited_email so far).
const express = require('express');
const jwtAuth = require('../../common/jwt-auth.middleware.js');
const validate = require('../../common/validate.middleware.js');
const { requireRole } = require('./roles.guard.js');
const controller = require('./permissions.controller.js');
const { inviteSchema, changeRoleSchema, linkShareSchema } = require('../../contracts/schemas/permission.schema.js');

const router = express.Router();
router.use(jwtAuth);

router.get('/:id/permissions', requireRole('share'), controller.list);
router.post('/:id/permissions', requireRole('share'), validate(inviteSchema), controller.invite);
router.patch(
  '/:id/permissions/:permissionId',
  requireRole('share'),
  validate(changeRoleSchema),
  controller.changeRole,
);
router.delete('/:id/permissions/:permissionId', requireRole('share'), controller.revoke);
router.post('/:id/link', requireRole('manageLink'), validate(linkShareSchema), controller.upsertLinkShare);

module.exports = router;
