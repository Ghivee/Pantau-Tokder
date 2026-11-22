export function bacaCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

// "Rp1.234.567", "1,234.50", "12.345,67", "1500" → number
export function angkaUang(v) {
  let s = String(v ?? '').replace(/[^\d,.\-]/g, '');
  if (!/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc > -1) s = /^[^,]*,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (ld > -1 && !/^[^.]*\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const ISO_OK = (y, mo, d) => { const x = new Date(Date.UTC(+y, +mo - 1, +d)); return x.getUTCFullYear() === +y && x.getUTCMonth() === +mo - 1 && x.getUTCDate() === +d ? x.toISOString().slice(0, 10) : null; };

// "2026-10-21 13:00", "21/10/2026 08:00", "21-10-2026", "Oct 21, 2026" → "2026-10-21" (hari lebih dulu, seperti laporan Indonesia)
export function tglIso(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ISO_OK(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return ISO_OK(m[3], m[2], m[1]);
  const d = new Date(s + ' UTC');
  return s && /[a-z]/i.test(s) && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
}

// Sidik jari 32 heks (SHA-256) dari teks: kunci baris laporan supaya impor ulang tidak menggandakan.
export async function sidik(teks) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
