// app/pages/ringkasan.js - Ringkasan page
import { getState, isAdmin } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, fmt, idr, usd, signed, pct, cf, nf, tglPanjang, PALETTE } from '../core/utils.js';
import { drawStacked, drawSparkbars } from '../charts/charts.js';
import { editorById, activeEditors, analyticsChannels, chName, chColor } from '../components/nav.js';
import { confirmDialog } from '../components/dialogs.js';

export function renderRingkasan() {
  const S = getState();
  const showRev = isAdmin();
  const days = daysBack(S.periode);
  const editors = activeEditors();
  const team = editors.filter((e) => (e.peran || 'editor') === 'editor');
  const limited = editors.filter((e) => (e.peran || 'editor') === 'terbatas');

  // Totals
  let totViews = 0, totRevenue = 0, totVideo = 0, totShorts = 0, totVideoDur = 0, totShortsDur = 0;
  S.content.filter((c) => days.includes(c._day)).forEach((c) => {
    totViews += c.views;
    if (c.revenue != null) totRevenue += c.revenue;
    if (c.tipe_video === 'short') { totShorts++; totShortsDur += c.duration_secs; }
    else { totVideo++; totVideoDur += c.duration_secs; }
  });

  // Series for stacked chart
  const series = team.map((e) => {
    const values = days.map((d) => S.content.filter((c) => c.editor_id === e.id && c._day === d).length);
    return { name: e.nama, color: e._color, values };
  });
  series.push({ name: 'Belum dikenali', color: 'var(--line-2)', values: days.map((d) => S.content.filter((c) => c._day === d && !team.some((e) => e.id === c.editor_id)).length) });

  // Target line = sum of editors' daily targets * days fraction
  const target = team.reduce((s, e) => s + (e.target_harian || 3) * days.length, 0);

  // Top videos
  const topViews = [...S.content].filter((c) => days.includes(c._day)).sort((a, b) => b.views - a.views).slice(0, 5);
  const topRevenue = showRev ? [...S.content].filter((c) => days.includes(c._day) && c.revenue != null).sort((a, b) => (b.revenue || 0) - (a.revenue || 0)).slice(0, 5) : [];

  // Channel cards
  const chCards = analyticsChannels().map((c) => {
    const chData = S.daily.filter((d) => d.channel_id === c.id && days.includes(d.tanggal));
    const v = chData.reduce((s, d) => s + d.views, 0);
    const m = chData.reduce((s, d) => s + d.menit_tonton, 0);
    const rev = showRev ? chData.reduce((s, d) => s + (d.revenue || 0), 0) : null;
    const sub = chData.reduce((s, d) => s + d.sub_naik - d.sub_turun, 0);
    const prevCh = S.daily.filter((d) => d.channel_id === c.id && days.map((x) => addDays(x, -S.periode)).includes(d.tanggal));
    const pv = prevCh.reduce((s, d) => s + d.views, 0);
    const pm = prevCh.reduce((s, d) => s + d.menit_tonton, 0);
    const prevRev = showRev ? prevCh.reduce((s, d) => s + (d.revenue || 0), 0) : null;
    return { id: c.id, nama: c.nama, connected: c.connected, v, m, rev, sub, pv, pm, prevRev };
  });

  return `
    <section class="card"><div class="card-h"><h2>Ringkasan ${S.periode} hari</h2></div>
      <div class="grid-4">
        <div class="stat"><span>Video panjang</span><b>${fmt(totVideo)}</b><div class="d">${signed(totVideo - (S.content.filter((c) => days.map((x) => addDays(x, -S.periode)).includes(c._day) && c.tipe_video !== 'short')).length)} vs periode lalu</div></div>
        <div class="stat"><span>Shorts</span><b>${fmt(totShorts)}</b><div class="d">${signed(totShorts - (S.content.filter((c) => days.map((x) => addDays(x, -S.periode)).includes(c._day) && c.tipe_video === 'short')).length)} vs periode lalu</div></div>
        <div class="stat"><span>Total Views</span><b>${fmt(totViews)}</b><div class="d">${pct(totViews / Math.max(1, pv) - 1)} vs periode lalu</div></div>
        ${showRev ? `<div class="stat"><span>Pendapatan</span><b>${usd(totRevenue)}</b><div class="d">${signed(usd(totRevenue - prevRev))} vs periode lalu</div></div>` : ''}
      </div>
      <div class="chart-wrap" id="chart-stacked" style="height:250px;margin-top:12px"></div>
    </section>

    ${chCards.map((c) => `
      <section class="card"><div class="card-h"><h2>${esc(c.nama)} ${c.connected ? '<span class="pill ok">Analytics</span>' : '<span class="pill warn">Belum sambung</span>'}</h2></div>
        <div class="grid-4">
          <div class="stat"><span>Views</span><b>${fmt(c.v)}</b><div class="d">${pct(c.v / Math.max(1, c.pv) - 1)}</div></div>
          <div class="stat"><span>Menit tonton</span><b>${fmt(c.m)}</b><div class="d">${pct(c.m / Math.max(1, c.pm) - 1)}</div></div>
          ${showRev ? `<div class="stat"><span>Pendapatan</span><b>${usd(c.rev)}</b><div class="d">${signed(usd(c.rev - c.prevRev))}</div></div>` : ''}
          <div class="stat"><span>Sub bersih</span><b>${signed(c.sub)}</b></div>
        </div>
        <div class="chart-wrap" id="spark-${c.id}" style="height:120px;margin-top:8px"></div>
      </section>
    `).join('')}

    ${team.length ? `
      <section class="card"><div class="card-h"><h2>Skor Tim (${S.periode} hari)</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Target</th><th>Video</th><th>Tepat</th><th>Views</th><th>Skor</th><th>Nilai</th></tr></thead><tbody>
          ${team.map((e) => {
            const ps = periodStats(e, days);
            return `<tr><td>${avatar(e)}${esc(e.nama)}</td><td>${ps.target}</td><td>${ps.n}</td><td>${ps.tepat != null ? pct(ps.tepat) : '—'}</td><td>${fmt(ps.views)}</td><td><b>${ps.skor ?? '—'}</b></td><td>${gradeOf(ps.skor)}</td></tr>`;
          }).join('')}
        </tbody></table></div>
      </section>
    ` : ''}

    ${limited.length ? `
      <section class="card"><div class="card-h"><h2>Editor Terbatas (${S.periode} hari)</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Video</th><th>Views</th></tr></thead><tbody>
          ${limited.map((e) => {
            const vids = S.content.filter((c) => c.editor_id === e.id && days.includes(c._day));
            return `<tr><td>${avatar(e)}${esc(e.nama)}</td><td>${vids.length}</td><td>${fmt(vids.reduce((s, c) => s + c.views, 0))}</td></tr>`;
          }).join('')}
        </tbody></table></div>
      </section>
    ` : ''}

    <section class="card"><div class="card-h"><h2>Top Video (Views)</h2></div>
      <div class="table-wrap"><table><thead><tr><th>Judul</th><th>Channel</th><th>Pembuat</th><th>Jenis</th><th>Views</th><th>Like</th><th>Komentar</th></tr></thead><tbody>
        ${topViews.map((c) => `<tr><td><b>${esc(c.judul)}</b></td><td>${esc(c._chNama)}</td><td>${editorCell(c)}</td><td>${c.tipe_video === 'short' ? 'Shorts' : 'Video'}</td><td>${fmt(c.views)}</td><td>${fmt(c.likes)}</td><td>${fmt(c.comments)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Belum ada video</td></tr>'}
      </tbody></table></div>
    </section>

    ${showRev && topRevenue.length ? `
      <section class="card"><div class="card-h"><h2>Top Video (Pendapatan)</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Judul</th><th>Channel</th><th>Pembuat</th><th>Pendapatan</th></tr></thead><tbody>
          ${topRevenue.map((c) => `<tr><td><b>${esc(c.judul)}</b></td><td>${esc(c._chNama)}</td><td>${editorCell(c)}</td><td>${usd(c.revenue)}</td></tr>`).join('')}
        </tbody></table></div>
      </section>
    ` : ''}
  `;
}

import { periodStats, daysBack } from '../core/scoring.js';
import { addDays, avatar, gradeOf, editorCell } from '../core/utils.js';