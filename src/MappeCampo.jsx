import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";
import { leggiMappaIndice, limitiDa, zoneVigore, prescrizioneGeoJson, prescrizioneKml, prescrizioneShapefile, scaricaFile, coloreCss, dentroConfine } from "./multispettrale.js";

// «🛰️ Mappe e scouting» (supabase/multispettrale.sql): mappe NDVI/NDRE per campo con lo storico,
// punti di scouting sulla mappa e mappe di prescrizione a zone da esportare per l'Agras.

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const scheda = { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 16 };
const btn = (primario) => ({ background: primario ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: primario ? "#10141f" : "#e7eaee", border: primario ? "none" : "1px solid #343e57", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" });
const etichetta = { fontSize: 12, color: "#8b95a3", display: "flex", flexDirection: "column", gap: 4 };
export const CATEGORIE_SCOUTING = [
  { k: "malattia", t: "Malattia", e: "🍂", c: "#f97316" },
  { k: "insetti", t: "Insetti", e: "🐛", c: "#ef4444" },
  { k: "infestanti", t: "Infestanti", e: "🌿", c: "#a3e635" },
  { k: "stress", t: "Carenza o stress", e: "🥀", c: "#facc15" },
  { k: "acqua", t: "Acqua (ristagno o secco)", e: "💧", c: "#38bdf8" },
  { k: "altro", t: "Altro", e: "📌", c: "#c4b5fd" },
];
const cat = (k) => CATEGORIE_SCOUTING.find((x) => x.k === k) || CATEGORIE_SCOUTING[CATEGORIE_SCOUTING.length - 1];
const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const ha = (n) => `${(Math.round(n * 100) / 100).toLocaleString("it-IT")} ha`;
const dataIt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }) : "");
const manca = (msg) => /mappe_campo|punti_scouting|does not exist|schema cache/i.test(String(msg || ""));

function MappaIndice({ campo, mappa, opacita, punti, zone, onTocca, altezza = 380 }) {
  const box = useRef(null), m = useRef(null), strati = useRef(null), tocca = useRef(onTocca), centrata = useRef("");
  tocca.current = onTocca;
  useEffect(() => {
    const mp = L.map(box.current, { zoomControl: true }).setView([42.5, 12.5], 6);
    L.tileLayer(SATELLITE, { maxZoom: 20, attribution: "Immagini © Esri" }).addTo(mp);
    strati.current = L.layerGroup().addTo(mp);
    mp.on("click", (e) => tocca.current && tocca.current(e.latlng));
    m.current = mp;
    return () => mp.remove();
  }, []);
  useEffect(() => {
    const g = strati.current; g.clearLayers();
    let limiti = null;
    if (mappa && mappa.immagine && mappa.angoli) {
      const b = limitiDa(mappa.angoli);
      L.imageOverlay(mappa.immagine, b, { opacity: opacita }).addTo(g);
      limiti = L.latLngBounds(b);
    }
    if (zone) L.geoJSON(zone, { style: (f) => ({ color: f.properties.colore, weight: 0, fillColor: f.properties.colore, fillOpacity: 0.65 }) }).addTo(g);
    if (campo && campo.confini) {
      const c = L.geoJSON(campo.confini, { style: { color: "#ffffff", weight: 2.5, fillOpacity: 0, dashArray: "6 4" } }).addTo(g);
      limiti = limiti ? limiti.extend(c.getBounds()) : c.getBounds();
    }
    (punti || []).forEach((p) => {
      const k = cat(p.categoria);
      L.circleMarker([p.lat, p.lon], { radius: 9, color: "#10141f", weight: 2, fillColor: p.risolto ? "#6b7480" : k.c, fillOpacity: 1 })
        .bindTooltip(`${k.e} ${k.t}${p.nota ? ` · ${p.nota}` : ""}`, { direction: "top" }).addTo(g);
    });
    // centro la vista solo quando cambia il campo o la mappa (non a ogni punto o alla trasparenza)
    const chiave = `${campo ? campo.id : ""}|${mappa ? mappa.id || mappa.nome_file : ""}`;
    if (limiti && limiti.isValid() && centrata.current !== chiave) { m.current.fitBounds(limiti, { padding: [20, 20], maxZoom: 19 }); centrata.current = chiave; }
  }, [campo, mappa, opacita, punti, zone]);
  return <div ref={box} style={{ height: altezza, borderRadius: 10, overflow: "hidden", border: "1px solid #2a3349", background: "#0a0d16", cursor: onTocca ? "crosshair" : "grab" }} />;
}

