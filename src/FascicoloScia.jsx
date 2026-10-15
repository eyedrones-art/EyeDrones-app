import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { formattaEttari } from "./campi.js";

// Fascicolo per la SCIA della sperimentazione dei trattamenti con i droni (Legge 182/2025, art. 13-bis del
// D.lgs 150/2012): tutto quello che il contoterzista deve avere pronto — impresa, piloti con patentino e
// certificazione, drone e attrezzatura controllata, assicurazione, relazione agronomica asseverata, servizio
// fitosanitario regionale — con l'elenco di cosa manca e il PDF. I requisiti esatti li fisserà il decreto
// attuativo: qui c'è la base, da adattare quando esce. Tabella in supabase/agricoltura-scia.sql

export const FONTE_SCIA = "Legge 182/2025 (art. 13-bis del D.lgs 150/2012): sperimentazione triennale dei trattamenti con droni, con SCIA al servizio fitosanitario regionale, relazione agronomica asseverata e certificazione specifica del pilota. Il decreto attuativo, che fisserà i dettagli, alla data di questa versione non risulta ancora pubblicato.";

const REGIONI = ["Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Friuli Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche", "Molise", "Piemonte", "Provincia di Bolzano", "Provincia di Trento", "Puglia", "Sardegna", "Sicilia", "Toscana", "Umbria", "Valle d'Aosta", "Veneto"];

const VUOTO = {
  impresa: { ragione: "", piva: "", sede: "", pec: "", cciaa: "", contoterzi: true },
  piloti: [{ nome: "", attestato: "", patentino: "", patentinoScadenza: "", certificazione: "", certificazioneData: "" }],
  mezzi: [{ droneId: "", modello: "", mtom: "", serbatoio: "", ugelli: "", controllo: "", controlloScadenza: "", enac: "" }],
  assicurazione: { compagnia: "", polizza: "", massimale: "", scadenza: "" },
  relazione: { agronomo: "", albo: "", data: "", riferimento: "", campi: [] },
  scia: { regione: "", data: "", protocollo: "", note: "" },
};

const dataIt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const scaduta = (d) => !!d && new Date(`${d}T23:59:59`) < new Date();
const pieno = (v) => String(v ?? "").trim() !== "";
export const unisci = (d) => ({
  impresa: { ...VUOTO.impresa, ...(d?.impresa || {}) },
  piloti: d?.piloti?.length ? d.piloti.map((p) => ({ ...VUOTO.piloti[0], ...p })) : VUOTO.piloti,
  mezzi: d?.mezzi?.length ? d.mezzi.map((m) => ({ ...VUOTO.mezzi[0], ...m })) : VUOTO.mezzi,
  assicurazione: { ...VUOTO.assicurazione, ...(d?.assicurazione || {}) },
  relazione: { ...VUOTO.relazione, ...(d?.relazione || {}), campi: d?.relazione?.campi || [] },
  scia: { ...VUOTO.scia, ...(d?.scia || {}) },
});

