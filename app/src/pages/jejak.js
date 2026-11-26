import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { nf } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { confirmDialog, openDialog } from '../ui/dialog.js';
import { render } from '../ui/layout.js';

// Jejak: riwayat masuk dan interaksi semua orang, lengkap dengan IP, jaringan, perangkat, dan lokasi perkiraan, plus peringatan keanehan.
// Hanya pemilik. Data dimuat per tab; Master ikut tampil karena disalin dari database Master.
const J = (S.jejak = { tab: 'peringatan', ring: null, per: null, riw: null, sesi: null, filter: { hari: '7', jenis: '', sumber: '', hasil: '', nama: '', risikoMin: '', q: '' }, galat: null, buka: new Set() });

const WIB_OPS = { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false };
const waktu = (d) => new Date(d).toLocaleString('id-ID', WIB_OPS).replace(/\./g, ':');
export function rel(d, kini = Date.now()) {
  const s = Math.max(0, Math.round((kini - new Date(d).getTime()) / 1000));
  if (s < 60) return 'baru saja';
  if (s < 3600) return Math.round(s / 60) + ' mnt lalu';
  if (s < 86400) return Math.round(s / 3600) + ' jam lalu';
  return Math.round(s / 86400) + ' hari lalu';
}
const TINGKAT = { tinggi: ['bad', 'Tinggi'], sedang: ['warn', 'Sedang'], rendah: ['', 'Rendah'], normal: ['ok', 'Normal'] };
const badgeRisiko = (r) => { const t = r.tingkat || 'normal'; return t === 'normal' ? '' : `<span class="pill ${TINGKAT[t][0]}" title="Skor ${r.risiko}">${TINGKAT[t][1]} · ${r.risiko}</span>`; };
const JENIS = { masuk: 'Masuk', gagal: 'Gagal masuk', keluar: 'Keluar', halaman: 'Halaman', interaksi: 'Aksi', sensitif: 'Data sensitif', sistem: 'Sistem', perubahan: 'Perubahan Office' };
const AKSI = { login_sso: 'Masuk (Akun Tokder)', login_pin: 'Masuk (PIN)', login_password: 'Masuk (password pemilik)', login_master: 'Masuk ke Office', logout_master: 'Keluar dari Office', logout: 'Keluar', logout_semua: 'Keluar dari semua web', gagal_pin: 'PIN salah', gagal_password: 'Password salah', gagal_sso: 'Masuk Akun Tokder gagal', terkunci: 'Dikunci (terlalu banyak gagal)', dibatasi_laju: 'Diblokir pembatas laju', ditolak_akses: 'Akses ke Tokder ditolak', buka_halaman: 'Membuka halaman' };
const namaAksi = (x) => AKSI[x.aksi] || x.aksi;
const perangkatLabel = (x) => (x.browser ? `${x.browser}${x.os ? ' · ' + x.os : ''}${x.model ? ' · ' + x.model : ''}` : 'Tidak diketahui');
const lokasi = (x) => [x.kota, x.negara].filter(Boolean).join(', ');
const tempat = (x) => (x.ip ? `${esc(x.ip)}${lokasi(x) ? ' · ' + esc(lokasi(x)) : ''}${x.kantor ? ' · <span class="pill ok">jaringan kantor</span>' : ''}` : '—');

// ---- pemuatan data
async function muat(tab) {
  J.galat = null;
  try {
    if (tab === 'peringatan' || tab === 'pengguna') J.ring = await api('/api/jejak/ringkasan');
    if (tab === 'peringatan') J.per = await api('/api/jejak?belumDitinjau=1&hari=30&batas=100');
    if (tab === 'riwayat') J.riw = await api('/api/jejak?' + query(J.filter) + '&batas=50');
    if (tab === 'sesi') J.sesi = await api('/api/jejak/sesi');
  } catch (e) { J.galat = e.message; }
  if (route() === 'jejak') render();
}
function query(f, ekstra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...ekstra })) if (v !== '' && v != null) p.set(k, v);
  return p.toString();
}
// Dipanggil saat keluar: tidak ada data jejak yang tersisa di memori browser.
export function resetJejak() {
  Object.assign(J, { tab: 'peringatan', ring: null, per: null, riw: null, sesi: null, galat: null, dimuat: false, filter: { hari: '7', jenis: '', sumber: '', hasil: '', nama: '', risikoMin: '', q: '' } });
  J.buka.clear();
}
export const bukaTab = (tab) => { J.tab = tab; render(); muat(tab); };

