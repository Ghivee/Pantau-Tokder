import { api } from '../core/data.js';
import { kataLaris, topikTerakhir } from '../core/tren-data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { fmt, nf, tglPendek } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { kali } from './shared.js';

// Saran untuk tim produksi, per channel, dari data nyata: topik dan kata judul yang laris di channel itu, komentar penonton,
// video populer di channel ini dan di channel lain. Kebutuhan affiliate (produk, tautan) ada di menu Tautan.
const Z = (S.saranData = { data: null, galat: null, memuat: false, ch: null, komentar: null });

const pendek = (n) => String(n).replace(/\s+Hari Ini$/i, '');
const warna = (id) => { const i = Z.data ? Z.data.channels.findIndex((c) => c.id === id) : -1; return i >= 0 && i < 3 ? `var(--ch-${i + 1})` : 'var(--muted)'; };
const pilihan = () => Z.data.channels.find((c) => c.id === Z.ch) || Z.data.channels[0];
const nf0 = (n) => nf.format(n);

// Satu baris video: judul (membuka videonya), keterangan kecil, dan views di kanan.
const rowVideo = (judul, url, sub, views) => `<a class="sr-ct" href="${esc(url)}" target="_blank" rel="noopener"><span>${esc(judul)}${sub ? `<span class="muted"> · ${esc(sub)}</span>` : ''}</span><b>${fmt(views)}</b></a>`;

// Topik 14 hari terakhir: views dibanding video lain di periode yang sama, lalu dibanding 15-60 hari sebelumnya.
function kartuTopik(c) {
  const t = topikTerakhir(S.content.filter((v) => v._ch === c.id));
  return `<section class="card">
      <div class="card-h"><h2>Topik 14 hari terakhir</h2><span class="muted">${esc(pendek(c.nama))}</span></div>
      ${t.length ? t.slice(0, 6).map((x) => {
        const up = x.b == null ? null : x.r - x.b;
        const cls = x.r >= 1.2 ? 'ok' : x.r < 0.8 ? 'bad' : '';
        const arah = up == null ? ['baru', ''] : up >= 0.25 ? ['naik', 'ok'] : up <= -0.25 ? ['turun', 'bad'] : ['stabil', ''];
        return `<div class="tp-row"><div class="tp-h"><b>${esc(x.t)}</b><span class="tp-x ${cls}">${kali(x.r)} <span class="pill ${arah[1]}">${arah[0]}</span></span></div>
          <span class="muted tp-s">${x.n} video${x.b != null ? ' · sebelumnya ' + kali(x.b) : ''} · terbaik: ${esc(x.best.judul)}</span></div>`; }).join('')
        : '<p class="muted">Belum cukup video: butuh minimal 2 video per topik yang berumur 2–16 hari.</p>'}
    </section>`;
}

// Kata di judul yang muncul di 3 video atau lebih dalam 30 hari: median views dibanding video lain di channel itu.
function kartuKata(c) {
  const { kuat, lemah } = kataLaris(S.content.filter((v) => v._ch === c.id));
  return `<section class="card">
      <div class="card-h"><h2>Kata judul laris</h2><span class="muted">${esc(pendek(c.nama))}</span></div>
      ${kuat.length || lemah.length ? `<div class="sr-kata">${kuat.map((x) => `<span class="pill ok" title="${x.n} video">${esc(x.k)} ${kali(x.r)}</span>`).join('')}${lemah.map((x) => `<span class="pill bad" title="${x.n} video">${esc(x.k)} ${kali(x.r)}</span>`).join('')}</div>
        <p class="sr-ket">Hijau: judul dengan kata ini lebih ramai. Merah: lebih sepi. Angka: median views dibanding video lain.</p>`
        : '<p class="muted">Belum ada pola yang jelas. Butuh lebih banyak video dalam 30 hari terakhir.</p>'}
    </section>`;
}

// Komentar penonton channel ini, dikelompokkan per topik pertanyaan; ketuk untuk menyalin contohnya sebagai bahan judul.
function kartuKomentar(c) {
  const K = Z.komentar;
  const k = K && K.tersedia && K.channels.find((x) => x.id === c.id);
  if (!k || k.galat) return '';
  return `<section class="card">
      <div class="card-h"><h2>Komentar</h2><span class="muted">${nf0(k.dipindai)} komentar terbaru</span></div>
      ${k.topik.length ? k.topik.map((t) => `<button class="sr-q" data-act="saran-judul" data-v="${esc(t.contoh[0])}"><span class="sr-qh"><b>${esc(t.topik)}</b><span class="muted">${t.n} pertanyaan</span></span><span class="sr-qc">${esc(t.contoh[0])}</span></button>`).join('') : '<p class="muted">Belum ada pertanyaan yang jelas.</p>'}
    </section>`;
}

// Video terlaris channel ini dalam 90 hari terakhir.
function kartuPopulerIni(c) {
  const top = S.content.filter((v) => v._ch === c.id && v._age <= 90).sort((a, b) => b.views - a.views).slice(0, 5);
  return `<section class="card">
      <div class="card-h"><h2>Populer channel ini</h2><span class="muted">90 hari terakhir</span></div>
      ${top.length ? top.map((v) => rowVideo(v.judul, v.url || 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.post_id), tglPendek(v._day), v.views)).join('') : '<p class="muted">Belum ada video di periode ini.</p>'}
    </section>`;
}

// Video terlaris di YouTube untuk kata kunci channel ini, dari channel lain, setahun terakhir. Butuh YOUTUBE_API_KEY.
function kartuPopulerLain(c) {
  const d = c.youtube && c.youtube.daftar;
  if (!d || !d.length) return '';
  return `<section class="card">
      <div class="card-h"><h2>Populer channel lain</h2><span class="muted">YouTube, setahun terakhir</span></div>
      ${d.slice(0, 5).map((v) => rowVideo(v.judul, 'https://www.youtube.com/watch?v=' + encodeURIComponent(v.id), v.channel, v.views)).join('')}
    </section>`;
}

function isi() {
  if (Z.galat && !Z.data) return `<section class="card"><div class="empty">${esc(Z.galat)}</div><div class="tools"><button class="btn sm" data-act="saran-muat">Coba lagi</button></div></section>`;
  if (!Z.data) return '<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:240px"></div>';
  const d = Z.data, c = pilihan();
  return `
    <div class="seg scroll" role="group" aria-label="Channel">${d.channels.map((x) => `<button data-act="saran-ch" data-v="${esc(x.id)}" aria-pressed="${x.id === c.id}"><i class="dot" style="background:${warna(x.id)}"></i>${esc(pendek(x.nama))}</button>`).join('')}</div>
    ${kartuTopik(c)}
    ${kartuKata(c)}
    ${kartuKomentar(c)}
    ${kartuPopulerIni(c)}
    ${kartuPopulerLain(c)}`;
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
