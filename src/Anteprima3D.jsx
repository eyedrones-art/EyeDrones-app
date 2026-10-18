// Anteprima 3D del volo: area e rotta sopra la mappa satellitare con i rilievi, e un drone che percorre la rotta
// con i dati del volo (punto, altezza, velocità, direzione, tempo). Serve a vedere il volo prima di farlo
// e a mostrarlo al cliente. È un'anteprima: edifici, alberi e cavi non ci sono, l'area va sempre controllata dal vivo.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// il «motore» della mappa gira a parte: lo faccio impacchettare da Vite e dico a MapLibre dove trovarlo
import indirizzoMotore from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { grigliaDiVolo, passoDaAltezza, misuraPercorso, lungoIlPercorso, sfoltisci } from "./percorso3d.js";

maplibregl.setWorkerUrl(indirizzoMotore);

const STILE = {
  version: 8,
  sources: {
    sat: { type: "raster", tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 19, attribution: "Immagini © Esri, Maxar, Earthstar Geographics" },
    dem: { type: "raster-dem", tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 14, encoding: "terrarium", attribution: "Rilievi © Mapzen, AWS Terrain Tiles" },
  },
  layers: [
    { id: "cielo-fondo", type: "background", paint: { "background-color": "#9cc7ea" } },
    { id: "sat", type: "raster", source: "sat" },
  ],
  terrain: { source: "dem", exaggeration: 1.3 },
  sky: { "sky-color": "#7fb6ea", "horizon-color": "#f3e3c8", "fog-color": "#e9eef5", "sky-horizon-blend": 0.6, "horizon-fog-blend": 0.6, "fog-ground-blend": 0.2 },
};
const ACCELERA = [1, 4, 8];
const tempo = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function Anteprima3D({ poligono, percorso, altezza = 60, velocita = 5, nome, onChiudi }) {
  const box = useRef(null), mappa = useRef(null), drone = useRef(null), stelo = useRef(null);
  const [errore, setErrore] = useState(null);
  const [pronta, setPronta] = useState(false);
  const [vai, setVai] = useState(false);
  const [x, setX] = useState(4);
  const [segui, setSegui] = useState(false);
  const [d, setD] = useState(0);
  const h = Math.max(1, Number(altezza) || 60);
  const v = Math.max(1, Number(velocita) || 5);
  // la rotta: quella della missione se c'è, altrimenti una griglia a strisciate dentro l'area
  const { rotta, daMissione } = useMemo(() => {
    if (Array.isArray(percorso) && percorso.length >= 2) return { rotta: sfoltisci(percorso), daMissione: true };
    return { rotta: grigliaDiVolo(poligono, passoDaAltezza(h)), daMissione: false };
  }, [percorso, poligono, h]);
  const cum = useMemo(() => misuraPercorso(rotta), [rotta]);
  const totale = cum[cum.length - 1] || 0;
  const qui = lungoIlPercorso(rotta, cum, d);

  // la mappa
  useEffect(() => {
    let m;
    try {
      m = new maplibregl.Map({ container: box.current, style: STILE, center: [poligono[0][1], poligono[0][0]], zoom: 16, pitch: 62, bearing: -25, maxPitch: 80, attributionControl: { compact: true } });
    } catch (e) {
      setErrore("Questo telefono non riesce a mostrare la mappa 3D (serve WebGL).");
      return undefined;
    }
    mappa.current = m;
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    m.on("error", () => { /* una tessera che non arriva non deve fermare tutto */ });
    m.on("load", () => {
      const anello = [...poligono, poligono[0]].map(([a, b]) => [b, a]);
      m.addSource("area", { type: "geojson", data: { type: "Feature", geometry: { type: "Polygon", coordinates: [anello] } } });
      m.addLayer({ id: "area-fondo", type: "fill", source: "area", paint: { "fill-color": "#a78bfa", "fill-opacity": 0.22 } });
      m.addLayer({ id: "area-bordo", type: "line", source: "area", paint: { "line-color": "#c4b5fd", "line-width": 3 } });
      if (rotta.length >= 2) {
        m.addSource("rotta", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: rotta.map(([a, b]) => [b, a]) } } });
        m.addLayer({ id: "rotta-ombra", type: "line", source: "rotta", paint: { "line-color": "#000", "line-width": 6, "line-opacity": 0.35, "line-blur": 2 } });
        m.addLayer({ id: "rotta", type: "line", source: "rotta", paint: { "line-color": "#ffe14d", "line-width": 3 } });
        m.addSource("partenza", { type: "geojson", data: { type: "Feature", geometry: { type: "Point", coordinates: [rotta[0][1], rotta[0][0]] } } });
        m.addLayer({ id: "partenza", type: "circle", source: "partenza", paint: { "circle-radius": 7, "circle-color": "#4ade80", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });
      }
      const lim = new maplibregl.LngLatBounds();
      [...poligono, ...rotta].forEach(([a, b]) => lim.extend([b, a]));
      m.fitBounds(lim, { padding: { top: 90, bottom: 190, left: 40, right: 40 }, pitch: 62, bearing: -25, duration: 0, maxZoom: 18.5 });
      // il drone: un segnaposto con la «stanghetta» che mostra quanto è alto
      const el = document.createElement("div");
      el.style.cssText = "display:flex;flex-direction:column;align-items:center;pointer-events:none";
      el.innerHTML = `<div style="width:46px;height:46px;border-radius:50%;background:rgba(18,21,28,.85);border:2px solid #ffe14d;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.5)"><svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#ffe14d" stroke-width="2.4" stroke-linecap="round"><path d="M9 9l14 14M23 9L9 23"/><circle cx="8" cy="8" r="4"/><circle cx="24" cy="8" r="4"/><circle cx="8" cy="24" r="4"/><circle cx="24" cy="24" r="4"/></g><rect x="12.5" y="12.5" width="7" height="7" rx="2" fill="#ffe14d"/></svg></div><div class="stelo" style="width:2px;height:60px;background:linear-gradient(#ffe14d,rgba(255,225,77,.15))"></div><div style="width:12px;height:5px;border-radius:50%;background:rgba(0,0,0,.45)"></div>`;
      stelo.current = el.querySelector(".stelo");
      drone.current = new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([rotta[0]?.[1] ?? poligono[0][1], rotta[0]?.[0] ?? poligono[0][0]]).addTo(m);
      setPronta(true);
    });
    return () => { m.remove(); mappa.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // il drone si muove
  useEffect(() => {
    if (!vai || !totale) return undefined;
    let prima = performance.now(), id;
    const passo = (ora) => {
      const dt = Math.min(0.1, (ora - prima) / 1000); prima = ora;
      setD((cur) => {
        const nuovo = cur + dt * v * x;
        if (nuovo >= totale) { setVai(false); return totale; }
        return nuovo;
      });
      id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [vai, x, v, totale]);

  // posizione del drone, altezza della stanghetta e camera che segue
  useEffect(() => {
    const m = mappa.current;
    if (!m || !qui || !drone.current) return;
    drone.current.setLngLat([qui.lon, qui.lat]);
    const mpp = (156543.03 * Math.cos((qui.lat * Math.PI) / 180)) / 2 ** m.getZoom();
    const px = (h / mpp) * Math.sin((m.getPitch() * Math.PI) / 180);
    if (stelo.current) stelo.current.style.height = `${Math.max(8, Math.min(260, px))}px`;
    if (segui) m.jumpTo({ center: [qui.lon, qui.lat], bearing: qui.direzione });
  }, [qui?.lat, qui?.lon, segui, pronta]); // eslint-disable-line react-hooks/exhaustive-deps

  const bottone = (attivo) => ({ minHeight: 40, padding: "0 12px", borderRadius: 8, border: `1px solid ${attivo ? "#ffe14d" : "#3a4150"}`, background: attivo ? "#ffe14d22" : "#1b2028", color: attivo ? "#ffe14d" : "#e7eaee", fontSize: 13, fontWeight: 700 });
  const fine = d >= totale && totale > 0;

  return (
    <div role="dialog" aria-label="Anteprima 3D del volo" style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#0b0e13", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#12151c", borderBottom: "1px solid #262b33" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>🧊 Anteprima 3D{nome ? ` · ${nome}` : ""}</div>
          <div style={{ fontSize: 11.5, color: "#8b95a3" }}>{daMissione ? "Rotta della missione caricata" : `Rotta a strisciate ogni ${passoDaAltezza(h)} m (indicativa)`} · {Math.round(totale)} m · circa {tempo(totale / v)} a {v} m/s</div>
        </div>
        <button type="button" onClick={onChiudi} style={{ ...bottone(false), background: "#262b33" }}>Chiudi ✕</button>
      </div>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div ref={box} style={{ position: "absolute", inset: 0 }} />
        {errore && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center", color: "#ff9c9c", fontSize: 14 }}>{errore}</div>}
        {!errore && !pronta && <div style={{ position: "absolute", left: 0, right: 0, top: "45%", textAlign: "center", color: "#c3cad4", fontSize: 13 }}>Carico la mappa 3D…</div>}
        {qui && (
          <div style={{ position: "absolute", left: 10, right: 10, bottom: 10, background: "rgba(18,21,28,.9)", border: "1px solid #2b313d", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#e7eaee" }}>
              <span>📍 {qui.punto}/{rotta.length}</span>
              <span>↑ {h} m</span>
              <span>⏱ {vai ? v : 0} m/s</span>
              <span>🧭 {qui.direzione}°</span>
              <span>🕒 {tempo(d / v)} / {tempo(totale / v)}</span>
            </div>
            <input type="range" min={0} max={Math.max(1, Math.round(totale))} value={Math.round(d)} onChange={(e) => setD(Number(e.target.value))} aria-label="Punto del volo" style={{ width: "100%", accentColor: "#ffe14d" }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button type="button" onClick={() => { if (fine) setD(0); setVai(!vai); }} style={{ ...bottone(true), minWidth: 96 }}>{vai ? "⏸ Pausa" : fine ? "↺ Rivedi" : "▶ Vola"}</button>
              {ACCELERA.map((k) => <button key={k} type="button" onClick={() => setX(k)} style={bottone(x === k)}>{k}×</button>)}
              <button type="button" onClick={() => setSegui(!segui)} style={bottone(segui)}>🎥 {segui ? "Segui: sì" : "Segui il drone"}</button>
            </div>
            <div style={{ fontSize: 10.5, color: "#8b95a3", lineHeight: 1.4 }}>Anteprima indicativa: nella mappa non ci sono edifici, alberi, cavi e altri ostacoli. Controlla sempre l'area dal vivo prima di volare.</div>
          </div>
        )}
      </div>
    </div>
  );
}
