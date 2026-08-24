// One row per document, keyed by document_id. The share token is generated
// once and kept stable across enable/disable/role/expiry changes -- a link
// someone already has shouldn't silently break the next time settings change,
// same as Google Docs.
const crypto = require('node:crypto');
const BaseRepository = require('../../infra/postgres/base.repository.js');

class LinkShareRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'link_shares');
  }

  async findByDocument(documentId) {
    const { rows } = await this.pool.query('SELECT * FROM link_shares WHERE document_id = $1', [documentId]);
    return rows[0] || null;
  }

  async findByToken(token) {
    const { rows } = await this.pool.query('SELECT * FROM link_shares WHERE token = $1', [token]);
    return rows[0] || null;
  }

  async getOrCreate(documentId) {
    const existing = await this.findByDocument(documentId);
    if (existing) return existing;

    const token = crypto.randomBytes(24).toString('base64url');
    const { rows } = await this.pool.query(
      `INSERT INTO link_shares (document_id, token) VALUES ($1, $2)
       ON CONFLICT (document_id) DO NOTHING
       RETURNING *`,
      [documentId, token],
    );
    return rows[0] || (await this.findByDocument(documentId));
  }

  async update(documentId, { enabled, role, expiresAt }) {
    const { rows } = await this.pool.query(
      `UPDATE link_shares SET enabled = $2, role = $3, expires_at = $4 WHERE document_id = $1 RETURNING *`,
      [documentId, enabled, role, expiresAt || null],
    );
    return rows[0] || null;
  }
}

module.exports = LinkShareRepository;
