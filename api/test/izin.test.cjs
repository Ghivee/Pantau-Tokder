const test = require('node:test');
const assert = require('node:assert');
const { bisa, bisaLihatUang, hapusUang, resolve, KUNCI, KATALOG, MASTER } = require('../src/utils/izin');

const karyawan = (izin) => ({ isAdmin: false, editor: { id: 1, izin } });

test('pemilik boleh semuanya dan melihat penghasilan', () => {
  const r = { isAdmin: true, editor: null };
  for (const a of ['upload', 'tayang', 'hapus', 'tautan', 'tetapkan']) assert.ok(bisa(r, a));
  assert.ok(bisaLihatUang(r));
});

test('karyawan hanya bisa apa yang diizinkan satu per satu, tanpa memandang jabatan', () => {
  const r = karyawan({ upload: true, tayang: false, hapus: true, tautan: false });
  assert.deepStrictEqual(['upload', 'tayang', 'hapus', 'tautan'].map((a) => bisa(r, a)), [true, false, true, false]);
  assert.ok(!bisa(karyawan({}), 'upload'), 'kunci yang tidak ada = tidak boleh');
  assert.ok(!bisa({ isAdmin: false, editor: null }, 'upload'));
});

test('penghasilan hanya untuk pemilik atau karyawan yang diizinkan', () => {
  assert.ok(!bisaLihatUang(karyawan({ upload: true })));
  assert.ok(bisaLihatUang(karyawan({ uang: true })));
  assert.ok(!bisaLihatUang({ isAdmin: false, editor: null }));
});

test('belum pernah diatur: nilai awal dari aturan lama, tidak ada yang kehilangan akses mendadak', () => {
  const a = resolve({ peran: 'editor', lihat_penghasilan: false, izin: null });
  assert.strictEqual(a.tersimpan, false);
  assert.deepStrictEqual(['upload', 'tayang', 'hapus', 'tautan', 'tetapkan', 'uang'].map((k) => a.izin[k]), [true, true, false, true, true, false]);
  assert.strictEqual(resolve({ peran: 'manajer', izin: null }).izin.hapus, true);
  assert.strictEqual(resolve({ peran: 'penonton', izin: null }).izin.upload, false);
  assert.strictEqual(resolve({ peran: 'terbatas', lihat_penghasilan: true, izin: null }).izin.uang, true);
  assert.strictEqual(a.izin.master_kas_catat, false);
  assert.strictEqual(a.izin.master_order_lihat, true);
});

test('setelah diatur pemilik, izin tersimpan menang atas jabatan lama', () => {
  const r = resolve({ peran: 'manajer', lihat_penghasilan: true, izin: { upload: false, hapus: false, uang: false, master_kas_catat: true } });
  assert.strictEqual(r.tersimpan, true);
  assert.deepStrictEqual([r.izin.upload, r.izin.hapus, r.izin.uang, r.izin.master_kas_catat], [false, false, false, true]);
  assert.strictEqual(r.izin.tayang, true, 'kunci yang tidak tersimpan jatuh ke nilai awal');
});

test('data izin rusak diabaikan, nilai non-boolean tidak dipercaya', () => {
  assert.strictEqual(resolve({ peran: 'editor', izin: 'rusak' }).tersimpan, false);
  assert.strictEqual(resolve({ peran: 'editor', izin: ['x'] }).tersimpan, false);
  assert.strictEqual(resolve({ peran: 'editor', izin: { hapus: 'ya', upload: 1 } }).izin.hapus, false);
  assert.strictEqual(resolve({ peran: 'editor', izin: { upload: 1 } }).izin.upload, true, 'nilai awal dipakai, bukan 1');
});

test('katalog konsisten: semua kunci unik dan izin Master terdaftar', () => {
  assert.strictEqual(new Set(KUNCI).size, KUNCI.length);
  assert.ok(KATALOG.length === 3);
  for (const k of Object.keys(MASTER)) assert.ok(KUNCI.includes(k));
});

test('hapusUang membuang kolom revenue di mana pun, tanpa menyentuh data lain', () => {
  const d = { days: 7, vids: [{ id: 1, revenue: 5000, views: 10 }], list: [{ vids: [{ revenue: 1 }], n: 2 }], tgl: new Date(0) };
  const o = hapusUang(d);
  assert.strictEqual(JSON.stringify(o).includes('revenue'), false);
  assert.strictEqual(o.vids[0].views, 10);
  assert.ok(o.tgl instanceof Date);
});
