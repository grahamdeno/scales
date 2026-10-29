// The trial's worker, retired: it removes its cache and itself, so /app/next/ simply forwards to Scales.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("scales-next-v")).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
