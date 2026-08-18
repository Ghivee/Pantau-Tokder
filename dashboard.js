// ============ STATE ============
let editors = [];
let content = [];
let isLoading = true;
let kontenPage = 1;
const KONTEN_PER_PAGE = 10;
const DASHBOARD_LIMIT = 5;
let trendMetric = 'views'; // views | likes | comments

let filters = { editor: "all", platform: "all", range: "30" };
let chartInstance = null;
let distChartInstance = null;
let retentionChartInstance = null;
let assignTargetId = null;
let selectedUnmatched = new Set();

let isAdminMode = false;
let adminToken = localStorage.getItem("adminToken") || null;
if (adminToken) { isAdminMode = true; }
if (adminToken) { isAdminMode = true; }

// Intercept fetch to add admin token
const originalFetch = window.fetch;
window.fetch = function() {
  let [resource, config] = arguments;
  if (config && ['POST', 'PUT', 'DELETE'].includes(config.method?.toUpperCase())) {
    config.headers = config.headers || {};
    if (adminToken) config.headers['x-admin-password'] = adminToken;
  }
  return originalFetch(resource, config);
};

// ============ THEME TOGGLE ============
const body = document.body;
const themeToggleBtn = document.getElementById("sidebarThemeToggle");

function applyThemeToBtn(theme) {
  if (!themeToggleBtn) return;
  if (theme === "dark") {
    themeToggleBtn.innerHTML = '<i data-lucide="sun" class="theme-icon" style="width: 18px; height: 18px; color: #F59F00;"></i>';
    themeToggleBtn.title = "Mode Terang";
  } else {
    themeToggleBtn.innerHTML = '<i data-lucide="moon" class="theme-icon" style="width: 18px; height: 18px; color: #63E6BE;"></i>';
    themeToggleBtn.title = "Mode Gelap";
  }
  lucide.createIcons({ root: themeToggleBtn });
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = body.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    body.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    applyThemeToBtn(newTheme);
    // Redraw chart with new theme colors
    if (document.getElementById("view-dashboard").classList.contains("active")) {
      renderChart();
    }
  });
}

const savedTheme = localStorage.getItem("theme") || "light";
body.setAttribute("data-theme", savedTheme);
applyThemeToBtn(savedTheme);

// ============ HELPERS ============
function fmt(n) { 
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + "k"; 
  return n.toString(); 
}
function platformLabel(p) {
  if (p === 'youtube') return '<img src="/assets/youtube.svg" style="width:14px;height:14px;vertical-align:middle;"> YouTube';
  if (p === 'instagram') return '<img src="/assets/instagram-icon.svg" style="width:14px;height:14px;vertical-align:middle;"> Instagram';
  if (p === 'facebook') return '<img src="/assets/facebook-icon.svg" style="width:14px;height:14px;vertical-align:middle;"> Facebook';
  if (p === 'tiktok') {
    const isDark = document.body.getAttribute("data-theme") === "dark";
    const src = isDark ? "/assets/TikTok_dark.svg" : "/assets/TikTok_light.svg";
    return `<img src="${src}" class="tk-icon" style="width:14px;height:14px;vertical-align:middle;"> TikTok`;
  }
  return p;
}
function platformClass(p) {
  if (p === 'youtube') return 'plat-yt';
  if (p === 'instagram') return 'plat-ig';
  if (p === 'facebook') return 'plat-fb';
  if (p === 'tiktok') return 'plat-tk';
  return '';
}
function editorById(id) { return editors.find(e => e.id === id); }

function showToast(msg, isError = false) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.innerHTML = `<i data-lucide="${isError ? 'alert-circle' : 'check-circle-2'}" style="width:18px;height:18px;"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  lucide.createIcons({ root: toast });
  
  setTimeout(() => {
    toast.classList.add("hiding");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }
document.querySelectorAll("[data-close]").forEach(b => {
  b.addEventListener("click", e => e.target.closest(".overlay").classList.remove("active"));
});
document.querySelectorAll(".overlay").forEach(o => {
  o.addEventListener("click", e => { if (e.target === o) o.classList.remove("active"); });
});

function filteredContent() {
  const days = Number(filters.range) || 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return content.filter(c => {
    if (filters.editor !== "all" && String(c.editor_id) !== filters.editor) return false;
    if (filters.platform !== "all" && c.platform !== filters.platform) return false;
    if (c.tanggal_upload) {
      const uploadDate = new Date(c.tanggal_upload);
      if (!isNaN(uploadDate.getTime()) && uploadDate < cutoff) return false;
    }
    return true;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
  } catch(e) { return dateStr; }
}

// ============ NAV ============
const asideEl = document.querySelector("aside");
const overlayEl = document.getElementById("sidebarOverlay");

function closeMobileMenu() {
  if (asideEl.classList.contains("show-mobile")) {
    asideEl.classList.remove("show-mobile");
    overlayEl.classList.remove("show");
  }
}

document.getElementById("mobileMenuBtn")?.addEventListener("click", () => {
  asideEl.classList.add("show-mobile");
  overlayEl.classList.add("show");
});

overlayEl?.addEventListener("click", closeMobileMenu);

function switchView(viewName) {
  document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);
  if (navItem) navItem.classList.add("active");
  document.getElementById("view-" + viewName).classList.add("active");
  if (viewName === "pengaturan") {
    renderCodeTable();
    checkAnalyticsStatus();
  }
  closeMobileMenu();
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => switchView(item.dataset.view));
});

// ============ CUSTOM CONFIRM MODAL ============
let customConfirmResolve = null;

function customConfirm(title, message, okText = "Konfirmasi", okClass = "btn-primary") {
  return new Promise((resolve) => {
    document.getElementById("customConfirmTitle").textContent = title;
    document.getElementById("customConfirmMessage").textContent = message;
    
    const okBtn = document.getElementById("customConfirmOkBtn");
    okBtn.textContent = okText;
    okBtn.className = `btn ${okClass}`;
    
    customConfirmResolve = resolve;
    openModal("customConfirmModal");
  });
}

document.getElementById("customConfirmCancelBtn")?.addEventListener("click", () => {
  closeModal("customConfirmModal");
  if (customConfirmResolve) customConfirmResolve(false);
  customConfirmResolve = null;
});

document.getElementById("customConfirmOkBtn")?.addEventListener("click", () => {
  closeModal("customConfirmModal");
  if (customConfirmResolve) customConfirmResolve(true);
  customConfirmResolve = null;
});

// ============ ADMIN MODE ============
function updateAdminUI() {
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdminMode ? '' : 'none';
  });
  
  const menuText = document.getElementById('adminMenuText');
  const menuIcon = document.getElementById('adminMenuIcon');
  const menuStatusDot = document.getElementById('adminMenuStatusDot');
  
  if (menuText && menuIcon) {
    if (isAdminMode) {
      menuText.textContent = "Admin Aktif";
      menuText.style.color = "var(--teal)";
      menuIcon.outerHTML = '<i data-lucide="unlock" id="adminMenuIcon" style="width:18px;height:18px;margin-right:8px;color:var(--teal);"></i>';
      menuStatusDot.style.background = "var(--teal)";
    } else {
      menuText.textContent = "Mode Admin";
      menuText.style.color = "";
      menuIcon.outerHTML = '<i data-lucide="lock" id="adminMenuIcon" style="width:18px;height:18px;margin-right:8px;opacity:0.7;"></i>';
      menuStatusDot.style.background = "var(--line-strong)";
    }
    lucide.createIcons({ root: document.getElementById('adminMenuBtn') });
  }
}

document.getElementById("adminMenuBtn")?.addEventListener("click", async () => {
  if (isAdminMode) {
    const isSure = await customConfirm("Keluar Mode Admin", "Anda yakin ingin keluar dari Mode Admin?", "Keluar", "btn-outline");
    if (isSure) {
      isAdminMode = false;
      adminToken = null;
      localStorage.removeItem("adminToken");
      updateAdminUI();
      if (document.getElementById("view-pengaturan").classList.contains("active")) {
        switchView("dashboard");
      }
      showToast("Terkunci: Kembali ke mode publik");
    }
  } else {
    document.getElementById("adminPasswordInput").value = "";
    openModal("adminLoginModal");
  }
});

document.getElementById("confirmAdminLoginBtn")?.addEventListener("click", async () => {
  const pwd = document.getElementById("adminPasswordInput").value;
  if (!pwd) return showToast("Masukkan password", true);
  
  const btn = document.getElementById("confirmAdminLoginBtn");
  btn.disabled = true;
  btn.textContent = "Memeriksa...";
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    
    if (res.ok) {
      isAdminMode = true;
      adminToken = pwd;
      localStorage.setItem("adminToken", pwd);
      closeModal("adminLoginModal");
      updateAdminUI();
      showToast("Berhasil masuk Mode Admin");
    } else {
      const err = await res.json();
      showToast(err.error || "Password salah", true);
    }
  } catch(e) {
    showToast("Gagal menghubungi server", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Masuk Mode Admin";
  }
});

// ============ SKELETON LOADING ============
function showSkeletons() {
  // Metric cards skeleton
  document.getElementById("metricCards").innerHTML = 
    '<div class="metric-card"><div class="skeleton skel-card"></div></div>'.repeat(4);

  // Chart skeleton
  const chartPanel = document.getElementById("chartPanel");
  const canvas = document.getElementById("trendChart");
  if (canvas) canvas.style.display = "none";
  const skelChart = document.createElement("div");
  skelChart.className = "skeleton skel-chart";
  skelChart.id = "skelChart";
  chartPanel.appendChild(skelChart);

  // Leaderboard skeleton
  document.getElementById("editorLeaderboard").innerHTML = 
    '<div class="skeleton skel-leaderboard"></div>'.repeat(3);

  // Dashboard table skeleton
  document.getElementById("contentTable").innerHTML = 
    `<tr><td colspan="7"><div class="skeleton skel-row"></div><div class="skeleton skel-row"></div><div class="skeleton skel-row"></div></td></tr>`;
}

function hideSkeletons() {
  const skelChart = document.getElementById("skelChart");
  if (skelChart) skelChart.remove();
  const canvas = document.getElementById("trendChart");
  if (canvas) canvas.style.display = "";
}

// ============ RENDER: DASHBOARD ============
function populateEditorFilter() {
  const options = '<option value="all">Semua editor</option>' + editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
  const sel1 = document.getElementById("filterEditor");
  if (sel1) sel1.innerHTML = options;
  const sel2 = document.getElementById("kontenFilterEditor");
  if (sel2) sel2.innerHTML = options;
}

function renderMetrics() {
  const data = filteredContent();
  const totalViews = data.reduce((s, c) => s + (c.views || 0), 0);
  const totalLikes = data.reduce((s, c) => s + (c.likes || 0), 0);
  const unmatched = content.filter(c => c.status_identifikasi === "unmatched").length;
  
  // Update sidebar badge
  const badge = document.getElementById("unmatchedBadge");
  if (badge) {
    if (unmatched > 0) {
      badge.textContent = unmatched;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
  
  document.getElementById("metricCards").innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Total konten</div>
      <div class="metric-value num">${data.length}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total views</div>
      <div class="metric-value num">${fmt(totalViews)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total likes</div>
      <div class="metric-value num">${fmt(totalLikes)}</div>
    </div>
    <div class="metric-card warn-card" style="cursor:pointer;" onclick="switchView('unmatched')">
      <div class="metric-label">Belum teridentifikasi</div>
      <div class="metric-value num">${unmatched}</div>
      <div class="metric-sub">Klik untuk tinjau →</div>
    </div>
  `;
}

