const test = require('node:test');
const assert = require('node:assert');

// --- database tiruan yang bisa diatur
const dbPath = require.resolve('../src/config/db');
let sesi = { tipe: 'admin' };
let editors = [];
const sesiBaru = [];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (sql, p) => {
  if (/FROM sesi s/.test(sql)) return { rows: [sesi.tipe === 'admin' ? { tipe: 'admin', id: null } : sesi.tipe === 'karyawan' ? { tipe: 'karyawan', status: 'aktif', ...sesi.row } : undefined].filter(Boolean) };
  if (/INSERT INTO sesi/.test(sql)) { sesiBaru.push(sql); return { rows: [], rowCount: 1 }; }
  if (/FROM editors WHERE id = \$1/.test(sql)) return { rows: editors.filter((e) => String(e.id) === String(p[0])) };
  if (/FROM editors$/.test(sql.trim()) || /FROM editors\s*$/.test(sql)) return { rows: editors };
  return { rows: [], rowCount: 0 };
} } };

const { hashPin } = require('../src/middlewares/sessionAuth');
const ENV = { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_APP_URL: 'https://m.example.app', TELPROM_APP_URL: 'https://t.example.app' };
Object.assign(process.env, ENV);

let profilMaster = { role: 'staff', staff: 'via', name: 'Via' };
const asliFetch = global.fetch;
global.fetch = async (url, o) => {
  if (!String(url).includes('supabase.co')) return asliFetch(url, o);
  const j = (code, body) => ({ ok: code < 300, status: code, json: async () => body });
  if (String(url).endsWith('/auth/v1/user')) return j(200, { id: 'u1', email: 'via@master.app' });
  if (String(url).includes('/rest/v1/profiles')) return j(200, [profilMaster]);
  return j(404, {});
};

