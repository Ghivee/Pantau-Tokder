import { S, isAdmin, me } from './state.js';
import { closeOverlay } from '../ui/dialog.js';
import { render } from '../ui/layout.js';

export const ROUTES = [
  { id: 'hari-ini', label: 'Hari ini', icon: 'home', karyawan: true },
  { id: 'rekap', label: 'Rekap', icon: 'chart' },
  { id: 'saran', label: 'Saran', icon: 'bulb' },
  { id: 'ringkasan', label: 'Ringkasan', icon: 'home', admin: true },
  { id: 'harian', label: 'Harian', icon: 'day' },
  { id: 'performa', label: 'Performa', short: 'Performa', icon: 'target' },
  { id: 'tren', label: 'Tren channel', short: 'Tren', icon: 'trend' },
  { id: 'konten', label: 'Konten', icon: 'video' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'sosmed', label: 'Upload', icon: 'share' },
  { id: 'presensi', label: 'Presensi', icon: 'pin' },
  { id: 'pengajuan', label: 'Izin & klaim', short: 'Izin', icon: 'inbox' },
  { id: 'gaji', label: 'Gaji', icon: 'wallet' },
  { id: 'identifikasi', label: 'Belum dikenali', icon: 'help' },
  { id: 'karyawan', label: 'Karyawan', icon: 'team', admin: true },
  { id: 'panduan', label: 'Panduan', icon: 'book' },
  { id: 'monetisasi', label: 'Pendapatan', icon: 'money', admin: true },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'gear', admin: true },
];

export const MENU_LENGKAP = false;

export const beranda = () => (me() && MENU_LENGKAP ? 'hari-ini' : 'rekap');

// The menu in groups, ordered by what each role uses most. The bottom bar on phones shows the first four.
export function menuGroups() {
  // Tampilan ringkas untuk pemilik dan karyawan: Rekap, Saran, Upload. Halaman lain (Hari ini, Harian, Presensi, Gaji, dst.)
  // tidak dihapus, hanya disembunyikan dari menu; set MENU_LENGKAP = true untuk menampilkannya lagi.
  if (!MENU_LENGKAP) return [{ label: 'Menu', ids: ['rekap', 'saran', 'sosmed'] }];
  if (me()) return [
    { label: 'Kerja saya', ids: ['hari-ini', 'harian', 'performa', 'presensi', 'pengajuan', 'gaji'] },
    { label: 'Channel', ids: ['rekap', 'saran', 'sosmed', 'tren', 'analytics', 'konten', 'identifikasi'] },
    { label: 'Bantuan', ids: ['panduan'] },
  ];
  return [
    { label: 'Pantau', ids: ['rekap', 'saran', 'ringkasan', 'harian', 'performa', 'tren', 'konten', 'analytics', 'sosmed'] },
    { label: 'Tim', ids: ['presensi', 'pengajuan', 'gaji', 'karyawan', 'identifikasi'] },
    { label: 'Pemilik', ids: ['monetisasi', 'pengaturan', 'panduan'] },
  ];
}

export const TABS = () => (!MENU_LENGKAP ? ['rekap', 'saran', 'sosmed'] : me() ? ['hari-ini', 'presensi', 'performa', 'pengajuan'] : ['rekap', 'harian', 'pengajuan', 'gaji']);

export const routeLabel = (r) => (me() && r.id === 'harian' ? 'Harian saya' : me() && r.id === 'performa' ? 'Performa saya' : me() && r.id === 'konten' ? 'Video channel' : r.label);


export const bisaBuka = (r) => (!r.admin || isAdmin()) && (!r.karyawan || !!me());

export const badgeOf = (id) => (id === 'identifikasi' ? S.unmatched : id === 'pengajuan' ? menunggu() : 0);

// Pages live at real paths (/harian, /presensi, /harian/3); "/" is the home page of each role.
export const pathOf = (id) => (id === beranda() ? '/' : '/' + id);

export function route() {
  const h = location.pathname.replace(/^\/+/, '').split('/')[0] || beranda();
  const r = ROUTES.find((x) => x.id === h);
  if (!r || !bisaBuka(r)) return beranda();
  return r.id;
}

export function navigate(path) {
  if (location.pathname + location.hash !== path) history.pushState(null, '', path);
  closeOverlay();
  render();
  // /panduan#p-gaji opens the guide at that section.
  const el = path.includes('#') && document.getElementById(path.split('#')[1]);
  if (el) el.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
  const pg = document.getElementById('page'); if (pg) pg.focus({ preventScroll: true });
}

const menunggu = () => (isAdmin() && S.pengajuan ? S.pengajuan.list.filter((p) => p.status === 'menunggu').length : 0);
