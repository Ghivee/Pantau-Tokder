const test = require('node:test');
const assert = require('node:assert');
const { ringkasCuaca, aturan } = require('../src/services/saranService');
const { sisipKode } = require('../src/routes/posting');

const hari = (lalu, depan, suhu = 29, rh = 80) => ({
  precipitation_sum: [...lalu, ...depan], temperature_2m_max: Array(14).fill(suhu), relative_humidity_2m_mean: Array(14).fill(rh),
});

test('minggu basah: patek dan akar busuk muncul, hama kering tidak', () => {
  const c = ringkasCuaca(hari([12, 12, 12, 12, 12, 12, 12], [15, 15, 15, 15, 15, 15, 15], 28, 90));
  const id = aturan(c).map((x) => x.id);
  assert.ok(id.includes('patek-hujan') && id.includes('akar-busuk') && !id.includes('hama-kering'));
});

test('minggu kering dan panas: hama penghisap muncul, patek tidak', () => {
  const c = ringkasCuaca(hari([0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], 33, 60));
  const id = aturan(c).map((x) => x.id);
  assert.ok(id.includes('hama-kering') && !id.includes('patek-hujan'));
});

test('selalu ada saran dengan masalah, solusi, produk, judul dan dasar data', () => {
  for (const c of [ringkasCuaca(hari(Array(7).fill(5), Array(7).fill(3))), ringkasCuaca(hari(Array(7).fill(0), Array(7).fill(0)))]) {
    const s = aturan(c);
    assert.ok(s.length >= 1 && s.length <= 4);
    for (const x of s) assert.ok(x.masalah && x.solusi.length && x.produk.length && x.judul.length && x.dasar && x.produk.every((p) => p.url.startsWith('https://shopee.co.id/search?keyword=')));
  }
});

test('kode karyawan disisipkan sekali dan tidak menyalahi kata lain', () => {
  assert.strictEqual(sisipKode('Pupuk', 'AL'), 'Pupuk\n#AL');
  assert.strictEqual(sisipKode('Cek #AL ini', '#AL'), 'Cek #AL ini');
  assert.strictEqual(sisipKode('KODE desa', 'DE'), 'KODE desa\n#DE');
  assert.strictEqual(sisipKode('x', ''), 'x');
});
