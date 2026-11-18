import { analyticsChannels, api, chColor, jamMenit } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { daysBack } from '../core/stats.js';
import { $, esc } from '../lib/dom.js';
import { angkaUang, bacaCsv } from '../lib/csv.js';
import { WIB, addDays, durasi, fmt, nf, signed, sum, tglPanjang, tglPendek, today } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { drawLines } from '../ui/charts.js';
import { closeOverlay, openDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

// Rekap 3 channel: views, CTR, retensi, real-time dan klik afiliasi per channel, plus satu diagram pembanding.
// Views dan retensi dari YouTube Analytics; real-time dari bacaan total tayangan tiap menit; CTR dan klik afiliasi
// diimpor dari CSV karena YouTube Analytics API tidak menyediakan CTR dan afiliasi tidak punya API.

const R = (S.rekap = { metrik: null, snap: [], galatMetrik: null, galatRt: null, metrikPilih: 'views' });
const persen = (v) => (v == null ? '—' : nf.format(Math.round(v * 10) / 10) + '%');
const dot = (id) => `<i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(id)}"></i>`;
const nama = (c) => `<span class="ed">${dot(c.id)}${esc(c.nama)}</span>`;

const METRIK = [
  ['views', 'Views'], ['ctr', 'CTR'], ['retensi', 'Retensi'], ['realtime', 'Real-time'], ['klik', 'Klik afiliasi'],
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

const klikOf = (id, days) => { const r = metrikRows(id, days).filter((m) => m.klik_afiliasi != null); return r.length ? sum(r, (m) => m.klik_afiliasi) : null; };

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
  if (m === 'klik') return { labels, titles, fmtY: fmt, label: 'Klik afiliasi harian', series: chans.map((c) => ({ ...warna(c), values: p.days.map((d) => { const r = (R.metrik || []).find((x) => x.channel_id === c.id && x.tanggal === d); return r && r.klik_afiliasi != null ? r.klik_afiliasi : null; }) })) };
  // Retensi: rata-rata video yang tayang di hari itu; hari tanpa video berkurva retensi dikosongkan.
  return { labels, titles, fmtY: persen, label: 'Retensi di tengah video, menurut hari tayang', series: chans.map((c) => ({ ...warna(c), values: p.days.map((d) => { const v = retensiVideos(c.id, [d]); return v.length ? sum(v, (x) => S.insight.retMap.get(x.id).tengah) / v.length : null; }) })) };
}

const kosongDiagram = {
  views: 'Belum ada angka views dari YouTube Analytics. Hubungkan channel di Pengaturan.',
  ctr: 'Belum ada data CTR. Klik Impor CSV, pilih CTR, lalu pilih file ekspor YouTube Studio.',
  klik: 'Belum ada data klik afiliasi. Klik Impor CSV, pilih Klik afiliasi, lalu pilih file laporan klik.',
  retensi: 'Belum ada kurva retensi untuk video di periode ini.',
  realtime: 'Bacaan real-time baru mulai terkumpul. Biarkan halaman ini terbuka beberapa menit.',
};

function isi() {
  const chans = analyticsChannels();
  const p = periode();
  const sel = (ids, ds) => S.daily.filter((d) => ids.includes(d.channel_id) && ds.includes(d.tanggal));
  const views = (id, ds) => { const r = sel([id], ds); return r.length ? sum(r, (d) => d.views) : null; };
  const baris = chans.map((c) => {
    const v = views(c.id, p.days), vp = views(c.id, p.prev);
    const t = sel([c.id], p.days);
    const dur = t.length && sum(t, (d) => d.views) ? Math.round((sum(t, (d) => d.menit_tonton) * 60) / sum(t, (d) => d.views)) : null;
    return { c, v, vp, dur, ctr: ctrOf(c.id, p.days), ret: retensiOf(c.id, p.days), jam: naikRealtime(c.id, 3600000), hari: naikRealtime(c.id, 86400000), klik: klikOf(c.id, p.days), total: totalViews(c.id) };
  });
  const belum = (txt) => `<span class="muted">${txt}</span>`;
  const ubah = (a, b) => (a == null || !b ? '' : `<div class="sub ${a >= b ? 'ok' : 'bad'}">${signed(Math.round(((a - b) / b) * 100), (x) => nf.format(x) + '%')} vs ${S.anPeriode} hari sebelumnya</div>`);
  const sd = seriesFor(chans, p);
  const adaData = sd.series.some((s) => s.values.some((v) => v != null));
  const tombolImpor = `<button class="btn sm" data-act="rekap-impor">${icon('plus')}Impor CSV</button>`;
  return `
    ${R.galatRt ? `<div class="notice" role="status"><span><b>Real-time belum terbaca.</b> ${esc(R.galatRt)}</span></div>` : ''}
    ${R.galatMetrik ? `<div class="notice" role="status"><span><b>CTR dan klik afiliasi belum termuat.</b> ${esc(R.galatMetrik)}</span></div>` : ''}
    <section class="card">
      <div class="card-h"><h2>Rekap ${S.anPeriode} hari</h2><p>${p.latest ? 'Views dan retensi sampai ' + tglPanjang(p.latest) + ' (YouTube terlambat 2–3 hari). ' : ''}Real-time dan klik afiliasi mengikuti bacaan terbaru.</p></div>
      <div class="table-wrap"><table class="t stack"><thead><tr><th>Channel</th><th class="num">Views</th><th class="num">CTR</th><th class="num">Retensi</th><th class="num">Real-time</th><th class="num">Klik afiliasi</th></tr></thead><tbody>
      ${baris.map((b) => `<tr>
        <td class="full"><b>${nama(b.c)}</b>${b.c.connected ? '' : ' <span class="pill warn">belum tersambung</span>'}</td>
        <td class="num" data-label="Views">${b.v == null ? belum('belum ada data') : `<b>${fmt(b.v)}</b>${ubah(b.v, b.vp)}`}</td>
        <td class="num" data-label="CTR">${b.ctr == null ? belum('belum diimpor') : `<b>${persen(b.ctr)}</b>`}</td>
        <td class="num lebar" data-label="Retensi">${b.ret ? `<b>${persen(b.ret.tengah)}</b><div class="sub">bertahan di tengah video · ${b.ret.n} video${b.dur != null ? '<br>' + durasi(b.dur) + ' ditonton per view' : ''}</div>` : belum('belum ada kurva')}</td>
        <td class="num lebar" data-label="Real-time">${b.jam ? `<b>+${fmt(b.jam.naik)}</b><div class="sub">views / ${b.jam.menit} mnt${b.hari && b.hari.menit > b.jam.menit + 30 ? `<br>+${fmt(b.hari.naik)} / ${b.hari.menit >= 1440 ? '24 jam' : jamMenit(b.hari.menit)}` : ''}</div>` : belum(R.galatRt ? 'tidak terbaca' : 'mengumpulkan…')}</td>
        <td class="num" data-label="Klik afiliasi">${b.klik == null ? belum('belum diimpor') : `<b>${fmt(b.klik)}</b>`}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="card" id="kartu-banding">
      <div class="card-h"><h2>Perbandingan 3 channel</h2><div class="tools">${tombolImpor}</div></div>
      <div class="seg mb-12" role="group" aria-label="Angka yang dibandingkan">${METRIK.map(([k, l]) => `<button data-act="rekap-metrik" data-v="${k}" aria-pressed="${R.metrikPilih === k}">${l}</button>`).join('')}</div>
      <div class="chart-legend">${chans.map((c) => `<span><i style="background:${chColor(c.id)}"></i>${esc(c.nama)}</span>`).join('')}</div>
      ${adaData ? '<div class="chart minh-230" id="rekap-chart"></div>' : `<div class="empty"><b>Belum ada data</b>${kosongDiagram[R.metrikPilih]}</div>`}
      <p class="muted fs-125 mt-10">${{ views: 'Views harian semua video di channel.', ctr: 'CTR harian (klik dibanding impresi) dari file YouTube Studio yang diimpor.', retensi: 'Persentase penonton yang masih menonton di tengah video, rata-rata video yang tayang di hari itu.', realtime: 'Tayangan per jam (WIB) dari bacaan total tayangan tiap menit. Hanya terkumpul selama halaman ini terbuka.', klik: 'Klik tautan afiliasi harian dari laporan yang diimpor.' }[R.metrikPilih]}</p>
    </section>`;
}

PAGES.rekap = function () {
  const nConn = analyticsChannels().filter((c) => c.connected).length, n = analyticsChannels().length;
  return `<header class="head"><div><h1>Rekap 3 channel</h1><p><b>${nConn}</b> dari ${n} channel tersambung ke YouTube Analytics.</p></div>
      <div class="tools"><div class="seg" role="group" aria-label="Periode">${[7, 28, 90].map((x) => `<button data-act="an-periode" data-v="${x}" aria-pressed="${S.anPeriode === x}">${x} hari</button>`).join('')}</div>
      <button class="btn sm" data-act="rekap-impor">${icon('plus')}Impor CSV</button></div></header>
    <div id="rekap-isi">${isi()}</div>`;
};

function gambar() {
  const box = $('#rekap-chart');
  if (!box) return;
  const sd = seriesFor(analyticsChannels(), periode());
  drawLines(box, sd);
}

export function segarkanRekap() {
  const el = $('#rekap-isi');
  if (!el || route() !== 'rekap' || $('#overlay').innerHTML) return;
  el.innerHTML = isi();
  gambar();
}

let timer = null;

async function muatMetrik() {
  try { R.metrik = (await api('/api/rekap?hari=366')).metrik; R.galatMetrik = null; } catch (e) { R.galatMetrik = e.message; if (!R.metrik) R.metrik = []; }
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
  if (R.metrik == null) muatMetrik().then(segarkanRekap);
  if (!timer) mulaiRealtime();
};

export const pilihMetrik = (v) => { R.metrikPilih = v; segarkanRekap(); const b = $('#kartu-banding'); if (b) b.scrollIntoView({ block: 'nearest' }); };

// ---------- impor CSV ----------

// "2026-10-21", "21/10/2026", "Oct 21, 2026" → "2026-10-21"
function tglIso(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return ok(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return ok(m[3], m[2], m[1]);
  const d = new Date(s + ' UTC');
  return s && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
}
const ok = (y, mo, d) => { const x = new Date(Date.UTC(+y, +mo - 1, +d)); return x.getUTCMonth() === +mo - 1 && x.getUTCDate() === +d ? x.toISOString().slice(0, 10) : null; };

export function imporRekapDialog() {
  const chans = analyticsChannels();
  openDialog(`<h2>Impor CSV ke Rekap</h2>
      <p>CTR tidak diberikan YouTube Analytics API, dan klik afiliasi hanya ada di dashboard afiliasi. Unduh CSV-nya, pilih jenis dan channel, lalu simpan. Hari yang sama ditimpa; jenis lain tidak tersentuh.</p>
      <div class="stack">
        <div class="row">
          <label class="field"><span>Jenis</span><select class="input" id="rk-jenis"><option value="ctr">CTR (ekspor YouTube Studio)</option><option value="klik">Klik afiliasi</option></select></label>
          <label class="field"><span>Channel</span><select class="input" id="rk-ch">${chans.map((c) => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>File CSV</span><input class="input" type="file" id="rk-file" accept=".csv,text/csv"></label>
        <div id="rk-isi"></div>
      </div>
      <div class="err" id="rk-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="rk-simpan" disabled>Simpan</button></div>`, (d) => {
    d.classList.add('wide');
    let rows = null, hasil = null;
    const isiEl = $('#rk-isi', d), err = $('#rk-err', d), simpan = $('#rk-simpan', d);
    const jenis = () => $('#rk-jenis', d).value;
    const opt = (sel, kosong) => (kosong ? `<option value="" ${sel < 0 ? 'selected' : ''}>(tidak ada)</option>` : '') + rows[0].map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Kolom ' + (i + 1))}</option>`).join('');
    const tebak = (re) => rows[0].findIndex((h) => re.test(h));

    const hitung = () => {
      err.textContent = '';
      const [, ...data] = rows;
      const ci = +$('#rk-tgl', d).value, cv = +$('#rk-nilai', d).value, cimp = $('#rk-imp') ? $('#rk-imp').value : '';
      const cf = $('#rk-fkol') ? $('#rk-fkol').value : '', fv = $('#rk-fval') ? $('#rk-fval').value.trim().toLowerCase() : '';
      const per = {}; let lewat = 0, saring = 0;
      data.forEach((r) => {
        if (cf !== '' && fv && !String(r[+cf] || '').toLowerCase().includes(fv)) { saring++; return; }
        const t = tglIso(r[ci]), n = angkaUang(r[cv]);
        if (!t || n == null || n < 0) { lewat++; return; }
        const o = (per[t] ||= { tanggal: t, w: 0, n: 0, imp: 0, k: 0, c: 0 });
        if (jenis() === 'klik') { o.k += n; return; }
        const imp = cimp !== '' ? angkaUang(r[+cimp]) : null;
        o.c++; o.n += n; if (imp) { o.imp += imp; o.w += n * imp; }
      });
      const baris = Object.values(per).sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1)).map((o) => (jenis() === 'klik'
        ? { tanggal: o.tanggal, klik: o.k }
        : { tanggal: o.tanggal, ctr: o.imp > 0 ? Math.round((o.w / o.imp) * 1000) / 1000 : Math.round((o.n / o.c) * 1000) / 1000, impresi: o.imp > 0 ? o.imp : null }));
      hasil = baris;
      const el = $('#rk-hasil', d);
      if (!baris.length) { el.innerHTML = '<div class="empty"><b>Tidak ada baris yang terbaca</b>Periksa pilihan kolom tanggal dan nilai.</div>'; simpan.disabled = true; return; }
      const nilai = (b) => (jenis() === 'klik' ? nf.format(b.klik) : persen(b.ctr));
      const bukan = jenis() === 'ctr' && baris.some((b) => b.ctr > 100);
      el.innerHTML = `<p><b>${baris.length}</b> hari terbaca, ${tglPendek(baris[0].tanggal)} – ${tglPendek(baris[baris.length - 1].tanggal)}${lewat ? `, ${lewat} baris dilewati` : ''}${saring ? `, ${saring} baris tersaring` : ''}.</p>
        <table class="t"><thead><tr><th>Tanggal</th><th class="num">${jenis() === 'klik' ? 'Klik' : 'CTR'}</th></tr></thead><tbody>${baris.slice(-5).map((b) => `<tr><td>${tglPendek(b.tanggal)}</td><td class="num"><b>${nilai(b)}</b></td></tr>`).join('')}</tbody></table>
        ${jenis() === 'ctr' && baris.every((b) => b.ctr <= 1) ? '<p class="muted fs-125">Semua CTR ≤ 1. Bila di file CTR ditulis sebagai pecahan (0,045 = 4,5%), pilih kolom yang berupa persen.</p>' : ''}`;
      if (bukan) { err.textContent = 'Ada CTR di atas 100%. Periksa kolom nilai.'; simpan.disabled = true; return; }
      simpan.disabled = baris.length > 800;
      if (baris.length > 800) err.textContent = 'Maksimal 800 hari per impor.';
    };

    const pasang = () => {
      const k = jenis() === 'klik';
      const tg = tebak(/tanggal|date|waktu|time|hari|day/i), nv = tebak(k ? /klik|click/i : /click-through|clickthrough|\bctr\b|rasio klik|rasio proporsi/i), im = tebak(/impres/i);
      isiEl.innerHTML = `<div class="stack">
          <div class="row">
            <label class="field"><span>Kolom tanggal</span><select class="input" id="rk-tgl">${opt(Math.max(0, tg))}</select></label>
            <label class="field"><span>${k ? 'Kolom jumlah klik' : 'Kolom CTR'}</span><select class="input" id="rk-nilai">${opt(Math.max(0, nv))}</select></label>
            ${k ? '' : `<label class="field"><span>Kolom impresi (opsional)</span><select class="input" id="rk-imp">${opt(im, true)}</select></label>`}
          </div>
          ${k ? `<div class="row"><label class="field"><span>Saring baris (opsional): kolom</span><select class="input" id="rk-fkol">${opt(-1, true)}</select></label>
            <label class="field"><span>mengandung teks</span><input class="input" id="rk-fval" placeholder="mis. kode channel di Sub ID"></label></div>
            <p class="muted fs-125">Satu laporan afiliasi yang memuat beberapa channel? Pisahkan dengan kolom Sub ID, lalu impor sekali per channel.</p>` : ''}
          <div id="rk-hasil"></div></div>`;
      isiEl.querySelectorAll('select, input').forEach((e) => e.addEventListener('input', hitung));
      hitung();
    };

    $('#rk-jenis', d).addEventListener('change', () => { if (rows) pasang(); });
    $('#rk-file', d).addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      err.textContent = ''; simpan.disabled = true; isiEl.innerHTML = ''; rows = null;
      if (!f) return;
      if (f.size > 5e6) { err.textContent = 'File terlalu besar (maksimal 5 MB).'; return; }
      rows = bacaCsv(await f.text());
      if (rows.length < 2) { err.textContent = 'File kosong atau bukan CSV.'; rows = null; return; }
      pasang();
    });
    simpan.addEventListener('click', async () => {
      if (!hasil || !hasil.length) return;
      simpan.disabled = true; err.textContent = '';
      try {
        const r = await api('/api/rekap/impor', { method: 'PUT', timeout: 60000, body: { jenis: jenis(), channel_id: $('#rk-ch', d).value, baris: hasil } });
        R.metrik = (await api('/api/rekap?hari=366')).metrik;
        closeOverlay();
        toast(r.baris + ' hari tersimpan');
        render();
      } catch (e) { err.textContent = e.message; simpan.disabled = false; }
    });
  });
}
