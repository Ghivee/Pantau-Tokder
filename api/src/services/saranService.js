const db = require('../config/db');
const { getChannelIds, getChannelNames } = require('./channelService');
const { analisisGaya } = require('./gayaService');
const { sarankanPencarian, videoTerlaris } = require('../integrations/pencarian');

// Saran judul dan kata kunci per channel dari tiga sumber nyata:
//  - pencarian YouTube (frasa yang diketik penonton) untuk kata kunci dan bahan judul,
//  - video terlaris di YouTube untuk kata kunci itu (contoh pasar),
//  - video channel sendiri (ciri khas judul yang bekerja di channel itu).
// Sasaran penonton: petani cabe rawit di seluruh Indonesia, jadi tidak memakai lokasi atau cuaca.

const TTL_PENCARIAN = 12 * 3600 * 1000, TTL_TERLARIS = 24 * 3600 * 1000;
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const temaOf = (nama) => (/harga/i.test(nama) ? 'harga' : /budidaya/i.test(nama) ? 'budidaya' : 'tokder');

// Kata benih pencarian per tema; ditambah kata terkuat dari video channel itu sendiri.
const BENIH = {
  budidaya: ['cara menanam cabe rawit', 'hama cabe rawit', 'penyakit cabe rawit', 'pupuk cabe rawit', 'cabe rawit rontok', 'budidaya cabe rawit'],
  tokder: ['obat cabe rawit', 'pupuk untuk cabe rawit', 'fungisida cabe rawit', 'insektisida cabe rawit', 'mulsa cabe rawit', 'alat semprot cabe rawit'],
  harga: ['harga cabe rawit', 'harga cabe rawit hari ini', 'harga cabe rawit naik', 'prediksi harga cabe rawit'],
};

const relevan = (f) => /\b(cabe|cabai|rawit)\b/.test(f);
const tanpaDaerah = (f) => !DAERAH.test(f);

// Cache di tabel settings supaya bertahan antar permintaan serverless dan tidak membebani YouTube.
async function dariCache(kunci, ttl, ambil) {
  try {
    const r = await db.query('SELECT value FROM settings WHERE key = $1', [kunci]);
    const c = r.rows[0] && JSON.parse(r.rows[0].value);
    if (c && Date.now() - c.waktu < ttl) return c.data;
  } catch (e) { /* tanpa cache */ }
  const data = await ambil();
  try { await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, [kunci, JSON.stringify({ waktu: Date.now(), data })]); } catch (e) { /* abaikan */ }
  return data;
}

async function kataPencarian(channelId, benih) {
  return dariCache('saran_kata:' + channelId, TTL_PENCARIAN, async () => {
    const hasil = await Promise.allSettled(benih.map((b) => sarankanPencarian(b)));
    const frasa = [];
    for (const r of hasil) if (r.status === 'fulfilled') for (const f of r.value) if (relevan(f) && tanpaDaerah(f) && !frasa.includes(f)) frasa.push(f);
    if (!frasa.length && hasil.every((r) => r.status === 'rejected')) throw new Error('Saran pencarian YouTube belum bisa diambil');
    return frasa;
  });
}

async function contohTerlaris(channelId, benih) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { tersedia: false, daftar: [] };
  try {
    const daftar = await dariCache('saran_terlaris:' + channelId, TTL_TERLARIS, async () => {
      const r = await Promise.allSettled(benih.slice(0, 2).map((b) => videoTerlaris(b, key)));
      const semua = r.flatMap((x) => (x.status === 'fulfilled' ? x.value : []));
      if (!semua.length && r.every((x) => x.status === 'rejected')) throw new Error('pencarian video gagal');
      const unik = new Map(semua.map((v) => [v.id, v]));
      return [...unik.values()].sort((a, b) => b.views - a.views).slice(0, 5);
    });
    return { tersedia: true, daftar };
  } catch (e) { console.warn('saran terlaris:', e.message); return { tersedia: false, daftar: [] }; }
}

const judulKapital = (f) => f.replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bNpk\b/g, 'NPK').replace(/\b(Dan|Yang|Untuk|Di|Dari|Dengan|Atau|Agar|Ke)\b/g, (m) => m.toLowerCase());

// Sasaran seluruh Indonesia: frasa yang menyebut daerah atau pasar tertentu tidak dipakai.
const DAERAH = /\b(medan|jakarta|bandung|surabaya|jawa|sumatera|sumatra|kalimantan|sulawesi|bali|lampung|aceh|riau|jambi|palembang|makassar|pare|brebes|malang|kediri|garut|semarang|yogya|yogyakarta|bogor|bekasi|tangerang|depok|banten|jatim|jateng|jabar|ntt|ntb|papua|manado|padang|pekanbaru|batam|pontianak|banjarmasin|samarinda|kendari|ambon|mataram|kupang|kab|kota|pasar|induk|kramat|jati|cibitung|keputran)\b/;

