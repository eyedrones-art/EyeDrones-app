import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { TestataPagina } from "./VoloHero.jsx";
import { scenaVuota } from "./Scene.jsx";
import { btn, scheda, campo, Etichetta, griglia, oggi, Linguette, Scorciatoie, Firma, posizioneSole, cardinale, luce, oraridelSole, useDocumenti, AvvisoSql, condividiPdf } from "./lavoroComune.jsx";

const MappaSole = lazy(() => import("./MappaSole.jsx"));

// Cartella «🎬 Foto e video»: giornata dell'evento con il sole e le batterie, dove sarà il sole, contratto per le riprese
// firmato col dito, inquadrature scelte dal cliente con un link e calcolatore di timelapse e iperlapse.
// Si salva in documenti_lavoro (supabase/riprese-fpv.sql).

const CHIAVE_VISTA = "eyedrones_fotovideo_vista";
export const apriFotoVideo = (vista) => { try { sessionStorage.setItem(CHIAVE_VISTA, vista); } catch { /* niente */ } };
const minuti = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const conData = (dataIso, hhmm) => new Date(`${dataIso}T${hhmm || "12:00"}:00`);

export default function FotoVideo({ supabase, inputStyle, azienda = {}, droni = [], onNav, cercaIndirizzo }) {
  const [vista, setVista] = useState(() => { try { const v = sessionStorage.getItem(CHIAVE_VISTA); sessionStorage.removeItem(CHIAVE_VISTA); return v || "giornata"; } catch { return "giornata"; } });
  const voci = [["giornata", "🗓️ Giornata dell'evento"], ["sole", "☀️ Dove sarà il sole"], ["contratto", "📝 Contratto"], ["inquadrature", "🎯 Inquadrature del cliente"], ["timelapse", "⏱️ Timelapse"]];
  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }} data-fotovideo>
      <div style={{ maxWidth: 1000 }}>
        <TestataPagina titolo="Foto e video" sigla="RIPRESE · MATRIMONI · EVENTI · IMMOBILI" foto="/trova-pilota/matrimoni.webp" info="Gli strumenti per chi fa riprese: la giornata dell'evento con il sole e le batterie, il contratto firmato col dito, le scene scelte dal cliente con un link e il calcolatore dei timelapse. Da telefono e da computer." />
        <Scorciatoie voci={[
          ["🎬", "Scaletta e manovre", () => onNav("scaletta")],
          ["📤", "Consegna al cliente", () => onNav("volo:condividi")],
          ["✍️", "Liberatorie", () => onNav("volo:liberatorie")],
          ["🕶️", "Filtri ND", () => onNav("calcolatori")],
          ["🎨", "Colore e LUT", () => onNav("post-produzione")],
          ["📈", "Telemetria sul video", () => onNav("telemetria")],
        ]} />
        <Linguette voci={voci} attiva={vista} onCambia={setVista} />
        {vista === "giornata" && <Giornata supabase={supabase} droni={droni} cercaIndirizzo={cercaIndirizzo} azienda={azienda} />}
        {vista === "sole" && <DoveSole cercaIndirizzo={cercaIndirizzo} />}
        {vista === "contratto" && <Contratto supabase={supabase} azienda={azienda} />}
        {vista === "inquadrature" && <Inquadrature supabase={supabase} azienda={azienda} />}
        {vista === "timelapse" && <Timelapse droni={droni} />}
      </div>
    </div>
  );
}

// --- luogo: cerco l'indirizzo o tocco la mappa ------------------------------------------------------------
function Luogo({ luogo, onCambia, cercaIndirizzo }) {
  const [testo, setTesto] = useState(luogo?.nome || "");
  const [stato, setStato] = useState("");
  const cerca = async () => {
    if (!testo.trim() || !cercaIndirizzo) return;
    setStato("cerco");
    const r = await cercaIndirizzo(testo).catch(() => null);
    if (!r) { setStato("Non trovo l'indirizzo: prova con via e comune, o tocca la mappa."); return; }
    setStato(""); onCambia({ lat: r.lat, lon: r.lon, nome: testo.trim() });
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
      <Etichetta t="Dove (via e comune)"><input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && cerca()} placeholder="es. Villa Sassi, Torino" style={{ ...campo, minWidth: 220 }} aria-label="Luogo" /></Etichetta>
      <button type="button" onClick={cerca} style={btn(true)}>{stato === "cerco" ? "Cerco…" : "🔎 Cerca"}</button>
      {luogo && <span style={{ fontSize: 12, color: "#8b95a3" }}>📍 {luogo.lat.toFixed(5)}, {luogo.lon.toFixed(5)}</span>}
      {stato && stato !== "cerco" && <span style={{ fontSize: 12, color: "#ffb877", width: "100%" }}>{stato}</span>}
    </div>
  );
}

function RigaSole({ dataIso, ora, luogo }) {
  if (!luogo || !ora) return null;
  const s = posizioneSole(conData(dataIso, ora), luogo.lat, luogo.lon), l = luce(s.altezza);
  return <span style={{ fontSize: 12, color: l.colore }}>{l.emoji} {l.nome}{s.altezza > -1 ? ` · sole da ${cardinale(s.azimut)}, alto ${Math.round(s.altezza)}°` : ""}</span>;
}