// cosa serve per presentare la SCIA: ogni voce dice se c'è e, se manca, cosa fare
export function controlliScia(f, campi) {
  const p = f.piloti.filter((x) => pieno(x.nome));
  const m = f.mezzi.filter((x) => pieno(x.modello));
  const voci = [
    { gruppo: "Impresa", titolo: "Dati dell'impresa (ragione sociale, P. IVA, sede, PEC)", ok: pieno(f.impresa.ragione) && pieno(f.impresa.piva) && pieno(f.impresa.sede) && pieno(f.impresa.pec) },
    { gruppo: "Piloti", titolo: "Almeno un pilota con attestato UAS", ok: p.length > 0 && p.every((x) => pieno(x.attestato)) },
    { gruppo: "Piloti", titolo: "Patentino fitosanitario (abilitazione all'uso) valido per ogni pilota", ok: p.length > 0 && p.every((x) => pieno(x.patentino) && !scaduta(x.patentinoScadenza)), nota: p.some((x) => scaduta(x.patentinoScadenza)) ? "un patentino risulta scaduto" : "" },
    { gruppo: "Piloti", titolo: "Certificazione specifica per i trattamenti con drone", ok: p.length > 0 && p.every((x) => pieno(x.certificazione)), nota: "i contenuti del corso li fisserà il decreto attuativo" },
    { gruppo: "Mezzi", titolo: "Drone irroratore con modello, peso massimo al decollo e serbatoio", ok: m.length > 0 && m.every((x) => pieno(x.mtom) && pieno(x.serbatoio)) },
    { gruppo: "Mezzi", titolo: "Controllo funzionale / taratura dell'irroratore in corso di validità", ok: m.length > 0 && m.every((x) => pieno(x.controllo) && !scaduta(x.controlloScadenza)), nota: m.some((x) => scaduta(x.controlloScadenza)) ? "un controllo risulta scaduto" : "" },
    { gruppo: "Mezzi", titolo: "Autorizzazione / dichiarazione ENAC per l'operazione (categoria Specific)", ok: m.length > 0 && m.every((x) => pieno(x.enac)) },
    { gruppo: "Assicurazione", titolo: "Polizza RC per i trattamenti con drone, valida", ok: pieno(f.assicurazione.compagnia) && pieno(f.assicurazione.polizza) && !scaduta(f.assicurazione.scadenza), nota: scaduta(f.assicurazione.scadenza) ? "la polizza risulta scaduta" : "" },
    { gruppo: "Relazione agronomica", titolo: "Relazione agronomica asseverata (agronomo, iscrizione all'albo, data)", ok: pieno(f.relazione.agronomo) && pieno(f.relazione.albo) && pieno(f.relazione.data) },
    { gruppo: "Relazione agronomica", titolo: "Appezzamenti coperti dalla relazione", ok: (f.relazione.campi || []).length > 0, nota: (campi || []).length === 0 ? "aggiungi prima gli appezzamenti" : "" },
    { gruppo: "SCIA", titolo: "Servizio fitosanitario regionale a cui presentarla", ok: pieno(f.scia.regione) },
  ];
  return { voci, fatte: voci.filter((v) => v.ok).length };
}

