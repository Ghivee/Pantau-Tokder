const test = require('node:test');
const assert = require('node:assert');
const { susunTerlaris, tanpaUang } = require('../src/services/afiliasiService');

const HARI_INI = '2026-11-18';
const r = (tanggal, produk, komisi) => ({ tanggal, produk, komisi });

test('terlaris: urut menurut komisi jendela sekarang, nama beda huruf dan spasi digabung', () => {
  const rows = [r('2026-11-17', 'Pupuk NPK Mutiara 1kg', 5000), r('2026-11-10', 'pupuk  npk mutiara 1kg', 7000), r('2026-11-12', 'Mulsa Perak', 20000), r('2026-11-01', 'Sprayer 16L', 9000)];
  const h = susunTerlaris(rows, 30, HARI_INI);
  assert.deepStrictEqual(h.terlaris.map((x) => [x.produk, x.komisi, x.pesanan]), [['Mulsa Perak', 20000, 1], ['Pupuk NPK Mutiara 1kg', 12000, 2], ['Sprayer 16L', 9000, 1]]);
  assert.strictEqual(h.total, 41000);
  assert.strictEqual(h.data_sampai, '2026-11-17');
});

test('terlaris: jendela tepat hari terakhir dan hari sebelumnya, tren naik/turun/stabil/baru', () => {
  // hari=7 → sekarang 12-18 Nov, sebelumnya 5-11 Nov
  const rows = [
    r('2026-11-12', 'Naik', 1500), r('2026-11-05', 'Naik', 1000),
    r('2026-11-18', 'Turun', 700), r('2026-11-11', 'Turun', 1000),
    r('2026-11-15', 'Stabil', 1000), r('2026-11-08', 'Stabil', 1000),
    r('2026-11-14', 'Baru', 800),
    r('2026-11-04', 'Terlalu Lama', 99999), r('2026-11-19', 'Masa Depan', 99999),
    r('2026-11-09', 'Hanya Sebelumnya', 5000),
  ];
  const h = susunTerlaris(rows, 7, HARI_INI);
  const t = Object.fromEntries(h.terlaris.map((x) => [x.produk, x.tren]));
  assert.deepStrictEqual(t, { Naik: 'naik', Turun: 'turun', Stabil: 'stabil', Baru: 'baru' });
  assert.ok(!h.terlaris.some((x) => /Lama|Depan|Sebelumnya/.test(x.produk)));
  assert.strictEqual(h.total_sebelum, 1000 + 1000 + 1000 + 5000);
});

test('terlaris: batas jendela inklusif (hari ke-7 masuk, hari ke-8 tidak)', () => {
  const h = susunTerlaris([r('2026-11-12', 'A', 100), r('2026-11-11', 'B', 100)], 7, HARI_INI);
  assert.deepStrictEqual(h.terlaris.map((x) => x.produk), ['A']);
});

test('terlaris: maksimal 10, peringkat berurutan, kosong aman', () => {
  const rows = Array.from({ length: 15 }, (_, i) => r('2026-11-17', 'P' + i, 1000 + i));
  const h = susunTerlaris(rows, 30, HARI_INI);
  assert.strictEqual(h.terlaris.length, 10);
  assert.deepStrictEqual(h.terlaris.map((x) => x.peringkat), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepStrictEqual(susunTerlaris([], 30, HARI_INI), { hari: 30, terlaris: [], total: 0, total_sebelum: 0, data_sampai: null });
});

test('tanpa izin penghasilan: tidak ada nominal, jumlah pesanan, maupun total', () => {
  const h = tanpaUang(susunTerlaris([r('2026-11-17', 'Mulsa Perak', 20000), r('2026-11-02', 'Mulsa Perak', 5000)], 30, HARI_INI));
  const teks = JSON.stringify(h);
  assert.ok(!/komisi|pesanan|total|20000|25000|5000/.test(teks), teks);
  assert.deepStrictEqual(h.terlaris[0], { peringkat: 1, produk: 'Mulsa Perak', tren: 'baru' });
  assert.strictEqual(h.uang, false);
});
