import { S, isAdmin, me } from './state.js';
import { closeOverlay } from '../ui/dialog.js';
import { render } from '../ui/layout.js';

export const ROUTES = [
  { id: 'hari-ini', label: 'Hari ini', icon: 'home', karyawan: true },
  { id: 'ringkasan', label: 'Ringkasan', icon: 'home', admin: true },
  { id: 'harian', label: 'Harian', icon: 'day' },
  { id: 'performa', label: 'Performa', short: 'Performa', icon: 'target' },
  { id: 'tren', label: 'Tren channel', short: 'Tren', icon: 'trend' },
  { id: 'konten', label: 'Konten', icon: 'video' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'sosmed', label: 'Sosmed', icon: 'share', admin: true },
  { id: 'presensi', label: 'Presensi', icon: 'pin' },
  { id: 'pengajuan', label: 'Izin & klaim', short: 'Izin', icon: 'inbox' },
  { id: 'gaji', label: 'Gaji', icon: 'wallet' },
  { id: 'identifikasi', label: 'Belum dikenali', icon: 'help' },
  { id: 'karyawan', label: 'Karyawan', icon: 'team', admin: true },
  { id: 'panduan', label: 'Panduan', icon: 'book' },
  { id: 'monetisasi', label: 'Pendapatan', icon: 'money', admin: true },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'gear', admin: true },
];

// The menu in groups, ordered by what each role uses most. The bottom bar on phones shows the first four.
export function menuGroups() {
  if (me()) return [
    { label: 'Kerja saya', ids: ['hari-ini', 'harian', 'performa', 'presensi', 'pengajuan', 'gaji'] },
    { label: 'Channel', ids: ['tren', 'analytics', 'konten', 'identifikasi'] },
    { label: 'Bantuan', ids: ['panduan'] },
  ];
  return [
    { label: 'Pantau', ids: ['ringkasan', 'harian', 'performa', 'tren', 'konten', 'analytics', 'sosmed'] },
    { label: 'Tim', ids: ['presensi', 'pengajuan', 'gaji', 'karyawan', 'identifikasi'] },
    { label: 'Pemilik', ids: ['monetisasi', 'pengaturan', 'panduan'] },
  ];
}

export const TABS = () => (me() ? ['hari-ini', 'presensi', 'performa', 'pengajuan'] : ['ringkasan', 'harian', 'pengajuan', 'gaji']);

export const routeLabel = (r) => (me() && r.id === 'harian' ? 'Harian saya' : me() && r.id === 'performa' ? 'Performa saya' : me() && r.id === 'konten' ? 'Video channel' : r.label);

// Each menu group has its own colour, so it is clear at a glance which part of the app is open.
export const grupOf = (id) => { const i = menuGroups().findIndex((g) => g.ids.includes(id)); return ['a', 'b', 'c'][Math.max(0, i)]; };

export const bisaBuka = (r) => (!r.admin || isAdmin()) && (!r.karyawan || !!me());

export const badgeOf = (id) => (id === 'identifikasi' ? S.unmatched : id === 'pengajuan' ? menunggu() : 0);

// Pages live at real paths (/harian, /presensi, /harian/3); "/" is the home page of each role.
export const pathOf = (id) => (id === (me() ? 'hari-ini' : 'ringkasan') ? '/' : '/' + id);

export function route() {
  const h = location.pathname.replace(/^\/+/, '').split('/')[0] || (me() ? 'hari-ini' : 'ringkasan');
  const r = ROUTES.find((x) => x.id === h);
  if (!r || !bisaBuka(r)) return me() ? 'hari-ini' : 'ringkasan';
  return r.id;
}

export function navigate(path) {
  if (location.pathname + location.hash !== path) history.pushState(null, '', path);
  closeOverlay();
  render();
  // /panduan#p-gaji opens the guide at that section.
  const el = path.includes('#') && document.getElementById(path.split('#')[1]);
  if (el) el.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
}

const menunggu = () => (isAdmin() && S.pengajuan ? S.pengajuan.list.filter((p) => p.status === 'menunggu').length : 0);
