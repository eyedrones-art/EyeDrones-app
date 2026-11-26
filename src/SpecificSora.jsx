import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { TestataPagina } from "./VoloHero.jsx";
import { COLONNE_GRC, SCENARI_TERRA, MITIGAZIONI, grc, arcIniziale, sail, volumi, coordNotam, firSuggerita, FIR, metriInNm, piediAmsl, testoNotam } from "./sora.js";

// «Categoria Specific»: SORA guidata con ConOps e piano di emergenza in PDF (bozza), e assistente per la richiesta di NOTAM.
// Non sostituisce ENAC né la versione ufficiale della SORA: prepara i documenti, la valutazione resta dell'operatore.

const scheda = { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 16 };
const btn = (p) => ({ background: p ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: p ? "#10141f" : "#e7eaee", border: p ? "none" : "1px solid #343e57", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700 });
const et = { fontSize: 12, color: "#8b95a3", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 };
const griglia = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
const leggi = (k, base) => { try { return { ...base, ...JSON.parse(localStorage.getItem(k) || "{}") } } catch { return base; } };
const salvaLocale = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* niente */ } };
const n = (v) => Number(String(v ?? "").replace(",", ".")) || 0;

const SORA_BASE = {
  missione: "", luogo: "", descrizione: "", drone: "", massa: "", dimensione: "", velocita: "", altezza: "", raggio: "",
  modo: "vlos", scenario: "scarsa", m1: "", m2: "", m3: "media",
  atipico: false, aeroporto: false, classeAeroporto: "D", controllato: false, tmz: false, urbano: false,
  erpContatti: "112 (emergenze), proprietario dell'area, cliente", erpPerditaLink: "Ritorno automatico al punto di decollo (RTH) a quota di sicurezza; se non rientra, atterraggio sul posto.",
  erpFlyaway: "Interruzione del volo con il comando di emergenza; avviso immediato al 112 e all'ente ATS se vicino a spazi aerei controllati.",
  erpPersone: "Sospensione immediata del volo; il drone resta fermo o atterra lontano dalle persone.", erpIncendio: "Estintore per batterie al litio a portata; batteria isolata su superficie non infiammabile.",
};
const CHECKLIST = ["Meteo, vento e visibilità entro i limiti del drone", "Zone geografiche D-Flight e NOTAM controllati", "Area di volo, contingenza e buffer segnati e liberi", "Drone, eliche, batterie e serbatoi controllati", "Collegamento radio, GNSS e RTH impostati", "Osservatori (se servono) al loro posto, comunicazione provata", "Piano di emergenza ripassato con l'equipaggio", "Documenti a bordo: attestati, assicurazione, autorizzazione"];

