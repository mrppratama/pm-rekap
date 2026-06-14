// Konfigurasi Harga
const HARGA = { fc: 10000, geprek: 13000, nasi: 3000 };

// DOM Elements
const inputs = document.querySelectorAll(".calc-input");
const expenseList = document.getElementById("expenseList");
const btnAddExpense = document.getElementById("btnAddExpense");
const incomeList = document.getElementById("incomeList");
const btnAddIncome = document.getElementById("btnAddIncome");
const themeIcon = document.getElementById("themeIcon");
const kasirInput = document.getElementById("kasir");

// Filter Input Nama Kasir (Hanya Huruf dan Spasi)
kasirInput.addEventListener("input", function () {
  this.value = this.value.replace(/[^a-zA-Z\s]/g, "");
});

// Utility: Format Rupiah (Display)
const formatRupiah = (angka) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(angka);
};

// Utility: Parsing string "Rp. 1.000" jadi angka
const parseCurrency = (str) => {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, "")) || 0;
};

// Utility: Format Input Pengeluaran & Pemasukan (Rp. + Titik)
const formatCurrencyInput = (e) => {
  let val = e.target.value.replace(/[^0-9]/g, "");
  if (val === "") {
    e.target.value = "";
  } else {
    e.target.value = "Rp. " + new Intl.NumberFormat("id-ID").format(val);
  }
  calculateAll();
};

// Utility: Validasi Input Angka Positif Realtime
const validateNumberInput = (e) => {
  if (e.target.value < 0 || e.target.value === "") {
    e.target.value = 0;
  }
  calculateAll();
};

// Setup Tanggal dan Jam Otomatis
const setupDateTime = () => {
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const updateTime = () => {
    const now = new Date();

    // Update Hari & Tanggal
    document.getElementById("hari").value = days[now.getDay()];
    const tanggalFormat = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;
    document.getElementById("tanggal").value = tanggalFormat;

    // Update Jam (Format 24 Jam)
    const jamFormat = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    document.getElementById("jam").value = jamFormat;
  };

  updateTime(); // Panggil pertama kali
  setInterval(updateTime, 60000); // Update setiap 1 menit otomatis
};

