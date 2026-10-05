import React, { useState, useEffect } from "react";
import { leggiZoneSalvate, controllaPunto, altezzaLibera } from "./zoneUAS";

// Posti belli dove volare: punti panoramici dalle mappe pubbliche (OpenStreetMap) + consigli dei piloti EyeDrones.
// Ogni posto mostra la verifica della zona (se il file D-Flight è caricato): l'app non deve mandare nessuno dove non si può.

const TIPI_OSM = [
  { chiave: "viewpoint", emoji: "🏞️", nome: "Punto panoramico" },
  { chiave: "castle", emoji: "🏰", nome: "Castello" },
  { chiave: "ruins", emoji: "🏛️", nome: "Rovine" },
  { chiave: "monastery", emoji: "⛪", nome: "Abbazia / monastero" },
  { chiave: "lake", emoji: "💧", nome: "Lago" },
  { chiave: "beach", emoji: "🏖️", nome: "Spiaggia" },
  { chiave: "waterfall", emoji: "🌊", nome: "Cascata" },
  { chiave: "peak", emoji: "⛰️", nome: "Vetta" },
  { chiave: "lighthouse", emoji: "🗼", nome: "Faro" },
];
const TIPI_PILOTI = ["Panorama", "Lago / mare", "Montagna", "Castello / borgo", "Campagna", "Città", "FPV"];
const tipoDa = (t) => {
  if (t.tourism === "viewpoint") return "viewpoint";
  if (t.historic === "castle") return "castle";
  if (t.historic === "ruins") return "ruins";
  if (t.historic === "monastery" || t.amenity === "monastery") return "monastery";
  if (t.natural === "water" || t.water) return "lake";
  if (t.natural === "beach") return "beach";
  if (t.waterway === "waterfall") return "waterfall";
  if (t.natural === "peak") return "peak";
  if (t.man_made === "lighthouse") return "lighthouse";
  return null;
};
const distanzaKm = (a, b) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

async function cercaPostiOsm({ lat, lon }, raggioKm) {
  const r = Math.round(raggioKm * 1000);
  const q = `[out:json][timeout:25];(
    node["tourism"="viewpoint"](around:${r},${lat},${lon});
    nwr["historic"~"^(castle|ruins|monastery)$"]["name"](around:${r},${lat},${lon});
    nwr["natural"="water"]["water"~"^(lake|reservoir)$"]["name"](around:${r},${lat},${lon});
    nwr["natural"="beach"]["name"](around:${r},${lat},${lon});
    node["waterway"="waterfall"](around:${r},${lat},${lon});
    node["natural"="peak"]["name"](around:${r},${lat},${lon});
    nwr["man_made"="lighthouse"](around:${r},${lat},${lon});
  );out center tags 120;`;
  const risp = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  if (!risp.ok) throw new Error("mappe non raggiungibili");
  const { elements = [] } = await risp.json();
  const visti = new Set();
  return elements.map((e) => {
    const t = e.tags || {};
    const tipo = tipoDa(t);
    const p = e.lat != null ? { lat: e.lat, lon: e.lon } : e.center ? { lat: e.center.lat, lon: e.center.lon } : null;
    if (!tipo || !p) return null;
    const info = TIPI_OSM.find((x) => x.chiave === tipo);
    return { id: `osm-${e.type}-${e.id}`, fonte: "mappe", nome: t.name || info.nome, tipo: info.nome, emoji: info.emoji, ...p };
  }).filter((x) => x && !visti.has(x.nome + x.tipo) && visti.add(x.nome + x.tipo));
}

function statoZona(zone, p) {
  if (!zone) return null;
  const { dentro } = controllaPunto(zone, p, { raggio: 0 });
  const vietata = dentro.some((z) => z.restrizione === "PROHIBITED" && !(z.limiti && z.limiti.da > 0));
  const libera = altezzaLibera(dentro);
  if (vietata && libera === 0) return { colore: "#ff4d4d", testo: "Volo vietato" };
  if (dentro.length === 0 || libera >= 120) return { colore: "#4ade80", testo: dentro.length ? "Volo consentito con le condizioni della zona" : "Nessuna zona UAS: fino a 120 m" };
  if (libera > 0) return { colore: "#f5b942", testo: `Libero fino a ${libera} m · sopra serve autorizzazione` };
  return { colore: "#ff8c42", testo: "Serve autorizzazione già da terra" };
}

