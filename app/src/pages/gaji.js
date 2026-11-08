import { kalender } from '../core/calendar.js';
import { api, editorById } from '../core/data.js';
import { AFTER, PAGES } from '../core/registry.js';
import { route } from '../core/router.js';
import { S, isAdmin } from '../core/state.js';
import { $, esc } from '../lib/dom.js';
import { fmt, idr, sum, tglPanjang, tglPendek, today } from '../lib/format.js';
import { ringkasJadwal } from './presensi.js';
import { bantuan, bulanLabel, muatUlang } from './shared.js';
import { avatar, toast } from '../ui/bits.js';
import { openDialog } from '../ui/dialog.js';
import { icon } from '../ui/icons.js';
import { render } from '../ui/layout.js';

const ATURAN = [
  ['gaji_pokok', 'Gaji pokok per bulan'], ['tunjangan', 'Tunjangan tetap per bulan'], ['potongan_tetap', 'Potongan tetap per bulan', 'BPJS, cicilan kasbon, dll.'],
  ['potong_alpa', 'Potongan per hari tidak hadir', 'Hari kerja tanpa absen dan tanpa izin/sakit/cuti yang disetujui'], ['potong_izin', 'Potongan per hari izin', 'Isi 0 bila izin tidak dipotong. Sakit dan cuti tidak pernah dipotong.'],
  ['potong_telat', 'Potongan per kali telat', 'Telat = absen masuk lewat jam masuk + toleransi'], ['tarif_lembur', 'Upah lembur per jam', 'Dihitung dari absen pulang ≥ 30 menit setelah jam pulang'],
  ['bonus_video', 'Bonus per video di atas target'], ['bonus_1000_views', 'Bonus per 1.000 views', 'Views video yang tayang di bulan itu'],
];

const HARI_PDK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export async function loadGaji(bulan) { const r = await api('/api/gaji?bulan=' + bulan); S.gajiCache[bulan] = r; return r; }

const gajiStatus = (r) => (r.dibayar_at ? '<span class="pill leaf">Dibayar</span>' : r.status === 'final' ? '<span class="pill ok">Final</span>' : '<span class="pill warn">Perkiraan</span>');

