const db = require('../config/db');
const { pastikanJob, ambilReach } = require('../integrations/reporting');

const wib = (n = 0) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
const JEDA_JAM = 5;

// CTR dan impresi satu channel dari laporan reach YouTube, disimpan ke channel_metrik.
// Berjalan paling sering sekali per 5 jam per channel; 3 hari terakhir selalu diunduh ulang (YouTube merevisi angka),
// hari yang lebih lama hanya bila belum ada.
async function syncCtr(channelId, token) {
  const kunci = 'ctr_sync:' + channelId;
  const last = await db.query(`SELECT EXTRACT(EPOCH FROM (NOW() - updated_at)) AS detik FROM settings WHERE key = $1`, [kunci]);
  if (last.rows[0] && +last.rows[0].detik < JEDA_JAM * 3600) return 0;
  const job = await pastikanJob(token);
  const ada = new Set((await db.query(`SELECT to_char(tanggal, 'YYYY-MM-DD') AS t FROM channel_metrik WHERE channel_id = $1 AND ctr IS NOT NULL`, [channelId])).rows.map((r) => r.t));
  const batas = wib(3);
  const { hasil } = await ambilReach(token, job.id, (t) => t >= batas || !ada.has(t));
  let n = 0;
  for (const [t, o] of Object.entries(hasil)) {
    await db.query(
      `INSERT INTO channel_metrik (channel_id, tanggal, impresi, ctr) VALUES ($1, $2, $3, $4)
       ON CONFLICT (channel_id, tanggal) DO UPDATE SET impresi = $3, ctr = $4, updated_at = NOW()`,
      [channelId, t, o.impresi, o.ctr]);
    n++;
  }
  await db.query(`INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [kunci, job.baru ? 'job-baru' : 'ok']);
  return job.baru && !n ? -1 : n; // -1: job baru dibuat, laporan pertama datang 1-2 hari lagi
}

module.exports = { syncCtr, wib };
