const test = require('node:test');
const assert = require('node:assert');
const dbPath = require.resolve('../src/config/db');
const store = { akses_web: JSON.stringify({ 7: ['telprom'] }) };
let tipe = 'karyawan';
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (sql, p) => {
  if (/FROM sesi s/.test(sql)) return { rows: [tipe === 'admin' ? { tipe: 'admin', id: null } : { tipe: 'karyawan', id: 7, nama: 'Via', peran: 'editor', status: 'aktif', lihat_penghasilan: false }] };
  if (/INSERT INTO settings/.test(sql)) { store[p[0]] = p[1]; return { rows: [], rowCount: 1 }; }
  if (/FROM editors WHERE id/.test(sql)) return { rows: String(p[0]) === '7' ? [{ id: 7 }] : [] };
  if (/FROM editors WHERE status/.test(sql)) return { rows: [{ id: 7, nama: 'Via' }, { id: 8, nama: 'Deni' }] };
  if (/settings WHERE key/.test(sql)) return { rows: store[p[0]] ? [{ value: store[p[0]] }] : [] };
  return { rows: [], rowCount: 0 };
} } };
const { izinDari, terapkan, WEB } = require('../src/services/aksesWebService');

test('karyawan yang belum pernah diatur boleh membuka semua web', () => {
  assert.deepStrictEqual(izinDari({}, 5), WEB);
});

test('mematikan satu web mulai dari bawaan, lalu menyalakannya lagi', () => {
  let p = terapkan({}, 5, 'master', false);
  assert.deepStrictEqual(izinDari(p, 5), ['telprom']);
  assert.deepStrictEqual(izinDari(p, 6), WEB, 'karyawan lain tidak terpengaruh');
  p = terapkan(p, 5, 'master', true);
  assert.deepStrictEqual(izinDari(p, 5), ['master', 'telprom']);
});

test('web tak dikenal ditolak (pantau tidak bisa dimatikan)', () => {
  assert.throws(() => terapkan({}, 5, 'pantau', false), (e) => e.status === 400);
  assert.throws(() => terapkan({}, 5, 'x', true), (e) => e.status === 400);
});

test('data rusak di pengaturan tidak membuat karyawan kehilangan atau mendapat web liar', () => {
  assert.deepStrictEqual(izinDari({ 5: 'master' }, 5), WEB);
  assert.deepStrictEqual(izinDari({ 5: ['master', 'sembarang'] }, 5), ['master']);
});

test('lewat HTTP: karyawan hanya melihat web yang diizinkan, pemilik mengatur lewat rute pemilik', async () => {
  process.env.MASTER_APP_URL = 'https://master.example.app'; process.env.TELPROM_APP_URL = 'https://telprom.example.app';
  const app = require('../src/app');
  const srv = app.listen(0);
  const u = `http://127.0.0.1:${srv.address().port}`;
  const h = { Cookie: 'pt_session=' + 'a'.repeat(43), 'Content-Type': 'application/json' };
  try {
    const r = await (await fetch(u + '/api/aplikasi', { headers: h })).json();
    assert.deepStrictEqual(r.daftar.map((a) => a.id), ['pantau', 'telprom']);
    assert.equal((await fetch(u + '/api/aplikasi/akses', { headers: h })).status, 403);
    assert.equal((await fetch(u + '/api/aplikasi/akses', { method: 'PUT', headers: h, body: JSON.stringify({ editor_id: 7, web: 'master', nilai: true }) })).status, 403);
    assert.equal((await fetch(u + '/api/aplikasi')).status, 401);

    tipe = 'admin';
    const a = await (await fetch(u + '/api/aplikasi/akses', { headers: h })).json();
    assert.deepStrictEqual(a.karyawan.find((k) => k.id === 7).web, { master: false, telprom: true });
    assert.deepStrictEqual(a.karyawan.find((k) => k.id === 8).web, { master: true, telprom: true });
    const put = (b) => fetch(u + '/api/aplikasi/akses', { method: 'PUT', headers: h, body: JSON.stringify(b) });
    assert.equal((await put({ editor_id: 7, web: 'master', nilai: true })).status, 200);
    assert.equal((await put({ editor_id: 7, web: 'pantau', nilai: false })).status, 400);
    assert.equal((await put({ editor_id: 99, web: 'master', nilai: false })).status, 404);
    assert.equal((await put({ editor_id: 7, web: 'master', nilai: 'ya' })).status, 400);
    assert.deepStrictEqual(JSON.parse(store.akses_web)['7'], ['master', 'telprom']);
    assert.equal((await (await fetch(u + '/api/aplikasi', { headers: h })).json()).daftar.length, 3, 'pemilik melihat semua');
    tipe = 'karyawan';
    assert.deepStrictEqual((await (await fetch(u + '/api/aplikasi', { headers: h })).json()).daftar.map((x) => x.id), ['pantau', 'master', 'telprom']);
  } finally { srv.close(); }
});
