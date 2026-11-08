import { kalender } from '../core/calendar.js';
import { activeEditors, analyticsChannels, api, belumDikenali, editorById, fetchAll } from '../core/data.js';
import { route } from '../core/router.js';
import { S, isAdmin } from '../core/state.js';
import { $ } from '../lib/dom.js';
import { addDays, median, today } from '../lib/format.js';
import { loadGaji } from './gaji.js';
import { ringkasJadwal } from './presensi.js';
import { toast } from '../ui/bits.js';
import { icon } from '../ui/icons.js';
import { render, renderNav } from '../ui/layout.js';

export function kontenRows() {
  const k = S.konten;
  const from = k.periode === 'all' ? '0000' : addDays(today(), -(+k.periode) + 1);
  const q = k.q.trim().toLowerCase();
  const rows = S.content.filter((c) => c._day >= from
    && (k.channel === 'all' || c._ch === k.channel)
    && (k.editor === 'all' || (k.editor === 'none' ? belumDikenali(c) : String(c.editor_id) === k.editor))
    && (k.tipe === 'all' || c.tipe_video === k.tipe)
    && (!q || (c.judul || '').toLowerCase().includes(q)));
  const val = {
    judul: (c) => c.judul || '', editor: (c) => (editorById(c.editor_id) || { nama: '~' }).nama, tanggal: (c) => c.tanggal_upload,
    views: (c) => c.views, likes: (c) => c.likes, comments: (c) => c.comments, durasi: (c) => +c.duration_secs || 0,
  }[k.sort];
  rows.sort((a, b) => { const x = val(a), y = val(b); const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y)); return k.dir === 'asc' ? r : -r; });
  return rows;
}

const BLN_PJ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const bulanLabel = (b) => BLN_PJ[+b.slice(5, 7) - 1] + ' ' + b.slice(0, 4);

export const kali = (r) => (r == null || isNaN(r) ? '—' : r.toFixed(1).replace('.', ',') + '×');

export const bantuan = (id) => `<a class="btn ghost" href="/panduan#p-${id}">${icon('book')}Cara kerja</a>`;

// Same, but against videos published in the same window: fair for comparing older weeks.
export function peerRatios(list) {
  const g = {};
  list.forEach((c) => { (g[c._ch + '|' + c.tipe_video] ||= []).push(c.views); });
  const med = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, median(v)]));
  return new Map(list.map((c) => { const m = med[c._ch + '|' + c.tipe_video]; return [c.id, m ? c.views / m : null]; }));
}

// Retention summaries and recent view gains: loaded after the first paint, never blocking it.
let insightJob = null;

export function loadInsight(force = false) {
  if (insightJob || (S.insight && !S.insight.error && !force)) return insightJob;
  insightJob = api('/api/insight', { timeout: 30000 })
    .then((r) => { S.insight = { ...r, retMap: new Map(r.retensi.map((x) => [x.id, x])), naikMap: new Map(r.naik.map((x) => [x.id, x])) }; })
    .catch((e) => { S.insight = { error: e.message, retensi: [], naik: [], retMap: new Map(), naikMap: new Map() }; })
    .finally(() => { insightJob = null; if (['performa', 'tren'].includes(route()) && !$('#overlay').innerHTML) render(); });
  return insightJob;
}

// After a change that moves pay or leave: everything again in one request, plus the month on screen.
export async function muatUlang() {
  try {
    await fetchAll();
    if (S.gajiBulan && !S.gajiCache[S.gajiBulan]) await loadGaji(S.gajiBulan).catch(() => {});
  } catch (e) { toast(e.message, true); }
  if (!$('#overlay').innerHTML) render(); else renderNav();
}

// Web Push: izin baru, keputusan izin, gaji final/dibayar, pengingat absen. On iPhone it needs the
// site added to the home screen first (Safari only allows push for installed web apps).
export const pushDidukung = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const diIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

export const terpasang = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

export let swReg = null;

export async function daftarSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
  try { swReg = swReg || (await navigator.serviceWorker.register('/sw.js')); } catch (e) { console.warn('Service worker:', e.message); }
  return swReg;
}

