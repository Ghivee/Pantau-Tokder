import { JADWAL_BAWAAN, jamKerja, kalender, ketLibur } from '../core/calendar.js';
import { activeEditors, api, editorById } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { badgeOf, route } from '../core/router.js';
import { S, isAdmin, me } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { HARI, WIB, addDays, nf, sum, tglPanjang, tglPendek, toMin, today } from '../lib/format.js';
import { bantuan, muatUlang, notifCard } from './shared.js';
import { avatar, toast } from '../ui/bits.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

// Employees check in and out; the server decides (office Wi-Fi IP, GPS accuracy, radius, jumps).
// The owner sees today's attendance, a 30-day recap, refused attempts, and sets the rules.
export const jamWib = (iso) => (iso ? new Date(new Date(iso).getTime() + WIB).toISOString().slice(11, 16) : '—');

export const waktuWib = (iso) => { const w = new Date(new Date(iso).getTime() + WIB).toISOString(); return tglPendek(w.slice(0, 10)) + ' ' + w.slice(11, 16); };

const meter = (v) => (v == null ? '—' : nf.format(Math.round(v)) + ' m');

async function loadPresensi() {
  const q = '?dari=' + addDays(today(), -30) + '&sampai=' + today();
  const [config, rows, ditolak] = await Promise.all([api('/api/presensi/config'), api('/api/presensi' + q), api('/api/presensi/ditolak' + q)]);
  S.presensi = { config, rows, ditolak };
}

export const hariPresensi = (rows, id, d) => {
  const r = rows.filter((x) => x.editor_id === id && x.tanggal === d);
  return { masuk: r.find((x) => x.jenis === 'masuk') || null, pulang: r.find((x) => x.jenis === 'pulang') || null };
};

export function statusPresensi(h, cfg, d) {
  const j = jamKerja(d);
  if (!h.masuk) return !j ? `<span class="pill">Libur · ${esc(ketLibur(d))}</span>` : d === today() ? '<span class="pill warn">Belum absen</span>' : '<span class="pill bad">Tidak absen</span>';
  if (!j) return '<span class="pill leaf">Masuk di hari libur (lembur)</span>';
  const out = [h.masuk.telat_menit > 0 ? `<span class="pill bad">Telat ${h.masuk.telat_menit} mnt</span>` : '<span class="pill ok">Tepat waktu</span>'];
  if (h.pulang) { const cepat = toMin(j.pulang) - toMin(jamWib(h.pulang.waktu)); if (cepat > 0) out.push(`<span class="pill warn">Pulang ${cepat} mnt lebih awal</span>`); }
  return out.join(' ');
}

// "Senin–Kamis 08:00–16:00 · Jumat–Sabtu 08:00–15:00 · Minggu libur"
export function ringkasJadwal(jadwal) {
  const urut = [1, 2, 3, 4, 5, 6, 0];
  const kelompok = [];
  urut.forEach((i) => {
    const x = jadwal[i];
    const k = x ? x.masuk + '–' + x.pulang : 'libur';
    const last = kelompok[kelompok.length - 1];
    if (last && last.k === k) last.hari.push(i); else kelompok.push({ k, hari: [i] });
  });
  return kelompok.map((g) => (g.hari.length > 1 ? HARI[g.hari[0]] + '–' + HARI[g.hari[g.hari.length - 1]] : HARI[g.hari[0]]) + ' ' + g.k).join(' · ');
}

// The next red dates, for the owner's settings and the guide.
export const liburBerikutnya = (n = 6) => Object.entries(kalender().libur).filter(([d]) => d >= today()).sort(([a], [b]) => a.localeCompare(b)).slice(0, n);

function ditolakTable(list, owner) {
  if (!list.length) return '<div class="empty"><b>Tidak ada percobaan yang ditolak</b>30 hari terakhir.</div>';
  return `<div class="table-wrap"><table class="t stack"><thead><tr><th>Waktu</th>${owner ? '<th>Karyawan</th>' : ''}<th>Alasan</th>${owner ? '<th>IP</th><th class="num">Akurasi</th><th class="num">Jarak</th>' : ''}</tr></thead><tbody>
      ${list.map((x) => `<tr><td class="mono" data-label="Waktu">${waktuWib(x.waktu)} · ${esc(x.jenis)}</td>${owner ? `<td data-label="Karyawan">${esc((editorById(x.editor_id) || {}).nama || '—')}</td>` : ''}<td class="full">${esc(x.alasan)}</td>${owner ? `<td class="mono" data-label="IP">${esc(x.ip)}</td><td class="num" data-label="Akurasi">${meter(x.akurasi)}</td><td class="num" data-label="Jarak">${meter(x.jarak)}</td>` : ''}</tr>`).join('')}
    </tbody></table></div>`;
}

