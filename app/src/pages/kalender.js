// Kalender aktivitas: satu bulan dalam kotak tanggal; ketuk tanggal untuk rinciannya. Tidak ada di menu,
// dibuka dari Rangkuman. Data dibatasi server: karyawan hanya menerima miliknya sendiri.
import { api } from '../core/data.js';
import { exportKalender } from '../core/export.js';
import { AFTER, PAGES } from '../core/registry.js';
import { navigate, route } from '../core/router.js';
import { S, isAdmin } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { fmt, tglPanjang, today } from '../lib/format.js';
import { avatar } from '../ui/bits.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';
import { bukaRiwayat } from './jejak.js';

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
// Setiap status punya tanda berbentuk beda, jadi tetap terbaca tanpa warna.
export const STATUS = {
  hadir: ['●', 'Hadir tepat waktu'], telat: ['◐', 'Telat'], izin: ['○', 'Izin'], sakit: ['○', 'Sakit'], cuti: ['○', 'Cuti'],
  alpa: ['✕', 'Tidak hadir'], belum: ['…', 'Belum absen'], libur: ['', 'Libur'], '': ['', 'Belum ada data'],
};
const nama = (b) => `${BULAN[+b.slice(5) - 1]} ${b.slice(0, 4)}`;
const geser = (b, n) => { const d = new Date(Date.UTC(+b.slice(0, 4), +b.slice(5) - 1 + n, 1)); return d.toISOString().slice(0, 7); };

const keadaan = () => (S.kal ||= { bulan: today().slice(0, 7), hari: today(), orang: '', data: {}, galat: null });
export const dataKalender = () => { const K = keadaan(); return { K, data: K.data[K.bulan] }; };

async function muat(bulan) {
  const K = keadaan();
  K.galat = null;
  try { K.data[bulan] = await api('/api/kalender?bulan=' + bulan, { timeout: 30000 }); } catch (e) { K.galat = e.message; }
  if (route() === 'kalender') render();
}

const terpilih = (K, h) => (K.orang ? h.orang.filter((o) => String(o.id) === K.orang) : h.orang);

function kotak(K, D, h) {
  const daftar = terpilih(K, h);
  const video = daftar.reduce((n, o) => n + o.video.length, 0) + (!K.orang && h.lain ? h.lain.video.length : 0);
  const tanda = daftar.filter((o) => STATUS[o.status][0]).map((o) => `<i class="kal-t ${o.status}">${STATUS[o.status][0]}</i>`).join('');
  const ucap = [tglPanjang(h.tanggal), h.libur || '', ...daftar.map((o) => `${(D.orang.find((x) => x.id === o.id) || {}).nama}: ${STATUS[o.status][1]}`), video ? video + ' video' : ''].filter(Boolean).join('. ');
  return `<button type="button" class="kal-hari${h.libur ? ' libur' : ''}${h.tanggal === K.hari ? ' dipilih' : ''}${h.tanggal === D.hariIni ? ' kini' : ''}" data-act="kal-hari" data-v="${h.tanggal}" aria-pressed="${h.tanggal === K.hari}" aria-label="${esc(ucap)}">
    <b>${+h.tanggal.slice(8)}</b><span class="kal-tanda" aria-hidden="true">${tanda}</span>${video ? `<small aria-hidden="true">${video} vid</small>` : ''}</button>`;
}

const bagian = (judul, isi) => (isi ? `<div class="kal-bag"><h4>${judul}</h4>${isi}</div>` : '');
const daftarHtml = (a, f) => (a.length ? `<ul>${a.map((x) => `<li>${f(x)}</li>`).join('')}</ul>` : '');
const videoBaris = (v) => `<span class="mono">${v.jam}</span> ${/^https?:\/\//.test(v.url || '') ? `<a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.judul || 'Tanpa judul')}</a>` : esc(v.judul || 'Tanpa judul')} <small>${esc(v.channel || '')}${v.views != null ? ' · ' + fmt(v.views) + ' views' : ''}</small>`;
const unggahBaris = (u) => `<span class="mono">${u.jam}</span> ${esc(u.judul)} <small>${u.tujuan.map((t) => esc(t.platform + ' (' + t.status + ')')).join(', ')}</small>`;

