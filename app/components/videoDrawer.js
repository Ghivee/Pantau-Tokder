// app/components/videoDrawer.js - Video detail drawer
import { getState, isAdmin, canAssign } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, fmt, durasi, usd, avatar } from '../core/utils.js';
import { confirmDialog, catatDialog, closeOverlay } from '../components/dialogs.js';
import { drawRetention } from '../charts/charts.js';
import { activeEditors, editorById } from './nav.js';

export function videoDrawer(id) {
  const S = getState();
  const c = S.content.find((x) => x.id === +id);
  if (!c) return;
  const e = editorById(c.editor_id);
  const connected = S.connected.has(c._ch);

  openDialog(`
    <div class="drawer">
      <div class="drawer-head">
        <h2>${esc(c.judul)}</h2>
        <button class="btn ghost" data-act="close-overlay">${icon('x')}</button>
      </div>
      <div class="drawer-body">
        <div class="vid-large">${c.post_id ? `<img src="https://i.ytimg.com/vi/${encodeURIComponent(c.post_id)}/hqdefault.jpg" alt="">` : '<span class="ph-large"></span>'}</div>
        <div class="stats">
          <div><span>Views</span><b>${fmt(c.views)}</b></div>
          <div><span>Like</span><b>${fmt(c.likes)}</b></div>
          <div><span>Komentar</span><b>${fmt(c.comments)}</b></div>
          <div><span>Durasi</span><b>${durasi(c.duration_secs)}</b></div>
          ${isAdmin() ? `<div><span>Pendapatan</span><b>${c.revenue != null ? usd(c.revenue) : '—'}</b></div>` : ''}
        </div>
        <div class="meta">
          <span>Channel: ${esc(c._chNama)}</span>
          <span>Tanggal: ${c._day} ${c._jam} WIB</span>
          <span>Jenis: ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'}</span>
          <span>Topik: ${c._topik}</span>
          <a href="${esc(c.url)}" target="_blank" rel="noopener" class="btn ghost sm">${icon('ext')} Buka di YouTube</a>
        </div>
        <div id="dr-retention" class="chart-wrap" style="height:250px;margin:16px 0"></div>
        ${canAssign() ? `<div class="tools" style="margin-top:10px"><select class="input" id="dr-assign" style="width:auto"><option value="">${e ? 'Ganti pembuat…' : 'Tetapkan pembuat…'}</option>${activeEditors().map((x) => `<option value="${x.id}">${esc(x.nama)}</option>`).join('')}</select></div>` : ''}
        <div class="tools" style="margin-top:10px">
          <button class="btn ghost" data-act="catat" data-id="${e?.id || ''}">${icon('plus')} Catat aktivitas</button>
        </div>
      </div>
    </div>`, (d) => {
    const box = $('#dr-retention', d);
    api('/api/content/' + c.id).then((full) => {
      if (!box.isConnected) return;
      let ret = full.retention_data;
      if (typeof ret === 'string') { try { ret = JSON.parse(ret); } catch (e) { ret = null; } }
      if (Array.isArray(ret) && ret.length) drawRetention(box, ret);
      else box.innerHTML = `<div class="empty"><b>Belum ada data retensi</b>${connected ? 'YouTube biasanya baru mengeluarkan angka retensi 2–3 hari setelah video tayang. Akan terisi otomatis.' : esc(c._chNama) + ' belum tersambung ke YouTube Analytics. Hubungkan di Pengaturan.'}</div>`;
    }).catch((e) => { if (box.isConnected) box.innerHTML = `<div class="empty"><b>Retensi gagal dimuat</b>${esc(e.message)}</div>`; });
    
    const s = $('#dr-assign', d);
    if (s) s.addEventListener('change', () => { if (s.value) { closeOverlay(); assign([c.id], +s.value); } });
    $('.drawer .btn').focus();
  });
}

async function assign(ids, editorId) {
  try {
    for (const id of ids) await api(`/api/content/${id}/assign`, { method: 'POST', body: { editor_id: editorId } });
    ids.forEach((id) => { const c = getState().content.find((x) => x.id === id); if (c) { c.editor_id = editorId; c.status_identifikasi = 'matched'; } });
    getState().sel.clear();
    getState().cache.clear();
    toast(ids.length + ' video ditetapkan ke ' + editorById(editorId).nama);
    import('../components/nav.js').then(m => m.renderNav());
  } catch (e) { toast(e.message, true); }
}

export { assign };