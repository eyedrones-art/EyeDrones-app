import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { leggiZoneSalvate, controllaPunto, descriviRestrizione, formattaLimiti, partenzaZona, valoreReale } from "./zoneUAS";

const MappaPunto = lazy(() => import("./MappaPunto.jsx"));

// «Assistente permessi»: dici dove voli, l'app legge le zone dal file ufficiale di D-Flight e ti dice
// se puoi chiedere il permesso, a chi, quanti giorni prima e con quale modulo. Poi prepara la richiesta.
// Regole: Circolare ENAC ATM-09A (24/03/2021) e pagina ENAC «Voli con droni: limitazioni e riserve dello spazio aereo».
// - zone vicino agli aeroporti (safety): in Open vietate, si vola solo sotto l'altezza da cui partono; in Specific/STS
//   si chiede la riserva di spazio aereo con il Modello ATM-09A (35 giorni ENAV, 60 militari, 15 senza servizi ATS)
// - zone istituite per altri motivi (parchi, siti sensibili, privacy…): nulla osta dell'ente che ha chiesto la zona,
//   anche in Open

const CHIAVE_RICHIEDENTE = "eyedrones_richiedente_permessi";

// Direzioni aeroportuali ENAC (Allegato B della ATM-09A): la PEC è sempre protocollo@pec.enac.gov.it
export const DIREZIONI_AEROPORTUALI = [
  { id: "nordovest", nome: "Nord Ovest", zona: "Piemonte, Valle d'Aosta, Liguria", email: "nordovest.apt@enac.gov.it" },
  { id: "lombardia", nome: "Lombardia", zona: "Lombardia (tranne Como e Varese)", email: "lombardia.apt@enac.gov.it" },
  { id: "malpensa", nome: "Milano Malpensa", zona: "Province di Como e Varese", email: "malpensa.apt@enac.gov.it" },
  { id: "nordest", nome: "Nord Est", zona: "Veneto, Friuli-Venezia Giulia, Trentino-Alto Adige", email: "nordest.apt@enac.gov.it" },
  { id: "emilia", nome: "Emilia Romagna", zona: "Emilia-Romagna", email: "emiliaromagna.apt@enac.gov.it" },
  { id: "toscana", nome: "Toscana", zona: "Toscana", email: "toscana.apt@enac.gov.it" },
  { id: "centro", nome: "Regioni Centro", zona: "Marche, Umbria, Abruzzo, Molise", email: "regionicentro.apt@enac.gov.it" },
  { id: "lazio", nome: "Lazio", zona: "Lazio", email: "laziofco.apt@enac.gov.it" },
  { id: "campania", nome: "Campania", zona: "Campania", email: "campania.apt@enac.gov.it" },
  { id: "puglia", nome: "Puglia Basilicata", zona: "Puglia, Basilicata", email: "pugliabasilicata.apt@enac.gov.it" },
  { id: "calabria", nome: "Calabria", zona: "Calabria", email: "calabria.apt@enac.gov.it" },
  { id: "sardegna", nome: "Sardegna", zona: "Sardegna", email: "sardegna.apt@enac.gov.it" },
  { id: "siciliaocc", nome: "Sicilia Occidentale", zona: "Agrigento, Caltanissetta, Enna, Palermo, Trapani", email: "occidentalesicilia.apt@enac.gov.it" },
  { id: "siciliaor", nome: "Sicilia Orientale", zona: "Catania, Messina, Ragusa, Siracusa", email: "orientalesicilia.apt@enac.gov.it" },
];
const PEC_ENAC = "protocollo@pec.enac.gov.it";

// dove sei → comune, provincia (sigla) e regione, da OpenStreetMap
async function doveSono(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1&accept-language=it`);
    const a = (await r.json()).address || {};
    const sigla = String(a["ISO3166-2-lvl6"] || "").replace(/^IT-/, "");
    const provincia = String(a.county || a.province || a.state_district || "").replace(/^(Città Metropolitana di|Provincia (autonoma )?di|Libero consorzio comunale di)\s+/i, "").trim();
    return { comune: a.city || a.town || a.village || a.municipality || "", provincia, sigla, regione: a.state || "" };
  } catch { return null; }
}
// regione (e per Lombardia e Sicilia la provincia) → Direzione Aeroportuale ENAC competente (ATM-09A, Allegato B)
function direzionePer(luogo) {
  if (!luogo) return "";
  const r = (luogo.regione || "").toLowerCase(), sg = (luogo.sigla || "").toUpperCase();
  if (/piemonte|valle d|liguria/.test(r)) return "nordovest";
  if (/lombardia/.test(r)) return ["CO", "VA"].includes(sg) ? "malpensa" : "lombardia";
  if (/veneto|friuli|trentino|alto adige|südtirol/.test(r)) return "nordest";
  if (/emilia/.test(r)) return "emilia";
  if (/toscana/.test(r)) return "toscana";
  if (/marche|umbria|abruzzo|molise/.test(r)) return "centro";
  if (/lazio/.test(r)) return "lazio";
  if (/campania/.test(r)) return "campania";
  if (/puglia|basilicata/.test(r)) return "puglia";
  if (/calabria/.test(r)) return "calabria";
  if (/sardegna/.test(r)) return "sardegna";
  if (/sicilia/.test(r)) return ["AG", "CL", "EN", "PA", "TP"].includes(sg) ? "siciliaocc" : "siciliaor";
  return "";
}
// Circolare ENAC ATM-05B, capitolo 11: zone P, R (attive), D e altre di AIP ENR 5 → nulla osta dell'amministrazione
// che ha chiesto la zona, con il Modello ATM-05 in bollo, e in copia a ENAC (indirizzo aggiornato a febbraio 2024)
const PEC_DAP = "segreteriasicurezza.dap@giustiziacert.it";
const CC_ENAC_05 = ["protocollo@pec.enac.gov.it", "mobilita.innovativa@enac.gov.it"];
export const pecPrefettura = (sigla) => (sigla ? `protocollo.pref${String(sigla).toLowerCase()}@pec.interno.it` : "");
const eCarcere = (z) => /penitenz|carcer|circondarial|reclusion|detenzion|edifici particolari/i.test(`${z.nome || ""} ${z.messaggio || ""} ${z.altroMotivo || ""} ${z.motivo || ""}`);
const cercaSulWeb = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

// tipo di aeroporto → a chi si manda il Modello ATM-09A e con quanto anticipo (ATM-09A § 9.2, 9.3, 9.4)
const TIPI_AEROPORTO = {
  civile: { nome: "Aeroporto civile con torre o servizi ENAV (CTR/ATZ)", giorni: 35, a: ["ENAV S.p.A. – protocollogenerale@pec.enav.it"], pec: ["protocollogenerale@pec.enav.it"], diritti: true },
  militare: { nome: "Aeroporto militare (anche aperto al traffico civile)", giorni: 60, a: ["Comando Operazioni Aeree (COA) – aerosquadra.coa@postacert.difesa.it"], pec: ["aerosquadra.coa@postacert.difesa.it"], cc: ["RSCCAM – ACU – sccamciampino.acu@aeronautica.difesa.it"], diritti: false },
  senza: { nome: "Aeroporto, aviosuperficie o elisuperficie senza servizi del traffico aereo", giorni: 15, a: [], pec: [], diritti: true },
};

// richiesta a un ente scelto da te (anche senza zona nel file): Prefettura, Comune, parco, proprietario...
const ENTI_LIBERI = [
  { id: "prefettura", nome: "Prefettura", esempio: "Prefettura di Torino", nota: "La Prefettura dà il nulla osta per l'ordine e la sicurezza pubblica (centri città, eventi, luoghi sensibili). Molte vogliono il loro modulo: guarda il sito della tua Prefettura («sorvoli con drone»). Di solito 10–15 giorni lavorativi prima, via PEC.", giorni: 15 },
  { id: "comune", nome: "Comune", esempio: "Comune di Caselle Torinese", nota: "Al Comune si chiede per riprese in luoghi pubblici o se c'è un'ordinanza. Per il decollo da suolo pubblico può servire l'ufficio occupazione suolo pubblico.", giorni: 10 },
  { id: "parco", nome: "Ente parco o riserva", esempio: "Ente Parco del …", nota: "Molti parchi hanno un loro modulo «nulla osta sorvolo droni» sul sito, a volte a pagamento: se c'è, usa quello.", giorni: 15 },
  { id: "proprietario", nome: "Proprietario o gestore del posto", esempio: "Villa …, Azienda …", nota: "Per decollare o atterrare su un terreno privato, o volare vicino a un edificio (eccezione dell'ostacolo vicino agli aeroporti), serve il permesso del proprietario.", giorni: 3 },
  { id: "altro", nome: "Altro ente", esempio: "Capitaneria di porto, Soprintendenza…", nota: "Usa il contatto scritto sul sito dell'ente.", giorni: 15 },
];

const ATTIVITA = ["Riprese video", "Fotografie", "Ispezione termografica", "Ispezione visiva", "Rilievo / aerofotogrammetria", "Riprese per evento", "Volo amatoriale"];

// zone dello spazio aereo LI-P / LI-D (vietate) e LI-R (vietate quando attive): ATM-09A § 5.3
const siglaSpazioAereo = (z) => { const m = /\bLI[\s-]?([PDR])\s?\d/i.exec(`${z.nome || ""} ${z.id || ""}`); return m ? m[1].toUpperCase() : null; };
const eZonaAeroporto = (z) => /AIR_TRAFFIC/i.test(z.motivo || "") || /ATM ?-?0?9/i.test(z.altroMotivo || "") || /\b(ATZ|CTR|aeroport|eliport|aviosuperf|elisuperf|idrosuperf|airport|heliport)/i.test(z.nome || "");

// 45.40123 → 45°24'04"N (WGS84, risoluzione 1 secondo, come chiede il Modello ATM-09A)
function sessagesimale(v, pos, neg, cifre) {
  const s = Math.round(Math.abs(v) * 3600);
  const g = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(g).padStart(cifre, "0")}°${String(m).padStart(2, "0")}'${String(sec).padStart(2, "0")}"${v >= 0 ? pos : neg}`;
}
export const coordinateDms = (lat, lon) => `${sessagesimale(lat, "N", "S", 2)} ${sessagesimale(lon, "E", "W", 3)}`;
const piedi = (m) => Math.round(Number(m) * 3.28084);
const dataIt = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "");
const meno = (iso, giorni) => { if (!iso) return null; const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() - giorni); return d.toISOString().slice(0, 10); };
const oggiIso = () => new Date().toISOString().slice(0, 10);
// "P15D" → "15 giorni", "PT48H" → "48 ore" (durate ISO del file D-Flight)
const durata = (d) => { const m = String(d || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/i); return m && (m[1] || m[2]) ? [m[1] && `${m[1]} giorni`, m[2] && `${m[2]} ore`].filter(Boolean).join(" e ") : d; };

