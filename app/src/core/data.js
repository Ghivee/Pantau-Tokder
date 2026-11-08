import { route } from './router.js';
import { PALETTE, topikOf } from './rules.js';
import { S, saveSession } from './state.js';
import { $ } from '../lib/dom.js';
import { WIB, fmt, median, nf, today } from '../lib/format.js';
import { daftarSW, loadInsight, pushDidukung } from '../pages/shared.js';
import { render, renderNav } from '../ui/layout.js';

export async function api(path, opts = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
  let res;
  try {
    res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
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
    // The session ended on the server (signed out elsewhere, password or PIN changed): show the sign-in screen.
    if (res.status === 401 && S.session && !path.includes('/api/auth/login') && !path.includes('editor-login')) {
      saveSession(null);
      render();
      err.message = 'Sesi Anda sudah berakhir. Silakan masuk lagi.';
    }
    throw err;
  }
  if (data === null) throw new Error('Jawaban server tidak bisa dibaca. Coba lagi.');
  return data;
}

// Secondary data may fail on its own; the page still shows what loaded and says what did not.
export const optional = (p, label) => p.catch((e) => { S.warnings.push(label + ': ' + e.message); return null; });

// One request brings everything every page needs, so switching pages never waits for the network.
const BAGIAN = { kalender: 'Jam kerja & libur', aktivitas: 'Aktivitas', channels: 'Daftar channel', scan: 'Status sinkronisasi', oauth: 'Status YouTube Analytics', sosmed: 'TikTok, Instagram & Facebook', goal: 'Target omzet', daily: 'YouTube Analytics', presensi: 'Presensi', gaji: 'Gaji', pengajuan: 'Izin & klaim' };

// The last data is kept on this device so the app opens instantly and still shows something
// on a weak signal. Payroll is left out; signing out clears it.
const CACHE_KEY = 'pt_data';

export function simpanCache(b) {
  try {
    if (!b) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify({ waktu: Date.now(), b: { ...b, gaji: null } }));
  } catch (e) { /* storage full or off: the app works without it */ }
}

function bacaCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return c && c.b && c.b.me && c.b.me.authenticated && Date.now() - c.waktu < 7 * 86400000 ? c : null;
  } catch (e) { return null; }
}

export async function fetchAll() {
  const b = await api('/api/bootstrap');
  pakaiData(b);
  S.offline = null;
  simpanCache(b);
}

function pakaiData(b) {
  applySession(b.me);
  S.warnings = Object.keys(b.gagal || {}).map((k) => (BAGIAN[k] || k) + ': ' + b.gagal[k]);
  Object.assign(S, {
    editors: b.editors, content: b.content, aktivitas: b.aktivitas || [], channels: b.channels || [], scan: b.scan, oauth: b.oauth, sosmed: b.sosmed || null,
    goal: b.goal, daily: b.daily || [], presensi: b.presensi || (b.gagal && b.gagal.presensi ? { error: b.gagal.presensi } : null),
    pengajuan: b.pengajuan || null, kalender: b.kalender || null,
    error: null, loadedAt: Date.now(),
  });
  const bln = today().slice(0, 7);
  if (!S.gajiBulan) S.gajiBulan = bln;
  S.gajiCache = b.gaji ? { [bln]: b.gaji } : {};
  normalize();
}

const applySession = (who) => saveSession(!who || !who.authenticated ? null : who.type === 'admin' ? { type: 'admin' } : { type: 'karyawan', id: who.id, nama: who.nama });

export async function load() {
  S.error = null;
  // Show the saved data at once; fresh data replaces it a moment later.
  const c = bacaCache();
  if (c) { try { pakaiData(c.b); render(); } catch (e) { simpanCache(null); } }
  try {
    await fetchAll();
  } catch (e) {
    // 401 means signed out: the sign-in screen is shown, not an error.
    if (e.status === 401) saveSession(null);
    // No connection but saved data on screen: keep it, labelled with its time.
    else if (c && !e.status && S.session) S.offline = c.waktu;
    else { console.error(e); S.error = e.message; }
  }
  render();
  if (S.session) {
    autoSync(); loadInsight(true);
    cekNotif().then(() => { if (['ringkasan', 'pengaturan', 'pengajuan', 'presensi'].includes(route()) && !$('#overlay').innerHTML) render(); });
  }
}

// Quiet refresh: new numbers without losing the open dialog or scroll position.
let refreshing = false;

export async function refresh() {
  if (refreshing || !S.session) return;
  refreshing = true;
  try {
    await fetchAll();
    loadInsight(true);
    if (!$('#overlay').innerHTML && !document.activeElement.matches('input, select, textarea')) render(); else renderNav();
  } catch (e) {
    console.warn('Refresh failed:', e.message);
  } finally {
    refreshing = false;
  }
}

// Asks the server to pull fresh numbers from YouTube when the last sync is older than 15 minutes.
export let syncing = false;

export const lastScanAt = () => { const l = S.scan && S.scan.last_scan; const t = l && new Date(l.waktu_scan || l.created_at).getTime(); return t || null; };

async function autoSync(force = false) {
  if (syncing || S.error || !S.session) return;
  const last = lastScanAt();
  if (!force && last && Date.now() - last < 15 * 60000) return;
  syncing = true;
  renderNav();
  try {
    const r = await api('/api/scan/auto', { timeout: 75000 });
    if (!r.skipped) await refresh();
  } catch (e) {
    S.warnings.push('Sinkronisasi otomatis: ' + e.message);
  } finally {
    syncing = false;
    renderNav();
  }
}

