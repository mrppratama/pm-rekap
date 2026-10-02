const CACHE_NAME = "pm-rekap-v4.8";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/firebase-config.js",
  "/kaching-sound-fix.mp3",
  "/kaching-sound-fx.mp3",
  "/favicon.png",
  "/favicon-32.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json"
];

// 1. Install Event - Cache Static Assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .catch((err) => console.warn("SW install cache warning:", err))
  );
});

// 2. Activate Event - Clean Up Old Caches & Take Control Immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or Firebase DB websocket/HTTP calls
  if (
    request.method !== "GET" ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.protocol.startsWith("chrome-extension")
  ) {
    return;
  }

  // Navigation: Network first, fallback to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match("/index.html") || caches.match("/");
      })
    );
    return;
  }

  // Static Assets: Cache first with network fallback & background cache update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === "basic" || networkResponse.type === "cors")
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});

// 4. Notification Click Event - Open or Focus PWA Window & Open Single Report Detail
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const reportId = event.notification.data ? event.notification.data.reportId : null;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url && "focus" in client) {
            client.focus();
            if (reportId) {
              client.postMessage({ type: "OPEN_REPORT_DETAIL", reportId: reportId });
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow("/").then((client) => {
            if (client && reportId) {
              setTimeout(() => {
                client.postMessage({ type: "OPEN_REPORT_DETAIL", reportId: reportId });
              }, 1000);
            }
          });
        }
      })
  );
});
