# 🚀 Quick Start Firebase untuk PM Rekap App

## ⚡ Setup dalam 5 Menit

### 1️⃣ Buat Project Firebase (2 menit)

```
https://console.firebase.google.com/
→ Klik "+ Add project"
→ Nama: pm-rekap-app
→ Finish
```

### 2️⃣ Buat Realtime Database (1 menit)

```
Build → Realtime Database → Create Database
→ Lokasi: asia-southeast1 (untuk Indonesia)
→ Mode: Test Mode
→ Enable
```

### 3️⃣ Copy Konfigurasi (1 menit)

```
⚙️ Project Settings → Your apps → </>
→ Copy seluruh firebaseConfig
```

### 4️⃣ Update File (1 menit)

Edit `firebase-config.js` dan paste config:

```javascript
const firebaseConfig = {
  apiKey: "PASTE_HERE",
  authDomain: "PASTE_HERE",
  databaseURL: "PASTE_HERE",
  projectId: "PASTE_HERE",
  storageBucket: "PASTE_HERE",
  messagingSenderId: "PASTE_HERE",
  appId: "PASTE_HERE",
};
```

### 5️⃣ Test!

```
Buka aplikasi di browser
Lihat Console (F12):
  ✅ "Firebase berhasil diinisialisasi"
Simpan data → cek di Firebase Console
```

---

## 🎯 Yang Bisa Dilakukan Sekarang

| Fitur           | Sebelum            | Sekarang               |
| --------------- | ------------------ | ---------------------- |
| Penyimpanan     | Local browser saja | Cloud Firebase + Local |
| Multi-device    | ❌                 | ✅ Realtime sync       |
| Backup          | Manual             | Otomatis di cloud      |
| Admin Dashboard | Statis             | Realtime update        |
| Fallback        | Tidak ada          | ✅ Tetap berfungsi     |

---

## 💡 Mode Fallback

Jika Firebase tidak tersedia:

- Aplikasi tetap jalan ✅
- Data disimpan ke localStorage ✅
- Tidak ada sinkronisasi ⚠️

---

## 📚 Dokumentasi Lengkap

Baca **FIREBASE_SETUP.md** untuk:

- Setup lebih detail
- Troubleshooting
- Production setup
- Security rules

---

## 🆘 Jika Ada Error

**Error: "Firebase not initialized"**
→ Tunggu beberapa detik, refresh halaman

**Data tidak muncul di Firebase Console**
→ Pastikan sudah login dan simpan data
→ Cek Rules di Realtime Database

**Mau offline tapi tetap simpan data**
→ Aplikasi otomatis jatuh ke localStorage
→ Saat online lagi, sync manual diperlukan

---

## ✨ Selesai!

Database Anda sekarang **realtime** dan **tersinkronisasi di cloud** 🎉

Cek Console (F12) untuk debug logs dengan emoji ✅ 📍 ❌
