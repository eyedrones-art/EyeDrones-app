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

const SERVER_MAPPE = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const conTempoMassimo = (promessa, ms) => Promise.race([promessa, new Promise((_, no) => setTimeout(() => no(new Error("tempo scaduto")), ms))]);
// il primo che risponde bene vince (come Promise.any, che non c'è sui telefoni più vecchi)
const primoBuono = (promesse) => new Promise((ok, no) => { let falliti = 0; promesse.forEach((p) => p.then(ok, () => { if (++falliti === promesse.length) no(new Error("nessuna risposta")); })); });

// memoria dei risultati per zona (7 giorni): la seconda volta i posti compaiono subito
const CHIAVE_MEMORIA = "eyedrones_posti_memoria2"; // «2»: dimentica i risultati vecchi con città e aeroporti
const chiaveZona = ({ lat, lon }, km) => `${lat.toFixed(2)},${lon.toFixed(2)},${km}`;
function daMemoria(c, km) {
  try { const m = JSON.parse(localStorage.getItem(CHIAVE_MEMORIA) || "{}")[chiaveZona(c, km)]; return m && Date.now() - m.t < 7 * 86400000 ? m.posti : null; } catch { return null; }
}
function inMemoria(c, km, posti) {
  try {
    const m = JSON.parse(localStorage.getItem(CHIAVE_MEMORIA) || "{}");
    m[chiaveZona(c, km)] = { t: Date.now(), posti };
    const chiavi = Object.keys(m).sort((x, y) => m[y].t - m[x].t).slice(0, 15); // tengo solo le 15 zone più recenti
    localStorage.setItem(CHIAVE_MEMORIA, JSON.stringify(Object.fromEntries(chiavi.map((k) => [k, m[k]]))));
  } catch { /* memoria piena: pazienza */ }
}

// mappe OpenStreetMap (Overpass): belvedere, castelli, laghi, spiagge, cascate, vette, fari
async function cercaPostiMappe({ lat, lon }, raggioKm) {
  const r = Math.round(Math.min(raggioKm, 30) * 1000);
  const q = `[out:json][timeout:12];(
    node["tourism"="viewpoint"](around:${r},${lat},${lon});
    nwr["historic"~"^(castle|ruins|monastery)$"]["name"](around:${r},${lat},${lon});
    way["natural"="water"]["water"~"^(lake|reservoir)$"]["name"](around:${r},${lat},${lon});
    nwr["natural"="beach"]["name"](around:${r},${lat},${lon});
    node["waterway"="waterfall"]["name"](around:${r},${lat},${lon});
    node["natural"="peak"]["name"](around:${r},${lat},${lon});
    nwr["man_made"="lighthouse"](around:${r},${lat},${lon});
  );out center tags 80;`;
  const prova = (url) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 14000);
    return fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: ctrl.signal })
      .then((risp) => { if (!risp.ok) throw new Error("risposta " + risp.status); return risp.json(); })
      .finally(() => clearTimeout(t));
  };
  const { elements = [] } = await primoBuono(SERVER_MAPPE.map(prova));
  const visti = new Set();
  return elements.map((e) => {
    const tg = e.tags || {};
    const tipo = tipoDa(tg);
    const p = e.lat != null ? { lat: e.lat, lon: e.lon } : e.center ? { lat: e.center.lat, lon: e.center.lon } : null;
    if (!tipo || !p) return null;
    const info = TIPI_OSM.find((x) => x.chiave === tipo);
    return { id: `osm-${e.type}-${e.id}`, fonte: "mappe", nome: tg.name || info.nome, tipo: info.nome, emoji: info.emoji, ...p };
  }).filter((x) => x && !visti.has(x.nome + x.tipo) && visti.add(x.nome + x.tipo));
}

