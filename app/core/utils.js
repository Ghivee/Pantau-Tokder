// app/core/utils.js - Helper functions
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&', '<': '<', '>': '>', '"': '"', "'": "'"
}[c]));

export const nf = new Intl.NumberFormat('id-ID');
export const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
export const fmt = (n) => (n == null || isNaN(n) ? '—' : Math.abs(n) >= 10000 ? cf.format(n) : nf.format(Math.round(n)));
export const pct = (v) => (v == null || isNaN(v) ? '—' : Math.round(v * 100) + '%');
export const usd = (v) => (v == null || isNaN(v) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v));
export const idr = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
export const signed = (v, f = nf.format) => (v == null || isNaN(v) ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v)));

export const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
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

export const ICON = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  day: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14h3v3H8z"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
  team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  money: '<path d="M12 2v20M17 6.5c-.8-1.5-2.6-2.5-5-2.5-3 0-5 1.5-5 3.7 0 5 10 2.6 10 7.6 0 2.2-2 3.7-5 3.7-2.6 0-4.5-1-5.3-2.6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  sync: '<path d="M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8"/><path d="M18 2v4h-4M6 22v-4h4"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  out: '<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>',
};
export const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

// Rules
export const TOL = 15;
export const TUGAS = [
  { nama: 'Riset harga cabai', short: 'Riset harga', target: (video, frac) => (frac > 0 ? 1 : 0) },
  { nama: 'Buat thumbnail', short: 'Thumbnail', target: (video) => video },
  { nama: 'Cek SEO & tag', short: 'Cek SEO', target: (video) => video },
  { nama: 'Balas komentar', short: 'Komentar', target: (video, frac) => Math.round(30 * frac) },
];
export const TUGAS_LAIN = ['Edit video', 'Lainnya'];
export const TOPIK = [
  ['Harga cabai', /harga|pasar|naik|turun|update|prediksi/i],
  ['Pestisida & semprot', /pestisida|insektisida|fungisida|semprot|oplos/i],
  ['Hama & penyakit', /hama|penyakit|thrips|kutu|layu|patek|antraknosa|keriting|virus|ulat|lalat|busuk|fusarium/i],
  ['Pupuk & nutrisi', /pupuk|npk|kocor|kalsium|boron|nutrisi|kompos|organik/i],
  ['Semai & bibit', /semai|bibit|benih|pindah tanam|persemaian/i],
  ['Panen & hasil', /panen|hasil|untung|omzet/i],
  ['Lahan & perawatan', /lahan|mulsa|bedeng|ajir|siram|perawatan|pangkas|wiwil/i],
];
export const topikOf = (t) => (TOPIK.find(([, re]) => re.test(t)) || ['Lainnya'])[0];
export const targetOf = (e) => +e.target_harian || 3;
export const slotsOf = (e) => String(e.jadwal || '').split(',').map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)).sort();
export const gradeOf = (s) => (s == null ? null : s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : 'D');
export const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];

// Toast system
export function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}

// Broken image fallback
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (img.tagName === 'IMG' && img.classList.contains('ava')) {
    const s = document.createElement('span');
    s.className = img.className;
    s.style.background = img.dataset.color || 'var(--muted)';
    s.textContent = img.dataset.ini || '?';
    img.replaceWith(s);
  }
}, true);

export const peranLabel = (p) => (p === 'terbatas' ? 'Editor terbatas' : 'Editor');
export const thumb = (c) => (c.post_id ? `https://i.ytimg.com/vi/${encodeURIComponent(c.post_id)}/mqdefault.jpg` : '');
export const vidCell = (c) => `<div class="vid">${thumb(c) ? `<img src="${thumb(c)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div class="tx"><b>${esc(c.judul)}</b><div>${esc(c._chNama)} · ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'}</div></div></div>`;
export const editorCell = (c, editorById) => {
  let e = null;
  if (typeof editorById === 'function') {
    e = editorById(c.editor_id);
  } else if (typeof window !== 'undefined' && window.__pt_getEditor) {
    e = window.__pt_getEditor(c.editor_id);
  }
  return e ? `<span class="ed">${avatar(e, 'xs')}${esc(e.nama)}</span>` : '<span class="pill warn">Belum dikenali</span>';
};

export function avatar(e, size = '') {
  if (!e) return `<span class="ava ${size}" style="background:var(--line-2)" aria-hidden="true">?</span>`;
  const ini = esc((e.nama || '?').trim().slice(0, 1).toUpperCase());
  if (e.foto_url) return `<img class="ava ${size}" src="${esc(e.foto_url)}" alt="Foto ${esc(e.nama)}" data-ini="${ini}" data-color="${e._color}">`;
  return `<span class="ava ${size}" style="background:${e._color}" aria-hidden="true">${ini}</span>`;
}

export const agoText = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu';
};

export function measureText(svg, text) {
  try {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.textContent = text;
    svg.append(t);
    const w = t.getComputedTextLength() || (String(text).length * 8);
    t.remove();
    return w;
  } catch (e) {
    return String(text).length * 8;
  }
}

export const niceStep = (max) => { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw) || p * 10; };
