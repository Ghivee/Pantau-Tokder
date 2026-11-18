const db = require('../config/db');
const { getChannelIds, getChannelNames } = require('./channelService');
const { analisisGaya } = require('./gayaService');
const { sarankanPencarian, videoTerlaris } = require('../integrations/pencarian');

// Bahan halaman Saran dan Tautan per channel dari sumber nyata:
//  - pencarian YouTube (frasa yang diketik penonton): produk yang dicari,
//  - video terlaris di YouTube untuk kata kunci itu (populer di channel lain),
//  - video channel sendiri: kata terkuatnya memperkaya kata benih pencarian.
// Sasaran penonton: petani cabe rawit di seluruh Indonesia, jadi tidak memakai lokasi atau cuaca.

const TTL_PENCARIAN = 12 * 3600 * 1000, TTL_TERLARIS = 24 * 3600 * 1000;

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


// Sasaran seluruh Indonesia: frasa yang menyebut daerah atau pasar tertentu tidak dipakai.
const DAERAH = /\b(medan|jakarta|bandung|surabaya|jawa|sumatera|sumatra|kalimantan|sulawesi|bali|lampung|aceh|riau|jambi|palembang|makassar|pare|brebes|malang|kediri|garut|semarang|yogya|yogyakarta|bogor|bekasi|tangerang|depok|banten|jatim|jateng|jabar|ntt|ntb|papua|manado|padang|pekanbaru|batam|pontianak|banjarmasin|samarinda|kendari|ambon|mataram|kupang|kab|kota|pasar|induk|kramat|jati|cibitung|keputran)\b/;

const awalProduk = /^(obat|pupuk|fungisida|insektisida|pestisida|mulsa|perekat|benih|bibit|alat|sprayer|polybag|ajir|dolomit|trichoderma|racun|zpt)\b/;

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
  const channels = await Promise.all(ids.map(async (id) => {
    const nama = names[id] || id, tema = temaOf(nama);
    const gaya = analisisGaya(video[id] || []);
    // Kata terkuat di channel sendiri memperkaya benih pencarian.
    const benih = [...BENIH[tema], ...gaya.ampuh.slice(0, 2).map((a) => `${a.kata} cabe rawit`)];
    let frasa = [], galat = null;
    try { frasa = await kataPencarian(id, benih); } catch (e) { galat = e.message; }
    const terlaris = await contohTerlaris(id, BENIH[tema]);
    return {
      id, nama, tema, galat,
      produk: tema === 'harga' ? [] : daftarProduk(frasa),
      youtube: terlaris,
    };
  }));
  if (channels.length && channels.every((c) => c.galat)) { const e = new Error(channels[0].galat); e.status = 502; throw e; }
  return { channels, dihitung: new Date().toISOString() };
}

module.exports = { saran, temaOf };