// Ringkasan Jejak: hanya ada pada data pemilik (server tidak mengirimnya ke karyawan).
function jejakHtml(j, siapa, tanggal) {
  if (!j) return '';
  const butir = [`${j.jumlah} catatan, ${j.awal}–${j.akhir}`, j.masuk ? `${j.masuk} kali masuk` : '', j.gagal ? `${j.gagal} gagal masuk` : '', j.sensitif ? `${j.sensitif} buka data sensitif` : '', j.perubahan ? `${j.perubahan} perubahan di Office` : ''].filter(Boolean).join(' · ');
  return bagian('Jejak', `<p>${esc(butir)}${j.peringatan ? ` <span class="pill warn">${j.peringatan} peringatan</span>` : ''}</p>
    ${j.perangkat.length || j.lokasi.length ? `<p class="muted">${esc([...j.perangkat, ...j.lokasi].join(' · '))}</p>` : ''}
    <button type="button" class="btn sm ghost" data-act="kal-jejak" data-nama="${esc(siapa)}" data-v="${tanggal}">Lihat lengkap</button>`);
}

function orangHtml(D, o, tanggal) {
  const e = S.edMap.get(o.id) || D.orang.find((x) => x.id === o.id) || { nama: '?' };
  const presensi = [
    o.masuk ? `<li>Masuk <b class="mono">${o.masuk.jam}</b>${o.masuk.telat ? ` <span class="pill bad">telat ${o.masuk.telat} mnt</span>` : ''}${o.masuk.jarak != null ? ` <small>${o.masuk.jarak} m dari kantor</small>` : ''}</li>` : '',
    o.pulang ? `<li>Pulang <b class="mono">${o.pulang.jam}</b>${o.pulang.jarak != null ? ` <small>${o.pulang.jarak} m dari kantor</small>` : ''}</li>` : o.masuk ? '<li>Pulang: belum absen</li>' : '',
    ...o.ditolak.map((x) => `<li><span class="mono">${x.jam}</span> Absen ${esc(x.jenis || '')} ditolak <small>${esc(x.alasan || '')}</small></li>`),
  ].join('');
  const isi = bagian('Presensi', presensi ? `<ul>${presensi}</ul>` : '')
    + bagian('Izin dan klaim', daftarHtml(o.pengajuan, (x) => `${esc(x.jenis)} <span class="pill ${x.status === 'disetujui' ? 'ok' : x.status === 'ditolak' ? 'bad' : 'warn'}">${esc(x.status)}</span> <small>${esc(x.alasan || '')}${x.jenis === 'klaim' && x.jumlah ? ' · Rp ' + Math.round(x.jumlah).toLocaleString('id-ID') : ''}</small>`))
    + bagian('Video tayang', daftarHtml(o.video, videoBaris))
    + bagian('Unggahan draf', daftarHtml(o.unggah, unggahBaris))
    + bagian('Tugas', daftarHtml(o.tugas, (x) => `<span class="mono">${esc(x.jam)}</span> ${esc(x.tugas)}${x.jumlah > 1 ? ' × ' + x.jumlah : ''} <small>${esc(x.detail || '')}</small>`))
    + jejakHtml(o.jejak, e.nama, tanggal);
  return `<section class="kal-orang"><header>${avatar(e, 'sm')}<b>${esc(e.nama)}</b><span class="muted">${STATUS[o.status][1]}</span></header>${isi || '<p class="muted">Tidak ada aktivitas tercatat.</p>'}</section>`;
}

function rincian(K, D) {
  const h = D.hari.find((x) => x.tanggal === K.hari);
  if (!h) return '<section class="card"><p class="muted">Ketuk tanggal untuk melihat rinciannya.</p></section>';
  const lain = !K.orang && h.lain ? bagian('Video tanpa pembuat', daftarHtml(h.lain.video, videoBaris)) + bagian('Unggahan pemilik atau lainnya', daftarHtml(h.lain.unggah, unggahBaris)) : '';
  const jejakLain = !K.orang && h.lain ? h.lain.jejak.map((j) => `<section class="kal-orang"><header><b>${esc(j.nama)}</b></header>${jejakHtml(j, j.nama, h.tanggal)}</section>`).join('') : '';
  return `<section class="card" id="kal-rinci" aria-live="polite"><div class="card-h"><h2>${tglPanjang(h.tanggal)}</h2>${h.libur ? `<span class="muted">${esc(h.libur)}</span>` : ''}</div>
    ${terpilih(K, h).map((o) => orangHtml(D, o, h.tanggal)).join('')}${lain ? `<section class="kal-orang">${lain}</section>` : ''}${jejakLain}</section>`;
}