function renderLeaderboard() {
  const data = filteredContent();
  const stats = editors.map(e => {
    const items = data.filter(c => c.editor_id === e.id);
    const views = items.reduce((s, c) => s + (c.views || 0), 0);
    return { ...e, count: items.length, views };
  }).sort((a, b) => b.views - a.views);
  
  const maxViews = Math.max(...stats.map(s => s.views), 1);
  document.getElementById("editorLeaderboard").innerHTML = stats.map(s => `
    <div class="editor-row" data-editor="${s.id}">
      <div class="editor-id">
        <div class="avatar">${s.nama.slice(0, 2).toUpperCase()}</div>
        <div><div class="editor-name">${s.nama}</div><div class="editor-count">${s.count} konten</div></div>
      </div>
      <div class="editor-metric">
        <div class="editor-views num">${fmt(s.views)} views</div>
      </div>
    </div>
  `).join("") || '<div class="empty-note">Belum ada data performa.</div>';
  
  document.querySelectorAll("#editorLeaderboard .editor-row").forEach(row => {
    row.addEventListener("click", () => openEditorModal(Number(row.dataset.editor)));
  });
}

function contentRowHtml(c) {
  const editor = editorById(c.editor_id);
  const tipeBadge = c.tipe_video === 'short' 
    ? '<span class="status-pill status-warn" style="font-size:11px;">Shorts</span>' 
    : '<span class="status-pill status-ok" style="font-size:11px;">Panjang</span>';
    
  function fmtDur(secs) {
    if (!secs || secs === 0) return '-';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  
  return `
    <tr class="clickable" data-content="${c.id}">
      <td data-label="Konten" class="content-title">${c.judul}</td>
      <td data-label="Platform"><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></td>
      <td data-label="Jenis">${tipeBadge}</td>
      <td data-label="Durasi">${fmtDur(c.duration_secs)}</td>
      <td data-label="Waktu Upload" style="white-space: nowrap;">${formatDate(c.tanggal_upload).replace(',', '')}</td>
      <td data-label="Editor">${editor ? editor.nama : "—"}</td>
      <td data-label="Views" class="num-cell">${fmt(c.views)}</td>
      <td data-label="Likes" class="num-cell">${fmt(c.likes)}</td>
      <td data-label="Komentar" class="num-cell">${fmt(c.comments || c.komentar)}</td>
      <td data-label="Status">${c.status_identifikasi === "matched" ? '<span class="status-pill status-ok">Teridentifikasi</span>' : '<span class="status-pill status-warn">Perlu ditinjau</span>'}</td>
    </tr>`;
}

function renderTable() {
  const data = filteredContent();
  const limited = data.slice(0, DASHBOARD_LIMIT);
  document.getElementById("tableCount").textContent = `${data.length} item`;
  document.getElementById("contentTable").innerHTML = limited.map(contentRowHtml).join("") || `<tr><td colspan="7" class="empty-note">Tidak ada konten sesuai filter.</td></tr>`;
  attachRowClicks("contentTable");
  
  // Show/hide "Lihat semua" link
  const viewAllLink = document.getElementById("viewAllLink");
  if (data.length > DASHBOARD_LIMIT) {
    viewAllLink.style.display = "flex";
  } else {
    viewAllLink.style.display = "none";
  }
}

// "Lihat semua konten" link handler
document.getElementById("goToKonten")?.addEventListener("click", () => {
  switchView("konten");
});

function attachRowClicks(tbodyId) {
  document.querySelectorAll(`#${tbodyId} tr[data-content]`).forEach(row => {
    row.addEventListener("click", () => openContentModal(Number(row.dataset.content)));
  });
}

// ============ CHART: Weekly Bar Chart ============
// Metric toggle buttons
document.querySelectorAll(".metric-toggle").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".metric-toggle").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    trendMetric = btn.dataset.metric;
    renderChart();
  });
});

