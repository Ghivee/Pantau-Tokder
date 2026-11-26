import { upload } from '@vercel/blob/client';
import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S, bisa, isAdmin } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { nf } from '../lib/format.js';
import { waktuWib } from './presensi.js';
import { toast } from '../ui/bits.js';
import { confirmDialog } from '../ui/dialog.js';
import { daftarTautan, muatTautanSekali } from './tautan.js';

const PLAT = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' };

const STATUS = (t) => ({
  diproses: ['Diproses', 'warn'], siap: ['Siap tayang', 'leaf'], tayang: ['Tayang', 'ok'], gagal: ['Gagal', 'bad'],
  menunggu: ['Antre (maks 1 jam)', 'warn'], mengunggah: ['Mengunggah', 'warn'],
  'di-app': [t.platform === 'tiktok' ? 'Draf di aplikasi TikTok' : 'Privat di YouTube Studio', 'ok'],
}[t.status] || [t.status, '']);

function postListHtml() {
  const list = (S.sosmed && S.sosmed.posting) || [];
  if (!list.length) return '<div class="empty">Belum ada posting</div>';
  return list.map((p) => {
    const siap = p.targets.some((t) => t.status === 'siap');
    return `<div class="post-item"><div class="post-top"><div><b>${esc(p.judul)}</b><div class="muted">${waktuWib(p.created_at)}${p.ukuran ? ' · ' + nf.format(Math.round(p.ukuran / 1048576)) + ' MB' : ''}</div></div>
        <div class="row-actions"><button class="btn sm ghost" data-act="post-cek" data-id="${p.id}">Cek status</button>${siap && bisa('tayang') ? `<button class="btn sm primary" data-act="post-tayang" data-id="${p.id}">Tayangkan</button>` : ''}${bisa('hapus') ? `<button class="btn sm ghost danger" data-act="post-hapus" data-id="${p.id}">Hapus</button>` : ''}</div></div>
        <div class="post-chips">${p.targets.map((t) => { const [lb, cl] = STATUS(t); return `<span class="pill ${cl}" title="${esc(t.galat || '')}">${esc((PLAT[t.platform] || t.platform) + ' · ' + (t.akun_nama || ''))}: ${lb}</span>${t.hasil_url ? `<a class="btn sm ghost" href="${esc(t.hasil_url)}" target="_blank" rel="noopener">Buka</a>` : ''}${t.galat ? `<span class="muted fs-125">${esc(t.galat)}</span>` : ''}`; }).join('')}</div></div>`;
  }).join('');
}

export const showPostList = () => { const el = $('#post-list'); if (el) el.innerHTML = postListHtml(); };

export function setPosting(p) {
  const l = S.sosmed.posting || (S.sosmed.posting = []);
  const i = l.findIndex((x) => x.id === p.id);
  if (i >= 0) l[i] = p; else l.unshift(p);
  showPostList();
}

// While something is still being processed by a platform, ask for news every 12 seconds (at most 10 times).
let postPoll = null;

export function pantauPosting(n = 0) {
  clearTimeout(postPoll);
  const pending = () => ((S.sosmed && S.sosmed.posting) || []).filter((p) => p.targets.some((t) => t.status === 'diproses'));
  if (!pending().length || n >= 10 || route() !== 'sosmed') return;
  postPoll = setTimeout(async () => {
    try { for (const p of pending()) setPosting(await api(`/api/posting/${p.id}/segarkan`, { method: 'POST', timeout: 30000 })); } catch (e) { /* try again next round */ }
    pantauPosting(n + 1);
  }, 12000);
}

// Tautan pelacak yang bisa dimasukkan ke deskripsi; diisi setelah daftarnya dimuat.
function tautanPilihan() {
  const L = daftarTautan();
  if (!L || !L.length) return '<span class="muted">Belum ada tautan. Buat di menu Affiliate.</span>';
  return L.map((t) => `<label class="chk"><input type="checkbox" name="tautan" value="${esc(t.kode)}"> ${esc(t.label)}</label>`).join('');
}

