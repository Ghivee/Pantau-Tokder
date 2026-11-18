const axios = require('axios');

// CTR dan impresi thumbnail ada di YouTube Reporting API (laporan reach), bukan di Analytics API.
// Laporan dibuat YouTube sekali sehari setelah sebuah "job" dibuat; data baru muncul 1-2 hari kemudian.
const BASE = 'https://youtubereporting.googleapis.com/v1';
const TIPE = 'channel_reach_basic_a1';

const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });

async function pastikanJob(token) {
  const r = await axios.get(`${BASE}/jobs`, { ...auth(token), params: { includeSystemManaged: false } });
  const ada = (r.data.jobs || []).find((j) => j.reportTypeId === TIPE);
  if (ada) return { id: ada.id, baru: false };
  const c = await axios.post(`${BASE}/jobs`, { reportTypeId: TIPE, name: 'Pantau Tokder reach' }, auth(token));
  return { id: c.data.id, baru: true };
}

const tgl = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

// Baris CSV laporan → { hari, video }.
//  hari : {YYYY-MM-DD: {impresi, ctr}}, CTR tiap hari ditimbang impresi per video.
//  video: [{video_id, tanggal, impresi, ctr}], satu baris per video per hari.
// YouTube tidak menjelaskan apakah CTR berupa pecahan (0,05) atau persen (5); bila median nilai di bawah 1
// dianggap pecahan dan dikali 100.
function ringkas(csv) {
  const baris = csv.trim().split(/\r?\n/).map((l) => l.split(','));
  const h = baris.shift() || [];
  const iD = h.indexOf('date'), iV = h.indexOf('video_id');
  const iI = h.indexOf('video_thumbnail_impressions'), iC = h.indexOf('video_thumbnail_impressions_ctr');
  if (iD < 0 || iI < 0 || iC < 0) throw new Error('Format laporan reach tidak dikenali');
  const nilai = baris
    .map((r) => ({ d: r[iD], v: iV >= 0 ? r[iV] : null, imp: Number(r[iI]), ctr: Number(r[iC]) }))
    .filter((r) => /^\d{8}$/.test(r.d) && r.imp > 0 && Number.isFinite(r.ctr));
  const besar = nilai.filter((r) => r.imp >= 100);
  const sampel = (besar.length ? besar : nilai).map((r) => r.ctr).sort((a, b) => a - b);
  const pecahan = sampel.length > 0 && sampel[Math.floor(sampel.length / 2)] < 1;
  const perHari = {}, perVideo = {};
  for (const r of nilai) {
    const t = tgl(r.d), w = r.imp * r.ctr * (pecahan ? 100 : 1);
    const o = (perHari[t] ||= { impresi: 0, w: 0 });
    o.impresi += r.imp; o.w += w;
    if (r.v && /^[\w-]{6,20}$/.test(r.v)) {
      const x = (perVideo[r.v + '|' + t] ||= { video_id: r.v, tanggal: t, impresi: 0, w: 0 });
      x.impresi += r.imp; x.w += w;
    }
  }
  const bulat = (w, i) => Math.round((w / i) * 1000) / 1000;
  return {
    hari: Object.fromEntries(Object.entries(perHari).map(([t, o]) => [t, { impresi: Math.round(o.impresi), ctr: bulat(o.w, o.impresi) }])),
    video: Object.values(perVideo).map((x) => ({ video_id: x.video_id, tanggal: x.tanggal, impresi: Math.round(x.impresi), ctr: bulat(x.w, x.impresi) })),
  };
}

// Hari terbaru lebih dulu; `perlu(tanggal)` menentukan hari mana yang diunduh (hari lama yang sudah ada dilewati).
async function ambilReach(token, jobId, perlu, maks = 40) {
  const laporan = [];
  let pageToken;
  for (let i = 0; i < 5; i++) {
    const r = await axios.get(`${BASE}/jobs/${jobId}/reports`, { ...auth(token), params: { pageSize: 100, pageToken } });
    laporan.push(...(r.data.reports || []));
    pageToken = r.data.nextPageToken;
    if (!pageToken) break;
  }
  // Satu laporan terbaru per hari (YouTube dapat menerbitkan ulang hari yang sama).
  const terbaru = {};
  for (const l of laporan) { const k = l.startTime; if (!terbaru[k] || l.createTime > terbaru[k].createTime) terbaru[k] = l; }
  const pilih = Object.values(terbaru).sort((a, b) => (a.startTime < b.startTime ? 1 : -1)).filter((l) => perlu(l.startTime.slice(0, 10))).slice(0, maks);
  const hasil = {}, video = [], diunduh = [];
  for (const l of pilih) {
    const csv = await axios.get(l.downloadUrl, { ...auth(token), responseType: 'text', transformResponse: (x) => x });
    const r = ringkas(String(csv.data));
    Object.assign(hasil, r.hari);
    video.push(...r.video);
    diunduh.push(l.startTime.slice(0, 10));
  }
  return { hasil, video, diunduh, laporan: laporan.length };
}

module.exports = { pastikanJob, ambilReach, ringkas };
