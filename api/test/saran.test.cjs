const test = require('node:test');
const assert = require('node:assert');
const { ringkasCuaca, aturan, kondisiOf, temaOf } = require('../src/services/saranService');
const { MASALAH, harga, SEPANJANG_MASA, gabung } = require('../src/services/saranData');
const { sisipKode } = require('../src/routes/posting');

const hari = (lalu, depan, suhu = 29, rh = 80) => ({
  precipitation_sum: [...lalu, ...depan], temperature_2m_max: Array(14).fill(suhu), relative_humidity_2m_mean: Array(14).fill(rh),
});

test('minggu basah: patek dan akar busuk muncul, hama kering tidak', () => {
  const c = ringkasCuaca(hari([12, 12, 12, 12, 12, 12, 12], [15, 15, 15, 15, 15, 15, 15], 28, 90));
  const id = aturan(c).map((x) => x.id);
  assert.ok(id.includes('patek') && id.includes('akar') && !id.includes('hama'));
  assert.strictEqual(kondisiOf(c), 'hujan');
});

test('minggu kering dan panas: hama muncul, patek tidak', () => {
  const c = ringkasCuaca(hari([0, 0, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], 33, 60));
  const id = aturan(c).map((x) => x.id);
  assert.ok(id.includes('hama') && !id.includes('patek'));
  assert.strictEqual(kondisiOf(c), 'kering');
});

test('selalu ada 1 sampai 4 masalah dengan dasar data', () => {
  for (const c of [ringkasCuaca(hari(Array(7).fill(5), Array(7).fill(3))), ringkasCuaca(hari(Array(7).fill(0), Array(7).fill(0)))]) {
    const a = aturan(c);
    assert.ok(a.length >= 1 && a.length <= 4);
    assert.ok(a.every((x) => MASALAH[x.id] && x.dasar));
  }
});

test('setiap masalah punya isi video serta banyak judul dan kata kunci per tema', () => {
  for (const m of Object.values(MASALAH)) {
    assert.ok(m.masalah && m.solusi.length === 3 && m.produk.length >= 2);
    assert.ok(m.produk.every((p) => p.url.startsWith('https://shopee.co.id/search?keyword=')));
    assert.ok(m.budidaya.judul.length >= 6 && m.budidaya.kata.length >= 8);
    assert.ok(m.tokder.judul.length >= 5 && m.tokder.kata.length >= 6);
    for (const j of [...m.budidaya.judul, ...m.tokder.judul]) assert.ok(j.length <= 100, 'judul YouTube maksimal 100 karakter: ' + j);
  }
});

test('channel harga: judul memuat tanggal, tidak menebak arah harga, tiap kondisi punya variasi', () => {
  for (const k of ['hujan', 'kering', 'campuran']) {
    const h = harga(k, '18 November 2026', '18 November', 'November 2026');
    assert.ok(h.judul.length >= 8 && h.kata.length >= 10);
    assert.ok(h.judul.some((j) => j.includes('18 November')));
    assert.ok(h.kata.includes('harga cabe November 2026'));
    for (const j of h.judul) assert.ok(j.length <= 100);
    assert.ok(h.judul.every((j) => !/pasti (naik|turun)/i.test(j)));
  }
});

test('judul dan kata kunci banyak per channel, tanpa duplikat dan muat batas YouTube', () => {
  for (const m of Object.values(MASALAH)) for (const [tema, umum] of [['budidaya', SEPANJANG_MASA.budidaya], ['tokder', SEPANJANG_MASA.tokder]]) {
    const g = gabung(m[tema], umum);
    assert.ok(g.judul.length >= 13 && g.kata.length >= 14, `${tema}: ${g.judul.length} judul, ${g.kata.length} kata`);
    assert.strictEqual(new Set(g.judul).size, g.judul.length);
    assert.ok(g.judul.every((j) => j.length <= 100));
  }
  assert.ok(harga('hujan', '18 November 2026', '18 November', 'November 2026').judul.length >= 12);
});

test('tema channel dari nama', () => {
  assert.strictEqual(temaOf('Harga Cabe Hari Ini'), 'harga');
  assert.strictEqual(temaOf('Budidaya Cabe'), 'budidaya');
  assert.strictEqual(temaOf('Tokder'), 'tokder');
});

test('kode karyawan disisipkan sekali dan tidak menyalahi kata lain', () => {
  assert.strictEqual(sisipKode('Pupuk', 'AL'), 'Pupuk\n#AL');
  assert.strictEqual(sisipKode('Cek #AL ini', '#AL'), 'Cek #AL ini');
  assert.strictEqual(sisipKode('KODE desa', 'DE'), 'KODE desa\n#DE');
  assert.strictEqual(sisipKode('x', ''), 'x');
});
