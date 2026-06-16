const HARGA = { fc: 10000, geprek: 13000, nasi: 3000 };
let db; // Reference ke Firebase Database
let firebaseReady = false;
let editingId = null;
let editingTimestamp = null;
let timeInterval;
let salesChartInstance = null;
let allReportsGlobal = [];

// --- 1. INISIALISASI DATABASE FIREBASE ---
const initializeDatabase = () => {
  // Tunggu Firebase ter-inisialisasi
  const checkFirebase = setInterval(() => {
    if (typeof firebaseDb !== "undefined" && firebaseDb !== null) {
      clearInterval(checkFirebase);
      // adapter: script.js butuh firebaseDb.ref() gaya v8
      db = firebaseDb;
      firebaseReady = true;
      console.log("✅ Database Firebase siap digunakan");
      // Setup real-time listener
      setupRealtimeListener();
    } else {
      // Fallback ke localStorage jika Firebase tidak tersedia
      console.warn("⚠️ Firebase tidak tersedia, menggunakan localStorage");
      useLocalStorage();
    }
  }, 100);

  // Timeout 5 detik
  setTimeout(() => {
    if (!firebaseReady) {
      clearInterval(checkFirebase);
      console.warn("⚠️ Firebase tidak responsif, fallback ke localStorage");
      useLocalStorage();
    }
  }, 5000);
};

// Fallback ke localStorage
const useLocalStorage = () => {
  window.isUsingLocalStorage = true;
};

// Setup real-time listener untuk sync data
const setupRealtimeListener = () => {
  if (!db) return;

  const reportsRef = db.ref("reports");
  reportsRef.on(
    "value",
    (snapshot) => {
      const data = snapshot.val();

      allReportsGlobal = [];
      if (data) {
        allReportsGlobal = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
      }

      console.log(
        "✅ Data realtime tersinkronisasi",
        allReportsGlobal.length,
        "records",
      );

      // Saat mode edit aktif, jangan rerender list agar input tidak ke-reset.
      if (window.isEditMode) return;

      // Update UI yang sedang aktif agar benar-benar realtime
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
    },
    (error) => {
      console.error("❌ Error membaca data Firebase:", error);
    },
  );
};

// Inisialisasi saat DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initializeDatabase, 500);
});

const formatNumber = (angka) => new Intl.NumberFormat("id-ID").format(angka);
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
const parseIndoDate = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date();
  return new Date(parts[2], parts[1] - 1, parts[0]);
};

// --- 2. SISTEM LOGIN PORTAL ---
const viewLogin = document.getElementById("view-login");
const viewKasir = document.getElementById("view-kasir");
const viewKasirHistory = document.getElementById("view-kasir-history");
const viewAdmin = document.getElementById("view-admin");
const btnLogout = document.getElementById("btnLogout");
const mainTitle = document.getElementById("mainTitle");
const subTitle = document.getElementById("subTitle");
const appHeader = document.getElementById("appHeader");
const loginBg = document.getElementById("loginBg");

const switchView = (role) => {
  viewLogin.classList.add("hidden");
  viewKasir.classList.add("hidden");
  viewKasirHistory.classList.add("hidden");
  viewAdmin.classList.add("hidden");
  btnLogout.classList.remove("hidden");
  loginBg.classList.remove("active");
  appHeader.style.backgroundColor = "var(--red)";

  if (role === "kasir") {
    viewKasir.classList.remove("hidden");
    mainTitle.textContent = "PM Fried Chicken Kendayakan";
    subTitle.textContent = "Sistem Rekap Kasir";
    setupDateTime();
  } else if (role === "admin") {
    viewAdmin.classList.remove("hidden");
    mainTitle.textContent = "Dashboard Owner";
    subTitle.textContent = "Statistik & Database";
    renderAdminDashboard();
  }
};

document.getElementById("btnLogin").addEventListener("click", () => {
  const pin = document.getElementById("loginPin").value;
  if (pin === "1234") {
    switchView("kasir");
    showToast("Login Kasir Berhasil");
  } else if (pin === "8888") {
    switchView("admin");
    showToast("Selamat Datang, Owner");
  } else {
    alert("PIN Salah! Silakan coba lagi.");
  }
  document.getElementById("loginPin").value = "";
});

document.getElementById("loginPin").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    document.getElementById("btnLogin").click();
  }
});

btnLogout.addEventListener("click", () => {
  viewLogin.classList.remove("hidden");
  viewKasir.classList.add("hidden");
  viewKasirHistory.classList.add("hidden");
  viewAdmin.classList.add("hidden");
  btnLogout.classList.add("hidden");
  loginBg.classList.add("active");

  appHeader.style.backgroundColor = "var(--red)";
  mainTitle.textContent = "PM Fried Chicken Kendayakan";
  subTitle.textContent = "Portal Login Pegawai";
  clearInterval(timeInterval);
  exitEditMode();
});

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

