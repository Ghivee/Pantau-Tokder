import { assign, refreshAktivitas } from '../actions.js';
import { activeEditors, api, belumDikenali, editorById, load, normalize } from '../core/data.js';
import { ROUTES, TABS, badgeOf, bisaBuka, menuGroups, navigate, pathOf, route, routeLabel } from '../core/router.js';
import { TUGAS, TUGAS_LAIN, slotsOf, targetOf } from '../core/rules.js';
import { S, canAssign, isAdmin, lihatUang, me } from '../core/state.js';
import { ssoInfo } from '../core/sso.js';
import { $, $$, esc } from '../lib/dom.js';
import { durasi, nf, nowJam, rpOrDash, tglPanjang, today } from '../lib/format.js';
import { avatar, editorCell, peranLabel, thumb, toast } from './bits.js';
import { drawRetention } from './charts.js';
import { closeOverlay, ingatFokus, openDialog } from './dialog.js';
import { icon } from './icons.js';
import { render } from './layout.js';

// Phone: the routes and account actions that don't fit in the bottom bar.
export function moreSheet() {
  const who = me();
  const theme = document.documentElement.dataset.theme;
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const tabs = TABS();
  const groups = S.session ? menuGroups().map((g) => ({ label: g.label, list: g.ids.map((id) => ROUTES.find((x) => x.id === id)).filter((r) => bisaBuka(r) && !tabs.includes(r.id)) })).filter((g) => g.list.length) : [];
  openDialog(`
      ${S.session ? `<div class="who">${who ? avatar(who, 'sm') : '<span class="ava sm" style="background:var(--ink);color:var(--paper)">P</span>'}<div class="t"><b>${who ? esc(who.nama) : 'Pemilik'}</b><small>${who ? peranLabel(who.peran) : 'Akses penuh'}</small></div></div>` : '<h2>Menu</h2>'}
      <div class="sheet-list">
        ${groups.map((g) => `<div class="sheet-label">${g.label}</div>` + g.list.map((r) => `<a href="${pathOf(r.id)}">${icon(r.icon)}${routeLabel(r)}${badgeOf(r.id) ? `<span class="count">${badgeOf(r.id)}</span>` : ''}</a>`).join('')).join('')}
        <div class="sheet-label">Akun</div>
        <button data-act="theme">${icon(dark ? 'sun' : 'moon')}${dark ? 'Mode terang' : 'Mode gelap'}</button>
        ${S.session ? `<button data-act="logout">${icon('out')}Keluar</button>` : `<button data-act="login">${icon('out')}Masuk</button>`}
      </div>`);
}

export async function loginDialog(tab = 'karyawan') {
  let eds = [];
  if (tab === 'karyawan') {
    try { eds = await api('/api/auth/karyawan'); } catch (e) { toast(e.message, true); }
  }
  const sso = await ssoInfo();
  openDialog(`
      <h2>Masuk</h2>
      ${sso.aktif ? '<button type="button" class="btn primary" data-act="sso-master" data-url="' + esc(sso.masterUrl) + '" style="width:100%;margin-bottom:12px">Masuk dengan Master</button><p class="muted" style="text-align:center;margin:0 0 12px">atau pakai PIN / password Pantau</p>' : ''}
      <div class="seg" role="group" aria-label="Masuk sebagai"><button data-tab="karyawan" aria-pressed="${tab === 'karyawan'}">Karyawan</button><button data-tab="admin" aria-pressed="${tab === 'admin'}">Pemilik</button></div>
      <form id="login-form" class="dialog-form stack">
        ${tab === 'karyawan' ? `
          <label class="field"><span>Nama</span><select class="input" name="editor" required>${eds.map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('') || '<option value="">Belum ada karyawan dengan PIN</option>'}</select></label>
          <label class="field"><span>PIN</span><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required><small>PIN diberikan pemilik. Belum punya? Minta pemilik mengaturnya di menu Karyawan.</small></label>`
        : `<label class="field"><span>Password pemilik</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>`}
        <div class="err" id="login-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Masuk</button></div>
      </form>`, (d) => {
    $$('[data-tab]', d).forEach((b) => b.addEventListener('click', () => loginDialog(b.dataset.tab)));
    $('#login-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = new FormData(ev.target);
      try {
        const btn = $('button.primary', d);
        btn.disabled = true;
        try {
          if (tab === 'admin') await api('/api/auth/login', { method: 'POST', body: { password: f.get('password') } });
          else await api('/api/auth/editor-login', { method: 'POST', body: { editor_id: +f.get('editor'), pin: f.get('pin') } });
        } finally { btn.disabled = false; }
        closeOverlay();
        toast('Berhasil masuk');
        await load();
        navigate('/aplikasi');
      } catch (e) { $('#login-err', d).textContent = e.message; }
    });
  });
}

