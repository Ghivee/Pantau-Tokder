const test = require('node:test');
const assert = require('node:assert');

// --- database tiruan
const dbPath = require.resolve('../src/config/db');
let sesi = { tipe: 'admin' };
const editors = [
  { id: 1, nama: 'Via', peran: 'editor', lihat_penghasilan: false, izin: null },
  { id: 2, nama: 'Deni', peran: 'editor', lihat_penghasilan: false, izin: { upload: true, web_master: false } },
  { id: 3, nama: 'Zed', peran: 'editor', lihat_penghasilan: false, izin: null },
  { id: 4, nama: 'Alivia', peran: 'editor', lihat_penghasilan: false, izin: null, akun_master: null },
];
let latensi = 0;
const tunda = () => (latensi ? new Promise((r) => setTimeout(r, latensi)) : null);
const updates = [];
const dicabut = [];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (sql, p) => {
  if (/FROM sesi s/.test(sql)) return { rows: [sesi.tipe === 'admin' ? { tipe: 'admin', id: null } : { tipe: 'karyawan', status: 'aktif', ...sesi.row }] };
  if (/FROM editors WHERE status = 'aktif'/.test(sql)) { const hasil = editors.map((e) => ({ ...e })); await tunda(); return { rows: hasil }; }
  if (/UPDATE editors SET izin = izin \|\| jsonb_build_object/.test(sql)) { await tunda(); const e = editors.find((x) => x.id === p[2]); if (!e || !e.izin) return { rows: [] }; e.izin = { ...e.izin, [p[0]]: p[1] }; updates.push([p[2], e.izin]); return { rows: [{ izin: e.izin }] }; }
  if (/UPDATE editors SET izin = \$1 WHERE id = \$2 AND izin IS NULL/.test(sql)) { await tunda(); const e = editors.find((x) => x.id === p[1]); if (!e || e.izin) return { rows: [] }; e.izin = JSON.parse(p[0]); updates.push([p[1], e.izin]); return { rows: [{ izin: e.izin }] }; }
  if (/UPDATE editors SET akun_master/.test(sql)) { const e = editors.find((x) => x.id === p[1]); e.akun_master = p[0]; return { rows: [], rowCount: 1 }; }
  if (/UPDATE editors SET izin/.test(sql)) { await tunda(); const e = editors.find((x) => x.id === p[1]); e.izin = JSON.parse(p[0]); updates.push([p[1], e.izin]); return { rows: [], rowCount: 1 }; }
  if (/DELETE FROM sesi WHERE editor_id/.test(sql)) { dicabut.push(p[0]); return { rows: [], rowCount: 1 }; }
  if (/settings WHERE key/.test(sql)) return { rows: [] };
  return { rows: [], rowCount: 0 };
} } };

// --- Master tiruan
const ENV = { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_PANTAU_PASSWORD: 'x', MASTER_APP_URL: 'https://m.example.app', TELPROM_APP_URL: 'https://t.example.app' };
Object.assign(process.env, ENV);
const master = require('../src/services/kontenMasterService');
let masterAktif = { via: ['order_lihat', 'kas_catat'], deni: [] };
let masterMati = false, tulisMati = false;
const tulis = [];
const asliFetch = global.fetch;
global.fetch = async (url, o) => {
  if (!String(url).includes('supabase.co')) return asliFetch(url, o);
  const j = (code, body) => ({ ok: code < 300, status: code, json: async () => body });
  if (url.includes('grant_type=password')) return j(200, { access_token: 'T', expires_in: 3600 });
  if (url.endsWith('/rpc/baca_akses')) return masterMati ? j(500, {}) : j(200, Object.entries(masterAktif).flatMap(([staff, l]) => l.map((izin) => ({ staff, izin }))));
  if (url.endsWith('/rpc/set_akses')) { if (tulisMati) return j(500, { message: 'boom' }); const b = JSON.parse(o.body); tulis.push(b); masterAktif[b.p_staff] = b.p_izin; return j(204, null); }
  return j(404, {});
};