// Wikipedia: luoghi d'interesse con una voce (ville, chiese, castelli, laghi, monumenti). Risponde in fretta.
// Tengo solo i posti belli da riprendere: niente città e paesi, aeroporti, stazioni, strade, scuole o aziende.
const BELLI = /\b(castell[oi]|villa|ville|chiesa|santuario|abbazia|basilica|cattedrale|duomo|torre|rocca|forte|fortezza|borgo|lago|laghi|ponte|parco|giardin[oi]|belvedere|palazzo|palazzina|residenza|monastero|convento|cascata|cascate|monte|colle|eremo|cappella|pieve|reggia|anfiteatro|faro|spiaggia|isola|riserva|oasi|sacra|certosa|ricetto|mulino|cascina|lungolago|lungomare|diga|gola|orrido)\b/i;
const BRUTTI = /\b(comun[ei]|frazione|citt[aà]|quartiere|paese|capoluogo|aeroport[oi]|aeroportuale|aerodromo|aviosuperficie|eliporto|stazione|ferrovi|metropolitana|autostrada|tangenziale|strada|statale|autostazione|ospedale|clinica|scuola|liceo|istituto|universit|stadio|palazzetto|azienda|societ[aà]|squadra|calcio|centro commerciale|ipermercato|cimitero|caserma|carcere|casa circondariale|fabbrica|stabilimento|industria|discarica|depuratore|centrale|inceneritore|ufficio|tribunale|municipio)\b/i;
async function cercaPostiWikipedia({ lat, lon }, raggioKm) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const u = `https://it.wikipedia.org/w/api.php?action=query&generator=geosearch&ggscoord=${lat}|${lon}&ggsradius=${Math.round(Math.min(raggioKm, 10) * 1000)}&ggslimit=60&prop=coordinates|description&format=json&formatversion=2&origin=*`;
    const risp = await fetch(u, { signal: ctrl.signal });
    if (!risp.ok) throw new Error("wikipedia " + risp.status);
    const dati = await risp.json();
    return (dati?.query?.pages || [])
      .filter((g) => g.coordinates?.[0])
      .filter((g) => {
        const descr = g.description || "";
        if (BRUTTI.test(g.title) || BRUTTI.test(descr)) return false;
        return BELLI.test(g.title) || BELLI.test(descr);
      })
      .map((g) => ({ id: `wiki-${g.pageid}`, fonte: "mappe", nome: g.title, tipo: "Luogo d'interesse", emoji: "📌", lat: g.coordinates[0].lat, lon: g.coordinates[0].lon, link: `https://it.wikipedia.org/?curid=${g.pageid}` }));
  } finally { clearTimeout(t); }
}

// tutte e due le fonti insieme: basta che una risponda; null solo se non risponde nessuna
async function cercaPostiOsm(c, raggioKm) {
  const ricordati = daMemoria(c, raggioKm);
  if (ricordati) return ricordati;
  const [mappe, wiki] = await Promise.all([cercaPostiMappe(c, raggioKm).catch(() => null), cercaPostiWikipedia(c, raggioKm).catch(() => null)]);
  if (mappe === null && wiki === null) return null;
  const tutti = [...(mappe || [])];
  for (const w of wiki || []) if (!tutti.some((m) => distanzaKm(m, w) < 0.25 || m.nome.toLowerCase() === w.nome.toLowerCase())) tutti.push(w);
  if (mappe !== null) inMemoria(c, raggioKm, tutti); // salvo solo i risultati completi
  return tutti;
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
  const [caricandoMappe, setCaricandoMappe] = useState(false);
  const [errore, setErrore] = useState(null);
  const [zone, setZone] = useState(undefined);
  const [filtro, setFiltro] = useState("tutti");
  const [aperto, setAperto] = useState(null);
  const [nuovo, setNuovo] = useState(null); // modulo «consiglia un posto»
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { leggiZoneSalvate().then((d) => setZone(d && Array.isArray(d.zone) ? d.zone : null)).catch(() => setZone(null)); }, []);

  const carica = async (c, km = raggio) => {
    setCentro(c); setCaricando(true); setCaricandoMappe(true); setErrore(null); setPosti([]); setConsigli([]);
    const dLat = km / 111, dLon = km / (111 * Math.cos((c.lat * Math.PI) / 180));
    // prima i consigli dei piloti (veloci), poi i punti delle mappe quando arrivano
    const pil = await conTempoMassimo(
      supabase.from("posti_consigliati").select("id, nome, lat, lon, tipo, nota, voto, created_at").gte("lat", c.lat - dLat).lte("lat", c.lat + dLat).gte("lon", c.lon - dLon).lte("lon", c.lon + dLon).limit(300)
        .then(({ data, error }) => (error ? [] : data || [])),
      10000,
    ).catch(() => []);
    setConsigli(pil);
    setCaricando(false);
    const osm = await cercaPostiOsm(c, km).catch(() => null);
    setCaricandoMappe(false);
    if (osm === null) setErrore(pil.length ? "I punti panoramici delle mappe non arrivano adesso: ti mostro solo i consigli dei piloti. Riprova tra poco." : "Le mappe non rispondono in questo momento: riprova tra qualche minuto.");
    setPosti(osm || []);
  };
  const cerca = async () => {
    if (!testo.trim()) return;
    setCaricando(true); setErrore(null);
    const r = await conTempoMassimo(cercaIndirizzo(testo), 12000).catch(() => null);
    if (!r) { setCaricando(false); setErrore("Luogo non trovato: prova con il nome del paese."); return; }
    carica({ lat: r.lat, lon: r.lon, etichetta: testo.trim() });
  };
  const miaPosizione = () => {
    if (!navigator.geolocation) { setErrore("Questo telefono non dà la posizione."); return; }
    setCaricando(true); setErrore(null);
    let finito = false;
    // se il telefono non risponde (posizione spenta o permesso non dato) non resto bloccato
    const guardia = setTimeout(() => { if (finito) return; finito = true; setCaricando(false); setErrore("Non ricevo la posizione: attiva la localizzazione del telefono e consenti l'accesso alla posizione, oppure scrivi il nome del paese."); }, 15000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (finito) return; finito = true; clearTimeout(guardia); carica({ lat: pos.coords.latitude, lon: pos.coords.longitude, etichetta: "la tua posizione" }); },
      () => { if (finito) return; finito = true; clearTimeout(guardia); setCaricando(false); setErrore("Posizione non disponibile: attiva la localizzazione e consenti l'accesso alla posizione, oppure scrivi il nome del paese."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
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
      {caricando && <div style={{ fontSize: 13, color: "#8b95a3" }}>{centro ? "Cerco i posti…" : "Cerco dove sei…"}</div>}
      {!centro && !caricando && <div style={{ background: "#1b2028", border: "1px dashed #333a45", borderRadius: 10, padding: 18, fontSize: 13, color: "#8b95a3", textAlign: "center" }}>Scrivi dove sei o tocca «📍 Vicino a me» per vedere i posti intorno.</div>}

      {centro && !caricando && (
        <>
          <div style={{ fontSize: 12, color: "#8b95a3", marginBottom: 8 }}>{elenco.length} posti entro {raggio} km da {centro.etichetta}{gruppi.length ? ` · ⭐ ${gruppi.length} consigliati dai piloti` : ""}{caricandoMappe ? " · cerco anche i punti panoramici delle mappe…" : ""}</div>
          {tipiPresenti.length > 1 && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 8 }}><button type="button" onClick={() => setFiltro("tutti")} style={stChip(filtro === "tutti")}>Tutti</button>{tipiPresenti.map((t) => <button key={t} type="button" onClick={() => setFiltro(t)} style={stChip(filtro === t)}>{t}</button>)}</div>}
          {elenco.length === 0 && !caricandoMappe && <div style={{ fontSize: 13, color: "#8b95a3" }}>Nessun posto trovato: prova ad allargare la distanza.</div>}
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
                        {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={stLink}>📖 Wikipedia</a>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 10.5, color: "#6b7480", margin: "12px 0 0 0" }}>Punti da OpenStreetMap (© contributori OpenStreetMap) e Wikipedia. Un posto bello non vuol dire che lì si possa volare: controlla sempre zona, NOTAM e regole del luogo (parchi, proprietà private).</p>
        </>
      )}
    </div>
  );
}