function pdfSora(d, r, az) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const riga = (t, opt = {}) => { const righe = doc.splitTextToSize(t, 180); if (y + righe.length * 5 > 285) { doc.addPage(); y = 18; } doc.setFont("helvetica", opt.b ? "bold" : "normal"); doc.setFontSize(opt.s || 10); doc.text(righe, 15, y); y += righe.length * (opt.s ? opt.s * 0.5 : 5) + (opt.dopo || 1); };
  const titolo = (t) => { y += 3; riga(t, { b: true, s: 12, dopo: 2 }); };
  riga("ConOps e valutazione SORA — BOZZA", { b: true, s: 16, dopo: 3 });
  riga(`Operatore: ${az.nome || "—"}${az.codiceOperatore ? ` · codice operatore ${az.codiceOperatore}` : ""}`);
  riga(`Preparata con EyeDrones il ${new Date().toLocaleDateString("it-IT")}. Bozza da controllare e completare: non è un documento ENAC. Calcoli secondo la SORA 2.0 (AMC1 all'art. 11 del Reg. UE 2019/947); se ENAC chiede un'altra versione, verifica i valori.`, { s: 9, dopo: 3 });
  titolo("1. Descrizione dell'operazione (ConOps)");
  riga(`Missione: ${d.missione || "—"}`); riga(`Luogo: ${d.luogo || "—"}`); riga(`Tipo di volo: ${d.modo.toUpperCase()}`);
  if (d.descrizione) riga(d.descrizione);
  titolo("2. Drone");
  riga(`${d.drone || "—"} · massa massima ${d.massa || "?"} kg · dimensione caratteristica ${d.dimensione || "?"} m · velocità massima ${d.velocita || "?"} m/s`);
  riga(`Energia cinetica tipica: ${Math.round(r.g.energia).toLocaleString("it-IT")} J, colonna «${COLONNE_GRC[r.g.col].nome}»`);
  titolo("3. Volumi");
  riga(`Area di volo (flight geography): raggio ${d.raggio || "?"} m, altezza massima ${d.altezza || "?"} m dal suolo.`);
  riga(`Volume di contingenza: +${r.v.contingenzaOrizz} m in orizzontale, +${r.v.contingenzaVert} m in verticale (GNSS 3 m, reazione 1 s, arresto a 45°).`);
  riga(`Buffer per il rischio a terra: ${r.v.buffer} m (regola 1:1 per multirotori).`);
  titolo("4. Rischio a terra (GRC)");
  riga(`Scenario: ${(SCENARI_TERRA.find((s) => s.k === d.scenario) || {}).nome} · GRC intrinseco: ${r.g.iniziale ?? "fuori tabella"}`);
  ["m1", "m2", "m3"].forEach((k) => riga(`${MITIGAZIONI[k].nome}: ${(MITIGAZIONI[k].livelli.find((x) => x[0] === d[k]) || MITIGAZIONI[k].livelli[0])[1]}`));
  riga(`GRC finale: ${r.g.finale ?? "—"}${r.g.certificata ? ": oltre 7, serve la categoria certificata" : ""}`, { b: true });
  titolo("5. Rischio in aria (ARC)");
  riga(`ARC iniziale: ARC-${r.arc}${d.aeroporto ? ` (ambiente aeroportuale, classe ${d.classeAeroporto})` : ""}${d.controllato ? " · spazio aereo controllato" : ""}${d.tmz ? " · TMZ/RMZ" : ""}${d.urbano ? " · sopra area urbana" : ""}`);
  titolo("6. SAIL");
  riga(r.sail ? `SAIL ${r.sail}: gli obiettivi di sicurezza operativa (OSO) vanno dimostrati con la robustezza indicata per questo SAIL nella tabella degli OSO della SORA.` : "SAIL non determinabile: GRC oltre 7.", { b: true });
  titolo("7. Piano di risposta alle emergenze (ERP)");
  riga(`Chi chiamare: ${d.erpContatti}`); riga(`Perdita del collegamento: ${d.erpPerditaLink}`); riga(`Fly-away / uscita dal volume: ${d.erpFlyaway}`); riga(`Persone nell'area: ${d.erpPersone}`); riga(`Incendio della batteria: ${d.erpIncendio}`);
  titolo("8. Checklist prima del volo");
  CHECKLIST.forEach((c) => riga(`[  ] ${c}`));
  y += 6; riga("Firma dell'operatore: ____________________________    Data: ____________", { dopo: 2 });
  doc.save(`SORA-${(d.missione || "missione").replace(/[^\w]+/g, "-")}.pdf`);
}

