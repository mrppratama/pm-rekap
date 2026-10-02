const DEFAULT_PRODUCTS = [
  { id: "fc", name: "Fried Chicken", price: 10000, unit: "pcs", stockType: "fc" },
  { id: "geprek", name: "Ayam Geprek", price: 13000, unit: "pcs", stockType: "fc" },
  { id: "nasi", name: "Nasi", price: 3000, unit: "porsi", stockType: "nasi" },
];

let currentProducts = (function () {
  try {
    const saved = localStorage.getItem("pm_products");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (_) {}
  return [...DEFAULT_PRODUCTS];
})();

const HARGA = new Proxy(
  {},
  {
    get: (target, prop) => {
      const p = currentProducts.find((x) => x.id === prop);
      if (p) return p.price || 0;
      if (prop === "fc") return 10000;
      if (prop === "geprek") return 13000;
      if (prop === "nasi") return 3000;
      return 0;
    },
  },
);

let currentAppRole = "guest";
let db; // Reference ke Firebase Database
let firebaseReady = false;
let firebaseDataLoaded = false;
let editingId = null;
let editingTimestamp = null;
let timeInterval;
let salesChartInstance = null;
let allReportsGlobal = [];

// --- PAGINATION & FILTER CONFIGURATION ---
const ITEMS_PER_PAGE = 10;
let kasirCurrentPage = 1;
let adminCurrentPage = 1;

let kasirFilterState = {
  type: "all",
  startDate: "",
  endDate: "",
};

let adminFilterState = {
  type: "7days",
  startDate: "",
  endDate: "",
};

// ==========================================
// --- CUSTOM UI DIALOG SYSTEM ---
// (Menggantikan alert() dan confirm() browser)
// ==========================================
const customDialogModal = document.getElementById("customDialogModal");
const dialogIconWrapper = document.getElementById("dialogIconWrapper");
const dialogIcon = document.getElementById("dialogIcon");
const dialogTitle = document.getElementById("dialogTitle");
const dialogMessage = document.getElementById("dialogMessage");
const dialogActions = document.getElementById("dialogActions");

let dialogResolve = null;

const customAlert = (message, title = "Informasi", type = "info") => {
  return new Promise((resolve) => {
    dialogResolve = resolve;

    // Reset & apply classes
    dialogIconWrapper.className = `dialog-icon-wrapper ${type}`;
    if (type === "success") {
      dialogIcon.className = "fas fa-check-circle";
    } else if (type === "error" || type === "danger") {
      dialogIcon.className = "fas fa-times-circle";
    } else if (type === "warning") {
      dialogIcon.className = "fas fa-exclamation-triangle";
    } else {
      dialogIcon.className = "fas fa-info-circle";
    }

    dialogTitle.textContent = title;
    dialogMessage.textContent = message;

    const btnClass =
      type === "error" || type === "danger"
        ? "btn-primary"
        : type === "warning"
          ? "btn-yellow"
          : type === "success"
            ? "btn-green"
            : "btn-primary";

    dialogActions.innerHTML = `
      <button type="button" class="btn ${btnClass} btn-full" id="btnDialogOk">
        <i class="fas fa-check"></i> Mengerti
      </button>
    `;

    const handleOk = () => {
      customDialogModal.classList.add("hidden");
      customDialogModal.style.display = "none";
      if (dialogResolve) {
        const r = dialogResolve;
        dialogResolve = null;
        r(true);
      }
    };

    document.getElementById("btnDialogOk").onclick = handleOk;
    customDialogModal.classList.remove("hidden");
    customDialogModal.style.display = "flex";
  });
};

const customConfirm = (
  message,
  title = "Konfirmasi",
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  type = "warning",
  customIcon = null,
) => {
  return new Promise((resolve) => {
    dialogResolve = resolve;

    dialogIconWrapper.className = `dialog-icon-wrapper ${type}`;
    if (customIcon) {
      dialogIcon.className = customIcon;
    } else if (type === "logout") {
      dialogIcon.className = "fa-solid fa-arrow-right-from-bracket";
    } else if (type === "danger" || type === "error") {
      dialogIcon.className = "fas fa-trash-alt";
    } else if (type === "warning") {
      dialogIcon.className = "fas fa-question-circle";
    } else {
      dialogIcon.className = "fas fa-info-circle";
    }

    dialogTitle.textContent = title;
    dialogMessage.textContent = message;

    const confirmBtnClass =
      type === "danger" || type === "error" || type === "logout" ? "btn-danger" : "btn-primary";

    dialogActions.innerHTML = `
      <button type="button" class="btn btn-outline" id="btnDialogCancel">
        ${cancelText}
      </button>
      <button type="button" class="btn ${confirmBtnClass}" id="btnDialogConfirm">
        ${confirmText}
      </button>
    `;

    const handleCancel = () => {
      customDialogModal.classList.add("hidden");
      customDialogModal.style.display = "none";
      if (dialogResolve) {
        const r = dialogResolve;
        dialogResolve = null;
        r(false);
      }
    };

    const handleConfirm = () => {
      customDialogModal.classList.add("hidden");
      customDialogModal.style.display = "none";
      if (dialogResolve) {
        const r = dialogResolve;
        dialogResolve = null;
        r(true);
      }
    };

    document.getElementById("btnDialogCancel").onclick = handleCancel;
    document.getElementById("btnDialogConfirm").onclick = handleConfirm;

    customDialogModal.classList.remove("hidden");
    customDialogModal.style.display = "flex";
  });
};

// --- 1. INISIALISASI DATABASE FIREBASE ---
const initializeDatabase = () => {
  const checkFirebase = setInterval(() => {
    if (typeof firebaseDb !== "undefined" && firebaseDb !== null) {
      clearInterval(checkFirebase);
      db = firebaseDb;
      firebaseReady = true;
      console.log("✅ Database Firebase siap digunakan");
      setupRealtimeListener();
      setupProductsRealtimeListener();
    } else {
      console.warn("⚠️ Firebase tidak tersedia, menggunakan localStorage");
      useLocalStorage();
    }
  }, 100);

  setTimeout(() => {
    if (!firebaseReady) {
      clearInterval(checkFirebase);
      console.warn("⚠️ Firebase tidak responsif, fallback ke localStorage");
      useLocalStorage();
    }
  }, 5000);
};

const useLocalStorage = () => {
  window.isUsingLocalStorage = true;
  const records = JSON.parse(localStorage.getItem("pmReports") || "[]");
  allReportsGlobal = records;
  try {
    const savedProd = localStorage.getItem("pm_products");
    if (savedProd) {
      const parsed = JSON.parse(savedProd);
      if (Array.isArray(parsed) && parsed.length > 0) currentProducts = parsed;
    }
  } catch (_) {}
  renderKasirSalesList();
  renderAdminProductGrid();
  firebaseDataLoaded = true;
  console.log("✅ LocalStorage loaded:", allReportsGlobal.length, "records");
  onDataChanged();
};

// --- NOTIFICATION & CHIME AUDIO SYSTEM ---
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.setValueAtTime(880, now + 0.09); // A5

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (_) {}
}

async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (_) {}
  }
}

// --- NOTIFICATION CENTER SYSTEM ---
const getNotificationHistory = () => {
  try {
    return JSON.parse(localStorage.getItem("pm_notifications") || "[]");
  } catch (_) {
    return [];
  }
};

const saveNotificationHistory = (list) => {
  try {
    localStorage.setItem("pm_notifications", JSON.stringify(list.slice(0, 40)));
  } catch (_) {}
};

function addNotificationHistory(title, message, type = "system", reportId = null) {
  const list = getNotificationHistory();
  const now = new Date();
  const timeStr =
    now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) +
    " • " +
    now.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

  const newItem = {
    id: "notif_" + Date.now().toString() + "_" + Math.floor(Math.random() * 1000),
    title,
    message,
    type, // 'report-in', 'report-out', 'system'
    time: timeStr,
    unread: true,
    reportId: reportId ? String(reportId) : null,
  };

  list.unshift(newItem);
  saveNotificationHistory(list);
  updateNotificationBadges();
}

function updateNotificationBadges() {
  const list = getNotificationHistory();
  const unreadCount = list.filter((n) => n.unread).length;

  const notifDropdownBadge = document.getElementById("notifDropdownBadge");
  const headerNotifDot = document.getElementById("headerNotifDot");

  if (notifDropdownBadge) {
    if (unreadCount > 0) {
      notifDropdownBadge.textContent = unreadCount > 9 ? "9+" : unreadCount;
      notifDropdownBadge.classList.remove("hidden");
    } else {
      notifDropdownBadge.classList.add("hidden");
    }
  }

  if (headerNotifDot) {
    if (unreadCount > 0) {
      headerNotifDot.classList.remove("hidden");
    } else {
      headerNotifDot.classList.add("hidden");
    }
  }
}

