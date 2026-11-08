import { jamKerja } from './calendar.js';
import { TOL, TUGAS, gradeOf, slotsOf, targetOf } from './rules.js';
import { S } from './state.js';
import { addDays, nowJam, sum, toMin, today } from '../lib/format.js';

// Which schedule slot an upload belongs to: the latest slot no more than 30 minutes after the upload.
function slotFor(e, jam) {
  const slots = slotsOf(e);
  if (!slots.length) return null;
  const t = toMin(jam);
  const before = slots.filter((s) => toMin(s) <= t + 30);
  const slot = before.length ? before[before.length - 1] : slots[0];
  return { slot, late: t - toMin(slot) };
}

export function dayStats(e, day) {
  const key = e.id + '|' + day;
  if (S.cache.has(key)) return S.cache.get(key);
  // Today only counts the part of the day that has passed: slots already due, or hours since 05:00.
  const partial = day === today();
  let frac = 1;
  if (partial) {
    const now = toMin(nowJam());
    const sl = slotsOf(e);
    frac = sl.length ? sl.filter((x) => toMin(x) + TOL <= now).length / sl.length : Math.min(1, Math.max(0, (now - 300) / (22 * 60 - 300)));
  }
  const target = jamKerja(day) ? Math.round(targetOf(e) * frac) : 0;
  const tTarget = Object.fromEntries(TUGAS.map((t) => [t.nama, t.target(target, frac)]));
  const vids = (S.byEdDay.get(e.id + '|' + day) || []).slice().sort((a, b) => a._jam.localeCompare(b._jam));
  vids.forEach((v) => { const m = slotFor(e, v._jam); v._slot = m && m.slot; v._late = m ? m.late : null; v._tepat = m ? m.late <= TOL : null; });
  const tasks = S.akByEdDay.get(e.id + '|' + day) || [];
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
    e, day, libur: !jamKerja(day), target, tTarget, partial, vids, n, tepat, telat: withSlot.length - tepat, withSlot: withSlot.length, tasks, done,
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
