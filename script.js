// Konfigurasi Harga
const HARGA = { fc: 10000, geprek: 13000, nasi: 3000 };

// --- DATABASE (IndexedDB) SETUP ---
let db;
const request = indexedDB.open("PMRekapDB", 1);

request.onupgradeneeded = function (event) {
  db = event.target.result;
  if (!db.objectStoreNames.contains("reports")) {
    db.createObjectStore("reports", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = function (event) {
  db = event.target.result;
};
request.onerror = function (event) {
  console.error("Database error:", event.target.errorCode);
};

const saveToDatabase = (reportText, kasir, totalPenjualan, totalSaldo) => {
  if (!db) return;
  const transaction = db.transaction(["reports"], "readwrite");
  const store = transaction.objectStore("reports");
  const data = {
    tanggal: document.getElementById("tanggal").value,
    jam: document.getElementById("jam").value,
    kasir: kasir,
    penjualan: totalPenjualan,
    saldoAkhir: totalSaldo,
    laporanLengkap: reportText,
    timestamp: new Date().getTime(),
  };
  store.add(data);
};

const loadHistory = () => {
  if (!db) return;
  const historyContainer = document.getElementById("historyContainer");
  historyContainer.innerHTML =
    '<div class="spinner" style="margin:auto;"></div>';

  const transaction = db.transaction(["reports"], "readonly");
  const store = transaction.objectStore("reports");
  const request = store.getAll();

  request.onsuccess = function () {
    const data = request.result;
    historyContainer.innerHTML = "";
    if (data.length === 0) {
      historyContainer.innerHTML =
        '<p class="text-muted text-center">Belum ada riwayat laporan tersimpan di database perangkat ini.</p>';
      return;
    }

    data.sort((a, b) => b.timestamp - a.timestamp);
    data.forEach((item) => {
      const html = `
                <div class="history-item">
                    <h4>${item.tanggal} <span style="font-size:0.8rem; color:var(--text-muted)">${item.jam}</span></h4>
                    <p><strong>Kasir:</strong> ${item.kasir}</p>
                    <p><strong>Penjualan:</strong> Rp${new Intl.NumberFormat("id-ID").format(item.penjualan)}</p>
                    <p><strong>Saldo Bersih:</strong> Rp${new Intl.NumberFormat("id-ID").format(item.saldoAkhir)}</p>
                    <button class="btn-small btn-secondary" onclick="viewHistoryText(${item.id})" style="margin-top:10px; width:100%"><i class="fas fa-file-alt"></i> Lihat Laporan Detail</button>
                    <pre id="historyText-${item.id}" class="hidden" style="margin-top:10px; background:var(--bg-color); padding:10px; border-radius:5px; font-size:0.8rem; white-space:pre-wrap;"></pre>
                </div>
            `;
      historyContainer.insertAdjacentHTML("beforeend", html);
    });
  };
};

window.viewHistoryText = (id) => {
  const preEl = document.getElementById(`historyText-${id}`);
  if (!preEl.classList.contains("hidden")) {
    preEl.classList.add("hidden");
    return;
  }

  const transaction = db.transaction(["reports"], "readonly");
  const store = transaction.objectStore("reports");
  const request = store.get(id);
  request.onsuccess = function () {
    preEl.textContent = request.result.laporanLengkap;
    preEl.classList.remove("hidden");
  };
};

// --- DOM ELEMENTS & APP LOGIC ---
const inputs = document.querySelectorAll(".calc-input");
const expenseList = document.getElementById("expenseList");
const incomeList = document.getElementById("incomeList");
const kasirInput = document.getElementById("kasir");

// Filter Input Nama Kasir (Hanya Menerima Huruf)
kasirInput.addEventListener("input", function () {
  this.value = this.value.replace(/[^a-zA-Z\s]/g, "");
});

const formatRupiah = (angka) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
const parseCurrency = (str) => {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, "")) || 0;
};

const formatCurrencyInput = (e) => {
  let val = e.target.value.replace(/[^0-9]/g, "");
  e.target.value =
    val === "" ? "" : "Rp. " + new Intl.NumberFormat("id-ID").format(val);
  calculateAll();
};

const validateNumberInput = (e) => {
  if (e.target.value < 0 || e.target.value === "") e.target.value = 0;
  calculateAll();
};

const setupDateTime = () => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const updateTime = () => {
    const now = new Date();
    document.getElementById("hari").value = days[now.getDay()];
    document.getElementById("tanggal").value =
      `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    document.getElementById("jam").value =
      `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  };
  updateTime();
  setInterval(updateTime, 60000);
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
  const jualFc = parseInt(document.getElementById("jualFc").value) || 0;
  const jualGeprek = parseInt(document.getElementById("jualGeprek").value) || 0;
  const jualNasi = parseInt(document.getElementById("jualNasi").value) || 0;
  const awalFc = parseInt(document.getElementById("awalFc").value) || 0;
  const awalNasi = parseInt(document.getElementById("awalNasi").value) || 0;

  const subFc = jualFc * HARGA.fc,
    subGeprek = jualGeprek * HARGA.geprek,
    subNasi = jualNasi * HARGA.nasi;
  document.getElementById("subFc").textContent = formatRupiah(subFc);
  document.getElementById("subGeprek").textContent = formatRupiah(subGeprek);
  document.getElementById("subNasi").textContent = formatRupiah(subNasi);

  const totalPenjualan = subFc + subGeprek + subNasi;
  document.getElementById("totalPenjualan").textContent =
    formatRupiah(totalPenjualan);
  document.getElementById("sumPenjualan").textContent =
    formatRupiah(totalPenjualan);

  const akhirFc = awalFc - (jualFc + jualGeprek),
    akhirNasi = awalNasi - jualNasi;
  document.getElementById("akhirFc").textContent = akhirFc;
  document.getElementById("akhirNasi").textContent = akhirNasi;
  document.getElementById("akhirFc").style.color =
    akhirFc < 0 ? "var(--red)" : "";
  document.getElementById("akhirNasi").style.color =
    akhirNasi < 0 ? "var(--red)" : "";

  let totalPemasukan = 0;
  document
    .querySelectorAll(".income-amount")
    .forEach((input) => (totalPemasukan += parseCurrency(input.value)));
  document.getElementById("totalPemasukan").textContent =
    formatRupiah(totalPemasukan);
  document.getElementById("sumPemasukan").textContent =
    formatRupiah(totalPemasukan);

  let totalPengeluaran = 0;
  document
    .querySelectorAll(".expense-amount")
    .forEach((input) => (totalPengeluaran += parseCurrency(input.value)));
  document.getElementById("totalPengeluaran").textContent =
    formatRupiah(totalPengeluaran);
  document.getElementById("sumPengeluaran").textContent =
    formatRupiah(totalPengeluaran);

  const saldoAkhir = totalPenjualan + totalPemasukan - totalPengeluaran;
  document.getElementById("saldoAkhir").textContent = formatRupiah(saldoAkhir);
};