export function catatDialog(editorId) {
  const who = isAdmin() ? (editorById(editorId) || activeEditors()[0]) : me();
  if (!who) return loginDialog();
  const jenis = [...TUGAS.map((t) => t.nama), ...TUGAS_LAIN];
  openDialog(`
      <h2>Catat aktivitas</h2>
      <form id="catat-form" class="stack">
        ${isAdmin() ? `<label class="field"><span>Karyawan</span><select class="input" name="editor_id">${activeEditors().map((e) => `<option value="${e.id}" ${e.id === who.id ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}</select></label>` : `<p>Dicatat sebagai <b>${esc(who.nama)}</b>.</p>`}
        <div class="row">
          <label class="field"><span>Tanggal</span><input class="input" type="date" name="tanggal" value="${S.day > today() ? today() : S.day}" max="${today()}" required></label>
          <label class="field"><span>Jam selesai</span><input class="input" type="time" name="jam" value="${nowJam()}" required></label>
        </div>
        <div class="row">
          <label class="field"><span>Tugas</span><select class="input" name="tugas">${jenis.map((j) => `<option>${esc(j)}</option>`).join('')}</select></label>
          <label class="field"><span>Jumlah</span><input class="input" type="number" name="jumlah" min="1" max="9999" value="1" required><small>Komentar: jumlah yang dibalas</small></label>
        </div>
        <label class="field"><span>Channel</span><select class="input" name="channel_id"><option value="">Semua / tidak spesifik</option>${S.channels.map((c) => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
        <label class="field"><span>Keterangan</span><textarea class="input" name="detail" maxlength="300" placeholder="Misal: cek harga rawit di 5 pasar induk"></textarea></label>
        <div class="err" id="catat-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div>
      </form>`, (d) => {
    const tugas = $('[name=tugas]', d), jumlah = $('[name=jumlah]', d);
    tugas.addEventListener('change', () => { if (tugas.value === 'Balas komentar' && jumlah.value === '1') jumlah.value = '10'; });
    $('#catat-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const body = Object.fromEntries(new FormData(ev.target));
      body.editor_id = +(body.editor_id || who.id);
      body.jumlah = +body.jumlah;
      try {
        await api('/api/aktivitas', { method: 'POST', body });
        await refreshAktivitas();
        S.cache.clear();
        closeOverlay();
        S.day = body.tanggal;
        toast('Aktivitas tersimpan');
        if (route() !== 'harian') navigate('/harian'); else render();
      } catch (e) { $('#catat-err', d).textContent = e.message; }
    });
  });
}

export function editorDialog(id) {
  const e = id ? editorById(id) : { nama: '', kode_identifikasi: '', jadwal: '', target_harian: 3, foto_url: '', status: 'aktif' };
  openDialog(`
      <h2>${id ? 'Ubah ' + esc(e.nama) : 'Tambah karyawan'}</h2>
      <p class="muted" style="margin:0">Hak akses diatur per orang di Pengaturan, Akses karyawan.</p>
      <form id="ed-form" class="stack">
        <div class="row">
          <label class="field"><span>Nama</span><input class="input" name="nama" value="${esc(e.nama)}" required maxlength="100"></label>
          <label class="field"><span>Kode</span><input class="input" name="kode" value="${esc(e.kode_identifikasi)}" required maxlength="20" style="text-transform:uppercase"><small>Ditulis di deskripsi video, misal #AL</small></label>
        </div>
        <div class="row">
          <label class="field"><span>Status</span><select class="input" name="status"><option value="aktif" ${e.status !== 'nonaktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${e.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option></select></label>
        </div>
        <div class="row">
          <label class="field"><span>Jadwal tayang</span><input class="input mono" name="jadwal" value="${esc(slotsOf(e).join(', '))}" placeholder="06:00, 12:00, 18:00"><small>Jam WIB, pisahkan dengan koma</small></label>
          <label class="field"><span>Target video per hari</span><input class="input" type="number" name="target_harian" min="1" max="50" value="${targetOf(e)}"></label>
        </div>
        <label class="field"><span>Link foto (opsional)</span><input class="input" name="foto_url" type="url" value="${esc(e.foto_url || '')}" placeholder="https://…"><small>Kosongkan untuk memakai inisial nama</small></label>
        <label class="field"><span>${e.punya_pin ? 'PIN baru (kosongkan bila tidak diganti)' : 'PIN untuk masuk'}</span><input class="input" name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" autocomplete="new-password" placeholder="4–12 angka"></label>
        ${e.punya_pin ? '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="hapus_pin"> Hapus PIN (karyawan tidak bisa masuk)</label>' : ''}
        <div class="err" id="ed-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div>
      </form>`, (d) => {
    $('#ed-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const body = Object.fromEntries(new FormData(ev.target));
      body.kode = body.kode.toUpperCase().replace(/^#/, '');
      body.hapus_pin = !!body.hapus_pin;
      if (body.pin && !/^\d{4,12}$/.test(body.pin)) { $('#ed-err', d).textContent = 'PIN harus 4–12 angka'; return; }
      if (!body.pin) delete body.pin;
      try {
        const saved = await api(id ? '/api/editors/' + id : '/api/editors', { method: id ? 'PUT' : 'POST', body });
        const i = S.editors.findIndex((x) => x.id === saved.id); if (i >= 0) S.editors[i] = saved; else S.editors.push(saved);
        normalize();
        closeOverlay();
        toast('Data karyawan tersimpan');
        render();
      } catch (e2) { $('#ed-err', d).textContent = e2.message; }
    });
  });
}

export function goalDialog() {
  const g = S.goal || { bulan: today().slice(0, 7), target_omset: 0, tercapai: 0 };
  openDialog(`<h2>Target omzet afiliasi</h2><form id="goal-form" class="stack">
      <p>Bulan ${esc(g.bulan)}</p>
      <div class="row"><label class="field"><span>Target (Rp)</span><input class="input" type="number" name="target_omset" min="0" value="${+g.target_omset || 0}"></label>
      <label class="field"><span>Tercapai (Rp)</span><input class="input" type="number" name="tercapai" min="0" value="${+g.tercapai || 0}"></label></div>
      <div class="err" id="goal-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div></form>`, (d) => {
    $('#goal-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      try {
        const r = await api('/api/goals', { method: 'PUT', body: { bulan: g.bulan, target_omset: +f.target_omset, tercapai: +f.tercapai } });
        S.goal = r || { ...g, target_omset: +f.target_omset, tercapai: +f.tercapai };
        closeOverlay(); toast('Target tersimpan'); render();
      } catch (e) { $('#goal-err', d).textContent = e.message; }
    });
  });
}

export function videoDrawer(id) {
  const c = S.content.find((x) => x.id === +id);
  if (!c) return;
  const e = editorById(c.editor_id);
  const connected = S.connected.has(c._ch);
  ingatFokus();
  $('#overlay').innerHTML = `<div class="scrim drawer-scrim" data-act="close-overlay"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Detail video">
        <div class="drawer-top"><h2>${esc(c.judul)}</h2><button class="btn icon ghost" data-act="close-overlay" aria-label="Tutup">${icon('x')}</button></div>
        ${thumb(c) ? `<img class="hero" src="${thumb(c).replace('mqdefault', 'hqdefault')}" alt="">` : ''}
        <div class="muted">${esc(c._chNama)} · ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'} · ${tglPanjang(c._day)} jam ${c._jam} WIB · durasi ${durasi(c.duration_secs)}</div>
        <div class="stats"><div><span>Views</span><b>${nf.format(c.views)}</b></div><div><span>Like</span><b>${nf.format(c.likes)}</b></div><div><span>Komentar</span><b>${nf.format(c.comments)}</b></div>${lihatUang() ? `<div><span>Pendapatan</span><b>${rpOrDash(c.revenue)}</b></div>` : ''}</div>
        <div><div class="card-h mb-6"><h2>Pembuat</h2></div>
          ${editorCell(c)}
          ${canAssign() && (isAdmin() || belumDikenali(c)) ? `<div class="tools mt-10"><select class="input w-auto" id="dr-assign"><option value="">${e ? 'Ganti pembuat…' : 'Tetapkan pembuat…'}</option>${activeEditors().map((x) => `<option value="${x.id}">${me() ? 'Ini video saya' : esc(x.nama)}</option>`).join('')}</select></div>` : ''}
        </div>
        <div><div class="card-h mb-6"><h2>Retensi penonton</h2><p>Dari YouTube Analytics.</p></div>
          <div class="chart" id="dr-ret" style="min-height:120px"><div class="skeleton" style="height:170px"></div></div></div>
        <a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">${icon('ext')}Buka di YouTube</a>
      </aside>`;
  const box = $('#dr-ret');
  api('/api/content/' + c.id).then((full) => {
    if (!box.isConnected) return;
    let ret = full.retention_data;
    if (typeof ret === 'string') { try { ret = JSON.parse(ret); } catch (e) { ret = null; } }
    if (Array.isArray(ret) && ret.length) { drawRetention(box, ret); return; }
    // The server asked YouTube just now when nothing was stored; it says why there is no curve.
    const why = {
      tidak_tersambung: esc(c._chNama) + ' belum tersambung ke YouTube Analytics. ' + (isAdmin() ? 'Hubungkan di Pengaturan.' : 'Minta pemilik menghubungkannya di Pengaturan.'),
      error: esc(full.retensi_pesan || 'YouTube Analytics tidak bisa dihubungi.'),
      belum_ada: c._age < 3
        ? 'YouTube biasanya baru mengeluarkan retensi 2–3 hari setelah video tayang. Dicek ulang otomatis.'
        : 'YouTube belum punya kurva retensi untuk video ini, biasanya karena penontonnya masih sedikit. Dicek ulang paling lama 6 jam sekali.',
    }[full.retensi_status] || (connected ? 'Belum ada data dari YouTube Analytics.' : esc(c._chNama) + ' belum tersambung ke YouTube Analytics.');
    box.innerHTML = `<div class="empty"><b>${full.retensi_status === 'error' ? 'Retensi tidak bisa diambil' : 'Belum ada data retensi'}</b>${why}</div>`;
  }).catch((e) => { if (box.isConnected) box.innerHTML = `<div class="empty"><b>Retensi gagal dimuat</b>${esc(e.message)}</div>`; });
  const s = $('#dr-assign');
  if (s) s.addEventListener('change', () => { if (s.value) { closeOverlay(); assign([c.id], +s.value); } });
  $('.drawer .btn').focus();
}
