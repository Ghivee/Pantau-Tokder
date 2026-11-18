const db = require('../config/db');
const { getChannelIds, getChannelNames } = require('./channelService');
const analyticsService = require('./analyticsService');
const editorService = require('./editorService');
const presensi = require('./presensiService');
const gaji = require('./gajiService');
const pengajuan = require('./pengajuanService');
const kalender = require('./kalenderService');
const social = require('./socialService');

// Every list the app shows, in one place: the single routes and /api/bootstrap both use these,
// so the numbers are the same whichever way they are loaded.

const wib = (n = 0) => new Date(Date.now() + 7 * 3600 * 1000 - n * 86400000).toISOString().slice(0, 10);
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

// Without the retention curves (they are large); latest numbers are stored on each row.
const LIST_COLUMNS = `id, post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video,
  duration_secs, channel_id, channel_nama, revenue, views, likes, comments, stats_at,
  (retention_data IS NOT NULL) AS punya_retensi`;

// An employee sees the channel as a whole and their own work, not colleagues': videos made by
// someone else carry editor_id 0 ("a colleague") instead of who made them.
function samarkan(row, selfId) {
  if (row.editor_id != null && row.editor_id !== selfId) row.editor_id = 0;
  return row;
}

async function content({ isAdmin, uang, selfId, editorId, platform, status } = {}) {
  let sql = `SELECT ${LIST_COLUMNS} FROM content WHERE 1=1`;
  const params = [];
  if (editorId && editorId !== 'all') { params.push(editorId); sql += ` AND editor_id = $${params.length}`; }
  if (platform && platform !== 'all') { params.push(platform); sql += ` AND platform = $${params.length}`; }
  if (status) { params.push(status); sql += ` AND status_identifikasi = $${params.length}`; }
  const rows = (await db.query(sql + ' ORDER BY tanggal_upload DESC', params)).rows;
  // Penghasilan hanya untuk pemilik dan karyawan yang diberi izin; karyawan tidak diberi tahu pembuat video rekannya.
  if (!uang) rows.forEach((r) => { delete r.revenue; });
  if (!isAdmin) rows.forEach((r) => samarkan(r, selfId));
  return rows;
}

async function channels() {
  const [ids, names, seen] = await Promise.all([
    getChannelIds(),
    getChannelNames(),
    db.query(`SELECT channel_id, MAX(channel_nama) AS nama, COUNT(*)::int AS jumlah_video FROM content WHERE channel_id IS NOT NULL GROUP BY channel_id`),
  ]);
  const byId = Object.fromEntries(seen.rows.map((r) => [r.channel_id, r]));
  return ids.map((id) => ({ id, nama: names[id] || (byId[id] && byId[id].nama) || id, jumlah_video: (byId[id] && byId[id].jumlah_video) || 0 }));
}

async function daily({ uang, dari = wib(95), sampai = wib(0) } = {}) {
  if (!TANGGAL.test(dari)) dari = wib(95);
  if (!TANGGAL.test(sampai)) sampai = wib(0);
  const rows = (await db.query(
    `SELECT channel_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, views, menit_tonton::float AS menit_tonton,
            sub_naik, sub_turun, revenue::float AS revenue
     FROM channel_daily WHERE tanggal BETWEEN $1 AND $2 ORDER BY tanggal`,
    [dari, sampai]
  )).rows;
  if (!uang) rows.forEach((r) => { delete r.revenue; });
  return rows;
}

async function aktivitas({ dari = wib(30), sampai = wib(0), editorId } = {}) {
  const params = [dari, sampai];
  let sql = `SELECT id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jam, tugas, detail, jumlah, channel_id, created_at
             FROM aktivitas WHERE tanggal BETWEEN $1 AND $2`;
  if (editorId) { params.push(editorId); sql += ` AND editor_id = $3`; }
  return (await db.query(sql + ' ORDER BY tanggal, jam', params)).rows;
}

async function goal(bulan = wib().slice(0, 7)) {
  let r = await db.query('SELECT * FROM affiliate_goals WHERE bulan = $1', [bulan]);
  if (!r.rows.length) r = await db.query('INSERT INTO affiliate_goals (bulan, target_omset, tercapai) VALUES ($1, 0, 0) ON CONFLICT DO NOTHING RETURNING *', [bulan]);
  const g = r.rows[0] || { bulan, target_omset: 0, tercapai: 0 };
  const imp = await db.query(`SELECT value FROM settings WHERE key = 'afiliasi_impor'`);
  try { g.impor = imp.rows[0] ? JSON.parse(imp.rows[0].value) : null; } catch (e) { g.impor = null; }
  return g;
}