function renderChart() {
  const ctx = document.getElementById("trendChart");
  if (!ctx) return;
  if (typeof Chart === "undefined") {
    ctx.outerHTML = '<div class="empty-note">Gagal memuat grafik. Periksa koneksi internet Anda.</div>';
    return;
  }
  
  if (chartInstance) chartInstance.destroy();
  
  const days = Number(filters.range) || 30;
  const data = filteredContent();
  const metric = trendMetric || 'views';
  const metricKey = metric === 'comments' ? 'comments' : metric; // views or likes
  const metricLabel = metric === 'views' ? 'Views' : metric === 'likes' ? 'Likes' : 'Komentar';
  const lineColor = metric === 'views' ? (document.body.getAttribute('data-theme')==='dark' ? '#63E6BE' : '#20C997')
    : metric === 'likes' ? '#FF6B6B'
    : '#339AF0';
  
  // Group data by week
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  // Calculate number of weeks
  const totalMs = today.getTime() - startDate.getTime();
  const totalWeeks = Math.max(Math.ceil(totalMs / (7 * 24 * 60 * 60 * 1000)), 1);
  
  // Initialize weeks
  const weeks = [];
  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > today) weekEnd.setTime(today.getTime());
    
    weeks.push({
      start: weekStart,
      end: weekEnd,
      label: `${weekStart.getDate()}/${weekStart.getMonth() + 1}`,
      views: 0, likes: 0, comments: 0,
      count: 0
    });
  }
  
  // Populate weeks with data
  data.forEach(item => {
    if (!item.tanggal_upload) return;
    try {
      const d = new Date(item.tanggal_upload);
      if (isNaN(d.getTime())) return;
      
      for (const week of weeks) {
        if (d >= week.start && d <= week.end) {
          week.views += Number(item.views || 0);
          week.likes += Number(item.likes || 0);
          week.comments += Number(item.comments || item.komentar || 0);
          week.count++;
          break;
        }
      }
    } catch(e) {}
  });
  
  const labels = weeks.map(w => w.label);
  const chartData = weeks.map(w => w[metricKey]);
  const hasData = chartData.some(v => v > 0);
  
  if (!hasData) {
    ctx.style.display = "none";
    let emptyMsg = document.getElementById("chartEmpty");
    if (!emptyMsg) {
      emptyMsg = document.createElement("div");
      emptyMsg.id = "chartEmpty";
      emptyMsg.className = "empty-note";
      emptyMsg.textContent = "Belum ada data di periode ini.";
      ctx.parentElement.appendChild(emptyMsg);
    }
    return;
  }
  
  // Remove empty message if exists
  const emptyMsg = document.getElementById("chartEmpty");
  if (emptyMsg) emptyMsg.remove();
  ctx.style.display = "";
  
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const gridColor = isDark ? "#2D2D2D" : "#E9ECEF";
  const textColor = isDark ? "#A0A0A0" : "#6C757D";
  // lineColor is already computed above based on metric
  const finalLineColor = lineColor;

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  const gradAlpha = metric === 'views' ? (isDark ? 'rgba(99,230,190,0.4)' : 'rgba(32,201,151,0.4)')
    : metric === 'likes' ? 'rgba(255,107,107,0.4)'
    : 'rgba(51,154,240,0.4)';
  const gradAlpha0 = metric === 'views' ? (isDark ? 'rgba(99,230,190,0)' : 'rgba(32,201,151,0)')
    : metric === 'likes' ? 'rgba(255,107,107,0)'
    : 'rgba(51,154,240,0)';
  gradient.addColorStop(0, gradAlpha);
  gradient.addColorStop(1, gradAlpha0);

  chartInstance = new Chart(ctx, {
    type: "line",
    data: { 
      labels, 
      datasets: [{ 
        label: metricLabel,
        data: chartData, 
        borderColor: finalLineColor,
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: finalLineColor,
        pointBorderColor: isDark ? "#1E1E1E" : "#fff",
        pointBorderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4
      }] 
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: { 
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? "#2D2D2D" : "#12181A",
          titleFont: { family: "Inter", size: 12, weight: "600" },
          bodyFont: { family: "JetBrains Mono", size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            title: function(ctx) {
              const i = ctx[0].dataIndex;
              const w = weeks[i];
              const startStr = w.start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
              const endStr = w.end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
              return `${startStr} – ${endStr}`;
            },
            label: function(ctx) {
              const i = ctx.dataIndex;
              return `${ctx.formattedValue} ${metricLabel.toLowerCase()} (${weeks[i].count} konten)`;
            }
          }
        }
      },
      scales: {
        y: { 
          ticks: { callback: v => fmt(v), color: textColor, font: { family: "JetBrains Mono", size: 11 } }, 
          grid: { color: gridColor }, 
          beginAtZero: true 
        },
        x: { 
          ticks: { color: textColor, font: { size: 11 } }, 
          grid: { display: false } 
        }
      }
    }
  });
}

// ============ RENDER: TOP CONTENT PER PLATFORM ============
function renderTopContent() {
  const grid = document.getElementById("topContentGrid");
  if (!grid) return;
  const data = filteredContent();
  const platforms = ['youtube', 'instagram', 'facebook', 'tiktok'];
  const platformNames = { youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
  
  let html = '';
  platforms.forEach(plat => {
    const items = data.filter(c => c.platform === plat)
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 3);
    if (items.length === 0) return;
    
    html += `<div style="background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:16px;">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; font-weight:600; font-size:13px; color:var(--ink);">
        ${platformLabel(plat)}
      </div>
      ${items.map((c, i) => `
        <div style="display:flex; align-items:flex-start; gap:10px; padding:8px 0; ${i < items.length - 1 ? 'border-bottom:1px solid var(--line);' : ''}">
          <div style="width:20px; height:20px; border-radius:50%; background:var(--line-strong); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; color:var(--muted); flex-shrink:0;">${i+1}</div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:12.5px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--ink); cursor:pointer;" data-content="${c.id}">${c.judul}</div>
            <div style="font-size:11.5px; color:var(--teal); font-weight:600; margin-top:2px;">${fmt(c.views || 0)} views</div>
          </div>
        </div>
      `).join('')}
    </div>`;
  });
  
  grid.innerHTML = html || '<div class="empty-note" style="grid-column:1/-1;">Belum ada data konten.</div>';
  grid.querySelectorAll('[data-content]').forEach(el => {
    el.addEventListener('click', () => openContentModal(Number(el.dataset.content)));
  });
}

function renderDashboard() {
  renderMetrics(); renderLeaderboard(); renderTable(); renderChart();
  renderDistChart(); renderKeywords(); renderTopContent();
}

