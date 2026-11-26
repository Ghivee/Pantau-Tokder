import { agoText, lastScanAt, syncing } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { ROUTES, TABS, badgeOf, beranda, bisaBuka, menuGroups, pathOf, route, routeLabel } from '../core/router.js';
import { S, me } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { WIB, sum } from '../lib/format.js';
import { avatar, peranLabel } from './bits.js';
import { icon } from './icons.js';
import { pingHalaman } from '../core/jejak.js';
import { ssoInfo } from '../core/sso.js';
import { renderApps } from './tkapps.js';

// Selalu di kiri bawah menu samping.
const BAWAH = ['pengaturan', 'akun'];
const tautanMenu = (r, cur) => `<a href="${pathOf(r.id)}" ${r.id === cur ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${routeLabel(r)}</span>${badgeOf(r.id) ? `<span class="count">${badgeOf(r.id)}</span>` : ''}</a>`;

export function renderNav() {
  renderApps();
  const cur = route();
  // Sebelum masuk hanya halaman depan yang tampil: tanpa sidebar dan bilah atas.
  document.querySelector('.shell').classList.toggle('publik', !S.session);
  const grup = S.session ? menuGroups().map((g) => ({ label: g.label, list: g.ids.map((id) => ROUTES.find((x) => x.id === id)).filter(bisaBuka) })) : [];
  const atas = grup.map((g) => ({ label: g.label, list: g.list.filter((r) => !BAWAH.includes(r.id)) })).filter((g) => g.list.length);
  const bawah = BAWAH.flatMap((id) => grup.flatMap((g) => g.list).filter((r) => r.id === id));
  $('#nav').innerHTML = atas.map((g) => (atas.length > 1 ? `<div class="nav-label" role="presentation">${g.label}</div>` : '') + g.list.map((r) => tautanMenu(r, cur)).join('')).join('');
  const who = me();
  const theme = document.documentElement.dataset.theme;
  const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const last = lastScanAt();
  const freshText = syncing ? 'Memperbarui data YouTube…' : last ? 'YouTube diperbarui ' + agoText(last) : 'Belum pernah sinkron';
  const who2 = me();
  $('#appbar').innerHTML = `
      <img class="logo" src="/logo.svg" alt="">
      <div class="ttl"><b>Tokder</b><small>${last || syncing ? '<span class="dot"></span>' : ''}${freshText}</small></div>
      ${S.session ? '' : '<button class="btn sm primary" data-act="login" style="border-radius:9px;padding:0 14px">Masuk</button>'}`;
  const tabs = TABS();
  const moreActive = !tabs.includes(cur);
  const sisa = sum(ROUTES.filter((r) => !tabs.includes(r.id) && bisaBuka(r) && menuGroups().some((g) => g.ids.includes(r.id))), (r) => badgeOf(r.id));
  $('#tabbar').innerHTML = !S.session ? '' : `<button data-act="lainnya" ${moreActive ? 'aria-current="page"' : ''}>${icon('menu')}<span>Menu</span>${sisa ? `<span class="count">${sisa > 99 ? '99+' : sisa}</span>` : ''}</button>` +
    tabs.map((id) => { const r = ROUTES.find((x) => x.id === id); return `<a href="${pathOf(id)}" ${id === cur ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${r.short || routeLabel(r)}</span>${badgeOf(id) ? `<span class="count">${badgeOf(id) > 99 ? '99+' : badgeOf(id)}</span>` : ''}</a>`; }).join('');
  $('#side-foot').innerHTML = `
      ${bawah.length ? `<nav class="nav nav-bawah" id="nav-bawah" aria-label="Pengaturan dan akun">${bawah.map((r) => tautanMenu(r, cur)).join('')}</nav>` : ''}
      <div class="fresh" title="Data YouTube ditarik otomatis tiap 15 menit selama aplikasi terbuka">${last || syncing ? `<span class="dot${syncing ? ' live' : ''}"></span>` : ''}${freshText}</div>
      ${S.session ? `<div class="who">${who ? avatar(who, 'sm') : '<span class="ava sm" style="background:var(--ink);color:var(--paper)">P</span>'}<div class="t"><b>${who ? esc(who.nama) : 'Pemilik'}</b><small>${who ? peranLabel(who.peran) : 'Akses penuh'}</small></div></div>` : ''}
      <div class="side-actions">
        ${S.session ? `<button class="btn sm ghost" data-act="logout">${icon('out')}Keluar</button>` : `<button class="btn sm primary" data-act="login">Masuk</button>`}
        <button class="btn sm ghost icon" data-act="theme" aria-label="${dark ? 'Mode terang' : 'Mode gelap'}">${icon(dark ? 'sun' : 'moon')}</button>
      </div>
      <div class="legal"><a href="/privacy.html" target="_blank" rel="noopener">Privasi</a> · <a href="/terms.html" target="_blank" rel="noopener">Syarat</a> · <a href="/data-deletion.html" target="_blank" rel="noopener">Hapus data</a></div>`;
  $('#notice').innerHTML = S.offline && S.session && !S.error
    ? `<div class="notice" role="status"><b>Tanpa koneksi.</b> Menampilkan data tersimpan jam ${new Date(S.offline + WIB).toISOString().slice(11, 16)} WIB. <button class="btn sm ghost" data-act="retry">Coba lagi</button></div>`
    : S.warnings.length && !S.error
    ? `<div class="notice" role="status"><b>Sebagian data tidak termuat.</b> ${S.warnings.map(esc).join(' · ')} <button class="btn sm ghost" data-act="retry">Coba lagi</button></div>`
    : '';
}