function Sora({ inputStyle, droni, azienda }) {
  const [d, setD] = useState(() => leggi("eyedrones_sora", SORA_BASE));
  useEffect(() => { salvaLocale("eyedrones_sora", d); }, [d]);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const g = grc({ dimensione: n(d.dimensione), massa: n(d.massa), velocita: n(d.velocita), scenario: d.scenario, bvlos: d.modo === "bvlos", m1: d.m1, m2: d.m2, m3: d.m3 });
  const arc = arcIniziale({ ...d, oltre150: n(d.altezza) > 150 });
  const s = g.finale && !g.certificata ? sail(g.finale, arc) : null;
  const v = volumi({ velocita: n(d.velocita), altezza: n(d.altezza) });
  const pronto = n(d.massa) && n(d.dimensione) && n(d.velocita);
  const sceltoDrone = (id) => { const dr = droni.find((x) => String(x.id) === id); if (!dr) return; setD({ ...d, drone: [dr.nome, dr.modello].filter(Boolean).join(" · "), massa: dr.peso_kg || dr.mtom || d.massa }); };
  const colSail = { I: "#4ade80", II: "#a3e635", III: "#facc15", IV: "#fb923c", V: "#f87171", VI: "#ef4444" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-sora>
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>1 · L'operazione (ConOps)</div>
        <div style={griglia}>
          <label style={et}>Missione<input value={d.missione} onChange={set("missione")} placeholder="es. Trattamento vigneti in pendenza" style={inputStyle} /></label>
          <label style={et}>Luogo<input value={d.luogo} onChange={set("luogo")} placeholder="Comune, località" style={inputStyle} /></label>
          <label style={et}>Tipo di volo<select value={d.modo} onChange={set("modo")} style={inputStyle}><option value="vlos">VLOS (a vista)</option><option value="evlos">EVLOS (con osservatori)</option><option value="bvlos">BVLOS (oltre la vista)</option></select></label>
        </div>
        <label style={{ ...et, marginTop: 10 }}>Descrizione (cosa fai, come, con chi)<textarea rows={2} value={d.descrizione} onChange={set("descrizione")} style={{ ...inputStyle, resize: "vertical" }} /></label>
      </div>
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>2 · Drone e area di volo</div>
        <div style={griglia}>
          {droni.length > 0 && <label style={et}>Dai tuoi droni<select defaultValue="" onChange={(e) => sceltoDrone(e.target.value)} style={inputStyle}><option value="">— scegli —</option>{droni.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>}
          <label style={et}>Drone<input value={d.drone} onChange={set("drone")} placeholder="es. Agras T50" style={inputStyle} /></label>
          <label style={et}>Massa massima al decollo (kg)<input inputMode="decimal" value={d.massa} onChange={set("massa")} style={inputStyle} /></label>
          <label style={et}>Dimensione massima (m, eliche comprese)<input inputMode="decimal" value={d.dimensione} onChange={set("dimensione")} style={inputStyle} /></label>
          <label style={et}>Velocità massima (m/s)<input inputMode="decimal" value={d.velocita} onChange={set("velocita")} style={inputStyle} /></label>
          <label style={et}>Altezza massima (m dal suolo)<input inputMode="decimal" value={d.altezza} onChange={set("altezza")} style={inputStyle} /></label>
          <label style={et}>Raggio dell'area di volo (m)<input inputMode="decimal" value={d.raggio} onChange={set("raggio")} style={inputStyle} /></label>
        </div>
        {pronto ? <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 10, lineHeight: 1.6 }} data-volumi>Energia cinetica: <b>{Math.round(g.energia).toLocaleString("it-IT")} J</b> · Contingenza: <b>+{v.contingenzaOrizz} m</b> attorno, <b>+{v.contingenzaVert} m</b> sopra · Buffer a terra: <b>{v.buffer} m</b></div> : <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 8 }}>Scrivi massa, dimensione e velocità per i calcoli.</div>}
      </div>
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>3 · Rischio a terra</div>
        <label style={et}>Cosa c'è sotto<select value={d.scenario} onChange={set("scenario")} style={inputStyle}>{SCENARI_TERRA.map((x) => <option key={x.k} value={x.k}>{x.nome}</option>)}</select></label>
        <div style={{ ...griglia, marginTop: 10 }}>
          {["m1", "m2", "m3"].map((k) => <label key={k} style={et}>{MITIGAZIONI[k].nome}<select value={d[k]} onChange={set(k)} style={inputStyle}>{MITIGAZIONI[k].livelli.map(([val, t]) => <option key={val} value={val}>{t}</option>)}</select></label>)}
        </div>
        {pronto && <div style={{ fontSize: 13, marginTop: 10 }} data-grc>GRC intrinseco <b>{g.iniziale ?? "fuori tabella"}</b> → GRC finale <b style={{ color: g.certificata ? "#ff9c9c" : "#4ade80" }}>{g.finale ?? "—"}</b>{g.certificata ? " · oltre 7: serve la categoria certificata" : ""}</div>}
      </div>
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>4 · Rischio in aria</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#c3cad4" }}>
          <label><input type="checkbox" checked={d.atipico} onChange={set("atipico")} /> Spazio aereo atipico o segregato (es. area riservata con NOTAM)</label>
          <label><input type="checkbox" checked={d.aeroporto} onChange={set("aeroporto")} /> Vicino a un aeroporto o eliporto{d.aeroporto && <select value={d.classeAeroporto} onChange={set("classeAeroporto")} style={{ ...inputStyle, width: 110, display: "inline-block", marginLeft: 8, padding: "4px 6px" }}>{["B", "C", "D", "E", "F", "G"].map((c) => <option key={c} value={c}>classe {c}</option>)}</select>}</label>
          <label><input type="checkbox" checked={d.controllato} onChange={set("controllato")} /> Dentro uno spazio aereo controllato (CTR, ATZ…)</label>
          <label><input type="checkbox" checked={d.tmz} onChange={set("tmz")} /> In una TMZ o RMZ</label>
          <label><input type="checkbox" checked={d.urbano} onChange={set("urbano")} /> Sopra un'area urbana</label>
          {n(d.altezza) > 150 && <div style={{ color: "#facc15" }}>Altezza oltre 150 m dal suolo.</div>}
        </div>
        <div style={{ fontSize: 13, marginTop: 10 }}>ARC iniziale: <b>ARC-{arc}</b></div>
      </div>
      {pronto && (
        <div style={{ ...scheda, border: `1px solid ${s ? colSail[s] : "#ff9c9c"}88`, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }} data-sail>
          <div style={{ fontSize: 34, fontWeight: 900, color: s ? colSail[s] : "#ff9c9c", minWidth: 110 }}>{s ? `SAIL ${s}` : "—"}</div>
          <div style={{ fontSize: 12.5, color: "#c3cad4", lineHeight: 1.5, flex: "1 1 240px" }}>{s ? `Con GRC ${g.finale} e ARC-${arc}. Gli obiettivi di sicurezza operativa (OSO) vanno dimostrati con la robustezza richiesta per il SAIL ${s}.` : "Con questo rischio a terra l'operazione non rientra nella categoria Specific."}</div>
        </div>
      )}
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>5 · Piano di emergenza</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[["erpContatti", "Chi chiamare"], ["erpPerditaLink", "Perdita del collegamento"], ["erpFlyaway", "Fly-away o uscita dal volume"], ["erpPersone", "Persone nell'area"], ["erpIncendio", "Incendio della batteria"]].map(([k, t]) => <label key={k} style={et}>{t}<textarea rows={2} value={d[k]} onChange={set(k)} style={{ ...inputStyle, resize: "vertical" }} /></label>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" disabled={!pronto} onClick={() => pdfSora(d, { g, arc, sail: s, v }, azienda || {})} style={{ ...btn(true), opacity: pronto ? 1 : 0.5 }}>📄 Scarica ConOps e SORA in PDF</button>
        <button type="button" onClick={() => setD(SORA_BASE)} style={btn(false)}>Ricomincia</button>
      </div>
      <div style={{ fontSize: 11.5, color: "#8b95a3", lineHeight: 1.5 }}>Calcoli secondo la SORA 2.0 (AMC1 all'art. 11 del Reg. UE 2019/947). Se ENAC chiede la SORA 2.5 i passaggi sono simili ma alcuni valori cambiano. È una bozza per prepararti: la valutazione e la domanda di autorizzazione restano dell'operatore, e decide ENAC. Per l'agricoltura ENAC ha anche un manuale predefinito (vedi Pratica ENAC).</div>
    </div>
  );
}

