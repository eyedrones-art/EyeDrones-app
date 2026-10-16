import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";
import { leggiZoneSalvate } from "./zoneUAS";
import { cercaAreeProtette } from "./areeProtette";
import { statoZona } from "./Posti.jsx";
import { GIRO_VUOTO, MAX_TAPPE, tappaDa } from "./giro.js";

// Giro della giornata: più posti nello stesso piano. Il primo è il luogo del piano, le altre tappe si aggiungono qui.
// Per ogni tappa: strada e tempo in auto dalla precedente, ora di arrivo (con le soste), zona D-Flight, parchi e meteo a quell'ora.
// Salvato in piani_volo.checklist_stato.giro = { sostaPartenza, tappe: [{ id, nome, lat, lon, sosta }] }

const kmTra = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
// senza il servizio delle strade: linea d'aria × 1,35 a 50 km/h di media (stima prudente fuori città)
const stimaStrada = (a, b) => { const km = kmTra(a, b) * 1.35; return { km, min: (km / 50) * 60 }; };

const coordinateDa = (t) => {
  const m = String(t || "").trim().match(/^(-?\d{1,2}[.,]\d+)\s*[,; ]\s*(-?\d{1,3}[.,]\d+)$/);
  if (!m) return null;
  const lat = Number(m[1].replace(",", ".")), lon = Number(m[2].replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
};

const OSRM = "https://router.project-osrm.org";
const lista = (punti) => punti.map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
const conTempo = (promessa, ms) => Promise.race([promessa, new Promise((_, no) => setTimeout(() => no(new Error("tempo scaduto")), ms))]);

// tempi tra tutti i posti (per scegliere l'ordine): strade vere, altrimenti la stima
async function matriceTempi(punti) {
  try {
    const r = await conTempo(fetch(`${OSRM}/table/v1/driving/${lista(punti)}?annotations=duration`), 8000);
    const j = await r.json();
    if (j.code === "Ok" && Array.isArray(j.durations)) return j.durations.map((riga, i) => riga.map((d, k) => (d == null ? stimaStrada(punti[i], punti[k]).min * 60 : d)));
  } catch { /* uso la stima */ }
  return punti.map((a) => punti.map((b) => stimaStrada(a, b).min * 60));
}

// il percorso nell'ordine scelto: km e minuti di ogni tratto, più la linea per la mappa
async function percorso(punti) {
  if (punti.length < 2) return { tratti: [], linea: null, stimato: false };
  try {
    const r = await conTempo(fetch(`${OSRM}/route/v1/driving/${lista(punti)}?overview=simplified&geometries=geojson`), 8000);
    const j = await r.json();
    const rt = j.code === "Ok" && j.routes && j.routes[0];
    if (rt && rt.legs.length === punti.length - 1) {
      return { tratti: rt.legs.map((l) => ({ km: l.distance / 1000, min: l.duration / 60 })), linea: rt.geometry.coordinates.map(([lon, lat]) => [lat, lon]), stimato: false };
    }
  } catch { /* uso la stima */ }
  return { tratti: punti.slice(1).map((p, i) => stimaStrada(punti[i], p)), linea: punti.map((p) => [p.lat, p.lon]), stimato: true };
}

// ordine con meno strada, partenza fissa: il più vicino ogni volta, poi scambi a due (2-opt) finché migliora
export function ordineMigliore(m) {
  const n = m.length;
  if (n <= 2) return [...Array(n).keys()];
  const ord = [0];
  const resta = new Set([...Array(n).keys()].slice(1));
  while (resta.size) {
    const da = ord[ord.length - 1];
    let best = null;
    for (const k of resta) if (best === null || m[da][k] < m[da][best]) best = k;
    ord.push(best); resta.delete(best);
  }
  const costo = (o) => o.slice(1).reduce((t, k, i) => t + m[o[i]][k], 0);
  let meglio = true;
  while (meglio) {
    meglio = false;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const prova = [...ord.slice(0, i), ...ord.slice(i, k + 1).reverse(), ...ord.slice(k + 1)];
        if (costo(prova) + 1 < costo(ord)) { ord.splice(0, n, ...prova); meglio = true; }
      }
    }
  }
  return ord;
}

