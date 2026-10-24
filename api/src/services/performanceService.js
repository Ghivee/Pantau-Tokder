const db = require('../config/db');

const TOL = 15; // menit toleransi keterlambatan
const WIB = 7 * 3600 * 1000;

const TUGAS = [
  { nama: 'Riset harga cabai', short: 'Riset harga', target: (video, frac) => (frac > 0 ? 1 : 0) },
  { nama: 'Buat thumbnail', short: 'Thumbnail', target: (video) => video },
  { nama: 'Cek SEO & tag', short: 'Cek SEO', target: (video) => video },
  { nama: 'Balas komentar', short: 'Komentar', target: (video, frac) => Math.round(30 * frac) },
];

function todayWib() {
  return new Date(Date.now() + WIB).toISOString().slice(0, 10);
}

function addDays(d, n) {
  return new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

function toMin(hm) {
  const p = String(hm).split(':');
  return (+p[0]) * 60 + (+p[1]);
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function sum(arr, fn) {
  return arr.reduce((s, x) => s + (fn ? fn(x) : x), 0);
}

async function getEditorById(id) {
  const r = await db.query(
    `SELECT id, nama, kode_identifikasi, peran, jadwal, target_harian FROM editors WHERE id = $1 AND status = 'aktif'`,
    [id]
  );
  return r.rows[0] || null;
}

async function getContentByEditorAndDate(editorId, day) {
  const r = await db.query(
    `SELECT id, post_id, platform, url, judul, tanggal_upload, editor_id, status_identifikasi, tipe_video,
      duration_secs, channel_id, channel_nama, revenue, views, likes, comments, stats_at,
      retention_data, retention_source
     FROM content 
     WHERE editor_id = $1 AND to_char(tanggal_upload AT TIME ZONE 'UTC+7', 'YYYY-MM-DD') = $2
     ORDER BY tanggal_upload`,
    [editorId, day]
  );
  return r.rows;
}

async function getAllContentForMedian() {
  const r = await db.query(
    `SELECT channel_id, tipe_video, views, tanggal_upload
     FROM content
     WHERE tanggal_upload >= NOW() - INTERVAL '32 days'
       AND tanggal_upload <= NOW() - INTERVAL '2 days'`
  );
  return r.rows;
}

async function getActivitiesByEditorAndDate(editorId, day) {
  const r = await db.query(
    `SELECT id, editor_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, jam, tugas, detail, jumlah, channel_id, created_at
     FROM aktivitas 
     WHERE editor_id = $1 AND tanggal = $2`,
    [editorId, day]
  );
  return r.rows;
}

function slotsOf(editor) {
  return String(editor.jadwal || '').split(',').map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)).sort();
}

function targetOf(editor) {
  return +editor.target_harian || 3;
}

function slotFor(editor, jam) {
  const slots = slotsOf(editor);
  if (!slots.length) return null;
  const t = toMin(jam);
  const before = slots.filter((s) => toMin(s) <= t + 30);
  const slot = before.length ? before[before.length - 1] : slots[0];
  return { slot, late: t - toMin(slot) };
}

function gradeOf(s) {
  return s == null ? null : s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : 'D';
}

