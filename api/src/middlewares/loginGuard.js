const db = require('../config/db');

// Failed sign-ins are counted in the database, so the limit holds no matter which
// serverless instance answers. Keys are per IP and per account (a 4-digit PIN would
// otherwise be guessable from many addresses).
const WINDOW_MIN = 15;

async function tooManyFailures(keys, max) {
  const r = await db.query(
    `SELECT kunci, COUNT(*)::int AS n FROM login_gagal
     WHERE kunci = ANY($1) AND waktu > NOW() - INTERVAL '${WINDOW_MIN} minutes' GROUP BY kunci`,
    [keys]
  );
  return r.rows.some((x) => x.n >= max);
}

async function recordFailure(keys) {
  await db.query(`INSERT INTO login_gagal (kunci) SELECT unnest($1::text[])`, [keys]);
  db.query(`DELETE FROM login_gagal WHERE waktu < NOW() - INTERVAL '1 day'`).catch(() => {});
}

const clearFailures = (keys) => db.query(`DELETE FROM login_gagal WHERE kunci = ANY($1)`, [keys]);

module.exports = { tooManyFailures, recordFailure, clearFailures, WINDOW_MIN };
