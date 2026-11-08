import { belumDikenali, editorById } from '../core/data.js';
import { me } from '../core/state.js';
import { esc } from '../lib/dom.js';

export function avatar(e, size = '') {
  if (!e) return `<span class="ava ${size}" style="background:var(--line-2)" aria-hidden="true">?</span>`;
  const ini = esc((e.nama || '?').trim().slice(0, 1).toUpperCase());
  if (e.foto_url) return `<img class="ava ${size}" src="${esc(e.foto_url)}" alt="Foto ${esc(e.nama)}" data-ini="${ini}" data-color="${e._color}">`;
  return `<span class="ava ${size}" style="background:${e._color}" aria-hidden="true">${ini}</span>`;
}

// Broken photo links fall back to initials.
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (img.tagName === 'IMG' && img.classList.contains('ava')) {
    const s = document.createElement('span');
    s.className = img.className;
    s.style.background = img.dataset.color || 'var(--muted)';
    s.textContent = img.dataset.ini || '?';
    img.replaceWith(s);
  }
}, true);

export const peranLabel = (p) => (p === 'terbatas' ? 'Editor terbatas' : 'Editor');

export const thumb = (c) => (c.post_id ? `https://i.ytimg.com/vi/${encodeURIComponent(c.post_id)}/mqdefault.jpg` : '');

export const vidCell = (c) => `<div class="vid">${thumb(c) ? `<img src="${thumb(c)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div class="tx"><b>${esc(c.judul)}</b><div>${esc(c._chNama)} · ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'}</div></div></div>`;

export const editorCell = (c) => {
  const e = editorById(c.editor_id);
  if (e) return me() ? '<span class="pill leaf">Anda</span>' : `<span class="ed">${avatar(e, 'xs')}${esc(e.nama)}</span>`;
  return belumDikenali(c) ? '<span class="pill warn">Belum dikenali</span>' : '<span class="muted">Tim</span>';
};

export function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 3200);
}