function pdfFascicolo(f, campi, controlli, azienda) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 15, W = 180;
  let y = 16;
  const spazio = (h) => { if (y + h > 282) { doc.addPage(); y = 16; } };
  const titolo = (t) => { spazio(12); y += 3; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(224, 85, 47); doc.text(t, L, y); y += 2; doc.setDrawColor(224, 85, 47); doc.line(L, y, L + W, y); y += 6; doc.setTextColor(30, 30, 30); };
  const riga = (k, v) => {
    const righe = doc.splitTextToSize(String(v || "—"), W - 62);
    spazio(righe.length * 5 + 1);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90); doc.text(k, L, y);
    doc.setFont("helvetica", "normal"); doc.setTextColor(25, 25, 25); doc.text(righe, L + 62, y);
    y += righe.length * 5 + 1;
  };
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(25, 25, 25);
  doc.text("Fascicolo per la SCIA — trattamenti con drone", L, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90, 90, 90);
  doc.text(`${f.impresa.ragione || azienda?.nome || ""} · preparato il ${new Date().toLocaleDateString("it-IT")} con EyeDrones`, L, y); y += 5;
  const nota = doc.splitTextToSize(FONTE_SCIA + " Verifica sempre i requisiti con il servizio fitosanitario della tua regione.", W);
  doc.setFontSize(8.5); doc.text(nota, L, y); y += nota.length * 4 + 2;

  titolo(`Cosa c'è (${controlli.fatte} di ${controlli.voci.length})`);
  doc.setFontSize(9.5);
  for (const v of controlli.voci) {
    const t = doc.splitTextToSize(`${v.ok ? "[OK]" : "[MANCA]"}  ${v.titolo}${v.nota && !v.ok ? ` — ${v.nota}` : ""}`, W);
    spazio(t.length * 5);
    doc.setTextColor(v.ok ? 30 : 190, v.ok ? 130 : 60, v.ok ? 60 : 40); doc.text(t, L, y); y += t.length * 5;
  }
  doc.setTextColor(25, 25, 25);

  titolo("Impresa");
  riga("Ragione sociale", f.impresa.ragione); riga("P. IVA / C.F.", f.impresa.piva); riga("Sede", f.impresa.sede); riga("PEC", f.impresa.pec);
  riga("Iscrizione CCIAA", f.impresa.cciaa); riga("Attività", f.impresa.contoterzi ? "Contoterzista (lavori per altre aziende agricole)" : "Lavori sui propri terreni");

  titolo("Piloti");
  f.piloti.filter((p) => pieno(p.nome)).forEach((p, i) => {
    riga(`Pilota ${i + 1}`, p.nome); riga("Attestato UAS", p.attestato);
    riga("Patentino fitosanitario", `${p.patentino || "—"}${p.patentinoScadenza ? ` · scade il ${dataIt(p.patentinoScadenza)}` : ""}`);
    riga("Certificazione drone", `${p.certificazione || "—"}${p.certificazioneData ? ` · del ${dataIt(p.certificazioneData)}` : ""}`);
  });

  titolo("Droni e attrezzatura");
  f.mezzi.filter((m) => pieno(m.modello)).forEach((m, i) => {
    riga(`Drone ${i + 1}`, m.modello); riga("Peso massimo al decollo", m.mtom ? `${m.mtom} kg` : ""); riga("Serbatoio", m.serbatoio ? `${m.serbatoio} litri` : "");
    riga("Ugelli / sistema", m.ugelli); riga("Controllo funzionale", `${m.controllo || "—"}${m.controlloScadenza ? ` · valido fino al ${dataIt(m.controlloScadenza)}` : ""}`);
    riga("ENAC", m.enac);
  });

  titolo("Assicurazione");
  riga("Compagnia", f.assicurazione.compagnia); riga("Polizza", f.assicurazione.polizza); riga("Massimale", f.assicurazione.massimale); riga("Scadenza", dataIt(f.assicurazione.scadenza));

  titolo("Relazione agronomica asseverata");
  riga("Agronomo", f.relazione.agronomo); riga("Iscrizione all'albo", f.relazione.albo); riga("Data", dataIt(f.relazione.data)); riga("Riferimento", f.relazione.riferimento);
  const coperti = (campi || []).filter((c) => (f.relazione.campi || []).includes(c.id));
  if (coperti.length) {
    spazio(8); doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); doc.text("Appezzamenti", L, y); y += 5; doc.setFont("helvetica", "normal");
    let tot = 0;
    for (const c of coperti) { tot += Number(c.ettari) || 0; riga(`• ${c.nome}`, [c.azienda, c.coltura, c.ettari ? `${formattaEttari(c.ettari)}` : ""].filter(Boolean).join(" · ")); }
    riga("Superficie totale", formattaEttari(tot));
  }

  titolo("SCIA");
  riga("Servizio fitosanitario", f.scia.regione ? `Regione ${f.scia.regione}` : ""); riga("Data di presentazione", dataIt(f.scia.data)); riga("Protocollo", f.scia.protocollo); riga("Note", f.scia.note);

  const pagine = doc.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(140, 140, 140); doc.text(`EyeDrones · Fascicolo SCIA · pagina ${i} di ${pagine}`, L, 292); }
  doc.save(`fascicolo-scia-${(f.impresa.ragione || "eyedrones").replace(/[^\w-]+/g, "-").toLowerCase()}.pdf`);
}

