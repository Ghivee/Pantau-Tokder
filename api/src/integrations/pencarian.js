const axios = require('axios');

// Apa yang benar-benar dicari dan ditonton orang Indonesia di YouTube.
// 1. Saran pencarian YouTube (autocomplete): frasa yang diketik penonton, urut menurut populer.
//    Alamat ini tidak resmi dan tanpa jaminan; bila gagal, bagian itu kosong dan aplikasi tetap jalan.
// 2. Video terlaris untuk sebuah kata kunci lewat YouTube Data API (butuh YOUTUBE_API_KEY; 100 unit kuota per pencarian).

async function sarankanPencarian(q) {
  const r = await axios.get('https://suggestqueries.google.com/complete/search', {
    params: { client: 'firefox', ds: 'yt', hl: 'id', gl: 'id', q }, timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const d = Array.isArray(r.data) ? r.data : JSON.parse(r.data);
  return (Array.isArray(d[1]) ? d[1] : []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

async function videoTerlaris(q, key, { hari = 365, maks = 10 } = {}) {
  if (!key) return [];
  const sejak = new Date(Date.now() - hari * 86400000).toISOString();
  const s = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: { key, q, part: 'snippet', type: 'video', regionCode: 'ID', relevanceLanguage: 'id', order: 'viewCount', publishedAfter: sejak, maxResults: maks }, timeout: 12000,
  });
  const ids = (s.data.items || []).map((i) => i.id && i.id.videoId).filter(Boolean);
  if (!ids.length) return [];
  const v = await axios.get('https://www.googleapis.com/youtube/v3/videos', { params: { key, id: ids.join(','), part: 'snippet,statistics' }, timeout: 12000 });
  return (v.data.items || []).map((i) => ({ id: i.id, judul: i.snippet.title, channel: i.snippet.channelTitle, views: Number(i.statistics.viewCount) || 0 }))
    .sort((a, b) => b.views - a.views);
}

module.exports = { sarankanPencarian, videoTerlaris };
