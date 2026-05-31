/* ════════════════════════════════════════
   Wave Music — Service Worker
   ════════════════════════════════════════ */
const CACHE_VERSION = "wave-v3";
const PRECACHE = ["/", "/index.html", "/manifest.json"];

// ── Install ───────────────────────────────────────────────────────────────
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clear old caches ────────────────────────────────────────────
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // API — always network
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => new Response("{}", { headers: { "Content-Type": "application/json" } }))
    );
    return;
  }

  // CSS / JS — network-first: always fetch fresh, cache as fallback
  if (url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(c => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Everything else — cache-first, update in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || net;
    })
  );
});