export default function FascicoloScia({ supabase, inputStyle, campi = [], droni = [], azienda = {} }) {
  const [f, setF] = useState(null);
  const [stato, setStato] = useState("");
  const [manca, setManca] = useState(false);
  useEffect(() => {
    let annullato = false;
    supabase.from("agri_fascicolo").select("dati").maybeSingle().then(({ data, error }) => {
      if (annullato) return;
      if (error && /agri_fascicolo|does not exist|schema cache/i.test(error.message)) setManca(true);
      const base = unisci(data && data.dati);
      if (!base.impresa.ragione && azienda?.nome) base.impresa.ragione = azienda.nome;
      setF(base);
    });
    return () => { annullato = true; };
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps
  const controlli = useMemo(() => (f ? controlliScia(f, campi) : null), [f, campi]);
  if (!f) return <p style={{ color: "#8b95a3" }}>Carico…</p>;

  const cambia = (sez, k, v) => { setF((x) => ({ ...x, [sez]: { ...x[sez], [k]: v } })); setStato(""); };
  const cambiaLista = (sez, i, k, v) => { setF((x) => ({ ...x, [sez]: x[sez].map((r, j) => (j === i ? { ...r, [k]: v } : r)) })); setStato(""); };
  const aggiungi = (sez) => setF((x) => ({ ...x, [sez]: [...x[sez], { ...VUOTO[sez][0] }] }));
  const togli = (sez, i) => setF((x) => ({ ...x, [sez]: x[sez].length > 1 ? x[sez].filter((_, j) => j !== i) : [{ ...VUOTO[sez][0] }] }));
  const salva = async () => {
    setStato("salvo");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("agri_fascicolo").upsert({ user_id: u?.user?.id, dati: f, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setStato(error ? `Non salvato: ${error.message}` : "Salvato ✓");
  };

  const scheda = { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 12, padding: 16, marginTop: 14 };
  const et = { fontSize: 11, color: "#8b95a3", display: "block", marginBottom: 4 };
  const griglia = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 };
  const campo = (label, valore, onChange, extra = {}) => (
    <label style={{ display: "block" }}><span style={et}>{label}</span>
      <input value={valore || ""} onChange={(e) => onChange(e.target.value)} style={inputStyle} {...extra} /></label>
  );
  const h = (t, sotto) => <><div style={{ fontSize: 15, fontWeight: 700 }}>{t}</div>{sotto && <div style={{ fontSize: 12, color: "#8b95a3", margin: "2px 0 10px 0" }}>{sotto}</div>}</>;
  const piccolo = { background: "#1f2530", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "6px 10px", fontSize: 12 };
  const tutto = controlli.fatte === controlli.voci.length;

  return (
    <div>
      {manca && (
        <div style={{ ...scheda, marginTop: 0, border: "1px solid #f5b94266", background: "#211a0c", fontSize: 13, color: "#ffe2a8" }}>
          ⚙️ Per salvare il fascicolo serve una cosa da fare <strong>una volta sola</strong>: in Supabase apri <strong>SQL Editor</strong>, incolla lo script <strong>supabase/agricoltura-scia.sql</strong> e premi <strong>Run</strong>.
        </div>
      )}
      <div style={{ ...scheda, marginTop: manca ? 14 : 0, border: `1px solid ${tutto ? "#4ade8066" : "#ff8c4266"}` }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: tutto ? "#4ade80" : "#ffb877" }}>{tutto ? "✅ Pronto per la SCIA" : `📁 Fascicolo SCIA · ${controlli.fatte} di ${controlli.voci.length}`}</div>
        <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 4, lineHeight: 1.5 }}>
          Per i trattamenti con il drone serve una <strong>SCIA</strong> al servizio fitosanitario della tua regione. Qui prepari tutto quello che serve e lo stampi in un PDF da consegnare o da allegare.
        </div>
        <div style={{ height: 6, background: "#262b33", borderRadius: 3, margin: "10px 0", overflow: "hidden" }}><div style={{ width: `${Math.round((controlli.fatte / controlli.voci.length) * 100)}%`, height: "100%", background: tutto ? "#4ade80" : "#ff8c42" }} /></div>
        {controlli.voci.map((v) => (
          <div key={v.titolo} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "3px 0", color: v.ok ? "#8b95a3" : "#e7eaee" }}>
            <span>{v.ok ? "✅" : "⬜"}</span><span>{v.titolo}{!v.ok && v.nota ? <span style={{ color: "#ffb877" }}> · {v.nota}</span> : null}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#6b7480", marginTop: 8, lineHeight: 1.45 }}>{FONTE_SCIA} Verifica sempre i requisiti con il servizio fitosanitario della tua regione.</div>
      </div>

      <div style={scheda}>
        {h("🏢 Impresa", "Chi presenta la SCIA.")}
        <div style={griglia}>
          {campo("Ragione sociale", f.impresa.ragione, (v) => cambia("impresa", "ragione", v))}
          {campo("P. IVA / codice fiscale", f.impresa.piva, (v) => cambia("impresa", "piva", v))}
          {campo("Sede", f.impresa.sede, (v) => cambia("impresa", "sede", v))}
          {campo("PEC", f.impresa.pec, (v) => cambia("impresa", "pec", v), { type: "email" })}
          {campo("Iscrizione CCIAA (REA)", f.impresa.cciaa, (v) => cambia("impresa", "cciaa", v))}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 10 }}>
          <input type="checkbox" checked={!!f.impresa.contoterzi} onChange={(e) => cambia("impresa", "contoterzi", e.target.checked)} /> Lavoro come contoterzista (per altre aziende agricole)
        </label>
      </div>

      <div style={scheda}>
        {h("👨‍✈️ Piloti", "Per ognuno: attestato del drone, patentino per i prodotti fitosanitari e la certificazione per i trattamenti con drone.")}
        {f.piloti.map((p, i) => (
          <div key={i} style={{ borderTop: i ? "1px solid #262b33" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
            <div style={griglia}>
              {campo("Nome e cognome", p.nome, (v) => cambiaLista("piloti", i, "nome", v))}
              {campo("Attestato UAS (es. STS, Specific)", p.attestato, (v) => cambiaLista("piloti", i, "attestato", v))}
              {campo("N. patentino fitosanitario", p.patentino, (v) => cambiaLista("piloti", i, "patentino", v))}
              {campo("Patentino: scadenza", p.patentinoScadenza, (v) => cambiaLista("piloti", i, "patentinoScadenza", v), { type: "date" })}
              {campo("Certificazione trattamenti con drone", p.certificazione, (v) => cambiaLista("piloti", i, "certificazione", v), { placeholder: "ente, n. attestato" })}
              {campo("Certificazione: data", p.certificazioneData, (v) => cambiaLista("piloti", i, "certificazioneData", v), { type: "date" })}
            </div>
            {f.piloti.length > 1 && <button type="button" onClick={() => togli("piloti", i)} style={{ ...piccolo, marginTop: 8 }}>Togli pilota</button>}
          </div>
        ))}
        <button type="button" onClick={() => aggiungi("piloti")} style={{ ...piccolo, marginTop: 10 }}>+ Aggiungi pilota</button>
      </div>

      <div style={scheda}>
        {h("🚁 Droni e attrezzatura", "Il drone irroratore e il controllo dell'attrezzatura per la distribuzione.")}
        {f.mezzi.map((m, i) => (
          <div key={i} style={{ borderTop: i ? "1px solid #262b33" : "none", paddingTop: i ? 12 : 0, marginTop: i ? 12 : 0 }}>
            <div style={griglia}>
              {droni.length > 0 && (
                <label style={{ display: "block" }}><span style={et}>Dai tuoi droni</span>
                  <select value={m.droneId || ""} onChange={(e) => { const d = droni.find((x) => x.id === e.target.value); cambiaLista("mezzi", i, "droneId", e.target.value); if (d) cambiaLista("mezzi", i, "modello", d.modello || d.nome || ""); }} style={inputStyle}>
                    <option value="">— scegli —</option>
                    {droni.map((d) => <option key={d.id} value={d.id}>{d.nome || d.modello}</option>)}
                  </select></label>
              )}
              {campo("Modello", m.modello, (v) => cambiaLista("mezzi", i, "modello", v), { placeholder: "es. DJI Agras T50" })}
              {campo("Peso massimo al decollo (kg)", m.mtom, (v) => cambiaLista("mezzi", i, "mtom", v), { inputMode: "decimal" })}
              {campo("Serbatoio (litri)", m.serbatoio, (v) => cambiaLista("mezzi", i, "serbatoio", v), { inputMode: "decimal" })}
              {campo("Ugelli / sistema di distribuzione", m.ugelli, (v) => cambiaLista("mezzi", i, "ugelli", v), { placeholder: "es. centrifughi, antideriva" })}
              {campo("Controllo funzionale / taratura", m.controllo, (v) => cambiaLista("mezzi", i, "controllo", v), { placeholder: "centro prova, n. attestato" })}
              {campo("Controllo: valido fino al", m.controlloScadenza, (v) => cambiaLista("mezzi", i, "controlloScadenza", v), { type: "date" })}
              {campo("Autorizzazione / dichiarazione ENAC", m.enac, (v) => cambiaLista("mezzi", i, "enac", v), { placeholder: "n. e data" })}
            </div>
            {f.mezzi.length > 1 && <button type="button" onClick={() => togli("mezzi", i)} style={{ ...piccolo, marginTop: 8 }}>Togli drone</button>}
          </div>
        ))}
        <button type="button" onClick={() => aggiungi("mezzi")} style={{ ...piccolo, marginTop: 10 }}>+ Aggiungi drone</button>
      </div>

      <div style={scheda}>
        {h("🛡️ Assicurazione", "La polizza RC che copre i trattamenti con il drone.")}
        <div style={griglia}>
          {campo("Compagnia", f.assicurazione.compagnia, (v) => cambia("assicurazione", "compagnia", v))}
          {campo("N. polizza", f.assicurazione.polizza, (v) => cambia("assicurazione", "polizza", v))}
          {campo("Massimale", f.assicurazione.massimale, (v) => cambia("assicurazione", "massimale", v), { placeholder: "es. 1.000.000 €" })}
          {campo("Scadenza", f.assicurazione.scadenza, (v) => cambia("assicurazione", "scadenza", v), { type: "date" })}
        </div>
      </div>

      <div style={scheda}>
        {h("📝 Relazione agronomica asseverata", "La firma un agronomo iscritto all'albo. Scegli gli appezzamenti che copre.")}
        <div style={griglia}>
          {campo("Agronomo", f.relazione.agronomo, (v) => cambia("relazione", "agronomo", v))}
          {campo("Iscrizione all'albo (n. e provincia)", f.relazione.albo, (v) => cambia("relazione", "albo", v))}
          {campo("Data della relazione", f.relazione.data, (v) => cambia("relazione", "data", v), { type: "date" })}
          {campo("Riferimento / protocollo", f.relazione.riferimento, (v) => cambia("relazione", "riferimento", v))}
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={et}>Appezzamenti coperti {campi.length ? `(${(f.relazione.campi || []).length} di ${campi.length})` : ""}</span>
          {campi.length === 0 ? <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Aggiungi prima gli appezzamenti nella scheda «🗺️ Appezzamenti».</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
              {campi.map((c) => {
                const dentro = (f.relazione.campi || []).includes(c.id);
                return (
                  <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={dentro} onChange={() => cambia("relazione", "campi", dentro ? f.relazione.campi.filter((x) => x !== c.id) : [...(f.relazione.campi || []), c.id])} />
                    {c.nome}<span style={{ color: "#8b95a3", fontSize: 12 }}>{[c.azienda, c.coltura, c.ettari ? formattaEttari(c.ettari) : ""].filter(Boolean).join(" · ")}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={scheda}>
        {h("🏛️ SCIA", "A quale servizio fitosanitario la presenti e, quando l'hai fatto, data e protocollo.")}
        <div style={griglia}>
          <label style={{ display: "block" }}><span style={et}>Regione</span>
            <select value={f.scia.regione} onChange={(e) => cambia("scia", "regione", e.target.value)} style={inputStyle}>
              <option value="">— scegli —</option>{REGIONI.map((r) => <option key={r} value={r}>{r}</option>)}
            </select></label>
          {campo("Data di presentazione", f.scia.data, (v) => cambia("scia", "data", v), { type: "date" })}
          {campo("Protocollo", f.scia.protocollo, (v) => cambia("scia", "protocollo", v))}
          {campo("Note", f.scia.note, (v) => cambia("scia", "note", v))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
        <button type="button" onClick={salva} disabled={stato === "salvo"} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 800 }}>{stato === "salvo" ? "Salvo…" : "💾 Salva il fascicolo"}</button>
        <button type="button" onClick={() => pdfFascicolo(f, campi, controlli, azienda)} style={{ background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 8, padding: "10px 16px", fontSize: 13.5, fontWeight: 700 }}>📄 PDF del fascicolo</button>
        {stato && stato !== "salvo" && <span style={{ fontSize: 12.5, color: stato.startsWith("Salvato") ? "#4ade80" : "#ff9c9c" }}>{stato}</span>}
      </div>
    </div>
  );
}