async function computeDailyScore(editorId, day) {
  const editor = await getEditorById(editorId);
  if (!editor) return null;

  const [content, activities] = await Promise.all([
    getContentByEditorAndDate(editorId, day),
    getActivitiesByEditorAndDate(editorId, day)
  ]);

  // Calculate medians for views ratio (cached globally)
  const allContent = await getAllContentForMedian();
  const grouped = {};
  allContent.forEach(c => {
    const chType = `${c.channel_id}|${c.tipe_video}`;
    (grouped[chType] ||= []).push(c.views);
  });
  const medians = {};
  Object.entries(grouped).forEach(([k, v]) => { medians[k] = median(v); });

  // Today partial factor
  const partial = day === todayWib();
  let frac = 1;
  if (partial) {
    const now = toMin(new Date(Date.now() + WIB).toISOString().slice(11, 16));
    const sl = slotsOf(editor);
    frac = sl.length ? sl.filter((x) => toMin(x) + TOL <= now).length / sl.length : Math.min(1, Math.max(0, (now - 300) / (22 * 60 - 300)));
  }

  const target = Math.round(targetOf(editor) * frac);
  const tTarget = Object.fromEntries(TUGAS.map((t) => [t.nama, t.target(target, frac)]));

  const vids = content.map(v => {
    const w = new Date(new Date(v.tanggal_upload).getTime() + WIB).toISOString();
    const jam = w.slice(11, 16);
    const m = slotFor(editor, jam);
    v._slot = m && m.slot;
    v._late = m ? m.late : null;
    v._tepat = m ? m.late <= TOL : null;
    v._age = (Date.now() - new Date(v.tanggal_upload).getTime()) / 86400000;
    return v;
  });

  const n = vids.length;
  const withSlot = vids.filter(v => v._tepat !== null);
  const tepat = withSlot.filter(v => v._tepat).length;

  const mature = vids.filter(v => v._age >= 2 && medians[`${v.channel_id}|${v.tipe_video}`]);
  const ratio = mature.length ? sum(mature, v => Math.min(v.views / medians[`${v.channel_id}|${v.tipe_video}`], 1.2)) / mature.length : null;

  const done = (nama) => sum(activities.filter(a => a.tugas === nama), a => a.jumlah);
  const due = TUGAS.filter(t => tTarget[t.nama] > 0);

  const parts = [];
  if (target > 0 || n > 0) parts.push({ key: 'video', max: 35, pts: target ? Math.min(n / target, 1) * 35 : 35 });
  if (slotsOf(editor).length && n) parts.push({ key: 'jadwal', max: 25, pts: (tepat / n) * 25 });
  if (ratio != null) parts.push({ key: 'views', max: 20, pts: (ratio / 1.2) * 20 });
  if (activities.length && due.length) parts.push({ key: 'tugas', max: 20, pts: (sum(due, t => Math.min(done(t.nama) / tTarget[t.nama], 1)) / due.length) * 20 });

  const skor = day > todayWib() || !parts.length ? null : Math.round((sum(parts, p => p.pts) / sum(parts, p => p.max)) * 100);

  return {
    editor,
    day,
    target,
    tTarget,
    partial,
    vids,
    n,
    tepat,
    telat: withSlot.length - tepat,
    withSlot: withSlot.length,
    tasks: activities,
    done,
    views: sum(vids, v => v.views),
    ratio,
    parts,
    skor,
    nilai: gradeOf(skor)
  };
}

async function computePeriodScore(editorId, days) {
  const editor = await getEditorById(editorId);
  if (!editor) return null;

  const dayStats = await Promise.all(days.map(d => computeDailyScore(editorId, d)));
  const scored = dayStats.filter(x => x.skor != null);
  const vids = dayStats.flatMap(x => x.vids);
  const withSlot = sum(dayStats, x => x.withSlot);

  return {
    editor,
    list: dayStats,
    n: vids.length,
    target: sum(dayStats, x => x.target),
    tepat: withSlot ? sum(dayStats, x => x.tepat) / withSlot : null,
    views: sum(vids, v => v.views),
    tugas: sum(dayStats, x => sum(x.tasks, a => a.jumlah)),
    skor: scored.length ? Math.round(sum(scored, x => x.skor) / scored.length) : null
  };
}

async function getAllEditorScores(days = 7) {
  const editorsResult = await db.query(`SELECT id FROM editors WHERE status = 'aktif'`);
  const dayList = Array.from({ length: days }, (_, i) => addDays(todayWib(), i - days + 1));
  
  const results = await Promise.all(
    editorsResult.rows.map(e => computePeriodScore(e.id, dayList))
  );
  
  return results.filter(r => r !== null);
}

module.exports = {
  computeDailyScore,
  computePeriodScore,
  getAllEditorScores,
  todayWib,
  addDays,
  TOL,
  WIB
};