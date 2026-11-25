import { api } from '../core/data.js';
import { PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { esc } from '../lib/dom.js';
import { render } from '../ui/layout.js';

// Akses karyawan: pemilik mengatur izin SATU PER SATU untuk tiap orang (berdasarkan nama, bukan jabatan).
// Mencakup fitur Pantau, web yang tampil di halaman Aplikasi, dan izin di dalam Master (diselaraskan ke Master).
export const statusSinkron = (s) => (!s ? '' : s.ok ? '<span class="pill ok">Master: tersinkron</span>' : `<span class="pill warn" title="${esc(s.galat || '')}">Master belum tersinkron</span> <button class="btn sm ghost" data-act="akses-sinkron">Coba lagi</button>`);

export function aksesCard() {
  const x = S.akses;
  if (x === undefined) {
    S.akses = null;
    api('/api/akses').then((r) => { S.akses = r; }).catch((e) => { S.akses = { error: e.message }; }).then(() => { if (route() === 'akses') render(); });
  }
  const kepala = '<div class="card-h"><h2>Akses karyawan</h2><p>Atur apa yang boleh dilakukan tiap orang, satu per satu. Berlaku menurut nama, bukan jabatan.</p></div>';
  if (!x) return `<section class="card">${kepala}<p class="muted">Memuat…</p></section>`;
  if (x.error) return `<section class="card">${kepala}<p class="muted">${esc(x.error)}</p></section>`;
  if (!x.karyawan.length) return `<section class="card">${kepala}<p class="muted">Belum ada karyawan aktif.</p></section>`;
  const sk = x.sinkron || {};
  return `<section class="card" id="akses-karyawan">${kepala}
    ${x.master.terbaca ? '' : `<div class="notice" role="status"><span>Izin di Master belum terbaca${x.master.galat ? ': ' + esc(x.master.galat) : ''}. Mengubah izin Master untuk orang yang belum pernah diatur ditunda sampai Master terbaca.</span></div>`}
    ${x.karyawan.map((k) => `<div class="ak-orang"><div class="ak-nama"><b>${esc(k.nama)}</b><span id="ak-st-${k.id}">${statusSinkron(sk[k.id])}</span></div>
      ${x.katalog.map((g) => `<div class="ak-grup"><h4>${esc(g.grup)}</h4><div class="ak-grid">${g.butir.map((b) => {
        const mati = b.k.startsWith('master_') && !k.akunMaster;
        return `<label class="ak-i${mati ? ' off' : ''}"><input type="checkbox" data-act="akses-izin" data-id="${k.id}" data-k="${esc(b.k)}" ${k.izin[b.k] ? 'checked' : ''} ${mati ? 'disabled' : ''}><span>${esc(b.nama)}</span></label>`;
      }).join('')}</div>${g.grup === 'Di dalam Master' && !k.akunMaster ? '<p class="muted">Nama ini belum punya akun Master (saat ini hanya Via dan Deni).</p>' : ''}</div>`).join('')}
    </div>`).join('')}
    <p class="muted" style="margin-top:10px">Izin "Di dalam Master" dikirim ke Master dan ditegakkan di sana. Izin lain ditegakkan di Tokder. Pemilik selalu boleh semuanya.</p></section>`;
}

PAGES.akses = function () {
  return `<header class="head"><div><h1>Akses</h1><p>Atur apa yang boleh dibuka dan dilakukan tiap orang. Berlaku menurut nama, bukan jabatan.</p></div></header>
    ${aksesCard()}`;
};
