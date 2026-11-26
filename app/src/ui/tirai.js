import { $, esc } from '../lib/dom.js';

// Layar peralihan: menutup isi saat masuk, keluar, atau pindah web, supaya tidak ada tampilan yang berkedip.
let pengaman;

export function tirai(teks) {
  let t = $('#tirai');
  if (!t) { t = document.createElement('div'); t.id = 'tirai'; t.className = 'tirai'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.innerHTML = `<img src="/logo.svg" alt="" width="56" height="56"><span>${esc(teks)}</span>`;
  // Bila perpindahan halaman gagal, layar tidak boleh tertutup selamanya.
  clearTimeout(pengaman);
  pengaman = setTimeout(bukaTirai, 12000);
}

export function bukaTirai() {
  clearTimeout(pengaman);
  const t = $('#tirai'); if (t) t.remove();
}
