import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// colori come nel riquadro della zona
const COLORE_ZONA = { PROHIBITED: "#ff4d4d", REQ_AUTHORISATION: "#ff8c42", CONDITIONAL: "#f5b942", NO_RESTRICTION: "#3d8bfd" };

const ICONA = L.divIcon({
  className: "",
  html: '<div style="font-size:30px;line-height:30px;transform:translate(-2px,-26px);filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))">📍</div>',
  iconSize: [30, 30],
  iconAnchor: [13, 4],
});

// piccola mappa col punto controllato: il puntino si trascina (o si tocca la mappa) per metterlo sul posto esatto.
// Disegna anche le zone D-Flight lì intorno, così si vede se si è vicini al bordo
export default function MappaPunto({ punto, zone, onSposta }) {
  const contenitore = useRef(null);
  const mappa = useRef(null);
  const marker = useRef(null);
  const sposta = useRef(onSposta);
  sposta.current = onSposta;

  useEffect(() => {
    const m = L.map(contenitore.current, { zoomControl: true, attributionControl: true }).setView([punto.lat, punto.lon], 16);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    const mk = L.marker([punto.lat, punto.lon], { icon: ICONA, draggable: !!sposta.current, autoPan: true }).addTo(m);
    mk.on("dragend", () => { const p = mk.getLatLng(); sposta.current && sposta.current(p.lat, p.lng); });
    m.on("click", (e) => { if (!sposta.current) return; mk.setLatLng(e.latlng); sposta.current(e.latlng.lat, e.latlng.lng); });
    mappa.current = m;
    marker.current = mk;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // il punto è cambiato da fuori (nuovo indirizzo, coordinate): sposto il puntino e, se è uscito dalla vista, la mappa
  useEffect(() => {
    const m = mappa.current, mk = marker.current;
    if (!m || !mk) return;
    const vecchio = mk.getLatLng();
    if (vecchio.lat !== punto.lat || vecchio.lng !== punto.lon) mk.setLatLng([punto.lat, punto.lon]);
    if (!m.getBounds().pad(-0.15).contains([punto.lat, punto.lon])) m.setView([punto.lat, punto.lon], Math.max(m.getZoom(), 15));
    if (mk.dragging) (onSposta ? mk.dragging.enable() : mk.dragging.disable());
  }, [punto.lat, punto.lon, onSposta]);

  useEffect(() => {
    const m = mappa.current;
    if (!m) return undefined;
    const livello = L.layerGroup().addTo(m);
    (zone || []).forEach((z) => {
      const colore = COLORE_ZONA[z.restrizione] || "#f5b942";
      const stile = { color: colore, weight: 2, fillColor: colore, fillOpacity: 0.18, interactive: false };
      (z.poligoni || []).forEach((pol) => L.polygon(pol.map((anello) => anello.map(([lon, lat]) => [lat, lon])), stile).addTo(livello));
      (z.cerchi || []).forEach(({ c, r }) => L.circle([c[1], c[0]], { ...stile, radius: r }).addTo(livello));
    });
    return () => livello.remove();
  }, [zone]);

  return <div ref={contenitore} style={{ height: 230, borderRadius: 8, overflow: "hidden", marginTop: 8, border: "1px solid #262b33", zIndex: 0, position: "relative" }} />;
}
