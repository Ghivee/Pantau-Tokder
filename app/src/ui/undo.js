import { api } from '../core/data.js';
import { $, esc } from '../lib/dom.js';
import { toast } from './bits.js';

// Deleting waits 5 seconds with an Undo button; the request goes out only when time is up
// (or right away when the page is closed), so a mis-tap costs nothing.
const tertunda = new Map();

export function hapusDenganBatal(pesan, url, { sembunyikan, kembalikan, sesudah }) {
  const id = url + '|' + Date.now();
  sembunyikan();
  const t = document.createElement('div');
  t.className = 'toast undo';
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${esc(pesan)}</span><button type="button">Batalkan</button>`;
  document.querySelectorAll('.toast').forEach((x) => x.remove());
  document.body.append(t);
  const jalan = async () => {
    if (!tertunda.has(id)) return;
    tertunda.delete(id);
    t.remove();
    try { await api(url, { method: 'DELETE' }); if (sesudah) await sesudah(); } catch (e) { kembalikan(); toast(e.message, true); }
  };
  tertunda.set(id, url);
  $('button', t).addEventListener('click', () => { if (!tertunda.delete(id)) return; t.remove(); kembalikan(); toast('Dibatalkan'); });
  setTimeout(jalan, 5000);
}

window.addEventListener('pagehide', () => {
  tertunda.forEach((url) => { try { fetch(url, { method: 'DELETE', keepalive: true, credentials: 'same-origin' }); } catch (e) { /* closing anyway */ } });
  tertunda.clear();
});
