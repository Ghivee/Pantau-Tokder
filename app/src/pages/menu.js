import { PAGES } from '../core/registry.js';
import { ROUTES, TABS, badgeOf, bisaBuka, menuGroups, pathOf, routeLabel } from '../core/router.js';
import { me } from '../core/state.js';
import { esc } from '../lib/dom.js';
import { avatar, peranLabel } from '../ui/bits.js';
import { icon } from '../ui/icons.js';

// Halaman Menu: satu kartu per tujuan, lalu akun dan tombol keluar. Susunannya sama dengan Menu di Office dan Telprom.
const KET = { karyawan: 'Data tim dan hak akses', gaji: 'Slip dan aturan gaji', pengaturan: 'Sambungan data dan keamanan', akun: 'Kata sandi dan sesi Anda' };

PAGES.menu = function () {
  const tabs = TABS();
  const tujuan = menuGroups().flatMap((g) => g.ids).map((id) => ROUTES.find((r) => r.id === id)).filter((r) => bisaBuka(r) && !tabs.includes(r.id));
  const who = me();
  return `<header class="head"><div><h1>Menu</h1><p>Pengaturan tim dan akun Anda.</p></div></header>
    <nav class="tkm-list" aria-label="Menu lainnya">${tujuan.map((r) => `<a class="tkm" href="${pathOf(r.id)}"><span class="tkm-ikon">${icon(r.icon)}</span><span class="tkm-isi"><b>${routeLabel(r)}</b>${KET[r.id] ? `<small>${KET[r.id]}</small>` : ''}</span>${badgeOf(r.id) ? `<span class="tkm-angka">${badgeOf(r.id)}</span>` : ''}<span class="tkm-panah">${icon('right')}</span></a>`).join('')}</nav>
    <h2 class="tkm-judul">Akun Tokder</h2>
    <div class="tkm-list">
      <div class="tkm" style="cursor:default">${who ? avatar(who, 'sm') : '<span class="ava sm" style="background:var(--ink);color:var(--paper)">P</span>'}<span class="tkm-isi"><b>${who ? esc(who.nama) : 'Pemilik'}</b><small>${who ? peranLabel(who.peran) : 'Akses penuh'}</small></span></div>
      <button type="button" class="tkm merah" data-act="logout"><span class="tkm-ikon">${icon('out')}</span><span class="tkm-isi"><b>Keluar</b></span></button>
    </div>`;
};
