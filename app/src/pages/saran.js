import { api } from '../core/data.js';
import { kataLaris, topikTerakhir } from '../core/tren-data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S, bisa } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { fmt, idr, nf, tglPendek } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { kali } from './shared.js';

// Saran untuk tim produksi: apa yang laku (produk affiliate dan topik), apa yang bekerja di judul tiap channel,
// dan apa yang ditanyakan penonton. Semuanya dari data nyata; tidak ada tebakan.
const Z = (S.saranData = { data: null, galat: null, memuat: false, ch: null, komentar: null, af: null, afHari: 30, afGalat: null });

const pendek = (n) => String(n).replace(/\s+Hari Ini$/i, '');
const warna = (id) => { const i = Z.data ? Z.data.channels.findIndex((c) => c.id === id) : -1; return i >= 0 && i < 3 ? `var(--ch-${i + 1})` : 'var(--muted)'; };
const pilihan = () => Z.data.channels.find((c) => c.id === Z.ch) || Z.data.channels[0];
const rowContoh = (j, sub) => `<div class="sr-ct"><span>${esc(j.judul)}${sub ? `<span class="muted"> · ${esc(sub)}</span>` : ''}</span><b>${fmt(j.views)}</b></div>`;
const nf0 = (n) => nf.format(n);

// Produk affiliate terlaris menurut komisi (rupiah) di periode terpilih, dibanding periode sebelumnya yang sama panjang.
// Tanpa izin penghasilan hanya urutan dan arah tren yang tampil, tanpa nominal.
const TREN = { naik: ['naik', 'ok'], turun: ['turun', 'bad'], stabil: ['stabil', ''], baru: ['baru', 'leaf'] };

function kartuAfiliasi() {
  const A = Z.af;
  if (!A) return Z.afGalat ? `<section class="card"><div class="empty">${esc(Z.afGalat)}</div></section>` : '<div class="skeleton" style="height:120px"></div>';
  const punyaUang = !!A.uang;
  if (!A.ada_data && !punyaUang) return '';
  const seg = `<div class="seg" role="group" aria-label="Periode">${[7, 30, 90].map((n) => `<button data-act="af-hari" data-v="${n}" aria-pressed="${A.hari === n}">${n} hari</button>`).join('')}</div>`;
  const impor = punyaUang ? `<button class="btn sm" data-act="af-impor">Impor laporan</button>` : '';
  const baris = A.terlaris.map((x) => { const [t, c] = TREN[x.tren]; return `
      <div class="af-row"><span class="af-n">${x.peringkat}</span>
        <span class="af-p"><span class="af-nm">${esc(x.produk)}</span><span class="muted"><span class="pill ${c}">${t}</span>${punyaUang ? ` ${nf0(x.pesanan)} pesanan${x.tren === 'baru' ? '' : ` · sebelumnya ${idr(x.komisi_sebelum)}`}` : ''}</span></span>
        <span class="af-r">${punyaUang ? `<b>${idr(x.komisi)}</b>` : ''}${bisa('tautan') ? `<button class="lnk" data-act="saran-tautan" data-v="${esc(x.produk.slice(0, 80))}">Tautan</button>` : ''}</span></div>`; }).join('');
  return `<section class="card">
      <div class="card-h"><h2>Produk affiliate terlaris</h2>${impor}</div>
      ${seg}
      ${A.terlaris.length ? `<div class="af-list mt-12">${baris}</div>${punyaUang ? `<p class="sr-ket">Total komisi ${A.hari} hari: <b>${idr(A.total)}</b>${A.total_sebelum ? ` · sebelumnya ${idr(A.total_sebelum)}` : ''}${A.data_sampai ? ` · data sampai ${tglPendek(A.data_sampai)}` : ''}</p>` : ''}`
        : `<p class="muted mt-12">Belum ada penjualan dalam ${A.hari} hari terakhir.</p>`}
    </section>`;
}

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

function cirikhas(c) {
  const g = c.gaya;
  if (!g.n) return '<p class="muted">Belum ada video di channel ini.</p>';
  if (!g.cukup) return `<p class="muted">Baru ${g.n} video. Ciri khas muncul setelah 8 video yang sudah berumur 3 hari.</p>`;
  const ciri = [...g.ciri, `Judul ±${g.panjang} huruf`, ...(g.short >= 50 ? ['Banyak Shorts'] : [])];
  return `<div class="sr-kata">${ciri.map((x) => `<span class="chip tetap">${esc(x)}</span>`).join('')}</div>`;
}

function isi() {
  if (Z.galat && !Z.data) return `${kartuAfiliasi()}<section class="card"><div class="empty">${esc(Z.galat)}</div><div class="tools"><button class="btn sm" data-act="saran-muat">Coba lagi</button></div></section>`;
  if (!Z.data) return `${kartuAfiliasi()}<div class="skeleton" style="height:120px"></div><div class="skeleton" style="height:240px"></div>`;
  const d = Z.data, c = pilihan();
  return `
    ${kartuAfiliasi()}
    <div class="seg scroll" role="group" aria-label="Channel">${d.channels.map((x) => `<button data-act="saran-ch" data-v="${esc(x.id)}" aria-pressed="${x.id === c.id}"><i class="dot" style="background:${warna(x.id)}"></i>${esc(pendek(x.nama))}</button>`).join('')}</div>
    ${c.galat ? `<section class="card"><div class="empty">${esc(c.galat)}</div></section>` : ''}
    ${kartuTopik(c)}
    ${kartuKata(c)}
    <section class="card">
      <div class="card-h"><h2>Ciri khas</h2><span class="muted">${c.gaya.n} video</span></div>
      ${cirikhas(c)}
    </section>
    ${kartuKomentar(c)}
    ${c.produk.length ? `<section class="card">
      <div class="card-h"><h2>Produk dicari</h2></div>
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

export async function muatAfiliasi(hari = Z.afHari) {
  Z.afHari = hari;
  try { Z.af = await api('/api/afiliasi?hari=' + hari, { timeout: 30000 }); Z.afGalat = null; } catch (e) { Z.afGalat = e.message; }
  tampil();
}

async function muatKomentar() {
  try { Z.komentar = await api('/api/komentar', { timeout: 60000 }); } catch (e) { Z.komentar = { tersedia: false, channels: [] }; }
  tampil();
}

AFTER.saran = () => {
  if (!Z.data || Date.now() - new Date(Z.data.dihitung).getTime() > 3 * 3600 * 1000) muatSaran();
  if (!Z.af) muatAfiliasi();
  if (!Z.komentar) muatKomentar();
};

export const pilihChannel = (id) => { Z.ch = id; tampil(); };

export async function salin(teks, pesan = 'Disalin') {
  try { await navigator.clipboard.writeText(teks); toast(pesan); } catch (e) { toast(teks, true); }
}
