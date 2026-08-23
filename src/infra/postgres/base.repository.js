// Generic CRUD over a single table. Domain repositories (e.g. UserRepository)
// extend this and add table-specific queries on top.
class BaseRepository {
  constructor(pool, tableName) {
    this.pool = pool;
    this.tableName = tableName;
  }

  async findById(id) {
    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  }

  async findAll({ where = {}, limit = 50, offset = 0 } = {}) {
    const keys = Object.keys(where);
    const clause = keys.length
      ? `WHERE ${keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ')}`
      : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM ${this.tableName} ${clause} LIMIT $${keys.length + 1} OFFSET $${keys.length + 2}`,
      [...Object.values(where), limit, offset],
    );
    return rows;
  }

  async create(data) {
    const keys = Object.keys(data);
    const columns = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const { rows } = await this.pool.query(
      `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
      Object.values(data),
    );
    return rows[0];
  }

  async update(id, data) {
    const keys = Object.keys(data);
    const assignments = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    const { rows } = await this.pool.query(
      `UPDATE ${this.tableName} SET ${assignments} WHERE id = $${keys.length + 1} RETURNING *`,
      [...Object.values(data), id],
    );
    return rows[0] || null;
  }

  async delete(id) {
    const { rowCount } = await this.pool.query(
      `DELETE FROM ${this.tableName} WHERE id = $1`,
      [id],
    );
    return rowCount > 0;
  }
}

module.exports = BaseRepository;
