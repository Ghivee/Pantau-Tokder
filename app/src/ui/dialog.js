import { $, esc } from '../lib/dom.js';

export function openDialog(html, onMount) {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="scrim" data-act="close-overlay"><div class="dialog" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $('input, select, textarea, button', ov.querySelector('.dialog'));
  if (first) first.focus();
  if (onMount) onMount(ov.querySelector('.dialog'));
}

export const closeOverlay = () => { $('#overlay').innerHTML = ''; };

export function confirmDialog(title, msg, okLabel, onOk) {
  openDialog(`<h2>${esc(title)}</h2><p>${esc(msg)}</p><div class="actions"><button class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="ok">${esc(okLabel)}</button></div>`, (d) => {
    $('#ok', d).addEventListener('click', async () => { closeOverlay(); await onOk(); });
  });
}
