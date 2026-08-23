// User data access. Extends BaseRepository for id-based CRUD, adds the
// domain-specific lookups auth needs (by email, by verify/reset token hash).
const BaseRepository = require('../../infra/postgres/base.repository.js');

class UserRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'users');
  }

  async findByEmail(email) {
    const { rows } = await this.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  }

  async findByEmailVerifyTokenHash(tokenHash) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE email_verify_token_hash = $1 AND email_verify_expires_at > now()',
      [tokenHash],
    );
    return rows[0] || null;
  }

  async findByResetTokenHash(tokenHash) {
    const { rows } = await this.pool.query(
      'SELECT * FROM users WHERE reset_token_hash = $1 AND reset_token_expires_at > now()',
      [tokenHash],
    );
    return rows[0] || null;
  }
}

// Strips password hash + token fields before a user row ever reaches a response.
function toSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.email_verified,
    name: user.name,
    avatarUrl: user.avatar_url,
    colorOverride: user.color_override,
    createdAt: user.created_at,
  };
}

module.exports = UserRepository;
module.exports.toSafeUser = toSafeUser;
