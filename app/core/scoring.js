// app/core/scoring.js - Scoring logic (moved from main.js)
import { getState } from './state.js';
import { TOL, TUGAS, targetOf, slotsOf, gradeOf, median, sum, topikOf, toMin, addDays, today, nowJam, PALETTE, WIB } from './utils.js';

export function slotFor(e, jam) {
  const slots = slotsOf(e);
  if (!slots.length) return null;
  const t = toMin(jam);
  const before = slots.filter((s) => toMin(s) <= t + 30);
  const slot = before.length ? before[before.length - 1] : slots[0];
  return { slot, late: t - toMin(slot) };
}

export function dayStats(e, day) {
  const S = getState();
  const key = e.id + '|' + day;
  if (S.cache.has(key)) return S.cache.get(key);
  
  const partial = day === today();
  let frac = 1;
  if (partial) {
    const now = toMin(nowJam());
    const sl = slotsOf(e);
    frac = sl.length ? sl.filter((x) => toMin(x) + TOL <= now).length / sl.length : Math.min(1, Math.max(0, (now - 300) / (22 * 60 - 300)));
  }
  const target = Math.round(targetOf(e) * frac);
  const tTarget = Object.fromEntries(TUGAS.map((t) => [t.nama, t.target(target, frac)]));
  const vids = S.content.filter((c) => c.editor_id === e.id && c._day === day).sort((a, b) => a._jam.localeCompare(b._jam));
  vids.forEach((v) => { const m = slotFor(e, v._jam); v._slot = m && m.slot; v._late = m ? m.late : null; v._tepat = m ? m.late <= TOL : null; });
  const tasks = S.aktivitas.filter((a) => a.editor_id === e.id && a.tanggal === day);
  const done = (nama) => sum(tasks.filter((a) => a.tugas === nama), (a) => a.jumlah);
  const n = vids.length;
  const withSlot = vids.filter((v) => v._tepat !== null);
  const tepat = withSlot.filter((v) => v._tepat).length;
  const mature = vids.filter((v) => v._age >= 2 && S.medians[v._ch + '|' + v.tipe_video]);
  const ratio = mature.length ? sum(mature, (v) => Math.min(v.views / S.medians[v._ch + '|' + v.tipe_video], 1.2)) / mature.length : null;

  const parts = [];
  if (target > 0 || n > 0) parts.push({ key: 'video', max: 35, pts: target ? Math.min(n / target, 1) * 35 : 35 });
  if (slotsOf(e).length && n) parts.push({ key: 'jadwal', max: 25, pts: (tepat / n) * 25 });
  if (ratio != null) parts.push({ key: 'views', max: 20, pts: (ratio / 1.2) * 20 });
  const due = TUGAS.filter((t) => tTarget[t.nama] > 0);
  if (S.aktivitas.length && due.length) parts.push({ key: 'tugas', max: 20, pts: (sum(due, (t) => Math.min(done(t.nama) / tTarget[t.nama], 1)) / due.length) * 20 });
  const skor = day > today() || !parts.length ? null : Math.round((sum(parts, (p) => p.pts) / sum(parts, (p) => p.max)) * 100);
  const res = {
    e, day, target, tTarget, partial, vids, n, tepat, telat: withSlot.length - tepat, withSlot: withSlot.length, tasks, done,
    views: sum(vids, (v) => v.views), ratio, parts, skor, nilai: gradeOf(skor),
  };
  S.cache.set(key, res);
  return res;
}

export function periodStats(e, days) {
  const list = days.map((d) => dayStats(e, d));
  const scored = list.filter((x) => x.skor != null);
  const vids = list.flatMap((x) => x.vids);
  const withSlot = sum(list, (x) => x.withSlot);
  return {
    e, list, n: vids.length, target: sum(list, (x) => x.target),
    tepat: withSlot ? sum(list, (x) => x.tepat) / withSlot : null,
    views: sum(vids, (v) => v.views),
    tugas: sum(list, (x) => sum(x.tasks, (a) => a.jumlah)),
    skor: scored.length ? Math.round(sum(scored, (x) => x.skor) / scored.length) : null,
  };
}

export const daysBack = (n, end = today()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

export function normalize() {
  const S = getState();
  S.cache.clear();
  S.editors.sort((a, b) => a.id - b.id);
  S.editors.forEach((e, i) => { e._color = PALETTE[i % PALETTE.length]; e.peran = e.peran || 'editor'; e.status = e.status || 'aktif'; });
  const chNames = Object.fromEntries((S.channels || []).map((c) => [c.id, c.nama]));
  const firstCh = (S.channels[0] && S.channels[0].id) || 'utama';
  S.content.forEach((c) => {
    const w = new Date(new Date(c.tanggal_upload).getTime() + WIB).toISOString();
    c._day = w.slice(0, 10);
    c._jam = w.slice(11, 16);
    c._ch = c.channel_id || firstCh;
    c._chNama = c.channel_nama || chNames[c._ch] || 'Channel utama';
    c._topik = topikOf(c.judul || '');
    c.views = +c.views || 0; c.likes = +c.likes || 0; c.comments = +c.comments || 0; c.revenue = c.revenue == null ? null : +c.revenue;
    c._age = (Date.now() - new Date(c.tanggal_upload).getTime()) / 86400000;
    if (typeof c.retention_data === 'string') { try { c.retention_data = JSON.parse(c.retention_data); } catch (e) { c.retention_data = null; } }
  });
  if (!S.channels.length) {
    const seen = {};
    S.content.forEach((c) => { seen[c._ch] = c._chNama; });
    S.channels = Object.entries(seen).map(([id, nama]) => ({ id, nama }));
  }
  const CH_COLORS = ['var(--s4)', 'var(--s5)', 'var(--s3)', 'var(--s1)', 'var(--s2)'];
  S.channels.forEach((c, i) => { c._color = CH_COLORS[i % CH_COLORS.length]; });
  S.connected = new Set(((S.oauth && S.oauth.channels) || []).filter((c) => c.connected).map((c) => c.id));
  S.daily.forEach((d) => { d.views = +d.views || 0; d.menit_tonton = +d.menit_tonton || 0; d.sub_naik = +d.sub_naik || 0; d.sub_turun = +d.sub_turun || 0; d.revenue = d.revenue == null ? null : +d.revenue; });
  S.aktivitas.forEach((a) => { a.editor_id = +a.editor_id; a.jumlah = +a.jumlah || 1; a.tanggal = String(a.tanggal).slice(0, 10); });
  
  // Median views per channel + type
  S.medians = {};
  const grouped = {};
  S.content.filter((c) => c._age >= 2 && c._age <= 32).forEach((c) => { (grouped[c._ch + '|' + c.tipe_video] ||= []).push(c.views); });
  Object.entries(grouped).forEach(([k, v]) => { S.medians[k] = median(v); });
  if (!S.day) S.day = today();
}