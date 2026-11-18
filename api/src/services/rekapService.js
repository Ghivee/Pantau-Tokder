const db = require('../config/db');
const { pastikanJob, ambilReach } = require('../integrations/reporting');

const wib = (n = 0) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
const JEDA_JAM = 5;
const SIMPAN_HARI = 120;

async function baca(kunci) { const r = await db.query('SELECT value FROM settings WHERE key = $1', [kunci]); return r.rows[0] ? r.rows[0].value : null; }
async function tulis(kunci, nilai) {
  await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`, [kunci, nilai]);
}

// Simpan banyak baris per-video per-hari sekaligus (unnest), dalam kelompok agar parameter tidak membengkak.
async function simpanVideo(channelId, baris) {
  for (let i = 0; i < baris.length; i += 1000) {
    const k = baris.slice(i, i + 1000);
    await db.query(
      `INSERT INTO video_reach (video_id, channel_id, tanggal, impresi, ctr)
       SELECT * FROM unnest($1::text[], $2::text[], $3::date[], $4::bigint[], $5::numeric[])
       ON CONFLICT (video_id, tanggal) DO UPDATE SET impresi = EXCLUDED.impresi, ctr = EXCLUDED.ctr`,
      [k.map((x) => x.video_id), k.map(() => channelId), k.map((x) => x.tanggal), k.map((x) => x.impresi), k.map((x) => x.ctr)]);
  }
}

// CTR dan impresi satu channel dari laporan reach YouTube: total per hari ke channel_metrik, per video per hari ke video_reach.
// Berjalan paling sering sekali per 5 jam per channel; 3 hari terakhir selalu diunduh ulang (YouTube merevisi angka),
// hari yang lebih lama hanya bila belum pernah diproses (dicatat di settings 'reach_selesai:<channel>').
async function syncCtr(channelId, token) {
  const kunci = 'ctr_sync:' + channelId;
  const last = await db.query(`SELECT EXTRACT(EPOCH FROM (NOW() - updated_at)) AS detik FROM settings WHERE key = $1`, [kunci]);
  if (last.rows[0] && +last.rows[0].detik < JEDA_JAM * 3600) return 0;
  const job = await pastikanJob(token);
  let selesai = [];
  try { selesai = JSON.parse((await baca('reach_selesai:' + channelId)) || '[]'); } catch (e) { selesai = []; }
  const sudah = new Set(selesai);
  const batas = wib(3);
  const { hasil, video, diunduh } = await ambilReach(token, job.id, (t) => t >= batas || !sudah.has(t));
  let n = 0;
  for (const [t, o] of Object.entries(hasil)) {
    await db.query(
      `INSERT INTO channel_metrik (channel_id, tanggal, impresi, ctr) VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel_id, tanggal) DO UPDATE SET impresi = $3, ctr = $4, updated_at = NOW()`,
      [channelId, t, o.impresi, o.ctr]);
    n++;
  }
  if (video.length) await simpanVideo(channelId, video);
  await db.query(`DELETE FROM video_reach WHERE channel_id = $1 AND tanggal < $2`, [channelId, wib(SIMPAN_HARI)]);
  const gabung = [...new Set([...selesai, ...diunduh.filter((t) => t < batas)])].sort().slice(-SIMPAN_HARI);
  await tulis('reach_selesai:' + channelId, JSON.stringify(gabung));
  await tulis(kunci, job.baru ? 'job-baru' : 'ok');
  return job.baru && !n ? -1 : n; // -1: job baru dibuat, laporan pertama datang 1-2 hari lagi
}

module.exports = { syncCtr, wib };
