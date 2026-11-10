// Ortaly — service worker: rende l'app installabile e mostra le notifiche dei nuovi ordini.
// Non salva pagine in memoria: Ortaly mostra sempre prezzi e ordini aggiornati.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch (x) { m = {}; }
  const url = typeof m.url === "string" && /^\/(?!\/)/.test(m.url) ? m.url : "/#vendo";
  e.waitUntil(self.registration.showNotification(m.titolo || "Novità su Ortaly", {
    body: m.testo || "Hai un nuovo ordine o un messaggio: tocca per vederlo.",
    icon: "/icona-192.png",
    badge: "/badge-96.png",
    tag: "ortaly-" + url,
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/#vendo";
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of finestre) {
      if (new URL(f.url).origin === self.location.origin) { await f.focus(); f.postMessage({ tipo: "apri", url }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
