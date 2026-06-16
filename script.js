<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PM Fried Chicken - Sistem Rekap</title>
    <link rel="stylesheet" href="style.css" />
    <link rel="manifest" href="manifest.json" />
    <meta name="theme-color" content="#D62828" />
    <link
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
      rel="stylesheet"
    />
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <!-- Firebase SDK (compat untuk mendukung kode v8 seperti firebase.database().ref()) -->
    <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/10.7.0/firebase-database-compat.js"></script>
  </head>

  <body>
    <div id="loginBg" class="login-bg"></div>
    <div id="loading" class="loading-overlay hidden">
      <div class="spinner"></div>
    </div>
    <div id="toast" class="toast hidden"></div>

    <header class="app-header" id="appHeader">
      <div class="header-content">
        <div class="logo-container">
          <img src="logo.png" alt="Logo PM" class="logo-img" />
        </div>
        <div class="header-text">
          <h1 id="mainTitle">PM Fried Chicken Kendayakan</h1>
          <p id="subTitle">Sistem Rekap Penjualan Harian</p>
        </div>
      </div>
      <div class="header-actions">
        <button id="darkModeToggle" class="btn-icon" title="Ganti Tema">
          <i class="fas fa-moon" id="themeIcon"></i>
        </button>
        <button id="btnLogout" class="btn-icon hidden" title="Keluar">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </header>

    <main id="view-login" class="container view-section">
      <div class="login-card">
        <h2 style="color: var(--text-main)">
          <i class="fas fa-lock"></i> Masuk ke Sistem
        </h2>
        <div class="form-group" style="margin-top: 25px">
          <input
            type="password"
            id="loginPin"
            placeholder="Masukkan PIN"
            style="text-align: center; font-size: 1.5rem; letter-spacing: 5px"
            autocomplete="off"
          />
        </div>
        <button
          id="btnLogin"
          type="button"
          class="btn btn-yellow btn-full"
          style="margin-top: 15px; font-size: 1.1rem; color: #1a1a1a"
        >
          Masuk
        </button>
      </div>
    </main>

    <main id="view-kasir" class="container view-section hidden">
      <div class="top-action-bar">
        <button
          id="btnRiwayat"
          type="button"
          class="btn btn-secondary btn-small"
        >
          <i class="fas fa-database"></i> Lihat Riwayat Database
        </button>
      </div>

      <section class="card">
        <h2><i class="fas fa-info-circle"></i> Informasi Umum</h2>
        <div class="grid-2">
          <div class="form-group">
            <label>Hari</label
            ><input type="text" id="hari" readonly class="readonly-input" />
          </div>
          <div class="form-group">
            <label>Tanggal</label
            ><input type="text" id="tanggal" readonly class="readonly-input" />
          </div>
          <div class="form-group">
            <label>Nama Kasir <span class="text-red">*</span></label
            ><input
              type="text"
              id="kasir"
              placeholder="Contoh: Budi"
              required
              autocomplete="off"
            />
          </div>
          <div class="form-group">
            <label>Jam</label
            ><input type="text" id="jam" readonly class="readonly-input" />
          </div>
        </div>
      </section>

      <div class="grid-2-desktop">
        <div class="col-left">
          <section class="card">
            <h2><i class="fas fa-box-open"></i> Stok Awal</h2>
            <div class="grid-2">
              <div class="form-group">
                <label
                  >Fried Chicken (pcs) <span class="text-red">*</span></label
                >
                <div class="qty-control">
                  <button type="button" class="btn-qty minus">
                    <i class="fas fa-minus"></i></button
                  ><input
                    type="number"
                    id="awalFc"
                    class="calc-input"
                    value="0"
                    required
                  /><button type="button" class="btn-qty plus">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label>Nasi (porsi) <span class="text-red">*</span></label>
                <div class="qty-control">
                  <button type="button" class="btn-qty minus">
                    <i class="fas fa-minus"></i></button
                  ><input
                    type="number"
                    id="awalNasi"
                    class="calc-input"
                    value="0"
                    required
                  /><button type="button" class="btn-qty plus">
                    <i class="fas fa-plus"></i>
                  </button>
                </div>
              </div>
            </div>
          </section>
          <section class="card highlight-card">
            <h2><i class="fas fa-boxes"></i> Stok Akhir</h2>
            <div class="grid-2">
              <div class="stat-box">
                <span>Fried Chicken</span>
                <h3 id="akhirFc">0</h3>
              </div>
              <div class="stat-box">
                <span>Nasi</span>
                <h3 id="akhirNasi">0</h3>
              </div>
            </div>
          </section>
        </div>

        <div class="col-right">
          <section class="card">
            <h2><i class="fas fa-shopping-cart"></i> Penjualan Hari Ini</h2>
            <div class="sales-list">
              <div class="sales-item">
                <div class="sales-info">
                  <strong>Fried Chicken</strong><span>@ Rp10.000</span>
                </div>
                <div class="sales-controls">
                  <div class="qty-control">
                    <button type="button" class="btn-qty minus">
                      <i class="fas fa-minus"></i></button
                    ><input
                      type="number"
                      id="jualFc"
                      class="calc-input"
                      value="0"
                      required
                    /><button type="button" class="btn-qty plus">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                  <div class="sales-subtotal" id="subFc">Rp0</div>
                </div>
              </div>
              <div class="sales-item">
                <div class="sales-info">
                  <strong>Ayam Geprek</strong><span>@ Rp13.000</span>
                </div>
                <div class="sales-controls">
                  <div class="qty-control">
                    <button type="button" class="btn-qty minus">
                      <i class="fas fa-minus"></i></button
                    ><input
                      type="number"
                      id="jualGeprek"
                      class="calc-input"
                      value="0"
                      required
                    /><button type="button" class="btn-qty plus">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                  <div class="sales-subtotal" id="subGeprek">Rp0</div>
                </div>
              </div>
              <div class="sales-item">
                <div class="sales-info">
                  <strong>Nasi</strong><span>@ Rp3.000</span>
                </div>
                <div class="sales-controls">
                  <div class="qty-control">
                    <button type="button" class="btn-qty minus">
                      <i class="fas fa-minus"></i></button
                    ><input
                      type="number"
                      id="jualNasi"
                      class="calc-input"
                      value="0"
                      required
                    /><button type="button" class="btn-qty plus">
                      <i class="fas fa-plus"></i>
                    </button>
                  </div>
                  <div class="sales-subtotal" id="subNasi">Rp0</div>
                </div>
              </div>
            </div>
            <div class="total-bar">
              <span>Total Penjualan</span
              ><strong id="totalPenjualan">Rp0</strong>
            </div>
          </section>
        </div>
      </div>

      <section class="card">
        <div class="header-between">
          <h2><i class="fas fa-hand-holding-usd"></i> Pemasukan Lainnya</h2>
          <button type="button" id="btnAddIncome" class="btn-small btn-green">
            <i class="fas fa-plus"></i> Tambah
          </button>
        </div>
        <div id="incomeList"></div>
        <div class="total-bar">
          <span>Total Pemasukan Lainnya</span
          ><strong id="totalPemasukan" class="text-green">Rp0</strong>
        </div>
      </section>

      <section class="card">
        <div class="header-between">
          <h2><i class="fas fa-receipt"></i> Pengeluaran</h2>
          <button type="button" id="btnAddExpense" class="btn-small btn-yellow">
            <i class="fas fa-plus"></i> Tambah
          </button>
        </div>
        <div id="expenseList"></div>
        <div class="total-bar expense-bar">
          <span>Total Pengeluaran</span
          ><strong id="totalPengeluaran" class="text-red">Rp0</strong>
        </div>
      </section>

      <section class="card summary-card">
        <h2><i class="fas fa-chart-pie"></i> Rekap Akhir</h2>
        <div class="summary-grid">
          <div class="summary-item">
            <span>Total Penjualan</span><strong id="sumPenjualan">Rp0</strong>
          </div>
          <div class="summary-item">
            <span>Total Pemasukan Lainnya</span
            ><strong id="sumPemasukan" class="text-green">Rp0</strong>
          </div>
          <div class="summary-item">
            <span>Total Pengeluaran</span
            ><strong id="sumPengeluaran" class="text-red">Rp0</strong>
          </div>
          <div class="summary-item final">
            <span>Saldo Akhir</span><strong id="saldoAkhir">Rp0</strong>
          </div>
        </div>
      </section>

      <div class="action-buttons">
        <button id="btnReset" type="button" class="btn btn-outline">
          <i class="fas fa-undo"></i> Reset Form
        </button>
        <button id="btnBatalEdit" type="button" class="btn btn-danger hidden">
          <i class="fas fa-times"></i> Batal Edit
        </button>
        <button id="btnPreview" type="button" class="btn btn-secondary">
          <i class="fas fa-eye"></i> Preview WA
        </button>
        <button id="btnKirimWAEdit" type="button" class="btn btn-green hidden">
          <i class="fab fa-whatsapp"></i> Kirim Pesan WA
        </button>
        <button
          id="btnSimpanKirim"
          type="button"
          class="btn btn-primary btn-large"
        >
          <i class="fas fa-save"></i> Simpan dan Kirim WA
        </button>
      </div>
    </main>

    <main id="view-kasir-history" class="container view-section hidden">
      <div class="top-action-bar">
        <button
          id="btnKembaliKasir"
          type="button"
          class="btn btn-secondary btn-small"
        >
          <i class="fas fa-arrow-left"></i> Kembali ke Form Input
        </button>
      </div>
      <section class="card">
        <h2><i class="fas fa-database"></i> Riwayat Database Anda</h2>
        <div id="historyContainer" class="history-container">
          <p class="text-muted">Memuat data database...</p>
        </div>
      </section>
    </main>

    <main id="view-admin" class="container view-section hidden">
      <div class="grid-3">
        <div class="stat-card red">
          <div class="stat-icon"><i class="fas fa-calendar-day"></i></div>
          <div class="stat-details">
            <span>Saldo Hari Ini</span>
            <h3 id="statToday">Rp0</h3>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon"><i class="fas fa-calendar-week"></i></div>
          <div class="stat-details">
            <span>Saldo Bulan Ini</span>
            <h3 id="statMonth">Rp0</h3>
          </div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-icon"><i class="fas fa-receipt"></i></div>
          <div class="stat-details">
            <span>Total Laporan</span>
            <h3 id="statTotalDoc">0</h3>
          </div>
        </div>
      </div>

      <section class="card" style="margin-top: 20px">
        <div class="header-between admin-wrap-header">
          <h2><i class="fas fa-chart-line"></i> Grafik Pendapatan Bersih</h2>
          <div class="admin-chart-dropdown">
            <select
              id="chartFilterType"
              style="padding: 8px; border-radius: 6px; width: 100%"
            >
              <option value="7hari">7 Hari Terakhir</option>
              <option value="mingguan">Per Minggu</option>
              <option value="bulanan">Per Bulan</option>
              <option value="tahun">Per Tahun</option>
              <option value="custom">Custom Tanggal</option>
            </select>
          </div>
        </div>
        <div
          id="chartFilterCustom"
          class="grid-2 hidden"
          style="
            margin-bottom: 15px;
            background: var(--bg-color);
            padding: 10px;
            border-radius: 8px;
            border: 1px solid var(--border-color);
          "
        >
          <div class="form-group">
            <label>Dari Tanggal</label><input type="date" id="chartDateStart" />
          </div>
          <div class="form-group">
            <label>Sampai Tanggal</label><input type="date" id="chartDateEnd" />
          </div>
          <button
            id="btnApplyChartFilter"
            class="btn btn-orange"
            style="grid-column: 1 / -1"
          >
            Terapkan Filter Custom
          </button>
        </div>

        <div class="chart-wrapper">
          <canvas id="salesChart"></canvas>
        </div>
      </section>

      <section
        class="card"
        style="margin-top: 20px; overflow: hidden; max-width: 100%"
      >
        <h2><i class="fas fa-database"></i> Database Laporan Keseluruhan</h2>
        <div id="adminHistoryContainer" class="history-container"></div>
      </section>

      <section class="card" style="margin-top: 20px">
        <h2><i class="fas fa-file-pdf"></i> Unduh Rekapan PDF</h2>
        <div class="grid-2">
          <div class="form-group">
            <label>Pilih Rentang Waktu</label>
            <select
              id="pdfFilterType"
              style="
                padding: 10px;
                border-radius: 8px;
                border: 1px solid var(--border-color);
                background: var(--bg-color);
                color: var(--text-main);
              "
            >
              <option value="semua">Seluruh Data (Semua Waktu)</option>
              <option value="harian">Harian (Satu Hari Tertentu)</option>
              <option value="mingguan">Mingguan (7 Hari Terakhir)</option>
              <option value="bulanan">Bulanan (Bulan Tertentu)</option>
              <option value="custom">Kustom (Pilih Rentang Tanggal)</option>
            </select>
          </div>

          <div class="form-group hidden" id="filterHarian">
            <label>Pilih Tanggal</label>
            <input type="date" id="dateHarian" />
          </div>
          <div class="form-group hidden" id="filterBulanan">
            <label>Pilih Bulan</label>
            <input type="month" id="dateBulanan" />
          </div>
        </div>

        <div class="grid-2 hidden" id="filterCustom" style="margin-top: 15px">
          <div class="form-group">
            <label>Dari Tanggal</label><input type="date" id="dateStart" />
          </div>
          <div class="form-group">
            <label>Sampai Tanggal</label><input type="date" id="dateEnd" />
          </div>
        </div>

        <button
          id="btnDownloadPdf"
          class="btn btn-orange"
          style="margin-top: 15px; width: 100%"
        >
          <i class="fas fa-download"></i> Buat & Unduh Laporan PDF
        </button>
      </section>
    </main>

    <div id="previewModal" class="modal hidden">
      <div class="modal-content">
        <span class="close-modal" onclick="closeModal('previewModal')"
          >&times;</span
        >
        <h2>Preview Teks WhatsApp</h2>
        <pre
          id="previewText"
          style="
            white-space: pre-wrap;
            font-family: monospace;
            word-break: break-word;
            overflow-wrap: break-word;
          "
        ></pre>
        <div class="modal-actions">
          <button
            id="btnKirimModal"
            type="button"
            class="btn btn-green btn-full"
          >
            <i class="fab fa-whatsapp"></i> Kirim Pesan WA
          </button>
        </div>
      </div>
    </div>

    <footer>
      <p>COPYRIGHT PM FRIED CHICKEN 2026</p>
    </footer>

    <script src="firebase-config.js"></script>
    <script src="script.js"></script>
  </body>
</html>
