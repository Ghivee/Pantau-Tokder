// app/pages/pengaturan.js - Pengaturan page (Admin only)
import { getState, isAdmin } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, today, addDays, usd } from '../core/utils.js';
import { goalDialog, confirmDialog } from '../components/dialogs.js';

export function renderPengaturan() {
  const S = getState();
  if (!isAdmin()) return '<div class="empty"><b>Akses ditolak</b><br>Hanya pemilik yang bisa mengakses pengaturan.</div>';

  return `
    <section class="card"><div class="card-h"><h2>Channel Dipantau</h2></div>
      <p>Daftar channel YouTube yang dipantau. Data video & analytics diambil dari channel ini.</p>
      <div class="tools">
        <button class="btn primary" data-act="edit-channels">${icon('plus')}Kelola Channel</button>
      </div>
      <ul class="channel-list">
        ${S.channels.map((c) => `<li><span class="ava" style="background:${c._color}">${esc((c.nama || '?').slice(0,1).toUpperCase())}</span><span>${esc(c.nama)}</span><small>${c.jumlah_video} video</small></li>`).join('')}
      </ul>
    </section>

    <section class="card"><div class="card-h"><h2>YouTube Analytics</h2></div>
      <p>Sambungkan channel ke YouTube Analytics untuk data views, menit tonton, pendapatan, dll.</p>
      <div class="tools">
        ${S.oauth?.channels?.filter((c) => c.connected).map((c) => `
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <span class="pill ok">${esc(c.nama)} tersambung</span>
            <button class="btn ghost sm danger" data-act="putus-analytics" data-id="${esc(c.id)}">${icon('x')} Putuskan</button>
          </div>
        `).join('') || '<span class="pill warn">Belum ada channel tersambung</span>'}
        ${S.channels.filter((c) => !(S.oauth?.channels?.some((o) => o.id === c.id && o.connected))).map((c) => `
          <a class="btn" href="/api/auth/google">${icon('plus')}Hubungkan ${esc(c.nama)}</a>
        `).join('')}</div>
    </section>

    <section class="card"><div class="card-h"><h2>Ganti Password Pemilik</h2></div>
      <form id="pw-form" class="dialog-form" style="display:flex;flex-direction:column;gap:12px;max-width:400px">
        <label class="field"><span>Password baru (min 8 karakter)</span><input class="input" type="password" id="pw-baru" autocomplete="new-password" required minlength="8" placeholder="Masukkan password baru"></label>
        <div class="err" id="pw-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn primary" data-act="ganti-pw">Simpan</button></div>
      </form>
    </section>

    <section class="card"><div class="card-h"><h2>Target Omset Bulanan</h2></div>
      <div class="tools"><button class="btn primary" data-act="goal">${icon('money')}Atur Target</button></div>
      ${S.goal ? `<p>Target: <b>${usd(S.goal.target_omset)}</b> | Tercapai: <b>${usd(S.goal.tercapai)}</b> | Sisa: <b>${usd(Math.max(0, S.goal.target_omset - S.goal.tercapai))}</b></p>` : '<p class="empty">Belum ada target disetel.</p>'}
    </section>

    <section class="card"><div class="card-h"><h2>Sinkronisasi Data</h2></div>
      <div class="tools">
        <button class="btn primary" data-act="sync" id="sync-btn">${icon('sync')} Sinkronkan Sekarang</button>
        <span id="scan-status" class="scan-status"></span>
      </div>
      ${S.scan?.last_scan ? `<p>Terakhir sinkron: ${new Date(S.scan.last_scan.waktu_scan || S.scan.last_scan.created_at).toLocaleString('id-ID')}</p>` : '<p class="empty">Belum pernah sinkron</p>'}
      ${S.scan?.errors?.length ? `<details><summary>${S.scan.errors.length} catatan error (klik untuk lihat)</summary><pre>${esc(S.scan.errors.join('\n'))}</pre></details>` : ''}
    </section>

    <section class="card"><div class="card-h"><h2>Tema</h2></div>
      <div class="tools">
        <button class="btn ghost" data-act="theme">${icon('moon')} Toggle Gelap/Terang</button>
      </div>
    </section>
  `;
}