// Setup Tombol Plus Minus
const setupQtyControls = () => {
  document.querySelectorAll(".qty-control").forEach((ctrl) => {
    if (ctrl.dataset.initialized) return;

    const btnMinus = ctrl.querySelector(".minus");
    const btnPlus = ctrl.querySelector(".plus");
    const input = ctrl.querySelector("input");

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

// Perhitungan Realtime
const calculateAll = () => {
  const jualFc = parseInt(document.getElementById("jualFc").value) || 0;
  const jualGeprek = parseInt(document.getElementById("jualGeprek").value) || 0;
  const jualNasi = parseInt(document.getElementById("jualNasi").value) || 0;

  const awalFc = parseInt(document.getElementById("awalFc").value) || 0;
  const awalNasi = parseInt(document.getElementById("awalNasi").value) || 0;

  const subFc = jualFc * HARGA.fc;
  const subGeprek = jualGeprek * HARGA.geprek;
  const subNasi = jualNasi * HARGA.nasi;

  document.getElementById("subFc").textContent = formatRupiah(subFc);
  document.getElementById("subGeprek").textContent = formatRupiah(subGeprek);
  document.getElementById("subNasi").textContent = formatRupiah(subNasi);

  const totalPenjualan = subFc + subGeprek + subNasi;
  document.getElementById("totalPenjualan").textContent =
    formatRupiah(totalPenjualan);
  document.getElementById("sumPenjualan").textContent =
    formatRupiah(totalPenjualan);

  // Stok Akhir
  const akhirFc = awalFc - (jualFc + jualGeprek);
  const akhirNasi = awalNasi - jualNasi;

  document.getElementById("akhirFc").textContent = akhirFc;
  document.getElementById("akhirNasi").textContent = akhirNasi;
  document.getElementById("akhirFc").style.color =
    akhirFc < 0 ? "var(--red)" : "";
  document.getElementById("akhirNasi").style.color =
    akhirNasi < 0 ? "var(--red)" : "";

  // Hitung Pemasukan Lainnya
  let totalPemasukan = 0;
  document.querySelectorAll(".income-amount").forEach((input) => {
    totalPemasukan += parseCurrency(input.value);
  });

  document.getElementById("totalPemasukan").textContent =
    formatRupiah(totalPemasukan);
  document.getElementById("sumPemasukan").textContent =
    formatRupiah(totalPemasukan);

  // Hitung Pengeluaran
  let totalPengeluaran = 0;
  document.querySelectorAll(".expense-amount").forEach((input) => {
    totalPengeluaran += parseCurrency(input.value);
  });

  document.getElementById("totalPengeluaran").textContent =
    formatRupiah(totalPengeluaran);
  document.getElementById("sumPengeluaran").textContent =
    formatRupiah(totalPengeluaran);

  // Saldo Akhir (Penjualan + Pemasukan - Pengeluaran)
  const saldoAkhir = totalPenjualan + totalPemasukan - totalPengeluaran;
  document.getElementById("saldoAkhir").textContent = formatRupiah(saldoAkhir);
};

// Fitur Pemasukan Dinamis
btnAddIncome.addEventListener("click", () => {
  const id = Date.now();
  const html = `
        <div class="income-item" id="inc-${id}">
            <input type="text" class="income-desc" placeholder="Keterangan">
            <input type="text" class="income-amount" placeholder="Rp. 0">
            <button type="button" class="btn-danger" onclick="removeIncome('${id}')"><i class="fas fa-trash"></i></button>
        </div>
    `;
  incomeList.insertAdjacentHTML("beforeend", html);

  const newInput = document.querySelector(`#inc-${id} .income-amount`);
  newInput.addEventListener("input", formatCurrencyInput);
});

window.removeIncome = (id) => {
  document.getElementById(`inc-${id}`).remove();
  calculateAll();
};

// Fitur Pengeluaran Dinamis
btnAddExpense.addEventListener("click", () => {
  const id = Date.now();
  const html = `
        <div class="expense-item" id="exp-${id}">
            <input type="text" class="expense-desc" placeholder="Keterangan">
            <input type="text" class="expense-amount" placeholder="Rp. 0">
            <button type="button" class="btn-danger" onclick="removeExpense('${id}')"><i class="fas fa-trash"></i></button>
        </div>
    `;
  expenseList.insertAdjacentHTML("beforeend", html);

  const newInput = document.querySelector(`#exp-${id} .expense-amount`);
  newInput.addEventListener("input", formatCurrencyInput);
});

window.removeExpense = (id) => {
  document.getElementById(`exp-${id}`).remove();
  calculateAll();
};

inputs.forEach((input) => input.addEventListener("input", validateNumberInput));

// Toast Notification
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

// Update Ikon Tema
const updateThemeIcon = (isDark) => {
  if (isDark) {
    themeIcon.className = "fas fa-sun";
  } else {
    themeIcon.className = "fas fa-moon";
  }
};

// Validasi Form Sebelum Kirim / Preview
const validateForm = () => {
  // 1. Cek Nama Kasir
  const kasir = kasirInput.value.trim();
  if (!kasir) {
    alert("⚠️ GAGAL MENGIRIM!\nMohon isi Nama Kasir terlebih dahulu.");
    kasirInput.focus();
    return false;
  }

  // 2. Cek Input Angka Stok & Penjualan
  const requiredNumberInputs = [
    "awalFc",
    "awalNasi",
    "jualFc",
    "jualGeprek",
    "jualNasi",
  ];
  for (let id of requiredNumberInputs) {
    const el = document.getElementById(id);
    if (el.value === "") {
      alert(
        "⚠️ GAGAL MENGIRIM!\nPastikan semua form Stok dan Penjualan sudah terisi. Jika tidak ada, isi dengan angka 0.",
      );
      el.focus();
      return false;
    }
  }

  return true; // Lolos Validasi
};

// Generate Laporan Teks
const generateReportText = () => {
  const kasir = kasirInput.value || "-";
  const jualFc = parseInt(document.getElementById("jualFc").value) || 0;
  const jualGeprek = parseInt(document.getElementById("jualGeprek").value) || 0;
  const jualNasi = parseInt(document.getElementById("jualNasi").value) || 0;
  const totalPenjualan =
    jualFc * HARGA.fc + jualGeprek * HARGA.geprek + jualNasi * HARGA.nasi;

  // List Pemasukan
  let daftarPemasukan = "";
  let totalInc = 0;
  const incItems = document.querySelectorAll(".income-item");
  if (incItems.length === 0) {
    daftarPemasukan = "Tidak ada pemasukan lain\n";
  } else {
    incItems.forEach((item) => {
      const desc =
        item.querySelector(".income-desc").value || "Tanpa keterangan";
      const amount = parseCurrency(item.querySelector(".income-amount").value);
      if (amount > 0) {
        daftarPemasukan += `• ${desc} : Rp${new Intl.NumberFormat("id-ID").format(amount)}\n`;
        totalInc += amount;
      }
    });
  }

  // List Pengeluaran
  let daftarPengeluaran = "";
  let totalExp = 0;
  const expItems = document.querySelectorAll(".expense-item");
  if (expItems.length === 0) {
    daftarPengeluaran = "Tidak ada pengeluaran\n";
  } else {
    expItems.forEach((item) => {
      const desc =
        item.querySelector(".expense-desc").value || "Tanpa keterangan";
      const amount = parseCurrency(item.querySelector(".expense-amount").value);
      if (amount > 0) {
        daftarPengeluaran += `• ${desc} : Rp${new Intl.NumberFormat("id-ID").format(amount)}\n`;
        totalExp += amount;
      }
    });
  }

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


_Laporan dibuat melalui Sistem Rekap Penjualan PM Fried Chicken Kendayakan_`;
};

// Fitur Kirim WhatsApp secara Manual
const sendToWhatsApp = () => {
  if (!validateForm()) return;

  const text = generateReportText();
  const encodedText = encodeURIComponent(text);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;

  document.getElementById("loading").classList.remove("hidden");

  setTimeout(() => {
    document.getElementById("loading").classList.add("hidden");
    window.open(waUrl, "_blank");
    showToast("Membuka WhatsApp...");
  }, 800);
};

// Event Modal Preview & Tombol Kirim
const modal = document.getElementById("previewModal");

document.getElementById("btnPreview").addEventListener("click", () => {
  if (validateForm()) {
    document.getElementById("previewText").textContent = generateReportText();
    modal.classList.remove("hidden");
  }
});

document.querySelector(".close-modal").addEventListener("click", () => {
  modal.classList.add("hidden");
});

// Routing Tombol Kirim Utama
document.getElementById("btnKirim").addEventListener("click", sendToWhatsApp);
document.getElementById("btnKirimModal").addEventListener("click", () => {
  modal.classList.add("hidden");
  sendToWhatsApp();
});

// Event Reset
document.getElementById("btnReset").addEventListener("click", () => {
  if (confirm("Yakin ingin mereset semua data hari ini?")) {
    document
      .querySelectorAll('input[type="number"]')
      .forEach((input) => (input.value = 0));
    kasirInput.value = "";
    expenseList.innerHTML = "";
    incomeList.innerHTML = "";
    calculateAll();
    showToast("Form berhasil di-reset");
  }
});

// Dark Mode Toggle
document.getElementById("darkModeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("pm_darkmode", isDark);
  updateThemeIcon(isDark);
});

// Init
window.addEventListener("DOMContentLoaded", () => {
  setupDateTime();
  setupQtyControls();
  calculateAll();

  const isDark = localStorage.getItem("pm_darkmode") === "true";
  if (isDark) {
    document.body.classList.add("dark-mode");
  }
  updateThemeIcon(isDark);
});

// Registrasi Service Worker PWA
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .catch((err) => console.error(err));
  });
}
