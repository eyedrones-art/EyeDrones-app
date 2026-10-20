import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { spazioDalLink } from "./spazi.js";

// dopo un aggiornamento dell'app, chi aveva la versione vecchia aperta non trova più alcuni pezzi
// («Failed to fetch dynamically imported module», «Importing a module script failed»): ricarico una volta
window.addEventListener("vite:preloadError", (e) => {
  try {
    const ultima = Number(sessionStorage.getItem("eyedrones_ricarica_versione") || 0);
    if (Date.now() - ultima < 60000) return; // già ricaricato da poco: lascio stare per non entrare in un giro
    sessionStorage.setItem("eyedrones_ricarica_versione", String(Date.now()));
    window.__eyedronesInRicarica = true;
    e.preventDefault();
    location.reload();
  } catch { /* niente */ }
});

// se una pagina si rompe, al posto della schermata vuota mostro un messaggio e segnalo l'errore
class ProtezioneErrori extends React.Component {
  constructor(props) { super(props); this.state = { errore: null }; }
  static getDerivedStateFromError(errore) { return { errore }; }
  componentDidCatch(errore, info) { window.__eyedronesSegnalaErrore?.(errore, (info && info.componentStack ? info.componentStack.slice(0, 1500) : "")); }
  render() {
    if (!this.state.errore) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif", color: "#e7eaee", background: "#12151c", textAlign: "center" }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 40 }}>🛠️</div>
          <h1 style={{ fontSize: 20, margin: "8px 0" }}>Qualcosa è andato storto</h1>
          <p style={{ fontSize: 14, color: "#9aa4b1" }}>L'errore è stato segnalato e lo sistemiamo al più presto. Ricarica l'app per continuare: i tuoi dati sono al sicuro.</p>
          <button onClick={() => { try { sessionStorage.removeItem("eyedrones_pagina"); } catch (e) { /* niente */ } location.reload(); }} style={{ marginTop: 10, background: "#ff8c42", color: "#161a1f", border: "none", borderRadius: 8, padding: "12px 20px", fontSize: 15, fontWeight: 700 }}>Ricarica EyeDrones</button>
        </div>
      </div>
    );
  }
}

// link diretto a uno spazio (/agri, /ispezioni…): lo ricordo subito, così vale anche dopo il login
spazioDalLink();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ProtezioneErrori>
      <App />
    </ProtezioneErrori>
  </React.StrictMode>
);

// nelle pagine per i clienti l'app da installare è quella dei clienti («I miei lavori»), non quella dei piloti
if (/^\/(trova-pilota|offerte|miei-lavori)(\/|$)/i.test(window.location.pathname)) {
  document.querySelector('link[rel="manifest"]')?.setAttribute("href", "/manifest-clienti.webmanifest");
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute("content", "I miei lavori");
  document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute("content", "default");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#fbf7f2");
}

// il telefono propone "Installa l'app" con questo evento: lo conservo per il pulsante dentro l'app
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__eventoInstallazione = e;
  window.dispatchEvent(new Event("eyedrones-installabile"));
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