// --- LOGIKA VALIDASI TAMBAH BARIS PEMASUKAN & PENGELUARAN ---
document.getElementById("btnAddIncome").addEventListener("click", () => {
  // Pencegahan jika baris sebelumnya kosong
  const existingItems = incomeList.querySelectorAll(".income-item");
  for (let item of existingItems) {
    const desc = item.querySelector(".income-desc").value.trim();
    const amount = parseCurrency(item.querySelector(".income-amount").value);
    if (!desc || amount <= 0) {
      alert(
        "⚠️ Harap lengkapi Keterangan dan Jumlah pada baris Pemasukan sebelumnya.",
      );
      item.querySelector(!desc ? ".income-desc" : ".income-amount").focus();
      return;
    }
  }

  const id = Date.now();
  const html = `<div class="income-item" id="inc-${id}"><input type="text" class="income-desc" placeholder="Keterangan Pemasukan"><input type="text" class="income-amount" placeholder="Rp. 0"><button type="button" class="btn-danger" onclick="removeEl('inc-${id}')"><i class="fas fa-trash"></i></button></div>`;
  incomeList.insertAdjacentHTML("beforeend", html);
  document
    .querySelector(`#inc-${id} .income-amount`)
    .addEventListener("input", formatCurrencyInput);
});

document.getElementById("btnAddExpense").addEventListener("click", () => {
  // Pencegahan jika baris sebelumnya kosong
  const existingItems = expenseList.querySelectorAll(".expense-item");
  for (let item of existingItems) {
    const desc = item.querySelector(".expense-desc").value.trim();
    const amount = parseCurrency(item.querySelector(".expense-amount").value);
    if (!desc || amount <= 0) {
      alert(
        "⚠️ Harap lengkapi Keterangan dan Jumlah pada baris Pengeluaran sebelumnya.",
      );
      item.querySelector(!desc ? ".expense-desc" : ".expense-amount").focus();
      return;
    }
  }

  const id = Date.now();
  const html = `<div class="expense-item" id="exp-${id}"><input type="text" class="expense-desc" placeholder="Keterangan Pengeluaran"><input type="text" class="expense-amount" placeholder="Rp. 0"><button type="button" class="btn-danger" onclick="removeEl('exp-${id}')"><i class="fas fa-trash"></i></button></div>`;
  expenseList.insertAdjacentHTML("beforeend", html);
  document
    .querySelector(`#exp-${id} .expense-amount`)
    .addEventListener("input", formatCurrencyInput);
});

