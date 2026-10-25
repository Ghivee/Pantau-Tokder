// app/main.js - Entry point (modular)
import './styles.css';
import { getState, setSession, clearSession, isAdmin, me, canLog, canAssign } from './core/state.js';
import { api, fetchCritical, fetchSecondary, fetchAll, refresh, autoSync, initIntervals, clearApiCache } from './core/api.js';
import { normalize, dayStats, periodStats, daysBack } from './core/scoring.js';
import { icon, esc, fmt, idr, usd, signed, pct, cf, nf, durasi, tglPanjang, today, addDays, nowJam, toast, peranLabel, TUGAS, TUGAS_LAIN, topikOf, $, $$ } from './core/utils.js';
import { renderNav, ROUTES, setCurrentRoute, getCurrentRoute, editorById, activeEditors, chName, chColor, analyticsChannels, editorCell, vidCell, avatar } from './components/nav.js';
import { loginDialog, catatDialog, editorDialog, goalDialog, confirmDialog, openDialog, closeOverlay } from './components/dialogs.js';
import { videoDrawer } from './components/videoDrawer.js';
import { drawStacked, drawSparkbars, drawRetention } from './charts/charts.js';
import { renderRingkasan } from './pages/ringkasan.js';
import { renderHarian } from './pages/harian.js';
import { renderKonten } from './pages/konten.js';
import { renderAktivitas } from './pages/aktivitas.js';
import { renderAnalytics } from './pages/analytics.js';
import { renderKaryawan } from './pages/karyawan.js';
import { renderPengaturan } from './pages/pengaturan.js';
import { kontenRows, exportCsv } from './pages/konten.js';
import { renderPresensi, loadPresensi, absen, lokasiSaya, ipSaya, initPresensiForm } from './pages/presensi.js';
import { assign } from './components/videoDrawer.js';

// Make functions globally available for inline handlers
window.api = api;
window.refresh = refresh;
window.autoSync = autoSync;
window.toast = toast;
window.confirmDialog = confirmDialog;
window.openDialog = openDialog;
window.closeOverlay = closeOverlay;
window.loginDialog = loginDialog;
window.catatDialog = catatDialog;
window.editorDialog = editorDialog;
window.goalDialog = goalDialog;
window.videoDrawer = videoDrawer;
window.assign = assign;
window.exportCsv = exportCsv;
window.kontenRows = kontenRows;
window.__pt_render = () => render();
window.__pt_renderNav = () => renderNav();

// Who is signed in is decided by the server (HttpOnly cookie); nothing about it is kept in localStorage.
try { localStorage.removeItem('pt_session'); localStorage.removeItem('adminToken'); } catch (e) {}
window.__pt_reload = async () => { clearApiCache(); getState().presensi = null; await load(); };

