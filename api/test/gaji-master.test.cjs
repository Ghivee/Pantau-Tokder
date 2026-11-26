const test = require('node:test');
const assert = require('node:assert');
const master = require('../src/services/kontenMasterService');
const svc = require('../src/services/masterGajiService');

const ENV = { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_PANTAU_PASSWORD: 'rahasia' };
const pasang = (env) => { for (const k of Object.keys(ENV)) delete process.env[k]; Object.assign(process.env, env); master.reset(); svc.reset(); };
const jawab = (code, j) => ({ ok: code < 300, status: code, json: async () => j });

test('penjualan: tanpa env tidak memanggil jaringan dan tidak melempar', async () => {
  pasang({});
  const asli = global.fetch; let n = 0; global.fetch = async () => { n++; };
  try { const r = await svc.penjualan('2026-11'); assert.strictEqual(r.terhubung, false); assert.strictEqual(r.pcs, 0); assert.strictEqual(n, 0); } finally { global.fetch = asli; }
});

test('penjualan: menjumlah pcs per channel dari rpc penjualan_pcs, lalu memakai cache', async () => {
  pasang(ENV);
  const asli = global.fetch; const url = [];
  global.fetch = async (u, o) => {
    url.push([u, o && o.body]);
    if (u.includes('grant_type=password')) return jawab(200, { access_token: 'T', expires_in: 3600 });
    return jawab(200, [{ channel: 'shopee', pcs: 52 }, { channel: 'lincah', pcs: 8 }]);
  };
  try {
    const r = await svc.penjualan('2026-11');
    assert.deepStrictEqual(r, { terhubung: true, pcs: 60, per_channel: { shopee: 52, lincah: 8 } });
    assert.match(url[1][0], /rpc\/penjualan_pcs$/);
    assert.deepStrictEqual(JSON.parse(url[1][1]), { p_bulan: '2026-11' });
    await svc.penjualan('2026-11');
    assert.strictEqual(url.length, 2, 'bulan sama memakai cache');
  } finally { global.fetch = asli; }
});

test('penjualan: fungsi belum dipasang di Master memberi pesan jelas', async () => {
  pasang(ENV);
  const asli = global.fetch;
  global.fetch = async (u) => (u.includes('grant_type') ? jawab(200, { access_token: 'T', expires_in: 3600 }) : jawab(404, { message: 'not found' }));
  try { const r = await svc.penjualan('2026-11'); assert.strictEqual(r.terhubung, false); assert.match(r.galat, /gaji-pantau\.sql/); } finally { global.fetch = asli; }
});

test('susunKiriman: kunci akun Master bila dipetakan, final hanya bila semua final', () => {
  const eds = [{ id: 1, akun_master: 'via' }, { id: 2, akun_master: null }];
  const d = svc.susunKiriman([{ editor_id: 1, nama: 'Via', total: 3150000.4, status: 'final' }, { editor_id: 2, nama: 'Rina', total: 2000000, status: 'draf' }], eds);
  assert.deepStrictEqual(d, { staff: { via: { total: 3150000, nama: 'Via', final: true }, pantau_2: { total: 2000000, nama: 'Rina', final: false } }, final: false });
  assert.strictEqual(svc.susunKiriman([{ editor_id: 1, nama: 'Via', total: 1, status: 'final' }], eds).final, true);
});
