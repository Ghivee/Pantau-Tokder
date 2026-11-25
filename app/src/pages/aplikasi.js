import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S, isAdmin } from '../core/state.js';
import { esc } from '../lib/dom.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

const INISIAL = { pantau: 'P', master: 'M', telprom: 'T' };

function kartu(a) {
  const isi = `<span class="app-ini" aria-hidden="true">${INISIAL[a.id] || '?'}</span>
    <span class="app-t"><b>${esc(a.nama)}</b><span class="muted">${esc(a.ket)}</span></span>`;
  if (a.sekarang) return `<div class="card app-card on" aria-current="true">${isi}<span class="app-go muted">Sedang dibuka</span></div>`;
  if (!a.url) return `<div class="card app-card off">${isi}<span class="app-go muted">${isAdmin() ? 'Alamat belum diatur (' + esc(a.env) + ' di Vercel)' : 'Belum tersedia'}</span></div>`;
  return `<a class="card app-card" href="${esc(a.url)}" target="_blank" rel="noopener">${isi}<span class="app-go">Buka ${icon('ext')}</span></a>`;
}

PAGES.aplikasi = function () {
  return `<header class="head"><div><h1>Aplikasi</h1><p class="muted">Pilih web yang ingin dibuka. Anda tidak perlu login lagi.</p></div>${isAdmin() ? '<div class="tools"><a class="btn sm" href="/akses">Atur akses</a></div>' : ''}</header>
    <div class="apps">${S.aplikasi ? S.aplikasi.map(kartu).join('') : '<p class="muted">Memuat…</p>'}</div>`;
};

AFTER.aplikasi = async function () {
  if (S.aplikasi) return;
  try { S.aplikasi = (await api('/api/aplikasi')).daftar; } catch (e) { S.aplikasi = []; }
  if (route() === 'aplikasi') render();
};
