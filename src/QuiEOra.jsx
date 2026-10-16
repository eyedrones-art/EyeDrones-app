import React, { useEffect, useRef, useState } from "react";
import L from "./leafletSicuro";
import "leaflet/dist/leaflet.css";
import { leggiZoneSalvate, controllaPunto, altezzaSenzaPermessi, postiLiberiVicini } from "./zoneUAS";
import { cercaAreeProtette } from "./areeProtette";
import { statoZona, cercaPostiOsm } from "./Posti.jsx";
import { matriceTempi } from "./GiroGiornata.jsx";

// «Qui e ora»: sei sul posto (anche a piedi, in montagna) e vuoi sapere subito se e dove puoi volare, senza preparare un piano.
// 1) Posso volare qui? (zona D-Flight salvata nel telefono: funziona anche senza rete; parchi e meteo solo con la rete)
// 2) Dove posso volare qui intorno, a piedi  3) E adesso? posti belli vicini in auto, con i minuti e la luce che resta

const COLORE_ZONA = { PROHIBITED: "#ff4d4d", REQ_AUTHORISATION: "#ff8c42", CONDITIONAL: "#f5b942", NO_RESTRICTION: "#3d8bfd" };
const conTempo = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("tempo scaduto")), ms))]);
const kmTra = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
const durata = (min) => (min < 60 ? `${Math.max(1, Math.round(min))} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, "0")}`);
const adesso = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
// a piedi, in montagna: circa 4 km/h e un po' di giro in più rispetto alla linea d'aria
const minutiAPiedi = (m) => (m * 1.3) / 67;

function giudizio(zone, p) {
  if (!zone) return null;
  const { dentro } = controllaPunto(zone, p, { raggio: 0 });
  const h = altezzaSenzaPermessi(zone, p, 0);
  const vietata = dentro.some((z) => z.restrizione === "PROHIBITED" && !(z.limiti && z.limiti.da > 0));
  if (vietata && h === 0) return { emoji: "⛔", titolo: "Qui non si vola", sotto: dentro[0] ? dentro[0].nome : "Zona vietata", colore: "#ff4d4d", altezza: 0 };
  if (h >= 120) return { emoji: "✅", titolo: "Puoi volare qui", sotto: dentro.length ? "fino a 120 m, con le condizioni della zona" : "fino a 120 m: nessuna zona UAS", colore: "#4ade80", altezza: 120 };
  if (h > 0) return { emoji: "⚠️", titolo: `Qui fino a ${h} m`, sotto: "sopra serve l'autorizzazione", colore: "#f5b942", altezza: h };
  return { emoji: "⛔", titolo: "Qui serve l'autorizzazione", sotto: dentro[0] ? dentro[0].nome : "anche da terra", colore: "#ff8c42", altezza: 0 };
}

