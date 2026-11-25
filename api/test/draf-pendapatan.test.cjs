const test = require('node:test');
const assert = require('node:assert');
const { susunDraf, bulanSelesai } = require('../src/services/drafPendapatanService');

test('bulan selesai: dua bulan terakhir sebelum bulan berjalan, termasuk lintas tahun', () => {
  assert.deepStrictEqual(bulanSelesai(new Date('2026-11-25T03:00:00Z')), ['2026-09', '2026-10']);
  assert.deepStrictEqual(bulanSelesai(new Date('2027-01-05T03:00:00Z')), ['2026-11', '2026-12']);
  assert.deepStrictEqual(bulanSelesai(new Date('2026-10-31T20:00:00Z')), ['2026-09', '2026-10']); // 1 Nov WIB sudah November
});

test('draf adsense: total dibulatkan, rincian per channel urut terbesar, tanggal akhir bulan', () => {
  const [d] = susunDraf({ ym: '2026-02', adsense: [{ channel_id: 'a', total: 100000.4 }, { channel_id: 'b', total: 250000.2 }], nama: { a: 'Tokder', b: 'Budidaya Cabe' }, afiliasi: 0 });
  assert.strictEqual(d.kunci, 'adsense:2026-02');
  assert.strictEqual(d.platform, 'youtube');
  assert.strictEqual(d.jumlah, 350001);
  assert.strictEqual(d.tanggal, '2026-02-28');
  assert.ok(d.catatan.indexOf('Budidaya Cabe') < d.catatan.indexOf('Tokder'));
  assert.ok(/Februari 2026/.test(d.catatan));
});

test('draf afiliasi terpisah; nol atau kosong tidak membuat draf', () => {
  const r = susunDraf({ ym: '2026-10', adsense: [{ channel_id: 'a', total: 0 }], nama: {}, afiliasi: 125000.6 });
  assert.deepStrictEqual(r.map((x) => [x.kunci, x.platform, x.jumlah]), [['afiliasi:2026-10', 'afiliasi', 125001]]);
  assert.deepStrictEqual(susunDraf({ ym: '2026-10', adsense: [], nama: {}, afiliasi: 0.2 }), []);
});

test('channel tanpa nama memakai id; channel dengan pendapatan nol tidak masuk rincian', () => {
  const [d] = susunDraf({ ym: '2026-10', adsense: [{ channel_id: 'UCx', total: 5000 }, { channel_id: 'b', total: 0 }], nama: { b: 'B' }, afiliasi: 0 });
  assert.ok(d.catatan.includes('UCx') && !d.catatan.includes(' B '));
});

test('kirim: membuat draf yang belum ada, tidak menyentuh yang sudah ada, dan menolak bila belum rupiah', async () => {
  const db = require('../src/config/db');
  const draf = require('../src/services/drafPendapatanService');
  const master = require('../src/services/kontenMasterService');
  const asliQuery = db.query, asliFetch = global.fetch;
  const ENV = { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_PANTAU_PASSWORD: 'x' };
  Object.assign(process.env, ENV); master.reset();
  let rupiah = true;
  const ada = {}; const posts = [];
  db.query = async (sql) => {
    if (/pendapatan_rupiah/.test(sql)) return { rows: rupiah ? [{}] : [] };
    if (/channel_daily/.test(sql)) return { rows: [{ channel_id: 'a', total: 400000 }] };
    if (/afiliasi_komisi/.test(sql)) return { rows: [{ total: 90000 }] };
    if (/settings/.test(sql)) return { rows: [] };
    return { rows: [] };
  };
  const bulan = bulanSelesai();
  ada['adsense:' + bulan[0]] = 'disetujui'; // sudah ada dan diputuskan
  global.fetch = async (url, o) => {
    const j = (code, body) => ({ ok: code < 300, status: code, json: async () => body });
    if (url.includes('grant_type=password')) return j(200, { access_token: 'T', expires_in: 3600 });
    if (o.method === 'GET') return j(200, Object.entries(ada).map(([k, s]) => ({ sumber_kunci: k, status: s })));
    posts.push(JSON.parse(o.body)); return j(201, null);
  };
  try {
    const r = await draf.kirim();
    assert.strictEqual(r.sudah, 1);
    assert.strictEqual(r.dibuat, 3); // 2 bulan x (adsense, afiliasi) minus 1 yang sudah ada
    assert.ok(posts.every((p) => p.sumber_kunci && ['youtube', 'afiliasi'].includes(p.platform) && p.jumlah > 0));
    assert.ok(!posts.some((p) => p.sumber_kunci === 'adsense:' + bulan[0]));
    rupiah = false; posts.length = 0;
    await assert.rejects(draf.kirim(), /rupiah/);
    assert.strictEqual(posts.length, 0);
  } finally { db.query = asliQuery; global.fetch = asliFetch; master.reset(); for (const k of Object.keys(ENV)) delete process.env[k]; }
});
