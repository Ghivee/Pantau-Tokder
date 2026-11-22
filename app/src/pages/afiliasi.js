import { api } from '../core/data.js';
import { $, esc } from '../lib/dom.js';
import { angkaUang, bacaCsv, sidik, tglIso } from '../lib/csv.js';
import { idr, nf, tglPendek } from '../lib/format.js';
import { toast } from '../ui/bits.js';
import { closeOverlay, openDialog } from '../ui/dialog.js';

// Impor laporan komisi afiliasi (CSV dari dashboard marketplace): satu baris per pesanan. Tiap baris diberi sidik jari dari
// isinya, jadi mengimpor ulang file yang sama atau file yang tumpang tindih tidak menggandakan komisi.

const KOLOM = {
  tanggal: /waktu pembelian|waktu pesanan|purchase|order time|tanggal pesanan|tanggal|waktu|date/i,
  produk: /nama produk|nama item|item name|product name|produk|product|item/i,
  komisi: /total komisi|komisi bersih|net commission|total commission|komisi|commission|penghasilan|earning/i,
  qty: /jumlah|kuantitas|quantity|qty/i,
  status: /status/i,
};

export function imporAfiliasiDialog(selesai) {
  openDialog(`<h2>Impor laporan komisi</h2>
      <p class="muted">Unduh laporan konversi dari dashboard afiliasi (CSV), lalu pilih filenya. Mengimpor file yang sama dua kali tidak menggandakan komisi.</p>
      <label class="field"><span>File CSV</span><input class="input" type="file" id="af-file" accept=".csv,text/csv"></label>
      <div id="af-isi"></div>
      <div class="err" id="af-err" role="alert"></div>
      <div class="actions"><button type="button" class="btn ghost" data-act="close-overlay">Batal</button><button class="btn primary" id="af-simpan" disabled>Simpan</button></div>`, (d) => {
    d.classList.add('wide');
    let rows = null, nama = '', hasil = null, ver = 0;
    const isi = $('#af-isi', d), err = $('#af-err', d), simpan = $('#af-simpan', d);
    const tebak = (re) => Math.max(0, rows[0].findIndex((h) => re.test(h)));
    const opsi = (sel, kosong) => (kosong ? `<option value="" ${sel < 0 ? 'selected' : ''}>(tidak ada)</option>` : '') + rows[0].map((h, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(h || 'Kolom ' + (i + 1))}</option>`).join('');

    const hitung = async () => {
      const v = ++ver;
      err.textContent = ''; simpan.disabled = true;
      const [, ...data] = rows;
      const ci = +$('#af-tgl', d).value, cp = +$('#af-prod', d).value, ck = +$('#af-kom', d).value;
      const cq = $('#af-qty', d).value, cs = $('#af-sts', d).value;
      const abaikan = $('#af-abaikan', d).value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
      const muncul = new Map(), baris = []; let lewat = 0, saring = 0;
      for (const r of data) {
        if (cs !== '' && abaikan.length && abaikan.some((w) => String(r[+cs] || '').toLowerCase().includes(w))) { saring++; continue; }
        const tanggal = tglIso(r[ci]), komisi = angkaUang(r[ck]), produk = String(r[cp] || '').replace(/\s+/g, ' ').trim();
        if (!tanggal || komisi == null || !produk) { lewat++; continue; }
        // Baris yang persis sama di dalam satu file dibedakan dengan nomor urut, sehingga keduanya tetap dihitung.
        const isiBaris = r.join('␟'), n = (muncul.get(isiBaris) || 0) + 1;
        muncul.set(isiBaris, n);
        const q = cq !== '' ? angkaUang(r[+cq]) : null;
        baris.push({ kunci: await sidik(isiBaris + '#' + n), tanggal, produk: produk.slice(0, 200), komisi, qty: q != null && Number.isInteger(q) && q >= 0 ? q : null });
      }
      if (v !== ver) return; // pilihan kolom berubah saat menghitung: hasil ini sudah usang
      hasil = baris;
      const el = $('#af-hasil', d);
      if (!baris.length) { el.innerHTML = '<div class="empty">Tidak ada baris yang terbaca. Periksa pilihan kolom.</div>'; return; }
      const tgl = baris.map((b) => b.tanggal).sort(), total = baris.reduce((s, b) => s + b.komisi, 0);
      const per = {}; baris.forEach((b) => { per[b.produk] = (per[b.produk] || 0) + b.komisi; });
      const top = Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 3);
      el.innerHTML = `<p><b>${nf.format(baris.length)}</b> baris · ${tglPendek(tgl[0])} – ${tglPendek(tgl[tgl.length - 1])} · komisi <b>${idr(total)}</b>${lewat ? ` · ${lewat} dilewati` : ''}${saring ? ` · ${saring} diabaikan` : ''}</p>
        <table class="t"><tbody>${top.map(([p, v]) => `<tr><td>${esc(p)}</td><td class="num"><b>${idr(v)}</b></td></tr>`).join('')}</tbody></table>`;
      simpan.disabled = false;
    };

    $('#af-file', d).addEventListener('change', async (ev) => {
      const f = ev.target.files[0];
      err.textContent = ''; simpan.disabled = true; isi.innerHTML = ''; rows = null;
      if (!f) return;
      if (f.size > 8e6) { err.textContent = 'File terlalu besar (maksimal 8 MB).'; return; }
      rows = bacaCsv(await f.text()); nama = f.name;
      if (rows.length < 2) { err.textContent = 'File kosong atau bukan CSV.'; rows = null; return; }
      const sts = rows[0].findIndex((h) => KOLOM.status.test(h));
      isi.innerHTML = `<div class="stack">
          <div class="row">
            <label class="field"><span>Kolom tanggal</span><select class="input" id="af-tgl">${opsi(tebak(KOLOM.tanggal))}</select></label>
            <label class="field"><span>Kolom nama produk</span><select class="input" id="af-prod">${opsi(tebak(KOLOM.produk))}</select></label>
            <label class="field"><span>Kolom komisi (Rp)</span><select class="input" id="af-kom">${opsi(tebak(KOLOM.komisi))}</select></label>
          </div>
          <div class="row">
            <label class="field"><span>Kolom jumlah (opsional)</span><select class="input" id="af-qty">${opsi(rows[0].findIndex((h) => KOLOM.qty.test(h)), true)}</select></label>
            <label class="field"><span>Kolom status (opsional)</span><select class="input" id="af-sts">${opsi(sts, true)}</select></label>
            <label class="field"><span>Abaikan status berisi</span><input class="input" id="af-abaikan" value="${sts >= 0 ? 'batal, cancel, refund, retur' : ''}"></label>
          </div>
          <div id="af-hasil"></div></div>`;
      isi.querySelectorAll('select, input').forEach((e) => e.addEventListener('input', hitung));
      hitung();
    });

    simpan.addEventListener('click', async () => {
      if (!hasil || !hasil.length) return;
      simpan.disabled = true; err.textContent = '';
      try {
        const sumber = /tiktok/i.test(nama) ? 'TikTok Shop' : /shopee/i.test(nama) ? 'Shopee' : 'Afiliasi';
        for (let i = 0; i < hasil.length; i += 1000) {
          simpan.textContent = `Menyimpan ${Math.min(i + 1000, hasil.length)} / ${hasil.length}`;
          await api('/api/afiliasi/impor', { method: 'POST', timeout: 60000, body: { sumber, baris: hasil.slice(i, i + 1000) } });
        }
        closeOverlay();
        toast(`${nf.format(hasil.length)} baris tersimpan`);
        if (selesai) selesai();
      } catch (e) { err.textContent = e.message; simpan.disabled = false; simpan.textContent = 'Simpan'; }
    });
  });
}