window.removeEl = (id) => {
  document.getElementById(id).remove();
  calculateAll();
};
inputs.forEach((input) => input.addEventListener("input", validateNumberInput));

const showToast = (msg) => {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 3000);
};

const validateForm = () => {
  if (!kasirInput.value.trim()) {
    alert("⚠️ GAGAL!\nMohon isi Nama Kasir.");
    kasirInput.focus();
    return false;
  }
  for (let id of ["awalFc", "awalNasi", "jualFc", "jualGeprek", "jualNasi"]) {
    if (document.getElementById(id).value === "") {
      alert(
        "⚠️ GAGAL!\nPastikan semua form Stok dan Penjualan terisi (minimal 0).",
      );
      document.getElementById(id).focus();
      return false;
    }
  }
  return true;
};

const generateReportText = () => {
  const kasir = kasirInput.value || "-";
  const jualFc = parseInt(document.getElementById("jualFc").value) || 0;
  const jualGeprek = parseInt(document.getElementById("jualGeprek").value) || 0;
  const jualNasi = parseInt(document.getElementById("jualNasi").value) || 0;
  const totalPenjualan =
    jualFc * HARGA.fc + jualGeprek * HARGA.geprek + jualNasi * HARGA.nasi;

  let daftarPemasukan = "",
    totalInc = 0;
  const incItems = document.querySelectorAll(".income-item");
  if (incItems.length === 0) daftarPemasukan = "Tidak ada pemasukan lain\n";
  else
    incItems.forEach((item) => {
      const desc =
        item.querySelector(".income-desc").value || "Tanpa keterangan";
      const amount = parseCurrency(item.querySelector(".income-amount").value);
      if (amount > 0) {
        daftarPemasukan += `• ${desc} : Rp${new Intl.NumberFormat("id-ID").format(amount)}\n`;
        totalInc += amount;
      }
    });

  let daftarPengeluaran = "",
    totalExp = 0;
  const expItems = document.querySelectorAll(".expense-item");
  if (expItems.length === 0) daftarPengeluaran = "Tidak ada pengeluaran\n";
  else
    expItems.forEach((item) => {
      const desc =
        item.querySelector(".expense-desc").value || "Tanpa keterangan";
      const amount = parseCurrency(item.querySelector(".expense-amount").value);
      if (amount > 0) {
        daftarPengeluaran += `• ${desc} : Rp${new Intl.NumberFormat("id-ID").format(amount)}\n`;
        totalExp += amount;
      }
    });

  const formatNumStr = (num) => new Intl.NumberFormat("id-ID").format(num);

  return `📋 *LAPORAN REKAP PENJUALAN PM FRIED CHICKEN*

📅 Hari/Tanggal : ${document.getElementById("hari").value}, ${document.getElementById("tanggal").value}
⏰ Jam : ${document.getElementById("jam").value}
👤 Kasir : ${kasir}
━━━━━━━━━━━━━━
📦 STOK AWAL
• Fried Chicken : ${document.getElementById("awalFc").value} pcs
• Nasi : ${document.getElementById("awalNasi").value} porsi
━━━━━━━━━━━━━━
🍗 RINCIAN PENJUALAN

Fried Chicken
Terjual : ${jualFc} pcs
Harga : Rp10.000
Subtotal : Rp${formatNumStr(jualFc * HARGA.fc)}

Ayam Geprek
Terjual : ${jualGeprek} porsi
Harga : Rp13.000
Subtotal : Rp${formatNumStr(jualGeprek * HARGA.geprek)}

Nasi
Terjual : ${jualNasi} porsi
Harga : Rp3.000
Subtotal : Rp${formatNumStr(jualNasi * HARGA.nasi)}
━━━━━━━━━━━━━━
📦 STOK AKHIR
• Fried Chicken : ${document.getElementById("akhirFc").textContent} pcs
• Nasi : ${document.getElementById("akhirNasi").textContent} porsi
━━━━━━━━━━━━━━
💰 TOTAL PENJUALAN
Fried Chicken : Rp${formatNumStr(jualFc * HARGA.fc)}
Ayam Geprek : Rp${formatNumStr(jualGeprek * HARGA.geprek)}
Nasi : Rp${formatNumStr(jualNasi * HARGA.nasi)}
Total Penjualan : Rp${formatNumStr(totalPenjualan)}
━━━━━━━━━━━━━━
💵 PEMASUKAN LAINNYA
${daftarPemasukan.trim()}
Total Pemasukan : Rp${formatNumStr(totalInc)}
━━━━━━━━━━━━━━
💸 PENGELUARAN
${daftarPengeluaran.trim()}
Total Pengeluaran : Rp${formatNumStr(totalExp)}
━━━━━━━━━━━━━━
📊 REKAP AKHIR
Total Penjualan : Rp${formatNumStr(totalPenjualan)}
Total Pemasukan : Rp${formatNumStr(totalInc)}
Total Pengeluaran : Rp${formatNumStr(totalExp)}
Saldo Akhir : Rp${formatNumStr(totalPenjualan + totalInc - totalExp)}
━━━━━━━━━━━━━━


*Laporan dibuat melalui Sistem Rekap Penjualan PM Fried Chicken Kendayakan*`;
};

