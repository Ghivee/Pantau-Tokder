const test = require('node:test');
const assert = require('node:assert');
const { pasangDb } = require('./_pg.cjs');

let q, jm, master;
const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const UA_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0';
let masterRows = [], sesi = [], mode = 'ok', panggilan = [];

test.before(async () => {
  const d = await pasangDb(); q = d.q;
  Object.assign(process.env, { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_PANTAU_PASSWORD: 'x' });
  const asli = global.fetch;
  global.fetch = async (url, o) => {
    if (!String(url).includes('supabase.co')) return asli(url, o);
    const j = (c, b) => ({ ok: c < 300, status: c, json: async () => b });
    const u = String(url);
    if (u.includes('grant_type=password')) return j(200, { access_token: 'T', expires_in: 3600 });
    const body = o && o.body ? JSON.parse(o.body) : {};
    panggilan.push([u.split('/rest/v1/')[1], body]);
    if (mode === '404') return j(404, {});
    if (mode === '500') return j(500, {});
    if (u.endsWith('/rpc/jejak_master_baca')) return j(200, masterRows.filter((r) => Number(r.id) > Number(body.p_setelah)).slice(0, body.p_batas));
    if (u.endsWith('/rpc/jejak_sesi_aktif')) return j(200, sesi);
    if (u.endsWith('/rpc/jejak_master_pangkas')) return j(200, 7);
    return j(404, {});
  };
  master = require('../src/services/kontenMasterService'); master.reset();
  jm = require('../src/services/jejakMasterService');
});
test.beforeEach(async () => { await q('delete from jejak'); await q('delete from settings where key = $1', ['jejak_master_terakhir']); jm.reset(); require('../src/services/jejakService').resetCache(); masterRows = []; sesi = []; mode = 'ok'; panggilan = []; });

let nomor = 0;
const login = (o = {}) => ({ id: ++nomor, waktu: new Date(Date.now() - 3600000 + nomor * 1000).toISOString(), jenis: 'masuk', aksi: 'sesi_dibuat', aktor: 'u1', aktor_email: 'alivia@master.app', aktor_nama: 'Alivia', ip: '203.0.113.5', ua: UA_MAC, tabel: null, baris_id: null, ringkas: null, ...o });
const ubah = (o = {}) => ({ id: ++nomor, waktu: new Date().toISOString(), jenis: 'perubahan', aksi: 'update', aktor: 'u1', aktor_email: 'doni@master.app', aktor_nama: 'Doni', tabel: 'kas_harian', baris_id: '42', ringkas: 'cocok_bank,status', ip: null, ua: null, ...o });

test('login Master disalin lengkap dengan IP dan perangkat; akun otomatis Tokder diberi label layanan dan tidak dinilai', async () => {
  masterRows = [login(), login({ aktor_email: 'pantau@master.app', aktor_nama: 'Tokder (otomatis)', ua: 'node', ip: '54.169.162.243' })];
  const h = await jm.sinkron({ paksa: true });
  assert.deepStrictEqual([h.terhubung, h.baru], [true, 2]);
  const [a, l] = await q(`select * from jejak order by id`);
  assert.deepStrictEqual([a.sumber, a.jenis, a.aksi, a.pengguna_tipe, a.pengguna_nama, a.akun, a.kunci, a.metode], ['master', 'masuk', 'login_master', 'akun', 'Alivia', 'alivia@master.app', 'm:alivia@master.app', 'master']);
  assert.deepStrictEqual([a.ip, a.jaringan, a.browser, a.os, a.perangkat], ['203.0.113.5', '203.0.113.0/24', 'Chrome 124', 'macOS', 'desktop']);
  assert.deepStrictEqual([l.pengguna_tipe, l.perangkat, l.risiko, l.tanda], ['layanan', 'layanan', 0, []]);
  assert.ok(new Date(a.waktu).getTime() < Date.now() - 3000000, 'waktu asli dari Master dipertahankan');
});

test('sinkron bertahap: hanya yang baru ditarik, titik terakhir tersimpan, dan baris yang sama tidak pernah ganda', async () => {
  masterRows = [login(), login()];
  assert.equal((await jm.sinkron({ paksa: true })).baru, 2);
  assert.equal((await q(`select value from settings where key = 'jejak_master_terakhir'`))[0].value, String(masterRows[1].id));
  masterRows.push(login(), ubah());
  const h = await jm.sinkron({ paksa: true }); assert.equal(h.baru, 2);
  assert.equal(panggilan.at(-1)[1].p_setelah, masterRows[1].id, 'melanjutkan tepat setelah titik terakhir');
  assert.equal((await q('select count(*)::int as n from jejak')).at(0).n, 4);
  // titik terakhir dikembalikan ke 0: seluruh baris dikirim ulang, tetapi tidak ada yang ganda
  await q(`update settings set value = '0' where key = 'jejak_master_terakhir'`);
  const ulang = await jm.sinkron({ paksa: true }); assert.equal(ulang.baru, 0, 'semua sudah ada');
  assert.equal((await q('select count(*)::int as n from jejak')).at(0).n, 4);
});

