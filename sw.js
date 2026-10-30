// Scales service worker. Opens Scales with no connection.
// Network first: online, the latest files are fetched and the copy refreshed; offline, the copy is used.

// Must match VERSION in core.js (a test checks), so phones drop the old copy.
const CACHE = "scales-v2.8.0";
const SHELL = ["./", "index.html", "core.js", "core.js?v=2.8.0", "sets.js", "sets.js?v=2.8.0", "manifest.webmanifest", "fonts/geist-latin.woff2",
  "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon-32.png",
  "icons/pick/auto.png", "icons/pick/pistachio.png", "icons/pick/plum.png", "icons/pick/bone.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });

// Every other copy goes: older versions, Scales 1's ("scales-v1...", "scales-state") and the trial's ("scales-next-v...").
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: "no-cache" }).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
  );
});
