import { AFTER, PAGES } from '../core/registry.js';
import { S, me } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { durasi, fmt, nf, sum, tglPendek } from '../lib/format.js';
import { kontenRows } from './shared.js';
import { editorCell, vidCell } from '../ui/bits.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

PAGES.konten = function () {
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
  };

AFTER.konten = function () {
    const k = S.konten;
    const q = $('#k-q');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { k.q = q.value; k.page = 1; render(); const n = $('#k-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    [['#k-channel', 'channel'], ['#k-editor', 'editor'], ['#k-tipe', 'tipe'], ['#k-periode', 'periode']].forEach(([s, f]) => $(s).addEventListener('change', (ev) => { k[f] = ev.target.value; k.page = 1; render(); }));
  };
