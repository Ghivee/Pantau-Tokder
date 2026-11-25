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

// Dipanggil sekali saat aplikasi dibuka. Mengembalikan pesan galat bila gagal, atau null.
export async function tangkapTokenSso() {
  const m = /^#sso=([A-Za-z0-9._-]+)$/.exec(location.hash);
  if (!m) return null;
  history.replaceState(null, '', location.pathname + location.search);
  try { await api('/api/auth/sso', { method: 'POST', body: { token: m[1] } }); return null; } catch (e) { return e.message; }
}
