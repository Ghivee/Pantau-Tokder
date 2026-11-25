import { analyticsChannels, api, editorById, load, normalize, optional, refresh } from './core/data.js';
import { exportCsv, exportGaji, exportPresensi } from './core/export.js';
import { navigate } from './core/router.js';
import { gantiSandi, keluarSemua, masukDenganMaster, ssoInfo } from './core/sso.js';
import { S, saveSession } from './core/state.js';
import { $, esc } from './lib/dom.js';
import { angkaUang, bacaCsv } from './lib/csv.js';
import { addDays, idr, today } from './lib/format.js';
import { aturGajiDialog, cetakSlip, loadGaji, slipDialog } from './pages/gaji.js';
import { ajukanDialog, putuskanDialog } from './pages/pengajuan.js';
import { absen, ambilLokasi } from './pages/presensi.js';
import { muatSaran, pilihChannel, salin } from './pages/saran.js';
import { statusSinkron } from './pages/akses.js';
import { kirimDraf, pilihMetrik } from './pages/rekap.js';
import { buatTautan, hapusTautan, imporAfiliasi, muatAfiliasi, salinTautan, salinTeks, tautanDialog } from './pages/tautan.js';
import { bulanLabel, daftarSW, diIOS, muatUlang, pushDidukung, swReg, terpasang } from './pages/shared.js';
import { pantauPosting, setPosting, showPostList, susunDeskripsi } from './pages/sosmed.js';
import { toast } from './ui/bits.js';
import { closeOverlay, confirmDialog, openDialog } from './ui/dialog.js';
import { catatDialog, editorDialog, goalDialog, loginDialog, moreSheet, videoDrawer } from './ui/dialogs.js';
import { icon } from './ui/icons.js';
import { render } from './ui/layout.js';
import { hapusDenganBatal } from './ui/undo.js';

const b64 = (s) => { const r = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

const perangkatLabel = () => { const u = navigator.userAgent; return (/Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iPhone' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'Perangkat') + ' · ' + (/Edg\//.test(u) ? 'Edge' : /Chrome\//.test(u) ? 'Chrome' : /Firefox\//.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'browser'); };

async function aktifkanNotif() {
  if (!pushDidukung()) {
    toast(diIOS && !terpasang() ? 'Di iPhone: ketuk Bagikan → Tambah ke Layar Utama, buka Tokder dari ikon itu, lalu aktifkan notifikasi.' : 'Browser ini tidak mendukung notifikasi. Pakai Chrome, Edge, Firefox atau Safari terbaru.', true);
    return;
  }
  const btn = $('[data-act="notif-aktif"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Mengaktifkan…'; }
  // Some browsers never answer when their push service is unreachable: give up with a clear message.
  const batas = (pr, pesan) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(pesan)), 20000))]);
  try {
    const izin = await Notification.requestPermission();
    if (izin !== 'granted') { toast('Izin notifikasi ditolak. Izinkan notifikasi untuk situs ini di pengaturan browser, lalu coba lagi.', true); return; }
    await daftarSW();
    const reg = await batas(navigator.serviceWorker.ready, 'browser tidak menyiapkan layanan notifikasi');
    const { publicKey } = await api('/api/push');
    const sub = (await reg.pushManager.getSubscription()) || (await batas(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }), 'layanan push browser tidak menjawab. Periksa koneksi lalu coba lagi.'));
    await api('/api/push/langganan', { method: 'POST', body: { subscription: sub.toJSON(), perangkat: perangkatLabel() } });
    await api('/api/push/coba', { method: 'POST' });
    S.notif = { didukung: true, aktif: true, izin: 'granted' };
    toast('Notifikasi aktif. Pesan percobaan dikirim ke perangkat ini.');
    render();
  } catch (e) { toast('Notifikasi belum bisa diaktifkan: ' + e.message, true); render(); }
}

