const CACHE_NAME = "pm-rekap-v1.2";
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./firebase-config.js",
  "./favicon-32.png",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800;900&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
];

// 1. Install Event - Cache Static Assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("SW install cache warning:", err))
  );
});

// 2. Activate Event - Clean Up Old Caches
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

// 3. Fetch Event - Network First with Cache Fallback for HTML/Data, Cache First for Static
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Skip non-GET requests or Firebase DB websocket/HTTP calls
  if (
    request.method !== "GET" ||
    request.url.includes("firebaseio.com") ||
    request.url.includes("google.com/recaptcha") ||
    request.url.startsWith("chrome-extension://")
  ) {
    return;
  }

  // Network-First strategy with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // If response is valid, clone and update cache
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache if offline
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
      })
  );
});
