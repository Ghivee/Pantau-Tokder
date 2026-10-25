// app/components/nav.js - Navigation rendering
import { getState, isAdmin, me, canLog, canAssign } from '../core/state.js';
import { icon, esc, tglPanjang, fmt, idr, signed, usd, PALETTE, $, thumb } from '../core/utils.js';
export const ROUTES = [
  { hash: 'ringkasan', label: 'Ringkasan', icon: icon('home'), admin: false },
  { hash: 'harian', label: 'Harian', icon: icon('day'), admin: false },
  { hash: 'konten', label: 'Konten', icon: icon('video'), admin: false },
  { hash: 'aktivitas', label: 'Aktivitas', icon: icon('chart'), admin: false },
  { hash: 'analytics', label: 'Analytics', icon: icon('chart'), admin: false },
  { hash: 'karyawan', label: 'Karyawan', icon: icon('team'), admin: true },
  { hash: 'pengaturan', label: 'Pengaturan', icon: icon('gear'), admin: true },
];

let currentRoute = null;

export function getCurrentRoute() {
  return currentRoute;
}

export function setCurrentRoute(hash) {
  currentRoute = ROUTES.find(r => r.hash === hash) || ROUTES[0];
  return currentRoute;
}

export function renderNav() {
  const S = getState();
  const who = me(editorById);
  const nav = $('#nav');
  if (!nav) return;
  
  nav.innerHTML = ROUTES.filter((r) => !r.admin || isAdmin()).map((r, i) =>
    (r.admin && !ROUTES.slice(0, ROUTES.indexOf(r)).some((x) => x.admin) ? '<div class="nav-label">Pemilik</div>' : '') +
    `<a class="nav-a${r.hash === currentRoute?.hash ? ' active' : ''}" href="#${r.hash}" ${r.hash === currentRoute?.hash ? 'aria-current="page"' : ''}>${r.icon}<span>${r.label}</span></a>`
  ).join('');

  const foot = $('#side-foot');
  if (foot) {
    if (who) {
      foot.innerHTML = `<div class="user"><div class="ava" style="background:${who._color}" aria-hidden="true">${esc((who.nama || '?').trim().slice(0, 1).toUpperCase())}</div><div class="u-info"><b>${esc(who.nama)}</b><small>${peranLabel(who.peran)}</small></div></div>
        <button class="btn ghost" style="width:100%;margin-top:8px" data-act="logout">${icon('out')} Keluar</button>`;
    } else if (isAdmin()) {
      foot.innerHTML = `<div class="user"><div class="ava" style="background:var(--s1)" aria-hidden="true">👑</div><div class="u-info"><b>Pemilik</b><small>Admin</small></div></div>
        <button class="btn ghost" style="width:100%;margin-top:8px" data-act="logout">${icon('out')} Keluar</button>`;
    } else {
      foot.innerHTML = `<button class="btn primary" style="width:100%" data-act="login">${icon('out')} Masuk</button>`;
    }
  }
}

export function peranLabel(p) {
  return p === 'terbatas' ? 'Editor terbatas' : 'Editor';
}

export function editorById(id) {
  return getState().editors.find((e) => e.id === +id) || null;
}
if (typeof window !== 'undefined') {
  window.__pt_getEditor = editorById;
}

export function activeEditors() {
  return getState().editors.filter((e) => e.status !== 'nonaktif');
}

export function chName(id) {
  return (getState().channels.find((c) => c.id === id) || {}).nama || 'Channel utama';
}

export function chColor(id) {
  return (getState().channels.find((c) => c.id === id) || {})._color || 'var(--muted)';
}

export function analyticsChannels() {
  const S = getState();
  const st = (S.oauth && S.oauth.channels) || [];
  const ids = [...new Set([...S.channels.map((c) => c.id), ...st.map((c) => c.id)])];
  return ids.map((id) => {
    const x = st.find((c) => c.id === id) || {};
    return { id, nama: (S.channels.find((c) => c.id === id) || {}).nama || x.nama || id, connected: !!x.connected, connected_at: x.connected_at || null };
  });
}

export function editorCell(c, fn) {
  const e = typeof fn === 'function' ? fn(c.editor_id) : editorById(c.editor_id);
  return e ? `<span class="ed">${avatar(e, 'xs')}${esc(e.nama)}</span>` : '<span class="pill warn">Belum dikenali</span>';
}

export function vidCell(c) {
  return `<div class="vid">${thumb(c) ? `<img src="${thumb(c)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<div class="tx"><b>${esc(c.judul)}</b><div>${esc(c._chNama)} · ${c.tipe_video === 'short' ? 'Shorts' : 'Video panjang'}</div></div></div>`;
}

export function avatar(e, size = '') {
  if (!e) return `<span class="ava ${size}" style="background:var(--line-2)" aria-hidden="true">?</span>`;
  const ini = esc((e.nama || '?').trim().slice(0, 1).toUpperCase());
  if (e.foto_url) return `<img class="ava ${size}" src="${esc(e.foto_url)}" alt="Foto ${esc(e.nama)}" data-ini="${ini}" data-color="${e._color}">`;
  return `<span class="ava ${size}" style="background:${e._color}" aria-hidden="true">${ini}</span>`;
}