export function notifCard() {
  const n = S.notif || {};
  const isi = isAdmin() ? 'pengajuan izin, sakit, cuti dan klaim baru' : 'keputusan izin dan klaim, slip gaji final, gaji dibayar, dan pengingat bila belum absen masuk';
  const tombol = n.aktif
    ? `<span class="pill ok">Aktif di perangkat ini</span><button class="btn sm ghost" data-act="notif-coba">Kirim percobaan</button><button class="btn sm ghost" data-act="notif-mati">Matikan</button>`
    : !n.didukung && diIOS && !terpasang()
      ? '<span class="muted fs-13">Di iPhone: ketuk <b>Bagikan → Tambah ke Layar Utama</b>, buka dari ikon itu, lalu aktifkan di sini.</span>'
      : n.izin === 'denied' ? '<span class="muted fs-13">Notifikasi diblokir di browser ini. Izinkan untuk situs ini di pengaturan browser.</span>'
      : `<button class="btn primary sm" data-act="notif-aktif">${icon('plus')}Aktifkan notifikasi</button>`;
  return `<section class="card" id="kartu-notif"><div class="card-h"><h2>Notifikasi ke HP</h2><p>Kabar ${isi}. Aktifkan di tiap HP atau laptop yang dipakai.</p></div><div class="tools">${tombol}</div></section>`;
}

// What still needs doing before every number in the app is complete. Hidden once all is done.
export function persiapanItems() {
  const G = S.gajiCache[today().slice(0, 7)];
  const eds = activeEditors();
  const ch = analyticsChannels();
  const belumGaji = G && G.list ? G.list.filter((r) => !r.aturan_diisi) : [];
  return [
    { ok: !!(eds.length && eds.every((e) => e.punya_pin)), t: 'Tambah karyawan dan beri PIN', d: eds.length ? eds.filter((e) => !e.punya_pin).map((e) => e.nama).join(', ') + ' belum punya PIN untuk masuk.' : 'Belum ada karyawan.', cara: 'Isi nama, kode video (misal AL), jadwal tayang, target dan PIN.', href: '/karyawan' },
    { ok: !!(ch.length && ch.every((c) => c.connected)), t: 'Sambungkan YouTube Analytics', d: `${ch.filter((c) => c.connected).length} dari ${ch.length} channel tersambung. Retensi, jam tonton dan pendapatan hanya terbaca dari channel yang tersambung.`, cara: 'Pengaturan → Hubungkan, masuk dengan tokodeeres@gmail.com, pilih channel. Ulangi untuk tiap channel.', href: '/pengaturan' },
    { ok: !!(S.presensi && S.presensi.config && S.presensi.config.siap), t: 'Atur presensi', d: 'Isi lokasi kantor dan IP Wi-Fi kantor dari kantor.', cara: 'Buka dari Wi-Fi kantor: Pakai lokasi saya, Tambahkan IP saya, Simpan.', href: '/presensi' },
    { ok: !!(G && G.config && G.config.tersimpan), t: 'Cek jam kerja dan jatah cuti', d: `Jam kerja: ${ringkasJadwal(kalender().jadwal)}; tanggal merah libur. Pastikan jatah cuti per tahun sudah benar.`, cara: 'Jam kerja di Presensi, jatah cuti di Gaji → Atur gaji.', href: '/gaji', act: 'atur-gaji', id: 'umum' },
    { ok: !!(G && G.list && G.list.length && !belumGaji.length), t: 'Isi gaji tiap karyawan', d: belumGaji.map((r) => r.nama).join(', ') + ' belum punya gaji pokok atau komponen lain.', cara: 'Gaji pokok, tunjangan, potongan, lembur, bonus.', href: '/gaji', act: 'atur-gaji', id: belumGaji.length ? belumGaji[0].editor_id : G && G.list && G.list[0] && G.list[0].editor_id },
    { ok: !!(S.notif && S.notif.aktif), t: 'Nyalakan notifikasi di HP', d: 'Supaya pengajuan izin dan klaim langsung terlihat.', cara: 'Supaya pengajuan izin dan klaim langsung masuk ke HP.', href: '/pengaturan', act: S.notif && S.notif.aktif ? null : 'notif-aktif' },
  ];
}