function leggiRichiedente() { try { return JSON.parse(localStorage.getItem(CHIAVE_RICHIEDENTE) || "null") || {}; } catch { return {}; } }

const st = {
  card: { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 12, padding: 16, marginBottom: 14 },
  input: { width: "100%", boxSizing: "border-box", background: "#12151a", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 6, padding: "9px 10px", fontSize: 13.5, minHeight: 40 },
  etich: { fontSize: 11.5, color: "#8b95a3", display: "block", marginBottom: 4 },
  primario: { background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 700, minHeight: 44 },
  secondario: { background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, minHeight: 42 },
  passo: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: "50%", background: "#ff8c42", color: "#161a1f", fontWeight: 800, fontSize: 13, flex: "none" },
};

function Titolo({ n, children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><span style={st.passo}>{n}</span><span style={{ fontSize: 15.5, fontWeight: 700 }}>{children}</span></div>;
}

export default function AssistentePermessi({ cercaIndirizzo, caricaFileZone, riprendiZone, droni = [], azienda, emailUtente, onSalva, onChiudi }) {
  const [archivio, setArchivio] = useState(undefined);
  const [testo, setTesto] = useState("");
  const [punto, setPunto] = useState(null);
  const [cerco, setCerco] = useState(false);
  const [errore, setErrore] = useState(null);
  const [scelta, setScelta] = useState(null); // { zona, tipo: "aeroporto" | "ente" }
  const [categoria, setCategoria] = useState("open");
  const [luogo, setLuogo] = useState(null); // comune, provincia, regione del punto

  const [leggoFile, setLeggoFile] = useState(false);
  const [erroreFile, setErroreFile] = useState(null);
  // zone dal telefono; se non ci sono provo la copia salvata nell'account
  useEffect(() => {
    let vivo = true;
    leggiZoneSalvate().then(async (d) => {
      const dati = d && Array.isArray(d.zone) ? d : riprendiZone ? await riprendiZone() : null;
      if (vivo) setArchivio(dati || null);
    });
    return () => { vivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const caricaFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !caricaFileZone) return;
    setLeggoFile(true); setErroreFile(null);
    try { setArchivio(await caricaFileZone(file)); } catch (err) { setErroreFile(err.message); }
    setLeggoFile(false);
  };

  useEffect(() => {
    setLuogo(null);
    if (!punto) return undefined;
    let vivo = true;
    const t = setTimeout(() => doveSono(punto.lat, punto.lon).then((l) => vivo && setLuogo(l)), 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [punto && punto.lat, punto && punto.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const esito = useMemo(() => (archivio && punto ? controllaPunto(archivio.zone, punto, { raggio: 300 }) : null), [archivio, punto]);
  const vicine = esito ? esito.vicine.filter((z) => z.distanza <= 150 && z.restrizione !== "NO_RESTRICTION") : [];

  const cerca = async () => {
    if (!testo.trim()) return;
    setCerco(true); setErrore(null); setScelta(null);
    const c = /^\s*(-?\d{1,2}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)\s*$/.exec(testo);
    const trovato = c ? { lat: Number(c[1].replace(",", ".")), lon: Number(c[2].replace(",", ".")), etichetta: "Coordinate" } : await cercaIndirizzo(testo);
    setCerco(false);
    if (trovato) setPunto({ lat: trovato.lat, lon: trovato.lon, etichetta: trovato.etichetta || testo });
    else setErrore("Non trovo questo indirizzo: prova con via e comune, oppure tocca «📍 Sono qui».");
  };
  const quiOra = () => {
    if (!navigator.geolocation) { setErrore("Questo telefono non dà la posizione."); return; }
    setCerco(true); setErrore(null); setScelta(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setCerco(false); setPunto({ lat: p.coords.latitude, lon: p.coords.longitude, etichetta: "La mia posizione" }); setTesto(`${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}`); },
      () => { setCerco(false); setErrore("Non riesco a leggere la posizione: controlla il permesso del browser."); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const zoneDaMostrare = esito ? [...esito.dentro, ...vicine] : [];

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ ...st.card, background: "linear-gradient(135deg, #1d2633, #1b2028)", borderColor: "#3d8bfd55" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>🧭 Assistente permessi</div>
            <div style={{ fontSize: 13, color: "#c3cad4", marginTop: 4 }}>Dimmi dove voli: ti dico se puoi chiedere il permesso, a chi, quanti giorni prima, e ti preparo la richiesta già compilata.</div>
          </div>
          {onChiudi && <button type="button" onClick={onChiudi} style={{ ...st.secondario, minHeight: 36, padding: "6px 12px" }}>Chiudi</button>}
        </div>
      </div>

      {/* 1) dove */}
      <div style={st.card}>
        <Titolo n="1">Dove voli?</Titolo>
        {archivio === null && (
          <div style={{ background: "#3a2a12", border: "1px solid #f5b94266", color: "#ffd9a0", borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 10 }}>
            <div>⚠ Per sapere che zona è serve il <strong>file delle zone di D-Flight</strong>. È gratis e si fa <strong>una volta sola</strong>:</div>
            <ol style={{ margin: "6px 0 8px 0", paddingLeft: 20, fontSize: 12.5, lineHeight: 1.5, color: "#f3dfbf" }}>
              <li>Apri <a href="https://www.d-flight.it/web-app/" target="_blank" rel="noreferrer" style={{ color: "#7fb0ff", fontWeight: 700 }}>D-Flight ↗</a> ed entra con le tue credenziali.</li>
              <li>In alto a sinistra tocca il logo <strong>«d»</strong>, poi sotto «Dettagli account» il <strong>dischetto 💾</strong> (Download UAS Zone Geo).</li>
              <li>Torna qui e tocca il bottone qui sotto: scegli il file dalla cartella <strong>Download</strong>.</li>
            </ol>
            {caricaFileZone && (
              <label style={{ display: "inline-block", background: "#1f2a3a", border: "1px solid #3d8bfd88", color: "#7fb0ff", borderRadius: 6, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                {leggoFile ? "Sto leggendo il file…" : "📂 Carica il file zone di D-Flight"}
                <input type="file" onChange={caricaFile} disabled={leggoFile} style={{ display: "none" }} />
              </label>
            )}
            {erroreFile && <div style={{ color: "#ff9c9c", fontSize: 12.5, marginTop: 6 }}>{erroreFile}</div>}
            <div style={{ fontSize: 11.5, color: "#c9b48f", marginTop: 6 }}>Anche senza file, quando hai scritto il posto puoi già preparare la richiesta a Prefettura, Comune, parco o proprietario.</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && cerca()} placeholder="Via e comune, oppure coordinate (45.0703, 7.6869)" style={{ ...st.input, flex: "1 1 260px" }} />
          <button type="button" onClick={cerca} disabled={cerco} style={st.secondario}>{cerco ? "Cerco…" : "🔎 Cerca"}</button>
          <button type="button" onClick={quiOra} disabled={cerco} style={st.secondario}>📍 Sono qui</button>
        </div>
        {errore && <p style={{ fontSize: 12.5, color: "#ff9c9c", margin: "8px 0 0 0" }}>{errore}</p>}
        {punto && (
          <>
            <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "8px 0 0 0" }}>📍 {luogo && luogo.comune ? `${luogo.comune}${luogo.sigla ? ` (${luogo.sigla})` : ""}${luogo.regione ? ` · ${luogo.regione}` : ""}` : punto.etichetta} · {coordinateDms(punto.lat, punto.lon)} · trascina il puntino se non è nel posto esatto</p>
            <Suspense fallback={null}>
              <MappaPunto punto={punto} zone={esito ? [...esito.dentro, ...esito.vicine] : null} onSposta={(lat, lon) => { setScelta(null); setPunto({ lat, lon, etichetta: "Punto sulla mappa" }); }} />
            </Suspense>
          </>
        )}
      </div>

      {/* 2) cosa dice la zona */}
      {punto && archivio && esito && (
        <div style={st.card}>
          <Titolo n="2">Cosa serve qui</Titolo>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, color: "#8b95a3", alignSelf: "center" }}>Come voli?</span>
            {[["open", "Categoria Open (A1/A3, A2)"], ["specific", "Specific (STS o autorizzazione ENAC)"]].map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setCategoria(k); setScelta(null); }} aria-pressed={categoria === k} style={{ ...st.secondario, minHeight: 36, padding: "6px 12px", background: categoria === k ? "#2b3a52" : "#1f2530", borderColor: categoria === k ? "#3d8bfd" : "#333a45" }}>{l}</button>
            ))}
          </div>

          {zoneDaMostrare.length === 0 && (
            <div style={{ borderLeft: "3px solid #4ade80", background: "#4ade8012", borderRadius: 6, padding: "10px 12px", fontSize: 13 }}>
              <strong style={{ color: "#4ade80" }}>✓ Nessuna zona geografica qui: non devi chiedere permessi per lo spazio aereo.</strong>
              <div style={{ color: "#c3cad4", marginTop: 4 }}>Valgono le regole della tua categoria (Open: massimo 120 m, drone sempre in vista). Controlla comunque i <strong>NOTAM</strong> su D-Flight il giorno prima: eventi, elisoccorso ed esercitazioni non sempre sono nel file.</div>
            </div>
          )}

          {zoneDaMostrare.map((z) => {
            const sigla = siglaSpazioAereo(z);
            const aeroporto = !sigla && eZonaAeroporto(z);
            const d = descriviRestrizione(z.restrizione);
            const parte = partenzaZona(z);
            const enti = (z.autorita || []).map((a) => ({ nome: valoreReale(a.nome), email: valoreReale(a.email), telefono: valoreReale(a.telefono), sito: valoreReale(a.sito), preavviso: valoreReale(a.preavviso) })).filter((a) => a.nome || a.email || a.telefono);
            return (
              <div key={(z.id || z.nome) + (z.distanza || "")} style={{ border: `1px solid ${d.colore}55`, background: d.colore + "0f", borderRadius: 10, padding: 12, marginTop: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: d.colore }}>{sigla ? `⛔ Zona LI-${sigla} dello spazio aereo` : aeroporto ? "✈️ Zona di un aeroporto" : "🏛️ Zona di un ente"}{z.distanza ? <span style={{ color: "#8b95a3", fontWeight: 400 }}> · a {z.distanza} m dal punto</span> : null}</div>
                <div style={{ fontSize: 13, color: "#e7eaee", marginTop: 2 }}>{z.nome}</div>
                {formattaLimiti(z.limiti) && <div style={{ fontSize: 12, color: "#c3cad4", marginTop: 2 }}>↕️ Zona {formattaLimiti(z.limiti)}</div>}

                {sigla && (
                  <div style={{ fontSize: 13, color: "#e7eaee", marginTop: 8, lineHeight: 1.5 }}>
                    {sigla === "R"
                      ? <>⏰ <strong>Vietata solo quando è attiva.</strong> Guarda gli orari su D-Flight e nei NOTAM: fuori orario valgono le regole normali.</>
                      : <>⛔ <strong>Zona {sigla === "P" ? "proibita" : "pericolosa"}: normalmente vietata ai droni.</strong></>}
                    <div style={{ marginTop: 6 }}>✉️ Per volarci {sigla === "R" ? "mentre è attiva " : ""}serve il <strong>nulla osta dell'amministrazione che ha chiesto la zona</strong>, con il <strong>Modello ATM-05 in bollo</strong> (Circolare ENAC ATM-05B, cap. 11), in copia a ENAC.</div>
                    {eCarcere(z) && <div style={{ marginTop: 6, color: "#ffd9a0" }}>🏢 Zona di un carcere: il nulla osta si dà <strong>solo per lavoro</strong> (non per hobby), al Dipartimento dell'Amministrazione Penitenziaria, <strong>almeno 15 giorni prima</strong>, con il documento d'identità.</div>}
                    <div style={{ marginTop: 8 }}><button type="button" onClick={() => setScelta({ zona: z, tipo: "atm05", ente: enti[0] || null, carcere: eCarcere(z) })} style={st.primario}>Prepara il Modello ATM-05 ›</button></div>
                  </div>
                )}
                {aeroporto && categoria === "open" && (
                  <div style={{ fontSize: 13, color: "#e7eaee", marginTop: 8, lineHeight: 1.5 }}>
                    {parte > 0
                      ? <>✅ <strong>Puoi volare fino a {parte} m dal suolo senza chiedere niente</strong>, con le regole della tua categoria. Sopra i {parte} m, in Open, <strong>non si può</strong> e non si può chiedere il permesso.</>
                      : <>⛔ <strong>In categoria Open qui non si vola</strong>, e il permesso non si può chiedere: le zone degli aeroporti sono fatte per la sicurezza del volo.</>}
                    {parte > 0 && <div style={{ color: "#c3cad4", marginTop: 6 }}>🏢 Eccezione utile: vicino a un edificio o a un'antenna puoi stare <strong>entro 50 m in orizzontale e fino a 5 m sopra di esso</strong>, con il permesso del proprietario (ATM-09A § 6.4).</div>}
                    <div style={{ color: "#8b95a3", marginTop: 6 }}>Per salire di più o volare nell'area rossa serve la categoria Specific (scenario standard o autorizzazione ENAC).</div>
                  </div>
                )}
                {aeroporto && categoria === "specific" && (
                  <div style={{ fontSize: 13, color: "#e7eaee", marginTop: 8, lineHeight: 1.5 }}>
                    📄 Si chiede la <strong>riserva di spazio aereo</strong> con il <strong>Modello ATM-09A</strong> ufficiale di ENAC: te lo compilo io.
                    <div style={{ marginTop: 8 }}><button type="button" onClick={() => setScelta({ zona: z, tipo: "aeroporto" })} style={st.primario}>Prepara il Modello ATM-09A ›</button></div>
                  </div>
                )}
                {!aeroporto && !sigla && (
                  <div style={{ fontSize: 13, color: "#e7eaee", marginTop: 8, lineHeight: 1.5 }}>
                    {parte > 0 && <div>✅ Fino a <strong>{parte} m</strong> la zona non vale: lì voli con le regole normali.</div>}
                    ✉️ Si può chiedere il <strong>nulla osta</strong> all'ente che ha chiesto la zona{categoria === "open" ? ", anche in categoria Open" : ""}.
                    {enti.length > 0 ? enti.map((a, i) => (
                      <div key={i} style={{ marginTop: 4, color: "#c3cad4" }}>🏛️ {a.nome || "Ente"}{a.email ? ` · ${a.email}` : ""}{a.telefono ? ` · ${a.telefono}` : ""}{a.preavviso ? ` · chiedi almeno ${durata(a.preavviso)} prima` : ""}</div>
                    )) : <div style={{ marginTop: 4, color: "#f5b942" }}>Il file non dice il contatto dell'ente: lo trovi toccando la zona su D-Flight.</div>}
                    <div style={{ color: "#8b95a3", marginTop: 6 }}>Se l'ente ha un suo modulo (molti parchi e Prefetture ce l'hanno), usa quello: la scheda che ti preparo ha tutti i dati pronti da copiare.</div>
                    <div style={{ marginTop: 8 }}><button type="button" onClick={() => setScelta({ zona: z, tipo: "ente", ente: enti[0] || null })} style={st.primario}>Prepara la richiesta ›</button></div>
                  </div>
                )}
              </div>
            );
          })}

          {zoneDaMostrare.length > 0 && (
            <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "12px 0 0 0" }}>
              🏙️ In centro città, durante eventi o vicino a luoghi sensibili può servire anche il <strong>nulla osta della Prefettura</strong> (di solito 10–15 giorni prima, con il loro modulo): guarda il sito della Prefettura della tua provincia.
            </p>
          )}
        </div>
      )}

      {punto && (
        <div style={{ ...st.card, padding: 12 }}>
          <div style={{ fontSize: 13, color: "#c3cad4", marginBottom: 8 }}>✍️ Devi scrivere a qualcun altro? Prefettura, Comune, un parco che non è nel file o il proprietario del posto: ti scrivo io la richiesta.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ENTI_LIBERI.map((e) => (
              <button key={e.id} type="button" onClick={() => setScelta({ tipo: "ente", libero: e, zona: { id: "libero-" + e.id, nome: "" }, ente: null })} style={{ ...st.secondario, minHeight: 38, padding: "6px 12px", fontSize: 12.5, borderColor: scelta?.libero?.id === e.id ? "#3d8bfd" : "#333a45" }}>{e.nome}</button>
            ))}
          </div>
        </div>
      )}

      {/* 3) richiesta */}
      {scelta && <ModuloRichiesta key={(scelta.zona.id || scelta.zona.nome) + scelta.tipo + (scelta.libero ? scelta.libero.id : "") + (luogo ? luogo.comune : "")} scelta={scelta} punto={punto} luogo={luogo} categoria={categoria} droni={droni} azienda={azienda} emailUtente={emailUtente} onSalva={onSalva} />}

      <p style={{ fontSize: 10.5, color: "#6b7480", margin: "4px 0 0 0" }}>
        Basato sul tuo file zone D-Flight e sulla Circolare ENAC ATM-09A. ENAC sta preparando un nuovo regolamento sulle zone geografiche: quando entra in vigore alcune regole possono cambiare. La verifica ufficiale resta su D-Flight.
      </p>
    </div>
  );
}

