const db = require('../config/db');

// Produk affiliate terlaris dari komisi per pesanan yang diimpor. Jumlah rupiah adalah penghasilan: hanya pemilik atau karyawan
// yang diberi izin yang menerimanya; yang lain hanya mendapat urutan dan arah tren (tanpa nominal dan tanpa jumlah pesanan).

const HARI = [7, 28, 90, 365];
const wib = (n = 0) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
const norm = (p) => String(p || '').replace(/\s+/g, ' ').trim();

// rows: [{tanggal:'YYYY-MM-DD', produk, komisi, qty}] yang mencakup dua jendela berurutan (sekarang dan sebelumnya).
// Jendela sekarang = `hari` hari terakhir termasuk hari ini; sebelumnya = `hari` hari tepat sebelum itu.
function susunTerlaris(rows, hari, hariIni = wib(0)) {
  const mulai = wib0(hariIni, hari - 1), mulaiSebelum = wib0(hariIni, 2 * hari - 1);
  const per = new Map();
  let total = 0, totalSebelum = 0, sampai = null;
  for (const r of rows) {
    if (r.tanggal > hariIni || r.tanggal < mulaiSebelum) continue;
    const nama = norm(r.produk);
    if (!nama) continue;
    const k = nama.toLowerCase();
    const o = per.get(k) || { produk: nama, komisi: 0, pesanan: 0, komisi_sebelum: 0 };
    const sekarang = r.tanggal >= mulai;
    if (sekarang) { o.komisi += r.komisi; o.pesanan += 1; total += r.komisi; if (!sampai || r.tanggal > sampai) sampai = r.tanggal; }
    else { o.komisi_sebelum += r.komisi; totalSebelum += r.komisi; }
    per.set(k, o);
  }
  const bulat = (v) => Math.round(v);
  const terlaris = [...per.values()].filter((o) => o.pesanan > 0).sort((a, b) => b.komisi - a.komisi).slice(0, 10).map((o, i) => {
    const t = o.komisi_sebelum <= 0 ? 'baru' : o.komisi >= o.komisi_sebelum * 1.25 ? 'naik' : o.komisi <= o.komisi_sebelum * 0.75 ? 'turun' : 'stabil';
    return { peringkat: i + 1, produk: o.produk, tren: t, komisi: bulat(o.komisi), pesanan: o.pesanan, komisi_sebelum: bulat(o.komisi_sebelum) };
  });
  return { hari, terlaris, total: bulat(total), total_sebelum: bulat(totalSebelum), data_sampai: sampai };
}
const wib0 = (dasar, n) => new Date(Date.parse(dasar + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10);

// Tanpa izin penghasilan: hanya peringkat, nama produk, dan arah tren.
function tanpaUang(h) {
  return { hari: h.hari, uang: false, data_sampai: h.data_sampai, terlaris: h.terlaris.map(({ peringkat, produk, tren }) => ({ peringkat, produk, tren })) };
}

async function terlaris({ hari, uang }) {
  const h = HARI.includes(hari) ? hari : 28;
  const r = await db.query(
    `SELECT to_char(tanggal, 'YYYY-MM-DD') AS tanggal, produk, komisi::float AS komisi FROM afiliasi_komisi WHERE tanggal >= $1 ORDER BY tanggal`,
    [wib(2 * h - 1)]);
  const hasil = susunTerlaris(r.rows.map((x) => ({ tanggal: x.tanggal, produk: x.produk, komisi: +x.komisi })), h);
  const info = await db.query('SELECT COUNT(*)::int AS baris, MAX(diimpor_at) AS terakhir FROM afiliasi_komisi');
  return { ...(uang ? { ...hasil, uang: true } : tanpaUang(hasil)), ada_data: info.rows[0].baris > 0, diimpor: info.rows[0].terakhir };
}

// Simpan baris laporan (unnest, kelompok 1000). Kunci yang sama diperbarui, bukan digandakan.
async function simpan(sumber, baris) {
  for (let i = 0; i < baris.length; i += 1000) {
    const k = baris.slice(i, i + 1000);
    await db.query(
      `INSERT INTO afiliasi_komisi (kunci, tanggal, produk, komisi, qty, sumber)
       SELECT * FROM unnest($1::text[], $2::date[], $3::text[], $4::numeric[], $5::int[], $6::text[])
       ON CONFLICT (kunci) DO UPDATE SET tanggal = EXCLUDED.tanggal, produk = EXCLUDED.produk, komisi = EXCLUDED.komisi, qty = EXCLUDED.qty, sumber = EXCLUDED.sumber, diimpor_at = NOW()`,
      [k.map((x) => x.kunci), k.map((x) => x.tanggal), k.map((x) => norm(x.produk).slice(0, 200)), k.map((x) => x.komisi), k.map((x) => (x.qty == null ? null : x.qty)), k.map(() => sumber)]);
  }
  return baris.length;
}

module.exports = { susunTerlaris, tanpaUang, terlaris, simpan, HARI };
