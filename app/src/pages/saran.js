import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { fmt, median, nf } from '../lib/format.js';
import { toast } from '../ui/bits.js';

// Saran video affiliate: masalah → solusi → produk, dari cuaca terkini (server) dan performa topik channel sendiri.
const Z = (S.saranData = { data: null, galat: null, memuat: false });

// Topik terkuat 60 hari terakhir dari video channel sendiri (median views, minimal 3 video).
function topikKuat() {
  const g = {};
  S.content.filter((c) => c._age >= 2 && c._age <= 60 && c._topik !== 'Lainnya').forEach((c) => { (g[c._topik] ||= []).push(c.views); });
  const semua = median(S.content.filter((c) => c._age >= 2 && c._age <= 60).map((c) => c.views));
  const t = Object.entries(g).filter(([, l]) => l.length >= 3).map(([n, l]) => ({ n, m: median(l), jml: l.length })).sort((a, b) => b.m - a.m)[0];
  return t && semua && t.m >= semua * 1.2 ? t : null;
}

function kartu(s, i) {
  return `<section class="card sr">
    <div class="sr-k"><span class="sr-n">${i + 1}</span><span class="sr-d">${esc(s.dasar)}</span></div>
    <h2>${esc(s.masalah)}</h2>
    <p class="muted">${esc(s.sebab)}</p>
    <h3>Solusi</h3>
    <ul>${s.solusi.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <h3>Produk</h3>
    <div class="sr-p">${s.produk.map((p) => `<a class="chip" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.kata)}</a>`).join('')}</div>
    <h3>Judul</h3>
    ${s.judul.map((j) => `<button class="sr-j" data-act="saran-judul" data-v="${esc(j)}">${esc(j)}<span class="sr-c">Salin</span></button>`).join('')}
    <div class="tools mt-12"><button class="btn sm primary" data-act="saran-tautan" data-v="${esc(s.produk[0].kata)}">Buat tautan</button></div>
  </section>`;
}

function isi() {
  if (Z.galat && !Z.data) return `<section class="card"><div class="empty">${esc(Z.galat)}</div><div class="tools"><button class="btn sm" data-act="saran-muat">Coba lagi</button></div></section>`;
  if (!Z.data) return '<div class="skeleton" style="height:220px"></div><div class="skeleton" style="height:220px"></div>';
  const c = Z.data.cuaca, t = topikKuat();
  return `<section class="card sr-cuaca">
      <div class="sr-lok">${esc(Z.data.lokasi)}</div>
      <div class="sr-stat"><div><b>${nf.format(c.hujanLalu)}</b><span>mm minggu lalu</span></div><div><b>${nf.format(c.hujanDepan)}</b><span>mm 7 hari ke depan</span></div><div><b>${c.hariHujanDepan}/7</b><span>hari hujan</span></div><div><b>${c.lembap}%</b><span>lembap</span></div></div>
    </section>
    ${t ? `<section class="card sr-topik"><h3>Topik terkuat di channel</h3><b>${esc(t.n)}</b> <span class="muted">median ${fmt(t.m)} views · ${t.jml} video, 60 hari</span></section>` : ''}
    ${Z.data.saran.map(kartu).join('')}
    <section class="card sr-alur"><h3>Alur video</h3><ol><li>Masalah: tunjukkan gejalanya di 5 detik pertama</li><li>Penyebab singkat</li><li>Langkah solusi</li><li>Produk yang dipakai, tautan di deskripsi</li><li>Tag produk di YouTube Studio (Earn → Shopping)</li></ol>
      <p class="muted">Ikuti dosis dan izin edar di label produk.</p></section>`;
}

PAGES.saran = () => `<header class="head"><h1>Saran</h1></header><div id="saran-isi" class="stack-page">${isi()}</div>`;

export async function muatSaran() {
  if (Z.memuat) return;
  Z.memuat = true;
  try { Z.data = await api('/api/saran', { timeout: 30000 }); Z.galat = null; } catch (e) { Z.galat = e.message; }
  Z.memuat = false;
  const el = $('#saran-isi');
  if (el) el.innerHTML = isi();
}

AFTER.saran = () => { if (!Z.data || Date.now() - new Date(Z.data.dihitung).getTime() > 3 * 3600 * 1000) muatSaran(); };

export async function salinJudul(v) {
  try { await navigator.clipboard.writeText(v); toast('Disalin'); } catch (e) { toast(v, true); }
}