function renderNotificationList() {
  const container = document.getElementById("notifListContainer");
  if (!container) return;

  const list = getNotificationHistory();

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="notif-empty-state">
        <i class="fa-regular fa-bell-slash"></i>
        <p>Belum ada notifikasi baru</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list
    .map((item) => {
      const iconClass =
        item.type === "report-in"
          ? "fa-solid fa-file-invoice-dollar"
          : item.type === "report-out"
            ? "fa-solid fa-paper-plane"
            : "fa-solid fa-bell";

      const iconType = item.type || "system";
      const hasReport = item.type === "report-in" || item.type === "report-out" || item.reportId;
      const safeReportId = item.reportId || "";

      const actionBtn = hasReport
        ? `<button type="button" class="btn-notif-detail" onclick="openNotificationDetail('${item.id}', '${safeReportId}', event)">
             <i class="fa-solid fa-file-lines"></i> Lihat Rincian Laporan
           </button>`
        : "";

      return `
        <div class="notif-item ${item.unread ? "unread" : ""}" onclick="openNotificationDetail('${item.id}', '${safeReportId}', event)">
          <div class="notif-item-icon ${iconType}">
            <i class="${iconClass}"></i>
          </div>
          <div class="notif-item-content">
            <div class="notif-item-title">
              <span>${item.title}</span>
              ${item.unread ? '<span class="notif-unread-dot" title="Belum dibaca"></span>' : ""}
            </div>
            <p class="notif-item-desc">${item.message}</p>
            <div class="notif-item-footer">
              <span class="notif-item-time"><i class="fa-regular fa-clock"></i> ${item.time}</span>
              ${actionBtn}
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

window.showNotificationCenterModal = (e) => {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.preventDefault === "function") e.preventDefault();
  }
  const wrapper = document.getElementById("userAccountWrapper");
  if (wrapper) wrapper.classList.remove("open");

  renderNotificationList();

  const modal = document.getElementById("notifCenterModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
};

window.markAllNotificationsAsRead = () => {
  const list = getNotificationHistory();
  list.forEach((n) => (n.unread = false));
  saveNotificationHistory(list);
  updateNotificationBadges();
  renderNotificationList();
  showToast("Semua notifikasi ditandai dibaca");
};

let currentViewedReportId = null;

window.openNotificationDetail = (notifId, reportId, e) => {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.preventDefault === "function") e.preventDefault();
  }

  // Tandai dibaca & hapus dari list unread
  if (notifId) {
    let list = getNotificationHistory();
    list = list.filter((n) => n.id !== notifId);
    saveNotificationHistory(list);
    updateNotificationBadges();
    renderNotificationList();
  }

  // Tutup modal notifikasi jika terbuka
  closeModal("notifCenterModal");

  if (!reportId) {
    showToast("ID Laporan tidak tersedia");
    return;
  }

  let report = allReportsGlobal.find((r) => (r.id || r.timestamp?.toString()) === String(reportId));
  if (!report) {
    const fallbackReports = JSON.parse(localStorage.getItem("pmReports") || "[]");
    report = fallbackReports.find((r) => (r.id || r.timestamp?.toString()) === String(reportId));
  }

  if (!report) {
    customAlert("Data laporan tidak ditemukan atau telah dihapus.", "Laporan Tidak Ditemukan", "warning");
    return;
  }

  displayReportDetailModal(report);
};

window.displayReportDetailModal = (item) => {
  currentViewedReportId = item.id || item.timestamp?.toString();
  const modal = document.getElementById("reportDetailModal");
  const modalTitle = document.getElementById("reportModalTitle");
  const modalBody = document.getElementById("reportDetailModalBody");

  if (modalTitle) {
    modalTitle.innerHTML = `
      <span>Rincian Laporan: <strong style="color: var(--primary);">${item.kasir || "Kasir"}</strong></span>
      <span class="badge-time-modal"><i class="fa-regular fa-calendar-check"></i> ${item.hari || ""}, ${item.tanggal || ""} &bull; ${item.jam || ""}</span>
    `;
  }

  if (modalBody) {
    const activeRole = currentAppRole || localStorage.getItem("pm_logged_role") || "kasir";
    modalBody.innerHTML = generateDetailTableHTML(item, activeRole.startsWith("admin"));
    const subCloseBtn = modalBody.querySelector(".detail-header-bar");
    if (subCloseBtn) subCloseBtn.style.display = "none";
  }

  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
};

window.jumpToReportInTable = () => {
  closeModal("reportDetailModal");
  const reportId = currentViewedReportId;
  if (!reportId) return;

  const currentRole = currentAppRole || localStorage.getItem("pm_logged_role") || "kasir";

  if (currentRole.startsWith("admin")) {
    switchView("admin");
    adminFilterState.type = "all";
    adminFilterState.startDate = "";
    adminFilterState.endDate = "";
    const adminUnifiedFilter = document.getElementById("adminUnifiedFilter");
    if (adminUnifiedFilter) adminUnifiedFilter.value = "all";
    document.getElementById("adminUnifiedCustomDates")?.classList.add("hidden");

    let sorted = [...allReportsGlobal].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let idx = sorted.findIndex((r) => (r.id || r.timestamp?.toString()) === reportId);
    if (idx !== -1) {
      adminCurrentPage = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    }
    renderAdminDashboard();

    setTimeout(() => {
      const row = document.getElementById(`admin-detail-${reportId}`);
      const content = document.getElementById(`admin-content-${reportId}`);
      if (row && content) {
        const item = allReportsGlobal.find((r) => (r.id || r.timestamp?.toString()) === reportId);
        if (item) {
          content.innerHTML = generateDetailTableHTML(item, true);
          row.classList.remove("hidden");
        }
      }
      const rowEl = document.getElementById(`admin-row-${reportId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
        rowEl.classList.add("highlight-row");
        setTimeout(() => rowEl.classList.remove("highlight-row"), 2500);
      }
    }, 150);
  } else {
    // Kasir
    switchView("kasir");
    document.getElementById("view-kasir")?.classList.add("hidden");
    document.getElementById("view-kasir-history")?.classList.remove("hidden");
    kasirFilterState.type = "all";
    kasirFilterState.startDate = "";
    kasirFilterState.endDate = "";
    const kasirFilterRange = document.getElementById("kasirFilterRange");
    if (kasirFilterRange) kasirFilterRange.value = "all";
    document.getElementById("kasirCustomDateWrap")?.classList.add("hidden");

    let sorted = [...allReportsGlobal].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let idx = sorted.findIndex((r) => (r.id || r.timestamp?.toString()) === reportId);
    if (idx !== -1) {
      kasirCurrentPage = Math.floor(idx / ITEMS_PER_PAGE) + 1;
    }
    loadKasirHistory();

    setTimeout(() => {
      const row = document.getElementById(`kasir-detail-${reportId}`);
      const content = document.getElementById(`content-detail-${reportId}`);
      if (row && content) {
        const item = allReportsGlobal.find((r) => (r.id || r.timestamp?.toString()) === reportId);
        if (item) {
          content.innerHTML = generateDetailTableHTML(item, false);
          row.classList.remove("hidden");
        }
      }
      const rowEl = document.getElementById(`kasir-row-${reportId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "center" });
        rowEl.classList.add("highlight-row");
        setTimeout(() => rowEl.classList.remove("highlight-row"), 2500);
      }
    }, 150);
  }
};

window.clearAllNotifications = () => {
  saveNotificationHistory([]);
  updateNotificationBadges();
  renderNotificationList();
  showToast("Notifikasi telah dibersihkan");
};

async function sendNativeNotification(title, body, tag = "pm-rekap", type = "system", reportId = null) {
  playNotificationSound();
  addNotificationHistory(title, body, type, reportId);
  showToast(title, reportId, body);

  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return;
    } catch (_) {
      return;
    }
  }

  if (Notification.permission === "granted") {
    const iconUrl = new URL("icon-192.png", window.location.href).href;
    const badgeUrl = new URL("favicon-32.png", window.location.href).href;

    let shownDirect = false;
    try {
      const n = new Notification(title, {
        body: body,
        icon: iconUrl,
        badge: badgeUrl,
        tag: tag + "_" + Date.now(),
        requireInteraction: false,
        data: { reportId: reportId },
      });
      n.onclick = function () {
        window.focus();
        this.close();
        if (reportId) {
          openNotificationDetail(null, reportId);
        }
      };
      shownDirect = true;
    } catch (e) {
      shownDirect = false;
    }

    if (!shownDirect && "serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg && typeof reg.showNotification === "function") {
          reg.showNotification(title, {
            body: body,
            icon: iconUrl,
            badge: badgeUrl,
            tag: tag + "_" + Date.now(),
            data: { reportId: reportId },
          });
        }
      });
    }
  }
}

// Listen to notification clicks received from Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data && event.data.type === "OPEN_REPORT_DETAIL" && event.data.reportId) {
      openNotificationDetail(null, event.data.reportId);
    }
  });
}

let knownReportTimestamps = new Map();
let isInitialRealtimeLoad = true;

const setupRealtimeListener = () => {
  if (!db) return;

  const reportsRef = db.ref("reports");
  reportsRef.on(
    "value",
    (snapshot) => {
      const data = snapshot.val();
      const currentList = [];

      if (data) {
        Object.keys(data).forEach((key) => {
          const report = { id: key, ...data[key] };
          currentList.push(report);

          // Trigger notification for Owner when a new report arrives or an existing report is updated
          if (!isInitialRealtimeLoad) {
            const activeRole = currentAppRole || localStorage.getItem("pm_logged_role") || "";
            if (activeRole.startsWith("admin")) {
              if (!knownReportTimestamps.has(key)) {
                // New Report
                sendNativeNotification(
                  "🍗 Laporan Kasir Baru Masuk!",
                  `Kasir ${report.kasir || "Shift"} mengirim laporan baru (${report.tanggal || "Hari ini"}) • Saldo Bersih: Rp ${formatNumber(report.saldoAkhir || 0)}`,
                  "admin-report-received",
                  "report-in",
                  key,
                );
              } else if (knownReportTimestamps.get(key) !== report.timestamp) {
                // Report Updated / Edited
                sendNativeNotification(
                  "✏️ Laporan Kasir Diperbarui!",
                  `Kasir ${report.kasir || "Shift"} memperbarui laporan (${report.tanggal || "Hari ini"}) • Saldo Bersih: Rp ${formatNumber(report.saldoAkhir || 0)}`,
                  "admin-report-updated",
                  "report-in",
                  key,
                );
              }
            }
          }
        });
      }

      allReportsGlobal = currentList;
      knownReportTimestamps = new Map(allReportsGlobal.map((r) => [r.id, r.timestamp]));
      isInitialRealtimeLoad = false;
      firebaseDataLoaded = true;

      console.log(
        "✅ Data realtime tersinkronisasi",
        allReportsGlobal.length,
        "records",
      );

      onDataChanged();
    },
    (error) => {
      console.error("❌ Error membaca data Firebase:", error);
    },
  );
};

// --- REALTIME LISTENER & MANAGEMENT MENU PRODUK & HARGA ---
const setupProductsRealtimeListener = () => {
  if (!db) {
    renderKasirSalesList();
    renderAdminProductGrid();
    return;
  }

  const prodRef = db.ref("products");
  prodRef.on(
    "value",
    (snapshot) => {
      const val = snapshot.val();
      if (val) {
        if (Array.isArray(val)) {
          currentProducts = val.filter(Boolean);
        } else {
          currentProducts = Object.keys(val).map((k) => ({
            id: k,
            ...val[k],
          }));
        }
        localStorage.setItem("pm_products", JSON.stringify(currentProducts));
      } else {
        currentProducts = [...DEFAULT_PRODUCTS];
        try {
          const seedObj = {};
          DEFAULT_PRODUCTS.forEach((p) => {
            seedObj[p.id] = {
              name: p.name,
              price: p.price,
              unit: p.unit,
              stockType: p.stockType,
            };
          });
          prodRef.set(seedObj);
        } catch (_) {}
        localStorage.setItem("pm_products", JSON.stringify(currentProducts));
      }
      renderKasirSalesList();
      renderAdminProductGrid();
      calculateAll();
    },
    (error) => {
      console.error("❌ Error membaca data produk Firebase:", error);
      renderKasirSalesList();
      renderAdminProductGrid();
    },
  );
};

const renderKasirSalesList = () => {
  const container = document.getElementById("salesList");
  if (!container) return;

  const currentValues = {};
  container.querySelectorAll(".product-sales-qty").forEach((input) => {
    const pid =
      input.dataset.productId ||
      input.id.replace("jual_", "").replace("jual", "").toLowerCase();
    if (pid) currentValues[pid] = input.value;
  });

  let html = "";
  currentProducts.forEach((p) => {
    const val = currentValues[p.id] !== undefined ? currentValues[p.id] : "0";
    const subtotal = (parseInt(val) || 0) * (p.price || 0);
    const stockBadge =
      p.stockType === "fc"
        ? '<span class="prod-badge-stock fc"><i class="fa-solid fa-drumstick-bite"></i> Stok Ayam</span>'
        : p.stockType === "nasi"
          ? '<span class="prod-badge-stock nasi"><i class="fa-solid fa-bowl-rice"></i> Stok Nasi</span>'
          : '<span class="prod-badge-stock free"><i class="fa-solid fa-sparkles"></i> Bebas</span>';

    const inputId =
      p.id === "fc"
        ? "jualFc"
        : p.id === "geprek"
          ? "jualGeprek"
          : p.id === "nasi"
            ? "jualNasi"
            : `jual_${p.id}`;
    const subId =
      p.id === "fc"
        ? "subFc"
        : p.id === "geprek"
          ? "subGeprek"
          : p.id === "nasi"
            ? "subNasi"
            : `sub_${p.id}`;

    html += `
      <div class="sales-item" data-product-id="${p.id}">
        <div class="sales-info">
          <div class="sales-info-top">
            <strong>${p.name}</strong>
            ${stockBadge}
          </div>
          <span class="price-tag">@ Rp${formatNumber(p.price)} / ${p.unit || "pcs"}</span>
        </div>
        <div class="sales-controls">
          <div class="qty-control">
            <button type="button" class="btn-qty minus">
              <i class="fas fa-minus"></i>
            </button>
            <input
              type="number"
              id="${inputId}"
              data-product-id="${p.id}"
              class="calc-input product-sales-qty"
              value="${val}"
              required
            />
            <button type="button" class="btn-qty plus">
              <i class="fas fa-plus"></i>
            </button>
          </div>
          <div class="sales-subtotal" id="${subId}">Rp${formatNumber(subtotal)}</div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  setupQtyControls();

  container.querySelectorAll(".calc-input").forEach((input) => {
    input.addEventListener("input", validateNumberInput);
  });
};

const renderAdminProductGrid = () => {
  const container = document.getElementById("productGridContainer");
  const countBadge = document.getElementById("productCountBadge");
  if (countBadge) countBadge.textContent = `${currentProducts.length} Menu Produk`;
  if (!container) return;

  let html = "";
  currentProducts.forEach((p) => {
    const stockText =
      p.stockType === "fc"
        ? '<span class="prod-chip fc"><i class="fa-solid fa-drumstick-bite"></i> Potong Stok Ayam</span>'
        : p.stockType === "nasi"
          ? '<span class="prod-chip nasi"><i class="fa-solid fa-bowl-rice"></i> Potong Stok Nasi</span>'
          : '<span class="prod-chip none"><i class="fa-solid fa-sparkles"></i> Bebas (Non-Stok)</span>';

    html += `
      <div class="product-card-item">
        <div class="prod-card-header">
          <div class="prod-card-name-wrap">
            <h4 class="prod-card-title">${p.name}</h4>
            ${stockText}
          </div>
        </div>
        <div class="prod-card-body">
          <div class="prod-card-price">
            <span class="currency-label">Rp</span>
            <span class="price-val">${formatNumber(p.price)}</span>
            <span class="unit-val">/ ${p.unit || "pcs"}</span>
          </div>
        </div>
        <div class="prod-card-footer">
          <button type="button" class="btn btn-small btn-edit-product btn-full" onclick="openEditProductModal('${p.id}')">
            <i class="fa-solid fa-pen-to-square"></i> Edit Menu &amp; Harga
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
};

window.openAddProductModal = () => {
  document.getElementById("prodEditId").value = "";
  document.getElementById("productModalTitle").textContent = "Tambah Menu Baru";
  document.getElementById("productModalIcon").className = "fa-solid fa-utensils text-primary";
  document.getElementById("prodName").value = "";
  document.getElementById("prodPrice").value = "";
  document.getElementById("prodUnit").value = "pcs";
  document.getElementById("prodStockType").value = "fc";
  document.getElementById("btnDeleteProduct").classList.add("hidden");
  document.getElementById("btnDeleteProduct").style.display = "none";
  document.getElementById("btnSaveProduct").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Menu';

  const modal = document.getElementById("productModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
  setTimeout(() => document.getElementById("prodName")?.focus(), 100);
};

window.openEditProductModal = (id) => {
  const product = currentProducts.find((p) => p.id === id);
  if (!product) return;

  document.getElementById("prodEditId").value = product.id;
  document.getElementById("productModalTitle").textContent = `Edit Menu: ${product.name}`;
  document.getElementById("productModalIcon").className = "fa-solid fa-pen-to-square text-primary";
  document.getElementById("prodName").value = product.name || "";
  document.getElementById("prodPrice").value = product.price || 0;
  document.getElementById("prodUnit").value = product.unit || "pcs";
  document.getElementById("prodStockType").value = product.stockType || "none";

  const btnDelete = document.getElementById("btnDeleteProduct");
  btnDelete.classList.remove("hidden");
  btnDelete.style.display = "";

  document.getElementById("btnSaveProduct").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Menu';

  const modal = document.getElementById("productModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
};

window.handleSaveProduct = async (e) => {
  if (e) e.preventDefault();
  const editId = document.getElementById("prodEditId").value.trim();
  const name = document.getElementById("prodName").value.trim();
  const price = parseInt(document.getElementById("prodPrice").value) || 0;
  const unit = document.getElementById("prodUnit").value.trim() || "pcs";
  const stockType = document.getElementById("prodStockType").value || "none";

  if (!name) {
    await customAlert("Mohon masukkan nama produk/menu.", "Nama Kosong", "warning");
    return;
  }
  if (price < 0) {
    await customAlert("Harga produk tidak boleh bernilai negatif.", "Harga Tidak Valid", "warning");
    return;
  }

  const pid = editId || "prod_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const updatedProduct = {
    id: pid,
    name,
    price,
    unit,
    stockType,
  };

  if (firebaseReady && db) {
    try {
      await db.ref(`products/${pid}`).set({
        name: updatedProduct.name,
        price: updatedProduct.price,
        unit: updatedProduct.unit,
        stockType: updatedProduct.stockType,
      });
      showToast(`✅ Menu "${name}" berhasil disimpan!`);
    } catch (err) {
      await customAlert("Gagal menyimpan ke Firebase: " + err.message, "Gagal Simpan", "error");
      return;
    }
  } else {
    const idx = currentProducts.findIndex((p) => p.id === pid);
    if (idx !== -1) {
      currentProducts[idx] = updatedProduct;
    } else {
      currentProducts.push(updatedProduct);
    }
    localStorage.setItem("pm_products", JSON.stringify(currentProducts));
    renderKasirSalesList();
    renderAdminProductGrid();
    calculateAll();
    showToast(`✅ Menu "${name}" berhasil disimpan (Lokal)!`);
  }

  closeModal("productModal");
};

window.handleDeleteProduct = async () => {
  const editId = document.getElementById("prodEditId").value.trim();
  if (!editId) return;

  const product = currentProducts.find((p) => p.id === editId);
  const prodName = product?.name || "menu ini";

  // Tutup form modal edit produk terlebih dahulu agar tidak bertumpuk dengan dialog konfirmasi
  closeModal("productModal");

  const confirmed = await customConfirm(
    `Apakah Anda yakin ingin menghapus menu "${prodName}" dari sistem?`,
    "Hapus Menu Produk",
    "Ya, Hapus Menu",
    "Batal",
    "danger",
  );

  if (confirmed) {
    if (firebaseReady && db) {
      try {
        await db.ref(`products/${editId}`).remove();
        showToast(`Menu "${prodName}" berhasil dihapus`);
      } catch (err) {
        await customAlert("Gagal menghapus produk: " + err.message, "Gagal Hapus", "error");
        return;
      }
    } else {
      currentProducts = currentProducts.filter((p) => p.id !== editId);
      localStorage.setItem("pm_products", JSON.stringify(currentProducts));
      renderKasirSalesList();
      renderAdminProductGrid();
      calculateAll();
      showToast(`Menu "${prodName}" berhasil dihapus`);
    }
  }
};

const onDataChanged = () => {
  if (window.isEditMode) return;

  if (
    !document
      .getElementById("view-kasir-history")
      ?.classList.contains("hidden")
  ) {
    loadKasirHistory();
  }

  if (
    !document.getElementById("view-admin")?.classList.contains("hidden")
  ) {
    renderAdminDashboard();
  }

  if (
    !document.getElementById("view-admin-products")?.classList.contains("hidden")
  ) {
    renderAdminProductGrid();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initializeDatabase, 500);
});

const formatNumber = (angka) => new Intl.NumberFormat("id-ID").format(angka || 0);
const formatRupiah = (angka) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka || 0);

const parseCurrency = (str) => {
  if (!str) return 0;
  return parseInt(String(str).replace(/[^0-9]/g, "")) || 0;
};

const parseIndoDate = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date();
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

const filterReportsByDate = (reports, filterType, startDateVal, endDateVal) => {
  if (!filterType || filterType === "all") return reports;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return reports.filter((item) => {
    const itemDate = parseIndoDate(item.tanggal);
    if (!itemDate || isNaN(itemDate.getTime())) return false;

    if (filterType === "today") {
      return itemDate >= todayStart && itemDate <= todayEnd;
    } else if (filterType === "7days") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return itemDate >= sevenDaysAgo && itemDate <= todayEnd;
    } else if (filterType === "thisMonth") {
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    } else if (filterType === "custom") {
      if (!startDateVal && !endDateVal) return true;
      let valid = true;
      if (startDateVal) {
        const s = new Date(startDateVal);
        s.setHours(0, 0, 0, 0);
        valid = valid && itemDate >= s;
      }
      if (endDateVal) {
        const e = new Date(endDateVal);
        e.setHours(23, 59, 59, 999);
        valid = valid && itemDate <= e;
      }
      return valid;
    }
    return true;
  });
};

// --- 2. SISTEM LOGIN PORTAL ---
const viewLogin = document.getElementById("view-login");
const viewKasir = document.getElementById("view-kasir");
const viewKasirHistory = document.getElementById("view-kasir-history");
const viewAdmin = document.getElementById("view-admin");
const viewAdminProducts = document.getElementById("view-admin-products");
const mainTitle = document.getElementById("mainTitle");
const subTitle = document.getElementById("subTitle");
const appHeader = document.getElementById("appHeader");
const loginBg = document.getElementById("loginBg");
const userAccountWrapper = document.getElementById("userAccountWrapper");
const btnUserAccount = document.getElementById("btnUserAccount");
const userAvatarText = document.getElementById("userAvatarText");
const userAccountName = document.getElementById("userAccountName");
const userAccountRole = document.getElementById("userAccountRole");
const userDropdownAvatar = document.getElementById("userDropdownAvatar");
const userDropdownName = document.getElementById("userDropdownName");
const userDropdownBadge = document.getElementById("userDropdownBadge");

function hideAppInitLoader(delay = 400) {
  const loader = document.getElementById("appInitLoader");
  if (loader) {
    setTimeout(() => {
      loader.classList.add("fade-out");
      setTimeout(() => {
        loader.style.display = "none";
        document.documentElement.classList.remove("has-saved-session");
      }, 240);
    }, delay);
  }
}
window.hideAppInitLoader = hideAppInitLoader;

const switchView = (role) => {
  currentAppRole = role;
  try {
    if (role === "admin" || role === "kasir") {
      localStorage.setItem("pm_logged_role", role);
    }
  } catch (_) {}

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  viewLogin.classList.add("hidden");
  viewKasir.classList.add("hidden");
  viewKasirHistory.classList.add("hidden");
  viewAdmin.classList.add("hidden");
  if (viewAdminProducts) viewAdminProducts.classList.add("hidden");
  loginBg.classList.remove("active");
  appHeader.style.backgroundColor = "#D62828";

  const menuKelolaProduk = document.getElementById("menuKelolaProduk");

  if (userAccountWrapper) {
    userAccountWrapper.classList.remove("hidden");
    userAccountWrapper.classList.remove("open");
  }

  // Sembunyikan initial loading screen
  hideAppInitLoader();

  // Request native notification permission if supported
  requestNotificationPermission();

  if (role === "kasir") {
    if (menuKelolaProduk) menuKelolaProduk.classList.add("hidden");
    viewKasir.classList.remove("hidden");
    mainTitle.textContent = "PM Fried Chicken Kendayakan";
    subTitle.textContent = "Sistem Rekap Kasir";
    
    if (userAvatarText) userAvatarText.textContent = "K";
    if (userDropdownAvatar) userDropdownAvatar.textContent = "K";
    if (userAccountName) userAccountName.textContent = "Kasir";
    if (userAccountRole) userAccountRole.textContent = "Shift Aktif";
    if (userDropdownName) userDropdownName.textContent = "Kasir PMFC";
    if (userDropdownBadge) userDropdownBadge.textContent = "Kasir Aktif";

    setupDateTime();
  } else if (role === "admin") {
    if (menuKelolaProduk) menuKelolaProduk.classList.remove("hidden");
    viewAdmin.classList.remove("hidden");
    mainTitle.textContent = "Dashboard Owner";
    subTitle.textContent = "Statistik & Database";

    if (userAvatarText) userAvatarText.textContent = "A";
    if (userDropdownAvatar) userDropdownAvatar.textContent = "A";
    if (userAccountName) userAccountName.textContent = "Owner";
    if (userAccountRole) userAccountRole.textContent = "Super Admin";
    if (userDropdownName) userDropdownName.textContent = "Owner / Admin";
    if (userDropdownBadge) userDropdownBadge.textContent = "Super Admin";

    renderAdminDashboard();
  } else if (role === "admin-products") {
    if (menuKelolaProduk) menuKelolaProduk.classList.remove("hidden");
    if (viewAdminProducts) viewAdminProducts.classList.remove("hidden");
    mainTitle.textContent = "Kelola Menu & Harga";
    subTitle.textContent = "Pengaturan Produk & Harga Satuan";

    if (userAvatarText) userAvatarText.textContent = "A";
    if (userDropdownAvatar) userDropdownAvatar.textContent = "A";
    if (userAccountName) userAccountName.textContent = "Owner";
    if (userAccountRole) userAccountRole.textContent = "Super Admin";
    if (userDropdownName) userDropdownName.textContent = "Owner / Admin";
    if (userDropdownBadge) userDropdownBadge.textContent = "Super Admin";

    renderAdminProductGrid();
  }

  if (typeof initCustomSelects === "function") {
    initCustomSelects();
  }

  updateNotificationBadges();
  window.scrollTo(0, 0);
};
window.switchView = switchView;

window.handleUserKelolaProduk = (e) => {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.preventDefault === "function") e.preventDefault();
  }
  const wrapper = document.getElementById("userAccountWrapper");
  if (wrapper) wrapper.classList.remove("open");
  switchView("admin-products");
};

window.showAppChangelogModal = (e) => {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
    if (typeof e.preventDefault === "function") e.preventDefault();
  }
  const wrapper = document.getElementById("userAccountWrapper");
  if (wrapper) wrapper.classList.remove("open");
  const modal = document.getElementById("changelogModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
};

const handleLogout = async () => {
  const confirmed = await customConfirm(
    "Apakah Anda yakin ingin keluar dari sistem akun ini?",
    "Konfirmasi Keluar",
    "Ya, Keluar Akun",
    "Batal",
    "logout",
    "fa-solid fa-arrow-right-from-bracket",
  );
  if (confirmed) {
    try {
      localStorage.removeItem("pm_logged_role");
    } catch (_) {}

    if (window.isEditMode) exitEditMode();
    if (userAccountWrapper) {
      userAccountWrapper.classList.add("hidden");
      userAccountWrapper.classList.remove("open");
    }
    viewLogin.classList.remove("hidden");
    viewKasir.classList.add("hidden");
    viewKasirHistory.classList.add("hidden");
    viewAdmin.classList.add("hidden");
    if (viewAdminProducts) viewAdminProducts.classList.add("hidden");
    loginBg.classList.add("active");

    appHeader.style.backgroundColor = "#D62828";
    mainTitle.textContent = "PM Fried Chicken Kendayakan";
    subTitle.textContent = "Portal Login Pegawai";
    clearInterval(timeInterval);
    showToast("Anda telah keluar akun");
  }
};

const loginPinInput = document.getElementById("loginPin");
if (loginPinInput) {
  // Hanya menerima input angka 0-9
  loginPinInput.addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9]/g, "");
  });
}

document.getElementById("btnLogin").addEventListener("click", async () => {
  const pin = document.getElementById("loginPin").value.trim();
  if (!pin) {
    await customAlert(
      "Mohon masukkan PIN untuk masuk ke sistem rekap.",
      "PIN Diperlukan",
      "warning",
    );
    document.getElementById("loginPin").focus();
    return;
  }
  if (pin === "1234") {
    switchView("kasir");
    showToast("Login Kasir Berhasil");
  } else if (pin === "8888") {
    switchView("admin");
    showToast("Selamat Datang, Owner");
  } else {
    await customAlert(
      "PIN yang Anda masukkan salah. Silakan coba kembali.",
      "Akses Ditolak",
      "error",
    );
  }
  document.getElementById("loginPin").value = "";
});

document.getElementById("loginPin").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("btnLogin").click();
  }
});

// Setup User Account Menu & Theme Toggle Actions
window.toggleUserAccountMenu = (e) => {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById("userAccountWrapper");
  if (wrapper) {
    wrapper.classList.toggle("open");
  }
};

window.handleUserThemeToggle = (e) => {
  if (e) e.stopPropagation();
  toggleDarkModeAction();
};

window.handleUserLogout = (e) => {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById("userAccountWrapper");
  if (wrapper) wrapper.classList.remove("open");
  handleLogout();
};

window.addEventListener("DOMContentLoaded", () => {
  loginBg.classList.add("active");
});

// --- 3. LOGIKA KASIR & HITUNG OTOMATIS ---
const inputs = document.querySelectorAll(".calc-input");
const expenseList = document.getElementById("expenseList");
const incomeList = document.getElementById("incomeList");
const kasirInput = document.getElementById("kasir");

kasirInput.addEventListener("input", function () {
  this.value = this.value.replace(/[^a-zA-Z\s]/g, "");
});

const formatCurrencyInput = (e) => {
  let val = e.target.value.replace(/[^0-9]/g, "");
  e.target.value = val === "" ? "" : "Rp. " + formatNumber(val);
  calculateAll();
};

const validateNumberInput = (e) => {
  if (e.target.value < 0 || e.target.value === "") e.target.value = 0;
  calculateAll();
};

const setupDateTime = () => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const updateTime = () => {
    if (editingId !== null) return;
    const now = new Date();
    document.getElementById("hari").value = days[now.getDay()];
    document.getElementById("tanggal").value =
      `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    document.getElementById("jam").value =
      `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };
  updateTime();
  clearInterval(timeInterval);
  timeInterval = setInterval(updateTime, 60000);
};

const setupQtyControls = () => {
  document.querySelectorAll(".qty-control").forEach((ctrl) => {
    if (ctrl.dataset.initialized) return;
    const btnMinus = ctrl.querySelector(".minus"),
      btnPlus = ctrl.querySelector(".plus"),
      input = ctrl.querySelector("input");
    btnMinus.addEventListener("click", () => {
      let val = parseInt(input.value) || 0;
      if (val > 0) {
        input.value = val - 1;
        calculateAll();
      }
    });
    btnPlus.addEventListener("click", () => {
      let val = parseInt(input.value) || 0;
      input.value = val + 1;
      calculateAll();
    });
    ctrl.dataset.initialized = "true";
  });
};

const calculateAll = () => {
  const awalFc = parseInt(document.getElementById("awalFc")?.value) || 0;
  const awalNasi = parseInt(document.getElementById("awalNasi")?.value) || 0;

  let totalSalesQtyFc = 0;
  let totalSalesQtyNasi = 0;
  let totalPenjualan = 0;

  currentProducts.forEach((p) => {
    const input =
      document.getElementById(`jual_${p.id}`) ||
      (p.id === "fc" ? document.getElementById("jualFc") : null) ||
      (p.id === "geprek" ? document.getElementById("jualGeprek") : null) ||
      (p.id === "nasi" ? document.getElementById("jualNasi") : null);

    const qty = parseInt(input?.value) || 0;
    const subtotal = qty * (p.price || 0);

    const subEl =
      document.getElementById(`sub_${p.id}`) ||
      (p.id === "fc" ? document.getElementById("subFc") : null) ||
      (p.id === "geprek" ? document.getElementById("subGeprek") : null) ||
      (p.id === "nasi" ? document.getElementById("subNasi") : null);

    if (subEl) subEl.textContent = formatRupiah(subtotal);

    totalPenjualan += subtotal;

    if (p.stockType === "fc") {
      totalSalesQtyFc += qty;
    } else if (p.stockType === "nasi") {
      totalSalesQtyNasi += qty;
    }
  });

  const akhirFc = awalFc - totalSalesQtyFc;
  const akhirNasi = awalNasi - totalSalesQtyNasi;

  const elAkhirFc = document.getElementById("akhirFc");
  const elAkhirNasi = document.getElementById("akhirNasi");

  if (elAkhirFc) {
    elAkhirFc.textContent = akhirFc;
    elAkhirFc.style.color = akhirFc < 0 ? "var(--primary)" : "var(--primary)";
  }

  if (elAkhirNasi) {
    elAkhirNasi.textContent = akhirNasi;
    elAkhirNasi.style.color = akhirNasi < 0 ? "var(--primary)" : "var(--primary)";
  }

  const totalPenjEl = document.getElementById("totalPenjualan");
  if (totalPenjEl) totalPenjEl.textContent = formatRupiah(totalPenjualan);

  const sumPenjEl = document.getElementById("sumPenjualan");
  if (sumPenjEl) sumPenjEl.textContent = formatRupiah(totalPenjualan);

  let totalPemasukan = 0;
  document
    .querySelectorAll(".income-amount")
    .forEach((input) => (totalPemasukan += parseCurrency(input.value)));
  const totalPemasukanEl = document.getElementById("totalPemasukan");
  if (totalPemasukanEl) totalPemasukanEl.textContent = formatRupiah(totalPemasukan);
  const sumPemasukanEl = document.getElementById("sumPemasukan");
  if (sumPemasukanEl) sumPemasukanEl.textContent = formatRupiah(totalPemasukan);

  let totalPengeluaran = 0;
  document
    .querySelectorAll(".expense-amount")
    .forEach((input) => (totalPengeluaran += parseCurrency(input.value)));
  const totalPengeluaranEl = document.getElementById("totalPengeluaran");
  if (totalPengeluaranEl) totalPengeluaranEl.textContent = formatRupiah(totalPengeluaran);
  const sumPengeluaranEl = document.getElementById("sumPengeluaran");
  if (sumPengeluaranEl) sumPengeluaranEl.textContent = formatRupiah(totalPengeluaran);

  const saldoAkhir = totalPenjualan + totalPemasukan - totalPengeluaran;
  const saldoAkhirEl = document.getElementById("saldoAkhir");
  if (saldoAkhirEl) saldoAkhirEl.textContent = formatRupiah(saldoAkhir);
};

document.getElementById("btnAddIncome").addEventListener("click", async () => {
  const existingItems = incomeList.querySelectorAll(".income-item");
  for (let item of existingItems) {
    if (
      !item.querySelector(".income-desc").value.trim() ||
      parseCurrency(item.querySelector(".income-amount").value) <= 0
    ) {
      await customAlert(
        "Harap lengkapi keterangan dan nominal pada baris pemasukan sebelumnya terlebih dahulu.",
        "Data Belum Lengkap",
        "warning",
      );
      return;
    }
  }
  const uid = "inc_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  incomeList.insertAdjacentHTML(
    "beforeend",
    `<div class="income-item" id="${uid}">
      <input type="text" class="income-desc" placeholder="Keterangan Pemasukan Lainnya">
      <input type="text" class="income-amount" placeholder="Rp. 0">
      <button type="button" class="btn-danger btn-icon-small" onclick="removeEl('${uid}')" title="Hapus Baris"><i class="fas fa-trash"></i></button>
    </div>`,
  );
  document
    .getElementById(uid)
    .querySelector(".income-amount")
    .addEventListener("input", formatCurrencyInput);
});

document.getElementById("btnAddExpense").addEventListener("click", async () => {
  const existingItems = expenseList.querySelectorAll(".expense-item");
  for (let item of existingItems) {
    if (
      !item.querySelector(".expense-desc").value.trim() ||
      parseCurrency(item.querySelector(".expense-amount").value) <= 0
    ) {
      await customAlert(
        "Harap lengkapi keterangan dan nominal pada baris pengeluaran sebelumnya terlebih dahulu.",
        "Data Belum Lengkap",
        "warning",
      );
      return;
    }
  }
  const uid = "exp_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  expenseList.insertAdjacentHTML(
    "beforeend",
    `<div class="expense-item" id="${uid}">
      <input type="text" class="expense-desc" placeholder="Keterangan Pengeluaran">
      <input type="text" class="expense-amount" placeholder="Rp. 0">
      <button type="button" class="btn-danger btn-icon-small" onclick="removeEl('${uid}')" title="Hapus Baris"><i class="fas fa-trash"></i></button>
    </div>`,
  );
  document
    .getElementById(uid)
    .querySelector(".expense-amount")
    .addEventListener("input", formatCurrencyInput);
});

window.removeEl = (id) => {
  const el = document.getElementById(id);
  if (el) el.remove();
  calculateAll();
};

inputs.forEach((input) => input.addEventListener("input", validateNumberInput));

const validateForm = async () => {
  if (!kasirInput.value.trim()) {
    await customAlert(
      "Mohon isi Nama Kasir yang bertugas sebelum melanjutkan.",
      "Nama Kasir Diperlukan",
      "warning",
    );
    kasirInput.focus();
    return false;
  }
  for (let id of ["awalFc", "awalNasi"]) {
    const el = document.getElementById(id);
    if (!el || el.value === "") {
      await customAlert(
        "Pastikan semua form stok awal terisi dengan benar (minimal 0).",
        "Form Belum Lengkap",
        "warning",
      );
      return false;
    }
  }

  const salesInputs = document.querySelectorAll(".product-sales-qty");
  for (let input of salesInputs) {
    if (input.value === "") {
      await customAlert(
        "Pastikan semua kolom penjualan produk terisi dengan angka (minimal 0).",
        "Form Belum Lengkap",
        "warning",
      );
      input.focus();
      return false;
    }
  }

  return true;
};

// --- 4. FORMAT DATA GENERATOR ---
const getRawData = () => {
  const items = currentProducts.map((p) => {
    const input =
      document.getElementById(`jual_${p.id}`) ||
      (p.id === "fc" ? document.getElementById("jualFc") : null) ||
      (p.id === "geprek" ? document.getElementById("jualGeprek") : null) ||
      (p.id === "nasi" ? document.getElementById("jualNasi") : null);

    const qty = parseInt(input?.value) || 0;
    return {
      id: p.id,
      name: p.name,
      price: p.price || 0,
      unit: p.unit || "pcs",
      qty: qty,
      subtotal: qty * (p.price || 0),
      stockType: p.stockType || "none",
    };
  });

  const fcItem = items.find((x) => x.id === "fc");
  const geprekItem = items.find((x) => x.id === "geprek");
  const nasiItem = items.find((x) => x.id === "nasi");

  return {
    awalFc: document.getElementById("awalFc")?.value || "0",
    awalNasi: document.getElementById("awalNasi")?.value || "0",
    jualFc: fcItem ? fcItem.qty : parseInt(document.getElementById("jualFc")?.value) || 0,
    jualGeprek: geprekItem ? geprekItem.qty : parseInt(document.getElementById("jualGeprek")?.value) || 0,
    jualNasi: nasiItem ? nasiItem.qty : parseInt(document.getElementById("jualNasi")?.value) || 0,
    items: items,
    incomes: Array.from(document.querySelectorAll(".income-item")).map(
      (item) => ({
        desc: item.querySelector(".income-desc").value,
        amount: parseCurrency(item.querySelector(".income-amount").value),
      }),
    ),
    expenses: Array.from(document.querySelectorAll(".expense-item")).map(
      (item) => ({
        desc: item.querySelector(".expense-desc").value,
        amount: parseCurrency(item.querySelector(".expense-amount").value),
      }),
    ),
  };
};

const generateReportText = () => {
  const raw = getRawData();
  const kasir = kasirInput.value || "-";

  let rincianPenjualan = "";
  let totalPenjualan = 0;
  let totalSalesQtyFc = 0;
  let totalSalesQtyNasi = 0;

  const items =
    raw.items && raw.items.length > 0
      ? raw.items
      : currentProducts.map((p) => {
          const q =
            p.id === "fc"
              ? parseInt(raw.jualFc) || 0
              : p.id === "geprek"
                ? parseInt(raw.jualGeprek) || 0
                : p.id === "nasi"
                  ? parseInt(raw.jualNasi) || 0
                  : 0;
          return {
            id: p.id,
            name: p.name,
            price: p.price,
            unit: p.unit || "pcs",
            qty: q,
            subtotal: q * p.price,
            stockType: p.stockType,
          };
        });

  items.forEach((item) => {
    totalPenjualan += item.subtotal;
    if (item.stockType === "fc") totalSalesQtyFc += item.qty;
    if (item.stockType === "nasi") totalSalesQtyNasi += item.qty;

    rincianPenjualan += `${item.name}
Terjual : ${item.qty} ${item.unit || "pcs"}
Harga : Rp${formatNumber(item.price)}
Subtotal : Rp${formatNumber(item.subtotal)}

`;
  });

  let daftarPemasukan = "",
    totalInc = 0;
  if (raw.incomes.length === 0)
    daftarPemasukan = "Tidak ada pemasukan lainnya\n";
  else
    raw.incomes.forEach((inc) => {
      if (inc.amount > 0) {
        daftarPemasukan += `• ${inc.desc} : Rp${formatNumber(inc.amount)}\n`;
        totalInc += inc.amount;
      }
    });

  let daftarPengeluaran = "",
    totalExp = 0;
  if (raw.expenses.length === 0) daftarPengeluaran = "Tidak ada pengeluaran\n";
  else
    raw.expenses.forEach((exp) => {
      if (exp.amount > 0) {
        daftarPengeluaran += `• ${exp.desc} : Rp${formatNumber(exp.amount)}\n`;
        totalExp += exp.amount;
      }
    });

  const sisaFc = parseInt(raw.awalFc) - totalSalesQtyFc;
  const sisaNasi = parseInt(raw.awalNasi) - totalSalesQtyNasi;

  return `📋 *LAPORAN REKAP PENJUALAN PM FRIED CHICKEN*

📅 Hari/Tanggal : ${document.getElementById("hari").value}, ${document.getElementById("tanggal").value}
⏰ Jam : ${document.getElementById("jam").value}
👤 Kasir : ${kasir}
━━━━━━━━━━━━━━
📦 STOK AWAL
• Fried Chicken : ${raw.awalFc} pcs
• Nasi : ${raw.awalNasi} porsi
━━━━━━━━━━━━━━
🍗 RINCIAN PENJUALAN

${rincianPenjualan}Total Penjualan : Rp${formatNumber(totalPenjualan)}
━━━━━━━━━━━━━━
📦 SISA STOK AKHIR
• Fried Chicken : ${sisaFc} pcs
• Nasi : ${sisaNasi} porsi
━━━━━━━━━━━━━━
💵 PEMASUKAN LAINNYA
${daftarPemasukan}Total Pemasukan Lainnya : Rp${formatNumber(totalInc)}
━━━━━━━━━━━━━━
🧾 PENGELUARAN
${daftarPengeluaran}Total Pengeluaran : Rp${formatNumber(totalExp)}
━━━━━━━━━━━━━━
📊 REKAP AKHIR
Total Penjualan : Rp${formatNumber(totalPenjualan)}
Total Pemasukan Lainnya : Rp${formatNumber(totalInc)}
Total Pengeluaran : Rp${formatNumber(totalExp)}
Saldo Akhir : Rp${formatNumber(totalPenjualan + totalInc - totalExp)}
━━━━━━━━━━━━━━

_Laporan dibuat melalui Sistem Rekap Penjualan PM Fried Chicken Kendayakan_`;
};

// Tabel Detail Laporan Database
window.hideDetailRow = (id, isAdmin = false) => {
  const prefix = isAdmin ? "admin-detail-" : "kasir-detail-";
  const row = document.getElementById(`${prefix}${id}`);
  if (row) {
    row.classList.add("hidden");
  }
};

const generateDetailTableHTML = (item, isAdmin = false) => {
  const raw = item?.rawData;
  const money = (n) => `Rp${formatNumber(n || 0)}`;
  const itemId = item?.id || item?.timestamp?.toString() || "";
  const closeFunction = `hideDetailRow('${itemId}', ${isAdmin ? "true" : "false"})`;

  if (!raw) {
    return `
    <div class="detail-card-panel">
      <div class="detail-header-bar">
        <div class="detail-meta-info">
          <h4><i class="fa-solid fa-file-invoice text-red"></i> Rincian Laporan: <strong>${item?.kasir || "-"}</strong></h4>
          <span class="badge-meta"><i class="fa-regular fa-calendar-days"></i> ${item?.hari || "-"}, ${item?.tanggal || "-"} &bull; <i class="fa-regular fa-clock"></i> ${item?.jam || "-"}</span>
        </div>
        <button type="button" class="btn btn-small btn-secondary" onclick="${closeFunction}">
          <i class="fa-solid fa-xmark"></i> Tutup
        </button>
      </div>
      <p class="text-muted" style="padding: 16px;">Data rincian mentah tidak tersedia untuk laporan ini.</p>
    </div>
    `;
  }

  const incomes = Array.isArray(raw.incomes) ? raw.incomes : [];
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];

  const stokAwalFc = parseInt(raw.awalFc) || 0;
  const stokAwalNasi = parseInt(raw.awalNasi) || 0;

  let salesRowsHtml = "";
  let computedPenjualan = 0;
  let totalFcSold = 0;
  let totalNasiSold = 0;

  if (raw.items && Array.isArray(raw.items) && raw.items.length > 0) {
    raw.items.forEach((p) => {
      const q = p.qty || 0;
      const pr = p.price || 0;
      const sub = p.subtotal !== undefined ? p.subtotal : q * pr;
      computedPenjualan += sub;
      if (p.stockType === "fc") totalFcSold += q;
      if (p.stockType === "nasi") totalNasiSold += q;

      salesRowsHtml += `
        <div class="sales-row-detail">
          <span>${p.name} (${q} ${p.unit || "pcs"} @ ${formatNumber(pr)})</span>
          <strong>${money(sub)}</strong>
        </div>
      `;
    });
  } else {
    const jualFc = parseInt(raw.jualFc) || 0;
    const jualGeprek = parseInt(raw.jualGeprek) || 0;
    const jualNasi = parseInt(raw.jualNasi) || 0;

    const subFc = jualFc * HARGA.fc;
    const subGeprek = jualGeprek * HARGA.geprek;
    const subNasi = jualNasi * HARGA.nasi;

    computedPenjualan = subFc + subGeprek + subNasi;
    totalFcSold = jualFc + jualGeprek;
    totalNasiSold = jualNasi;

    salesRowsHtml = `
      <div class="sales-row-detail">
        <span>Fried Chicken (${jualFc} pcs @ ${formatNumber(HARGA.fc)})</span>
        <strong>${money(subFc)}</strong>
      </div>
      <div class="sales-row-detail">
        <span>Ayam Geprek (${jualGeprek} porsi @ ${formatNumber(HARGA.geprek)})</span>
        <strong>${money(subGeprek)}</strong>
      </div>
      <div class="sales-row-detail">
        <span>Nasi (${jualNasi} porsi @ ${formatNumber(HARGA.nasi)})</span>
        <strong>${money(subNasi)}</strong>
      </div>
    `;
  }

  const stokAkhirFc = stokAwalFc - totalFcSold;
  const stokAkhirNasi = stokAwalNasi - totalNasiSold;

  const totalInc = incomes.reduce((s, i) => s + (i?.amount || 0), 0);
  const totalExp = expenses.reduce((s, e) => s + (e?.amount || 0), 0);
  const saldoAkhir = item?.saldoAkhir ?? (computedPenjualan + totalInc - totalExp);
  const totalPenjualanKotor = item?.penjualan ?? computedPenjualan;

  const renderChips = (arr, emptyText, type) => {
    if (!arr.length) return `<span class="detail-empty-text">${emptyText}</span>`;
    return (
      `<div class="detail-chips-list">` +
      arr
        .map((x) => {
          const desc = x?.desc || "-";
          const amount = x?.amount || 0;
          const badgeClass = type === "expense" ? "expense-chip" : "income-chip";
          const sign = type === "expense" ? "-" : "+";
          return `
          <div class="detail-chip-item ${badgeClass}">
            <span class="chip-desc">${desc}</span>
            <span class="chip-val">${sign}${money(amount)}</span>
          </div>
        `;
        })
        .join("") +
      `</div>`
    );
  };

  return `
    <div class="detail-card-panel">
      <div class="detail-header-bar">
        <div class="detail-meta-info">
          <h4><i class="fa-solid fa-file-invoice text-red"></i> Rincian Laporan: <strong>${item?.kasir || "-"}</strong></h4>
          <span class="badge-meta"><i class="fa-regular fa-calendar-check"></i> ${item?.hari || "-"}, ${item?.tanggal || "-"} &bull; <i class="fa-regular fa-clock"></i> ${item?.jam || "-"}</span>
        </div>
        <button type="button" class="btn btn-small btn-secondary" onclick="${closeFunction}">
          <i class="fa-solid fa-xmark"></i> Tutup Rincian
        </button>
      </div>

      <div class="detail-grid-cards">
        <!-- Card 1: Stok -->
        <div class="detail-subcard">
          <div class="subcard-title"><i class="fa-solid fa-boxes-stacked text-orange"></i> Pergerakan Stok</div>
          <div class="detail-stock-row">
            <div class="stock-item">
              <span class="stock-label">Fried Chicken</span>
              <div class="stock-flow">
                <span class="stock-tag awal">Awal: ${stokAwalFc} pcs</span>
                <i class="fa-solid fa-arrow-right-long text-muted"></i>
                <span class="stock-tag ${stokAkhirFc < 0 ? "danger" : "akhir"}">Sisa: ${stokAkhirFc} pcs</span>
              </div>
            </div>
            <div class="stock-item">
              <span class="stock-label">Nasi</span>
              <div class="stock-flow">
                <span class="stock-tag awal">Awal: ${stokAwalNasi} porsi</span>
                <i class="fa-solid fa-arrow-right-long text-muted"></i>
                <span class="stock-tag ${stokAkhirNasi < 0 ? "danger" : "akhir"}">Sisa: ${stokAkhirNasi} porsi</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Penjualan -->
        <div class="detail-subcard">
          <div class="subcard-title"><i class="fa-solid fa-bag-shopping text-primary"></i> Rincian Penjualan</div>
          <div class="detail-sales-table">
            ${salesRowsHtml}
            <div class="sales-row-detail total">
              <span>Total Penjualan Kotor</span>
              <strong class="text-green">${money(totalPenjualanKotor)}</strong>
            </div>
          </div>
        </div>

        <!-- Card 3: Pemasukan Lainnya -->
        <div class="detail-subcard">
          <div class="subcard-title"><i class="fa-solid fa-arrow-trend-up text-green"></i> Pemasukan Tambahan (${money(totalInc)})</div>
          ${renderChips(incomes, "Tidak ada pemasukan tambahan", "income")}
        </div>

        <!-- Card 4: Pengeluaran -->
        <div class="detail-subcard">
          <div class="subcard-title"><i class="fa-solid fa-arrow-trend-down text-red"></i> Pengeluaran (${money(totalExp)})</div>
          ${renderChips(expenses, "Tidak ada pengeluaran tercatat", "expense")}
        </div>
      </div>

      <div class="detail-kpi-strip">
        <div class="kpi-strip-item">
          <span class="strip-label"><i class="fa-solid fa-bag-shopping"></i> Penjualan Kotor</span>
          <strong class="strip-val">${money(totalPenjualanKotor)}</strong>
        </div>
        <div class="kpi-strip-operator">+</div>
        <div class="kpi-strip-item green">
          <span class="strip-label"><i class="fa-solid fa-circle-plus"></i> Pemasukan Lain</span>
          <strong class="strip-val text-green">${money(totalInc)}</strong>
        </div>
        <div class="kpi-strip-operator">-</div>
        <div class="kpi-strip-item red">
          <span class="strip-label"><i class="fa-solid fa-circle-minus"></i> Pengeluaran</span>
          <strong class="strip-val text-red">${money(totalExp)}</strong>
        </div>
        <div class="kpi-strip-operator">=</div>
        <div class="kpi-strip-item gold final">
          <span class="strip-label"><i class="fa-solid fa-wallet"></i> Saldo Bersih Akhir</span>
          <strong class="strip-val text-gold">${money(saldoAkhir)}</strong>
        </div>
      </div>
    </div>
  `;
};

// --- 5. EKSEKUSI PENYIMPANAN WA & DATABASE ---
document.getElementById("btnKirimWAEdit").addEventListener("click", async () => {
  const isValid = await validateForm();
  if (!isValid) return;
  const text = generateReportText();
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
  );
});

document.getElementById("btnSimpanKirim").addEventListener("click", async () => {
  const isValid = await validateForm();
  if (!isValid) return;

  if (!db && !window.isUsingLocalStorage) {
    await customAlert(
      "Sistem Database belum siap. Silakan muat ulang halaman.",
      "Database Belum Siap",
      "warning",
    );
    return;
  }

  document.getElementById("loading").classList.remove("hidden");

  const text = generateReportText();
  const totalPenj = parseCurrency(
    document.getElementById("sumPenjualan").textContent,
  );
  const totalSaldo = parseCurrency(
    document.getElementById("saldoAkhir").textContent,
  );
  const rawData = getRawData();

  const dataToSave = {
    hari: document.getElementById("hari").value,
    tanggal: document.getElementById("tanggal").value,
    jam: document.getElementById("jam").value,
    kasir: kasirInput.value,
    penjualan: totalPenj,
    saldoAkhir: totalSaldo,
    laporanLengkap: text,
    rawData: rawData,
    timestamp: new Date().getTime(),
  };

  if (firebaseReady && db) {
    const reportsRef = db.ref("reports");

    if (editingId !== null) {
      reportsRef
        .child(editingId)
        .update(dataToSave)
        .then(() => {
          document.getElementById("loading").classList.add("hidden");
          showToast("✅ Perubahan Berhasil Disimpan!");
          sendNativeNotification(
            "Laporan Berhasil Diperbarui! ✅",
            `Perubahan data laporan Kasir ${dataToSave.kasir || ""} tanggal ${dataToSave.tanggal} telah disimpan ke sistem.`,
            "kasir-updated",
            "report-out",
            editingId,
          );
          exitEditMode();
          document.getElementById("view-kasir").classList.add("hidden");
          document
            .getElementById("view-kasir-history")
            .classList.remove("hidden");
          loadKasirHistory();
          window.scrollTo(0, 0);
        })
        .catch(async (error) => {
          document.getElementById("loading").classList.add("hidden");
          await customAlert(
            "Gagal menyimpan ke cloud Firebase: " + error.message,
            "Gagal Simpan",
            "error",
          );
        });
    } else {
      const newKey = reportsRef.push().key;
      reportsRef
        .child(newKey)
        .set(dataToSave)
        .then(() => {
          document.getElementById("loading").classList.add("hidden");
          showToast("Laporan Berhasil Dikirim!");
          sendNativeNotification(
            "Laporan Berhasil Terkirim! ✅",
            `Laporan Kasir ${dataToSave.kasir || ""} tanggal ${dataToSave.tanggal} (Total: Rp ${formatNumber(dataToSave.penjualan)}) berhasil tersimpan ke sistem.`,
            "kasir-sent",
            "report-out",
            newKey,
          );
          resetForm();
          window.open(
            `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
            "_blank",
          );
        })
        .catch(async (error) => {
          document.getElementById("loading").classList.add("hidden");
          await customAlert(
            "Gagal menyimpan ke cloud Firebase: " + error.message,
            "Gagal Simpan",
            "error",
          );
        });
    }
  } else {
    // Fallback ke localStorage
    const records = JSON.parse(localStorage.getItem("pmReports") || "[]");
    const safeLocalId = editingId !== null ? editingId : Date.now().toString();
    if (editingId !== null) {
      const idx = records.findIndex((r) => r.id === editingId);
      if (idx !== -1) records[idx] = { id: editingId, ...dataToSave };
    } else {
      records.push({ id: safeLocalId, ...dataToSave });
    }
    localStorage.setItem("pmReports", JSON.stringify(records));

    document.getElementById("loading").classList.add("hidden");
    if (editingId !== null) {
      showToast("Perubahan Berhasil Disimpan!");
      sendNativeNotification(
        "Laporan Berhasil Diperbarui! ✅",
        `Perubahan data laporan Kasir ${dataToSave.kasir || ""} tanggal ${dataToSave.tanggal} telah disimpan ke sistem lokal.`,
        "kasir-updated",
        "report-out",
        editingId,
      );
      exitEditMode();
      document.getElementById("view-kasir").classList.add("hidden");
      document.getElementById("view-kasir-history").classList.remove("hidden");
      loadKasirHistory();
    } else {
      showToast("Laporan Berhasil Dikirim!");
      sendNativeNotification(
        "Laporan Berhasil Terkirim! ✅",
        `Laporan Kasir ${dataToSave.kasir || ""} tanggal ${dataToSave.tanggal} berhasil tersimpan ke sistem lokal.`,
        "kasir-sent",
        "report-out",
        safeLocalId,
      );
      resetForm();
      window.open(
        `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
        "_blank",
      );
    }
    window.scrollTo(0, 0);
  }
});

const resetForm = () => {
  document
    .querySelectorAll('input[type="number"]')
    .forEach((input) => (input.value = 0));
  kasirInput.value = "";
  expenseList.innerHTML = "";
  incomeList.innerHTML = "";
  calculateAll();
};

document.getElementById("btnReset").addEventListener("click", async () => {
  const confirmed = await customConfirm(
    "Apakah Anda yakin ingin mengosongkan dan mereset seluruh formulir rekap ini?",
    "Konfirmasi Reset",
    "Ya, Reset Form",
    "Batal",
    "warning",
  );
  if (confirmed) {
    resetForm();
    showToast("Formulir berhasil di-reset");
  }
});

// --- 6. LOGIKA RIWAYAT DATABASE KASIR ---
document.getElementById("btnRiwayat").addEventListener("click", () => {
  loadKasirHistory();
  document.getElementById("view-kasir").classList.add("hidden");
  document.getElementById("view-kasir-history").classList.remove("hidden");
  window.scrollTo(0, 0);
});

document.getElementById("btnKembaliKasir").addEventListener("click", () => {
  document.getElementById("view-kasir-history").classList.add("hidden");
  document.getElementById("view-kasir").classList.remove("hidden");
  window.scrollTo(0, 0);
});

// --- HELPER KOMPONEN PAGINATION ---
const renderPaginationControls = (totalItems, currentPage, onPageChangeName) => {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  if (totalPages <= 1) return "";

  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  let pageButtonsHtml = "";
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    pageButtonsHtml += `<button type="button" class="btn-page ${currentPage === 1 ? "active" : ""}" onclick="${onPageChangeName}(1)">1</button>`;
    if (startPage > 2) {
      pageButtonsHtml += `<span class="page-ellipsis">&hellip;</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    pageButtonsHtml += `<button type="button" class="btn-page ${currentPage === p ? "active" : ""}" onclick="${onPageChangeName}(${p})">${p}</button>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageButtonsHtml += `<span class="page-ellipsis">&hellip;</span>`;
    }
    pageButtonsHtml += `<button type="button" class="btn-page ${currentPage === totalPages ? "active" : ""}" onclick="${onPageChangeName}(${totalPages})">${totalPages}</button>`;
  }

  return `
    <div class="pagination-bar">
      <div class="pagination-info">
        Menampilkan <strong>${startItem} - ${endItem}</strong> dari <strong>${totalItems}</strong> data laporan
      </div>
      <div class="pagination-buttons">
        <button type="button" class="btn-page-nav" ${currentPage <= 1 ? "disabled" : ""} onclick="${onPageChangeName}(${currentPage - 1})" title="Halaman Sebelumnya">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div class="page-numbers-group">
          ${pageButtonsHtml}
        </div>
        <button type="button" class="btn-page-nav" ${currentPage >= totalPages ? "disabled" : ""} onclick="${onPageChangeName}(${currentPage + 1})" title="Halaman Selanjutnya">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    </div>
  `;
};

window.changeKasirPage = (page) => {
  kasirCurrentPage = page;
  loadKasirHistory();
  document.getElementById("view-kasir-history")?.scrollIntoView({ behavior: "smooth" });
};

window.changeAdminPage = (page) => {
  adminCurrentPage = page;
  renderAdminDashboard();
  document.getElementById("view-admin")?.scrollIntoView({ behavior: "smooth" });
};

const loadKasirHistory = () => {
  const container = document.getElementById("historyContainer");

  if (firebaseReady && !window.isUsingLocalStorage && !firebaseDataLoaded) {
    container.innerHTML = '<div class="spinner" style="margin:auto;"></div>';
    return;
  }

  let reports = [...allReportsGlobal];
  reports = filterReportsByDate(
    reports,
    kasirFilterState.type,
    kasirFilterState.startDate,
    kasirFilterState.endDate,
  );

  if (reports.length === 0) {
    const isFiltered = kasirFilterState.type !== "all";
    container.innerHTML = isFiltered
      ? '<div class="text-center text-muted" style="padding: 32px 16px;"><i class="fa-solid fa-calendar-xmark" style="font-size: 2.2rem; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p style="font-weight:600; font-size: 0.95rem;">Tidak ada laporan ditemukan pada rentang waktu yang dipilih.</p><button type="button" class="btn btn-secondary btn-small" onclick="resetKasirFilterAction()" style="margin-top: 10px;"><i class="fa-solid fa-rotate-left"></i> Reset Filter Waktu</button></div>'
      : '<p class="text-muted text-center" style="padding:24px;">Belum ada riwayat laporan tersimpan.</p>';
    return;
  }

  reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const totalItems = reports.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  if (kasirCurrentPage > totalPages) kasirCurrentPage = totalPages;
  if (kasirCurrentPage < 1) kasirCurrentPage = 1;

  const startIndex = (kasirCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReports = reports.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  let html = `
    <div class="table-responsive">
      <table class="history-table">
        <thead>
          <tr>
            <th style="width: 28%;">Waktu & Tanggal</th>
            <th style="width: 22%;">Kasir</th>
            <th style="width: 25%;">Saldo Bersih Akhir</th>
            <th style="width: 25%; text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
  `;

  paginatedReports.forEach((item) => {
    html += `
      <tr id="kasir-row-${item.id}">
        <td data-label="Waktu">
          <div class="cell-time">
            <i class="fa-regular fa-calendar-days text-muted"></i>
            <div>
              <strong>${item.hari}, ${item.tanggal}</strong>
              <span class="badge-time">${item.jam}</span>
            </div>
          </div>
        </td>
        <td data-label="Kasir">
          <div class="cell-kasir">
            <span class="kasir-avatar">${(item.kasir || "K").charAt(0).toUpperCase()}</span>
            <span class="kasir-name">${item.kasir || "-"}</span>
          </div>
        </td>
        <td data-label="Saldo Akhir">
          <span class="badge-saldo text-green">Rp${formatNumber(item.saldoAkhir)}</span>
        </td>
        <td data-label="Aksi" style="text-align: right;">
          <div class="action-btn-group">
            <button class="btn-action btn-action-detail" onclick="toggleDetailKasir('${item.id}')" title="Lihat Rincian Laporan">
              <i class="fa-regular fa-eye"></i> <span>Rincian</span>
            </button>
            <button class="btn-action btn-action-edit" onclick="triggerEditMode('${item.id}')" title="Edit Laporan">
              <i class="fa-regular fa-pen-to-square"></i>
            </button>
            <button class="btn-action btn-action-delete" onclick="executeDelete('${item.id}')" title="Hapus Laporan">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
      <tr id="kasir-detail-${item.id}" class="hidden detail-row">
        <td colspan="4" style="padding: 0; border: none; background: transparent;">
          <div id="content-detail-${item.id}" style="padding-bottom: 16px;"></div>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table></div>`;
  html += renderPaginationControls(totalItems, kasirCurrentPage, "changeKasirPage");
  container.innerHTML = html;
};

window.toggleDetailKasir = (id) => {
  const item = allReportsGlobal.find((r) => (r.id || r.timestamp?.toString()) === String(id));
  if (item) {
    displayReportDetailModal(item);
  } else {
    customAlert(
      "Data rincian laporan tidak ditemukan atau telah dihapus.",
      "Data Tidak Ditemukan",
      "warning",
    );
  }
};

window.executeDelete = async (id) => {
  const item = allReportsGlobal.find((r) => (r.id || r.timestamp?.toString()) === id);
  const infoKasir = item?.kasir ? `Kasir: ${item.kasir}` : "Laporan ini";
  const infoTgl = item?.tanggal ? ` (${item.tanggal})` : "";

  const confirmed = await customConfirm(
    `Apakah Anda yakin ingin menghapus data ${infoKasir}${infoTgl} secara permanen dari database?`,
    "Hapus Laporan",
    "Ya, Hapus Permanen",
    "Batal",
    "danger",
  );

  if (confirmed) {
    if (firebaseReady && db) {
      const reportsRef = db.ref("reports");
      reportsRef
        .child(id)
        .remove()
        .then(() => {
          showToast("✅ Laporan Sukses Dihapus");
        })
        .catch(async (error) => {
          await customAlert(
            "Gagal menghapus laporan dari Firebase: " + error.message,
            "Gagal Hapus",
            "error",
          );
        });
    } else {
      const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");
      const idx = reports.findIndex((r) => (r.id || r.timestamp?.toString()) === id);
      if (idx !== -1) {
        reports.splice(idx, 1);
        localStorage.setItem("pmReports", JSON.stringify(reports));
        allReportsGlobal = reports;
        showToast("✅ Laporan Sukses Dihapus");
        onDataChanged();
      }
    }
  }
};

// --- 7. ALUR EDIT FORM KASIR ---
window.triggerEditMode = async (id) => {
  if (!db && !window.isUsingLocalStorage) {
    await customAlert("Sistem Database belum siap.", "Database Belum Siap", "warning");
    return;
  }

  const item = allReportsGlobal.find((r) => r.id === id);
  if (item) {
    loadDataForEdit(item);
  } else {
    await customAlert(
      "Data laporan tidak ditemukan.",
      "Data Tidak Ditemukan",
      "warning",
    );
  }
};

const loadDataForEdit = async (data) => {
  if (!data || !data.rawData) {
    console.error("[EDIT] Data mentah tidak valid:", data);
    await customAlert(
      "Data laporan ini tidak memiliki struktur lengkap untuk diedit.",
      "Data Tidak Valid",
      "error",
    );
    return;
  }

  const parsedRaw = {
    ...data.rawData,
    incomes: Array.isArray(data.rawData?.incomes) ? data.rawData.incomes : [],
    expenses: Array.isArray(data.rawData?.expenses)
      ? data.rawData.expenses
      : [],
  };

  window.isEditMode = true;

  editingId = data.id;
  editingTimestamp = data.timestamp;

  document.getElementById("hari").value = data.hari || "-";
  document.getElementById("tanggal").value = data.tanggal;
  document.getElementById("jam").value = data.jam;
  document.getElementById("kasir").value = data.kasir;
  document.getElementById("awalFc").value = parsedRaw.awalFc;
  document.getElementById("awalNasi").value = parsedRaw.awalNasi;

  if (parsedRaw.items && Array.isArray(parsedRaw.items)) {
    parsedRaw.items.forEach((item) => {
      const input =
        document.getElementById(`jual_${item.id}`) ||
        (item.id === "fc" ? document.getElementById("jualFc") : null) ||
        (item.id === "geprek" ? document.getElementById("jualGeprek") : null) ||
        (item.id === "nasi" ? document.getElementById("jualNasi") : null);
      if (input) input.value = item.qty || 0;
    });
  } else {
    if (document.getElementById("jualFc"))
      document.getElementById("jualFc").value = parsedRaw.jualFc || 0;
    if (document.getElementById("jualGeprek"))
      document.getElementById("jualGeprek").value = parsedRaw.jualGeprek || 0;
    if (document.getElementById("jualNasi"))
      document.getElementById("jualNasi").value = parsedRaw.jualNasi || 0;
  }

  const incList = document.getElementById("incomeList");
  const expList = document.getElementById("expenseList");
  incList.innerHTML = "";
  expList.innerHTML = "";

  parsedRaw.incomes.forEach((inc, idx) => {
    const safeUid = "inc_" + Date.now() + "_" + idx;
    incList.insertAdjacentHTML(
      "beforeend",
      `<div class="income-item" id="${safeUid}">
        <input type="text" class="income-desc" value="${inc.desc}">
        <input type="text" class="income-amount" value="Rp. ${formatNumber(inc.amount)}">
        <button type="button" class="btn-danger btn-icon-small" onclick="removeEl('${safeUid}')" title="Hapus"><i class="fas fa-trash"></i></button>
      </div>`,
    );
    document
      .getElementById(safeUid)
      .querySelector(".income-amount")
      .addEventListener("input", formatCurrencyInput);
  });

  parsedRaw.expenses.forEach((exp, idx) => {
    const safeUid = "exp_" + Date.now() + "_" + idx;
    expList.insertAdjacentHTML(
      "beforeend",
      `<div class="expense-item" id="${safeUid}">
        <input type="text" class="expense-desc" value="${exp.desc}">
        <input type="text" class="expense-amount" value="Rp. ${formatNumber(exp.amount)}">
        <button type="button" class="btn-danger btn-icon-small" onclick="removeEl('${safeUid}')" title="Hapus"><i class="fas fa-trash"></i></button>
      </div>`,
    );
    document
      .getElementById(safeUid)
      .querySelector(".expense-amount")
      .addEventListener("input", formatCurrencyInput);
  });

  calculateAll();

  document.getElementById("view-kasir-history").classList.add("hidden");
  document.getElementById("view-kasir").classList.remove("hidden");

  appHeader.style.backgroundColor = "#D62828";
  document.getElementById("mainTitle").textContent = "MODE EDIT DATA";
  document.getElementById("subTitle").textContent =
    `Sedang memperbaiki data tanggal: ${data.tanggal}`;

  const btnSimpan = document.getElementById("btnSimpanKirim");
  btnSimpan.className = "btn btn-orange btn-large";
  btnSimpan.innerHTML = '<i class="fas fa-save"></i> Simpan Perubahan Data';

  document.getElementById("btnKirimWAEdit").classList.remove("hidden");
  document.getElementById("btnBatalEdit").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => {
    document.getElementById("kasir").focus();
  }, 100);
};

const exitEditMode = () => {
  editingId = null;
  editingTimestamp = null;
  window.isEditMode = false;

  appHeader.style.backgroundColor = "#D62828";
  document.getElementById("mainTitle").textContent =
    "PM Fried Chicken Kendayakan";
  document.getElementById("subTitle").textContent =
    "Sistem Rekap Penjualan Harian";

  const btnSimpan = document.getElementById("btnSimpanKirim");
  btnSimpan.className = "btn btn-primary btn-large";
  btnSimpan.innerHTML = '<i class="fas fa-save"></i> Simpan dan Kirim WA';

  document.getElementById("btnKirimWAEdit").classList.add("hidden");
  document.getElementById("btnBatalEdit").classList.add("hidden");

  resetForm();
  document.getElementById("jam").value = "";
  setupDateTime();
  window.scrollTo(0, 0);
};

document.getElementById("btnBatalEdit").addEventListener("click", async () => {
  const confirmed = await customConfirm(
    "Apakah Anda yakin ingin membatalkan pengeditan data ini?",
    "Batalkan Edit",
    "Ya, Batalkan",
    "Lanjut Edit",
    "warning",
  );
  if (confirmed) {
    exitEditMode();
    showToast("Edit Dibatalkan");
  }
});

// --- 8. DASHBOARD ADMIN (OWNER VIEW) ---
const renderAdminDashboard = () => {
  renderAdminProductGrid();
  const container = document.getElementById("adminHistoryContainer");

  if (firebaseReady && !window.isUsingLocalStorage && !firebaseDataLoaded) {
    container.innerHTML = '<div class="spinner" style="margin:auto;"></div>';
    return;
  }

  const reports = [...allReportsGlobal];

  if (reports.length === 0) {
    document.getElementById("statToday").textContent = formatRupiah(0);
    document.getElementById("statMonth").textContent = formatRupiah(0);
    document.getElementById("statTotalDoc").textContent = 0;
    container.innerHTML =
      '<p class="text-muted text-center" style="padding: 24px;">Belum ada data rekap laporan masuk.</p>';
    return;
  }

  const todayStr = `${new Date().getDate().toString().padStart(2, "0")}/${(new Date().getMonth() + 1).toString().padStart(2, "0")}/${new Date().getFullYear()}`;
  const monthStr = `${(new Date().getMonth() + 1).toString().padStart(2, "0")}/${new Date().getFullYear()}`;

  let saldoToday = 0,
    saldoMonth = 0;
  reports.forEach((item) => {
    if (item.tanggal === todayStr) saldoToday += item.saldoAkhir || 0;
    if (item.tanggal && item.tanggal.includes(monthStr)) saldoMonth += item.saldoAkhir || 0;
  });

  document.getElementById("statToday").textContent = formatRupiah(saldoToday);
  document.getElementById("statMonth").textContent = formatRupiah(saldoMonth);
  document.getElementById("statTotalDoc").textContent = reports.length;

  let filteredReports = filterReportsByDate(
    reports,
    adminFilterState.type,
    adminFilterState.startDate,
    adminFilterState.endDate,
  );

  // Update Status Badges for Chart and Database Table
  let badgeText = "7 Hari Terakhir";
  if (adminFilterState.type === "today") badgeText = `Hari Ini (${todayStr})`;
  else if (adminFilterState.type === "thisMonth") badgeText = `Bulan Ini (${monthStr})`;
  else if (adminFilterState.type === "all") badgeText = "Semua Waktu";
  else if (adminFilterState.type === "custom") {
    badgeText = `${adminFilterState.startDate || "Awal"} s/d ${adminFilterState.endDate || "Akhir"}`;
  }

  const chartBadge = document.getElementById("chartFilterStatusBadge");
  const tableBadge = document.getElementById("tableFilterStatusBadge");
  if (chartBadge) chartBadge.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${badgeText}`;
  if (tableBadge) tableBadge.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${badgeText}`;

  updateAdminChart(filteredReports);

  if (filteredReports.length === 0) {
    const isFiltered = adminFilterState.type !== "all";
    container.innerHTML = isFiltered
      ? '<div class="text-center text-muted" style="padding: 32px 16px;"><i class="fa-solid fa-calendar-xmark" style="font-size: 2.2rem; margin-bottom: 12px; display: block; opacity: 0.4;"></i><p style="font-weight:600; font-size: 0.95rem;">Tidak ada laporan ditemukan pada rentang waktu yang dipilih.</p><button type="button" class="btn btn-secondary btn-small" onclick="resetAdminFilterAction()" style="margin-top: 10px;"><i class="fa-solid fa-rotate-left"></i> Reset Filter (7 Hari)</button></div>'
      : '<p class="text-muted text-center" style="padding: 24px;">Belum ada data rekap laporan masuk.</p>';
    return;
  }

  filteredReports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const totalItems = filteredReports.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  if (adminCurrentPage > totalPages) adminCurrentPage = totalPages;
  if (adminCurrentPage < 1) adminCurrentPage = 1;

  const startIndex = (adminCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  let html = `
    <div class="table-responsive">
      <table class="history-table">
        <thead>
          <tr>
            <th style="width: 28%;">Waktu & Tanggal</th>
            <th style="width: 22%;">Kasir</th>
            <th style="width: 25%;">Saldo Bersih Akhir</th>
            <th style="width: 25%; text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
  `;

  paginatedReports.forEach((item) => {
    const itemId = item.id || item.timestamp?.toString() || "";
    html += `
      <tr id="admin-row-${itemId}">
        <td data-label="Waktu">
          <div class="cell-time">
            <i class="fa-regular fa-calendar-days text-muted"></i>
            <div>
              <strong>${item.hari}, ${item.tanggal}</strong>
              <span class="badge-time">${item.jam}</span>
            </div>
          </div>
        </td>
        <td data-label="Kasir">
          <div class="cell-kasir">
            <span class="kasir-avatar">${(item.kasir || "K").charAt(0).toUpperCase()}</span>
            <span class="kasir-name">${item.kasir || "-"}</span>
          </div>
        </td>
        <td data-label="Saldo Akhir">
          <span class="badge-saldo text-green">Rp${formatNumber(item.saldoAkhir)}</span>
        </td>
        <td data-label="Aksi" style="text-align: right;">
          <div class="action-btn-group">
            <button class="btn-action btn-action-detail" onclick="toggleAdminDetail('${itemId}')" title="Lihat Rincian Laporan">
              <i class="fa-regular fa-eye"></i> <span>Rincian</span>
            </button>
            <button class="btn-action btn-action-delete" onclick="executeDelete('${itemId}')" title="Hapus Permanen">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
      <tr id="admin-detail-${itemId}" class="hidden detail-row">
        <td colspan="4" style="padding: 0; border: none; background: transparent;">
          <div id="admin-content-${itemId}" style="padding-bottom: 16px;"></div>
        </td>
      </tr>
    `;
  });
  html += `</tbody></table></div>`;
  html += renderPaginationControls(totalItems, adminCurrentPage, "changeAdminPage");
  container.innerHTML = html;
};

window.toggleAdminDetail = (id) => {
  const item = allReportsGlobal.find((r) => (r.id || r.timestamp?.toString()) === String(id));
  if (item) {
    displayReportDetailModal(item);
  } else {
    customAlert(
      "Data rincian laporan tidak ditemukan.",
      "Data Tidak Ditemukan",
      "warning",
    );
  }
};

const updateAdminChart = (filteredData = null) => {
  if (!allReportsGlobal || allReportsGlobal.length === 0) return;

  const currentType = adminFilterState.type || "7days";
  const dataset = filteredData !== null ? filteredData : filterReportsByDate(
    allReportsGlobal,
    currentType,
    adminFilterState.startDate,
    adminFilterState.endDate,
  );

  let labels = [];
  let chartData = [];

  if (currentType === "7days") {
    // Generate 7 consecutive days [D-6 to Today] for clean continuous visual line
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const now = new Date();
    const daysMap = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
      const dayLabel = `${dayNames[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
      daysMap.push({ dateStr, label: dayLabel, amount: 0 });
    }

    dataset.forEach((item) => {
      const entry = daysMap.find((d) => d.dateStr === item.tanggal);
      if (entry) {
        entry.amount += item.saldoAkhir || 0;
      }
    });

    labels = daysMap.map((d) => d.label);
    chartData = daysMap.map((d) => d.amount);
  } else {
    const map = new Map();
    dataset.forEach((item) => {
      const dDate = parseIndoDate(item.tanggal);
      const key = item.tanggal || "-";

      const current = map.get(key) || { amount: 0, sortDate: dDate };
      map.set(key, {
        amount: current.amount + (item.saldoAkhir || 0),
        sortDate: current.sortDate,
      });
    });

    const sortedEntries = Array.from(map.entries()).sort(
      (a, b) => a[1].sortDate - b[1].sortDate,
    );

    labels = sortedEntries.map((e) => e[0]);
    chartData = sortedEntries.map((e) => e[1].amount);
  }

  const ctx = document.getElementById("salesChart");
  if (ctx) {
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new window.Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Pendapatan Bersih (Rp)",
            data: chartData,
            backgroundColor: "rgba(214, 40, 40, 0.12)",
            borderColor: "#D62828",
            borderWidth: 2.5,
            pointBackgroundColor: "#D62828",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4.5,
            pointHoverRadius: 6.5,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              font: { family: "Inter", weight: "600" },
              color: "#64748b",
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `Pendapatan: Rp ${formatNumber(context.parsed.y)}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => "Rp " + formatNumber(value),
              font: { family: "Inter" },
              color: "#64748b",
            },
            grid: {
              color: "rgba(226, 232, 240, 0.6)",
            },
          },
          x: {
            ticks: {
              font: { family: "Inter" },
              color: "#64748b",
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }
};

// --- 9. GENERATE UNDUH LAPORAN PDF ---
const pdfFilterTypeEl = document.getElementById("pdfFilterType");
if (pdfFilterTypeEl) {
  pdfFilterTypeEl.addEventListener("change", function () {
    const val = this.value;
    const filterHarian = document.getElementById("filterHarian");
    const filterBulanan = document.getElementById("filterBulanan");
    const filterCustom = document.getElementById("filterCustom");
    const hintEl = document.getElementById("pdfFilterHint");

    if (filterHarian) filterHarian.classList.add("hidden");
    if (filterBulanan) filterBulanan.classList.add("hidden");
    if (filterCustom) filterCustom.classList.add("hidden");

    if (val === "harian") {
      if (filterHarian) filterHarian.classList.remove("hidden");
      if (hintEl) {
        hintEl.innerHTML = `
          <i class="fa-solid fa-circle-info"></i>
          <span>Pilih satu tanggal tertentu untuk mencetak rekapan transaksi hari tersebut.</span>
        `;
      }
    } else if (val === "bulanan") {
      if (filterBulanan) filterBulanan.classList.remove("hidden");
      if (hintEl) {
        hintEl.innerHTML = `
          <i class="fa-solid fa-circle-info"></i>
          <span>Pilih satu bulan tertentu untuk mencetak semua rekapan transaksi dalam bulan tersebut.</span>
        `;
      }
    } else if (val === "custom") {
      if (filterCustom) filterCustom.classList.remove("hidden");
      if (hintEl) {
        hintEl.innerHTML = `
          <i class="fa-solid fa-circle-info"></i>
          <span>Tentukan rentang tanggal mulai dan akhir untuk mencetak dokumen rekapan.</span>
        `;
      }
    } else if (val === "mingguan") {
      if (hintEl) {
        hintEl.innerHTML = `
          <i class="fa-solid fa-circle-info"></i>
          <span>Mencakup seluruh rekapan transaksi 7 hari terakhir dari hari ini.</span>
        `;
      }
    } else {
      if (hintEl) {
        hintEl.innerHTML = `
          <i class="fa-solid fa-circle-info"></i>
          <span>Mencakup seluruh data transaksi &amp; rekapan yang tersimpan di sistem database.</span>
        `;
      }
    }
  });
}

document.getElementById("btnDownloadPdf").addEventListener("click", async () => {
  if (!allReportsGlobal || allReportsGlobal.length === 0) {
    await customAlert(
      "Tidak ada data laporan di database untuk dicetak.",
      "Data Kosong",
      "info",
    );
    return;
  }
  const filterType = document.getElementById("pdfFilterType").value;

  let paramHarian = document.getElementById("dateHarian").value;
  let paramBulanan = document.getElementById("dateBulanan").value;
  let paramStart = document.getElementById("dateStart").value;
  let paramEnd = document.getElementById("dateEnd").value;

  let dataToPrint = [...allReportsGlobal];

  if (filterType === "harian") {
    if (!paramHarian) {
      await customAlert(
        "Mohon pilih tanggal laporan yang ingin dicetak.",
        "Pilih Tanggal",
        "warning",
      );
      return;
    }
    const tgt = new Date(paramHarian);
    const strTgt = `${tgt.getDate().toString().padStart(2, "0")}/${(tgt.getMonth() + 1).toString().padStart(2, "0")}/${tgt.getFullYear()}`;
    dataToPrint = dataToPrint.filter((d) => d.tanggal === strTgt);
  } else if (filterType === "mingguan") {
    const now = new Date();
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    dataToPrint = dataToPrint.filter((d) => {
      const dDate = parseIndoDate(d.tanggal);
      return dDate >= last7Days && dDate <= now;
    });
  } else if (filterType === "bulanan") {
    if (!paramBulanan) {
      await customAlert(
        "Mohon pilih bulan laporan yang ingin dicetak.",
        "Pilih Bulan",
        "warning",
      );
      return;
    }
    const parts = paramBulanan.split("-");
    const strTgt = `${parts[1]}/${parts[0]}`;
    dataToPrint = dataToPrint.filter((d) => d.tanggal && d.tanggal.includes(strTgt));
  } else if (filterType === "custom") {
    if (!paramStart || !paramEnd) {
      await customAlert(
        "Mohon lengkapi rentang tanggal mulai dan akhir.",
        "Rentang Belum Lengkap",
        "warning",
      );
      return;
    }
    const startDate = new Date(paramStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(paramEnd);
    endDate.setHours(23, 59, 59, 999);

    dataToPrint = dataToPrint.filter((d) => {
      const dDate = parseIndoDate(d.tanggal);
      return dDate >= startDate && dDate <= endDate;
    });
  }

  if (dataToPrint.length === 0) {
    await customAlert(
      "Tidak ada data laporan yang ditemukan pada rentang waktu tersebut.",
      "Data Tidak Ditemukan",
      "info",
    );
    return;
  }

  document.getElementById("loading").classList.remove("hidden");

  const executePDFGeneration = async () => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "pt", "a4");
      dataToPrint.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      const pageCenter = doc.internal.pageSize.getWidth() / 2;
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.setTextColor(214, 40, 40);
      doc.text("LAPORAN REKAP PENJUALAN", pageCenter, 45, { align: "center" });
      doc.setFontSize(14);
      doc.setFont(undefined, "normal");
      doc.setTextColor(40, 40, 40);
      doc.text("PM Fried Chicken Kendayakan", pageCenter, 63, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("Kendayakan, Terisi, Indramayu", pageCenter, 78, { align: "center" });

      doc.setLineWidth(1.5);
      doc.setDrawColor(214, 40, 40);
      doc.line(40, 95, 555, 95);

      let textPeriode = "Semua Waktu";
      if (filterType === "harian") textPeriode = paramHarian;
      if (filterType === "mingguan") textPeriode = `7 Hari Terakhir`;
      if (filterType === "bulanan") textPeriode = paramBulanan;
      if (filterType === "custom")
        textPeriode = `${paramStart} s/d ${paramEnd}`;

      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Periode Laporan : ${textPeriode}`, 40, 115);
      doc.text(
        `Waktu Cetak     : ${new Date().toLocaleString("id-ID")}`,
        40,
        130,
      );

      let sumPenjualan = 0;
      let sumPemasukan = 0;
      let sumPengeluaran = 0;
      let sumSaldo = 0;

      const tableData = dataToPrint.map((item, index) => {
        sumPenjualan += item.penjualan || 0;
        let itemInc = 0;
        let itemExp = 0;
        const incomes = item?.rawData?.incomes || [];
        const expenses = item?.rawData?.expenses || [];

        if (incomes && incomes.forEach) {
          incomes.forEach((i) => (itemInc += i?.amount || 0));
        }
        if (expenses && expenses.forEach) {
          expenses.forEach((e) => (itemExp += e?.amount || 0));
        }
        sumPemasukan += itemInc;
        sumPengeluaran += itemExp;
        sumSaldo += item.saldoAkhir || 0;

        return [
          index + 1,
          `${item.hari}, ${item.tanggal}\n(${item.jam})`,
          item.kasir,
          `Rp ${formatNumber(item.penjualan)}`,
          `Rp ${formatNumber(itemInc)}`,
          `Rp ${formatNumber(itemExp)}`,
          `Rp ${formatNumber(item.saldoAkhir)}`,
        ];
      });

      doc.autoTable({
        startY: 145,
        head: [
          [
            "No",
            "Hari/Tanggal",
            "Kasir",
            "Penjualan",
            "Pend. Lain",
            "Pengeluaran",
            "Saldo Bersih",
          ],
        ],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [214, 40, 40], textColor: [255, 255, 255] },
        styles: { fontSize: 9, cellPadding: 5 },
        columnStyles: {
          0: { halign: "center", cellWidth: 30 },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right" },
          6: { halign: "right", fontStyle: "bold" },
        },
      });

      const summaryData = [
        ["Total Penjualan Kotor", `Rp ${formatNumber(sumPenjualan)}`],
        ["Total Pemasukan Tambahan", `Rp ${formatNumber(sumPemasukan)}`],
        ["Total Pengeluaran", `Rp ${formatNumber(sumPengeluaran)}`],
        ["TOTAL LABA / SALDO BERSIH", `Rp ${formatNumber(sumSaldo)}`],
      ];

      doc.autoTable({
        startY: doc.lastAutoTable.finalY + 20,
        body: summaryData,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 6 },
        columnStyles: {
          0: { fontStyle: "bold", fillColor: [244, 246, 249] },
          1: { halign: "right", fontStyle: "bold" },
        },
        willDrawCell: function (data) {
          if (data.row.index === 3 && data.section === "body") {
            data.cell.styles.textColor = [230, 81, 0];
          }
          if (
            data.row.index === 2 &&
            data.section === "body" &&
            data.column.index === 1
          ) {
            data.cell.styles.textColor = [214, 40, 40];
          }
        },
      });

      const safePeriode = textPeriode.replace(/[\/\\]/g, "-");
      doc.save(`Laporan Penjualan PMFC (${safePeriode}).pdf`);
      showToast("✅ File PDF Berhasil Dibuat");
    } catch (err) {
      console.error(err);
      await customAlert(
        "Terjadi kesalahan sistem saat menyusun file PDF.",
        "Gagal Cetak PDF",
        "error",
      );
    } finally {
      document.getElementById("loading").classList.add("hidden");
    }
  };

  executePDFGeneration();
});