test('perubahan data di Master tercatat dengan pelaku, tabel, dan kolom yang berubah; tanpa IP dan perangkat', async () => {
  masterRows = [ubah(), ubah({ aksi: 'delete', tabel: 'konten', ringkas: null, aktor_email: null, aktor_nama: 'sistem/SQL', aktor: null })];
  await jm.sinkron({ paksa: true });
  const [a, b] = await q('select * from jejak order by id');
  assert.deepStrictEqual([a.sumber, a.jenis, a.aksi, a.pengguna_nama, a.risiko], ['master', 'perubahan', 'update kas_harian', 'Doni', 0]);
  assert.deepStrictEqual([a.detail.tabel, a.detail.baris_id, a.detail.ringkas], ['kas_harian', '42', 'cocok_bank,status']);
  assert.deepStrictEqual([a.ip, a.ua, a.perangkat], [null, null, null]);
  assert.deepStrictEqual([b.aksi, b.pengguna_nama, b.akun, b.kunci], ['delete konten', 'sistem/SQL', null, 'm:sistem']);
});

test('akun otomatis Tokder yang masuk berulang dari IP AWS berbeda tidak pernah memicu keanehan (itu perilaku normal serverless)', async () => {
  const svc = (ip, ua = 'node') => login({ aktor_email: 'pantau@master.app', aktor_nama: 'Tokder (otomatis)', ua, ip });
  masterRows = [svc('54.169.162.243'), svc('47.129.163.125'), svc('13.250.8.193'), svc('13.214.199.149', 'curl/8.4.0')];
  await jm.sinkron({ paksa: true });
  const r = await q(`select tanda, risiko, pengguna_tipe from jejak order by id`);
  assert.ok(r.every((x) => x.pengguna_tipe === 'layanan' && x.risiko === 0 && x.tanda.length === 0), JSON.stringify(r));
});

test('keanehan login Master dinilai: perangkat baru setelah ada riwayat, dan login pertama tidak dianggap aneh', async () => {
  masterRows = [login(), login(), login({ ua: UA_WIN, ip: '198.51.100.20' })];
  await jm.sinkron({ paksa: true });
  const r = await q(`select tanda, risiko, detail from jejak order by id`);
  assert.deepStrictEqual(r.slice(0, 2).map((x) => x.tanda), [[], []]);
  assert.deepStrictEqual(r[2].tanda.sort(), ['jaringan_baru', 'perangkat_baru']);
  assert.ok(r[2].detail.alasan.some((a) => a.includes('Edge')));
});

test('dibatasi sekali per menit, tidak berjalan ganda bersamaan, dan galat Master dilaporkan tanpa melempar', async () => {
  masterRows = [login()];
  const [a, b] = await Promise.all([jm.sinkron({ paksa: true }), jm.sinkron({ paksa: true })]);
  assert.deepStrictEqual([a.baru, b.baru], [1, 1], 'panggilan bersamaan berbagi satu pekerjaan');
  assert.equal(panggilan.filter(([n]) => n === 'rpc/jejak_master_baca').length, 1);
  masterRows.push(login());
  assert.equal((await jm.sinkron()).dilewati, true, 'terlalu cepat: dilewati');
  assert.equal((await jm.sinkron({ paksa: true })).baru, 1);
  mode = '404';
  const g404 = await jm.sinkron({ paksa: true }); assert.match(g404.galat, /jejak\.sql/); assert.equal(g404.baru, 0);
  mode = '500';
  const g500 = await jm.sinkron({ paksa: true }); assert.match(g500.galat, /menolak/);
  mode = 'ok'; assert.equal((await jm.sinkron()).dilewati, undefined, 'setelah galat boleh dicoba lagi segera');
});

test('tanpa pengaturan Master: terhubung=false dan tidak ada panggilan jaringan', async () => {
  const simpan = process.env.MASTER_PANTAU_PASSWORD; delete process.env.MASTER_PANTAU_PASSWORD; panggilan = [];
  try {
    assert.deepStrictEqual(await jm.sinkron({ paksa: true }), { terhubung: false, baru: 0 });
    assert.deepStrictEqual(await jm.sesiMaster(), { terhubung: false, sesi: [] });
    assert.equal(await jm.pangkas(), 0); assert.equal(panggilan.length, 0);
  } finally { process.env.MASTER_PANTAU_PASSWORD = simpan; }
});

test('sesi Master aktif: akun otomatis ditandai; pangkas mengembalikan jumlah; pesan jelas bila SQL belum dipasang', async () => {
  sesi = [{ email: 'alivia@master.app', nama: 'Alivia', ip: '203.0.113.5', ua: UA_MAC, dibuat: new Date().toISOString() }, { email: 'pantau@master.app', nama: 'Tokder (otomatis)', ip: '54.1.1.1', ua: 'node', dibuat: new Date().toISOString() }];
  const s = await jm.sesiMaster(); assert.deepStrictEqual(s.sesi.map((x) => [x.email, x.layanan]), [['alivia@master.app', false], ['pantau@master.app', true]]);
  assert.equal(await jm.pangkas(), 7);
  mode = '404'; assert.match((await jm.sesiMaster()).galat, /jejak\.sql/);
});

test('ringkasan menampilkan orang dari Master dan Tokder bersama; akun layanan tidak muncul sebagai orang', async () => {
  masterRows = [login(), login({ aktor_email: 'pantau@master.app', aktor_nama: 'Tokder (otomatis)', ua: 'node' }), login({ aktor_email: 'doni@master.app', aktor_nama: 'Doni', ip: '198.51.100.8' })];
  await jm.sinkron({ paksa: true });
  const r = await require('../src/services/jejakService').ringkasan();
  assert.deepStrictEqual(r.pengguna.map((x) => x.nama).sort(), ['Alivia', 'Doni']);
  assert.ok(!r.pengguna.some((x) => /otomatis/i.test(x.nama)));
  const dm = await require('../src/services/jejakService').daftar({ sumber: 'master' }); assert.equal(dm.baris.length, 3);
});
