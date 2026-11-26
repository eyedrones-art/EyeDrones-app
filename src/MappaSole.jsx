import React, { useEffect, useRef } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";

// mappa con il punto delle riprese, la direzione da cui arriva il sole (linea gialla) e quella delle ombre (linea grigia).
// Tocca la mappa per spostare il punto.
export default function MappaSole({ centro, sole, onTocca, altezza = 300 }) {
  const box = useRef(null), mappa = useRef(null), tocca = useRef(onTocca);
  tocca.current = onTocca;
  useEffect(() => {
    const c = centro || { lat: 42.5, lon: 12.5 };
    const m = L.map(box.current, { zoomControl: true }).setView([c.lat, c.lon], centro ? 17 : 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    m.on("click", (e) => tocca.current && tocca.current(e.latlng.lat, e.latlng.lng));
    mappa.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const m = mappa.current;
    if (!m || !centro) return undefined;
    if (m.getZoom() < 12) m.setView([centro.lat, centro.lon], 17);
    const g = L.layerGroup().addTo(m);
    L.circleMarker([centro.lat, centro.lon], { radius: 7, color: "#ff8c42", weight: 3, fillColor: "#10141f", fillOpacity: 1 }).addTo(g);
    const verso = (az, dist) => { const r = (az * Math.PI) / 180; return [centro.lat + dist * Math.cos(r), centro.lon + (dist * Math.sin(r)) / Math.cos((centro.lat * Math.PI) / 180)]; };
    if (sole && sole.altezza > -1) {
      const fine = verso(sole.azimut, 0.0016);
      L.polyline([[centro.lat, centro.lon], fine], { color: "#f5b942", weight: 4, dashArray: "8 6" }).addTo(g);
      L.marker(fine, { icon: L.divIcon({ className: "", html: '<div style="font-size:24px;filter:drop-shadow(0 0 4px #000)">☀️</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(g);
      // ombra di un oggetto alto 10 m: più il sole è basso, più è lunga (la disegno fino a 120 m)
      const lung = Math.min(120, 10 / Math.tan((Math.max(1, sole.altezza) * Math.PI) / 180));
      L.polyline([[centro.lat, centro.lon], verso(sole.azimut + 180, lung / 111000)], { color: "#9aa3b2", weight: 6, opacity: 0.8 }).addTo(g);
    }
    return () => g.remove();
  }, [centro, sole]);
  return <div ref={box} style={{ height: altezza, borderRadius: 10, overflow: "hidden", border: "1px solid #2a3349", position: "relative", zIndex: 0 }} data-mappa-sole />;
}
