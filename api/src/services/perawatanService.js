const db = require('../config/db');
const push = require('./pushService');
const { todayWib } = require('./presensiService');

// Daily housekeeping so the database stays small and fast as the years pass.
// - metrics_snapshot: hourly rows are kept for 14 days; older days keep only their last row per
//   video (enough for "views per day" charts and the 7-day gain).
// - push_terkirim: "already sent" markers older than 60 days are no longer needed.
// - presensi_ditolak: refused check-ins are kept for a year.
// Deletes run in batches within a time budget, so one run never holds the scheduler for long;
// whatever is left is picked up the next day.

const KUNCI = 'perawatan';
const BATCH = 20000;
const BUDGET_MS = 20000;

async function hapusBertahap(sql, mulai) {
  let total = 0;
  for (;;) {
    const r = await db.query(sql, [BATCH]);
    total += r.rowCount;
    if (r.rowCount < BATCH || Date.now() - mulai > BUDGET_MS) return total;
  }
}

async function rawat() {
  const mulai = Date.now();
  const snapshot = await hapusBertahap(
    `DELETE FROM metrics_snapshot WHERE ctid IN (
       SELECT m.ctid FROM metrics_snapshot m
       WHERE m.timestamp < NOW() - INTERVAL '14 days'
         AND EXISTS (SELECT 1 FROM metrics_snapshot n
                     WHERE n.content_id = m.content_id AND n.timestamp > m.timestamp
                       AND (n.timestamp + INTERVAL '7 hours')::date = (m.timestamp + INTERVAL '7 hours')::date)
       LIMIT $1)`, mulai);
  const terkirim = await hapusBertahap(
    `DELETE FROM push_terkirim WHERE ctid IN (SELECT ctid FROM push_terkirim WHERE waktu < NOW() - INTERVAL '60 days' LIMIT $1)`, mulai);
  const ditolak = await hapusBertahap(
    `DELETE FROM presensi_ditolak WHERE ctid IN (SELECT ctid FROM presensi_ditolak WHERE waktu < NOW() - INTERVAL '365 days' LIMIT $1)`, mulai);
  const hasil = { waktu: new Date().toISOString(), detik: Math.round((Date.now() - mulai) / 100) / 10, dihapus: { snapshot, terkirim, ditolak } };
  await db.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [KUNCI, JSON.stringify(hasil)]
  );
  return hasil;
}

// Monday-morning summary for the owner: last 7 days against the 7 before, from real data only.
async function ringkasanMingguan() {
  const r = await db.query(`
    SELECT
      (SELECT COUNT(*)::int FROM content WHERE tanggal_upload >= NOW() - INTERVAL '7 days') AS video,
      (SELECT COUNT(*)::int FROM content WHERE tanggal_upload >= NOW() - INTERVAL '14 days' AND tanggal_upload < NOW() - INTERVAL '7 days') AS video_lalu,
      (SELECT COALESCE(SUM(views), 0)::bigint FROM channel_daily WHERE tanggal >= CURRENT_DATE - 7) AS views,
      (SELECT COALESCE(SUM(views), 0)::bigint FROM channel_daily WHERE tanggal >= CURRENT_DATE - 14 AND tanggal < CURRENT_DATE - 7) AS views_lalu,
      (SELECT COUNT(*)::int FROM presensi WHERE jenis = 'masuk' AND telat_menit > 0 AND tanggal >= CURRENT_DATE - 7) AS telat,
      (SELECT COUNT(*)::int FROM pengajuan WHERE status = 'menunggu') AS menunggu`);
  const x = r.rows[0];
  const nf = new Intl.NumberFormat('id-ID');
  const arah = (a, b) => (b > 0 ? ` (${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%)` : '');
  const bagian = [`${x.video} video baru${arah(x.video, x.video_lalu)}`];
  if (Number(x.views) > 0) bagian.push(`${nf.format(Number(x.views))} views${arah(Number(x.views), Number(x.views_lalu))}`);
  bagian.push(x.telat ? `${x.telat}× telat masuk` : 'tidak ada yang telat');
  if (x.menunggu) bagian.push(`${x.menunggu} pengajuan menunggu`);
  return { title: 'Ringkasan minggu lalu', body: bagian.join(' · ') + '.', url: '/', tag: 'mingguan' };
}

// Called by the hourly scheduler; each job runs at most once in its period.
async function jadwal(now = Date.now()) {
  const hari = todayWib(now);
  const jamWib = new Date(now + 7 * 3600000).getUTCHours();
  const out = {};
  // Housekeeping at night (WIB), when nobody is checking in.
  if (jamWib >= 1 && jamWib < 5) {
    await push.sekali(`rawat:${hari}`, async () => { out.perawatan = await rawat(); });
  }
  // Monday 07:00–10:00 WIB.
  if (new Date(now + 7 * 3600000).getUTCDay() === 1 && jamWib >= 7 && jamWib < 10) {
    await push.sekali(`mingguan:${hari}`, async () => { out.mingguan = await push.kirim({ admin: true }, await ringkasanMingguan()); });
  }
  return out;
}

async function status() {
  const [ukuran, baris, rawatTerakhir, sinkron, langganan] = await Promise.all([
    db.query('SELECT pg_database_size(current_database())::bigint AS b').catch(() => ({ rows: [{ b: null }] })),
    db.query(`SELECT relname AS tabel, n_live_tup::bigint AS baris FROM pg_stat_user_tables
              WHERE relname IN ('content', 'metrics_snapshot', 'presensi', 'aktivitas', 'audit_logs', 'channel_daily')`).catch(() => ({ rows: [] })),
    db.query(`SELECT value FROM settings WHERE key = $1`, [KUNCI]),
    db.query(`SELECT * FROM scan_log ORDER BY id DESC LIMIT 1`).catch(() => ({ rows: [] })),
    db.query(`SELECT COUNT(*)::int AS n FROM push_langganan`),
  ]);
  let perawatan = null;
  try { perawatan = rawatTerakhir.rows[0] ? JSON.parse(rawatTerakhir.rows[0].value) : null; } catch (e) { perawatan = null; }
  const s = sinkron.rows[0] || null;
  return {
    db_bytes: ukuran.rows[0].b == null ? null : Number(ukuran.rows[0].b),
    baris: Object.fromEntries(baris.rows.map((x) => [x.tabel, Number(x.baris)])),
    perawatan,
    sinkron_terakhir: s ? (s.waktu_scan || s.created_at || null) : null,
    perangkat_notif: langganan.rows[0].n,
  };
}

module.exports = { rawat, ringkasanMingguan, jadwal, status };
