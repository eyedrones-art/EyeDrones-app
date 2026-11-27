import React, { useEffect, useRef, useState } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";
import { ettariDi, formattaEttari } from "./campi.js";

// Disegna il confine di un campo sulla mappa satellitare: cerchi il posto, tocchi gli angoli del campo uno dopo
// l'altro e l'app chiude il poligono. Funziona col dito (telefono) e col mouse (computer).
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const btn = (p) => ({ background: p ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: p ? "#10141f" : "#e7eaee", border: p ? "none" : "1px solid #343e57", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 700, minHeight: 40 });

export default function DisegnaConfine({ iniziale, centro, onFatto, onAnnulla, inputStyle }) {
  const box = useRef(null), mappa = useRef(null), strato = useRef(null);
  // punti [lon, lat]; se il campo ha già un confine (poligono semplice) parto da quello
  const [punti, setPunti] = useState(() => (iniziale && iniziale.type === "Polygon" ? iniziale.coordinates[0].slice(0, -1) : []));
  const [cerca, setCerca] = useState("");
  const [msg, setMsg] = useState("");
  const aggiungi = useRef(null);
  aggiungi.current = (ll) => setPunti((p) => [...p, [Math.round(ll.lng * 1e7) / 1e7, Math.round(ll.lat * 1e7) / 1e7]]);

  useEffect(() => {
    const c = punti.length ? { lat: punti[0][1], lon: punti[0][0] } : centro && centro.lat != null ? centro : null;
    const m = L.map(box.current, { zoomControl: true }).setView(c ? [c.lat, c.lon] : [42.5, 12.5], c ? 17 : 6);
    L.tileLayer(SATELLITE, { maxZoom: 20, attribution: "Immagini © Esri" }).addTo(m);
    strato.current = L.layerGroup().addTo(m);
    m.on("click", (e) => aggiungi.current(e.latlng));
    mappa.current = m;
    if (punti.length > 2) m.fitBounds(L.latLngBounds(punti.map(([lo, la]) => [la, lo])), { padding: [30, 30] });
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const g = strato.current; if (!g) return;
    g.clearLayers();
    const ll = punti.map(([lo, la]) => [la, lo]);
    if (ll.length > 2) L.polygon(ll, { color: "#ffffff", weight: 2.5, fillColor: "#a3e635", fillOpacity: 0.25, dashArray: "6 4" }).addTo(g);
    else if (ll.length === 2) L.polyline(ll, { color: "#ffffff", weight: 2.5, dashArray: "6 4" }).addTo(g);
    ll.forEach((p, i) => L.circleMarker(p, { radius: i === 0 ? 8 : 6, color: "#10141f", weight: 2, fillColor: i === 0 ? "#ff8c42" : "#ffffff", fillOpacity: 1 }).addTo(g));
  }, [punti]);

  const vai = async () => {
    if (!cerca.trim()) return;
    setMsg("Cerco…");
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&accept-language=it&q=${encodeURIComponent(cerca.trim())}`);
      const [primo] = await r.json();
      if (!primo) { setMsg("Non trovo il posto: prova con il comune o la località."); return; }
      mappa.current.setView([Number(primo.lat), Number(primo.lon)], 17); setMsg("");
    } catch { setMsg("Ricerca non riuscita: sposta la mappa a mano."); }
  };
  const geom = punti.length > 2 ? { type: "Polygon", coordinates: [[...punti, punti[0]]] } : null;
  const ha = geom ? ettariDi(geom) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-disegna-confine>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={cerca} onChange={(e) => setCerca(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), vai())} placeholder="Cerca il posto (comune, località, via)" style={{ ...inputStyle, flex: "1 1 220px", minWidth: 0 }} aria-label="Cerca il posto del campo" />
        <button type="button" onClick={vai} style={btn(false)}>🔎 Vai</button>
      </div>
      {msg && <div style={{ fontSize: 12, color: "#ffb877" }}>{msg}</div>}
      <div ref={box} style={{ height: 360, borderRadius: 10, overflow: "hidden", border: "1px solid #2a3349", cursor: "crosshair", position: "relative", zIndex: 0 }} aria-label="Mappa: tocca gli angoli del campo" />
      <div style={{ fontSize: 12.5, color: "#c3cad4" }}>{punti.length < 3 ? `Tocca gli angoli del campo uno dopo l'altro (${punti.length} di almeno 3). Ingrandisci la mappa per essere preciso.` : <>Campo di <b style={{ color: "#4ade80" }}>{formattaEttari(ha)}</b> · {punti.length} angoli. Puoi aggiungerne altri o togliere l'ultimo.{ha > 1000 && <span style={{ color: "#ffb877" }}> ⚠️ Sembra molto grande per un campo: ingrandisci la mappa e tocca gli angoli veri del campo.</span>}</>}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={!geom} onClick={() => onFatto(geom, ha)} style={{ ...btn(true), opacity: geom ? 1 : 0.5 }} data-confine-fatto>✓ Usa questo confine</button>
        <button type="button" disabled={!punti.length} onClick={() => setPunti(punti.slice(0, -1))} style={btn(false)}>↩️ Togli l'ultimo</button>
        {punti.length > 0 && <button type="button" onClick={() => setPunti([])} style={btn(false)}>Ricomincia</button>}
        <button type="button" onClick={onAnnulla} style={btn(false)}>Annulla</button>
      </div>
    </div>
  );
}
