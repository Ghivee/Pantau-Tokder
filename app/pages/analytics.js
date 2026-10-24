// app/pages/analytics.js - Analytics page
import { getState, isAdmin } from '../core/state.js';
import { api } from '../core/api.js';
import { icon, esc, fmt, pct, usd, cf, nf, addDays, today } from '../core/utils.js';
import { analyticsChannels } from '../components/nav.js';
import { confirmDialog } from '../components/dialogs.js';
import { drawStacked, drawSparkbars } from '../charts/charts.js';

export function renderAnalytics() {
  const S = getState();
  const chans = analyticsChannels();
  const connected = chans.filter((c) => c.connected);
  const missing = chans.filter((c) => !c.connected);

  return `
    <section class="card"><div class="card-h"><h2>YouTube Analytics</h2></div>
      ${connected.length ? `
        <div class="chart-wrap" id="chart-analytics" style="height:250px"></div>
        <div class="grid-2" style="margin-top:16px">
          ${connected.map((c) => {
            const chData = S.daily.filter((d) => d.channel_id === c.id);
            const v = chData.reduce((s, d) => s + d.views, 0);
            const m = chData.reduce((s, d) => s + d.menit_tonton, 0);
            const rev = isAdmin() ? chData.reduce((s, d) => s + (d.revenue || 0), 0) : null;
            const sub = chData.reduce((s, d) => s + d.sub_naik - d.sub_turun, 0);
            return `
              <section class="card"><div class="card-h"><h2>${esc(c.nama)}</h2></div>
                <div class="grid-4">
                  <div class="stat"><span>Views</span><b>${fmt(v)}</b></div>
                  <div class="stat"><span>Menit tonton</span><b>${fmt(m)}</b></div>
                  ${isAdmin() ? `<div class="stat"><span>Pendapatan</span><b>${usd(rev)}</b></div>` : ''}
                  <div class="stat"><span>Sub bersih</span><b>${sub >= 0 ? '+' : ''}${sub}</b></div>
                </div>
                <div class="chart-wrap" id="spark-${c.id}" style="height:120px;margin-top:8px"></div>
              </section>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="empty"><b>Belum ada channel tersambung</b><br>Hubungkan channel di Pengaturan untuk melihat data Analytics.</div>
      `}

      ${missing.length ? `
        <section class="card" style="border-color:var(--warn)"><div class="card-h"><h2>${missing.length} channel belum tersambung</h2><p>${isAdmin() ? 'Klik Hubungkan, login dengan akun tokodeeres@gmail.com, lalu pilih channel yang sesuai di layar Google. Ulangi untuk tiap channel.' : 'Minta pemilik menghubungkannya di Pengaturan.'}</p></div>
          <div class="tools">${missing.map((c) => isAdmin() ? `<a class="btn" href="/api/auth/google">${icon('plus')}Hubungkan ${esc(c.nama)}</a>` : `<span class="pill warn">${esc(c.nama)}</span>`).join('')}</div>
        </section>
      ` : ''}
    </section>
  `;
}