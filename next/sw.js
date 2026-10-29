// Scales (next) service worker. Opens the new Scales with no connection.
// Network first: online, the latest files are fetched and the copy refreshed; offline, the copy is used.
// It keeps its own cache ("scales-next-v...") and never touches the current app's "scales-v..." cache.

// Bump this with VERSION in core.js so phones drop the old copy.
const CACHE = "scales-next-v2.0.0-next.1";
const SHELL = ["./", "index.html", "core.js", "core.js?v=2.0.0-next.1", "manifest.webmanifest",
  "../icons/apple-touch-icon.png", "../icons/icon-192.png", "../icons/icon-512.png", "../icons/favicon-32.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("scales-next-v") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
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
