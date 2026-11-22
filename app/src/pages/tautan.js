import { analyticsChannels, api } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { S, bisa } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { idr, nf, tglPendek } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { closeOverlay, confirmDialog, openDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';
import { imporAfiliasiDialog } from './afiliasi.js';

// Menu Affiliate: semua kebutuhan affiliate di satu tempat, dari atas ke bawah: produk affiliate terlaris (yang terbukti laku),
// produk dicari (yang dicari penonton di YouTube), lalu tautan pelacak milik tim. Di tiap produk, satu ketukan membuat tautan
// (nama sudah terisi) atau, bila tautannya sudah ada, menyalinnya.

const T = (S.tautanData = { daftar: null, af: null, afHari: 28, afGalat: null, dicari: null, galatDicari: null });

const urlTautan = (kode) => location.origin + '/go/' + kode;
const cariShopee = (q) => 'https://shopee.co.id/search?keyword=' + encodeURIComponent(q);
const channelTerakhir = () => { try { return localStorage.getItem('pt_tl_ch'); } catch (e) { return null; } };
const simpanChannel = (id) => { try { localStorage.setItem('pt_tl_ch', id); } catch (e) { /* penyimpanan mati */ } };

// Dua nama dianggap produk yang sama bila yang satu memuat yang lain (minimal 6 huruf).
const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const serupa = (a, b) => { const x = norm(a), y = norm(b); if (!x || !y) return false; const [p, q] = x.length <= y.length ? [x, y] : [y, x]; return p.length >= 6 && q.includes(p); };
const tautanProduk = (nama) => (T.daftar || []).find((t) => serupa(t.label, nama)) || null;

// Aksi di tiap produk: sudah ada tautan → klik 7 hari dan Salin; belum → Cari di Shopee dan Buat tautan.
function aksiProduk(nama) {
  const t = tautanProduk(nama);
  if (t) return `<span class="pr-ada"><b>${nf.format(t.tujuh_hari)}</b><span class="muted">klik 7 hari</span></span><button class="btn sm" data-act="tautan-salin" data-kode="${esc(t.kode)}">Salin</button>`;
  return `<a class="lnk" href="${esc(cariShopee(nama))}" target="_blank" rel="noopener">Cari</a>${bisa('tautan') ? `<button class="btn sm primary" data-act="tautan-baru" data-v="${esc(String(nama).slice(0, 80))}">Buat tautan</button>` : ''}`;
}

// 1. Produk affiliate terlaris menurut komisi di periode terpilih, dibanding periode sebelumnya yang sama panjang.
// Tanpa izin penghasilan hanya urutan dan arah tren yang tampil, tanpa nominal.
const TREN = { naik: ['naik', 'ok'], turun: ['turun', 'bad'], stabil: ['stabil', ''], baru: ['baru', 'leaf'] };

function kartuTerlaris() {
  const A = T.af;
  if (!A) return T.afGalat ? `<section class="card"><div class="card-h"><h2>Produk affiliate terlaris</h2></div><p class="muted">${esc(T.afGalat)}</p></section>` : '<div class="skeleton" style="height:120px"></div>';
  const uang = !!A.uang;
  if (!A.ada_data && !uang) return '';
  const seg = `<div class="seg" role="group" aria-label="Periode">${[7, 28, 90, 365].map((n) => `<button data-act="af-hari" data-v="${n}" aria-pressed="${A.hari === n}">${n} hari</button>`).join('')}</div>`;
  const baris = A.terlaris.map((x) => { const [t, c] = TREN[x.tren]; return `
      <div class="af-row"><span class="af-n">${x.peringkat}</span>
        <span class="af-p"><span class="af-nm">${esc(x.produk)}</span>
          <span class="muted"><span class="pill ${c}">${t}</span>${uang ? ` ${nf.format(x.pesanan)} pesanan${x.tren === 'baru' ? '' : ` · sebelumnya ${idr(x.komisi_sebelum)}`}` : ''}</span>
          <span class="af-akt">${aksiProduk(x.produk)}</span></span>
        <span class="af-r">${uang ? `<b>${idr(x.komisi)}</b>` : ''}</span></div>`; }).join('');
  return `<section class="card">
      <div class="card-h"><h2>Produk affiliate terlaris</h2>${uang ? '<button class="btn sm" data-act="af-impor">Impor laporan</button>' : ''}</div>
      ${seg}
      ${A.terlaris.length ? `<div class="af-list mt-12">${baris}</div>${uang ? `<p class="sr-ket">Total komisi ${A.hari} hari: <b>${idr(A.total)}</b>${A.total_sebelum ? ` · sebelumnya ${idr(A.total_sebelum)}` : ''}${A.data_sampai ? ` · data sampai ${tglPendek(A.data_sampai)}` : ''}</p>` : ''}`
        : `<p class="muted mt-12">Belum ada penjualan dalam ${A.hari} hari terakhir.</p>`}
    </section>`;
}

// 2. Produk yang dicari penonton di YouTube (dari saran pencarian; semua channel digabung, tanpa duplikat).
function kartuDicari() {
  let isi;
  if (T.dicari == null) isi = T.galatDicari ? `<p class="muted">${esc(T.galatDicari)}</p>` : '<div class="skeleton" style="height:100px"></div>';
  else if (!T.dicari.length) isi = '<p class="muted">Belum ada produk yang terdeteksi dicari.</p>';
  else isi = T.dicari.map((nama) => `<div class="pr-row"><div class="pr-t"><span class="pr-nm">${esc(nama)}</span></div><div class="pr-a">${aksiProduk(nama)}</div></div>`).join('');
  return `<section class="card"><div class="card-h"><h2>Produk dicari</h2><span class="muted">di YouTube</span></div>${isi}</section>`;
}

// 3. Tautan pelacak milik tim, klik terbanyak di atas.
function kartuTautan() {
  const L = T.daftar, chans = analyticsChannels();
  let isi;
  if (L == null) isi = '<div class="skeleton" style="height:90px"></div>';
  else if (!L.length) isi = '<p class="muted">Belum ada tautan. Buat dari salah satu produk di atas.</p>';
  else isi = `<div class="tl-list">${[...L].sort((a, b) => b.tujuh_hari - a.tujuh_hari || b.total - a.total).map((t) => `
      <div class="tl-row"><div class="tl-t"><b>${esc(t.label)}</b><span class="muted mono">${esc(urlTautan(t.kode).replace(/^https?:\/\//, ''))}</span>
        <span class="muted">${esc((chans.find((c) => c.id === t.channel_id) || {}).nama || '')}${t.video_id ? ' · ' + esc(((S.content.find((v) => v.post_id === t.video_id) || {}).judul) || 'video tertaut') : ''}</span></div>
        <div class="tl-n"><b>${nf.format(t.tujuh_hari)}</b><span class="muted">7 hari</span></div>
        <div class="tl-a"><button class="btn sm ghost" data-act="tautan-salin" data-kode="${esc(t.kode)}">Salin</button><button class="btn sm ghost" data-act="tautan-teks" data-kode="${esc(t.kode)}">Salin teks</button>${bisa('hapus') ? `<button class="btn sm ghost danger" data-act="tautan-hapus" data-kode="${esc(t.kode)}">Hapus</button>` : ''}</div></div>`).join('')}</div>`;
  return `<section class="card"><div class="card-h"><h2>Tautan saya</h2><span class="muted">${L ? L.length : ''}</span></div>${isi}</section>`;
}

PAGES.affiliate = () => `<header class="head"><h1>Affiliate</h1>${bisa('tautan') ? `<div class="tools"><button class="btn sm" data-act="tautan-baru" data-v="">${icon('plus')}Baru</button></div>` : ''}</header>
  <div id="tautan-isi" class="stack-page">${kartuTerlaris()}${kartuDicari()}${kartuTautan()}</div>`;

function tampil() {
  const el = $('#tautan-isi');
  if (el && !$('#overlay').innerHTML) el.innerHTML = kartuTerlaris() + kartuDicari() + kartuTautan();
}

export async function muatTautan() {
  try { T.daftar = (await api('/api/rekap/tautan')).tautan; } catch (e) { if (T.daftar == null) return null; }
  return T.daftar;
}

export async function muatAfiliasi(hari = T.afHari) {
  T.afHari = hari;
  try { T.af = await api('/api/afiliasi?hari=' + hari, { timeout: 30000 }); T.afGalat = null; } catch (e) { T.afGalat = e.message; }
  tampil();
}

// Frasa produk dari pencarian YouTube tiap channel, digabung dan dibuang yang kembar.
async function muatDicari() {
  try {
    const d = await api('/api/saran', { timeout: 60000 });
    const lihat = new Set(), daftar = [];
    for (const c of d.channels) for (const p of c.produk || []) { const k = norm(p.nama); if (!lihat.has(k)) { lihat.add(k); daftar.push(p.nama); } }
    T.dicari = daftar.slice(0, 8); T.galatDicari = null;
  } catch (e) { T.galatDicari = e.message; }
  tampil();
}

AFTER.affiliate = () => {
  muatTautan().then(tampil);
  if (!T.af) muatAfiliasi();
  if (!T.dicari) muatDicari();
};

export function imporAfiliasi() { imporAfiliasiDialog(() => muatAfiliasi()); }

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
      } catch (e) { toast(e.message, true); }
  });
}
