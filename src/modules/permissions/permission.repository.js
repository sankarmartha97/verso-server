// Data access for document-level role grants. Not a plain id-keyed entity
// (a grant is looked up by document+user or document+email), so most methods
// are hand-written rather than inherited from BaseRepository's generic CRUD.
const BaseRepository = require('../../infra/postgres/base.repository.js');

class PermissionRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'permissions');
  }

  async listForDocument(documentId) {
    const { rows } = await this.pool.query(
      `SELECT p.*, u.email AS user_email, u.name AS user_name, u.avatar_url AS user_avatar_url
       FROM permissions p LEFT JOIN users u ON u.id = p.user_id
       WHERE p.document_id = $1 ORDER BY p.created_at ASC`,
      [documentId],
    );
    return rows;
  }

  async findForUser(documentId, userId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM permissions WHERE document_id = $1 AND user_id = $2',
      [documentId, userId],
    );
    return rows[0] || null;
  }

  async findForEmail(documentId, email) {
    const { rows } = await this.pool.query(
      'SELECT * FROM permissions WHERE document_id = $1 AND invited_email = $2',
      [documentId, email],
    );
    return rows[0] || null;
  }

  async upsertForUser(documentId, userId, role) {
    const { rows } = await this.pool.query(
      `INSERT INTO permissions (document_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id) WHERE user_id IS NOT NULL
       DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [documentId, userId, role],
    );
    return rows[0];
  }

  async upsertForEmail(documentId, email, role) {
    const { rows } = await this.pool.query(
      `INSERT INTO permissions (document_id, invited_email, role) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, invited_email) WHERE invited_email IS NOT NULL
       DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [documentId, email, role],
    );
    return rows[0];
  }

  async removeForUser(documentId, userId) {
    const { rowCount } = await this.pool.query(
      'DELETE FROM permissions WHERE document_id = $1 AND user_id = $2',
      [documentId, userId],
    );
    return rowCount > 0;
  }

  async removeById(documentId, permissionId) {
    const { rowCount } = await this.pool.query(
      'DELETE FROM permissions WHERE document_id = $1 AND id = $2',
      [documentId, permissionId],
    );
    return rowCount > 0;
  }

  // Called on signup: a pending invite (user_id NULL, keyed by email so far)
  // becomes a real grant once the invited address actually creates an
  // account.
  async resolvePendingInvites(userId, email) {
    const { rows } = await this.pool.query(
      `UPDATE permissions SET user_id = $1, invited_email = NULL
       WHERE invited_email = $2 AND user_id IS NULL
       RETURNING *`,
      [userId, email],
    );
    return rows;
  }

  async listSharedWithUser(userId, { limit = 50 } = {}) {
    const { rows } = await this.pool.query(
      `SELECT d.*, p.role AS permission_role,
              EXISTS (SELECT 1 FROM stars s WHERE s.user_id = $1 AND s.document_id = d.id) AS starred
       FROM permissions p
       JOIN documents d ON d.id = p.document_id
       WHERE p.user_id = $1 AND d.is_deleted = false
       ORDER BY d.last_edited_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }
}

module.exports = PermissionRepository;