// Halaman depan: pintu masuk di kiri, isi dasbor di kanan (ikon dan nama sama dengan menu).
const ISI_DASBOR = [
  ['rangkuman', 'Rangkuman', 'Tayangan, suka, dan komentar video tim dari YouTube, TikTok, Instagram, dan Facebook.'],
  ['naik', 'Upload', 'Satu video diunggah sekali, lalu dikirim sebagai draf ke akun milik tim.'],
  ['team', 'Tim', 'Hasil kerja harian tiap anggota, dengan akses yang diatur pemilik.'],
  ['pin', 'Presensi', 'Absen masuk dan pulang dari radius kantor, tanpa foto.'],
];

function halamanDepan() {
  return `<div class="depan">
    <div class="depan-atas">
      <section class="card depan-masuk" aria-labelledby="depan-judul">
        <div class="depan-merek"><img src="/logo.svg" alt="Logo Tokder" width="48" height="48"><span>Tokder</span></div>
        <h1 id="depan-judul">Ruang kerja tim konten cabai</h1>
        <p class="depan-lead">Dasbor internal tim konten Tokder (channel budidaya cabai) untuk memantau hasil kerja harian dan performa video di YouTube, TikTok, Instagram dan Facebook.</p>
        <div class="depan-aksi">
          <button class="btn primary depan-tombol" data-act="masuk-akun">Masuk dengan Akun Tokder</button>
          <button class="btn ghost depan-cadangan" data-act="masuk-cadangan">Pakai PIN atau password</button>
        </div>
        <p class="muted depan-catatan">Hanya untuk pemilik dan karyawan Tokder. Tidak ada pendaftaran terbuka.</p>
      </section>
      <section class="card depan-isi" aria-labelledby="depan-isi-judul">
        <h2 id="depan-isi-judul">Di dalam dasbor</h2>
        <ul>${ISI_DASBOR.map(([ik, nama, ket]) => `<li><span class="depan-ikon" aria-hidden="true">${icon(ik)}</span><div><b>${nama}</b><p>${ket}</p></div></li>`).join('')}</ul>
      </section>
    </div>
    <section class="card depan-data" aria-labelledby="depan-data-judul">
      <h2 id="depan-data-judul">Data akun platform</h2>
      <div class="depan-kolom">
        <div><h3>Yang dilakukan</h3><p>Pemilik menghubungkan akun milik tim sendiri. Aplikasi membaca nama akun, jumlah pengikut, serta daftar video beserta tayangan, suka, komentar dan bagikan, lalu menampilkannya berdampingan.</p></div>
        <div><h3>Posting sekali upload</h3><p>Pemilik dan anggota tim yang diberi izin mengunggah satu video, lalu mengirimnya sebagai <em>draf</em> ke akun TikTok, Instagram, Facebook dan YouTube milik tim. Tidak ada yang tayang tanpa tindakan pemilik atau anggota tim yang diberi izin menayangkan.</p></div>
        <div><h3>Yang tidak dilakukan</h3><p>Tidak membaca pesan atau data penonton, tidak mengubah atau menghapus konten yang sudah ada, tidak menjual atau membagikan data.</p></div>
      </div>
    </section>
    <footer class="depan-kaki">
      <nav aria-label="Informasi hukum"><a href="/privacy.html">Kebijakan Privasi</a><a href="/terms.html">Syarat Layanan</a><a href="/data-deletion.html">Hapus data</a><a href="mailto:tokodeeres@gmail.com">tokodeeres@gmail.com</a></nav>
      <p class="muted" lang="en">Tokder is a private dashboard for the Tokder chili-farming video team. The owner connects the team's own TikTok, Instagram, Facebook and YouTube accounts to read the accounts' own profile and video statistics, and to let the owner and authorised team members send the team's own videos to those accounts as drafts, which only the owner or members permitted to publish can then publish. See the Privacy Policy and Terms above.</p>
    </footer></div>`;
}