// Riquadro compatto per la Pianificazione: i posti belli intorno al luogo del volo (es. foto suggestive agli sposi).
// Si carica solo quando lo apri, per non chiamare le mappe a ogni piano.
export function PostiVicini({ supabase, punto, tipo, onZonaRossa }) {
  const [aperto, setAperto] = useState(false);
  const [km, setKm] = useState(5);
  const [stato, setStato] = useState({ caricando: false, posti: null, errore: null });
  const [zone, setZone] = useState(undefined);
  const chiave = punto ? `${punto.lat.toFixed(3)},${punto.lon.toFixed(3)},${km}` : "";

  useEffect(() => { if (aperto && zone === undefined) leggiZoneSalvate().then((d) => setZone(d && Array.isArray(d.zone) ? d.zone : null)).catch(() => setZone(null)); }, [aperto]);
  useEffect(() => {
    if (!aperto || !punto) return;
    let annullato = false;
    (async () => {
      setStato({ caricando: true, posti: null, errore: null });
      const dLat = km / 111, dLon = km / (111 * Math.cos((punto.lat * Math.PI) / 180));
      const pil = await conTempoMassimo(
        supabase.from("posti_consigliati").select("id, nome, lat, lon, tipo, nota, voto").gte("lat", punto.lat - dLat).lte("lat", punto.lat + dLat).gte("lon", punto.lon - dLon).lte("lon", punto.lon + dLon).limit(100)
          .then(({ data, error }) => (error ? [] : data || [])), 10000,
      ).catch(() => []);
      const osm = await cercaPostiOsm(punto, km).catch(() => null);
      if (annullato) return;
      // consigli vicini tra loro (entro ~300 m) = un posto solo, con le note insieme
      const daPiloti = [];
      for (const c of pil) {
        const g = daPiloti.find((x) => distanzaKm(x, c) < 0.3);
        if (g) { g.n += 1; if (c.nota) g.note.push(c.nota); }
        else daPiloti.push({ id: "pil-" + c.id, nome: c.nome, tipo: c.tipo || "Consigliato", emoji: "⭐", lat: c.lat, lon: c.lon, note: c.nota ? [c.nota] : [], n: 1, piloti: true });
      }
      const tutti = [...daPiloti, ...(osm || []).filter((p) => !daPiloti.some((g) => distanzaKm(g, p) < 0.3))]
        .map((p) => ({ ...p, km: distanzaKm(punto, p) }))
        .filter((p) => p.km <= km + 0.3 && p.km > 0.05)
        .sort((a, b) => (a.piloti === b.piloti ? a.km - b.km : a.piloti ? -1 : 1));
      setStato({ caricando: false, posti: tutti, errore: osm === null && tutti.length === 0 ? "Le mappe non rispondono adesso: riprova tra qualche minuto." : null });
    })();
    return () => { annullato = true; };
  }, [aperto, chiave]);

  if (!punto) return null;
  const sottotitolo = ["video", "foto"].includes(tipo) ? "per foto e riprese suggestive (sposi, eventi, immobili)" : "per sapere cosa c'è intorno";
  const stChip = (on) => ({ background: on ? "#ff8c42" : "#1f2530", color: on ? "#161a1f" : "#e7eaee", border: on ? "none" : "1px solid #333a45", borderRadius: 14, padding: "3px 10px", fontSize: 11.5, fontWeight: on ? 700 : 500 });
  return (
    <details open={aperto} onToggle={(e) => setAperto(e.currentTarget.open)} style={{ background: "#171c24", border: "1px solid #2b3a52", borderRadius: 8, padding: "10px 14px", margin: "14px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#9fc3ff" }}>📍 Posti belli qui vicino <span style={{ fontWeight: 400, color: "#8b95a3", fontSize: 12 }}>· {sottotitolo}</span></summary>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, fontSize: 11.5, color: "#8b95a3" }}>
        Entro {[2, 5, 10].map((k) => <button key={k} type="button" onClick={() => setKm(k)} style={stChip(km === k)}>{k} km</button>)}
      </div>
      {stato.caricando && <div style={{ fontSize: 12.5, color: "#8b95a3", marginTop: 10 }}>Cerco i posti intorno… di solito bastano pochi secondi.</div>}
      {stato.errore && <div style={{ fontSize: 12.5, color: "#ff9c9c", marginTop: 10 }}>{stato.errore}</div>}
      {stato.posti && stato.posti.length === 0 && !stato.errore && <div style={{ fontSize: 12.5, color: "#8b95a3", marginTop: 10 }}>Nessun posto segnato qui intorno: prova ad allargare la distanza.</div>}
      {stato.posti && stato.posti.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {stato.posti.slice(0, 12).map((p) => {
            const z = statoZona(zone, p);
            return (
              <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#1b2028", border: `1px solid ${p.piloti ? "#5a4a16" : "#2b313d"}`, borderRadius: 8, padding: "8px 10px" }}>
                <span style={{ fontSize: 18 }}>{p.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.nome}</div>
                  <div style={{ fontSize: 11.5, color: "#8b95a3" }}>{p.tipo} · {p.km < 1 ? `${Math.round(p.km * 1000)} m` : `${p.km.toFixed(1)} km`}{p.piloti ? ` · consigliato da ${p.n} ${p.n === 1 ? "pilota" : "piloti"}` : ""}</div>
                  {(p.note || []).slice(0, 2).map((n) => <div key={n} style={{ fontSize: 11.5, color: "#d6dde6" }}>💬 «{n}»</div>)}
                  {z && <div style={{ fontSize: 11.5, color: z.colore, fontWeight: 600 }}>🛡️ {z.testo}{z.colore !== "#4ade80" && onZonaRossa ? <> · <button type="button" onClick={onZonaRossa} style={{ background: "none", border: "none", color: "#ffb877", padding: 0, fontSize: 11.5, textDecoration: "underline" }}>come si fa?</button></> : null}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "#3d8bfd", textDecoration: "none", whiteSpace: "nowrap" }}>🧭 Vai</a>
                  {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, color: "#3d8bfd", textDecoration: "none", whiteSpace: "nowrap" }}>📖 Info</a>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: "#6b7480", margin: "8px 0 0 0" }}>{zone === null ? "Carica il file D-Flight qui sopra per vedere la zona di ogni posto. " : ""}Punti da OpenStreetMap, Wikipedia e dai consigli dei piloti: controlla sempre zona, NOTAM e permessi del luogo (proprietà private, parchi).</p>
    </details>
  );
}
