import '../styles/index.css';
import './pages/analytics.js';
import './pages/akses.js';
import './pages/akun.js';
import './pages/jejak.js';
import './pages/kalender.js';
import './pages/menu.js';
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
import './pages/rekap.js';
import './pages/ringkasan.js';
import './pages/saran.js';
import './pages/shared.js';
import './pages/sosmed.js';
import './pages/tautan.js';
import './pages/tren.js';
import './actions.js';
import './ui/undo.js';
import { load, simpanCache } from './core/data.js';
import { S } from './core/state.js';
import { bukaTirai } from './ui/tirai.js';
import { tangkapTokenSso, umumkanKeluar } from './core/sso.js';
import { toast } from './ui/bits.js';
import { $ } from './lib/dom.js';
import { closeOverlay, trapTab } from './ui/dialog.js';
import { render, renderNav } from './ui/layout.js';

// Token SSO dari Master harus ditangkap lebih dulu (sinkron, sebelum fromHash di bawah): kalau tidak, #sso=... dianggap
// rute lama dan dipindah ke path, sehingga SSO gagal dan tokennya ikut tertulis di alamat.
const ssoMasuk = tangkapTokenSso();

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#overlay').innerHTML) closeOverlay(); else trapTab(ev); });

window.addEventListener('popstate', () => { closeOverlay(); render(); });

// Old links used #route (/#presensi, /#harian/3): move them to the real path.
const fromHash = () => { if (location.pathname === '/' && /^#(?!sso=)[a-z]/.test(location.hash)) { history.replaceState(null, '', '/' + location.hash.slice(1)); return true; } return false; };

window.addEventListener('hashchange', () => { if (fromHash()) { closeOverlay(); render(); } });

fromHash();

// Warna sekarang selalu mengikuti mode HP; pilihan tema lama dibuang.
try { localStorage.removeItem('pt_theme'); } catch (e) { /* penyimpanan mati */ }
delete document.documentElement.dataset.theme;

let lastW = innerWidth, rt;

window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; if (!$('#overlay').innerHTML) render(); } }, 200); });

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderNav());

ssoMasuk.then(async (r) => {
  const masukBaru = r.ada && !r.galat;
  // Data simpanan lama dibuang. Alamat yang diminta (mis. /presensi dari Master) dipertahankan.
  if (masukBaru) simpanCache(null);
  await load();
  if (r.galat) toast(r.galat, true);
  else if (S.session) { try { sessionStorage.removeItem('pt_keluar'); } catch (e) { /* penyimpanan mati */ } } else umumkanKeluar();
});

// Kembali lewat tombol Back dari halaman masuk: browser memulihkan halaman lama apa adanya, termasuk layar peralihan.
window.addEventListener('pageshow', (ev) => { if (ev.persisted) { bukaTirai(); load(); } });
