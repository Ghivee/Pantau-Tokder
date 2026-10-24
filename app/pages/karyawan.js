// app/pages/karyawan.js - Karyawan page (Admin only)
import { getState, isAdmin } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, fmt, avatar, peranLabel } from '../core/utils.js';
import { editorDialog } from '../components/dialogs.js';
import { editorById, activeEditors, confirmDialog } from '../components/nav.js';

export function renderKaryawan() {
  const S = getState();
  if (!isAdmin()) return '<div class="empty"><b>Akses ditolak</b><br>Hanya pemilik yang bisa mengelola karyawan.</div>';
  const editors = S.editors;

  return `
    <section class="card"><div class="card-h"><h2>Karyawan <button class="btn primary" data-act="editor-form">${icon('plus')}Tambah karyawan</button></h2></div>
      <div class="list">
        ${editors.map((e) => `
          <article class="member">
            ${avatar(e)}
            <div class="m-info">
              <div><b>${esc(e.nama)}</b> <span class="pill ${e.peran === 'terbatas' ? 'warn' : ''}">${peranLabel(e.peran)}</span> <span class="pill ${e.status === 'aktif' ? 'ok' : 'warn'}">${e.status}</span></div>
              <div class="m-meta">
                <span>Kode: <b>${esc(e.kode_identifikasi)}</b></span>
                <span>Target: <b>${e.target_harian}/hari</b></span>
                <span>Jadwal: <b>${esc(e.jadwal || '—')}</b></span>
                <dt>PIN</dt><dd>${e.punya_pin ? '<span class="pill ok">Sudah diatur</span>' : '<span class="pill warn">Belum diatur</span>'}</dd>
              </div>
            </div>
            <div class="member-actions">
              <button class="btn sm" data-act="editor-form" data-id="${e.id}">Ubah</button>
              <button class="btn sm ghost danger" data-act="editor-hapus" data-id="${e.id}">Hapus</button>
            </div>
          </article>
        `).join('') || '<div class="empty">Belum ada karyawan</div>'}
      </div>
    </section>
  `;
}