import { median } from '../lib/format.js';
import { peerRatios } from '../pages/shared.js';

// Topik dan kata judul yang laris, dihitung dari video yang pernah dibuat. Dipakai halaman Saran dan Tren channel.
// vids: video (S.content) milik satu channel atau lebih; tiap video dibandingkan dengan video sejenis di channelnya sendiri.

export const STOP = new Set('yang dan untuk dengan dari agar supaya biar bisa tidak jangan paling sangat lebih sudah belum akan pada dalam atau juga saat kalau jika tanpa buat ini itu nya kok loh lah dong aja saja banget gini begini cara tips hari video shorts short part episode terbaru viral sekarang kita kamu anda mereka harus semua banyak sampai cuma setelah sebelum bikin'.split(' '));

export const kataOf = (t) => [...new Set(String(t || '').toLowerCase().replace(/#[\p{L}\d_]+/gu, ' ').match(/\p{L}{4,}/gu) || [])].filter((w) => !STOP.has(w));

const group = (list, key) => { const g = {}; list.forEach((c) => key(c).forEach((k) => { (g[k] ||= []).push(c); })); return g; };

// Topik 14 hari terakhir (video berumur 2-16 hari): views dibanding video lain di periode yang sama, lalu dibanding
// 15-60 hari sebelumnya. Topik ditebak dari kata di judul (core/rules.js).
export function topikTerakhir(vids) {
  const win = (a, b) => vids.filter((c) => c._age >= a && c._age < b);
  const recent = win(2, 16), base = win(16, 60);
  const rR = peerRatios(recent), rB = peerRatios(base);
  const gR = group(recent, (c) => [c._topik]), gB = group(base, (c) => [c._topik]);
  return Object.keys(gR).filter((t) => gR[t].length >= 2).map((t) => ({
    t, n: gR[t].length,
    r: median(gR[t].map((c) => rR.get(c.id)).filter((x) => x != null)),
    b: gB[t] && gB[t].length >= 2 ? median(gB[t].map((c) => rB.get(c.id)).filter((x) => x != null)) : null,
    best: gR[t].reduce((a, b) => (b.views > a.views ? b : a)),
  })).sort((a, b) => b.r - a.r);
}

// Kata di judul yang muncul di 3 video atau lebih dalam 30 hari: median views dibanding video lain.
// kuat = rata-rata lebih ramai (>= 1,15x), lemah = lebih sepi (<= 0,85x).
export function kataLaris(vids) {
  const last30 = vids.filter((c) => c._age >= 2 && c._age < 32), r30 = peerRatios(last30);
  const gK = group(last30, (c) => kataOf(c.judul));
  const kata = Object.entries(gK).filter(([, l]) => l.length >= 3 && l.length <= last30.length * 0.6)
    .map(([k, l]) => ({ k, n: l.length, r: median(l.map((c) => r30.get(c.id)).filter((x) => x != null)) })).sort((a, b) => b.r - a.r);
  return { kuat: kata.filter((x) => x.r >= 1.15).slice(0, 8), lemah: kata.filter((x) => x.r <= 0.85).slice(-4).reverse() };
}
