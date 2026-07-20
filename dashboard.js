// ============ STATE ============
let editors = [];
let content = [];
let isLoading = true;
let kontenPage = 1;
const KONTEN_PER_PAGE = 10;
const DASHBOARD_LIMIT = 5;

let filters = { editor: "all", platform: "all", range: "30" };
let chartInstance = null;
let assignTargetId = null;

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
function platformLabel(p) { return { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook" }[p] || p; }
function platformClass(p) { return { youtube: "plat-yt", instagram: "plat-ig", facebook: "plat-fb" }[p] || ""; }
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
  return content.filter(c => {
    if (filters.editor !== "all" && String(c.editor_id) !== filters.editor) return false;
    if (filters.platform !== "all" && c.platform !== filters.platform) return false;
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
  if (viewName === "pengaturan") renderCodeTable();
  closeMobileMenu();
}

document.querySelectorAll(".nav-item").forEach(item => {
  item.addEventListener("click", () => switchView(item.dataset.view));
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
  const unmatched = data.filter(c => c.status_identifikasi === "unmatched").length;
  
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
    <div class="metric-card warn-card">
      <div class="metric-label">Belum teridentifikasi</div>
      <div class="metric-value num">${unmatched}</div>
      <div class="metric-sub">Perlu ditinjau</div>
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
  return `
    <tr class="clickable" data-content="${c.id}">
      <td data-label="Konten" class="content-title">${c.judul}</td>
      <td data-label="Platform"><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></td>
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
      views: 0,
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
          week.count++;
          break;
        }
      }
    } catch(e) {}
  });
  
  const labels = weeks.map(w => w.label);
  const chartData = weeks.map(w => w.views);
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
  const lineColor = isDark ? "#63E6BE" : "#20C997";
  const gridColor = isDark ? "#2D2D2D" : "#E9ECEF";
  const textColor = isDark ? "#A0A0A0" : "#6C757D";

  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, isDark ? "rgba(99, 230, 190, 0.4)" : "rgba(32, 201, 151, 0.4)");
  gradient.addColorStop(1, isDark ? "rgba(99, 230, 190, 0.0)" : "rgba(32, 201, 151, 0.0)");

  chartInstance = new Chart(ctx, {
    type: "line",
    data: { 
      labels, 
      datasets: [{ 
        label: "Views",
        data: chartData, 
        borderColor: lineColor,
        backgroundColor: gradient,
        borderWidth: 3,
        pointBackgroundColor: lineColor,
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
              return `${ctx.formattedValue} views (${weeks[i].count} konten)`;
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

function renderDashboard() {
  renderMetrics(); renderLeaderboard(); renderTable(); renderChart();
  renderDistChart(); renderKeywords();
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

// ============ CHART: Distribution Chart (Doughnut) ============
let distChartInstance = null;
function renderDistChart() {
  const ctx = document.getElementById("distChart");
  if (!ctx) return;
  if (typeof Chart === "undefined") return;
  
  if (distChartInstance) distChartInstance.destroy();
  
  const data = filteredContent();
  
  // Aggregate count by editor
  const stats = editors.map(e => {
    const count = data.filter(c => c.editor_id === e.id).length;
    return { name: e.nama, count };
  }).filter(s => s.count > 0).sort((a, b) => b.count - a.count);
  
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
  
  const isDark = document.body.getAttribute("data-theme") === "dark";
  const textColor = isDark ? "#A0A0A0" : "#6C757D";
  
  // Vibrant UI colors for Doughnut
  const colors = ["#20C997", "#339AF0", "#FF922B", "#F06595", "#845EF7", "#FCC419", "#20C997"];
  
  distChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: { 
      labels: stats.map(s => s.name),
      datasets: [{
        data: stats.map(s => s.count),
        backgroundColor: colors.slice(0, stats.length),
        borderWidth: isDark ? 2 : 2,
        borderColor: isDark ? "#12181A" : "#FFFFFF"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: textColor, font: { family: "Inter", size: 12 }, padding: 16 }
        },
        tooltip: {
          backgroundColor: isDark ? "#2D2D2D" : "#12181A",
          titleFont: { family: "Inter", size: 12, weight: "600" },
          bodyFont: { family: "JetBrains Mono", size: 12 },
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: function(ctx) {
              const value = ctx.raw;
              const total = ctx.dataset.data.reduce((a,b) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return ` ${value} konten (${percentage}%)`;
            }
          }
        }
      }
    }
  });
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
          <button class="btn btn-sm btn-danger" data-remove-editor="${e.id}">Hapus</button>
        </div>
      </div>`;
  }).join("") || '<div class="empty-note">Belum ada data editor.</div>';
  
  document.querySelectorAll("[data-view-editor]").forEach(b => b.addEventListener("click", () => openEditorModal(Number(b.dataset.viewEditor))));
  document.querySelectorAll("[data-remove-editor]").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.dataset.removeEditor);
    const e = editorById(id);
    if (!confirm(`Hapus editor ${e.nama}? Konten miliknya akan berpindah ke status belum teridentifikasi.`)) return;
    
    b.disabled = true;
    const originalText = b.textContent;
    b.textContent = "Menghapus...";
    try {
      await fetch(`/api/editors/${id}`, { method: 'DELETE' });
      content.forEach(c => { if (c.editor_id === id) { c.editor_id = null; c.status_identifikasi = "unmatched"; } });
      editors = editors.filter(x => x.id !== id);
      showToast(`Editor ${e.nama} dihapus`);
      renderAll();
    } catch (err) {
      showToast("Gagal menghapus editor", true);
    } finally {
      b.disabled = false;
      b.textContent = originalText;
    }
  }));
}