// ============ EXPORT CSV ============
function exportToCSV(dataRows, filename) {
  if (dataRows.length === 0) {
    showToast("Tidak ada data untuk diekspor", true);
    return;
  }
  
  const headers = ["Judul Konten", "Platform", "Nama Editor", "Views", "Likes", "Komentar", "Status", "Tanggal Upload", "URL"];
  
  const csvRows = [headers.join(",")];
  
  dataRows.forEach(c => {
    const editor = editorById(c.editor_id);
    const editorName = editor ? editor.nama : "";
    
    // Escape strings for CSV
    const escapeCsv = (str) => {
      if (str == null) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };
    
    csvRows.push([
      escapeCsv(c.judul),
      escapeCsv(platformLabel(c.platform)),
      escapeCsv(editorName),
      c.views || 0,
      c.likes || 0,
      c.komentar || c.comments || 0,
      escapeCsv(c.status_identifikasi === "matched" ? "Teridentifikasi" : "Belum teridentifikasi"),
      escapeCsv(c.tanggal_upload ? new Date(c.tanggal_upload).toLocaleDateString('id-ID') : ''),
      escapeCsv(c.url)
    ].join(","));
  });
  
  const csvBlob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(csvBlob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============ CHART: Distribution Chart (Horizontal Stacked Bar) ============
function renderDistChart() {
  const ctx = document.getElementById("distChart");
  if (!ctx) return;
  if (typeof Chart === "undefined") return;
  
  if (distChartInstance) distChartInstance.destroy();
  
  const data = filteredContent();
  
  // Aggregate count by editor and platform & video type
  const stats = editors.map(e => {
    const ed = data.filter(c => c.editor_id === e.id);
    return {
      name: e.nama,
      total: ed.length,
      yt_long: ed.filter(c => String(c.platform).toLowerCase() === "youtube" && c.tipe_video === 'long').length,
      yt_short: ed.filter(c => String(c.platform).toLowerCase() === "youtube" && c.tipe_video === 'short').length,
      ig_long: ed.filter(c => String(c.platform).toLowerCase() === "instagram" && c.tipe_video === 'long').length,
      ig_short: ed.filter(c => String(c.platform).toLowerCase() === "instagram" && c.tipe_video === 'short').length,
      fb_long: ed.filter(c => String(c.platform).toLowerCase() === "facebook" && c.tipe_video === 'long').length,
      fb_short: ed.filter(c => String(c.platform).toLowerCase() === "facebook" && c.tipe_video === 'short').length,
      tk_long: ed.filter(c => String(c.platform).toLowerCase() === "tiktok" && c.tipe_video === 'long').length,
      tk_short: ed.filter(c => String(c.platform).toLowerCase() === "tiktok" && c.tipe_video === 'short').length,
    };
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total);
  
  const hasData = stats.length > 0;
  
  if (!hasData) {
    ctx.style.display = "none";
    let emptyMsg = document.getElementById("distEmpty");
    if (!emptyMsg) {
      emptyMsg = document.createElement("div");
      emptyMsg.id = "distEmpty";
      emptyMsg.className = "empty-note";
      emptyMsg.textContent = "Belum ada data distribusi.";
      ctx.parentElement.appendChild(emptyMsg);
    }
    return;
  }
  
  const emptyMsg = document.getElementById("distEmpty");
  if (emptyMsg) emptyMsg.remove();
  ctx.style.display = "";
  
  // Adjust height dynamically based on number of editors
  const dynamicHeight = Math.max(360, stats.length * 40 + 160);
  ctx.parentElement.style.height = `${dynamicHeight}px`;
  
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#A0A0A0" : "#6C757D";
  const gridColor = isDark ? "#2D2D2D" : "#E9ECEF";
  
  distChartInstance = new Chart(ctx, {
    type: "bar",
    data: { 
      labels: stats.map(s => s.name),
      datasets: [
        {
          label: "YT Panjang",
          data: stats.map(s => s.yt_long),
          backgroundColor: "#C92A2A", // Dark red
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "YT Shorts",
          data: stats.map(s => s.yt_short),
          backgroundColor: "#FF6B6B", // Light red
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "IG Video",
          data: stats.map(s => s.ig_long),
          backgroundColor: "#A61E4D", // Dark pink
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "IG Reels",
          data: stats.map(s => s.ig_short),
          backgroundColor: "#F06595", // Light pink
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "FB Video",
          data: stats.map(s => s.fb_long),
          backgroundColor: "#1864AB", // Dark blue
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "FB Reels",
          data: stats.map(s => s.fb_short),
          backgroundColor: "#339AF0", // Light blue
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "TK Video",
          data: stats.map(s => s.tk_long),
          backgroundColor: "#25F4EE", // TikTok Cyan
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        },
        {
          label: "TK Shorts",
          data: stats.map(s => s.tk_short),
          backgroundColor: "#000000", // TikTok Black
          borderRadius: 4, barThickness: 'flex', maxBarThickness: 24
        }
      ]
    },
    options: {
      indexAxis: 'y', // Horizontal
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 20,
          right: 20
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: textColor, font: { family: "JetBrains Mono", size: 11 }, stepSize: 1 },
          grid: { color: gridColor },
          beginAtZero: true
        },
        y: {
          stacked: true,
          ticks: { color: textColor, font: { size: 12 } },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: isDark ? "#2D2D2D" : "#12181A",
          titleFont: { family: "Inter", size: 12, weight: "600" },
          bodyFont: { family: "JetBrains Mono", size: 12 },
          padding: 12,
          cornerRadius: 8,
          mode: 'index',
          intersect: false
        }
      }
    }
  });

  const tkSrc = isDark ? "/assets/TikTok_dark.svg" : "/assets/TikTok_light.svg";
  const tkColor = isDark ? "#FFFFFF" : "#000000";

  const dot = (color) => `<div style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;margin-right:4px;vertical-align:middle;"></div>`;
  
  document.getElementById("distCustomLegend").innerHTML = `
    <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 11.5px; margin-bottom: 16px; justify-content: center; color: var(--muted);">
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="/assets/youtube.svg" style="width:14px;height:14px;margin-right:-2px;">
        <span style="display:flex;align-items:center;">${dot('#C92A2A')} Panjang</span>
        <span style="display:flex;align-items:center;">${dot('#FF6B6B')} Shorts</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="/assets/instagram-icon.svg" style="width:14px;height:14px;margin-right:-2px;">
        <span style="display:flex;align-items:center;">${dot('#A61E4D')} Video</span>
        <span style="display:flex;align-items:center;">${dot('#F06595')} Reels</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="/assets/facebook-icon.svg" style="width:14px;height:14px;margin-right:-2px;">
        <span style="display:flex;align-items:center;">${dot('#1864AB')} Video</span>
        <span style="display:flex;align-items:center;">${dot('#339AF0')} Reels</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${tkSrc}" class="tk-icon" style="width:14px;height:14px;margin-right:-2px;">
        <span style="display:flex;align-items:center;">${dot('#25F4EE')} Video</span>
        <span style="display:flex;align-items:center;">${dot(tkColor)} Shorts</span>
      </div>
    </div>
  `;
}

// ============ NLP: Keyword Parsing ============
function renderKeywords() {
  const tableBody = document.getElementById("keywordTable");
  if (!tableBody) return;
  
  const data = filteredContent();
  if (data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="empty-note">Belum ada data untuk dianalisis.</td></tr>`;
    return;
  }
  
  // Basic Indonesian Stop Words
  const stopWords = new Set(["di", "ke", "dari", "yang", "dan", "atau", "ini", "itu", "dengan", "untuk", "pada", "dalam", "sebagai", "adalah", "tidak", "ya", "sih", "dong", "kan", "buat", "ada", "juga", "aku", "kamu", "dia", "kita", "kami", "mereka", "bisa", "akan", "sudah", "belum", "lagi", "terus", "apa", "kenapa", "bagaimana", "siapa", "kapan", "dimana", "kok", "saja", "aja", "biar", "karena", "seperti"]);
  
  const keywordMap = {};
  
  data.forEach(c => {
    if (!c.judul) return;
    // Clean and split title
    const words = c.judul.toLowerCase()
      .replace(/[^\w\s]/g, '') // remove punctuation
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w) && !Number.isFinite(Number(w))); // length > 2, not stop word, not pure number
      
    // Use a Set to avoid counting the same word multiple times per title
    const uniqueWords = new Set(words);
    
    uniqueWords.forEach(w => {
      if (!keywordMap[w]) keywordMap[w] = { count: 0, views: 0 };
      keywordMap[w].count++;
      keywordMap[w].views += (c.views || 0);
    });
  });
  
  const topKeywords = Object.entries(keywordMap)
    .map(([word, stats]) => ({ word, ...stats }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
    
  if (topKeywords.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="empty-note">Tidak ditemukan kata kunci spesifik.</td></tr>`;
    return;
  }
  
  tableBody.innerHTML = topKeywords.map(k => `
    <tr>
      <td style="font-weight: 600; text-transform: capitalize;">${k.word}</td>
      <td class="num-cell">${k.count}</td>
      <td class="num-cell" style="color: var(--teal);">${fmt(k.views)}</td>
    </tr>
  `).join("");
}

