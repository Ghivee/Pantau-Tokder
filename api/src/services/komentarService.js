const axios = require('axios');
const db = require('../config/db');
const { getChannelIds, getChannelNames } = require('./channelService');

// Pertanyaan penonton di komentar tiap channel, dikelompokkan menjadi topik. Petani menulis masalahnya langsung di komentar,
// jadi ini bahan ide video masalah-solusi yang paling nyata. Hanya topik, jumlah, dan contoh singkat tanpa nama penulis yang
// disimpan; komentar mentah tidak disimpan.

const TTL = 6 * 3600 * 1000;

// Urutan = prioritas: sebuah pertanyaan masuk ke topik pertama yang cocok.
const TOPIK = [
  ['Hama', /\b(hama|thrips|trip|kutu|ulat|tungau|lalat|wereng|belalang|semut|kebul)\b/],
  ['Daun keriting dan kuning', /\b(keriting|kriting|menguning|kuning|kerdil|mengkerut|virus|gemini)\b/],
  ['Layu dan busuk akar', /\b(layu|akar|pangkal|mati)\b/],
  ['Buah busuk dan patek', /\b(patek|antraknosa|busuk|bercak|hitam|jamur)\b/],
  ['Bunga dan buah rontok', /\b(rontok|gugur|bunga|berbuah|buah sedikit)\b/],
  ['Pupuk', /\b(pupuk|npk|kocor|nutrisi|kalsium|kalium|mutiara|organik|pocp)\b/],
  ['Obat dan semprot', /\b(obat|semprot|pestisida|fungisida|insektisida|dosis|campur|racun|perekat)\b/],
  ['Bibit dan semai', /\b(bibit|benih|semai|persemaian|biji|pindah tanam)\b/],
  ['Polybag dan media tanam', /\b(polybag|pot|media tanam|tanah|sekam|cocopeat|kompos)\b/],
  ['Harga dan jual', /\b(harga|jual|untung|modal|pasar|tengkulak)\b/],
  ['Panen', /\b(panen|petik|produksi|lebat)\b/],
];

const KATA_TANYA = /\b(kenapa|mengapa|gimana|bagaimana|apakah|apa|berapa|kapan|dimana|di mana|bisakah|bolehkah|tolong|minta saran|solusi|gmn|knp)\b/;
const SPAM = /(https?:\/\/|www\.|wa\.me|\bwhatsapp\b|\bwa\s*\d|\btelegram\b|\bt\.me\b|\bslot\b|\bjudi\b|\bpinjol\b)/i;

const bersih = (t) => String(t || '').replace(/\s+/g, ' ').trim();
const pendek = (t, n = 140) => (t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// Apakah komentar ini sebuah pertanyaan atau permintaan bantuan yang cukup jelas untuk dijadikan ide.
function isPertanyaan(teks) {
  const t = bersih(teks);
  if (t.length < 14 || t.length > 400 || SPAM.test(t)) return false;
  if (t.split(' ').length < 4) return false;
  return /\?/.test(t) || KATA_TANYA.test(t.toLowerCase());
}

// komentar: array teks. Hasil: {dipindai, pertanyaan, topik: [{topik, n, contoh: [..]}]} urut dari yang paling banyak ditanyakan.
function kelompokkan(komentar) {
  const lihat = new Set(), tanya = [];
  for (const k of komentar) {
    const t = bersih(k);
    const kunci = t.toLowerCase();
    if (lihat.has(kunci) || !isPertanyaan(t)) continue;
    lihat.add(kunci); tanya.push(t);
  }
  const per = new Map();
  for (const t of tanya) {
    const rendah = t.toLowerCase();
    const hit = TOPIK.find(([, re]) => re.test(rendah));
    if (!hit) continue;
    const o = per.get(hit[0]) || { topik: hit[0], n: 0, contoh: [] };
    o.n++;
    if (o.contoh.length < 2) o.contoh.push(pendek(t));
    per.set(hit[0], o);
  }
  return { dipindai: komentar.length, pertanyaan: tanya.length, topik: [...per.values()].sort((a, b) => b.n - a.n).slice(0, 6) };
}

async function ambilKomentar(channelId, key) {
  const teks = [];
  const minta = async (params) => {
    const r = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', { params: { key, part: 'snippet', maxResults: 100, order: 'time', textFormat: 'plainText', ...params }, timeout: 15000 });
    for (const i of r.data.items || []) { const s = i.snippet && i.snippet.topLevelComment && i.snippet.topLevelComment.snippet; if (s) teks.push(s.textOriginal || s.textDisplay || ''); }
    return r.data.nextPageToken;
  };
  try {
    let token;
    for (let i = 0; i < 3; i++) { token = await minta({ allThreadsRelatedToChannelId: channelId, pageToken: token }); if (!token) break; }
  } catch (e) {
    // Beberapa channel menolak permintaan tingkat channel; coba komentar di video terbaru satu per satu.
    const v = await db.query(`SELECT post_id FROM content WHERE platform = 'youtube' AND channel_id = $1 AND post_id IS NOT NULL ORDER BY tanggal_upload DESC LIMIT 8`, [channelId]);
    for (const r of v.rows) { try { await minta({ videoId: r.post_id }); } catch (e2) { /* komentar dimatikan di video ini */ } }
    if (!teks.length) throw e;
  }
  return teks;
}

async function topikChannel(channelId, key) {
  const kunci = 'komentar:' + channelId;
  try {
    const r = await db.query('SELECT value FROM settings WHERE key = $1', [kunci]);
    const c = r.rows[0] && JSON.parse(r.rows[0].value);
    if (c && Date.now() - c.waktu < TTL) return c.data;
  } catch (e) { /* tanpa cache */ }
  const data = kelompokkan(await ambilKomentar(channelId, key));
  try { await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, [kunci, JSON.stringify({ waktu: Date.now(), data })]); } catch (e) { /* abaikan */ }
  return data;
}

async function komentar() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return { tersedia: false, alasan: 'YOUTUBE_API_KEY belum diisi', channels: [] };
  const [ids, names] = await Promise.all([getChannelIds(), getChannelNames()]);
  const channels = await Promise.all(ids.map(async (id) => {
    try { return { id, nama: names[id] || id, ...(await topikChannel(id, key)) }; } catch (e) {
      console.warn('komentar', id, e.response?.data?.error?.message || e.message);
      return { id, nama: names[id] || id, galat: 'Komentar belum bisa dibaca', dipindai: 0, pertanyaan: 0, topik: [] };
    }
  }));
  return { tersedia: true, channels };
}

module.exports = { komentar, kelompokkan, isPertanyaan };
