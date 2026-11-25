import { api } from './data.js';

// "Masuk dengan Master": Master mengirim token Supabase lewat bagian # alamat (tidak ikut dikirim ke server).
// Token langsung dihapus dari alamat, ditukar dengan sesi Pantau, dan tidak disimpan di browser.
let info = null;

export async function ssoInfo() {
  if (!info) { try { info = await api('/api/auth/sso-info'); } catch (e) { info = { aktif: false, masterUrl: '' }; } }
  return info;
}

export function masukDenganMaster(masterUrl) {
  if (!/^https:\/\//.test(masterUrl || '')) return;
  location.href = masterUrl + '/?sso=pantau&kembali=' + encodeURIComponent(location.origin);
}

// Dipanggil sekali saat aplikasi dibuka. Mengembalikan { ada, galat }: ada = alamat membawa token, galat = pesan bila gagal.
export async function tangkapTokenSso() {
  const m = /^#sso=([A-Za-z0-9._-]+)$/.exec(location.hash);
  if (!m) return { ada: false, galat: null };
  history.replaceState(null, '', location.pathname + location.search);
  try { await api('/api/auth/sso', { method: 'POST', body: { token: m[1] } }); return { ada: true, galat: null }; } catch (e) { return { ada: true, galat: e.message }; }
}

// "Keluar sekali, keluar semua": setelah sesi Pantau berakhir, Master mengeluarkan akun Tokder,
// lalu mengembalikan ke Pantau (rantai redirect, tanpa membawa data apa pun).
export function keluarSemua(masterUrl) {
  if (!/^https:\/\//.test(masterUrl || '')) return false;
  location.href = masterUrl + '/?keluar=1';
  return true;
}

// Ganti kata sandi hanya bisa di Master (pemegang sesi akun).
export function gantiSandi(masterUrl) {
  if (!/^https:\/\//.test(masterUrl || '')) return;
  location.href = masterUrl + '/?akun=1&kembali=' + encodeURIComponent(location.origin);
}
