import '../styles.css';
import './pages/analytics.js';
import './pages/gaji.js';
import './pages/hari-ini.js';
import './pages/harian.js';
import './pages/identifikasi.js';
import './pages/karyawan.js';
import './pages/konten.js';
import './pages/monetisasi.js';
import './pages/panduan.js';
import './pages/pengajuan.js';
import './pages/pengaturan.js';
import './pages/performa.js';
import './pages/presensi.js';
import './pages/ringkasan.js';
import './pages/shared.js';
import './pages/sosmed.js';
import './pages/tren.js';
import './actions.js';
import './ui/undo.js';
import { load } from './core/data.js';
import { $ } from './lib/dom.js';
import { closeOverlay } from './ui/dialog.js';
import { render, renderNav } from './ui/layout.js';

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#overlay').innerHTML) closeOverlay(); });

window.addEventListener('popstate', () => { closeOverlay(); render(); });

// Old links used #route (/#presensi, /#harian/3): move them to the real path.
const fromHash = () => { if (location.pathname === '/' && /^#[a-z]/.test(location.hash)) { history.replaceState(null, '', '/' + location.hash.slice(1)); return true; } return false; };

window.addEventListener('hashchange', () => { if (fromHash()) { closeOverlay(); render(); } });

fromHash();

let lastW = innerWidth, rt;

window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; if (!$('#overlay').innerHTML) render(); } }, 200); });

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderNav());

load();