async function scanStatus() {
  const [ids, last, summary] = await Promise.all([
    getChannelIds(),
    db.query('SELECT * FROM scan_log ORDER BY id DESC LIMIT 1').catch(() => ({ rows: [] })),
    db.query(`SELECT value FROM settings WHERE key = 'last_scan_summary'`).catch(() => ({ rows: [] })),
  ]);
  let lastSummary = null;
  try { lastSummary = summary.rows[0] ? JSON.parse(summary.rows[0].value) : null; } catch (e) { /* unreadable: show none */ }
  return {
    youtube_api_key: !!process.env.YOUTUBE_API_KEY,
    youtube_channels: ids.length,
    database_url: !!process.env.DATABASE_URL,
    google_oauth_client: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    last_scan: last.rows[0] || null,
    last_summary: lastSummary,
  };
}

async function oauthStatus() {
  await analyticsService.migrateLegacyToken();
  const [connections, ids, names] = await Promise.all([analyticsService.listConnections(), getChannelIds(), getChannelNames()]);
  const byId = Object.fromEntries(connections.map((c) => [c.channel_id, c]));
  const all = [...new Set([...ids, ...connections.map((c) => c.channel_id)])];
  return {
    connected: connections.length > 0,
    channels: all.map((id) => ({ id, nama: names[id] || (byId[id] && byId[id].nama) || id, connected: !!byId[id], connected_at: byId[id] ? byId[id].updated_at : null })),
  };
}

// Presensi as the signed-in person may see it: the owner gets everything, an employee only their own.
async function presensiFor({ isAdmin, editor, ip }) {
  const dari = wib(30), sampai = wib(0);
  const editorId = isAdmin ? null : editor.id;
  const [cfg, rows, ditolak] = await Promise.all([presensi.getConfig(), presensi.daftar({ dari, sampai, editorId }), presensi.daftarDitolak({ dari, sampai, editorId })]);
  const base = { ip_anda: ip, ip_kantor: presensi.ipTerdaftar(ip, cfg.ips) };
  const config = isAdmin
    ? { ...cfg, ...base, ip_saran: presensi.ipSaran(ip), ip_kandidat: await presensi.kandidatIp(cfg) }
    : { ...presensi.untukKaryawan(cfg), ...base };
  return { config, rows, ditolak };
}

// Opening hours per weekday and every day off by date, for the pages that count working days.
async function kalenderFor() {
  const cfg = await presensi.getConfig();
  return { jadwal: cfg.jadwal, toleransi: cfg.toleransi, cuti_bersama: cfg.cuti_bersama, libur: kalender.daftarLibur(cfg) };
}

async function pengajuanFor({ isAdmin, editor }) {
  const editorId = isAdmin ? null : editor.id;
  const cfg = await gaji.getConfig();
  const [list, cuti] = await Promise.all([pengajuan.daftar({ editorId }), pengajuan.sisaCuti(cfg, editorId)]);
  return { list, cuti };
}

// Everything the app needs to draw any page, in one request. A part that fails is reported
// in `gagal` instead of failing the whole answer, so the rest still shows.
async function bootstrap({ isAdmin, editor, ip }) {
  const parts = {
    // An employee gets only their own profile, tasks and attendance.
    editors: () => editorService.getAllEditors().then((l) => (isAdmin ? l : l.filter((e) => e.id === editor.id))),
    content: () => content({ isAdmin, uang: isAdmin || !!(editor && editor.uang), selfId: editor && editor.id }),
    aktivitas: () => aktivitas({ dari: wib(60), editorId: isAdmin ? null : editor.id }),
    kalender: () => kalenderFor(),
    channels: () => channels(),
    scan: () => scanStatus(),
    oauth: () => oauthStatus(),
    sosmed: () => social.ringkasan(),
    goal: () => (isAdmin ? goal() : null),
    daily: () => daily({ uang: isAdmin || !!(editor && editor.uang), dari: wib(190) }),
    presensi: () => presensiFor({ isAdmin, editor, ip }),
    gaji: () => gaji.hitungBulan(wib().slice(0, 7), { editorId: isAdmin ? null : editor.id }),
    pengajuan: () => pengajuanFor({ isAdmin, editor }),
  };
  const names = Object.keys(parts);
  const results = await Promise.allSettled(names.map((n) => parts[n]()));
  const out = { gagal: {} };
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out[names[i]] = r.value;
    else { console.error('bootstrap', names[i], r.reason); out[names[i]] = null; out.gagal[names[i]] = 'Tidak bisa dimuat. Coba lagi sebentar lagi.'; }
  });
  // Without the people and videos no page can be drawn: that is a real error.
  if (out.editors == null || out.content == null) throw results.find((r) => r.status === 'rejected').reason;
  return out;
}

module.exports = { samarkan, kalenderFor, content, channels, daily, aktivitas, goal, scanStatus, oauthStatus, presensiFor, bootstrap, LIST_COLUMNS, wib };
