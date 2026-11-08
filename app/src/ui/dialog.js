import { $, esc } from '../lib/dom.js';

// Fokus kembali ke tombol yang membuka dialog saat dialog ditutup, dan Tab berputar di dalam dialog.
let pemicu = null;
export const ingatFokus = () => { pemicu = document.activeElement; };
const FOKUS = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function openDialog(html, onMount) {
  const ov = $('#overlay');
  ingatFokus();
  ov.innerHTML = `<div class="scrim" data-act="close-overlay"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  const dlg = ov.querySelector('.dialog');
  const judul = $('h2', dlg);
  if (judul) { judul.id = 'dlg-judul'; dlg.setAttribute('aria-labelledby', 'dlg-judul'); }
  const first = $('input, select, textarea, button', dlg);
  if (first) first.focus();
  if (onMount) onMount(dlg);
}

export const closeOverlay = () => {
  const ada = $('#overlay').innerHTML;
  $('#overlay').innerHTML = '';
  if (ada && pemicu && document.contains(pemicu)) pemicu.focus({ preventScroll: true });
  pemicu = null;
};

export function trapTab(ev) {
  if (ev.key !== 'Tab') return;
  const box = $('#overlay .dialog, #overlay .drawer');
  if (!box) return;
  const list = [...box.querySelectorAll(FOKUS)].filter((x) => x.offsetParent !== null);
  if (!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
  else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
}

export function confirmDialog(title, msg, okLabel, onOk) {
  openDialog(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="actions"><button class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`, (d) => {
    $('#ok', d).addEventListener('click', async () => { closeOverlay(); await onOk(); });
  });
}
