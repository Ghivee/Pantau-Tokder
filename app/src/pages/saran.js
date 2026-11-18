import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { toast } from '../ui/bits.js';

// Saran konten untuk tim produksi: pilih channel, pilih masalah kebun, lalu salin judul dan kata kunci.
// Isinya dihitung server dari cuaca terkini; channel harga mendapat judul update harga bertanggal.
const Z = (S.saranData = { data: null, galat: null, memuat: false, ch: null, m: null });

const pendek = (n) => String(n).replace(/\s+Hari Ini$/i, '');
const chIndex = (id) => (Z.data ? Z.data.channels.findIndex((c) => c.id === id) : -1);
const warna = (id) => { const i = chIndex(id); return i >= 0 && i < 3 ? `var(--ch-${i + 1})` : 'var(--muted)'; };

function pilihan() {
  const d = Z.data;
  const ch = d.channels.find((c) => c.id === Z.ch) || d.channels[0];
  const m = d.masalah.find((x) => x.id === Z.m) || d.masalah[0];
  return { ch, m, isi: m.per[ch.id] };
}

function isi() {
  if (Z.galat && !Z.data) return `<section class="card"><div class="empty">${esc(Z.galat)}</div><div class="tools"><button class="btn sm" data-act="saran-muat">Coba lagi</button></div></section>`;
  if (!Z.data) return '<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:240px"></div>';
  const d = Z.data, { ch, m, isi: x } = pilihan();
  const harga = ch.tema === 'harga';
  return `
    <p class="sr-sit">${esc(d.ringkas)} · ${esc(d.lokasi)}</p>
    <div class="seg scroll" role="group" aria-label="Channel">${d.channels.map((c) => `<button data-act="saran-ch" data-v="${esc(c.id)}" aria-pressed="${c.id === ch.id}"><i class="dot" style="background:${warna(c.id)}"></i>${esc(pendek(c.nama))}</button>`).join('')}</div>
    ${harga ? '' : `
    ${d.masalah.length > 1 ? `<div class="sr-chips" role="group" aria-label="Masalah">${d.masalah.map((x2) => `<button data-act="saran-m" data-v="${esc(x2.id)}" aria-pressed="${x2.id === m.id}">${esc(x2.label)}</button>`).join('')}</div>` : ''}
    <section class="card sr-isi">
      <dl>
        <dt>Masalah</dt><dd><b>${esc(m.masalah)}</b><span class="muted">${esc(m.dasar)}</span></dd>
        <dt>Solusi</dt><dd><ol>${m.solusi.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></dd>
        <dt>Produk</dt><dd>${m.produk.map((p) => `<div class="sr-prod"><span>${esc(p.nama)}</span><a href="${esc(p.url)}" target="_blank" rel="noopener">Cari</a><button class="lnk" data-act="saran-tautan" data-v="${esc(p.nama)}">Tautan</button></div>`).join('')}</dd>
      </dl>
    </section>`}
    <section class="card">
      <div class="card-h"><h2>Judul</h2><span class="muted">${x.judul.length} · ketuk untuk menyalin</span></div>
      ${x.judul.map((j) => `<button class="sr-j" data-act="saran-judul" data-v="${esc(j)}"><span>${esc(j)}</span></button>`).join('')}
    </section>
    <section class="card">
      <div class="card-h"><h2>Kata kunci</h2><button class="btn sm" data-act="saran-kata-semua">Salin semua</button></div>
      <div class="sr-kata">${x.kata.map((k) => `<button class="chip" data-act="saran-judul" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    </section>`;
}

PAGES.saran = () => `<header class="head"><h1>Saran</h1></header><div id="saran-isi" class="stack-page">${isi()}</div>`;

function tampil() { const el = $('#saran-isi'); if (el) el.innerHTML = isi(); }

export async function muatSaran() {
  if (Z.memuat) return;
  Z.memuat = true;
  try { Z.data = await api('/api/saran', { timeout: 30000 }); Z.galat = null; if (!Z.data.channels.some((c) => c.id === Z.ch)) Z.ch = null; if (!Z.data.masalah.some((x) => x.id === Z.m)) Z.m = null; } catch (e) { Z.galat = e.message; }
  Z.memuat = false;
  tampil();
}

AFTER.saran = () => { if (!Z.data || Date.now() - new Date(Z.data.dihitung).getTime() > 3 * 3600 * 1000) muatSaran(); };

export const pilihChannel = (id) => { Z.ch = id; tampil(); };
export const pilihMasalah = (id) => { Z.m = id; tampil(); };

export async function salin(teks, pesan = 'Disalin') {
  try { await navigator.clipboard.writeText(teks); toast(pesan); } catch (e) { toast(teks, true); }
}

// Kolom tag YouTube dibatasi 500 karakter: kata kunci diambil dari yang paling penting sampai muat.
export function salinSemuaKata() {
  if (!Z.data) return;
  const kata = []; let n = 0;
  for (const k of pilihan().isi.kata) { if (n + k.length + 2 > 500) break; kata.push(k); n += k.length + 2; }
  salin(kata.join(', '), `${kata.length} kata kunci disalin`);
}