// The office's public IP seems to have changed (several people refused from one new network while
// inside the office): one tap for the owner instead of everyone being refused all day.
export function ipBaruCard() {
  const k = isAdmin() && S.presensi && S.presensi.config && S.presensi.config.ip_kandidat;
  if (!k) return '';
  return `<section class="card ip-baru" role="alert"><div class="card-h"><h2>IP Wi-Fi kantor tampaknya berubah</h2><p>${k.orang} karyawan yang GPS-nya di dalam kantor ditolak dari jaringan <b class="mono">${esc(k.ip)}</b> (terakhir ${jamWib(k.terakhir)}). Biasanya karena modem dinyalakan ulang. Setujui bila mereka memang di kantor.</p></div>
      <div class="tools"><button class="btn primary" data-act="ip-baru" data-ip="${esc(k.ip)}" data-ganti="1">Ganti IP lama dengan ini</button><button class="btn" data-act="ip-baru" data-ip="${esc(k.ip)}">Tambahkan saja</button><button class="btn ghost" data-act="ip-abaikan" data-ip="${esc(k.ip)}">Bukan kantor</button></div></section>`;
}

// Izin & klaim tidak ada di menu; dibuka dari sini.
const tombolIzin = () => `<a class="btn" href="/pengajuan">Izin & klaim${badgeOf('pengajuan') ? ` <span class="pill warn">${badgeOf('pengajuan')}</span>` : ''}</a>`;