document.getElementById("btnAddIncome").addEventListener("click", () => {
  const existingItems = incomeList.querySelectorAll(".income-item");
  for (let item of existingItems) {
    if (
      !item.querySelector(".income-desc").value.trim() ||
      parseCurrency(item.querySelector(".income-amount").value) <= 0
    ) {
      alert("⚠️ Harap lengkapi baris Pemasukan sebelumnya.");
      return;
    }
  }
  const uid = "inc_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  incomeList.insertAdjacentHTML(
    "beforeend",
    `<div class="income-item" id="${uid}"><input type="text" class="income-desc" placeholder="Keterangan Pemasukan Lainnya"><input type="text" class="income-amount" placeholder="Rp. 0"><button type="button" class="btn-danger" onclick="removeEl('${uid}')"><i class="fas fa-trash"></i></button></div>`,
  );
  document
    .getElementById(uid)
    .querySelector(".income-amount")
    .addEventListener("input", formatCurrencyInput);
});

document.getElementById("btnAddExpense").addEventListener("click", () => {
  const existingItems = expenseList.querySelectorAll(".expense-item");
  for (let item of existingItems) {
    if (
      !item.querySelector(".expense-desc").value.trim() ||
      parseCurrency(item.querySelector(".expense-amount").value) <= 0
    ) {
      alert("⚠️ Harap lengkapi baris Pengeluaran sebelumnya.");
      return;
    }
  }
  const uid = "exp_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  expenseList.insertAdjacentHTML(
    "beforeend",
    `<div class="expense-item" id="${uid}"><input type="text" class="expense-desc" placeholder="Keterangan Pengeluaran"><input type="text" class="expense-amount" placeholder="Rp. 0"><button type="button" class="btn-danger" onclick="removeEl('${uid}')"><i class="fas fa-trash"></i></button></div>`,
  );
  document
    .getElementById(uid)
    .querySelector(".expense-amount")
    .addEventListener("input", formatCurrencyInput);
});

window.removeEl = (id) => {
  document.getElementById(id).remove();
  calculateAll();
};
inputs.forEach((input) => input.addEventListener("input", validateNumberInput));

const validateForm = () => {
  if (!kasirInput.value.trim()) {
    alert("⚠️ Mohon isi Nama Kasir.");
    kasirInput.focus();
    return false;
  }
  for (let id of ["awalFc", "awalNasi", "jualFc", "jualGeprek", "jualNasi"]) {
    if (document.getElementById(id).value === "") {
      alert("⚠️ Pastikan semua form terisi (minimal 0).");
      return false;
    }
  }
  return true;
};

