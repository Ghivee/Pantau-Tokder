import { upload } from '@vercel/blob/client';
import { api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S } from '../core/state.js';
import { $, $$, esc } from '../lib/dom.js';
import { WIB, fmt, nf, sum, tglPendek } from '../lib/format.js';
import { waktuWib } from './presensi.js';
import { toast } from '../ui/bits.js';
import { icon } from '../ui/icons.js';

const PLAT = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' };

const STATUS = (t) => ({
  diproses: ['Diproses', 'warn'], siap: ['Siap tayang', 'leaf'], tayang: ['Tayang', 'ok'], gagal: ['Gagal', 'bad'],
  menunggu: ['Antre (maks 1 jam)', 'warn'], mengunggah: ['Mengunggah', 'warn'],
  'di-app': [t.platform === 'tiktok' ? 'Draf di aplikasi TikTok' : 'Privat di YouTube Studio', 'ok'],
}[t.status] || [t.status, '']);

function postListHtml() {
  const list = (S.sosmed && S.sosmed.posting) || [];
  if (!list.length) return '<div class="empty"><b>Belum ada posting</b>Unggah satu video di atas, lalu tayangkan ke semua platform.</div>';
  return list.map((p) => {
    const siap = p.targets.some((t) => t.status === 'siap');
    return `<div class="post-item"><div class="post-top"><div><b>${esc(p.judul)}</b><div class="muted">${waktuWib(p.created_at)}${p.ukuran ? ' · ' + nf.format(Math.round(p.ukuran / 1048576)) + ' MB' : ''}</div></div>
        <div class="row-actions"><button class="btn sm ghost" data-act="post-cek" data-id="${p.id}">Cek status</button>${siap ? `<button class="btn sm primary" data-act="post-tayang" data-id="${p.id}">Tayangkan</button>` : ''}<button class="btn sm ghost danger" data-act="post-hapus" data-id="${p.id}">Hapus</button></div></div>
        <div class="post-chips">${p.targets.map((t) => { const [lb, cl] = STATUS(t); return `<span class="pill ${cl}" title="${esc(t.galat || '')}">${esc((PLAT[t.platform] || t.platform) + ' · ' + (t.akun_nama || ''))}: ${lb}</span>${t.hasil_url ? `<a class="btn sm ghost" href="${esc(t.hasil_url)}" target="_blank" rel="noopener">Buka</a>` : ''}${t.galat ? `<span class="muted" style="font-size:12.5px">${esc(t.galat)}</span>` : ''}`; }).join('')}</div></div>`;
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

function postingCard(d) {
  const sosmedAkun = d.platforms.flatMap((p) => p.koneksi);
  const yt = ((S.oauth && S.oauth.channels) || []).filter((c) => c.connected);
  const kotak = (name, val, label, off, note) => `<label class="chk"${off ? ' style="opacity:.55"' : ''}><input type="checkbox" name="${name}" value="${esc(val)}" ${off ? 'disabled' : 'checked'}> ${label}${note ? ` <span class="muted" style="font-size:12px">${note}</span>` : ''}</label>`;
  return `<section class="card" id="kartu-posting"><div class="card-h"><h2>Posting sekali upload</h2><p>Unggah satu video, pilih tujuan. Semuanya masuk sebagai draf; baru tayang saat Anda klik Tayangkan.</p></div>
      ${d.blob ? '' : '<div class="notice" role="status" style="margin:0 0 12px"><span><b>Penyimpanan video belum aktif.</b> Di Vercel: Storage → Create → Blob, sambungkan ke proyek ini, lalu deploy ulang.</span></div>'}
      <form id="post-form" style="display:flex;flex-direction:column;gap:12px">
        <label class="field"><span>Judul</span><input class="input" name="judul" maxlength="100" required placeholder="Judul video"></label>
        <label class="field"><span>Deskripsi</span><textarea class="input" name="deskripsi" rows="3" maxlength="4000" placeholder="Keterangan, kode karyawan (#AL), tagar"></textarea></label>
        <label class="field"><span>Video (MP4, MOV, atau WebM)</span><input class="input" type="file" name="video" accept="video/mp4,video/quicktime,video/webm" required></label>
        <div class="field"><span>Kirim ke</span><div class="kata">
          ${sosmedAkun.map((k) => kotak('akun', k.id, esc(PLAT[k.platform] + ' · ' + (k.nama || k.akun_id)), !k.bisa_posting, k.bisa_posting ? '' : 'hubungkan ulang untuk izin posting')).join('')}
          ${yt.map((c) => kotak('yt', c.id, 'YouTube · ' + esc(c.nama), false, 'privat, lewat antrean')).join('')}
          ${!sosmedAkun.length && !yt.length ? '<span class="muted">Belum ada akun tersambung.</span>' : ''}
        </div></div>
        <div class="err" id="post-err" role="alert" style="color:var(--bad);font-size:13px"></div>
        <div class="tools"><button class="btn primary" id="post-btn" ${d.blob ? '' : 'disabled'}>Unggah dan siapkan</button><span class="muted" id="post-prog"></span></div>
      </form>
      <div id="post-list" style="margin-top:14px">${postListHtml()}</div></section>`;
}

PAGES.sosmed = function () {
    const d = S.sosmed;
    const head = `<header class="head"><div><h1>Sosmed</h1><p>TikTok, Instagram dan Facebook: pengikut dan statistik 90 hari terakhir, plus posting satu video ke semua platform.</p></div>
        <div class="tools"><button class="btn primary" data-act="sync-sosmed">${icon('sync')}Tarik data</button></div></header>`;
    if (!d) return head + '<section class="card"><div class="empty"><b>Data sosmed belum termuat</b>Coba muat ulang halaman.</div></section>';
    const hariWib = (iso) => new Date(new Date(iso).getTime() + WIB).toISOString().slice(0, 10);
    const batas = Date.now() - 30 * 86400000;
    const baru = d.posts.filter((p) => new Date(p.tanggal).getTime() >= batas);
    const pengikut = sum(d.platforms.flatMap((p) => p.koneksi), (k) => k.followers || 0);
    const edNama = (id) => { const e = S.editors.find((x) => x.id === id); return e ? esc(e.nama) : '<span class="muted">—</span>'; };
    const kartu = (p) => `<section class="card"><div class="card-h"><h2>${esc(p.nama)}</h2><p>${p.siap ? (p.koneksi.length ? p.koneksi.length + ' akun tersambung' : 'Belum ada akun tersambung') : 'Belum disiapkan di server'}</p></div>
        <div class="checklist">
          ${p.koneksi.map((k) => `<div class="ck"><span class="st ${k.status === 'aktif' && !k.galat ? 'ok' : 'bad'}">${k.status === 'aktif' && !k.galat ? '✓' : '!'}</span><div><b>${esc(k.nama || k.akun_id)}${k.handle ? ' <span class="muted">' + esc(k.handle) + '</span>' : ''}</b>
            <div>${k.followers != null ? nf.format(k.followers) + ' pengikut · ' : ''}${k.last_sync ? 'ditarik ' + waktuWib(k.last_sync) : 'belum pernah ditarik'}</div>
            ${k.galat ? `<div style="color:var(--bad);font-size:13px">${esc(k.galat)}${k.status === 'putus' ? ' Hubungkan ulang.' : ''}</div>` : ''}</div>
            <button class="btn sm ghost danger" data-act="putus-sosmed" data-id="${k.id}">Putuskan</button></div>`).join('')}
          ${p.siap ? `<div class="ck"><span></span><div><div class="muted">Masuk dengan akun ${esc(p.nama)} milik channel, lalu setujui izin baca dan unggah. Sudah tersambung sebelum fitur Posting? Klik Tambah akun untuk memberi izin unggah.</div></div><a class="btn sm" href="/api/social/connect/${p.id}">${p.koneksi.length ? 'Tambah akun' : 'Hubungkan'}</a></div>`
            : `<div class="ck"><span class="st bad">!</span><div><b>Isi di Vercel</b><div class="mono">${p.env.map(esc).join(' · ')}</div><div class="muted">Dari portal pengembang ${esc(p.nama)}; lalu deploy ulang. Lihat Panduan.</div></div></div>`}
        </div></section>`;
    return head + `
        <section class="kpis" aria-label="Angka utama sosmed">
          <div class="kpi"><span class="l">Pengikut</span><span class="v">${fmt(pengikut)}</span><span class="d">semua akun tersambung</span></div>
          <div class="kpi"><span class="l">Posting 30 hari</span><span class="v">${nf.format(baru.length)}</span><span class="d">TikTok, Instagram, Facebook</span></div>
          <div class="kpi"><span class="l">Views 30 hari</span><span class="v">${fmt(sum(baru, (x) => x.views || 0))}</span><span class="d">Instagram bisa kosong untuk foto</span></div>
          <div class="kpi"><span class="l">Suka + komentar</span><span class="v">${fmt(sum(baru, (x) => (x.likes || 0) + (x.comments || 0)))}</span><span class="d">30 hari terakhir</span></div>
        </section>
        ${postingCard(d)}
        <div class="grid-2">${d.platforms.map(kartu).join('')}</div>
        <section class="card"><div class="card-h"><h2>Posting terbaru</h2><p>Pembuat dikenali dari kode karyawan di keterangan posting, sama seperti video YouTube.</p></div>
          ${d.posts.length ? `<div class="table-wrap"><table class="t stack"><thead><tr><th>Posting</th><th>Platform</th><th>Tanggal</th><th class="num">Views</th><th class="num">Suka</th><th class="num">Komentar</th><th class="num">Bagikan</th><th>Pembuat</th></tr></thead><tbody>
            ${d.posts.slice(0, 60).map((x) => `<tr><td class="full">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.judul || '(tanpa judul)')}</a>` : esc(x.judul || '(tanpa judul)')}<div class="muted">${esc(x.akun_nama || '')}</div></td>
              <td data-label="Platform">${esc((d.platforms.find((p) => p.id === x.platform) || {}).nama || x.platform)}</td><td data-label="Tanggal">${tglPendek(hariWib(x.tanggal))}</td>
              <td class="num" data-label="Views">${x.views == null ? '—' : nf.format(x.views)}</td><td class="num" data-label="Suka">${x.likes == null ? '—' : nf.format(x.likes)}</td><td class="num" data-label="Komentar">${x.comments == null ? '—' : nf.format(x.comments)}</td><td class="num" data-label="Bagikan">${x.shares == null ? '—' : nf.format(x.shares)}</td><td data-label="Pembuat">${edNama(x.editor_id)}</td></tr>`).join('')}
          </tbody></table></div>` : '<div class="empty"><b>Belum ada posting</b>Hubungkan akun di atas, lalu klik Tarik data.</div>'}
        </section>`;
  };

AFTER.sosmed = function () {
    pantauPosting();
    const f = $('#post-form');
    if (!f) return;
    f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const err = $('#post-err'), prog = $('#post-prog'), btn = $('#post-btn');
      err.textContent = '';
      const file = f.elements.video.files[0];
      const akun = $$('[name=akun]:checked', f).map((x) => x.value), youtube = $$('[name=yt]:checked', f).map((x) => x.value);
      if (!file) { err.textContent = 'Pilih file video dulu'; return; }
      if (!akun.length && !youtube.length) { err.textContent = 'Pilih minimal satu tujuan'; return; }
      btn.disabled = true;
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
      btn.disabled = false;
    });
  };
