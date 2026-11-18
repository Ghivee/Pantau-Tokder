import { analyticsChannels, api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S, bisa, lihatUang } from '../core/state.js';
import { daysBack } from '../core/stats.js';
import { $, esc } from '../lib/dom.js';
import { WIB, addDays, fmt, nf, signed, sum, tglPanjang, tglPendek, today } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { drawLines } from '../ui/charts.js';
import { closeOverlay, confirmDialog, openDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';

// Rekap 3 channel, sepenuhnya otomatis: views dan retensi dari YouTube Analytics, CTR dari YouTube Reporting API,
// real-time dari bacaan total tayangan tiap menit, klik dari pelacak tautan.


const R = (S.rekap = { metrik: null, klikTautan: [], tautan: null, snap: [], galatMetrik: null, galatRt: null, metrikPilih: 'views' });
const persen = (v) => (v == null ? '—' : nf.format(Math.round(v * 10) / 10) + '%');
// Warna mengikuti channel (urutan tetap), bukan peringkat nilainya; tiga warna ini sudah divalidasi (lihat pages.css).
const chColor = (id) => { const i = analyticsChannels().findIndex((c) => c.id === id); return i >= 0 && i < 3 ? `var(--ch-${i + 1})` : 'var(--muted)'; };
const dot = (id) => `<i class="dot" style="background:${chColor(id)}"></i>`;
const nama = (c) => `<span class="ed">${dot(c.id)}${esc(c.nama)}</span>`;

const METRIK = [
  ['views', 'Views'], ['ctr', 'CTR'], ['retensi', 'Retensi'], ['realtime', 'Real-time'], ['klik', 'Klik'],
];

// ---------- hitungan ----------

function periode() {
  const latest = S.daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
  const end = latest || addDays(today(), -2);
  const days = daysBack(S.anPeriode, end);
  return { latest, end, days, prev: daysBack(S.anPeriode, addDays(days[0], -1)) };
}

const metrikRows = (id, days) => ((R.metrik || []).filter((m) => m.channel_id === id && days.includes(m.tanggal)));

// CTR periode: ditimbang impresi bila ada, kalau tidak rata-rata biasa. null bila tidak ada angka.
function ctrOf(id, days) {
  const r = metrikRows(id, days).filter((m) => m.ctr != null);
  if (!r.length) return null;
  const imp = sum(r, (m) => m.impresi || 0);
  return imp > 0 ? sum(r, (m) => (m.impresi ? m.ctr * m.impresi : 0)) / sum(r.filter((m) => m.impresi), (m) => m.impresi) : sum(r, (m) => m.ctr) / r.length;
}

// Klik afiliasi per hari: hanya dari pelacak tautan (otomatis). Angka dari impor CSV lama tidak ditampilkan.
function klikHari(id, tanggal) {
  const t = R.klikTautan.find((k) => k.channel_id === id && k.tanggal === tanggal);
  return t ? t.jumlah : null;
}

function klikOf(id, days) { const v = days.map((d) => klikHari(id, d)).filter((x) => x != null); return v.length ? sum(v) : null; }

// Persentase penonton yang masih menonton di pertengahan video, rata-rata video channel ini yang tayang di periode.
function retensiVideos(id, days) {
  const map = S.insight && S.insight.retMap;
  if (!map) return [];
  return S.content.filter((c) => c._ch === id && days.includes(c._day) && map.has(c.id));
}

function retensiOf(id, days) {
  const v = retensiVideos(id, days);
  return v.length ? { tengah: sum(v, (c) => S.insight.retMap.get(c.id).tengah) / v.length, n: v.length } : null;
}

// Tayangan naik dalam `ms` terakhir dari bacaan tersimpan. Memakai bacaan terakhir sebelum jendela
// (atau bacaan tertua bila belum ada); `menit` = rentang yang benar-benar tercakup.
function naikRealtime(id, ms) {
  const s = R.snap.filter((x) => x.channel_id === id);
  if (s.length < 2) return null;
  const last = s[s.length - 1], t1 = new Date(last.waktu).getTime();
  const awal = [...s].reverse().find((x) => new Date(x.waktu).getTime() <= t1 - ms) || s[0];
  const menit = Math.round((t1 - new Date(awal.waktu).getTime()) / 60000);
  if (menit < 3) return null;
  return { naik: Math.max(0, last.views - awal.views), menit };
}

const totalViews = (id) => { const s = R.snap.filter((x) => x.channel_id === id); return s.length ? s[s.length - 1].views : null; };

// ---------- isi halaman ----------

function seriesFor(chans, p) {
  const warna = (c) => ({ name: c.nama, color: chColor(c.id) });
  const m = R.metrikPilih;
  if (m === 'realtime') {
    // Tayangan per jam (WIB) selama 48 jam terakhir: selisih antar bacaan terakhir tiap jam.
    const jam = (t) => Math.floor((new Date(t).getTime() + WIB) / 3600000);
    const now = jam(new Date().toISOString());
    const hs = Array.from({ length: 48 }, (_, i) => now - 47 + i);
    const labels = hs.map((h) => String(h % 24).padStart(2, '0') + ':00');
    const titles = hs.map((h) => tglPendek(new Date(h * 3600000).toISOString().slice(0, 10)) + ', jam ' + String(h % 24).padStart(2, '0') + ':00 WIB');
    return {
      labels, titles, fmtY: fmt, label: 'Tayangan per jam, 48 jam terakhir',
      series: chans.map((c) => {
        const last = {};
        R.snap.filter((x) => x.channel_id === c.id).forEach((x) => { last[jam(x.waktu)] = x.views; });
        return { ...warna(c), values: hs.map((h) => (last[h] != null && last[h - 1] != null ? Math.max(0, last[h] - last[h - 1]) : null)) };
      }),
    };
  }
  const labels = p.days.map(tglPendek), titles = p.days.map(tglPanjang);
  if (m === 'views') return { labels, titles, fmtY: fmt, label: 'Views harian', series: chans.map((c) => ({ ...warna(c), values: p.days.map((d) => { const r = S.daily.find((x) => x.channel_id === c.id && x.tanggal === d); return r ? r.views : null; }) })) };
  if (m === 'ctr') return { labels, titles, fmtY: persen, label: 'CTR harian', series: chans.map((c) => ({ ...warna(c), values: p.days.map((d) => { const r = (R.metrik || []).find((x) => x.channel_id === c.id && x.tanggal === d); return r && r.ctr != null ? r.ctr : null; }) })) };
  if (m === 'klik') return { labels, titles, fmtY: fmt, label: 'Klik afiliasi harian', series: chans.map((c) => ({ ...warna(c), values: p.days.map((d) => klikHari(c.id, d)) })) };
  // Retensi: rata-rata video yang tayang di hari itu; hari tanpa video berkurva retensi dikosongkan.
  return { labels, titles, fmtY: persen, label: 'Retensi di tengah video, menurut hari tayang', series: chans.map((c) => ({ ...warna(c), values: p.days.map((d) => { const v = retensiVideos(c.id, [d]); return v.length ? sum(v, (x) => S.insight.retMap.get(x.id).tengah) / v.length : null; }) })) };
}


// ---------- tampilan ----------

// Satu kartu per angka; di dalamnya satu baris per channel: nama, nilai, dan batang tipis pada skala yang sama.
// Nilai tertinggi ditebalkan. Warna batang mengikuti channel.
function kartuAngka(judul, baris, val, f, { max, delta } = {}) {
  const v = baris.map(val), ada = v.filter((x) => x != null);
  const skala = max || Math.max(...ada, 0), top = ada.length > 1 ? Math.max(...ada) : null;
  return `<section class="card met"><h2>${judul}</h2>${baris.map((b, i) => `
    <div class="mrow"><span class="nm">${dot(b.c.id)}${esc(b.c.nama)}</span>
      <span class="vl"><b class="v${v[i] != null && v[i] === top ? ' top' : ''}">${v[i] == null ? '<span class="muted">—</span>' : f(v[i])}</b>${delta && v[i] != null ? delta(b) : ''}</span>
      <span class="bar">${v[i] == null || skala <= 0 ? '' : `<i style="width:${Math.max(2, (v[i] / skala) * 100)}%;background:${chColor(b.c.id)}"></i>`}</span></div>`).join('')}</section>`;
}

function isi() {
  const chans = analyticsChannels();
  const p = periode();
  const sel = (id, ds) => S.daily.filter((d) => d.channel_id === id && ds.includes(d.tanggal));
  const views = (id, ds) => { const r = sel(id, ds); return r.length ? sum(r, (d) => d.views) : null; };
  const uang = (id, ds) => { const r = sel(id, ds).filter((d) => d.revenue != null); return r.length ? sum(r, (d) => d.revenue) : null; };
  const baris = chans.map((c) => ({ c, uang: uang(c.id, p.days), v: views(c.id, p.days), vp: views(c.id, p.prev), ctr: ctrOf(c.id, p.days), ret: retensiOf(c.id, p.days), jam: naikRealtime(c.id, 3600000), klik: klikOf(c.id, p.days) }));
  const delta = (b) => (b.v == null || !b.vp ? '' : `<span class="dl ${b.v >= b.vp ? 'ok' : 'bad'}">${signed(Math.round(((b.v - b.vp) / b.vp) * 100), (x) => nf.format(x) + '%')}</span>`);
  const sd = seriesFor(chans, p);
  const adaData = sd.series.some((s) => s.values.some((v) => v != null));
  const belum = chans.filter((c) => !c.connected);
  return `
    ${belum.length ? `<div class="notice" role="status"><span>${belum.map((c) => esc(c.nama)).join(', ')} belum tersambung.</span></div>` : ''}
    ${R.galatRt ? `<div class="notice" role="status"><span>Real-time: ${esc(R.galatRt)}</span></div>` : ''}
    <div class="met-grid">
      ${kartuAngka('Views', baris, (b) => b.v, fmt, { delta })}
      ${lihatUang() ? kartuAngka('Penghasilan', baris, (b) => b.uang, (v) => 'Rp ' + fmt(v)) : ''}
      ${kartuAngka('CTR', baris, (b) => b.ctr, persen)}
      ${kartuAngka('Retensi', baris, (b) => (b.ret ? b.ret.tengah : null), persen, { max: 100 })}
      ${kartuAngka('Real-time · per jam', baris, (b) => (b.jam ? b.jam.naik : null), (v) => '+' + fmt(v))}
      ${kartuAngka('Klik', baris, (b) => b.klik, fmt)}
    </div>
    <section class="card" id="kartu-banding">
      <div class="seg scroll" role="group" aria-label="Angka">${METRIK.map(([k, l]) => `<button data-act="rekap-metrik" data-v="${k}" aria-pressed="${R.metrikPilih === k}">${l}</button>`).join('')}</div>
      <div class="chart-legend mt-12">${chans.map((c) => `<span>${dot(c.id)}${esc(c.nama)}</span>`).join('')}</div>
      ${adaData ? '<div class="chart minh-230" id="rekap-chart"></div>' : '<div class="empty">Belum ada data</div>'}
    </section>`;
}

const urlTautan = (kode) => location.origin + '/go/' + kode;

function tautanKartu(chans) {
  const L = R.tautan;
  return `<section class="card" id="kartu-tautan">
      <div class="card-h"><h2>Tautan</h2>${bisa('tautan') ? `<button class="btn sm" data-act="tautan-baru" aria-label="Tautan baru">${icon('plus')}Baru</button>` : ''}</div>
      ${L == null ? '<div class="empty">…</div>' : L.length ? `<div class="tl-list">${L.map((t) => `
        <div class="tl-row"><div class="tl-t"><b>${esc(t.label)}</b><span class="muted mono">${esc(urlTautan(t.kode).replace(/^https?:\/\//, ''))}</span>
          <span class="muted">${esc((chans.find((c) => c.id === t.channel_id) || {}).nama || '')}</span></div>
          <div class="tl-n"><b>${nf.format(t.tujuh_hari)}</b><span class="muted">7 hari</span></div>
          <div class="tl-a"><button class="btn sm ghost" data-act="tautan-salin" data-kode="${esc(t.kode)}">Salin</button>${bisa('hapus') ? `<button class="btn sm ghost danger" data-act="tautan-hapus" data-kode="${esc(t.kode)}">Hapus</button>` : ''}</div></div>`).join('')}</div>` : '<div class="empty">Belum ada tautan</div>'}
    </section>`;
}

PAGES.rekap = function () {
  return `<header class="head"><h1>Rekap</h1>
      <div class="seg" role="group" aria-label="Periode">${[7, 28, 90].map((x) => `<button data-act="an-periode" data-v="${x}" aria-pressed="${S.anPeriode === x}">${x} hari</button>`).join('')}</div></header>
    <div id="rekap-isi" class="stack-page">${isi()}</div>
    <div id="rekap-tautan">${tautanKartu(analyticsChannels())}</div>`;
};

function gambar() {
  const box = $('#rekap-chart');
  if (!box) return;
  drawLines(box, seriesFor(analyticsChannels(), periode()));
}

// Kartu tautan di luar #rekap-isi: pembaruan tiap menit tidak boleh mengganggu dialog atau isian.
function segarkanTautan() {
  const el = $('#rekap-tautan');
  if (el && route() === 'rekap') el.innerHTML = tautanKartu(analyticsChannels());
}

export function segarkanRekap() {
  const el = $('#rekap-isi');
  if (!el || route() !== 'rekap' || $('#overlay').innerHTML) return;
  el.innerHTML = isi();
  gambar();
}

let timer = null;

async function muatMetrik() {
  try { const r = await api('/api/rekap?hari=366'); R.metrik = r.metrik; R.klikTautan = r.klik_tautan || []; R.galatMetrik = null; } catch (e) { R.galatMetrik = e.message; if (!R.metrik) R.metrik = []; }
  try { R.tautan = (await api('/api/rekap/tautan')).tautan; } catch (e) { if (!R.tautan) R.tautan = []; }
}

export function tautanDialog(label = '') {
  const chans = analyticsChannels();
  openDialog(`<h2>Tautan baru</h2>
      <div class="stack">
        <label class="field"><span>Nama</span><input class="input" id="tl-label" maxlength="80" autocomplete="off" value="${esc(label)}"></label>
        <label class="field"><span>Channel</span><select class="input" id="tl-ch">${chans.map((c) => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
        <label class="field"><span>Tautan afiliasi</span><input class="input" id="tl-tujuan" inputmode="url" placeholder="https://" autocomplete="off" autocapitalize="off"></label>
      </div>
      <div class="err" id="tl-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" data-act="tautan-buat">Buat</button></div>`);
}

export async function buatTautan() {
  const v = (id) => $(id).value.trim(), err = $('#tl-err');
  err.textContent = '';
  try {
    const t = await api('/api/rekap/tautan', { method: 'POST', body: { label: v('#tl-label'), channel_id: $('#tl-ch').value, tujuan: v('#tl-tujuan') } });
    R.tautan = [t, ...(R.tautan || [])];
    closeOverlay();
    segarkanTautan();
    try { await navigator.clipboard.writeText(urlTautan(t.kode)); toast('Disalin'); } catch (e) { toast('Tautan dibuat'); }
  } catch (e) { err.textContent = e.message; }
}

export async function salinTautan(kode) {
  try { await navigator.clipboard.writeText(urlTautan(kode)); toast('Disalin'); } catch (e) { toast(urlTautan(kode), true); }
}

export function hapusTautan(kode) {
  const t = (R.tautan || []).find((x) => x.kode === kode);
  if (!t) return;
  confirmDialog('Hapus tautan?', `${t.label}. Tautan di deskripsi video berhenti bekerja.`, 'Hapus', async () => {
    try { await api('/api/rekap/tautan/' + encodeURIComponent(kode), { method: 'DELETE' }); R.tautan = R.tautan.filter((x) => x.kode !== kode); await muatMetrik(); segarkanTautan(); segarkanRekap(); } catch (e) { toast(e.message, true); }
  });
}

async function bacaRealtime() {
  try { const r = await api('/api/rekap/realtime', { method: 'POST', timeout: 30000 }); R.snap = r.snap; R.galatRt = null; } catch (e) { R.galatRt = e.message; }
  segarkanRekap();
}

function mulaiRealtime() {
  clearInterval(timer);
  bacaRealtime();
  timer = setInterval(() => {
    if (route() !== 'rekap') { clearInterval(timer); timer = null; return; }
    if (document.visibilityState === 'visible') bacaRealtime();
  }, 60000);
}

AFTER.rekap = function () {
  gambar();
  if (R.metrik == null) muatMetrik().then(() => { segarkanRekap(); segarkanTautan(); });
  if (!timer) mulaiRealtime();
};

export const pilihMetrik = (v) => { R.metrikPilih = v; segarkanRekap(); };
