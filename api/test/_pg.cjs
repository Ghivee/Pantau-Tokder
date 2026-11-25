// Pembantu tes: memasang Postgres sungguhan (PGlite, WebAssembly) sebagai modul database, dengan skema produksi yang sama.
const path = require('path');
async function pasangDb() {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite();
  const dbPath = require.resolve(path.join(__dirname, '../src/config/db'));
  const tulis = [];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    pool: null,
    query: async (sql, params) => { const r = await pg.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows != null ? r.affectedRows : r.rows.length }; },
  } };
  await pg.exec(require('fs').readFileSync(path.join(__dirname, '../../migrations/001_init.sql'), 'utf8')); // tabel dasar seperti produksi
  const { STATEMENTS } = require('../src/config/schema');
  const gagal = [];
  for (const s of STATEMENTS) { try { await pg.exec(s); } catch (e) { gagal.push(e.message.slice(0, 80)); } }
  return { pg, gagal, q: (sql, p) => pg.query(sql, p).then((r) => r.rows), tulis };
}
// Permintaan palsu secukupnya untuk layanan yang membaca header dan alamat socket.
const permintaan = (o = {}) => ({ headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'accept-language': 'id-ID,id;q=0.9', ...(o.headers || {}) }, socket: { remoteAddress: o.ip || '203.0.113.5' }, method: o.method || 'GET', originalUrl: o.url || '/api/x', isAdmin: !!o.admin, editor: o.editor || null, akun: o.akun || null, namaAkun: o.namaAkun || null, metodeMasuk: o.metode || null, sesiId: o.sesi || null });
module.exports = { pasangDb, permintaan };
