import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// mappa del sopralluogo: decollo, ostacoli, persone, parcheggio, foto delle scene e direzione del sole.
// Tocca la mappa per aggiungere un punto del tipo scelto.
const STILI = {
  decollo: { emoji: "🛫", colore: "#4ade80" },
  ostacolo: { emoji: "⚠️", colore: "#ff4d4d" },
  persone: { emoji: "👥", colore: "#3d8bfd" },
  parcheggio: { emoji: "🅿️", colore: "#a8a2bd" },
  altro: { emoji: "📍", colore: "#f5b942" },
  scena: { emoji: "🎬", colore: "#c4b5fd" },
};
const icona = (tipo) => {
  const s = STILI[tipo] || STILI.altro;
  return L.divIcon({ className: "", html: `<div style="width:30px;height:30px;border-radius:50%;background:#12151a;border:2px solid ${s.colore};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 4px rgba(0,0,0,.5)">${s.emoji}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
};
const testo = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default function MappaSopralluogo({ centro, punti, sole, onTocca, tipoNuovo }) {
  const box = useRef(null);
  const mappa = useRef(null);
  const tocca = useRef(onTocca);
  tocca.current = onTocca;

  useEffect(() => {
    const iniziale = centro || (punti[0] && { lat: punti[0].lat, lon: punti[0].lon }) || { lat: 42.5, lon: 12.5 };
    const m = L.map(box.current, { zoomControl: true }).setView([iniziale.lat, iniziale.lon], centro || punti[0] ? 17 : 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    m.on("click", (e) => tocca.current && tocca.current(e.latlng.lat, e.latlng.lng));
    mappa.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = mappa.current;
    if (!m) return undefined;
    const livello = L.layerGroup().addTo(m);
    punti.forEach((p) => L.marker([p.lat, p.lon], { icon: icona(p.tipo) }).bindPopup(`<strong>${(STILI[p.tipo] || STILI.altro).emoji} ${testo(p.nota) || "Punto"}</strong>`).addTo(livello));
    // direzione da cui arriva il sole all'ora delle riprese, dal centro del posto
    const c = centro || (punti[0] && { lat: punti[0].lat, lon: punti[0].lon });
    if (c && sole && sole.altezza > -1) {
      const dist = 0.0016; // circa 150-180 m
      const rad = (sole.azimut * Math.PI) / 180;
      const fine = [c.lat + dist * Math.cos(rad), c.lon + (dist * Math.sin(rad)) / Math.cos((c.lat * Math.PI) / 180)];
      L.polyline([[c.lat, c.lon], fine], { color: "#f5b942", weight: 4, dashArray: "8 6" }).addTo(livello);
      L.marker(fine, { icon: L.divIcon({ className: "", html: '<div style="font-size:24px;filter:drop-shadow(0 0 4px #000)">☀️</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
        .bindPopup(`Il sole arriva da qui${sole.ora ? ` alle ${testo(sole.ora)}` : ""} (alto ${Math.round(sole.altezza)}°)`).addTo(livello);
    }
    return () => livello.remove();
  }, [punti, sole, centro]);

  return (
    <div style={{ marginTop: 8 }}>
      <div ref={box} style={{ height: 280, borderRadius: 8, overflow: "hidden", border: "1px solid #2a4562", position: "relative", zIndex: 0 }} />
      <div style={{ fontSize: 11, color: "#8b95a3", marginTop: 4 }}>Tocca la mappa per aggiungere un punto «{tipoNuovo ? `${tipoNuovo.emoji} ${tipoNuovo.nome}` : "punto"}»{sole ? " · ☀️ la linea gialla indica da dove arriva il sole all'ora delle riprese" : ""}.</div>
    </div>
  );
}
