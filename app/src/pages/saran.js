import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { fmt } from '../lib/format.js';
import { toast } from '../ui/bits.js';

// Saran untuk tim produksi, dari tiga sumber nyata: pencarian YouTube (kata kunci dan bahan judul), video terlaris di YouTube,
// dan video channel itu sendiri (ciri khas judul yang bekerja). Pilih channel, salin judul dan kata kunci.
const Z = (S.saranData = { data: null, galat: null, memuat: false, ch: null, komentar: null });

const pendek = (n) => String(n).replace(/\s+Hari Ini$/i, '');
const warna = (id) => { const i = Z.data ? Z.data.channels.findIndex((c) => c.id === id) : -1; return i >= 0 && i < 3 ? `var(--ch-${i + 1})` : 'var(--muted)'; };
const pilihan = () => Z.data.channels.find((c) => c.id === Z.ch) || Z.data.channels[0];
const rowContoh = (j, sub) => `<div class="sr-ct"><span>${esc(j.judul)}${sub ? `<span class="muted"> · ${esc(sub)}</span>` : ''}</span><b>${fmt(j.views)}</b></div>`;

// Pertanyaan penonton di komentar channel ini, per topik; ketuk untuk menyalin contoh pertanyaannya sebagai bahan judul.
function kartuKomentar(c) {
  const K = Z.komentar;
  const k = K && K.tersedia && K.channels.find((x) => x.id === c.id);
  if (!k || k.galat) return '';
  return `<section class="card">
      <div class="card-h"><h2>Pertanyaan penonton</h2><span class="muted">${nf0(k.dipindai)} komentar terbaru</span></div>
      ${k.topik.length ? k.topik.map((t) => `<button class="sr-q" data-act="saran-judul" data-v="${esc(t.contoh[0])}"><span class="sr-qh"><b>${esc(t.topik)}</b><span class="muted">${t.n} pertanyaan</span></span><span class="sr-qc">${esc(t.contoh[0])}</span></button>`).join('') : '<p class="muted">Belum ada pertanyaan yang jelas.</p>'}
    </section>`;
}
const nf0 = (n) => new Intl.NumberFormat('id-ID').format(n);

function cirikhas(c) {
  const g = c.gaya;
  if (!g.n) return '<p class="muted">Belum ada video di channel ini.</p>';
  if (!g.cukup) return `<p class="muted">Baru ${g.n} video. Ciri khas muncul setelah 8 video yang sudah berumur 3 hari.</p>`;
  const ciri = [...g.ciri, `Judul ±${g.panjang} huruf`, ...(g.short >= 50 ? ['Banyak Shorts'] : [])];
  return `<div class="sr-kata">${ciri.map((x) => `<span class="chip tetap">${esc(x)}</span>`).join('')}</div>
    ${g.ampuh.length ? `<p class="sr-ket">Kata yang menyertai views tinggi</p><div class="sr-kata">${g.ampuh.map((a) => `<span class="chip tetap">${esc(a.kata)}</span>`).join('')}</div>` : ''}`;
}

function isi() {
  if (Z.galat && !Z.data) return `<section class="card"><div class="empty">${esc(Z.galat)}</div><div class="tools"><button class="btn sm" data-act="saran-muat">Coba lagi</button></div></section>`;
  if (!Z.data) return '<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:240px"></div>';
  const d = Z.data, c = pilihan();
  return `
    <div class="seg scroll" role="group" aria-label="Channel">${d.channels.map((x) => `<button data-act="saran-ch" data-v="${esc(x.id)}" aria-pressed="${x.id === c.id}"><i class="dot" style="background:${warna(x.id)}"></i>${esc(pendek(x.nama))}</button>`).join('')}</div>
    ${c.galat ? `<section class="card"><div class="empty">${esc(c.galat)}</div></section>` : ''}
    <section class="card">
      <div class="card-h"><h2>Ciri khas</h2><span class="muted">${c.gaya.n} video</span></div>
      ${cirikhas(c)}
    </section>
    ${kartuKomentar(c)}
    ${c.judul.length ? `<section class="card">
      <div class="card-h"><h2>Judul</h2><span class="muted">${c.judul.length} · ketuk untuk menyalin</span></div>
      ${c.judul.map((j) => `<button class="sr-j" data-act="saran-judul" data-v="${esc(j)}"><span>${esc(j)}</span></button>`).join('')}
    </section>` : ''}
    ${c.kata.length ? `<section class="card">
      <div class="card-h"><h2>Kata kunci</h2><button class="btn sm" data-act="saran-kata-semua">Salin semua</button></div>
      <div class="sr-kata">${c.kata.map((k) => `<button class="chip" data-act="saran-judul" data-v="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    </section>` : ''}
    ${c.produk.length ? `<section class="card">
      <div class="card-h"><h2>Produk</h2></div>
      ${c.produk.map((p) => `<div class="sr-prod"><span>${esc(p.nama)}</span><a href="${esc(p.url)}" target="_blank" rel="noopener">Cari</a><button class="lnk" data-act="saran-tautan" data-v="${esc(p.nama)}">Tautan</button></div>`).join('')}
    </section>` : ''}
    ${c.gaya.terlaris.length || c.youtube.daftar.length ? `<section class="card">
      <div class="card-h"><h2>Contoh terlaris</h2></div>
      ${c.gaya.terlaris.length ? `<p class="sr-ket">Di channel ini</p>${c.gaya.terlaris.slice(0, 3).map((j) => rowContoh(j)).join('')}` : ''}
      ${c.youtube.daftar.length ? `<p class="sr-ket">Di YouTube, setahun terakhir</p>${c.youtube.daftar.slice(0, 4).map((j) => rowContoh(j, j.channel)).join('')}` : ''}
    </section>` : ''}`;
}

PAGES.saran = () => `<header class="head"><h1>Saran</h1></header><div id="saran-isi" class="stack-page">${isi()}</div>`;

function tampil() { const el = $('#saran-isi'); if (el) el.innerHTML = isi(); }

export async function muatSaran() {
  if (Z.memuat) return;
  Z.memuat = true;
  try { Z.data = await api('/api/saran', { timeout: 60000 }); Z.galat = null; if (!Z.data.channels.some((c) => c.id === Z.ch)) Z.ch = null; } catch (e) { Z.galat = e.message; }
  Z.memuat = false;
  tampil();
}

async function muatKomentar() {
  try { Z.komentar = await api('/api/komentar', { timeout: 60000 }); } catch (e) { Z.komentar = { tersedia: false, channels: [] }; }
  tampil();
}

AFTER.saran = () => {
  if (!Z.data || Date.now() - new Date(Z.data.dihitung).getTime() > 3 * 3600 * 1000) muatSaran();
  if (!Z.komentar) muatKomentar();
};

export const pilihChannel = (id) => { Z.ch = id; tampil(); };

export async function salin(teks, pesan = 'Disalin') {
  try { await navigator.clipboard.writeText(teks); toast(pesan); } catch (e) { toast(teks, true); }
}

// Kolom tag YouTube dibatasi 500 karakter: kata kunci diambil dari yang paling dicari sampai muat.
export function salinSemuaKata() {
  if (!Z.data) return;
  const kata = []; let n = 0;
  for (const k of pilihan().kata) { if (n + k.length + 2 > 500) break; kata.push(k); n += k.length + 2; }
  salin(kata.join(', '), `${kata.length} kata kunci disalin`);
}