const app = require('../src/app');
const srv = app.listen(0);
const u = `http://127.0.0.1:${srv.address().port}`;
const h = { Cookie: 'pt_session=' + 'a'.repeat(43), 'Content-Type': 'application/json' };
const get = (p) => fetch(u + p, { headers: h });
const put = (p, b) => fetch(u + p, { method: 'PUT', headers: h, body: JSON.stringify(b) });
test.after(() => { srv.close(); global.fetch = asliFetch; });

test('karyawan tidak bisa membuka atau mengubah pengaturan akses', async () => {
  sesi = { tipe: 'karyawan', row: { id: 1, nama: 'Via', peran: 'editor', lihat_penghasilan: false, izin: null } };
  assert.equal((await get('/api/akses')).status, 403);
  assert.equal((await put('/api/akses/1', { kunci: 'uang', nilai: true })).status, 403);
  assert.equal((await fetch(u + '/api/akses/sinkron', { method: 'POST', headers: h })).status, 403);
});

test('halaman Aplikasi: izin web per orang menang; belum diatur ikut aturan lama (semua)', async () => {
  sesi = { tipe: 'karyawan', row: { id: 2, nama: 'Deni', peran: 'editor', lihat_penghasilan: false, izin: { web_master: false, web_telprom: true } } };
  assert.deepStrictEqual((await (await get('/api/aplikasi')).json()).daftar.map((a) => a.id), ['pantau', 'telprom']);
  sesi = { tipe: 'karyawan', row: { id: 1, nama: 'Via', peran: 'editor', lihat_penghasilan: false, izin: null } };
  assert.deepStrictEqual((await (await get('/api/aplikasi')).json()).daftar.map((a) => a.id), ['pantau', 'master', 'telprom']);
});

test('matriks: orang yang belum diatur memakai keadaan nyata Master, bukan tebakan; nama tanpa akun Master tanpa izin Master', async () => {
  sesi = { tipe: 'admin' };
  const r = await (await get('/api/akses')).json();
  const via = r.karyawan.find((k) => k.nama === 'Via'), deni = r.karyawan.find((k) => k.nama === 'Deni'), zed = r.karyawan.find((k) => k.nama === 'Zed');
  assert.equal(r.master.terbaca, true);
  assert.deepStrictEqual([via.izin.master_order_lihat, via.izin.master_order_unggah, via.izin.master_kas_catat], [true, false, true]);
  assert.equal(via.tersimpan, false);
  assert.equal(via.akunMaster, true);
  assert.equal(deni.tersimpan, true);
  assert.equal(deni.izin.web_master, false);
  assert.equal(zed.akunMaster, false);
});

test('mengubah izin Via: tersimpan penuh di Pantau dan diselaraskan ke Master', async () => {
  sesi = { tipe: 'admin' }; updates.length = 0; tulis.length = 0;
  const res = await put('/api/akses/1', { kunci: 'master_konten_lihat', nilai: true });
  assert.equal(res.status, 200);
  const b = await res.json();
  assert.equal(b.sinkron.ok, true);
  assert.equal(b.izin.master_konten_lihat, true);
  assert.deepStrictEqual(tulis[0].p_izin.sort(), ['konten_lihat', 'kas_catat', 'order_lihat'].sort(), 'keadaan nyata Master ikut terbawa');
  assert.equal(tulis[0].p_staff, 'via');
  assert.equal(updates[0][1].master_order_unggah, false);
  assert.equal(updates[0][1].upload, true, 'izin Pantau awal ikut disimpan');
});

test('izin Pantau saja tidak menyentuh Master setelah orangnya pernah diatur', async () => {
  sesi = { tipe: 'admin' }; tulis.length = 0;
  const res = await put('/api/akses/1', { kunci: 'hapus', nilai: true });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).izin.hapus, true);
  assert.equal(tulis.length, 0);
});

