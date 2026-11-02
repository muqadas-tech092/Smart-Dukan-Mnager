/* Service worker: caches the app shell so it opens instantly and works offline.
   Bump CACHE_VERSION whenever files change so clients pick up the update. */
const CACHE_VERSION = "sdm-v2.0.0";
const SHELL = [
  "./", "./index.html", "./config.js", "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js", "./js/store.js", "./js/ui.js", "./js/icons.js", "./js/i18n.js", "./js/charts.js", "./js/router.js",
  "./js/views/dashboard.js", "./js/views/pos.js", "./js/views/inventory.js", "./js/views/customers.js",
  "./js/views/khata.js", "./js/views/sales.js", "./js/views/expenses.js", "./js/views/reports.js",
  "./js/views/settings.js", "./js/views/onboarding.js",
  "./assets/logo.png", "./assets/placeholder.png", "./assets/empty_box.png", "./assets/empty_cart.png",
  "./assets/empty_receipt.png", "./assets/empty_users.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Fonts and other cross-origin assets: network first, fall back to cache.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }
  // Same-origin app files: cache first, refresh in the background.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetching = fetch(req).then((res) => {
        if (res && res.ok) caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetching;
    })
  );
});
