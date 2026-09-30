import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

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
