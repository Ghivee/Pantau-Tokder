// app/core/api.js - Centralized API layer
import { getState, isAdmin } from './state.js';
import { today, addDays } from './utils.js';

export async function api(path, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  let res;
  try {
    res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
      signal: ctl.signal,
      cache: 'no-store',
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Server terlalu lama menjawab. Periksa koneksi lalu coba lagi.' : 'Tidak bisa terhubung ke server. Periksa koneksi internet Anda.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Server menjawab ' + res.status);
    err.status = res.status;
    if (res.status === 401 && getState().session && !path.includes('/api/auth/login') && !path.includes('editor-login')) {
      import('./state.js').then(m => m.clearSession());
      import('../components/nav.js').then(m => m.renderNav());
      err.message = 'Sesi Anda tidak berlaku lagi (password atau PIN sudah berubah). Silakan masuk ulang.';
    }
    throw err;
  }
  if (data === null) throw new Error('Jawaban server tidak bisa dibaca. Coba lagi.');
  return data;
}

export const optional = (p, label) => p.catch((e) => { getState().warnings.push(label + ': ' + e.message); return null; });

export async function fetchAll(normalize) {
  const S = getState();
  S.warnings = [];
  const [editors, content, aktivitas, channels, scan, oauth, goal, daily] = await Promise.all([
    api('/api/editors'),
    api('/api/content'),
    optional(api('/api/aktivitas?dari=' + addDays(today(), -60) + '&sampai=' + today()), 'Aktivitas'),
    optional(api('/api/channels'), 'Daftar channel'),
    optional(api('/api/scan/status'), 'Status sinkronisasi'),
    optional(api('/api/auth/status'), 'Status YouTube Analytics'),
    isAdmin() ? optional(api('/api/goals'), 'Target omzet') : Promise.resolve(S.goal),
    optional(api('/api/analytics?dari=' + addDays(today(), -190) + '&sampai=' + today()), 'YouTube Analytics'),
  ]);
  Object.assign(S, { editors, content, aktivitas: aktivitas || [], channels: channels || [], scan, oauth, goal, daily: daily || [], error: null, loadedAt: Date.now() });
  normalize();
}

let refreshing = false;
export async function refresh(render, renderNav, fetchAll, normalize) {
  if (refreshing) return;
  refreshing = true;
  try {
    await fetchAll(normalize);
    if (!$('#overlay').innerHTML && !document.activeElement.matches('input, select, textarea')) render(); else renderNav();
  } catch (e) {
    console.warn('Refresh failed:', e.message);
  } finally {
    refreshing = false;
  }
}

let syncing = false;
const lastScanAt = () => { const l = getState().scan && getState().scan.last_scan; const t = l && new Date(l.waktu_scan || l.created_at).getTime(); return t || null; };

export async function autoSync(force, renderNav, api, refresh) {
  if (syncing || getState().error) return;
  const last = lastScanAt();
  if (!force && last && Date.now() - last < 15 * 60000) return;
  syncing = true;
  renderNav();
  try {
    const r = await api('/api/scan/auto', { timeout: 75000 });
    if (!r.skipped) await refresh();
  } catch (e) {
    getState().warnings.push('Sinkronisasi otomatis: ' + e.message);
  } finally {
    syncing = false;
    renderNav();
  }
}

export function initIntervals(refresh, autoSync) {
  setInterval(() => { if (document.visibilityState === 'visible' && !getState().error) refresh().then(() => autoSync()); }, 5 * 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getState().loadedAt && Date.now() - getState().loadedAt > 2 * 60000) refresh().then(() => autoSync());
  });
}