// Judul + tautan yang dicentang menjadi deskripsi siap pakai (produk, tautan pelacak, pernyataan afiliasi, tagar).
export function susunDeskripsi() {
  const f = $('#post-form');
  if (!f) return;
  const err = $('#post-err');
  err.textContent = '';
  const judul = f.elements.judul.value.trim();
  if (!judul) { err.textContent = 'Isi judul dulu'; f.elements.judul.focus(); return; }
  const jalan = async () => {
    try {
      const r = await api('/api/posting/deskripsi', { method: 'POST', body: { judul, tautan: $$('[name=tautan]:checked', f).map((x) => x.value) } });
      f.elements.deskripsi.value = r.deskripsi;
      toast('Deskripsi siap');
    } catch (e) { err.textContent = e.message; }
  };
  if (f.elements.deskripsi.value.trim()) confirmDialog('Ganti deskripsi?', 'Isi deskripsi sekarang akan diganti.', 'Ganti', jalan); else jalan();
}

function postingCard(d) {
  const sosmedAkun = d.platforms.flatMap((p) => p.koneksi);
  const yt = ((S.oauth && S.oauth.channels) || []).filter((c) => c.connected);
  const kotak = (name, val, label, off, note) => `<label class="chk"${off ? ' style="opacity:.55"' : ''}><input type="checkbox" name="${name}" value="${esc(val)}" ${off ? 'disabled' : 'checked'}> ${label}${note ? ` <span class="muted fs-12">${note}</span>` : ''}</label>`;
  return `<section class="card" id="kartu-posting"><div class="card-h"><h2>Unggah video baru</h2></div>
      ${d.blob ? '' : '<div class="notice mb-12 mt-0" role="status"><span>Penyimpanan video belum aktif (Vercel → Storage → Blob).</span></div>'}
      ${bisa('upload') ? `<form id="post-form" class="stack">
        <div class="step-h"><span class="no" aria-hidden="true">1</span><b>Video</b></div>
        <label class="field"><span>File video</span><input class="input" type="file" name="video" accept="video/mp4,video/quicktime,video/webm" required></label>
        <span class="muted fs-13" id="post-file" aria-live="polite"></span>
        <div class="step-h"><span class="no" aria-hidden="true">2</span><b>Judul dan deskripsi</b></div>
        <label class="field"><span>Judul</span><input class="input" name="judul" maxlength="100" required></label>
        <label class="field"><span>Deskripsi</span><textarea class="input" name="deskripsi" rows="3" maxlength="4000"></textarea></label>
        <div class="field"><span>Tautan produk</span><div class="kata" id="post-tautan">${tautanPilihan()}</div></div>
        <div><button type="button" class="btn sm" data-act="susun-deskripsi">Susun deskripsi</button></div>
        <div class="step-h"><span class="no" aria-hidden="true">3</span><b>Tayang di</b></div>
        <div class="field"><span>Kirim ke</span><div class="kata">
          ${sosmedAkun.map((k) => kotak('akun', k.id, esc(PLAT[k.platform] + ' · ' + (k.nama || k.akun_id)), !k.bisa_posting, k.bisa_posting ? '' : 'hubungkan ulang')).join('')}
          ${yt.map((c) => kotak('yt', c.id, 'YouTube · ' + esc(c.nama), false, '')).join('')}
          ${!sosmedAkun.length && !yt.length ? '<span class="muted">Belum ada akun.</span>' : ''}
        </div></div>
        <div class="err text-bad fs-13" id="post-err" role="alert"></div>
        <div class="tools"><button class="btn primary" id="post-btn" ${d.blob ? '' : 'disabled'}>Unggah sebagai draf</button><span class="muted" id="post-prog"></span></div>
        <p class="muted fs-13">Setiap platform menerima draf dulu. Tayangkan dari daftar di bawah setelah dicek.</p>
      </form>` : ''}
      <h3 class="mt-14">Riwayat upload</h3>
      <div id="post-list">${postListHtml()}</div></section>`;
}

