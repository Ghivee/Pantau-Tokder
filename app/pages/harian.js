// app/pages/harian.js - Harian page
import { getState, isAdmin, me, canLog, canAssign } from '../core/state.js';
import { icon, esc, fmt, pct, tglPanjang, avatar, editorCell, vidCell, today, addDays, usd, gradeOf } from '../core/utils.js';
import { dayStats, periodStats, daysBack } from '../core/scoring.js';
import { drawStacked } from '../charts/charts.js';
import { confirmDialog } from '../components/dialogs.js';
import { editorById, activeEditors, chName } from '../components/nav.js';

export function renderHarian() {
  const S = getState();
  if (!S.day) S.day = today();
  const day = S.day;
  const who = me(editorById);
  const editors = activeEditors();
  const team = editors.filter((e) => (e.peran || 'editor') === 'editor');
  const limited = editors.filter((e) => (e.peran || 'editor') === 'terbatas');
  const vids = S.content.filter((c) => c._day === day);
  const totalViews = vids.reduce((s, c) => s + c.views, 0);
  const totalRev = vids.reduce((s, c) => s + (c.revenue || 0), 0);
  const videoCount = vids.filter((c) => c.tipe_video !== 'short').length;
  const shortsCount = vids.filter((c) => c.tipe_video === 'short').length;

  return `
    <section class="card"><div class="card-h"><h2>${tglPanjang(day)}</h2>
      <div class="tools">
        <button class="btn ghost sm" data-act="hari" data-v="-1" ${day <= addDays(today(), -S.periode) ? 'disabled' : ''}>${icon('left')}</button>
        <button class="btn ghost sm" data-act="hari-ini">Hari ini</button>
        <button class="btn ghost sm" data-act="hari" data-v="1" ${day >= today() ? 'disabled' : ''}>${icon('right')}</button>
      </div></div>
      <div class="grid-4">
        <div class="stat"><span>Video panjang</span><b>${videoCount}</b></div>
        <div class="stat"><span>Shorts</span><b>${shortsCount}</b></div>
        <div class="stat"><span>Views</span><b>${fmt(totalViews)}</b></div>
        ${isAdmin() ? `<div class="stat"><span>Pendapatan</span><b>${usd(totalRev)}</b></div>` : ''}
      </div>
    </section>

    ${team.length ? `
      <section class="card"><div class="card-h"><h2>Skor Harian</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Target</th><th>Video</th><th>Tepat</th><th>Telat</th><th>Views</th><th>Views/Video</th><th>Skor</th><th>Nilai</th></tr></thead><tbody>
          ${team.map((e) => {
            const ds = dayStats(e, day);
            return `<tr>
              <td>${avatar(e)}${esc(e.nama)}</td>
              <td>${ds.target}</td>
              <td>${ds.n}</td>
              <td>${ds.tepat}</td>
              <td>${ds.telat}</td>
              <td>${fmt(ds.views)}</td>
              <td>${ds.n ? fmt(ds.views / ds.n) : '—'}</td>
              <td><b>${ds.skor ?? '—'}</b></td>
              <td>${gradeOf(ds.skor)}</td>
            </tr>`;
          }).join('')}
        </tbody></table></div>
      </section>
    ` : ''}

    ${limited.length ? `
      <section class="card"><div class="card-h"><h2>Editor Terbatas</h2></div>
        <div class="table-wrap"><table><thead><tr><th>Karyawan</th><th>Video</th><th>Views</th></tr></thead><tbody>
          ${limited.map((e) => {
            const vids = S.content.filter((c) => c.editor_id === e.id && c._day === day);
            return `<tr><td>${avatar(e)}${esc(e.nama)}</td><td>${vids.length}</td><td>${fmt(vids.reduce((s, c) => s + c.views, 0))}</td></tr>`;
          }).join('')}
        </tbody></table></div>
      </section>
    ` : ''}

    ${who && canLog(editorById) ? `
      <section class="card"><div class="card-h"><h2>Aktivitas ${who.nama} <button class="btn ghost sm" data-act="catat" data-id="${who.id}">${icon('plus')}Catat</button></h2></div>
        <div class="table-wrap"><table><thead><tr><th>Jam</th><th>Tugas</th><th>Jumlah</th><th>Detail</th></tr></thead><tbody>
          ${S.aktivitas.filter((a) => a.editor_id === who.id && a.tanggal === day).map((a) => `<tr><td>${a.jam}</td><td>${esc(a.tugas)}</td><td>${a.jumlah}</td><td>${esc(a.detail || '')}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Belum ada aktivitas</td></tr>'}
        </tbody></table></div>
      </section>
    ` : ''}

    <section class="card"><div class="card-h"><h2>Video ${tglPanjang(day)}</h2></div>
      <div class="list" id="day-videos">
        ${vids.map((c) => `
          <article class="video-item">
            ${vidCell(c)}
            <div class="meta">
              <span>${esc(c._chNama)}</span>
              <span>${editorCell(c)}</span>
              <span>${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'}</span>
              <span>${fmt(c.views)} views</span>
              <span>${fmt(c.likes)} like</span>
              ${isAdmin() && c.revenue != null ? `<span>${usd(c.revenue)}</span>` : ''}
              <button class="btn ghost sm" data-act="video" data-id="${c.id}">${icon('ext')} Detail</button>
            </div>
          </article>
        `).join('') || '<div class="empty">Tidak ada video hari ini</div>'}
      </div>
    </section>
  `;
}