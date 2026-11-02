import React, { useEffect, useRef, useState } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";

// mappa per disegnare a mano l'area di volo dello STS-01: ogni tocco aggiunge un vertice,
// i vertici si trascinano per correggerli. Attorno disegno contingenza e buffer già calcolati
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STRADE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const VERTICE = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid #2e7d32;box-shadow:0 1px 3px rgba(0,0,0,.6)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const COLORE_ZONA = { PROHIBITED: "#ff4d4d", REQ_AUTHORISATION: "#ff8c42", CONDITIONAL: "#f5b942", NO_RESTRICTION: "#3d8bfd" };

export default function MappaAreaSTS({ centro, punti, aree, zone, onCambia, altezza = 340 }) {
  const contenitore = useRef(null);
  const mappa = useRef(null);
  const strato = useRef(null);
  const sfondo = useRef(null);
  const cambia = useRef(onCambia);
  cambia.current = onCambia;
  const ultimi = useRef(punti);
  ultimi.current = punti;
  const [satellite, setSatellite] = useState(true);
  const stratoZone = useRef(null);

  useEffect(() => {
    const m = L.map(contenitore.current, { zoomControl: true, attributionControl: true });
    if (punti && punti.length >= 2) m.fitBounds(L.latLngBounds(punti), { padding: [40, 40], maxZoom: 18 });
    else if (centro) m.setView([centro.lat, centro.lon], 16);
    else m.setView([42.5, 12.5], 6);
    stratoZone.current = L.layerGroup().addTo(m);
    strato.current = L.layerGroup().addTo(m);
    m.on("click", (e) => cambia.current([...(ultimi.current || []), [e.latlng.lat, e.latlng.lng]]));
    mappa.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sfondo.current) sfondo.current.remove();
    sfondo.current = L.tileLayer(satellite ? SATELLITE : STRADE, {
      maxZoom: 19,
      attribution: satellite ? "Immagini © Esri" : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mappa.current);
    sfondo.current.bringToBack();
  }, [satellite]);

  useEffect(() => {
    const g = strato.current;
    g.clearLayers();
    const non = { interactive: false };
    if (aree?.buffer?.length > 2) L.polygon(aree.buffer, { ...non, color: "#d32f2f", weight: 2, fillColor: "#d32f2f", fillOpacity: 0.15 }).addTo(g);
    if (aree?.contingenza?.length > 2) L.polygon(aree.contingenza, { ...non, color: "#e68a00", weight: 2, fillColor: "#e68a00", fillOpacity: 0.22 }).addTo(g);
    const p = punti || [];
    if (p.length >= 3) L.polygon(p, { ...non, color: "#2e7d32", weight: 3, fillColor: "#2e7d32", fillOpacity: 0.3 }).addTo(g);
    else if (p.length === 2) L.polyline(p, { ...non, color: "#2e7d32", weight: 3 }).addTo(g);
    p.forEach((v, i) => {
      const mk = L.marker(v, { icon: VERTICE, draggable: true, autoPan: true }).addTo(g);
      mk.on("dragend", () => {
        const q = mk.getLatLng();
        cambia.current(p.map((x, k) => (k === i ? [q.lat, q.lng] : x)));
      });
    });
  }, [punti, aree]);

  // zone D-Flight che toccano l'area, tratteggiate sotto le aree dello STS
  useEffect(() => {
    const g = stratoZone.current;
    g.clearLayers();
    (zone || []).forEach((z) => {
      const colore = COLORE_ZONA[z.restrizione] || "#f5b942";
      const stile = { color: colore, weight: 2, dashArray: "6 5", fillColor: colore, fillOpacity: 0.08 };
      const nome = z.nome || "Zona";
      (z.poligoni || []).forEach((pol) => L.polygon(pol.map((anello) => anello.map(([lon, lat]) => [lat, lon])), stile).bindTooltip(nome, { sticky: true }).addTo(g));
      (z.cerchi || []).forEach(({ c, r }) => L.circle([c[1], c[0]], { ...stile, radius: r }).bindTooltip(nome, { sticky: true }).addTo(g));
    });
  }, [zone]);

  return (
    <div style={{ position: "relative", marginTop: 8 }}>
      <div ref={contenitore} style={{ height: altezza, borderRadius: 8, overflow: "hidden", border: "1px solid #232b3f", background: "#0a0d16", zIndex: 0, position: "relative", cursor: "crosshair" }} />
      <button type="button" onClick={() => setSatellite(!satellite)} style={{ position: "absolute", top: 10, right: 10, zIndex: 500, background: "#12151cdd", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
        {satellite ? "🗺️ Strade" : "🛰️ Satellite"}
      </button>
    </div>
  );
}
