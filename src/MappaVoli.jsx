import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// "45.4012, 8.0391" → [45.4012, 8.0391]
export function coordinateDaTesto(testo) {
  const m = String(testo || "").match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  return [lat, lon];
}

const escape = (t) => String(t || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// mappa di tutti i voli con coordinate GPS (mappe OpenStreetMap, gratuite)
export default function MappaVoli({ voli, tipi, onApri }) {
  const contenitore = useRef(null);
  const mappa = useRef(null);

  useEffect(() => {
    const m = L.map(contenitore.current, { zoomControl: true, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    mappa.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = mappa.current;
    if (!m) return;
    const livello = L.layerGroup().addTo(m);
    const punti = [];
    voli.forEach((v) => {
      const c = coordinateDaTesto(v.coordinate_gps);
      if (!c) return;
      punti.push(c);
      const tipo = (tipi || []).find((t) => t.key === v.tipo_attivita) || { colore: "#ff8c42", emoji: "✈️", label: "Volo" };
      const marker = L.circleMarker(c, { radius: 8, color: "#12151a", weight: 2, fillColor: tipo.colore, fillOpacity: 0.95 }).addTo(livello);
      const div = document.createElement("div");
      div.style.cssText = "font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; min-width: 150px";
      div.innerHTML = `<strong>${escape(v.data ? new Date(v.data).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "")}</strong> · ${tipo.emoji} ${escape(tipo.label)}<br>${escape(v.luogo || "")}${v.drone_nome ? `<br><span style="color:#666">${escape(v.drone_nome)}</span>` : ""}`;
      if (onApri && !v._derived) {
        const b = document.createElement("button");
        b.textContent = "Apri il volo";
        b.style.cssText = "margin-top:6px;background:#ff8c42;border:none;border-radius:5px;padding:4px 10px;font-weight:600;cursor:pointer";
        b.onclick = () => onApri(v);
        div.appendChild(document.createElement("br"));
        div.appendChild(b);
      }
      marker.bindPopup(div);
    });
    if (punti.length === 1) m.setView(punti[0], 13);
    else if (punti.length > 1) m.fitBounds(punti, { padding: [30, 30], maxZoom: 13 });
    else m.setView([42.5, 12.5], 5); // Italia
    return () => livello.remove();
  }, [voli]);

  return <div ref={contenitore} style={{ width: "100%", height: "60vh", minHeight: 320, borderRadius: 10, overflow: "hidden", border: "1px solid #262b33" }} />;
}
