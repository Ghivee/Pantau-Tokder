// Alur nyata dari ujung ke ujung: aplikasi Express asli + Postgres sungguhan (PGlite). Hanya Supabase yang ditiru.
const test = require('node:test');
const assert = require('node:assert');
const { pasangDb } = require('./_pg.cjs');

let q, srv, u, hashPin;
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_HP = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
let profilMaster = { role: 'admin', staff: null, name: 'Windri' }, emailMaster = 'windri@master.app';

test.before(async () => {
  const d = await pasangDb(); q = d.q;
  Object.assign(process.env, { ADMIN_PASSWORD: 'sandi-pemilik-123', MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_APP_URL: 'https://m.example.app' });
  delete process.env.VERCEL;
  ({ hashPin } = require('../src/middlewares/sessionAuth'));
  await q(`insert into editors (nama, kode_identifikasi, pin, akun_master) values ('Alivia','AL',$1,'via'), ('Deni','DE',$2,null)`, [hashPin('1234'), hashPin('5678')]);
  const asli = global.fetch;
  global.fetch = async (url, o) => {
    if (!String(url).includes('supabase.co')) return asli(url, o);
    const j = (c, b) => ({ ok: c < 300, status: c, json: async () => b });
    if (String(url).endsWith('/auth/v1/user')) return j(200, { id: 'u1', email: emailMaster });
    if (String(url).includes('/rest/v1/profiles')) return j(200, [profilMaster]);
    return j(404, {});
  };
  const app = require('../src/app');
  srv = app.listen(0); u = `http://127.0.0.1:${srv.address().port}`;
});
test.after(() => srv.close());
test.beforeEach(async () => { require('../src/middlewares/rateLimit').store.windows.clear(); await q('delete from jejak'); await q('delete from sesi'); await q('delete from login_gagal'); require('../src/services/jejakService').resetCache(); });

