// app/pages/konten.js - Konten page
import { getState, isAdmin, canAssign } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, fmt, pct, cf, nf, durasi, usd, avatar, editorCell, vidCell } from '../core/utils.js';
import { confirmDialog, catatDialog } from '../components/dialogs.js';
import { activeEditors, editorById } from '../components/nav.js';

export function renderKonten() {
  const S = getState();
  const k = S.konten;
  const rows = kontenRows();
  const total = rows.length;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (k.page > totalPages) { k.page = totalPages; }
  const pageRows = rows.slice((k.page - 1) * pageSize, k.page * pageSize);

  return `
    <section class="card"><div class="card-h"><h2>Konten${S.sel.size ? ` (${S.sel.size} dipilih)` : ''} ${isAdmin() ? `<button class="btn ghost sm" data-act="csv">${icon('download')} CSV</button>` : ''}</h2>
      <div class="tools">
        <input class="input" id="k-q" placeholder="Cari judul..." value="${esc(k.q)}" style="max-width:300px">
        <select class="input" id="k-channel" style="width:auto"><option value="all">Semua Channel</option>${S.channels.map((c) => `<option value="${esc(c.id)}" ${k.channel === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>
        <select class="input" id="k-editor" style="width:auto"><option value="all">Semua Pembuat</option>${activeEditors().map((e) => `<option value="${e.id}" ${k.editor === e.id ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}<option value="unmatched" ${k.editor === 'unmatched' ? 'selected' : ''}>Belum dikenali</option></select>
        <select class="input" id="k-tipe" style="width:auto"><option value="all">Semua Jenis</option><option value="video" ${k.tipe === 'video' ? 'selected' : ''}>Video panjang</option><option value="short" ${k.tipe === 'short' ? 'selected' : ''}>Shorts</option></select>
        <select class="input" id="k-periode" style="width:auto"><option value="7" ${k.periode === '7' ? 'selected' : ''}>7 hari</option><option value="30" ${k.periode === '30' ? 'selected' : ''}>30 hari</option><option value="90" ${k.periode === '90' ? 'selected' : ''}>90 hari</option><option value="all" ${k.periode === 'all' ? 'selected' : ''}>Semua</option></select>
      </div>
      <div class="table-wrap"><table><thead><tr>
        ${isAdmin() || canAssign() ? '<th style="width:36px"><input type="checkbox" id="sel-all"></th>' : ''}
        <th data-sort="tanggal" class="sortable ${k.sort === 'tanggal' ? k.dir : ''}">Tanggal ${icon(k.sort === 'tanggal' ? (k.dir === 'asc' ? 'up' : 'down') : 'chart')}</th>
        <th data-sort="channel" class="sortable ${k.sort === 'channel' ? k.dir : ''}">Channel ${icon(k.sort === 'channel' ? (k.dir === 'asc' ? 'up' : 'down') : 'chart')}</th>
        <th data-sort="judul" class="sortable ${k.sort === 'judul' ? k.dir : ''}">Judul ${icon(k.sort === 'judul' ? (k.dir === 'asc' ? 'up' : 'down') : 'chart')}</th>
        <th>Jenis</th>
        <th data-sort="views" class="sortable ${k.sort === 'views' ? k.dir : ''}">Views ${icon(k.sort === 'views' ? (k.dir === 'asc' ? 'up' : 'down') : 'chart')}</th>
        <th>Like</th>
        <th>Komentar</th>
        <th>Durasi</th>
        ${isAdmin() ? '<th>Pendapatan</th>' : ''}
        <th data-sort="editor" class="sortable ${k.sort === 'editor' ? k.dir : ''}">Pembuat ${icon(k.sort === 'editor' ? (k.dir === 'asc' ? 'up' : 'down') : 'chart')}</th>
        <th style="width:40px"></th>
      </tr></thead><tbody>
        ${pageRows.map((c) => `
          <tr${S.sel.has(c.id) ? ' class="selected"' : ''}>
            ${isAdmin() || canAssign() ? `<td><input type="checkbox" data-sel="${c.id}" ${S.sel.has(c.id) ? 'checked' : ''}></td>` : ''}
            <td>${c._day} ${c._jam}</td>
            <td>${esc(c._chNama)}</td>
            <td><b>${esc(c.judul)}</b></td>
            <td>${c.tipe_video === 'short' ? 'Shorts' : 'Video'}</td>
            <td>${fmt(c.views)}</td>
            <td>${fmt(c.likes)}</td>
            <td>${fmt(c.comments)}</td>
            <td>${durasi(c.duration_secs)}</td>
            ${isAdmin() ? `<td>${c.revenue != null ? usd(c.revenue) : '—'}</td>` : ''}
            <td>${editorCell(c)}</td>
            <td><button class="btn ghost sm" data-act="video" data-id="${c.id}">${icon('ext')}</button></td>
          </tr>
        `).join('') || '<tr><td colspan="12" class="empty">Tidak ada video</td></tr>'}
      </tbody></table></div>
      <div class="pagination">
        <button class="btn ghost sm" data-act="page" data-v="-1" ${k.page === 1 ? 'disabled' : ''}>${icon('left')}</button>
        <span>Halaman ${k.page} / ${totalPages}</span>
        <button class="btn ghost sm" data-act="page" data-v="1" ${k.page === totalPages ? 'disabled' : ''}>${icon('right')}</button>
      </div>
    </section>

    ${isAdmin() && S.sel.size ? `
      <section class="card"><div class="card-h"><h2>Aksi Massal (${S.sel.size} video terpilih)</h2></div>
        <div class="tools"><select class="input" id="bulk-editor" style="width:auto"><option value="">Pilih karyawan…</option>${activeEditors().map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select>
        <button class="btn primary" data-act="bulk-assign">${icon('team')} Tetapkan ke karyawan</button></div>
      </section>
    ` : ''}
  `;
}

function kontenRows() {
  const S = getState();
  const k = S.konten;
  let rows = S.content;
  if (k.q) rows = rows.filter((c) => c.judul.toLowerCase().includes(k.q.toLowerCase()));
  if (k.channel !== 'all') rows = rows.filter((c) => c._ch === k.channel);
  if (k.editor === 'unmatched') rows = rows.filter((c) => !c.editor_id);
  else if (k.editor !== 'all') rows = rows.filter((c) => c.editor_id === +k.editor);
  if (k.tipe !== 'all') rows = rows.filter((c) => c.tipe_video === k.tipe);
  if (k.periode !== 'all') {
    const days = Array.from({ length: +k.periode }, (_, i) => addDays(today(), -i));
    rows = rows.filter((c) => days.includes(c._day));
  }
  rows.sort((a, b) => {
    let av, bv;
    switch (k.sort) {
      case 'tanggal': av = a.tanggal_upload; bv = b.tanggal_upload; break;
      case 'channel': av = a._chNama; bv = b._chNama; break;
      case 'judul': av = a.judul; bv = b.judul; break;
      case 'views': av = a.views; bv = b.views; break;
      case 'editor': av = editorById(a.editor_id)?.nama || ''; bv = editorById(b.editor_id)?.nama || ''; break;
      default: return 0;
    }
    return k.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });
  return rows;
}


export function exportCsv() {
  const rows = kontenRows();
  const head = ['Tanggal', 'Jam (WIB)', 'Channel', 'Pembuat', 'Judul', 'Jenis', 'Views', 'Like', 'Komentar', 'Durasi (detik)', 'URL'];
  const csvEscape = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [head, ...rows.map((c) => [c._day, c._jam, c._chNama, (editorById(c.editor_id) || {}).nama || '', c.judul, c.tipe_video, c.views, c.likes, c.comments, c.duration_secs, c.url])].map((r) => r.map(csvEscape).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'konten-tokder-' + today() + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export { kontenRows };
