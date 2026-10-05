// Eyedrones — service worker: rende l'app installabile e la fa aprire anche con poca rete.
// Regole semplici per non mostrare mai una versione vecchia:
// - pagine: prima la rete, la copia salvata solo se si è offline
// - file in /assets/ (hanno un nome nuovo a ogni versione): prima la copia salvata
// - tutto ciò che non è di questo sito (Supabase, meteo, mappe...) non passa di qui
const CACHE = "eyedrones-v1";
const BASE = ["/", "/favicon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/.netlify/")) return;
  // le pagine partner sono a parte: non vanno salvate al posto dell'app
  if (url.pathname.startsWith("/partner-")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copia));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then((salvata) => salvata || fetch(req).then((res) => {
        if (res.ok) { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)); }
        return res;
      }))
    );
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});
