// Scales service worker.
// Keeps a copy of the app shell so Scales opens with no connection.
// Network first: when online, the latest files are fetched and the cache is refreshed,
// so updates show up the next time the app opens.

// Bump this name whenever cached files change so phones drop the old copy.
const CACHE = "scales-v1.40.0";

// Files needed to open the app offline.
const SHELL = ["./", "index.html", "core.js", "fonts/geist-latin.woff2", "manifest.webmanifest", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png", "icons/favicon-64.png"];

// Install: cache the shell and take over right away instead of waiting for old tabs to close.
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });

// Activate: delete caches from older versions.
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Fetch: only handles GET requests for this site (and Google Fonts, kept for phones that cached them before 1.28.0).
// Try the network, save a fresh copy, and fall back to the cache when offline.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "api.anthropic.com") return; // never cache AI calls
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  // Same-origin files skip the browser's HTTP cache (GitHub Pages sends max-age=600),
  // so a new version is picked up on the next launch instead of up to ten minutes later.
  e.respondWith(
    fetch(req, sameOrigin ? { cache: "no-cache" } : undefined).then(res => {
      if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