function slipHtml(r, { aksi = false } = {}) {
  const h = r.hari;
  const owner = isAdmin();
  const draf = r.status !== 'final';
  return `<div class="slip">
      <div class="slip-h"><div><b>Slip gaji ${esc(r.nama)}</b><div class="muted">${bulanLabel(r.bulan)} · dihitung ${tglPendek(r.periode.dari)} – ${tglPendek(r.periode.sampai)}${r.periode.selesai ? '' : ' (bulan masih berjalan)'}</div></div>${gajiStatus(r)}</div>
      ${!r.presensi_dipakai ? '<p class="muted fs-125 m-0">Presensi belum dipakai di periode ini, jadi ketidakhadiran tidak dihitung.</p>' : ''}
      <dl class="kv">
        <dt>Hari kerja</dt><dd>${h.kerja} hari: hadir ${h.hadir}${h.izin ? ', izin ' + h.izin : ''}${h.sakit ? ', sakit ' + h.sakit : ''}${h.cuti ? ', cuti ' + h.cuti : ''}${h.alpa ? `, <b class="bad">tidak hadir ${h.alpa}</b>` : ''}</dd>
        ${h.alpa ? `<dt>Tidak hadir</dt><dd>${h.alpa_tanggal.map(tglPendek).join(', ')}</dd>` : ''}
        <dt>Telat</dt><dd>${h.telat} kali${h.telat ? ', total ' + h.telat_menit + ' menit' : ''}</dd>
        <dt>Lembur</dt><dd>${Math.floor(h.lembur_menit / 60)} jam ${h.lembur_menit % 60} menit</dd>
        <dt>Video</dt><dd>${r.video.jumlah} dari target ${r.video.target} · ${fmt(r.video.views)} views</dd>
      </dl>
      <div class="table-wrap"><table class="t slip-t"><tbody>
        ${r.baris.map((b) => `<tr><td><b>${esc(b.label)}</b>${b.ket ? `<div class="muted fs-12">${esc(b.ket)}</div>` : ''}</td><td class="num ${b.jumlah < 0 ? 'bad' : ''}">${idr(b.jumlah)}</td></tr>`).join('')}
        <tr class="tot"><td><b>Total diterima</b>${r.minus ? '<div class="muted fs-12">Potongan melebihi pendapatan; total dibulatkan ke Rp0.</div>' : ''}</td><td class="num"><b>${idr(r.total)}</b></td></tr>
      </tbody></table></div>
      ${!r.aturan_diisi ? `<p class="muted fs-125 m-0">Aturan gaji ${esc(r.nama)} belum diisi${owner ? ': klik Atur gaji.' : '. Pemilik belum mengaturnya.'}</p>` : ''}
      ${r.status === 'final' ? `<p class="muted fs-125 m-0">Final ${new Date(r.final_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}${r.dibayar_at ? ' · dibayar ' + new Date(r.dibayar_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : ''}. Angka tidak berubah lagi.</p>` : '<p class="muted fs-125 m-0">Perkiraan: angka masih bisa berubah sampai pemilik memfinalkan bulan ini.</p>'}
      ${aksi && owner && draf ? `<div class="slip-adj"><b>Penyesuaian</b>${(r.penyesuaian || []).map((p) => `<div class="adj"><span>${esc(p.keterangan)}</span><span class="num ${p.jumlah < 0 ? 'bad' : ''}">${idr(p.jumlah)}</span><button class="btn sm ghost" data-act="hapus-penyesuaian" data-id="${p.id}" aria-label="Hapus penyesuaian">${icon('x')}</button></div>`).join('') || '<div class="muted fs-13">Belum ada.</div>'}
        <form id="adj-form" class="row" style="align-items:end"><label class="field"><span>Jumlah (Rp, minus untuk potongan)</span><input class="input" type="number" name="jumlah" step="1000" required placeholder="200000 atau -50000"></label><label class="field"><span>Keterangan</span><input class="input" name="keterangan" maxlength="200" required placeholder="Bonus video viral"></label><button class="btn">Tambah</button></form>
        <div class="err" id="adj-err" role="alert"></div></div>` : ''}
    </div>`;
}

export function slipDialog(editorId) {
  const G = S.gajiCache[S.gajiBulan];
  const r = G && G.list.find((x) => x.editor_id === +editorId);
  if (!r) return;
  openDialog(`${slipHtml(r, { aksi: true })}<div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Tutup</button><button class="btn" data-act="cetak-slip" data-id="${r.editor_id}">${icon('download')}Cetak / PDF</button></div>`, (d) => {
    d.classList.add('wide');
    const f = $('#adj-form', d);
    if (f) f.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await api('/api/gaji/penyesuaian', { method: 'POST', body: { editor_id: r.editor_id, bulan: r.bulan, jumlah: +f.jumlah.value, keterangan: f.keterangan.value } });
        await loadGaji(r.bulan); slipDialog(r.editor_id); toast('Penyesuaian ditambahkan');
      } catch (e) { $('#adj-err', d).textContent = e.message; }
    });
  });
}

export function cetakSlip(editorId) {
  const G = S.gajiCache[S.gajiBulan];
  const r = G && G.list.find((x) => x.editor_id === +editorId);
  if (!r) return;
  let box = $('#print');
  if (!box) { box = document.createElement('div'); box.id = 'print'; document.body.append(box); }
  box.innerHTML = `<div class="print-brand"><img src="/logo.svg" alt=""><b>Pantau Tokder</b></div>${slipHtml(r)}`;
  window.print();
}

export async function aturGajiDialog(pilih = 'umum') {
  let A;
  try { A = await api('/api/gaji/aturan'); } catch (e) { toast(e.message, true); return; }
  const eds = S.editors.filter((e) => e.status !== 'nonaktif');
  const form = () => {
    if (pilih === 'umum') {
      const c = A.config;
      return `<form id="ag-form" class="stack">
          <div class="field"><span>Hari kerja dan libur</span><div>${esc(ringkasJadwal(kalender().jadwal))}. Tanggal merah libur.</div><small>Diubah di <a href="/presensi">Presensi → Aturan presensi</a>; dipakai juga untuk gaji, cuti dan target video.</small></div>
          <label class="field"><span>Jatah cuti per tahun (hari kerja)</span><input class="input" type="number" name="jatah_cuti" min="0" max="60" value="${c.jatah_cuti}" required></label>
          <div class="err" id="ag-err" role="alert"></div>
          <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Tutup</button><button class="btn primary">Simpan</button></div></form>`;
    }
    const a = A.aturan.find((x) => x.editor_id === +pilih) || {};
    return `<form id="ag-form" class="stack">
        <div class="grid-form">${ATURAN.map(([k, l, s]) => `<label class="field"><span>${l}</span><input class="input" type="number" name="${k}" min="0" step="1000" value="${Math.round(+a[k] || 0)}">${s ? `<small>${s}</small>` : ''}</label>`).join('')}</div>
        <p class="muted" style="margin:0;font-size:12.5px">Semua dalam rupiah. Biarkan 0 untuk komponen yang tidak dipakai. Perubahan tidak mengubah bulan yang sudah final.</p>
        <div class="err" id="ag-err" role="alert"></div>
        <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Tutup</button><button class="btn primary">Simpan</button></div></form>`;
  };
  openDialog(`<h2>Atur gaji</h2>
      <label class="field"><span>Bagian</span><select class="input" id="ag-pilih"><option value="umum">Aturan umum (jatah cuti)</option>${eds.map((e) => `<option value="${e.id}" ${+pilih === e.id ? 'selected' : ''}>Gaji ${esc(e.nama)}</option>`).join('')}</select></label>
      ${form()}`, (d) => {
    d.classList.add('wide');
    $('#ag-pilih', d).addEventListener('change', (ev) => aturGajiDialog(ev.target.value));
    $('#ag-form', d).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      try {
        if (pilih === 'umum') await api('/api/gaji/config', { method: 'PUT', body: { jatah_cuti: +f.jatah_cuti.value } });
        else await api('/api/gaji/aturan/' + pilih, { method: 'PUT', body: Object.fromEntries(ATURAN.map(([k]) => [k, +f[k].value || 0])) });
        toast('Aturan gaji tersimpan');
        S.gajiCache = {};
        await muatUlang();
        aturGajiDialog(pilih);
      } catch (e) { $('#ag-err', d).textContent = e.message; }
    });
  });
}

