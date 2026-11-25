const test = require('node:test');
const assert = require('node:assert');
const sso = require('../src/services/ssoMasterService');

const ENV = { MASTER_SUPABASE_URL: 'https://abc.supabase.co', MASTER_SUPABASE_ANON_KEY: 'k'.repeat(40), MASTER_APP_URL: 'https://master.example.app/' };
const pasang = (env) => { for (const k of Object.keys(ENV)) delete process.env[k]; Object.assign(process.env, env); };
const j = (code, body) => ({ ok: code < 300, status: code, json: async () => body });
const TOKEN = 'a'.repeat(30) + '.' + 'b'.repeat(30);

test('peta peran: admin jadi pemilik, staff cocok nama karyawan aktif, sisanya ditolak', () => {
  const eds = [{ id: 1, nama: 'Via', status: 'aktif' }, { id: 2, nama: 'Deni', status: 'nonaktif' }];
  assert.deepStrictEqual(sso.petakan({ role: 'admin' }, eds), { tipe: 'admin' });
  assert.deepStrictEqual(sso.petakan({ role: 'staff', staff: 'via', name: ' via ' }, eds), { tipe: 'karyawan', editorId: 1, nama: 'Via' });
  assert.ok(sso.petakan({ role: 'staff', staff: 'deni', name: 'Deni' }, eds).galat, 'karyawan nonaktif ditolak');
  assert.ok(sso.petakan({ role: 'staff', staff: 'x', name: 'Zed' }, eds).galat, 'nama tidak ada di Pantau');
  assert.strictEqual(sso.petakan({ role: 'reader' }, eds).status, 403);
});

test('url Master hanya https dan dinormalkan', () => {
  pasang(ENV); assert.strictEqual(sso.masterUrl(), 'https://master.example.app');
  pasang({ ...ENV, MASTER_APP_URL: 'http://master.example.app' }); assert.strictEqual(sso.masterUrl(), '');
  pasang({ ...ENV, MASTER_APP_URL: 'bukan url' }); assert.strictEqual(sso.masterUrl(), '');
});

test('tanpa env atau dengan service_role: tidak aktif dan ditolak 503', async () => {
  pasang({}); assert.strictEqual(sso.aktif(), false);
  await assert.rejects(sso.verifikasi(TOKEN), (e) => e.status === 503);
  pasang({ ...ENV, MASTER_SUPABASE_ANON_KEY: 'service_role_' + 'k'.repeat(30) }); assert.strictEqual(sso.aktif(), false);
});

test('token berbentuk aneh ditolak tanpa memanggil jaringan', async () => {
  pasang(ENV); const asli = global.fetch; let n = 0; global.fetch = async () => { n++; };
  try {
    for (const t of ['', 'pendek', 'a b'.repeat(20), '../etc/passwd'.repeat(5), null]) await assert.rejects(sso.verifikasi(t), (e) => e.status === 400);
    assert.strictEqual(n, 0);
  } finally { global.fetch = asli; }
});

test('verifikasi: token valid membaca peran dari profiles memakai token yang sama', async () => {
  pasang(ENV); const asli = global.fetch; const p = [];
  global.fetch = async (url, o) => {
    p.push([url, o.headers]);
    if (url.endsWith('/auth/v1/user')) return j(200, { id: 'u1', email: 'via@master.app' });
    return j(200, [{ role: 'staff', staff: 'via', name: 'Via' }]);
  };
  try {
    const r = await sso.verifikasi(TOKEN);
    assert.deepStrictEqual(r, { id: 'u1', email: 'via@master.app', role: 'staff', staff: 'via', name: 'Via' });
    assert.ok(p.every(([, h]) => h.Authorization === 'Bearer ' + TOKEN));
  } finally { global.fetch = asli; }
});

test('verifikasi: token kedaluwarsa 401, bukan akun master 403, tanpa peran 403, Supabase mati 502', async () => {
  pasang(ENV); const asli = global.fetch;
  const coba = async (impl, status) => { global.fetch = impl; await assert.rejects(sso.verifikasi(TOKEN), (e) => e.status === status); };
  try {
    await coba(async () => j(401, {}), 401);
    await coba(async () => j(200, { id: 'u', email: 'orang@gmail.com' }), 403);
    await coba(async (u) => (u.endsWith('/user') ? j(200, { id: 'u', email: 'x@master.app' }) : j(200, [])), 403);
    await coba(async () => j(500, {}), 502);
  } finally { global.fetch = asli; }
});