// Theme
try { const t = localStorage.getItem('pt_theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}

let intervalsStarted = false;
const syncNow = (force) => autoSync(force, renderNav, api, () => refresh(render, renderNav, fetchCritical, normalize, true));

// Main load function - Progressive loading: critical first, secondary background
async function load() {
  let who;
  try {
    who = await api('/api/auth/me');
  } catch (e) {
    getState().error = e.message;
    render();
    return;
  }
  clearSession();
  if (who.authenticated) setSession(who.type === 'admin' ? { type: 'admin' } : { type: 'karyawan', id: who.id, nama: who.nama });
  if (!getState().session) {
    // Signed out: drop data cached for whoever used this browser before.
    clearApiCache();
    getState().error = null;
    render();
    return;
  }
  
  // 1. CRITICAL: Load editors + content first (cached), render IMMEDIATELY
  try {
    await fetchCritical(normalize, true); // use cache
    render(); // Render SEGERA dengan data critical
  } catch (e) {
    console.error(e);
    getState().error = e.message;
    render();
    return;
  }
  
  // 2. SECONDARY: Load remaining data in background (non-blocking)
  fetchSecondary(true).then(() => {
    if (!$('#overlay').innerHTML) render(); // Re-render dengan data lengkap
    syncNow(false);
  }).catch(e => console.warn('Secondary load failed:', e.message));
  
  // 3. Init intervals once (use fetchCritical for periodic refresh)
  if (intervalsStarted) return;
  intervalsStarted = true;
  initIntervals(() => refresh(render, renderNav, fetchCritical, normalize, true), syncNow);
}

// Render function
function render() {
  const S = getState();
  const route = setCurrentRoute((location.hash || '#ringkasan').slice(1));
  
  renderNav();
  
  const page = $('#page');
  const notice = $('#notice');
  
  if (S.warnings.length) {
    notice.innerHTML = S.warnings.map((w) => `<div class="notice warn">${icon('help')} ${esc(w)}</div>`).join('');
  } else {
    notice.innerHTML = '';
  }
  
  if (!S.session && !S.error) {
    notice.innerHTML = '';
    page.innerHTML = `<section class="card"><div class="empty"><b>Masuk untuk melihat data</b><br>Data tim, konten dan presensi hanya untuk pemilik dan karyawan.<br><br><button class="btn primary" data-act="login">${icon('out')} Masuk</button></div></section>`;
    return;
  }

  if (S.error) {
    page.innerHTML = `<div class="card"><div class="empty"><b>Gagal memuat data</b><br>${esc(S.error)}<br><button class="btn primary" data-act="retry">${icon('sync')} Coba lagi</button></div></div>`;
    return;
  }
  
  switch (route.hash) {
    case 'ringkasan': page.innerHTML = renderRingkasan(); break;
    case 'harian': page.innerHTML = renderHarian(); break;
    case 'konten': page.innerHTML = renderKonten(); initKontenListeners(); break;
    case 'aktivitas': page.innerHTML = renderAktivitas(); break;
    case 'analytics': page.innerHTML = renderAnalytics(); initAnalyticsCharts(); break;
    case 'karyawan': page.innerHTML = renderKaryawan(); break;
    case 'pengaturan': page.innerHTML = renderPengaturan(); break;
    case 'presensi': page.innerHTML = renderPresensi(); initPresensiForm(); break;
    default: page.innerHTML = renderRingkasan();
  }
  
  // Initialize charts after DOM update
  if (route.hash === 'ringkasan') initRingkasanCharts();
  if (route.hash === 'analytics') initAnalyticsCharts();
  
  // Scroll to top on route change
  window.scrollTo({ top: 0 });
}

// Initialize konten page listeners
function initKontenListeners() {
  const S = getState();
  const k = S.konten;
  const q = $('#k-q');
  if (q) {
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { k.q = q.value; k.page = 1; render(); const n = $('#k-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
  }
  [['#k-channel', 'channel'], ['#k-editor', 'editor'], ['#k-tipe', 'tipe'], ['#k-periode', 'periode']].forEach(([s, f]) => $(s)?.addEventListener('change', (ev) => { k[f] = ev.target.value; k.page = 1; render(); }));
  
  // Selection
  const all = $('#sel-all');
  if (all) all.addEventListener('change', () => { $$('[data-sel]').forEach((c) => { c.checked = all.checked; if (c.checked) S.sel.add(+c.dataset.sel); else S.sel.delete(+c.dataset.sel); }); const sc = $('#sel-count'); if (sc) sc.textContent = S.sel.size + ' dipilih'; });
  $$('[data-sel]').forEach((c) => c.addEventListener('change', () => { if (c.checked) S.sel.add(+c.dataset.sel); else S.sel.delete(+c.dataset.sel); const sc = $('#sel-count'); if (sc) sc.textContent = S.sel.size + ' dipilih'; }));
  $$('[data-assign]').forEach((s) => s.addEventListener('change', () => { if (s.value) { closeOverlay(); assign([+s.dataset.assign], +s.value); } }));
}

// One value per day (0 when YouTube Analytics has no row for it), aligned with `days`.
const viewsPerDay = (channelId, days) => days.map((d) => { const r = getState().daily.find((x) => x.channel_id === channelId && x.tanggal === d); return r ? +r.views || 0 : 0; });

// Initialize ringkasan charts
function initRingkasanCharts() {
  const S = getState();
  const days = daysBack(S.periode);
  const team = activeEditors().filter((e) => (e.peran || 'editor') === 'editor');
  const series = team.map((e) => ({ name: e.nama, color: e._color, values: days.map((d) => S.content.filter((c) => c.editor_id === e.id && c._day === d).length) }));
  series.push({ name: 'Belum dikenali', color: 'var(--line-2)', values: days.map((d) => S.content.filter((c) => c._day === d && !team.some((e) => e.id === c.editor_id)).length) });
  const target = team.reduce((s, e) => s + (e.target_harian || 3) * days.length, 0);
  
  const box = $('#chart-stacked');
  if (box) drawStacked(box, { days, series, target });
  
  // Sparkbars for channels
  analyticsChannels().forEach((c) => {
    const box = $('#spark-' + c.id);
    if (box) {
      drawSparkbars(box, { days, values: viewsPerDay(c.id, days), color: c.connected ? 'var(--s1)' : 'var(--muted)', label: c.nama });
    }
  });
}

// Initialize analytics charts
function initAnalyticsCharts() {
  const S = getState();
  const chans = analyticsChannels().filter((c) => c.connected);
  if (!chans.length) return;
  
  const days = daysBack(30);
  const series = chans.map((c) => ({ name: c.nama, color: c.connected ? 'var(--s1)' : 'var(--muted)', values: days.map((d) => { const r = S.daily.find((x) => x.channel_id === c.id && x.tanggal === d); return r ? r.views : 0; }) }));
  
  const box = $('#chart-analytics');
  if (box) drawStacked(box, { days, series, label: 'Views per channel (30 hari)' });
  
  chans.forEach((c) => {
    const box = $('#spark-' + c.id);
    if (box) {
      drawSparkbars(box, { days, values: viewsPerDay(c.id, days), color: 'var(--s1)', label: c.nama });
    }
  });
}

// Event delegation for all actions
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'close-overlay') { if (ev.target === el || el.tagName === 'BUTTON') closeOverlay(); return; }
  
  const S = getState();
  switch (act) {
    case 'login': loginDialog(); break;
    case 'logout': 
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
      clearSession(); clearApiCache(); toast('Anda sudah keluar'); await load(); break;
    case 'retry': S.error = null; $('#page').innerHTML = '<div class="skeleton" style="height:320px"></div>'; await load(); break;
    case 'theme': {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('pt_theme', next); } catch (e) {}
      render();
      break;
    }
    case 'periode': S.periode = +el.dataset.v; render(); break;
    case 'hari': { const d = addDays(S.day, +el.dataset.v); if (d <= today()) { S.day = d; render(); } break; }
    case 'hari-ini': S.day = today(); render(); break;
    case 'ke-hari': S.day = el.dataset.v; render(); break;
    case 'lihat-orang': ev.preventDefault(); location.hash = '#harian/' + el.dataset.id; break;
    case 'catat': catatDialog(+el.dataset.id || null); break;
    case 'hapus-aktivitas':
      confirmDialog('Hapus aktivitas?', 'Catatan ini akan dihapus dan skor dihitung ulang.', 'Hapus', async () => {
        try { await api('/api/aktivitas/' + el.dataset.id, { method: 'DELETE' }); await refresh(); S.cache.clear(); toast('Aktivitas dihapus'); render(); } catch (e) { toast(e.message, true); }
      });
      break;
    case 'video': ev.preventDefault(); videoDrawer(el.dataset.id); break;
    case 'sort': { const k = S.konten; if (k.sort === el.dataset.k) k.dir = k.dir === 'asc' ? 'desc' : 'asc'; else { k.sort = el.dataset.k; k.dir = el.dataset.k === 'judul' || el.dataset.k === 'editor' ? 'asc' : 'desc'; } render(); break; }
    case 'page': S.konten.page += +el.dataset.v; render(); window.scrollTo({ top: 0 }); break;
    case 'csv': exportCsv(); break;
    case 'bulk-assign': { const v = +$('#bulk-editor').value; if (!v) return toast('Pilih karyawan dulu', true); if (!S.sel.size) return toast('Centang video dulu', true); assign([...S.sel], v); break; }
    case 'editor-form': editorDialog(+el.dataset.id || null); break;
    case 'editor-hapus': {
      const e = editorById(el.dataset.id);
      confirmDialog('Hapus ' + e.nama + '?', 'Video buatannya akan kembali ke daftar "Belum dikenali". Untuk sekadar menonaktifkan, ubah statusnya menjadi Nonaktif.', 'Hapus', async () => {
        try { await api('/api/editors/' + e.id, { method: 'DELETE' }); S.editors = S.editors.filter((x) => x.id !== e.id); S.content.forEach((c) => { if (c.editor_id === e.id) c.editor_id = null; }); normalize(); toast(e.nama + ' dihapus'); render(); } catch (err) { toast(err.message, true); }
      });
      break;
    }
    case 'goal': goalDialog(); break;
    case 'absen': await absen(el); break;
    case 'presensi-lokasi-saya': await lokasiSaya(); break;
    case 'presensi-ip-saya': ipSaya(el); break;
    case 'presensi-muat': S.presensi = null; render(); break;
    case 'an-periode': S.anPeriode = +el.dataset.v; render(); break;
    case 'putus-analytics': {
      const c = analyticsChannels().find((x) => x.id === el.dataset.id);
      confirmDialog('Putuskan ' + c.nama + '?', 'Angka YouTube Analytics yang sudah tersimpan tetap ada, tapi tidak diperbarui lagi sampai dihubungkan ulang.', 'Putuskan', async () => {
        try { await api('/api/auth/google/' + encodeURIComponent(c.id), { method: 'DELETE' }); S.oauth = await api('/api/auth/status'); normalize(); toast(c.nama + ' diputuskan'); render(); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'sync': {
      el.disabled = true; el.innerHTML = icon('sync') + 'Menyinkronkan…';
      try { const r = await api('/api/scan', { method: 'POST' }); toast(`Selesai: ${r.newPosts || 0} video baru, ${r.updatedPosts || 0} diperbarui` + (r.analyticsChannels != null ? `, analytics ${r.analyticsChannels} channel` : '') + (r.errors ? ` · ${r.errors.length} catatan, lihat log` : '') + (r.skipped ? ' (' + r.reason + ')' : '')); await refresh(); } catch (e) { toast(e.message, true); render(); }
      break;
    }
    case 'ganti-pw': {
      const v = $('#pw-baru').value;
      try { await api('/api/auth/password', { method: 'POST', body: { baru: v } }); toast('Password tersimpan. Perangkat lain yang masuk sebagai pemilik sudah dikeluarkan.'); $('#pw-baru').value = ''; } catch (e) { toast(e.message, true); }
      break;
    }
    case 'edit-channels': {
      // Open channel management dialog
      openDialog(`<h2>Kelola Channel</h2><p>Masukkan Channel ID atau @handle (satu per baris):</p><textarea id="ch-input" class="input" rows="6" style="font-family:monospace">${S.channels.map(c => c.id).join('\n')}</textarea><div class="actions"><button class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="save-channels">Simpan</button></div>`, (d) => {
        $('#save-channels', d).addEventListener('click', async () => {
          const val = $('#ch-input', d).value.trim().split('\n').map(s => s.trim()).filter(Boolean);
          try { await api('/api/channels', { method: 'PUT', body: { channels: val } }); closeOverlay(); toast('Channel diperbarui'); await refresh(); } catch (e) { toast(e.message, true); }
        });
      });
      break;
    }
    default: break;
  }
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#overlay').innerHTML) closeOverlay(); });
window.addEventListener('hashchange', () => { closeOverlay(); render(); window.scrollTo({ top: 0 }); });
let lastW = innerWidth, rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; if (!$('#overlay').innerHTML) render(); } }, 200); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderNav());

// Start
load();