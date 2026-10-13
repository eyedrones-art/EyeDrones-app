import React, { useEffect, useRef, useState } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";

// mappa degli appezzamenti: i confini colorati sul satellite, il campo scelto in evidenza.
// Toccando un campo lo si apre; serve anche come anteprima prima di salvare un file di confini
const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const STRADE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export default function MappaCampi({ campi, selezionato, onScegli, altezza = 320 }) {
  const contenitore = useRef(null);
  const mappa = useRef(null);
  const strato = useRef(null);
  const sfondo = useRef(null);
  const scegli = useRef(onScegli);
  scegli.current = onScegli;
  const [satellite, setSatellite] = useState(true);

  useEffect(() => {
    const m = L.map(contenitore.current, { zoomControl: true, attributionControl: true }).setView([42.5, 12.5], 6);
    strato.current = L.layerGroup().addTo(m);
    mappa.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    const m = mappa.current;
    if (sfondo.current) sfondo.current.remove();
    sfondo.current = L.tileLayer(satellite ? SATELLITE : STRADE, {
      maxZoom: 19,
      attribution: satellite ? "Immagini © Esri" : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    sfondo.current.bringToBack();
  }, [satellite]);

  // ridisegno i confini quando cambiano i campi o quello scelto; la vista si adatta solo se cambiano i campi
  const firma = (campi || []).map((c) => c.id || c.nome).join("|");
  useEffect(() => {
    const g = strato.current;
    g.clearLayers();
    const tutti = [];
    (campi || []).forEach((c) => {
      if (!c.confini) return;
      const scelto = selezionato && (c.id || c.nome) === selezionato;
      const layer = L.geoJSON(c.confini, {
        style: { color: scelto ? "#ff8c42" : c.colore || "#4ade80", weight: scelto ? 4 : 2, fillOpacity: scelto ? 0.25 : 0.12 },
      });
      layer.bindTooltip(`${c.nome}${c.ettari ? ` · ${Number(c.ettari).toLocaleString("it-IT", { maximumFractionDigits: 2 })} ha` : ""}`, { sticky: true });
      layer.on("click", () => scegli.current && scegli.current(c.id || c.nome));
      layer.addTo(g);
      tutti.push(layer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, selezionato]);

  useEffect(() => {
    const m = mappa.current;
    const conConfini = (campi || []).filter((c) => c.confini);
    const scelto = selezionato && conConfini.find((c) => (c.id || c.nome) === selezionato);
    const da = scelto ? [scelto] : conConfini;
    if (!da.length) return;
    try {
      const b = L.geoJSON({ type: "FeatureCollection", features: da.map((c) => ({ type: "Feature", properties: {}, geometry: c.confini })) }).getBounds();
      if (b.isValid()) m.fitBounds(b, { padding: [24, 24], maxZoom: 18 });
    } catch { /* confine strano: lascio la vista com'è */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, selezionato]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={contenitore} style={{ height: altezza, borderRadius: 10, overflow: "hidden", border: "1px solid #2b313d", background: "#0e1116" }} />
      <button type="button" onClick={() => setSatellite(!satellite)} style={{ position: "absolute", top: 10, right: 10, zIndex: 500, background: "#12151cdd", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600 }}>
        {satellite ? "🗺️ Strade" : "🛰️ Satellite"}
      </button>
    </div>
  );
}
