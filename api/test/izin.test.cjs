const test = require('node:test');
const assert = require('node:assert');
const { bisa, bisaLihatUang, hapusUang, peranValid, PERAN } = require('../src/utils/izin');

const karyawan = (peran, uang = false) => ({ isAdmin: false, editor: { id: 1, peran, uang } });

test('pemilik boleh semuanya dan melihat penghasilan', () => {
  const r = { isAdmin: true, editor: null };
  for (const a of ['upload', 'tayang', 'hapus', 'tautan']) assert.ok(bisa(r, a));
  assert.ok(bisaLihatUang(r));
});

test('izin menurut peran seperti YouTube Studio', () => {
  assert.deepStrictEqual(['upload', 'tayang', 'hapus', 'tautan'].map((a) => bisa(karyawan('manajer'), a)), [true, true, true, true]);
  assert.deepStrictEqual(['upload', 'tayang', 'hapus', 'tautan'].map((a) => bisa(karyawan('editor'), a)), [true, true, false, true]);
  assert.deepStrictEqual(['upload', 'tayang', 'hapus', 'tautan'].map((a) => bisa(karyawan('terbatas'), a)), [true, false, false, true]);
  assert.deepStrictEqual(['upload', 'tayang', 'hapus', 'tautan'].map((a) => bisa(karyawan('penonton'), a)), [false, false, false, false]);
  assert.ok(!bisa({ isAdmin: false, editor: null }, 'upload'));
});

test('penghasilan hanya untuk pemilik atau karyawan bertanda, apa pun perannya', () => {
  assert.ok(!bisaLihatUang(karyawan('manajer')));
  assert.ok(bisaLihatUang(karyawan('penonton', true)));
  assert.ok(!bisaLihatUang({ isAdmin: false, editor: null }));
});

test('hapusUang membuang kolom revenue di mana pun, tanpa menyentuh data lain', () => {
  const d = { days: 7, vids: [{ id: 1, revenue: 5000, views: 10 }], list: [{ vids: [{ revenue: 1 }], n: 2 }], tgl: new Date(0) };
  const o = hapusUang(d);
  assert.strictEqual(JSON.stringify(o).includes('revenue'), false);
  assert.strictEqual(o.vids[0].views, 10);
  assert.ok(o.tgl instanceof Date);
});

test('peran tak dikenal jatuh ke editor; semua peran terdaftar', () => {
  assert.strictEqual(peranValid('admin'), 'editor');
  assert.deepStrictEqual(PERAN, ['manajer', 'editor', 'terbatas', 'penonton']);
});