function Notam({ inputStyle, azienda }) {
  const domani = (() => { const x = new Date(Date.now() + 86400000); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; })();
  const [d, setD] = useState(() => leggi("eyedrones_notam", { lat: "", lon: "", luogo: "", raggio: "300", altezza: "30", quota: "", dataInizio: domani, dataFine: "", oraInizio: "08:00", oraFine: "12:00", attivita: "UAS agricultural operations", operatore: azienda?.nome || "", telefono: "", fir: "" }));
  const [stato, setStato] = useState("");
  const [copiato, setCopiato] = useState(false);
  useEffect(() => { salvaLocale("eyedrones_notam", d); }, [d]);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const lat = n(d.lat), lon = n(d.lon);
  const coordOk = d.lat !== "" && d.lon !== "" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && (lat || lon);
  const prendiQuota = async (la, lo) => {
    try { const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${la}&longitude=${lo}`); const j = await r.json(); if (j && j.elevation && j.elevation.length) return Math.round(j.elevation[0]); } catch { /* niente */ }
    return null;
  };
  const quiSonoIo = () => {
    if (!navigator.geolocation) { setStato("Il telefono non dà la posizione: scrivi le coordinate."); return; }
    setStato("Cerco la posizione…");
    navigator.geolocation.getCurrentPosition(async (p) => {
      const la = Math.round(p.coords.latitude * 1e5) / 1e5, lo = Math.round(p.coords.longitude * 1e5) / 1e5;
      const q = await prendiQuota(la, lo);
      setD((x) => ({ ...x, lat: String(la), lon: String(lo), quota: q != null ? String(q) : x.quota, fir: x.fir || firSuggerita(la) }));
      setStato(q != null ? `Quota del terreno: ${q} m` : "");
    }, () => setStato("Posizione non disponibile: scrivi le coordinate."), { enableHighAccuracy: true, timeout: 15000 });
  };
  const cercaQuota = async () => { if (!coordOk) return; setStato("Cerco la quota del terreno…"); const q = await prendiQuota(lat, lon); setD({ ...d, quota: q != null ? String(q) : d.quota, fir: d.fir || firSuggerita(lat) }); setStato(q != null ? `Quota del terreno: ${q} m` : "Quota non trovata: scrivila tu."); };
  const pronto = coordOk && d.fir && d.dataInizio && d.oraInizio && d.oraFine && n(d.raggio) && n(d.altezza);
  const testo = pronto ? testoNotam({ ...d, lat, lon }) : "";
  const copia = async () => { try { await navigator.clipboard.writeText(testo); setCopiato(true); setTimeout(() => setCopiato(false), 2000); } catch { setStato("Copia non riuscita: tieni premuto sul testo per copiarlo."); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-notam>
      <div style={{ ...scheda, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.5 }}>Prepara il testo della richiesta di NOTAM con area, quote e orari già nel formato giusto (orari in UTC, coordinate, raggio in miglia nautiche, quota in piedi sul livello del mare). Poi la mandi tu, seguendo la procedura ENAC/ENAV in vigore: controlla sempre i tempi di preavviso.</div>
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Dove</div>
        <div style={griglia}>
          <label style={et}>Latitudine<input inputMode="decimal" value={d.lat} onChange={set("lat")} placeholder="es. 45.0667" style={inputStyle} /></label>
          <label style={et}>Longitudine<input inputMode="decimal" value={d.lon} onChange={set("lon")} placeholder="es. 7.6667" style={inputStyle} /></label>
          <label style={et}>Località<input value={d.luogo} onChange={set("luogo")} placeholder="es. Carmagnola" style={inputStyle} /></label>
          <label style={et}>Raggio (m)<input inputMode="decimal" value={d.raggio} onChange={set("raggio")} style={inputStyle} /></label>
          <label style={et}>Altezza massima (m dal suolo)<input inputMode="decimal" value={d.altezza} onChange={set("altezza")} style={inputStyle} /></label>
          <label style={et}>Quota del terreno (m s.l.m.)<input inputMode="decimal" value={d.quota} onChange={set("quota")} style={inputStyle} /></label>
          <label style={et}>FIR<select value={d.fir} onChange={set("fir")} style={inputStyle}><option value="">— scegli —</option>{FIR.map(([k, t]) => <option key={k} value={k}>{k} · {t}</option>)}</select></label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" onClick={quiSonoIo} style={btn(false)}>🧭 Usa la mia posizione</button>
          <button type="button" onClick={cercaQuota} disabled={!coordOk} style={btn(false)}>⛰️ Trova la quota del terreno</button>
        </div>
        {coordOk && <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 8 }}>{coordNotam(lat, lon)} · raggio {metriInNm(d.raggio).toFixed(1)} NM · fino a {piediAmsl(d.quota, d.altezza)} ft AMSL</div>}
        {stato && <div style={{ fontSize: 12, color: "#9cc4ff", marginTop: 6 }}>{stato}</div>}
      </div>
      <div style={scheda}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Quando e chi</div>
        <div style={griglia}>
          <label style={et}>Dal<input type="date" value={d.dataInizio} onChange={set("dataInizio")} style={inputStyle} /></label>
          <label style={et}>Al (se più giorni)<input type="date" value={d.dataFine} onChange={set("dataFine")} style={inputStyle} /></label>
          <label style={et}>Dalle (ora italiana)<input type="time" value={d.oraInizio} onChange={set("oraInizio")} style={inputStyle} /></label>
          <label style={et}>Alle (ora italiana)<input type="time" value={d.oraFine} onChange={set("oraFine")} style={inputStyle} /></label>
          <label style={et}>Attività (in inglese)<input value={d.attivita} onChange={set("attivita")} style={inputStyle} /></label>
          <label style={et}>Operatore<input value={d.operatore} onChange={set("operatore")} style={inputStyle} /></label>
          <label style={et}>Telefono durante il volo<input value={d.telefono} onChange={set("telefono")} placeholder="+39 …" style={inputStyle} /></label>
        </div>
      </div>
      {pronto ? (
        <div style={{ ...scheda, border: "1px solid #3d8bfd66" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>📡 Testo della richiesta</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12.5, background: "#0b0f19", border: "1px solid #232b3f", borderRadius: 8, padding: 12, margin: 0, userSelect: "all" }} data-testo-notam>{testo}</pre>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button type="button" onClick={copia} style={btn(true)}>{copiato ? "✓ Copiato" : "📋 Copia il testo"}</button>
            <a href={`mailto:?subject=${encodeURIComponent(`Richiesta NOTAM UAS ${d.luogo || ""} ${d.dataInizio}`)}&body=${encodeURIComponent(testo)}`} style={{ ...btn(false), textDecoration: "none" }}>✉️ Prepara l'email</a>
          </div>
          <div style={{ fontSize: 11.5, color: "#8b95a3", marginTop: 8, lineHeight: 1.5 }}>Orari convertiti in UTC dall'ora del telefono. La FIR va controllata: al centro-sud il confine tra Roma e Brindisi non è dritto. L'emissione del NOTAM la decide l'ente competente.</div>
        </div>
      ) : <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Compila posizione, FIR, raggio, altezza, data e orari: il testo compare qui.</div>}
    </div>
  );
}

export default function SpecificSora({ inputStyle, droni = [], azienda = {}, incorporata = false }) {
  const [tab, setTab] = useState("sora");
  return (
    <div style={incorporata ? {} : { padding: "28px 32px", overflow: "auto" }}>
      <div style={{ maxWidth: 900 }}>
        {!incorporata && <TestataPagina titolo="Categoria Specific" sigla="SORA · CONOPS · NOTAM" info="SORA guidata con ConOps, volumi e piano di emergenza in PDF, e il testo della richiesta di NOTAM già pronto." />}
        <div role="tablist" style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
          {[["sora", "🧮 SORA guidata"], ["notam", "📡 Richiesta NOTAM"]].map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} style={{ ...btn(false), background: tab === k ? "#241d16" : "#1a2133", borderColor: tab === k ? "#ff8c42" : "#343e57" }}>{t}</button>)}
        </div>
        {tab === "sora" ? <Sora inputStyle={inputStyle} droni={droni} azienda={azienda} /> : <Notam inputStyle={inputStyle} azienda={azienda} />}
      </div>
    </div>
  );
}
