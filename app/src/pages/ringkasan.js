import { activeEditors } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { TOL, gradeOf, targetOf } from '../core/rules.js';
import { S, isAdmin } from '../core/state.js';
import { dayStats, daysBack, periodStats } from '../core/stats.js';
import { $, $$, esc } from '../lib/dom.js';
import { addDays, fmt, median, nf, pct, signed, sum, tglPendek } from '../lib/format.js';
import { ipBaruCard } from './presensi.js';
import { persiapanItems } from './shared.js';
import { avatar, editorCell, vidCell } from '../ui/bits.js';
import { drawSparkbars, drawStacked } from '../ui/charts.js';
import { render } from '../ui/layout.js';

function ringkasanData() {
  const days = daysBack(S.periode);
  const prev = daysBack(S.periode, addDays(days[0], -1));
  const inCh = (c) => S.channel === 'all' || c._ch === S.channel;
  const vids = S.content.filter((c) => days.includes(c._day) && inCh(c));
  const vidsPrev = S.content.filter((c) => prev.includes(c._day) && inCh(c));
  const team = activeEditors();
  const target = sum(team, (e) => sum(days, (d) => dayStats(e, d).target));
  return { days, prev, vids, vidsPrev, team, target };
}

PAGES.ringkasan = function () {
    const { days, vids, vidsPrev, team, target } = ringkasanData();
    const stats = team.map((e) => periodStats(e, days));
    const mature = vids.filter((c) => c._age >= 2);
    const unmatched = S.unmatched;
    const slotted = sum(stats, (s) => sum(s.list, (x) => x.withSlot));
    const tepat = slotted ? sum(stats, (s) => sum(s.list, (x) => x.tepat)) / slotted : null;
    const label = S.periode === 7 ? '7 hari terakhir' : '30 hari terakhir';
    const sentence = team.length
      ? `${label}: <b>${nf.format(vids.length)}</b> video tayang${target ? ' dari target <b>' + nf.format(target) + '</b>' : ''}. ` +
        stats.map((s) => `${esc(s.e.nama)} rata-rata skor <b>${s.skor ?? '—'}</b>`).join(', ') + '.' +
        (unmatched ? ` <b>${unmatched}</b> video belum dikenali pembuatnya.` : '')
      : 'Belum ada karyawan. Tambahkan di menu Karyawan.';
    const chOpts = S.channels.map((c) => `<option value="${esc(c.id)}" ${S.channel === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('');
    return `
        <header class="head">
          <div><h1>Ringkasan</h1><p>${sentence}</p></div>
          <div class="tools">
            <select class="input w-auto" id="f-channel" aria-label="Channel"><option value="all">Semua channel</option>${chOpts}</select>
            <div class="seg" role="group" aria-label="Periode">
              <button data-act="periode" data-v="7" aria-pressed="${S.periode === 7}">7 hari</button>
              <button data-act="periode" data-v="30" aria-pressed="${S.periode === 30}">30 hari</button>
            </div>
          </div>
        </header>
        ${ipBaruCard()}
        ${persiapanHtml()}
        <section class="kpis" aria-label="Angka utama">
          <div class="kpi"><span class="l">Video tayang</span><span class="v">${nf.format(vids.length)}${target && S.channel === 'all' ? ` <small>/ ${nf.format(target)}</small>` : ''}</span><span class="d ${vids.length >= vidsPrev.length ? 'ok' : 'bad'}">${signed(vids.length - vidsPrev.length)} dari periode sebelumnya</span></div>
          <div class="kpi"><span class="l">Views video baru</span><span class="v">${fmt(sum(vids, (c) => c.views))}</span><span class="d">${fmt(sum(vidsPrev, (c) => c.views))} di periode sebelumnya</span></div>
          <div class="kpi"><span class="l">Median views per video</span><span class="v">${fmt(median(mature.map((c) => c.views)))}</span><span class="d">video berumur ≥ 2 hari</span></div>
          <div class="kpi"><span class="l">Tepat jadwal</span><span class="v ${tepat == null ? '' : tepat >= 0.85 ? 'ok' : tepat >= 0.7 ? 'warn' : 'bad'}">${pct(tepat)}</span><span class="d">telat &gt; ${TOL} menit dihitung telat</span></div>
          <a class="kpi ${unmatched ? 'alert' : ''}" href="/identifikasi"><span class="l">Belum dikenali</span><span class="v">${nf.format(unmatched)}</span><span class="d">${unmatched ? 'Tetapkan pembuatnya →' : 'Semua video sudah dikenali'}</span></a>
        </section>
        <div class="grid-2">
          <section class="card" id="kartu-harian">
            <div class="card-h"><h2>Video tayang per hari</h2><p>Per karyawan. Garis putus-putus: target harian seluruh tim.</p></div>
            <div class="chart-legend">${team.map((e) => `<span><i style="background:${e._color}"></i>${esc(e.nama)}</span>`).join('')}<span><i style="background:var(--line-2)"></i>Belum dikenali</span>${target && S.channel === 'all' ? '<span><i class="line"></i>Target</span>' : ''}</div>
            <div class="chart minh-230" id="ch-video"></div>
          </section>
          <section class="card" id="kartu-peringkat">
            <div class="card-h"><h2>Kinerja karyawan</h2><p>Rata-rata skor harian ${label}. Klik nama untuk melihat hari per hari.</p></div>
            <div class="rank">${stats.length ? stats.sort((a, b) => (b.skor ?? -1) - (a.skor ?? -1)).map((s) => `
              <a class="rank-row no-underline" href="/harian/${s.e.id}" data-act="lihat-orang" data-id="${s.e.id}">
                ${avatar(s.e, 'sm')}
                <div class="tx"><b>${esc(s.e.nama)}</b><div>${nf.format(s.n)}/${nf.format(s.target)} video · tepat ${pct(s.tepat)} · ${fmt(s.views)} views · ${nf.format(s.tugas)} tugas</div>
                  <div class="bar"><i style="width:${s.skor ?? 0}%;background:${s.e._color}"></i></div></div>
                <span class="grade ${gradeOf(s.skor) || ''}" title="Skor ${s.skor ?? '—'}">${s.skor ?? '—'}</span>
              </a>`).join('') : '<div class="empty"><b>Belum ada karyawan</b>Tambahkan di menu Karyawan.</div>'}</div>
          </section>
          <section class="card" id="kartu-channel">
            <div class="card-h"><h2>Per channel</h2><p>Video dan views video baru, ${label}.</p></div>
            <div class="minis">${S.channels.map((ch) => {
              const v = vids.filter((c) => c._ch === ch.id);
              return `<div class="mini"><h3>${esc(ch.nama)}</h3><div class="v">${fmt(sum(v, (c) => c.views))} <span class="muted" style="font-size:13px;font-weight:600">views</span></div><div class="d">${nf.format(v.length)} video · median ${fmt(median(v.filter((c) => c._age >= 2).map((c) => c.views)))}</div><div class="chart spark mt-8" data-ch="${esc(ch.id)}"></div></div>`;
            }).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
          </section>
          <section class="card" id="kartu-topik">
            <div class="card-h"><h2>Ide konten berikutnya</h2><p>Median views tiap topik dibanding median channel-nya, video 30 hari terakhir. Topik ditebak dari kata di judul.</p></div>
            ${topikHtml()}
          </section>
          <section class="card span-all" id="kartu-terbaik">
            <div class="card-h"><h2>Video terbaik ${label}</h2></div>
            ${vids.length ? `<div class="table-wrap"><table class="t stack"><thead><tr><th>Video</th><th>Pembuat</th><th>Tayang</th><th class="num">Views</th><th class="num">Like</th><th class="num">Komentar</th></tr></thead><tbody>
              ${[...vids].sort((a, b) => b.views - a.views).slice(0, 5).map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td class="full">${vidCell(c)}</td><td data-label="Pembuat">${editorCell(c)}</td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td><td class="num" data-label="Like">${nf.format(c.likes)}</td><td class="num" data-label="Komentar">${nf.format(c.comments)}</td></tr>`).join('')}
            </tbody></table></div>` : '<div class="empty"><b>Belum ada video di periode ini</b>Jalankan sinkronisasi di Pengaturan bila seharusnya sudah ada.</div>'}
          </section>
        </div>`;
  };

function topikHtml() {
  const base = S.content.filter((c) => c._age >= 2 && c._age <= 32);
  const html = S.channels.map((ch) => {
    const vc = base.filter((c) => c._ch === ch.id);
    const med = median(vc.map((c) => c.views));
    if (!vc.length || !med) return '';
    const groups = {};
    vc.forEach((c) => { (groups[c._topik] ||= []).push(c); });
    const rows = Object.entries(groups).map(([t, list]) => ({ t, n: list.length, r: median(list.map((c) => c.views)) / med, best: list.reduce((a, b) => (b.views > a.views ? b : a)) }))
      .filter((x) => x.t !== 'Lainnya' || Object.keys(groups).length === 1).sort((a, b) => b.r - a.r).slice(0, 4);
    return `<div class="topic-ch"><h3>${esc(ch.nama)}</h3>${rows.map((x) => {
        const cls = x.n < 2 ? '' : x.r >= 1.2 ? 'ok' : x.r < 0.8 ? 'bad' : '';
        const tag = x.n < 2 ? 'uji lagi' : x.r >= 1.2 ? 'perbanyak' : x.r < 0.8 ? 'kurangi' : 'pertahankan';
        return `<div class="topic"><b>${esc(x.t)}</b><span class="x ${cls}">${x.r.toFixed(1).replace('.', ',')}× <span class="pill ${cls}">${tag}</span></span><span class="ex">${x.n} video · terbaik: ${esc(x.best.judul)}</span></div>`;
      }).join('')}</div>`;
  }).join('');
  return html ? `<div class="topics">${html}</div>` : '<div class="empty"><b>Belum cukup data</b>Butuh video berumur minimal 2 hari.</div>';
}

AFTER.ringkasan = function () {
    const { days, vids, team, target } = ringkasanData();
    const series = team.map((e) => ({ name: e.nama, color: e._color, values: days.map((d) => vids.filter((c) => c._day === d && c.editor_id === e.id).length) }));
    series.push({ name: 'Belum dikenali', color: 'var(--line-2)', values: days.map((d) => vids.filter((c) => c._day === d && !team.some((e) => e.id === c.editor_id)).length) });
    const box = $('#ch-video');
    if (box) drawStacked(box, { days, series, target: S.channel === 'all' ? sum(team, targetOf) : 0 });
    $$('.spark').forEach((el) => drawSparkbars(el, days.map((d) => sum(vids.filter((c) => c._ch === el.dataset.ch && c._day === d), (c) => c.views)), 'var(--leaf)'));
    const sel = $('#f-channel');
    if (sel) sel.addEventListener('change', () => { S.channel = sel.value; render(); });
  };

// What still needs doing before every number in the app is complete. Hidden once all is done.
function persiapanHtml() {
  if (!isAdmin()) return '';
  const items = persiapanItems();
  const sisa = items.filter((x) => !x.ok);
  if (!sisa.length) return '';
  return `<section class="card" id="kartu-persiapan"><div class="card-h"><h2>Persiapan: ${items.length - sisa.length} dari ${items.length} selesai</h2><p>Lengkapi supaya semua angka dan fitur terisi.</p></div>
      <div class="checklist">${sisa.map((x) => `<div class="ck"><span class="st bad">!</span><div><b>${esc(x.t)}</b><div>${esc(x.d)}</div></div>${x.act ? `<button class="btn sm" data-act="${x.act}" data-id="${x.id || 'umum'}">${x.act === 'notif-aktif' ? 'Aktifkan' : 'Atur'}</button>` : `<a class="btn sm" href="${x.href}">Buka</a>`}</div>`).join('')}</div></section>`;
}