const processAndSend = () => {
  if (!validateForm()) return;

  const text = generateReportText();
  const totalPenj = parseCurrency(
    document.getElementById("sumPenjualan").textContent,
  );
  const totalSaldo = parseCurrency(
    document.getElementById("saldoAkhir").textContent,
  );

  saveToDatabase(text, kasirInput.value, totalPenj, totalSaldo);

  const encodedText = encodeURIComponent(text);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  document.getElementById("loading").classList.remove("hidden");
  setTimeout(() => {
    document.getElementById("loading").classList.add("hidden");
    window.open(waUrl, "_blank");
    showToast("Data Disimpan & Membuka WA...");
  }, 800);
};

window.closeModal = (id) => document.getElementById(id).classList.add("hidden");

document.getElementById("btnPreview").addEventListener("click", () => {
  if (validateForm()) {
    document.getElementById("previewText").textContent = generateReportText();
    document.getElementById("previewModal").classList.remove("hidden");
  }
});

document.getElementById("btnRiwayat").addEventListener("click", () => {
  loadHistory();
  document.getElementById("riwayatModal").classList.remove("hidden");
});

document.getElementById("btnKirim").addEventListener("click", processAndSend);
document.getElementById("btnKirimModal").addEventListener("click", () => {
  closeModal("previewModal");
  processAndSend();
});

document.getElementById("btnReset").addEventListener("click", () => {
  if (confirm("Yakin ingin mereset form?")) {
    document
      .querySelectorAll('input[type="number"]')
      .forEach((input) => (input.value = 0));
    kasirInput.value = "";
    expenseList.innerHTML = "";
    incomeList.innerHTML = "";
    calculateAll();
    showToast("Form di-reset");
  }
});

document.getElementById("darkModeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("pm_darkmode", isDark);
  document.getElementById("themeIcon").className = isDark
    ? "fas fa-sun"
    : "fas fa-moon";
});

// --- PWA INSTALLATION LOGIC ---
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("btnInstall").classList.remove("hidden"); // Memunculkan tombol jika didukung
});

document.getElementById("btnInstall").addEventListener("click", async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted")
      document.getElementById("btnInstall").classList.add("hidden");
    deferredPrompt = null;
  }
});

// Init
window.addEventListener("DOMContentLoaded", () => {
  setupDateTime();
  setupQtyControls();
  calculateAll();
  const isDark = localStorage.getItem("pm_darkmode") === "true";
  if (isDark) document.body.classList.add("dark-mode");
  document.getElementById("themeIcon").className = isDark
    ? "fas fa-sun"
    : "fas fa-moon";
});

if ("serviceWorker" in navigator) {
  // Mendaftarkan service worker untuk PWA (Vercel Support)
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/service-worker.js", { scope: "/" }),
  );
}
