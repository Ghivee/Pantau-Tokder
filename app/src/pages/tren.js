import { chColor, chName, jamMenit } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S, me } from '../core/state.js';
import { daysBack } from '../core/stats.js';
import { $, esc } from '../lib/dom.js';
import { addDays, fmt, nf, signed, sum, tglPanjang, tglPendek } from '../lib/format.js';
import { bantuan, kali, loadInsight } from './shared.js';
import { kataLaris, topikTerakhir } from '../core/tren-data.js';
import { editorCell, vidCell } from '../ui/bits.js';
import { drawStacked } from '../ui/charts.js';
import { render } from '../ui/layout.js';



PAGES.tren = function () {
  const ch = S.trenCh;
  const ids = ch === 'all' ? S.channels.map((c) => c.id) : [ch];
  const inCh = (c) => ids.includes(c._ch);
  const daily = S.daily.filter((d) => ids.includes(d.channel_id));
  const latest = daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
  const w1 = latest ? daysBack(7, latest) : [], w0 = latest ? daysBack(7, addDays(w1[0], -1)) : [];
  const tot = (ds, f) => sum(daily.filter((d) => ds.includes(d.tanggal)), f);
  const pctChange = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 100) : null);
  const delta = (a, b) => { const x = pctChange(a, b); return x == null ? '<span class="d">belum ada pembanding</span>' : `<span class="d ${x >= 0 ? 'ok' : 'bad'}">${signed(x, (v) => nf.format(v) + '%')} dari 7 hari sebelumnya</span>`; };
  const vNow = tot(w1, (d) => d.views), vPrev = tot(w0, (d) => d.views);
  const mNow = tot(w1, (d) => d.menit_tonton), mPrev = tot(w0, (d) => d.menit_tonton);
  const sNow = tot(w1, (d) => d.sub_naik - d.sub_turun), sPrev = tot(w0, (d) => d.sub_naik - d.sub_turun);
  const vids = S.content.filter(inCh);
  const upNow = vids.filter((c) => c._age < 7).length, upPrev = vids.filter((c) => c._age >= 7 && c._age < 14).length;

  // Rising right now, from sync snapshots (views gained, scaled to 24 hours)
  if (!S.insight) loadInsight();
  const naik = S.insight && !S.insight.error ? vids.map((c) => { const x = S.insight.naikMap.get(c.id); const h = x && x.hari; return h && h.jam >= 12 && h.jam <= 72 && h.naik > 0 ? { c, per: (h.naik * 24) / h.jam } : null; }).filter(Boolean).sort((a, b) => b.per - a.per) : [];
  const baru = naik.filter((x) => x.c._age <= 14).slice(0, 6), lama = naik.filter((x) => x.c._age > 30).slice(0, 5);

  // Topics and title words: shared with the Saran page (core/tren-data.js)
  const topik = topikTerakhir(vids);
  const { kuat, lemah } = kataLaris(vids);
  const fmtNaik = (x) => `<tr class="click" data-act="video" data-id="${x.c.id}"><td class="full">${vidCell(x.c)}</td>${me() ? '' : `<td data-label="Pembuat">${editorCell(x.c)}</td>`}<td class="mono" data-label="Tayang">${tglPendek(x.c._day)}</td><td class="num" data-label="Naik / 24 jam"><b>+${fmt(x.per)}</b></td><td class="num" data-label="Total views">${fmt(x.c.views)}</td></tr>`;
  const naikHead = '<thead><tr><th>Video</th>' + (me() ? '' : '<th>Pembuat</th>') + '<th>Tayang</th><th class="num">Naik / 24 jam</th><th class="num">Total views</th></tr></thead>';
  const naikEmpty = !S.insight ? '<div class="skeleton" style="height:120px"></div>' : S.insight.error ? `<div class="empty"><b>Belum bisa dimuat</b>${esc(S.insight.error)}</div>` : '<div class="empty"><b>Belum ada catatan kenaikan</b>Kenaikan dihitung dari dua sinkronisasi yang berjarak 12–72 jam. Data muncul setelah aplikasi dibuka atau sinkron otomatis berjalan di dua hari berbeda.</div>';
  return `
      <header class="head">
        <div><h1>Tren channel</h1><p>${latest ? `Angka YouTube Analytics sampai ${tglPanjang(latest)} (YouTube terlambat 2–3 hari). ` : 'Belum ada angka YouTube Analytics. '}Video yang sedang naik dihitung dari sinkronisasi terbaru.</p></div>
        <div class="tools"><select class="input w-auto" id="tr-ch" aria-label="Channel"><option value="all">Semua channel</option>${S.channels.map((c) => `<option value="${esc(c.id)}" ${ch === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>${bantuan('tren')}</div>
      </header>
      <section class="kpis" aria-label="7 hari terakhir">
        <div class="kpi"><span class="l">Views 7 hari</span><span class="v">${latest ? fmt(vNow) : '—'}</span>${latest ? delta(vNow, vPrev) : '<span class="d">hubungkan YouTube Analytics</span>'}</div>
        <div class="kpi"><span class="l">Jam tonton 7 hari</span><span class="v">${latest ? jamMenit(mNow) : '—'}</span>${latest ? delta(mNow, mPrev) : ''}</div>
        <div class="kpi"><span class="l">Subscriber bersih 7 hari</span><span class="v ${sNow < 0 ? 'bad' : ''}">${latest ? signed(sNow) : '—'}</span>${latest ? `<span class="d">7 hari sebelumnya ${signed(sPrev)}</span>` : ''}</div>
        <div class="kpi"><span class="l">Video baru 7 hari</span><span class="v">${nf.format(upNow)}</span><span class="d ${upNow >= upPrev ? 'ok' : 'bad'}">${signed(upNow - upPrev)} dari minggu sebelumnya</span></div>
      </section>
      <section class="card" id="kartu-tren-views">
        <div class="card-h"><h2>Views harian 28 hari</h2><p>Semua video di channel, termasuk video lama.</p></div>
        <div class="chart-legend">${ids.map((id) => `<span><i style="background:${chColor(id)}"></i>${esc(chName(id))}</span>`).join('')}</div>
        ${latest ? '<div class="chart minh-230" id="tr-chart"></div>' : '<div class="empty"><b>Belum ada angka dari YouTube Analytics</b>Hubungkan channel di Pengaturan.</div>'}
      </section>
      <section class="card" id="kartu-naik">
        <div class="card-h"><h2>Sedang naik sekarang</h2><p>Video 14 hari terakhir dengan tambahan views terbanyak, disetarakan per 24 jam.</p></div>
        ${baru.length ? `<div class="table-wrap"><table class="t stack">${naikHead}<tbody>${baru.map(fmtNaik).join('')}</tbody></table></div>` : naikEmpty}
      </section>
      <div class="grid-2">
        <section class="card" id="kartu-topik-naik">
          <div class="card-h"><h2>Topik 14 hari terakhir</h2><p>Views dibanding video lain di periode yang sama, lalu dibanding 15–60 hari sebelumnya. Topik ditebak dari kata di judul.</p></div>
          ${topik.length ? `<div class="topics"><div class="topic-ch">${topik.slice(0, 6).map((x) => { const up = x.b == null ? null : x.r - x.b; const cls = x.r >= 1.2 ? 'ok' : x.r < 0.8 ? 'bad' : ''; return `<div class="topic"><b>${esc(x.t)}</b><span class="x ${cls}">${kali(x.r)} <span class="pill ${up == null ? '' : up >= 0.25 ? 'ok' : up <= -0.25 ? 'bad' : ''}">${up == null ? 'baru' : up >= 0.25 ? 'naik' : up <= -0.25 ? 'turun' : 'stabil'}</span></span><span class="ex">${x.n} video${x.b != null ? ' · sebelumnya ' + kali(x.b) : ''} · terbaik: ${esc(x.best.judul)}</span></div>`; }).join('')}</div></div>` : '<div class="empty"><b>Belum cukup video</b>Butuh minimal 2 video per topik yang berumur 2–16 hari.</div>'}
        </section>
        <section class="card" id="kartu-kata">
          <div class="card-h"><h2>Kata di judul yang laris</h2><p>Kata yang muncul di 3 video atau lebih dalam 30 hari, dengan median views dibanding video lain.</p></div>
          ${kuat.length || lemah.length ? `<div class="kata">${kuat.map((x) => `<span class="pill ok" title="${x.n} video">${esc(x.k)} ${kali(x.r)}</span>`).join('')}${lemah.map((x) => `<span class="pill bad" title="${x.n} video">${esc(x.k)} ${kali(x.r)}</span>`).join('')}</div><p class="muted fs-125 mt-10">Hijau: judul dengan kata ini lebih ramai. Merah: lebih sepi. Angka di samping kata: median views dibanding video lain.</p>` : '<div class="empty"><b>Belum ada pola yang jelas</b>Butuh lebih banyak video dalam 30 hari terakhir.</div>'}
        </section>
      </div>
      <section class="card" id="kartu-hidup-lagi">
        <div class="card-h"><h2>Video lama yang hidup lagi</h2><p>Video berumur lebih dari 30 hari yang masih bertambah views. Bahan untuk video lanjutan atau versi terbaru.</p></div>
        ${lama.length ? `<div class="table-wrap"><table class="t stack">${naikHead}<tbody>${lama.map(fmtNaik).join('')}</tbody></table></div>` : (S.insight && !S.insight.error ? '<div class="empty"><b>Belum ada video lama yang naik</b>Atau belum ada dua sinkronisasi yang berjarak 12–72 jam.</div>' : naikEmpty)}
      </section>`;
};

AFTER.tren = () => {
  const sel = $('#tr-ch');
  if (sel) sel.addEventListener('change', () => { S.trenCh = sel.value; render(); });
  const box = $('#tr-chart');
  if (!box) return;
  const ids = S.trenCh === 'all' ? S.channels.map((c) => c.id) : [S.trenCh];
  const latest = S.daily.filter((d) => ids.includes(d.channel_id)).reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
  const days = daysBack(28, latest);
  const val = (id, d) => (S.daily.find((x) => x.channel_id === id && x.tanggal === d) || {}).views || 0;
  drawStacked(box, { days, series: ids.map((id) => ({ name: chName(id), color: chColor(id), values: days.map((d) => val(id, d)) })), label: 'Views harian 28 hari' });
};
