import { assign } from '../actions.js';
import { activeEditors, belumDikenali } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S, canAssign } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { nf, tglPendek } from '../lib/format.js';
import { vidCell } from '../ui/bits.js';

PAGES.identifikasi = function () {
    const rows = S.content.filter(belumDikenali).sort((a, b) => b.tanggal_upload.localeCompare(a.tanggal_upload));
    const allowed = canAssign();
    const codes = activeEditors().map((e) => `<span class="slot">#${esc(e.kode_identifikasi)}</span> ${esc(e.nama)}`).join(' · ');
    return `
        <header class="head">
          <div><h1>Belum dikenali</h1><p>Video dikenali otomatis bila deskripsinya memuat kode karyawan (${codes || 'belum ada kode'}). Video di bawah ini tidak memuat kode, jadi pembuatnya perlu ditetapkan manual.</p></div>
        </header>
        <section class="card">
          ${rows.length ? `
          ${allowed ? `<div class="tools mb-12">
            <span class="muted" id="sel-count">${S.sel.size} dipilih</span>
            <select class="input w-auto" id="bulk-editor" aria-label="Tetapkan ke"><option value="">Tetapkan ke…</option>${activeEditors().map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select>
            <button class="btn primary" data-act="bulk-assign">Tetapkan yang dipilih</button>
          </div>` : '<p class="muted mb-12 mt-0">Masuk sebagai pemilik atau editor untuk menetapkan pembuat video.</p>'}
          <div class="table-wrap"><table class="t stack"><thead><tr><th>${allowed ? '<label style="display:inline-flex;gap:10px;align-items:center"><input type="checkbox" id="sel-all" aria-label="Pilih semua"> Video</label>' : 'Video'}</th><th>Tayang (WIB)</th><th class="num">Views</th>${allowed ? '<th>Pembuat</th>' : ''}</tr></thead><tbody>
            ${rows.map((c) => `<tr><td class="full"><div style="display:flex;gap:10px;align-items:center">${allowed ? `<input type="checkbox" data-sel="${c.id}" ${S.sel.has(c.id) ? 'checked' : ''} aria-label="Pilih ${esc(c.judul)}" style="width:20px;height:20px;flex:none">` : ''}<a href="/identifikasi" data-act="video" data-id="${c.id}" style="text-decoration:none;min-width:0">${vidCell(c)}</a></div></td><td class="mono" data-label="Tayang">${tglPendek(c._day)} ${c._jam}</td><td class="num" data-label="Views">${nf.format(c.views)}</td>${allowed ? `<td class="full"><select class="input" data-assign="${c.id}" aria-label="Pembuat"><option value="">Tetapkan pembuat…</option>${activeEditors().map((e) => `<option value="${e.id}">${esc(e.nama)}</option>`).join('')}</select></td>` : ''}</tr>`).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Semua video sudah dikenali</b>Video baru tanpa kode akan muncul di sini setelah sinkronisasi.</div>'}
        </section>`;
  };

AFTER.identifikasi = function () {
    const all = $('#sel-all');
    if (all) all.addEventListener('change', () => { $$('[data-sel]').forEach((c) => { c.checked = all.checked; c.checked ? S.sel.add(+c.dataset.sel) : S.sel.delete(+c.dataset.sel); }); $('#sel-count').textContent = S.sel.size + ' dipilih'; });
    $$('[data-sel]').forEach((c) => c.addEventListener('change', () => { c.checked ? S.sel.add(+c.dataset.sel) : S.sel.delete(+c.dataset.sel); $('#sel-count').textContent = S.sel.size + ' dipilih'; }));
    $$('[data-assign]').forEach((s) => s.addEventListener('change', () => { if (s.value) assign([+s.dataset.assign], +s.value); }));
  };
