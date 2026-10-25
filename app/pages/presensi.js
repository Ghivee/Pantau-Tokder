// app/pages/presensi.js - Presensi page: employees check in/out, the owner sees the recap and sets the rules
import { getState, isAdmin, me } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, tglPanjang, today, addDays, toMin, toast, $ } from '../core/utils.js';
import { editorById, activeEditors } from '../components/nav.js';

const jamWib = (iso) => (iso ? new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace('.', ':') : '—');
const waktuWib = (iso) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const meter = (v) => (v == null ? '—' : Math.round(v) + ' m');

export async function loadPresensi() {
  const S = getState();
  const q = '?dari=' + addDays(today(), -30) + '&sampai=' + today();
  const [config, rows, ditolak] = await Promise.all([
    api('/api/presensi/config'),
    api('/api/presensi' + q),
    api('/api/presensi/ditolak' + q),
  ]);
  S.presensi = { config, rows, ditolak, loaded: true };
}

// One day of one person: { masuk, pulang } rows.
function hari(rows, editorId, tanggal) {
  const r = rows.filter((x) => x.editor_id === editorId && x.tanggal === tanggal);
  return { masuk: r.find((x) => x.jenis === 'masuk') || null, pulang: r.find((x) => x.jenis === 'pulang') || null };
}

function statusPill(h, cfg, tanggal) {
  if (!h.masuk) return tanggal === today() ? '<span class="pill warn">Belum absen</span>' : '<span class="pill bad">Tidak hadir</span>';
  const parts = [h.masuk.telat_menit > 0 ? `<span class="pill bad">Telat ${h.masuk.telat_menit} mnt</span>` : '<span class="pill ok">Tepat waktu</span>'];
  if (h.pulang && cfg && cfg.jam_pulang) {
    const cepat = toMin(cfg.jam_pulang) - toMin(jamWib(h.pulang.waktu));
    if (cepat > 0) parts.push(`<span class="pill warn">Pulang ${cepat} mnt lebih awal</span>`);
  }
  return parts.join(' ');
}

function jaringan(cfg) {
  return cfg.ip_kantor
    ? `<span class="pill ok">Wi-Fi kantor</span> <span class="muted">IP ${esc(cfg.ip_anda)}</span>`
    : `<span class="pill bad">Bukan Wi-Fi kantor</span> <span class="muted">IP ${esc(cfg.ip_anda)}</span>`;
}