function MappaQui({ punto, liberi, zone }) {
  const box = useRef(null);
  const mappa = useRef(null);
  useEffect(() => {
    const m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([punto.lat, punto.lon], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(m);
    mappa.current = m;
    return () => m.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const m = mappa.current;
    if (!m) return undefined;
    const s = L.layerGroup().addTo(m);
    const { dentro, vicine: intorno } = controllaPunto(zone || [], punto, { raggio: 4000 });
    const vicine = [...dentro, ...intorno];
    vicine.forEach((z) => {
      const colore = COLORE_ZONA[z.restrizione] || "#f5b942";
      const stile = { color: colore, weight: 2, fillColor: colore, fillOpacity: 0.2, interactive: false };
      (z.poligoni || []).forEach((pol) => L.polygon(pol.map((a) => a.map(([lon, lat]) => [lat, lon])), stile).addTo(s));
      (z.cerchi || []).forEach(({ c, r }) => L.circle([c[1], c[0]], { ...stile, radius: r }).addTo(s));
    });
    L.circleMarker([punto.lat, punto.lon], { radius: 9, color: "#fff", weight: 3, fillColor: "#3d8bfd", fillOpacity: 1 }).bindTooltip("Sei qui").addTo(s);
    (liberi || []).forEach((q) => L.marker([q.lat, q.lon], { icon: L.divIcon({ className: "", html: `<div style="width:30px;height:30px;border-radius:50%;background:#4ade80;color:#0f1216;border:2px solid #fff;font:800 13px/26px sans-serif;text-align:center;box-shadow:0 2px 4px rgba(0,0,0,.5)">${q.altezza >= 120 ? "✓" : q.altezza}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(s));
    const tutti = [[punto.lat, punto.lon], ...(liberi || []).map((q) => [q.lat, q.lon])];
    if (tutti.length > 1) m.fitBounds(L.latLngBounds(tutti), { padding: [36, 36], maxZoom: 16 });
    return () => s.remove();
  }, [punto.lat, punto.lon, liberi, zone]);
  return <div ref={box} style={{ height: 260, borderRadius: 10, overflow: "hidden", border: "1px solid #2b313d", marginTop: 10 }} />;
}

export default function QuiEOra({ supabase, onPianifica, onAlGiro, onCaricaZone, puntoProva }) {
  const [punto, setPunto] = useState(puntoProva || null);
  const [errorePos, setErrorePos] = useState("");
  const [zone, setZone] = useState(undefined);
  const [parchi, setParchi] = useState(undefined); // undefined = cerco, null = senza rete
  const [meteo, setMeteo] = useState(undefined);
  const [auto, setAuto] = useState(null); // null | "cerco" | { posti } | { errore }
  const [nelGiro, setNelGiro] = useState({});

  const prendiPosizione = () => {
    setErrorePos(""); setPunto(null); setAuto(null);
    if (!navigator.geolocation) { setErrorePos("Questo telefono non dà la posizione."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPunto({ lat: pos.coords.latitude, lon: pos.coords.longitude, precisione: Math.round(pos.coords.accuracy || 0) }),
      () => setErrorePos("Non ricevo la posizione: attiva il GPS e consenti alla pagina di usarla."),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  };
  useEffect(() => { if (!puntoProva) prendiPosizione(); leggiZoneSalvate().then((d) => setZone(d && Array.isArray(d.zone) ? d.zone : null)).catch(() => setZone(null)); }, []);
  useEffect(() => {
    if (!punto) return;
    let via = false;
    setParchi(undefined); setMeteo(undefined);
    conTempo(cercaAreeProtette(punto), 12000).then((r) => !via && setParchi(r.dentro || [])).catch(() => !via && setParchi(null));
    conTempo(fetch(`https://api.open-meteo.com/v1/forecast?latitude=${punto.lat.toFixed(4)}&longitude=${punto.lon.toFixed(4)}&current=wind_speed_10m,wind_gusts_10m,precipitation&daily=sunset&timezone=Europe%2FRome&forecast_days=1`).then((r) => r.json()), 9000)
      .then((j) => { if (via) return; const c = j.current || {}; setMeteo({ vento: c.wind_speed_10m, raffiche: c.wind_gusts_10m, pioggia: c.precipitation, tramonto: j.daily && j.daily.sunset ? (([h, m]) => h * 60 + m)(j.daily.sunset[0].slice(11, 16).split(":").map(Number)) : null }); })
      .catch(() => !via && setMeteo(null));
    return () => { via = true; };
  }, [punto && punto.lat, punto && punto.lon]);

  const g = punto ? giudizio(zone, punto) : null;
  const liberi = punto && zone && g && g.altezza < 120 ? postiLiberiVicini(zone, punto, { maxKm: 3, passo: 150, minimo: 30 }) : [];
  const luce = meteo && meteo.tramonto != null ? meteo.tramonto - adesso() : null;

  // E adesso? posti belli entro 20 km in auto, dove si può volare, con i minuti di strada
  const cercaInAuto = async () => {
    if (!punto) return;
    setAuto("cerco");
    try {
      const km = 20, dLat = km / 111, dLon = km / (111 * Math.cos((punto.lat * Math.PI) / 180));
      const [pil, osm] = await Promise.all([
        conTempo(supabase.from("posti_consigliati").select("id, nome, lat, lon, tipo, nota, voto").gte("lat", punto.lat - dLat).lte("lat", punto.lat + dLat).gte("lon", punto.lon - dLon).lte("lon", punto.lon + dLon).limit(200).then(({ data }) => data || []), 10000).catch(() => []),
        cercaPostiOsm(punto, km).catch(() => []),
      ]);
      const candidati = [];
      for (const c of pil) if (!candidati.some((x) => kmTra(x, c) < 0.3)) candidati.push({ id: "p" + c.id, nome: c.nome, tipo: c.tipo || "Consigliato", emoji: "⭐", lat: c.lat, lon: c.lon, nota: c.nota, piloti: true });
      for (const o of osm || []) if (!candidati.some((x) => kmTra(x, o) < 0.3)) candidati.push(o);
      const buoni = candidati
        .map((p) => ({ ...p, km: kmTra(punto, p), zona: statoZona(zone, p) }))
        .filter((p) => p.km > 0.4 && p.km <= km && (!p.zona || p.zona.colore === "#4ade80" || p.zona.colore === "#f5b942"))
        .sort((a, b) => (a.piloti === b.piloti ? a.km - b.km : a.piloti ? -1 : 1))
        .slice(0, 12);
      if (!buoni.length) { setAuto({ posti: [] }); return; }
      const m = await matriceTempi([punto, ...buoni]);
      const conTempi = buoni.map((p, i) => ({ ...p, min: m[0][i + 1] / 60 })).sort((a, b) => (a.piloti && !b.piloti && a.min < b.min + 10 ? -1 : !a.piloti && b.piloti && b.min < a.min + 10 ? 1 : a.min - b.min)).slice(0, 5);
      setAuto({ posti: conTempi });
    } catch { setAuto({ errore: "Le mappe non rispondono: controlla di avere campo e riprova." }); }
  };

  const scheda = { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 12, padding: "14px 16px", marginBottom: 14 };
  const titolo = { fontSize: 12, fontWeight: 700, color: "#8b95a3", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 };
  const bottone = { background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center" };

  return (
    <div style={{ padding: "24px 20px", maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px 0" }}>📍 Qui e ora</h1>
      <p style={{ fontSize: 13, color: "#8b95a3", margin: "0 0 14px 0" }}>Sei sul posto? Ti dico subito se puoi volare, dove andare a piedi se qui non si può, e i posti belli qui vicino. Senza preparare niente.</p>

      {errorePos && <div style={{ ...scheda, borderColor: "#ff6b6b66", color: "#ff9c9c", fontSize: 13 }}>{errorePos} <button type="button" onClick={prendiPosizione} style={{ ...bottone, marginLeft: 6, padding: "4px 10px" }}>Riprova</button></div>}
      {!punto && !errorePos && <div style={{ ...scheda, color: "#8b95a3", fontSize: 13 }}>📡 Cerco dove sei…</div>}

      {punto && (
        <>
          {/* 1. Posso volare qui? */}
          <div style={{ ...scheda, borderColor: g ? g.colore + "88" : "#2b313d" }}>
            {g ? (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 42, lineHeight: 1 }}>{g.emoji}</span>
                <div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: g.colore }}>{g.titolo}</div>
                  <div style={{ fontSize: 13, color: "#c3cad4", marginTop: 2 }}>{g.sotto}</div>
                </div>
              </div>
            ) : zone === null ? (
              <div style={{ fontSize: 13.5, color: "#f5b942" }}>⚠ Per sapere se puoi volare qui serve il file delle zone D-Flight salvato nel telefono (una volta sola, poi funziona anche senza rete). {onCaricaZone && <button type="button" onClick={onCaricaZone} style={{ ...bottone, marginTop: 8 }}>Carica le zone</button>}</div>
            ) : <div style={{ fontSize: 13, color: "#8b95a3" }}>Controllo la zona…</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12, fontSize: 13, color: "#c3cad4" }}>
              {parchi === undefined && <div>🌳 Controllo parchi e aree protette…</div>}
              {parchi === null && <div style={{ color: "#8b95a3" }}>🌳 Parchi non controllati: qui non c'è rete</div>}
              {parchi && parchi.length > 0 && <div style={{ color: "#f5b942", fontWeight: 600 }}>🌳 Sei in: {parchi[0].nome}. Serve il permesso dell'ente del parco.</div>}
              {parchi && parchi.length === 0 && <div>🌳 Nessun parco o area protetta qui</div>}
              {meteo === undefined && <div>💨 Guardo il vento…</div>}
              {meteo === null && <div style={{ color: "#8b95a3" }}>💨 Meteo non disponibile: qui non c'è rete</div>}
              {meteo && <div style={{ color: meteo.raffiche > 38 ? "#ff9c9c" : meteo.raffiche > 28 ? "#f5b942" : "#c3cad4" }}>💨 Vento {Math.round(meteo.vento)} km/h, raffiche {Math.round(meteo.raffiche)}{meteo.raffiche > 38 ? " · troppo forte per i droni piccoli" : ""}{meteo.pioggia > 0 ? " · 🌧️ sta piovendo" : ""}</div>}
              {luce != null && <div style={{ color: luce < 30 ? "#ff9c9c" : luce < 75 ? "#ffd07a" : "#c3cad4" }}>{luce <= 0 ? `🌙 Il sole è già tramontato (${hhmm(meteo.tramonto)}): di notte servono luci e permessi` : `☀️ Ti restano ${durata(luce)} di luce (tramonto alle ${hhmm(meteo.tramonto)})${luce < 75 ? " · ✨ ora d'oro" : ""}`}</div>}
              {punto.precisione > 60 && <div style={{ color: "#8b95a3" }}>📡 Posizione precisa a circa {punto.precisione} m: all'aperto il GPS migliora</div>}
            </div>
          </div>

          {/* 2. A piedi */}
          {g && g.altezza < 120 && (
            <div style={scheda}>
              <div style={titolo}>🚶 Dove posso volare qui intorno</div>
              {liberi.length === 0 ? <div style={{ fontSize: 13, color: "#c3cad4" }}>Nel raggio di 3 km non trovo un punto libero: prova con «E adesso?» qui sotto per i posti in auto.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {liberi.map((q) => (
                    <div key={`${q.lat},${q.lon}`} style={{ display: "flex", gap: 10, alignItems: "center", background: "#161a1f", border: "1px solid #4ade8055", borderRadius: 10, padding: "10px 12px" }}>
                      <span style={{ fontSize: 22 }}>{q.altezza >= 120 ? "✅" : "⚠️"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{q.distanza < 1000 ? `${q.distanza} m` : `${(q.distanza / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km`} verso {q.direzione}</div>
                        <div style={{ fontSize: 12.5, color: "#aab3bf" }}>circa {durata(minutiAPiedi(q.distanza))} a piedi · {q.altezza >= 120 ? "libero fino a 120 m" : `fino a ${q.altezza} m`}</div>
                      </div>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${q.lat},${q.lon}&travelmode=walking`} target="_blank" rel="noreferrer" style={{ ...bottone, padding: "6px 10px", fontSize: 12.5 }}>🚶 Portami</a>
                    </div>
                  ))}
                </div>
              )}
              <MappaQui punto={punto} liberi={liberi} zone={zone} />
              <div style={{ fontSize: 11, color: "#6b7480", marginTop: 6 }}>Pallino blu: sei qui · verde: dove si vola · colori delle zone come su D-Flight. A piedi guarda sempre il sentiero, non la linea dritta.</div>
            </div>
          )}

          {/* 3. In auto */}
          <div style={scheda}>
            <div style={titolo}>🎯 E adesso? Posti belli qui vicino</div>
            {auto === null && <button type="button" onClick={cercaInAuto} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 800 }}>🎯 Dove vado adesso?</button>}
            {auto === "cerco" && <div style={{ fontSize: 13, color: "#8b95a3" }}>Cerco i posti intorno e i minuti di strada…</div>}
            {auto && auto.errore && <div style={{ fontSize: 13, color: "#ff9c9c" }}>{auto.errore}</div>}
            {auto && auto.posti && auto.posti.length === 0 && <div style={{ fontSize: 13, color: "#c3cad4" }}>Qui intorno non trovo posti segnati dove si può volare. Se ne conosci uno, consiglialo dalla pagina Posti!</div>}
            {auto && auto.posti && auto.posti.length > 0 && (
              <>
                {luce != null && luce > 0 && <div style={{ fontSize: 12.5, color: "#ffd07a", marginBottom: 8 }}>☀️ Ti restano {durata(luce)} di luce: {auto.posti.filter((p) => p.min + 20 < luce).length} di questi posti ci stanno.</div>}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {auto.posti.map((p) => {
                    const tardi = luce != null && p.min + 20 >= luce;
                    return (
                      <div key={p.id} style={{ background: "#161a1f", border: `1px solid ${p.piloti ? "#5a4a16" : "#2b313d"}`, borderRadius: 10, padding: "10px 12px", opacity: tardi ? 0.6 : 1 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          <span style={{ fontSize: 22 }}>{p.emoji}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nome}</div>
                            <div style={{ fontSize: 12.5, color: "#aab3bf" }}>🚗 {durata(p.min)} · {p.km.toLocaleString("it-IT", { maximumFractionDigits: 1 })} km · {p.tipo}{p.piloti ? " · consigliato dai piloti" : ""}</div>
                            {p.zona && <div style={{ fontSize: 12, color: p.zona.colore, fontWeight: 600 }}>🛡️ {p.zona.testo}</div>}
                            {!p.zona && <div style={{ fontSize: 12, color: "#8b95a3" }}>🛡️ Zona da controllare</div>}
                            {p.nota && <div style={{ fontSize: 12, color: "#d6dde6" }}>💬 «{p.nota}»</div>}
                            {tardi && <div style={{ fontSize: 12, color: "#ff9c9c" }}>⏳ Arrivi quando il sole è quasi giù</div>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                          <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" style={{ ...bottone, padding: "6px 10px", fontSize: 12.5, background: "#241d16", color: "#ffb877", borderColor: "#ff8c42" }}>🧭 Vai</a>
                          {onAlGiro && <button type="button" disabled={nelGiro[p.id]} onClick={() => { onAlGiro(p); setNelGiro((x) => ({ ...x, [p.id]: true })); }} style={{ ...bottone, padding: "6px 10px", fontSize: 12.5, color: nelGiro[p.id] ? "#4ade80" : "#e7eaee" }}>{nelGiro[p.id] ? "✓ Nel giro" : "＋ Al giro"}</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={prendiPosizione} style={bottone}>🔄 Aggiorna la posizione</button>
            {onPianifica && <button type="button" onClick={() => onPianifica({ nome: "La mia posizione", lat: punto.lat, lon: punto.lon, adesso: true })} style={bottone}>📋 Pianifica il volo completo qui</button>}
          </div>
          <p style={{ fontSize: 10.5, color: "#6b7480", margin: "12px 0 0 0" }}>Zone dal file D-Flight salvato nel telefono, parchi dall'Agenzia europea dell'ambiente, meteo Open-Meteo. Controlla sempre anche NOTAM, proprietà private e il regolamento del parco.</p>
        </>
      )}
    </div>
  );
}
