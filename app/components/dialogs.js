// app/components/dialogs.js - Dialog/overlay management
import { getState, isAdmin, me, canAssign } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, toast, today, addDays, TUGAS, TUGAS_LAIN, peranLabel } from '../core/utils.js';
import { activeEditors, editorById } from './nav.js';

export function loginDialog() {
  const S = getState();
  const eds = activeEditors();
  const tabs = { karyawan: 'Karyawan', admin: 'Pemilik' };
  
  function renderTab(tab) {
    return `
      <h2>Masuk</h2>
      <div class="seg" role="group" aria-label="Masuk sebagai">
        <button data-tab="karyawan" aria-pressed="${tab === 'karyawan'}">Karyawan</button>
        <button data-tab="admin" aria-pressed="${tab === 'admin'}">Pemilik</button>
      </div>
      <form id="login-form" class="dialog-form" style="display:flex;flex-direction:column;gap:12px">
        ${tab === 'karyawan' ? `
          <label class="field"><span>Nama</span><select class="input" name="editor" required>${eds.map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select></label>
          <label class="field"><span>PIN</span><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required><small>PIN diberikan pemilik. Belum punya? Minta pemilik mengaturnya di menu Karyawan.</small></label>`
        : `<label class="field"><span>Password pemilik</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>`}
        <div class="err" id="login-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Masuk</button></div>
      </form>
    `;
  }
  
  openDialog(renderTab('karyawan'), (d) => {
    $$('[data-tab]', d).forEach((b) => b.addEventListener('click', () => {
      d.querySelector('.dialog').innerHTML = renderTab(b.dataset.tab);
      setupForm(d);
    }));
    setupForm(d);
  });
  
  function setupForm(d) {
    $('#login-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      try {
        if (f.get('password')) {
          await api('/api/auth/login', { method: 'POST', body: { password: f.get('password') } });
          import('../core/state.js').then(m => m.setSession({ type: 'admin' }));
        } else {
          const r = await api('/api/auth/editor-login', { method: 'POST', body: { editor_id: +f.get('editor'), pin: f.get('pin') } });
          import('../core/state.js').then(m => m.setSession({ type: 'karyawan', id: r.id, nama: r.nama }));
        }
        closeOverlay();
        toast('Berhasil masuk');
        import('./nav.js').then(m => m.renderNav());
        import('../core/api.js').then(m => m.fetchAll());
      } catch (e) { $('#login-err', d).textContent = e.message; }
    });
  }
}

