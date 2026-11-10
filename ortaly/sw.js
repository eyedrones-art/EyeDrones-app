// Ortaly — service worker: rende l'app installabile e mostra le notifiche dei nuovi ordini.
// Non salva pagine in memoria: Ortaly mostra sempre prezzi e ordini aggiornati.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  e.waitUntil(self.registration.showNotification("Nuovo ordine su Ortaly", {
    body: "Un cliente ti ha mandato un ordine: tocca per vederlo e accettarlo.",
    icon: "/icona-192.png",
    badge: "/badge-96.png",
    tag: "ortaly-ordine",
    renotify: true,
    vibrate: [180, 80, 180],
    data: { url: "/#vendo" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/#vendo";
  e.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const f of finestre) {
      if (new URL(f.url).origin === self.location.origin) { await f.focus(); f.postMessage({ tipo: "apri-ordini" }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