// ============ RENDER: EDITOR PAGE ============
function renderEditorCards() {
  document.getElementById("editorCards").innerHTML = editors.map(e => {
    const items = content.filter(c => c.editor_id === e.id);
    const views = items.reduce((s, c) => s + (c.views || 0), 0);
    const likes = items.reduce((s, c) => s + (c.likes || 0), 0);
    return `
      <div class="editor-card">
        <div class="editor-card-head">
          <div class="avatar">${e.nama.slice(0, 2).toUpperCase()}</div>
          <div style="flex: 1; display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="editor-name">${e.nama}</div>
            <span class="code-tag">${e.kode_identifikasi || e.kode}</span>
          </div>
        </div>
        <div class="editor-card-stats">
          <div>Konten<b>${items.length}</b></div>
          <div>Views<b>${fmt(views)}</b></div>
          <div>Likes<b>${fmt(likes)}</b></div>
        </div>
        <div class="row-actions">
          <button class="btn btn-sm" data-view-editor="${e.id}">Lihat detail</button>
          <button class="btn btn-sm btn-danger admin-only delete-editor-btn" data-id="${e.id}" style="${!isAdminMode ? 'display:none;' : ''}">Hapus</button>
        </div>
      </div>`;
  }).join("") || '<div class="empty-note">Belum ada data editor.</div>';
  
  document.querySelectorAll("[data-view-editor]").forEach(b => b.addEventListener("click", () => openEditorModal(Number(b.dataset.viewEditor))));
  
  if (isAdminMode) {
    document.querySelectorAll(".delete-editor-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.id);
        const e = editorById(id);
        if (!e) return;
        const isSure = await customConfirm("Hapus Editor", `Hapus editor ${e.nama}? Konten miliknya akan berpindah ke status belum teridentifikasi.`, "Hapus");
        if (!isSure) return;
  
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = "Menghapus...";
        try {
          await fetch(`/api/editors/${id}`, { method: 'DELETE' });
          content.forEach(c => { if (c.editor_id === id) { c.editor_id = null; c.status_identifikasi = "unmatched"; } });
          editors = editors.filter(x => x.id !== id);
          showToast(`Editor ${e.nama} dihapus`);
          renderAll();
        } catch (err) {
          showToast("Gagal menghapus editor", true);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    });
  }
}

// ============ RENDER: KONTEN PAGE (with Pagination) ============
function renderKontenFull() {
  const q = (document.getElementById("searchKonten")?.value || "").trim().toLowerCase();
  const platform = document.getElementById("kontenFilterPlatform")?.value || "all";
  const editor = document.getElementById("kontenFilterEditor")?.value || "all";
  const status = document.getElementById("kontenFilterStatus")?.value || "all";
  const jenis = document.getElementById("kontenFilterJenis")?.value || "all";
  
  const allRows = content.filter(c => {
    if (q && !c.judul.toLowerCase().includes(q)) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    if (editor !== "all" && String(c.editor_id) !== editor) return false;
    if (status !== "all" && status === "matched" && c.status_identifikasi !== "matched") return false;
    if (status !== "all" && status === "unmatched" && c.status_identifikasi !== "unmatched") return false;
    if (jenis !== "all" && String(c.tipe_video) !== jenis) return false;
    return true;
  });
  
  const sort = document.getElementById("kontenSort")?.value || "newest";
  allRows.sort((a, b) => {
    switch (sort) {
      case "newest": return new Date(b.tanggal_upload || 0) - new Date(a.tanggal_upload || 0);
      case "oldest": return new Date(a.tanggal_upload || 0) - new Date(b.tanggal_upload || 0);
      case "views_desc": return (b.views || 0) - (a.views || 0);
      case "views_asc": return (a.views || 0) - (b.views || 0);
      case "likes_desc": return (b.likes || 0) - (a.likes || 0);
      case "comments_desc": return (b.comments || b.komentar || 0) - (a.comments || a.komentar || 0);
      default: return 0;
    }
  });
  
  const totalPages = Math.max(Math.ceil(allRows.length / KONTEN_PER_PAGE), 1);
  
  // Clamp page
  if (kontenPage > totalPages) kontenPage = totalPages;
  if (kontenPage < 1) kontenPage = 1;
  
  const start = (kontenPage - 1) * KONTEN_PER_PAGE;
  const pageRows = allRows.slice(start, start + KONTEN_PER_PAGE);
  
  document.getElementById("kontenFullTable").innerHTML = pageRows.map(contentRowHtml).join("") || `<tr><td colspan="7" class="empty-note">Tidak ada konten ditemukan.</td></tr>`;
  attachRowClicks("kontenFullTable");
  
  // Render pagination
  renderPagination(totalPages, allRows.length);
}

function renderPagination(totalPages, totalItems) {
  const container = document.getElementById("kontenPagination");
  
  if (totalPages <= 1) {
    container.innerHTML = `<span class="page-info" style="margin-right:auto;">Menampilkan ${totalItems} konten</span>`;
    return;
  }
  
  let html = `<span class="page-info" style="margin-right:auto;">Menampilkan ${totalItems} konten</span>`;
  html += `<button ${kontenPage <= 1 ? 'disabled' : ''} id="prevPage">← Sebelumnya</button>`;
  
  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages <= 5 || i === 1 || i === totalPages || Math.abs(i - kontenPage) <= 1) {
      html += `<button class="${i === kontenPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    } else if (Math.abs(i - kontenPage) === 2) {
      html += `<span class="page-info">…</span>`;
    }
  }
  
  html += `<button ${kontenPage >= totalPages ? 'disabled' : ''} id="nextPage">Berikutnya →</button>`;
  
  container.innerHTML = html;
  
  // Attach events
  container.querySelector("#prevPage")?.addEventListener("click", () => {
    kontenPage--;
    renderKontenFull();
  });
  container.querySelector("#nextPage")?.addEventListener("click", () => {
    kontenPage++;
    renderKontenFull();
  });
  container.querySelectorAll("[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      kontenPage = Number(btn.dataset.page);
      renderKontenFull();
    });
  });
}

["searchKonten", "kontenFilterPlatform", "kontenFilterEditor", "kontenFilterStatus", "kontenSort", "kontenFilterJenis"].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(id === "searchKonten" ? "input" : "change", () => {
      kontenPage = 1;
      renderKontenFull();
    });
  }
});

// ============ RENDER: UNMATCHED PAGE ============
function renderUnmatched() {
  const rows = content.filter(c => c.status_identifikasi === "unmatched");
  
  // Populate assign-all select
  const assignAllSel = document.getElementById("assignAllEditorSelect");
  if (assignAllSel) {
    assignAllSel.innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
  }
  
  document.getElementById("unmatchedTable").innerHTML = rows.map(c => `
    <tr>
      <td style="text-align: center;"><input type="checkbox" class="unmatched-cb admin-only" value="${c.id}" ${selectedUnmatched.has(c.id) ? 'checked' : ''} style="cursor: pointer; ${!isAdminMode ? 'display:none;' : ''}"></td>
      <td data-label="Konten" class="content-title">${c.judul}</td>
      <td data-label="Platform"><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></td>
      <td data-label="Waktu Upload" style="white-space:nowrap;font-size:12px;">${formatDate(c.tanggal_upload).replace(',','')}</td>
      <td data-label="Views" class="num-cell">${fmt(c.views)}</td>
      <td data-label="Aksi"><button class="btn btn-sm btn-primary admin-only" data-assign="${c.id}" style="${!isAdminMode ? 'display:none;' : ''}">Tandai editor</button></td>
    </tr>
  `).join("");
  document.getElementById("unmatchedEmpty").style.display = rows.length ? "none" : "block";

  // Checkbox logic
  const selectAllCb = document.getElementById("selectAllUnmatched");
  const rowCbs = document.querySelectorAll(".unmatched-cb");
  const assignBtn = document.getElementById("assignAllBtn");

  function updateAssignBtnState() {
    if (assignBtn) {
      assignBtn.textContent = `Tandai ${selectedUnmatched.size} terpilih`;
      assignBtn.disabled = selectedUnmatched.size === 0;
    }
    if (selectAllCb) {
      selectAllCb.checked = rows.length > 0 && selectedUnmatched.size === rows.length;
    }
  }

  if (selectAllCb) {
    selectAllCb.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      selectedUnmatched.clear();
      if (isChecked) rows.forEach(r => selectedUnmatched.add(r.id));
      rowCbs.forEach(cb => cb.checked = isChecked);
      updateAssignBtnState();
    });
  }

  rowCbs.forEach(cb => {
    cb.addEventListener("change", (e) => {
      const id = Number(e.target.value);
      if (e.target.checked) selectedUnmatched.add(id);
      else selectedUnmatched.delete(id);
      updateAssignBtnState();
    });
  });

  updateAssignBtnState();
  
  document.querySelectorAll("[data-assign]").forEach(b => b.addEventListener("click", () => {
    assignTargetId = Number(b.dataset.assign);
    document.getElementById("assignEditorSelect").innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
    openModal("assignModal");
  }));
}

// ============ ASSIGN BULK UNMATCHED ============
document.getElementById("assignAllBtn")?.addEventListener("click", async () => {
  const editorId = Number(document.getElementById("assignAllEditorSelect").value);
  if (!editorId) { showToast("Pilih editor terlebih dahulu", true); return; }
  const editor = editorById(editorId);
  const itemsToAssign = content.filter(c => selectedUnmatched.has(c.id));
  
  if (itemsToAssign.length === 0) { showToast("Pilih minimal satu konten"); return; }
  
  const isSure = await customConfirm("Tandai Editor", `Tandai ${itemsToAssign.length} konten terpilih ke editor ${editor.nama}?`);
  if (!isSure) return;
  
  const btn = document.getElementById("assignAllBtn");
  btn.disabled = true;
  btn.textContent = "Menandai...";
  
  let success = 0;
  for (const item of itemsToAssign) {
    try {
      await fetch(`/api/content/${item.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor_id: editorId })
      });
      item.editor_id = editorId;
      item.status_identifikasi = "matched";
      success++;
    } catch(e) {}
  }
  
  showToast(`${success} konten berhasil ditandai ke ${editor.nama}`);
  selectedUnmatched.clear();
  renderAll();
});

