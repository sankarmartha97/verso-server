// Liveness/readiness probe.
const pool = require('../../infra/postgres/pool.js');

async function checkHealth(req, res) {
  let db = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch {
    db = 'unreachable';
  }

  res.json({
    status: 'ok',
    service: 'verso-server',
    time: new Date().toISOString(),
    db,
  });
}

module.exports = { checkHealth };
