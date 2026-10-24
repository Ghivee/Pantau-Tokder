// app/core/api.js - Centralized API layer with progressive loading & stale-while-revalidate cache
import { getState, isAdmin, clearSession } from './state.js';
import { today, addDays, $ } from './utils.js';
import { normalize } from './scoring.js';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 menit
const CACHE_PREFIX = 'pt_cache_';

function getCache(key) {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const { data, timestamp } = JSON.parse(item);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  } catch (e) {}
  return null;
}

function setCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

async function cachedFetch(key, fetcher, useCache = true) {
  if (useCache) {
    const cached = getCache(key);
    if (cached) {
      // Stale-while-revalidate: fetch fresh in background
      fetcher().then(fresh => setCache(key, fresh)).catch(() => {});
      return cached;
    }
  }
  const fresh = await fetcher();
  setCache(key, fresh);
  return fresh;
}

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
      clearSession();
      if (typeof window !== 'undefined' && typeof window.__pt_renderNav === 'function') window.__pt_renderNav();
      err.message = 'Sesi Anda tidak berlaku lagi (password atau PIN sudah berubah). Silakan masuk ulang.';
    }
    throw err;
  }
  if (data === null) throw new Error('Jawaban server tidak bisa dibaca. Coba lagi.');
  return data;
}

export const optional = (p, label) => p.catch((e) => { getState().warnings.push(label + ': ' + e.message); return null; });

// CRITICAL: Data minimal untuk render halaman (editors + content)
export async function fetchCritical(normalize, useCache = true) {
  const S = getState();
  S.warnings = [];
  
  const [editors, content] = await Promise.all([
    cachedFetch('editors', () => api('/api/editors'), useCache),
    cachedFetch('content', () => api('/api/content'), useCache),
  ]);
  
  Object.assign(S, { editors, content, error: null, loadedAt: Date.now() });
  normalize();
  return { editors, content };
}

// SECONDARY: Data tambahan (load di background setelah render)
export async function fetchSecondary(useCache = true) {
  const S = getState();
  const analyticsDays = new URLSearchParams(location.search).get('analyticsDays') || '30';
  
  const [aktivitas, channels, scan, oauth, goal, daily] = await Promise.all([
    cachedFetch('aktivitas', () => optional(api('/api/aktivitas?dari=' + addDays(today(), -30) + '&sampai=' + today()), 'Aktivitas'), useCache),
    cachedFetch('channels', () => optional(api('/api/channels'), 'Daftar channel'), useCache),
    cachedFetch('scan', () => optional(api('/api/scan/status'), 'Status sinkronisasi'), useCache),
    cachedFetch('oauth', () => optional(api('/api/auth/status'), 'Status YouTube Analytics'), useCache),
    isAdmin() ? cachedFetch('goal', () => optional(api('/api/goals'), 'Target omzet'), useCache) : Promise.resolve(S.goal),
    cachedFetch('daily', () => optional(api('/api/analytics?dari=' + addDays(today(), -analyticsDays) + '&sampai=' + today()), 'YouTube Analytics'), useCache),
  ]);
  
  Object.assign(S, { 
    aktivitas: aktivitas || [], 
    channels: channels || [], 
    scan, oauth, goal, 
    daily: daily || [] 
  });
  return { aktivitas, channels, scan, oauth, goal, daily };
}

// FULL: Load semua data (fallback / manual refresh)
export async function fetchAll(normalizeFn, useCache = true) {
  const norm = typeof normalizeFn === 'function' ? normalizeFn : normalize;
  const critical = await fetchCritical(norm, useCache);
  const secondary = await fetchSecondary(useCache);
  return { ...critical, ...secondary };
}

let refreshing = false;
export async function refresh(render, renderNav, fetchAllFn, normalizeFn, useCache = true) {
  if (refreshing) return;
  refreshing = true;
  try {
    const doFetch = typeof fetchAllFn === 'function' ? fetchAllFn : fetchAll;
    const doNorm = typeof normalizeFn === 'function' ? normalizeFn : normalize;
    await doFetch(doNorm, useCache);
    const ov = $('#overlay');
    if (typeof render === 'function') {
      if ((!ov || !ov.innerHTML) && !document.activeElement?.matches?.('input, select, textarea')) render();
      else if (typeof renderNav === 'function') renderNav();
    } else if (typeof window !== 'undefined' && typeof window.__pt_render === 'function') {
      if ((!ov || !ov.innerHTML) && !document.activeElement?.matches?.('input, select, textarea')) window.__pt_render();
      else if (typeof window.__pt_renderNav === 'function') window.__pt_renderNav();
    }
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

// Clear cache (dipanggil saat mutate data)
export function clearApiCache(keys) {
  if (!keys) {
    // Clear all pt_cache_*
    Object.keys(localStorage).forEach(k => { if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k); });
  } else if (Array.isArray(keys)) {
    keys.forEach(k => localStorage.removeItem(CACHE_PREFIX + k));
  } else {
    localStorage.removeItem(CACHE_PREFIX + keys);
  }
}