// UI Triggers Tambahan
window.closeModal = (id) => {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("hidden");
    el.style.display = "none";
  }
};

let toastTimer = null;

const showToast = (msg, reportId = null, subtext = null) => {
  const toast = document.getElementById("toast");
  if (!toast) return;

  clearTimeout(toastTimer);

  const cleanMsg = msg ? String(msg).replace(/^[✅✨🎉🔔🍗✏️]\s*/, "") : "";

  if (reportId) {
    toast.dataset.reportId = String(reportId);
    toast.classList.add("clickable-toast");
    toast.innerHTML = `
      <div class="toast-inner-clickable">
        <i class="fa-solid fa-file-invoice-dollar text-primary toast-lead-icon"></i>
        <div class="toast-body-content">
          <strong class="toast-main-title">${cleanMsg}</strong>
          ${subtext ? `<span class="toast-subtext">${subtext}</span>` : ""}
        </div>
        <span class="toast-tap-hint"><i class="fa-solid fa-chevron-right"></i></span>
      </div>
    `;
    toast.onclick = (e) => {
      e.stopPropagation();
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 200);
      if (reportId) {
        openNotificationDetail(null, reportId);
      }
    };
  } else {
    delete toast.dataset.reportId;
    toast.classList.remove("clickable-toast");
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-green"></i> <span>${cleanMsg}</span>`;
    toast.onclick = (e) => {
      e.stopPropagation();
      toast.classList.remove("show");
      setTimeout(() => toast.classList.add("hidden"), 200);
    };
  }

  toast.classList.remove("hidden");
  void toast.offsetWidth; // Trigger reflow for animation
  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, reportId ? 5000 : 3200);
};

