// Folder data access. Extends BaseRepository for id-based CRUD, adds the
// owner-scoped listing and sibling lookups the service needs for the
// depth guard and duplicate-name handling.
const BaseRepository = require('../../infra/postgres/base.repository.js');

class FolderRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'folders');
  }

  async findByOwner(ownerId) {
    const { rows } = await this.pool.query(
      'SELECT * FROM folders WHERE owner_id = $1 ORDER BY name',
      [ownerId],
    );
    return rows;
  }

  async findSiblings(ownerId, parentId) {
    const { rows } = await this.pool.query(
      parentId
        ? 'SELECT * FROM folders WHERE owner_id = $1 AND parent_id = $2'
        : 'SELECT * FROM folders WHERE owner_id = $1 AND parent_id IS NULL',
      parentId ? [ownerId, parentId] : [ownerId],
    );
    return rows;
  }
}

module.exports = FolderRepository;