async function matikanNotif(diam = false) {
  try {
    const reg = swReg || (await navigator.serviceWorker.getRegistration());
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) { await api('/api/push/langganan', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) { /* nothing subscribed */ }
  S.notif = { ...(S.notif || {}), aktif: false };
  if (!diam) { toast('Notifikasi dimatikan di perangkat ini'); render(); }
}

// "2026-10-21 13:00", "21/10/2026", "21-10-2026 08:00" → "2026-10" (day first, as in Indonesian reports)
function bulanTgl(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.]\d{1,2}/);
  let out = m ? m[1] + '-' + m[2].padStart(2, '0') : null;
  if (!out) { m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); out = m ? m[3] + '-' + m[2].padStart(2, '0') : null; }
  return out && /^\d{4}-(0[1-9]|1[0-2])$/.test(out) ? out : null;
}

function imporDialog() {
  openDialog(`<h2>Impor laporan afiliasi</h2>
      <p>Unduh laporan komisi dari dashboard afiliasi (misalnya Shopee Affiliate atau TikTok Shop) dalam format CSV, lalu pilih filenya. Omzet tercapai tiap bulan di file akan diganti dengan jumlah dari laporan.</p>
      <label class="field"><span>File CSV</span><input class="input" type="file" id="im-file" accept=".csv,text/csv"></label>
      <div id="im-isi"></div>
      <div class="err" id="im-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="im-simpan" disabled>Simpan</button></div>`, (d) => {
    d.classList.add('wide');
    let rows = null, nama = '', hasil = null;
    const isi = $('#im-isi', d), err = $('#im-err', d), simpan = $('#im-simpan', d);
    const hitung = () => {
      const [head, ...data] = rows;
      const ci = +$('#im-tgl', d).value, ca = +$('#im-jml', d).value, cf = $('#im-fkol', d).value, fv = $('#im-fval', d).value.trim().toLowerCase();
      const per = {}; let pakai = 0, lewat = 0, saring = 0;
      data.forEach((r) => {
        if (cf !== '' && fv && !String(r[+cf] || '').toLowerCase().includes(fv)) { saring++; return; }
        const b = bulanTgl(r[ci]), n = angkaUang(r[ca]);
        if (!b || n == null) { lewat++; return; }
        per[b] = (per[b] || 0) + n; pakai++;
      });
      hasil = { per, pakai };
      const bl = Object.keys(per).sort();
      $('#im-hasil', d).innerHTML = bl.length
        ? `<table class="t"><thead><tr><th>Bulan</th><th class="num">Omzet tercapai</th></tr></thead><tbody>${bl.map((b) => `<tr><td>${bulanLabel(b)}</td><td class="num"><b>${idr(per[b])}</b></td></tr>`).join('')}</tbody></table><p class="muted" style="font-size:12.5px;margin:6px 0 0">${pakai} baris dipakai${saring ? `, ${saring} tidak cocok saringan` : ''}${lewat ? `, ${lewat} dilewati karena tanggal atau angkanya tidak terbaca` : ''}. Kolom ${esc(head[ci])} dan ${esc(head[ca])}.</p>`
        : '<div class="empty"><b>Tidak ada baris yang terbaca</b>Periksa pilihan kolom tanggal dan jumlah.</div>';
      simpan.disabled = !bl.length || bl.length > 36;
    };
    $('#im-file', d).addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      err.textContent = ''; simpan.disabled = true; isi.innerHTML = '';
      if (!f) return;
      if (f.size > 5e6) { err.textContent = 'File terlalu besar (maksimal 5 MB).'; return; }
      rows = bacaCsv(await f.text()); nama = f.name;
      if (rows.length < 2) { err.textContent = 'File kosong atau bukan CSV.'; return; }
      const head = rows[0];
      const tebak = (re) => Math.max(0, head.findIndex((h) => re.test(h)));
      const opt = (sel) => head.map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Kolom ' + (i + 1))}</option>`).join('');
      isi.innerHTML = `<div class="stack">
          <div class="row"><label class="field"><span>Sumber</span><input class="input" id="im-sumber" maxlength="60" value="${/tiktok/i.test(nama) ? 'TikTok Shop' : /shopee/i.test(nama) ? 'Shopee Affiliate' : 'Afiliasi'}"></label>
            <label class="field"><span>Kolom tanggal</span><select class="input" id="im-tgl">${opt(tebak(/tanggal|waktu|date|time/i))}</select></label>
            <label class="field"><span>Kolom jumlah komisi</span><select class="input" id="im-jml">${opt(tebak(/komisi|commission|penghasilan|pendapatan|earning|amount/i))}</select></label></div>
          <div class="row"><label class="field"><span>Saring kolom (opsional)</span><select class="input" id="im-fkol"><option value="">Tanpa saringan</option>${head.map((h, i) => `<option value="${i}">${esc(h || 'Kolom ' + (i + 1))}</option>`).join('')}</select></label>
            <label class="field"><span>Hanya baris yang berisi</span><input class="input" id="im-fval" placeholder="Misal: Selesai"><small>Untuk memakai pesanan yang selesai saja</small></label></div>
          <div id="im-hasil"></div></div>`;
      ['#im-tgl', '#im-jml', '#im-fkol'].forEach((s) => $(s, d).addEventListener('change', hitung));
      $('#im-fval', d).addEventListener('input', hitung);
      hitung();
    });
    simpan.addEventListener('click', async () => {
      simpan.disabled = true;
      try {
        const per = Object.fromEntries(Object.entries(hasil.per).map(([k, v]) => [k, Math.round(v)]));
        const g = await api('/api/goals/impor', { method: 'PUT', body: { bulan: per, sumber: $('#im-sumber', d).value, file: nama, baris: hasil.pakai } });
        S.goal = g;
        closeOverlay(); toast(`Omzet ${Object.keys(per).length} bulan diperbarui dari ${nama}`); render();
      } catch (e) { err.textContent = e.message; simpan.disabled = false; }
    });
  });
}