document.getElementById("btnPreview").addEventListener("click", async () => {
  const isValid = await validateForm();
  if (isValid) {
    document.getElementById("previewText").textContent = generateReportText();
    document.getElementById("previewModal").classList.remove("hidden");
  }
});

document.getElementById("btnKirimModal").addEventListener("click", () => {
  const text = document.getElementById("previewText").textContent;
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
  );
  closeModal("previewModal");
});

// --- 9. FILTER WAKTU RIWAYAT DATABASE ---
const setupHistoryFilterListeners = () => {
  // Kasir Filter
  const kasirFilterRange = document.getElementById("kasirFilterRange");
  const kasirCustomWrap = document.getElementById("kasirCustomDateWrap");
  const btnApplyKasir = document.getElementById("btnApplyKasirFilter");
  const btnResetKasir = document.getElementById("btnResetKasirFilter");

  if (kasirFilterRange) {
    kasirFilterRange.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "custom") {
        kasirCustomWrap?.classList.remove("hidden");
      } else {
        kasirCustomWrap?.classList.add("hidden");
        kasirFilterState.type = val;
        kasirFilterState.startDate = "";
        kasirFilterState.endDate = "";
        kasirCurrentPage = 1;
        if (btnResetKasir) {
          if (val === "all") btnResetKasir.classList.add("hidden");
          else btnResetKasir.classList.remove("hidden");
        }
        loadKasirHistory();
      }
    });
  }

  if (btnApplyKasir) {
    btnApplyKasir.addEventListener("click", () => {
      const start = document.getElementById("kasirDateStart")?.value;
      const end = document.getElementById("kasirDateEnd")?.value;
      if (!start && !end) {
        customAlert(
          "Silakan pilih tanggal awal atau akhir terlebih dahulu.",
          "Pilih Tanggal",
          "warning",
        );
        return;
      }
      kasirFilterState.type = "custom";
      kasirFilterState.startDate = start;
      kasirFilterState.endDate = end;
      kasirCurrentPage = 1;
      if (btnResetKasir) btnResetKasir.classList.remove("hidden");
      loadKasirHistory();
    });
  }

  window.resetKasirFilterAction = () => {
    kasirFilterState = { type: "all", startDate: "", endDate: "" };
    if (kasirFilterRange) {
      kasirFilterRange.value = "all";
      kasirFilterRange.dispatchEvent(new Event("change"));
    }
    if (kasirCustomWrap) kasirCustomWrap.classList.add("hidden");
    const sInput = document.getElementById("kasirDateStart");
    const eInput = document.getElementById("kasirDateEnd");
    if (sInput) sInput.value = "";
    if (eInput) eInput.value = "";
    if (btnResetKasir) btnResetKasir.classList.add("hidden");
    kasirCurrentPage = 1;
    loadKasirHistory();
  };

  if (btnResetKasir) {
    btnResetKasir.addEventListener("click", window.resetKasirFilterAction);
  }

  // Admin Unified Filter (Grafik & Database)
  const adminUnifiedFilter = document.getElementById("adminUnifiedFilter");
  const adminUnifiedCustomWrap = document.getElementById("adminUnifiedCustomDates");
  const btnApplyAdmin = document.getElementById("btnApplyAdminUnifiedFilter");
  const btnResetAdmin = document.getElementById("btnResetAdminUnifiedFilter");

  if (adminUnifiedFilter) {
    adminUnifiedFilter.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "custom") {
        adminUnifiedCustomWrap?.classList.remove("hidden");
      } else {
        adminUnifiedCustomWrap?.classList.add("hidden");
        adminFilterState.type = val;
        adminFilterState.startDate = "";
        adminFilterState.endDate = "";
        adminCurrentPage = 1;

        if (btnResetAdmin) {
          if (val === "7days") btnResetAdmin.classList.add("hidden");
          else btnResetAdmin.classList.remove("hidden");
        }
        renderAdminDashboard();
      }
    });
  }

  if (btnApplyAdmin) {
    btnApplyAdmin.addEventListener("click", () => {
      const start = document.getElementById("adminDateStart")?.value;
      const end = document.getElementById("adminDateEnd")?.value;
      if (!start && !end) {
        customAlert(
          "Silakan pilih tanggal awal atau akhir terlebih dahulu.",
          "Pilih Tanggal",
          "warning",
        );
        return;
      }
      adminFilterState.type = "custom";
      adminFilterState.startDate = start;
      adminFilterState.endDate = end;
      adminCurrentPage = 1;
      if (btnResetAdmin) btnResetAdmin.classList.remove("hidden");
      renderAdminDashboard();
    });
  }

  window.resetAdminFilterAction = () => {
    adminFilterState = { type: "7days", startDate: "", endDate: "" };
    if (adminUnifiedFilter) {
      adminUnifiedFilter.value = "7days";
      adminUnifiedFilter.dispatchEvent(new Event("change"));
    }
    if (adminUnifiedCustomWrap) adminUnifiedCustomWrap.classList.add("hidden");
    const sInput = document.getElementById("adminDateStart");
    const eInput = document.getElementById("adminDateEnd");
    if (sInput) sInput.value = "";
    if (eInput) eInput.value = "";
    if (btnResetAdmin) btnResetAdmin.classList.add("hidden");
    adminCurrentPage = 1;
    renderAdminDashboard();
  };

  if (btnResetAdmin) {
    btnResetAdmin.addEventListener("click", window.resetAdminFilterAction);
  }
};

