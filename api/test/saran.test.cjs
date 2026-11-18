const test = require('node:test');
const assert = require('node:assert');
const { analisisGaya } = require('../src/services/gayaService');
const { buatJudul, temaOf, judulKapital } = require('../src/services/saranService');
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

test('judul: channel berbeda mendapat pengait berbeda dari frasa pencarian yang sama', () => {
  const frasa = ['obat hama cabe rawit', 'pupuk cabe rawit', 'cara menanam cabe rawit'];
  const t = buatJudul(frasa, analisisGaya(rows(TANYA)), 'budidaya', { pendek: '18 November', panjang: '18 November 2026' });
  const g = buatJudul(frasa, analisisGaya(rows(ANGKA)), 'budidaya', { pendek: '18 November', panjang: '18 November 2026' });
  assert.ok(t.some((x) => x.includes('?')) && g.some((x) => /^\d/.test(x)));
  assert.notDeepStrictEqual(t, g);
});

test('judul: wajar, tidak mengulang kata, tidak menyebut daerah, maksimal 90 huruf', () => {
  const frasa = ['harga cabe rawit hari ini', 'harga cabe rawit hari ini di medan', 'prediksi harga cabe rawit 2027', 'mengatasi hama cabe rawit', 'jenis jenis hama cabe rawit', 'obat hama cabe rawit paling ampuh', 'cara menanam cabe rawit di polybag'];
  for (const tema of ['budidaya', 'harga']) {
    const j = buatJudul(frasa, analisisGaya(rows(TANYA)), tema, { pendek: '18 November', panjang: '18 November 2026' });
    assert.ok(j.length >= 8, `${tema}: ${j.length}`);
    for (const x of j) {
      assert.ok(x.length <= 90, x);
      assert.ok(!/medan/i.test(x), x);
    }
    assert.strictEqual(new Set(j).size, j.length);
  }
  assert.ok(!buatJudul(['prediksi harga cabe rawit 2027'], {}, 'harga', { pendek: '18 November', panjang: '18 November 2026' }).some((x) => x.includes('18 November')));
  assert.ok(!buatJudul(['obat hama cabe rawit paling ampuh'], {}, 'budidaya', {}).some((x) => /Mana yang Paling Ampuh/.test(x)));
  assert.ok(!buatJudul(['mengatasi hama cabe rawit'], {}, 'budidaya', {}).some((x) => /Cara Mengatasinya/.test(x)));
});

test('judul harga memuat tanggal hari ini', () => {
  const j = buatJudul(['harga cabe rawit hari ini', 'harga cabe rawit'], analisisGaya([]), 'harga', { pendek: '18 November', panjang: '18 November 2026' });
  assert.ok(j.some((x) => x.includes('18 November')));
});

test('tema channel dari nama dan kapitalisasi judul', () => {
  assert.strictEqual(temaOf('Harga Cabe Hari Ini'), 'harga');
  assert.strictEqual(temaOf('Budidaya Cabe'), 'budidaya');
  assert.strictEqual(temaOf('Tokder'), 'tokder');
  assert.strictEqual(judulKapital('pupuk untuk cabe rawit dan npk'), 'Pupuk untuk Cabe Rawit dan NPK');
});

test('kode karyawan disisipkan sekali dan tidak menyalahi kata lain', () => {
  assert.strictEqual(sisipKode('Pupuk', 'AL'), 'Pupuk\n#AL');
  assert.strictEqual(sisipKode('Cek #AL ini', '#AL'), 'Cek #AL ini');
  assert.strictEqual(sisipKode('KODE desa', 'DE'), 'KODE desa\n#DE');
  assert.strictEqual(sisipKode('x', ''), 'x');
});