document.getElementById("confirmAssignBtn").addEventListener("click", async () => {
  const editorId = Number(document.getElementById("assignEditorSelect").value);
  const item = content.find(c => c.id === assignTargetId);
  
  if (item) {
    const btn = document.getElementById("confirmAssignBtn");
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = "Menyimpan...";
    
    try {
      await fetch(`/api/content/${assignTargetId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editor_id: editorId })
      });
      item.editor_id = editorId; 
      item.status_identifikasi = "matched";
      closeModal("assignModal");
      showToast("Konten ditandai dan dikaitkan ke editor");
      renderAll();
    } catch (err) {
      showToast("Gagal menandai konten", true);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
});

// ============ RENDER: PENGATURAN ============
function renderCodeTable() {
  document.getElementById("codeTable").innerHTML = editors.map(e => `
    <tr>
      <td data-label="Editor">${e.nama}</td>
      <td data-label="Kode">
        <input type="text" class="input" data-code-for="${e.id}" value="${e.kode_identifikasi || e.kode}" style="width:140px; font-family:'JetBrains Mono', monospace; font-weight:600; font-size:13px; padding:10px 12px;" placeholder="Kode Editor">
      </td>
      <td data-label="Status"><span class="status-pill status-ok">Aktif</span></td>
      <td data-label=""><button class="btn btn-sm btn-primary admin-only" data-save-code="${e.id}">Simpan</button></td>
    </tr>
  `).join("");
  
  document.querySelectorAll("[data-save-code]").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.dataset.saveCode);
    const input = document.querySelector(`[data-code-for="${id}"]`);
    const newCode = input.value.trim();
    const ed = editorById(id);
    
    b.disabled = true;
    const originalText = b.textContent;
    b.textContent = "...";
    try {
      await fetch(`/api/editors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: ed.nama, kode: newCode })
      });
      ed.kode_identifikasi = newCode;
      showToast("Kode identifikasi disimpan");
    } catch (err) {
      showToast("Gagal menyimpan kode", true);
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
  }));
}

// ============ ANALYTICS STATUS ============
async function checkAnalyticsStatus() {
  const statusText = document.getElementById("analyticsStatusText");
  const statusBox = document.getElementById("analyticsStatusBox");
  const connectBtn = document.getElementById("connectAnalyticsBtn");
  if (!statusText) return;

  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (data.connected) {
      statusText.textContent = "✅ YouTube Analytics terhubung";
      statusBox.style.background = "var(--teal-tint)";
      statusBox.style.borderColor = "var(--teal-deep)";
      statusText.style.color = "var(--teal-deep)";
      statusText.style.fontWeight = "600";
      if (connectBtn) connectBtn.textContent = "🔄 Hubungkan Ulang";
    } else {
      statusText.textContent = "❌ Belum terhubung";
      statusBox.style.background = "var(--red-tint)";
      statusBox.style.borderColor = "var(--red-deep)";
      statusText.style.color = "var(--red-deep)";
    }
  } catch(e) {
    statusText.textContent = "⚠️ Tidak bisa memeriksa status koneksi Analytics";
  }
}



// ============ MODALS ============
function openContentModal(id) {
  const c = content.find(x => x.id === id);
  const editor = editorById(c.editor_id);
  const views = c.views || 0;
  const likes = c.likes || 0;
  const comments = c.comments || c.komentar || 0;
  
  const formattedUpload = formatDate(c.tanggal_upload);
  const jenisLabel = c.tipe_video === 'short' ? 'Shorts / Reels' : 'Video Panjang';
  
  // Format real duration from duration_secs
  function fmtDur(secs) {
    if (!secs || secs === 0) return '-';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const realDuration = fmtDur(c.duration_secs);
  const avgDuration = c.avg_view_duration || '-';
  
  document.getElementById("contentModalBody").innerHTML = `
    <div class="detail-row"><span class="detail-label">Judul</span><span>${c.judul}</span></div>
    <div class="detail-row"><span class="detail-label">Platform</span><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></div>
    <div class="detail-row"><span class="detail-label">Jenis Konten</span><span style="font-weight:600;">${jenisLabel}</span></div>
    <div class="detail-row"><span class="detail-label">Durasi Video</span><span class="num" style="font-size:15px; font-weight:700;">${realDuration}</span></div>
    <div class="detail-row"><span class="detail-label">Editor</span><span>${editor ? editor.nama : "Belum teridentifikasi"}</span></div>
    <div class="detail-row"><span class="detail-label">Waktu upload</span><span>${formattedUpload}</span></div>
    <div class="detail-row"><span class="detail-label">Views</span><span class="num">${views.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Likes</span><span class="num">${likes.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Komentar</span><span class="num">${comments.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Tautan</span><span><a href="${c.url}" target="_blank" rel="noopener">Buka postingan ↗</a></span></div>
    
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--line);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom: 12px;">
        <div style="font-size: 14px; font-weight: 600; color: var(--ink);">Retensi Penonton</div>
        ${c.platform === 'youtube' ? `<span id="retentionDataBadge" style="font-size:11px; font-weight:500; color:var(--muted);"></span>` : ''}
      </div>
      <div class="detail-row" style="border-bottom: none; padding-bottom: 0;"><span class="detail-label">Rata-rata durasi tonton</span><span class="num" style="font-size: 14px;">${avgDuration}</span></div>
      <div style="height: 180px; width: 100%; position: relative; margin-top: 16px;">
        <canvas id="retentionChart"></canvas>
      </div>
    </div>
    
    ${!editor ? `<div class="modal-actions admin-only" style="margin-top:16px;"><button class="btn btn-primary btn-sm" id="modalAssignBtn">Tandai editor</button></div>` : ""}
  `;
  const assignBtn = document.getElementById("modalAssignBtn");
  if (assignBtn) assignBtn.addEventListener("click", () => {
    closeModal("contentModal");
    assignTargetId = c.id;
    document.getElementById("assignEditorSelect").innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
    openModal("assignModal");
  });
  
  openModal("contentModal");
  
  // Render Retention Chart if data exists
  if (retentionChartInstance) {
    retentionChartInstance.destroy();
    retentionChartInstance = null;
  }
  
  const retData = c.retention_data ? (typeof c.retention_data === 'string' ? JSON.parse(c.retention_data) : c.retention_data) : [];
  
  if (retData && retData.length > 0) {
    const ctx = document.getElementById('retentionChart');
    if (ctx) {
      const isDark = document.body.getAttribute("data-theme") === "dark";
      const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      const textColor = isDark ? "#A1A1AA" : "#71717A";
      
      const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 180);
      grad.addColorStop(0, "rgba(255, 0, 0, 0.4)"); // YouTube-like red
      grad.addColorStop(1, "rgba(255, 0, 0, 0.0)");
      
      retentionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: retData.map(d => d.percent_duration + "%"),
          datasets: [{
            label: "Persentase Penonton (%)",
            data: retData.map(d => Math.max(0, d.retention)),
            borderColor: "#FF0000",
            backgroundColor: grad,
            borderWidth: 2,
            pointRadius: 0, // hide points for smooth curve look
            pointHoverRadius: 4,
            fill: true,
            tension: 0.3 // smooth curves
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, maxTicksLimit: 5 } // Only show a few percentage markers
            },
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 25, callback: (val) => val + "%" }
            }
          },
          plugins: {
            legend: { display: false }, // Hide legend
            tooltip: {
              backgroundColor: isDark ? "rgba(30, 30, 30, 0.95)" : "rgba(255, 255, 255, 0.95)",
              titleColor: isDark ? "#ffffff" : "#111111",
              bodyColor: isDark ? "#cccccc" : "#444444",
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              borderWidth: 1,
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
              titleFont: { family: "Inter", size: 13, weight: "600" },
              bodyFont: { family: "Inter", size: 13 },
              callbacks: {
                label: (ctx) => `Penonton: ${ctx.parsed.y.toFixed(1)}%`
              }
            }
          }
        }
      });

      // Update retention badge: check if OAuth connected
      const badge = document.getElementById("retentionDataBadge");
      if (badge) {
        fetch('/api/auth/status').then(r => r.json()).then(data => {
          if (data.connected) {
            badge.innerHTML = `<span style="opacity: 0.6;">•</span> Data asli`;
          } else {
            badge.innerHTML = `<span style="opacity: 0.6;">•</span> Estimasi`;
          }
        }).catch(() => {
          badge.innerHTML = `<span style="opacity: 0.6;">•</span> Estimasi`;
        });
      }
    }
  } else {
    // Show empty state if no data
    const canvasContainer = document.getElementById('retentionChart').parentElement;
    canvasContainer.innerHTML = '<div class="empty-note" style="height:100%; display:flex; align-items:center; justify-content:center;">Data retensi belum tersedia.</div>';
  }
}