// --- 10. UNIVERSAL CUSTOM UI DROPDOWN SYSTEM ---
function initCustomSelects() {
  const selects = document.querySelectorAll("select:not(.custom-select-native)");

  selects.forEach((nativeSelect) => {
    if (nativeSelect.parentElement.classList.contains("custom-select-wrapper")) return;

    nativeSelect.classList.add("custom-select-native");
    nativeSelect.style.cssText =
      "display: none !important; position: absolute !important; opacity: 0 !important; pointer-events: none !important; width: 0 !important; height: 0 !important;";

    const wrapper = document.createElement("div");
    wrapper.className = "custom-select-wrapper";
    nativeSelect.parentNode.insertBefore(wrapper, nativeSelect);
    wrapper.appendChild(nativeSelect);

    const selectedOption =
      nativeSelect.options[nativeSelect.selectedIndex] || nativeSelect.options[0];
    const initialText = selectedOption ? selectedOption.text : "";

    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    trigger.innerHTML = `
      <span class="trigger-text">${initialText}</span>
      <i class="fa-solid fa-chevron-down select-chevron"></i>
    `;
    wrapper.appendChild(trigger);

    const dropdown = document.createElement("div");
    dropdown.className = "custom-select-dropdown";

    const renderOptions = () => {
      dropdown.innerHTML = "";
      Array.from(nativeSelect.options).forEach((opt) => {
        const item = document.createElement("div");
        item.className = `custom-select-option ${opt.selected ? "selected" : ""}`;
        item.dataset.value = opt.value;
        item.innerHTML = `
          <span>${opt.text}</span>
          <i class="fa-solid fa-check option-check"></i>
        `;
        item.addEventListener("click", (e) => {
          e.stopPropagation();
          nativeSelect.value = opt.value;
          trigger.querySelector(".trigger-text").textContent = opt.text;
          dropdown
            .querySelectorAll(".custom-select-option")
            .forEach((el) => el.classList.remove("selected"));
          item.classList.add("selected");
          wrapper.classList.remove("open");
          nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
        });
        dropdown.appendChild(item);
      });
    };

    renderOptions();
    wrapper.appendChild(dropdown);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = wrapper.classList.contains("open");
      document.querySelectorAll(".custom-select-wrapper.open").forEach((w) => {
        if (w !== wrapper) w.classList.remove("open");
      });
      wrapper.classList.toggle("open", !isOpen);
    });

    nativeSelect.addEventListener("change", () => {
      const currentOpt = nativeSelect.options[nativeSelect.selectedIndex];
      if (currentOpt) {
        trigger.querySelector(".trigger-text").textContent = currentOpt.text;
        dropdown.querySelectorAll(".custom-select-option").forEach((el) => {
          el.classList.toggle("selected", el.dataset.value === currentOpt.value);
        });
      }
    });
  });
};

