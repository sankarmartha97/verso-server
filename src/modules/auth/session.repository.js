// Refresh-token session storage. Extends BaseRepository for id-based CRUD,
// adds the bulk revoke used on password reset and reuse-detection.
const BaseRepository = require('../../infra/postgres/base.repository.js');

class SessionRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'sessions');
  }

  async deleteAllForUser(userId) {
    await this.pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
}

module.exports = SessionRepository;