// Bila Akun Tokder belum diatur di server, tombol utama membuka dialog PIN/password dan tombol cadangan disembunyikan.
function siapkanHalamanDepan(page) {
  ssoInfo().then((sso) => {
    if (sso.aktif) return;
    const utama = page.querySelector('.depan-tombol'), cadangan = page.querySelector('.depan-cadangan');
    if (utama) utama.textContent = 'Masuk';
    if (cadangan) cadangan.hidden = true;
  });
}

// Isi halaman terakhir yang digambar, untuk membandingkan saat penyegaran di belakang layar.
let htmlTerakhir = '';

// True bila orang sedang mengisi atau mengirim sesuatu di halaman ini.
function sedangDiisi(page) {
  if (page.querySelector('form button:disabled')) return true;
  if (page.contains(document.activeElement) && document.activeElement.matches('input, select, textarea')) return true;
  return $$('input, textarea, select', page).some((el) => {
    if (el.type === 'file') return el.files.length > 0;
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked !== el.defaultChecked;
    if (el.tagName === 'SELECT') { const awal = [...el.options].findIndex((o) => o.defaultSelected); return el.selectedIndex !== Math.max(0, awal); }
    return el.value !== el.defaultValue;
  });
}

// Untuk penyegaran otomatis: gambar ulang hanya bila isinya berubah dan tidak ada yang sedang diisi.
export function renderLatar() {
  const page = $('#page'), r = route();
  if (S.session && !S.error) {
    if ($('#overlay').innerHTML || sedangDiisi(page) || (page.dataset.route === r && PAGES[r]() === htmlTerakhir)) { renderNav(); return; }
  }
  render();
}

export function render() {
  renderNav();
  const r = route();
  const page = $('#page');
  // A page this person cannot open (or an unknown address) shows its fallback at the matching address.
  const want = location.pathname.replace(/^\/+/, '').split('/')[0] || beranda();
  if (want !== r) history.replaceState(null, '', pathOf(r));
  if (!S.session && !S.error) {
    // Halaman depan publik: dibaca juga oleh reviewer TikTok/Meta, jadi menjelaskan apa aplikasi ini,
    // data apa yang dibaca dari tiap platform, dan menaut ke kebijakan privasi, syarat, dan hapus data.
    page.innerHTML = halamanDepan();
    siapkanHalamanDepan(page);
    document.title = 'Masuk · Tokder';
    return;
  }
  if (S.error) {
    page.innerHTML = `<section class="card state" role="alert"><b>Data belum bisa dimuat</b><p>${esc(S.error)}</p><button class="btn primary" data-act="retry">${icon('sync')}Coba lagi</button></section>`;
    return;
  }
  htmlTerakhir = PAGES[r]();
  page.innerHTML = htmlTerakhir;
  page.dataset.route = r;
  // Penjelasan dipangkas satu baris lewat CSS; teks lengkapnya tetap bisa dibaca dengan mengarahkan kursor.
  $$('.head p, .card-h p, .kpi .d', page).forEach((el) => { el.title = el.textContent.trim(); });
  (AFTER[r] || (() => {}))();
  document.title = routeLabel(ROUTES.find((x) => x.id === r) || {}) + ' · Tokder';
  pingHalaman();
}