// --- 4. FORMAT DATA GENERATOR ---
const getRawData = () => {
  return {
    awalFc: document.getElementById("awalFc").value,
    awalNasi: document.getElementById("awalNasi").value,
    jualFc: document.getElementById("jualFc").value,
    jualGeprek: document.getElementById("jualGeprek").value,
    jualNasi: document.getElementById("jualNasi").value,
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
  const totalPenjualan =
    raw.jualFc * HARGA.fc +
    raw.jualGeprek * HARGA.geprek +
    raw.jualNasi * HARGA.nasi;

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

Fried Chicken
Terjual : ${raw.jualFc} pcs
Harga : Rp10.000
Subtotal : Rp${formatNumber(raw.jualFc * HARGA.fc)}

Ayam Geprek
Terjual : ${raw.jualGeprek} porsi
Harga : Rp13.000
Subtotal : Rp${formatNumber(raw.jualGeprek * HARGA.geprek)}

Nasi
Terjual : ${raw.jualNasi} porsi
Harga : Rp3.000
Subtotal : Rp${formatNumber(raw.jualNasi * HARGA.nasi)}
━━━━━━━━━━━━━━
📦 STOK AKHIR
• Fried Chicken : ${document.getElementById("akhirFc").textContent} pcs
• Nasi : ${document.getElementById("akhirNasi").textContent} porsi
━━━━━━━━━━━━━━
💰 TOTAL PENJUALAN
Fried Chicken : Rp${formatNumber(raw.jualFc * HARGA.fc)}
Ayam Geprek : Rp${formatNumber(raw.jualGeprek * HARGA.geprek)}
Nasi : Rp${formatNumber(raw.jualNasi * HARGA.nasi)}
Total Penjualan : Rp${formatNumber(totalPenjualan)}
━━━━━━━━━━━━━━
💵 PEMASUKAN LAINNYA
${daftarPemasukan.trim()}
Total Pemasukan : Rp${formatNumber(totalInc)}
━━━━━━━━━━━━━━
💸 PENGELUARAN
${daftarPengeluaran.trim()}
Total Pengeluaran : Rp${formatNumber(totalExp)}
━━━━━━━━━━━━━━
📊 REKAP AKHIR
Total Penjualan : Rp${formatNumber(totalPenjualan)}
Total Pemasukan Lainnya : Rp${formatNumber(totalInc)}
Total Pengeluaran : Rp${formatNumber(totalExp)}
Saldo Akhir : Rp${formatNumber(totalPenjualan + totalInc - totalExp)}
━━━━━━━━━━━━━━

_Laporan dibuat melalui Sistem Rekap Penjualan PM Fried Chicken Kendayakan_`;
};

// Tabel Detail Laporan Database (single main table)
const generateDetailTableHTML = (item) => {
  const raw = item?.rawData;

  const money = (n) => `Rp${formatNumber(n || 0)}`;

  if (!raw) {
    return `
    <div class="detail-wrapper" style="width:100%; max-width:100%; display:block;">
      <table class="detail-main-table" style="width:100%; max-width:100%; border-collapse: collapse; table-layout:fixed;">
        <tbody>
            <tr><th class="detail-section-head" colspan="2">INFORMASI UMUM</th></tr>
            <tr><th class="detail-th">Nama Kasir</th><td class="detail-td">${item?.kasir || "-"}</td></tr>
            <tr><th class="detail-th">Waktu Laporan</th><td class="detail-td">${item?.hari || "-"}, ${item?.tanggal || "-"} ${item?.jam || ""}</td></tr>
            <tr><th class="detail-section-head" colspan="2">Tidak Ada Detail</th></tr>
            <tr><th class="detail-th">Info</th><td class="detail-td text-muted">Data detail tidak lengkap</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const incomes = Array.isArray(raw.incomes) ? raw.incomes : [];
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];

  const stokAwalFc = raw.awalFc ?? 0;
  const stokAwalNasi = raw.awalNasi ?? 0;
  const jualFc = raw.jualFc ?? 0;
  const jualGeprek = raw.jualGeprek ?? 0;
  const jualNasi = raw.jualNasi ?? 0;

  const stokAkhirFc = stokAwalFc - jualFc - jualGeprek;
  const stokAkhirNasi = stokAwalNasi - jualNasi;

  const subFc = jualFc * HARGA.fc;
  const subGeprek = jualGeprek * HARGA.geprek;
  const subNasi = jualNasi * HARGA.nasi;

  const totalInc = incomes.reduce((s, i) => s + (i?.amount || 0), 0);
  const totalExp = expenses.reduce((s, e) => s + (e?.amount || 0), 0);
  const saldoAkhir = item?.saldoAkhir ?? 0;

  const totalPenjualanKotor = item?.penjualan ?? subFc + subGeprek + subNasi;

  const renderList = (arr, emptyText, sign) => {
    if (!arr.length) return `<span class="text-muted">${emptyText}</span>`;

    return arr
      .map((x) => {
        const desc = x?.desc || "-";
        const amount = x?.amount || 0;
        const value = `${sign === "minus" ? "-" : ""}${money(amount)}`;
        return `<div class="detail-list-row"><span class="detail-list-bullet">•</span> <span class="detail-list-desc">${desc}</span> : <span class="${sign === "minus" ? "text-red" : "text-green"} detail-list-value">${value}</span></div>`;
      })
      .join("");
  };

  return `
    <div class="detail-wrapper">
      <table class="detail-main-table">
        <tbody>
          <tr><th class="detail-section-head" colspan="2">INFORMASI UMUM</th></tr>
          <tr>
            <th class="detail-th">Nama Kasir</th>
            <td class="detail-td">${item?.kasir || "-"}</td>
          </tr>
          <tr>
            <th class="detail-th">Waktu Laporan</th>
            <td class="detail-td">${item?.hari || "-"}, ${item?.tanggal || "-"}<br/><span class="detail-muted">${item?.jam || "-"}</span></td>
          </tr>

          <tr><th class="detail-section-head" colspan="2">STOK (Awal → Akhir)</th></tr>
          <tr>
            <th class="detail-th">Fried Chicken</th>
            <td class="detail-td">${stokAwalFc} → ${stokAkhirFc} pcs</td>
          </tr>
          <tr>
            <th class="detail-th">Nasi</th>
            <td class="detail-td">${stokAwalNasi} → ${stokAkhirNasi} porsi</td>
          </tr>

          <tr><th class="detail-section-head" colspan="2">RINCIAN PENJUALAN</th></tr>
          <tr>
            <th class="detail-th">Fried Chicken</th>
            <td class="detail-td">${jualFc} pcs</td>
          </tr>
          <tr>
            <th class="detail-th">Ayam Geprek</th>
            <td class="detail-td">${jualGeprek} porsi</td>
          </tr>
          <tr>
            <th class="detail-th">Nasi</th>
            <td class="detail-td">${jualNasi} porsi</td>
          </tr>
          <tr>
            <th class="detail-th">Total Penjualan Kotor</th>
            <td class="detail-td text-green font-bold">${money(totalPenjualanKotor)}</td>
          </tr>

          <tr><th class="detail-section-head" colspan="2">PEMASUKAN &amp; PENGELUARAN</th></tr>
          <tr>
            <th class="detail-th">Seluruh Pemasukan Tambahan</th>
            <td class="detail-td">${renderList(incomes, "Tidak ada pemasukan lainnya", "plus")}</td>
          </tr>
          <tr>
            <th class="detail-th">Seluruh Pengeluaran</th>
            <td class="detail-td">${renderList(expenses, "Tidak ada pengeluaran", "minus")}</td>
          </tr>
          <tr>
            <th class="detail-th">Total Pemasukan</th>
            <td class="detail-td text-green font-bold">${money(totalInc)}</td>
          </tr>
          <tr>
            <th class="detail-th">Total Pengeluaran</th>
            <td class="detail-td text-red font-bold">${money(totalExp)}</td>
          </tr>

          <tr><th class="detail-section-head" colspan="2">REKAPITULASI AKHIR</th></tr>
          <tr>
            <th class="detail-th">Total Penjualan</th>
            <td class="detail-td text-green font-bold">${money(totalPenjualanKotor)}</td>
          </tr>
          <tr>
            <th class="detail-th">Total Pemasukan Lainnya</th>
            <td class="detail-td text-green font-bold">${money(totalInc)}</td>
          </tr>
          <tr>
            <th class="detail-th">Total Pengeluaran</th>
            <td class="detail-td text-red font-bold">${money(totalExp)}</td>
          </tr>
          <tr>
            <th class="detail-th">Saldo Akhir</th>
            <td class="detail-td detail-saldo-akhir">${money(saldoAkhir)}</td>
          </tr>
        </tbody>
      </table>

      <div class="detail-bottom-actions" style="margin-top:12px;">
        <button class="btn btn-secondary" style="width:100%" onclick="toggleDetailKasir('${item?.id}')"><i class="fas fa-times"></i> Tutup Detail</button>
      </div>
    </div>
  `;
};

