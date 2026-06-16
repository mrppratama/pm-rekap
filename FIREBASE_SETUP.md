# 📱 PM Rekap App - Setup Firebase Realtime Database

## Fitur Baru: Database Realtime dengan Firebase ✅

Database aplikasi **PM Fried Chicken** telah diperbarui menggunakan **Firebase Realtime Database**. Ini memungkinkan:

✅ **Sinkronisasi Real-time** - Data otomatis tersimpan dan tersinkronisasi ke cloud
✅ **Multi-Device Access** - Akses data dari perangkat berbeda secara bersamaan
✅ **Fallback Mode** - Aplikasi tetap bekerja menggunakan localStorage jika Firebase tidak tersedia
✅ **Backup Otomatis** - Semua data tersimpan aman di cloud Firebase

---

## 🔧 Setup Awal (PENTING!)

### Langkah 1: Buat Project Firebase

1. Buka https://console.firebase.google.com/
2. Klik **"+ Add project"** atau pilih project yang ada
3. Isi nama project: `pm-rekap-app` (atau nama lain)
4. Ikuti wizard setup hingga selesai

### Langkah 2: Buat Realtime Database

1. Di Firebase Console, klik **"Build"** → **"Realtime Database"**
2. Klik **"Create Database"**
3. Pilih lokasi server (contoh: **asia-southeast1** untuk Indonesia)
4. Pilih mode keamanan: **Start in Test Mode** (untuk testing)
5. Klik **"Enable"**

### Langkah 3: Konfigurasi Aturan Keamanan

Di tab **"Rules"**, ganti dengan kode ini untuk production:

```json
{
  "rules": {
    "reports": {
      ".read": true,
      ".write": true,
      ".validate": "newData.hasChildren(['hari', 'tanggal', 'kasir', 'penjualan', 'saldoAkhir'])"
    }
  }
}
```

Klik **"Publish"** untuk menyimpan.

**⚠️ CATATAN KEAMANAN:**

- Mode `Test Mode` di atas hanya untuk testing (berlaku 30 hari)
- Untuk production, tambahkan authentication atau ganti rules dengan lebih ketat
- Jangan bagikan API key ke publik

### Langkah 4: Ambil Konfigurasi Firebase

1. Di Firebase Console, klik ⚙️ **"Project Settings"**
2. Pilih tab **"Your apps"**
3. Klik icon web `</>`
4. Copy seluruh konfigurasi `firebaseConfig` (dari `apiKey` hingga `appId`)

### Langkah 5: Update File Konfigurasi

Buka file `firebase-config.js` dan ganti `firebaseConfig` dengan konfigurasi Anda:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

---

## 🚀 Menggunakan Aplikasi

### Kasir Mode

- Login dengan PIN `1234`
- Isi form laporan seperti biasa
- Klik **"Simpan dan Kirim WA"** → Data otomatis tersimpan ke Firebase
- Lihat riwayat di **"Lihat Riwayat Database"**

### Owner/Admin Mode

- Login dengan PIN `8888`
- Lihat dashboard dengan statistik realtime
- Data diperbarui otomatis saat kasir menyimpan laporan baru
- Klik edit untuk memperbaiki laporan yang ada
- Download laporan PDF kapan saja

---

## 💾 Fallback ke Local Storage

Jika Firebase tidak tersedia:

- ✅ Aplikasi tetap berfungsi normal
- ✅ Data disimpan di **localStorage** (browser lokal)
- ⚠️ Data tidak tersinkronisasi antar device
- ⚠️ Data hilang jika cache browser dihapus

---

## 🔍 Troubleshooting

### Masalah: "Firebase Configuration Error"

**Solusi:**

- Pastikan internet terkoneksi
- Cek konfigurasi di `firebase-config.js`
- Buka DevTools (F12) → Console untuk melihat error detail

### Masalah: Data tidak tersimpan di Firebase

**Solusi:**

- Pastikan Database URL benar di `firebase-config.js`
- Cek Rules di Firebase Console sudah di-publish
- Lihat Console untuk error message

### Masalah: Data tidak sync antar device

**Solusi:**

- Gunakan URL yang sama untuk kedua device
- Pastikan kedua device terhubung internet
- Refresh halaman di device lain

---

## 📊 Struktur Database Firebase

```
reports/
├── report1_uid (auto-generated)
│   ├── hari: "Senin"
│   ├── tanggal: "16/06/2026"
│   ├── jam: "09:30"
│   ├── kasir: "Budi"
│   ├── penjualan: 500000
│   ├── saldoAkhir: 450000
│   ├── timestamp: 1718527200000
│   └── rawData: { ... }
└── report2_uid
    └── { ... }
```

---

## 🔐 Upgrade ke Production (Opsional)

Untuk aplikasi production, tambahkan authentication:

1. Di Firebase Console → **Authentication** → **Sign-in method**
2. Enable **Email/Password**
3. Update Rules untuk validasi user:

```json
{
  "rules": {
    "reports": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

4. Tambahkan login screen dengan Firebase Auth di aplikasi

---

## 📝 Perubahan pada File

### index.html

- Tambah Firebase SDK scripts

### firebase-config.js (BARU)

- Konfigurasi Firebase dengan kredensial Anda

### script.js

- Ganti IndexedDB dengan Firebase Realtime Database
- Tambah fallback ke localStorage
- Real-time data sync

---

## ✅ Checklist Setup

- [ ] Buat project Firebase di console.firebase.google.com
- [ ] Buat Realtime Database
- [ ] Konfigurasi Rules keamanan
- [ ] Copy firebaseConfig dari Project Settings
- [ ] Update firebase-config.js dengan kredensial Anda
- [ ] Test: Buka aplikasi di browser
- [ ] Test: Lihat console (F12) → pastikan "✅ Firebase berhasil diinisialisasi"
- [ ] Test: Simpan laporan dan cek di Firebase Console → Realtime Database
- [ ] Test: Buka di device lain dan cek sinkronisasi data

---

## 🆘 Support

Jika ada error, cek:

1. Console browser (F12) untuk pesan error
2. Firebase Console → Realtime Database → melihat data terstruktur
3. Network tab untuk melihat koneksi ke Firebase

Selamat menggunakan! 🎉