function ditolakTable(list, showName) {
  if (!list.length) return '<p class="empty">Tidak ada percobaan yang ditolak dalam 30 hari terakhir.</p>';
  // Employees only need to know when and why; the technical columns are for the owner.
  if (!showName) {
    return `<div class="table-wrap"><table class="t"><thead><tr><th>Waktu</th><th>Alasan</th></tr></thead><tbody>
      ${list.map((d) => `<tr><td style="white-space:nowrap">${waktuWib(d.waktu)}<br><span class="muted">${esc(d.jenis)}</span></td><td>${esc(d.alasan)}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
  return `<div class="table-wrap"><table class="t"><thead><tr><th>Waktu</th>${showName ? '<th>Karyawan</th>' : ''}<th>Jenis</th><th>Alasan</th><th>IP</th><th>Akurasi</th><th>Jarak</th></tr></thead><tbody>
    ${list.map((d) => `<tr><td>${waktuWib(d.waktu)}</td>${showName ? `<td>${esc((editorById(d.editor_id) || {}).nama || '—')}</td>` : ''}<td>${esc(d.jenis)}</td><td>${esc(d.alasan)}</td><td>${esc(d.ip)}</td><td>${meter(d.akurasi)}</td><td>${meter(d.jarak)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

function renderKaryawan(who, P) {
  const cfg = P.config;
  const h = hari(P.rows, who.id, today());
  const days = [...new Set(P.rows.map((r) => r.tanggal))].sort().reverse();
  return `
    <section class="card"><div class="card-h"><h2>Presensi — ${tglPanjang(today())}</h2></div>
      ${!cfg.siap ? '<div class="notice warn">Presensi belum diatur pemilik (lokasi dan IP Wi-Fi kantor). Minta pemilik mengaturnya.</div>' : ''}
      <div class="grid-3">
        <div class="stat"><span>Masuk</span><b>${jamWib(h.masuk && h.masuk.waktu)}</b><div class="d">Jam masuk ${esc(cfg.jam_masuk)}, toleransi ${cfg.toleransi} mnt</div></div>
        <div class="stat"><span>Pulang</span><b>${jamWib(h.pulang && h.pulang.waktu)}</b><div class="d">Jam pulang ${esc(cfg.jam_pulang)}</div></div>
        <div class="stat"><span>Status</span><b style="font-size:15px">${statusPill(h, cfg, today())}</b><div class="d">${jaringan(cfg)}</div></div>
      </div>
      <div class="tools" style="margin-top:14px">
        <button class="btn primary" data-act="absen" data-jenis="masuk" ${h.masuk || !cfg.siap ? 'disabled' : ''}>${icon('pin')} Absen masuk</button>
        <button class="btn" data-act="absen" data-jenis="pulang" ${!h.masuk || h.pulang || !cfg.siap ? 'disabled' : ''}>${icon('out')} Absen pulang</button>
      </div>
      <p class="muted" id="absen-status" role="status" style="margin-top:10px">Syarat: tersambung ke Wi-Fi kantor, GPS menyala dengan akurasi ≤ ${cfg.akurasi_maks} m, dan berada dalam ${cfg.radius} m dari kantor. Izinkan akses lokasi saat diminta browser.</p>
    </section>
    <section class="card"><div class="card-h"><h2>Riwayat 30 hari</h2></div>
      ${days.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead><tbody>
        ${days.map((d) => { const x = hari(P.rows, who.id, d); return `<tr><td>${tglPanjang(d)}</td><td>${jamWib(x.masuk && x.masuk.waktu)}</td><td>${jamWib(x.pulang && x.pulang.waktu)}</td><td>${statusPill(x, cfg, d)}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="empty">Belum ada presensi.</p>'}
    </section>
    <section class="card"><div class="card-h"><h2>Percobaan yang ditolak</h2></div>${ditolakTable(P.ditolak, false)}</section>`;
}

function renderPemilik(P) {
  const cfg = P.config;
  const eds = activeEditors();
  const t = today();
  const hadir = eds.filter((e) => hari(P.rows, e.id, t).masuk).length;
  const rekap = eds.map((e) => {
    const masuk = P.rows.filter((r) => r.editor_id === e.id && r.jenis === 'masuk');
    const telat = masuk.filter((r) => r.telat_menit > 0);
    return { e, hadir: masuk.length, telat: telat.length, menit: telat.reduce((s, r) => s + r.telat_menit, 0), ditolak: P.ditolak.filter((d) => d.editor_id === e.id).length };
  });
  return `
    <section class="card"><div class="card-h"><h2>Presensi hari ini — ${tglPanjang(t)}</h2><span class="pill ${hadir === eds.length ? 'ok' : 'warn'}">${hadir}/${eds.length} hadir</span></div>
      ${!cfg.siap ? '<div class="notice warn">Presensi belum bisa dipakai. Isi lokasi kantor dan IP Wi-Fi kantor di bawah.</div>' : ''}
      <div class="table-wrap"><table class="t"><thead><tr><th>Karyawan</th><th>Masuk</th><th>Pulang</th><th>Status</th><th>Jarak</th><th>Akurasi</th></tr></thead><tbody>
        ${eds.map((e) => { const h = hari(P.rows, e.id, t); return `<tr><td>${esc(e.nama)}</td><td>${jamWib(h.masuk && h.masuk.waktu)}</td><td>${jamWib(h.pulang && h.pulang.waktu)}</td><td>${statusPill(h, cfg, t)}</td><td>${meter(h.masuk && h.masuk.jarak)}</td><td>${meter(h.masuk && h.masuk.akurasi)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Belum ada karyawan aktif</td></tr>'}
      </tbody></table></div>
    </section>
    <section class="card"><div class="card-h"><h2>Rekap 30 hari</h2></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Karyawan</th><th>Hadir</th><th>Telat</th><th>Total telat</th><th>Percobaan ditolak</th></tr></thead><tbody>
        ${rekap.map((r) => `<tr><td>${esc(r.e.nama)}</td><td>${r.hadir} hari</td><td>${r.telat}×</td><td>${r.menit} mnt</td><td>${r.ditolak ? `<span class="pill bad">${r.ditolak}</span>` : '0'}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="card"><div class="card-h"><h2>Percobaan yang ditolak</h2></div>
      <p class="muted">Banyak penolakan "bukan Wi-Fi kantor", "akurasi tidak wajar" atau "lokasi berpindah" dari satu orang bisa menandakan percobaan curang.</p>
      ${ditolakTable(P.ditolak, true)}
    </section>
    <section class="card"><div class="card-h"><h2>Aturan presensi</h2></div>
      <form id="presensi-form" style="display:flex;flex-direction:column;gap:12px;max-width:560px">
        <p class="muted" style="margin:0">Absen hanya diterima jika <b>ketiganya</b> terpenuhi: IP internet sama dengan Wi-Fi kantor, akurasi GPS cukup baik, dan posisi di dalam radius kantor.</p>
        <div class="row">
          <label class="field"><span>Lintang (lat) kantor</span><input class="input" name="lat" inputmode="decimal" value="${cfg.lat ?? ''}" placeholder="-6.200000" required></label>
          <label class="field"><span>Bujur (lng) kantor</span><input class="input" name="lng" inputmode="decimal" value="${cfg.lng ?? ''}" placeholder="106.816666" required></label>
        </div>
        <div class="tools"><button type="button" class="btn ghost sm" data-act="presensi-lokasi-saya">${icon('pin')} Pakai lokasi saya sekarang</button><span class="muted" id="lokasi-info"></span></div>
        <div class="row">
          <label class="field"><span>Radius kantor (meter)</span><input class="input" name="radius" type="number" min="20" max="2000" value="${cfg.radius}" required></label>
          <label class="field"><span>Akurasi GPS maksimal (meter)</span><input class="input" name="akurasi_maks" type="number" min="5" max="500" value="${cfg.akurasi_maks}" required></label>
        </div>
        <label class="field"><span>IP publik Wi-Fi kantor (satu per baris; boleh rentang seperti 203.0.113.0/24)</span>
          <textarea class="input" name="ips" rows="3" style="font-family:var(--mono, monospace)" required>${esc((cfg.ips || []).join('\n'))}</textarea>
          <small>IP Anda sekarang: <b>${esc(cfg.ip_anda)}</b> ${cfg.ip_kantor ? '(sudah terdaftar)' : '(belum terdaftar)'}. Buka halaman ini dari Wi-Fi kantor lalu klik tombol di bawah.</small></label>
        <div class="tools"><button type="button" class="btn ghost sm" data-act="presensi-ip-saya" data-ip="${esc(cfg.ip_saran || cfg.ip_anda)}">${icon('plus')} Tambahkan IP saya</button></div>
        <div class="row">
          <label class="field"><span>Jam masuk (WIB)</span><input class="input" name="jam_masuk" type="time" value="${esc(cfg.jam_masuk)}" required></label>
          <label class="field"><span>Toleransi telat (menit)</span><input class="input" name="toleransi" type="number" min="0" max="120" value="${cfg.toleransi}" required></label>
          <label class="field"><span>Jam pulang (WIB)</span><input class="input" name="jam_pulang" type="time" value="${esc(cfg.jam_pulang)}" required></label>
        </div>
        <div class="err" id="presensi-err" role="alert"></div>
        <div class="actions"><button class="btn primary">Simpan aturan</button></div>
      </form>
    </section>`;
}

export function renderPresensi() {
  const S = getState();
  const P = S.presensi;
  if (!P || !P.loaded) {
    loadPresensi().then(() => window.__pt_render && window.__pt_render()).catch((e) => {
      S.presensi = { error: e.message, loaded: true };
      window.__pt_render && window.__pt_render();
    });
    return '<div class="skeleton" style="height:220px"></div>';
  }
  if (P.error) return `<div class="card"><div class="empty"><b>Gagal memuat presensi</b><br>${esc(P.error)}<br><button class="btn primary" data-act="presensi-muat">${icon('sync')} Coba lagi</button></div></div>`;
  if (isAdmin()) return renderPemilik(P);
  const who = me(editorById);
  if (!who) return '<div class="card"><div class="empty"><b>Masuk sebagai karyawan</b><br>Presensi dicatat atas nama karyawan yang sedang masuk.</div></div>';
  return renderKaryawan(who, P);
}

// Watches GPS for a few seconds and keeps the most precise reading, so a rough first fix
// does not get refused when a better one arrives shortly after.
function ambilLokasi(target, onUpdate) {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) return reject(new Error('Browser ini tidak bisa membaca lokasi. Buka lewat https dengan Chrome atau Safari.'));
    let best = null;
    let done = false;
    const finish = (fn) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); clearTimeout(timer); fn(); };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
        onUpdate && onUpdate(best.coords.accuracy);
        if (best.coords.accuracy <= target) finish(() => resolve(best));
      },
      (e) => finish(() => reject(new Error(
        e.code === 1 ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'
          : e.code === 3 ? 'Lokasi tidak didapat. Pastikan GPS menyala lalu coba lagi.'
            : 'Lokasi tidak bisa dibaca. Pastikan GPS menyala.'))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
    const timer = setTimeout(() => finish(() => (best ? resolve(best) : reject(new Error('Lokasi tidak didapat dalam 20 detik. Pindah dekat jendela lalu coba lagi.')))), 20000);
  });
}

export async function absen(el) {
  const S = getState();
  const cfg = S.presensi.config;
  const status = $('#absen-status');
  const say = (t) => { if (status) status.textContent = t; };
  document.querySelectorAll('[data-act="absen"]').forEach((b) => { b.disabled = true; });
  try {
    say('Membaca lokasi GPS…');
    const pos = await ambilLokasi(cfg.akurasi_maks, (acc) => say(`Membaca lokasi GPS… akurasi ± ${Math.round(acc)} m`));
    say('Mengirim presensi…');
    await api('/api/presensi', {
      method: 'POST',
      body: { jenis: el.dataset.jenis, lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy, diambil: pos.timestamp },
    });
    toast(el.dataset.jenis === 'masuk' ? 'Absen masuk tercatat' : 'Absen pulang tercatat');
  } catch (e) {
    toast(e.message, true);
  }
  try { await loadPresensi(); } catch (e) { /* the page keeps the last data */ }
  window.__pt_render && window.__pt_render();
}

export async function lokasiSaya() {
  const info = $('#lokasi-info');
  try {
    if (info) info.textContent = 'Membaca lokasi…';
    const pos = await ambilLokasi(15, (acc) => { if (info) info.textContent = `Membaca lokasi… ± ${Math.round(acc)} m`; });
    const f = $('#presensi-form');
    f.lat.value = pos.coords.latitude.toFixed(6);
    f.lng.value = pos.coords.longitude.toFixed(6);
    if (info) info.textContent = `Terisi (akurasi ± ${Math.round(pos.coords.accuracy)} m). Klik Simpan aturan.`;
  } catch (e) {
    if (info) info.textContent = e.message;
  }
}

export function ipSaya(el) {
  const f = $('#presensi-form');
  const ip = el.dataset.ip;
  const list = f.ips.value.split(/\s+/).filter(Boolean);
  if (!list.includes(ip)) list.push(ip);
  f.ips.value = list.join('\n');
}

export function initPresensiForm() {
  const f = $('#presensi-form');
  if (!f) return;
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = new FormData(f);
    const body = Object.fromEntries(d.entries());
    body.ips = String(body.ips || '').split(/\s+/).filter(Boolean);
    ['radius', 'akurasi_maks', 'toleransi'].forEach((k) => { body[k] = Number(body[k]); });
    try {
      const cfg = await api('/api/presensi/config', { method: 'PUT', body });
      getState().presensi.config = cfg;
      toast('Aturan presensi tersimpan');
      window.__pt_render && window.__pt_render();
    } catch (e) {
      $('#presensi-err').textContent = e.message;
    }
  });
}