// ---- tampilan
const alasan = (x) => (x.alasan.length ? `<ul class="jj-alasan">${x.alasan.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '');
const detailBaris = (x) => `<dl class="kv jj-detail">
  <dt>Waktu</dt><dd>${waktu(x.waktu)} WIB</dd>
  <dt>Sumber</dt><dd>${x.sumber === 'master' ? 'Office (database)' : 'Tokder'}</dd>
  <dt>Siapa</dt><dd>${esc(x.pengguna_nama || 'Tidak dikenal')}${x.akun ? ' · ' + esc(x.akun) : ''}${x.metode ? ' · ' + esc(x.metode) : ''}</dd>
  <dt>IP</dt><dd>${tempat(x)}</dd>
  <dt>Jaringan</dt><dd>${esc(x.jaringan || '—')}</dd>
  <dt>Lokasi perkiraan</dt><dd>${esc([x.kota, x.wilayah, x.negara].filter(Boolean).join(', ') || '—')}${x.zona ? ' · ' + esc(x.zona) : ''}</dd>
  <dt>Perangkat</dt><dd>${esc(perangkatLabel(x))} · ${esc(x.perangkat || '—')}</dd>
  <dt>Bahasa</dt><dd>${esc(x.bahasa || '—')}</dd>
  <dt>Sidik perangkat</dt><dd class="mono">${esc(x.sidik || '—')}</dd>
  ${x.rute ? `<dt>Permintaan</dt><dd class="mono">${esc(x.metode_http || '')} ${esc(x.rute)} → ${x.status || '—'}${x.durasi_ms ? ' · ' + x.durasi_ms + ' ms' : ''}</dd>` : ''}
  ${x.detail && x.detail.tabel ? `<dt>Data Office</dt><dd class="mono">${esc(x.detail.tabel)} #${esc(x.detail.baris_id || '')}${x.detail.ringkas ? ' · ubah: ' + esc(x.detail.ringkas) : ''}</dd>` : ''}
  ${x.detail && x.detail.alasan_singkat ? `<dt>Alasan</dt><dd>${esc(x.detail.alasan_singkat)}</dd>` : ''}
  <dt>User agent</dt><dd class="mono jj-ua">${esc(x.ua || '—')}</dd>
  ${x.ditinjau_pada ? `<dt>Ditinjau</dt><dd>${esc(x.ditinjau_oleh || '')} · ${waktu(x.ditinjau_pada)}</dd>` : ''}
</dl>${alasan(x)}`;

const barisRiwayat = (x) => `<div class="jj-baris ${x.hasil === 'gagal' ? 'gagal' : ''}" data-id="${x.id}">
  <button class="jj-ringkas" data-act="jejak-baris" data-id="${x.id}" aria-expanded="${J.buka.has(x.id)}">
    <span class="jj-t">${waktu(x.waktu)}</span>
    <span class="jj-n"><b>${esc(x.pengguna_nama || 'Tidak dikenal')}</b><small>${esc(JENIS[x.jenis] || x.jenis)}${x.sumber === 'master' ? ' · Office' : ''}</small></span>
    <span class="jj-a">${esc(namaAksi(x))}${x.rute && x.jenis !== 'halaman' ? `<small class="mono">${esc(x.status || '')}</small>` : x.rute ? `<small class="mono">${esc(x.rute)}</small>` : ''}</span>
    <span class="jj-w">${tempat(x)}<small>${esc(perangkatLabel(x))}</small></span>
    <span class="jj-r">${badgeRisiko(x)}</span>
  </button>
  <div class="jj-isi" ${J.buka.has(x.id) ? '' : 'hidden'}>${detailBaris(x)}</div>
</div>`;

function tabPeringatan() {
  const r = J.ring, p = J.per;
  if (!r || !p) return '<p class="muted">Memuat…</p>';
  const ada = p.baris.length;
  const kepala = `<div class="jj-chip-baris">
      <span class="pill ${r.tinggi ? 'bad' : r.peringatan ? 'warn' : 'ok'}">${r.peringatan} peringatan belum ditinjau${r.tinggi ? ` · ${r.tinggi} tinggi` : ''}</span>
      <span class="pill">${nf.format(r.total)} kejadian 30 hari</span>
      ${masterChip(r.master)}
      ${ada ? '<button class="btn sm ghost" data-act="jejak-tinjau-semua">Tandai semua ditinjau</button>' : ''}</div>`;
  if (!ada) return kepala + '<section class="card"><p>Tidak ada peringatan yang menunggu. Kejadian yang tidak biasa (perangkat atau lokasi baru, gagal masuk berulang, jam janggal, dan lainnya) akan muncul di sini.</p></section>';
  return kepala + p.baris.map((x) => `<section class="card jj-peringatan ${x.tingkat}">
      <div class="card-h"><h2>${esc(x.judulTanda.join(' · ') || namaAksi(x))}</h2>${badgeRisiko(x)}</div>
      <p><b>${esc(x.pengguna_nama || 'Tidak dikenal')}</b> · ${esc(namaAksi(x))} · ${waktu(x.waktu)} WIB <span class="muted">(${rel(x.waktu)})</span></p>
      ${alasan(x)}
      <p class="muted">${tempat(x)} · ${esc(perangkatLabel(x))}</p>
      <div class="tools"><button class="btn sm" data-act="jejak-tinjau" data-id="${x.id}">Tandai sudah ditinjau</button><button class="btn sm ghost" data-act="jejak-baris-buka" data-id="${x.id}">Lihat semua rincian</button></div>
      <div class="jj-isi" id="jj-rinci-${x.id}" hidden>${detailBaris(x)}</div>
    </section>`).join('');
}

const masterChip = (m) => (!m ? '' : !m.terhubung ? '<span class="pill warn" title="Isi MASTER_* di Vercel">Office belum tersambung</span>' : m.galat ? `<span class="pill warn" title="${esc(m.galat)}">Office: ${esc(m.galat.slice(0, 50))}</span>` : '<span class="pill ok">Office tersambung</span>');

function tabPengguna() {
  const r = J.ring;
  if (!r) return '<p class="muted">Memuat…</p>';
  if (!r.pengguna.length) return '<section class="card"><p>Belum ada riwayat 30 hari terakhir.</p></section>';
  return `<div class="jj-chip-baris">${masterChip(r.master)}</div><div class="team">${r.pengguna.map((u) => {
    const t = u.terakhirMasuk;
    return `<section class="card member">
      <div class="member-top"><div class="t"><b>${esc(u.nama)}</b><div class="muted fs-125">${u.tipe === 'admin' ? 'Pemilik' : u.tipe === 'karyawan' ? 'Karyawan' : 'Akun Office'}${u.aktifSekarang ? ' · <span class="pill ok">aktif sekarang</span>' : ''}</div></div>${u.peringatan ? `<span class="pill ${u.peringatan > 2 ? 'bad' : 'warn'}">${u.peringatan} peringatan</span>` : '<span class="pill ok">bersih</span>'}</div>
      <dl class="kv">
        <dt>Masuk terakhir</dt><dd>${t ? `${waktu(t.waktu)} WIB<br><span class="muted">${tempat(t)}<br>${esc(perangkatLabel(t))}${t.sumber === 'master' ? ' · lewat Office' : ''}</span>` : '—'}</dd>
        <dt>Masuk 30 hari</dt><dd>${u.masuk_30h}× · gagal ${u.gagal_30h}×</dd>
        <dt>Perangkat / IP</dt><dd>${u.perangkat} perangkat · ${u.ip_unik} IP</dd>
        <dt>Aksi 30 hari</dt><dd>${nf.format(u.aksi_30h)}</dd>
      </dl>
      <div class="member-actions"><button class="btn sm" data-act="jejak-pengguna" data-nama="${esc(u.nama)}">Perangkat dan jaringan</button><button class="btn sm ghost" data-act="jejak-riwayat-nama" data-nama="${esc(u.nama)}">Riwayat</button></div>
    </section>`;
  }).join('')}</div>`;
}

function tabRiwayat() {
  const f = J.filter, r = J.riw, orang = J.ring ? J.ring.pengguna.map((u) => u.nama) : [];
  const opsi = (arr, pilih) => arr.map(([v, l]) => `<option value="${esc(v)}" ${pilih === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const bar = `<section class="card jj-filter"><div class="jj-grid">
      <label class="field"><span>Orang</span><select class="input" id="jf-nama">${opsi([['', 'Semua'], ...orang.map((n) => [n, n])], f.nama)}</select></label>
      <label class="field"><span>Jenis</span><select class="input" id="jf-jenis">${opsi([['', 'Semua'], ...Object.entries(JENIS)], f.jenis)}</select></label>
      <label class="field"><span>Sumber</span><select class="input" id="jf-sumber">${opsi([['', 'Tokder dan Office'], ['tokder', 'Tokder'], ['master', 'Office']], f.sumber)}</select></label>
      <label class="field"><span>Hasil</span><select class="input" id="jf-hasil">${opsi([['', 'Semua'], ['ok', 'Berhasil'], ['gagal', 'Gagal']], f.hasil)}</select></label>
      <label class="field"><span>Rentang</span><select class="input" id="jf-hari">${opsi([['1', '24 jam'], ['7', '7 hari'], ['30', '30 hari'], ['90', '90 hari'], ['365', '1 tahun']], f.hari)}</select></label>
      <label class="field"><span>Risiko minimal</span><select class="input" id="jf-risiko">${opsi([['', 'Semua'], ['10', 'Rendah ke atas'], ['30', 'Sedang ke atas'], ['60', 'Tinggi saja']], f.risikoMin)}</select></label>
      <label class="field jj-q"><span>Cari (aksi, rute, kota, browser, IP)</span><input class="input" id="jf-q" value="${esc(f.q)}" maxlength="60" placeholder="mis. gaji, Jakarta, 203.0.113"></label>
    </div><div class="tools"><button class="btn primary" data-act="jejak-filter">Terapkan</button><button class="btn ghost" data-act="jejak-reset">Atur ulang</button><a class="btn ghost" href="/api/jejak/ekspor?${esc(query(f))}" download>Unduh CSV</a></div></section>`;
  if (!r) return bar + '<p class="muted">Memuat…</p>';
  if (!r.baris.length) return bar + '<section class="card"><p>Tidak ada kejadian yang cocok dengan penyaring ini.</p></section>';
  return bar + `<section class="card jj-daftar">${r.baris.map(barisRiwayat).join('')}${r.berikutnya ? '<div class="tools"><button class="btn" data-act="jejak-lagi">Muat lebih banyak</button></div>' : '<p class="muted jj-akhir">Sudah semuanya.</p>'}</section>`;
}

function tabSesi() {
  const s = J.sesi;
  if (!s) return '<p class="muted">Memuat…</p>';
  const baris = (x, master) => `<div class="jj-sesi">
      <div><b>${esc(x.nama || x.email || '?')}</b>${x.ini ? ' <span class="pill leaf">sesi Anda</span>' : ''}${x.layanan ? ' <span class="pill">akun otomatis</span>' : ''}<div class="muted">${master ? 'Akun Tokder (Office)' : esc(x.metode || '')}${x.akun ? ' · ' + esc(x.akun) : ''}${x.email && master ? ' · ' + esc(x.email) : ''}</div></div>
      <div class="muted">${x.ip ? esc(x.ip) : '—'}<br>${esc(perangkatLabel(x))}</div>
      <div class="muted">Masuk ${waktu(x.created_at || x.dibuat)}${x.aktif_terakhir ? `<br>Aktif ${rel(x.aktif_terakhir)}` : ''}</div>
      <div>${master ? '' : `<button class="btn sm ghost danger" data-act="jejak-cabut" data-id="${x.id}" data-nama="${esc(x.nama)}" data-ini="${x.ini ? '1' : ''}">Keluarkan</button>`}</div>
    </div>`;
  const m = s.master || { sesi: [] };
  return `<section class="card"><div class="card-h"><h2>Sesi di Tokder</h2><p>Setiap perangkat yang sedang masuk. "Keluarkan" langsung mengakhiri sesi itu.</p></div>${s.sesi.length ? s.sesi.map((x) => baris(x, false)).join('') : '<p class="muted">Tidak ada sesi aktif.</p>'}</section>
    <section class="card"><div class="card-h"><h2>Sesi Akun Tokder di Office</h2><p>Dicatat oleh Supabase untuk semua web yang memakai Akun Tokder.</p></div>${m.galat ? `<p class="muted">${esc(m.galat)}</p>` : !m.terhubung ? '<p class="muted">Office belum tersambung.</p>' : m.sesi.length ? m.sesi.map((x) => baris(x, true)).join('') : '<p class="muted">Tidak ada sesi aktif.</p>'}</section>`;
}

PAGES.jejak = function () {
  const n = J.ring ? J.ring.peringatan : 0;
  const tabs = [['peringatan', 'Peringatan' + (n ? ` (${n})` : '')], ['pengguna', 'Pengguna'], ['riwayat', 'Riwayat'], ['sesi', 'Sesi aktif']];
  return `<header class="head"><div><h1>Jejak</h1><p>Siapa masuk, dari mana, dengan perangkat apa, dan apa yang dilakukan. Hanya pemilik yang melihat halaman ini.</p></div>
      <div class="tools"><a class="btn ghost" href="/pengaturan">‹ Pengaturan</a><button class="btn" data-act="jejak-sinkron">Sinkronkan Office</button></div></header>
    <div class="seg" role="group" aria-label="Bagian">${tabs.map(([k, l]) => `<button data-act="jejak-tab" data-v="${k}" aria-pressed="${J.tab === k}">${l}</button>`).join('')}</div>
    ${J.galat ? `<div class="notice" role="alert"><span>${esc(J.galat)}</span></div>` : ''}
    <div class="stack-page">${J.tab === 'peringatan' ? tabPeringatan() : J.tab === 'pengguna' ? tabPengguna() : J.tab === 'riwayat' ? tabRiwayat() : tabSesi()}</div>`;
};

AFTER.jejak = function () { if (!J.dimuat) { J.dimuat = true; muat(J.tab); } };

// ---- aksi
function bacaFilter() {
  J.filter = { nama: $('#jf-nama').value, jenis: $('#jf-jenis').value, sumber: $('#jf-sumber').value, hasil: $('#jf-hasil').value, hari: $('#jf-hari').value, risikoMin: $('#jf-risiko').value, q: $('#jf-q').value.trim() };
}
export async function aksiJejak(act, el) {
  switch (act) {
    case 'jejak-tab': bukaTab(el.dataset.v); break;
    case 'jejak-sinkron': {
      try { const r = await api('/api/jejak/sinkron', { method: 'POST', timeout: 60000 }); toast(r.galat ? 'Office: ' + r.galat : r.terhubung ? `${r.baru} catatan baru dari Office` : 'Office belum tersambung', !!r.galat || !r.terhubung); } catch (e) { toast(e.message, true); }
      J.dimuat = false; muat(J.tab); break;
    }
    case 'jejak-filter': bacaFilter(); J.riw = null; render(); muat('riwayat'); break;
    case 'jejak-reset': J.filter = { hari: '7', jenis: '', sumber: '', hasil: '', nama: '', risikoMin: '', q: '' }; J.riw = null; render(); muat('riwayat'); break;
    case 'jejak-riwayat-nama': J.filter = { ...J.filter, nama: el.dataset.nama }; J.riw = null; J.tab = 'riwayat'; render(); muat('riwayat'); break;
    case 'jejak-lagi': {
      try { const r = await api('/api/jejak?' + query(J.filter, { sebelum: J.riw.berikutnya, batas: 50 })); J.riw = { baris: [...J.riw.baris, ...r.baris], berikutnya: r.berikutnya }; render(); } catch (e) { toast(e.message, true); }
      break;
    }
    case 'jejak-baris': {
      const id = el.dataset.id, buka = !J.buka.has(id);
      buka ? J.buka.add(id) : J.buka.delete(id);
      el.setAttribute('aria-expanded', String(buka));
      const isi = el.parentElement.querySelector('.jj-isi'); if (isi) isi.hidden = !buka;
      break;
    }
    case 'jejak-baris-buka': { const isi = $('#jj-rinci-' + el.dataset.id); if (isi) isi.hidden = !isi.hidden; break; }
    case 'jejak-tinjau': {
      try { await api('/api/jejak/tinjau/' + el.dataset.id, { method: 'POST' }); toast('Ditandai sudah ditinjau'); J.dimuat = false; muat('peringatan'); } catch (e) { toast(e.message, true); }
      break;
    }
    case 'jejak-tinjau-semua': {
      confirmDialog('Tandai semua sudah ditinjau?', 'Semua peringatan yang ada ditandai sudah Anda tinjau. Catatannya tetap tersimpan di Riwayat.', 'Tandai semua', async () => {
        try { const r = await api('/api/jejak/tinjau-semua', { method: 'POST', body: {} }); toast(`${r.jumlah} peringatan ditandai`); muat('peringatan'); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'jejak-cabut': {
      const nama = el.dataset.nama || 'orang ini', ini = !!el.dataset.ini;
      confirmDialog('Keluarkan ' + nama + '?', ini ? 'Ini sesi Anda sendiri. Anda akan keluar dari Tokder di perangkat ini.' : 'Sesi itu langsung berakhir dan harus masuk lagi.', 'Keluarkan', async () => {
        try { await api('/api/jejak/sesi/' + el.dataset.id + '/cabut', { method: 'POST' }); toast('Sesi dikeluarkan'); if (ini) location.href = '/'; else muat('sesi'); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'jejak-pengguna': {
      try {
        const nama = el.dataset.nama, d = await api('/api/jejak/pengguna?nama=' + encodeURIComponent(nama));
        const maks = Math.max(1, ...d.jam.map((x) => x.n));
        const jam = Array.from({ length: 24 }, (_, h) => d.jam.find((x) => x.jam === h) || { jam: h, n: 0 });
        openDialog(`<h2>${esc(nama)}</h2>
          <h3 class="jj-h3">Perangkat yang pernah dipakai masuk</h3>
          ${d.perangkat.length ? `<div class="jj-tabel">${d.perangkat.map((p) => `<div><b>${esc(p.browser || '?')} · ${esc(p.os || '?')}${p.model ? ' · ' + esc(p.model) : ''}</b><span class="muted">${esc(p.perangkat || '')} · ${p.kali}× · pertama ${waktu(p.pertama)} · terakhir ${waktu(p.terakhir)}</span></div>`).join('')}</div>` : '<p class="muted">Belum ada.</p>'}
          <h3 class="jj-h3">Jaringan dan lokasi</h3>
          ${d.jaringan.length ? `<div class="jj-tabel">${d.jaringan.map((j) => `<div><b>${esc(j.ip || '?')}${j.kota ? ' · ' + esc(j.kota) : ''}${j.negara ? ', ' + esc(j.negara) : ''}${j.kantor ? ' · jaringan kantor' : ''}</b><span class="muted">${esc(j.jaringan || '')} · ${j.kali}× · terakhir ${waktu(j.terakhir)}</span></div>`).join('')}</div>` : '<p class="muted">Belum ada.</p>'}
          <h3 class="jj-h3">Jam aktif (WIB, 60 hari)</h3>
          <div class="jj-jam" role="img" aria-label="Aktivitas per jam">${jam.map((x) => `<span title="${String(x.jam).padStart(2, '0')}:00 · ${x.n} kejadian" style="height:${Math.max(2, Math.round((x.n / maks) * 100))}%"></span>`).join('')}</div>
          <div class="jj-jam-label"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
          <h3 class="jj-h3">Halaman yang sering dibuka (30 hari)</h3>
          ${d.halaman.length ? `<div class="jj-tabel">${d.halaman.map((h) => `<div><b class="mono">${esc(h.rute)}</b><span class="muted">${h.kali}× · terakhir ${rel(h.terakhir)}</span></div>`).join('')}</div>` : '<p class="muted">Belum ada.</p>'}
          <div class="actions"><button class="btn primary" data-act="close-overlay">Tutup</button></div>`);
      } catch (e) { toast(e.message, true); }
      break;
    }
    default: break;
  }
}