function Campo({ label, children, largo }) {
  return <label style={{ display: "block", gridColumn: largo ? "1 / -1" : undefined }}><span style={st.etich}>{label}</span>{children}</label>;
}

function ModuloRichiesta({ scelta, punto, luogo, categoria, droni, azienda, emailUtente, onSalva }) {
  const aeroporto = scelta.tipo === "aeroporto";
  const atm05 = scelta.tipo === "atm05";
  const ricordo = leggiRichiedente();
  const [f, setF] = useState(() => ({
    nome: ricordo.nome || (azienda && azienda.nomeImpostato ? azienda.nome : ""),
    operatore: ricordo.operatore || "",
    autorizzazione: ricordo.autorizzazione || "",
    telefono: ricordo.telefono || "",
    email: ricordo.email || emailUtente || "",
    droneId: droni[0]?.id || "",
    attivita: "Riprese video",
    localita: punto.etichetta && !/^Coordinate|Punto sulla mappa|La mia posizione$/.test(punto.etichetta) ? punto.etichetta.split(",").slice(0, 3).join(",") : luogo && luogo.comune ? `${luogo.comune}${luogo.sigla ? ` (${luogo.sigla})` : ""}` : "",
    dataDa: "", dataA: "", oraDa: "09:00", oraA: "12:00",
    altezza: aeroporto ? 60 : 50, raggio: 200,
    tipoAeroporto: "civile", direzione: direzionePer(luogo), aeroportoNome: (scelta.zona.nome || "").replace(/^(ATZ|CTR)\s*/i, "").replace(/\s*[-–]\s*(area|zona)\b.*$/i, ""), distanzaKm: "",
    sicurezza: "Volo in VLOS con osservatore. Area di decollo e atterraggio delimitata e senza pubblico. Drone con geofence e ritorno automatico attivi.",
  }));
  const [fatto, setFatto] = useState(null);
  const libero = scelta.libero || null;
  const nomeProposto = atm05
    ? (scelta.carcere ? "Ministero della Giustizia – Dipartimento dell'Amministrazione Penitenziaria – Segreteria di Sicurezza" : scelta.ente?.nome || "")
    : !libero || !luogo ? "" : libero.id === "prefettura" && luogo.provincia ? `Prefettura di ${luogo.provincia}` : libero.id === "comune" && luogo.comune ? `Comune di ${luogo.comune}` : "";
  const emailProposta = atm05 ? (scelta.carcere ? PEC_DAP : scelta.ente?.email || "") : libero && libero.id === "prefettura" && luogo ? pecPrefettura(luogo.sigla) : "";
  const [enteNome, setEnteNome] = useState(nomeProposto);
  const [enteEmail, setEnteEmail] = useState(emailProposta);
  const cambia = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const drone = droni.find((d) => d.id === f.droneId);
  const descrDrone = drone ? [drone.modello || drone.nome, drone.marcatura_classe ? `classe ${drone.marcatura_classe}` : null, drone.matricola ? `S/N ${drone.matricola}` : null].filter(Boolean).join(", ") : "";
  const tipoA = TIPI_AEROPORTO[f.tipoAeroporto];
  const dir = DIREZIONI_AEROPORTUALI.find((x) => x.id === f.direzione);
  const ente = libero || atm05 ? { nome: enteNome, email: enteEmail.trim(), preavviso: scelta.ente?.preavviso } : scelta.ente;
  const nomeZona = libero ? (f.localita || "il luogo indicato") : scelta.zona.nome;
  const giorniEnte = libero ? libero.giorni : (() => { const m = String(ente?.preavviso || "").match(/(\d+)\s*(giorn|D)/i) || String(ente?.preavviso || "").match(/^P(\d+)D/i); return m ? Number(m[1]) : null; })();
  const giorni = aeroporto ? tipoA.giorni : atm05 ? (scelta.carcere ? 15 : giorniEnte || 15) : giorniEnte;
  const entro = giorni && f.dataDa ? meno(f.dataDa, giorni) : null;
  const tardi = entro && entro < oggiIso();
  const coord = coordinateDms(punto.lat, punto.lon);
  const periodo = f.dataDa ? `${f.dataA && f.dataA !== f.dataDa ? `dal ${dataIt(f.dataDa)} al ${dataIt(f.dataA)}` : `il ${dataIt(f.dataDa)}`}, dalle ${f.oraDa} alle ${f.oraA} (ora locale)` : "";
  const categoriaTesto = categoria === "open" ? "categoria Open" : f.autorizzazione ? `categoria Specific – ${f.autorizzazione}` : "categoria Specific";
  const richiedente = [f.nome, f.operatore ? `operatore UAS ${f.operatore}` : null, categoria === "specific" && f.autorizzazione ? f.autorizzazione : null].filter(Boolean).join(" – ");
  const destinatari = aeroporto
    ? [...tipoA.pec, PEC_ENAC]
    : [ente?.email].filter(Boolean);
  const inCopia = atm05 ? CC_ENAC_05 : [];
  const oggetto = atm05
    ? `Modello ATM-05 – Richiesta di nulla osta al sorvolo della zona ${scelta.zona.nome} con drone – ${f.dataDa ? dataIt(f.dataDa) : ""}`
    : aeroporto
    ? `Modello ATM-09A – Riserva di spazio aereo per operazioni UAS – ${f.localita || coord} – ${f.dataDa ? dataIt(f.dataDa) : ""}`
    : `${libero && libero.id === "proprietario" ? "Richiesta di permesso" : "Richiesta di nulla osta"} per sorvolo con drone – ${nomeZona} – ${f.dataDa ? dataIt(f.dataDa) : ""}`;
  const allegati = atm05
    ? ["Modello ATM-05 compilato e firmato, con marca da bollo da 16 €", "Documento d'identità del richiedente", "Attestato del pilota remoto", "Registrazione operatore D-Flight (codice operatore)", "Polizza assicurativa RC", ...(categoria === "specific" ? ["Autorizzazione ENAC o dichiarazione dello scenario standard (STS)"] : []), "Mappa dell'area di volo"]
    : aeroporto
    ? ["Modello ATM-09A compilato e firmato", "Documentazione dell'operatore UAS: autorizzazione ENAC o dichiarazione dello scenario standard (STS)", "Attestato del pilota remoto", "Polizza assicurativa RC", ...(tipoA.diritti ? ["Ricevuta del pagamento dei diritti ENAC (servizionline.enac.gov.it)"] : [])]
    : ["Documento d'identità del richiedente e del pilota", "Attestato del pilota remoto (A1/A3, A2 o STS)", "Registrazione operatore D-Flight (codice operatore)", "Polizza assicurativa RC del drone", "Scheda del drone (modello, classe, peso)", "Mappa dell'area di volo con il punto di decollo"];
  // quanto costa: cifre sicure dove ci sono (bollo), altrimenti indicazioni oneste
  const costi = atm05
    ? [["Marca da bollo", "16 €", "il modulo va «in bollo»: la compri dal tabaccaio, la incolli sul modulo e scrivi il numero"], ...(scelta.carcere ? [] : [["Nulla osta", "di solito gratis", "se l'amministrazione chiede altro te lo dice nella risposta"]])]
    : aeroporto
    ? (tipoA.diritti
      ? [["Diritti ENAC", "da pagare", "l'importo dipende dalla tariffa ENAC in vigore: lo vedi su servizionline prima di pagare"], ["ENAV / gestore", "di solito gratis", "la riserva di spazio aereo in sé non si paga"]]
      : [["Comando Operazioni Aeree", "di solito gratis", "per gli aeroporti militari non ci sono diritti ENAC da pagare"]])
    : libero?.id === "prefettura" ? [["Prefettura", "di solito gratis", "alcune Prefetture chiedono una marca da bollo da 16 €: è scritto sul loro modulo"]]
    : libero?.id === "comune" ? [["Comune", "di solito gratis", "se decolli da suolo pubblico per lavoro può servire il permesso di occupazione (costo secondo il Comune)"]]
    : libero?.id === "parco" ? [["Ente parco", "dipende", "spesso gratis per uso amatoriale, a pagamento per riprese commerciali: da poche decine a centinaia di €. Guarda il regolamento del parco"]]
    : libero?.id === "proprietario" ? [["Proprietario", "gratis", "salvo accordi diversi con lui"]]
    : [["Ente", "dipende", "di solito gratis: nella richiesta chiedo io se ci sono costi"]];
  const chiediCosti = !atm05 && !aeroporto;
  const testoEmail = [
    "Buongiorno,",
    "",
    atm05
      ? `in allegato il Modello ATM-05 per la richiesta di nulla osta al sorvolo con drone della zona ${scelta.zona.nome}, ai sensi della Circolare ENAC ATM-05B (cap. 11), con le seguenti caratteristiche:`
      : aeroporto
      ? `in allegato il Modello ATM-09A per la riserva di spazio aereo per operazioni UAS in ${categoriaTesto}, nella zona «${scelta.zona.nome}».`
      : libero
        ? `con la presente chiedo ${libero.id === "proprietario" ? "il permesso di decollare, atterrare e volare con un drone" : "il nulla osta al sorvolo con drone"} a ${f.localita || "nel luogo indicato"}, con le seguenti caratteristiche:`
        : `con la presente chiedo il nulla osta al sorvolo con drone nella zona «${scelta.zona.nome}», con le seguenti caratteristiche:`,
    "",
    `• Richiedente: ${richiedente || "—"}`,
    `• Attività: ${f.attivita}, in VLOS, ${categoriaTesto}`,
    `• Drone: ${descrDrone || "—"}`,
    `• Luogo: ${[f.localita, `coordinate ${coord} (WGS84)`].filter(Boolean).join(" – ")}`,
    `• Area: raggio ${f.raggio} m dal punto, altezza massima ${f.altezza} m dal suolo (${piedi(f.altezza)} ft AGL)`,
    `• Quando: ${periodo || "—"}`,
    `• Sicurezza: ${f.sicurezza}`,
    "",
    "Allego:",
    ...allegati.map((a) => `- ${a}`),
    "",
    ...(chiediCosti ? ["Vi chiedo cortesemente di indicarmi eventuali costi, diritti o marche da bollo necessari.", ""] : []),
    "Resto a disposizione per qualsiasi chiarimento.",
    "Cordiali saluti,",
    f.nome,
    [f.telefono, f.email].filter(Boolean).join(" · "),
  ].join("\n");

  const ricorda = () => { try { localStorage.setItem(CHIAVE_RICHIEDENTE, JSON.stringify({ nome: f.nome, operatore: f.operatore, autorizzazione: f.autorizzazione, telefono: f.telefono, email: f.email })); } catch { /* niente */ } };

  // Modello ATM-09A ufficiale: è un PDF con i campi, li riempio uno per uno
  const scaricaModello = async () => {
    ricorda();
    const { PDFDocument } = await import("pdf-lib");
    const byte = await (await fetch("/moduli/MOD_ATM-09A.pdf")).arrayBuffer();
    const pdf = await PDFDocument.load(byte);
    const form = pdf.getForm();
    const metti = (nome, valore) => { try { form.getTextField(nome).setText(String(valore || "")); } catch { /* campo assente: lo salto */ } };
    metti("A 2", tipoA.a.join("; ") || `ENAC – Direzione Aeroportuale ${dir ? dir.nome : ""} – ${PEC_ENAC}`);
    metti("Cc 2", [tipoA.a.length ? `ENAC – Direzione Aeroportuale ${dir ? dir.nome : "competente"} – ${PEC_ENAC}` : "", ...(tipoA.cc || [])].filter(Boolean).join("; "));
    metti("Il richiedente 3", richiedente);
    metti("Testo1", f.telefono);
    metti("EmailPec", f.email);
    metti("Tipo di attività 4", `${f.attivita} – VLOS`);
    metti("Tipo di UAS 5", descrDrone);
    metti("Località di decollo e coordinate geografiche 6", `${f.localita} – ${coord}`);
    metti("Località di atterraggio e coordinate geografiche 6", `${f.localita} – ${coord}`);
    metti("fill_37", f.localita);
    metti("Raggio di", (f.raggio / 1852).toFixed(2));
    metti("NM", (f.raggio / 1000).toFixed(2));
    metti("Km con centro nel  punto di coordinate geografiche", coord);
    metti("undefined", "GND");
    metti("undefined_2", `${piedi(f.altezza)} ft AGL`);
    metti("fill_9", f.aeroportoNome);
    if (f.distanzaKm) { metti("undefined_3", (Number(f.distanzaKm) / 1.852).toFixed(1)); metti("NM_2", Number(f.distanzaKm).toFixed(1)); }
    metti("Datae orarioi inizio attività 8", periodo);
    metti("Altre notizie utili alla sicurezza delle operazioni 9", f.sicurezza);
    metti("Luogo e data", [(f.localita || "").split(",")[0], new Date().toLocaleDateString("it-IT")].filter(Boolean).join(", "));
    const out = await pdf.save();
    const url = URL.createObjectURL(new Blob([out], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = `Modello-ATM-09A-${(f.localita || "volo").replace(/[^\w]+/g, "-").slice(0, 30)}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // Modello ATM-05 (Allegato A della ATM-05B): il modulo ufficiale è un'immagine, scrivo i dati sopra, riga per riga
  const scaricaModello05 = async () => {
    ricorda();
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.load(await (await fetch("/moduli/MOD_ATM-05.pdf")).arrayBuffer());
    const pg = pdf.getPage(0);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const H = pg.getSize().height;
    const pulito = (t) => String(t || "").replace(/[•]/g, "-").replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”€…]/g, "");
    // coordinate prese dal modulo disegnato a 1,5x (px), convertite in punti PDF
    const scrivi = (t, x, y, finoA = 770) => {
      const testo = pulito(t); if (!testo) return;
      let size = 8.5; const larg = (finoA - x) / 1.5;
      while (size > 5.5 && font.widthOfTextAtSize(testo, size) > larg) size -= 0.5;
      pg.drawText(testo, { x: x / 1.5, y: H - (y + 3) / 1.5, size, font, color: rgb(0.05, 0.12, 0.4) });
    };
    const aCapo = (t, x, y, finoA, righe) => {
      const parole = pulito(t).split(/\s+/); const larg = (finoA - x) / 1.5; let riga = "", n = 0;
      for (const w of parole) { const prova = riga ? `${riga} ${w}` : w; if (font.widthOfTextAtSize(prova, 8) > larg && riga) { pg.drawText(riga, { x: x / 1.5, y: H - (y + 3 + n * 13) / 1.5, size: 8, font, color: rgb(0.05, 0.12, 0.4) }); riga = w; n += 1; if (n >= righe) return; } else riga = prova; }
      if (riga) pg.drawText(riga, { x: x / 1.5, y: H - (y + 3 + n * 13) / 1.5, size: 8, font, color: rgb(0.05, 0.12, 0.4) });
    };
    scrivi(`${ente?.nome || ""}${ente?.email ? ` – ${ente.email}` : ""}`, 140, 461);
    scrivi(`ENAC – Direzione Regolazione e Ricerca Mobilità Innovativa – ${CC_ENAC_05.join(" – ")}`, 140, 482);
    scrivi(richiedente, 190, 510);
    scrivi(f.telefono, 170, 532, 455);
    scrivi(f.email, 528, 532);
    scrivi(`${f.attivita} con drone (UAS) – VLOS – ${categoriaTesto}`, 265, 554);
    scrivi(`UAS ${descrDrone}`, 258, 576);
    scrivi(`${f.localita} – ${coord}`, 400, 597);
    scrivi(`${f.localita} – ${coord}`, 412, 619);
    scrivi(f.localita, 345, 640);
    scrivi(scelta.zona.nome, 292, 661);
    scrivi((f.raggio / 1852).toFixed(2), 192, 847, 236);
    scrivi((f.raggio / 1000).toFixed(2), 298, 847, 322);
    scrivi(coord, 598, 847);
    scrivi("GND", 272, 867, 340);
    scrivi(`${piedi(f.altezza)} ft AGL`, 425, 867, 505);
    scrivi(luogo && luogo.provincia ? `${luogo.comune || ""} (${luogo.sigla || luogo.provincia})` : "", 538, 888);
    scrivi(periodo, 305, 931);
    aCapo(f.sicurezza, 395, 951, 770, 4);
    scrivi([(f.localita || "").split(/[,(]/)[0].trim(), new Date().toLocaleDateString("it-IT")].filter(Boolean).join(", "), 178, 1229, 345);
    const out = await pdf.save();
    const url = URL.createObjectURL(new Blob([out], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url; a.download = `Modello-ATM-05-${(scelta.zona.nome || "zona").replace(/[^\w]+/g, "-").slice(0, 30)}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  // lettera di richiesta del nulla osta, pronta da firmare
  const scaricaLettera = async () => {
    ricorda();
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pulito = (t) => String(t || "").replace(/[•–]/g, (c) => (c === "•" ? "-" : "-")).replace(/[^\x20-\x7E\xA0-\xFF\n€]/g, "");
    let y = 20;
    const riga = (t, { size = 10.5, b = false, gap = 5.2 } = {}) => { doc.setFont("helvetica", b ? "bold" : "normal"); doc.setFontSize(size); doc.splitTextToSize(pulito(t), 180).forEach((r) => { if (y > 280) { doc.addPage(); y = 20; } doc.text(r, 15, y); y += gap; }); };
    riga(f.nome, { b: true, size: 11 }); riga([f.operatore ? `Operatore UAS ${f.operatore}` : "", f.telefono, f.email].filter(Boolean).join(" - ")); y += 6;
    riga(`Spett.le ${ente?.nome || "Ente gestore della zona"}`, { b: true }); if (ente?.email) riga(ente.email); y += 6;
    riga(`Oggetto: ${oggetto}`, { b: true }); y += 3;
    testoEmail.split("\n").slice(0, -2).forEach((t) => (t ? riga(t) : (y += 2.5)));
    riga(f.nome);
    y += 6; riga([(f.localita || "").split(",")[0], new Date().toLocaleDateString("it-IT")].filter(Boolean).join(", ")); y += 10; riga("Firma ______________________________");
    doc.save(`Richiesta-${(libero ? `${libero.nome}-${f.localita}` : scelta.zona.nome || "zona").replace(/[^\w]+/g, "-").slice(0, 40)}.pdf`);
  };

  const apriEmail = () => { ricorda(); window.location.href = `mailto:${destinatari.join(",")}?${inCopia.length ? `cc=${inCopia.join(",")}&` : ""}subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(testoEmail)}`; };
  const copia = async () => { try { await navigator.clipboard.writeText(`A: ${destinatari.join(", ")}${inCopia.length ? `\nCc: ${inCopia.join(", ")}` : ""}\nOggetto: ${oggetto}\n\n${testoEmail}`); setFatto("copiato"); setTimeout(() => setFatto(null), 2500); } catch { setFatto("errore"); } };
  const salva = async () => {
    ricorda();
    const ok = await onSalva({
      impianto: f.localita || coord,
      ente_contattato: atm05 ? `${ente?.nome || ""} (cc ENAC)` : aeroporto ? [tipoA.a.join(", "), `ENAC DA ${dir ? dir.nome : ""}`].filter(Boolean).join(" + ") : (ente?.nome || (libero ? libero.nome : scelta.zona.nome)),
      permessi_richiesti: atm05 ? `Nulla osta zona ${scelta.zona.nome} – Modello ATM-05` : aeroporto ? `Riserva spazio aereo – Modello ATM-09A (${scelta.zona.nome})` : `${libero && libero.id === "proprietario" ? "Permesso" : "Nulla osta"} sorvolo – ${libero ? `${libero.nome}, ${nomeZona}` : scelta.zona.nome}`,
      data_richiesta: oggiIso(),
      note: [`Volo: ${periodo}`, `Area: raggio ${f.raggio} m, max ${f.altezza} m AGL, ${coord}`, giorni ? `Preavviso richiesto: ${giorni} giorni` : null].filter(Boolean).join("\n"),
    });
    if (ok) setFatto("salvato");
  };

  const pronto = f.nome && f.dataDa && (aeroporto ? f.direzione || tipoA.a.length : libero || atm05 ? enteNome.trim() : true);

  return (
    <div style={st.card}>
      <Titolo n="3">{aeroporto ? "Modello ATM-09A, compilato da me" : atm05 ? "Modello ATM-05, compilato da me" : libero ? `La richiesta per: ${libero.nome}` : "La richiesta di nulla osta"}</Titolo>
      {atm05 ? (
        <>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "0 0 10px 0" }}>Zona <strong>{scelta.zona.nome}</strong>. Il nulla osta lo dà l'amministrazione che ha chiesto la zona{scelta.carcere ? ": per le carceri il DAP, solo per lavoro" : ""}. Se non è scritta nel file, la trovi nell'AIP-Italia (ENR 5.1) o toccando la zona su D-Flight.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 10 }}>
            <Campo label="Amministrazione a cui chiedi"><input value={enteNome} onChange={(e) => setEnteNome(e.target.value)} style={st.input} /></Campo>
            <Campo label="PEC dell'amministrazione"><input value={enteEmail} onChange={(e) => setEnteEmail(e.target.value)} inputMode="email" style={st.input} /></Campo>
          </div>
        </>
      ) : libero ? (
        <>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "0 0 10px 0" }}>{libero.nota}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 10 }}>
            <Campo label={`A chi scrivi (es. ${libero.esempio})`}><input value={enteNome} onChange={(e) => setEnteNome(e.target.value)} style={st.input} /></Campo>
            <Campo label="Email o PEC dell'ente (dal suo sito)"><input value={enteEmail} onChange={(e) => setEnteEmail(e.target.value)} inputMode="email" style={st.input} /></Campo>
          </div>
          {enteNome.trim() && (
            <p style={{ fontSize: 12, color: "#8b95a3", margin: "0 0 10px 0" }}>
              🔎 Non sai l'indirizzo? <a href={cercaSulWeb(`${enteNome} ${libero.id === "prefettura" ? "sorvolo drone PEC" : libero.id === "comune" ? "PEC protocollo" : "PEC nulla osta drone"}`)} target="_blank" rel="noreferrer" style={{ color: "#7fb0ff" }}>Cercalo sul sito di {enteNome} ↗</a>{libero.id === "prefettura" ? " (guarda se c'è la pagina «sorvoli con drone» e il loro modulo)" : ""}
            </p>
          )}
        </>
      ) : <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "0 0 12px 0" }}>Zona: <strong>{scelta.zona.nome}</strong>. Riempi quello che manca: i dati della persona li ricordo per la prossima volta.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        <Campo label="Nome e cognome (o azienda)"><input value={f.nome} onChange={cambia("nome")} style={st.input} /></Campo>
        <Campo label="Codice operatore D-Flight (ITA…)"><input value={f.operatore} onChange={cambia("operatore")} placeholder="ITAxxxxxxxxxxxx" style={st.input} /></Campo>
        {categoria === "specific" && <Campo label="N. autorizzazione ENAC o dichiarazione STS"><input value={f.autorizzazione} onChange={cambia("autorizzazione")} placeholder="es. Dichiarazione STS-01 n. …" style={st.input} /></Campo>}
        <Campo label="Telefono"><input value={f.telefono} onChange={cambia("telefono")} inputMode="tel" style={st.input} /></Campo>
        <Campo label={aeroporto ? "Email o PEC" : "Email"}><input value={f.email} onChange={cambia("email")} inputMode="email" style={st.input} /></Campo>
        <Campo label="Drone">
          <select value={f.droneId} onChange={cambia("droneId")} style={st.input}>
            <option value="">— scegli —</option>
            {droni.map((d) => <option key={d.id} value={d.id}>{d.nome}{d.marcatura_classe ? ` (${d.marcatura_classe})` : ""}</option>)}
          </select>
        </Campo>
        <Campo label="Attività"><select value={f.attivita} onChange={cambia("attivita")} style={st.input}>{ATTIVITA.map((a) => <option key={a}>{a}</option>)}</select></Campo>
        <Campo label="Località (paese, via)" largo><input value={f.localita} onChange={cambia("localita")} style={st.input} /></Campo>
        <Campo label="Giorno del volo"><input type="date" value={f.dataDa} onChange={cambia("dataDa")} style={st.input} /></Campo>
        <Campo label="Ultimo giorno (se più giorni)"><input type="date" value={f.dataA} onChange={cambia("dataA")} style={st.input} /></Campo>
        <Campo label="Dalle"><input type="time" value={f.oraDa} onChange={cambia("oraDa")} style={st.input} /></Campo>
        <Campo label="Alle"><input type="time" value={f.oraA} onChange={cambia("oraA")} style={st.input} /></Campo>
        <Campo label="Altezza massima (m dal suolo)"><input type="number" inputMode="numeric" value={f.altezza} onChange={cambia("altezza")} style={st.input} /></Campo>
        <Campo label="Raggio dell'area (m)"><input type="number" inputMode="numeric" value={f.raggio} onChange={cambia("raggio")} style={st.input} /></Campo>
        {aeroporto && <>
          <Campo label="Che aeroporto è?" largo>
            <select value={f.tipoAeroporto} onChange={cambia("tipoAeroporto")} style={st.input}>{Object.entries(TIPI_AEROPORTO).map(([k, t]) => <option key={k} value={k}>{t.nome} · {t.giorni} giorni prima</option>)}</select>
          </Campo>
          <Campo label={direzionePer(luogo) && f.direzione === direzionePer(luogo) ? `Direzione Aeroportuale ENAC · scelta in automatico per ${luogo.regione}` : "Direzione Aeroportuale ENAC (la tua regione)"} largo>
            <select value={f.direzione} onChange={cambia("direzione")} style={st.input}>
              <option value="">— scegli —</option>
              {DIREZIONI_AEROPORTUALI.map((x) => <option key={x.id} value={x.id}>{x.nome} · {x.zona}</option>)}
            </select>
          </Campo>
          <Campo label="Aeroporto vicino"><input value={f.aeroportoNome} onChange={cambia("aeroportoNome")} style={st.input} /></Campo>
          <Campo label="Distanza dall'aeroporto (km, facoltativa)"><input type="number" inputMode="decimal" value={f.distanzaKm} onChange={cambia("distanzaKm")} style={st.input} /></Campo>
        </>}
        <Campo label="Note per la sicurezza" largo><textarea rows={2} value={f.sicurezza} onChange={cambia("sicurezza")} style={{ ...st.input, fontFamily: "inherit", resize: "vertical" }} /></Campo>
      </div>

      {giorni ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, fontSize: 13, background: tardi ? "#ff4d4d1a" : "#3d8bfd14", border: `1px solid ${tardi ? "#ff4d4d66" : "#3d8bfd55"}`, color: tardi ? "#ff9c9c" : "#cfe2ff" }}>
          ⏰ Va mandata <strong>almeno {giorni} giorni prima</strong>{entro ? <>: entro il <strong>{dataIt(entro)}</strong></> : ""}.{tardi ? " Sei in ritardo: chiedi comunque, ma il volo potrebbe non essere autorizzato in tempo." : ""}
        </div>
      ) : !aeroporto && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: "#c3cad4" }}>⏰ Il file non dice il preavviso: chiedi almeno <strong>15 giorni prima</strong> per stare tranquillo.</div>
      )}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>💶 Quanto costa</div>
        {costi.map(([chi, quanto, nota]) => (
          <div key={chi} style={{ display: "flex", gap: 8, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.5, marginBottom: 2 }}>
            <span style={{ flexShrink: 0, minWidth: 92, fontWeight: 700, color: /gratis/.test(quanto) ? "#4ade80" : "#ffb877" }}>{quanto}</span>
            <span><strong>{chi}</strong>: {nota}.</span>
          </div>
        ))}
        {libero?.id !== "proprietario" && <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "4px 0 0 0" }}>Serve anche una casella <strong>PEC</strong> per mandarla: se non ce l'hai costa pochi euro l'anno.</p>}
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>📎 Da allegare</div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.6 }}>{allegati.map((a) => <li key={a}>{a}</li>)}</ul>
        {aeroporto && tipoA.diritti && <p style={{ fontSize: 12, color: "#8b95a3", margin: "6px 0 0 0" }}>I diritti ENAC si pagano su <a href="https://servizionline.enac.gov.it" target="_blank" rel="noreferrer" style={{ color: "#7fb0ff" }}>servizionline.enac.gov.it ↗</a>: poi scrivi numero e data della fattura nel riquadro in alto a destra del modello.</p>}
        {atm05 && <p style={{ fontSize: 12, color: "#8b95a3", margin: "6px 0 0 0" }}>Va mandata da una <strong>PEC</strong> a {ente?.email || "l'amministrazione"}, in copia a ENAC ({CC_ENAC_05.join(", ")}). La marca da bollo da 16 € va applicata sul modulo (o pagata come indicato dall'amministrazione).</p>}
        {aeroporto && <p style={{ fontSize: 12, color: "#8b95a3", margin: "6px 0 0 0" }}>Va mandata da una <strong>PEC</strong> a: {destinatari.join(", ")}{tipoA.cc ? ` (in copia ${tipoA.cc.join(", ")})` : ""}.</p>}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {atm05
          ? <button type="button" disabled={!pronto} onClick={scaricaModello05} style={{ ...st.primario, opacity: pronto ? 1 : 0.5 }}>📄 Scarica il Modello ATM-05 compilato</button>
          : aeroporto
          ? <button type="button" disabled={!pronto} onClick={scaricaModello} style={{ ...st.primario, opacity: pronto ? 1 : 0.5 }}>📄 Scarica il Modello ATM-09A compilato</button>
          : <button type="button" disabled={!pronto} onClick={scaricaLettera} style={{ ...st.primario, opacity: pronto ? 1 : 0.5 }}>📄 Scarica la lettera compilata</button>}
        {destinatari.length > 0 && <button type="button" disabled={!pronto} onClick={apriEmail} style={{ ...st.secondario, opacity: pronto ? 1 : 0.5 }}>✉️ Prepara l'email</button>}
        <button type="button" disabled={!pronto} onClick={copia} style={{ ...st.secondario, opacity: pronto ? 1 : 0.5 }}>{fatto === "copiato" ? "✓ Copiato" : "📋 Copia il testo"}</button>
        <button type="button" disabled={!pronto} onClick={salva} style={{ ...st.secondario, opacity: pronto ? 1 : 0.5 }}>{fatto === "salvato" ? "✓ Salvato nei permessi" : "💾 Segna come inviata"}</button>
      </div>
      {!pronto && <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "6px 0 0 0" }}>Servono almeno nome, giorno del volo{aeroporto ? " e Direzione Aeroportuale" : libero || atm05 ? " e a chi scrivi" : ""}.</p>}
      <p style={{ fontSize: 11, color: "#6b7480", margin: "10px 0 0 0" }}>Controlla sempre i dati prima di mandarla e firmala. {aeroporto ? "Modello ATM-09A: Allegato C della Circolare ENAC ATM-09A." : atm05 ? "Modello ATM-05: Allegato A della Circolare ENAC ATM-05B." : "Se l'ente ha un suo modulo, copia questi dati lì."}</p>
    </div>
  );
}