function openEditorModal(id) {
  const e = editorById(id);
  const items = content.filter(c => c.editor_id === id);
  const views = items.reduce((s, c) => s + (c.views || 0), 0);
  const likes = items.reduce((s, c) => s + (c.likes || 0), 0);
  const shortCount = items.filter(c => c.tipe_video === 'short').length;
  const longCount = items.filter(c => c.tipe_video === 'long').length;

  // Month-over-month comparison
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  
  const thisMonthItems = items.filter(c => c.tanggal_upload && new Date(c.tanggal_upload) >= thisMonthStart);
  const lastMonthItems = items.filter(c => {
    if (!c.tanggal_upload) return false;
    const d = new Date(c.tanggal_upload);
    return d >= lastMonthStart && d <= lastMonthEnd;
  });
  const thisMonthViews = thisMonthItems.reduce((s, c) => s + (c.views || 0), 0);
  const lastMonthViews = lastMonthItems.reduce((s, c) => s + (c.views || 0), 0);
  const viewsDiff = lastMonthViews > 0 ? ((thisMonthViews - lastMonthViews) / lastMonthViews * 100) : null;
  const viewsDiffHtml = viewsDiff !== null
    ? `<span style="font-size:11px; font-weight:600; color:${viewsDiff >= 0 ? 'var(--teal)' : '#FA5252'};">${viewsDiff >= 0 ? '▲' : '▼'} ${Math.abs(viewsDiff).toFixed(1)}% vs bulan lalu</span>`
    : '';
  
  document.getElementById("editorModalName").textContent = e.nama;
  document.getElementById("editorModalBody").innerHTML = `
    <div class="detail-row"><span class="detail-label">Kode identifikasi</span><span class="code-tag">${e.kode_identifikasi || e.kode}</span></div>
    <div class="detail-row"><span class="detail-label">Total konten</span><span class="num">${items.length} <span style="font-size:12px;color:var(--muted);font-weight:normal;">(${longCount} Panjang, ${shortCount} Shorts)</span></span></div>
    <div class="detail-row"><span class="detail-label">Total views</span><span class="num">${fmt(views)}</span></div>
    <div class="detail-row"><span class="detail-label">Total likes</span><span class="num">${fmt(likes)}</span></div>

    <div style="margin-top:16px; padding:14px; border-radius:10px; background:var(--surface); border:1px solid var(--line);">
      <div style="font-size:12px; color:var(--muted); font-weight:600; margin-bottom:10px; text-transform:uppercase; letter-spacing:0.5px;">Perbandingan Bulan Ini vs Lalu</div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
        <div>
          <div style="font-size:11px; color:var(--muted); margin-bottom:3px;">Bulan ini</div>
          <div style="font-size:16px; font-weight:700; color:var(--ink);">${fmt(thisMonthViews)} <span style="font-size:11px;font-weight:400;color:var(--muted);">views</span></div>
          <div style="font-size:12px; color:var(--muted);">${thisMonthItems.length} konten</div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--muted); margin-bottom:3px;">Bulan lalu</div>
          <div style="font-size:16px; font-weight:700; color:var(--ink);">${fmt(lastMonthViews)} <span style="font-size:11px;font-weight:400;color:var(--muted);">views</span></div>
          <div style="font-size:12px; color:var(--muted);">${lastMonthItems.length} konten</div>
        </div>
      </div>
      ${viewsDiffHtml ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--line);">${viewsDiffHtml}</div>` : ''}
    </div>

    <div style="margin-top:20px;font-size:12.5px;color:var(--muted);margin-bottom:12px;font-weight:600;">Konten terbaru</div>
    ${items.slice(0, 5).map(c => `
      <div class="detail-row" style="margin-bottom:8px; align-items:flex-start;">
        <div style="flex:1; padding-right:12px;">
          <div style="margin-bottom:6px; line-height:1.4;">${c.judul}</div>
          <span style="display:inline-flex; align-items:center; gap:4px; font-size:10.5px; padding:3px 8px; background:var(--surface-hover); color:var(--ink); border:1px solid var(--line); border-radius:6px; font-weight:500;">
            ${c.tipe_video === 'short' ? 'Shorts' : 'Panjang'} <span style="color:var(--muted); margin:0 2px;">•</span> ${platformLabel(c.platform)}
          </span>
        </div>
        <span class="num">${fmt(c.views)}</span>
      </div>
    `).join("") || '<div class="empty-note">Belum ada konten.</div>'}
    <div class="modal-actions" style="margin-top:16px; padding-top:12px; border-top:1px solid var(--line);">
      <button class="btn btn-sm" id="exportEditorBtn" data-editor-id="${id}"><i data-lucide="download" style="width:14px;height:14px;"></i> Unduh CSV editor ini</button>
    </div>
  `;
  openModal("editorModal");

  // Export per editor button
  document.getElementById("exportEditorBtn")?.addEventListener("click", () => {
    exportToCSV(items, `Konten_${e.nama}_${new Date().toISOString().split('T')[0]}`);
  });
  lucide.createIcons({ root: document.getElementById("editorModalBody") });
}

// ============ ADD EDITOR ============
document.getElementById("addEditorBtn").addEventListener("click", () => {
  document.getElementById("newEditorName").value = "";
  document.getElementById("newEditorCode").value = "";
  openModal("addEditorModal");
});
document.getElementById("saveEditorBtn").addEventListener("click", async () => {
  const nama = document.getElementById("newEditorName").value.trim();
  const kode = document.getElementById("newEditorCode").value.trim();
  if (!nama || !kode) { showToast("Isi nama dan kode terlebih dahulu", true); return; }
  
  const btn = document.getElementById("saveEditorBtn");
  btn.disabled = true;
  const originalHtml = btn.innerHTML;
  btn.textContent = "Menyimpan...";
  
  try {
    const res = await fetch('/api/editors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nama, kode })
    });
    const newEd = await res.json();
    if (!res.ok) throw new Error(newEd.error || "Gagal menyimpan");
    
    editors.push(newEd);
    closeModal("addEditorModal");
    showToast(`Editor ${nama} ditambahkan`);
    renderAll();
  } catch (err) {
    showToast("Gagal menambah editor: " + err.message, true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
});

// ============ FILTERS + SYNC ============
["filterEditor", "filterPlatform", "filterRange"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    filters = {
      editor: document.getElementById("filterEditor").value,
      platform: document.getElementById("filterPlatform").value,
      range: document.getElementById("filterRange").value,
    };
    renderDashboard();
  });
});

// CSV Export Listeners
document.getElementById("exportDashBtn")?.addEventListener("click", () => {
  exportToCSV(filteredContent(), `Dashboard_Analitik_${new Date().toISOString().split('T')[0]}`);
});
document.getElementById("exportKontenBtn")?.addEventListener("click", () => {
  const q = (document.getElementById("searchKonten")?.value || "").trim().toLowerCase();
  const platform = document.getElementById("kontenFilterPlatform")?.value || "all";
  const editor = document.getElementById("kontenFilterEditor")?.value || "all";
  const status = document.getElementById("kontenFilterStatus")?.value || "all";
  const jenis = document.getElementById("kontenFilterJenis")?.value || "all";

  const allRows = content.filter(c => {
    if (q && !c.judul.toLowerCase().includes(q)) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    if (editor !== "all" && String(c.editor_id) !== editor) return false;
    if (status !== "all" && status === "matched" && c.status_identifikasi !== "matched") return false;
    if (status !== "all" && status === "unmatched" && c.status_identifikasi !== "unmatched") return false;
    if (jenis !== "all" && String(c.tipe_video) !== jenis) return false;
    return true;
  });
  
  exportToCSV(allRows, `Data_Konten_${new Date().toISOString().split('T')[0]}`);
});

document.getElementById("refreshBtn").addEventListener("click", async () => {
  const btn = document.getElementById("refreshBtn");
  btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#fff;"></div> Menyinkronkan...`;
  btn.disabled = true;
  
  try {
    const res = await fetch('/api/scan', { method: 'POST' });
    const data = await res.json();
    
    if (!res.ok) {
      showToast(`Gagal sinkronisasi: ${data.error || 'Server error'}`, true);
      return;
    }
    
    // Update last sync display
    const now = new Date();
    const syncDisplay = document.getElementById("lastSyncDisplay");
    if (syncDisplay) {
      syncDisplay.innerHTML = `<i data-lucide="clock" style="width:12px;height:12px;"></i> Sinkron: ${now.toLocaleDateString('id-ID', {day:'numeric',month:'short'})} ${now.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}`;
      lucide.createIcons({ root: syncDisplay });
    }
    localStorage.setItem('lastSync', now.toISOString());

    // Reload data from DB
    await loadData();
    
    if (data.errors && data.errors.length > 0) {
      showToast(`Sinkronisasi selesai (${data.newPosts || 0} baru, ${data.updatedPosts || 0} diperbarui). Ada ${data.errors.length} error, cek console untuk detail.`, true);
    } else {
      showToast(`Sinkronisasi selesai! ${data.newPosts || 0} konten baru, ${data.updatedPosts || 0} diperbarui.`);
    }
  } catch (err) {
    console.error('Sync error:', err);
    showToast("Gagal terhubung ke backend. Periksa apakah API Vercel berjalan.", true);
  } finally {
    btn.innerHTML = `<span class="btn-text">Sinkronkan sekarang</span>`;
    btn.disabled = false;
  }
});