const minta = (path, o = {}) => fetch(u + path, { method: o.method || 'GET', redirect: 'manual', headers: { 'Content-Type': 'application/json', 'User-Agent': o.ua || UA_MAC, 'Accept-Language': 'id-ID', ...(o.cookie ? { Cookie: o.cookie } : {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
const biskuit = (r) => (r.headers.get('set-cookie') || '').split(';')[0];
const pin = (id, p, ua) => minta('/api/auth/editor-login', { method: 'POST', ua, body: { editor_id: id, pin: p } });
const TOKEN = 'a'.repeat(30) + '.' + 'b'.repeat(30);
const sso = (ua) => minta('/api/auth/sso', { method: 'POST', ua, body: { token: TOKEN } });
const idAl = async () => (await q(`select id from editors where nama='Alivia'`))[0].id;
const baris = (w = '') => q(`select * from jejak ${w} order by id`);

test('PIN benar: sesi menyimpan identitas dan perangkat; jejak masuk lengkap dan tertaut ke sesi', async () => {
  const id = await idAl();
  const r = await pin(id, '1234', UA_HP); assert.equal(r.status, 200);
  const [s] = await q(`select * from sesi`);
  assert.deepStrictEqual([s.tipe, s.nama, s.metode, s.ip], ['karyawan', 'Alivia', 'pin', '127.0.0.1']);
  assert.ok(s.ua.includes('SM-A546E')); assert.match(s.sidik, /^[0-9a-f]{12}$/);
  const [j] = await baris(`where jenis='masuk'`);
  assert.deepStrictEqual([j.aksi, j.hasil, j.pengguna_nama, j.metode, j.perangkat, j.model, j.os], ['login_pin', 'ok', 'Alivia', 'pin', 'mobile', 'SM-A546E', 'Android 14']);
  assert.equal(j.sesi, s.token_hash.slice(0, 12), 'kejadian tertaut ke sesi yang sama');
  assert.equal(j.sidik, s.sidik);
});

test('PIN salah berulang dicatat, tidak membocorkan PIN, dan percobaan ke-5 ditandai', async () => {
  const id = await idAl();
  for (let i = 0; i < 5; i++) assert.equal((await pin(id, '000' + i, 'curl/8.4.0')).status, 401);
  const g = await baris(`where jenis='gagal'`);
  assert.equal(g.length, 5); assert.ok(g.every((x) => x.aksi === 'gagal_pin' && x.pengguna_nama === 'Alivia' && x.hasil === 'gagal' && x.status === 401));
  assert.ok(g[4].tanda.includes('gagal_berulang_akun') && g[4].tanda.includes('gagal_berulang_ip'));
  assert.ok(g.every((x) => x.tanda.includes('perangkat_otomatis')), 'curl terdeteksi');
  const nilai = (o) => (o && typeof o === 'object' ? Object.values(o).flatMap(nilai) : [o]);
  const semua = (await baris()).flatMap(nilai).map(String);
  for (const dicoba of ['0000', '0001', '0002', '0003', '0004']) assert.ok(!semua.includes(dicoba) && !semua.some((v) => v.includes('pin=' + dicoba)), 'PIN yang dicoba tersimpan: ' + dicoba);
});

test('terkunci setelah terlalu banyak gagal juga dicatat; PIN benar setelah gagal ditandai', async () => {
  const id = await idAl();
  for (let i = 0; i < 6; i++) await pin(id, 'salah' + i);
  const kunci = await pin(id, '1234'); assert.equal(kunci.status, 429);
  assert.ok((await baris(`where aksi='terkunci'`)).length >= 1);
  await q('delete from login_gagal');
  const ok = await pin(id, '1234'); assert.equal(ok.status, 200);
  const [m] = await baris(`where jenis='masuk'`); assert.ok(m.tanda.includes('berhasil_setelah_gagal'));
});

test('password pemilik: salah dan benar tercatat dengan identitas "Pemilik"', async () => {
  assert.equal((await minta('/api/auth/login', { method: 'POST', body: { password: 'salah' } })).status, 401);
  const r = await minta('/api/auth/login', { method: 'POST', body: { password: 'sandi-pemilik-123' } }); assert.equal(r.status, 200);
  const j = await baris(); assert.deepStrictEqual(j.map((x) => [x.jenis, x.aksi, x.pengguna_nama]), [['gagal', 'gagal_password', 'Pemilik (password)'], ['masuk', 'login_password', 'Pemilik']]);
  assert.ok(!JSON.stringify(j).includes('sandi-pemilik-123'));
});

test('SSO: Windri dan Doni tercatat sebagai orang berbeda; karyawan lewat SSO memakai nama Tokder-nya', async () => {
  profilMaster = { role: 'admin', staff: null, name: 'Windri' }; emailMaster = 'windri@master.app'; assert.equal((await sso()).status, 200);
  profilMaster = { role: 'admin', staff: null, name: 'Doni' }; emailMaster = 'doni@master.app'; assert.equal((await sso()).status, 200);
  profilMaster = { role: 'staff', staff: 'via', name: 'Via' }; emailMaster = 'alivia@master.app'; assert.equal((await sso(UA_HP)).status, 200);
  const j = await baris(`where jenis='masuk'`);
  assert.deepStrictEqual(j.map((x) => [x.pengguna_tipe, x.pengguna_nama, x.akun, x.metode]), [['admin', 'Windri', 'windri@master.app', 'sso'], ['admin', 'Doni', 'doni@master.app', 'sso'], ['karyawan', 'Alivia', 'alivia@master.app', 'sso']]);
  const s = await q(`select nama, akun from sesi order by created_at`); assert.deepStrictEqual(s.map((x) => x.nama), ['Windri', 'Doni', 'Alivia']);
});

test('SSO gagal (belum dipetakan) tercatat dengan akun dan alasannya', async () => {
  profilMaster = { role: 'staff', staff: 'deni', name: 'Deni' }; emailMaster = 'deni@master.app';
  await q(`update editors set nama='Dodi' where nama='Deni'`);
  try {
    assert.equal((await sso()).status, 403);
    const [g] = await baris(`where jenis='gagal'`);
    assert.deepStrictEqual([g.aksi, g.akun, g.status], ['gagal_sso', 'deni@master.app', 403]);
    assert.match(g.detail.alasan_singkat, /dipetakan|nama yang sama/);
  } finally { await q(`update editors set nama='Deni' where nama='Dodi'`); }
});

test('aksi yang mengubah data dan penolakan dicatat; GET biasa tidak', async () => {
  const id = await idAl(); const ck = biskuit(await pin(id, '1234'));
  await minta('/api/bootstrap', { cookie: ck });
  const aksi = await minta('/api/aktivitas', { method: 'POST', cookie: ck, body: {} });
  const ditolak = await minta('/api/jejak', { cookie: ck });
  assert.equal(ditolak.status, 403);
  const j = await baris(`where jenis in ('interaksi','sensitif')`);
  assert.ok(j.some((x) => x.aksi === 'POST /api/aktivitas' && x.pengguna_nama === 'Alivia' && x.status === aksi.status));
  assert.ok(j.some((x) => x.aksi === 'GET /api/jejak' && x.status === 403 && x.hasil === 'gagal'), 'karyawan membuka log: ditolak dan tercatat');
  assert.ok(!j.some((x) => x.aksi === 'GET /api/bootstrap'));
  assert.ok(j.every((x) => x.sesi === ck.length ? true : x.sesi === (j[0].sesi)), 'semua tertaut ke sesi yang sama');
});

test('halaman dibuka dikirim browser, dan tamu tidak bisa mengirim', async () => {
  const id = await idAl(); const ck = biskuit(await pin(id, '1234'));
  assert.equal((await minta('/api/jejak/halaman', { method: 'POST', cookie: ck, body: { rute: '/rangkuman' } })).status, 200);
  assert.equal((await minta('/api/jejak/halaman', { method: 'POST', body: { rute: '/rangkuman' } })).status, 401);
  const h = await baris(`where jenis='halaman'`); assert.deepStrictEqual(h.map((x) => [x.rute, x.pengguna_nama]), [['/rangkuman', 'Alivia']]);
});

test('pemilik: ringkasan, riwayat berfilter, detail pengguna, sesi aktif; karyawan dan tamu ditolak di semua rute', async () => {
  const id = await idAl(); const ckAl = biskuit(await pin(id, '1234', UA_HP));
  profilMaster = { role: 'admin', staff: null, name: 'Windri' }; emailMaster = 'windri@master.app';
  const ckAdm = biskuit(await sso());
  await minta('/api/jejak/halaman', { method: 'POST', cookie: ckAl, body: { rute: '/saran' } });
  const rute = ['/api/jejak', '/api/jejak/ringkasan', '/api/jejak/pengguna?nama=Alivia', '/api/jejak/sesi', '/api/jejak/ekspor'];
  for (const r of rute) { assert.equal((await minta(r)).status, 401, 'tamu ' + r); assert.equal((await minta(r, { cookie: ckAl })).status, 403, 'karyawan ' + r); }
  for (const [r, m] of [['/api/jejak/tinjau/1', 'POST'], ['/api/jejak/tinjau-semua', 'POST'], ['/api/jejak/sesi/aaaaaaaaaaaa/cabut', 'POST']]) { assert.equal((await minta(r, { method: m })).status, 401); assert.equal((await minta(r, { method: m, cookie: ckAl })).status, 403); }
  const ring = await (await minta('/api/jejak/ringkasan', { cookie: ckAdm })).json();
  assert.deepStrictEqual(ring.pengguna.map((x) => x.nama).sort(), ['Alivia', 'Windri']);
  const daf = await (await minta('/api/jejak?nama=Alivia&jenis=masuk', { cookie: ckAdm })).json();
  assert.equal(daf.baris.length, 1); assert.equal(daf.baris[0].perangkat, 'mobile'); assert.equal(typeof daf.baris[0].id, 'string');
  const det = await (await minta('/api/jejak/pengguna?nama=Alivia', { cookie: ckAdm })).json();
  assert.equal(det.perangkat[0].model, 'SM-A546E'); assert.equal(det.halaman[0].rute, '/saran');
  assert.equal((await minta('/api/jejak/pengguna', { cookie: ckAdm })).status, 400);
  const ses = (await (await minta('/api/jejak/sesi', { cookie: ckAdm })).json()).sesi;
  assert.deepStrictEqual(ses.map((s) => [s.nama, s.ini]).sort(), [['Alivia', false], ['Windri', true]]);
});

test('pemilik mengeluarkan sesi karyawan: karyawan langsung ditolak, dan pencabutan tercatat', async () => {
  const id = await idAl(); const ckAl = biskuit(await pin(id, '1234'));
  profilMaster = { role: 'admin', staff: null, name: 'Windri' }; emailMaster = 'windri@master.app';
  const ckAdm = biskuit(await sso());
  assert.equal((await minta('/api/akun', { cookie: ckAl })).status, 200);
  const ses = (await (await minta('/api/jejak/sesi', { cookie: ckAdm })).json()).sesi.find((s) => s.nama === 'Alivia');
  const r = await minta(`/api/jejak/sesi/${ses.id}/cabut`, { method: 'POST', cookie: ckAdm }); assert.equal(r.status, 200); assert.equal((await r.json()).sesiIni, false);
  assert.equal((await minta('/api/akun', { cookie: ckAl })).status, 401, 'tidak bisa lagi memakai sesi itu');
  assert.equal((await minta(`/api/jejak/sesi/${ses.id}/cabut`, { method: 'POST', cookie: ckAdm })).status, 404);
  assert.ok((await baris(`where aksi like 'POST /api/jejak/sesi%'`)).length >= 1, 'pencabutan oleh pemilik tercatat');
});

test('peringatan: ditandai, ditinjau satu per satu dan sekaligus; ekspor CSV aman dan tercatat sebagai data sensitif', async () => {
  const id = await idAl();
  for (let i = 0; i < 2; i++) await pin(id, '1234');
  await pin(id, '1234', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0');
  profilMaster = { role: 'admin', staff: null, name: 'Windri' }; emailMaster = 'windri@master.app';
  const ckAdm = biskuit(await sso());
  const per = await (await minta('/api/jejak?belumDitinjau=1', { cookie: ckAdm })).json();
  assert.equal(per.baris.length, 1); assert.deepStrictEqual(per.baris[0].tanda, ['perangkat_baru']);
  assert.ok(per.baris[0].alasan[0].includes('Edge')); assert.deepStrictEqual(per.baris[0].judulTanda, ['Perangkat baru']);
  const t = await (await minta(`/api/jejak/tinjau/${per.baris[0].id}`, { method: 'POST', cookie: ckAdm })).json(); assert.equal(t.ok, true);
  const [ditinjau] = await q(`select ditinjau_oleh from jejak where ditinjau_pada is not null`); assert.equal(ditinjau.ditinjau_oleh, 'Windri', 'siapa yang meninjau tercatat');
  assert.equal((await (await minta('/api/jejak?belumDitinjau=1', { cookie: ckAdm })).json()).baris.length, 0);
  const csv = await minta('/api/jejak/ekspor?hari=7', { cookie: ckAdm });
  assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/); assert.match(csv.headers.get('content-disposition'), /attachment; filename="jejak-\d{4}-\d{2}-\d{2}\.csv"/);
  const mentah = new Uint8Array(await csv.arrayBuffer());
  assert.deepStrictEqual([...mentah.slice(0, 3)], [0xef, 0xbb, 0xbf], 'diawali BOM agar Excel membaca UTF-8');
  const isi = Buffer.from(mentah).toString('utf8').replace(/^\ufeff/, ''); assert.ok(isi.startsWith('"Waktu (WIB)"')); assert.ok(isi.includes('login_pin'));
  assert.ok((await baris(`where jenis='sensitif' and aksi='GET /api/jejak/ekspor'`)).length === 1, 'mengunduh log juga tercatat');
});

test('logout dan keluar-semua tercatat sebelum sesi berakhir; sesi benar-benar hilang', async () => {
  const id = await idAl(); const ck = biskuit(await pin(id, '1234'));
  assert.equal((await minta('/api/auth/logout', { method: 'POST', cookie: ck })).status, 200);
  assert.equal((await minta('/api/akun', { cookie: ck })).status, 401);
  const ck2 = biskuit(await pin(id, '1234'));
  const r = await minta('/api/auth/keluar-sso', { cookie: ck2 }); assert.equal(r.status, 302);
  const k = await baris(`where jenis='keluar'`); assert.deepStrictEqual(k.map((x) => [x.aksi, x.pengguna_nama]), [['logout', 'Alivia'], ['logout_semua', 'Alivia']]);
  assert.equal((await q('select count(*)::int as n from sesi'))[0].n, 0);
});

test('tidak ada rahasia di jejak: token SSO, kata sandi, dan isi permintaan tidak pernah tersimpan', async () => {
  const id = await idAl();
  await pin(id, '1234'); await sso();
  await minta('/api/auth/login', { method: 'POST', body: { password: 'sandi-pemilik-123' } });
  await minta('/api/aktivitas?token=RAHASIA-QUERY', { method: 'POST', cookie: biskuit(await pin(id, '1234')), body: { catatan: 'ISI-RAHASIA-BODY' } });
  const semua = JSON.stringify(await baris());
  for (const s of ['sandi-pemilik-123', TOKEN, 'RAHASIA-QUERY', 'ISI-RAHASIA-BODY', '"1234"']) assert.ok(!semua.includes(s), 'bocor: ' + s);
});

test('kegagalan database pada pencatatan tidak merusak login atau permintaan', async () => {
  const id = await idAl();
  await q('alter table jejak rename to jejak_sementara');
  try {
    const r = await pin(id, '1234'); assert.equal(r.status, 200, 'login tetap berhasil walau jejak tak bisa ditulis');
    assert.equal((await minta('/api/akun', { cookie: biskuit(r) })).status, 200);
    const gagal = await pin(id, 'salah'); assert.equal(gagal.status, 401);
  } finally { await q('alter table jejak_sementara rename to jejak'); }
});

test('banjir percobaan login yang diblokir pembatas laju tetap terlihat di jejak (satu catatan per menit per IP)', async () => {
  const id = await idAl();
  const hasil = []; for (let i = 0; i < 25; i++) hasil.push((await pin(id, 'salah' + (i % 3))).status);
  assert.ok(hasil.includes(429), 'pembatas laju bekerja');
  const b = await baris(`where aksi = 'dibatasi_laju'`);
  assert.equal(b.length, 1, 'banjir tidak membanjiri log');
  assert.deepStrictEqual([b[0].jenis, b[0].hasil, b[0].status, b[0].rute], ['gagal', 'gagal', 429, '/api/auth/editor-login']);
  const jumlah = await q(`select count(*)::int as n, count(*) filter (where aksi = 'terkunci')::int as terkunci, count(*) filter (where aksi = 'gagal_pin')::int as gagal from jejak`);
  assert.equal(jumlah[0].gagal, 6, 'enam PIN salah pertama');
  assert.ok(jumlah[0].terkunci >= 1, 'penguncian oleh rute tercatat');
  assert.equal(jumlah[0].n, jumlah[0].gagal + jumlah[0].terkunci + 1, 'tiap permintaan dicatat paling banyak sekali: gagal + terkunci + satu catatan banjir');
  assert.ok(jumlah[0].n < hasil.length, 'lebih sedikit dari jumlah permintaan karena banjir dibatasi');
});
