export const nf = new Intl.NumberFormat('id-ID');

const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

export const fmt = (n) => (n == null || isNaN(n) ? '—' : Math.abs(n) >= 10000 ? cf.format(n) : nf.format(Math.round(n)));

export const pct = (v) => (v == null || isNaN(v) ? '—' : Math.round(v * 100) + '%');

export const idr = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);

export const rpOrDash = (v) => (v == null || isNaN(v) ? '—' : idr(v));

export const signed = (v, f = nf.format) => (v == null || isNaN(v) ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v)));

const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const WIB = 7 * 3600 * 1000;

export const today = () => new Date(Date.now() + WIB).toISOString().slice(0, 10);

export const nowJam = () => new Date(Date.now() + WIB).toISOString().slice(11, 16);

export const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);

export const asDate = (d) => new Date(d + 'T00:00:00Z');

export const tglPendek = (d) => { const x = asDate(d); return x.getUTCDate() + ' ' + BLN[x.getUTCMonth()]; };

export const tglPanjang = (d) => { const x = asDate(d); return HARI[x.getUTCDay()] + ', ' + x.getUTCDate() + ' ' + BLN[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); };

export const toMin = (hm) => { const p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1]); };

export const durasi = (s) => { s = +s || 0; const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };

export const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
