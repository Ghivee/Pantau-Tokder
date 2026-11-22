const test = require('node:test');
const assert = require('node:assert');
const { analisisGaya } = require('../src/services/gayaService');
const { temaOf } = require('../src/services/saranService');
const { sisipKode } = require('../src/routes/posting');

const rows = (judul, f = (i) => 10000 - i * 500) => judul.map((j, i) => ({ judul: j, views: f(i) + (/\?/.test(j) ? 8000 : 0), tipe_video: 'long', umur_hari: 30 }));
const TANYA = ['Kenapa Cabe Rawit Rontok? Ini Penyebabnya', 'Cabe Rawit Layu Mendadak? Selamatkan', 'Hama Thrips Cabe Rawit? Atasi', 'Cara Semai Cabe Rawit', 'Panen Cabe Rawit Harian', 'Jarak Tanam Cabe Rawit', 'Pupuk Cabe Rawit Murah', 'Pangkas Cabe Rawit', 'Mulsa Cabe Rawit'];
const ANGKA = ['5 Pupuk Cabe Rawit Terbaik', '3 Kesalahan Tanam Cabe Rawit', '7 Hama Cabe Rawit', 'Cara Semai Cabe Rawit', 'Panen Cabe Rawit Harian', 'Jarak Tanam Cabe Rawit', 'Pupuk Murah', 'Pangkas Cabe Rawit', 'Mulsa Cabe Rawit'];

test('gaya: butuh minimal 8 video yang sudah berumur 3 hari', () => {
  assert.strictEqual(analisisGaya(rows(TANYA.slice(0, 5))).cukup, false);
  assert.strictEqual(analisisGaya([...rows(TANYA), { judul: 'Baru', views: 1, tipe_video: 'long', umur_hari: 1 }]).n, 9);
  assert.strictEqual(analisisGaya([]).n, 0);
});

test('gaya: ciri khas mengikuti apa yang sering muncul di video terlaris channel itu', () => {
  assert.ok(analisisGaya(rows(TANYA)).ciri.includes('Judul berupa pertanyaan'));
  const a = analisisGaya(rows(ANGKA));
  assert.ok(a.ciri.includes('Memakai angka') && !a.ciri.includes('Judul berupa pertanyaan'));
  assert.strictEqual(a.terlaris[0].judul, ANGKA[0]);
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
