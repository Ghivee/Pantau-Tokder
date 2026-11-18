const test = require('node:test');
const assert = require('node:assert');
const { susunSaranProduk, TOPIK_PRODUK } = require('../src/services/produkSaranService');

const T = (peringkat, produk, tren = 'stabil', komisi) => ({ peringkat, produk, tren, ...(komisi != null ? { komisi } : {}) });

test('urutan: terlaris dulu, lalu yang ditanyakan penonton, lalu yang dicari', () => {
  const d = susunSaranProduk({
    terlaris: [T(1, 'Mulsa Plastik Hitam Perak 1 Roll', 'naik'), T(2, 'Fungisida Antracol 70WP 1kg', 'baru')],
    ditanya: [{ topik: 'Hama', n: 14 }, { topik: 'Pupuk', n: 9 }],
    dicari: [{ nama: 'pupuk alami untuk cabe rawit' }, { nama: 'obat hama cabe rawit' }],
  });
  assert.deepStrictEqual(d.map((x) => x.alasan[0].jenis).join(), 'terlaris,terlaris,ditanya,ditanya,ditanya,dicari,dicari');
  assert.strictEqual(d[0].alasan[0].teks, 'Terlaris #1 · naik');
  assert.strictEqual(d[1].alasan[0].teks, 'Terlaris #2 · baru');
  assert.match(d[2].alasan[0].teks, /^14 pertanyaan · Hama$/);
});

test('komisi rupiah hanya ikut bila berizin penghasilan', () => {
  const terlaris = [T(1, 'Mulsa Plastik Hitam Perak', 'naik', 1284000)];
  assert.strictEqual(susunSaranProduk({ terlaris, uang: true })[0].komisi, 1284000);
  const tanpa = susunSaranProduk({ terlaris, uang: false })[0];
  assert.ok(!('komisi' in tanpa));
  assert.ok(!/1284000|1\.284/.test(JSON.stringify(tanpa)));
});

test('produk yang sama dari sumber berbeda digabung, alasan bertambah tanpa duplikat, maksimal 3', () => {
  const d = susunSaranProduk({
    terlaris: [T(3, 'Perangkap Lengket Kuning Yellow Trap Isi 20', 'naik')],
    ditanya: [{ topik: 'Hama', n: 6 }, { topik: 'Daun keriting dan kuning', n: 4 }],
    dicari: [{ nama: 'perangkap lengket kuning' }, { nama: 'perangkap lengket kuning' }],
  });
  const p = d.filter((x) => /perangkap lengket kuning/i.test(x.nama));
  assert.strictEqual(p.length, 1);
  assert.deepStrictEqual(p[0].alasan.map((a) => a.jenis), ['terlaris', 'ditanya', 'ditanya']);
});

test('tautan yang sudah ada dikenali (termasuk nama lebih panjang/pendek) dan membawa klik 7 harinya', () => {
  const d = susunSaranProduk({
    ditanya: [{ topik: 'Pupuk', n: 5 }],
    terlaris: [T(1, 'Fungisida Antracol 70WP Propineb 1kg Cabe', 'naik')],
    tautan: [{ kode: 'abc123', label: 'pupuk npk untuk cabe rawit', tujuh_hari: 12 }, { kode: 'def456', label: 'Fungisida Antracol 70WP', tujuh_hari: 3 }],
  });
  assert.deepStrictEqual(d.find((x) => /antracol/i.test(x.nama)).tautan, { kode: 'def456', tujuh_hari: 3 });
  assert.deepStrictEqual(d.find((x) => /npk/i.test(x.nama)).tautan, { kode: 'abc123', tujuh_hari: 12 });
  assert.strictEqual(susunSaranProduk({ dicari: [{ nama: 'mulsa' }], tautan: [{ kode: 'x1y2z3', label: 'mulsa perak', tujuh_hari: 1 }] })[0].tautan, null); // terlalu pendek (<6) untuk dianggap sama
});

test('batas jumlah, tautan pencarian Shopee, dan data kosong aman', () => {
  const banyak = Array.from({ length: 30 }, (_, i) => ({ nama: 'produk unik nomor ' + i }));
  const d = susunSaranProduk({ dicari: banyak });
  assert.strictEqual(d.length, 6);
  assert.ok(d.every((x) => x.cari.startsWith('https://shopee.co.id/search?keyword=')));
  assert.deepStrictEqual(susunSaranProduk({}), []);
  const semua = susunSaranProduk({ terlaris: Array.from({ length: 10 }, (_, i) => T(i + 1, 'Terlaris ' + i)), ditanya: Object.keys(TOPIK_PRODUK).map((topik) => ({ topik, n: 3 })), dicari: banyak });
  assert.ok(semua.length <= 14);
  assert.ok(semua.filter((x) => x.alasan[0].jenis === 'terlaris').length <= 5);
});

test('topik tak dikenal diabaikan; topik tanpa produk (harga, panen) tidak menghasilkan apa pun', () => {
  assert.deepStrictEqual(susunSaranProduk({ ditanya: [{ topik: 'Harga dan jual', n: 40 }, { topik: 'Panen', n: 9 }, { topik: 'Entah', n: 99 }] }), []);
});
