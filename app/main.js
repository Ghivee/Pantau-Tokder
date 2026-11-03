import './styles.css';

(() => {
  'use strict';

  // ============ helpers ============
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('id-ID');
  const cf = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  const fmt = (n) => (n == null || isNaN(n) ? '—' : Math.abs(n) >= 10000 ? cf.format(n) : nf.format(Math.round(n)));
  const pct = (v) => (v == null || isNaN(v) ? '—' : Math.round(v * 100) + '%');
  const idr = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
  const rpOrDash = (v) => (v == null || isNaN(v) ? '—' : idr(v));
  const signed = (v, f = nf.format) => (v == null || isNaN(v) ? '' : (v > 0 ? '+' : v < 0 ? '−' : '±') + f(Math.abs(v)));
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const WIB = 7 * 3600 * 1000;
  const today = () => new Date(Date.now() + WIB).toISOString().slice(0, 10);
  const nowJam = () => new Date(Date.now() + WIB).toISOString().slice(11, 16);
  const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  const asDate = (d) => new Date(d + 'T00:00:00Z');
  const tglPendek = (d) => { const x = asDate(d); return x.getUTCDate() + ' ' + BLN[x.getUTCMonth()]; };
  const tglPanjang = (d) => { const x = asDate(d); return HARI[x.getUTCDay()] + ', ' + x.getUTCDate() + ' ' + BLN[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); };
  const toMin = (hm) => { const p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1]); };
  const durasi = (s) => { s = +s || 0; const m = Math.floor(s / 60); return m + ':' + String(s % 60).padStart(2, '0'); };
  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const sum = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);

  const ICON = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    day: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M8 14h3v3H8z"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
    team: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
    money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    left: '<path d="M15 18l-6-6 6-6"/>',
    right: '<path d="M9 18l6-6-6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    sync: '<path d="M21 12a9 9 0 01-15.5 6.2M3 12A9 9 0 0118.5 5.8"/><path d="M18 2v4h-4M6 22v-4h4"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    out: '<path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
    moon: '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>',
    trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/><path d="M6 6l9-3 1 3"/>',
    inbox: '<path d="M4 4h16v16H4z"/><path d="M4 14h5l1 2h4l1-2h5"/>',
    book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M9 7h6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;

  // ============ rules ============
  const TOL = 15; // menit setelah jadwal yang masih dihitung tepat
  // Target harian tugas lain. `video` = target video hari itu; `frac` = bagian hari yang sudah lewat.
  const TUGAS = [
    { nama: 'Riset harga cabai', short: 'Riset harga', target: (video, frac) => (frac > 0 ? 1 : 0) },
    { nama: 'Buat thumbnail', short: 'Thumbnail', target: (video) => video },
    { nama: 'Cek SEO & tag', short: 'Cek SEO', target: (video) => video },
    { nama: 'Balas komentar', short: 'Komentar', target: (video, frac) => Math.round(30 * frac) },
  ];
  const TUGAS_LAIN = ['Edit video', 'Lainnya'];
  const TOPIK = [
    ['Harga cabai', /harga|pasar|naik|turun|update|prediksi/i],
    ['Pestisida & semprot', /pestisida|insektisida|fungisida|semprot|oplos/i],
    ['Hama & penyakit', /hama|penyakit|thrips|kutu|layu|patek|antraknosa|keriting|virus|ulat|lalat|busuk|fusarium/i],
    ['Pupuk & nutrisi', /pupuk|npk|kocor|kalsium|boron|nutrisi|kompos|organik/i],
    ['Semai & bibit', /semai|bibit|benih|pindah tanam|persemaian/i],
    ['Panen & hasil', /panen|hasil|untung|omzet/i],
    ['Lahan & perawatan', /lahan|mulsa|bedeng|ajir|siram|perawatan|pangkas|wiwil/i],
  ];
  const topikOf = (t) => (TOPIK.find(([, re]) => re.test(t)) || ['Lainnya'])[0];
  const targetOf = (e) => +e.target_harian || 3;
  const slotsOf = (e) => String(e.jadwal || '').split(',').map((s) => s.trim()).filter((s) => /^\d{2}:\d{2}$/.test(s)).sort();
  const gradeOf = (s) => (s == null ? null : s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : 'D');
  const PALETTE = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];

  // ============ state ============
  const S = {
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
  function saveSession(s) {
    S.session = s;
    if (!s) {
      Object.assign(S, { editors: [], content: [], aktivitas: [], daily: [], goal: null, presensi: null, gajiCache: {}, gajiRiwayat: null, pengajuan: null, insight: null, sistem: undefined, warnings: [], offline: null });
      simpanCache(null);
    }
  }
  const isAdmin = () => S.session && S.session.type === 'admin';
  const me = () => (S.session && S.session.type === 'karyawan' ? S.editors.find((e) => e.id === S.session.id) || null : null);
  const canLog = () => isAdmin() || !!me();
  const canAssign = () => isAdmin() || (me() && (me().peran || 'editor') === 'editor');

  // ============ api ============
  async function api(path, opts = {}) {
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
  const optional = (p, label) => p.catch((e) => { S.warnings.push(label + ': ' + e.message); return null; });

  // One request brings everything every page needs, so switching pages never waits for the network.
  const BAGIAN = { kalender: 'Jam kerja & libur', aktivitas: 'Aktivitas', channels: 'Daftar channel', scan: 'Status sinkronisasi', oauth: 'Status YouTube Analytics', sosmed: 'TikTok, Instagram & Facebook', goal: 'Target omzet', daily: 'YouTube Analytics', presensi: 'Presensi', gaji: 'Gaji', pengajuan: 'Izin & klaim' };
  // The last data is kept on this device so the app opens instantly and still shows something
  // on a weak signal. Payroll is left out; signing out clears it.
  const CACHE_KEY = 'pt_data';
  function simpanCache(b) {
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

  async function fetchAll() {
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

  async function load() {
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
  async function refresh() {
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
  let syncing = false;
  const lastScanAt = () => { const l = S.scan && S.scan.last_scan; const t = l && new Date(l.waktu_scan || l.created_at).getTime(); return t || null; };
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
  const agoText = (t) => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu';
  };

  function normalize() {
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

  const editorById = (id) => S.edMap.get(+id) || null;
  // editor_id 0 = made by a colleague (employees are not told who).
  const belumDikenali = (c) => c.editor_id == null || (c.editor_id !== 0 && !S.edMap.has(+c.editor_id));
  const activeEditors = () => S.editors.filter((e) => e.status !== 'nonaktif');
  const chName = (id) => (S.channels.find((c) => c.id === id) || {}).nama || 'Channel utama';
  const chColor = (id) => (S.channels.find((c) => c.id === id) || {})._color || 'var(--muted)';
  // Monitored channels with their YouTube Analytics connection state.
  // includeExtra: also list connected channels that are not monitored (only Pengaturan needs them).
  function analyticsChannels(includeExtra = false) {
    const st = (S.oauth && S.oauth.channels) || [];
    const ids = [...new Set([...S.channels.map((c) => c.id), ...(includeExtra ? st.filter((c) => c.connected).map((c) => c.id) : [])])];
    return ids.map((id) => {
      const x = st.find((c) => c.id === id) || {};
      return { id, nama: (S.channels.find((c) => c.id === id) || {}).nama || x.nama || id, connected: !!x.connected, connected_at: x.connected_at || null };
    });
  }
  const jamMenit = (menit) => (menit >= 600 ? fmt(menit / 60) + ' jam' : nf.format(Math.round(menit / 60 * 10) / 10) + ' jam');
  const niceStep = (max) => { const raw = max / 4; const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); return [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw) || p * 10; };

  // ============ scoring ============
  // Which schedule slot an upload belongs to: the latest slot no more than 30 minutes after the upload.
  function slotFor(e, jam) {
    const slots = slotsOf(e);
    if (!slots.length) return null;
    const t = toMin(jam);
    const before = slots.filter((s) => toMin(s) <= t + 30);
    const slot = before.length ? before[before.length - 1] : slots[0];
    return { slot, late: t - toMin(slot) };
  }

  function dayStats(e, day) {
    const key = e.id + '|' + day;
    if (S.cache.has(key)) return S.cache.get(key);
    // Today only counts the part of the day that has passed: slots already due, or hours since 05:00.
    const partial = day === today();
    let frac = 1;
    if (partial) {
      const now = toMin(nowJam());
      const sl = slotsOf(e);
      frac = sl.length ? sl.filter((x) => toMin(x) + TOL <= now).length / sl.length : Math.min(1, Math.max(0, (now - 300) / (22 * 60 - 300)));
    }
    const target = jamKerja(day) ? Math.round(targetOf(e) * frac) : 0;
    const tTarget = Object.fromEntries(TUGAS.map((t) => [t.nama, t.target(target, frac)]));
    const vids = (S.byEdDay.get(e.id + '|' + day) || []).slice().sort((a, b) => a._jam.localeCompare(b._jam));
    vids.forEach((v) => { const m = slotFor(e, v._jam); v._slot = m && m.slot; v._late = m ? m.late : null; v._tepat = m ? m.late <= TOL : null; });
    const tasks = S.akByEdDay.get(e.id + '|' + day) || [];
    const done = (nama) => sum(tasks.filter((a) => a.tugas === nama), (a) => a.jumlah);
    const n = vids.length;
    const withSlot = vids.filter((v) => v._tepat !== null);
    const tepat = withSlot.filter((v) => v._tepat).length;
    const mature = vids.filter((v) => v._age >= 2 && S.medians[v._ch + '|' + v.tipe_video]);
    const ratio = mature.length ? sum(mature, (v) => Math.min(v.views / S.medians[v._ch + '|' + v.tipe_video], 1.2)) / mature.length : null;

    const parts = [];
    if (target > 0 || n > 0) parts.push({ key: 'video', max: 35, pts: target ? Math.min(n / target, 1) * 35 : 35 });
    if (slotsOf(e).length && n) parts.push({ key: 'jadwal', max: 25, pts: (tepat / n) * 25 });
    if (ratio != null) parts.push({ key: 'views', max: 20, pts: (ratio / 1.2) * 20 });
    const due = TUGAS.filter((t) => tTarget[t.nama] > 0);
    if (S.aktivitas.length && due.length) parts.push({ key: 'tugas', max: 20, pts: (sum(due, (t) => Math.min(done(t.nama) / tTarget[t.nama], 1)) / due.length) * 20 });
    const skor = day > today() || !parts.length ? null : Math.round((sum(parts, (p) => p.pts) / sum(parts, (p) => p.max)) * 100);
    const res = {
      e, day, libur: !jamKerja(day), target, tTarget, partial, vids, n, tepat, telat: withSlot.length - tepat, withSlot: withSlot.length, tasks, done,
      views: sum(vids, (v) => v.views), ratio, parts, skor, nilai: gradeOf(skor),
    };
    S.cache.set(key, res);
    return res;
  }

  function periodStats(e, days) {
    const list = days.map((d) => dayStats(e, d));
    const scored = list.filter((x) => x.skor != null);
    const vids = list.flatMap((x) => x.vids);
    const withSlot = sum(list, (x) => x.withSlot);
    return {
      e, list, n: vids.length, target: sum(list, (x) => x.target),
      tepat: withSlot ? sum(list, (x) => x.tepat) / withSlot : null,
      views: sum(vids, (v) => v.views),
      tugas: sum(list, (x) => sum(x.tasks, (a) => a.jumlah)),
      skor: scored.length ? Math.round(sum(scored, (x) => x.skor) / scored.length) : null,
    };
  }
  const daysBack = (n, end = today()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

  // ============ office calendar ============
  // Opening hours per weekday and days off come from the server (Presensi → Jam kerja & libur).
  const JADWAL_BAWAAN = [null, ...Array(4).fill({ masuk: '08:00', pulang: '16:00' }), { masuk: '08:00', pulang: '15:00' }, { masuk: '08:00', pulang: '15:00' }];
  const kalender = () => S.kalender || { jadwal: JADWAL_BAWAAN, toleransi: 10, libur: {} };
  const liburNama = (d) => kalender().libur[d] || null;
  // Opening hours on a date, or null on a day off.
  const jamKerja = (d) => (liburNama(d) ? null : (kalender().jadwal || JADWAL_BAWAAN)[asDate(d).getUTCDay()] || null);
  const ketLibur = (d) => liburNama(d) || (asDate(d).getUTCDay() === 0 ? 'Minggu' : 'Hari libur');

  // ============ shared bits ============
  function avatar(e, size = '') {
    if (!e) return `<span class="ava ${size}" style="background:var(--line-2)" aria-hidden="true">?</span>`;
    const ini = esc((e.nama || '?').trim().slice(0, 1).toUpperCase());
    if (e.foto_url) return `<img class="ava ${size}" src="${esc(e.foto_url)}" alt="Foto ${esc(e.nama)}" data-ini="${ini}" data-color="${e._color}">`;
    return `<span class="ava ${size}" style="background:${e._color}" aria-hidden="true">${ini}</span>`;
  }
  // Broken photo links fall back to initials.
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (img.tagName === 'IMG' && img.classList.contains('ava')) {
      const s = document.createElement('span');
      s.className = img.className;
      s.style.background = img.dataset.color || 'var(--muted)';
      s.textContent = img.dataset.ini || '?';
      img.replaceWith(s);
    }
  }, true);

  const peranLabel = (p) => (p === 'terbatas' ? 'Editor terbatas' : 'Editor');
  const thumb = (c) => (c.post_id ? `https://i.ytimg.com/vi/${encodeURIComponent(c.post_id)}/mqdefault.jpg` : '');
  const vidCell = (c) => `<div class="vid">${thumb(c) ? `<img src="${thumb(c)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div class="tx"><b>${esc(c.judul)}</b><div>${esc(c._chNama)} · ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'}</div></div></div>`;
  const editorCell = (c) => {
    const e = editorById(c.editor_id);
    if (e) return me() ? '<span class="pill leaf">Anda</span>' : `<span class="ed">${avatar(e, 'xs')}${esc(e.nama)}</span>`;
    return belumDikenali(c) ? '<span class="pill warn">Belum dikenali</span>' : '<span class="muted">Tim</span>';
  };

  function toast(msg, bad = false) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.append(t);
    setTimeout(() => t.remove(), 3200);
  }

  // ============ charts ============
  function measureText(svg, text) {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.textContent = text;
    svg.append(t);
    const w = t.getComputedTextLength();
    t.remove();
    return w;
  }

  // Stacked bars per day with an optional dashed target line.
  function drawStacked(box, { days, series, target, label = 'Video tayang per hari' }) {
    const W = Math.max(280, box.clientWidth), H = 230;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}"></svg><div class="tip" hidden></div>`;
    const svg = $('svg', box), tip = $('.tip', box);
    const totals = days.map((d, i) => sum(series, (s) => s.values[i]));
    const max = Math.max(target || 0, ...totals, 1);
    const step = Math.max(1, niceStep(max * 1.1));
    const yMax = Math.ceil((max * 1.1) / step) * step;
    const ticks = []; for (let v = 0; v <= yMax + step / 2; v += step) ticks.push(v);
    const left = Math.max(...ticks.map((t) => measureText(svg, fmt(t)))) + 10;
    const m = { t: 10, r: 6, b: 24, l: left };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const bw = iw / days.length;
    const y = (v) => m.t + ih - (v / yMax) * ih;
    let html = '';
    ticks.forEach((t) => { html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end">${fmt(t)}</text>`; });
    const labelEvery = Math.ceil(days.length / Math.max(2, Math.floor(iw / 52)));
    days.forEach((d, i) => {
      const x = m.l + i * bw, w = Math.min(28, bw * 0.62), x0 = x + (bw - w) / 2;
      let acc = 0;
      series.forEach((s) => {
        const v = s.values[i];
        if (!v) return;
        const y1 = y(acc + v), h = y(acc) - y1;
        html += `<rect x="${x0}" y="${y1}" width="${w}" height="${Math.max(0, h - 1)}" rx="2" fill="${s.color}"/>`;
        acc += v;
      });
      if ((days.length - 1 - i) % labelEvery === 0) html += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${tglPendek(d)}</text>`;
      html += `<rect class="hit" data-i="${i}" x="${x}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent"/>`;
    });
    if (target) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(target)}" y2="${y(target)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
    html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)"/>`;
    svg.innerHTML = html;
    svg.addEventListener('mousemove', (ev) => {
      const r = ev.target.closest('.hit');
      if (!r) { tip.hidden = true; return; }
      const i = +r.dataset.i;
      tip.innerHTML = `<div class="h">${tglPanjang(days[i])}</div>` + series.filter((s) => s.values[i]).map((s) => `<div><i style="background:${s.color}"></i>${esc(s.name)}: <b>${nf.format(s.values[i])}</b></div>`).join('') + `<div class="h" style="margin-top:3px">Total ${nf.format(totals[i])}${target ? ' dari target ' + target : ''}</div>`;
      tip.hidden = false;
      const bx = box.getBoundingClientRect();
      const px = ev.clientX - bx.left;
      tip.style.left = Math.max(0, Math.min(bx.width - tip.offsetWidth, px + 12)) + 'px';
      tip.style.top = Math.max(0, ev.clientY - bx.top - tip.offsetHeight - 10) + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  }

  function drawSparkbars(box, values, color) {
    const W = Math.max(160, box.clientWidth), H = 44;
    const max = Math.max(...values, 1), bw = W / values.length;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" aria-hidden="true">${values.map((v, i) => {
      const h = Math.max(v ? 2 : 0, (v / max) * (H - 4));
      return `<rect x="${i * bw + bw * 0.15}" y="${H - h}" width="${bw * 0.7}" height="${h}" rx="1.5" fill="${i === values.length - 1 ? color : 'var(--line-2)'}"/>`;
    }).join('')}</svg>`;
  }

  // Share of viewers still watching at each point of the video (YouTube audienceWatchRatio).
  // Shorts that loop go above 100%, so the scale follows the data instead of clipping it.
  function drawRetention(box, data) {
    const pts = [...data].sort((a, b) => a.percent_duration - b.percent_duration);
    const top = Math.max(100, Math.ceil(Math.max(...pts.map((d) => d.retention)) / 25) * 25);
    const W = Math.max(260, box.clientWidth), H = 170, m = { t: 8, r: 8, b: 22, l: 40 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = (p) => m.l + (p / 100) * iw, y = (v) => m.t + ih - (v / top) * ih;
    const step = top > 200 ? 50 : 25;
    let html = '';
    for (let t = 0; t <= top; t += step) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 6}" y="${y(t)}" dy="0.32em" text-anchor="end">${t}%</text>`;
    [0, 50, 100].forEach((t) => { html += `<text x="${x(t)}" y="${H - 5}" text-anchor="${t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}">${t === 0 ? 'Awal' : t === 100 ? 'Akhir' : 'Tengah'}</text>`; });
    const line = pts.map((d) => `${x(d.percent_duration)},${y(d.retention)}`).join(' ');
    html += `<polygon points="${x(pts[0].percent_duration)},${y(0)} ${line} ${x(pts[pts.length - 1].percent_duration)},${y(0)}" fill="var(--leaf)" opacity=".12"/>`;
    html += `<polyline points="${line}" fill="none" stroke="var(--leaf)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const at = (p) => pts.reduce((a, b) => (Math.abs(b.percent_duration - p) < Math.abs(a.percent_duration - p) ? b : a)).retention;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Grafik retensi penonton">${html}</svg>
      <div class="muted" style="font-size:12.5px;margin-top:6px">Masih menonton di tengah video <b>${nf.format(Math.round(at(50)))}%</b>, di akhir <b>${nf.format(Math.round(at(100)))}%</b>.${top > 100 ? ' Di atas 100% berarti bagian itu ditonton ulang.' : ''}</div>`;
  }

  // Day ruler: schedule slots, uploads (on time / late) and other tasks on one 24-hour line.
  function drawRuler(box, st) {
    const W = Math.max(280, box.clientWidth), H = 74, m = { l: 6, r: 6 };
    const startH = 4, endH = 24;
    const x = (hm) => m.l + ((Math.max(startH * 60, Math.min(endH * 60, toMin(hm))) - startH * 60) / ((endH - startH) * 60)) * (W - m.l - m.r);
    let html = `<line x1="${m.l}" x2="${W - m.r}" y1="34" y2="34" stroke="var(--line-2)"/>`;
    const every = W < 420 ? 4 : 2;
    for (let h = startH; h <= endH; h += every) {
      const hm = String(h).padStart(2, '0') + ':00';
      html += `<line x1="${x(hm)}" x2="${x(hm)}" y1="30" y2="38" stroke="var(--line-2)"/><text x="${x(hm)}" y="70" text-anchor="middle" style="font-family:var(--mono);font-size:10.5px">${String(h % 24).padStart(2, '0')}</text>`;
    }
    const nowX = st.day === today() ? x(nowJam()) : null;
    if (nowX != null) html += `<line x1="${nowX}" x2="${nowX}" y1="6" y2="52" stroke="var(--leaf)" stroke-dasharray="2 3"/>`;
    slotsOf(st.e).forEach((s) => { html += `<rect x="${x(s) - 5}" y="8" width="10" height="10" rx="2" fill="none" stroke="var(--muted)" stroke-width="1.5"><title>Jadwal ${s}</title></rect>`; });
    st.tasks.forEach((a) => { html += `<rect x="${x(a.jam) - 3}" y="47" width="6" height="6" rx="1" fill="var(--line-2)"><title>${esc(a.jam + ' ' + a.tugas)}</title></rect>`; });
    st.vids.forEach((v) => {
      const late = v._tepat === false;
      if (v._slot) html += `<line x1="${x(v._slot)}" x2="${x(v._jam)}" y1="22" y2="34" stroke="${late ? 'var(--bad)' : 'var(--ok)'}" stroke-width="1.2" opacity=".6"/>`;
      html += `<circle cx="${x(v._jam)}" cy="34" r="6" fill="${late ? 'var(--bad)' : 'var(--ok)'}" stroke="var(--surface)" stroke-width="2"><title>${esc(v._jam + ' ' + v.judul)}</title></circle>`;
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Linimasa hari ${esc(st.e.nama)}">${html}</svg>`;
  }

  // ============ navigation ============
  const ROUTES = [
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
  function menuGroups() {
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
  const TABS = () => (me() ? ['hari-ini', 'presensi', 'performa', 'pengajuan'] : ['ringkasan', 'harian', 'pengajuan', 'gaji']);
  const routeLabel = (r) => (me() && r.id === 'harian' ? 'Harian saya' : me() && r.id === 'performa' ? 'Performa saya' : me() && r.id === 'konten' ? 'Video channel' : r.label);
  // Each menu group has its own colour, so it is clear at a glance which part of the app is open.
  const grupOf = (id) => { const i = menuGroups().findIndex((g) => g.ids.includes(id)); return ['a', 'b', 'c'][Math.max(0, i)]; };
  const bisaBuka = (r) => (!r.admin || isAdmin()) && (!r.karyawan || !!me());
  const badgeOf = (id) => (id === 'identifikasi' ? S.unmatched : id === 'pengajuan' ? menunggu() : 0);
  // Pages live at real paths (/harian, /presensi, /harian/3); "/" is the home page of each role.
  const pathOf = (id) => (id === (me() ? 'hari-ini' : 'ringkasan') ? '/' : '/' + id);
  function route() {
    const h = location.pathname.replace(/^\/+/, '').split('/')[0] || (me() ? 'hari-ini' : 'ringkasan');
    const r = ROUTES.find((x) => x.id === h);
    if (!r || !bisaBuka(r)) return me() ? 'hari-ini' : 'ringkasan';
    return r.id;
  }
  function navigate(path) {
    if (location.pathname + location.hash !== path) history.pushState(null, '', path);
    closeOverlay();
    render();
    // /panduan#p-gaji opens the guide at that section.
    const el = path.includes('#') && document.getElementById(path.split('#')[1]);
    if (el) el.scrollIntoView({ block: 'start' }); else window.scrollTo({ top: 0 });
  }

  function renderNav() {
    const cur = route();
    $('#nav').innerHTML = S.session ? menuGroups().map((g, gi) => `<div class="nav-label" data-grup="${'abc'[gi]}">${g.label}</div>` + g.ids.map((id) => ROUTES.find((x) => x.id === id)).filter(bisaBuka).map((r) =>
      `<a href="${pathOf(r.id)}" data-grup="${'abc'[gi]}" ${r.id === cur ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${routeLabel(r)}</span>${badgeOf(r.id) ? `<span class="count">${badgeOf(r.id)}</span>` : ''}</a>`
    ).join('')).join('') : '';
    const who = me();
    const theme = document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const last = lastScanAt();
    const freshText = syncing ? 'Memperbarui data YouTube…' : last ? 'YouTube diperbarui ' + agoText(last) : 'Belum pernah sinkron';
    const who2 = me();
    $('#appbar').innerHTML = `
      <img class="logo" src="/tokderlogo.png" alt="">
      <div class="ttl"><b>Pantau Tokder</b><small>${last || syncing ? '<span class="dot"></span>' : ''}${freshText}</small></div>
      ${S.session ? `<button data-act="lainnya" aria-label="Akun dan menu lain">${who2 ? avatar(who2, 'sm') : '<span class="ava sm" style="background:var(--ink);color:var(--paper)">P</span>'}</button>` : '<button class="btn sm primary" data-act="login" style="border-radius:9px;padding:0 14px">Masuk</button>'}`;
    const tabs = TABS();
    const moreActive = !tabs.includes(cur);
    const sisa = sum(ROUTES.filter((r) => !tabs.includes(r.id) && bisaBuka(r)), (r) => badgeOf(r.id));
    $('#tabbar').innerHTML = !S.session ? '' : tabs.map((id) => { const r = ROUTES.find((x) => x.id === id); return `<a href="${pathOf(id)}" data-grup="${grupOf(id)}" ${id === cur ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${r.short || routeLabel(r)}</span>${badgeOf(id) ? `<span class="count">${badgeOf(id) > 99 ? '99+' : badgeOf(id)}</span>` : ''}</a>`; }).join('') +
      `<button data-act="lainnya" ${moreActive ? 'aria-current="page"' : ''}>${icon('more')}<span>Lainnya</span>${sisa ? `<span class="count">${sisa > 99 ? '99+' : sisa}</span>` : ''}</button>`;
    $('#side-foot').innerHTML = `
      <div class="fresh" title="Data YouTube ditarik otomatis tiap 15 menit selama aplikasi terbuka">${last || syncing ? `<span class="dot${syncing ? ' live' : ''}"></span>` : ''}${freshText}</div>
      ${S.session ? `<div class="who">${who ? avatar(who, 'sm') : '<span class="ava sm" style="background:var(--ink)">P</span>'}<div class="t"><b>${who ? esc(who.nama) : 'Pemilik'}</b><small>${who ? peranLabel(who.peran) : 'Akses penuh'}</small></div></div>` : ''}
      <div class="side-actions">
        ${S.session ? `<button class="btn sm ghost" data-act="logout">${icon('out')}Keluar</button>` : `<button class="btn sm primary" data-act="login">Masuk</button>`}
        <button class="btn sm ghost icon" data-act="theme" aria-label="${dark ? 'Mode terang' : 'Mode gelap'}">${icon(dark ? 'sun' : 'moon')}</button>
      </div>
      <div class="legal"><a href="/privacy.html" target="_blank" rel="noopener">Privasi</a> · <a href="/terms.html" target="_blank" rel="noopener">Syarat</a> · <a href="/data-deletion.html" target="_blank" rel="noopener">Hapus data</a></div>`;
    $('#notice').innerHTML = S.offline && S.session && !S.error
      ? `<div class="notice" role="status"><b>Tanpa koneksi.</b> Menampilkan data tersimpan jam ${new Date(S.offline + WIB).toISOString().slice(11, 16)} WIB. <button class="btn sm ghost" data-act="retry">Coba lagi</button></div>`
      : S.warnings.length && !S.error
      ? `<div class="notice" role="status"><b>Sebagian data tidak termuat.</b> ${S.warnings.map(esc).join(' · ')} <button class="btn sm ghost" data-act="retry">Coba lagi</button></div>`
      : '';
  }

  function render() {
    renderNav();
    const r = route();
    const page = $('#page');
    // A page this person cannot open (or an unknown address) shows its fallback at the matching address.
    const want = location.pathname.replace(/^\/+/, '').split('/')[0] || (me() ? 'hari-ini' : 'ringkasan');
    if (want !== r) history.replaceState(null, '', pathOf(r));
    if (!S.session && !S.error) {
      page.innerHTML = `<section class="card empty" style="padding:56px 20px;max-width:520px;margin:24px auto">
        <img src="/tokderlogo.png" alt="" style="width:56px;height:56px;border-radius:14px;margin:0 auto 12px">
        <b style="font-size:18px">Masuk ke Pantau Tokder</b>
        <p style="margin:6px 0 18px">Data kerja tim, konten, analytics dan presensi hanya untuk pemilik dan karyawan.</p>
        <button class="btn primary" data-act="login">${icon('out')}Masuk</button></section>`;
      document.title = 'Masuk · Pantau Tokder';
      return;
    }
    if (S.error) {
      page.innerHTML = `<section class="card empty" style="padding:48px 20px" role="alert"><b style="font-size:16px">Data belum bisa dimuat</b><p style="margin:6px 0 16px">${esc(S.error)}</p><button class="btn primary" data-act="retry">${icon('sync')}Coba lagi</button></section>`;
      return;
    }
    page.innerHTML = (['ringkasan', 'harian', 'hari-ini'].includes(r) ? sambutan() : '') + PAGES[r]();
    page.dataset.route = r;
    page.dataset.grup = grupOf(r);
    const h1 = $('.head h1', page);
    const rt = ROUTES.find((x) => x.id === r);
    if (h1 && rt) h1.insertAdjacentHTML('beforebegin', `<span class="page-ico" aria-hidden="true">${icon(rt.icon)}</span>`);
    // Penjelasan dipangkas satu baris lewat CSS; teks lengkapnya tetap bisa dibaca dengan mengarahkan kursor.
    $$('.head p, .card-h p, .kpi .d', page).forEach((el) => { el.title = el.textContent.trim(); });
    (AFTER[r] || (() => {}))();
    document.title = routeLabel(ROUTES.find((x) => x.id === r) || {}) + ' · Pantau Tokder';
  }

  // ============ page: ringkasan ============
  function ringkasanData() {
    const days = daysBack(S.periode);
    const prev = daysBack(S.periode, addDays(days[0], -1));
    const inCh = (c) => S.channel === 'all' || c._ch === S.channel;
    const vids = S.content.filter((c) => days.includes(c._day) && inCh(c));
    const vidsPrev = S.content.filter((c) => prev.includes(c._day) && inCh(c));
    const team = activeEditors();
    const target = sum(team, (e) => sum(days, (d) => dayStats(e, d).target));
    return { days, prev, vids, vidsPrev, team, target };
  }

  const PAGES = {
    ringkasan() {
      const { days, vids, vidsPrev, team, target } = ringkasanData();
      const stats = team.map((e) => periodStats(e, days));
      const mature = vids.filter((c) => c._age >= 2);
      const unmatched = S.unmatched;
      const slotted = sum(stats, (s) => sum(s.list, (x) => x.withSlot));
      const tepat = slotted ? sum(stats, (s) => sum(s.list, (x) => x.tepat)) / slotted : null;
      const label = S.periode === 7 ? '7 hari terakhir' : '30 hari terakhir';
      const sentence = team.length
        ? `${label}: <b>${nf.format(vids.length)}</b> video tayang${target ? ' dari target <b>' + nf.format(target) + '</b>' : ''}. ` +
          stats.map((s) => `${esc(s.e.nama)} rata-rata skor <b>${s.skor ?? '—'}</b>`).join(', ') + '.' +
          (unmatched ? ` <b>${unmatched}</b> video belum dikenali pembuatnya.` : '')
        : 'Belum ada karyawan. Tambahkan di menu Karyawan.';
      const chOpts = S.channels.map((c) => `<option value="${esc(c.id)}" ${S.channel === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('');
      return `
        <header class="head">
          <div><h1>Ringkasan</h1><p>${sentence}</p></div>
          <div class="tools">
            <select class="input" id="f-channel" aria-label="Channel" style="width:auto"><option value="all">Semua channel</option>${chOpts}</select>
            <div class="seg" role="group" aria-label="Periode">
              <button data-act="periode" data-v="7" aria-pressed="${S.periode === 7}">7 hari</button>
              <button data-act="periode" data-v="30" aria-pressed="${S.periode === 30}">30 hari</button>
            </div>
          </div>
        </header>
        ${ipBaruCard()}
        ${persiapanHtml()}
        <section class="kpis" aria-label="Angka utama">
          <div class="kpi"><span class="l">Video tayang</span><span class="v">${nf.format(vids.length)}${target && S.channel === 'all' ? ` <small>/ ${nf.format(target)}</small>` : ''}</span><span class="d ${vids.length >= vidsPrev.length ? 'ok' : 'bad'}">${signed(vids.length - vidsPrev.length)} dari periode sebelumnya</span></div>
          <div class="kpi"><span class="l">Views video baru</span><span class="v">${fmt(sum(vids, (c) => c.views))}</span><span class="d">${fmt(sum(vidsPrev, (c) => c.views))} di periode sebelumnya</span></div>
          <div class="kpi"><span class="l">Median views per video</span><span class="v">${fmt(median(mature.map((c) => c.views)))}</span><span class="d">video berumur ≥ 2 hari</span></div>
          <div class="kpi"><span class="l">Tepat jadwal</span><span class="v ${tepat == null ? '' : tepat >= 0.85 ? 'ok' : tepat >= 0.7 ? 'warn' : 'bad'}">${pct(tepat)}</span><span class="d">telat &gt; ${TOL} menit dihitung telat</span></div>
          <a class="kpi ${unmatched ? 'alert' : ''}" href="/identifikasi"><span class="l">Belum dikenali</span><span class="v">${nf.format(unmatched)}</span><span class="d">${unmatched ? 'Tetapkan pembuatnya →' : 'Semua video sudah dikenali'}</span></a>
        </section>
        <div class="grid-2">
          <section class="card" id="kartu-harian">
            <div class="card-h"><h2>Video tayang per hari</h2><p>Per karyawan. Garis putus-putus: target harian seluruh tim.</p></div>
            <div class="chart-legend">${team.map((e) => `<span><i style="background:${e._color}"></i>${esc(e.nama)}</span>`).join('')}<span><i style="background:var(--line-2)"></i>Belum dikenali</span>${target && S.channel === 'all' ? '<span><i class="line"></i>Target</span>' : ''}</div>
            <div class="chart" id="ch-video" style="min-height:230px"></div>
          </section>
          <section class="card" id="kartu-peringkat">
            <div class="card-h"><h2>Kinerja karyawan</h2><p>Rata-rata skor harian ${label}. Klik nama untuk melihat hari per hari.</p></div>
            <div class="rank">${stats.length ? stats.sort((a, b) => (b.skor ?? -1) - (a.skor ?? -1)).map((s) => `
              <a class="rank-row" href="/harian/${s.e.id}" data-act="lihat-orang" data-id="${s.e.id}" style="text-decoration:none">
                ${avatar(s.e, 'sm')}
                <div class="tx"><b>${esc(s.e.nama)}</b><div>${nf.format(s.n)}/${nf.format(s.target)} video · tepat ${pct(s.tepat)} · ${fmt(s.views)} views · ${nf.format(s.tugas)} tugas</div>
                  <div class="bar"><i style="width:${s.skor ?? 0}%;background:${s.e._color}"></i></div></div>
                <span class="grade ${gradeOf(s.skor) || ''}" title="Skor ${s.skor ?? '—'}">${s.skor ?? '—'}</span>
              </a>`).join('') : '<div class="empty"><b>Belum ada karyawan</b>Tambahkan di menu Karyawan.</div>'}</div>
          </section>
          <section class="card" id="kartu-channel">
            <div class="card-h"><h2>Per channel</h2><p>Video dan views video baru, ${label}.</p></div>
            <div class="minis">${S.channels.map((ch) => {
              const v = vids.filter((c) => c._ch === ch.id);
              return `<div class="mini"><h3>${esc(ch.nama)}</h3><div class="v">${fmt(sum(v, (c) => c.views))} <span class="muted" style="font-size:13px;font-weight:600">views</span></div><div class="d">${nf.format(v.length)} video · median ${fmt(median(v.filter((c) => c._age >= 2).map((c) => c.views)))}</div><div class="chart spark" data-ch="${esc(ch.id)}" style="margin-top:8px"></div></div>`;
            }).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
          </section>
          <section class="card" id="kartu-topik">
            <div class="card-h"><h2>Ide konten berikutnya</h2><p>Median views tiap topik dibanding median channel-nya, video 30 hari terakhir. Topik ditebak dari kata di judul.</p></div>
            ${topikHtml()}
          </section>
          <section class="card span-all" id="kartu-terbaik">
            <div class="card-h"><h2>Video terbaik ${label}</h2></div>
            ${vids.length ? `<div class="table-wrap"><table class="t stack"><thead><tr><th>Video</th><th>Pembuat</th><th>Tayang</th><th class="num">Views</th><th class="num">Like</th><th class="num">Komentar</th></tr></thead><tbody>
              ${[...vids].sort((a, b) => b.views - a.views).slice(0, 5).map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td class="full">${vidCell(c)}</td><td data-label="Pembuat">${editorCell(c)}</td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td><td class="num" data-label="Like">${nf.format(c.likes)}</td><td class="num" data-label="Komentar">${nf.format(c.comments)}</td></tr>`).join('')}
            </tbody></table></div>` : '<div class="empty"><b>Belum ada video di periode ini</b>Jalankan sinkronisasi di Pengaturan bila seharusnya sudah ada.</div>'}
          </section>
        </div>`;
    },

    harian() {
      const day = S.day;
      const team = activeEditors();
      const mine = me();
      const order = mine ? [mine] : team;
      const list = order.map((e) => dayStats(e, day));
      const gaps = (st) => {
        const g = [];
        if (st.n < st.target) g.push((st.target - st.n) + ' video kurang');
        if (st.telat) g.push(st.telat + ' telat');
        if (S.aktivitas.length) TUGAS.forEach((t) => { if (st.done(t.nama) < st.tTarget[t.nama]) g.push(t.short.toLowerCase() + ' ' + st.done(t.nama) + '/' + st.tTarget[t.nama]); });
        return g;
      };
      const sentence = list.length
        ? !jamKerja(day) ? `<b>Libur: ${esc(ketLibur(day))}.</b> Tidak ada target; video yang tetap tayang tetap tercatat.`
        : list.map((st) => { const g = gaps(st); return `${mine ? 'Anda' : esc(st.e.nama)}: <b>${st.n}</b> dari ${st.target} video, skor <b>${st.skor ?? '—'}</b>${g.length ? ' (' + esc(g.slice(0, 3).join(', ')) + ')' : ', semua beres'}`; }).join('. ') + '.'
        : 'Belum ada karyawan aktif.';
      const isToday = day === today();
      return `
        <header class="head">
          <div><h1>${mine ? 'Harian saya' : 'Harian'}</h1><p><span class="muted">${tglPanjang(day)}${isToday ? ' · hari ini, sampai jam ' + nowJam() : ''}.</span> ${sentence}</p></div>
          <div class="tools">
            <div class="daynav">
              <button class="btn icon" data-act="hari" data-v="-1" aria-label="Hari sebelumnya">${icon('left')}</button>
              <input class="input" type="date" id="f-day" value="${day}" max="${today()}" aria-label="Tanggal">
              <button class="btn icon" data-act="hari" data-v="1" aria-label="Hari berikutnya" ${isToday ? 'disabled' : ''}>${icon('right')}</button>
            </div>
            ${!isToday ? '<button class="btn ghost" data-act="hari-ini">Hari ini</button>' : ''}
            ${canLog() ? `<button class="btn primary" data-act="catat">${icon('plus')}Catat aktivitas</button>` : ''}
            ${bantuan('harian')}
          </div>
        </header>
        <div class="people">${list.map(personCard).join('') || '<div class="card empty"><b>Belum ada karyawan aktif</b>Tambahkan di menu Karyawan.</div>'}</div>
        <p class="muted" style="font-size:12.5px;margin:0;max-width:90ch">Skor harian 0–100: video tayang dibanding target (35 poin), tepat jadwal (25), views dibanding median channel untuk video berumur ≥ 2 hari (20), tugas lain (20). Komponen yang belum ada datanya tidak dihitung. Nilai A ≥ 85, B ≥ 70, C ≥ 55.</p>`;
    },

    konten() {
      const k = S.konten;
      const rows = kontenRows();
      const per = 25, pages = Math.max(1, Math.ceil(rows.length / per));
      k.page = Math.min(k.page, pages);
      const shown = rows.slice((k.page - 1) * per, k.page * per);
      const th = (key, label, cls = '') => `<th class="${cls}" aria-sort="${k.sort === key ? (k.dir === 'asc' ? 'ascending' : 'descending') : 'none'}"><button data-act="sort" data-k="${key}">${label}</button></th>`;
      return `
        <header class="head">
          <div><h1>${me() ? 'Video channel' : 'Konten'}</h1><p>${nf.format(rows.length)} video sesuai filter, total <b>${fmt(sum(rows, (c) => c.views))}</b> views.</p></div>
          <div class="tools"><button class="btn" data-act="csv">${icon('download')}Unduh CSV</button></div>
        </header>
        <section class="card">
          <div class="tools" style="margin-bottom:12px">
            <label class="search">${icon('search')}<input class="input" type="search" id="k-q" placeholder="Cari judul" value="${esc(k.q)}" aria-label="Cari judul"></label>
            <select class="input" id="k-channel" style="width:auto" aria-label="Channel"><option value="all">Semua channel</option>${S.channels.map((c) => `<option value="${esc(c.id)}" ${k.channel === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>
            <select class="input" id="k-editor" style="width:auto" aria-label="Pembuat"><option value="all">${me() ? 'Semua video channel' : 'Semua pembuat'}</option>${S.editors.map((e) => `<option value="${e.id}" ${k.editor === String(e.id) ? 'selected' : ''}>${me() ? 'Video saya' : esc(e.nama)}</option>`).join('')}<option value="none" ${k.editor === 'none' ? 'selected' : ''}>Belum dikenali</option></select>
            <select class="input" id="k-tipe" style="width:auto" aria-label="Jenis"><option value="all">Semua jenis</option><option value="short" ${k.tipe === 'short' ? 'selected' : ''}>Shorts</option><option value="long" ${k.tipe === 'long' ? 'selected' : ''}>Video panjang</option></select>
            <select class="input" id="k-periode" style="width:auto" aria-label="Periode"><option value="7" ${k.periode === '7' ? 'selected' : ''}>7 hari</option><option value="30" ${k.periode === '30' ? 'selected' : ''}>30 hari</option><option value="90" ${k.periode === '90' ? 'selected' : ''}>90 hari</option><option value="all" ${k.periode === 'all' ? 'selected' : ''}>Semua</option></select>
          </div>
          ${shown.length ? `<div class="table-wrap"><table class="t stack"><thead><tr>${th('judul', 'Video')}${th('editor', 'Pembuat')}${th('tanggal', 'Tayang (WIB)')}${th('views', 'Views', 'num')}${th('likes', 'Like', 'num')}${th('comments', 'Komentar', 'num')}${th('durasi', 'Durasi', 'num')}</tr></thead><tbody>
            ${shown.map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td class="full">${vidCell(c)}</td><td data-label="Pembuat">${editorCell(c)}</td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td><td class="num" data-label="Like">${nf.format(c.likes)}</td><td class="num" data-label="Komentar">${nf.format(c.comments)}</td><td class="num mono" data-label="Durasi">${durasi(c.duration_secs)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="pager"><span>Menampilkan ${(k.page - 1) * per + 1}–${(k.page - 1) * per + shown.length} dari ${nf.format(rows.length)}</span>
            <span class="tools"><button class="btn sm" data-act="page" data-v="-1" ${k.page <= 1 ? 'disabled' : ''}>${icon('left')}Sebelumnya</button><span>Hal. ${k.page}/${pages}</span><button class="btn sm" data-act="page" data-v="1" ${k.page >= pages ? 'disabled' : ''}>Berikutnya${icon('right')}</button></span></div>`
          : '<div class="empty"><b>Tidak ada video yang cocok</b>Ubah filter atau kata pencarian.</div>'}
        </section>`;
    },

    identifikasi() {
      const rows = S.content.filter(belumDikenali).sort((a, b) => b.tanggal_upload.localeCompare(a.tanggal_upload));
      const allowed = canAssign();
      const codes = activeEditors().map((e) => `<span class="slot">#${esc(e.kode_identifikasi)}</span> ${esc(e.nama)}`).join(' · ');
      return `
        <header class="head">
          <div><h1>Belum dikenali</h1><p>Video dikenali otomatis bila deskripsinya memuat kode karyawan (${codes || 'belum ada kode'}). Video di bawah ini tidak memuat kode, jadi pembuatnya perlu ditetapkan manual.</p></div>
        </header>
        <section class="card">
          ${rows.length ? `
          ${allowed ? `<div class="tools" style="margin-bottom:12px">
            <span class="muted" id="sel-count">${S.sel.size} dipilih</span>
            <select class="input" id="bulk-editor" style="width:auto" aria-label="Tetapkan ke"><option value="">Tetapkan ke…</option>${activeEditors().map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select>
            <button class="btn primary" data-act="bulk-assign">Tetapkan yang dipilih</button>
          </div>` : '<p class="muted" style="margin:0 0 12px">Masuk sebagai pemilik atau editor untuk menetapkan pembuat video.</p>'}
          <div class="table-wrap"><table class="t stack"><thead><tr><th>${allowed ? '<label style="display:inline-flex;gap:10px;align-items:center"><input type="checkbox" id="sel-all" aria-label="Pilih semua"> Video</label>' : 'Video'}</th><th>Tayang (WIB)</th><th class="num">Views</th>${allowed ? '<th>Pembuat</th>' : ''}</tr></thead><tbody>
            ${rows.map((c) => `<tr><td class="full"><div style="display:flex;gap:10px;align-items:center">${allowed ? `<input type="checkbox" data-sel="${c.id}" ${S.sel.has(c.id) ? 'checked' : ''} aria-label="Pilih ${esc(c.judul)}" style="width:20px;height:20px;flex:none">` : ''}<a href="/identifikasi" data-act="video" data-id="${c.id}" style="text-decoration:none;min-width:0">${vidCell(c)}</a></div></td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td>${allowed ? `<td class="full"><select class="input" data-assign="${c.id}" aria-label="Pembuat"><option value="">Tetapkan pembuat…</option>${activeEditors().map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select></td>` : ''}</tr>`).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Semua video sudah dikenali</b>Video baru tanpa kode akan muncul di sini setelah sinkronisasi.</div>'}
        </section>`;
    },

    sosmed() {
      const d = S.sosmed;
      const head = `<header class="head"><div><h1>Sosmed</h1><p>TikTok, Instagram dan Facebook: pengikut dan statistik posting 90 hari terakhir. Hanya dibaca, tidak ada yang diposting.</p></div>
        <div class="tools"><button class="btn primary" data-act="sync-sosmed">${icon('sync')}Tarik data</button></div></header>`;
      if (!d) return head + '<section class="card"><div class="empty"><b>Data sosmed belum termuat</b>Coba muat ulang halaman.</div></section>';
      const hariWib = (iso) => new Date(new Date(iso).getTime() + WIB).toISOString().slice(0, 10);
      const batas = Date.now() - 30 * 86400000;
      const baru = d.posts.filter((p) => new Date(p.tanggal).getTime() >= batas);
      const pengikut = sum(d.platforms.flatMap((p) => p.koneksi), (k) => k.followers || 0);
      const edNama = (id) => { const e = S.editors.find((x) => x.id === id); return e ? esc(e.nama) : '<span class="muted">—</span>'; };
      const kartu = (p) => `<section class="card"><div class="card-h"><h2>${esc(p.nama)}</h2><p>${p.siap ? (p.koneksi.length ? p.koneksi.length + ' akun tersambung' : 'Belum ada akun tersambung') : 'Belum disiapkan di server'}</p></div>
        <div class="checklist">
          ${p.koneksi.map((k) => `<div class="ck"><span class="st ${k.status === 'aktif' && !k.galat ? 'ok' : 'bad'}">${k.status === 'aktif' && !k.galat ? '✓' : '!'}</span><div><b>${esc(k.nama || k.akun_id)}${k.handle ? ' <span class="muted">' + esc(k.handle) + '</span>' : ''}</b>
            <div>${k.followers != null ? nf.format(k.followers) + ' pengikut · ' : ''}${k.last_sync ? 'ditarik ' + waktuWib(k.last_sync) : 'belum pernah ditarik'}</div>
            ${k.galat ? `<div style="color:var(--bad);font-size:13px">${esc(k.galat)}${k.status === 'putus' ? ' Hubungkan ulang.' : ''}</div>` : ''}</div>
            <button class="btn sm ghost danger" data-act="putus-sosmed" data-id="${k.id}">Putuskan</button></div>`).join('')}
          ${p.siap ? `<div class="ck"><span></span><div><div class="muted">Masuk dengan akun ${esc(p.nama)} milik channel, lalu setujui izin baca-saja.</div></div><a class="btn sm" href="/api/social/connect/${p.id}">${p.koneksi.length ? 'Tambah akun' : 'Hubungkan'}</a></div>`
            : `<div class="ck"><span class="st bad">!</span><div><b>Isi di Vercel</b><div class="mono">${p.env.map(esc).join(' · ')}</div><div class="muted">Dari portal pengembang ${esc(p.nama)}; lalu deploy ulang. Lihat Panduan.</div></div></div>`}
        </div></section>`;
      return head + `
        <section class="kpis" aria-label="Angka utama sosmed">
          <div class="kpi"><span class="l">Pengikut</span><span class="v">${fmt(pengikut)}</span><span class="d">semua akun tersambung</span></div>
          <div class="kpi"><span class="l">Posting 30 hari</span><span class="v">${nf.format(baru.length)}</span><span class="d">TikTok, Instagram, Facebook</span></div>
          <div class="kpi"><span class="l">Views 30 hari</span><span class="v">${fmt(sum(baru, (x) => x.views || 0))}</span><span class="d">Instagram bisa kosong untuk foto</span></div>
          <div class="kpi"><span class="l">Suka + komentar</span><span class="v">${fmt(sum(baru, (x) => (x.likes || 0) + (x.comments || 0)))}</span><span class="d">30 hari terakhir</span></div>
        </section>
        <div class="grid-2">${d.platforms.map(kartu).join('')}</div>
        <section class="card"><div class="card-h"><h2>Posting terbaru</h2><p>Pembuat dikenali dari kode karyawan di keterangan posting, sama seperti video YouTube.</p></div>
          ${d.posts.length ? `<div class="table-wrap"><table class="t stack"><thead><tr><th>Posting</th><th>Platform</th><th>Tanggal</th><th class="num">Views</th><th class="num">Suka</th><th class="num">Komentar</th><th class="num">Bagikan</th><th>Pembuat</th></tr></thead><tbody>
            ${d.posts.slice(0, 60).map((x) => `<tr><td class="full">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.judul || '(tanpa judul)')}</a>` : esc(x.judul || '(tanpa judul)')}<div class="muted">${esc(x.akun_nama || '')}</div></td>
              <td data-label="Platform">${esc((d.platforms.find((p) => p.id === x.platform) || {}).nama || x.platform)}</td><td data-label="Tanggal">${tglPendek(hariWib(x.tanggal))}</td>
              <td class="num" data-label="Views">${x.views == null ? '—' : nf.format(x.views)}</td><td class="num" data-label="Suka">${x.likes == null ? '—' : nf.format(x.likes)}</td><td class="num" data-label="Komentar">${x.comments == null ? '—' : nf.format(x.comments)}</td><td class="num" data-label="Bagikan">${x.shares == null ? '—' : nf.format(x.shares)}</td><td data-label="Pembuat">${edNama(x.editor_id)}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Belum ada posting</b>Hubungkan akun di atas, lalu klik Tarik data.</div>'}
        </section>`;
    },

    karyawan() {
      const days = daysBack(7);
      return `
        <header class="head">
          <div><h1>Karyawan</h1><p>Kode dipakai untuk mengenali video dari deskripsinya. Jadwal dipakai untuk menilai tepat atau telat. PIN dipakai karyawan untuk masuk, mencatat aktivitas dan absen.</p></div>
          ${isAdmin() ? `<div class="tools"><button class="btn primary" data-act="editor-form">${icon('plus')}Tambah karyawan</button></div>` : ''}
        </header>
        <div class="team">${S.editors.map((e) => {
          const st = periodStats(e, days);
          return `<section class="card member">
            <div class="member-top">${avatar(e, 'lg')}<div class="t"><b>${esc(e.nama)}</b><div class="muted" style="font-size:12.5px">${peranLabel(e.peran)}${e.status === 'nonaktif' ? ' · nonaktif' : ''}</div></div><span class="grade ${gradeOf(st.skor) || ''}" title="Rata-rata skor 7 hari">${st.skor ?? '—'}</span></div>
            <dl class="kv">
              <dt>Kode</dt><dd><span class="slot">#${esc(e.kode_identifikasi)}</span></dd>
              <dt>Jadwal</dt><dd>${slotsOf(e).map((s) => `<span class="slot">${s}</span>`).join('') || '<span class="muted">Belum diatur</span>'}</dd>
              <dt>Target</dt><dd>${targetOf(e)} video per hari</dd>
              <dt>PIN</dt><dd>${e.punya_pin ? '<span class="pill ok">Sudah diatur</span>' : '<span class="pill warn">Belum diatur</span>'}</dd>
              <dt>7 hari</dt><dd>${st.n} video · tepat ${pct(st.tepat)} · ${fmt(st.views)} views</dd>
            </dl>
            ${isAdmin() ? `<div class="member-actions"><button class="btn sm" data-act="editor-form" data-id="${e.id}">Ubah</button><button class="btn sm ghost danger" data-act="editor-hapus" data-id="${e.id}">Hapus</button></div>` : ''}
          </section>`;
        }).join('') || '<div class="card empty"><b>Belum ada karyawan</b>Masuk sebagai pemilik untuk menambahkan.</div>'}</div>
        <section class="card">
          <div class="card-h"><h2>Hak akses</h2></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Bisa…</th><th>Pemilik</th><th>Editor</th><th>Editor terbatas</th></tr></thead><tbody>
            ${[['Melihat ringkasan, harian, konten, analytics', 'Ya', 'Ya', 'Ya'], ['Mencatat aktivitas sendiri', 'Ya (siapa pun)', 'Ya', 'Ya'], ['Absen masuk dan pulang', '—', 'Ya', 'Ya'], ['Menetapkan pembuat video', 'Ya', 'Ya', '—'], ['Mengatur karyawan, presensi, sinkronisasi, pendapatan', 'Ya', '—', '—']]
              .map((r) => `<tr><td class="full"><b>${r[0]}</b></td>${['Pemilik', 'Editor', 'Editor terbatas'].map((l, i) => `<td data-label="${l}">${r[i + 1]}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
        </section>`;
    },

    analytics() {
      const chans = analyticsChannels();
      const latest = S.daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
      const end = latest || addDays(today(), -2);
      const days = daysBack(S.anPeriode, end);
      const prev = daysBack(S.anPeriode, addDays(days[0], -1));
      const pick = (ids, ds) => S.daily.filter((d) => ids.includes(d.channel_id) && ds.includes(d.tanggal));
      const tot = (list) => ({
        views: sum(list, (d) => d.views), menit: sum(list, (d) => d.menit_tonton),
        naik: sum(list, (d) => d.sub_naik), turun: sum(list, (d) => d.sub_turun),
        rev: list.some((d) => d.revenue != null) ? sum(list, (d) => d.revenue || 0) : null,
      });
      const ids = chans.map((c) => c.id);
      const cur = tot(pick(ids, days)), pv = tot(pick(ids, prev));
      const has = pick(ids, days).length > 0;
      const show = (txt) => (has ? txt : '—');
      const change = (a, b) => {
        if (!b) return `<span class="d">belum ada pembanding</span>`;
        const x = Math.round(((a - b) / Math.abs(b)) * 100);
        return `<span class="d ${x >= 0 ? 'ok' : 'bad'}">${signed(x, (v) => nf.format(v) + '%')} dari ${S.anPeriode} hari sebelumnya</span>`;
      };
      const avgDur = (t) => (t.views ? durasi(Math.round((t.menit * 60) / t.views)) : '—');
      const showRev = isAdmin() && cur.rev != null;
      const nConn = chans.filter((c) => c.connected).length;
      const missing = chans.filter((c) => !c.connected);
      return `
        <header class="head">
          <div><h1>Analytics</h1><p><b>${nConn}</b> dari ${chans.length} channel tersambung ke YouTube Analytics. ${latest ? 'Angka sampai ' + tglPanjang(latest) + '; YouTube biasanya terlambat 2–3 hari.' : 'Belum ada angka tersimpan.'}</p></div>
          <div class="tools"><div class="seg" role="group" aria-label="Periode">
            ${[7, 28, 90].map((n) => `<button data-act="an-periode" data-v="${n}" aria-pressed="${S.anPeriode === n}">${n} hari</button>`).join('')}
          </div></div>
        </header>
        ${missing.length ? `<section class="card" style="border-color:var(--warn)"><div class="card-h"><h2>${missing.length} channel belum tersambung</h2><p>${isAdmin() ? 'Klik Hubungkan, login dengan akun tokodeeres@gmail.com, lalu pilih channel yang sesuai di layar Google. Ulangi untuk tiap channel.' : 'Minta pemilik menghubungkannya di Pengaturan.'}</p></div>
          <div class="tools">${missing.map((c) => isAdmin() ? `<a class="btn" href="/api/auth/google">${icon('plus')}Hubungkan ${esc(c.nama)}</a>` : `<span class="pill warn">${esc(c.nama)}</span>`).join('')}</div></section>` : ''}
        <section class="kpis" aria-label="Total ${S.anPeriode} hari">
          <div class="kpi"><span class="l">Views</span><span class="v">${show(fmt(cur.views))}</span>${has ? change(cur.views, pv.views) : '<span class="d">belum ada data</span>'}</div>
          <div class="kpi"><span class="l">Jam tonton</span><span class="v">${show(jamMenit(cur.menit))}</span>${has ? change(cur.menit, pv.menit) : ''}</div>
          <div class="kpi"><span class="l">Subscriber bersih</span><span class="v ${cur.naik - cur.turun < 0 ? 'bad' : ''}">${show(signed(cur.naik - cur.turun))}</span>${has ? `<span class="d">+${nf.format(cur.naik)} baru, −${nf.format(cur.turun)} berhenti</span>` : ''}</div>
          <div class="kpi"><span class="l">Rata-rata ditonton</span><span class="v mono" style="font-size:24px">${show(avgDur(cur))}</span><span class="d">menit:detik per view</span></div>
          ${showRev ? `<div class="kpi"><span class="l">Perkiraan pendapatan</span><span class="v">${rpOrDash(cur.rev)}</span>${change(cur.rev, pv.rev)}</div>` : ''}
        </section>
        ${strategiHtml(days, chans)}
        <section class="card" id="kartu-views-harian">
          <div class="card-h"><h2>Views harian per channel</h2><p>Semua video di channel, termasuk video lama.</p></div>
          <div class="chart-legend">${chans.map((c) => `<span><i style="background:${chColor(c.id)}"></i>${esc(c.nama)}</span>`).join('')}</div>
          ${has ? '<div class="chart" id="an-chart" style="min-height:230px"></div>' : '<div class="empty"><b>Belum ada angka dari YouTube Analytics</b>Hubungkan channel di Pengaturan, lalu klik Sinkronkan sekarang.</div>'}
        </section>
        <div class="grid-3">${chans.map((c) => {
          const t = tot(pick([c.id], days)), p = tot(pick([c.id], prev));
          return `<section class="card" id="an-${esc(c.id)}">
            <div class="card-h"><h2><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></h2>${c.connected ? '<span class="pill ok">Tersambung</span>' : '<span class="pill warn">Belum tersambung</span>'}</div>
            ${t.views || t.menit ? `
              <div class="minis" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
                <div class="mini"><h3>Views</h3><div class="v">${fmt(t.views)}</div>${change(t.views, p.views)}</div>
                <div class="mini"><h3>Jam tonton</h3><div class="v">${jamMenit(t.menit)}</div><div class="d">${avgDur(t)} per view</div></div>
                <div class="mini"><h3>Subscriber bersih</h3><div class="v">${signed(t.naik - t.turun)}</div><div class="d">+${nf.format(t.naik)} / −${nf.format(t.turun)}</div></div>
                ${isAdmin() && t.rev != null ? `<div class="mini"><h3>Pendapatan</h3><div class="v">${rpOrDash(t.rev)}</div>${change(t.rev, p.rev)}</div>` : `<div class="mini"><h3>Video baru</h3><div class="v">${nf.format(S.content.filter((x) => x._ch === c.id && days.includes(x._day)).length)}</div><div class="d">di periode ini</div></div>`}
              </div>
              <div class="chart an-spark" data-ch="${esc(c.id)}" style="margin-top:12px"></div>`
            : `<div class="empty"><b>${c.connected ? 'Menunggu data' : 'Belum ada data'}</b>${c.connected ? 'Klik Sinkronkan sekarang di Pengaturan.' : 'Hubungkan channel ini di Pengaturan.'}</div>`}
          </section>`;
        }).join('')}</div>
        <section class="card">
          <div class="card-h"><h2>Perbandingan channel</h2><p>${S.anPeriode} hari sampai ${latest ? tglPendek(latest) : '—'}.</p></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Channel</th><th class="num">Views</th><th class="num">Jam tonton</th><th class="num">Ditonton / view</th><th class="num">Sub baru</th><th class="num">Berhenti</th><th class="num">Bersih</th>${showRev ? '<th class="num">Pendapatan</th>' : ''}<th class="num">Video baru</th></tr></thead><tbody>
            ${chans.map((c) => { const t = tot(pick([c.id], days)); if (!pick([c.id], days).length) return `<tr><td class="full"><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></td><td colspan="${showRev ? 8 : 7}" class="muted full">Belum ada data${c.connected ? '' : ' · belum tersambung'}</td></tr>`; return `<tr><td class="full"><b><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></b></td><td class="num" data-label="Views">${nf.format(t.views)}</td><td class="num" data-label="Jam tonton">${jamMenit(t.menit)}</td><td class="num mono" data-label="Ditonton / view">${avgDur(t)}</td><td class="num" data-label="Sub baru">${nf.format(t.naik)}</td><td class="num" data-label="Berhenti">${nf.format(t.turun)}</td><td class="num" data-label="Bersih">${signed(t.naik - t.turun)}</td>${showRev ? `<td class="num" data-label="Pendapatan">${t.rev == null ? '—' : rpOrDash(t.rev)}</td>` : ''}<td class="num" data-label="Video baru">${nf.format(S.content.filter((x) => x._ch === c.id && days.includes(x._day)).length)}</td></tr>`; }).join('')}
          </tbody></table></div>
        </section>`;
    },

    pengaturan() {
      const sc = S.scan || {};
      const last = sc.last_scan;
      const item = (ok, title, desc, action = '') => `<div class="ck"><span class="st ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'}</span><div><b>${title}</b><div>${desc}</div></div>${action}</div>`;
      return `
        <header class="head"><div><h1>Pengaturan</h1><p>Sambungan data, sinkronisasi video dan keamanan.</p></div>
          <div class="tools"><button class="btn primary" data-act="sync">${icon('sync')}Sinkronkan sekarang</button></div></header>
        ${notifCard()}
        <div class="grid-2">
          <section class="card"><div class="card-h"><h2>Sambungan</h2><p>${last ? 'Sinkronisasi terakhir ' + new Date(last.waktu_scan || last.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (last.jumlah_post_baru ?? 0) + ' video baru' : 'Belum ada catatan sinkronisasi.'}</p></div>
            <div class="checklist">
              ${item(sc.database_url, 'Database', sc.database_url ? 'Tersambung' : 'Isi DATABASE_URL di Vercel')}
              ${item(sc.youtube_api_key, 'YouTube Data API', sc.youtube_api_key ? 'Kunci API terpasang' : 'Isi YOUTUBE_API_KEY di Vercel')}
              ${item((sc.youtube_channels || 0) >= 3, 'Channel dipantau', (sc.youtube_channels || 0) + ' channel' + ((sc.youtube_channels || 0) < 3 ? '. Tambahkan ketiga channel di kartu Channel.' : ''))}
              ${analyticsChannels(true).map((c) => item(c.connected, 'Analytics: ' + esc(c.nama), c.connected ? 'Terhubung' + (c.connected_at ? ' sejak ' + new Date(c.connected_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '') : 'Belum terhubung: retensi, jam tonton dan pendapatan belum terbaca',
                c.connected ? `<button class="btn sm ghost danger" data-act="putus-analytics" data-id="${esc(c.id)}">Putuskan</button>` : `<a class="btn sm" href="/api/auth/google">Hubungkan</a>`)).join('')}
            </div>
            ${sc.last_summary ? `<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)"><div class="card-h" style="margin-bottom:6px"><h2>Catatan sinkronisasi terakhir</h2><p>${new Date(sc.last_summary.selesai).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} · ${sc.last_summary.detik ?? '—'} detik · ${nf.format(sc.last_summary.newPosts || 0)} video baru, ${nf.format(sc.last_summary.updatedPosts || 0)} diperbarui, analytics ${sc.last_summary.analyticsChannels ?? 0} channel</p></div>
              ${(sc.last_summary.errors || []).length ? `<ul style="margin:0;padding-left:18px;color:var(--warn);font-size:13px">${sc.last_summary.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : '<p class="muted" style="margin:0;font-size:13px">Tidak ada masalah.</p>'}</div>` : ''}
          </section>
          <section class="card"><div class="card-h"><h2>Channel</h2><p>Channel yang videonya ditarik saat sinkronisasi.</p></div>
            <div class="rank">${S.channels.map((c) => `<div class="rank-row"><span></span><div class="tx"><b>${esc(c.nama)}</b><div class="mono">${esc(c.id)}</div></div><span class="muted">${nf.format(S.content.filter((x) => x._ch === c.id).length)} video</span></div>`).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
            <form id="ch-form" style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
              <label class="field"><span>Ganti daftar channel</span><textarea class="input mono" name="channels" rows="3" placeholder="@tokder&#10;https://www.youtube.com/@budidayacabe&#10;UCxxxxxxxxxxxxxxxxxxxxxx">${esc(S.channels.map((c) => c.id).join('\n'))}</textarea>
                <small>Satu channel per baris: link channel, @handle, atau ID (UC…). Setelah disimpan, klik Sinkronkan sekarang.</small></label>
              <div class="err" id="ch-err" role="alert" style="color:var(--bad);font-size:13px"></div>
              <div><button class="btn">Simpan channel</button></div>
            </form></section>
          <section class="card"><div class="card-h"><h2>Password pemilik</h2><p>Dipakai untuk masuk sebagai pemilik. Mengganti password mengeluarkan pemilik dari perangkat lain.</p></div>
            <div class="tools"><input class="input" type="password" id="pw-baru" placeholder="Password baru, minimal 8 karakter" autocomplete="new-password" style="max-width:300px"><button class="btn" data-act="ganti-pw">Simpan</button></div></section>
        </div>
        ${sistemCard()}`;
    },
  };

  // Database size, the nightly clean-up and the last sync, loaded when Pengaturan opens.
  function sistemCard() {
    const x = S.sistem;
    if (!x) {
      if (x === undefined) { S.sistem = null; api('/api/scan/sistem').then((r) => { S.sistem = r; }).catch((e) => { S.sistem = { error: e.message }; }).then(() => { if (route() === 'pengaturan' && !$('#overlay').innerHTML) render(); }); }
      return '<section class="card"><div class="card-h"><h2>Kesehatan sistem</h2><p>Memuat…</p></div></section>';
    }
    if (x.error) return `<section class="card"><div class="card-h"><h2>Kesehatan sistem</h2><p>${esc(x.error)}</p></div></section>`;
    const mb = (b) => (b == null ? '—' : nf.format(Math.round(b / 1048576)) + ' MB');
    const b = x.baris || {};
    const r = x.perawatan;
    return `<section class="card"><div class="card-h"><h2>Kesehatan sistem</h2><p>Data lama dirapikan otomatis tiap malam: angka views per jam disimpan 14 hari, setelahnya satu angka per hari.</p></div>
      <div class="sys-grid">
        <div><span>Ukuran database</span><b>${mb(x.db_bytes)}</b></div>
        <div><span>Video</span><b>${nf.format(b.content || 0)}</b></div>
        <div><span>Catatan views</span><b>${nf.format(b.metrics_snapshot || 0)}</b></div>
        <div><span>Sinkron terakhir</span><b>${x.sinkron_terakhir ? agoText(new Date(x.sinkron_terakhir).getTime()) : '—'}</b></div>
        <div><span>Perapian terakhir</span><b>${r ? agoText(new Date(r.waktu).getTime()) : 'belum pernah'}</b>${r ? `<span>${nf.format(r.dihapus.snapshot + r.dihapus.terkirim + r.dihapus.ditolak)} baris lama dihapus</span>` : ''}</div>
        <div><span>Perangkat dengan notifikasi</span><b>${x.perangkat_notif}</b></div>
      </div></section>`;
  }

  // Revenue and growth advice computed from the channels' own numbers. A rule shows only when
  // there is enough data behind it, and each one states the numbers it is based on.
  function strategiHtml(days, chans) {
    const admin = isAdmin();
    const out = [];
    const money = rpOrDash;
    const period = S.anPeriode + ' hari';
    const recent = (n) => S.content.filter((c) => c._age >= 2 && c._age <= n);
    const dayRows = (id) => S.daily.filter((d) => d.channel_id === id && days.includes(d.tanggal));

    // 1. Channels not yet sending revenue numbers
    if (admin) {
      chans.filter((c) => !c.connected).forEach((c) => out.push({
        impact: 1e9, title: `Sambungkan YouTube Analytics ${esc(c.nama)}`,
        why: 'Tanpa sambungan, pendapatan, jam tonton dan retensi channel ini tidak terbaca, jadi saran di bawah tidak menghitungnya.',
        act: 'Pengaturan → Hubungkan, login tokodeeres@gmail.com, pilih channel ini.',
      }));
      chans.filter((c) => c.connected && dayRows(c.id).length >= 7 && dayRows(c.id).every((d) => d.revenue == null)).forEach((c) => out.push({
        impact: 9e8, title: `${esc(c.nama)} belum menghasilkan pendapatan iklan`,
        why: `YouTube tidak mengirim angka pendapatan untuk channel ini selama ${period}, padahal views-nya ${fmt(sum(dayRows(c.id), (d) => d.views))}.`,
        act: 'Cek YouTube Studio → Hasilkan uang. Syarat umum Program Partner: 1.000 subscriber dan 4.000 jam tonton publik dalam 12 bulan, atau 10 juta views Shorts dalam 90 hari.',
      }));
    }

    // 2. Revenue per 1,000 views by channel
    if (admin) {
      const rpm = chans.map((c) => { const r = dayRows(c.id); const v = sum(r, (d) => d.views); const rev = r.some((d) => d.revenue != null) ? sum(r, (d) => d.revenue || 0) : null; return { c, v, rev, rpm: rev != null && v >= 1000 ? (rev / v) * 1000 : null }; }).filter((x) => x.rpm != null);
      if (rpm.length >= 2) {
        rpm.sort((a, b) => b.rpm - a.rpm);
        const hi = rpm[0], lo = rpm[rpm.length - 1];
        if (lo.rpm > 0 ? hi.rpm / lo.rpm >= 1.5 : hi.rpm > 0) {
          out.push({
            impact: (hi.rpm - lo.rpm) * lo.v / 1000,
            title: `${esc(hi.c.nama)} paling menguntungkan per view`,
            why: `Pendapatan per 1.000 views (${period}): ` + rpm.map((x) => `${esc(x.c.nama)} <b>${money(x.rpm)}</b>`).join(' · ') + '.',
            act: `Arahkan penonton ${esc(lo.c.nama)} ke ${esc(hi.c.nama)} lewat layar akhir, kartu dan playlist, dan tambah slot jadwal di ${esc(hi.c.nama)} bila tim sanggup.`,
          });
        }
      }
    }

    // 3. Long videos vs Shorts
    if (admin) {
      const vids = recent(90).filter((c) => c.revenue != null && c.views >= 100);
      const by = (t) => { const v = vids.filter((c) => c.tipe_video === t); return { n: v.length, rpm: sum(v, (c) => c.views) ? (sum(v, (c) => c.revenue) / sum(v, (c) => c.views)) * 1000 : 0 }; };
      const L = by('long'), Sh = by('short');
      if (L.n >= 3 && Sh.n >= 3 && L.rpm >= Sh.rpm * 1.5) {
        const topShorts = vids.filter((c) => c.tipe_video === 'short').sort((a, b) => b.views - a.views).slice(0, 2);
        const shareLong = L.n / (L.n + Sh.n);
        out.push({
          impact: (L.rpm - Sh.rpm) * sum(topShorts, (c) => c.views) / 1000 + 1,
          title: `Video panjang menghasilkan ${(L.rpm / Math.max(Sh.rpm, 0.0001)).toFixed(1).replace('.', ',')}× lebih banyak per view`,
          why: `Per 1.000 views: video panjang <b>${money(L.rpm)}</b> (${L.n} video), Shorts <b>${money(Sh.rpm)}</b> (${Sh.n} video), 90 hari terakhir. Video panjang baru ${pct(shareLong)} dari upload.`,
          act: `Buat versi panjang (8 menit atau lebih, supaya bisa dipasang iklan tengah) dari Shorts terlaris: ${topShorts.map((c) => '“' + esc(c.judul) + '”').join(', ')}. Di Shorts-nya, tautkan video panjang tersebut.`,
        });
      } else if (L.n >= 3 && Sh.n >= 3 && Sh.rpm >= L.rpm * 1.5) {
        out.push({
          impact: 1, title: 'Shorts menghasilkan lebih banyak per view daripada video panjang',
          why: `Per 1.000 views: Shorts <b>${money(Sh.rpm)}</b> (${Sh.n} video), video panjang <b>${money(L.rpm)}</b> (${L.n} video), 90 hari terakhir.`,
          act: 'Pertahankan porsi Shorts, dan pendekkan video panjang yang retensinya turun cepat.',
        });
      }
    }

    // 4. Topics that earn (owner) or draw views (everyone) the most
    {
      const vids = recent(90).filter((c) => (admin ? c.revenue != null : true));
      const metric = (c) => (admin ? c.revenue : c.views);
      const overall = median(vids.map(metric));
      const groups = {};
      vids.forEach((c) => { if (c._topik !== 'Lainnya') (groups[c._topik] ||= []).push(c); });
      const best = Object.entries(groups).filter(([, l]) => l.length >= 3).map(([t, l]) => ({ t, l, m: median(l.map(metric)) })).sort((a, b) => b.m - a.m)[0];
      if (best && overall > 0 && best.m / overall >= 1.3) {
        const top = best.l.reduce((a, b) => (metric(b) > metric(a) ? b : a));
        out.push({
          impact: admin ? (best.m - overall) * 10 : 0.5,
          title: `Perbanyak topik “${esc(best.t)}”`,
          why: admin
            ? `Median pendapatan per video topik ini <b>${money(best.m)}</b>, sedangkan median semua video ${money(overall)} (${best.l.length} video, 90 hari).`
            : `Median views per video topik ini <b>${fmt(best.m)}</b>, sedangkan median semua video ${fmt(overall)} (${best.l.length} video, 90 hari).`,
          act: `Jadikan topik ini menu tetap di jadwal mingguan. Contoh terbaik: “${esc(top.judul)}” (${esc(top._chNama)}).`,
        });
      }
    }

    // 5. Best publishing time per channel
    chans.forEach((c) => {
      const vids = recent(60).filter((x) => x._ch === c.id);
      const med = median(vids.map((x) => x.views));
      if (vids.length < 9 || !med) return;
      const buckets = {};
      vids.forEach((x) => { const h = Math.floor(+x._jam.slice(0, 2) / 3) * 3; (buckets[h] ||= []).push(x.views); });
      const best = Object.entries(buckets).filter(([, l]) => l.length >= 3).map(([h, l]) => ({ h: +h, n: l.length, m: median(l) })).sort((a, b) => b.m - a.m)[0];
      if (!best || best.m / med < 1.25 || best.n / vids.length > 0.6) return;
      const hh = (h) => String(h).padStart(2, '0') + ':00';
      out.push({
        impact: ((best.m - med) * (vids.length - best.n)) / 1e6 + 0.3,
        title: `${esc(c.nama)}: tayang di jam ${hh(best.h)}–${hh(best.h + 3)} lebih ramai`,
        why: `Median views video yang tayang di jam itu <b>${fmt(best.m)}</b>, sedangkan median channel ${fmt(med)} (${best.n} dari ${vids.length} video, 60 hari).`,
        act: 'Geser satu slot jadwal karyawan ke jam ini (menu Karyawan → Ubah → Jadwal tayang).',
      });
    });

    // 6. Days without uploads
    chans.forEach((c) => {
      const rows = dayRows(c.id);
      const upDays = new Set(S.content.filter((x) => x._ch === c.id).map((x) => x._day));
      const withUp = rows.filter((d) => upDays.has(d.tanggal)), without = rows.filter((d) => !upDays.has(d.tanggal));
      if (withUp.length < 4 || without.length < 4) return;
      const a = sum(withUp, (d) => d.views) / withUp.length, b = sum(without, (d) => d.views) / without.length;
      if (!b || a / b < 1.1) return;
      out.push({
        impact: ((a - b) * without.length) / 1e6 + 0.2,
        title: `${esc(c.nama)}: jangan ada hari tanpa upload`,
        why: `Hari dengan upload rata-rata <b>${fmt(a)}</b> views, hari tanpa upload ${fmt(b)} (${Math.round((1 - b / a) * 100)}% lebih rendah). Ada ${without.length} hari kosong dalam ${period}.`,
        act: 'Pastikan minimal satu video tiap hari. Siapkan stok 2–3 video untuk hari libur atau saat karyawan berhalangan.',
      });
    });

    const list = out.sort((a, b) => b.impact - a.impact).slice(0, 6);
    return `<section class="card" id="kartu-strategi">
      <div class="card-h"><h2>${admin ? 'Strategi menaikkan pendapatan' : 'Strategi menaikkan views'}</h2><p>Dihitung dari data channel Anda sendiri, diurutkan dari dampak terbesar. Saran hanya muncul bila datanya cukup.${admin ? '' : ' Masuk sebagai pemilik untuk saran berbasis pendapatan.'}</p></div>
      ${list.length ? `<ol class="advice">${list.map((x) => `<li><div class="t"><b>${x.title}</b><div class="why">${x.why}</div><div class="act">${icon('bulb')}<span>${x.act}</span></div></div></li>`).join('')}</ol>`
        : '<div class="empty"><b>Belum cukup data untuk saran</b>Butuh setidaknya beberapa minggu angka YouTube Analytics dan video berumur 2 hari atau lebih.</div>'}
    </section>`;
  }

  function topikHtml() {
    const base = S.content.filter((c) => c._age >= 2 && c._age <= 32);
    const html = S.channels.map((ch) => {
      const vc = base.filter((c) => c._ch === ch.id);
      const med = median(vc.map((c) => c.views));
      if (!vc.length || !med) return '';
      const groups = {};
      vc.forEach((c) => { (groups[c._topik] ||= []).push(c); });
      const rows = Object.entries(groups).map(([t, list]) => ({ t, n: list.length, r: median(list.map((c) => c.views)) / med, best: list.reduce((a, b) => (b.views > a.views ? b : a)) }))
        .filter((x) => x.t !== 'Lainnya' || Object.keys(groups).length === 1).sort((a, b) => b.r - a.r).slice(0, 4);
      return `<div class="topic-ch"><h3>${esc(ch.nama)}</h3>${rows.map((x) => {
        const cls = x.n < 2 ? '' : x.r >= 1.2 ? 'ok' : x.r < 0.8 ? 'bad' : '';
        const tag = x.n < 2 ? 'uji lagi' : x.r >= 1.2 ? 'perbanyak' : x.r < 0.8 ? 'kurangi' : 'pertahankan';
        return `<div class="topic"><b>${esc(x.t)}</b><span class="x ${cls}">${x.r.toFixed(1).replace('.', ',')}× <span class="pill ${cls}">${tag}</span></span><span class="ex">${x.n} video · terbaik: ${esc(x.best.judul)}</span></div>`;
      }).join('')}</div>`;
    }).join('');
    return html ? `<div class="topics">${html}</div>` : '<div class="empty"><b>Belum cukup data</b>Butuh video berumur minimal 2 hari.</div>';
  }

  function personCard(st) {
    const e = st.e;
    const isMe = me() && me().id === e.id;
    const strip = daysBack(14, S.day > today() ? today() : S.day).map((d) => dayStats(e, d));
    const checks = [
      { l: st.partial ? 'Video sejauh ini' : 'Video tayang', v: st.n, t: st.target },
      { l: 'Tepat jadwal', v: st.tepat, t: st.withSlot, na: !slotsOf(e).length ? 'jadwal belum diatur' : !st.withSlot ? 'belum ada video' : null },
      ...TUGAS.map((t) => ({ l: t.short, v: st.done(t.nama), t: st.tTarget[t.nama] })),
    ];
    const items = [
      ...st.vids.map((v) => ({ jam: v._jam, kind: 'up', v })),
      ...st.tasks.map((a) => ({ jam: a.jam, kind: 'task', a })),
    ].sort((a, b) => a.jam.localeCompare(b.jam));
    const canDel = (a) => isAdmin() || (me() && me().id === a.editor_id);
    return `<section class="card person" id="orang-${e.id}">
      <div class="person-top">${avatar(e, 'lg')}
        <div class="t"><h2>${esc(e.nama)}${isMe ? ' <span class="pill leaf">Anda</span>' : ''}</h2><div class="sub">${peranLabel(e.peran)} · kode #${esc(e.kode_identifikasi)} · ${slotsOf(e).length ? 'jadwal ' + slotsOf(e).join(', ') : 'jadwal belum diatur'}</div></div>
        <div class="score"><div class="cap">${st.partial ? 'Skor<br>sementara' : 'Skor<br>' + tglPendek(st.day)}</div><span class="n">${st.skor ?? '—'}</span>${st.nilai ? `<span class="grade ${st.nilai}">${st.nilai}</span>` : ''}</div>
      </div>
      <div class="checks">${checks.map((c) => {
        if (c.na) return `<div class="check"><span class="l">${c.l}</span><span class="v muted" style="font-size:12.5px;font-weight:500">${c.na}</span></div>`;
        const r = c.t ? c.v / c.t : c.v ? 1 : null;
        const cls = r == null ? '' : r >= 1 ? '' : r > 0 ? 'warn' : 'bad';
        return `<div class="check"><span class="l">${c.l}</span><span class="v">${nf.format(c.v)}<small> / ${nf.format(c.t)}</small></span><span class="meter"><i class="${cls}" style="width:${Math.min(1, r ?? 0) * 100}%"></i></span></div>`;
      }).join('')}</div>
      <div>
        <div class="legend" style="margin-bottom:6px"><span><i class="slot"></i>Jadwal</span><span><i style="background:var(--ok)"></i>Tayang tepat</span><span><i style="background:var(--bad)"></i>Telat</span><span><i class="task"></i>Tugas lain</span></div>
        <div class="ruler" data-ruler="${e.id}" style="min-height:74px"></div>
      </div>
      <div>
        <div class="strip-l"><span>${tglPendek(strip[0].day)}</span><span>Skor 14 hari</span><span>${tglPendek(strip[strip.length - 1].day)}</span></div>
        <div class="strip">${strip.map((x) => `<button class="${x.nilai || ''}" data-act="ke-hari" data-v="${x.day}" aria-pressed="${x.day === S.day}" title="${tglPendek(x.day)}: skor ${x.skor ?? '—'}" aria-label="${tglPendek(x.day)}, skor ${x.skor ?? 'tidak ada'}">${x.skor ?? '·'}</button>`).join('')}</div>
      </div>
      <div>
        <div class="card-h" style="margin-bottom:4px"><h2>Yang dikerjakan</h2>${isAdmin() || isMe ? `<button class="btn sm ghost" data-act="catat" data-id="${e.id}">${icon('plus')}Catat</button>` : ''}</div>
        <div class="timeline">${items.length ? items.map((it) => it.kind === 'up' ? `
          <div class="tl"><span class="time">${it.jam}</span><span class="dot ${it.v._tepat === false ? 'late' : 'up'}"></span>
            <div class="what"><b>Upload video</b> <a href="/harian" data-act="video" data-id="${it.v.id}" style="color:inherit">${esc(it.v.judul)}</a><div>${esc(it.v._chNama)} · ${fmt(it.v.views)} views</div></div>
            <div class="res">${it.v._tepat == null ? '<span class="pill">tanpa jadwal</span>' : it.v._tepat ? `<span class="pill ok">tepat ${it.v._slot}</span>` : `<span class="pill bad">telat ${it.v._late} mnt</span>`}</div></div>` : `
          <div class="tl"><span class="time">${esc(it.jam)}</span><span class="dot task"></span>
            <div class="what"><b>${esc(it.a.tugas)}</b>${it.a.jumlah > 1 ? ' · ' + nf.format(it.a.jumlah) : ''}<div>${esc(it.a.detail || '')}</div></div>
            <div class="res res-btn">${canDel(it.a) ? `<button class="btn sm ghost" data-act="hapus-aktivitas" data-id="${it.a.id}" aria-label="Hapus aktivitas">${icon('x')}</button>` : ''}</div></div>`).join('')
          : `<div class="empty"><b>Belum ada catatan</b>${S.day === today() ? 'Video yang tayang muncul setelah sinkronisasi; tugas lain dicatat lewat tombol Catat.' : 'Tidak ada video atau tugas tercatat di hari ini.'}</div>`}</div>
      </div>
    </section>`;
  }

  function kontenRows() {
    const k = S.konten;
    const from = k.periode === 'all' ? '0000' : addDays(today(), -(+k.periode) + 1);
    const q = k.q.trim().toLowerCase();
    const rows = S.content.filter((c) => c._day >= from
      && (k.channel === 'all' || c._ch === k.channel)
      && (k.editor === 'all' || (k.editor === 'none' ? belumDikenali(c) : String(c.editor_id) === k.editor))
      && (k.tipe === 'all' || c.tipe_video === k.tipe)
      && (!q || (c.judul || '').toLowerCase().includes(q)));
    const val = {
      judul: (c) => c.judul || '', editor: (c) => (editorById(c.editor_id) || { nama: '~' }).nama, tanggal: (c) => c.tanggal_upload,
      views: (c) => c.views, likes: (c) => c.likes, comments: (c) => c.comments, durasi: (c) => +c.duration_secs || 0,
    }[k.sort];
    rows.sort((a, b) => { const x = val(a), y = val(b); const r = typeof x === 'number' ? x - y : String(x).localeCompare(String(y)); return k.dir === 'asc' ? r : -r; });
    return rows;
  }

  // ============ after render (charts, inputs) ============
  const AFTER = {
    analytics() {
      const chans = analyticsChannels();
      const latest = S.daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '') || addDays(today(), -2);
      const days = daysBack(S.anPeriode, latest);
      const val = (id, d) => (S.daily.find((x) => x.channel_id === id && x.tanggal === d) || {}).views || 0;
      const box = $('#an-chart');
      if (box) drawStacked(box, { days, series: chans.map((c) => ({ name: c.nama, color: chColor(c.id), values: days.map((d) => val(c.id, d)) })), label: 'Views harian per channel' });
      $$('.an-spark').forEach((el) => drawSparkbars(el, days.map((d) => val(el.dataset.ch, d)), chColor(el.dataset.ch)));
    },
    pengaturan() {
      const f = $('#ch-form');
      if (!f) return;
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const channels = f.channels.value.split('\n').map((x) => x.trim()).filter(Boolean);
        const btn = $('button', f);
        btn.disabled = true; btn.textContent = 'Memeriksa ke YouTube…';
        try {
          const list = await api('/api/channels', { method: 'PUT', body: { channels } });
          S.channels = list;
          if (S.scan) S.scan.youtube_channels = list.length;
          normalize();
          toast(list.length + ' channel tersimpan: ' + list.map((c) => c.nama).join(', '));
          render();
        } catch (e) { $('#ch-err').textContent = e.message; btn.disabled = false; btn.textContent = 'Simpan channel'; }
      });
    },
    ringkasan() {
      const { days, vids, team, target } = ringkasanData();
      const series = team.map((e) => ({ name: e.nama, color: e._color, values: days.map((d) => vids.filter((c) => c._day === d && c.editor_id === e.id).length) }));
      series.push({ name: 'Belum dikenali', color: 'var(--line-2)', values: days.map((d) => vids.filter((c) => c._day === d && !team.some((e) => e.id === c.editor_id)).length) });
      const box = $('#ch-video');
      if (box) drawStacked(box, { days, series, target: S.channel === 'all' ? sum(team, targetOf) : 0 });
      $$('.spark').forEach((el) => drawSparkbars(el, days.map((d) => sum(vids.filter((c) => c._ch === el.dataset.ch && c._day === d), (c) => c.views)), 'var(--leaf)'));
      const sel = $('#f-channel');
      if (sel) sel.addEventListener('change', () => { S.channel = sel.value; render(); });
    },
    harian() {
      $$('[data-ruler]').forEach((el) => drawRuler(el, dayStats(editorById(el.dataset.ruler), S.day)));
      const inp = $('#f-day');
      if (inp) inp.addEventListener('change', () => { if (inp.value && inp.value <= today()) { S.day = inp.value; render(); } });
      const target = location.pathname.split('/')[2];
      // Employees have only their own page: /harian/<someone> is just /harian.
      if (target && me()) history.replaceState(null, '', '/harian');
      else if (target) { const el = $('#orang-' + target); if (el) el.scrollIntoView({ block: 'start' }); }
    },
    konten() {
      const k = S.konten;
      const q = $('#k-q');
      let t;
      q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { k.q = q.value; k.page = 1; render(); const n = $('#k-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
      [['#k-channel', 'channel'], ['#k-editor', 'editor'], ['#k-tipe', 'tipe'], ['#k-periode', 'periode']].forEach(([s, f]) => $(s).addEventListener('change', (ev) => { k[f] = ev.target.value; k.page = 1; render(); }));
    },
    identifikasi() {
      const all = $('#sel-all');
      if (all) all.addEventListener('change', () => { $$('[data-sel]').forEach((c) => { c.checked = all.checked; c.checked ? S.sel.add(+c.dataset.sel) : S.sel.delete(+c.dataset.sel); }); $('#sel-count').textContent = S.sel.size + ' dipilih'; });
      $$('[data-sel]').forEach((c) => c.addEventListener('change', () => { c.checked ? S.sel.add(+c.dataset.sel) : S.sel.delete(+c.dataset.sel); $('#sel-count').textContent = S.sel.size + ' dipilih'; }));
      $$('[data-assign]').forEach((s) => s.addEventListener('change', () => { if (s.value) assign([+s.dataset.assign], +s.value); }));
    },
  };

  // ============ page: presensi ============
  // Employees check in and out; the server decides (office Wi-Fi IP, GPS accuracy, radius, jumps).
  // The owner sees today's attendance, a 30-day recap, refused attempts, and sets the rules.
  const jamWib = (iso) => (iso ? new Date(new Date(iso).getTime() + WIB).toISOString().slice(11, 16) : '—');
  const waktuWib = (iso) => { const w = new Date(new Date(iso).getTime() + WIB).toISOString(); return tglPendek(w.slice(0, 10)) + ' ' + w.slice(11, 16); };
  const meter = (v) => (v == null ? '—' : nf.format(Math.round(v)) + ' m');

  async function loadPresensi() {
    const q = '?dari=' + addDays(today(), -30) + '&sampai=' + today();
    const [config, rows, ditolak] = await Promise.all([api('/api/presensi/config'), api('/api/presensi' + q), api('/api/presensi/ditolak' + q)]);
    S.presensi = { config, rows, ditolak };
  }

  const hariPresensi = (rows, id, d) => {
    const r = rows.filter((x) => x.editor_id === id && x.tanggal === d);
    return { masuk: r.find((x) => x.jenis === 'masuk') || null, pulang: r.find((x) => x.jenis === 'pulang') || null };
  };
  function statusPresensi(h, cfg, d) {
    const j = jamKerja(d);
    if (!h.masuk) return !j ? `<span class="pill">Libur · ${esc(ketLibur(d))}</span>` : d === today() ? '<span class="pill warn">Belum absen</span>' : '<span class="pill bad">Tidak absen</span>';
    if (!j) return '<span class="pill leaf">Masuk di hari libur (lembur)</span>';
    const out = [h.masuk.telat_menit > 0 ? `<span class="pill bad">Telat ${h.masuk.telat_menit} mnt</span>` : '<span class="pill ok">Tepat waktu</span>'];
    if (h.pulang) { const cepat = toMin(j.pulang) - toMin(jamWib(h.pulang.waktu)); if (cepat > 0) out.push(`<span class="pill warn">Pulang ${cepat} mnt lebih awal</span>`); }
    return out.join(' ');
  }
  // "Senin–Kamis 08:00–16:00 · Jumat–Sabtu 08:00–15:00 · Minggu libur"
  function ringkasJadwal(jadwal) {
    const urut = [1, 2, 3, 4, 5, 6, 0];
    const kelompok = [];
    urut.forEach((i) => {
      const x = jadwal[i];
      const k = x ? x.masuk + '–' + x.pulang : 'libur';
      const last = kelompok[kelompok.length - 1];
      if (last && last.k === k) last.hari.push(i); else kelompok.push({ k, hari: [i] });
    });
    return kelompok.map((g) => (g.hari.length > 1 ? HARI[g.hari[0]] + '–' + HARI[g.hari[g.hari.length - 1]] : HARI[g.hari[0]]) + ' ' + g.k).join(' · ');
  }
  // The next red dates, for the owner's settings and the guide.
  const liburBerikutnya = (n = 6) => Object.entries(kalender().libur).filter(([d]) => d >= today()).sort(([a], [b]) => a.localeCompare(b)).slice(0, n);
  function ditolakTable(list, owner) {
    if (!list.length) return '<div class="empty"><b>Tidak ada percobaan yang ditolak</b>30 hari terakhir.</div>';
    return `<div class="table-wrap"><table class="t stack"><thead><tr><th>Waktu</th>${owner ? '<th>Karyawan</th>' : ''}<th>Alasan</th>${owner ? '<th>IP</th><th class="num">Akurasi</th><th class="num">Jarak</th>' : ''}</tr></thead><tbody>
      ${list.map((x) => `<tr><td class="mono" data-label="Waktu">${waktuWib(x.waktu)} · ${esc(x.jenis)}</td>${owner ? `<td data-label="Karyawan">${esc((editorById(x.editor_id) || {}).nama || '—')}</td>` : ''}<td class="full">${esc(x.alasan)}</td>${owner ? `<td class="mono" data-label="IP">${esc(x.ip)}</td><td class="num" data-label="Akurasi">${meter(x.akurasi)}</td><td class="num" data-label="Jarak">${meter(x.jarak)}</td>` : ''}</tr>`).join('')}
    </tbody></table></div>`;
  }

  // The office's public IP seems to have changed (several people refused from one new network while
  // inside the office): one tap for the owner instead of everyone being refused all day.
  function ipBaruCard() {
    const k = isAdmin() && S.presensi && S.presensi.config && S.presensi.config.ip_kandidat;
    if (!k) return '';
    return `<section class="card ip-baru" role="alert"><div class="card-h"><h2>IP Wi-Fi kantor tampaknya berubah</h2><p>${k.orang} karyawan yang GPS-nya di dalam kantor ditolak dari jaringan <b class="mono">${esc(k.ip)}</b> (terakhir ${jamWib(k.terakhir)}). Biasanya karena modem dinyalakan ulang. Setujui bila mereka memang di kantor.</p></div>
      <div class="tools"><button class="btn primary" data-act="ip-baru" data-ip="${esc(k.ip)}" data-ganti="1">Ganti IP lama dengan ini</button><button class="btn" data-act="ip-baru" data-ip="${esc(k.ip)}">Tambahkan saja</button><button class="btn ghost" data-act="ip-abaikan" data-ip="${esc(k.ip)}">Bukan kantor</button></div></section>`;
  }

  function presensiPage() {
    const P = S.presensi;
    if (!P) {
      loadPresensi().then(() => { if (route() === 'presensi') render(); }).catch((e) => { S.presensi = { error: e.message }; if (route() === 'presensi') render(); });
      return '<header class="head"><div><h1>Presensi</h1><p>Memuat…</p></div></header><div class="skeleton" style="height:220px"></div>';
    }
    if (P.error) return `<section class="card empty" style="padding:48px 20px" role="alert"><b style="font-size:16px">Presensi belum bisa dimuat</b><p style="margin:6px 0 16px">${esc(P.error)}</p><button class="btn primary" data-act="presensi-muat">${icon('sync')}Coba lagi</button></section>`;
    const cfg = P.config;
    const net = cfg.ip_kantor ? '<span class="pill ok">Wi-Fi kantor</span>' : '<span class="pill bad">Bukan Wi-Fi kantor</span>';
    const jh = jamKerja(today());
    const syarat = `Absen diterima bila tersambung ke Wi-Fi kantor, GPS menyala dengan akurasi ≤ ${cfg.akurasi_maks} m, dan posisi dalam ${cfg.radius} m dari kantor. Jam kerja: ${esc(ringkasJadwal(cfg.jadwal || kalender().jadwal))} (toleransi telat ${cfg.toleransi} menit). Tanggal merah libur.`;
    if (!isAdmin()) {
      const who = me();
      if (!who) return '<section class="card empty"><b>Masuk sebagai karyawan untuk absen</b></section>';
      const h = hariPresensi(P.rows, who.id, today());
      const days = [...new Set(P.rows.map((r) => r.tanggal))].sort().reverse();
      return `
        <header class="head"><div><h1>Presensi</h1><p><span class="muted">${tglPanjang(today())}.</span> ${h.pulang ? 'Absen hari ini sudah lengkap.' : h.masuk ? 'Sudah absen masuk. Jangan lupa absen pulang.' : 'Belum absen masuk hari ini.'}</p></div><div class="tools">${bantuan('presensi')}</div></header>
        ${!cfg.siap ? '<div class="notice" role="status" style="margin:0;max-width:none"><b>Presensi belum diatur.</b> Pemilik perlu mengisi lokasi kantor dan IP Wi-Fi kantor dulu.</div>' : ''}
        <section class="kpis">
          <div class="kpi"><span class="l">Masuk</span><span class="v mono">${jamWib(h.masuk && h.masuk.waktu)}</span><span class="d">${jh ? 'jadwal ' + esc(jh.masuk) : 'libur: ' + esc(ketLibur(today()))}</span></div>
          <div class="kpi"><span class="l">Pulang</span><span class="v mono">${jamWib(h.pulang && h.pulang.waktu)}</span><span class="d">${jh ? 'jadwal ' + esc(jh.pulang) : 'tidak ada jadwal'}</span></div>
          <div class="kpi"><span class="l">Status hari ini</span><span class="v" style="font-size:15px">${statusPresensi(h, cfg, today())}</span><span class="d">${net} <span class="mono">IP ${esc(cfg.ip_anda)}</span></span></div>
        </section>
        <section class="card">
          <div class="tools">
            <button class="btn primary" data-act="absen" data-jenis="masuk" ${h.masuk || !cfg.siap ? 'disabled' : ''}>${icon('pin')}Absen masuk</button>
            <button class="btn" data-act="absen" data-jenis="pulang" ${!h.masuk || h.pulang || !cfg.siap ? 'disabled' : ''}>${icon('out')}Absen pulang</button>
          </div>
          <p class="muted" id="absen-status" role="status" style="margin:12px 0 0;font-size:13px">${syarat} Izinkan akses lokasi saat browser memintanya.</p>
        </section>
        <section class="card"><div class="card-h"><h2>Riwayat 30 hari</h2></div>
          ${days.length ? `<div class="table-wrap"><table class="t stack"><thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Status</th></tr></thead><tbody>
            ${days.map((d) => { const x = hariPresensi(P.rows, who.id, d); return `<tr><td class="full"><b>${tglPanjang(d)}</b></td><td class="mono" data-label="Masuk">${jamWib(x.masuk && x.masuk.waktu)}</td><td class="mono" data-label="Pulang">${jamWib(x.pulang && x.pulang.waktu)}</td><td data-label="Status">${statusPresensi(x, cfg, d)}</td></tr>`; }).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Belum ada presensi</b>Riwayat muncul setelah absen pertama.</div>'}
        </section>
        <section class="card"><div class="card-h"><h2>Percobaan yang ditolak</h2><p>Alasan tiap absen yang tidak diterima.</p></div>${ditolakTable(P.ditolak, false)}</section>
        ${notifCard()}`;
    }
    const eds = activeEditors();
    const hadir = eds.filter((e) => hariPresensi(P.rows, e.id, today()).masuk).length;
    const telat = eds.filter((e) => (hariPresensi(P.rows, e.id, today()).masuk || {}).telat_menit > 0).length;
    const ditolakHariIni = P.ditolak.filter((x) => waktuWib(x.waktu).startsWith(tglPendek(today()) + ' ')).length;
    return `
      <header class="head"><div><h1>Presensi</h1><p><span class="muted">${tglPanjang(today())}.</span> <b>${hadir}</b> dari ${eds.length} karyawan sudah absen masuk${telat ? `, <b>${telat}</b> telat` : ''}.</p></div><div class="tools">${bantuan('presensi')}</div></header>
      ${!cfg.siap ? '<div class="notice" role="status" style="margin:0;max-width:none"><b>Presensi belum bisa dipakai.</b> Isi lokasi kantor dan IP Wi-Fi kantor di kartu Aturan presensi.</div>' : ''}
      ${ipBaruCard()}
      <section class="kpis">
        <div class="kpi"><span class="l">Hadir hari ini</span><span class="v">${hadir} <small>/ ${eds.length}</small></span><span class="d">absen masuk tercatat</span></div>
        <div class="kpi"><span class="l">Telat hari ini</span><span class="v ${telat ? 'bad' : ''}">${telat}</span><span class="d">${jh ? `lewat ${esc(jh.masuk)} + ${cfg.toleransi} mnt` : 'hari ini libur'}</span></div>
        <div class="kpi ${ditolakHariIni ? 'alert' : ''}"><span class="l">Ditolak hari ini</span><span class="v">${ditolakHariIni}</span><span class="d">${P.ditolak.length} dalam 30 hari</span></div>
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Hari ini</h2></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Karyawan</th><th>Masuk</th><th>Pulang</th><th>Status</th><th class="num">Jarak</th></tr></thead><tbody>
            ${eds.map((e) => { const h = hariPresensi(P.rows, e.id, today()); return `<tr><td class="full"><span class="ed">${avatar(e, 'xs')}<b>${esc(e.nama)}</b></span></td><td class="mono" data-label="Masuk">${jamWib(h.masuk && h.masuk.waktu)}</td><td class="mono" data-label="Pulang">${jamWib(h.pulang && h.pulang.waktu)}</td><td data-label="Status">${statusPresensi(h, cfg, today())}</td><td class="num" data-label="Jarak">${meter(h.masuk && h.masuk.jarak)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="muted">Belum ada karyawan aktif.</td></tr>'}
          </tbody></table></div></section>
        <section class="card"><div class="card-h"><h2>Rekap 30 hari</h2><button class="btn sm ghost" data-act="csv-presensi">${icon('download')}Excel</button></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Karyawan</th><th class="num">Hadir</th><th class="num">Telat</th><th class="num">Total telat</th><th class="num">Ditolak</th></tr></thead><tbody>
            ${eds.map((e) => { const m = P.rows.filter((r) => r.editor_id === e.id && r.jenis === 'masuk'); const t = m.filter((r) => r.telat_menit > 0); const dt = P.ditolak.filter((x) => x.editor_id === e.id).length; return `<tr><td class="full"><b>${esc(e.nama)}</b></td><td class="num" data-label="Hadir">${m.length} hari</td><td class="num" data-label="Telat">${t.length}×</td><td class="num" data-label="Total telat">${sum(t, (r) => r.telat_menit)} mnt</td><td class="num" data-label="Ditolak">${dt ? `<span class="pill bad">${dt}</span>` : '0'}</td></tr>`; }).join('')}
          </tbody></table></div></section>
      </div>
      <section class="card"><div class="card-h"><h2>Percobaan yang ditolak</h2><p>Banyak penolakan "bukan Wi-Fi kantor", "akurasi tidak wajar" atau "lokasi berpindah" dari satu orang bisa menandakan percobaan curang.</p></div>${ditolakTable(P.ditolak, true)}</section>
      <section class="card"><div class="card-h"><h2>Aturan presensi</h2><p>Absen hanya diterima bila <b>semua</b> terpenuhi: IP internet sama dengan Wi-Fi kantor, akurasi GPS cukup, dan posisi di dalam radius kantor.</p></div>
        <form id="presensi-form" style="display:flex;flex-direction:column;gap:12px;max-width:640px">
          <div class="row">
            <label class="field"><span>Lintang (lat) kantor</span><input class="input mono" name="lat" inputmode="decimal" value="${cfg.lat ?? ''}" placeholder="-6.200000" required></label>
            <label class="field"><span>Bujur (lng) kantor</span><input class="input mono" name="lng" inputmode="decimal" value="${cfg.lng ?? ''}" placeholder="106.816666" required></label>
          </div>
          <div class="tools"><button type="button" class="btn sm" data-act="presensi-lokasi">${icon('pin')}Pakai lokasi saya sekarang</button><span class="muted" id="lokasi-info" style="font-size:13px"></span></div>
          <div class="row">
            <label class="field"><span>Radius kantor (meter)</span><input class="input" name="radius" type="number" min="20" max="2000" value="${cfg.radius}" required></label>
            <label class="field"><span>Akurasi GPS maksimal (meter)</span><input class="input" name="akurasi_maks" type="number" min="5" max="500" value="${cfg.akurasi_maks}" required></label>
          </div>
          <label class="field"><span>IP publik Wi-Fi kantor</span><textarea class="input mono" name="ips" rows="3" required placeholder="203.0.113.7">${esc((cfg.ips || []).join('\n'))}</textarea>
            <small>Satu per baris; rentang seperti 203.0.113.0/24 juga bisa. IP Anda sekarang: <b class="mono">${esc(cfg.ip_anda)}</b> ${cfg.ip_kantor ? '(sudah terdaftar)' : '(belum terdaftar)'}. Buka halaman ini dari Wi-Fi kantor lalu klik Tambahkan IP saya.</small></label>
          <div class="tools"><button type="button" class="btn sm" data-act="presensi-ip" data-ip="${esc(cfg.ip_saran || cfg.ip_anda)}">${icon('plus')}Tambahkan IP saya</button></div>
          <fieldset class="jam-kerja"><legend>Jam kerja (WIB)</legend>
            ${[1, 2, 3, 4, 5, 6, 0].map((i) => { const x = (cfg.jadwal || JADWAL_BAWAAN)[i]; return `<div class="jk-row" data-hari="${i}">
              <label class="chk"><input type="checkbox" name="kerja-${i}" ${x ? 'checked' : ''}> ${HARI[i]}</label>
              <input class="input" type="time" name="masuk-${i}" value="${esc(x ? x.masuk : '08:00')}" aria-label="Jam masuk ${HARI[i]}" ${x ? '' : 'disabled'}>
              <span class="muted">–</span>
              <input class="input" type="time" name="pulang-${i}" value="${esc(x ? x.pulang : '16:00')}" aria-label="Jam pulang ${HARI[i]}" ${x ? '' : 'disabled'}></div>`; }).join('')}
          </fieldset>
          <label class="field"><span>Toleransi telat (menit)</span><input class="input" name="toleransi" type="number" min="0" max="120" value="${cfg.toleransi}" required style="max-width:160px"></label>
          <div class="field"><span>Hari libur</span>
            <label class="chk"><input type="checkbox" name="cuti_bersama" ${cfg.cuti_bersama ? 'checked' : ''}> Ikut cuti bersama pemerintah</label>
            <small>Tanggal merah (libur nasional) selalu libur. Berikutnya: ${liburBerikutnya().map(([d, n]) => `${tglPendek(d)} ${esc(n)}`).join(' · ') || '—'}.</small></div>
          <label class="field"><span>Libur kantor tambahan</span><textarea class="input mono" name="libur_kantor" rows="2" placeholder="2026-12-31">${esc((cfg.libur_kantor || []).join('\n'))}</textarea><small>Satu tanggal per baris (YYYY-MM-DD), untuk libur khusus kantor di luar tanggal merah.</small></label>
          <div class="err" id="presensi-err" role="alert" style="color:var(--bad);font-size:13px"></div>
          <div><button class="btn primary">Simpan aturan</button></div>
        </form></section>`;
  }
  PAGES.presensi = presensiPage;

  // Watches GPS for a few seconds and keeps the most precise fix, so a rough first reading
  // is not sent when a better one arrives a moment later.
  function ambilLokasi(target, onUpdate) {
    return new Promise((resolve, reject) => {
      if (!window.isSecureContext || !navigator.geolocation) return reject(new Error('Browser ini tidak bisa membaca lokasi. Buka lewat https dengan Chrome atau Safari.'));
      let best = null, done = false, id = null;
      const finish = (fn) => { if (done) return; done = true; navigator.geolocation.clearWatch(id); clearTimeout(timer); fn(); };
      const timer = setTimeout(() => finish(() => (best ? resolve(best) : reject(new Error('Lokasi tidak didapat dalam 20 detik. Pastikan GPS menyala, lalu coba lagi.')))), 20000);
      id = navigator.geolocation.watchPosition((p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
        if (onUpdate) onUpdate(best.coords.accuracy);
        if (best.coords.accuracy <= target) finish(() => resolve(best));
      }, (e) => finish(() => reject(new Error(e.code === 1 ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu coba lagi.' : 'Lokasi tidak bisa dibaca. Pastikan GPS menyala.'))), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    });
  }

  async function absen(el) {
    const cfg = S.presensi.config;
    const say = (t) => { const s = $('#absen-status'); if (s) s.textContent = t; };
    $$('[data-act="absen"]').forEach((b) => { b.disabled = true; });
    try {
      say('Membaca lokasi GPS…');
      const pos = await ambilLokasi(cfg.akurasi_maks, (acc) => say(`Membaca lokasi GPS… akurasi ± ${Math.round(acc)} m`));
      say('Mengirim presensi…');
      await api('/api/presensi', { method: 'POST', body: { jenis: el.dataset.jenis, lat: pos.coords.latitude, lng: pos.coords.longitude, akurasi: pos.coords.accuracy, diambil: pos.timestamp } });
      toast(el.dataset.jenis === 'masuk' ? 'Absen masuk tercatat' : 'Absen pulang tercatat');
    } catch (e) {
      toast(e.message, true);
    }
    try { await loadPresensi(); } catch (e) { /* keep the last numbers on screen */ }
    render();
  }

  AFTER.presensi = () => {
    const f = $('#presensi-form');
    if (!f) return;
    $$('.jk-row', f).forEach((row) => { const cb = $('input[type=checkbox]', row); cb.addEventListener('change', () => { $$('input[type=time]', row).forEach((t) => { t.disabled = !cb.checked; }); }); });
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = Object.fromEntries(new FormData(f));
      const body = { lat: fd.lat, lng: fd.lng, ips: String(fd.ips || '').split(/\s+/).filter(Boolean), cuti_bersama: !!fd.cuti_bersama,
        libur_kantor: String(fd.libur_kantor || '').split(/\s+/).filter(Boolean),
        jadwal: [0, 1, 2, 3, 4, 5, 6].map((i) => (fd['kerja-' + i] ? { masuk: fd['masuk-' + i], pulang: fd['pulang-' + i] } : null)) };
      ['radius', 'akurasi_maks', 'toleransi'].forEach((k) => { body[k] = Number(fd[k]); });
      const btn = $('button.primary', f);
      btn.disabled = true;
      try {
        S.presensi.config = await api('/api/presensi/config', { method: 'PUT', body });
        toast('Aturan presensi tersimpan');
        // Working days move payroll, leave and video targets: everything again.
        S.gajiCache = {};
        await muatUlang();
      } catch (e) { $('#presensi-err').textContent = e.message; btn.disabled = false; }
    });
  };

  // ============ page: hari ini (karyawan) ============
  // One screen with everything an employee needs today: check in, the upload schedule,
  // tasks left, and anything waiting on them. The rest of the menu is for looking back.
  PAGES['hari-ini'] = function () {
    const e = me();
    if (!e) return '<section class="card empty"><b>Masuk sebagai karyawan</b></section>';
    const d = today();
    const st = dayStats(e, d);
    const P = S.presensi && S.presensi.config ? S.presensi : null;
    const cfg = P && P.config;
    const h = P ? hariPresensi(P.rows, e.id, d) : {};
    const now = toMin(nowJam());
    const jamHariIni = jamKerja(d);
    const salam = now < 660 ? 'Selamat pagi' : now < 900 ? 'Selamat siang' : now < 1080 ? 'Selamat sore' : 'Selamat malam';

    // Check-in: the one action that matters first thing.
    const absenLangkah = !cfg ? '' : !cfg.siap
      ? '<p class="muted" style="margin:0">Presensi belum diatur pemilik.</p>'
      : !jamHariIni && !h.masuk ? `<p style="margin:0"><b>Hari ini libur: ${esc(ketLibur(d))}.</b> Tidak perlu absen. Bila tetap bekerja, absen seperti biasa dan dihitung lembur.</p><div class="tools" style="margin-top:10px"><button class="btn" data-act="absen" data-jenis="masuk">${icon('pin')}Tetap absen masuk</button></div><p class="muted" id="absen-status" role="status" style="margin:10px 0 0;font-size:13px"></p>`
      : h.pulang ? `<p style="margin:0">Masuk <b class="mono">${jamWib(h.masuk.waktu)}</b> · pulang <b class="mono">${jamWib(h.pulang.waktu)}</b>. Absen hari ini lengkap.</p>`
      : `<div class="tools">${h.masuk
        ? `<button class="btn primary big" data-act="absen" data-jenis="pulang">${icon('out')}Absen pulang</button><span class="muted">Masuk ${jamWib(h.masuk.waktu)}${jamHariIni ? ' · jadwal pulang ' + esc(jamHariIni.pulang) : ''}</span>`
        : `<button class="btn primary big" data-act="absen" data-jenis="masuk">${icon('pin')}Absen masuk</button><span class="muted">Jam kerja hari ini ${esc(jamHariIni.masuk)}–${esc(jamHariIni.pulang)}</span>`}</div>
        <p class="muted" id="absen-status" role="status" style="margin:10px 0 0;font-size:13px">${cfg.ip_kantor ? 'Tersambung ke Wi-Fi kantor.' : 'Belum tersambung ke Wi-Fi kantor. Sambungkan dulu, matikan data seluler dan VPN.'} Nyalakan GPS.</p>`;

    // Upload schedule: each slot done, due now, or later.
    const slots = slotsOf(e);
    const target = targetOf(e);
    const terpakai = new Set(st.vids.map((v) => v._slot));
    const jadwal = slots.length ? slots.map((x) => {
      const v = st.vids.find((y) => y._slot === x);
      const cls = v ? (v._tepat ? 'ok' : 'warn') : toMin(x) + TOL < now ? 'bad' : toMin(x) - 60 <= now ? 'due' : '';
      const ket = v ? (v._tepat ? 'Tayang ' + v._jam : 'Telat · ' + v._jam) : toMin(x) + TOL < now ? 'Terlewat' : toMin(x) - 60 <= now ? 'Sebentar lagi' : 'Nanti';
      return `<li class="${cls}"><b class="mono">${x}</b><span>${ket}</span></li>`;
    }).join('') : '';
    const lepas = st.vids.filter((v) => !terpakai.has(v._slot) || !v._slot);

    // Tasks besides uploads, against the full-day target.
    const tugas = jamHariIni ? TUGAS.map((t) => ({ t, butuh: t.target(target, 1), sudah: st.done(t.nama) })).filter((x) => x.butuh > 0) : [];

    // Waiting on someone.
    const aju = S.pengajuan ? S.pengajuan.list.filter((p) => p.editor_id === e.id) : [];
    const tunggu = aju.filter((p) => p.status === 'menunggu').length;
    const putus = aju.filter((p) => p.status !== 'menunggu' && p.diputus_at && Date.now() - new Date(p.diputus_at).getTime() < 3 * 86400000);
    const G = S.gajiCache[d.slice(0, 7)];
    const gajiSaya = G && G.list ? G.list.find((r) => r.editor_id === e.id) : null;

    return `
      <header class="head"><div><h1>${salam}, ${esc(e.nama.split(' ')[0])}</h1><p class="muted">${tglPanjang(d)}</p></div></header>
      <section class="card today-hero">
        <div class="card-h"><h2>Presensi</h2>${cfg ? statusPresensi(h, cfg, d) : ''}</div>
        ${P ? absenLangkah : '<p class="muted" style="margin:0">Data presensi belum termuat. <a href="/presensi">Buka Presensi</a></p>'}
      </section>
      <div class="grid-2">
        <section class="card">
          <div class="card-h"><h2>Video hari ini</h2><span class="pill ${st.n >= target ? 'ok' : ''}">${jamHariIni ? st.n + ' / ' + target : st.n + ' · libur'}</span></div>
          ${!jamHariIni ? '<p class="muted" style="margin:0">Hari libur: tidak ada target video. Video yang tetap tayang tetap tercatat.</p>' : slots.length ? `<ul class="slots">${jadwal}</ul>` : `<p class="muted" style="margin:0">Belum ada jadwal tayang. Minta pemilik mengisinya di menu Tim.</p>`}
          ${lepas.length ? `<p class="muted" style="margin:10px 0 0;font-size:13px">${lepas.length} video di luar jadwal juga terhitung.</p>` : ''}
          <p class="muted" style="margin:10px 0 0;font-size:13px">Tulis <b class="mono">#${esc(e.kode_identifikasi || '')}</b> di deskripsi. Video muncul paling lama 1 jam setelah tayang.</p>
        </section>
        <section class="card">
          <div class="card-h"><h2>Tugas lain</h2><button class="btn sm" data-act="catat" data-id="${e.id}">${icon('plus')}Catat</button></div>
          ${tugas.length ? '' : '<p class="muted" style="margin:0">Tidak ada target tugas hari ini.</p>'}<ul class="todo">${tugas.map((x) => `<li class="${x.sudah >= x.butuh ? 'done' : ''}"><span class="tick" aria-hidden="true">${x.sudah >= x.butuh ? '✓' : ''}</span><span>${esc(x.t.nama)}</span><b class="num">${nf.format(x.sudah)} / ${nf.format(x.butuh)}</b></li>`).join('')}</ul>
        </section>
      </div>
      <section class="kpis">
        <a class="kpi" href="/harian"><span class="l">Skor ${st.partial ? 'sementara' : 'hari ini'}</span><span class="v">${st.skor ?? '—'} ${st.nilai ? `<span class="grade ${st.nilai}">${st.nilai}</span>` : ''}</span><span class="d">Lihat rinciannya →</span></a>
        <a class="kpi ${tunggu ? 'alert' : ''}" href="/pengajuan"><span class="l">Izin & klaim</span><span class="v">${tunggu}</span><span class="d">${tunggu ? 'menunggu keputusan' : putus.length ? putus.map((p) => (p.status === 'disetujui' ? 'disetujui' : 'ditolak')).join(', ') + ' baru-baru ini' : 'tidak ada yang menunggu'}</span></a>
        <a class="kpi" href="/gaji"><span class="l">Gaji ${bulanLabel(d.slice(0, 7)).split(' ')[0]}</span><span class="v">${gajiSaya && gajiSaya.aturan_diisi ? idr(gajiSaya.total) : '—'}</span><span class="d">${!gajiSaya ? 'belum termuat' : !gajiSaya.aturan_diisi ? 'aturan gaji belum diisi pemilik' : gajiSaya.dibayar_at ? 'sudah dibayar' : gajiSaya.status === 'final' ? 'sudah final' : 'perkiraan sampai hari ini'}</span></a>
      </section>
      ${S.notif && !S.notif.aktif ? notifCard() : ''}`;
  };

  // ============ shared: newer pages ============
  const BLN_PJ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const bulanLabel = (b) => BLN_PJ[+b.slice(5, 7) - 1] + ' ' + b.slice(0, 4);
  const kali = (r) => (r == null || isNaN(r) ? '—' : r.toFixed(1).replace('.', ',') + '×');
  const menunggu = () => (isAdmin() && S.pengajuan ? S.pengajuan.list.filter((p) => p.status === 'menunggu').length : 0);
  const bantuan = (id) => `<a class="btn ghost" href="/panduan#p-${id}">${icon('book')}Cara kerja</a>`;
  // Views of a video against the median of its channel and type (videos 2–32 days old), as on Harian.
  const ratioOf = (c) => { const m = S.medians[c._ch + '|' + c.tipe_video]; return c._age >= 2 && m ? c.views / m : null; };
  // Same, but against videos published in the same window: fair for comparing older weeks.
  function peerRatios(list) {
    const g = {};
    list.forEach((c) => { (g[c._ch + '|' + c.tipe_video] ||= []).push(c.views); });
    const med = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, median(v)]));
    return new Map(list.map((c) => { const m = med[c._ch + '|' + c.tipe_video]; return [c.id, m ? c.views / m : null]; }));
  }
  const retOf = (c) => (S.insight && S.insight.retMap.get(c.id)) || null;
  const likeRate = (list) => { const v = sum(list, (c) => c.views); return v >= 300 ? (sum(list, (c) => c.likes) / v) * 1000 : null; };
  const avgRet = (list, k) => { const r = list.map(retOf).filter(Boolean); return r.length >= 3 ? { v: sum(r, (x) => x[k]) / r.length, n: r.length } : null; };

  // Retention summaries and recent view gains: loaded after the first paint, never blocking it.
  let insightJob = null;
  function loadInsight(force = false) {
    if (insightJob || (S.insight && !S.insight.error && !force)) return insightJob;
    insightJob = api('/api/insight', { timeout: 30000 })
      .then((r) => { S.insight = { ...r, retMap: new Map(r.retensi.map((x) => [x.id, x])), naikMap: new Map(r.naik.map((x) => [x.id, x])) }; })
      .catch((e) => { S.insight = { error: e.message, retensi: [], naik: [], retMap: new Map(), naikMap: new Map() }; })
      .finally(() => { insightJob = null; if (['performa', 'tren'].includes(route()) && !$('#overlay').innerHTML) render(); });
    return insightJob;
  }

  // Simple bars with an optional dashed reference line (e.g. 100% = same as the channel median).
  function drawBars(box, { labels, values, ref = 0, fmtV = fmt, label, tipLabels = labels }) {
    const W = Math.max(260, box.clientWidth), H = 190;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(label)}"></svg><div class="tip" hidden></div>`;
    const svg = $('svg', box), tip = $('.tip', box);
    const vals = values.map((v) => v || 0);
    const max = Math.max(ref, ...vals, 1);
    const step = niceStep(max * 1.1);
    const yMax = Math.ceil((max * 1.1) / step) * step;
    const ticks = []; for (let v = 0; v <= yMax + step / 2; v += step) ticks.push(v);
    const m = { t: 10, r: 6, b: 24, l: Math.max(...ticks.map((t) => measureText(svg, fmtV(t)))) + 10 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, bw = iw / labels.length;
    const y = (v) => m.t + ih - (v / yMax) * ih;
    let html = '';
    ticks.forEach((t) => { html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end">${fmtV(t)}</text>`; });
    const every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 52)));
    labels.forEach((l, i) => {
      const x = m.l + i * bw, w = Math.min(34, bw * 0.6), x0 = x + (bw - w) / 2;
      if (values[i] != null) html += `<rect x="${x0}" y="${y(vals[i])}" width="${w}" height="${Math.max(0, y(0) - y(vals[i]))}" rx="2" fill="${ref && vals[i] < ref ? 'var(--line-2)' : 'var(--leaf)'}"/>`;
      if ((labels.length - 1 - i) % every === 0) html += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`;
      html += `<rect class="hit" data-i="${i}" x="${x}" y="${m.t}" width="${bw}" height="${ih}" fill="transparent"/>`;
    });
    if (ref) html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(ref)}" y2="${y(ref)}" stroke="var(--muted)" stroke-dasharray="4 4"/>`;
    html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line-2)"/>`;
    svg.innerHTML = html;
    svg.addEventListener('mousemove', (ev) => {
      const r = ev.target.closest('.hit');
      if (!r) { tip.hidden = true; return; }
      const i = +r.dataset.i;
      tip.innerHTML = `<div class="h">${esc(tipLabels[i])}</div><div><b>${values[i] == null ? 'tidak ada video' : fmtV(values[i])}</b></div>`;
      tip.hidden = false;
      const bx = box.getBoundingClientRect();
      tip.style.left = Math.max(0, Math.min(bx.width - tip.offsetWidth, ev.clientX - bx.left + 12)) + 'px';
      tip.style.top = Math.max(0, ev.clientY - bx.top - tip.offsetHeight - 10) + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  }

  // A short, dismissible pointer to the guide for people new to the app.
  function sambutan() {
    try { if (localStorage.getItem('pt_sambutan') === 'tutup') return ''; } catch (e) { /* storage off: show it */ }
    return `<div class="notice tip-card" role="note"><span><b>Baru di Pantau Tokder?</b> Lihat langkah awal dan jawaban singkat di Panduan.</span>
      <a class="btn sm" href="/panduan">${icon('book')}Buka panduan</a><button class="btn sm ghost" data-act="tutup-sambutan">Tutup</button></div>`;
  }

  // ============ page: performa ============
  // How one person's videos do against the channel and the rest of the team, with advice from their own numbers.
  function perfPerson() {
    if (me()) return me();
    return editorById(S.perfEditor) || activeEditors()[0] || S.editors[0] || null;
  }

  function perfSaran(e, mine, others, st) {
    const out = [];
    const banding = me() ? 'video lain di channel' : 'rekan setim';
    const mature = mine.filter((c) => ratioOf(c) != null);
    const medOf = (l) => median(l.map(ratioOf).filter((r) => r != null));
    // Topics
    const topik = {};
    mature.forEach((c) => { (topik[c._topik] ||= []).push(c); });
    const tl = Object.entries(topik).filter(([t, l]) => l.length >= 2 && t !== 'Lainnya').map(([t, l]) => ({ t, l, r: medOf(l) }));
    const best = [...tl].sort((a, b) => b.r - a.r)[0], worst = [...tl].sort((a, b) => a.r - b.r)[0];
    if (best && best.r >= 1.2) out.push({ good: true, title: `Topik terkuat: ${esc(best.t)}`, why: `Median views video topik ini <b>${kali(best.r)}</b> median channel (${best.l.length} video).`, act: `Buat lagi dengan sudut berbeda. Contoh terbaik: “${esc(best.l.reduce((a, b) => (ratioOf(b) > ratioOf(a) ? b : a)).judul)}”.` });
    if (worst && worst !== best && worst.r <= 0.8) out.push({ title: `Topik ${esc(worst.t)} kurang ditonton`, why: `Median views <b>${kali(worst.r)}</b> median channel (${worst.l.length} video).`, act: 'Coba judul dan thumbnail yang lebih spesifik (angka, masalah nyata petani), atau kurangi topik ini.' });
    // Retention
    const [ra, oa] = [avgRet(mine, 'awal'), avgRet(others, 'awal')];
    if (ra && oa && ra.v < oa.v - 5) out.push({ title: 'Penonton cepat pergi di awal video', why: `Rata-rata yang masih menonton di 10% awal video: <b>${Math.round(ra.v)}%</b>, ${banding} ${Math.round(oa.v)}% (${ra.n} video dengan data retensi).`, act: 'Perkuat 3 detik pertama: langsung tunjukkan hasil atau masalahnya, tanpa pembuka atau logo yang panjang.' });
    else if (ra && oa && ra.v > oa.v + 5) out.push({ good: true, title: 'Pembuka video sudah kuat', why: `Masih menonton di 10% awal: <b>${Math.round(ra.v)}%</b>, ${banding} ${Math.round(oa.v)}%.`, act: 'Pertahankan gaya pembuka ini dan bagikan caranya ke tim.' });
    const [rt, ot] = [avgRet(mine, 'akhir'), avgRet(others, 'akhir')];
    if (rt && ot && rt.v < ot.v - 5) out.push({ title: 'Banyak yang berhenti sebelum akhir', why: `Masih menonton di akhir video: <b>${Math.round(rt.v)}%</b>, ${banding} ${Math.round(ot.v)}%.`, act: 'Pangkas bagian yang berulang, simpan satu informasi penting untuk akhir, dan untuk Shorts buat akhir yang menyambung ke awal supaya ditonton ulang.' });
    // Likes
    const [lm, lo] = [likeRate(mine), likeRate(others)];
    if (lm != null && lo != null && lm < lo * 0.8) out.push({ title: me() ? 'Like per views lebih rendah dari video lain' : 'Like per views lebih rendah dari rekan', why: `<b>${nf.format(Math.round(lm))}</b> like per 1.000 views, ${banding} ${nf.format(Math.round(lo))}.`, act: 'Ajak penonton menekan like atau menjawab pertanyaan di komentar, di tengah video, bukan hanya di akhir.' });
    // Format
    const sh = mature.filter((c) => c.tipe_video === 'short'), lg = mature.filter((c) => c.tipe_video !== 'short');
    if (sh.length >= 3 && lg.length >= 3) {
      const a = medOf(sh), b = medOf(lg);
      if (Math.max(a, b) / Math.max(0.01, Math.min(a, b)) >= 1.4) out.push({ good: true, title: `Lebih kuat di ${a > b ? 'Shorts' : 'video panjang'}`, why: `Dibanding median channel: Shorts <b>${kali(a)}</b> (${sh.length} video), video panjang <b>${kali(b)}</b> (${lg.length} video).`, act: `Ambil lebih banyak jatah ${a > b ? 'Shorts' : 'video panjang'} bila jadwal tim memungkinkan.` });
    }
    // Shorts length
    const dur = { 'di bawah 30 detik': [], '30–59 detik': [], '60 detik atau lebih': [] };
    sh.forEach((c) => { const d = +c.duration_secs || 0; dur[d < 30 ? 'di bawah 30 detik' : d < 60 ? '30–59 detik' : '60 detik atau lebih'].push(c); });
    const dl = Object.entries(dur).filter(([, l]) => l.length >= 3).map(([k, l]) => ({ k, n: l.length, r: medOf(l) })).sort((a, b) => b.r - a.r);
    if (dl.length >= 2 && dl[0].r / Math.max(0.01, dl[dl.length - 1].r) >= 1.3) out.push({ title: `Shorts ${dl[0].k} paling ditonton`, why: dl.map((x) => `${x.k} <b>${kali(x.r)}</b> (${x.n})`).join(' · ') + '.', act: `Arahkan durasi Shorts ke ${dl[0].k}.` });
    // Time of day
    const jam = {};
    mature.forEach((c) => { const h = Math.floor(+c._jam.slice(0, 2) / 3) * 3; (jam[h] ||= []).push(c); });
    const jl = Object.entries(jam).filter(([, l]) => l.length >= 3).map(([h, l]) => ({ h: +h, n: l.length, r: medOf(l) })).sort((a, b) => b.r - a.r);
    if (jl.length >= 2 && jl[0].r / Math.max(0.01, jl[jl.length - 1].r) >= 1.3) {
      const hh = (h) => String(h).padStart(2, '0') + ':00';
      out.push({ title: `Video yang tayang jam ${hh(jl[0].h)}–${hh(jl[0].h + 3)} paling ramai`, why: jl.map((x) => `${hh(x.h)} <b>${kali(x.r)}</b> (${x.n})`).join(' · ') + '.', act: 'Minta pemilik menggeser satu slot jadwal ke jam ini.' });
    }
    // Discipline
    if (st.target && st.n < st.target) out.push({ title: `Kurang ${nf.format(st.target - st.n)} video dari target`, why: `${nf.format(st.n)} dari ${nf.format(st.target)} video dalam ${S.perfPeriode} hari.`, act: 'Siapkan stok 2–3 video jadi supaya jadwal tetap terisi saat ada kendala.' });
    if (st.tepat != null && st.tepat < 0.85) out.push({ title: 'Sering lewat jadwal tayang', why: `Tepat jadwal <b>${pct(st.tepat)}</b>. Telat lebih dari ${TOL} menit dihitung telat.`, act: 'Pakai fitur jadwalkan di YouTube Studio untuk jam tayang yang ditentukan.' });
    return out.sort((a, b) => (a.good ? 1 : 0) - (b.good ? 1 : 0));
  }

  PAGES.performa = function () {
    const e = perfPerson();
    const n = S.perfPeriode;
    const tools = `<div class="tools">
      ${isAdmin() && S.editors.length ? `<select class="input" id="pf-editor" style="width:auto" aria-label="Karyawan">${S.editors.map((x) => `<option value="${x.id}" ${e && x.id === e.id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select>` : ''}
      <div class="seg" role="group" aria-label="Periode">${[7, 30, 90].map((d) => `<button data-act="pf-periode" data-v="${d}" aria-pressed="${n === d}">${d} hari</button>`).join('')}</div>
      ${bantuan('performa')}</div>`;
    if (!e) return `<header class="head"><div><h1>Performa video</h1><p>Belum ada karyawan.</p></div>${tools}</header>`;
    const from = addDays(today(), -n + 1);
    const mine = S.content.filter((c) => c.editor_id === e.id && c._day >= from);
    // Owner: the rest of the team. Employee: every other video on the channels (makers not shown).
    const others = S.content.filter((c) => c.editor_id !== e.id && c._day >= from && (me() ? true : c.editor_id && editorById(c.editor_id)));
    const st = periodStats(e, daysBack(n));
    const rM = median(mine.map(ratioOf).filter((r) => r != null)), rO = median(others.map(ratioOf).filter((r) => r != null));
    const tM = avgRet(mine, 'tengah'), tO = avgRet(others, 'tengah');
    const lM = likeRate(mine), lO = likeRate(others);
    const cmp = (a, b, f) => (a == null || b == null ? '' : `<span class="d ${a >= b ? 'ok' : 'bad'}">${me() ? 'video lain' : 'rekan setim'} ${f(b)}</span>`);
    const saran = perfSaran(e, mine, others, st);
    const ranked = mine.filter((c) => ratioOf(c) != null).sort((a, b) => ratioOf(b) - ratioOf(a));
    const loadingRet = !S.insight;
    if (loadingRet) loadInsight();
    const row = (c) => { const r = ratioOf(c), t = retOf(c); return `<tr class="click" data-act="video" data-id="${c.id}"><td class="full">${vidCell(c)}</td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td><td class="num" data-label="Dibanding median">${r == null ? '<span class="muted">baru</span>' : `<span class="pill ${r >= 1.2 ? 'ok' : r < 0.8 ? 'bad' : ''}">${kali(r)}</span>`}</td><td class="num" data-label="Like / 1.000">${c.views >= 100 ? nf.format(Math.round((c.likes / c.views) * 1000)) : '—'}</td><td class="num" data-label="Retensi tengah">${t ? t.tengah + '%' : '—'}</td></tr>`; };
    const thead = '<thead><tr><th>Video</th><th>Tayang</th><th class="num">Views</th><th class="num">Dibanding median</th><th class="num">Like / 1.000</th><th class="num">Retensi tengah</th></tr></thead>';
    return `
      <header class="head">
        <div><h1>${me() ? 'Performa saya' : 'Performa ' + esc(e.nama)}</h1><p>${n} hari terakhir: <b>${nf.format(mine.length)}</b> video${mine.length ? `, median views <b>${kali(rM)}</b> median channel` : ''}. 1× berarti sama dengan video biasa di channel dan jenis yang sama; di atas 1× berarti lebih ramai.</p></div>
        ${tools}
      </header>
      <section class="kpis">
        <div class="kpi"><span class="l">Video tayang</span><span class="v">${nf.format(st.n)}${st.target ? ` <small>/ ${nf.format(st.target)}</small>` : ''}</span><span class="d">target dari jadwal harian</span></div>
        <div class="kpi"><span class="l">Views dibanding median</span><span class="v ${rM == null ? '' : rM >= 1 ? 'ok' : 'bad'}">${kali(rM)}</span>${cmp(rM, rO, kali) || '<span class="d">video berumur ≥ 2 hari</span>'}</div>
        <div class="kpi"><span class="l">Masih menonton di tengah</span><span class="v">${tM ? Math.round(tM.v) + '%' : loadingRet ? '…' : '—'}</span>${cmp(tM && tM.v, tO && tO.v, (v) => Math.round(v) + '%') || `<span class="d">${tM ? tM.n + ' video dengan retensi' : 'butuh ≥ 3 video dengan retensi'}</span>`}</div>
        <div class="kpi"><span class="l">Like per 1.000 views</span><span class="v">${lM == null ? '—' : nf.format(Math.round(lM))}</span>${cmp(lM, lO, (v) => nf.format(Math.round(v))) || '<span class="d">butuh ≥ 300 views</span>'}</div>
        <div class="kpi"><span class="l">Tepat jadwal</span><span class="v ${st.tepat == null ? '' : st.tepat >= 0.85 ? 'ok' : 'bad'}">${pct(st.tepat)}</span><span class="d">skor rata-rata ${st.skor ?? '—'}</span></div>
      </section>
      <section class="card" id="kartu-saran">
        <div class="card-h"><h2>Yang bisa ditingkatkan</h2><p>Dihitung dari video ${me() ? 'Anda' : esc(e.nama)} sendiri dibanding ${me() ? 'video lain di channel yang sama' : 'channel dan rekan setim'}. Saran hanya muncul bila datanya cukup.</p></div>
        ${saran.length ? `<ol class="advice">${saran.map((x) => `<li><div class="t"><b>${x.good ? '<span class="pill ok">Sudah bagus</span> ' : ''}${x.title}</b><div class="why">${x.why}</div><div class="act">${icon('bulb')}<span>${x.act}</span></div></div></li>`).join('')}</ol>`
          : `<div class="empty"><b>Belum cukup data untuk saran</b>Butuh beberapa video berumur 2 hari atau lebih${S.insight && S.insight.error ? '. Data retensi gagal dimuat: ' + esc(S.insight.error) : ''}.</div>`}
      </section>
      <section class="card" id="kartu-tren-orang">
        <div class="card-h"><h2>Perkembangan 8 minggu</h2><p>Median views video tiap minggu dibanding video lain yang tayang di minggu yang sama (100% = sama). Garis putus-putus: 100%.</p></div>
        <div class="chart" id="pf-chart" style="min-height:190px"></div>
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Paling berhasil</h2><p>Pelajari judul, thumbnail dan pembukanya.</p></div>
          ${ranked.length ? `<div class="table-wrap"><table class="t stack">${thead}<tbody>${ranked.slice(0, 3).map(row).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada video berumur 2 hari</b></div>'}</section>
        <section class="card"><div class="card-h"><h2>Paling kurang</h2><p>Cari bedanya dengan yang berhasil.</p></div>
          ${ranked.length >= 4 ? `<div class="table-wrap"><table class="t stack">${thead}<tbody>${ranked.slice(-3).reverse().map(row).join('')}</tbody></table></div>` : '<div class="empty"><b>Butuh minimal 4 video berumur 2 hari</b></div>'}</section>
      </div>
      <section class="card"><div class="card-h"><h2>Video ${n} hari terakhir</h2><p>${loadingRet ? 'Memuat data retensi…' : 'Retensi tengah: persen penonton yang masih menonton di pertengahan video (YouTube Analytics).'}</p></div>
        ${mine.length ? `<div class="table-wrap"><table class="t stack">${thead}<tbody>${[...mine].sort((a, b) => b.tanggal_upload.localeCompare(a.tanggal_upload)).slice(0, 20).map(row).join('')}</tbody></table></div>${mine.length > 20 ? `<p class="muted" style="font-size:12.5px;margin:10px 0 0">Menampilkan 20 video terbaru dari ${nf.format(mine.length)}. <a href="/konten" data-act="konten-orang" data-id="${e.id}">Lihat semua di Konten</a>.</p>` : ''}` : '<div class="empty"><b>Belum ada video di periode ini</b>Video dikenali dari kode #' + esc(e.kode_identifikasi) + ' di deskripsi.</div>'}
      </section>`;
  };
  AFTER.performa = () => {
    const sel = $('#pf-editor');
    if (sel) sel.addEventListener('change', () => { S.perfEditor = +sel.value; render(); });
    const e = perfPerson(), box = $('#pf-chart');
    if (!e || !box) return;
    const weeks = Array.from({ length: 8 }, (_, i) => { const end = addDays(today(), -7 * (7 - i)); return { from: addDays(end, -6), end }; });
    const values = weeks.map((w) => {
      const all = S.content.filter((c) => c._day >= w.from && c._day <= w.end && c._age >= 2);
      const r = peerRatios(all);
      const mineR = all.filter((c) => c.editor_id === e.id).map((c) => r.get(c.id)).filter((x) => x != null);
      return mineR.length ? Math.round(median(mineR) * 100) : null;
    });
    drawBars(box, { labels: weeks.map((w) => tglPendek(w.from)), tipLabels: weeks.map((w) => tglPendek(w.from) + ' – ' + tglPendek(w.end)), values, ref: 100, fmtV: (v) => nf.format(Math.round(v)) + '%', label: 'Perkembangan views mingguan' });
  };

  // ============ page: tren ============
  const STOP = new Set('yang dan untuk dengan dari agar supaya biar bisa tidak jangan paling sangat lebih sudah belum akan pada dalam atau juga saat kalau jika tanpa buat ini itu nya kok loh lah dong aja saja banget gini begini cara tips hari video shorts short part episode terbaru viral sekarang kita kamu anda mereka harus semua banyak sampai cuma setelah sebelum bikin'.split(' '));
  const kataOf = (t) => [...new Set(String(t || '').toLowerCase().replace(/#[\p{L}\d_]+/gu, ' ').match(/\p{L}{4,}/gu) || [])].filter((w) => !STOP.has(w));

  PAGES.tren = function () {
    const ch = S.trenCh;
    const ids = ch === 'all' ? S.channels.map((c) => c.id) : [ch];
    const inCh = (c) => ids.includes(c._ch);
    const daily = S.daily.filter((d) => ids.includes(d.channel_id));
    const latest = daily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
    const w1 = latest ? daysBack(7, latest) : [], w0 = latest ? daysBack(7, addDays(w1[0], -1)) : [];
    const tot = (ds, f) => sum(daily.filter((d) => ds.includes(d.tanggal)), f);
    const pctChange = (a, b) => (b ? Math.round(((a - b) / Math.abs(b)) * 100) : null);
    const delta = (a, b) => { const x = pctChange(a, b); return x == null ? '<span class="d">belum ada pembanding</span>' : `<span class="d ${x >= 0 ? 'ok' : 'bad'}">${signed(x, (v) => nf.format(v) + '%')} dari 7 hari sebelumnya</span>`; };
    const vNow = tot(w1, (d) => d.views), vPrev = tot(w0, (d) => d.views);
    const mNow = tot(w1, (d) => d.menit_tonton), mPrev = tot(w0, (d) => d.menit_tonton);
    const sNow = tot(w1, (d) => d.sub_naik - d.sub_turun), sPrev = tot(w0, (d) => d.sub_naik - d.sub_turun);
    const vids = S.content.filter(inCh);
    const upNow = vids.filter((c) => c._age < 7).length, upPrev = vids.filter((c) => c._age >= 7 && c._age < 14).length;

    // Rising right now, from sync snapshots (views gained, scaled to 24 hours)
    if (!S.insight) loadInsight();
    const naik = S.insight && !S.insight.error ? vids.map((c) => { const x = S.insight.naikMap.get(c.id); const h = x && x.hari; return h && h.jam >= 12 && h.jam <= 72 && h.naik > 0 ? { c, per: (h.naik * 24) / h.jam } : null; }).filter(Boolean).sort((a, b) => b.per - a.per) : [];
    const baru = naik.filter((x) => x.c._age <= 14).slice(0, 6), lama = naik.filter((x) => x.c._age > 30).slice(0, 5);

    // Topics and title words: the last 14 days against the 15–60 days before, each against its own window
    const win = (a, b) => vids.filter((c) => c._age >= a && c._age < b);
    const recent = win(2, 16), base = win(16, 60);
    const rR = peerRatios(recent), rB = peerRatios(base);
    const group = (list, key) => { const g = {}; list.forEach((c) => key(c).forEach((k) => { (g[k] ||= []).push(c); })); return g; };
    const gR = group(recent, (c) => [c._topik]), gB = group(base, (c) => [c._topik]);
    const topik = Object.keys(gR).filter((t) => gR[t].length >= 2).map((t) => ({ t, n: gR[t].length, r: median(gR[t].map((c) => rR.get(c.id)).filter((x) => x != null)), b: gB[t] && gB[t].length >= 2 ? median(gB[t].map((c) => rB.get(c.id)).filter((x) => x != null)) : null, best: gR[t].reduce((a, b) => (b.views > a.views ? b : a)) })).sort((a, b) => b.r - a.r);
    const last30 = win(2, 32), r30 = peerRatios(last30);
    const gK = group(last30, (c) => kataOf(c.judul));
    const kata = Object.entries(gK).filter(([, l]) => l.length >= 3 && l.length <= last30.length * 0.6).map(([k, l]) => ({ k, n: l.length, r: median(l.map((c) => r30.get(c.id)).filter((x) => x != null)) })).sort((a, b) => b.r - a.r);
    const kuat = kata.filter((x) => x.r >= 1.15).slice(0, 8), lemah = kata.filter((x) => x.r <= 0.85).slice(-4).reverse();
    const fmtNaik = (x) => `<tr class="click" data-act="video" data-id="${x.c.id}"><td class="full">${vidCell(x.c)}</td>${me() ? '' : `<td data-label="Pembuat">${editorCell(x.c)}</td>`}<td class="mono" data-label="Tayang">${tglPendek(x.c._day)}</td><td class="num" data-label="Naik / 24 jam"><b>+${fmt(x.per)}</b></td><td class="num" data-label="Total views">${fmt(x.c.views)}</td></tr>`;
    const naikHead = '<thead><tr><th>Video</th>' + (me() ? '' : '<th>Pembuat</th>') + '<th>Tayang</th><th class="num">Naik / 24 jam</th><th class="num">Total views</th></tr></thead>';
    const naikEmpty = !S.insight ? '<div class="skeleton" style="height:120px"></div>' : S.insight.error ? `<div class="empty"><b>Belum bisa dimuat</b>${esc(S.insight.error)}</div>` : '<div class="empty"><b>Belum ada catatan kenaikan</b>Kenaikan dihitung dari dua sinkronisasi yang berjarak 12–72 jam. Data muncul setelah aplikasi dibuka atau sinkron otomatis berjalan di dua hari berbeda.</div>';
    return `
      <header class="head">
        <div><h1>Tren channel</h1><p>${latest ? `Angka YouTube Analytics sampai ${tglPanjang(latest)} (YouTube terlambat 2–3 hari). ` : 'Belum ada angka YouTube Analytics. '}Video yang sedang naik dihitung dari sinkronisasi terbaru.</p></div>
        <div class="tools"><select class="input" id="tr-ch" style="width:auto" aria-label="Channel"><option value="all">Semua channel</option>${S.channels.map((c) => `<option value="${esc(c.id)}" ${ch === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>${bantuan('tren')}</div>
      </header>
      <section class="kpis" aria-label="7 hari terakhir">
        <div class="kpi"><span class="l">Views 7 hari</span><span class="v">${latest ? fmt(vNow) : '—'}</span>${latest ? delta(vNow, vPrev) : '<span class="d">hubungkan YouTube Analytics</span>'}</div>
        <div class="kpi"><span class="l">Jam tonton 7 hari</span><span class="v">${latest ? jamMenit(mNow) : '—'}</span>${latest ? delta(mNow, mPrev) : ''}</div>
        <div class="kpi"><span class="l">Subscriber bersih 7 hari</span><span class="v ${sNow < 0 ? 'bad' : ''}">${latest ? signed(sNow) : '—'}</span>${latest ? `<span class="d">7 hari sebelumnya ${signed(sPrev)}</span>` : ''}</div>
        <div class="kpi"><span class="l">Video baru 7 hari</span><span class="v">${nf.format(upNow)}</span><span class="d ${upNow >= upPrev ? 'ok' : 'bad'}">${signed(upNow - upPrev)} dari minggu sebelumnya</span></div>
      </section>
      <section class="card" id="kartu-tren-views">
        <div class="card-h"><h2>Views harian 28 hari</h2><p>Semua video di channel, termasuk video lama.</p></div>
        <div class="chart-legend">${ids.map((id) => `<span><i style="background:${chColor(id)}"></i>${esc(chName(id))}</span>`).join('')}</div>
        ${latest ? '<div class="chart" id="tr-chart" style="min-height:230px"></div>' : '<div class="empty"><b>Belum ada angka dari YouTube Analytics</b>Hubungkan channel di Pengaturan.</div>'}
      </section>
      <section class="card" id="kartu-naik">
        <div class="card-h"><h2>Sedang naik sekarang</h2><p>Video 14 hari terakhir dengan tambahan views terbanyak, disetarakan per 24 jam.</p></div>
        ${baru.length ? `<div class="table-wrap"><table class="t stack">${naikHead}<tbody>${baru.map(fmtNaik).join('')}</tbody></table></div>` : naikEmpty}
      </section>
      <div class="grid-2">
        <section class="card" id="kartu-topik-naik">
          <div class="card-h"><h2>Topik 14 hari terakhir</h2><p>Views dibanding video lain di periode yang sama, lalu dibanding 15–60 hari sebelumnya. Topik ditebak dari kata di judul.</p></div>
          ${topik.length ? `<div class="topics"><div class="topic-ch">${topik.slice(0, 6).map((x) => { const up = x.b == null ? null : x.r - x.b; const cls = x.r >= 1.2 ? 'ok' : x.r < 0.8 ? 'bad' : ''; return `<div class="topic"><b>${esc(x.t)}</b><span class="x ${cls}">${kali(x.r)} <span class="pill ${up == null ? '' : up >= 0.25 ? 'ok' : up <= -0.25 ? 'bad' : ''}">${up == null ? 'baru' : up >= 0.25 ? 'naik' : up <= -0.25 ? 'turun' : 'stabil'}</span></span><span class="ex">${x.n} video${x.b != null ? ' · sebelumnya ' + kali(x.b) : ''} · terbaik: ${esc(x.best.judul)}</span></div>`; }).join('')}</div></div>` : '<div class="empty"><b>Belum cukup video</b>Butuh minimal 2 video per topik yang berumur 2–16 hari.</div>'}
        </section>
        <section class="card" id="kartu-kata">
          <div class="card-h"><h2>Kata di judul yang laris</h2><p>Kata yang muncul di 3 video atau lebih dalam 30 hari, dengan median views dibanding video lain.</p></div>
          ${kuat.length || lemah.length ? `<div class="kata">${kuat.map((x) => `<span class="pill ok" title="${x.n} video">${esc(x.k)} ${kali(x.r)}</span>`).join('')}${lemah.map((x) => `<span class="pill bad" title="${x.n} video">${esc(x.k)} ${kali(x.r)}</span>`).join('')}</div><p class="muted" style="font-size:12.5px;margin:10px 0 0">Hijau: judul dengan kata ini lebih ramai. Merah: lebih sepi. Angka di samping kata: median views dibanding video lain.</p>` : '<div class="empty"><b>Belum ada pola yang jelas</b>Butuh lebih banyak video dalam 30 hari terakhir.</div>'}
        </section>
      </div>
      <section class="card" id="kartu-hidup-lagi">
        <div class="card-h"><h2>Video lama yang hidup lagi</h2><p>Video berumur lebih dari 30 hari yang masih bertambah views. Bahan untuk video lanjutan atau versi terbaru.</p></div>
        ${lama.length ? `<div class="table-wrap"><table class="t stack">${naikHead}<tbody>${lama.map(fmtNaik).join('')}</tbody></table></div>` : (S.insight && !S.insight.error ? '<div class="empty"><b>Belum ada video lama yang naik</b>Atau belum ada dua sinkronisasi yang berjarak 12–72 jam.</div>' : naikEmpty)}
      </section>`;
  };
  AFTER.tren = () => {
    const sel = $('#tr-ch');
    if (sel) sel.addEventListener('change', () => { S.trenCh = sel.value; render(); });
    const box = $('#tr-chart');
    if (!box) return;
    const ids = S.trenCh === 'all' ? S.channels.map((c) => c.id) : [S.trenCh];
    const latest = S.daily.filter((d) => ids.includes(d.channel_id)).reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
    const days = daysBack(28, latest);
    const val = (id, d) => (S.daily.find((x) => x.channel_id === id && x.tanggal === d) || {}).views || 0;
    drawStacked(box, { days, series: ids.map((id) => ({ name: chName(id), color: chColor(id), values: days.map((d) => val(id, d)) })), label: 'Views harian 28 hari' });
  };

  // ============ page: izin & klaim ============
  const JENIS = { izin: 'Izin', sakit: 'Sakit', cuti: 'Cuti', klaim: 'Klaim biaya' };
  const statusPill = (s) => `<span class="pill ${s === 'disetujui' ? 'ok' : s === 'ditolak' ? 'bad' : 'warn'}">${s === 'menunggu' ? 'Menunggu' : s === 'disetujui' ? 'Disetujui' : 'Ditolak'}</span>`;
  const rentangTgl = (p) => (p.jenis === 'klaim' || p.dari === p.sampai ? tglPanjang(p.dari) : tglPendek(p.dari) + ' – ' + tglPanjang(p.sampai));

  function pengajuanRow(p, owner) {
    const e = editorById(p.editor_id);
    const aksi = owner && p.status === 'menunggu'
      ? `<button class="btn sm primary" data-act="putuskan" data-id="${p.id}" data-v="disetujui">Setujui</button><button class="btn sm ghost danger" data-act="putuskan" data-id="${p.id}" data-v="ditolak">Tolak</button>`
      : !owner && p.status === 'menunggu' ? `<button class="btn sm ghost" data-act="batal-pengajuan" data-id="${p.id}">Batalkan</button>` : '';
    return `<tr>${owner ? `<td data-label="Karyawan"><span class="ed">${avatar(e, 'xs')}${esc(e ? e.nama : '—')}</span></td>` : ''}
      <td data-label="Jenis"><b>${JENIS[p.jenis] || esc(p.jenis)}</b></td>
      <td data-label="Tanggal">${rentangTgl(p)}</td>
      <td class="full">${esc(p.alasan)}${p.jumlah ? ` · <b>${idr(p.jumlah)}</b>` : ''}${p.catatan ? `<div class="muted" style="font-size:12.5px">Catatan pemilik: ${esc(p.catatan)}</div>` : ''}</td>
      <td data-label="Status">${statusPill(p.status)}</td>
      <td class="full"><div class="row-actions">${aksi}</div></td></tr>`;
  }

  PAGES.pengajuan = function () {
    const P = S.pengajuan;
    const head = (p, tools = '') => `<header class="head"><div><h1>Izin & klaim</h1><p>${p}</p></div><div class="tools">${tools}${bantuan('pengajuan')}</div></header>`;
    if (!P) return head('Data izin dan klaim belum termuat.', '<button class="btn" data-act="retry">Coba lagi</button>');
    const owner = isAdmin();
    const th = `<thead><tr>${owner ? '<th>Karyawan</th>' : ''}<th>Jenis</th><th>Tanggal</th><th>Keterangan</th><th>Status</th><th></th></tr></thead>`;
    if (!owner) {
      const who = me();
      if (!who) return head('Masuk sebagai karyawan untuk mengajukan izin atau klaim.');
      const c = P.cuti[who.id] || { jatah: 0, terpakai: 0 };
      const wait = P.list.filter((p) => p.status === 'menunggu').length;
      return head(`Ajukan izin, sakit, cuti atau klaim biaya. Pemilik akan menyetujui atau menolak; yang disetujui otomatis masuk ke perhitungan gaji.`,
        `<button class="btn primary" data-act="ajukan" data-v="izin">${icon('plus')}Ajukan izin / cuti</button><button class="btn" data-act="ajukan" data-v="klaim">${icon('plus')}Klaim biaya</button>`) + `
        <section class="kpis">
          <div class="kpi"><span class="l">Sisa cuti ${today().slice(0, 4)}</span><span class="v">${Math.max(0, c.jatah - c.terpakai)} <small>/ ${c.jatah} hari</small></span><span class="d">${c.terpakai} hari kerja terpakai</span></div>
          <div class="kpi"><span class="l">Menunggu keputusan</span><span class="v">${wait}</span><span class="d">pengajuan</span></div>
          <div class="kpi"><span class="l">Klaim disetujui bulan ini</span><span class="v">${idr(sum(P.list.filter((p) => p.jenis === 'klaim' && p.status === 'disetujui' && p.dari.slice(0, 7) === today().slice(0, 7)), (p) => p.jumlah))}</span><span class="d">dibayar bersama gaji</span></div>
        </section>
        <section class="card"><div class="card-h"><h2>Pengajuan saya</h2><p>120 hari terakhir.</p></div>
          ${P.list.length ? `<div class="table-wrap"><table class="t stack">${th}<tbody>${P.list.map((p) => pengajuanRow(p, false)).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada pengajuan</b>Klik Ajukan izin / cuti atau Klaim biaya.</div>'}
        </section>
        ${notifCard()}`;
    }
    const wait = P.list.filter((p) => p.status === 'menunggu');
    const done = P.list.filter((p) => p.status !== 'menunggu');
    return head(wait.length ? `<b>${wait.length}</b> pengajuan menunggu keputusan Anda.` : 'Tidak ada pengajuan yang menunggu.') + `
      <section class="card ${wait.length ? 'attn' : ''}"><div class="card-h"><h2>Menunggu keputusan</h2><p>Izin, sakit dan cuti yang disetujui tidak dihitung tidak hadir. Klaim yang disetujui ditambahkan ke gaji bulan tanggal klaimnya.</p></div>
        ${wait.length ? `<div class="table-wrap"><table class="t stack">${th}<tbody>${wait.map((p) => pengajuanRow(p, true)).join('')}</tbody></table></div>` : '<div class="empty"><b>Semua sudah diputuskan</b></div>'}
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Sisa cuti ${today().slice(0, 4)}</h2><p>Jatah per tahun diatur di Gaji → Atur gaji.</p></div>
          <div class="rank">${activeEditors().map((e) => { const c = P.cuti[e.id] || { jatah: 0, terpakai: 0 }; return `<div class="rank-row">${avatar(e, 'sm')}<div class="tx"><b>${esc(e.nama)}</b><div>${c.terpakai} dari ${c.jatah} hari terpakai</div><div class="bar"><i style="width:${c.jatah ? Math.min(100, (c.terpakai / c.jatah) * 100) : 0}%;background:${e._color}"></i></div></div><b>${Math.max(0, c.jatah - c.terpakai)} hari</b></div>`; }).join('') || '<div class="empty">Belum ada karyawan aktif.</div>'}</div></section>
        <section class="card"><div class="card-h"><h2>Bulan ini</h2></div>
          <dl class="kv">${['izin', 'sakit', 'cuti'].map((j) => `<dt>${JENIS[j]}</dt><dd>${done.filter((p) => p.jenis === j && p.status === 'disetujui' && (p.dari.slice(0, 7) === today().slice(0, 7) || p.sampai.slice(0, 7) === today().slice(0, 7))).length} disetujui</dd>`).join('')}
            <dt>Klaim</dt><dd>${idr(sum(done.filter((p) => p.jenis === 'klaim' && p.status === 'disetujui' && p.dari.slice(0, 7) === today().slice(0, 7)), (p) => p.jumlah))} disetujui</dd></dl></section>
      </div>
      <section class="card"><div class="card-h"><h2>Riwayat</h2><p>120 hari terakhir.</p></div>
        ${done.length ? `<div class="table-wrap"><table class="t stack">${th}<tbody>${done.map((p) => pengajuanRow(p, true)).join('')}</tbody></table></div>` : '<div class="empty"><b>Belum ada riwayat</b></div>'}
      </section>
      ${notifCard()}`;
  };

  function ajukanDialog(jenis) {
    const klaim = jenis === 'klaim';
    openDialog(`<h2>${klaim ? 'Klaim biaya' : 'Ajukan izin, sakit atau cuti'}</h2>
      <form id="aj-form" style="display:flex;flex-direction:column;gap:12px">
        ${klaim ? '<input type="hidden" name="jenis" value="klaim">' : `<label class="field"><span>Jenis</span><select class="input" name="jenis"><option value="izin">Izin (keperluan pribadi)</option><option value="sakit">Sakit</option><option value="cuti">Cuti (memakai jatah tahunan)</option></select></label>`}
        <div class="row">
          <label class="field"><span>${klaim ? 'Tanggal pengeluaran' : 'Dari tanggal'}</span><input class="input" type="date" name="dari" value="${today()}" ${klaim ? `max="${today()}"` : ''} required></label>
          ${klaim ? `<label class="field"><span>Jumlah (Rp)</span><input class="input" type="number" name="jumlah" min="1000" step="500" required placeholder="50000"></label>` : `<label class="field"><span>Sampai tanggal</span><input class="input" type="date" name="sampai" value="${today()}" required></label>`}
        </div>
        ${klaim ? '' : '<p class="muted" id="aj-hari" style="margin:0;font-size:13px"></p>'}
        <label class="field"><span>${klaim ? 'Untuk apa' : 'Alasan'}</span><textarea class="input" name="alasan" maxlength="300" required placeholder="${klaim ? 'Misal: beli pupuk untuk video uji kocor, nota disimpan' : 'Misal: kontrol ke dokter'}"></textarea>${klaim ? '<small>Simpan nota; pemilik bisa memintanya sebelum menyetujui.</small>' : ''}</label>
        <div class="err" id="aj-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Kirim</button></div>
      </form>`, (d) => {
      const f = $('#aj-form', d), info = $('#aj-hari', d);
      const hitungHari = () => {
        if (!info) return;
        if (!f.dari.value || !f.sampai.value || f.sampai.value < f.dari.value) { info.textContent = ''; return; }
        let n = 0; for (let x = f.dari.value; x <= f.sampai.value && n < 400; x = addDays(x, 1)) if (jamKerja(x)) n++;
        info.textContent = `${n} hari kerja.`;
      };
      if (info) { f.dari.addEventListener('change', () => { if (f.sampai.value < f.dari.value) f.sampai.value = f.dari.value; hitungHari(); }); f.sampai.addEventListener('change', hitungHari); hitungHari(); }
      f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const body = Object.fromEntries(new FormData(f));
        if (body.jumlah) body.jumlah = +body.jumlah;
        const btn = $('button.primary', f); btn.disabled = true;
        try { await api('/api/pengajuan', { method: 'POST', body }); closeOverlay(); toast('Pengajuan terkirim, menunggu keputusan pemilik'); await muatUlang(); } catch (e) { $('#aj-err', d).textContent = e.message; btn.disabled = false; }
      });
    });
  }

  function putuskanDialog(id, status) {
    const p = S.pengajuan.list.find((x) => x.id === +id);
    if (!p) return;
    const e = editorById(p.editor_id);
    openDialog(`<h2>${status === 'disetujui' ? 'Setujui' : 'Tolak'} ${JENIS[p.jenis].toLowerCase()} ${esc(e ? e.nama : '')}?</h2>
      <p>${rentangTgl(p)} · ${esc(p.alasan)}${p.jumlah ? ' · <b>' + idr(p.jumlah) + '</b>' : ''}</p>
      <form id="pt-form" style="display:flex;flex-direction:column;gap:12px">
        <label class="field"><span>Catatan untuk karyawan (opsional)</span><input class="input" name="catatan" maxlength="200"></label>
        <div class="err" id="pt-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">${status === 'disetujui' ? 'Setujui' : 'Tolak'}</button></div>
      </form>`, (d) => {
      $('#pt-form', d).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const btn = $('button.primary', d); btn.disabled = true;
        try { await api('/api/pengajuan/' + p.id, { method: 'PUT', body: { status, catatan: ev.target.catatan.value } }); closeOverlay(); toast(status === 'disetujui' ? 'Disetujui' : 'Ditolak'); await muatUlang(); } catch (err) { $('#pt-err', d).textContent = err.message; btn.disabled = false; }
      });
    });
  }

  // After a change that moves pay or leave: everything again in one request, plus the month on screen.
  async function muatUlang() {
    try {
      await fetchAll();
      if (S.gajiBulan && !S.gajiCache[S.gajiBulan]) await loadGaji(S.gajiBulan).catch(() => {});
    } catch (e) { toast(e.message, true); }
    if (!$('#overlay').innerHTML) render(); else renderNav();
  }

  // ============ page: gaji ============
  const ATURAN = [
    ['gaji_pokok', 'Gaji pokok per bulan'], ['tunjangan', 'Tunjangan tetap per bulan'], ['potongan_tetap', 'Potongan tetap per bulan', 'BPJS, cicilan kasbon, dll.'],
    ['potong_alpa', 'Potongan per hari tidak hadir', 'Hari kerja tanpa absen dan tanpa izin/sakit/cuti yang disetujui'], ['potong_izin', 'Potongan per hari izin', 'Isi 0 bila izin tidak dipotong. Sakit dan cuti tidak pernah dipotong.'],
    ['potong_telat', 'Potongan per kali telat', 'Telat = absen masuk lewat jam masuk + toleransi'], ['tarif_lembur', 'Upah lembur per jam', 'Dihitung dari absen pulang ≥ 30 menit setelah jam pulang'],
    ['bonus_video', 'Bonus per video di atas target'], ['bonus_1000_views', 'Bonus per 1.000 views', 'Views video yang tayang di bulan itu'],
  ];
  const HARI_PDK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  async function loadGaji(bulan) { const r = await api('/api/gaji?bulan=' + bulan); S.gajiCache[bulan] = r; return r; }
  const gajiStatus = (r) => (r.dibayar_at ? '<span class="pill leaf">Dibayar</span>' : r.status === 'final' ? '<span class="pill ok">Final</span>' : '<span class="pill warn">Perkiraan</span>');

  function slipHtml(r, { aksi = false } = {}) {
    const h = r.hari;
    const owner = isAdmin();
    const draf = r.status !== 'final';
    return `<div class="slip">
      <div class="slip-h"><div><b>Slip gaji ${esc(r.nama)}</b><div class="muted">${bulanLabel(r.bulan)} · dihitung ${tglPendek(r.periode.dari)} – ${tglPendek(r.periode.sampai)}${r.periode.selesai ? '' : ' (bulan masih berjalan)'}</div></div>${gajiStatus(r)}</div>
      ${!r.presensi_dipakai ? '<p class="muted" style="font-size:12.5px;margin:0">Presensi belum dipakai di periode ini, jadi ketidakhadiran tidak dihitung.</p>' : ''}
      <dl class="kv">
        <dt>Hari kerja</dt><dd>${h.kerja} hari: hadir ${h.hadir}${h.izin ? ', izin ' + h.izin : ''}${h.sakit ? ', sakit ' + h.sakit : ''}${h.cuti ? ', cuti ' + h.cuti : ''}${h.alpa ? `, <b class="bad">tidak hadir ${h.alpa}</b>` : ''}</dd>
        ${h.alpa ? `<dt>Tidak hadir</dt><dd>${h.alpa_tanggal.map(tglPendek).join(', ')}</dd>` : ''}
        <dt>Telat</dt><dd>${h.telat} kali${h.telat ? ', total ' + h.telat_menit + ' menit' : ''}</dd>
        <dt>Lembur</dt><dd>${Math.floor(h.lembur_menit / 60)} jam ${h.lembur_menit % 60} menit</dd>
        <dt>Video</dt><dd>${r.video.jumlah} dari target ${r.video.target} · ${fmt(r.video.views)} views</dd>
      </dl>
      <div class="table-wrap"><table class="t slip-t"><tbody>
        ${r.baris.map((b) => `<tr><td><b>${esc(b.label)}</b>${b.ket ? `<div class="muted" style="font-size:12px">${esc(b.ket)}</div>` : ''}</td><td class="num ${b.jumlah < 0 ? 'bad' : ''}">${idr(b.jumlah)}</td></tr>`).join('')}
        <tr class="tot"><td><b>Total diterima</b>${r.minus ? '<div class="muted" style="font-size:12px">Potongan melebihi pendapatan; total dibulatkan ke Rp0.</div>' : ''}</td><td class="num"><b>${idr(r.total)}</b></td></tr>
      </tbody></table></div>
      ${!r.aturan_diisi ? `<p class="muted" style="font-size:12.5px;margin:0">Aturan gaji ${esc(r.nama)} belum diisi${owner ? ': klik Atur gaji.' : '. Pemilik belum mengaturnya.'}</p>` : ''}
      ${r.status === 'final' ? `<p class="muted" style="font-size:12.5px;margin:0">Final ${new Date(r.final_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${r.dibayar_at ? ' · dibayar ' + new Date(r.dibayar_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : ''}. Angka tidak berubah lagi.</p>` : '<p class="muted" style="font-size:12.5px;margin:0">Perkiraan: angka masih bisa berubah sampai pemilik memfinalkan bulan ini.</p>'}
      ${aksi && owner && draf ? `<div class="slip-adj"><b>Penyesuaian</b>${(r.penyesuaian || []).map((p) => `<div class="adj"><span>${esc(p.keterangan)}</span><span class="num ${p.jumlah < 0 ? 'bad' : ''}">${idr(p.jumlah)}</span><button class="btn sm ghost" data-act="hapus-penyesuaian" data-id="${p.id}" aria-label="Hapus penyesuaian">${icon('x')}</button></div>`).join('') || '<div class="muted" style="font-size:13px">Belum ada.</div>'}
        <form id="adj-form" class="row" style="align-items:end"><label class="field"><span>Jumlah (Rp, minus untuk potongan)</span><input class="input" type="number" name="jumlah" step="1000" required placeholder="200000 atau -50000"></label><label class="field"><span>Keterangan</span><input class="input" name="keterangan" maxlength="200" required placeholder="Bonus video viral"></label><button class="btn">Tambah</button></form>
        <div class="err" id="adj-err" role="alert"></div></div>` : ''}
    </div>`;
  }

  function slipDialog(editorId) {
    const G = S.gajiCache[S.gajiBulan];
    const r = G && G.list.find((x) => x.editor_id === +editorId);
    if (!r) return;
    openDialog(`${slipHtml(r, { aksi: true })}<div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Tutup</button><button class="btn" data-act="cetak-slip" data-id="${r.editor_id}">${icon('download')}Cetak / PDF</button></div>`, (d) => {
      d.classList.add('wide');
      const f = $('#adj-form', d);
      if (f) f.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        try {
          await api('/api/gaji/penyesuaian', { method: 'POST', body: { editor_id: r.editor_id, bulan: r.bulan, jumlah: +f.jumlah.value, keterangan: f.keterangan.value } });
          await loadGaji(r.bulan); slipDialog(r.editor_id); toast('Penyesuaian ditambahkan');
        } catch (e) { $('#adj-err', d).textContent = e.message; }
      });
    });
  }

  function cetakSlip(editorId) {
    const G = S.gajiCache[S.gajiBulan];
    const r = G && G.list.find((x) => x.editor_id === +editorId);
    if (!r) return;
    let box = $('#print');
    if (!box) { box = document.createElement('div'); box.id = 'print'; document.body.append(box); }
    box.innerHTML = `<div class="print-brand"><img src="/tokderlogo.png" alt=""><b>Pantau Tokder</b></div>${slipHtml(r)}`;
    window.print();
  }

  async function aturGajiDialog(pilih = 'umum') {
    let A;
    try { A = await api('/api/gaji/aturan'); } catch (e) { toast(e.message, true); return; }
    const eds = S.editors.filter((e) => e.status !== 'nonaktif');
    const form = () => {
      if (pilih === 'umum') {
        const c = A.config;
        return `<form id="ag-form" style="display:flex;flex-direction:column;gap:12px">
          <div class="field"><span>Hari kerja dan libur</span><div>${esc(ringkasJadwal(kalender().jadwal))}. Tanggal merah libur.</div><small>Diubah di <a href="/presensi">Presensi → Aturan presensi</a>; dipakai juga untuk gaji, cuti dan target video.</small></div>
          <label class="field"><span>Jatah cuti per tahun (hari kerja)</span><input class="input" type="number" name="jatah_cuti" min="0" max="60" value="${c.jatah_cuti}" required></label>
          <div class="err" id="ag-err" role="alert"></div>
          <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Tutup</button><button class="btn primary">Simpan</button></div></form>`;
      }
      const a = A.aturan.find((x) => x.editor_id === +pilih) || {};
      return `<form id="ag-form" style="display:flex;flex-direction:column;gap:12px">
        <div class="grid-form">${ATURAN.map(([k, l, s]) => `<label class="field"><span>${l}</span><input class="input" type="number" name="${k}" min="0" step="1000" value="${Math.round(+a[k] || 0)}">${s ? `<small>${s}</small>` : ''}</label>`).join('')}</div>
        <p class="muted" style="margin:0;font-size:12.5px">Semua dalam rupiah. Biarkan 0 untuk komponen yang tidak dipakai. Perubahan tidak mengubah bulan yang sudah final.</p>
        <div class="err" id="ag-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Tutup</button><button class="btn primary">Simpan</button></div></form>`;
    };
    openDialog(`<h2>Atur gaji</h2>
      <label class="field"><span>Bagian</span><select class="input" id="ag-pilih"><option value="umum">Aturan umum (jatah cuti)</option>${eds.map((e) => `<option value="${e.id}" ${+pilih === e.id ? 'selected' : ''}>Gaji ${esc(e.nama)}</option>`).join('')}</select></label>
      ${form()}`, (d) => {
      d.classList.add('wide');
      $('#ag-pilih', d).addEventListener('change', (ev) => aturGajiDialog(ev.target.value));
      $('#ag-form', d).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = ev.target;
        try {
          if (pilih === 'umum') await api('/api/gaji/config', { method: 'PUT', body: { jatah_cuti: +f.jatah_cuti.value } });
          else await api('/api/gaji/aturan/' + pilih, { method: 'PUT', body: Object.fromEntries(ATURAN.map(([k]) => [k, +f[k].value || 0])) });
          toast('Aturan gaji tersimpan');
          S.gajiCache = {};
          await muatUlang();
          aturGajiDialog(pilih);
        } catch (e) { $('#ag-err', d).textContent = e.message; }
      });
    });
  }

  PAGES.gaji = function () {
    const b = S.gajiBulan || today().slice(0, 7);
    const G = S.gajiCache[b];
    const owner = isAdmin();
    const tools = `<input class="input" type="month" id="gj-bulan" value="${b}" max="${today().slice(0, 7)}" aria-label="Bulan" style="width:auto">
      ${owner ? `<button class="btn" data-act="atur-gaji">${icon('gear')}Atur gaji</button>` : ''}${bantuan('gaji')}`;
    const head = (p, extra = '') => `<header class="head"><div><h1>Gaji ${bulanLabel(b)}</h1><p>${p}</p></div><div class="tools">${tools}${extra}</div></header>`;
    if (!G) {
      loadGaji(b).then(() => { if (route() === 'gaji') render(); }).catch((e) => { S.gajiCache[b] = { error: e.message }; if (route() === 'gaji') render(); });
      return head('Menghitung…') + '<div class="skeleton" style="height:240px"></div>';
    }
    if (G.error) return head('Gaji belum bisa dihitung.') + `<section class="card empty" role="alert"><b>Gagal memuat</b>${esc(G.error)}<div style="margin-top:12px"><button class="btn primary" data-act="gaji-muat">Coba lagi</button></div></section>`;
    if (!owner) {
      const r = G.list[0];
      if (!S.gajiRiwayat) api('/api/gaji/riwayat').then((x) => { S.gajiRiwayat = x; if (route() === 'gaji') render(); }).catch(() => { S.gajiRiwayat = []; });
      return head(r ? (r.status === 'final' ? 'Gaji bulan ini sudah final.' : 'Perkiraan berdasarkan presensi, izin dan video sampai hari ini.') : 'Tidak ada data gaji untuk bulan ini.') + `
        ${r ? `<section class="card">${slipHtml(r)}<div class="tools" style="margin-top:12px"><button class="btn" data-act="cetak-slip" data-id="${r.editor_id}">${icon('download')}Cetak / PDF</button></div></section>` : ''}
        <section class="card"><div class="card-h"><h2>Slip yang sudah final</h2></div>
          ${S.gajiRiwayat && S.gajiRiwayat.length ? `<div class="rank">${S.gajiRiwayat.map((x) => `<a class="rank-row" href="/gaji" data-act="gaji-ke" data-v="${x.bulan}" style="text-decoration:none"><span></span><div class="tx"><b>${bulanLabel(x.bulan)}</b><div>${x.dibayar_at ? 'Dibayar ' + new Date(x.dibayar_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Final, belum ditandai dibayar'}</div></div><b>${idr(x.total)}</b></a>`).join('')}</div>` : '<div class="empty"><b>Belum ada slip final</b>Slip muncul di sini setelah pemilik memfinalkan gaji.</div>'}
        </section>`;
    }
    const list = G.list;
    const draf = list.filter((r) => r.status !== 'final');
    const belumAtur = list.filter((r) => !r.aturan_diisi);
    const lastDay = new Date(Date.UTC(+b.slice(0, 4), +b.slice(5, 7), 0)).toISOString().slice(0, 10);
    return head(`${list.length} karyawan, total <b>${idr(sum(list, (r) => r.total))}</b>. ${draf.length ? `${draf.length} masih perkiraan.` : 'Semua sudah final.'}`,
      `<button class="btn" data-act="csv-gaji">${icon('download')}Excel</button>` + (draf.length ? `<button class="btn primary" data-act="finalkan" data-v="semua">Finalkan ${draf.length > 1 ? 'semua' : ''}</button>` : '')) + `
      ${belumAtur.length ? `<div class="notice" role="status" style="margin:0;max-width:none"><b>Aturan gaji belum diisi</b> untuk ${belumAtur.map((r) => esc(r.nama)).join(', ')}. <button class="btn sm" data-act="atur-gaji" data-id="${belumAtur[0].editor_id}">Atur sekarang</button></div>` : ''}
      ${b === today().slice(0, 7) && today() < lastDay ? `<p class="muted" style="margin:0;font-size:13px">Bulan masih berjalan sampai ${tglPanjang(lastDay)}. Ketidakhadiran dihitung sampai kemarin; hari ini baru dihitung bila sudah absen.</p>` : ''}
      <section class="kpis">
        <div class="kpi"><span class="l">Total gaji</span><span class="v">${idr(sum(list, (r) => r.total))}</span><span class="d">${list.length} karyawan</span></div>
        <div class="kpi"><span class="l">Tidak hadir</span><span class="v ${sum(list, (r) => r.hari.alpa) ? 'bad' : ''}">${sum(list, (r) => r.hari.alpa)} hari</span><span class="d">tanpa absen dan tanpa izin</span></div>
        <div class="kpi"><span class="l">Telat</span><span class="v">${sum(list, (r) => r.hari.telat)} kali</span><span class="d">${sum(list, (r) => r.hari.telat_menit)} menit</span></div>
        <div class="kpi"><span class="l">Sudah dibayar</span><span class="v">${list.filter((r) => r.dibayar_at).length} <small>/ ${list.length}</small></span><span class="d">${list.filter((r) => r.status === 'final').length} final</span></div>
      </section>
      <section class="card">
        <div class="table-wrap"><table class="t stack"><thead><tr><th>Karyawan</th><th class="num">Hadir</th><th class="num">Tidak hadir</th><th class="num">Izin/sakit/cuti</th><th class="num">Telat</th><th class="num">Video</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>
          ${list.map((r) => { const e = editorById(r.editor_id); return `<tr>
            <td class="full"><span class="ed">${avatar(e, 'xs')}<b>${esc(r.nama)}</b></span></td>
            <td class="num" data-label="Hadir">${r.hari.hadir}</td>
            <td class="num" data-label="Tidak hadir">${r.hari.alpa ? `<span class="bad">${r.hari.alpa}</span>` : 0}</td>
            <td class="num" data-label="Izin/sakit/cuti">${r.hari.izin + r.hari.sakit + r.hari.cuti}</td>
            <td class="num" data-label="Telat">${r.hari.telat}×</td>
            <td class="num" data-label="Video">${r.video.jumlah}/${r.video.target}</td>
            <td class="num" data-label="Total"><b>${idr(r.total)}</b></td>
            <td data-label="Status">${gajiStatus(r)}</td>
            <td class="full"><div class="row-actions"><button class="btn sm" data-act="slip" data-id="${r.editor_id}">Rincian</button>
              ${r.status !== 'final' ? `<button class="btn sm" data-act="finalkan" data-v="${r.editor_id}">Finalkan</button>`
                : r.dibayar_at ? `<button class="btn sm ghost" data-act="dibayar" data-id="${r.editor_id}" data-v="0">Batal dibayar</button>`
                : `<button class="btn sm primary" data-act="dibayar" data-id="${r.editor_id}" data-v="1">Tandai dibayar</button><button class="btn sm ghost" data-act="buka-gaji" data-id="${r.editor_id}">Buka lagi</button>`}</div></td>
          </tr>`; }).join('') || '<tr><td colspan="9" class="muted">Belum ada karyawan aktif.</td></tr>'}
        </tbody></table></div>
      </section>
      <p class="muted" style="font-size:12.5px;margin:0;max-width:90ch">Finalkan = angka bulan ini dikunci jadi slip resmi; presensi, izin atau aturan yang berubah sesudahnya tidak mengubahnya. Buka lagi bila perlu dihitung ulang. Tandai dibayar setelah transfer.</p>`;
  };
  AFTER.gaji = () => {
    const inp = $('#gj-bulan');
    if (inp) inp.addEventListener('change', () => { if (/^\d{4}-\d{2}$/.test(inp.value) && inp.value <= today().slice(0, 7)) { S.gajiBulan = inp.value; render(); } });
  };

  // ============ page: pendapatan (sources made explicit) ============
  PAGES.monetisasi = function () {
    const rows = S.content;
    const month = today().slice(0, 7);
    const revDaily = S.daily.filter((d) => d.revenue != null);
    const hasDaily = revDaily.length > 0;
    const latest = revDaily.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), '');
    const d28 = latest ? daysBack(28, latest) : [], p28 = latest ? daysBack(28, addDays(d28[0], -1)) : [];
    const revIn = (ds) => sum(revDaily.filter((d) => ds.includes(d.tanggal)), (d) => d.revenue);
    const revMonth = sum(revDaily.filter((d) => d.tanggal.slice(0, 7) === month), (d) => d.revenue);
    const withRev = rows.filter((c) => c.revenue != null);
    const hasVid = withRev.length > 0;
    const by = (keyFn, nameFn) => {
      const m = new Map();
      withRev.forEach((c) => { const k = keyFn(c); m.set(k, (m.get(k) || 0) + (c.revenue || 0)); });
      return [...m.entries()].map(([k, v]) => ({ k, nama: nameFn(k), v })).sort((a, b) => b.v - a.v);
    };
    const perEditor = by((c) => (editorById(c.editor_id) ? c.editor_id : 0), (k) => (k ? editorById(k).nama : 'Belum dikenali'));
    const perCh = by((c) => c._ch, chName);
    const maxE = Math.max(...perEditor.map((x) => x.v), 0.01), maxC = Math.max(...perCh.map((x) => x.v), 0.01);
    // NUMERIC columns arrive as text ("0"), so they are turned into numbers before any comparison.
    const g0 = S.goal || {};
    const g = { ...g0, target_omset: +g0.target_omset || 0, tercapai: +g0.tercapai || 0 };
    const gp = g.target_omset ? Math.min(1, g.tercapai / g.target_omset) : null;
    const chans = analyticsChannels();
    const noRev = '<div class="empty"><b>Belum ada angka pendapatan</b>Muncul setelah channel tersambung ke YouTube Analytics dan sudah dimonetisasi.</div>';
    const ch28 = p28.length && revIn(p28) ? Math.round(((revIn(d28) - revIn(p28)) / revIn(p28)) * 100) : null;
    return `
      <header class="head"><div><h1>Pendapatan</h1><p>Pendapatan iklan adalah <b>perkiraan dari YouTube Analytics</b> dalam rupiah (dikonversi YouTube dengan kurs harian), angka yang sama dengan di YouTube Studio; pembayaran akhir AdSense bisa sedikit berbeda. Omzet afiliasi berasal dari laporan CSV yang diimpor atau diisi manual oleh pemilik.</p></div><div class="tools">${bantuan('pendapatan')}</div></header>
      <section class="kpis">
        <div class="kpi"><span class="l">Iklan bulan ini</span><span class="v">${hasDaily ? rpOrDash(revMonth) : '—'}</span><span class="d">${hasDaily ? 'semua video, sampai ' + tglPendek(latest) : 'belum ada data channel'}</span></div>
        <div class="kpi"><span class="l">Iklan 28 hari</span><span class="v">${hasDaily ? rpOrDash(revIn(d28)) : '—'}</span><span class="d ${ch28 == null ? '' : ch28 >= 0 ? 'ok' : 'bad'}">${ch28 == null ? 'belum ada pembanding' : signed(ch28, (v) => nf.format(v) + '%') + ' dari 28 hari sebelumnya'}</span></div>
        <div class="kpi"><span class="l">Total per video tercatat</span><span class="v">${hasVid ? rpOrDash(sum(withRev, (c) => c.revenue)) : '—'}</span><span class="d">${hasVid ? nf.format(withRev.filter((c) => c.revenue > 0).length) + ' video menghasilkan, seumur video' : 'belum ada data per video'}</span></div>
        <div class="kpi"><span class="l">Omzet afiliasi bulan ini</span><span class="v">${idr(g.tercapai)}</span><span class="d">${g.impor && g.impor.bulan.includes(month) ? 'dari impor ' + esc(g.impor.sumber) : 'diisi manual'} · ${g.target_omset ? 'target ' + idr(g.target_omset) : 'target belum diatur'}</span></div>
      </section>
      <section class="card"><div class="card-h"><h2>Sumber angka</h2></div>
        <div class="checklist">${chans.map((c) => { const r = revDaily.filter((d) => d.channel_id === c.id); const ok = c.connected && r.length > 0; return `<div class="ck"><span class="st ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'}</span><div><b>${esc(c.nama)}</b><div>${!c.connected ? (r.length ? `Tidak tersambung lagi ke YouTube Analytics. Angka yang tampil adalah data lama sampai ${tglPendek(r.reduce((m, d) => (d.tanggal > m ? d.tanggal : m), ''))}; hubungkan ulang di Pengaturan.` : 'Belum tersambung ke YouTube Analytics: pendapatannya tidak terbaca.') : r.length ? `Pendapatan terbaca, ${rpOrDash(sum(r.filter((d) => d.tanggal.slice(0, 7) === month), (d) => d.revenue))} bulan ini.` : 'Tersambung, tapi YouTube tidak mengirim angka pendapatan (channel belum dimonetisasi atau akun tidak punya akses pendapatan).'}</div></div></div>`; }).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
      </section>
      <div class="grid-2">
        <section class="card"><div class="card-h"><h2>Target omzet afiliasi</h2><div class="tools"><button class="btn sm" data-act="impor-afiliasi">${icon('download')}Impor CSV</button><button class="btn sm" data-act="goal">Ubah</button></div></div>
          <div class="goal-v">${gp == null ? idr(g.tercapai) : pct(gp)}</div><div class="goal-bar"><i style="width:${(gp || 0) * 100}%"></i></div>
          <div class="muted">${gp == null ? 'Target bulan ini belum diatur. Klik Ubah untuk mengisinya.' : `${idr(g.tercapai)} dari ${idr(g.target_omset)} · sisa ${idr(Math.max(0, g.target_omset - g.tercapai))}`}</div>
          <p class="muted" style="font-size:12.5px;margin:10px 0 0">${g.impor ? `Impor terakhir: ${esc(g.impor.sumber)}, ${esc(g.impor.file)} (${g.impor.bulan.map(bulanLabel).join(', ')}), ${new Date(g.impor.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.` : 'Belum pernah diimpor. Isi manual lewat Ubah, atau impor laporan komisi CSV dari dashboard afiliasi.'}</p></section>
        <section class="card"><div class="card-h"><h2>Per karyawan</h2><p>Jumlah pendapatan seumur video buatan tiap orang.</p></div>${hasVid ? `<div class="rank">${perEditor.map((x) => `<div class="rank-row">${avatar(editorById(x.k), 'sm')}<div class="tx"><b>${esc(x.nama)}</b><div class="bar"><i style="width:${(x.v / maxE) * 100}%"></i></div></div><b>${rpOrDash(x.v)}</b></div>`).join('')}</div>` : noRev}</section>
        <section class="card"><div class="card-h"><h2>Per channel</h2><p>Jumlah pendapatan seumur video yang tercatat.</p></div>${hasVid ? `<div class="rank">${perCh.map((x) => `<div class="rank-row"><span></span><div class="tx"><b>${esc(x.nama)}</b><div class="bar"><i style="width:${(x.v / maxC) * 100}%"></i></div></div><b>${rpOrDash(x.v)}</b></div>`).join('')}</div>` : noRev}</section>
        <section class="card"><div class="card-h"><h2>Video dengan pendapatan tertinggi</h2></div>
          ${withRev.some((c) => c.revenue > 0) ? `<div class="table-wrap"><table class="t"><tbody>${[...withRev].filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td>${vidCell(c)}</td><td class="num"><b>${rpOrDash(c.revenue)}</b></td></tr>`).join('')}</tbody></table></div>` : noRev}</section>
      </div>`;
  };

  // ============ page: panduan ============
  // Short and task-based: first steps, routines, what each menu is for, and short answers.
  // "Cara kerja" buttons on other pages open the matching answer (/panduan#p-gaji).
  const MENU_INFO = {
    'hari-ini': 'Halaman utama karyawan: absen, jadwal video, tugas, izin dan gaji hari ini.',
    ringkasan: 'Gambaran tim: video tayang, views, tepat jadwal, siapa paling bagus.',
    harian: 'Kerja per hari: video, jam tayang, tugas lain, skor. Karyawan hanya melihat miliknya sendiri.',
    performa: 'Video mana yang berhasil dibanding video lain di channel, plus saran perbaikan.',
    tren: 'Apa yang sedang naik di channel: video, topik, kata di judul.',
    konten: 'Semua video channel: cari, saring, lihat retensi, unduh CSV.',
    analytics: 'Angka resmi YouTube per channel: views, jam tonton, subscriber.',
    presensi: 'Absen masuk dan pulang dari Wi-Fi kantor. Pemilik mengatur jam kerja dan libur di sini.',
    pengajuan: 'Ajukan izin, sakit, cuti atau ganti uang (klaim).',
    gaji: 'Slip gaji yang dihitung otomatis dari presensi dan video.',
    identifikasi: 'Video tanpa kode karyawan, untuk ditetapkan pembuatnya.',
    karyawan: 'Data karyawan: kode, jadwal, target, PIN.',
    monetisasi: 'Pendapatan iklan YouTube (rupiah) dan omzet afiliasi.',
    pengaturan: 'Sambungan YouTube, sinkronisasi, notifikasi, password.',
  };

  const FAQ = [
    { id: 'harian', q: 'Bagaimana skor harian dihitung?', a: `<p>Skor 0–100 dari empat hal:</p><ul><li><b>Jumlah video</b> dibanding target: 35 poin</li><li><b>Tepat jadwal</b> (telat lebih dari ${TOL} menit = telat): 25 poin</li><li><b>Views</b> dibanding video lain di channel: 20 poin</li><li><b>Tugas lain</b> yang dicatat: 20 poin</li></ul><p>Nilai A ≥ 85, B ≥ 70, C ≥ 55, sisanya D.</p>` },
    { id: 'performa', q: 'Apa arti angka 1,3× atau 0,8×?', a: '<p>Views video dibanding video biasa di channel yang sama (Shorts dibanding Shorts). <b>1×</b> = biasa, <b>1,3×</b> = 30% lebih ramai, <b>0,8×</b> = 20% lebih sepi.</p><p>Video yang belum 2 hari belum dinilai karena views-nya masih naik.</p>' },
    { id: 'tren', q: 'Dari mana “Sedang naik sekarang” dihitung?', a: '<p>Dari selisih views antara dua kali sinkronisasi (data diambil tiap jam), lalu disetarakan per 24 jam. Topik dan kata judul dibandingkan dengan video lain di periode yang sama.</p>' },
    { id: 'jam-kerja', q: 'Jam kerja dan hari libur', get a() { return `<ul>${ringkasJadwal(kalender().jadwal).split(' · ').map((x) => `<li>${esc(x)}</li>`).join('')}<li><b>Tanggal merah</b> libur${kalender().cuti_bersama ? ', termasuk cuti bersama' : ''}</li></ul><p>Telat dihitung dari jam masuk hari itu. Di hari libur tidak ada target video dan tidak dihitung tidak hadir; bila tetap masuk, jam kerjanya dihitung lembur. Pemilik bisa mengubah jam kerja, ikut cuti bersama, atau menambah libur kantor di Presensi → Aturan presensi.</p>${liburBerikutnya().length ? `<p>Libur berikutnya: ${liburBerikutnya().map(([d, n]) => `${tglPendek(d)} (${esc(n)})`).join(', ')}.</p>` : ''}`; } },
    { id: 'privasi', q: 'Siapa yang bisa melihat data saya?', a: '<p>Karyawan hanya melihat <b>datanya sendiri</b> (absen, aktivitas, skor, gaji, izin) dan angka <b>channel secara umum</b>. Data karyawan lain tidak ditampilkan; video buatan rekan tertulis “Tim”. Pemilik melihat semuanya.</p>' },
    { id: 'presensi', q: 'Kenapa absen saya ditolak?', a: '<p>Absen hanya diterima bila <b>tersambung ke Wi-Fi kantor</b>, <b>GPS menyala dan akurat</b>, dan <b>berada di area kantor</b>. Alasannya tertulis di tabel “Percobaan yang ditolak”.</p><p>Coba: matikan data seluler dan VPN, sambung ke Wi-Fi kantor, nyalakan GPS, tunggu beberapa detik, lalu absen lagi.</p>' },
    { id: 'video', q: 'Video saya tidak muncul atau tidak terhitung', a: '<p>Pastikan <b>kode Anda</b> (misal #AL) ada di deskripsi video. Video baru muncul paling lama 1 jam setelah tayang. Video tanpa kode bisa ditetapkan pembuatnya di menu Belum dikenali.</p>' },
    { id: 'retensi', q: 'Kenapa retensi video kosong?', a: '<p>YouTube baru memberi data retensi 2–3 hari setelah video tayang, dan tidak memberikannya untuk video yang penontonnya sangat sedikit. Channel juga harus tersambung ke YouTube Analytics.</p>' },
    { id: 'pengajuan', q: 'Apa pengaruh izin, cuti dan klaim ke gaji?', a: '<ul><li><b>Sakit</b> dan <b>cuti</b> yang disetujui tidak dipotong.</li><li><b>Izin</b> dipotong hanya bila pemilik mengaturnya.</li><li><b>Klaim</b> yang disetujui ditambahkan ke gaji bulan itu.</li><li>Tidak absen tanpa izin = tidak hadir.</li></ul>' },
    { id: 'gaji', q: 'Bagaimana gaji dihitung?', a: '<p><b>Ditambah:</b> gaji pokok, tunjangan, lembur (pulang ≥ 30 menit setelah jam pulang hari itu, atau seluruh jam kerja di hari libur), bonus video di atas target, bonus views, klaim, bonus dari pemilik.</p><p><b>Dikurangi:</b> hari tidak hadir, izin (bila diatur), telat, potongan tetap seperti BPJS.</p><p>Nominal tiap komponen diatur pemilik di Gaji → Atur gaji.</p>' },
    { id: 'status-gaji', q: 'Apa beda Perkiraan, Final dan Dibayar?', a: '<ul><li><b>Perkiraan</b>: bulan masih berjalan, angka masih bisa berubah.</li><li><b>Final</b>: dikunci pemilik, angka tidak berubah lagi.</li><li><b>Dibayar</b>: pemilik sudah mentransfer.</li></ul>' },
    { id: 'notifikasi', q: 'Cara menyalakan notifikasi di HP', a: '<p><b>Android / laptop:</b> buka menu Pengaturan (pemilik) atau Izin & klaim (karyawan), lalu tekan <b>Aktifkan notifikasi</b>.</p><p><b>iPhone:</b> buka di Safari → <b>Bagikan</b> → <b>Tambah ke Layar Utama</b>. Buka Pantau Tokder dari ikon itu, lalu tekan Aktifkan notifikasi.</p>' },
    { id: 'pendapatan', q: 'Apakah angka pendapatan asli?', a: '<p>Ya. Pendapatan iklan diambil dari YouTube Analytics dalam <b>rupiah</b> (YouTube mengonversinya dengan kurs harian), sama dengan di YouTube Studio bila mata uangnya rupiah. Pembayaran AdSense bisa sedikit beda karena kurs saat transfer. Channel yang belum tersambung tampil “—”. Omzet afiliasi dari file CSV yang diimpor atau diisi manual.</p>', owner: true },
    { id: 'afiliasi', q: 'Cara memasukkan omzet afiliasi', a: '<p>Unduh laporan komisi (CSV) dari dashboard afiliasi, lalu di menu Pendapatan tekan <b>Impor CSV</b>, pilih file, cek total per bulan, dan Simpan.</p>', owner: true },
    { id: 'data', q: 'Dari mana semua angka berasal?', a: '<ul><li>Video, views, like: YouTube, diperbarui tiap jam.</li><li>Retensi, jam tonton, pendapatan: YouTube Analytics, terlambat 2–3 hari.</li><li>Absen, aktivitas, izin: dicatat di aplikasi ini.</li></ul><p>Tidak ada angka contoh. Data yang belum ada ditulis “—”.</p>' },
    { id: 'ip-kantor', q: 'Semua karyawan ditolak “bukan Wi-Fi kantor”', a: '<p>Biasanya IP internet kantor berganti setelah modem dinyalakan ulang. Bila dua karyawan yang GPS-nya di dalam kantor ditolak dari jaringan baru yang sama, pemilik mendapat notifikasi dan kartu <b>IP Wi-Fi kantor tampaknya berubah</b> di Presensi. Tekan <b>Ganti IP lama dengan ini</b>; karyawan diberi kabar untuk absen lagi.</p>', owner: true },
    { id: 'offline', q: 'Sinyal hilang, apakah data hilang?', a: '<p>Tidak. Aplikasi menampilkan data terakhir yang tersimpan di HP dengan keterangan jamnya, lalu memperbarui sendiri saat sinyal kembali. Absen tetap butuh koneksi karena diperiksa server.</p>' },
    { id: 'hapus', q: 'Salah hapus catatan', a: '<p>Setelah menghapus aktivitas atau membatalkan pengajuan, tekan <b>Batalkan</b> di pesan bawah layar dalam 5 detik.</p>' },
    { id: 'excel', q: 'Cara mengunduh rekap ke Excel', a: '<p>Tekan tombol <b>Excel</b> di Gaji (rekap gaji per bulan), Presensi (rekap 30 hari), atau Konten (daftar video). File bisa dibuka di Excel dan Google Sheets.</p>', owner: true },
    { id: 'pin', q: 'Lupa PIN', a: '<p>Minta pemilik mengganti PIN di menu Karyawan → Ubah.</p>' },
  ];

  function langkahPanduan(lihat) {
    if (lihat === 'pemilik') {
      return persiapanItems().map((x) => ({ ok: x.ok, t: x.t, d: x.cara, btn: x.act ? `<button class="btn sm" data-act="${x.act}" data-id="${x.id || 'umum'}">${x.act === 'notif-aktif' ? 'Aktifkan' : x.ok ? 'Ubah' : 'Atur'}</button>` : `<a class="btn sm" href="${x.href}">${x.ok ? 'Lihat' : 'Buka'}</a>` }));
    }
    const kode = (me() || {}).kode_identifikasi;
    const P = S.presensi && S.presensi.rows ? hariPresensi(S.presensi.rows, (me() || {}).id, today()) : {};
    return [
      { ok: null, t: `Tulis kode ${kode ? '#' + esc(kode) : 'Anda'} di deskripsi setiap video`, d: 'Tanpa kode, video tidak terhitung untuk Anda.', btn: '' },
      { ok: me() ? !!P.masuk : null, t: 'Absen masuk dan pulang', d: 'Dari Wi-Fi kantor dengan GPS menyala, langsung di halaman Hari ini.', btn: '<a class="btn sm" href="/">Hari ini</a>' },
      { ok: null, t: 'Catat tugas selain upload', d: 'Riset harga, thumbnail, cek SEO, balas komentar.', btn: '<a class="btn sm" href="/">Hari ini</a>' },
      { ok: !!(S.notif && S.notif.aktif), t: 'Nyalakan notifikasi', d: 'Supaya tahu izin disetujui, gaji dibayar, dan diingatkan absen.', btn: S.notif && S.notif.aktif ? '' : '<button class="btn sm" data-act="notif-aktif">Aktifkan</button>' },
      { ok: null, t: 'Lihat Performa tiap minggu', d: 'Baca bagian “Yang bisa ditingkatkan”: videomu dibanding video lain di channel.', btn: '<a class="btn sm" href="/performa">Performa</a>' },
    ];
  }

  PAGES.panduan = function () {
    const owner = isAdmin();
    const lihat = owner ? S.panduanUntuk || 'pemilik' : 'karyawan';
    const untukPemilik = lihat === 'pemilik';
    const langkah = langkahPanduan(lihat);
    const selesai = langkah.filter((x) => x.ok).length, dinilai = langkah.filter((x) => x.ok != null).length;
    const rutin = untukPemilik
      ? [['Setiap hari', ['Lihat Ringkasan dan Harian', 'Setujui atau tolak Izin & klaim']], ['Setiap minggu', ['Baca ringkasan Senin pagi di notifikasi', 'Buka Tren channel dan Performa', 'Tetapkan video di Belum dikenali']], ['Akhir bulan', ['Gaji → cek Rincian → Finalkan', 'Transfer, lalu Tandai dibayar', 'Unduh Excel untuk arsip', 'Impor omzet afiliasi']]]
      : [['Setiap hari kerja', ['Buka Hari ini, absen masuk', 'Upload sesuai jadwal, pakai kode', 'Centang tugas lain dengan Catat', 'Absen pulang. Jam kerja: ' + ringkasJadwal(kalender().jadwal)]], ['Setiap minggu', ['Buka Performa saya', 'Lihat Tren channel untuk ide']], ['Akhir bulan', ['Cek slip di Gaji', 'Ajukan klaim sebelum gaji final']]];
    const menu = ROUTES.filter((r) => r.id !== 'panduan' && MENU_INFO[r.id] && (!r.admin || untukPemilik) && (!r.karyawan || !untukPemilik));
    const faq = FAQ.filter((f) => !f.owner || untukPemilik);
    return `
      <header class="head"><div><h1>Panduan</h1><p>Semua yang perlu diketahui untuk memakai Pantau Tokder, singkat.</p></div>
        <div class="tools">${owner ? `<div class="seg" role="group" aria-label="Panduan untuk"><button data-act="panduan-untuk" data-v="pemilik" aria-pressed="${untukPemilik}">Untuk pemilik</button><button data-act="panduan-untuk" data-v="karyawan" aria-pressed="${!untukPemilik}">Untuk karyawan</button></div>` : ''}</div></header>
      <label class="search guide-search">${icon('search')}<input class="input" type="search" id="pd-cari" placeholder="Cari: gaji, absen ditolak, PIN, notifikasi…" aria-label="Cari di panduan"></label>
      <p class="muted" id="pd-kosong" hidden style="margin:0">Tidak ada yang cocok. Coba kata lain, misalnya “gaji” atau “absen”.</p>
      <section class="card guide-sec" data-cari="mulai langkah awal persiapan ${esc(langkah.map((x) => x.t).join(' '))}">
        <div class="card-h"><h2>${untukPemilik ? 'Mulai di sini' : 'Yang perlu Anda lakukan'}</h2>${dinilai && owner && untukPemilik ? `<span class="pill ${selesai === dinilai ? 'ok' : 'warn'}">${selesai} dari ${dinilai} selesai</span>` : ''}</div>
        <ol class="steps">${langkah.map((x, i) => `<li class="${x.ok ? 'done' : ''}"><span class="no" aria-hidden="true">${x.ok ? '✓' : i + 1}</span><div class="tx"><b>${x.t}</b><span>${x.d}</span></div>${x.btn}</li>`).join('')}</ol>
      </section>
      <section class="guide-sec" data-cari="rutinitas setiap hari minggu akhir bulan ${esc(rutin.flat(2).join(' '))}">
        <h2 class="guide-h">Rutinitas</h2>
        <div class="routine">${rutin.map(([w, l]) => `<div class="card"><h3>${w}</h3><ul>${l.map((t) => `<li>${t}</li>`).join('')}</ul></div>`).join('')}</div>
      </section>
      <section class="guide-sec" data-cari="menu">
        <h2 class="guide-h">Isi tiap menu</h2>
        <div class="menu-grid">${menu.map((r) => `<a class="card menu-card" href="${pathOf(r.id)}" data-cari="${esc(r.label + ' ' + MENU_INFO[r.id])}">${icon(r.icon)}<div><b>${r.label}</b><span>${MENU_INFO[r.id]}</span></div></a>`).join('')}</div>
      </section>
      <section class="guide-sec" data-cari="pertanyaan">
        <h2 class="guide-h">Pertanyaan umum</h2>
        <div class="card faq-list">${faq.map((f) => `<details id="p-${f.id}" data-cari="${esc(f.q + ' ' + f.a.replace(/<[^>]+>/g, ' '))}"><summary>${f.q}</summary><div class="ans">${f.a}</div></details>`).join('')}</div>
      </section>`;
  };
  AFTER.panduan = () => {
    // Opened from a "Cara kerja" button: unfold that answer and point to it.
    const id = location.hash.slice(1);
    const el = id && document.getElementById(id);
    if (el && el.tagName === 'DETAILS') {
      el.open = true;
      el.classList.add('flash');
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center' }));
      setTimeout(() => el.classList.remove('flash'), 2000);
    }
    const inp = $('#pd-cari');
    if (!inp) return;
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      let ada = 0;
      $$('.guide-sec').forEach((sec) => {
        const items = $$('[data-cari]', sec).filter((x) => x !== sec);
        if (!items.length) { const hit = !q || sec.dataset.cari.toLowerCase().includes(q); sec.hidden = !hit; ada += hit; return; }
        let n = 0;
        items.forEach((x) => { const hit = !q || x.dataset.cari.toLowerCase().includes(q); x.hidden = !hit; if (hit) n++; if (x.tagName === 'DETAILS') x.open = !!q && hit; });
        sec.hidden = !n; ada += n;
      });
      $('#pd-kosong').hidden = !!ada;
    });
  };

  // ============ notifikasi ============
  // Web Push: izin baru, keputusan izin, gaji final/dibayar, pengingat absen. On iPhone it needs the
  // site added to the home screen first (Safari only allows push for installed web apps).
  const pushDidukung = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const diIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const terpasang = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let swReg = null;
  async function daftarSW() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
    try { swReg = swReg || (await navigator.serviceWorker.register('/sw.js')); } catch (e) { console.warn('Service worker:', e.message); }
    return swReg;
  }
  async function cekNotif() {
    if (!pushDidukung()) { daftarSW(); S.notif = { didukung: false, aktif: false }; return; }
    const reg = await daftarSW();
    const sub = reg && (await reg.pushManager.getSubscription().catch(() => null));
    S.notif = { didukung: true, aktif: !!sub && Notification.permission === 'granted', izin: Notification.permission };
  }
  const b64 = (s) => { const r = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
  const perangkatLabel = () => { const u = navigator.userAgent; return (/Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Perangkat') + ' · ' + (/Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'browser'); };
  async function aktifkanNotif() {
    if (!pushDidukung()) {
      toast(diIOS && !terpasang() ? 'Di iPhone: ketuk Bagikan → Tambah ke Layar Utama, buka Pantau Tokder dari ikon itu, lalu aktifkan notifikasi.' : 'Browser ini tidak mendukung notifikasi. Pakai Chrome, Edge, Firefox atau Safari terbaru.', true);
      return;
    }
    const btn = $('[data-act="notif-aktif"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengaktifkan…'; }
    // Some browsers never answer when their push service is unreachable: give up with a clear message.
    const batas = (pr, pesan) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(pesan)), 20000))]);
    try {
      const izin = await Notification.requestPermission();
      if (izin !== 'granted') { toast('Izin notifikasi ditolak. Izinkan notifikasi untuk situs ini di pengaturan browser, lalu coba lagi.', true); return; }
      await daftarSW();
      const reg = await batas(navigator.serviceWorker.ready, 'browser tidak menyiapkan layanan notifikasi');
      const { publicKey } = await api('/api/push');
      const sub = (await reg.pushManager.getSubscription()) || (await batas(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }), 'layanan push browser tidak menjawab. Periksa koneksi lalu coba lagi.'));
      await api('/api/push/langganan', { method: 'POST', body: { subscription: sub.toJSON(), perangkat: perangkatLabel() } });
      await api('/api/push/coba', { method: 'POST' });
      S.notif = { didukung: true, aktif: true, izin: 'granted' };
      toast('Notifikasi aktif. Pesan percobaan dikirim ke perangkat ini.');
      render();
    } catch (e) { toast('Notifikasi belum bisa diaktifkan: ' + e.message, true); render(); }
  }
  async function matikanNotif(diam = false) {
    try {
      const reg = swReg || (await navigator.serviceWorker.getRegistration());
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) { await api('/api/push/langganan', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
    } catch (e) { /* nothing subscribed */ }
    S.notif = { ...(S.notif || {}), aktif: false };
    if (!diam) { toast('Notifikasi dimatikan di perangkat ini'); render(); }
  }
  function notifCard() {
    const n = S.notif || {};
    const isi = isAdmin() ? 'pengajuan izin, sakit, cuti dan klaim baru' : 'keputusan izin dan klaim, slip gaji final, gaji dibayar, dan pengingat bila belum absen masuk';
    const tombol = n.aktif
      ? `<span class="pill ok">Aktif di perangkat ini</span><button class="btn sm ghost" data-act="notif-coba">Kirim percobaan</button><button class="btn sm ghost" data-act="notif-mati">Matikan</button>`
      : !n.didukung && diIOS && !terpasang()
        ? '<span class="muted" style="font-size:13px">Di iPhone: ketuk <b>Bagikan → Tambah ke Layar Utama</b>, buka dari ikon itu, lalu aktifkan di sini.</span>'
        : n.izin === 'denied' ? '<span class="muted" style="font-size:13px">Notifikasi diblokir di browser ini. Izinkan untuk situs ini di pengaturan browser.</span>'
        : `<button class="btn primary sm" data-act="notif-aktif">${icon('plus')}Aktifkan notifikasi</button>`;
    return `<section class="card" id="kartu-notif"><div class="card-h"><h2>Notifikasi ke HP</h2><p>Kabar ${isi}. Aktifkan di tiap HP atau laptop yang dipakai.</p></div><div class="tools">${tombol}</div></section>`;
  }

  // ============ persiapan (pemilik) ============
  // What still needs doing before every number in the app is complete. Hidden once all is done.
  function persiapanItems() {
    const G = S.gajiCache[today().slice(0, 7)];
    const eds = activeEditors();
    const ch = analyticsChannels();
    const belumGaji = G && G.list ? G.list.filter((r) => !r.aturan_diisi) : [];
    return [
      { ok: !!(eds.length && eds.every((e) => e.punya_pin)), t: 'Tambah karyawan dan beri PIN', d: eds.length ? eds.filter((e) => !e.punya_pin).map((e) => e.nama).join(', ') + ' belum punya PIN untuk masuk.' : 'Belum ada karyawan.', cara: 'Isi nama, kode video (misal AL), jadwal tayang, target dan PIN.', href: '/karyawan' },
      { ok: !!(ch.length && ch.every((c) => c.connected)), t: 'Sambungkan YouTube Analytics', d: `${ch.filter((c) => c.connected).length} dari ${ch.length} channel tersambung. Retensi, jam tonton dan pendapatan hanya terbaca dari channel yang tersambung.`, cara: 'Pengaturan → Hubungkan, masuk dengan tokodeeres@gmail.com, pilih channel. Ulangi untuk tiap channel.', href: '/pengaturan' },
      { ok: !!(S.presensi && S.presensi.config && S.presensi.config.siap), t: 'Atur presensi', d: 'Isi lokasi kantor dan IP Wi-Fi kantor dari kantor.', cara: 'Buka dari Wi-Fi kantor: Pakai lokasi saya, Tambahkan IP saya, Simpan.', href: '/presensi' },
      { ok: !!(G && G.config && G.config.tersimpan), t: 'Cek jam kerja dan jatah cuti', d: `Jam kerja: ${ringkasJadwal(kalender().jadwal)}; tanggal merah libur. Pastikan jatah cuti per tahun sudah benar.`, cara: 'Jam kerja di Presensi, jatah cuti di Gaji → Atur gaji.', href: '/gaji', act: 'atur-gaji', id: 'umum' },
      { ok: !!(G && G.list && G.list.length && !belumGaji.length), t: 'Isi gaji tiap karyawan', d: belumGaji.map((r) => r.nama).join(', ') + ' belum punya gaji pokok atau komponen lain.', cara: 'Gaji pokok, tunjangan, potongan, lembur, bonus.', href: '/gaji', act: 'atur-gaji', id: belumGaji.length ? belumGaji[0].editor_id : G && G.list && G.list[0] && G.list[0].editor_id },
      { ok: !!(S.notif && S.notif.aktif), t: 'Nyalakan notifikasi di HP', d: 'Supaya pengajuan izin dan klaim langsung terlihat.', cara: 'Supaya pengajuan izin dan klaim langsung masuk ke HP.', href: '/pengaturan', act: S.notif && S.notif.aktif ? null : 'notif-aktif' },
    ];
  }
  // What still needs doing before every number in the app is complete. Hidden once all is done.
  function persiapanHtml() {
    if (!isAdmin()) return '';
    const items = persiapanItems();
    const sisa = items.filter((x) => !x.ok);
    if (!sisa.length) return '';
    return `<section class="card" id="kartu-persiapan"><div class="card-h"><h2>Persiapan: ${items.length - sisa.length} dari ${items.length} selesai</h2><p>Lengkapi supaya semua angka dan fitur terisi.</p></div>
      <div class="checklist">${sisa.map((x) => `<div class="ck"><span class="st bad">!</span><div><b>${esc(x.t)}</b><div>${esc(x.d)}</div></div>${x.act ? `<button class="btn sm" data-act="${x.act}" data-id="${x.id || 'umum'}">${x.act === 'notif-aktif' ? 'Aktifkan' : 'Atur'}</button>` : `<a class="btn sm" href="${x.href}">Buka</a>`}</div>`).join('')}</div></section>`;
  }

  // ============ impor afiliasi (CSV) ============
  function bacaCsv(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
      if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  // "Rp1.234.567", "1,234.50", "12.345,67", "1500" → number
  function angkaUang(v) {
    let s = String(v ?? '').replace(/[^\d,.\-]/g, '');
    if (!/\d/.test(s)) return null;
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (lc > -1) s = /^[^,]*,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (ld > -1 && !/^[^.]*\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  // "2026-10-21 13:00", "21/10/2026", "21-10-2026 08:00" → "2026-10" (day first, as in Indonesian reports)
  function bulanTgl(v) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.]\d{1,2}/);
    let out = m ? m[1] + '-' + m[2].padStart(2, '0') : null;
    if (!out) { m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); out = m ? m[3] + '-' + m[2].padStart(2, '0') : null; }
    return out && /^\d{4}-(0[1-9]|1[0-2])$/.test(out) ? out : null;
  }
  function imporDialog() {
    openDialog(`<h2>Impor laporan afiliasi</h2>
      <p>Unduh laporan komisi dari dashboard afiliasi (misalnya Shopee Affiliate atau TikTok Shop) dalam format CSV, lalu pilih filenya. Omzet tercapai tiap bulan di file akan diganti dengan jumlah dari laporan.</p>
      <label class="field"><span>File CSV</span><input class="input" type="file" id="im-file" accept=".csv,text/csv"></label>
      <div id="im-isi"></div>
      <div class="err" id="im-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="im-simpan" disabled>Simpan</button></div>`, (d) => {
      d.classList.add('wide');
      let rows = null, nama = '', hasil = null;
      const isi = $('#im-isi', d), err = $('#im-err', d), simpan = $('#im-simpan', d);
      const hitung = () => {
        const [head, ...data] = rows;
        const ci = +$('#im-tgl', d).value, ca = +$('#im-jml', d).value, cf = $('#im-fkol', d).value, fv = $('#im-fval', d).value.trim().toLowerCase();
        const per = {}; let pakai = 0, lewat = 0, saring = 0;
        data.forEach((r) => {
          if (cf !== '' && fv && !String(r[+cf] || '').toLowerCase().includes(fv)) { saring++; return; }
          const b = bulanTgl(r[ci]), n = angkaUang(r[ca]);
          if (!b || n == null) { lewat++; return; }
          per[b] = (per[b] || 0) + n; pakai++;
        });
        hasil = { per, pakai };
        const bl = Object.keys(per).sort();
        $('#im-hasil', d).innerHTML = bl.length
          ? `<table class="t"><thead><tr><th>Bulan</th><th class="num">Omzet tercapai</th></tr></thead><tbody>${bl.map((b) => `<tr><td>${bulanLabel(b)}</td><td class="num"><b>${idr(per[b])}</b></td></tr>`).join('')}</tbody></table><p class="muted" style="font-size:12.5px;margin:6px 0 0">${pakai} baris dipakai${saring ? `, ${saring} tidak cocok saringan` : ''}${lewat ? `, ${lewat} dilewati karena tanggal atau angkanya tidak terbaca` : ''}. Kolom ${esc(head[ci])} dan ${esc(head[ca])}.</p>`
          : '<div class="empty"><b>Tidak ada baris yang terbaca</b>Periksa pilihan kolom tanggal dan jumlah.</div>';
        simpan.disabled = !bl.length || bl.length > 36;
      };
      $('#im-file', d).addEventListener('change', async (ev) => {
        const f = ev.target.files[0];
        err.textContent = ''; simpan.disabled = true; isi.innerHTML = '';
        if (!f) return;
        if (f.size > 5e6) { err.textContent = 'File terlalu besar (maksimal 5 MB).'; return; }
        rows = bacaCsv(await f.text()); nama = f.name;
        if (rows.length < 2) { err.textContent = 'File kosong atau bukan CSV.'; return; }
        const head = rows[0];
        const tebak = (re) => Math.max(0, head.findIndex((h) => re.test(h)));
        const opt = (sel) => head.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Kolom ' + (i + 1))}</option>`).join('');
        isi.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">
          <div class="row"><label class="field"><span>Sumber</span><input class="input" id="im-sumber" maxlength="60" value="${/tiktok/i.test(nama) ? 'TikTok Shop' : /shopee/i.test(nama) ? 'Shopee Affiliate' : 'Afiliasi'}"></label>
            <label class="field"><span>Kolom tanggal</span><select class="input" id="im-tgl">${opt(tebak(/tanggal|waktu|date|time/i))}</select></label>
            <label class="field"><span>Kolom jumlah komisi</span><select class="input" id="im-jml">${opt(tebak(/komisi|commission|penghasilan|pendapatan|earning|amount/i))}</select></label></div>
          <div class="row"><label class="field"><span>Saring kolom (opsional)</span><select class="input" id="im-fkol"><option value="">Tanpa saringan</option>${head.map((h, i) => `<option value="${i}">${esc(h || 'Kolom ' + (i + 1))}</option>`).join('')}</select></label>
            <label class="field"><span>Hanya baris yang berisi</span><input class="input" id="im-fval" placeholder="Misal: Selesai"><small>Untuk memakai pesanan yang selesai saja</small></label></div>
          <div id="im-hasil"></div></div>`;
        ['#im-tgl', '#im-jml', '#im-fkol'].forEach((s) => $(s, d).addEventListener('change', hitung));
        $('#im-fval', d).addEventListener('input', hitung);
        hitung();
      });
      simpan.addEventListener('click', async () => {
        simpan.disabled = true;
        try {
          const per = Object.fromEntries(Object.entries(hasil.per).map(([k, v]) => [k, Math.round(v)]));
          const g = await api('/api/goals/impor', { method: 'PUT', body: { bulan: per, sumber: $('#im-sumber', d).value, file: nama, baris: hasil.pakai } });
          S.goal = g;
          closeOverlay(); toast(`Omzet ${Object.keys(per).length} bulan diperbarui dari ${nama}`); render();
        } catch (e) { err.textContent = e.message; simpan.disabled = false; }
      });
    });
  }

  // ============ actions: newer pages ============
  async function aksiBaru(act, el, ev) {
    switch (act) {
      case 'notif-aktif': await aktifkanNotif(); break;
      case 'notif-mati': await matikanNotif(); break;
      case 'notif-coba': try { const r = await api('/api/push/coba', { method: 'POST' }); toast(r.terkirim ? 'Pesan percobaan dikirim' : 'Tidak ada perangkat yang menerima. Aktifkan ulang notifikasi.', !r.terkirim); } catch (e) { toast(e.message, true); } break;
      case 'impor-afiliasi': imporDialog(); break;
      case 'panduan-untuk': S.panduanUntuk = el.dataset.v; render(); break;
      case 'tutup-sambutan': try { localStorage.setItem('pt_sambutan', 'tutup'); } catch (e) { /* storage off */ } el.closest('.notice').remove(); break;
      case 'pf-periode': S.perfPeriode = +el.dataset.v; render(); break;
      case 'konten-orang': ev.preventDefault(); Object.assign(S.konten, { editor: el.dataset.id, periode: String(S.perfPeriode), page: 1 }); navigate('/konten'); break;
      case 'ajukan': ajukanDialog(el.dataset.v); break;
      case 'putuskan': putuskanDialog(el.dataset.id, el.dataset.v); break;
      case 'batal-pengajuan': {
        const row = S.pengajuan && S.pengajuan.list.find((p) => p.id === +el.dataset.id);
        if (!row) break;
        hapusDenganBatal('Pengajuan dibatalkan', '/api/pengajuan/' + row.id, {
          sembunyikan: () => { S.pengajuan.list = S.pengajuan.list.filter((p) => p !== row); render(); },
          kembalikan: () => { if (!S.pengajuan.list.includes(row)) S.pengajuan.list.push(row); render(); },
          sesudah: muatUlang,
        });
        break;
      }
      case 'ip-baru':
      case 'ip-abaikan': {
        el.disabled = true;
        try {
          if (act === 'ip-baru') {
            S.presensi.config = await api('/api/presensi/ip-kandidat', { method: 'PUT', body: { ip: el.dataset.ip, ganti: el.dataset.ganti === '1' } });
            toast('IP kantor diperbarui. Karyawan yang ditolak diberi kabar untuk absen lagi.');
          } else {
            await api('/api/presensi/ip-kandidat', { method: 'DELETE', body: { ip: el.dataset.ip } });
            S.presensi.config.ip_kandidat = null;
            toast('Usulan diabaikan');
          }
          render();
        } catch (e) { el.disabled = false; toast(e.message, true); }
        break;
      }
      case 'csv-gaji': exportGaji(); break;
      case 'csv-presensi': exportPresensi(); break;
      case 'atur-gaji': aturGajiDialog(el.dataset.id || 'umum'); break;
      case 'gaji-muat': delete S.gajiCache[S.gajiBulan]; render(); break;
      case 'gaji-ke': ev.preventDefault(); S.gajiBulan = el.dataset.v; render(); window.scrollTo({ top: 0 }); break;
      case 'slip': slipDialog(el.dataset.id); break;
      case 'cetak-slip': cetakSlip(el.dataset.id); break;
      case 'finalkan': {
        const b = S.gajiBulan;
        const G = S.gajiCache[b];
        const ids = el.dataset.v === 'semua' ? null : [+el.dataset.v];
        const names = G.list.filter((r) => r.status !== 'final' && (!ids || ids.includes(r.editor_id))).map((r) => r.nama);
        const jalan = b === today().slice(0, 7);
        confirmDialog(`Finalkan gaji ${bulanLabel(b)}?`, `${names.join(', ')}. Angka dikunci menjadi slip resmi dan tidak ikut berubah bila presensi, izin atau aturan berubah.${jalan ? ' Bulan ini belum selesai: hari-hari yang tersisa tidak akan terhitung.' : ''}`, 'Finalkan', async () => {
          try { await api('/api/gaji/final', { method: 'POST', body: { bulan: b, editor_ids: ids || undefined } }); toast('Gaji difinalkan'); await loadGaji(b); render(); } catch (e) { toast(e.message, true); }
        });
        break;
      }
      case 'buka-gaji':
        confirmDialog('Buka lagi gaji ini?', 'Slip final dihapus dan angka kembali menjadi perkiraan yang dihitung ulang dari data terbaru.', 'Buka lagi', async () => {
          try { await api(`/api/gaji/final?bulan=${S.gajiBulan}&editor_id=${el.dataset.id}`, { method: 'DELETE' }); toast('Gaji dibuka lagi'); await loadGaji(S.gajiBulan); render(); } catch (e) { toast(e.message, true); }
        });
        break;
      case 'dibayar':
        try { await api('/api/gaji/dibayar', { method: 'PUT', body: { bulan: S.gajiBulan, editor_id: +el.dataset.id, dibayar: el.dataset.v === '1' } }); toast(el.dataset.v === '1' ? 'Ditandai sudah dibayar' : 'Tanda dibayar dibatalkan'); await loadGaji(S.gajiBulan); render(); } catch (e) { toast(e.message, true); }
        break;
      case 'hapus-penyesuaian': {
        const id = el.closest('.dialog') && S.gajiCache[S.gajiBulan].list.find((r) => (r.penyesuaian || []).some((p) => p.id === +el.dataset.id));
        try { await api('/api/gaji/penyesuaian/' + el.dataset.id, { method: 'DELETE' }); await loadGaji(S.gajiBulan); if (id) slipDialog(id.editor_id); toast('Penyesuaian dihapus'); } catch (e) { toast(e.message, true); }
        break;
      }
      default: break;
    }
  }

  // ============ actions ============
  async function assign(ids, editorId) {
    try {
      for (const id of ids) await api(`/api/content/${id}/assign`, { method: 'POST', body: { editor_id: editorId } });
      ids.forEach((id) => { const c = S.content.find((x) => x.id === id); if (c) { c.editor_id = editorId; c.status_identifikasi = 'matched'; } });
      S.sel.clear();
      normalize();
      toast(ids.length + ' video ditetapkan ke ' + editorById(editorId).nama);
      render();
    } catch (e) { toast(e.message, true); }
  }

  async function refreshAktivitas() {
    const rows = await optional(api('/api/aktivitas?dari=' + addDays(today(), -60) + '&sampai=' + today()), 'Aktivitas');
    if (rows) { S.aktivitas = rows; normalize(); }
  }

  function openDialog(html, onMount) {
    const ov = $('#overlay');
    ov.innerHTML = `<div class="scrim" data-act="close-overlay"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
    const first = $('input, select, textarea, button', ov.querySelector('.dialog'));
    if (first) first.focus();
    if (onMount) onMount(ov.querySelector('.dialog'));
  }
  const closeOverlay = () => { $('#overlay').innerHTML = ''; };

  // Phone: the routes and account actions that don't fit in the bottom bar.
  function moreSheet() {
    const who = me();
    const theme = document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const tabs = TABS();
    const groups = S.session ? menuGroups().map((g) => ({ label: g.label, list: g.ids.map((id) => ROUTES.find((x) => x.id === id)).filter((r) => bisaBuka(r) && !tabs.includes(r.id)) })).filter((g) => g.list.length) : [];
    openDialog(`
      ${S.session ? `<div class="who">${who ? avatar(who, 'sm') : '<span class="ava sm" style="background:var(--ink);color:var(--paper)">P</span>'}<div class="t"><b>${who ? esc(who.nama) : 'Pemilik'}</b><small>${who ? peranLabel(who.peran) : 'Akses penuh'}</small></div></div>` : '<h2>Menu</h2>'}
      <div class="sheet-list">
        ${groups.map((g) => `<div class="sheet-label">${g.label}</div>` + g.list.map((r) => `<a href="${pathOf(r.id)}">${icon(r.icon)}${routeLabel(r)}${badgeOf(r.id) ? `<span class="count">${badgeOf(r.id)}</span>` : ''}</a>`).join('')).join('')}
        <div class="sheet-label">Akun</div>
        <button data-act="theme">${icon(dark ? 'sun' : 'moon')}${dark ? 'Mode terang' : 'Mode gelap'}</button>
        ${S.session ? `<button data-act="logout">${icon('out')}Keluar</button>` : `<button data-act="login">${icon('out')}Masuk</button>`}
      </div>`);
  }

  function confirmDialog(title, msg, okLabel, onOk) {
    openDialog(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="actions"><button class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`, (d) => {
      $('#ok', d).addEventListener('click', async () => { closeOverlay(); await onOk(); });
    });
  }

  async function loginDialog(tab = 'karyawan') {
    let eds = [];
    if (tab === 'karyawan') {
      try { eds = await api('/api/auth/karyawan'); } catch (e) { toast(e.message, true); }
    }
    openDialog(`
      <h2>Masuk</h2>
      <div class="seg" role="group" aria-label="Masuk sebagai"><button data-tab="karyawan" aria-pressed="${tab === 'karyawan'}">Karyawan</button><button data-tab="admin" aria-pressed="${tab === 'admin'}">Pemilik</button></div>
      <form id="login-form" class="dialog-form" style="display:flex;flex-direction:column;gap:12px">
        ${tab === 'karyawan' ? `
          <label class="field"><span>Nama</span><select class="input" name="editor" required>${eds.map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('') || '<option value="">Belum ada karyawan dengan PIN</option>'}</select></label>
          <label class="field"><span>PIN</span><input class="input" name="pin" type="password" inputmode="numeric" autocomplete="current-password" required><small>PIN diberikan pemilik. Belum punya? Minta pemilik mengaturnya di menu Karyawan.</small></label>`
        : `<label class="field"><span>Password pemilik</span><input class="input" name="password" type="password" autocomplete="current-password" required></label>`}
        <div class="err" id="login-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Masuk</button></div>
      </form>`, (d) => {
      $$('[data-tab]', d).forEach((b) => b.addEventListener('click', () => loginDialog(b.dataset.tab)));
      $('#login-form', d).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.target);
        try {
          const btn = $('button.primary', d);
          btn.disabled = true;
          try {
            if (tab === 'admin') await api('/api/auth/login', { method: 'POST', body: { password: f.get('password') } });
            else await api('/api/auth/editor-login', { method: 'POST', body: { editor_id: +f.get('editor'), pin: f.get('pin') } });
          } finally { btn.disabled = false; }
          closeOverlay();
          toast('Berhasil masuk');
          await load();
        } catch (e) { $('#login-err', d).textContent = e.message; }
      });
    });
  }

  function catatDialog(editorId) {
    const who = isAdmin() ? (editorById(editorId) || activeEditors()[0]) : me();
    if (!who) return loginDialog();
    const jenis = [...TUGAS.map((t) => t.nama), ...TUGAS_LAIN];
    openDialog(`
      <h2>Catat aktivitas</h2>
      <form id="catat-form" style="display:flex;flex-direction:column;gap:12px">
        ${isAdmin() ? `<label class="field"><span>Karyawan</span><select class="input" name="editor_id">${activeEditors().map((e) => `<option value="${e.id}" ${e.id === who.id ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}</select></label>` : `<p>Dicatat sebagai <b>${esc(who.nama)}</b>.</p>`}
        <div class="row">
          <label class="field"><span>Tanggal</span><input class="input" type="date" name="tanggal" value="${S.day > today() ? today() : S.day}" max="${today()}" required></label>
          <label class="field"><span>Jam selesai</span><input class="input" type="time" name="jam" value="${nowJam()}" required></label>
        </div>
        <div class="row">
          <label class="field"><span>Tugas</span><select class="input" name="tugas">${jenis.map((j) => `<option>${esc(j)}</option>`).join('')}</select></label>
          <label class="field"><span>Jumlah</span><input class="input" type="number" name="jumlah" min="1" max="9999" value="1" required><small>Komentar: jumlah yang dibalas</small></label>
        </div>
        <label class="field"><span>Channel</span><select class="input" name="channel_id"><option value="">Semua / tidak spesifik</option>${S.channels.map((c) => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
        <label class="field"><span>Keterangan</span><textarea class="input" name="detail" maxlength="300" placeholder="Misal: cek harga rawit di 5 pasar induk"></textarea></label>
        <div class="err" id="catat-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div>
      </form>`, (d) => {
      const tugas = $('[name=tugas]', d), jumlah = $('[name=jumlah]', d);
      tugas.addEventListener('change', () => { if (tugas.value === 'Balas komentar' && jumlah.value === '1') jumlah.value = '10'; });
      $('#catat-form', d).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const body = Object.fromEntries(new FormData(ev.target));
        body.editor_id = +(body.editor_id || who.id);
        body.jumlah = +body.jumlah;
        try {
          await api('/api/aktivitas', { method: 'POST', body });
          await refreshAktivitas();
          S.cache.clear();
          closeOverlay();
          S.day = body.tanggal;
          toast('Aktivitas tersimpan');
          if (route() !== 'harian') navigate('/harian'); else render();
        } catch (e) { $('#catat-err', d).textContent = e.message; }
      });
    });
  }

  function editorDialog(id) {
    const e = id ? editorById(id) : { nama: '', kode_identifikasi: '', peran: 'editor', jadwal: '', target_harian: 3, foto_url: '', status: 'aktif' };
    openDialog(`
      <h2>${id ? 'Ubah ' + esc(e.nama) : 'Tambah karyawan'}</h2>
      <form id="ed-form" style="display:flex;flex-direction:column;gap:12px">
        <div class="row">
          <label class="field"><span>Nama</span><input class="input" name="nama" value="${esc(e.nama)}" required maxlength="100"></label>
          <label class="field"><span>Kode</span><input class="input" name="kode" value="${esc(e.kode_identifikasi)}" required maxlength="20" style="text-transform:uppercase"><small>Ditulis di deskripsi video, misal #AL</small></label>
        </div>
        <div class="row">
          <label class="field"><span>Peran</span><select class="input" name="peran"><option value="editor" ${e.peran !== 'terbatas' ? 'selected' : ''}>Editor</option><option value="terbatas" ${e.peran === 'terbatas' ? 'selected' : ''}>Editor terbatas</option></select></label>
          <label class="field"><span>Status</span><select class="input" name="status"><option value="aktif" ${e.status !== 'nonaktif' ? 'selected' : ''}>Aktif</option><option value="nonaktif" ${e.status === 'nonaktif' ? 'selected' : ''}>Nonaktif</option></select></label>
        </div>
        <div class="row">
          <label class="field"><span>Jadwal tayang</span><input class="input mono" name="jadwal" value="${esc(slotsOf(e).join(', '))}" placeholder="06:00, 12:00, 18:00"><small>Jam WIB, pisahkan dengan koma</small></label>
          <label class="field"><span>Target video per hari</span><input class="input" type="number" name="target_harian" min="1" max="50" value="${targetOf(e)}"></label>
        </div>
        <label class="field"><span>Link foto (opsional)</span><input class="input" name="foto_url" type="url" value="${esc(e.foto_url || '')}" placeholder="https://…"><small>Kosongkan untuk memakai inisial nama</small></label>
        <label class="field"><span>${e.punya_pin ? 'PIN baru (kosongkan bila tidak diganti)' : 'PIN untuk masuk'}</span><input class="input" name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" autocomplete="new-password" placeholder="4–12 angka"></label>
        ${e.punya_pin ? '<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" name="hapus_pin"> Hapus PIN (karyawan tidak bisa masuk)</label>' : ''}
        <div class="err" id="ed-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div>
      </form>`, (d) => {
      $('#ed-form', d).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const body = Object.fromEntries(new FormData(ev.target));
        body.kode = body.kode.toUpperCase().replace(/^#/, '');
        body.hapus_pin = !!body.hapus_pin;
        if (body.pin && !/^\d{4,12}$/.test(body.pin)) { $('#ed-err', d).textContent = 'PIN harus 4–12 angka'; return; }
        if (!body.pin) delete body.pin;
        try {
          const saved = await api(id ? '/api/editors/' + id : '/api/editors', { method: id ? 'PUT' : 'POST', body });
          const i = S.editors.findIndex((x) => x.id === saved.id); if (i >= 0) S.editors[i] = saved; else S.editors.push(saved);
          normalize();
          closeOverlay();
          toast('Data karyawan tersimpan');
          render();
        } catch (e2) { $('#ed-err', d).textContent = e2.message; }
      });
    });
  }

  function goalDialog() {
    const g = S.goal || { bulan: today().slice(0, 7), target_omset: 0, tercapai: 0 };
    openDialog(`<h2>Target omzet afiliasi</h2><form id="goal-form" style="display:flex;flex-direction:column;gap:12px">
      <p>Bulan ${esc(g.bulan)}</p>
      <div class="row"><label class="field"><span>Target (Rp)</span><input class="input" type="number" name="target_omset" min="0" value="${+g.target_omset || 0}"></label>
      <label class="field"><span>Tercapai (Rp)</span><input class="input" type="number" name="tercapai" min="0" value="${+g.tercapai || 0}"></label></div>
      <div class="err" id="goal-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary">Simpan</button></div></form>`, (d) => {
      $('#goal-form', d).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = Object.fromEntries(new FormData(ev.target));
        try {
          const r = await api('/api/goals', { method: 'PUT', body: { bulan: g.bulan, target_omset: +f.target_omset, tercapai: +f.tercapai } });
          S.goal = r || { ...g, target_omset: +f.target_omset, tercapai: +f.tercapai };
          closeOverlay(); toast('Target tersimpan'); render();
        } catch (e) { $('#goal-err', d).textContent = e.message; }
      });
    });
  }

  function videoDrawer(id) {
    const c = S.content.find((x) => x.id === +id);
    if (!c) return;
    const e = editorById(c.editor_id);
    const connected = S.connected.has(c._ch);
    $('#overlay').innerHTML = `<div class="scrim" data-act="close-overlay" style="justify-content:flex-end;padding:0"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Detail video">
        <div class="drawer-top"><h2>${esc(c.judul)}</h2><button class="btn icon ghost" data-act="close-overlay" aria-label="Tutup">${icon('x')}</button></div>
        ${thumb(c) ? `<img class="hero" src="${thumb(c).replace('mqdefault', 'hqdefault')}" alt="">` : ''}
        <div class="muted">${esc(c._chNama)} · ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'} · ${tglPanjang(c._day)} jam ${c._jam} WIB · durasi ${durasi(c.duration_secs)}</div>
        <div class="stats"><div><span>Views</span><b>${nf.format(c.views)}</b></div><div><span>Like</span><b>${nf.format(c.likes)}</b></div><div><span>Komentar</span><b>${nf.format(c.comments)}</b></div>${isAdmin() ? `<div><span>Pendapatan</span><b>${rpOrDash(c.revenue)}</b></div>` : ''}</div>
        <div><div class="card-h" style="margin-bottom:6px"><h2>Pembuat</h2></div>
          ${editorCell(c)}
          ${canAssign() && (isAdmin() || belumDikenali(c)) ? `<div class="tools" style="margin-top:10px"><select class="input" id="dr-assign" style="width:auto"><option value="">${e ? 'Ganti pembuat…' : 'Tetapkan pembuat…'}</option>${activeEditors().map((x) => `<option value="${x.id}">${me() ? 'Ini video saya' : esc(x.nama)}</option>`).join('')}</select></div>` : ''}
        </div>
        <div><div class="card-h" style="margin-bottom:6px"><h2>Retensi penonton</h2><p>Dari YouTube Analytics.</p></div>
          <div class="chart" id="dr-ret" style="min-height:120px"><div class="skeleton" style="height:170px"></div></div></div>
        <a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener">${icon('ext')}Buka di YouTube</a>
      </aside>`;
    const box = $('#dr-ret');
    api('/api/content/' + c.id).then((full) => {
      if (!box.isConnected) return;
      let ret = full.retention_data;
      if (typeof ret === 'string') { try { ret = JSON.parse(ret); } catch (e) { ret = null; } }
      if (Array.isArray(ret) && ret.length) { drawRetention(box, ret); return; }
      // The server asked YouTube just now when nothing was stored; it says why there is no curve.
      const why = {
        tidak_tersambung: esc(c._chNama) + ' belum tersambung ke YouTube Analytics. ' + (isAdmin() ? 'Hubungkan di Pengaturan.' : 'Minta pemilik menghubungkannya di Pengaturan.'),
        error: esc(full.retensi_pesan || 'YouTube Analytics tidak bisa dihubungi.'),
        belum_ada: c._age < 3
          ? 'YouTube biasanya baru mengeluarkan retensi 2–3 hari setelah video tayang. Dicek ulang otomatis.'
          : 'YouTube belum punya kurva retensi untuk video ini, biasanya karena penontonnya masih sedikit. Dicek ulang paling lama 6 jam sekali.',
      }[full.retensi_status] || (connected ? 'Belum ada data dari YouTube Analytics.' : esc(c._chNama) + ' belum tersambung ke YouTube Analytics.');
      box.innerHTML = `<div class="empty"><b>${full.retensi_status === 'error' ? 'Retensi tidak bisa diambil' : 'Belum ada data retensi'}</b>${why}</div>`;
    }).catch((e) => { if (box.isConnected) box.innerHTML = `<div class="empty"><b>Retensi gagal dimuat</b>${esc(e.message)}</div>`; });
    const s = $('#dr-assign');
    if (s) s.addEventListener('change', () => { if (s.value) { closeOverlay(); assign([c.id], +s.value); } });
    $('.drawer .btn').focus();
  }

  // A CSV that opens in Excel and Google Sheets (UTF-8 with BOM).
  function unduhCsv(nama, head, rows) {
    // A text cell starting with = + - @ would run as a formula in Excel/Sheets: prefix it with a quote.
    const q = (v) => { if (typeof v === 'number') return String(v); let x = String(v ?? ''); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
    const csv = [head, ...rows].map((r) => r.map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nama + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportCsv() {
    unduhCsv('konten-tokder-' + today(), ['Tanggal', 'Jam (WIB)', 'Channel', 'Pembuat', 'Judul', 'Jenis', 'Views', 'Like', 'Komentar', 'Durasi (detik)', 'URL'],
      kontenRows().map((c) => [c._day, c._jam, c._chNama, (editorById(c.editor_id) || {}).nama || '', c.judul, c.tipe_video, c.views, c.likes, c.comments, c.duration_secs, c.url]));
  }
  function exportGaji() {
    const b = S.gajiBulan;
    const G = S.gajiCache[b];
    if (!G || !G.list) return toast('Data gaji belum termuat', true);
    const nilai = (r, label) => sum(r.baris.filter((x) => x.label === label), (x) => x.jumlah);
    unduhCsv('gaji-tokder-' + b, ['Bulan', 'Karyawan', 'Status', 'Hadir', 'Tidak hadir', 'Izin', 'Sakit', 'Cuti', 'Telat (kali)', 'Telat (menit)', 'Lembur (menit)', 'Video', 'Target video', 'Gaji pokok', 'Tunjangan', 'Tambahan lain', 'Potongan', 'Total', 'Dibayar'],
      G.list.map((r) => {
        const pokok = nilai(r, 'Gaji pokok'), tunj = nilai(r, 'Tunjangan');
        const plus = sum(r.baris.filter((x) => x.jumlah > 0), (x) => x.jumlah) - pokok - tunj;
        const minus = sum(r.baris.filter((x) => x.jumlah < 0), (x) => x.jumlah);
        return [b, r.nama, r.dibayar_at ? 'Dibayar' : r.status === 'final' ? 'Final' : 'Perkiraan', r.hari.hadir, r.hari.alpa, r.hari.izin, r.hari.sakit, r.hari.cuti, r.hari.telat, r.hari.telat_menit, r.hari.lembur_menit,
          r.video.jumlah, r.video.target, pokok, tunj, plus, minus, r.total, r.dibayar_at ? String(r.dibayar_at).slice(0, 10) : ''];
      }));
  }
  function exportPresensi() {
    const P = S.presensi;
    if (!P || !P.rows) return toast('Data presensi belum termuat', true);
    const hari = [...new Set(P.rows.map((r) => r.tanggal))].sort().reverse();
    const rows = [];
    hari.forEach((d) => activeEditors().forEach((e) => {
      const h = hariPresensi(P.rows, e.id, d);
      if (h.masuk || h.pulang) rows.push([d, e.nama, jamWib(h.masuk && h.masuk.waktu), jamWib(h.pulang && h.pulang.waktu), h.masuk ? h.masuk.telat_menit || 0 : '', h.masuk && h.masuk.jarak != null ? Math.round(h.masuk.jarak) : '']);
    }));
    unduhCsv('presensi-tokder-' + today(), ['Tanggal', 'Karyawan', 'Masuk', 'Pulang', 'Telat (menit)', 'Jarak (m)'], rows);
  }

  // Deleting waits 5 seconds with an Undo button; the request goes out only when time is up
  // (or right away when the page is closed), so a mis-tap costs nothing.
  const tertunda = new Map();
  function hapusDenganBatal(pesan, url, { sembunyikan, kembalikan, sesudah }) {
    const id = url + '|' + Date.now();
    sembunyikan();
    const t = document.createElement('div');
    t.className = 'toast undo';
    t.setAttribute('role', 'status');
    t.innerHTML = `<span>${esc(pesan)}</span><button type="button">Batalkan</button>`;
    document.querySelectorAll('.toast').forEach((x) => x.remove());
    document.body.append(t);
    const jalan = async () => {
      if (!tertunda.has(id)) return;
      tertunda.delete(id);
      t.remove();
      try { await api(url, { method: 'DELETE' }); if (sesudah) await sesudah(); } catch (e) { kembalikan(); toast(e.message, true); }
    };
    tertunda.set(id, url);
    $('button', t).addEventListener('click', () => { if (!tertunda.delete(id)) return; t.remove(); kembalikan(); toast('Dibatalkan'); });
    setTimeout(jalan, 5000);
  }
  window.addEventListener('pagehide', () => {
    tertunda.forEach((url) => { try { fetch(url, { method: 'DELETE', keepalive: true, credentials: 'same-origin' }); } catch (e) { /* closing anyway */ } });
    tertunda.clear();
  });

  document.addEventListener('click', async (ev) => {
    const a = ev.target.closest('a[href^="/"]');
    if (a && !a.dataset.act && !a.target && !a.hasAttribute('download') && ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey && !a.getAttribute('href').startsWith('/api/')) {
      ev.preventDefault();
      navigate(a.getAttribute('href'));
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'close-overlay') { if (ev.target === el || el.tagName === 'BUTTON' || el.tagName === 'A') closeOverlay(); return; }
    switch (act) {
      case 'login': closeOverlay(); loginDialog(); break;
      case 'lainnya': moreSheet(); break;
      case 'logout':
        closeOverlay();
        await matikanNotif(true);
        try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* the cookie is cleared or already invalid */ }
        saveSession(null); toast('Anda sudah keluar'); navigate('/'); break;
      case 'retry': S.error = null; $('#page').innerHTML = '<div class="skeleton" style="height:320px"></div>'; await load(); break;
      case 'theme': {
        closeOverlay();
        const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('pt_theme', next); } catch (e) { /* storage off */ }
        render();
        break;
      }
      case 'periode': S.periode = +el.dataset.v; render(); break;
      case 'hari': { const d = addDays(S.day, +el.dataset.v); if (d <= today()) { S.day = d; render(); } break; }
      case 'hari-ini': S.day = today(); render(); break;
      case 'ke-hari': S.day = el.dataset.v; render(); break;
      case 'lihat-orang': ev.preventDefault(); navigate('/harian/' + el.dataset.id); break;
      case 'catat': catatDialog(+el.dataset.id || null); break;
      case 'hapus-aktivitas': {
        const id = +el.dataset.id;
        const row = S.aktivitas.find((a) => a.id === id);
        if (!row) break;
        const ulang = () => { normalize(); render(); };
        hapusDenganBatal('Aktivitas dihapus', '/api/aktivitas/' + id, {
          sembunyikan: () => { S.aktivitas = S.aktivitas.filter((a) => a !== row); ulang(); },
          kembalikan: () => { if (!S.aktivitas.includes(row)) S.aktivitas.push(row); ulang(); },
          sesudah: async () => { await refreshAktivitas(); if (!$('#overlay').innerHTML) render(); },
        });
        break;
      }
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
      case 'presensi-muat': S.presensi = null; render(); break;
      case 'presensi-lokasi': {
        const info = $('#lokasi-info');
        try {
          info.textContent = 'Membaca lokasi…';
          const pos = await ambilLokasi(15, (acc) => { info.textContent = `Membaca lokasi… ± ${Math.round(acc)} m`; });
          const f = $('#presensi-form');
          f.lat.value = pos.coords.latitude.toFixed(6);
          f.lng.value = pos.coords.longitude.toFixed(6);
          info.textContent = `Terisi (akurasi ± ${Math.round(pos.coords.accuracy)} m). Klik Simpan aturan.`;
        } catch (e) { info.textContent = e.message; }
        break;
      }
      case 'presensi-ip': {
        const f = $('#presensi-form');
        const list = f.ips.value.split(/\s+/).filter(Boolean);
        if (!list.includes(el.dataset.ip)) list.push(el.dataset.ip);
        f.ips.value = list.join('\n');
        break;
      }
      case 'an-periode': S.anPeriode = +el.dataset.v; render(); break;
      default: await aksiBaru(act, el, ev); break;
      case 'putus-analytics': {
        const c = analyticsChannels(true).find((x) => x.id === el.dataset.id);
        confirmDialog('Putuskan ' + c.nama + '?', 'Angka YouTube Analytics yang sudah tersimpan tetap ada, tapi tidak diperbarui lagi sampai dihubungkan ulang.', 'Putuskan', async () => {
          try { await api('/api/auth/google/' + encodeURIComponent(c.id), { method: 'DELETE' }); S.oauth = await optional(api('/api/auth/status'), 'Status YouTube Analytics'); normalize(); toast(c.nama + ' diputuskan'); render(); } catch (e) { toast(e.message, true); }
        });
        break;
      }
      case 'putus-sosmed': {
        const k = ((S.sosmed && S.sosmed.platforms) || []).flatMap((p) => p.koneksi).find((x) => String(x.id) === el.dataset.id);
        if (!k) break;
        confirmDialog('Putuskan ' + (k.nama || 'akun') + '?', 'Token dihapus dan semua posting akun ini yang tersimpan di Pantau Tokder ikut dihapus. Akun aslinya tidak berubah.', 'Putuskan', async () => {
          try { await api('/api/social/koneksi/' + encodeURIComponent(k.id), { method: 'DELETE' }); await refresh(); toast((k.nama || 'Akun') + ' diputuskan'); } catch (e) { toast(e.message, true); }
        });
        break;
      }
      case 'sync-sosmed': {
        el.disabled = true; el.innerHTML = icon('sync') + 'Menarik…';
        try { const r = await api('/api/social/sync', { method: 'POST', timeout: 60000 }); toast(r.akun ? `${r.akun} akun, ${r.posts} posting` + (r.galat.length ? ' · ' + r.galat[0] : '') : 'Belum ada akun tersambung'); await refresh(); } catch (e) { toast(e.message, true); render(); }
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
    }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#overlay').innerHTML) closeOverlay(); });
  window.addEventListener('popstate', () => { closeOverlay(); render(); });
  // Old links used #route (/#presensi, /#harian/3): move them to the real path.
  const fromHash = () => { if (location.pathname === '/' && /^#[a-z]/.test(location.hash)) { history.replaceState(null, '', '/' + location.hash.slice(1)); return true; } return false; };
  window.addEventListener('hashchange', () => { if (fromHash()) { closeOverlay(); render(); } });
  fromHash();
  let lastW = innerWidth, rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; if (!$('#overlay').innerHTML) render(); } }, 200); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderNav());

  load();
})();
