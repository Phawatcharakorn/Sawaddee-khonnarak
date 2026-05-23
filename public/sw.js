/* ════════════════════════════════════════
   Wave Music — Service Worker
   เปลี่ยน CACHE_VERSION เมื่อ deploy ใหม่
   ════════════════════════════════════════ */
const CACHE_VERSION = "wave-v1";
const STATIC_ASSETS = ["/", "/index.html", "/style.css", "/app.js", "/manifest.json"];

// ── Install: cache static assets ──────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first สำหรับ static, network-first สำหรับ API ──────────
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API calls — always go to network
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => new Response("{}", { headers: { "Content-Type": "application/json" } })));
    return;
  }

  // Static assets — cache first, fallback network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
      }
      return res;
    }))
  );
});
