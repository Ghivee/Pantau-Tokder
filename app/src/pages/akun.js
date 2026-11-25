import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { esc } from '../lib/dom.js';
import { ssoInfo } from '../core/sso.js';
import { render } from '../ui/layout.js';

// "Akun saya": siapa yang masuk, ganti kata sandi, keluar dari semua web. Akses sengaja tidak ditampilkan ke karyawan.
PAGES.akun = function () {
  const a = S.akun;
  return `<header class="head"><div><h1>Akun saya</h1><p>${a && !a.error ? esc(a.nama) + ' · ' + esc(a.jenis) : a && a.error ? esc(a.error) : 'Akun Tokder'}</p></div></header>
    <section class="card"><div class="card-h"><h2>Keamanan</h2><p>Satu Akun Tokder dipakai untuk Tokder, Master, dan Telprom.</p></div>
      <div class="tools"><button class="btn" data-act="ganti-sandi">Ganti kata sandi</button><button class="btn ghost" data-act="logout">Keluar dari semua web</button></div>
      <p class="muted" style="margin-top:8px">Kata sandi diganti di Master, lalu Anda dikembalikan ke sini.</p>
      <p class="muted">Demi keamanan, waktu masuk, perangkat, dan aktivitas di Tokder dicatat.</p></section>`;
};

AFTER.akun = async function () {
  if (S.akun) return;
  try { S.akun = await api('/api/akun'); } catch (e) { S.akun = { error: e.message }; }
  await ssoInfo();
  if (route() === 'akun') render();
};