const awalProduk = /^(obat|pupuk|fungisida|insektisida|pestisida|mulsa|perekat|benih|bibit|alat|sprayer|polybag|ajir|dolomit|trichoderma|racun|zpt)\b/;
const MASALAH_KATA = /\b(hama|penyakit|rontok|layu|busuk|keriting|kuning|mati|patek|thrips|kutu|ulat|gagal)\b/;
const jenisFrasa = (f) => (/^cara\b/.test(f) ? 'cara' : awalProduk.test(f) ? 'produk' : /^(membasmi|basmi|mengatasi|atasi|pengendalian|penanggulangan|mencegah)\b/.test(f) ? 'tindakan' : /^jenis\b/.test(f) ? 'jenis' : MASALAH_KATA.test(f) ? 'masalah' : 'umum');
const SUDAH_SOLUSI = /\b(cara|mengatasi|atasi|solusi|penyebab|penanggulangan|pengendalian|membasmi|basmi|mencegah)\b/;
const SUDAH_PILIHAN = /\b(terbaik|ampuh|paling|rekomendasi|murah)\b/;
const TAHUN = /\b20\d\d\b/;

// Judul dari frasa pencarian nyata. Pengait dipilih menurut jenis frasa (supaya kalimatnya wajar, dan tidak mengulang kata yang
// sudah ada di frasa) lalu diurutkan menurut kebiasaan channel: yang cocok dengan ciri channel (tanya, angka, kapital, seru)
// didahulukan, jadi tiap channel mendapat gaya sendiri.
function buatJudul(frasa, gaya, tema, tgl) {
  const P = judulKapital;
  const pref = gaya.preferensi || {};
  const suka = (id) => !!pref[id] && pref[id].atas >= 0.3 && pref[id].atas >= pref[id].semua * 1.15;
  const urut = (daftar) => daftar.sort((x, y) => (y.gaya && suka(y.gaya) ? 1 : 0) - (x.gaya && suka(x.gaya) ? 1 : 0));
  const kata = (f) => f.split(' ').length;
  const H = {
    cara: (f) => { const Q = P(f.replace(/^cara\s+/, '')); return [{ t: `Cara ${Q}: Panduan Lengkap` }, { t: `Kesalahan Saat ${Q} yang Sering Terjadi` }, { t: `${Q}? Begini Caranya`, gaya: 'tanya' }, { t: `5 Kesalahan Saat ${Q}`, gaya: 'angka' }, { t: `Cara ${Q} (JANGAN SALAH!)`, gaya: 'kapital' }, { t: `Cara ${Q}, Wajib Tahu!`, gaya: 'seru' }]; },
    produk: (f) => [{ t: `${P(f)}: Cara Pakai yang Benar` }, { t: `${P(f)}: Mana yang Paling Ampuh?`, gaya: 'tanya', skip: SUDAH_PILIHAN }, { t: `3 Pilihan ${P(f)} yang Layak Dicoba`, gaya: 'angka', skip: kata(f) > 5 || SUDAH_PILIHAN.test(f) }, { t: `Review ${P(f)}` }, { t: `${P(f)}, Cek Ini Sebelum Beli` }, { t: `${P(f)} (JANGAN SALAH PILIH!)`, gaya: 'kapital' }, { t: `${P(f)}, Wajib Coba!`, gaya: 'seru' }],
    masalah: (f) => [{ t: `${P(f)}: Penyebab dan Cara Mengatasinya`, skip: SUDAH_SOLUSI.test(f) }, { t: `${P(f)}? Ini Solusinya`, gaya: 'tanya', skip: SUDAH_SOLUSI.test(f) }, { t: `3 Penyebab ${P(f)} yang Sering Terlewat`, gaya: 'angka', skip: SUDAH_SOLUSI.test(f) || kata(f) > 5 }, { t: `${P(f)}: Kenali dan Tangani Sebelum Terlambat` }, { t: `${P(f)} (JANGAN DIBIARKAN!)`, gaya: 'kapital' }, { t: `${P(f)}, Segera Tangani!`, gaya: 'seru' }],
    tindakan: (f) => [{ t: `${P(f)}: Panduan Lengkap` }, { t: `${P(f)}? Begini Caranya`, gaya: 'tanya' }, { t: `5 Langkah ${P(f)}`, gaya: 'angka', skip: kata(f) > 6 }, { t: `${P(f)} (JANGAN SALAH!)`, gaya: 'kapital' }, { t: `${P(f)}, Wajib Tahu!`, gaya: 'seru' }],
    jenis: (f) => [{ t: `${P(f)} dan Cara Mengatasinya` }, { t: `${P(f)}: Kenali Sebelum Terlambat` }, { t: `${P(f)}? Ini Daftarnya`, gaya: 'tanya' }, { t: `${P(f)} (JANGAN SALAH!)`, gaya: 'kapital' }],
    umum: (f) => [{ t: `${P(f)}: Panduan Lengkap` }, { t: `${P(f)}? Ini Jawabannya`, gaya: 'tanya' }, { t: `5 Hal Penting Soal ${P(f)}`, gaya: 'angka', skip: kata(f) > 6 }, { t: `${P(f)} yang Perlu Diketahui Petani` }, { t: `${P(f)}, Wajib Tahu!`, gaya: 'seru' }],
    harga: (f) => [{ t: `${P(f)} ${tgl.pendek}`, skip: TAHUN.test(f) }, { t: `${P(f)}: Naik atau Turun?`, gaya: 'tanya', skip: /\b(naik|turun)\b/.test(f) }, { t: `${P(f)}: Update ${tgl.pendek}`, skip: TAHUN.test(f) }, { t: `${P(f)} | ${tgl.panjang}`, gaya: 'pemisah', skip: TAHUN.test(f) }, { t: `${P(f)} ${tgl.panjang}`, skip: TAHUN.test(f) }, { t: `${P(f)}` }],
  };
  const ok = frasa.filter((f) => !DAERAH.test(f));
  // Beragam: paling banyak 3 frasa dengan dua kata awal yang sama.
  const hitung = {}, pilih = [];
  for (const f of ok) { const k = f.split(' ').slice(0, 2).join(' '); hitung[k] = (hitung[k] || 0) + 1; if (hitung[k] <= 3) pilih.push(f); }
  const maks = 20, out = [], pakaiPer = {}, pakaiPola = {};
  // Tiga putaran: tiap putaran memberi tiap frasa satu judul dengan pengait terbaik menurut gaya channel yang belum dipakai
  // frasa itu. Satu pola pengait dipakai paling banyak 3 kali supaya daftar tidak seragam.
  for (let putaran = 0; putaran < 3 && out.length < maks; putaran++) {
    for (const f of pilih) {
      if (out.length >= maks) break;
      const jenis = tema === 'harga' ? 'harga' : jenisFrasa(f);
      const opsi = urut(H[jenis](f).map((o, i) => ({ ...o, k: jenis + ':' + i })).filter((o) => !o.skip));
      const o = opsi.find((x) => !(pakaiPer[f] || (pakaiPer[f] = new Set())).has(x.k) && (pakaiPola[x.k] || 0) < 3 && x.t.length <= 90 && !out.includes(x.t));
      if (!o) continue;
      pakaiPer[f].add(o.k); pakaiPola[o.k] = (pakaiPola[o.k] || 0) + 1; out.push(o.t);
    }
  }
  return out;
}

