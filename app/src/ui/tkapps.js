import { api } from '../core/data.js';
import { S } from '../core/state.js';
import { $ } from '../lib/dom.js';
import { esc } from '../lib/dom.js';

// Bilah pindah aplikasi di bagian atas. Daftar web mengikuti izin orang yang masuk (/api/aplikasi).
const RUPA = {pantau:['Tokder','Beranda','<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/>'],master:['Master','Kas & jualan','<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18"/><path d="M7 15h4"/>'],telprom:['Telprom','Rekam video','<rect x="3" y="7" width="12.5" height="10" rx="2.5"/><path d="m15.5 11 5.5-3v8l-5.5-3"/>']};
let memuat = false, gagal = false;

const isi = (id) => { const [nama, ket, ikon] = RUPA[id]; return `<svg viewBox="0 0 24 24" aria-hidden="true">${ikon}</svg><span><b>${nama}</b><small>${ket}</small></span>`; };

export function renderApps() {
  const bar = $('#tkapps');
  if (!bar) return;
  document.body.classList.toggle('tk-ada', !!S.session);
  bar.hidden = !S.session;
  if (!S.session) { S.aplikasi = null; gagal = false; bar.innerHTML = ''; return; }
  if (!S.aplikasi && !memuat && !gagal) {
    memuat = true;
    api('/api/aplikasi').then((r) => { S.aplikasi = r.daftar; }, () => { gagal = true; }).finally(() => { memuat = false; renderApps(); });
  }
  const url = (id) => { const a = (S.aplikasi || []).find((x) => x.id === id); return a && a.url; };
  const html = `<a href="/" aria-current="page">${isi('pantau')}</a>` + ['master', 'telprom']
    .filter((id) => !S.aplikasi || url(id))
    .map((id) => `<a ${url(id) ? `href="${esc(url(id))}"` : 'aria-disabled="true"'}>${isi(id)}</a>`).join('');
  if (bar.innerHTML !== html) bar.innerHTML = html;
}