setInterval(() => { if (document.visibilityState === 'visible' && !S.error) refresh().then(() => autoSync()); }, 5 * 60000);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.loadedAt && Date.now() - S.loadedAt > 2 * 60000) refresh().then(() => autoSync());
});

export const agoText = (t) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu';
};

export function normalize() {
  S.cache.clear();
  S.editors.sort((a, b) => a.id - b.id);
  S.editors.forEach((e, i) => { e._color = PALETTE[i % PALETTE.length]; e.peran = e.peran || 'editor'; e.status = e.status || 'aktif'; });
  const chNames = Object.fromEntries((S.channels || []).map((c) => [c.id, c.nama]));
  const firstCh = (S.channels[0] && S.channels[0].id) || 'utama';
  S.content.forEach((c) => {
    const w = new Date(new Date(c.tanggal_upload).getTime() + WIB).toISOString();
    c._day = w.slice(0, 10);
    c._jam = w.slice(11, 16);
    c._ch = c.channel_id || firstCh;
    c._chNama = c.channel_nama || chNames[c._ch] || 'Channel utama';
    c._topik = topikOf(c.judul || '');
    c.views = +c.views || 0; c.likes = +c.likes || 0; c.comments = +c.comments || 0; c.revenue = c.revenue == null ? null : +c.revenue;
    c._age = (Date.now() - new Date(c.tanggal_upload).getTime()) / 86400000;
    if (typeof c.retention_data === 'string') { try { c.retention_data = JSON.parse(c.retention_data); } catch (e) { c.retention_data = null; } }
  });
  if (!S.channels.length) {
    const seen = {};
    S.content.forEach((c) => { seen[c._ch] = c._chNama; });
    S.channels = Object.entries(seen).map(([id, nama]) => ({ id, nama }));
  }
  const CH_COLORS = ['var(--s4)', 'var(--s5)', 'var(--s3)', 'var(--s1)', 'var(--s2)'];
  S.channels.forEach((c, i) => { c._color = CH_COLORS[i % CH_COLORS.length]; });
  S.connected = new Set(((S.oauth && S.oauth.channels) || []).filter((c) => c.connected).map((c) => c.id));
  S.daily.forEach((d) => { d.views = +d.views || 0; d.menit_tonton = +d.menit_tonton || 0; d.sub_naik = +d.sub_naik || 0; d.sub_turun = +d.sub_turun || 0; d.revenue = d.revenue == null ? null : +d.revenue; });
  S.aktivitas.forEach((a) => { a.editor_id = +a.editor_id; a.jumlah = +a.jumlah || 1; a.tanggal = String(a.tanggal).slice(0, 10); });
  // Median views per channel + type, from videos old enough for views to settle.
  S.medians = {};
  const grouped = {};
  S.content.filter((c) => c._age >= 2 && c._age <= 32).forEach((c) => { (grouped[c._ch + '|' + c.tipe_video] ||= []).push(c.views); });
  Object.entries(grouped).forEach(([k, v]) => { S.medians[k] = median(v); });
  if (!S.day) S.day = today();
  buildIndex();
}

function buildIndex() {
  const push = (map, k, v) => { const a = map.get(k); if (a) a.push(v); else map.set(k, [v]); };
  S.edMap = new Map(S.editors.map((e) => [e.id, e]));
  S.byEdDay = new Map();
  S.akByEdDay = new Map();
  S.unmatched = 0;
  S.content.forEach((c) => { if (S.edMap.has(c.editor_id)) push(S.byEdDay, c.editor_id + '|' + c._day, c); else if (belumDikenali(c)) S.unmatched++; });
  S.aktivitas.forEach((a) => push(S.akByEdDay, a.editor_id + '|' + a.tanggal, a));
}

export const editorById = (id) => S.edMap.get(+id) || null;

// editor_id 0 = made by a colleague (employees are not told who).
export const belumDikenali = (c) => c.editor_id == null || (c.editor_id !== 0 && !S.edMap.has(+c.editor_id));

export const activeEditors = () => S.editors.filter((e) => e.status !== 'nonaktif');

export const chName = (id) => (S.channels.find((c) => c.id === id) || {}).nama || 'Channel utama';

export const chColor = (id) => (S.channels.find((c) => c.id === id) || {})._color || 'var(--muted)';

// Monitored channels with their YouTube Analytics connection state.
// includeExtra: also list connected channels that are not monitored (only Pengaturan needs them).
export function analyticsChannels(includeExtra = false) {
  const st = (S.oauth && S.oauth.channels) || [];
  const ids = [...new Set([...S.channels.map((c) => c.id), ...(includeExtra ? st.filter((c) => c.connected).map((c) => c.id) : [])])];
  return ids.map((id) => {
    const x = st.find((c) => c.id === id) || {};
    return { id, nama: (S.channels.find((c) => c.id === id) || {}).nama || x.nama || id, connected: !!x.connected, connected_at: x.connected_at || null };
  });
}

export const jamMenit = (menit) => (menit >= 600 ? fmt(menit / 60) + ' jam' : nf.format(Math.round(menit / 60 * 10) / 10) + ' jam');

export const niceStep = (max) => { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw) || p * 10; };

async function cekNotif() {
  if (!pushDidukung()) { daftarSW(); S.notif = { didukung: false, aktif: false }; return; }
  const reg = await daftarSW();
  const sub = reg && (await reg.pushManager.getSubscription().catch(() => null));
  S.notif = { didukung: true, aktif: !!sub && Notification.permission === 'granted', izin: Notification.permission };
}