// ============ GOALS ============
let currentGoal = { target_omset: 0, tercapai: 0 };
async function loadGoal() {
  try {
    const res = await fetch('/api/goals');
    if (res.ok) {
      currentGoal = await res.json();
      renderGoal();
    }
  } catch (e) { console.error("Error loading goal", e); }
}

function renderGoal() {
  document.getElementById("goalTarget").textContent = "Rp " + fmt(currentGoal.target_omset);
  document.getElementById("goalTercapai").textContent = "Rp " + fmt(currentGoal.tercapai);
  const percentage = currentGoal.target_omset > 0 ? (currentGoal.tercapai / currentGoal.target_omset) * 100 : 0;
  const clamped = Math.min(Math.max(percentage, 0), 100);
  document.getElementById("goalProgress").style.width = clamped + "%";
  document.getElementById("goalPercentage").textContent = clamped.toFixed(1) + "% tercapai";
}

document.getElementById("editGoalBtn")?.addEventListener("click", () => {
  document.getElementById("goalInputTarget").value = currentGoal.target_omset;
  document.getElementById("goalInputTercapai").value = currentGoal.tercapai;
  openModal("goalModal");
});

document.getElementById("saveGoalBtn")?.addEventListener("click", async () => {
  const target = Number(document.getElementById("goalInputTarget").value) || 0;
  const tercapai = Number(document.getElementById("goalInputTercapai").value) || 0;
  
  const btn = document.getElementById("saveGoalBtn");
  btn.disabled = true;
  btn.textContent = "Menyimpan...";
  
  try {
    const res = await fetch('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bulan: currentGoal.bulan || new Date().toISOString().slice(0,7), target_omset: target, tercapai: tercapai })
    });
    if (res.ok) {
      currentGoal = await res.json();
      renderGoal();
      closeModal("goalModal");
      showToast("Target berhasil diperbarui");
    }
  } catch (e) {
    showToast("Gagal menyimpan target", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Simpan Target";
  }
});

function renderAll() {
  try { populateEditorFilter(); } catch (e) {}
  try { renderDashboard(); } catch (e) {}
  try { renderEditorCards(); } catch (e) {}
  try { renderKontenFull(); } catch (e) {}
  try { renderUnmatched(); } catch (e) {}
  try { renderCodeTable(); } catch (e) {}
  try { lucide.createIcons(); } catch (e) {}
  try { updateAdminUI(); } catch (e) {}
}

// ============ INIT ============
async function loadData() {
  isLoading = true;
  showSkeletons();
  
  try {
    loadGoal(); // Load goal async
    const [editorsRes, contentRes] = await Promise.all([
      fetch('/api/editors').then(r => { if (!r.ok) throw new Error("API Error"); return r.json(); }),
      fetch('/api/content').then(r => { if (!r.ok) throw new Error("API Error"); return r.json(); }),
    ]);
    editors = Array.isArray(editorsRes) ? editorsRes : [];
    content = Array.isArray(contentRes) ? contentRes : [];
    
    // Auto-fix orphaned content (if an editor was deleted previously)
    content.forEach(c => {
      if (c.status_identifikasi === "matched" && !editorById(c.editor_id)) {
        c.status_identifikasi = "unmatched";
        c.editor_id = null;
      }
    });
    
    if (editors.length === 0) {
      showToast("Tabel editor kosong di database.", false);
    }
    
    if (content.length === 0) {
      showToast("Tabel konten kosong di database.", false);
    }
  } catch (err) {
    console.error("Gagal memuat data dari database:", err);
    showToast("Gagal terhubung ke database. Harap cek koneksi Anda.", true);
  }
  
  isLoading = false;
  hideSkeletons();
  renderAll();
  updateAdminUI();
}

// Observe theme change for chart update
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.attributeName === "data-theme" && document.getElementById("view-dashboard").classList.contains("active")) {
      renderChart();
      renderDistChart();
    }
  });
});
observer.observe(document.body, { attributes: true });

// Restore last sync time from localStorage
(function restoreLastSync() {
  const lastSync = localStorage.getItem('lastSync');
  if (lastSync) {
    const d = new Date(lastSync);
    const syncDisplay = document.getElementById("lastSyncDisplay");
    if (syncDisplay && !isNaN(d.getTime())) {
      syncDisplay.innerHTML = `<i data-lucide="clock" style="width:12px;height:12px;"></i> Sinkron: ${d.toLocaleDateString('id-ID', {day:'numeric',month:'short'})} ${d.toLocaleTimeString('id-ID', {hour:'2-digit',minute:'2-digit'})}`;
      lucide.createIcons({ root: syncDisplay });
    }
  }
})();

loadData();