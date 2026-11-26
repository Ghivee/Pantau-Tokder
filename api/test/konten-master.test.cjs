const test = require('node:test');
const assert = require('node:assert');
const svc = require('../src/services/kontenMasterService');

const ENV = { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_PANTAU_PASSWORD: 'rahasia' };
const pasang = (env) => { for (const k of Object.keys(ENV)) delete process.env[k]; Object.assign(process.env, env); svc.reset(); };
const jawab = (code, j) => ({ ok: code < 300, status: code, json: async () => j });

test('tanpa env: mati tanpa galat dan tanpa memanggil jaringan', async () => {
  pasang({});
  const asli = global.fetch; let n = 0; global.fetch = async () => { n++; };
  try { assert.deepStrictEqual(await svc.daftar(), { terhubung: false, daftar: {} }); assert.strictEqual(n, 0); } finally { global.fetch = asli; }
});

test('kunci service_role ditolak', async () => {
  pasang({ ...ENV, MASTER_SUPABASE_ANON_KEY: 'service_role_' + 'k'.repeat(30) });
  assert.strictEqual(svc.siap(), false);
});

test('login sebagai pantau, membaca konten, lalu memakai cache', async () => {
  pasang(ENV);
  const asli = global.fetch; const panggilan = [];
  global.fetch = async (url, o) => {
    panggilan.push([url, o]);
    if (url.includes('grant_type=password')) return jawab(200, { access_token: 'T', expires_in: 3600 });
    return jawab(200, [{ judul: 'Semai cabai', channel: 'cabe', petugas: 'via', status: 'tayang', youtube_id: 'dQw4w9WgXcQ' }]);
  };
  try {
    const a = await svc.daftar();
    assert.strictEqual(a.terhubung, true);
    assert.strictEqual(a.daftar.dQw4w9WgXcQ.petugas, 'via');
    assert.strictEqual(JSON.parse(panggilan[0][1].body).email, 'pantau@master.app');
    assert.strictEqual(panggilan[1][1].headers.Authorization, 'Bearer T');
    await svc.daftar();
    assert.strictEqual(panggilan.length, 2);
  } finally { global.fetch = asli; }
});

test('login gagal melempar galat yang jelas', async () => {
  pasang(ENV);
  const asli = global.fetch; global.fetch = async () => jawab(400, {});
  try { await assert.rejects(svc.daftar(), /Login akun pantau di Office gagal/); } finally { global.fetch = asli; }
});

