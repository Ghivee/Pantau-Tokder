const db = require('../config/db');
const afiliasi = require('./afiliasiService');
const saranService = require('./saranService');
const komentarService = require('./komentarService');

// Saran produk otomatis untuk menu Tautan, seperti rekomendasi di YouTube Shopping: produk yang terbukti laku (komisi),
// yang ditanyakan penonton, dan yang dicari orang di YouTube. Disusun dari tiga sumber yang sudah ada; tanpa katalog marketplace.

// Topik pertanyaan penonton → kata cari produk yang menjawabnya. Daftar ditulis tangan (bukan hasil analisis).
const TOPIK_PRODUK = {
  'Hama': ['insektisida cabe rawit', 'perangkap lengket kuning'],
  'Daun keriting dan kuning': ['perangkap lengket kuning', 'mulsa perak hitam'],
  'Layu dan busuk akar': ['trichoderma agens hayati', 'dolomit kapur pertanian'],
  'Buah busuk dan patek': ['fungisida cabe rawit antraknosa', 'perekat perata pestisida'],
  'Bunga dan buah rontok': ['pupuk kalsium cabe', 'pupuk kalium cabe'],
  'Pupuk': ['pupuk npk untuk cabe rawit'],
  'Obat dan semprot': ['sprayer elektrik 16 liter', 'fungisida cabe rawit'],
  'Bibit dan semai': ['benih cabe rawit unggul', 'tray semai'],
  'Polybag dan media tanam': ['polybag tanaman 40x40', 'cocopeat media tanam'],
};

const MAKS = { terlaris: 5, ditanya: 5, dicari: 6, total: 14 };

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const cari = (q) => 'https://shopee.co.id/search?keyword=' + encodeURIComponent(q);

// Dua nama dianggap produk yang sama bila yang satu memuat yang lain (minimal 6 huruf).
const serupa = (a, b) => { const x = norm(a), y = norm(b); if (!x || !y) return false; const [p, q] = x.length <= y.length ? [x, y] : [y, x]; return p.length >= 6 && q.includes(p); };

// terlaris: [{peringkat, produk, tren, komisi?}] ; ditanya: [{topik, n}] ; dicari: [{nama}] ; tautan: [{kode, label, tujuh_hari}]
function susunSaranProduk({ terlaris = [], ditanya = [], dicari = [], tautan = [], uang = false }) {
  const daftar = [];
  const tambah = (nama, alasan, ekstra = {}) => {
    const ada = daftar.find((x) => serupa(x.nama, nama));
    if (ada) { if (ada.alasan.length < 3 && !ada.alasan.some((x) => x.teks === alasan.teks)) ada.alasan.push(alasan); return; }
    if (daftar.length >= MAKS.total) return;
    const t = tautan.find((x) => serupa(x.label, nama));
    daftar.push({ nama, alasan: [alasan], cari: cari(nama), tautan: t ? { kode: t.kode, tujuh_hari: t.tujuh_hari } : null, ...ekstra });
  };

  for (const x of terlaris.slice(0, MAKS.terlaris)) {
    const teks = `Terlaris #${x.peringkat}${x.tren === 'naik' ? ' · naik' : x.tren === 'baru' ? ' · baru' : x.tren === 'turun' ? ' · turun' : ''}`;
    tambah(x.produk, { jenis: 'terlaris', teks }, uang && x.komisi != null ? { komisi: x.komisi } : {});
  }

  // Topik yang paling banyak ditanyakan (dijumlah dari semua channel) → produk penjawabnya.
  const jumlah = new Map();
  for (const t of ditanya) if (TOPIK_PRODUK[t.topik]) jumlah.set(t.topik, (jumlah.get(t.topik) || 0) + t.n);
  let ditambah = 0;
  ditanyaLoop: for (const [topik, n] of [...jumlah.entries()].sort((x, y) => y[1] - x[1])) {
    for (const q of TOPIK_PRODUK[topik]) {
      if (ditambah >= MAKS.ditanya) break ditanyaLoop;
      tambah(q, { jenis: 'ditanya', teks: `${n} pertanyaan · ${topik}` });
      ditambah++;
    }
  }

  const unik = new Set();
  for (const x of dicari) { if (unik.size >= MAKS.dicari) break; if (unik.has(norm(x.nama))) continue; unik.add(norm(x.nama)); tambah(x.nama, { jenis: 'dicari', teks: 'Dicari di YouTube' }); }
  return daftar;
}

async function tautanSaya() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000 - 6 * 86400000).toISOString().slice(0, 10);
  const r = await db.query(
    `SELECT t.kode, t.label, COALESCE(SUM(k.jumlah) FILTER (WHERE k.tanggal >= $1), 0)::int AS tujuh_hari
     FROM tautan t LEFT JOIN tautan_klik k ON k.kode = t.kode GROUP BY t.kode`, [wib]);
  return r.rows;
}

async function saranProduk({ uang }) {
  const [a, s, k, t] = await Promise.allSettled([afiliasi.terlaris({ hari: 30, uang }), saranService.saran(), komentarService.komentar(), tautanSaya()]);
  const ok = (r) => (r.status === 'fulfilled' ? r.value : null);
  const gagal = (r, nama) => { if (r.status === 'rejected') console.warn('saran produk:', nama, r.reason && r.reason.message); };
  gagal(a, 'afiliasi'); gagal(s, 'saran'); gagal(k, 'komentar'); gagal(t, 'tautan');
  const aff = ok(a), sar = ok(s), kom = ok(k);
  const daftar = susunSaranProduk({
    terlaris: aff ? aff.terlaris : [],
    ditanya: kom && kom.tersedia ? kom.channels.flatMap((c) => c.topik || []) : [],
    dicari: sar ? sar.channels.flatMap((c) => c.produk || []) : [],
    tautan: ok(t) || [],
    uang,
  });
  return { daftar, sumber: { terlaris: !!(aff && aff.terlaris.length), ditanya: !!(kom && kom.tersedia), dicari: !!sar } };
}

module.exports = { saranProduk, susunSaranProduk, TOPIK_PRODUK };
