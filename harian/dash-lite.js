// Pemuat data kecil untuk dashboard harian: membaca CSV, menjalankan perhitungan, memberi tahu tampilan.
(function () {
  const cfg = window.PANTAU_CONFIG || {};
  const sources = cfg.data || {};
  const state = {};
  const calcs = [];
  const subs = [];
  let params = Object.assign({}, cfg.params || {});
  let loadedAt = null;

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    const columns = (rows.shift() || []).map((s) => s.trim());
    const data = rows
      .filter((r) => r.some((x) => x.trim() !== ''))
      .map((r) => Object.fromEntries(columns.map((c, i) => [c, normalize(c, (r[i] ?? '').trim())])));
    return { columns, data };
  }

  // Google Sheet often exports dates as 21/10/2026, times as 6:05:00 and numbers as 1.234.
  function normalize(col, v) {
    if (!v) return v;
    if (col === 'Tanggal') {
      const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
      if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
      return v.slice(0, 10);
    }
    if (col === 'Jam' || col === 'Jadwal' || col === 'Jam_Tayang') {
      const m = v.match(/(\d{1,2})[:.](\d{2})/);
      return m ? m[1].padStart(2, '0') + ':' + m[2] : v;
    }
    if (col === 'Views' || col === 'Jumlah' || col === 'Subscriber') return v.replace(/[^\d-]/g, '') || '0';
    return v;
  }

  function notify() {
    subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    const s = document.getElementById('status-data');
    if (s) {
      const failed = Object.keys(sources).filter((id) => state[id] && state[id].status === 'error');
      s.textContent = failed.length
        ? 'Gagal memuat: ' + failed.join(', ') + '. Periksa link di config.js.'
        : loadedAt ? 'Data dimuat ' + loadedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Memuat data…';
    }
  }

  function recompute() {
    for (const c of calcs) {
      const ins = c.inputs.map((i) => state[i]);
      if (ins.some((s) => s && s.status === 'error')) { state[c.id] = { status: 'error', data: [] }; continue; }
      if (ins.some((s) => !s || s.status !== 'ok')) { state[c.id] = { status: 'loading', data: [] }; continue; }
      try {
        const data = c.fn(...ins.map((s) => s.data));
        state[c.id] = { status: 'ok', data, columns: data.length ? Object.keys(data[0]) : [] };
      } catch (e) {
        console.error('Perhitungan ' + c.id + ' gagal', e);
        state[c.id] = { status: 'error', data: [], message: String(e) };
      }
    }
    notify();
  }

  async function load(id) {
    const url = sources[id];
    if (!state[id] || state[id].status !== 'ok') state[id] = { status: 'loading', data: [] };
    try {
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const p = parseCSV(await r.text());
      state[id] = { status: 'ok', data: p.data, columns: p.columns };
      loadedAt = new Date();
    } catch (e) {
      console.error('Gagal memuat ' + id + ' dari ' + url, e);
      state[id] = { status: 'error', data: [], message: String(e) };
    }
    recompute();
  }
  const loadAll = () => Object.keys(sources).forEach(load);

  window.dash = {
    data: (id) => state[id] || { status: 'missing', data: [] },
    onData(fn) { subs.push(fn); try { fn(); } catch (e) { console.error(e); } },
    calc(id, o) { calcs.push({ id, inputs: o.inputs, fn: o.fn }); },
    params: () => Object.assign({}, params),
    setParams(p) { Object.assign(params, p); notify(); },
    resetParams() { params = Object.assign({}, cfg.params || {}); notify(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } },
    refresh(id) { if (id) load(id); else loadAll(); },
    colors: ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'],
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadAll();
    const btn = document.getElementById('muat-ulang');
    if (btn) btn.addEventListener('click', loadAll);
    if (cfg.muatUlangMenit > 0) setInterval(loadAll, cfg.muatUlangMenit * 60000);
  });
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(notify, 150); });
})();