function toggleDarkModeAction() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("pm_darkmode", isDark ? "true" : "false");
  updateThemeIcons(isDark);
  if (typeof showToast === "function") {
    showToast(isDark ? "Mode Gelap aktif" : "Mode Terang aktif");
  }
}
window.toggleDarkModeAction = toggleDarkModeAction;

function updateThemeIcons(isDark) {
  const menuThemeIcon = document.getElementById("menuThemeIcon");
  const menuThemeText = document.getElementById("menuThemeText");

  if (menuThemeIcon) {
    menuThemeIcon.className = isDark ? "fas fa-sun" : "fas fa-moon";
  }
  if (menuThemeText) {
    menuThemeText.textContent = isDark ? "Mode Terang" : "Mode Gelap";
  }
}
window.updateThemeIcons = updateThemeIcons;

document.addEventListener("click", () => {
  document.querySelectorAll(".custom-select-wrapper.open").forEach((w) => {
    w.classList.remove("open");
  });
  if (userAccountWrapper) {
    userAccountWrapper.classList.remove("open");
  }
});

// --- 11. PROGRESSIVE WEB APP (PWA) INSTALL SYSTEM ---
let deferredInstallPrompt = null;

function isAppInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.includes("android-app://")
  );
}

function updatePWAInstallUI() {
  const menuInstallBtn = document.getElementById("menuInstallApp");
  const menuInstallText = document.getElementById("menuInstallText");
  const menuInstallIcon = document.getElementById("menuInstallIcon");

  if (!menuInstallBtn) return;

  if (isAppInstalled()) {
    menuInstallBtn.classList.add("hidden");
  } else {
    menuInstallBtn.classList.remove("hidden");
    if (menuInstallText) menuInstallText.textContent = "Install Aplikasi";
    if (menuInstallIcon) menuInstallIcon.className = "fa-solid fa-download";
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  updatePWAInstallUI();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updatePWAInstallUI();
  if (typeof showToast === "function") {
    showToast("Aplikasi PM Rekap berhasil diinstall!");
  }
});