PAGES.sosmed = function () {
    const d = S.sosmed;
    const head = `<header class="head"><h1>Upload</h1></header>`;
    if (!d) return head + '<section class="card"><div class="empty">Belum termuat</div></section>';
    const kartu = (p) => `<section class="card"><div class="card-h"><h2>${esc(p.nama)}</h2>${p.siap && isAdmin() ? `<a class="btn sm" href="/api/social/connect/${p.id}">${p.koneksi.length ? 'Tambah' : 'Hubungkan'}</a>` : ''}</div>
        <div class="checklist">
          ${p.koneksi.map((k) => `<div class="ck"><span class="st ${k.status === 'aktif' && !k.galat ? 'ok' : 'bad'}">${k.status === 'aktif' && !k.galat ? '✓' : '!'}</span><div><b>${esc(k.nama || k.akun_id)}${k.handle ? ' <span class="muted">' + esc(k.handle) + '</span>' : ''}</b>
            ${k.galat ? `<div class="text-bad fs-13">${esc(k.galat)}${k.status === 'putus' ? ' Hubungkan ulang.' : ''}</div>` : ''}</div>
            ${isAdmin() ? `<button class="btn sm ghost danger" data-act="putus-sosmed" data-id="${k.id}">Putuskan</button>` : ''}</div>`).join('')}
          ${p.siap || !isAdmin() ? '' : `<div class="ck"><span class="st bad">!</span><div><b>Isi di Vercel</b><div class="mono">${p.env.map(esc).join(' · ')}</div></div></div>`}
        </div></section>`;
    const nAkun = d.platforms.reduce((n, p) => n + p.koneksi.length, 0);
    return head + `
        ${postingCard(d)}
        <details class="card akun-sosmed"${nAkun ? '' : ' open'}><summary><b>Akun tersambung</b> <span class="muted">${nAkun} akun</span></summary>
        <div class="grid-2 mt-12">${d.platforms.map(kartu).join('')}</div></details>
      `;
  };

AFTER.sosmed = function () {
    pantauPosting();
    muatTautanSekali().then(() => { const el = $('#post-tautan'); if (el && !$$('[name=tautan]:checked', el).length) el.innerHTML = tautanPilihan(); });
    const f = $('#post-form');
    if (!f) return;
    f.elements.video.addEventListener('change', () => { const x = f.elements.video.files[0]; $('#post-file').textContent = x ? `${x.name} · ${nf.format(Math.max(1, Math.round(x.size / 1048576)))} MB` : ''; });
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const err = $('#post-err'), prog = $('#post-prog'), btn = $('#post-btn');
      err.textContent = '';
      const file = f.elements.video.files[0];
      const akun = $$('[name=akun]:checked', f).map((x) => x.value), youtube = $$('[name=yt]:checked', f).map((x) => x.value);
      if (!file) { err.textContent = 'Pilih file video dulu'; return; }
      if (!akun.length && !youtube.length) { err.textContent = 'Pilih minimal satu tujuan'; return; }
      btn.disabled = true;
      const tahan = (e) => { e.preventDefault(); e.returnValue = ''; };
      window.addEventListener('beforeunload', tahan);
      try {
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp4';
        const blob = await upload('posting/video.' + ext, file, {
          access: 'public', handleUploadUrl: '/api/posting/blob', multipart: true, contentType: file.type || 'video/mp4',
          onUploadProgress: (e) => { prog.textContent = 'Mengunggah video… ' + Math.round(e.percentage) + '%'; },
        });
        prog.textContent = 'Menyiapkan di tiap platform…';
        const p = await api('/api/posting', { method: 'POST', timeout: 90000, body: { judul: f.elements.judul.value, deskripsi: f.elements.deskripsi.value, blob_url: blob.url, ukuran: file.size, mime: file.type, akun, youtube } });
        setPosting(p);
        f.reset();
        prog.textContent = '';
        toast('Video terunggah. Cek hasil per platform di bawah.');
        pantauPosting();
      } catch (e) { err.textContent = e.message || 'Gagal mengunggah'; prog.textContent = ''; }
      window.removeEventListener('beforeunload', tahan);
      btn.disabled = false;
    });
  };
