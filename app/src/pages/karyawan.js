import { PAGES } from '../core/registry.js';
import { gradeOf, slotsOf, targetOf } from '../core/rules.js';
import { S, isAdmin } from '../core/state.js';
import { daysBack, periodStats } from '../core/stats.js';
import { esc } from '../lib/dom.js';
import { fmt, pct } from '../lib/format.js';
import { avatar, peranLabel } from '../ui/bits.js';
import { icon } from '../ui/icons.js';

PAGES.karyawan = function () {
    const days = daysBack(7);
    return `
        <header class="head">
          <div><h1>Karyawan</h1><p>Kode dipakai untuk mengenali video dari deskripsinya. Jadwal dipakai untuk menilai tepat atau telat. PIN dipakai karyawan untuk masuk, mencatat aktivitas dan absen.</p></div>
          ${isAdmin() ? `<div class="tools"><button class="btn primary" data-act="editor-form">${icon('plus')}Tambah karyawan</button></div>` : ''}
        </header>
        <div class="team">${S.editors.map((e) => {
          const st = periodStats(e, days);
          return `<section class="card member">
            <div class="member-top">${avatar(e, 'lg')}<div class="t"><b>${esc(e.nama)}</b><div class="muted fs-125">${peranLabel(e.peran)}${e.status === 'nonaktif' ? ' · nonaktif' : ''}</div></div><span class="grade ${gradeOf(st.skor) || ''}" title="Rata-rata skor 7 hari">${st.skor ?? '—'}</span></div>
            <dl class="kv">
              <dt>Kode</dt><dd><span class="slot">#${esc(e.kode_identifikasi)}</span></dd>
              <dt>Jadwal</dt><dd>${slotsOf(e).map((s) => `<span class="slot">${s}</span>`).join('') || '<span class="muted">Belum diatur</span>'}</dd>
              <dt>Target</dt><dd>${targetOf(e)} video per hari</dd>
              <dt>Penghasilan</dt><dd>${e.lihat_penghasilan ? '<span class="pill ok">Boleh lihat</span>' : '<span class="muted">Tidak</span>'}</dd>
              <dt>PIN</dt><dd>${e.punya_pin ? '<span class="pill ok">Sudah diatur</span>' : '<span class="pill warn">Belum diatur</span>'}</dd>
              <dt>7 hari</dt><dd>${st.n} video · tepat ${pct(st.tepat)} · ${fmt(st.views)} views</dd>
            </dl>
            ${isAdmin() ? `<div class="member-actions"><button class="btn sm" data-act="editor-form" data-id="${e.id}">Ubah</button><button class="btn sm ghost danger" data-act="editor-hapus" data-id="${e.id}">Hapus</button></div>` : ''}
          </section>`;
        }).join('') || '<div class="card empty"><b>Belum ada karyawan</b>Masuk sebagai pemilik untuk menambahkan.</div>'}</div>
        <section class="card">
          <div class="card-h"><h2>Hak akses</h2></div>
          <div class="table-wrap"><table class="t stack"><thead><tr><th>Bisa…</th><th>Pemilik</th><th>Manajer</th><th>Editor</th><th>Editor terbatas</th><th>Penonton</th></tr></thead><tbody>
            ${[['Melihat rangkuman dan saran', 'Ya', 'Ya', 'Ya', 'Ya', 'Ya'], ['Mengunggah video sebagai draf', 'Ya', 'Ya', 'Ya', 'Ya', '—'], ['Membuat tautan affiliate', 'Ya', 'Ya', 'Ya', 'Ya', '—'], ['Menayangkan ke publik', 'Ya', 'Ya', 'Ya', '—', '—'], ['Menghapus posting dan tautan', 'Ya', 'Ya', '—', '—', '—'], ['Menghubungkan akun, mengatur tim', 'Ya', '—', '—', '—', '—'], ['Melihat penghasilan', 'Ya', 'Bila diberi tanda', 'Bila diberi tanda', 'Bila diberi tanda', 'Bila diberi tanda']]
              .map((r) => `<tr><td class="full"><b>${r[0]}</b></td>${['Pemilik', 'Manajer', 'Editor', 'Editor terbatas', 'Penonton'].map((l, i) => `<td data-label="${l}">${r[i + 1]}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
        </section>`;
  };
