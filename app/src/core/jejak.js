import { S } from './state.js';

// Memberi tahu server halaman mana yang dibuka (untuk jejak audit). Sekali per perpindahan halaman; kegagalan diabaikan.
let terakhir = '';
export function pingHalaman() {
  if (!S.session) { terakhir = ''; return; }
  const p = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : '/';
  if (p === terakhir) return;
  terakhir = p;
  try {
    fetch('/api/jejak/halaman', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rute: p }), keepalive: true, credentials: 'same-origin' }).catch(() => {});
  } catch (e) { /* tidak boleh mengganggu tampilan */ }
}