// Produk dari frasa pencarian yang memang diawali nama produk, satu per jenis (dua kata awal berbeda) supaya beragam.
function daftarProduk(frasa) {
  const lihat = new Set(), out = [];
  for (const f of frasa) {
    if (!awalProduk.test(f) || DAERAH.test(f)) continue;
    const k = f.split(' ').slice(0, 2).join(' ');
    if (lihat.has(k)) continue;
    lihat.add(k);
    out.push({ nama: f, url: 'https://shopee.co.id/search?keyword=' + encodeURIComponent(f) });
    if (out.length >= 6) break;
  }
  return out;
}

async function dataChannel() {
  const r = await db.query(
    `SELECT channel_id, judul, views, tipe_video, EXTRACT(EPOCH FROM (NOW() - tanggal_upload)) / 86400 AS umur_hari
     FROM content WHERE channel_id IS NOT NULL AND judul IS NOT NULL AND tanggal_upload > NOW() - INTERVAL '540 days'`);
  const per = {};
  for (const x of r.rows) (per[x.channel_id] ||= []).push({ judul: x.judul, views: +x.views || 0, tipe_video: x.tipe_video, umur_hari: +x.umur_hari });
  return per;
}

async function saran() {
  const [ids, names, video] = await Promise.all([getChannelIds(), getChannelNames(), dataChannel()]);
  const w = new Date(Date.now() + 7 * 3600 * 1000);
  const tgl = { pendek: `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]}`, panjang: `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}` };
  const channels = await Promise.all(ids.map(async (id) => {
    const nama = names[id] || id, tema = temaOf(nama);
    const gaya = analisisGaya(video[id] || []);
    // Kata terkuat di channel sendiri memperkaya benih pencarian.
    const benih = [...BENIH[tema], ...gaya.ampuh.slice(0, 2).map((a) => `${a.kata} cabe rawit`)];
    let frasa = [], galat = null;
    try { frasa = await kataPencarian(id, benih); } catch (e) { galat = e.message; }
    const terlaris = await contohTerlaris(id, BENIH[tema]);
    return {
      id, nama, tema, gaya, galat,
      kata: frasa.slice(0, 30), judul: buatJudul(frasa, gaya, tema, tgl),
      produk: tema === 'harga' ? [] : daftarProduk(frasa),
      youtube: terlaris,
    };
  }));
  if (channels.length && channels.every((c) => c.galat)) { const e = new Error(channels[0].galat); e.status = 502; throw e; }
  return { channels, dihitung: new Date().toISOString() };
}

module.exports = { saran, buatJudul, temaOf, judulKapital };