test('Master gagal: Pantau tetap menyimpan dan melaporkan belum tersinkron', async () => {
  sesi = { tipe: 'admin' }; tulisMati = true; updates.length = 0;
  try {
    const res = await put('/api/akses/1', { kunci: 'master_order_unggah', nilai: true });
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.sinkron.ok, false);
    assert.match(b.sinkron.galat, /boom|Master menolak/);
    assert.equal(updates.length, 1);
  } finally { tulisMati = false; }
});

test('orang yang belum diatur dan Master tidak terbaca: ditolak 503, tidak ada yang ditulis', async () => {
  editors.find((e) => e.id === 3).izin = null;
  const via = editors.find((e) => e.id === 1); const simpan = via.izin; via.izin = null;
  sesi = { tipe: 'admin' }; masterMati = true; updates.length = 0; tulis.length = 0;
  try {
    const res = await put('/api/akses/1', { kunci: 'master_konten_kelola', nilai: true });
    assert.equal(res.status, 503);
    assert.equal(updates.length, 0);
    assert.equal(tulis.length, 0);
    // izin Pantau saja untuk orang tanpa akun Master tidak butuh Master
    assert.equal((await put('/api/akses/3', { kunci: 'upload', nilai: false })).status, 200);
  } finally { masterMati = false; via.izin = simpan; }
});

test('masukan tidak valid ditolak: kunci asing, nilai bukan boolean, izin Master untuk nama tanpa akun, id tak ada', async () => {
  sesi = { tipe: 'admin' };
  assert.equal((await put('/api/akses/1', { kunci: 'jadi_admin', nilai: true })).status, 400);
  assert.equal((await put('/api/akses/1', { kunci: 'upload', nilai: 'ya' })).status, 400);
  assert.equal((await put('/api/akses/3', { kunci: 'master_kas_catat', nilai: true })).status, 400);
  assert.equal((await put('/api/akses/99', { kunci: 'upload', nilai: true })).status, 404);
  assert.equal((await put('/api/akses/abc', { kunci: 'upload', nilai: true })).status, 400);
});

test('sesi karyawan membawa izin per orang ke server (upload diizinkan satu per satu)', async () => {
  sesi = { tipe: 'karyawan', row: { id: 2, nama: 'Deni', peran: 'penonton', lihat_penghasilan: false, izin: { upload: true } } };
  const r = await fetch(u + '/api/auth/me', { headers: h });
  const b = await r.json();
  assert.equal(b.izin.upload, true);
  assert.equal(b.izin.tayang, false);
  assert.equal(b.peran, 'penonton', 'jabatan lama tidak lagi menentukan izin');
});

test('mematikan web_pantau mengeluarkan orang itu dari semua perangkat; izin lain tidak', async () => {
  sesi = { tipe: 'admin' }; dicabut.length = 0;
  assert.equal((await put('/api/akses/3', { kunci: 'upload', nilai: false })).status, 200);
  assert.deepEqual(dicabut, []);
  assert.equal((await put('/api/akses/3', { kunci: 'web_pantau', nilai: true })).status, 200);
  assert.deepEqual(dicabut, [], 'mengaktifkan tidak mencabut');
  assert.equal((await put('/api/akses/3', { kunci: 'web_pantau', nilai: false })).status, 200);
  assert.deepEqual(dicabut, [3]);
});

test('dua perubahan bersamaan pada orang yang sama tidak saling menimpa', async () => {
  sesi = { tipe: 'admin' };
  const deni = editors.find((e) => e.id === 2); deni.izin = { upload: true };
  latensi = 15;
  try {
    const [a, b, c] = await Promise.all([
      put('/api/akses/2', { kunci: 'tayang', nilai: false }),
      put('/api/akses/2', { kunci: 'hapus', nilai: true }),
      put('/api/akses/2', { kunci: 'tautan', nilai: false }),
    ]);
    assert.deepEqual([a.status, b.status, c.status], [200, 200, 200]);
  } finally { latensi = 0; }
  assert.equal(deni.izin.tayang, false, 'perubahan pertama tidak hilang');
  assert.equal(deni.izin.hapus, true, 'perubahan kedua tidak hilang');
  assert.equal(deni.izin.tautan, false, 'perubahan ketiga tidak hilang');
  assert.equal(deni.izin.upload, true, 'isi lama tetap');
});