async function aksiBaru(act, el, ev) {
  switch (act) {
    case 'notif-aktif': await aktifkanNotif(); break;
    case 'notif-mati': await matikanNotif(); break;
    case 'notif-coba': try { const r = await api('/api/push/coba', { method: 'POST' }); toast(r.terkirim ? 'Pesan percobaan dikirim' : 'Tidak ada perangkat yang menerima. Aktifkan ulang notifikasi.', !r.terkirim); } catch (e) { toast(e.message, true); } break;
    case 'impor-afiliasi': imporDialog(); break;
    case 'panduan-untuk': S.panduanUntuk = el.dataset.v; render(); break;
    case 'pf-periode': S.perfPeriode = +el.dataset.v; render(); break;
    case 'konten-orang': ev.preventDefault(); Object.assign(S.konten, { editor: el.dataset.id, periode: String(S.perfPeriode), page: 1 }); navigate('/konten'); break;
    case 'ajukan': ajukanDialog(el.dataset.v); break;
    case 'putuskan': putuskanDialog(el.dataset.id, el.dataset.v); break;
    case 'batal-pengajuan': {
      const row = S.pengajuan && S.pengajuan.list.find((p) => p.id === +el.dataset.id);
      if (!row) break;
      hapusDenganBatal('Pengajuan dibatalkan', '/api/pengajuan/' + row.id, {
        sembunyikan: () => { S.pengajuan.list = S.pengajuan.list.filter((p) => p !== row); render(); },
        kembalikan: () => { if (!S.pengajuan.list.includes(row)) S.pengajuan.list.push(row); render(); },
        sesudah: muatUlang,
      });
      break;
    }
    case 'ip-baru':
    case 'ip-abaikan': {
      el.disabled = true;
      try {
        if (act === 'ip-baru') {
          S.presensi.config = await api('/api/presensi/ip-kandidat', { method: 'PUT', body: { ip: el.dataset.ip, ganti: el.dataset.ganti === '1' } });
          toast('IP kantor diperbarui. Karyawan yang ditolak diberi kabar untuk absen lagi.');
        } else {
          await api('/api/presensi/ip-kandidat', { method: 'DELETE', body: { ip: el.dataset.ip } });
          S.presensi.config.ip_kandidat = null;
          toast('Usulan diabaikan');
        }
        render();
      } catch (e) { el.disabled = false; toast(e.message, true); }
      break;
    }
    case 'csv-gaji': exportGaji(); break;
    case 'csv-presensi': exportPresensi(); break;
    case 'atur-gaji': aturGajiDialog(el.dataset.id || 'umum'); break;
    case 'gaji-muat': delete S.gajiCache[S.gajiBulan]; render(); break;
    case 'gaji-ke': ev.preventDefault(); S.gajiBulan = el.dataset.v; render(); window.scrollTo({ top: 0 }); break;
    case 'slip': slipDialog(el.dataset.id); break;
    case 'cetak-slip': cetakSlip(el.dataset.id); break;
    case 'finalkan': {
      const b = S.gajiBulan;
      const G = S.gajiCache[b];
      const ids = el.dataset.v === 'semua' ? null : [+el.dataset.v];
      const names = G.list.filter((r) => r.status !== 'final' && (!ids || ids.includes(r.editor_id))).map((r) => r.nama);
      const jalan = b === today().slice(0, 7);
      confirmDialog(`Finalkan gaji ${bulanLabel(b)}?`, `${names.join(', ')}. Angka dikunci menjadi slip resmi dan tidak ikut berubah bila presensi, izin atau aturan berubah.${jalan ? ' Bulan ini belum selesai: hari-hari yang tersisa tidak akan terhitung.' : ''}`, 'Finalkan', async () => {
        try { await api('/api/gaji/final', { method: 'POST', body: { bulan: b, editor_ids: ids || undefined } }); toast('Gaji difinalkan'); await loadGaji(b); render(); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'buka-gaji':
      confirmDialog('Buka lagi gaji ini?', 'Slip final dihapus dan angka kembali menjadi perkiraan yang dihitung ulang dari data terbaru.', 'Buka lagi', async () => {
        try { await api(`/api/gaji/final?bulan=${S.gajiBulan}&editor_id=${el.dataset.id}`, { method: 'DELETE' }); toast('Gaji dibuka lagi'); await loadGaji(S.gajiBulan); render(); } catch (e) { toast(e.message, true); }
      });
      break;
    case 'dibayar':
      try { await api('/api/gaji/dibayar', { method: 'PUT', body: { bulan: S.gajiBulan, editor_id: +el.dataset.id, dibayar: el.dataset.v === '1' } }); toast(el.dataset.v === '1' ? 'Ditandai sudah dibayar' : 'Tanda dibayar dibatalkan'); await loadGaji(S.gajiBulan); render(); } catch (e) { toast(e.message, true); }
      break;
    case 'hapus-penyesuaian': {
      const id = el.closest('.dialog') && S.gajiCache[S.gajiBulan].list.find((r) => (r.penyesuaian || []).some((p) => p.id === +el.dataset.id));
      try { await api('/api/gaji/penyesuaian/' + el.dataset.id, { method: 'DELETE' }); await loadGaji(S.gajiBulan); if (id) slipDialog(id.editor_id); toast('Penyesuaian dihapus'); } catch (e) { toast(e.message, true); }
      break;
    }
    default: break;
  }
}

export async function assign(ids, editorId) {
  try {
    for (const id of ids) await api(`/api/content/${id}/assign`, { method: 'POST', body: { editor_id: editorId } });
    ids.forEach((id) => { const c = S.content.find((x) => x.id === id); if (c) { c.editor_id = editorId; c.status_identifikasi = 'matched'; } });
    S.sel.clear();
    normalize();
    toast(ids.length + ' video ditetapkan ke ' + editorById(editorId).nama);
    render();
  } catch (e) { toast(e.message, true); }
}

export async function refreshAktivitas() {
  const rows = await optional(api('/api/aktivitas?dari=' + addDays(today(), -60) + '&sampai=' + today()), 'Aktivitas');
  if (rows) { S.aktivitas = rows; normalize(); }
}

document.addEventListener('click', async (ev) => {
  if (ev.target.closest('.skip-link')) { ev.preventDefault(); $('#page').focus(); return; }
  const a = ev.target.closest('a[href^="/"]');
  if (a && !a.dataset.act && !a.target && !a.hasAttribute('download') && ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && !ev.altKey && !a.getAttribute('href').startsWith('/api/')) {
    ev.preventDefault();
    navigate(a.getAttribute('href'));
    return;
  }
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (act === 'close-overlay') { if (ev.target === el || el.tagName === 'BUTTON' || el.tagName === 'A') closeOverlay(); return; }
  switch (act) {
    case 'login': closeOverlay(); loginDialog(); break;
    case 'lainnya': moreSheet(); break;
    case 'logout':
      closeOverlay();
      await matikanNotif(true);
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) { /* the cookie is cleared or already invalid */ }
      saveSession(null);
      { const info = await ssoInfo(); if (info.aktif && keluarSemua(info.masterUrl)) break; }
      toast('Anda sudah keluar'); navigate('/'); break;
    case 'retry': S.error = null; $('#page').innerHTML = '<div class="skeleton" style="height:320px"></div>'; await load(); break;
    case 'theme': {
      closeOverlay();
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('pt_theme', next); } catch (e) { /* storage off */ }
      render();
      break;
    }
    case 'periode': S.periode = +el.dataset.v; render(); break;
    case 'hari': { const d = addDays(S.day, +el.dataset.v); if (d <= today()) { S.day = d; render(); } break; }
    case 'hari-ini': S.day = today(); render(); break;
    case 'ke-hari': S.day = el.dataset.v; render(); break;
    case 'lihat-orang': ev.preventDefault(); navigate('/harian/' + el.dataset.id); break;
    case 'catat': catatDialog(+el.dataset.id || null); break;
    case 'hapus-aktivitas': {
      const id = +el.dataset.id;
      const row = S.aktivitas.find((a) => a.id === id);
      if (!row) break;
      const ulang = () => { normalize(); render(); };
      hapusDenganBatal('Aktivitas dihapus', '/api/aktivitas/' + id, {
        sembunyikan: () => { S.aktivitas = S.aktivitas.filter((a) => a !== row); ulang(); },
        kembalikan: () => { if (!S.aktivitas.includes(row)) S.aktivitas.push(row); ulang(); },
        sesudah: async () => { await refreshAktivitas(); if (!$('#overlay').innerHTML) render(); },
      });
      break;
    }
    case 'video': ev.preventDefault(); videoDrawer(el.dataset.id); break;
    case 'sort': { const k = S.konten; if (k.sort === el.dataset.k) k.dir = k.dir === 'asc' ? 'desc' : 'asc'; else { k.sort = el.dataset.k; k.dir = el.dataset.k === 'judul' || el.dataset.k === 'editor' ? 'asc' : 'desc'; } render(); break; }
    case 'page': S.konten.page += +el.dataset.v; render(); window.scrollTo({ top: 0 }); break;
    case 'csv': exportCsv(); break;
    case 'bulk-assign': { const v = +$('#bulk-editor').value; if (!v) return toast('Pilih karyawan dulu', true); if (!S.sel.size) return toast('Centang video dulu', true); assign([...S.sel], v); break; }
    case 'editor-form': editorDialog(+el.dataset.id || null); break;
    case 'editor-hapus': {
      const e = editorById(el.dataset.id);
      confirmDialog('Hapus ' + e.nama + '?', 'Video buatannya akan kembali ke daftar "Belum dikenali". Untuk sekadar menonaktifkan, ubah statusnya menjadi Nonaktif.', 'Hapus', async () => {
        try { await api('/api/editors/' + e.id, { method: 'DELETE' }); S.editors = S.editors.filter((x) => x.id !== e.id); S.content.forEach((c) => { if (c.editor_id === e.id) c.editor_id = null; }); normalize(); toast(e.nama + ' dihapus'); render(); } catch (err) { toast(err.message, true); }
      });
      break;
    }
    case 'goal': goalDialog(); break;
    case 'absen': await absen(el); break;
    case 'presensi-muat': S.presensi = null; render(); break;
    case 'presensi-lokasi': {
      const info = $('#lokasi-info');
      try {
        info.textContent = 'Membaca lokasi…';
        const pos = await ambilLokasi(15, (acc) => { info.textContent = `Membaca lokasi… ± ${Math.round(acc)} m`; });
        const f = $('#presensi-form');
        f.lat.value = pos.coords.latitude.toFixed(6);
        f.lng.value = pos.coords.longitude.toFixed(6);
        info.textContent = `Terisi (akurasi ± ${Math.round(pos.coords.accuracy)} m). Klik Simpan aturan.`;
      } catch (e) { info.textContent = e.message; }
      break;
    }
    case 'presensi-ip': {
      const f = $('#presensi-form');
      const list = f.ips.value.split(/\s+/).filter(Boolean);
      if (!list.includes(el.dataset.ip)) list.push(el.dataset.ip);
      f.ips.value = list.join('\n');
      break;
    }
    case 'tautan-baru': tautanDialog(el.dataset.v || ''); break;
    case 'tautan-teks': salinTeks(el.dataset.kode); break;
    case 'susun-deskripsi': susunDeskripsi(); break;
    case 'saran-tautan': tautanDialog(el.dataset.v); break;
    case 'saran-judul': salin(el.dataset.v); break;
    case 'saran-ch': pilihChannel(el.dataset.v); break;
    case 'af-hari': muatAfiliasi(+el.dataset.v); break;
    case 'af-impor': imporAfiliasi(); break;
    case 'saran-muat': muatSaran(); break;
    case 'tautan-buat': buatTautan(); break;
    case 'tautan-salin': salinTautan(el.dataset.kode); break;
    case 'tautan-hapus': hapusTautan(el.dataset.kode); break;
    case 'rekap-metrik': pilihMetrik(el.dataset.v); break;
    case 'draf-kirim': await kirimDraf(); break;
    case 'sso-master': masukDenganMaster(el.dataset.url); break;
    case 'ganti-sandi': gantiSandi((await ssoInfo()).masterUrl); break;
    case 'akses-izin': {
      const id = +el.dataset.id, nilai = el.checked;
      try {
        const r = await api('/api/akses/' + id, { method: 'PUT', body: { kunci: el.dataset.k, nilai }, timeout: 30000 });
        const orang = S.akses && S.akses.karyawan.find((x) => x.id === id);
        if (orang) { orang.izin = r.izin; orang.tersimpan = true; }
        if (S.akses) S.akses.sinkron = { ...(S.akses.sinkron || {}), [id]: r.sinkron };
        const e = S.editors.find((x) => x.id === id); if (e) { e.izin = r.izin; e.izin_tersimpan = true; }
        S.aplikasi = null;
        const st = $('#ak-st-' + id); if (st) st.innerHTML = statusSinkron(r.sinkron);
        toast(r.sinkron.ok ? 'Akses diubah' : 'Tersimpan di Tokder, tapi belum sampai ke Master', !r.sinkron.ok);
      } catch (e) { el.checked = !nilai; toast(e.message, true); }
      break;
    }
    case 'akses-sinkron': {
      try {
        const r = await api('/api/akses/sinkron', { method: 'POST', timeout: 30000 });
        const gagal = r.hasil.filter((h) => !h.ok);
        toast(gagal.length ? 'Masih gagal untuk ' + gagal.map((h) => h.nama).join(', ') : 'Semua izin Master tersinkron', gagal.length > 0);
        S.akses = undefined; render();
      } catch (e) { toast(e.message, true); }
      break;
    }
    case 'an-periode': S.anPeriode = +el.dataset.v; render(); break;
    default: await aksiBaru(act, el, ev); break;
    case 'putus-analytics': {
      const c = analyticsChannels(true).find((x) => x.id === el.dataset.id);
      confirmDialog('Putuskan ' + c.nama + '?', 'Angka YouTube Analytics yang sudah tersimpan tetap ada, tapi tidak diperbarui lagi sampai dihubungkan ulang.', 'Putuskan', async () => {
        try { await api('/api/auth/google/' + encodeURIComponent(c.id), { method: 'DELETE' }); S.oauth = await optional(api('/api/auth/status'), 'Status YouTube Analytics'); normalize(); toast(c.nama + ' diputuskan'); render(); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'putus-sosmed': {
      const k = ((S.sosmed && S.sosmed.platforms) || []).flatMap((p) => p.koneksi).find((x) => String(x.id) === el.dataset.id);
      if (!k) break;
      confirmDialog('Putuskan ' + (k.nama || 'akun') + '?', 'Token dihapus dan semua posting akun ini yang tersimpan di Tokder ikut dihapus. Akun aslinya tidak berubah.', 'Putuskan', async () => {
        try { await api('/api/social/koneksi/' + encodeURIComponent(k.id), { method: 'DELETE' }); await refresh(); toast((k.nama || 'Akun') + ' diputuskan'); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'post-cek': case 'post-tayang': {
      const id = el.dataset.id;
      el.disabled = true;
      try {
        const p = await api(`/api/posting/${id}/${act === 'post-cek' ? 'segarkan' : 'tayang'}`, { method: 'POST', timeout: 60000 });
        setPosting(p);
        toast(act === 'post-cek' ? 'Status diperbarui' : 'Diproses. Cek hasilnya per platform.');
        if (act === 'post-tayang') pantauPosting();
      } catch (e) { toast(e.message, true); el.disabled = false; }
      break;
    }
    case 'post-hapus': {
      confirmDialog('Hapus posting ini?', 'Catatan dan berkas videonya di Tokder dihapus. Video yang sudah tayang di platform tidak ikut terhapus.', 'Hapus', async () => {
        try { await api('/api/posting/' + el.dataset.id, { method: 'DELETE' }); S.sosmed.posting = S.sosmed.posting.filter((x) => String(x.id) !== el.dataset.id); showPostList(); toast('Posting dihapus'); } catch (e) { toast(e.message, true); }
      });
      break;
    }
    case 'sync-sosmed': {
      el.disabled = true; el.innerHTML = icon('sync') + 'Menarik…';
      try { const r = await api('/api/social/sync', { method: 'POST', timeout: 60000 }); toast(r.akun ? `${r.akun} akun, ${r.posts} posting` + (r.galat.length ? ' · ' + r.galat[0] : '') : 'Belum ada akun tersambung'); await refresh(); } catch (e) { toast(e.message, true); render(); }
      break;
    }
    case 'sync': {
      el.disabled = true; el.innerHTML = icon('sync') + 'Menyinkronkan…';
      try { const r = await api('/api/scan', { method: 'POST' }); toast(`Selesai: ${r.newPosts || 0} video baru, ${r.updatedPosts || 0} diperbarui` + (r.analyticsChannels != null ? `, analytics ${r.analyticsChannels} channel` : '') + (r.errors ? ` · ${r.errors.length} catatan, lihat log` : '') + (r.skipped ? ' (' + r.reason + ')' : '')); await refresh(); } catch (e) { toast(e.message, true); render(); }
      break;
    }
    case 'ganti-pw': {
      const v = $('#pw-baru').value;
      try { await api('/api/auth/password', { method: 'POST', body: { baru: v } }); toast('Password tersimpan. Perangkat lain yang masuk sebagai pemilik sudah dikeluarkan.'); $('#pw-baru').value = ''; } catch (e) { toast(e.message, true); }
      break;
    }
  }
});