// --- 5. EKSEKUSI PENYIMPANAN WA & DATABASE ---
document.getElementById("btnKirimWAEdit").addEventListener("click", () => {
  if (!validateForm()) return;
  const text = generateReportText();
  window.open(
    `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
    "_blank",
  );
});

document.getElementById("btnSimpanKirim").addEventListener("click", () => {
  if (!validateForm()) return;
  if (!db && !window.isUsingLocalStorage) {
    alert("Sistem Database belum siap. Silakan refresh halaman.");
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
    timestamp: editingId !== null ? editingTimestamp : new Date().getTime(),
  };

  if (firebaseReady && db) {
    // Simpan ke Firebase
    const reportsRef = db.ref("reports");

    if (editingId !== null) {
      // Update existing record
      reportsRef
        .child(editingId)
        .update(dataToSave)
        .then(() => {
          document.getElementById("loading").classList.add("hidden");
          showToast("✅ Perubahan Berhasil Disimpan!");
          exitEditMode();
          document.getElementById("view-kasir").classList.add("hidden");
          document
            .getElementById("view-kasir-history")
            .classList.remove("hidden");
          loadKasirHistory();
          window.scrollTo(0, 0);
        })
        .catch((error) => {
          document.getElementById("loading").classList.add("hidden");
          alert("❌ Gagal menyimpan ke Firebase: " + error.message);
        });
    } else {
      // Add new record
      const newKey = reportsRef.push().key;
      reportsRef
        .child(newKey)
        .set(dataToSave)
        .then(() => {
          document.getElementById("loading").classList.add("hidden");
          showToast("✅ Tersimpan! Membuka WhatsApp...");
          resetForm();
          window.open(
            `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`,
            "_blank",
          );
        })
        .catch((error) => {
          document.getElementById("loading").classList.add("hidden");
          alert("❌ Gagal menyimpan ke Firebase: " + error.message);
        });
    }
  } else {
    // Fallback ke localStorage
    const records = JSON.parse(localStorage.getItem("pmReports") || "[]");
    if (editingId !== null) {
      const idx = records.findIndex((r) => r.id === editingId);
      if (idx !== -1) records[idx] = { id: editingId, ...dataToSave };
    } else {
      const newId = Date.now().toString();
      records.push({ id: newId, ...dataToSave });
    }
    localStorage.setItem("pmReports", JSON.stringify(records));

    document.getElementById("loading").classList.add("hidden");
    if (editingId !== null) {
      showToast("✅ Perubahan Berhasil Disimpan (Local)!");
      exitEditMode();
      document.getElementById("view-kasir").classList.add("hidden");
      document.getElementById("view-kasir-history").classList.remove("hidden");
      loadKasirHistory();
    } else {
      showToast("✅ Tersimpan! Membuka WhatsApp...");
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

document.getElementById("btnReset").addEventListener("click", () => {
  if (confirm("Yakin ingin mereset seluruh form?")) {
    resetForm();
    showToast("Form berhasil di-reset");
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

const loadKasirHistory = () => {
  const container = document.getElementById("historyContainer");
  container.innerHTML = '<div class="spinner" style="margin:auto;"></div>';

  if (firebaseReady && db) {
    // Load dari Firebase
    const reportsRef = db.ref("reports");
    reportsRef.once(
      "value",
      (snapshot) => {
        const data = snapshot.val();
        let reports = [];

        if (data) {
          reports = Object.keys(data).map((key) => ({
            id: key,
            ...data[key],
          }));
        }

        if (reports.length === 0) {
          container.innerHTML =
            '<p class="text-muted text-center" style="padding:20px;">Belum ada riwayat laporan.</p>';
          return;
        }

        reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        let html = `<div style="overflow-x: hidden; width: 100%;"><table class="history-table"><thead><tr><th>Waktu</th><th>Kasir</th><th>Saldo Akhir</th><th class="text-center">Aksi</th></tr></thead><tbody>`;

        reports.forEach((item) => {
          html += `
                  <tr>
                      <td data-label="Waktu">${item.hari}, ${item.tanggal}<br><span style="font-size:0.8rem; color:var(--text-muted);">${item.jam}</span></td>
                      <td data-label="Kasir">${item.kasir}</td>
                      <td data-label="Saldo Akhir" class="text-green font-bold">Rp${formatNumber(item.saldoAkhir)}</td>
                      <td data-label="Aksi" class="text-center">
                          <div class="action-flex">
                              <button class="btn-icon-small btn-secondary" onclick="toggleDetailKasir('${item.id}')" title="Lihat Detail"><i class="fas fa-eye"></i></button>
                              <button class="btn-icon-small btn-orange" onclick="triggerEditMode('${item.id}')" title="Edit Laporan"><i class="fas fa-edit"></i></button>
                              <button class="btn-icon-small btn-danger" onclick="executeDelete('${item.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                          </div>
                      </td>
                  </tr>
                  <tr id="kasir-detail-${item.id}" class="hidden detail-row">
                      <td colspan="4" style="padding: 0; border: none; background: transparent;">
                          <div id="content-detail-${item.id}" style="padding-bottom: 20px;"></div>
                      </td>
                  </tr>
              `;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
      },
      (error) => {
        container.innerHTML =
          '<p class="text-muted text-center" style="padding:20px; color:red;">⚠️ Gagal memuat data: ' +
          error.message +
          "</p>";
      },
    );
  } else {
    // Fallback localStorage
    const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");

    if (reports.length === 0) {
      container.innerHTML =
        '<p class="text-muted text-center" style="padding:20px;">Belum ada riwayat laporan (Local Storage).</p>';
      return;
    }

    reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let html = `<div style="overflow-x: hidden; width: 100%;"><table class="history-table"><thead><tr><th>Waktu</th><th>Kasir</th><th>Saldo Akhir</th><th class="text-center">Aksi</th></tr></thead><tbody>`;

    reports.forEach((item) => {
      html += `
                  <tr>
                      <td data-label="Waktu">${item.hari}, ${item.tanggal}<br><span style="font-size:0.8rem; color:var(--text-muted);">${item.jam}</span></td>
                      <td data-label="Kasir">${item.kasir}</td>
                      <td data-label="Saldo Akhir" class="text-green font-bold">Rp${formatNumber(item.saldoAkhir)}</td>
                      <td data-label="Aksi" class="text-center">
                          <div class="action-flex">
                              <button class="btn-icon-small btn-secondary" onclick="toggleDetailKasir('${item.id}')" title="Lihat Detail"><i class="fas fa-eye"></i></button>
                              <button class="btn-icon-small btn-orange" onclick="triggerEditMode('${item.id}')" title="Edit Laporan"><i class="fas fa-edit"></i></button>
                              <button class="btn-icon-small btn-danger" onclick="executeDelete('${item.id}')" title="Hapus"><i class="fas fa-trash"></i></button>
                          </div>
                      </td>
                  </tr>
                  <tr id="kasir-detail-${item.id}" class="hidden detail-row">
                      <td colspan="4" style="padding: 0; border: none; background: transparent;">
                          <div id="content-detail-${item.id}" style="padding-bottom: 20px;"></div>
                      </td>
                  </tr>
              `;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }
};

window.toggleDetailKasir = (id) => {
  const row = document.getElementById(`kasir-detail-${id}`);
  const content = document.getElementById(`content-detail-${id}`);

  if (row.classList.contains("hidden")) {
    if (firebaseReady && db) {
      // Load dari Firebase
      const reportsRef = db.ref("reports");
      reportsRef.child(id).once("value", (snapshot) => {
        const item = snapshot.val();
        if (item) {
          content.innerHTML =
            generateDetailTableHTML({ id, ...item }) 
            
          row.classList.remove("hidden");
        }
      });
    } else {
      // Load dari localStorage
      const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");
      const item = reports.find((r) => r.id === id);
      if (item) {
        content.innerHTML =
          generateDetailTableHTML(item) +
          
        row.classList.remove("hidden");
      }
    }
  } else {
    row.classList.add("hidden");
  }
};

window.executeDelete = (id) => {
  if (
    confirm(
      "Apakah Anda yakin ingin menghapus data laporan ini secara permanen?",
    )
  ) {
    if (firebaseReady && db) {
      // Delete dari Firebase
      const reportsRef = db.ref("reports");
      reportsRef
        .child(id)
        .remove()
        .then(() => {
          showToast("✅ Laporan Sukses Dihapus");
          if (
            !document
              .getElementById("view-kasir-history")
              .classList.contains("hidden")
          ) {
            loadKasirHistory();
          } else if (
            !document.getElementById("view-admin").classList.contains("hidden")
          ) {
            renderAdminDashboard();
          }
        })
        .catch((error) => {
          alert("❌ Gagal menghapus: " + error.message);
        });
    } else {
      // Delete dari localStorage
      const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");
      const idx = reports.findIndex((r) => r.id === id);
      if (idx !== -1) {
        reports.splice(idx, 1);
        localStorage.setItem("pmReports", JSON.stringify(reports));
        showToast("✅ Laporan Sukses Dihapus (Local)");
        if (
          !document
            .getElementById("view-kasir-history")
            .classList.contains("hidden")
        ) {
          loadKasirHistory();
        } else if (
          !document.getElementById("view-admin").classList.contains("hidden")
        ) {
          renderAdminDashboard();
        }
      }
    }
  }
};

// --- 7. ALUR EDIT FORM KASIR ---
window.triggerEditMode = (id) => {
  if (!db && !window.isUsingLocalStorage) {
    alert("Sistem Database belum siap.");
    return;
  }

  const loadDataForEdit = (data) => {
    if (!data || !data.rawData) {
      console.error("[EDIT] Data mentah tidak valid:", data);
      alert("Data laporan tidak valid untuk diedit.");
      return;
    }

    // Logging sementara untuk investigasi format lama vs baru
    console.log("[EDIT] Data mentah dari DB:", data);

    const parsedRaw = {
      ...data.rawData,
      incomes: Array.isArray(data.rawData?.incomes) ? data.rawData.incomes : [],
      expenses: Array.isArray(data.rawData?.expenses)
        ? data.rawData.expenses
        : [],
    };

    console.log("[EDIT] Hasil parsing rawData (normalized):", parsedRaw);

    // Mode edit aktif supaya listener realtime tidak merender ulang UI
    window.isEditMode = true;

    editingId = id;
    editingTimestamp = data.timestamp;

    document.getElementById("hari").value = data.hari || "-";
    document.getElementById("tanggal").value = data.tanggal;
    document.getElementById("jam").value = data.jam;
    document.getElementById("kasir").value = data.kasir;
    document.getElementById("awalFc").value = parsedRaw.awalFc;
    document.getElementById("awalNasi").value = parsedRaw.awalNasi;
    document.getElementById("jualFc").value = parsedRaw.jualFc;
    document.getElementById("jualGeprek").value = parsedRaw.jualGeprek;
    document.getElementById("jualNasi").value = parsedRaw.jualNasi;

    const incList = document.getElementById("incomeList");
    const expList = document.getElementById("expenseList");
    incList.innerHTML = "";
    expList.innerHTML = "";

    parsedRaw.incomes.forEach((inc, idx) => {
      const safeUid = "inc_" + Date.now() + "_" + idx;
      incList.insertAdjacentHTML(
        "beforeend",
        `<div class="income-item" id="${safeUid}"><input type="text" class="income-desc" value="${inc.desc}"><input type="text" class="income-amount" value="Rp. ${formatNumber(inc.amount)}"><button type="button" class="btn-danger" onclick="removeEl('${safeUid}')"><i class="fas fa-trash"></i></button></div>`,
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
        `<div class="expense-item" id="${safeUid}"><input type="text" class="expense-desc" value="${exp.desc}"><input type="text" class="expense-amount" value="Rp. ${formatNumber(exp.amount)}"><button type="button" class="btn-danger" onclick="removeEl('${safeUid}')"><i class="fas fa-trash"></i></button></div>`,
      );
      document
        .getElementById(safeUid)
        .querySelector(".expense-amount")
        .addEventListener("input", formatCurrencyInput);
    });

    calculateAll();

    document.getElementById("view-kasir-history").classList.add("hidden");
    document.getElementById("view-kasir").classList.remove("hidden");

    document.getElementById("appHeader").style.backgroundColor =
      "var(--orange)";
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

  if (firebaseReady && db) {
    // Load dari Firebase
    const reportsRef = db.ref("reports");
    reportsRef.child(id).once("value", (snapshot) => {
      const data = snapshot.val();
      if (data) {
        loadDataForEdit(data);
      }
    });
  } else {
    // Load dari localStorage
    const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");
    const data = reports.find((r) => r.id === id);
    if (data) {
      loadDataForEdit(data);
    }
  }
};

const exitEditMode = () => {
  editingId = null;
  editingTimestamp = null;
  window.isEditMode = false;

  document.getElementById("appHeader").style.backgroundColor = "var(--red)";
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

document.getElementById("btnBatalEdit").addEventListener("click", () => {
  if (confirm("Batalkan pengeditan data ini?")) {
    exitEditMode();
    showToast("Batal Edit.");
  }
});

// --- 8. DASHBOARD ADMIN (OWNER VIEW) ---

const renderAdminDashboard = () => {
  const container = document.getElementById("adminHistoryContainer");
  container.innerHTML = '<div class="spinner" style="margin:auto;"></div>';

  const processData = (reports) => {
    if (!reports || reports.length === 0) {
      allReportsGlobal = [];
      document.getElementById("statToday").textContent = formatRupiah(0);
      document.getElementById("statMonth").textContent = formatRupiah(0);
      document.getElementById("statTotalDoc").textContent = 0;
      container.innerHTML =
        '<p class="text-muted text-center" style="padding: 20px;">Belum ada data rekap laporan masuk.</p>';
      return;
    }

    allReportsGlobal = reports;

    const todayStr = `${new Date().getDate().toString().padStart(2, "0")}/${(new Date().getMonth() + 1).toString().padStart(2, "0")}/${new Date().getFullYear()}`;
    const monthStr = `${(new Date().getMonth() + 1).toString().padStart(2, "0")}/${new Date().getFullYear()}`;

    let saldoToday = 0,
      saldoMonth = 0;
    allReportsGlobal.forEach((item) => {
      if (item.tanggal === todayStr) saldoToday += item.saldoAkhir;
      if (item.tanggal.includes(monthStr)) saldoMonth += item.saldoAkhir;
    });

    document.getElementById("statToday").textContent = formatRupiah(saldoToday);
    document.getElementById("statMonth").textContent = formatRupiah(saldoMonth);
    document.getElementById("statTotalDoc").textContent =
      allReportsGlobal.length;

    updateAdminChart();

    allReportsGlobal.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    let html = `<div style="overflow-x: hidden; width: 100%;"><table class="history-table"><thead><tr><th>Waktu</th><th>Kasir</th><th>Saldo Akhir</th><th class="text-center">Aksi</th></tr></thead><tbody>`;

    allReportsGlobal.forEach((item) => {
      const itemId = item.id || item.timestamp.toString();
      html += `
                <tr>
                    <td data-label="Waktu">${item.hari}, ${item.tanggal}<br><span style="font-size:0.8rem; color:var(--text-muted);">${item.jam}</span></td>
                    <td data-label="Kasir">${item.kasir}</td>
                    <td data-label="Saldo Akhir" class="text-green font-bold">Rp${formatNumber(item.saldoAkhir)}</td>
                    <td data-label="Aksi" class="text-center">
                        <div class="action-flex">
                            <button class="btn-icon-small btn-secondary" onclick="toggleAdminDetail('${itemId}')" title="Lihat Laporan"><i class="fas fa-eye"></i></button>
                            <button class="btn-icon-small btn-danger" onclick="executeDelete('${itemId}')" title="Hapus Permanen"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
                <tr id="admin-detail-${itemId}" class="hidden detail-row">
                    <td colspan="4" style="padding: 0; border: none; background: transparent;">
                        <div id="admin-content-${itemId}" style="padding-bottom: 20px;"></div>
                    </td>
                </tr>
            `;
    });
    html += `</tbody></table></div>`;
    container.innerHTML = html;
  };

  if (firebaseReady && db) {
    // Load dari Firebase
    const reportsRef = db.ref("reports");
    reportsRef.once("value", (snapshot) => {
      const data = snapshot.val();
      let reports = [];

      if (data) {
        reports = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));
      }
      processData(reports);
    });
  } else {
    // Load dari localStorage
    const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");
    processData(reports);
  }
};

window.toggleAdminDetail = (id) => {
  const row = document.getElementById(`admin-detail-${id}`);
  const content = document.getElementById(`admin-content-${id}`);

  if (row.classList.contains("hidden")) {
    if (firebaseReady && db) {
      // Load dari Firebase
      const reportsRef = db.ref("reports");
      reportsRef.child(id).once("value", (snapshot) => {
        const item = snapshot.val();
        if (item) {
          content.innerHTML =
            generateDetailTableHTML({ id, ...item }) 
           
          row.classList.remove("hidden");
        }
      });
    } else {
      // Load dari localStorage
      const reports = JSON.parse(localStorage.getItem("pmReports") || "[]");
      const item = reports.find((r) => r.id === id);
      if (item) {
        content.innerHTML =
          generateDetailTableHTML(item) +
          
        row.classList.remove("hidden");
      }
    }
  } else {
    row.classList.add("hidden");
  }
};

document
  .getElementById("chartFilterType")
  .addEventListener("change", function () {
    if (this.value === "custom") {
      document.getElementById("chartFilterCustom").classList.remove("hidden");
    } else {
      document.getElementById("chartFilterCustom").classList.add("hidden");
      updateAdminChart();
    }
  });

document.getElementById("btnApplyChartFilter").addEventListener("click", () => {
  updateAdminChart();
});

const updateAdminChart = () => {
  if (!allReportsGlobal || allReportsGlobal.length === 0) return;

  const filter = document.getElementById("chartFilterType").value;
  let filtered = [...allReportsGlobal];
  const now = new Date();

  if (filter === "7hari") {
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    filtered = filtered.filter(
      (d) =>
        parseIndoDate(d.tanggal) >= last7Days &&
        parseIndoDate(d.tanggal) <= now,
    );
  } else if (filter === "custom") {
    const start = document.getElementById("chartDateStart").value;
    const end = document.getElementById("chartDateEnd").value;
    if (start && end) {
      const sDate = new Date(start);
      sDate.setHours(0, 0, 0, 0);
      const eDate = new Date(end);
      eDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((d) => {
        const dDate = parseIndoDate(d.tanggal);
        return dDate >= sDate && dDate <= eDate;
      });
    }
  }

  const map = new Map();
  filtered.forEach((item) => {
    const dDate = parseIndoDate(item.tanggal);
    let key = "";

    if (filter === "7hari" || filter === "custom") {
      key = item.tanggal;
    } else if (filter === "mingguan") {
      const weekNum = Math.ceil(dDate.getDate() / 7);
      const monthStr = dDate.toLocaleString("id-ID", { month: "short" });
      key = `Mg ${weekNum} ${monthStr} ${dDate.getFullYear()}`;
    } else if (filter === "bulanan") {
      key = `${dDate.toLocaleString("id-ID", { month: "short" })} ${dDate.getFullYear()}`;
    } else if (filter === "tahun") {
      key = `${dDate.getFullYear()}`;
    }

    const current = map.get(key) || { amount: 0, sortDate: dDate };
    map.set(key, {
      amount: current.amount + item.saldoAkhir,
      sortDate: current.sortDate,
    });
  });

  const sortedEntries = Array.from(map.entries()).sort(
    (a, b) => a[1].sortDate - b[1].sortDate,
  );

  let finalEntries = sortedEntries;
  if (filter === "7hari" && sortedEntries.length > 7) {
    finalEntries = sortedEntries.slice(-7);
  }

  const labels = finalEntries.map((e) => e[0]);
  const chartData = finalEntries.map((e) => e[1].amount);

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
            backgroundColor: "rgba(230, 81, 0, 0.2)",
            borderColor: "#E65100",
            borderWidth: 2,
            pointBackgroundColor: "#D62828",
            pointRadius: 4,
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
      },
    });
  }
};

// --- 9. GENERATE UNDUH LAPORAN PDF ---
document
  .getElementById("pdfFilterType")
  .addEventListener("change", function () {
    const val = this.value;
    document.getElementById("filterHarian").classList.add("hidden");
    document.getElementById("filterBulanan").classList.add("hidden");
    document.getElementById("filterCustom").classList.add("hidden");

    if (val === "harian")
      document.getElementById("filterHarian").classList.remove("hidden");
    else if (val === "bulanan")
      document.getElementById("filterBulanan").classList.remove("hidden");
    else if (val === "custom")
      document.getElementById("filterCustom").classList.remove("hidden");
  });

document.getElementById("btnDownloadPdf").addEventListener("click", () => {
  if (!allReportsGlobal || allReportsGlobal.length === 0) {
    alert("Tidak ada data di database untuk dicetak.");
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
      alert("Mohon pilih tanggal terlebih dahulu.");
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
      alert("Mohon pilih bulan terlebih dahulu.");
      return;
    }
    const parts = paramBulanan.split("-");
    const strTgt = `${parts[1]}/${parts[0]}`;
    dataToPrint = dataToPrint.filter((d) => d.tanggal.includes(strTgt));
  } else if (filterType === "custom") {
    if (!paramStart || !paramEnd) {
      alert("Mohon lengkapi rentang tanggal.");
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
    alert("Tidak ada data laporan yang ditemukan pada rentang waktu tersebut.");
    return;
  }

  document.getElementById("loading").classList.remove("hidden");

  const executePDFGeneration = (logoImgBase64) => {
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "pt", "a4");
      dataToPrint.sort((a, b) => a.timestamp - b.timestamp);

      if (logoImgBase64) {
        doc.addImage(logoImgBase64, "PNG", 40, 30, 60, 60);
        doc.setFontSize(18);
        doc.setFont(undefined, "bold");
        doc.setTextColor(214, 40, 40);
        doc.text("LAPORAN REKAP PENJUALAN", 115, 50);
        doc.setFontSize(14);
        doc.setFont(undefined, "normal");
        doc.setTextColor(40, 40, 40);
        doc.text("PM Fried Chicken Kendayakan", 115, 68);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Kendayakan, Terisi, Indramayu", 115, 82);
      } else {
        doc.setFontSize(18);
        doc.setFont(undefined, "bold");
        doc.setTextColor(214, 40, 40);
        doc.text("LAPORAN REKAP PENJUALAN", 40, 50);
        doc.setFontSize(14);
        doc.setFont(undefined, "normal");
        doc.setTextColor(40, 40, 40);
        doc.text("PM Fried Chicken Kendayakan", 40, 68);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Kendayakan, Terisi, Indramayu", 40, 82);
      }

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
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan sistem saat memproses PDF.");
    } finally {
      document.getElementById("loading").classList.add("hidden");
    }
  };

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = "logo.png";

  // Fix: jsPDF addImage butuh data image yang bisa dibaca.
  // Jika load logo gagal, langsung jalankan tanpa logo.
  img.onload = () => {
    try {
      // Convert ke base64 agar pasti kompatibel dengan jsPDF.
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const base64 = canvas.toDataURL("image/png");
      executePDFGeneration(base64);
    } catch (e) {
      console.warn("⚠️ Gagal konversi logo ke base64, lanjut tanpa logo:", e);
      executePDFGeneration(null);
    }
  };

  img.onerror = () => {
    console.warn("⚠️ logo.png gagal dimuat, lanjut tanpa logo");
    executePDFGeneration(null);
  };
});

// UI Triggers Tambahan
window.closeModal = (id) => document.getElementById(id).classList.add("hidden");
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

document.getElementById("btnPreview").addEventListener("click", () => {
  if (validateForm()) {
    document.getElementById("previewText").textContent = generateReportText();
    document.getElementById("previewModal").classList.remove("hidden");
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

window.addEventListener("DOMContentLoaded", () => {
  setupQtyControls();
  const isDark = localStorage.getItem("pm_darkmode") === "true";
  if (isDark) document.body.classList.add("dark-mode");
  document.getElementById("themeIcon").className = isDark
    ? "fas fa-sun"
    : "fas fa-moon";
});