PAGES.kalender = function () {
  const { K, data: D } = dataKalender();
  const kepala = `<header class="head"><div><h1>Kalender</h1><p>${isAdmin() ? 'Aktivitas tim per tanggal.' : 'Aktivitas Anda per tanggal.'}</p></div>
    <div class="tools"><a class="btn ghost" href="/">‹ Rangkuman</a><button class="btn" data-act="csv-kalender" ${D ? '' : 'disabled'}>${icon('download')}Spreadsheet</button></div></header>`;
  const bulan = `<div class="kal-bar"><div class="kal-bulan"><button type="button" class="btn sm" data-act="kal-bulan" data-v="-1" aria-label="Bulan sebelumnya">‹</button><b>${nama(K.bulan)}</b><button type="button" class="btn sm" data-act="kal-bulan" data-v="1" aria-label="Bulan berikutnya" ${K.bulan >= today().slice(0, 7) ? 'disabled' : ''}>›</button></div>
    ${D && D.orang.length > 1 ? `<div class="seg" role="group" aria-label="Orang">${[['', 'Semua'], ...D.orang.map((o) => [String(o.id), o.nama])].map(([v, l]) => `<button type="button" data-act="kal-orang" data-v="${v}" aria-pressed="${K.orang === v}">${esc(l)}</button>`).join('')}</div>` : ''}</div>`;
  if (!D) return kepala + bulan + (K.galat ? `<section class="card state" role="alert"><b>Kalender belum bisa dimuat</b><p>${esc(K.galat)}</p><button class="btn primary" data-act="kal-muat">Coba lagi</button></section>` : '<div class="skeleton" style="height:320px"></div>');
  const kosong = (new Date(K.bulan + '-01T00:00:00Z').getUTCDay() + 6) % 7;
  return `${kepala}${bulan}
    <section class="card kal"><div class="kal-grid">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((x) => `<span class="kal-nama" aria-hidden="true">${x}</span>`).join('')}${'<span></span>'.repeat(kosong)}${D.hari.map((h) => kotak(K, D, h)).join('')}</div>
      <p class="kal-ket">${[['hadir', 'Hadir'], ['telat', 'Telat'], ['izin', 'Izin, sakit, cuti'], ['alpa', 'Tidak hadir']].map(([k, l]) => `<span><i class="kal-t ${k}" aria-hidden="true">${STATUS[k][0]}</i> ${l}</span>`).join('')}${D.orang.length > 1 && !K.orang ? `<span class="muted">Urutan tanda: ${D.orang.map((o) => esc(o.nama)).join(', ')}</span>` : ''}</p></section>
    ${rincian(K, D)}`;
};

AFTER.kalender = function () { const { K, data } = dataKalender(); if (!data && !K.galat) muat(K.bulan); };

export function aksiKalender(act, el) {
  const K = keadaan();
  if (act === 'kal-bulan') {
    K.bulan = geser(K.bulan, +el.dataset.v);
    K.hari = K.bulan === today().slice(0, 7) ? today() : K.bulan + '-01';
    K.galat = null; render();
  } else if (act === 'kal-hari') {
    K.hari = el.dataset.v; render();
    const r = $('#kal-rinci'); if (r) r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else if (act === 'kal-orang') { K.orang = el.dataset.v; render(); } else if (act === 'kal-muat') { K.galat = null; muat(K.bulan); render(); } else if (act === 'kal-jejak') {
    navigate('/jejak'); bukaRiwayat(el.dataset.nama, el.dataset.v);
  } else if (act === 'csv-kalender') exportKalender();
}
