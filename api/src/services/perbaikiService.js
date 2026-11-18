const db = require('../config/db');
const { ringkasRetensi } = require('../routes/insight');

// Daftar "Perbaiki dulu": video yang paling rugi karena thumbnail/judul (CTR rendah) atau pembukaan (penonton pergi di awal).
// Dibandingkan dengan rata-rata channel itu sendiri, bukan angka umum. Fungsi cariPerbaikan murni agar mudah diuji.

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

const MIN_IMPRESI_VIDEO = 1000;   // impresi minimal sebuah video supaya CTR-nya bermakna
const MIN_IMPRESI_CHANNEL = 5000; // impresi minimal channel supaya rata-rata CTR-nya bermakna
const MIN_VIDEO_RETENSI = 5;      // video berkurva retensi minimal supaya rata-rata awal channel bermakna
const MIN_UMUR_HARI = 3;
const MAKS = 5;

// videos: [{id, channel_id, judul, views, umur_hari, url}]
// reach: Map video_id → {impresi, ctr}; ctrChannel: {channel_id: {impresi, ctr}}; awal: Map video_id → % penonton tersisa di 10% durasi
function cariPerbaikan({ videos, reach, ctrChannel, awal }) {
  const awalPer = {};
  for (const v of videos) { const a = awal.get(v.id); if (a != null) (awalPer[v.channel_id] ||= []).push(a); }
  const awalBase = {};
  for (const [ch, l] of Object.entries(awalPer)) awalBase[ch] = l.length >= MIN_VIDEO_RETENSI ? median(l) : null;
  const ctrBase = {};
  for (const [ch, c] of Object.entries(ctrChannel)) ctrBase[ch] = c.impresi >= MIN_IMPRESI_CHANNEL && c.ctr > 0 ? c.ctr : null;

  const thumbnail = [], pembukaan = [];
  for (const v of videos) {
    if (v.umur_hari < MIN_UMUR_HARI) continue;
    const r = reach.get(v.id), cb = ctrBase[v.channel_id], ab = awalBase[v.channel_id], a = awal.get(v.id);
    if (r && cb && r.impresi >= MIN_IMPRESI_VIDEO && r.ctr <= cb * 0.75) {
      thumbnail.push({ id: v.id, judul: v.judul, channel_id: v.channel_id, url: v.url, views: v.views, impresi: Math.round(r.impresi), ctr: r.ctr, ctr_channel: cb, potensi: ((cb - r.ctr) / 100) * r.impresi });
    }
    if (r && cb && ab != null && a != null && r.ctr >= cb * 0.95 && a <= ab * 0.8 && v.views >= 500) {
      pembukaan.push({ id: v.id, judul: v.judul, channel_id: v.channel_id, url: v.url, views: v.views, ctr: r.ctr, ctr_channel: cb, awal: a, awal_channel: ab, potensi: ((ab - a) / 100) * v.views });
    }
  }
  const urut = (l) => l.sort((x, y) => y.potensi - x.potensi).slice(0, MAKS).map((x) => ({ ...x, potensi: Math.round(x.potensi) }));
  return {
    thumbnail: urut(thumbnail), pembukaan: urut(pembukaan),
    siap: { ctr: Object.values(ctrBase).some((x) => x != null), retensi: Object.values(awalBase).some((x) => x != null) },
  };
}

async function perbaiki() {
  const [vid, rc, ch, ret] = await Promise.all([
    db.query(`SELECT post_id AS id, channel_id, judul, views, url, EXTRACT(EPOCH FROM (NOW() - tanggal_upload)) / 86400 AS umur_hari
              FROM content WHERE platform = 'youtube' AND channel_id IS NOT NULL AND post_id IS NOT NULL AND tanggal_upload > NOW() - INTERVAL '60 days'`),
    db.query(`SELECT video_id, SUM(impresi)::float AS impresi, (SUM(impresi * ctr) / NULLIF(SUM(impresi), 0))::float AS ctr
              FROM video_reach WHERE tanggal >= (NOW() - INTERVAL '90 days')::date GROUP BY video_id`),
    db.query(`SELECT channel_id, SUM(impresi)::float AS impresi, (SUM(impresi * ctr) / NULLIF(SUM(impresi), 0))::float AS ctr
              FROM video_reach WHERE tanggal >= (NOW() - INTERVAL '90 days')::date GROUP BY channel_id`),
    db.query(`SELECT post_id AS id, retention_data FROM content WHERE platform = 'youtube' AND retention_data IS NOT NULL AND tanggal_upload > NOW() - INTERVAL '120 days'`),
  ]);
  const reach = new Map(rc.rows.filter((r) => r.ctr != null).map((r) => [r.video_id, { impresi: +r.impresi, ctr: +r.ctr }]));
  const ctrChannel = Object.fromEntries(ch.rows.filter((r) => r.ctr != null).map((r) => [r.channel_id, { impresi: +r.impresi, ctr: +r.ctr }]));
  const awal = new Map();
  for (const r of ret.rows) { const s = ringkasRetensi(r.retention_data); if (s && s.awal != null) awal.set(r.id, s.awal); }
  const videos = vid.rows.map((r) => ({ id: r.id, channel_id: r.channel_id, judul: r.judul, views: +r.views || 0, umur_hari: +r.umur_hari, url: r.url }));
  return { ...cariPerbaikan({ videos, reach, ctrChannel, awal }), dihitung: new Date().toISOString() };
}

module.exports = { perbaiki, cariPerbaikan };