// ============ RENDER: KONTEN PAGE (with Pagination) ============
function renderKontenFull() {
  const q = (document.getElementById("searchKonten")?.value || "").trim().toLowerCase();
  const platform = document.getElementById("kontenFilterPlatform")?.value || "all";
  const editor = document.getElementById("kontenFilterEditor")?.value || "all";
  const status = document.getElementById("kontenFilterStatus")?.value || "all";

  const allRows = content.filter(c => {
    if (q && !c.judul.toLowerCase().includes(q)) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    if (editor !== "all" && String(c.editor_id) !== editor) return false;
    if (status !== "all" && status === "matched" && c.status_identifikasi !== "matched") return false;
    if (status !== "all" && status === "unmatched" && c.status_identifikasi !== "unmatched") return false;
    return true;
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

["searchKonten", "kontenFilterPlatform", "kontenFilterEditor", "kontenFilterStatus"].forEach(id => {
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
  document.getElementById("unmatchedTable").innerHTML = rows.map(c => `
    <tr>
      <td data-label="Konten" class="content-title">${c.judul}</td>
      <td data-label="Platform"><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></td>
      <td data-label="Views" class="num-cell">${fmt(c.views)}</td>
      <td data-label="Aksi"><button class="btn btn-sm btn-primary" data-assign="${c.id}">Tandai editor</button></td>
    </tr>
  `).join("");
  document.getElementById("unmatchedEmpty").style.display = rows.length ? "none" : "block";
  
  document.querySelectorAll("[data-assign]").forEach(b => b.addEventListener("click", () => {
    assignTargetId = Number(b.dataset.assign);
    document.getElementById("assignEditorSelect").innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
    openModal("assignModal");
  }));
}

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
      <td data-label="Kode"><span class="code-tag" contenteditable="true" data-code-for="${e.id}">${e.kode_identifikasi || e.kode}</span></td>
      <td data-label="Status"><span class="status-pill status-ok">Aktif</span></td>
      <td data-label=""><button class="btn btn-sm" data-save-code="${e.id}">Simpan</button></td>
    </tr>
  `).join("");
  
  document.querySelectorAll("[data-save-code]").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.dataset.saveCode);
    const span = document.querySelector(`[data-code-for="${id}"]`);
    const newCode = span.textContent.trim();
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
document.getElementById("saveSyncBtn").addEventListener("click", () => showToast("Pengaturan sinkronisasi disimpan"));

// ============ MODALS ============
function openContentModal(id) {
  const c = content.find(x => x.id === id);
  const editor = editorById(c.editor_id);
  const views = c.views || 0;
  const likes = c.likes || 0;
  const comments = c.comments || c.komentar || 0;
  
  const formattedUpload = formatDate(c.tanggal_upload);
  
  document.getElementById("contentModalBody").innerHTML = `
    <div class="detail-row"><span class="detail-label">Judul</span><span>${c.judul}</span></div>
    <div class="detail-row"><span class="detail-label">Platform</span><span class="plat ${platformClass(c.platform)}">${platformLabel(c.platform)}</span></div>
    <div class="detail-row"><span class="detail-label">Editor</span><span>${editor ? editor.nama : "Belum teridentifikasi"}</span></div>
    <div class="detail-row"><span class="detail-label">Waktu upload</span><span>${formattedUpload}</span></div>
    <div class="detail-row"><span class="detail-label">Views</span><span class="num">${views.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Likes</span><span class="num">${likes.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Komentar</span><span class="num">${comments.toLocaleString('id-ID')}</span></div>
    <div class="detail-row"><span class="detail-label">Tautan</span><span><a href="${c.url}" target="_blank" rel="noopener">Buka postingan ↗</a></span></div>
    ${!editor ? `<div class="modal-actions"><button class="btn btn-primary btn-sm" id="modalAssignBtn">Tandai editor</button></div>` : ""}
  `;
  const assignBtn = document.getElementById("modalAssignBtn");
  if (assignBtn) assignBtn.addEventListener("click", () => {
    closeModal("contentModal");
    assignTargetId = c.id;
    document.getElementById("assignEditorSelect").innerHTML = editors.map(e => `<option value="${e.id}">${e.nama}</option>`).join("");
    openModal("assignModal");
  });
  openModal("contentModal");
}

function openEditorModal(id) {
  const e = editorById(id);
  const items = content.filter(c => c.editor_id === id);
  const views = items.reduce((s, c) => s + (c.views || 0), 0);
  document.getElementById("editorModalName").textContent = e.nama;
  document.getElementById("editorModalBody").innerHTML = `
    <div class="detail-row"><span class="detail-label">Kode identifikasi</span><span class="code-tag">${e.kode_identifikasi || e.kode}</span></div>
    <div class="detail-row"><span class="detail-label">Total konten</span><span class="num">${items.length}</span></div>
    <div class="detail-row"><span class="detail-label">Total views</span><span class="num">${fmt(views)}</span></div>
    <div style="margin-top:20px;font-size:12.5px;color:var(--muted);margin-bottom:12px;font-weight:600;">Konten terbaru</div>
    ${items.slice(0, 5).map(c => `<div class="detail-row"><span>${c.judul}</span><span class="num">${fmt(c.views)}</span></div>`).join("") || '<div class="empty-note">Belum ada konten.</div>'}
  `;
  openModal("editorModal");
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

  const allRows = content.filter(c => {
    if (q && !c.judul.toLowerCase().includes(q)) return false;
    if (platform !== "all" && c.platform !== platform) return false;
    if (editor !== "all" && String(c.editor_id) !== editor) return false;
    if (status !== "all" && status === "matched" && c.status_identifikasi !== "matched") return false;
    if (status !== "all" && status === "unmatched" && c.status_identifikasi !== "unmatched") return false;
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
    if (!res.ok) throw new Error("Gagal sinkronisasi");
    await loadData();
    showToast("Sinkronisasi selesai");
  } catch (err) {
    showToast("Gagal terhubung ke backend", true);
  } finally {
    btn.innerHTML = `<span class="btn-text">Sinkronkan sekarang</span>`;
    btn.disabled = false;
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
}

// ============ INIT ============
async function loadData() {
  isLoading = true;
  showSkeletons();
  
  try {
    const [editorsRes, contentRes] = await Promise.all([
      fetch('/api/editors').then(r => { if (!r.ok) throw new Error("API Error"); return r.json(); }),
      fetch('/api/content').then(r => { if (!r.ok) throw new Error("API Error"); return r.json(); }),
    ]);
    editors = Array.isArray(editorsRes) ? editorsRes : [];
    content = Array.isArray(contentRes) ? contentRes : [];
    
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

loadData();