export default function MappeCampo({ supabase, inputStyle, campi }) {
  const conConfini = campi.filter((c) => c.confini || c.centro_lat != null);
  const [campoId, setCampoId] = useState(conConfini[0] ? conConfini[0].id : "");
  const [elenco, setElenco] = useState(null); // mappe salvate (senza immagine), null = tabella non creata
  const [mappa, setMappa] = useState(null); // mappa aperta (con immagine e griglia)
  const [nuova, setNuova] = useState(null); // letta dal file, non ancora salvata
  const [punti, setPunti] = useState([]);
  const [opacita, setOpacita] = useState(0.85);
  const [errore, setErrore] = useState("");
  const [lavoro, setLavoro] = useState("");
  const [meta, setMeta] = useState({ indice: "NDVI", data: oggi(), fonte: "" });
  const [puntoNuovo, setPuntoNuovo] = useState(null); // { lat, lon, categoria, nota }
  const [modoPunto, setModoPunto] = useState(false);
  const [presc, setPresc] = useState({ n: 3, dosi: ["", "", "", "", ""], unita: "l/ha", vedi: true });
  const campo = campi.find((c) => c.id === campoId) || null;

  const carica = async () => {
    if (!campoId) return;
    const [a, b] = await Promise.all([
      supabase.from("mappe_campo").select("id,appezzamento_id,data,indice,fonte,statistiche,colorata,note,user_id").eq("appezzamento_id", campoId).order("data", { ascending: false }),
      supabase.from("punti_scouting").select("*").eq("appezzamento_id", campoId).order("data", { ascending: false }),
    ]);
    if (a.error && manca(a.error.message)) { setElenco(null); return; }
    setElenco(a.data || []);
    setPunti(b.data || []);
    if ((a.data || []).length && !nuova) apri(a.data[0].id); else if (!(a.data || []).length) setMappa(null);
  };
  useEffect(() => { setMappa(null); setNuova(null); carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [campoId]);
  const apri = async (id) => {
    const { data } = await supabase.from("mappe_campo").select("*").eq("id", id).single();
    if (data) { setMappa(data); setNuova(null); }
  };

  const leggiFile = async (file) => {
    setErrore(""); if (!file) return;
    setLavoro("Leggo la mappa…");
    try {
      const m = await leggiMappaIndice(file);
      const nome = file.name || "";
      const ind = /ndre/i.test(nome) ? "NDRE" : /gndvi/i.test(nome) ? "GNDVI" : /lci/i.test(nome) ? "LCI" : /osavi/i.test(nome) ? "OSAVI" : "NDVI";
      setMeta({ ...meta, indice: ind, fonte: /terra/i.test(nome) ? "DJI Terra" : /pix4d/i.test(nome) ? "Pix4D" : meta.fonte });
      setNuova({ ...m, nome_file: nome });
      setMappa(null);
      // è sopra il campo scelto?
      if (campo && campo.centro_lat != null) {
        const b = limitiDa(m.angoli);
        if (campo.centro_lat < b[0][0] - 0.01 || campo.centro_lat > b[1][0] + 0.01 || campo.centro_lon < b[0][1] - 0.01 || campo.centro_lon > b[1][1] + 0.01) setErrore("⚠️ La mappa non sembra sopra questo campo: controlla di aver scelto il campo giusto.");
      }
    } catch (e) { setErrore(e.message || "File non leggibile."); }
    setLavoro("");
  };
  const salvaNuova = async () => {
    setLavoro("Salvo…");
    const { data, error } = await supabase.from("mappe_campo").insert({
      appezzamento_id: campoId, data: meta.data || oggi(), indice: meta.indice, fonte: meta.fonte.trim() || null, nome_file: nuova.nome_file,
      immagine: nuova.immagine, angoli: nuova.angoli, statistiche: nuova.statistiche, griglia: nuova.griglia, colorata: nuova.colorata,
    }).select("id").single();
    setLavoro("");
    if (error) { setErrore(`Salvataggio non riuscito: ${error.message}`); return; }
    setNuova(null); await carica(); if (data) apri(data.id);
  };
  const eliminaMappa = async (id) => { await supabase.from("mappe_campo").delete().eq("id", id); setMappa(null); carica(); };

  // punti di scouting
  const tocca = (ll) => { if (modoPunto) { setPuntoNuovo({ lat: ll.lat, lon: ll.lng, categoria: "malattia", nota: "" }); setModoPunto(false); } };
  const quiSonoIo = () => {
    if (!navigator.geolocation) { setErrore("Il telefono non dà la posizione."); return; }
    setLavoro("Cerco la posizione…");
    navigator.geolocation.getCurrentPosition((p) => { setLavoro(""); setPuntoNuovo({ lat: p.coords.latitude, lon: p.coords.longitude, categoria: "malattia", nota: "" }); setModoPunto(false); },
      () => { setLavoro(""); setErrore("Posizione non disponibile: tocca il punto sulla mappa."); }, { enableHighAccuracy: true, timeout: 15000 });
  };
  const salvaPunto = async () => {
    const p = puntoNuovo;
    const { error } = await supabase.from("punti_scouting").insert({ appezzamento_id: campoId, mappa_id: mappa ? mappa.id : null, lat: p.lat, lon: p.lon, categoria: p.categoria, nota: p.nota.trim() || null, data: oggi() });
    if (error) { setErrore(`Non salvato: ${error.message}`); return; }
    setPuntoNuovo(null); carica();
  };
  const cambiaPunto = async (p, dati) => { await supabase.from("punti_scouting").update(dati).eq("id", p.id); carica(); };
  const eliminaPunto = async (p) => { await supabase.from("punti_scouting").delete().eq("id", p.id); carica(); };

  const vista = nuova || mappa;
  const zv = useMemo(() => (vista && vista.griglia && campo ? zoneVigore(vista, campo.confini, presc.n) : null), [vista, campo, presc.n]);
  const zoneGeo = useMemo(() => {
    if (!zv || !presc.vedi) return null;
    const g = prescrizioneGeoJson(zv.celle, presc.dosi);
    g.features.forEach((f) => { f.properties.colore = coloreCss(presc.n === 1 ? 0.5 : (f.properties.ZONA - 1) / (presc.n - 1)); });
    return g;
  }, [zv, presc]);
  const totale = zv ? zv.zone.reduce((t, z) => t + z.ha * (Number(String(presc.dosi[z.zona - 1]).replace(",", ".")) || 0), 0) : 0;
  const nomeFile = `prescrizione-${(campo ? campo.nome : "campo").replace(/[^\w]+/g, "-").toLowerCase()}-${vista ? (vista.data || meta.data) : ""}`;
  const dosiNum = presc.dosi.map((d) => Number(String(d).replace(",", ".")) || 0);
  const esporta = async (tipo) => {
    if (!zv) return;
    if (tipo === "shp") scaricaFile(new Blob([await prescrizioneShapefile(zv.celle, dosiNum, nomeFile)], { type: "application/zip" }), `${nomeFile}-shp.zip`);
    if (tipo === "kml") scaricaFile(prescrizioneKml(zv.celle, dosiNum, nomeFile, presc.n), `${nomeFile}.kml`, "application/vnd.google-earth.kml+xml");
    if (tipo === "geojson") scaricaFile(JSON.stringify(prescrizioneGeoJson(zv.celle, dosiNum)), `${nomeFile}.geojson`, "application/geo+json");
  };

  if (!conConfini.length) return <div style={{ ...scheda, color: "#8b95a3", fontSize: 13.5 }}>Prima aggiungi un campo con il confine, nella scheda Appezzamenti: le mappe si appoggiano sul campo.</div>;
  if (elenco === null && campoId) {
    return <div style={{ ...scheda, border: "1px solid #f5b94266", background: "#211a0c", fontSize: 13, color: "#ffe2a8" }}>⚙️ Per usare mappe e scouting serve una cosa da fare <strong>una volta sola</strong>: in Supabase apri <strong>SQL Editor</strong>, incolla lo script <strong>supabase/multispettrale.sql</strong> e premi <strong>Run</strong>.</div>;
  }
  const precedente = (m) => { const i = (elenco || []).findIndex((x) => x.id === m.id); const p = (elenco || [])[i + 1]; return p && p.indice === m.indice ? p : null; };
  const aperti = punti.filter((p) => !p.risolto);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-mappe>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ ...etichetta, flex: "1 1 220px" }}>Campo
          <select value={campoId} onChange={(e) => setCampoId(e.target.value)} style={inputStyle} aria-label="Campo della mappa">{conConfini.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.azienda ? ` · ${c.azienda}` : ""}{c.ettari ? ` · ${ha(Number(c.ettari))}` : ""}</option>)}</select>
        </label>
        <label style={{ ...btn(true), cursor: "pointer", display: "inline-flex", alignItems: "center" }}>📥 Carica mappa NDVI / NDRE
          <input type="file" accept=".tif,.tiff,image/tiff" onChange={(e) => { leggiFile(e.target.files && e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} aria-label="File GeoTIFF dell'indice" />
        </label>
      </div>
      {lavoro && <div style={{ fontSize: 12.5, color: "#9cc4ff" }}>{lavoro}</div>}
      {errore && <div style={{ fontSize: 12.5, color: "#ffb877" }}>{errore}</div>}

      <MappaIndice campo={campo} mappa={vista} opacita={opacita} punti={punti} zone={zoneGeo} onTocca={modoPunto ? tocca : null} />

      {vista && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "#c3cad4" }}>
          {vista.statistiche && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span>{Number(vista.statistiche.p2).toFixed(2)}</span><span style={{ width: 120, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${[0, 0.25, 0.5, 0.75, 1].map(coloreCss).join(",")})` }} /><span>{Number(vista.statistiche.p98).toFixed(2)}</span><span style={{ color: "#8b95a3" }}>basso → alto vigore</span></div>}
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Trasparenza <input type="range" min="0.2" max="1" step="0.05" value={opacita} onChange={(e) => setOpacita(Number(e.target.value))} /></label>
        </div>
      )}

      {nuova && (
        <div style={{ ...scheda, border: "1px solid #a3e63566", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Nuova mappa{nuova.statistiche ? ` · media ${nuova.statistiche.media.toFixed(2)}` : " · immagine già colorata (senza zone)"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <label style={etichetta}>Indice<select value={meta.indice} onChange={(e) => setMeta({ ...meta, indice: e.target.value })} style={inputStyle}>{["NDVI", "NDRE", "GNDVI", "OSAVI", "LCI", "Altro"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label style={etichetta}>Data del volo<input type="date" value={meta.data} onChange={(e) => setMeta({ ...meta, data: e.target.value })} style={inputStyle} /></label>
            <label style={etichetta}>Fatta con<input value={meta.fonte} onChange={(e) => setMeta({ ...meta, fonte: e.target.value })} placeholder="es. DJI Terra, Mavic 3M" style={inputStyle} /></label>
          </div>
          <div style={{ display: "flex", gap: 8 }}><button type="button" onClick={salvaNuova} style={btn(true)}>Salva nello storico del campo</button><button type="button" onClick={() => setNuova(null)} style={btn(false)}>Annulla</button></div>
        </div>
      )}

      {elenco && elenco.length > 0 && (
        <div style={scheda}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📈 Storico del campo</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {elenco.map((x) => {
              const p = precedente(x); const d = p && x.statistiche && p.statistiche ? x.statistiche.media - p.statistiche.media : null;
              return (
                <div key={x.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: mappa && mappa.id === x.id ? "#1d2a12" : "#10141f", border: `1px solid ${mappa && mappa.id === x.id ? "#a3e63566" : "#232b3f"}`, cursor: "pointer" }} onClick={() => apri(x.id)} data-storico>
                  <div style={{ fontSize: 13 }}><b>{dataIt(x.data)}</b> · {x.indice}{x.fonte ? ` · ${x.fonte}` : ""}</div>
                  <div style={{ fontSize: 12.5, display: "flex", gap: 10, alignItems: "center" }}>
                    {x.statistiche && <span>media <b>{Number(x.statistiche.media).toFixed(2)}</b></span>}
                    {d != null && <span style={{ color: d > 0.02 ? "#4ade80" : d < -0.02 ? "#ff9c9c" : "#8b95a3", fontWeight: 700 }}>{d > 0.02 ? "▲" : d < -0.02 ? "▼" : "="} {d > 0 ? "+" : ""}{d.toFixed(2)}</span>}
                    {mappa && mappa.id === x.id && <button type="button" onClick={(e) => { e.stopPropagation(); eliminaMappa(x.id); }} style={{ ...btn(false), padding: "3px 8px", fontSize: 11.5, color: "#ff9c9c" }}>Elimina</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={scheda}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>🔎 Scouting{aperti.length ? ` · ${aperti.length} da controllare` : ""}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { setModoPunto(!modoPunto); setPuntoNuovo(null); }} style={btn(modoPunto)}>{modoPunto ? "Tocca il punto sulla mappa…" : "📍 Segna sulla mappa"}</button>
            <button type="button" onClick={quiSonoIo} style={btn(false)}>🧭 Sono qui</button>
          </div>
        </div>
        {puntoNuovo && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, borderRadius: 8, background: "#10141f", border: "1px solid #ff8c4266", marginBottom: 8 }} data-punto-nuovo>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{CATEGORIE_SCOUTING.map((k) => <button key={k.k} type="button" aria-pressed={puntoNuovo.categoria === k.k} onClick={() => setPuntoNuovo({ ...puntoNuovo, categoria: k.k })} style={{ ...btn(false), padding: "6px 10px", fontSize: 12, borderColor: puntoNuovo.categoria === k.k ? k.c : "#343e57", color: puntoNuovo.categoria === k.k ? k.c : "#e7eaee" }}>{k.e} {k.t}</button>)}</div>
            <input value={puntoNuovo.nota} onChange={(e) => setPuntoNuovo({ ...puntoNuovo, nota: e.target.value })} placeholder="Cosa hai visto (es. peronospora sulle foglie basse)" style={inputStyle} aria-label="Nota del punto" />
            <div style={{ fontSize: 11.5, color: "#8b95a3" }}>{puntoNuovo.lat.toFixed(6)}, {puntoNuovo.lon.toFixed(6)}{campo && campo.confini && !dentroConfine(puntoNuovo.lon, puntoNuovo.lat, campo.confini) ? " · ⚠️ fuori dal confine del campo" : ""}</div>
            <div style={{ display: "flex", gap: 8 }}><button type="button" onClick={salvaPunto} style={btn(true)}>Salva il punto</button><button type="button" onClick={() => setPuntoNuovo(null)} style={btn(false)}>Annulla</button></div>
          </div>
        )}
        {!punti.length && !puntoNuovo && <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Segna dove hai visto un problema: tocca il punto sulla mappa o usa «Sono qui» quando sei nel campo. Lo ritrovi la volta dopo, anche sulle mappe NDVI.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {punti.map((p) => { const k = cat(p.categoria); return (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "7px 10px", borderRadius: 8, background: "#10141f", opacity: p.risolto ? 0.55 : 1 }}>
              <div style={{ fontSize: 12.5 }}><span style={{ color: k.c, fontWeight: 700 }}>{k.e} {k.t}</span> · {dataIt(p.data)}{p.nota ? ` · ${p.nota}` : ""}</div>
              <div style={{ display: "flex", gap: 6 }}>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noopener noreferrer" style={{ ...btn(false), padding: "4px 8px", fontSize: 11.5 }}>📍 Portami</a>
                <button type="button" onClick={() => cambiaPunto(p, { risolto: !p.risolto })} style={{ ...btn(false), padding: "4px 8px", fontSize: 11.5 }}>{p.risolto ? "↩︎ Riapri" : "✓ Risolto"}</button>
                <button type="button" onClick={() => eliminaPunto(p)} style={{ ...btn(false), padding: "4px 8px", fontSize: 11.5, color: "#ff9c9c" }}>✕</button>
              </div>
            </div>); })}
        </div>
      </div>

      {zv && (
        <div style={{ ...scheda, border: "1px solid #3d8bfd55" }} data-prescrizione>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🎯 Mappa di prescrizione</div>
          <div style={{ fontSize: 12.5, color: "#c3cad4", marginBottom: 10, lineHeight: 1.5 }}>Divido il campo in zone dal vigore più basso al più alto. Scrivi la dose per ogni zona: l'app calcola il prodotto e prepara il file per il drone.</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 10 }}>
            <label style={etichetta}>Zone<select value={presc.n} onChange={(e) => setPresc({ ...presc, n: Number(e.target.value) })} style={{ ...inputStyle, width: 90 }}>{[2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></label>
            <label style={etichetta}>Unità<select value={presc.unita} onChange={(e) => setPresc({ ...presc, unita: e.target.value })} style={{ ...inputStyle, width: 100 }}>{["l/ha", "kg/ha"].map((u) => <option key={u}>{u}</option>)}</select></label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: "#c3cad4" }}><input type="checkbox" checked={presc.vedi} onChange={(e) => setPresc({ ...presc, vedi: e.target.checked })} /> Mostra le zone sulla mappa</label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {zv.zone.map((z) => (
              <div key={z.zona} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: coloreCss(presc.n === 1 ? 0.5 : (z.zona - 1) / (presc.n - 1)), flex: "none" }} />
                <span style={{ fontSize: 12.5, minWidth: 170 }}>Zona {z.zona} {z.zona === 1 ? "(vigore basso)" : z.zona === presc.n ? "(vigore alto)" : ""} · {ha(z.ha)}</span>
                <input inputMode="decimal" value={presc.dosi[z.zona - 1]} onChange={(e) => { const d = [...presc.dosi]; d[z.zona - 1] = e.target.value; setPresc({ ...presc, dosi: d }); }} placeholder="dose" aria-label={`Dose zona ${z.zona}`} style={{ ...inputStyle, width: 90, padding: "6px 8px" }} />
                <span style={{ fontSize: 12, color: "#8b95a3" }}>{presc.unita}</span>
              </div>
            ))}
          </div>
          {totale > 0 && <div style={{ fontSize: 13, color: "#4ade80", marginTop: 10 }}>Prodotto totale: <b>{(Math.round(totale * 10) / 10).toLocaleString("it-IT")} {presc.unita.split("/")[0]}</b> su {ha(zv.zone.reduce((t, z) => t + z.ha, 0))}</div>}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={() => esporta("shp")} style={btn(true)}>⬇️ Shapefile (zip)</button>
            <button type="button" onClick={() => esporta("kml")} style={btn(false)}>⬇️ KML</button>
            <button type="button" onClick={() => esporta("geojson")} style={btn(false)}>⬇️ GeoJSON</button>
          </div>
          <div style={{ fontSize: 11.5, color: "#8b95a3", marginTop: 8, lineHeight: 1.5 }}>Nel file ogni cella ha i campi ZONA, DOSE e VIGORE. Prima del lavoro controlla che DJI Terra o il radiocomando dell'Agras lo leggano bene e che le dosi siano quelle giuste: la scelta della dose resta tua e del tecnico.</div>
        </div>
      )}
    </div>
  );
}
