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
  const usd = (v) => (v == null || isNaN(v) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v));
  const idr = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v || 0);
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
    money: '<path d="M12 2v20M17 6.5c-.8-1.5-2.6-2.5-5-2.5-3 0-5 1.5-5 3.7 0 5 10 2.6 10 7.6 0 2.2-2 3.7-5 3.7-2.6 0-4.5-1-5.3-2.6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
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
    ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5"/>',
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
    session: readSession(),
    periode: 7, channel: 'all', day: null,
    konten: { q: '', channel: 'all', editor: 'all', tipe: 'all', periode: '30', sort: 'tanggal', dir: 'desc', page: 1 },
    sel: new Set(),
    cache: new Map(),
  };

  function readSession() {
    try {
      const s = JSON.parse(localStorage.getItem('pt_session') || 'null');
      if (s) return s;
      const old = localStorage.getItem('adminToken'); // sesi dari versi lama
      if (old) return { type: 'admin', password: old };
    } catch (e) { /* storage off */ }
    return null;
  }
  function saveSession(s) {
    S.session = s;
    try {
      if (s) localStorage.setItem('pt_session', JSON.stringify(s)); else localStorage.removeItem('pt_session');
      localStorage.removeItem('adminToken');
    } catch (e) { /* storage off */ }
  }
  const isAdmin = () => S.session && S.session.type === 'admin';
  const me = () => (S.session && S.session.type === 'karyawan' ? S.editors.find((e) => e.id === S.session.id) || null : null);
  const canLog = () => isAdmin() || !!me();
  const canAssign = () => isAdmin() || (me() && (me().peran || 'editor') === 'editor');

  // ============ api ============
  function authHeaders() {
    const s = S.session;
    if (!s) return {};
    if (s.type === 'admin') return { 'x-admin-password': s.password };
    return { 'x-editor-id': String(s.id), 'x-editor-pin': s.pin };
  }
  async function api(path, opts = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 20000);
    let res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      // A changed password or PIN makes the saved session useless: sign out instead of failing silently.
      if (res.status === 401 && S.session && !path.includes('/api/auth/login') && !path.includes('editor-login')) {
        saveSession(null);
        renderNav();
        err.message = 'Sesi Anda tidak berlaku lagi (password atau PIN sudah berubah). Silakan masuk ulang.';
      }
      throw err;
    }
    if (data === null) throw new Error('Jawaban server tidak bisa dibaca. Coba lagi.');
    return data;
  }
  // Secondary data may fail on its own; the page still shows what loaded and says what did not.
  const optional = (p, label) => p.catch((e) => { S.warnings.push(label + ': ' + e.message); return null; });

  async function fetchAll() {
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

  async function load() {
    try {
      await fetchAll();
    } catch (e) {
      console.error(e);
      S.error = e.message;
    }
    render();
    autoSync();
  }

  // Quiet refresh: new numbers without losing the open dialog or scroll position.
  let refreshing = false;
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      await fetchAll();
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
    if (syncing || S.error) return;
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
  }

  const editorById = (id) => S.editors.find((e) => e.id === +id) || null;
  const activeEditors = () => S.editors.filter((e) => e.status !== 'nonaktif');
  const chName = (id) => (S.channels.find((c) => c.id === id) || {}).nama || 'Channel utama';
  const chColor = (id) => (S.channels.find((c) => c.id === id) || {})._color || 'var(--muted)';
  // Monitored channels with their YouTube Analytics connection state.
  function analyticsChannels() {
    const st = (S.oauth && S.oauth.channels) || [];
    const ids = [...new Set([...S.channels.map((c) => c.id), ...st.map((c) => c.id)])];
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
    const target = Math.round(targetOf(e) * frac);
    const tTarget = Object.fromEntries(TUGAS.map((t) => [t.nama, t.target(target, frac)]));
    const vids = S.content.filter((c) => c.editor_id === e.id && c._day === day).sort((a, b) => a._jam.localeCompare(b._jam));
    vids.forEach((v) => { const m = slotFor(e, v._jam); v._slot = m && m.slot; v._late = m ? m.late : null; v._tepat = m ? m.late <= TOL : null; });
    const tasks = S.aktivitas.filter((a) => a.editor_id === e.id && a.tanggal === day);
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
      e, day, target, tTarget, partial, vids, n, tepat, telat: withSlot.length - tepat, withSlot: withSlot.length, tasks, done,
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
  const editorCell = (c) => { const e = editorById(c.editor_id); return e ? `<span class="ed">${avatar(e, 'xs')}${esc(e.nama)}</span>` : '<span class="pill warn">Belum dikenali</span>'; };

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

  function drawRetention(box, data) {
    const W = Math.max(260, box.clientWidth), H = 170, m = { t: 8, r: 8, b: 22, l: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const x = (p) => m.l + (p / 100) * iw, y = (v) => m.t + ih - (Math.min(v, 120) / 120) * ih;
    let html = '';
    [0, 25, 50, 75, 100].forEach((t) => { html += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--chart-grid)"/><text x="${m.l - 6}" y="${y(t)}" dy="0.32em" text-anchor="end">${t}%</text>`; });
    [0, 50, 100].forEach((t) => { html += `<text x="${x(t)}" y="${H - 5}" text-anchor="${t === 0 ? 'start' : t === 100 ? 'end' : 'middle'}">${t === 0 ? 'Awal' : t === 100 ? 'Akhir' : 'Tengah'}</text>`; });
    const pts = data.map((d) => `${x(d.percent_duration)},${y(d.retention)}`).join(' ');
    html += `<polyline points="${pts}" fill="none" stroke="var(--leaf)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Grafik retensi penonton">${html}</svg>`;
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
    { id: 'ringkasan', label: 'Ringkasan', icon: 'home' },
    { id: 'harian', label: 'Harian', icon: 'day' },
    { id: 'konten', label: 'Konten', icon: 'video' },
    { id: 'analytics', label: 'Analytics', icon: 'chart' },
    { id: 'identifikasi', label: 'Belum dikenali', icon: 'help' },
    { id: 'karyawan', label: 'Karyawan', icon: 'team' },
    { id: 'monetisasi', label: 'Pendapatan', icon: 'money', admin: true },
    { id: 'pengaturan', label: 'Pengaturan', icon: 'gear', admin: true },
  ];
  function route() {
    const h = location.hash.slice(1).split('/')[0];
    const r = ROUTES.find((x) => x.id === h);
    if (!r || (r.admin && !isAdmin())) return me() ? 'harian' : 'ringkasan';
    return r.id;
  }

  function renderNav() {
    const cur = route();
    const unmatched = S.content.filter((c) => !editorById(c.editor_id)).length;
    $('#nav').innerHTML = ROUTES.filter((r) => !r.admin || isAdmin()).map((r, i) =>
      (r.admin && !ROUTES.slice(0, ROUTES.indexOf(r)).some((x) => x.admin) ? '<div class="nav-label">Pemilik</div>' : '') +
      `<a href="#${r.id}" ${r.id === cur ? 'aria-current="page"' : ''}>${icon(r.icon)}<span>${r.label}</span>${r.id === 'identifikasi' && unmatched ? `<span class="count">${unmatched}</span>` : ''}</a>`
    ).join('');
    const who = me();
    const theme = document.documentElement.dataset.theme;
    const dark = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    const last = lastScanAt();
    $('#side-foot').innerHTML = `
      <div class="fresh" title="Data YouTube ditarik otomatis tiap 15 menit selama aplikasi terbuka">${syncing ? '<span class="dot live"></span>Memperbarui data YouTube…' : last ? `<span class="dot"></span>YouTube diperbarui ${agoText(last)}` : 'Belum pernah sinkron'}</div>
      ${S.session ? `<div class="who">${who ? avatar(who, 'sm') : '<span class="ava sm" style="background:var(--ink)">P</span>'}<div class="t"><b>${who ? esc(who.nama) : 'Pemilik'}</b><small>${who ? peranLabel(who.peran) : 'Akses penuh'}</small></div></div>` : ''}
      <div class="side-actions">
        ${S.session ? `<button class="btn sm ghost" data-act="logout">${icon('out')}Keluar</button>` : `<button class="btn sm primary" data-act="login">Masuk</button>`}
        <button class="btn sm ghost icon" data-act="theme" aria-label="${dark ? 'Mode terang' : 'Mode gelap'}">${icon(dark ? 'sun' : 'moon')}</button>
      </div>`;
    $('#notice').innerHTML = S.warnings.length && !S.error
      ? `<div class="notice" role="status"><b>Sebagian data tidak termuat.</b> ${S.warnings.map(esc).join(' · ')} <button class="btn sm ghost" data-act="retry">Coba lagi</button></div>`
      : '';
  }

  function render() {
    renderNav();
    const r = route();
    const page = $('#page');
    if (S.error) {
      page.innerHTML = `<section class="card empty" style="padding:48px 20px" role="alert"><b style="font-size:16px">Data belum bisa dimuat</b><p style="margin:6px 0 16px">${esc(S.error)}</p><button class="btn primary" data-act="retry">${icon('sync')}Coba lagi</button></section>`;
      return;
    }
    page.innerHTML = PAGES[r]();
    page.dataset.route = r;
    (AFTER[r] || (() => {}))();
    document.title = (ROUTES.find((x) => x.id === r) || {}).label + ' · Pantau Tokder';
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
      const unmatched = S.content.filter((c) => !editorById(c.editor_id)).length;
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
        <section class="kpis" aria-label="Angka utama">
          <div class="kpi"><span class="l">Video tayang</span><span class="v">${nf.format(vids.length)}${target && S.channel === 'all' ? ` <small>/ ${nf.format(target)}</small>` : ''}</span><span class="d ${vids.length >= vidsPrev.length ? 'ok' : 'bad'}">${signed(vids.length - vidsPrev.length)} dari periode sebelumnya</span></div>
          <div class="kpi"><span class="l">Views video baru</span><span class="v">${fmt(sum(vids, (c) => c.views))}</span><span class="d">${fmt(sum(vidsPrev, (c) => c.views))} di periode sebelumnya</span></div>
          <div class="kpi"><span class="l">Median views per video</span><span class="v">${fmt(median(mature.map((c) => c.views)))}</span><span class="d">video berumur ≥ 2 hari</span></div>
          <div class="kpi"><span class="l">Tepat jadwal</span><span class="v ${tepat == null ? '' : tepat >= 0.85 ? 'ok' : tepat >= 0.7 ? 'warn' : 'bad'}">${pct(tepat)}</span><span class="d">telat &gt; ${TOL} menit dihitung telat</span></div>
          <a class="kpi ${unmatched ? 'alert' : ''}" href="#identifikasi"><span class="l">Belum dikenali</span><span class="v">${nf.format(unmatched)}</span><span class="d">${unmatched ? 'Tetapkan pembuatnya →' : 'Semua video sudah dikenali'}</span></a>
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
              <a class="rank-row" href="#harian" data-act="lihat-orang" data-id="${s.e.id}" style="text-decoration:none">
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
            ${vids.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Video</th><th>Pembuat</th><th>Tayang</th><th class="num">Views</th><th class="num">Like</th><th class="num">Komentar</th></tr></thead><tbody>
              ${[...vids].sort((a, b) => b.views - a.views).slice(0, 5).map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td>${vidCell(c)}</td><td>${editorCell(c)}</td><td class="mono">${tglPendek(c._day)} ${c._jam}</td><td class="num">${nf.format(c.views)}</td><td class="num">${nf.format(c.likes)}</td><td class="num">${nf.format(c.comments)}</td></tr>`).join('')}
            </tbody></table></div>` : '<div class="empty"><b>Belum ada video di periode ini</b>Jalankan sinkronisasi di Pengaturan bila seharusnya sudah ada.</div>'}
          </section>
        </div>`;
    },

    harian() {
      const day = S.day;
      const team = activeEditors();
      const mine = me();
      const order = mine ? [mine, ...team.filter((e) => e.id !== mine.id)] : team;
      const list = order.map((e) => dayStats(e, day));
      const gaps = (st) => {
        const g = [];
        if (st.n < st.target) g.push((st.target - st.n) + ' video kurang');
        if (st.telat) g.push(st.telat + ' telat');
        if (S.aktivitas.length) TUGAS.forEach((t) => { if (st.done(t.nama) < st.tTarget[t.nama]) g.push(t.short.toLowerCase() + ' ' + st.done(t.nama) + '/' + st.tTarget[t.nama]); });
        return g;
      };
      const sentence = list.length
        ? list.map((st) => { const g = gaps(st); return `${esc(st.e.nama)}: <b>${st.n}</b> dari ${st.target} video, skor <b>${st.skor ?? '—'}</b>${g.length ? ' (' + esc(g.slice(0, 3).join(', ')) + ')' : ', semua beres'}`; }).join('. ') + '.'
        : 'Belum ada karyawan aktif.';
      const isToday = day === today();
      return `
        <header class="head">
          <div><h1>${mine ? 'Halo, ' + esc(mine.nama) : 'Harian'}</h1><p><span class="muted">${tglPanjang(day)}${isToday ? ' · hari ini, sampai jam ' + nowJam() : ''}.</span> ${sentence}</p></div>
          <div class="tools">
            <div class="daynav">
              <button class="btn icon" data-act="hari" data-v="-1" aria-label="Hari sebelumnya">${icon('left')}</button>
              <input class="input" type="date" id="f-day" value="${day}" max="${today()}" aria-label="Tanggal">
              <button class="btn icon" data-act="hari" data-v="1" aria-label="Hari berikutnya" ${isToday ? 'disabled' : ''}>${icon('right')}</button>
            </div>
            ${!isToday ? '<button class="btn ghost" data-act="hari-ini">Hari ini</button>' : ''}
            ${canLog() ? `<button class="btn primary" data-act="catat">${icon('plus')}Catat aktivitas</button>` : ''}
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
          <div><h1>Konten</h1><p>${nf.format(rows.length)} video sesuai filter, total <b>${fmt(sum(rows, (c) => c.views))}</b> views.</p></div>
          <div class="tools"><button class="btn" data-act="csv">${icon('download')}Unduh CSV</button></div>
        </header>
        <section class="card">
          <div class="tools" style="margin-bottom:12px">
            <label class="search">${icon('search')}<input class="input" type="search" id="k-q" placeholder="Cari judul" value="${esc(k.q)}" aria-label="Cari judul"></label>
            <select class="input" id="k-channel" style="width:auto" aria-label="Channel"><option value="all">Semua channel</option>${S.channels.map((c) => `<option value="${esc(c.id)}" ${k.channel === c.id ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>
            <select class="input" id="k-editor" style="width:auto" aria-label="Pembuat"><option value="all">Semua pembuat</option>${S.editors.map((e) => `<option value="${e.id}" ${k.editor === String(e.id) ? 'selected' : ''}>${esc(e.nama)}</option>`).join('')}<option value="none" ${k.editor === 'none' ? 'selected' : ''}>Belum dikenali</option></select>
            <select class="input" id="k-tipe" style="width:auto" aria-label="Jenis"><option value="all">Semua jenis</option><option value="short" ${k.tipe === 'short' ? 'selected' : ''}>Shorts</option><option value="long" ${k.tipe === 'long' ? 'selected' : ''}>Video panjang</option></select>
            <select class="input" id="k-periode" style="width:auto" aria-label="Periode"><option value="7" ${k.periode === '7' ? 'selected' : ''}>7 hari</option><option value="30" ${k.periode === '30' ? 'selected' : ''}>30 hari</option><option value="90" ${k.periode === '90' ? 'selected' : ''}>90 hari</option><option value="all" ${k.periode === 'all' ? 'selected' : ''}>Semua</option></select>
          </div>
          ${shown.length ? `<div class="table-wrap"><table class="t"><thead><tr>${th('judul', 'Video')}${th('editor', 'Pembuat')}${th('tanggal', 'Tayang (WIB)')}${th('views', 'Views', 'num')}${th('likes', 'Like', 'num')}${th('comments', 'Komentar', 'num')}${th('durasi', 'Durasi', 'num')}</tr></thead><tbody>
            ${shown.map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td>${vidCell(c)}</td><td>${editorCell(c)}</td><td class="mono">${tglPendek(c._day)} ${c._jam}</td><td class="num">${nf.format(c.views)}</td><td class="num">${nf.format(c.likes)}</td><td class="num">${nf.format(c.comments)}</td><td class="num mono">${durasi(c.duration_secs)}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="pager"><span>Menampilkan ${(k.page - 1) * per + 1}–${(k.page - 1) * per + shown.length} dari ${nf.format(rows.length)}</span>
            <span class="tools"><button class="btn sm" data-act="page" data-v="-1" ${k.page <= 1 ? 'disabled' : ''}>${icon('left')}Sebelumnya</button><span>Hal. ${k.page}/${pages}</span><button class="btn sm" data-act="page" data-v="1" ${k.page >= pages ? 'disabled' : ''}>Berikutnya${icon('right')}</button></span></div>`
          : '<div class="empty"><b>Tidak ada video yang cocok</b>Ubah filter atau kata pencarian.</div>'}
        </section>`;
    },

    identifikasi() {
      const rows = S.content.filter((c) => !editorById(c.editor_id)).sort((a, b) => b.tanggal_upload.localeCompare(a.tanggal_upload));
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
          <div class="table-wrap"><table class="t"><thead><tr>${allowed ? '<th style="width:32px"><input type="checkbox" id="sel-all" aria-label="Pilih semua"></th>' : ''}<th>Video</th><th>Tayang (WIB)</th><th class="num">Views</th>${allowed ? '<th>Pembuat</th>' : ''}</tr></thead><tbody>
            ${rows.map((c) => `<tr>${allowed ? `<td><input type="checkbox" data-sel="${c.id}" ${S.sel.has(c.id) ? 'checked' : ''} aria-label="Pilih ${esc(c.judul)}"></td>` : ''}<td><a href="#identifikasi" data-act="video" data-id="${c.id}" style="text-decoration:none">${vidCell(c)}</a></td><td class="mono">${tglPendek(c._day)} ${c._jam}</td><td class="num">${nf.format(c.views)}</td>${allowed ? `<td><select class="input" data-assign="${c.id}" style="width:auto" aria-label="Pembuat"><option value="">Pilih…</option>${activeEditors().map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select></td>` : ''}</tr>`).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Semua video sudah dikenali</b>Video baru tanpa kode akan muncul di sini setelah sinkronisasi.</div>'}
        </section>`;
    },

    karyawan() {
      const days = daysBack(7);
      return `
        <header class="head">
          <div><h1>Karyawan</h1><p>Kode dipakai untuk mengenali video dari deskripsinya. Jadwal dipakai untuk menilai tepat atau telat. PIN dipakai karyawan untuk masuk dan mencatat aktivitas.</p></div>
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
          <div class="table-wrap"><table class="t"><thead><tr><th>Bisa…</th><th>Pemilik</th><th>Editor</th><th>Editor terbatas</th><th>Tanpa masuk</th></tr></thead><tbody>
            <tr><td>Melihat ringkasan, harian, konten</td><td>Ya</td><td>Ya</td><td>Ya</td><td>Ya</td></tr>
            <tr><td>Mencatat aktivitas sendiri</td><td>Ya (siapa pun)</td><td>Ya</td><td>Ya</td><td>—</td></tr>
            <tr><td>Menetapkan pembuat video</td><td>Ya</td><td>Ya</td><td>—</td><td>—</td></tr>
            <tr><td>Mengatur karyawan, sinkronisasi, pendapatan</td><td>Ya</td><td>—</td><td>—</td><td>—</td></tr>
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
          ${showRev ? `<div class="kpi"><span class="l">Perkiraan pendapatan</span><span class="v">${usd(cur.rev)}</span>${change(cur.rev, pv.rev)}</div>` : ''}
        </section>
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
                ${isAdmin() && t.rev != null ? `<div class="mini"><h3>Pendapatan</h3><div class="v">${usd(t.rev)}</div>${change(t.rev, p.rev)}</div>` : `<div class="mini"><h3>Video baru</h3><div class="v">${nf.format(S.content.filter((x) => x._ch === c.id && days.includes(x._day)).length)}</div><div class="d">di periode ini</div></div>`}
              </div>
              <div class="chart an-spark" data-ch="${esc(c.id)}" style="margin-top:12px"></div>`
            : `<div class="empty"><b>${c.connected ? 'Menunggu data' : 'Belum ada data'}</b>${c.connected ? 'Klik Sinkronkan sekarang di Pengaturan.' : 'Hubungkan channel ini di Pengaturan.'}</div>`}
          </section>`;
        }).join('')}</div>
        <section class="card">
          <div class="card-h"><h2>Perbandingan channel</h2><p>${S.anPeriode} hari sampai ${latest ? tglPendek(latest) : '—'}.</p></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>Channel</th><th class="num">Views</th><th class="num">Jam tonton</th><th class="num">Ditonton / view</th><th class="num">Sub baru</th><th class="num">Berhenti</th><th class="num">Bersih</th>${showRev ? '<th class="num">Pendapatan</th>' : ''}<th class="num">Video baru</th></tr></thead><tbody>
            ${chans.map((c) => { const t = tot(pick([c.id], days)); if (!pick([c.id], days).length) return `<tr><td><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></td><td colspan="${showRev ? 8 : 7}" class="muted">Belum ada data${c.connected ? '' : ' · belum tersambung'}</td></tr>`; return `<tr><td><span class="ed"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${chColor(c.id)}"></i>${esc(c.nama)}</span></td><td class="num">${nf.format(t.views)}</td><td class="num">${jamMenit(t.menit)}</td><td class="num mono">${avgDur(t)}</td><td class="num">${nf.format(t.naik)}</td><td class="num">${nf.format(t.turun)}</td><td class="num">${signed(t.naik - t.turun)}</td>${showRev ? `<td class="num">${t.rev == null ? '—' : usd(t.rev)}</td>` : ''}<td class="num">${nf.format(S.content.filter((x) => x._ch === c.id && days.includes(x._day)).length)}</td></tr>`; }).join('')}
          </tbody></table></div>
        </section>`;
    },

    monetisasi() {
      const rows = S.content;
      const total = sum(rows, (c) => c.revenue || 0);
      const month = today().slice(0, 7);
      const thisMonth = rows.filter((c) => c._day.slice(0, 7) === month);
      const by = (keyFn, nameFn) => {
        const m = new Map();
        rows.forEach((c) => { const k = keyFn(c); m.set(k, (m.get(k) || 0) + (c.revenue || 0)); });
        return [...m.entries()].map(([k, v]) => ({ k, nama: nameFn(k), v })).sort((a, b) => b.v - a.v);
      };
      const perEditor = by((c) => (editorById(c.editor_id) ? c.editor_id : 0), (k) => (k ? editorById(k).nama : 'Belum dikenali'));
      const perCh = by((c) => c._ch, chName);
      const maxE = Math.max(...perEditor.map((x) => x.v), 0.01), maxC = Math.max(...perCh.map((x) => x.v), 0.01);
      const g = S.goal || { target_omset: 0, tercapai: 0 };
      const gp = g.target_omset ? Math.min(1, g.tercapai / g.target_omset) : 0;
      return `
        <header class="head"><div><h1>Pendapatan</h1><p>Perkiraan pendapatan iklan dari YouTube Analytics (dalam US$, sesuai laporan YouTube), ditambah target omzet afiliasi bulanan.</p></div></header>
        <section class="kpis">
          <div class="kpi"><span class="l">Pendapatan iklan, semua video tercatat</span><span class="v">${usd(total)}</span><span class="d">${nf.format(rows.filter((c) => c.revenue > 0).length)} video menghasilkan</span></div>
          <div class="kpi"><span class="l">Video bulan ini</span><span class="v">${usd(sum(thisMonth, (c) => c.revenue || 0))}</span><span class="d">dari ${nf.format(thisMonth.length)} video tayang bulan ini</span></div>
          <div class="kpi"><span class="l">Omzet afiliasi bulan ini</span><span class="v">${idr(g.tercapai)}</span><span class="d">target ${idr(g.target_omset)}</span></div>
        </section>
        <div class="grid-2">
          <section class="card"><div class="card-h"><h2>Target omzet afiliasi</h2><button class="btn sm" data-act="goal">Ubah</button></div>
            <div class="goal-v">${pct(gp)}</div><div class="goal-bar"><i style="width:${gp * 100}%"></i></div>
            <div class="muted">${idr(g.tercapai)} dari ${idr(g.target_omset)} · sisa ${idr(Math.max(0, g.target_omset - g.tercapai))}</div></section>
          <section class="card"><div class="card-h"><h2>Per karyawan</h2></div><div class="rank">${perEditor.map((x) => `<div class="rank-row">${avatar(editorById(x.k), 'sm')}<div class="tx"><b>${esc(x.nama)}</b><div class="bar"><i style="width:${(x.v / maxE) * 100}%"></i></div></div><b>${usd(x.v)}</b></div>`).join('')}</div></section>
          <section class="card"><div class="card-h"><h2>Per channel</h2></div><div class="rank">${perCh.map((x) => `<div class="rank-row"><span></span><div class="tx"><b>${esc(x.nama)}</b><div class="bar"><i style="width:${(x.v / maxC) * 100}%"></i></div></div><b>${usd(x.v)}</b></div>`).join('')}</div></section>
          <section class="card"><div class="card-h"><h2>Video dengan pendapatan tertinggi</h2></div>
            <div class="table-wrap"><table class="t"><tbody>${[...rows].filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((c) => `<tr class="click" data-act="video" data-id="${c.id}"><td>${vidCell(c)}</td><td class="num"><b>${usd(c.revenue)}</b></td></tr>`).join('')}</tbody></table></div></section>
        </div>`;
    },

    pengaturan() {
      const sc = S.scan || {};
      const last = sc.last_scan;
      const item = (ok, title, desc, action = '') => `<div class="ck"><span class="st ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '!'}</span><div><b>${title}</b><div>${desc}</div></div>${action}</div>`;
      return `
        <header class="head"><div><h1>Pengaturan</h1><p>Sambungan data, sinkronisasi video dan keamanan.</p></div>
          <div class="tools"><button class="btn primary" data-act="sync">${icon('sync')}Sinkronkan sekarang</button></div></header>
        <div class="grid-2">
          <section class="card"><div class="card-h"><h2>Sambungan</h2><p>${last ? 'Sinkronisasi terakhir ' + new Date(last.waktu_scan || last.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) + ' · ' + (last.jumlah_post_baru ?? 0) + ' video baru' : 'Belum ada catatan sinkronisasi.'}</p></div>
            <div class="checklist">
              ${item(sc.database_url, 'Database', sc.database_url ? 'Tersambung' : 'Isi DATABASE_URL di Vercel')}
              ${item(sc.youtube_api_key, 'YouTube Data API', sc.youtube_api_key ? 'Kunci API terpasang' : 'Isi YOUTUBE_API_KEY di Vercel')}
              ${item((sc.youtube_channels || 0) >= 3, 'Channel dipantau', (sc.youtube_channels || 0) + ' channel' + ((sc.youtube_channels || 0) < 3 ? '. Tambahkan ketiga channel di kartu Channel.' : ''))}
              ${analyticsChannels().map((c) => item(c.connected, 'Analytics: ' + esc(c.nama), c.connected ? 'Terhubung' + (c.connected_at ? ' sejak ' + new Date(c.connected_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '') : 'Belum terhubung: retensi, jam tonton dan pendapatan belum terbaca',
                c.connected ? `<button class="btn sm ghost danger" data-act="putus-analytics" data-id="${esc(c.id)}">Putuskan</button>` : `<a class="btn sm" href="/api/auth/google">Hubungkan</a>`)).join('')}
            </div></section>
          <section class="card"><div class="card-h"><h2>Channel</h2><p>Channel yang videonya ditarik saat sinkronisasi.</p></div>
            <div class="rank">${S.channels.map((c) => `<div class="rank-row"><span></span><div class="tx"><b>${esc(c.nama)}</b><div class="mono">${esc(c.id)}</div></div><span class="muted">${nf.format(S.content.filter((x) => x._ch === c.id).length)} video</span></div>`).join('') || '<div class="empty">Belum ada channel.</div>'}</div>
            <form id="ch-form" style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
              <label class="field"><span>Ganti daftar channel</span><textarea class="input mono" name="channels" rows="3" placeholder="@tokder&#10;https://www.youtube.com/@budidayacabe&#10;UCxxxxxxxxxxxxxxxxxxxxxx">${esc(S.channels.map((c) => c.id).join('\n'))}</textarea>
                <small>Satu channel per baris: link channel, @handle, atau ID (UC…). Setelah disimpan, klik Sinkronkan sekarang.</small></label>
              <div class="err" id="ch-err" role="alert" style="color:var(--bad);font-size:13px"></div>
              <div><button class="btn">Simpan channel</button></div>
            </form></section>
          <section class="card"><div class="card-h"><h2>Password pemilik</h2><p>Dipakai untuk masuk sebagai pemilik. Ganti dari bawaan "admin123" bila belum.</p></div>
            <div class="tools"><input class="input" type="password" id="pw-baru" placeholder="Password baru, minimal 8 karakter" autocomplete="new-password" style="max-width:300px"><button class="btn" data-act="ganti-pw">Simpan</button></div></section>
        </div>`;
    },
  };

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
            <div class="what"><b>Upload video</b> <a href="#harian" data-act="video" data-id="${it.v.id}" style="color:inherit">${esc(it.v.judul)}</a><div>${esc(it.v._chNama)} · ${fmt(it.v.views)} views</div></div>
            <div class="res">${it.v._tepat == null ? '<span class="pill">tanpa jadwal</span>' : it.v._tepat ? `<span class="pill ok">tepat ${it.v._slot}</span>` : `<span class="pill bad">telat ${it.v._late} mnt</span>`}</div></div>` : `
          <div class="tl"><span class="time">${esc(it.jam)}</span><span class="dot task"></span>
            <div class="what"><b>${esc(it.a.tugas)}</b>${it.a.jumlah > 1 ? ' · ' + nf.format(it.a.jumlah) : ''}<div>${esc(it.a.detail || '')}</div></div>
            <div class="res">${canDel(it.a) ? `<button class="btn sm ghost" data-act="hapus-aktivitas" data-id="${it.a.id}" aria-label="Hapus aktivitas">${icon('x')}</button>` : ''}</div></div>`).join('')
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
      && (k.editor === 'all' || (k.editor === 'none' ? !editorById(c.editor_id) : String(c.editor_id) === k.editor))
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
      const target = location.hash.split('/')[1];
      if (target) { const el = $('#orang-' + target); if (el) el.scrollIntoView({ block: 'start' }); }
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

  // ============ actions ============
  async function assign(ids, editorId) {
    try {
      for (const id of ids) await api(`/api/content/${id}/assign`, { method: 'POST', body: { editor_id: editorId } });
      ids.forEach((id) => { const c = S.content.find((x) => x.id === id); if (c) { c.editor_id = editorId; c.status_identifikasi = 'matched'; } });
      S.sel.clear();
      S.cache.clear();
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

  function confirmDialog(title, msg, okLabel, onOk) {
    openDialog(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="actions"><button class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`, (d) => {
      $('#ok', d).addEventListener('click', async () => { closeOverlay(); await onOk(); });
    });
  }

  function loginDialog(tab = 'karyawan') {
    const eds = activeEditors();
    openDialog(`
      <h2>Masuk</h2>
      <div class="seg" role="group" aria-label="Masuk sebagai"><button data-tab="karyawan" aria-pressed="${tab === 'karyawan'}">Karyawan</button><button data-tab="admin" aria-pressed="${tab === 'admin'}">Pemilik</button></div>
      <form id="login-form" class="dialog-form" style="display:flex;flex-direction:column;gap:12px">
        ${tab === 'karyawan' ? `
          <label class="field"><span>Nama</span><select class="input" name="editor" required>${eds.map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select></label>
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
          if (tab === 'admin') {
            const password = f.get('password');
            await api('/api/auth/login', { method: 'POST', body: { password } });
            saveSession({ type: 'admin', password });
          } else {
            const r = await api('/api/auth/editor-login', { method: 'POST', body: { editor_id: +f.get('editor'), pin: f.get('pin') } });
            saveSession({ type: 'karyawan', id: r.id, nama: r.nama, pin: f.get('pin') });
          }
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
          if (route() !== 'harian') location.hash = '#harian'; else render();
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
        <div class="stats"><div><span>Views</span><b>${nf.format(c.views)}</b></div><div><span>Like</span><b>${nf.format(c.likes)}</b></div><div><span>Komentar</span><b>${nf.format(c.comments)}</b></div>${isAdmin() ? `<div><span>Pendapatan</span><b>${usd(c.revenue)}</b></div>` : ''}</div>
        <div><div class="card-h" style="margin-bottom:6px"><h2>Pembuat</h2></div>
          ${e ? `<span class="ed">${avatar(e, 'sm')}<b>${esc(e.nama)}</b></span>` : '<span class="pill warn">Belum dikenali</span>'}
          ${canAssign() ? `<div class="tools" style="margin-top:10px"><select class="input" id="dr-assign" style="width:auto"><option value="">${e ? 'Ganti pembuat…' : 'Tetapkan pembuat…'}</option>${activeEditors().map((x) => `<option value="${x.id}">${esc(x.nama)}</option>`).join('')}</select></div>` : ''}
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
      if (Array.isArray(ret) && ret.length) drawRetention(box, ret);
      else box.innerHTML = `<div class="empty"><b>Belum ada data retensi</b>${connected ? 'YouTube biasanya baru mengeluarkan angka retensi 2–3 hari setelah video tayang. Akan terisi otomatis.' : esc(c._chNama) + ' belum tersambung ke YouTube Analytics. Hubungkan di Pengaturan.'}</div>`;
    }).catch((e) => { if (box.isConnected) box.innerHTML = `<div class="empty"><b>Retensi gagal dimuat</b>${esc(e.message)}</div>`; });
    const s = $('#dr-assign');
    if (s) s.addEventListener('change', () => { if (s.value) { closeOverlay(); assign([c.id], +s.value); } });
    $('.drawer .btn').focus();
  }

  function exportCsv() {
    const rows = kontenRows();
    const head = ['Tanggal', 'Jam (WIB)', 'Channel', 'Pembuat', 'Judul', 'Jenis', 'Views', 'Like', 'Komentar', 'Durasi (detik)', 'URL'];
    const q = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = [head, ...rows.map((c) => [c._day, c._jam, c._chNama, (editorById(c.editor_id) || {}).nama || '', c.judul, c.tipe_video, c.views, c.likes, c.comments, c.duration_secs, c.url])].map((r) => r.map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'konten-tokder-' + today() + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'close-overlay') { if (ev.target === el || el.tagName === 'BUTTON') closeOverlay(); return; }
    switch (act) {
      case 'login': loginDialog(); break;
      case 'logout': saveSession(null); toast('Anda sudah keluar'); await load(); break;
      case 'retry': S.error = null; $('#page').innerHTML = '<div class="skeleton" style="height:320px"></div>'; await load(); break;
      case 'theme': {
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
      case 'lihat-orang': ev.preventDefault(); location.hash = '#harian/' + el.dataset.id; break;
      case 'catat': catatDialog(+el.dataset.id || null); break;
      case 'hapus-aktivitas':
        confirmDialog('Hapus aktivitas?', 'Catatan ini akan dihapus dan skor dihitung ulang.', 'Hapus', async () => {
          try { await api('/api/aktivitas/' + el.dataset.id, { method: 'DELETE' }); await refreshAktivitas(); S.cache.clear(); toast('Aktivitas dihapus'); render(); } catch (e) { toast(e.message, true); }
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
      case 'an-periode': S.anPeriode = +el.dataset.v; render(); break;
      case 'putus-analytics': {
        const c = analyticsChannels().find((x) => x.id === el.dataset.id);
        confirmDialog('Putuskan ' + c.nama + '?', 'Angka YouTube Analytics yang sudah tersimpan tetap ada, tapi tidak diperbarui lagi sampai dihubungkan ulang.', 'Putuskan', async () => {
          try { await api('/api/auth/google/' + encodeURIComponent(c.id), { method: 'DELETE' }); S.oauth = await optional(api('/api/auth/status'), 'Status YouTube Analytics'); normalize(); toast(c.nama + ' diputuskan'); render(); } catch (e) { toast(e.message, true); }
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
        try { await api('/api/auth/password', { method: 'POST', body: { baru: v } }); saveSession({ type: 'admin', password: v }); toast('Password tersimpan'); $('#pw-baru').value = ''; } catch (e) { toast(e.message, true); }
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

  load();
})();
