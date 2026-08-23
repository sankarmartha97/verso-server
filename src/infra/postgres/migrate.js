// Tiny migration runner: applies migrations/*.sql in order, tracked in
// schema_migrations. Run with `npm run migrate`.
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const pool = require('./pool.js');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', '..', 'migrations');

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedNames = new Set(applied.map((row) => row.name));

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`failed: ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('migrations up to date');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