test('dua perubahan pertama bersamaan pada orang yang belum diatur: tidak ada yang hilang', async () => {
  sesi = { tipe: 'admin' };
  const zed = editors.find((e) => e.id === 3); zed.izin = null;
  latensi = 15;
  try {
    const [a, b] = await Promise.all([put('/api/akses/3', { kunci: 'upload', nilai: false }), put('/api/akses/3', { kunci: 'tayang', nilai: false })]);
    assert.deepEqual([a.status, b.status], [200, 200]);
  } finally { latensi = 0; }
  assert.equal(zed.izin.upload, false);
  assert.equal(zed.izin.tayang, false);
});

test('Alivia belum dipetakan: kotak izin Master tidak aktif; sesudah dipetakan ke akun via, izin Master berjalan', async () => {
  sesi = { tipe: 'admin' }; tulis.length = 0; masterAktif.via = ['order_lihat'];
  let r = await (await get('/api/akses')).json();
  let a = r.karyawan.find((k) => k.nama === 'Alivia');
  assert.equal(a.akunMaster, false);
  assert.equal((await put('/api/akses/4', { kunci: 'master_kas_catat', nilai: true })).status, 400, 'belum dipetakan: ditolak');
  const pilih = (id, akun) => fetch(u + `/api/akses/${id}/akun-master`, { method: 'PUT', headers: h, body: JSON.stringify({ akun }) });
  assert.equal((await pilih(4, 'via')).status, 409, 'akun via sudah dipakai Via (cocok nama)');
  assert.equal((await put('/api/akses/1', { kunci: 'upload', nilai: true })).status, 200);
  const lepasVia = editors.find((e) => e.id === 1); lepasVia.nama = 'Orang Lain'; // Via lama diganti nama: akun via bebas
  const ok = await pilih(4, 'via');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).akun, 'via');
  r = await (await get('/api/akses')).json();
  a = r.karyawan.find((k) => k.nama === 'Alivia');
  assert.deepEqual([a.akunMaster, a.akun], [true, 'via']);
  assert.equal(a.izin.master_order_lihat, true, 'izin awal mengikuti keadaan nyata akun via di Master');
  assert.equal((await put('/api/akses/4', { kunci: 'master_kas_catat', nilai: true })).status, 200);
  assert.deepEqual(tulis.at(-1).p_staff, 'via');
  assert.ok(tulis.at(-1).p_izin.includes('kas_catat'));
  lepasVia.nama = 'Via';
  assert.equal((await pilih(4, '')).status, 200);
  assert.equal(editors.find((e) => e.id === 4).akun_master, null, 'pemetaan bisa dilepas');
});

test('pemetaan akun Master: masukan buruk ditolak, karyawan tidak boleh, id tak ada 404', async () => {
  sesi = { tipe: 'admin' };
  const pilih = (id, akun) => fetch(u + `/api/akses/${id}/akun-master`, { method: 'PUT', headers: h, body: JSON.stringify({ akun }) });
  assert.equal((await pilih(4, 'doni')).status, 400);
  assert.equal((await pilih(4, "via'; drop table editors;--")).status, 400);
  assert.equal((await pilih(99, 'via')).status, 404);
  assert.equal((await pilih('abc', 'via')).status, 400);
  sesi = { tipe: 'karyawan', row: { id: 1, nama: 'Via', peran: 'editor', lihat_penghasilan: false, izin: null } };
  assert.equal((await pilih(4, 'via')).status, 403);
});