const app = require('../src/app');
const srv = app.listen(0);
const u = `http://127.0.0.1:${srv.address().port}`;
const cookie = { Cookie: 'pt_session=' + 'a'.repeat(43) };
const TOKEN = 'a'.repeat(30) + '.' + 'b'.repeat(30);
const postSso = () => fetch(u + '/api/auth/sso', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
test.after(() => { srv.close(); global.fetch = asliFetch; });

test('kartu Telprom membuka lewat Master (lompatan) agar otomatis masuk; tanpa Master jadi tautan biasa', async () => {
  sesi = { tipe: 'admin' };
  let r = await (await fetch(u + '/api/aplikasi', { headers: cookie })).json();
  const t = r.daftar.find((a) => a.id === 'telprom');
  assert.equal(t.url, 'https://m.example.app/?sso=telprom&kembali=' + encodeURIComponent('https://t.example.app'));
  assert.equal(r.daftar.find((a) => a.id === 'master').url, 'https://m.example.app');
  delete process.env.MASTER_APP_URL;
  try {
    r = await (await fetch(u + '/api/aplikasi', { headers: cookie })).json();
    assert.equal(r.daftar.find((a) => a.id === 'telprom').url, 'https://t.example.app');
  } finally { process.env.MASTER_APP_URL = ENV.MASTER_APP_URL; }
});

test('keluar-sso: tanpa login pun menghapus cookie lalu kembali ke halaman depan', async () => {
  const r = await fetch(u + '/api/auth/keluar-sso', { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.equal(r.headers.get('location'), '/');
  assert.match(r.headers.get('set-cookie') || '', /pt_session=;.*Max-Age=0/);
});

test('/api/akun: pemilik semua; karyawan hanya data dirinya dengan penanda boleh/tidak; tanpa login 401', async () => {
  assert.equal((await fetch(u + '/api/akun')).status, 401);
  sesi = { tipe: 'admin' };
  assert.equal((await (await fetch(u + '/api/akun', { headers: cookie })).json()).semua, true);
  sesi = { tipe: 'karyawan', row: { id: 1, nama: 'Via', peran: 'editor', lihat_penghasilan: false, izin: { upload: true, hapus: false, web_telprom: false } } };
  const b = await (await fetch(u + '/api/akun', { headers: cookie })).json();
  assert.equal(b.nama, 'Via');
  assert.equal(b.jenis, 'Karyawan');
  const semua = b.akses.flatMap((g) => g.butir);
  assert.equal(semua.find((x) => x.nama === 'Mengunggah draf sosmed').boleh, true);
  assert.equal(semua.find((x) => x.nama === 'Menghapus posting dan tautan').boleh, false);
  assert.equal(semua.find((x) => x.nama === 'Telprom').boleh, false);
  assert.ok(!JSON.stringify(b).includes('pin'), 'tidak membocorkan data lain');
});

test('SSO: karyawan dengan web_pantau mati ditolak 403 dan tidak dibuatkan sesi', async () => {
  sesi = { tipe: 'none' }; sesiBaru.length = 0;
  profilMaster = { role: 'staff', staff: 'via', name: 'Via' };
  editors = [{ id: 1, nama: 'Via', status: 'aktif', peran: 'editor', lihat_penghasilan: false, izin: { web_pantau: false } }];
  const r = await postSso();
  assert.equal(r.status, 403);
  assert.match((await r.json()).error, /tidak diizinkan membuka Tokder/);
  assert.equal(sesiBaru.length, 0);
});

test('SSO: karyawan yang diizinkan masuk dengan sesi 7 hari; pemilik juga 7 hari', async () => {
  sesi = { tipe: 'none' }; sesiBaru.length = 0;
  editors = [{ id: 1, nama: 'Via', status: 'aktif', peran: 'editor', lihat_penghasilan: false, izin: { web_pantau: true } }];
  let r = await postSso();
  assert.equal(r.status, 200);
  assert.match(sesiBaru[0], /INTERVAL '7 days'/);
  assert.match(r.headers.get('set-cookie'), /Max-Age=604800/);
  profilMaster = { role: 'admin', staff: null, name: 'Doni' }; sesiBaru.length = 0;
  r = await postSso();
  assert.equal(r.status, 200);
  assert.match(sesiBaru[0], /INTERVAL '7 days'/);
});

test('login PIN cadangan: web_pantau mati ditolak; yang diizinkan tetap bisa (sesi 30 hari)', async () => {
  sesi = { tipe: 'none' }; sesiBaru.length = 0;
  const pin = hashPin('1234');
  editors = [{ id: 5, nama: 'Deni', status: 'aktif', peran: 'editor', pin, foto_url: null, lihat_penghasilan: false, izin: { web_pantau: false } }];
  const kirim = () => fetch(u + '/api/auth/editor-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editor_id: 5, pin: '1234' }) });
  assert.equal((await kirim()).status, 403);
  assert.equal(sesiBaru.length, 0);
  editors[0].izin = { web_pantau: true };
  const r = await kirim();
  assert.equal(r.status, 200);
  assert.match(sesiBaru[0], /INTERVAL '30 days'/);
});

test('akses Pantau dicabut: sesi yang sudah ada langsung ditolak, dan pulih bila diaktifkan lagi', async () => {
  sesi = { tipe: 'karyawan', row: { id: 1, nama: 'Via', peran: 'editor', lihat_penghasilan: false, izin: { web_pantau: false } } };
  assert.equal((await fetch(u + '/api/akun', { headers: cookie })).status, 401);
  assert.equal((await fetch(u + '/api/aplikasi', { headers: cookie })).status, 401);
  sesi.row.izin = { web_pantau: true };
  assert.equal((await fetch(u + '/api/akun', { headers: cookie })).status, 200);
});

test('CORS dan anti-CSRF: hanya alamat produksi yang sebenarnya dipercaya; alamat lama yang tak terpakai tidak', async () => {
  const kirim = (origin) => fetch(u + '/api/auth/logout', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' } });
  assert.notEqual((await kirim('https://tokder.vercel.app')).status, 403, 'alamat produksi diterima');
  assert.equal((await kirim('https://pantautokder.vercel.app')).status, 403, 'alamat lama yang bisa dipesan orang lain ditolak');
  assert.equal((await kirim('https://jahat.example')).status, 403);
  const cors = await fetch(u + '/api/auth/me', { headers: { Origin: 'https://pantautokder.vercel.app' } });
  assert.equal(cors.headers.get('access-control-allow-origin'), null, 'tidak ada izin CORS untuk alamat lama');
  const ok = await fetch(u + '/api/auth/me', { headers: { Origin: 'https://tokder.vercel.app' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://tokder.vercel.app');
});
