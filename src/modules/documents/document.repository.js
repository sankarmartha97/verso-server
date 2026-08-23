// Document data access. Extends BaseRepository for id-based CRUD, adds the
// filtered/paginated listing, trash lifecycle, duplication, and star/recent
// side-tables a generic base can't express.
const BaseRepository = require('../../infra/postgres/base.repository.js');

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor(cursor) {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
}

class DocumentRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'documents');
  }

  async list({ ownerId, folderId, starred, trashed = false, q, sort = 'lastEdited', cursor, limit = 50 }) {
    const where = ['d.owner_id = $1', 'd.is_deleted = $2'];
    const params = [ownerId, trashed];

    if (folderId) {
      params.push(folderId);
      where.push(`d.folder_id = $${params.length}`);
    }
    if (starred) {
      params.push(ownerId);
      where.push(`EXISTS (SELECT 1 FROM stars s WHERE s.user_id = $${params.length} AND s.document_id = d.id)`);
    }
    if (q) {
      params.push(q);
      where.push(`d.title_search @@ plainto_tsquery('english', $${params.length})`);
    }

    const orderCol = sort === 'title' ? 'd.title' : 'd.last_edited_at';
    const orderDir = sort === 'title' ? 'ASC' : 'DESC';
    const cmp = sort === 'title' ? '>' : '<';

    if (cursor) {
      const [value, id] = decodeCursor(cursor);
      params.push(value, id);
      where.push(`(${orderCol}, d.id) ${cmp} ($${params.length - 1}, $${params.length})`);
    }

    params.push(limit);

    const { rows } = await this.pool.query(
      `SELECT d.*, EXISTS (SELECT 1 FROM stars s WHERE s.user_id = $1 AND s.document_id = d.id) AS starred
       FROM documents d
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderCol} ${orderDir}, d.id ${orderDir}
       LIMIT $${params.length}`,
      params,
    );

    const nextCursor =
      rows.length === limit
        ? encodeCursor([sort === 'title' ? rows[rows.length - 1].title : rows[rows.length - 1].last_edited_at, rows[rows.length - 1].id])
        : null;

    return { rows, nextCursor };
  }

  async findByIdForOwner(id, ownerId) {
    const { rows } = await this.pool.query(
      `SELECT d.*, EXISTS (SELECT 1 FROM stars s WHERE s.user_id = $1 AND s.document_id = d.id) AS starred
       FROM documents d WHERE d.id = $2 AND d.owner_id = $1`,
      [ownerId, id],
    );
    return rows[0] || null;
  }

  async softDelete(id) {
    const { rows } = await this.pool.query(
      'UPDATE documents SET is_deleted = true, deleted_at = now() WHERE id = $1 RETURNING *',
      [id],
    );
    return rows[0] || null;
  }

  async restore(id) {
    const { rows } = await this.pool.query(
      'UPDATE documents SET is_deleted = false, deleted_at = NULL WHERE id = $1 RETURNING *',
      [id],
    );
    return rows[0] || null;
  }

  async duplicate(sourceId, ownerId) {
    const { rows } = await this.pool.query(
      `INSERT INTO documents (title, owner_id, folder_id, last_edited_by)
       SELECT 'Copy of ' || title, $2, folder_id, $2 FROM documents WHERE id = $1
       RETURNING *`,
      [sourceId, ownerId],
    );
    return rows[0] || null;
  }

  async star(userId, documentId) {
    await this.pool.query(
      'INSERT INTO stars (user_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, documentId],
    );
  }

  async unstar(userId, documentId) {
    await this.pool.query('DELETE FROM stars WHERE user_id = $1 AND document_id = $2', [userId, documentId]);
  }

  async touchRecent(userId, documentId) {
    await this.pool.query(
      `INSERT INTO recent_documents (user_id, document_id, opened_at) VALUES ($1, $2, now())
       ON CONFLICT (user_id, document_id) DO UPDATE SET opened_at = now()`,
      [userId, documentId],
    );
  }

  async listRecent(userId, limit = 50) {
    const { rows } = await this.pool.query(
      `SELECT d.*, EXISTS (SELECT 1 FROM stars s WHERE s.user_id = $1 AND s.document_id = d.id) AS starred
       FROM recent_documents r
       JOIN documents d ON d.id = r.document_id
       WHERE r.user_id = $1 AND d.is_deleted = false
       ORDER BY r.opened_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows;
  }
}

module.exports = DocumentRepository;