// --- giornata dell'evento --------------------------------------------------------------------------------
const MOMENTI_MATRIMONIO = [["10:30", "Preparativi della sposa", 1, 6], ["11:30", "Arrivo in chiesa / municipio", 1, 8], ["12:30", "Uscita e lancio del riso", 1, 8], ["13:30", "Arrivo in location", 1, 10], ["17:30", "Servizio sposi all'ora d'oro", 2, 12]];
const GIORNATA_VUOTA = { data: oggi(), luogo: null, autonomia: "", scorta: 1, momenti: [] };

function Giornata({ supabase, droni, cercaIndirizzo, azienda }) {
  const docs = useDocumenti(supabase, "giornata");
  const [g, setG] = useState({ ...GIORNATA_VUOTA, titolo: "" });
  const [id, setId] = useState(null);
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setG((x) => ({ ...x, [k]: v }));
  const mom = [...g.momenti].sort((a, b) => minuti(a.ora) - minuti(b.ora));
  const autonomia = Number(String(g.autonomia).replace(",", ".")) || 0;
  const minutiVolo = mom.reduce((t, m) => t + (Number(m.voli) || 0) * (Number(m.minuti) || 0), 0);
  const batterie = autonomia ? Math.ceil(minutiVolo / (autonomia * 0.8)) + (Number(g.scorta) || 0) : null;
  const orari = g.luogo ? oraridelSole(g.data, g.luogo.lat, g.luogo.lon) : null;
  const scelto = mom[sel] || null;
  const soleScelto = g.luogo && scelto ? { ...posizioneSole(conData(g.data, scelto.ora), g.luogo.lat, g.luogo.lon) } : null;
  const aggiungi = (ora = "", evento = "", voli = 1, min = 8) => set("momenti", [...g.momenti, { id: Math.random().toString(36).slice(2, 8), ora, evento, voli, minuti: min }]);
  const cambia = (mid, k, v) => set("momenti", g.momenti.map((m) => (m.id === mid ? { ...m, [k]: v } : m)));
  const salva = async () => {
    try { const r = await docs.salva({ id, titolo: g.titolo || `Giornata del ${g.data}`, dati: g }); setId(r.id); setMsg("✅ Salvata"); } catch (e) { setMsg("Non salvata: " + (e.message || e)); }
  };
  const pdf = async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFontSize(16); doc.text(g.titolo || "Giornata dell'evento", 15, 18);
    doc.setFontSize(10); doc.setTextColor(90); doc.text(`${g.data}${g.luogo ? ` · ${g.luogo.nome || ""}` : ""} · ${azienda.nome || "EyeDrones"}`, 15, 25);
    if (orari) doc.text(`Alba ${orari.alba} · ora d'oro dalle ${orari.oroSeraInizio} · tramonto ${orari.tramonto} · ora blu fino alle ${orari.bluSeraFine}`, 15, 31);
    let y = 42; doc.setTextColor(20);
    mom.forEach((m) => {
      const s = g.luogo && m.ora ? posizioneSole(conData(g.data, m.ora), g.luogo.lat, g.luogo.lon) : null;
      doc.setFontSize(12); doc.text(`${m.ora || "--:--"}  ${m.evento || ""}`, 15, y);
      doc.setFontSize(9.5); doc.setTextColor(90);
      doc.text(`${m.voli || 0} voli da ${m.minuti || 0} min${s ? ` · ${luce(s.altezza).nome}${s.altezza > -1 ? `, sole da ${cardinale(s.azimut)} alto ${Math.round(s.altezza)}°` : ""}` : ""}`, 15, y + 5);
      doc.setTextColor(20); y += 13; if (y > 270) { doc.addPage(); y = 20; }
    });
    if (batterie != null) { doc.setFontSize(12); doc.text(`Batterie da portare: ${batterie} (${minutiVolo} min di volo, autonomia ${autonomia} min usata all'80%, ${g.scorta} di scorta)`, 15, y + 4, { maxWidth: 180 }); }
    await condividiPdf(doc, `Giornata-${g.data}.pdf`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-giornata>
      {docs.manca && <AvvisoSql />}
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={griglia}>
          <Etichetta t="Nome dell'evento"><input value={g.titolo} onChange={(e) => set("titolo", e.target.value)} placeholder="es. Matrimonio Rossi" style={campo} /></Etichetta>
          <Etichetta t="Data"><input type="date" value={g.data} onChange={(e) => set("data", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Autonomia di una batteria (min)"><input inputMode="decimal" value={g.autonomia} onChange={(e) => set("autonomia", e.target.value)} placeholder={droni.length ? "es. 30" : "es. 30"} style={campo} aria-label="Autonomia" /></Etichetta>
          <Etichetta t="Batterie di scorta"><input inputMode="numeric" value={g.scorta} onChange={(e) => set("scorta", e.target.value)} style={campo} /></Etichetta>
        </div>
        <Luogo luogo={g.luogo} onCambia={(l) => set("luogo", l)} cercaIndirizzo={cercaIndirizzo} />
        {orari && <div style={{ fontSize: 12.5, color: "#c3cad4" }}>🌅 Alba {orari.alba} · ✨ ora d'oro dalle {orari.oroSeraInizio} · 🌇 tramonto {orari.tramonto} · 🔵 ora blu fino alle {orari.bluSeraFine}</div>}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <div style={{ ...scheda, flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Momenti della giornata</div>
          {!mom.length && <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Aggiungi i momenti: per ognuno ti dico che luce c'è e da dove arriva il sole.</div>}
          {mom.map((m, i) => (
            <div key={m.id} onClick={() => setSel(i)} style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8, borderRadius: 8, border: `1px solid ${i === sel ? "#ff8c42" : "#232b3f"}`, background: "#10141f" }} data-momento>
              <div style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 6 }}>
                <input type="time" value={m.ora} onChange={(e) => cambia(m.id, "ora", e.target.value)} style={campo} aria-label="Ora" />
                <input value={m.evento} onChange={(e) => cambia(m.id, "evento", e.target.value)} placeholder="Cosa succede" style={campo} aria-label="Momento" />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "#8b95a3" }}>
                <input inputMode="numeric" value={m.voli} onChange={(e) => cambia(m.id, "voli", e.target.value)} style={{ ...campo, width: 52 }} aria-label="Voli" /> voli da
                <input inputMode="numeric" value={m.minuti} onChange={(e) => cambia(m.id, "minuti", e.target.value)} style={{ ...campo, width: 52 }} aria-label="Minuti" /> min
                <button type="button" onClick={(e) => { e.stopPropagation(); set("momenti", g.momenti.filter((x) => x.id !== m.id)); }} style={{ background: "none", border: "none", color: "#ff9c9c", marginLeft: "auto" }} aria-label="Togli">✕</button>
              </div>
              <RigaSole dataIso={g.data} ora={m.ora} luogo={g.luogo} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={() => aggiungi()} style={btn(false)}>＋ Aggiungi un momento</button>
            {!g.momenti.length && <button type="button" onClick={() => set("momenti", MOMENTI_MATRIMONIO.map(([ora, evento, voli, min]) => ({ id: Math.random().toString(36).slice(2, 8), ora, evento, voli, minuti: min })))} style={btn(false)}>💍 Parti da un matrimonio</button>}
          </div>
          <div style={{ fontSize: 13.5, color: "#e7eaee", borderTop: "1px solid #232b3f", paddingTop: 8 }} data-batterie>
            🔋 {batterie == null ? "Scrivi l'autonomia di una batteria per sapere quante portarne." : <>Porta <b style={{ color: "#4ade80" }}>{batterie} batterie</b> · {minutiVolo} minuti di volo in tutto, conto l'80% dell'autonomia e {g.scorta} di scorta.</>}
          </div>
        </div>
        <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {g.luogo ? <Suspense fallback={null}><MappaSole centro={g.luogo} sole={soleScelto} onTocca={(lat, lon) => set("luogo", { ...g.luogo, lat, lon })} /></Suspense> : <div style={{ ...scheda, fontSize: 12.5, color: "#8b95a3" }}>Cerca il luogo: sulla mappa vedi da dove arriva il sole nel momento scelto.</div>}
          {scelto && g.luogo && <div style={{ fontSize: 12, color: "#8b95a3" }}>Momento scelto: <b style={{ color: "#e7eaee" }}>{scelto.ora} {scelto.evento}</b> · linea gialla = sole, linea grigia = ombre. Tocca un altro momento per cambiarlo.</div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={salva} style={btn(true)}>💾 Salva la giornata</button>
        <button type="button" onClick={pdf} style={btn(false)}>📄 PDF per il cliente o lo staff</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✅") ? "#4ade80" : "#ffb877" }}>{msg}</span>}
      </div>
      {docs.lista && docs.lista.length > 0 && (
        <div style={scheda}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Giornate salvate</div>
          {docs.lista.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #232b3f", fontSize: 13 }}>
              <button type="button" onClick={() => { setG({ ...GIORNATA_VUOTA, ...d.dati, titolo: d.titolo || "" }); setId(d.id); setSel(0); }} style={{ background: "none", border: "none", color: "#9cc3ff", textAlign: "left", flex: 1 }}>{d.titolo}</button>
              <button type="button" onClick={() => docs.togli(d.id)} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Elimina">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- dove sarà il sole ----------------------------------------------------------------------------------
function DoveSole({ cercaIndirizzo }) {
  const [luogo, setLuogo] = useState(null);
  const [data, setData] = useState(oggi());
  const [min, setMin] = useState(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
  const ora = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const sole = luogo ? posizioneSole(conData(data, ora), luogo.lat, luogo.lon) : null;
  const orari = luogo ? oraridelSole(data, luogo.lat, luogo.lon) : null;
  const l = sole ? luce(sole.altezza) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-dove-sole>
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <Luogo luogo={luogo} onCambia={setLuogo} cercaIndirizzo={cercaIndirizzo} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Etichetta t="Giorno"><input type="date" value={data} onChange={(e) => setData(e.target.value)} style={campo} /></Etichetta>
          <Etichetta t={`Ora: ${ora}`}><input type="range" min={0} max={1439} step={5} value={min} onChange={(e) => setMin(Number(e.target.value))} style={{ width: 260, maxWidth: "100%" }} aria-label="Ora" /></Etichetta>
        </div>
        {sole && <div style={{ fontSize: 14, color: l.colore, fontWeight: 700 }}>{l.emoji} {l.nome}{sole.altezza > -1 ? ` · il sole arriva da ${cardinale(sole.azimut)} (${Math.round(sole.azimut)}°), alto ${Math.round(sole.altezza)}°` : " · il sole è sotto l'orizzonte"}</div>}
        {orari && <div style={{ fontSize: 12.5, color: "#c3cad4" }}>🌅 Alba {orari.alba} · ✨ ora d'oro del mattino fino alle {orari.oroMattinaFine} · ✨ ora d'oro della sera dalle {orari.oroSeraInizio} · 🌇 tramonto {orari.tramonto}</div>}
        {sole && sole.altezza > -1 && <div style={{ fontSize: 12, color: "#8b95a3" }}>Per una facciata in luce, mettiti con il sole alle spalle: guarda verso {cardinale(sole.azimut + 180)}. Controluce per le silhouette: guarda verso {cardinale(sole.azimut)}.</div>}
      </div>
      {luogo ? <Suspense fallback={null}><MappaSole centro={luogo} sole={sole} onTocca={(lat, lon) => setLuogo({ ...luogo, lat, lon })} altezza={360} /></Suspense> : <div style={{ ...scheda, fontSize: 12.5, color: "#8b95a3" }}>Cerca il posto (villa, chiesa, casa in vendita): poi muovi l'ora e guarda sole e ombre sulla mappa.</div>}
    </div>
  );
}

// --- contratto per le riprese ---------------------------------------------------------------------------
const USI = [["social", "Social del cliente"], ["sito", "Sito del cliente"], ["pubblicita", "Pubblicità (stampa, cartelloni, annunci)"], ["vendita", "Vendita o cessione a terzi"]];
const CONTRATTO_VUOTO = { cliente: "", contatto: "", lavoro: "Riprese con drone", data: "", luogo: "", consegna: "Video montato di 3–5 minuti e 30 foto ritoccate", giorni: "30", prezzo: "", acconto: "", usi: { social: true, sito: true }, portfolio: true, giorniAnnullo: "15", note: "", firmaCliente: "", firmaPilota: "", firmatoIl: "" };

function testoClausole(c, azienda) {
  const usi = USI.filter(([k]) => c.usi?.[k]).map(([, t]) => t.toLowerCase());
  return [
    ["Cosa si fa", `${c.lavoro}${c.data ? ` il ${c.data.split("-").reverse().join("/")}` : ""}${c.luogo ? ` a ${c.luogo}` : ""}.`],
    ["Cosa si consegna", `${c.consegna}. Consegna entro ${c.giorni || "30"} giorni dalle riprese, con un link per scaricare i file.`],
    ["Prezzo", `${c.prezzo ? `${c.prezzo} €` : "Come da preventivo"}${c.acconto ? `, acconto di ${c.acconto} € alla firma` : ""}; il saldo alla consegna.`],
    ["Uso delle immagini", `Il cliente può usare foto e video per: ${usi.length ? usi.join(", ") : "uso personale"}. ${c.portfolio ? `${azienda.nome || "Il pilota"} può mostrare alcune immagini nel suo portfolio e sui suoi social, senza dati personali.` : "Il pilota non pubblica le immagini senza il permesso del cliente."}`],
    ["Sicurezza, zone e permessi", "Il volo si fa solo dove le regole lo permettono e con i permessi necessari. Il pilota decide se e come volare per la sicurezza delle persone: se serve, cambia posizione o rinuncia a una ripresa."],
    ["Maltempo o divieti", "Se per meteo (vento, pioggia, nebbia) o per divieti delle autorità il volo non si può fare, si sceglie insieme un'altra data senza costi in più. Se non si trova una data, l'acconto si restituisce."],
    ["Se il cliente annulla", `Fino a ${c.giorniAnnullo || "15"} giorni prima l'acconto si restituisce; dopo, l'acconto resta al pilota per il tempo riservato.`],
    ["Persone riprese", "Se nelle riprese si riconoscono persone, il cliente avvisa gli invitati o raccoglie le liberatorie, anche con l'app del pilota."],
    ...(c.note ? [["Altri accordi", c.note]] : []),
  ];
}

function Contratto({ supabase, azienda }) {
  const docs = useDocumenti(supabase, "contratto");
  const [c, setC] = useState(CONTRATTO_VUOTO);
  const [id, setId] = useState(null);
  const [msg, setMsg] = useState("");
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const firmato = c.firmaCliente && c.firmaPilota;
  const salva = async (extra = {}) => {
    const dati = { ...c, ...extra };
    try { const r = await docs.salva({ id, titolo: `${dati.cliente || "Cliente"} · ${dati.lavoro}`, dati, stato: dati.firmatoIl ? "firmato" : "bozza" }); setId(r.id); setC(dati); setMsg("✅ Salvato"); } catch (e) { setMsg("Non salvato: " + (e.message || e)); }
  };
  const pdf = async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFontSize(16); doc.text("Accordo per riprese con drone", 15, 18);
    doc.setFontSize(10); doc.setTextColor(90);
    doc.text(`Pilota: ${azienda.nome || ""}${azienda.piva ? ` · P. IVA ${azienda.piva}` : ""}`, 15, 26);
    doc.text(`Cliente: ${c.cliente || ""}${c.contatto ? ` · ${c.contatto}` : ""}`, 15, 31);
    let y = 41;
    testoClausole(c, azienda).forEach(([t, x]) => {
      const righe = doc.splitTextToSize(x, 180);
      if (y + 6 + righe.length * 4.6 > 240) { doc.addPage(); y = 20; }
      doc.setTextColor(20); doc.setFontSize(11.5); doc.text(t, 15, y); y += 5.5;
      doc.setTextColor(60); doc.setFontSize(10); doc.text(righe, 15, y); y += righe.length * 4.6 + 4;
    });
    if (y > 235) { doc.addPage(); y = 20; }
    y += 4; doc.setTextColor(20); doc.setFontSize(10);
    doc.text("Firma del cliente", 15, y); doc.text("Firma del pilota", 110, y);
    if (c.firmaCliente) doc.addImage(c.firmaCliente, "PNG", 15, y + 2, 80, 28);
    if (c.firmaPilota) doc.addImage(c.firmaPilota, "PNG", 110, y + 2, 80, 28);
    if (c.firmatoIl) { doc.setFontSize(9); doc.setTextColor(110); doc.text(`Firmato il ${new Date(c.firmatoIl).toLocaleString("it-IT")}`, 15, y + 36); }
    doc.setFontSize(8); doc.setTextColor(130); doc.text("Modello di accordo preparato con EyeDrones: per casi particolari fallo controllare da un consulente.", 15, 288);
    await condividiPdf(doc, `Contratto-${(c.cliente || "cliente").replace(/[^\w-]+/g, "-")}.pdf`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-contratto>
      {docs.manca && <AvvisoSql />}
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={griglia}>
          <Etichetta t="Cliente"><input value={c.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Nome e cognome o azienda" style={campo} aria-label="Cliente" /></Etichetta>
          <Etichetta t="Telefono o email del cliente"><input value={c.contatto} onChange={(e) => set("contatto", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Lavoro"><input value={c.lavoro} onChange={(e) => set("lavoro", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Data"><input type="date" value={c.data} onChange={(e) => set("data", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Luogo"><input value={c.luogo} onChange={(e) => set("luogo", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Consegna entro (giorni)"><input inputMode="numeric" value={c.giorni} onChange={(e) => set("giorni", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Prezzo (€)"><input inputMode="decimal" value={c.prezzo} onChange={(e) => set("prezzo", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Acconto (€)"><input inputMode="decimal" value={c.acconto} onChange={(e) => set("acconto", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Annullo senza perdere l'acconto fino a (giorni prima)"><input inputMode="numeric" value={c.giorniAnnullo} onChange={(e) => set("giorniAnnullo", e.target.value)} style={campo} /></Etichetta>
          <Etichetta t="Cosa consegni" largo><input value={c.consegna} onChange={(e) => set("consegna", e.target.value)} style={campo} /></Etichetta>
        </div>
        <div style={{ fontSize: 12, color: "#8b95a3" }}>Il cliente può usare le immagini per:</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {USI.map(([k, t]) => <label key={k} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={!!c.usi[k]} onChange={(e) => set("usi", { ...c.usi, [k]: e.target.checked })} />{t}</label>)}
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}><input type="checkbox" checked={c.portfolio} onChange={(e) => set("portfolio", e.target.checked)} />Posso mostrare alcune immagini nel mio portfolio</label>
        <Etichetta t="Altri accordi (facoltativo)"><textarea rows={2} value={c.note} onChange={(e) => set("note", e.target.value)} style={{ ...campo, fontFamily: "inherit" }} /></Etichetta>
      </div>
      <div style={{ ...scheda, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.5 }}>
        <div style={{ fontWeight: 700, color: "#e7eaee", marginBottom: 6 }}>Cosa c'è scritto</div>
        {testoClausole(c, azienda).map(([t, x]) => <p key={t} style={{ margin: "0 0 6px 0" }}><b style={{ color: "#e7eaee" }}>{t}.</b> {x}</p>)}
        <div style={{ fontSize: 11.5, color: "#8b95a3" }}>È un modello di accordo semplice: per casi particolari fallo controllare da un consulente.</div>
      </div>
      <div style={{ ...scheda, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <Firma key={`c${id}`} valore={c.firmaCliente} onCambia={(v) => set("firmaCliente", v)} etichetta="Firma del cliente (col dito o col mouse)" />
        <Firma key={`p${id}`} valore={c.firmaPilota} onCambia={(v) => set("firmaPilota", v)} etichetta="La tua firma" />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => salva(firmato && !c.firmatoIl ? { firmatoIl: new Date().toISOString() } : {})} style={btn(true)} data-salva-contratto>{firmato && !c.firmatoIl ? "✍️ Firmato: salva" : "💾 Salva"}</button>
        <button type="button" onClick={pdf} style={btn(false)}>📄 PDF da mandare al cliente</button>
        <button type="button" onClick={() => { setC(CONTRATTO_VUOTO); setId(null); setMsg(""); }} style={btn(false)}>Nuovo contratto</button>
        {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✅") ? "#4ade80" : "#ffb877" }}>{msg}</span>}
      </div>
      {docs.lista && docs.lista.length > 0 && (
        <div style={scheda}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Contratti</div>
          {docs.lista.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #232b3f", fontSize: 13 }}>
              <button type="button" onClick={() => { setC({ ...CONTRATTO_VUOTO, ...d.dati }); setId(d.id); setMsg(""); }} style={{ background: "none", border: "none", color: "#9cc3ff", textAlign: "left", flex: 1 }}>{d.titolo}</button>
              <span style={{ fontSize: 11.5, color: d.stato === "firmato" ? "#4ade80" : "#8b95a3" }}>{d.stato === "firmato" ? "✍️ firmato" : "bozza"}</span>
              <button type="button" onClick={() => docs.togli(d.id)} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Elimina">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- inquadrature scelte dal cliente --------------------------------------------------------------------
export const CATALOGO_SCENE = {
  matrimonio: { nome: "💍 Matrimonio", scene: [["⛪", "La chiesa o il municipio dall'alto"], ["🚗", "Arrivo della sposa in auto"], ["🎉", "Uscita e lancio del riso"], ["👥", "Foto di gruppo con tutti gli invitati"], ["🏰", "La location vista dall'alto"], ["🌅", "Sposi all'ora d'oro"], ["🔄", "Giro intorno agli sposi"], ["🎆", "Fuochi o luci della sera"]] },
  immobile: { nome: "🏡 Casa o immobile", scene: [["🏠", "Facciata principale"], ["🌳", "Giardino e confini"], ["🛰️", "Vista dall'alto con il terreno"], ["🗺️", "La zona intorno: servizi, strade, panorama"], ["🌇", "Al tramonto con le luci accese"], ["🚪", "Entrata e percorso fino alla porta"]] },
  azienda: { nome: "🏭 Azienda", scene: [["🏢", "Sede vista dall'alto"], ["🚚", "Mezzi e magazzino al lavoro"], ["👷", "Persone al lavoro"], ["📐", "Cantiere o impianto"], ["🎞️", "Apertura con il logo"], ["🔁", "Passaggio lungo la linea di produzione (FPV)"]] },
  evento: { nome: "🎪 Evento", scene: [["👥", "La folla dall'alto"], ["🎤", "Palco e pubblico"], ["🚩", "Partenza o arrivo (gare)"], ["🌆", "Panorama del luogo"], ["⚡", "Momenti veloci in FPV"]] },
};

function Inquadrature({ supabase, azienda }) {
  const docs = useDocumenti(supabase, "inquadrature");
  const [tipo, setTipo] = useState("matrimonio");
  const [titolo, setTitolo] = useState("");
  const [messaggio, setMessaggio] = useState("Ciao! Scegli le riprese che ti piacciono di più: così so cosa preparare.");
  const [scelte, setScelte] = useState(() => CATALOGO_SCENE.matrimonio.scene.map((x) => x[1]));
  const [extra, setExtra] = useState("");
  const [creato, setCreato] = useState(null);
  const [errore, setErrore] = useState("");
  const [piani, setPiani] = useState(null);
  const [aperto, setAperto] = useState(null);
  const [esito, setEsito] = useState("");
  const proposta = useMemo(() => [...CATALOGO_SCENE[tipo].scene.filter((x) => scelte.includes(x[1])), ...extra.split("\n").map((t) => t.trim()).filter(Boolean).map((t) => ["🎬", t])], [tipo, scelte, extra]);
  const link = (d) => `${window.location.origin}/?scelte=${d.token}`;
  const crea = async () => {
    if (!proposta.length) { setErrore("Scegli almeno una scena."); return; }
    setErrore("");
    try {
      const r = await docs.salva({ titolo: titolo || CATALOGO_SCENE[tipo].nome.replace(/^\S+\s/, ""), stato: "inviato", dati: { tipo, messaggio, pilota: azienda.nome || "", scene: proposta.map(([e, t], i) => ({ id: `s${i}`, emoji: e, titolo: t })) } });
      setCreato(r);
    } catch (e) { setErrore("Non riesco a creare il link: " + (e.message || e)); }
  };
  const copia = async (t) => { try { await navigator.clipboard.writeText(t); setEsito("Link copiato"); } catch { setEsito(t); } };
  const caricaPiani = async () => {
    const { data } = await supabase.from("piani_volo").select("id, impianto_nome, data_prevista, checklist_stato").order("data_prevista", { ascending: true }).limit(100);
    setPiani((data || []).filter((p) => !p.checklist_stato?.fatto));
  };
  const nellaScaletta = async (d, pianoId) => {
    const p = piani.find((x) => String(x.id) === String(pianoId)); if (!p) return;
    const scelteCliente = d.risposta?.scelte || [];
    const nuove = (d.dati.scene || []).filter((s) => scelteCliente.includes(s.id)).map((s) => ({ ...scenaVuota(d.dati.tipo === "azienda" ? "video" : "video"), titolo: s.titolo, note: "Scelta dal cliente" }));
    if (d.risposta?.note) nuove.push({ ...scenaVuota("video"), titolo: "Richiesta del cliente", note: d.risposta.note });
    const cs = p.checklist_stato || {};
    const { error } = await supabase.from("piani_volo").update({ checklist_stato: { ...cs, scene: [...(cs.scene || []), ...nuove] } }).eq("id", p.id);
    setEsito(error ? "Non riesco a metterle nel piano: " + error.message : `✅ ${nuove.length} scene aggiunte alla scaletta di «${p.impianto_nome || "piano"}»`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-inquadrature>
      {docs.manca && <AvvisoSql />}
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#c3cad4" }}>Mandi un link al cliente: vede le scene proposte, spunta quelle che vuole e scrive le sue idee. Poi le metti nella scaletta del piano con un tocco.</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(CATALOGO_SCENE).map(([k, v]) => <button key={k} type="button" aria-pressed={tipo === k} onClick={() => { setTipo(k); setScelte(v.scene.map((x) => x[1])); }} style={{ ...btn(false), borderColor: tipo === k ? "#ff8c42" : "#343e57" }}>{v.nome}</button>)}
        </div>
        <div style={griglia}>
          <Etichetta t="Nome del lavoro"><input value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="es. Matrimonio Rossi" style={campo} aria-label="Nome del lavoro" /></Etichetta>
          <Etichetta t="Messaggio per il cliente" largo><input value={messaggio} onChange={(e) => setMessaggio(e.target.value)} style={campo} /></Etichetta>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 6 }}>
          {CATALOGO_SCENE[tipo].scene.map(([e, t]) => <label key={t} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, background: "#10141f", border: "1px solid #232b3f", borderRadius: 8, padding: "7px 9px" }}><input type="checkbox" checked={scelte.includes(t)} onChange={(ev) => setScelte(ev.target.checked ? [...scelte, t] : scelte.filter((x) => x !== t))} />{e} {t}</label>)}
        </div>
        <Etichetta t="Altre scene (una per riga)"><textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} style={{ ...campo, fontFamily: "inherit" }} /></Etichetta>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={crea} style={btn(true)} data-crea-link>🔗 Crea il link per il cliente</button>
          {errore && <span style={{ fontSize: 12.5, color: "#ffb877" }}>{errore}</span>}
        </div>
        {creato && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5 }} data-link-creato>
            <code style={{ background: "#10141f", padding: "5px 8px", borderRadius: 6, wordBreak: "break-all", flex: "1 1 240px" }}>{link(creato)}</code>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${messaggio} ${link(creato)}`)}`} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: "none" }}>WhatsApp</a>
            <button type="button" onClick={() => copia(link(creato))} style={btn(false)}>Copia</button>
          </div>
        )}
        {esito && <div style={{ fontSize: 12.5, color: esito.startsWith("Non") ? "#ffb877" : "#4ade80" }}>{esito}</div>}
      </div>
      {docs.lista && docs.lista.length > 0 && (
        <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Proposte mandate</div>
          {docs.lista.map((d) => (
            <div key={d.id} style={{ borderBottom: "1px solid #232b3f", paddingBottom: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
                <button type="button" onClick={() => { setAperto(aperto === d.id ? null : d.id); if (!piani) caricaPiani(); }} style={{ background: "none", border: "none", color: "#9cc3ff", textAlign: "left", flex: 1 }}>{d.titolo}</button>
                <span style={{ fontSize: 11.5, color: d.stato === "risposto" ? "#4ade80" : "#8b95a3" }}>{d.stato === "risposto" ? `✅ ha scelto ${d.risposta?.scelte?.length || 0} scene` : "in attesa"}</span>
                <button type="button" onClick={() => copia(link(d))} style={{ ...btn(false), padding: "4px 8px" }}>Link</button>
                <button type="button" onClick={() => docs.togli(d.id)} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Elimina">✕</button>
              </div>
              {aperto === d.id && (
                <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {(d.dati.scene || []).map((s) => <div key={s.id}>{d.risposta?.scelte?.includes(s.id) ? "✅" : "▫️"} {s.emoji} {s.titolo}</div>)}
                  {d.risposta?.note && <div>💬 «{d.risposta.note}»</div>}
                  {d.stato === "risposto" && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
                      <select defaultValue="" onChange={(e) => e.target.value && nellaScaletta(d, e.target.value)} style={{ ...campo, width: "auto", maxWidth: "100%" }} aria-label="Piano">
                        <option value="">Metti nella scaletta di un piano…</option>
                        {(piani || []).map((p) => <option key={p.id} value={p.id}>{p.impianto_nome || "Piano"} · {p.data_prevista || ""}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// pagina pubblica: il cliente apre il link (app.eyedrones.it/?scelte=…) e sceglie, senza account
export function SceltaInquadrature({ supabase, token }) {
  const [d, setD] = useState(undefined);
  const [scelte, setScelte] = useState([]);
  const [note, setNote] = useState("");
  const [stato, setStato] = useState("");
  useEffect(() => {
    supabase.rpc("inquadrature_leggi", { p_token: token }).then(({ data }) => {
      setD(data || null);
      if (data?.risposta) { setScelte(data.risposta.scelte || []); setNote(data.risposta.note || ""); }
    }, () => setD(null));
  }, [supabase, token]);
  const manda = async () => {
    setStato("invio");
    const { data, error } = await supabase.rpc("inquadrature_rispondi", { p_token: token, p_risposta: { scelte, note: note.slice(0, 1500) } });
    setStato(error || !data ? "errore" : "fatto");
  };
  const pagina = { minHeight: "100vh", background: "#0b0f19", color: "#e7eaee", padding: "28px max(16px, env(safe-area-inset-left, 0px))", fontFamily: "Inter, system-ui, sans-serif" };
  if (d === undefined) return <div style={pagina}>Carico…</div>;
  if (!d) return <div style={pagina}><div style={{ maxWidth: 560, margin: "0 auto" }}><h1 style={{ fontSize: 22 }}>Link non valido</h1><p style={{ color: "#8b95a3" }}>Questo link non è più attivo: chiedi al pilota di mandartene uno nuovo.</p></div></div>;
  return (
    <div style={pagina} data-scelta-cliente>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", color: "#ffb877" }}>🎬 RIPRESE CON DRONE{d.dati?.pilota ? ` · ${d.dati.pilota.toUpperCase()}` : ""}</div>
        <h1 style={{ fontSize: 26, margin: 0 }}>{d.titolo}</h1>
        {d.dati?.messaggio && <p style={{ color: "#c3cad4", margin: 0 }}>{d.dati.messaggio}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(d.dati?.scene || []).map((s) => {
            const si = scelte.includes(s.id);
            return <button key={s.id} type="button" aria-pressed={si} onClick={() => setScelte(si ? scelte.filter((x) => x !== s.id) : [...scelte, s.id])} style={{ display: "flex", gap: 12, alignItems: "center", textAlign: "left", background: si ? "#241d16" : "#151b2b", border: `1px solid ${si ? "#ff8c42" : "#2a3349"}`, borderRadius: 12, padding: "12px 14px", color: "#e7eaee", fontSize: 15, minHeight: 52 }}><span style={{ fontSize: 22 }}>{s.emoji}</span><span style={{ flex: 1 }}>{s.titolo}</span><span style={{ color: si ? "#ff8c42" : "#4a505a", fontSize: 18 }}>{si ? "✓" : "○"}</span></button>;
          })}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#8b95a3" }}>Idee, momenti speciali o cose da evitare<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 8, padding: 10, fontSize: 15, fontFamily: "inherit" }} /></label>
        <button type="button" onClick={manda} disabled={stato === "invio"} style={{ ...btn(true), fontSize: 15, padding: "12px 16px", minHeight: 48 }} data-manda-scelte>{stato === "invio" ? "Mando…" : d.risposta ? "Aggiorna le mie scelte" : "Manda le mie scelte"}</button>
        {stato === "fatto" && <div style={{ color: "#4ade80" }}>✅ Fatto! Il pilota ha ricevuto le tue scelte. Puoi cambiarle quando vuoi da questo link.</div>}
        {stato === "errore" && <div style={{ color: "#ffb877" }}>Non sono riuscito a mandarle: riprova tra poco.</div>}
        <div style={{ fontSize: 11.5, color: "#6b7480" }}>Le riprese si fanno solo dove le regole di volo lo permettono: il pilota ti dirà se qualche scena non si può fare.</div>
      </div>
    </div>
  );
}

// --- timelapse e iperlapse ------------------------------------------------------------------------------
const SOGGETTI = [["Nuvole", "2–3 s"], ["Traffico e persone", "1–2 s"], ["Tramonto e luce che cambia", "3–5 s"], ["Ombre e sole che si muove", "10–20 s"], ["Cantiere (giorni)", "5–15 min (da terra)"]];
function Timelapse({ droni }) {
  const [t, setT] = useState({ durata: "10", fps: "25", intervallo: "2", autonomia: "", mb: "25" });
  const n = (k) => Number(String(t[k]).replace(",", ".")) || 0;
  const foto = Math.ceil(n("durata") * n("fps"));
  const secondi = foto * n("intervallo");
  const minRiprese = secondi / 60;
  const batterie = n("autonomia") ? Math.ceil(minRiprese / (n("autonomia") * 0.75)) : null;
  const gb = (foto * n("mb")) / 1024;
  const vel = n("intervallo") * n("fps");
  const set = (k) => (e) => setT({ ...t, [k]: e.target.value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-timelapse>
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={griglia}>
          <Etichetta t="Durata del video finale (secondi)"><input inputMode="decimal" value={t.durata} onChange={set("durata")} style={campo} aria-label="Durata finale" /></Etichetta>
          <Etichetta t="Fotogrammi al secondo"><select value={t.fps} onChange={set("fps")} style={campo}><option value="24">24</option><option value="25">25</option><option value="30">30</option><option value="50">50</option><option value="60">60</option></select></Etichetta>
          <Etichetta t="Una foto ogni (secondi)"><input inputMode="decimal" value={t.intervallo} onChange={set("intervallo")} style={campo} aria-label="Intervallo" /></Etichetta>
          <Etichetta t="Autonomia di una batteria (min)"><input inputMode="decimal" value={t.autonomia} onChange={set("autonomia")} placeholder="es. 30" style={campo} /></Etichetta>
          <Etichetta t="Peso di una foto (MB)"><input inputMode="decimal" value={t.mb} onChange={set("mb")} style={campo} /></Etichetta>
        </div>
      </div>
      <div style={{ ...scheda, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }} data-risultato-timelapse>
        {[["📸 Foto da fare", foto.toLocaleString("it-IT")], ["⏱️ Tempo di ripresa", minRiprese >= 1 ? `${Math.floor(minRiprese)} min ${Math.round(secondi % 60)} s` : `${Math.round(secondi)} s`], ["⚡ Velocità", `${Math.round(vel)}× più veloce`], ["💾 Spazio sulla scheda", `${gb.toFixed(1)} GB`], ["🔋 Batterie", batterie == null ? "scrivi l'autonomia" : `${batterie}${batterie > 1 ? " (cambio a metà)" : ""}`]].map(([a, b]) => (
          <div key={a}><div style={{ fontSize: 12, color: "#8b95a3" }}>{a}</div><div style={{ fontSize: 18, fontWeight: 800 }}>{b}</div></div>
        ))}
      </div>
      <div style={{ ...scheda, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.55 }}>
        <div style={{ fontWeight: 700, color: "#e7eaee", marginBottom: 4 }}>Ogni quanto scattare</div>
        {SOGGETTI.map(([a, b]) => <div key={a}>• {a}: una foto ogni <b>{b}</b></div>)}
        <div style={{ marginTop: 6 }}>Con il drone in volo il tempo è limitato dalla batteria: tieni il 25% di riserva. Esposizione e bilanciamento del bianco in manuale, così la luce non «sfarfalla». Nell'iperlapse muoviti piano e sempre nella stessa direzione.</div>
      </div>
    </div>
  );
}