export default function Posti({ supabase, cercaIndirizzo, voli = [], inputStyle, onPianifica, onZonaRossa }) {
  const [testo, setTesto] = useState("");
  const [centro, setCentro] = useState(null); // { lat, lon, etichetta }
  const [raggio, setRaggio] = useState(15);
  const [posti, setPosti] = useState(null);
  const [consigli, setConsigli] = useState([]);
  const [caricando, setCaricando] = useState(false);
  const [errore, setErrore] = useState(null);
  const [zone, setZone] = useState(undefined);
  const [filtro, setFiltro] = useState("tutti");
  const [aperto, setAperto] = useState(null);
  const [nuovo, setNuovo] = useState(null); // modulo «consiglia un posto»
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { leggiZoneSalvate().then((d) => setZone(d && Array.isArray(d.zone) ? d.zone : null)).catch(() => setZone(null)); }, []);

  const carica = async (c, km = raggio) => {
    setCentro(c); setCaricando(true); setErrore(null); setPosti(null);
    const dLat = km / 111, dLon = km / (111 * Math.cos((c.lat * Math.PI) / 180));
    const [osm, pil] = await Promise.all([
      cercaPostiOsm(c, km).catch(() => null),
      supabase.from("posti_consigliati").select("id, nome, lat, lon, tipo, nota, voto, created_at").gte("lat", c.lat - dLat).lte("lat", c.lat + dLat).gte("lon", c.lon - dLon).lte("lon", c.lon + dLon).limit(300)
        .then(({ data, error }) => (error ? [] : data || [])),
    ]);
    setConsigli(pil);
    if (osm === null && pil.length === 0) setErrore("Non riesco a leggere le mappe in questo momento: riprova tra poco.");
    setPosti(osm || []);
    setCaricando(false);
  };
  const cerca = async () => {
    if (!testo.trim()) return;
    setCaricando(true); setErrore(null);
    const r = await cercaIndirizzo(testo);
    if (!r) { setCaricando(false); setErrore("Luogo non trovato: prova con il nome del paese."); return; }
    carica({ lat: r.lat, lon: r.lon, etichetta: testo.trim() });
  };
  const miaPosizione = () => {
    if (!navigator.geolocation) { setErrore("Questo telefono non dà la posizione."); return; }
    setCaricando(true); setErrore(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => carica({ lat: pos.coords.latitude, lon: pos.coords.longitude, etichetta: "la tua posizione" }),
      () => { setCaricando(false); setErrore("Posizione non disponibile: scrivi il nome del paese."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  // i consigli dei piloti vicini tra loro (entro ~300 m) diventano un posto solo
  const gruppi = [];
  for (const c of consigli) {
    const g = gruppi.find((x) => distanzaKm(x, c) < 0.3);
    if (g) g.consigli.push(c); else gruppi.push({ id: "pil-" + c.id, fonte: "piloti", nome: c.nome, tipo: c.tipo || "Consigliato", emoji: "⭐", lat: c.lat, lon: c.lon, consigli: [c] });
  }
  const tutti = centro ? [
    ...gruppi.map((g) => ({ ...g, voto: g.consigli.filter((x) => x.voto).reduce((s, x, _, a) => s + x.voto / a.length, 0) })),
    ...(posti || []).filter((p) => !gruppi.some((g) => distanzaKm(g, p) < 0.3)),
  ].map((p) => ({ ...p, km: distanzaKm(centro, p), zona: statoZona(zone, p) }))
    .filter((p) => p.km <= raggio + 0.5)
    .sort((a, b) => (a.fonte === b.fonte ? a.km - b.km : a.fonte === "piloti" ? -1 : 1)) : [];
  const tipiPresenti = [...new Set(tutti.map((p) => p.tipo))];
  const elenco = filtro === "tutti" ? tutti : tutti.filter((p) => p.tipo === filtro);
  const voliConPosizione = voli.filter((v) => v.coordinate_gps && /-?\d+\.\d+\s*,\s*-?\d+\.\d+/.test(v.coordinate_gps)).slice(0, 30);

  const salvaConsiglio = async () => {
    if (!nuovo?.nome?.trim() || !nuovo.lat) return;
    setSalvando(true);
    const { error } = await supabase.from("posti_consigliati").insert({ nome: nuovo.nome.trim(), lat: Number(nuovo.lat.toFixed(5)), lon: Number(nuovo.lon.toFixed(5)), tipo: nuovo.tipo || null, nota: nuovo.nota?.trim() || null, voto: nuovo.voto || null });
    setSalvando(false);
    if (error) { alert(/posti_consigliati|relation|schema cache/i.test(error.message) ? "Per consigliare i posti esegui prima lo script supabase/posti-consigliati.sql su Supabase." : "Non riuscito: " + error.message); return; }
    setNuovo(null);
    if (centro) carica(centro);
  };
  const stChip = (on) => ({ background: on ? "#ff8c42" : "#1f2530", color: on ? "#161a1f" : "#e7eaee", border: on ? "none" : "1px solid #333a45", borderRadius: 16, padding: "5px 11px", fontSize: 12, fontWeight: on ? 700 : 500, whiteSpace: "nowrap" });
  const stLink = { fontSize: 12, color: "#3d8bfd", textDecoration: "none", border: "1px solid #2b313d", borderRadius: 5, padding: "4px 8px", background: "none" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 780 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Posti</h1>
        <button type="button" onClick={() => setNuovo(nuovo ? null : { nome: "", tipo: "", nota: "", voto: 5 })} style={{ background: nuovo ? "transparent" : "#ff8c42", color: nuovo ? "#8b95a3" : "#161a1f", border: nuovo ? "1px solid #333a45" : "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>{nuovo ? "Annulla" : "⭐ Consiglia un posto"}</button>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 14px 0" }}>Posti belli da riprendere vicino a te: quelli consigliati dagli altri piloti e i punti panoramici delle mappe, con la zona di volo già controllata.</p>

      {nuovo && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, padding: 14, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 13, color: "#c3cad4" }}>Consiglia un posto dove hai volato: gli altri piloti vedono nome, nota e voto, <strong>mai chi l'ha scritto</strong>.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {voliConPosizione.length > 0 && (
              <select value="" onChange={(e) => { const v = voliConPosizione.find((x) => x.id === e.target.value); if (!v) return; const [la, lo] = v.coordinate_gps.split(",").map(Number); setNuovo({ ...nuovo, lat: la, lon: lo, nome: nuovo.nome || v.luogo || "" }); }} style={{ ...inputStyle, flex: "1 1 220px" }}>
                <option value="">📒 Da un mio volo…</option>
                {voliConPosizione.map((v) => <option key={v.id} value={v.id}>{v.data} · {v.luogo || v.coordinate_gps}</option>)}
              </select>
            )}
            <button type="button" onClick={() => navigator.geolocation?.getCurrentPosition((pos) => setNuovo((n) => ({ ...n, lat: pos.coords.latitude, lon: pos.coords.longitude })), () => alert("Posizione non disponibile."))} style={stLink}>📍 Sono qui adesso</button>
          </div>
          {nuovo.lat ? <div style={{ fontSize: 11.5, color: "#4ade80" }}>✓ Posizione: {nuovo.lat.toFixed(4)}, {nuovo.lon.toFixed(4)}{zone ? ` · ${statoZona(zone, nuovo)?.testo || ""}` : ""}</div> : <div style={{ fontSize: 11.5, color: "#8b95a3" }}>Scegli un tuo volo o usa la posizione attuale.</div>}
          <input placeholder="Nome del posto (es. Belvedere di Viverone)" value={nuovo.nome} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} style={inputStyle} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{TIPI_PILOTI.map((t) => <button key={t} type="button" onClick={() => setNuovo({ ...nuovo, tipo: nuovo.tipo === t ? "" : t })} style={stChip(nuovo.tipo === t)}>{t}</button>)}</div>
          <textarea rows={2} placeholder="Una dritta per gli altri: parcheggio, orari migliori, vento, quanta gente c'è..." value={nuovo.nota} onChange={(e) => setNuovo({ ...nuovo, nota: e.target.value })} style={{ ...inputStyle, resize: "vertical" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>Voto: {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setNuovo({ ...nuovo, voto: n })} style={{ background: "none", border: "none", fontSize: 20, padding: 0, opacity: n <= nuovo.voto ? 1 : 0.3 }}>⭐</button>)}</div>
          <button type="button" onClick={salvaConsiglio} disabled={!nuovo.nome.trim() || !nuovo.lat || salvando} style={{ background: nuovo.nome.trim() && nuovo.lat ? "#ff8c42" : "#333a45", color: nuovo.nome.trim() && nuovo.lat ? "#161a1f" : "#6b7480", border: "none", borderRadius: 6, padding: "9px 0", fontSize: 13, fontWeight: 600 }}>{salvando ? "Salvataggio..." : "Consiglia questo posto"}</button>
          <div style={{ fontSize: 10.5, color: "#6b7480" }}>Consiglia solo posti dove si può volare e senza indicare case o proprietà private.</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input placeholder="Dove sei? (es. Ivrea, Lago Maggiore)" value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && cerca()} style={{ ...inputStyle, flex: "1 1 200px" }} />
        <button type="button" onClick={cerca} disabled={caricando} style={{ background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}>Cerca</button>
        <button type="button" onClick={miaPosizione} disabled={caricando} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>📍 Vicino a me</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "#8b95a3", marginBottom: 12 }}>
        Entro {[10, 15, 30].map((k) => <button key={k} type="button" onClick={() => { setRaggio(k); if (centro) carica(centro, k); }} style={stChip(raggio === k)}>{k} km</button>)}
      </div>

      {zone === null && centro && <div style={{ fontSize: 12, color: "#f5b942", marginBottom: 10 }}>⚠ Per vedere la zona di volo di ogni posto carica il file D-Flight dalla Pianificazione (una volta sola).</div>}
      {errore && <div style={{ fontSize: 12.5, color: "#ff9c9c", marginBottom: 10 }}>{errore}</div>}
      {caricando && <div style={{ fontSize: 13, color: "#8b95a3" }}>Cerco i posti…</div>}
      {!centro && !caricando && <div style={{ background: "#1b2028", border: "1px dashed #333a45", borderRadius: 10, padding: 18, fontSize: 13, color: "#8b95a3", textAlign: "center" }}>Scrivi dove sei o tocca «📍 Vicino a me» per vedere i posti intorno.</div>}

      {centro && !caricando && (
        <>
          <div style={{ fontSize: 12, color: "#8b95a3", marginBottom: 8 }}>{elenco.length} posti entro {raggio} km da {centro.etichetta}{gruppi.length ? ` · ⭐ ${gruppi.length} consigliati dai piloti` : ""}</div>
          {tipiPresenti.length > 1 && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}><button type="button" onClick={() => setFiltro("tutti")} style={stChip(filtro === "tutti")}>Tutti</button>{tipiPresenti.map((t) => <button key={t} type="button" onClick={() => setFiltro(t)} style={stChip(filtro === t)}>{t}</button>)}</div>}
          {elenco.length === 0 && <div style={{ fontSize: 13, color: "#8b95a3" }}>Nessun posto trovato: prova ad allargare la distanza.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {elenco.slice(0, 60).map((p) => {
              const ap = aperto === p.id;
              return (
                <div key={p.id} style={{ background: "#1b2028", border: `1px solid ${p.fonte === "piloti" ? "#5a4a16" : "#2b313d"}`, borderRadius: 10, padding: "11px 14px" }}>
                  <div onClick={() => setAperto(ap ? null : p.id)} style={{ cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 22 }}>{p.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nome}</div>
                      <div style={{ fontSize: 12, color: "#8b95a3" }}>{p.tipo} · {p.km < 1 ? `${Math.round(p.km * 1000)} m` : `${p.km.toFixed(1)} km`}{p.fonte === "piloti" ? ` · consigliato da ${p.consigli.length} ${p.consigli.length === 1 ? "pilota" : "piloti"}${p.voto ? ` · ${"★".repeat(Math.round(p.voto))}` : ""}` : ""}</div>
                      {p.zona && <div style={{ fontSize: 12, color: p.zona.colore, fontWeight: 600, marginTop: 2 }}>🛡️ {p.zona.testo}</div>}
                    </div>
                  </div>
                  {ap && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2b313d", display: "flex", flexDirection: "column", gap: 8 }}>
                      {p.fonte === "piloti" && p.consigli.filter((c) => c.nota).slice(0, 5).map((c) => <div key={c.id} style={{ fontSize: 12.5, color: "#d6dde6" }}>💬 «{c.nota}»{c.voto ? <span style={{ color: "#f5b942" }}> {"★".repeat(c.voto)}</span> : null}</div>)}
                      {p.zona && p.zona.colore !== "#4ade80" && onZonaRossa && <button type="button" onClick={onZonaRossa} style={{ ...stLink, alignSelf: "flex-start", color: "#ff8c42" }}>🔴 Come si fa a volare qui?</button>}
                      {!p.zona && <div style={{ fontSize: 11.5, color: "#8b95a3" }}>Zona di volo non controllata: verificala su D-Flight prima di andare.</div>}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => onPianifica({ nome: p.nome, lat: p.lat, lon: p.lon })} style={{ ...stLink, background: "#241d16", color: "#ffb877", borderColor: "#ff8c42" }}>📅 Pianifica qui</button>
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" style={stLink}>🧭 Portami lì</a>
                        <a href="https://www.d-flight.it/web-app/" target="_blank" rel="noreferrer" style={stLink}>🗺️ D-Flight</a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 10.5, color: "#6b7480", margin: "12px 0 0 0" }}>Punti panoramici da OpenStreetMap (© contributori OpenStreetMap). Un posto bello non vuol dire che lì si possa volare: controlla sempre zona, NOTAM e regole del luogo (parchi, proprietà private).</p>
        </>
      )}
    </div>
  );
}
