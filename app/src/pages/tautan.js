import { analyticsChannels, api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S, bisa } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { idr, nf, tglPendek } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { closeOverlay, confirmDialog, openDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';

// Menu Tautan: saran produk otomatis (seperti rekomendasi di YouTube Shopping) dan tautan pelacak milik tim.
// Satu ketukan dari saran produk membuka dialog yang namanya sudah terisi; tinggal menempel tautan affiliate.

const T = (S.tautanData = { daftar: null, saran: null, galatSaran: null });

const urlTautan = (kode) => location.origin + '/go/' + kode;
const TREN_ALASAN = { terlaris: 'ok', ditanya: 'leaf', dicari: '' };
const channelTerakhir = () => { try { return localStorage.getItem('pt_tl_ch'); } catch (e) { return null; } };
const simpanChannel = (id) => { try { localStorage.setItem('pt_tl_ch', id); } catch (e) { /* penyimpanan mati */ } };

// Sudah ada tautan untuk produk ini: tampilkan klik 7 harinya dan tombol salin; belum: tombol buat tautan.
function barisSaran(x) {
  const chips = x.alasan.map((a) => `<span class="pill ${TREN_ALASAN[a.jenis] || ''}">${esc(a.teks)}</span>`).join('');
  const aksi = x.tautan
    ? `<span class="pr-ada"><b>${nf.format(x.tautan.tujuh_hari)}</b><span class="muted">klik 7 hari</span></span><button class="btn sm" data-act="tautan-salin" data-kode="${esc(x.tautan.kode)}">Salin</button>`
    : `<a class="lnk" href="${esc(x.cari)}" target="_blank" rel="noopener">Cari</a>${bisa('tautan') ? `<button class="btn sm primary" data-act="tautan-baru" data-v="${esc(x.nama.slice(0, 80))}">Buat tautan</button>` : ''}`;
  return `<div class="pr-row"><div class="pr-t"><span class="pr-nm">${esc(x.nama)}</span><span class="pr-c">${chips}${x.komisi != null ? `<span class="muted">${idr(x.komisi)} · 30 hari</span>` : ''}</span></div><div class="pr-a">${aksi}</div></div>`;
}

function kartuSaran() {
  const S2 = T.saran;
  let isi;
  if (!S2) isi = T.galatSaran ? `<p class="muted">${esc(T.galatSaran)}</p>` : '<div class="skeleton" style="height:140px"></div>';
  else if (!S2.daftar.length) isi = '<p class="muted">Belum ada saran produk. Saran muncul dari penjualan, pertanyaan penonton, dan pencarian YouTube.</p>';
  else isi = S2.daftar.map(barisSaran).join('');
  return `<section class="card"><div class="card-h"><h2>Saran produk</h2><span class="muted">otomatis</span></div>${isi}</section>`;
}

function kartuTautan() {
  const L = T.daftar, chans = analyticsChannels();
  let isi;
  if (L == null) isi = '<div class="skeleton" style="height:90px"></div>';
  else if (!L.length) isi = '<p class="muted">Belum ada tautan. Pilih produk di atas untuk membuat yang pertama.</p>';
  else isi = `<div class="tl-list">${[...L].sort((a, b) => b.tujuh_hari - a.tujuh_hari || b.total - a.total).map((t) => `
      <div class="tl-row"><div class="tl-t"><b>${esc(t.label)}</b><span class="muted mono">${esc(urlTautan(t.kode).replace(/^https?:\/\//, ''))}</span>
        <span class="muted">${esc((chans.find((c) => c.id === t.channel_id) || {}).nama || '')}${t.video_id ? ' · ' + esc(((S.content.find((v) => v.post_id === t.video_id) || {}).judul) || 'video tertaut') : ''}</span></div>
        <div class="tl-n"><b>${nf.format(t.tujuh_hari)}</b><span class="muted">7 hari</span></div>
        <div class="tl-a"><button class="btn sm ghost" data-act="tautan-salin" data-kode="${esc(t.kode)}">Salin</button><button class="btn sm ghost" data-act="tautan-teks" data-kode="${esc(t.kode)}">Salin teks</button>${bisa('hapus') ? `<button class="btn sm ghost danger" data-act="tautan-hapus" data-kode="${esc(t.kode)}">Hapus</button>` : ''}</div></div>`).join('')}</div>`;
  return `<section class="card"><div class="card-h"><h2>Tautan saya</h2><span class="muted">${L ? L.length : ''}</span></div>${isi}</section>`;
}

PAGES.tautan = () => `<header class="head"><h1>Tautan</h1>${bisa('tautan') ? `<div class="tools"><button class="btn sm" data-act="tautan-baru" data-v="">${icon('plus')}Baru</button></div>` : ''}</header>
  <div id="tautan-isi" class="stack-page">${kartuSaran()}${kartuTautan()}</div>`;

function tampil() {
  const el = $('#tautan-isi');
  if (el && !$('#overlay').innerHTML) el.innerHTML = kartuSaran() + kartuTautan();
}

export async function muatTautan() {
  try { T.daftar = (await api('/api/rekap/tautan')).tautan; } catch (e) { if (T.daftar == null) return null; }
  return T.daftar;
}

async function muatSaranProduk() {
  try { T.saran = await api('/api/produk-saran', { timeout: 60000 }); T.galatSaran = null; } catch (e) { T.galatSaran = e.message; }
  tampil();
}

AFTER.tautan = () => {
  muatTautan().then(tampil);
  muatSaranProduk();
};

// Daftar untuk halaman Upload (disusun menjadi deskripsi): dimuat sekali bila belum ada.
export const daftarTautan = () => T.daftar;
export async function muatTautanSekali() { return T.daftar == null ? muatTautan() : T.daftar; }

// ---------- dialog buat tautan ----------

// Video terbaru channel itu (maksimal 40) untuk dikaitkan ke tautan, supaya klik terlihat per video.
function opsiVideo(channelId) {
  const v = S.content.filter((c) => c._ch === channelId && c.post_id).sort((a, b) => (a.tanggal_upload < b.tanggal_upload ? 1 : -1)).slice(0, 40);
  return '<option value="">Tanpa video</option>' + v.map((c) => `<option value="${esc(c.post_id)}">${esc(c.judul)} · ${tglPendek(c._day)}</option>`).join('');
}

export function tautanDialog(label = '') {
  const chans = analyticsChannels();
  const awal = chans.some((c) => c.id === channelTerakhir()) ? channelTerakhir() : chans[0] && chans[0].id;
  openDialog(`<h2>Tautan baru</h2>
      <div class="stack">
        <label class="field"><span>Produk</span><input class="input" id="tl-label" maxlength="80" autocomplete="off" value="${esc(label)}"></label>
        <label class="field"><span>Tautan affiliate</span>
          <div class="tl-tempel"><input class="input" id="tl-tujuan" inputmode="url" placeholder="https://" autocomplete="off" autocapitalize="off"><button type="button" class="btn" id="tl-tempel">Tempel</button></div></label>
        <label class="field"><span>Channel</span><select class="input" id="tl-ch">${chans.map((c) => `<option value="${esc(c.id)}" ${c.id === awal ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select></label>
        <label class="field"><span>Video (opsional)</span><select class="input" id="tl-video">${opsiVideo(awal)}</select></label>
      </div>
      <div class="err" id="tl-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" data-act="tautan-buat">Buat dan salin</button></div>`, (d) => {
    $('#tl-ch', d).addEventListener('change', (ev) => { $('#tl-video', d).innerHTML = opsiVideo(ev.target.value); });
    $('#tl-tempel', d).addEventListener('click', async () => {
      try {
        const t = (await navigator.clipboard.readText()).trim();
        if (/^https:\/\/\S+$/i.test(t)) { $('#tl-tujuan', d).value = t; $('#tl-err', d).textContent = ''; } else toast('Tidak ada tautan https di clipboard', true);
      } catch (e) { toast('Izinkan akses clipboard, atau tempel manual', true); }
    });
    // Nama sudah terisi dari saran produk: langsung ke kolom tautan.
    ($('#tl-label', d).value ? $('#tl-tujuan', d) : $('#tl-label', d)).focus();
  });
}

export async function buatTautan() {
  const v = (id) => $(id).value.trim(), err = $('#tl-err');
  err.textContent = '';
  try {
    const t = await api('/api/rekap/tautan', { method: 'POST', body: { label: v('#tl-label'), channel_id: $('#tl-ch').value, video_id: $('#tl-video').value || null, tujuan: v('#tl-tujuan') } });
    simpanChannel(t.channel_id);
    T.daftar = [t, ...(T.daftar || [])];
    if (S.rekap) S.rekap.metrik = null; // klik di Rekap dihitung ulang saat dibuka
    closeOverlay();
    tampil();
    if (route() === 'tautan') muatSaranProduk();
    try { await navigator.clipboard.writeText(urlTautan(t.kode)); toast('Dibuat dan disalin'); } catch (e) { toast('Tautan dibuat'); }
  } catch (e) { err.textContent = e.message; }
}

export async function salinTautan(kode) {
  try { await navigator.clipboard.writeText(urlTautan(kode)); toast('Disalin'); } catch (e) { toast(urlTautan(kode), true); }
}

// Satu baris siap tempel ke deskripsi video: "• nama produk: tautan".
export async function salinTeks(kode) {
  const t = (T.daftar || []).find((x) => x.kode === kode);
  if (!t) return;
  const baris = `• ${t.label}: ${urlTautan(kode)}`;
  try { await navigator.clipboard.writeText(baris); toast('Teks disalin'); } catch (e) { toast(baris, true); }
}

export function hapusTautan(kode) {
  const t = (T.daftar || []).find((x) => x.kode === kode);
  if (!t) return;
  confirmDialog('Hapus tautan?', `${t.label}. Tautan di deskripsi video berhenti bekerja.`, 'Hapus', async () => {
    try {
      await api('/api/rekap/tautan/' + encodeURIComponent(kode), { method: 'DELETE' });
      T.daftar = T.daftar.filter((x) => x.kode !== kode);
      if (S.rekap) S.rekap.metrik = null;
      tampil();
      if (route() === 'tautan') muatSaranProduk();
    } catch (e) { toast(e.message, true); }
  });
}