window.handleUserInstallApp = async (e) => {
  if (e) e.stopPropagation();
  const wrapper = document.getElementById("userAccountWrapper");
  if (wrapper) wrapper.classList.remove("open");

  if (isAppInstalled()) {
    await customAlert(
      "Aplikasi PM Fried Chicken Rekap sudah terpasang di perangkat Anda.",
      "Aplikasi Terpasang",
      "success",
    );
    return;
  }

  // 1. Android & Desktop Chrome/Edge Native Prompt
  if (deferredInstallPrompt) {
    try {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === "accepted") {
        if (typeof showToast === "function") {
          showToast("Memulai instalasi aplikasi...");
        }
      }
      deferredInstallPrompt = null;
      updatePWAInstallUI();
      return;
    } catch (err) {
      console.warn("PWA prompt error:", err);
    }
  }

  // 2. iOS Safari instructions
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    await customAlert(
      "Untuk menginstall aplikasi di iPhone/iPad:\n\n1. Ketuk ikon Bagikan (Share / kotak tanda panah ke atas) di bilah bawah Safari.\n2. Gulir ke bawah lalu pilih 'Tambah ke Layar Utama' (Add to Home Screen).\n3. Ketuk 'Tambah' di pojok kanan atas.",
      "Panduan Install iOS",
      "info",
    );
    return;
  }

  // 3. Desktop / Android Browser general fallback instructions
  await customAlert(
    "Untuk menginstall aplikasi ini:\n\n• Di Desktop (Chrome/Edge): Klik ikon Install (+) di bilah alamat browser (URL bar) atau menu browser > 'Install PM Rekap'.\n• Di Android: Buka menu browser (titik tiga) > 'Tambahkan ke Layar Utama' / 'Install Aplikasi'.",
    "Install Aplikasi",
    "info",
  );
};

function initPWA() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => {
        console.log("✅ Service Worker PWA terdaftar:", reg.scope);
        reg.update();
      })
      .catch((err) => {
        console.warn("⚠️ Gagal mendaftarkan Service Worker:", err);
      });
  }
  updatePWAInstallUI();
}

window.addEventListener("DOMContentLoaded", () => {
  setupQtyControls();
  setupHistoryFilterListeners();
  initCustomSelects();
  initPWA();
  updateNotificationBadges();

  const isDark = localStorage.getItem("pm_darkmode") === "true";
  if (isDark) document.body.classList.add("dark-mode");
  updateThemeIcons(isDark);

  // Restore active user session on PWA/browser refresh
  const savedRole = localStorage.getItem("pm_logged_role");
  if (savedRole === "kasir" || savedRole === "admin") {
    switchView(savedRole);
  } else {
    hideAppInitLoader();
  }
});
