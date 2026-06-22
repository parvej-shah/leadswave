// LeadsWave service worker — installability + offline resilience.
// Strategy:
//   • navigations  → network-first, fall back to cached page, then /offline
//   • static assets → stale-while-revalidate
//   • API / auth    → never cached (always network)
// Bump CACHE_VERSION to invalidate old caches on deploy.

const CACHE_VERSION = "v1";
const RUNTIME = `lw-runtime-${CACHE_VERSION}`;
const PRECACHE = `lw-precache-${CACHE_VERSION}`;

// Minimal app shell precached so the app opens offline.
const PRECACHE_URLS = ["/offline", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== RUNTIME && k !== PRECACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/.test(
      url.pathname
    )
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET; let the browser do the rest (POST, etc.).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only.
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth — these are dynamic / sensitive.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.includes("/api/auth")
  ) {
    return;
  }

  // Navigations → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || (await caches.match("/offline"));
        })
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