const hhmm = (min) => { const m = Math.round(min) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const minuti = (s) => { const m = String(s || "").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const durata = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`);
const kmIt = (km) => (km < 10 ? km.toLocaleString("it-IT", { maximumFractionDigits: 1 }) : String(Math.round(km)));

// meteo del giorno per un punto (vento, raffiche, pioggia ora per ora; alba e tramonto)
const memoriaMeteo = new Map();
async function meteoDelGiorno(p, data) {
  const k = `${p.lat.toFixed(2)},${p.lon.toFixed(2)},${data}`;
  if (memoriaMeteo.has(k)) return memoriaMeteo.get(k);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat.toFixed(4)}&longitude=${p.lon.toFixed(4)}&hourly=wind_speed_10m,wind_gusts_10m,precipitation_probability&daily=sunrise,sunset&timezone=Europe%2FRome&start_date=${data}&end_date=${data}`;
  const j = await conTempo(fetch(url).then((r) => r.json()), 9000);
  if (!j || !j.hourly) throw new Error("meteo non disponibile");
  const ris = {
    ore: j.hourly.time.map((t, i) => ({ ora: Number(t.slice(11, 13)), vento: j.hourly.wind_speed_10m[i], raffiche: j.hourly.wind_gusts_10m[i], pioggia: j.hourly.precipitation_probability[i] })),
    alba: j.daily && j.daily.sunrise ? minuti(j.daily.sunrise[0].slice(11)) : null,
    tramonto: j.daily && j.daily.sunset ? minuti(j.daily.sunset[0].slice(11)) : null,
  };
  memoriaMeteo.set(k, ris);
  return ris;
}

function giudizioMeteo(mt, arrivo) {
  if (!mt || arrivo == null) return null;
  const h = mt.ore.find((x) => x.ora === Math.floor((arrivo % 1440) / 60));
  if (!h) return null;
  const testo = `💨 ${Math.round(h.vento)} km/h, raffiche ${Math.round(h.raffiche)}${h.pioggia != null ? ` · 🌧️ ${h.pioggia}%` : ""}`;
  const colore = h.raffiche > 38 || h.pioggia >= 60 ? "#ff9c9c" : h.raffiche > 28 || h.pioggia >= 30 ? "#f5b942" : "#4ade80";
  let luce = null;
  if (mt.tramonto != null && arrivo > mt.tramonto) luce = { colore: "#ff9c9c", testo: `🌙 Arrivi dopo il tramonto (${hhmm(mt.tramonto)}): serve l'ok per il volo notturno, o anticipa la tappa` };
  else if (mt.tramonto != null && mt.tramonto - arrivo <= 75) luce = { colore: "#ffd07a", testo: `✨ Ora d'oro: tramonto alle ${hhmm(mt.tramonto)}, luce bellissima` };
  else if (mt.alba != null && arrivo < mt.alba) luce = { colore: "#ff9c9c", testo: `🌙 Arrivi prima dell'alba (${hhmm(mt.alba)})` };
  return { testo, colore, luce };
}

// la mappa del giro: i numeri delle tappe e la strada
function MappaGiro({ punti, linea }) {
  const box = useRef(null);
  const mappa = useRef(null);
  const strato = useRef(null);
  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    strato.current = L.layerGroup().addTo(m);
    mappa.current = m;
    return () => m.remove();
  }, []);
  useEffect(() => {
    const m = mappa.current, s = strato.current;
    if (!m || !s) return;
    s.clearLayers();
    if (linea && linea.length > 1) L.polyline(linea, { color: "#ff8c42", weight: 4, opacity: 0.85 }).addTo(s);
    punti.forEach((p, i) => {
      const icona = L.divIcon({ className: "", html: `<div style="width:26px;height:26px;border-radius:50%;background:${i === 0 ? "#ff8c42" : "#161a1f"};color:${i === 0 ? "#161a1f" : "#fff"};border:2px solid #ff8c42;font:700 13px/22px 'IBM Plex Sans',sans-serif;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.5)">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
      L.marker([p.lat, p.lon], { icon: icona, title: p.nome }).addTo(s);
    });
    if (punti.length === 1) m.setView([punti[0].lat, punti[0].lon], 13);
    else if (punti.length > 1) m.fitBounds(L.latLngBounds(punti.map((p) => [p.lat, p.lon])), { padding: [28, 28], maxZoom: 14 });
  }, [punti, linea]);
  return <div ref={box} style={{ height: 240, borderRadius: 8, overflow: "hidden", marginTop: 12, border: "1px solid #2b313d" }} />;
}

export default function GiroGiornata({ partenza, giro, onCambia, data, oraPartenza, cercaIndirizzo, inputStyle, apertoIniziale = false }) {
  const g = { ...GIRO_VUOTO, ...(giro || {}) };
  const tappe = g.tappe || [];
  const [aperto, setAperto] = useState(apertoIniziale || tappe.length > 0);
  // aggiunta una tappa da fuori (es. «＋ Al giro» nei posti vicini): apro il giro
  const quante = useRef(tappe.length);
  useEffect(() => { if (tappe.length > quante.current) setAperto(true); quante.current = tappe.length; }, [tappe.length]);
  const [testo, setTesto] = useState("");
  const [cercando, setCercando] = useState(false);
  const [avviso, setAvviso] = useState("");
  const [strada, setStrada] = useState({ tratti: [], linea: null, stimato: false });
  const [ordinando, setOrdinando] = useState(false);
  const [zone, setZone] = useState(undefined);
  const [meteo, setMeteo] = useState({});
  const [parchi, setParchi] = useState({});

  // il primo punto è il luogo del piano; senza luogo, parte dalla prima tappa
  const punti = useMemo(() => [...(partenza ? [{ id: "partenza", nome: partenza.nome || "Luogo del piano", lat: partenza.lat, lon: partenza.lon, sosta: g.sostaPartenza, partenza: true }] : []), ...tappe], [partenza && partenza.lat, partenza && partenza.lon, partenza && partenza.nome, JSON.stringify(tappe), g.sostaPartenza]);
  const firma = punti.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join("|");

  useEffect(() => { if (aperto && zone === undefined) leggiZoneSalvate().then((d) => setZone(d && Array.isArray(d.zone) ? d.zone : null)).catch(() => setZone(null)); }, [aperto]);
  useEffect(() => {
    if (!aperto) return;
    let via = false;
    percorso(punti).then((r) => { if (!via) setStrada(r); });
    return () => { via = true; };
  }, [aperto, firma]);
  useEffect(() => {
    if (!aperto || !data) return;
    let via = false;
    punti.forEach((p) => {
      meteoDelGiorno(p, data).then((mt) => { if (!via) setMeteo((x) => ({ ...x, [`${p.lat},${p.lon}`]: mt })); }).catch(() => {});
      const k = `${p.lat},${p.lon}`;
      if (parchi[k] === undefined) cercaAreeProtette(p).then((r) => { if (!via) setParchi((x) => ({ ...x, [k]: r.dentro || [] })); }).catch(() => { if (!via) setParchi((x) => ({ ...x, [k]: null })); });
    });
    return () => { via = true; };
  }, [aperto, firma, data]);

  const cambia = (nuovo) => onCambia({ ...g, ...nuovo });
  const cambiaTappa = (id, campi) => cambia({ tappe: tappe.map((t) => (t.id === id ? { ...t, ...campi } : t)) });
  const togli = (id) => cambia({ tappe: tappe.filter((t) => t.id !== id) });
  const sposta = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= tappe.length) return;
    const n = [...tappe];
    [n[i], n[j]] = [n[j], n[i]];
    cambia({ tappe: n });
  };
  const aggiungi = (p) => {
    if (tappe.length >= MAX_TAPPE) { setAvviso(`Al massimo ${MAX_TAPPE} tappe oltre al luogo del piano (è il limite di Google Maps).`); return; }
    cambia({ tappe: [...tappe, tappaDa(p)] });
    setTesto(""); setAvviso("");
  };

  const cerca = async () => {
    const t = testo.trim();
    if (!t) return;
    const c = coordinateDa(t);
    if (c) { aggiungi({ nome: `Punto ${c.lat.toFixed(4)}, ${c.lon.toFixed(4)}`, ...c }); return; }
    setCercando(true); setAvviso("");
    try {
      const r = await cercaIndirizzo(t);
      if (r) aggiungi({ nome: t.length <= 40 ? t : String(r.etichetta || t).split(",")[0], lat: r.lat, lon: r.lon });
      else setAvviso("Non trovo questo posto: prova con paese e provincia, oppure incolla le coordinate (es. 45.12345, 7.54321).");
    } catch { setAvviso("Ricerca non riuscita: controlla la connessione e riprova."); }
    setCercando(false);
  };
  const dovesono = () => {
    if (!navigator.geolocation) { setAvviso("Questo telefono non dà la posizione."); return; }
    setCercando(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCercando(false); aggiungi({ nome: "Dove sono ora", lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      () => { setCercando(false); setAvviso("Posizione non disponibile: attiva il GPS e dai il permesso alla pagina."); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };
  const ottimizza = async () => {
    if (punti.length < 3) return;
    setOrdinando(true);
    const m = await matriceTempi(punti);
    const ord = ordineMigliore(m);
    const prima = tappe.map((x) => x.id).join();
    const nuoveTappe = (partenza ? ord.slice(1) : ord).map((i) => punti[i]).map(({ partenza: _, ...x }) => x);
    setOrdinando(false);
    if (nuoveTappe.map((x) => x.id).join() === prima) { setAvviso("✓ L'ordine era già il migliore."); return; }
    setAvviso("✓ Tappe rimesse nell'ordine con meno strada.");
    cambia({ tappe: nuoveTappe });
  };

  // orari: arrivo alla prima all'ora del piano (o alle 9:00), poi sosta + strada
  const inizio = minuti(oraPartenza) ?? 9 * 60;
  const arrivi = [];
  let t = inizio;
  punti.forEach((p, i) => {
    if (i > 0) t += (strada.tratti[i - 1] ? strada.tratti[i - 1].min : stimaStrada(punti[i - 1], p).min);
    arrivi.push(t);
    t += Number(p.sosta) || 0;
  });
  const fine = t;
  const totKm = strada.tratti.reduce((s, x) => s + x.km, 0);
  const totMin = strada.tratti.reduce((s, x) => s + x.min, 0);
  const linkMaps = punti.length >= 2
    ? `https://www.google.com/maps/dir/?api=1&origin=${punti[0].lat},${punti[0].lon}&destination=${punti[punti.length - 1].lat},${punti[punti.length - 1].lon}${punti.length > 2 ? `&waypoints=${encodeURIComponent(punti.slice(1, -1).map((p) => `${p.lat},${p.lon}`).join("|"))}` : ""}&travelmode=driving`
    : null;

  const bottone = (attivo = true) => ({ background: attivo ? "#1f2530" : "#1a1e25", color: attivo ? "#e7eaee" : "#6b7480", border: "1px solid #333a45", borderRadius: 6, padding: "7px 12px", fontSize: 12.5, fontWeight: 600 });
  const piccolo = { background: "none", border: "1px solid #333a45", color: "#aab3bf", borderRadius: 5, padding: "2px 7px", fontSize: 12, lineHeight: 1.4 };

  return (
    <details open={aperto} onToggle={(e) => setAperto(e.currentTarget.open)} style={{ background: "#1a1712", border: "1px solid #5a3f22", borderRadius: 8, padding: "10px 14px", margin: "14px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#ffb877" }}>
        🗺️ Giro della giornata{punti.length > 1 ? ` · ${punti.length} posti` : ""} <span style={{ fontWeight: 400, color: "#8b95a3", fontSize: 12 }}>· più posti nello stesso giorno</span>
      </summary>
      <p style={{ fontSize: 12, color: "#aab3bf", margin: "8px 0 10px 0" }}>Aggiungi gli altri posti che vuoi riprendere: ti metto le tappe nell'ordine con meno strada, ti dico a che ora arrivi e, per ogni posto, zona, parchi e meteo.</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); cerca(); } }} placeholder="Posto, indirizzo o coordinate" style={{ ...inputStyle, flex: "1 1 200px", minWidth: 0 }} />
        <button type="button" onClick={cerca} disabled={cercando || !testo.trim()} style={{ background: testo.trim() ? "#ff8c42" : "#333a45", color: testo.trim() ? "#161a1f" : "#6b7480", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>{cercando ? "Cerco…" : "＋ Aggiungi"}</button>
        <button type="button" onClick={dovesono} disabled={cercando} style={bottone()}>📍 Dove sono</button>
      </div>
      <div style={{ fontSize: 11, color: "#6b7480", marginTop: 4 }}>Puoi aggiungere anche i posti dei piloti da «📍 Posti belli qui vicino» e dalla pagina Posti (tasto «＋ Al giro»).</div>
      {avviso && <div style={{ fontSize: 12, color: avviso.startsWith("✓") ? "#4ade80" : "#ff9c9c", marginTop: 8 }}>{avviso}</div>}

      {punti.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
          {punti.map((p, i) => {
            const k = `${p.lat},${p.lon}`;
            const z = statoZona(zone, p);
            const mt = giudizioMeteo(meteo[k], arrivi[i]);
            const pa = parchi[k];
            const tratto = i > 0 ? strada.tratti[i - 1] || stimaStrada(punti[i - 1], p) : null;
            const iTappa = partenza ? i - 1 : i;
            return (
              <React.Fragment key={p.id}>
                {tratto && <div style={{ fontSize: 11.5, color: "#8b95a3", paddingLeft: 14 }}>🚗 {kmIt(tratto.km)} km · {durata(tratto.min)}{strada.stimato ? " (stima)" : ""}</div>}
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#1b2028", border: `1px solid ${p.partenza ? "#ff8c4288" : "#2b313d"}`, borderRadius: 8, padding: "8px 10px" }}>
                  <span style={{ flex: "none", width: 24, height: 24, borderRadius: "50%", background: i === 0 ? "#ff8c42" : "#161a1f", color: i === 0 ? "#161a1f" : "#fff", border: "2px solid #ff8c42", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {p.partenza
                      ? <div style={{ fontSize: 13, fontWeight: 700 }}>{p.nome} <span style={{ fontSize: 11, fontWeight: 400, color: "#8b95a3" }}>· luogo del piano</span></div>
                      : <input value={p.nome} onChange={(e) => cambiaTappa(p.id, { nome: e.target.value })} aria-label="Nome della tappa" style={{ background: "transparent", border: "none", borderBottom: "1px dashed #333a45", color: "#e7eaee", fontSize: 13, fontWeight: 700, padding: "1px 0", width: "100%" }} />}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 11.5, color: "#c3cad4", marginTop: 3 }}>
                      <span>🕒 arrivo <strong>{hhmm(arrivi[i])}</strong></span>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#8b95a3" }}>
                        sosta
                        <select value={Number(p.sosta) || 0} onChange={(e) => (p.partenza ? cambia({ sostaPartenza: Number(e.target.value) }) : cambiaTappa(p.id, { sosta: Number(e.target.value) }))} style={{ background: "#161a1f", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 4, fontSize: 11.5, padding: "1px 4px" }}>
                          {[10, 15, 20, 30, 45, 60, 90, 120].map((v) => <option key={v} value={v}>{durata(v)}</option>)}
                        </select>
                      </label>
                    </div>
                    {z && <div style={{ fontSize: 11.5, color: z.colore, fontWeight: 600, marginTop: 2 }}>🛡️ {z.testo}</div>}
                    {zone === null && i === 0 && <div style={{ fontSize: 11, color: "#6b7480", marginTop: 2 }}>🛡️ Carica il file D-Flight per vedere la zona di ogni tappa</div>}
                    {pa && pa.length > 0 && <div style={{ fontSize: 11.5, color: "#f5b942", marginTop: 2 }}>🌳 {pa[0].nome}: area protetta, chiedi all'ente prima di volare</div>}
                    {mt && <div style={{ fontSize: 11.5, color: mt.colore, marginTop: 2 }}>{mt.testo}</div>}
                    {mt && mt.luce && <div style={{ fontSize: 11.5, color: mt.luce.colore, marginTop: 2 }}>{mt.luce.testo}</div>}
                    {!p.partenza && (
                      <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 6 }}>
                        <button type="button" onClick={() => sposta(iTappa, -1)} disabled={iTappa === 0} aria-label="Sposta su" style={piccolo}>▲</button>
                        <button type="button" onClick={() => sposta(iTappa, 1)} disabled={iTappa === tappe.length - 1} aria-label="Sposta giù" style={piccolo}>▼</button>
                        <button type="button" onClick={() => togli(p.id)} aria-label="Togli la tappa" style={{ ...piccolo, color: "#ff9c9c" }}>✕</button>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "#3d8bfd", textDecoration: "none", marginLeft: "auto" }}>🧭 Vai</a>
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {punti.length >= 2 && (
        <>
          <div style={{ fontSize: 12.5, color: "#e7eaee", marginTop: 10 }}>
            Totale: <strong>{kmIt(totKm)} km</strong> · <strong>{durata(totMin)}</strong> in auto · fine all'ultima tappa verso le <strong>{hhmm(fine)}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {punti.length >= 3 && <button type="button" onClick={ottimizza} disabled={ordinando} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>{ordinando ? "Calcolo…" : "✨ Ordine migliore"}</button>}
            {linkMaps && <a href={linkMaps} target="_blank" rel="noreferrer" style={{ ...bottone(), textDecoration: "none", display: "inline-flex", alignItems: "center" }}>🧭 Apri il giro in Google Maps</a>}
          </div>
          {aperto && <MappaGiro punti={punti} linea={strada.linea} />}
          <p style={{ fontSize: 10.5, color: "#6b7480", margin: "8px 0 0 0" }}>Tempi in auto senza traffico{strada.stimato ? " (stimati: il servizio delle strade non risponde)" : " (strade di OpenStreetMap)"}. La prima tappa parte all'ora del piano{oraPartenza ? "" : " (o alle 9:00 se non l'hai scelta)"}. Zona, parchi e meteo vanno ricontrollati il giorno del volo.</p>
        </>
      )}
    </details>
  );
}
