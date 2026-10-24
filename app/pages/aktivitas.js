// app/pages/aktivitas.js - Aktivitas page
import { getState, isAdmin, me, canLog } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, fmt, pct, tglPanjang, addDays, avatar } from '../core/utils.js';
import { today } from '../core/utils.js';
import { catatDialog, confirmDialog } from '../components/dialogs.js';
import { editorById, activeEditors } from '../components/nav.js';

export function renderAktivitas() {
  const S = getState();
  const who = me(editorById);
  const editors = activeEditors();
  const rows = S.aktivitas;

  // Summary
  const summary = {};
  rows.forEach((a) => {
    const key = a.tugas;
    if (!summary[key]) summary[key] = { count: 0, jumlah: 0 };
    summary[key].count++;
    summary[key].jumlah += a.jumlah;
  });

  return `
    <section class="card"><div class="card-h"><h2>Aktivitas${who ? ` — ${who.nama}` : ''} ${canLog(editorById) ? `<button class="btn ghost sm" data-act="catat" data-id="${who?.id || ''}">${icon('plus')}Catat</button>` : ''}</h2></div>
      <div class="grid-4">
        ${Object.entries(summary).map(([tugas, data]) => `<div class="stat"><span>${esc(tugas)}</span><b>${data.jumlah}</b><div class="d">${data.count} catatan</div></div>`).join('') || '<div class="empty">Belum ada aktivitas</div>'}
      </div>
      <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Karyawan</th><th>Jam</th><th>Tugas</th><th>Jumlah</th><th>Detail</th><th></th></tr></thead><tbody>
        ${rows.map((a) => {
          const e = editorById(a.editor_id);
          return `<tr>
            <td>${tglPanjang(a.tanggal)}</td>
            <td>${e ? avatar(e) + esc(e.nama) : '—'}</td>
            <td>${a.jam}</td>
            <td>${esc(a.tugas)}</td>
            <td>${a.jumlah}</td>
            <td>${esc(a.detail || '')}</td>
            <td>${isAdmin() || (who && who.id === a.editor_id) ? `<button class="btn ghost sm" data-act="hapus-aktivitas" data-id="${a.id}">${icon('x')}</button>` : ''}</td>
          </tr>`;
        }).join('') || '<tr><td colspan="7" class="empty">Belum ada aktivitas</td></tr>'}
      </tbody></table></div>
    </section>
  `;
}