PAGES.gaji = function () {
  const b = S.gajiBulan || today().slice(0, 7);
  const G = S.gajiCache[b];
  const owner = isAdmin();
  const tools = `<input class="input w-auto" type="month" id="gj-bulan" value="${b}" max="${today().slice(0, 7)}" aria-label="Bulan">
      ${owner ? `<button class="btn" data-act="atur-gaji">${icon('gear')}Atur gaji</button>` : ''}${bantuan('gaji')}`;
  const head = (p, extra = '') => `<header class="head"><div><h1>Gaji ${bulanLabel(b)}</h1><p>${p}</p></div><div class="tools">${tools}${extra}</div></header>`;
  if (!G) {
    loadGaji(b).then(() => { if (route() === 'gaji') render(); }).catch((e) => { S.gajiCache[b] = { error: e.message }; if (route() === 'gaji') render(); });
    return head('Menghitung…') + '<div class="skeleton" style="height:240px"></div>';
  }
  if (G.error) return head('Gaji belum bisa dihitung.') + `<section class="card empty" role="alert"><b>Gagal memuat</b>${esc(G.error)}<div class="mt-12"><button class="btn primary" data-act="gaji-muat">Coba lagi</button></div></section>`;
  if (!owner) {
    const r = G.list[0];
    if (!S.gajiRiwayat) api('/api/gaji/riwayat').then((x) => { S.gajiRiwayat = x; if (route() === 'gaji') render(); }).catch(() => { S.gajiRiwayat = []; });
    return head(r ? (r.status === 'final' ? 'Gaji bulan ini sudah final.' : 'Perkiraan berdasarkan presensi, izin dan video sampai hari ini.') : 'Tidak ada data gaji untuk bulan ini.') + `
        ${r ? `<section class="card">${slipHtml(r)}<div class="tools mt-12"><button class="btn" data-act="cetak-slip" data-id="${r.editor_id}">${icon('download')}Cetak / PDF</button></div></section>` : ''}
        <section class="card"><div class="card-h"><h2>Slip yang sudah final</h2></div>
          ${S.gajiRiwayat && S.gajiRiwayat.length ? `<div class="rank">${S.gajiRiwayat.map((x) => `<a class="rank-row no-underline" href="/gaji" data-act="gaji-ke" data-v="${x.bulan}"><span></span><div class="tx"><b>${bulanLabel(x.bulan)}</b><div>${x.dibayar_at ? 'Dibayar ' + new Date(x.dibayar_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : 'Final, belum ditandai dibayar'}</div></div><b>${idr(x.total)}</b></a>`).join('')}</div>` : '<div class="empty"><b>Belum ada slip final</b>Slip muncul di sini setelah pemilik memfinalkan gaji.</div>'}
        </section>`;
  }
  const list = G.list;
  const draf = list.filter((r) => r.status !== 'final');
  const belumAtur = list.filter((r) => !r.aturan_diisi);
  const lastDay = new Date(Date.UTC(+b.slice(0, 4), +b.slice(5, 7), 0)).toISOString().slice(0, 10);
  return head(`${list.length} karyawan, total <b>${idr(sum(list, (r) => r.total))}</b>. ${draf.length ? `${draf.length} masih perkiraan.` : 'Semua sudah final.'}`,
    `<button class="btn" data-act="csv-gaji">${icon('download')}Excel</button>` + (draf.length ? `<button class="btn primary" data-act="finalkan" data-v="semua">Finalkan ${draf.length > 1 ? 'semua' : ''}</button>` : '')) + `
      ${belumAtur.length ? `<div class="notice m-0 mw-none" role="status"><b>Aturan gaji belum diisi</b> untuk ${belumAtur.map((r) => esc(r.nama)).join(', ')}. <button class="btn sm" data-act="atur-gaji" data-id="${belumAtur[0].editor_id}">Atur sekarang</button></div>` : ''}
      ${b === today().slice(0, 7) && today() < lastDay ? `<p class="muted m-0 fs-13">Bulan masih berjalan sampai ${tglPanjang(lastDay)}. Ketidakhadiran dihitung sampai kemarin; hari ini baru dihitung bila sudah absen.</p>` : ''}
      <section class="kpis">
        <div class="kpi"><span class="l">Total gaji</span><span class="v">${idr(sum(list, (r) => r.total))}</span><span class="d">${list.length} karyawan</span></div>
        <div class="kpi"><span class="l">Tidak hadir</span><span class="v ${sum(list, (r) => r.hari.alpa) ? 'bad' : ''}">${sum(list, (r) => r.hari.alpa)} hari</span><span class="d">tanpa absen dan tanpa izin</span></div>
        <div class="kpi"><span class="l">Telat</span><span class="v">${sum(list, (r) => r.hari.telat)} kali</span><span class="d">${sum(list, (r) => r.hari.telat_menit)} menit</span></div>
        <div class="kpi"><span class="l">Sudah dibayar</span><span class="v">${list.filter((r) => r.dibayar_at).length} <small>/ ${list.length}</small></span><span class="d">${list.filter((r) => r.status === 'final').length} final</span></div>
      </section>
      <section class="card">
        <div class="table-wrap"><table class="t stack"><thead><tr><th>Karyawan</th><th class="num">Hadir</th><th class="num">Tidak hadir</th><th class="num">Izin/sakit/cuti</th><th class="num">Telat</th><th class="num">Video</th><th class="num">Total</th><th>Status</th><th></th></tr></thead><tbody>
          ${list.map((r) => { const e = editorById(r.editor_id); return `<tr>
            <td class="full"><span class="ed">${avatar(e, 'xs')}<b>${esc(r.nama)}</b></span></td>
            <td class="num" data-label="Hadir">${r.hari.hadir}</td>
            <td class="num" data-label="Tidak hadir">${r.hari.alpa ? `<span class="bad">${r.hari.alpa}</span>` : 0}</td>
            <td class="num" data-label="Izin/sakit/cuti">${r.hari.izin + r.hari.sakit + r.hari.cuti}</td>
            <td class="num" data-label="Telat">${r.hari.telat}×</td>
            <td class="num" data-label="Video">${r.video.jumlah}/${r.video.target}</td>
            <td class="num" data-label="Total"><b>${idr(r.total)}</b></td>
            <td data-label="Status">${gajiStatus(r)}</td>
            <td class="full"><div class="row-actions"><button class="btn sm" data-act="slip" data-id="${r.editor_id}">Rincian</button>
              ${r.status !== 'final' ? `<button class="btn sm" data-act="finalkan" data-v="${r.editor_id}">Finalkan</button>`
                : r.dibayar_at ? `<button class="btn sm ghost" data-act="dibayar" data-id="${r.editor_id}" data-v="0">Batal dibayar</button>`
                : `<button class="btn sm primary" data-act="dibayar" data-id="${r.editor_id}" data-v="1">Tandai dibayar</button><button class="btn sm ghost" data-act="buka-gaji" data-id="${r.editor_id}">Buka lagi</button>`}</div></td>
          </tr>`; }).join('') || '<tr><td colspan="9" class="muted">Belum ada karyawan aktif.</td></tr>'}
        </tbody></table></div>
      </section>
      <p class="muted" style="font-size:12.5px;margin:0;max-width:90ch">Finalkan = angka bulan ini dikunci jadi slip resmi; presensi, izin atau aturan yang berubah sesudahnya tidak mengubahnya. Buka lagi bila perlu dihitung ulang. Tandai dibayar setelah transfer.</p>`;
};

AFTER.gaji = () => {
  const inp = $('#gj-bulan');
  if (inp) inp.addEventListener('change', () => { if (/^\d{4}-\d{2}$/.test(inp.value) && inp.value <= today().slice(0, 7)) { S.gajiBulan = inp.value; render(); } });
};
