import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { esc } from '../lib/dom.js';
import { ssoInfo } from '../core/sso.js';
import { render } from '../ui/layout.js';

// "Akun saya": siapa yang masuk, apa saja aksesnya (hanya baca), ganti kata sandi, keluar dari semua web.
PAGES.akun = function () {
  const a = S.akun;
  const isi = !a ? '<p class="muted">Memuat…</p>'
    : a.error ? `<p class="muted">${esc(a.error)}</p>`
    : a.semua ? '<p>Pemilik boleh membuka dan mengatur semuanya. Atur akses karyawan di menu <a href="/akses">Akses</a>.</p>'
    : a.akses.map((g) => `<div class="ak-grup"><h4>${esc(g.grup)}</h4><ul class="akun-daftar">${g.butir.map((b) => `<li class="${b.boleh ? 'ya' : 'tidak'}"><span aria-hidden="true">${b.boleh ? '✓' : '–'}</span> ${esc(b.nama)}<span class="muted"> · ${b.boleh ? 'boleh' : 'tidak'}</span></li>`).join('')}</ul></div>`).join('');
  return `<header class="head"><div><h1>Akun saya</h1><p>${a && !a.error ? esc(a.nama) + ' · ' + esc(a.jenis) : 'Akun Tokder'}</p></div></header>
    <section class="card"><div class="card-h"><h2>Akses saya</h2><p>Yang diatur pemilik untuk akun ini.</p></div>${isi}</section>
    <section class="card"><div class="card-h"><h2>Keamanan</h2><p>Satu Akun Tokder dipakai untuk Tokder, Master, dan Telprom.</p></div>
      <div class="tools"><button class="btn" data-act="ganti-sandi">Ganti kata sandi</button><button class="btn ghost" data-act="logout">Keluar dari semua web</button></div>
      <p class="muted" style="margin-top:8px">Kata sandi diganti di Master, lalu Anda dikembalikan ke sini.</p></section>`;
};

AFTER.akun = async function () {
  if (S.akun) return;
  try { S.akun = await api('/api/akun'); } catch (e) { S.akun = { error: e.message }; }
  await ssoInfo();
  if (route() === 'akun') render();
};
