import { simpanCache } from './data.js';

export const S = {
  editors: [], content: [], aktivitas: [], channels: [], daily: [], goal: null, scan: null, oauth: null,
  anPeriode: 28,
  error: null, warnings: [], loadedAt: null,
  session: null,
  presensi: null,
  kalender: null,
  gaji: null, gajiBulan: null, gajiCache: {}, gajiRiwayat: null, pengajuan: null, insight: null,
  perfEditor: null, perfPeriode: 30, trenCh: 'all',
  periode: 7, channel: 'all', day: null,
  konten: { q: '', channel: 'all', editor: 'all', tipe: 'all', periode: '30', sort: 'tanggal', dir: 'desc', page: 1 },
  sel: new Set(),
  cache: new Map(),
  // Lookup tables rebuilt by normalize(), so pages find a person's videos and tasks without scanning everything.
  edMap: new Map(), byEdDay: new Map(), akByEdDay: new Map(), unmatched: 0,
};

// Who is signed in lives in an HttpOnly cookie checked by the server; the browser keeps nothing secret.
try { localStorage.removeItem('pt_session'); localStorage.removeItem('adminToken'); } catch (e) { /* storage off */ }

export function saveSession(s) {
  S.session = s;
  if (!s) {
    Object.assign(S, { editors: [], content: [], aktivitas: [], daily: [], goal: null, presensi: null, gajiCache: {}, gajiRiwayat: null, pengajuan: null, insight: null, sistem: undefined, akses: undefined, akun: undefined, warnings: [], offline: null });
    simpanCache(null);
  }
}

export const isAdmin = () => S.session && S.session.type === 'admin';

export const me = () => (S.session && S.session.type === 'karyawan' ? S.editors.find((e) => e.id === S.session.id) || null : null);

export const canLog = () => isAdmin() || !!me();

export const canAssign = () => bisa('tetapkan');

// Hak akses per orang, diatur pemilik di Pengaturan > Akses karyawan (server yang menegakkannya; ini hanya untuk tampilan).
export const bisa = (aksi) => isAdmin() || !!(me() && me().izin && me().izin[aksi] === true);

// Penghasilan: pemilik, atau karyawan yang diizinkan pemilik.
export const lihatUang = () => isAdmin() || !!(me() && me().izin && me().izin.uang === true);
