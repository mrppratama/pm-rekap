// Firebase Configuration
// PENTING: Ganti dengan konfigurasi Firebase Anda sendiri!
const firebaseConfig = {
  apiKey: "AIzaSyBxRTtERQDDMItbUvtymLhJlc_kNuhCjD8",
  authDomain: "pm-rekapp-app.firebaseapp.com",
  databaseURL:
    "https://pm-rekapp-app-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pm-rekapp-app",
  storageBucket: "pm-rekapp-app.firebasestorage.app",
  messagingSenderId: "180516020369",
  appId: "1:180516020369:web:1e4492a5c4f8a8d2c29f30",
};

// ===== Adapter agar kompatibel dengan Firebase SDK yang dipakai di index.html =====
// index.html memuat:
//   - firebase-app.js (v10)
//   - firebase-database.js (v10)
// Tetapi script.js masih memakai pola v8 global (firebase.database(), ref(), push(), on('value')).
// File ini menyediakan adapter global yang dibutuhkan script.js.

let firebaseApp = null;
let firebaseDb = null;

try {
  // Jika versi modular memaparkan fungsi ke global (umumnya tidak), kita coba pakai itu.
  if (
    typeof window.initializeApp === "function" &&
    typeof window.getDatabase === "function"
  ) {
    firebaseApp = window.initializeApp(firebaseConfig);
    firebaseDb = window.getDatabase(firebaseApp);
  } else if (
    window.firebase &&
    window.firebase.initializeApp &&
    typeof window.firebase.database === "function"
  ) {
    // fallback v8 global
    firebaseApp = window.firebase.initializeApp(firebaseConfig);
    firebaseDb = window.firebase.database();
  } else {
    throw new Error(
      "Firebase SDK tidak memaparkan initializeApp/getDatabase atau firebase global v8. Cek apakah script Firebase yang dimuat di index.html sesuai dengan versi kode yang digunakan.",
    );
  }

  console.log("✅ Firebase berhasil diinisialisasi");
} catch (err) {
  console.error("❌ Error inisialisasi Firebase:", err);
  alert(
    "⚠️ Firebase belum terkonfigurasi.\n\nPastikan databaseURL benar dan Firebase SDK ter-load dengan benar.\n\nUntuk sementara, aplikasi akan menggunakan localStorage.",
  );
}

// ===== Sediakan API yang diharapkan oleh script.js =====
// script.js memakai:
//   firebaseDb = firebase.database();
//   db.ref('reports')
//   reportsRef.on('value', ...)
//   reportsRef.push().key
//   reportsRef.child(id).update/set/remove

// Jika firebaseDb berasal dari SDK v8, ref() sudah ada.
// Jika berasal dari SDK v10 modular, tidak ada ref/push/update/remove gaya v8 tanpa rewrite besar.
// Jadi adapter ini hanya menyiapkan getReportsRef untuk v8-style.

const getReportsRef = () => {
  if (firebaseDb && typeof firebaseDb.ref === "function") {
    return firebaseDb.ref("reports");
  }
  return null;
};

// Export untuk script.js
window.firebaseApp = firebaseApp;
window.firebaseDb = firebaseDb;
window.getReportsRef = getReportsRef;

// Tambahan kompatibilitas: pastikan global yang dicek script.js tersedia
// script.js saat ini mengecek `typeof firebaseDb !== 'undefined'` (tanpa window. prefix)
// sehingga kita set juga sebagai property global yang dapat terbaca.
try {
  window.firebase = window.firebase || window.firebaseApp || null;
} catch (_) {}

// set juga ke global scope agar `typeof firebaseDb` bernilai benar
// NOTE: tanpa 'use strict', assignment ke global var akan membuatnya bisa diakses oleh script.js
try {
  // @ts-ignore
  firebaseDb = window.firebaseDb;
  // @ts-ignore
  firebaseApp = window.firebaseApp;
  // @ts-ignore
  firebaseConfig = firebaseConfig;
} catch (_) {}

// pastikan juga property window tetap terisi
window.firebaseDb = firebaseDb;
window.firebaseApp = firebaseApp;
