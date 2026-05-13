// Service worker — offline support for the dashboard
// Cache strategy:
//   - HTML (the app shell): network-first with cache fallback
//     -> ensures users get fresh code when online, work offline otherwise
//   - email-triage.json: network-first (always try latest)
//   - everything else (icons, manifest): cache-first (rarely change)

const CACHE = 'dtd-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Don't intercept cross-origin (e.g. Gemini API, Outlook MCP redirects)
  if (url.origin !== self.location.origin) return;

  const isHtml = req.destination === 'document' || url.pathname.endsWith('.html');
  const isTriage = url.pathname.endsWith('email-triage.json');

  if (isHtml || isTriage) {
    // Network-first
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
  } else {
    // Cache-first
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => null);
        return res;
      }))
    );
  }
});
