// Segnalazione automatica degli errori: quando qualcosa si rompe, l'app annota pagina e messaggio nella tabella
// errori_app (script supabase/errori-spazio-promemoria.sql). Niente dati personali: solo cosa e dove.
let inviati = 0;
const visti = new Set();
const pulisci = (t, max) => String(t || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]").slice(0, max);
// errori del browser o di estensioni che non dipendono dall'app
const DA_IGNORARE = /ResizeObserver loop|Script error\.?$|extension:\/\/|Non-Error promise rejection|AbortError|The user aborted|Load failed$/i;

export function installaSegnalazioneErrori(supabase) {
  const segnala = (errore, extra = "") => {
    try {
      const messaggio = pulisci(errore?.message || errore, 500);
      if (!messaggio || DA_IGNORARE.test(messaggio) || visti.has(messaggio) || inviati >= 10) return;
      visti.add(messaggio); inviati += 1;
      let pagina = "";
      try { pagina = sessionStorage.getItem("eyedrones_pagina") || ""; } catch { /* niente */ }
      supabase.from("errori_app").insert({
        pagina: pulisci(pagina || location.pathname, 100),
        messaggio,
        dettagli: pulisci(`${extra}\n${errore?.stack || ""}`, 3000),
        indirizzo: pulisci(location.pathname + location.search.replace(/(galleria|token|pin)=[^&]+/gi, "$1=…"), 300),
        dispositivo: pulisci(navigator.userAgent, 300),
      }).then(() => {}, () => {});
    } catch { /* la segnalazione non deve mai rompere l'app */ }
  };
  window.addEventListener("error", (e) => segnala(e.error || e.message, e.filename ? `${e.filename}:${e.lineno}` : ""));
  window.addEventListener("unhandledrejection", (e) => segnala(e.reason, "promessa non gestita"));
  window.__eyedronesSegnalaErrore = segnala;
  // anche gli avvisi «… non riuscito» mostrati all'utente: sono errori che vale la pena vedere
  const alertOriginale = window.alert.bind(window);
  window.alert = (testo) => {
    if (/non riuscit|errore|error|cannot|undefined|failed/i.test(String(testo || "")) && !/esegui prima lo script|spazio è pieno/i.test(String(testo))) segnala(new Error(String(testo)), "mostrato all'utente");
    return alertOriginale(testo);
  };
}