function presensiPage() {
  const P = S.presensi;
  if (!P) {
    loadPresensi().then(() => { if (route() === 'presensi') render(); }).catch((e) => { S.presensi = { error: e.message }; if (route() === 'presensi') render(); });
    return '<header class="head"><div><h1>Presensi</h1><p>Memuat…</p></div></header><div class="skeleton" style="height:220px"></div>';
  }
  if (P.error) return `<section class="card empty" style="padding:48px 20px" role="alert"><b class="fs-16">Presensi belum bisa dimuat</b><p style="margin:6px 0 16px">${esc(P.error)}</p><button class="btn primary" data-act="presensi-muat">${icon('sync')}Coba lagi</button></section>`;
  const cfg = P.config;
  const net = cfg.ip_kantor ? '<span class="pill ok">Wi-Fi kantor</span>' : '<span class="pill bad">Bukan Wi-Fi kantor</span>';
  const jh = jamKerja(today());
  const syarat = `Absen diterima bila tersambung ke Wi-Fi kantor, GPS menyala dengan akurasi ≤ ${cfg.akurasi_maks} m, dan posisi dalam ${cfg.radius} m dari kantor. Jam kerja: ${esc(ringkasJadwal(cfg.jadwal || kalender().jadwal))} (toleransi telat ${cfg.toleransi} menit). Tanggal merah libur.`;
  if (!isAdmin()) {
    const who = me();
    if (!who) return '<section class="card empty"><b>Masuk sebagai karyawan untuk absen</b></section>';
    const h = hariPresensi(P.rows, who.id, today());
    const days = [...new Set(P.rows.map((r) => r.tanggal))].sort().reverse();
    return `
        <header class="head"><div><h1>Presensi</h1><p><span class="muted">${tglPanjang(today())}.</span> ${h.pulang ? 'Absen hari ini sudah lengkap.' : h.masuk ? 'Sudah absen masuk. Jangan lupa absen pulang.' : 'Belum absen masuk hari ini.'}</p></div><div class="tools">${tombolIzin()}${bantuan('presensi')}</div></header>
        ${!cfg.siap ? '<div class="notice m-0 mw-none" role="status"><b>Presensi belum diatur.</b> Pemilik perlu mengisi lokasi kantor dan IP Wi-Fi kantor dulu.</div>' : ''}
        <section class="kpis">
          <div class="kpi"><span class="l">Masuk</span><span class="v mono">${jamWib(h.masuk && h.masuk.waktu)}</span><span class="d">${jh ? 'jadwal ' + esc(jh.masuk) : 'libur: ' + esc(ketLibur(today()))}</span></div>
          <div class="kpi"><span class="l">Pulang</span><span class="v mono">${jamWib(h.pulang && h.pulang.waktu)}</span><span class="d">${jh ? 'jadwal ' + esc(jh.pulang) : 'tidak ada jadwal'}</span></div>
          <div class="kpi"><span class="l">Status hari ini</span><span class="v" style="font-size:15px">${statusPresensi(h, cfg, today())}</span><span class="d">${net} <span class="mono">IP ${esc(cfg.ip_anda)}</span></span></div>
        </section>
        <section class="card">
          <div class="tools">
            <button class="btn primary" data-act="absen" data-jenis="masuk" ${h.masuk || !cfg.siap ? 'disabled' : ''}>${icon('pin')}Absen masuk</button>
            <button class="btn" data-act="absen" data-jenis="pulang" ${!h.masuk || h.pulang || !cfg.siap ? 'disabled' : ''}>${icon('out')}Absen pulang</button>
          </div>
          <p class="muted mt-12 fs-13" id="absen-status" role="status">${syarat} Izinkan akses lokasi saat browser memintanya.</p>
        </section>
        <section class="card"><div class="card-h"><h2>Riwayat 30 hari</h2></div>
          ${days.length ? `<div class="table-wrap"><table class="t stack"><thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead><tbody>
            ${days.map((d) => { const x = hariPresensi(P.rows, who.id, d); return `<tr><td class="full"><b>${tglPanjang(d)}</b></td><td class="mono" data-label="Masuk">${jamWib(x.masuk && x.masuk.waktu)}</td><td class="mono" data-label="Pulang">${jamWib(x.pulang && x.pulang.waktu)}</td><td data-label="Status">${statusPresensi(x, cfg, d)}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Belum ada presensi</b>Riwayat muncul setelah absen pertama.</div>'}
        </section>
        <section class="card"><div class="card-h"><h2>Percobaan yang ditolak</h2><p>Alasan tiap absen yang tidak diterima.</p></div>${ditolakTable(P.ditolak, false)}</section>
        ${notifCard()}`;
  }
  const eds = activeEditors();
  const hadir = eds.filter((e) => hariPresensi(P.rows, e.id, today()).masuk).length;
  const telat = eds.filter((e) => (hariPresensi(P.rows, e.id, today()).masuk || {}).telat_menit > 0).length;
  const ditolakHariIni = P.ditolak.filter((x) => waktuWib(x.waktu).startsWith(tglPendek(today()) + ' ')).length;
  return `
      <header class="head"><div><h1>Presensi</h1><p><span class="muted">${tglPanjang(today())}.</span> <b>${hadir}</b> dari ${eds.length} karyawan sudah absen masuk${telat ? `, <b>${telat}</b> telat` : ''}.</p></div><div class="tools">${tombolIzin()}${bantuan('presensi')}</div></header>
      ${!cfg.siap ? '<div class="notice m-0 mw-none" role="status"><b>Presensi belum bisa dipakai.</b> Isi lokasi kantor dan IP Wi-Fi kantor di kartu Aturan presensi.</div>' : ''}
      ${ipBaruCard()}
      <section class="kpis">
        <div class="kpi"><span class="l">Hadir hari ini</span><span class="v">${hadir} <small>/ ${eds.length}</small></span><span class="d">absen masuk tercatat</span></div>
        <div class="kpi"><span class="l">Telat hari ini</span><span class="v ${telat ? 'bad' : ''}">${telat}</span><span class="d">${jh ? `lewat ${esc(jh.masuk)} + ${cfg.toleransi} mnt` : 'hari ini libur'}</span></div>
        <div class="kpi ${ditolakHariIni ? 'alert' : ''}"><span class="l">Ditolak hari ini</span><span class="v">${ditolakHariIni}</span><span class="d">${P.ditolak.length} dalam 30 hari</span></div>
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Hari ini</h2></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Karyawan</th><th>Masuk</th><th>Pulang</th><th>Status</th><th class="num">Jarak</th></tr></thead><tbody>
            ${eds.map((e) => { const h = hariPresensi(P.rows, e.id, today()); return `<tr><td class="full"><span class="ed">${avatar(e, 'xs')}<b>${esc(e.nama)}</b></span></td><td class="mono" data-label="Masuk">${jamWib(h.masuk && h.masuk.waktu)}</td><td class="mono" data-label="Pulang">${jamWib(h.pulang && h.pulang.waktu)}</td><td data-label="Status">${statusPresensi(h, cfg, today())}</td><td class="num" data-label="Jarak">${meter(h.masuk && h.masuk.jarak)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Belum ada karyawan aktif.</td></tr>'}
          </tbody></table></div></section>
        <section class="card"><div class="card-h"><h2>Rekap 30 hari</h2><button class="btn sm ghost" data-act="csv-presensi">${icon('download')}Excel</button></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Karyawan</th><th class="num">Hadir</th><th class="num">Telat</th><th class="num">Total telat</th><th class="num">Ditolak</th></tr></thead><tbody>
            ${eds.map((e) => { const m = P.rows.filter((r) => r.editor_id === e.id && r.jenis === 'masuk'); const t = m.filter((r) => r.telat_menit > 0); const dt = P.ditolak.filter((x) => x.editor_id === e.id).length; return `<tr><td class="full"><b>${esc(e.nama)}</b></td><td class="num" data-label="Hadir">${m.length} hari</td><td class="num" data-label="Telat">${t.length}×</td><td class="num" data-label="Total telat">${sum(t, (r) => r.telat_menit)} mnt</td><td class="num" data-label="Ditolak">${dt ? `<span class="pill bad">${dt}</span>` : '0'}</td></tr>`; }).join('')}
          </tbody></table></div></section>
      </div>
      <section class="card"><div class="card-h"><h2>Percobaan yang ditolak</h2><p>Banyak penolakan "bukan Wi-Fi kantor", "akurasi tidak wajar" atau "lokasi berpindah" dari satu orang bisa menandakan percobaan curang.</p></div>${ditolakTable(P.ditolak, true)}</section>
      <section class="card"><div class="card-h"><h2>Aturan presensi</h2><p>Absen hanya diterima bila <b>semua</b> terpenuhi: IP internet sama dengan Wi-Fi kantor, akurasi GPS cukup, dan posisi di dalam radius kantor.</p></div>
        <form id="presensi-form" style="display:flex;flex-direction:column;gap:12px;max-width:640px">
          <div class="row">
            <label class="field"><span>Lintang (lat) kantor</span><input class="input mono" name="lat" inputmode="decimal" value="${cfg.lat ?? ''}" placeholder="-6.200000" required></label>
            <label class="field"><span>Bujur (lng) kantor</span><input class="input mono" name="lng" inputmode="decimal" value="${cfg.lng ?? ''}" placeholder="106.816666" required></label>
          </div>
          <div class="tools"><button type="button" class="btn sm" data-act="presensi-lokasi">${icon('pin')}Pakai lokasi saya sekarang</button><span class="muted fs-13" id="lokasi-info"></span></div>
          <div class="row">
            <label class="field"><span>Radius kantor (meter)</span><input class="input" name="radius" type="number" min="20" max="2000" value="${cfg.radius}" required></label>
            <label class="field"><span>Akurasi GPS maksimal (meter)</span><input class="input" name="akurasi_maks" type="number" min="5" max="500" value="${cfg.akurasi_maks}" required></label>
          </div>
          <label class="field"><span>IP publik Wi-Fi kantor</span><textarea class="input mono" name="ips" rows="3" required placeholder="203.0.113.7">${esc((cfg.ips || []).join('\n'))}</textarea>
            <small>Satu per baris; rentang seperti 203.0.113.0/24 juga bisa. IP Anda sekarang: <b class="mono">${esc(cfg.ip_anda)}</b> ${cfg.ip_kantor ? '(sudah terdaftar)' : '(belum terdaftar)'}. Buka halaman ini dari Wi-Fi kantor lalu klik Tambahkan IP saya.</small></label>
          <div class="tools"><button type="button" class="btn sm" data-act="presensi-ip" data-ip="${esc(cfg.ip_saran || cfg.ip_anda)}">${icon('plus')}Tambahkan IP saya</button></div>
          <fieldset class="jam-kerja"><legend>Jam kerja (WIB)</legend>
            ${[1, 2, 3, 4, 5, 6, 0].map((i) => { const x = (cfg.jadwal || JADWAL_BAWAAN)[i]; return `<div class="jk-row" data-hari="${i}">
              <label class="chk"><input type="checkbox" name="kerja-${i}" ${x ? 'checked' : ''}> ${HARI[i]}</label>
              <input class="input" type="time" name="masuk-${i}" value="${esc(x ? x.masuk : '08:00')}" aria-label="Jam masuk ${HARI[i]}" ${x ? '' : 'disabled'}>
              <span class="muted">–</span>
              <input class="input" type="time" name="pulang-${i}" value="${esc(x ? x.pulang : '16:00')}" aria-label="Jam pulang ${HARI[i]}" ${x ? '' : 'disabled'}></div>`; }).join('')}
          </fieldset>
          <label class="field"><span>Toleransi telat (menit)</span><input class="input" name="toleransi" type="number" min="0" max="120" value="${cfg.toleransi}" required style="max-width:160px"></label>
          <div class="field"><span>Hari libur</span>
            <label class="chk"><input type="checkbox" name="cuti_bersama" ${cfg.cuti_bersama ? 'checked' : ''}> Ikut cuti bersama pemerintah</label>
            <small>Tanggal merah (libur nasional) selalu libur. Berikutnya: ${liburBerikutnya().map(([d, n]) => `${tglPendek(d)} ${esc(n)}`).join(' · ') || '—'}.</small></div>
          <label class="field"><span>Libur kantor tambahan</span><textarea class="input mono" name="libur_kantor" rows="2" placeholder="2026-12-31">${esc((cfg.libur_kantor || []).join('\n'))}</textarea><small>Satu tanggal per baris (YYYY-MM-DD), untuk libur khusus kantor di luar tanggal merah.</small></label>
          <div class="err text-bad fs-13" id="presensi-err" role="alert"></div>
          <div><button class="btn primary">Simpan aturan</button></div>
        </form></section>`;
}

PAGES.presensi = presensiPage;

// Watches GPS for a few seconds and keeps the most precise fix, so a rough first reading
// is not sent when a better one arrives a moment later.
export function ambilLokasi(target, onUpdate) {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext || !navigator.geolocation) return reject(new Error('Browser ini tidak bisa membaca lokasi. Buka lewat https dengan Chrome atau Safari.'));
    let best = null, done = false, id = null;
    const finish = (fn) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); clearTimeout(timer); fn(); };
    const timer = setTimeout(() => finish(() => (best ? resolve(best) : reject(new Error('Lokasi tidak didapat dalam 20 detik. Pastikan GPS menyala, lalu coba lagi.')))), 20000);
    id = navigator.geolocation.watchPosition((p) => {
      if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
      if (onUpdate) onUpdate(best.coords.accuracy);
      if (best.coords.accuracy <= target) finish(() => resolve(best));
    }, (e) => finish(() => reject(new Error(e.code === 1 ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu coba lagi.' : 'Lokasi tidak bisa dibaca. Pastikan GPS menyala.'))), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  });
}

export async function absen(el) {
  const cfg = S.presensi.config;
  const say = (t) => { const s = $('#absen-status'); if (s) s.textContent = t; };
  $$('[data-act="absen"]').forEach((b) => { b.disabled = true; });
  try {
    say('Membaca lokasi GPS…');
    const pos = await ambilLokasi(cfg.akurasi_maks, (acc) => say(`Membaca lokasi GPS… akurasi ± ${Math.round(acc)} m`));
    say('Mengirim presensi…');
    await api('/api/presensi', { method: 'POST', body: { jenis: el.dataset.jenis, lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy, diambil: pos.timestamp } });
    toast(el.dataset.jenis === 'masuk' ? 'Absen masuk tercatat' : 'Absen pulang tercatat');
  } catch (e) {
    toast(e.message, true);
  }
  try { await loadPresensi(); } catch (e) { /* keep the last numbers on screen */ }
  render();
}

AFTER.presensi = () => {
  const f = $('#presensi-form');
  if (!f) return;
  $$('.jk-row', f).forEach((row) => { const cb = $('input[type=checkbox]', row); cb.addEventListener('change', () => { $$('input[type=time]', row).forEach((t) => { t.disabled = !cb.checked; }); }); });
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    const body = { lat: fd.lat, lng: fd.lng, ips: String(fd.ips || '').split(/\s+/).filter(Boolean), cuti_bersama: !!fd.cuti_bersama,
      libur_kantor: String(fd.libur_kantor || '').split(/\s+/).filter(Boolean),
      jadwal: [0, 1, 2, 3, 4, 5, 6].map((i) => (fd['kerja-' + i] ? { masuk: fd['masuk-' + i], pulang: fd['pulang-' + i] } : null)) };
    ['radius', 'akurasi_maks', 'toleransi'].forEach((k) => { body[k] = Number(fd[k]); });
    const btn = $('button.primary', f);
    btn.disabled = true;
    try {
      S.presensi.config = await api('/api/presensi/config', { method: 'PUT', body });
      toast('Aturan presensi tersimpan');
      // Working days move payroll, leave and video targets: everything again.
      S.gajiCache = {};
      await muatUlang();
    } catch (e) { $('#presensi-err').textContent = e.message; btn.disabled = false; }
  });
};
