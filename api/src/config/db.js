const { Pool, types } = require('pg');

// Timestamps are stored as UTC wall-clock time (TIMESTAMP without zone). Read them as UTC
// whatever the server's own time zone is, and keep DATE values as plain YYYY-MM-DD text.
types.setTypeParser(1114, (v) => new Date(v.replace(' ', 'T') + 'Z'));
types.setTypeParser(1082, (v) => v);
try { require('dotenv').config(); } catch (e) { /* .env not present */ }

const dbUrl = process.env.DATABASE_URL || '';
const isPlaceholder = !dbUrl || /@host:5432\b|user:password@/.test(dbUrl);

// No made-up data: without a real database every query fails and the app shows the error.
const pool = isPlaceholder ? null : new Pool({
  connectionString: dbUrl,
  ssl: /localhost|127\.0\.0\.1/.test(dbUrl) ? false : { rejectUnauthorized: false },
});
if (pool) pool.on('error', (err) => console.error('Database pool error:', err.message));

async function query(text, params) {
  if (!pool) {
    const e = new Error('Koneksi database belum diatur (DATABASE_URL kosong).');
    e.code = 'ENOTFOUND';
    throw e;
  }
  return pool.query(text, params);
}

module.exports = { query, pool };