export function catatDialog(editorId) {
  const S = getState();
  const who = isAdmin() ? (editorById(editorId) || activeEditors()[0]) : me(editorById);
  if (!who) return loginDialog();
  const jenis = [...TUGAS.map((t) => t.nama), ...TUGAS_LAIN];
  
  openDialog(`
    <h2>Catat aktivitas</h2>
    <form id="catat-form" style="display:flex;flex-direction:column;gap:12px">
      ${isAdmin() ? `<label class="field"><span>Karyawan</span><select class="input" name="editor_id">${activeEditors().map((e) => `<option value="${e.id}" ${e.id === who.id ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}</select></label>` : `<p>Dicatat sebagai <b>${esc(who.nama)}</b>.</p>`}
      <div class="row">
        <label class="field"><span>Tanggal</span><input class="input" type="date" name="tanggal" value="${S.day > today() ? today() : S.day}" max="${today()}" required></label>
        <label class="field"><span>Jam</span><input class="input" type="time" name="jam" value="${nowJam()}" required></label>
      </div>
      <label class="field"><span>Jenis tugas</span><select class="input" name="tugas" required>${jenis.map((j) => `<option value="${esc(j)}">${esc(j)}</option>`).join('')}</select></label>
      <label class="field"><span>Jumlah</span><input class="input" type="number" name="jumlah" value="1" min="1" max="9999" required></label>
      <label class="field"><span>Detail</span><textarea class="input" name="detail" rows="2" maxlength="300" placeholder="Opsional"></textarea></label>
      <label class="field"><span>Channel</span><select class="input" name="channel_id"><option value="">—</option>${S.channels.map((c) => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
      <div class="err" id="catat-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div>
    </form>`, (d) => {
    $('#catat-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const editorId = isAdmin() ? Number(f.get('editor_id')) : who.id;
      const tanggal = f.get('tanggal');
      const jam = f.get('jam');
      const tugas = f.get('tugas');
      const jumlah = Math.max(1, Math.min(9999, parseInt(f.get('jumlah'), 10) || 1));
      const detail = f.get('detail') || '';
      const channel_id = f.get('channel_id') || null;
      
      if (!editorId) return $('#catat-err', d).textContent = 'Pilih karyawan';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return $('#catat-err', d).textContent = 'Format tanggal salah';
      if (!/^\d{2}:\d{2}$/.test(jam)) return $('#catat-err', d).textContent = 'Format jam salah';
      if (!tugas) return $('#catat-err', d).textContent = 'Jenis tugas wajib diisi';
      if (!isAdmin() && tanggal < addDays(today(), -2)) return $('#catat-err', d).textContent = 'Karyawan hanya bisa mencatat 2 hari terakhir';
      
      try {
        await api('/api/aktivitas', { method: 'POST', body: { editor_id: editorId, tanggal, jam, tugas, detail, jumlah, channel_id } });
        closeOverlay();
        toast('Aktivitas dicatat');
        import('../core/api.js').then(m => m.fetchAll());
      } catch (e) { $('#catat-err', d).textContent = e.message; }
    });
  });
}

export function editorDialog(editorId) {
  const S = getState();
  const editing = editorId ? editorById(editorId) : null;
  const eds = activeEditors();
  
  openDialog(`
    <h2>${editing ? 'Ubah karyawan' : 'Tambah karyawan'}</h2>
    <form id="editor-form" style="display:flex;flex-direction:column;gap:12px">
      <label class="field"><span>Nama</span><input class="input" name="nama" value="${editing ? esc(editing.nama) : ''}" required maxlength="100"></label>
      <label class="field"><span>Kode identifikasi</span><input class="input" name="kode" value="${editing ? esc(editing.kode_identifikasi) : ''}" required placeholder="AL" style="text-transform:uppercase" maxlength="10"></label>
      <label class="field"><span>Peran</span><select class="input" name="peran">${['editor', 'terbatas'].map((p) => `<option value="${p}" ${editing && editing.peran === p ? 'selected' : ''}>${peranLabel(p)}</option>`).join('')}</select></label>
      <label class="field"><span>Status</span><select class="input" name="status">${['aktif', 'nonaktif'].map((s) => `<option value="${s}" ${editing && editing.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}</select></label>
      <label class="field"><span>Target harian</span><input class="input" type="number" name="target_harian" value="${editing ? editing.target_harian : 3}" min="1" max="50" required></label>
      <label class="field"><span>Link foto (https://)</span><input class="input" name="foto_url" value="${editing ? esc(editing.foto_url || '') : ''}" placeholder="https://..."></label>
      <label class="field"><span>${editing && editing.punya_pin ? 'PIN baru (kosongkan bila tidak diganti)' : 'PIN untuk masuk'}</span><input class="input" name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" autocomplete="new-password" placeholder="4–12 angka"></label>
      ${editing && editing.punya_pin ? '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="hapus_pin"> Hapus PIN (karyawan tidak bisa masuk)</label>' : ''}
      <label class="field"><span>Jadwal (WIB, pisah koma)</span><input class="input" name="jadwal" value="${editing ? esc(editing.jadwal || '') : ''}" placeholder="06:00, 12:30, 18:00"></label>
      <div class="err" id="ed-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">${editing ? 'Simpan' : 'Tambah'}</button></div>
    </form>`, (d) => {
    $('#editor-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const body = { nama: f.get('nama'), kode: f.get('kode'), peran: f.get('peran'), status: f.get('status'), target_harian: f.get('target_harian'), foto_url: f.get('foto_url'), jadwal: f.get('jadwal') };
      if (f.get('pin')) { if (!/^\d{4,12}$/.test(f.get('pin'))) return $('#ed-err', d).textContent = 'PIN 4–12 angka'; body.pin = f.get('pin'); }
      body.hapus_pin = !!f.get('hapus_pin');
      if (!body.pin) delete body.pin;
      
      try {
        if (editing) await api('/api/editors/' + editing.id, { method: 'PUT', body });
        else await api('/api/editors', { method: 'POST', body });
        closeOverlay();
        toast(editing ? 'Karyawan diperbarui' : 'Karyawan ditambahkan');
        import('../core/api.js').then(m => m.fetchAll());
      } catch (e) { $('#ed-err', d).textContent = e.message; }
    });
  });
}

export function goalDialog() {
  const S = getState();
  const g = S.goal || { target_omset: 0, tercapai: 0 };
  const bulan = new Date().toISOString().slice(0, 7);
  
  openDialog(`
    <h2>Target omset (${bulan})</h2>
    <form id="goal-form" style="display:flex;flex-direction:column;gap:12px">
      <label class="field"><span>Target omset (USD)</span><input class="input" type="number" name="target" step="0.01" min="0" value="${g.target_omset}" required></label>
      <label class="field"><span>Tercapai (USD)</span><input class="input" type="number" name="tercapai" step="0.01" min="0" value="${g.tercapai}" required></label>
      <div class="err" id="goal-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div>
    </form>`, (d) => {
    $('#goal-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      const target = Number(f.get('target'));
      const tercapai = Number(f.get('tercapai'));
      if (!Number.isFinite(target) || target < 0) return $('#goal-err', d).textContent = 'Target tidak valid';
      if (!Number.isFinite(tercapai) || tercapai < 0) return $('#goal-err', d).textContent = 'Tercapai tidak valid';
      try {
        await api('/api/goals', { method: 'PUT', body: { bulan, target_omset: target, tercapai } });
        closeOverlay();
        toast('Target disimpan');
        import('../core/api.js').then(m => m.fetchAll());
      } catch (e) { $('#goal-err', d).textContent = e.message; }
    });
  });
}

export function confirmDialog(title, msg, okLabel, onOk) {
  openDialog(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="actions"><button class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`, (d) => {
    $('#ok', d).addEventListener('click', async () => { closeOverlay(); await onOk(); });
  });
}

export function openDialog(html, onMount) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="scrim" data-act="close-overlay"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $('input, select, textarea, button', ov.querySelector('.dialog'));
  if (first) first.focus();
  if (onMount) onMount(ov.querySelector('.dialog'));
}

export const closeOverlay = () => { $('#overlay').innerHTML = ''; };

import { nowJam } from '../core/utils.js';