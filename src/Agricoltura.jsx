import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import MappaCampi from "./MappaCampi.jsx";
import { pdfConsegnaAgricoltura } from "./reportConsegna.js";
import FascicoloScia, { controlliScia, unisci } from "./FascicoloScia.jsx";
import { leggiFileConfini, ettariDi, formattaEttari, meteoCampo, valutaOraTrattamento, deltaT, leggiSoglie, salvaSoglie, SOGLIE_BASE, daDove, TIPI_LAVORO, etichettaLavoro } from "./campi.js";

// Agricoltura (fase 1): appezzamenti con i confini sulla mappa, registro dei trattamenti con PDF,
// meteo per irrorare con soglie e Delta T. Tabelle in supabase/agricoltura.sql

const oggi = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const dataIt = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return v === "" || v == null || Number.isNaN(n) ? null : n; };
const testo = (v) => (String(v ?? "").trim() ? String(v).trim() : null);
const manca = (msg) => /appezzamenti|trattamenti|does not exist|schema cache|column/i.test(String(msg || ""));
const UNITA = ["l/ha", "kg/ha", "ml/ha", "g/ha"];

const scheda = { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 12, padding: 16 };
const etichetta = { fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 };
const btn = (primario) => ({ background: primario ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1f2530", color: primario ? "#161a1f" : "#e7eaee", border: primario ? "none" : "1px solid #333a45", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 700 });

const CHIAVE_VISTA = "eyedrones_agri_vista";

// Home dello spazio Agricoltura: campi, ultimi lavori, a che punto è il fascicolo SCIA, scorciatoie
export function HomeAgricoltura({ supabase, onNav }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let annullato = false;
    Promise.all([
      supabase.from("appezzamenti").select("id, nome, azienda, coltura, ettari"),
      supabase.from("trattamenti").select("id, data, campo_nome, prodotto, tipo, ettari").order("data", { ascending: false }).limit(3),
      supabase.from("agri_fascicolo").select("dati").maybeSingle(),
    ]).then(([a, t, f]) => {
      if (annullato) return;
      const campi = a.data || [];
      setD({ manca: !!(a.error && manca(a.error.message)), campi, lavori: t.data || [], scia: f.error ? null : controlliScia(unisci(f.data && f.data.dati), campi) });
    }).catch(() => { if (!annullato) setD({ manca: false, campi: [], lavori: [], scia: null }); });
    return () => { annullato = true; };
  }, [supabase]);
  const vai = (vista) => { try { sessionStorage.setItem(CHIAVE_VISTA, vista); } catch { /* niente */ } onNav("campi"); };
  if (!d) return null;
  const ettari = d.campi.reduce((x, c) => x + (Number(c.ettari) || 0), 0);
  const bott = (testo, vista, primario) => <button type="button" onClick={() => vai(vista)} style={btn(primario)}>{testo}</button>;
  return (
    <section style={{ ...scheda, border: "1px solid #4ade8055", marginBottom: 22 }}>
      <div style={{ fontSize: 15, fontWeight: 800 }}>🌾 In campo</div>
      <div style={{ fontSize: 12.5, color: "#aab3bf", marginTop: 2 }}>
        {d.manca ? "Per iniziare serve lo script supabase/agricoltura.sql (una volta sola)." : d.campi.length === 0 ? "Nessun appezzamento ancora: aggiungi il primo con i confini sulla mappa." : `${d.campi.length} ${d.campi.length === 1 ? "appezzamento" : "appezzamenti"} · ${formattaEttari(ettari)}`}
      </div>
      {d.lavori.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {d.lavori.map((l) => <div key={l.id} style={{ fontSize: 12.5, color: "#c3cad4" }}>🧪 {dataIt(l.data)} · {l.campo_nome || "campo"}{l.prodotto ? ` · ${l.prodotto}` : ""}</div>)}
        </div>
      )}
      {d.scia && (
        <button type="button" onClick={() => vai("scia")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginTop: 10, textAlign: "left", background: "#161a1f", border: `1px solid ${d.scia.fatte === d.scia.voci.length ? "#4ade8066" : "#ff8c4266"}`, borderRadius: 8, padding: "9px 12px", color: "#e7eaee" }}>
          <span>📁</span><span style={{ flex: 1, fontSize: 12.5 }}><strong>Fascicolo SCIA</strong> · {d.scia.fatte === d.scia.voci.length ? "pronto ✅" : `${d.scia.fatte} di ${d.scia.voci.length}: mancano ${d.scia.voci.length - d.scia.fatte} cose`}</span><span style={{ color: "#8b95a3" }}>›</span>
        </button>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        {bott("🧪 Registra un trattamento", "trattamenti", true)}
        {bott("🌦️ Meteo per irrorare", "meteo")}
        {bott("🗺️ Appezzamenti", "campi")}
      </div>
    </section>
  );
}

export default function Agricoltura({ supabase, inputStyle, clienti = [], droni = [], azienda = {} }) {
  // dalla Home dello spazio Agricoltura si può arrivare direttamente a una scheda (es. il fascicolo SCIA)
  const [vista, setVista] = useState(() => { try { const v = sessionStorage.getItem(CHIAVE_VISTA); sessionStorage.removeItem(CHIAVE_VISTA); return v || "campi"; } catch { return "campi"; } });
  const [campi, setCampi] = useState(null);
  const [trattamenti, setTrattamenti] = useState([]);
  const [mancaTabella, setMancaTabella] = useState(false);
  const [selezionato, setSelezionato] = useState(null);
  const [campoMeteo, setCampoMeteo] = useState(null);
  const [nuovoLavoro, setNuovoLavoro] = useState(null); // dati iniziali del modulo trattamento

  const carica = async () => {
    const [a, t] = await Promise.all([
      supabase.from("appezzamenti").select("*").order("azienda", { ascending: true }).order("nome", { ascending: true }),
      supabase.from("trattamenti").select("*").order("data", { ascending: false }).order("ora_inizio", { ascending: false }).limit(1000),
    ]);
    if ((a.error && manca(a.error.message)) || (t.error && manca(t.error.message))) { setMancaTabella(true); setCampi([]); return; }
    setCampi(a.data || []);
    setTrattamenti(t.data || []);
  };
  useEffect(() => { carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const nomeCliente = (id) => (clienti.find((c) => c.id === id) || {}).nome || "";
  const apriLavoro = (campo) => { setNuovoLavoro(campo ? { campo } : {}); setVista("trattamenti"); window.scrollTo(0, 0); };
  const apriMeteo = (campo) => { setCampoMeteo(campo ? campo.id : null); setVista("meteo"); window.scrollTo(0, 0); };

  const linguette = [["campi", "🗺️ Appezzamenti"], ["trattamenti", "🧪 Registro lavori"], ["meteo", "🌦️ Meteo trattamenti"], ["scia", "📁 Fascicolo SCIA"]];
  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ maxWidth: 1000 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px 0" }}>🌾 Campi e trattamenti</h1>
        <p style={{ color: "#8b95a3", fontSize: 13.5, margin: "0 0 16px 0" }}>Appezzamenti dei tuoi clienti con i confini sulla mappa, registro dei lavori con PDF e meteo per irrorare.</p>

        {mancaTabella && (
          <div style={{ ...scheda, border: "1px solid #f5b94266", background: "#211a0c", marginBottom: 16, fontSize: 13, color: "#ffe2a8" }}>
            ⚙️ Per usare questa sezione serve una cosa da fare <strong>una volta sola</strong>: in Supabase apri <strong>SQL Editor</strong>, incolla lo script <strong>supabase/agricoltura.sql</strong> e premi <strong>Run</strong>. Poi ricarica la pagina.
          </div>
        )}

        <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {linguette.map(([k, t]) => (
            <button key={k} role="tab" aria-selected={vista === k} type="button" onClick={() => setVista(k)} style={{ ...btn(false), background: vista === k ? "#241d16" : "#1f2530", border: vista === k ? "1px solid #ff8c42" : "1px solid #333a45", fontWeight: 600 }}>{t}</button>
          ))}
        </div>

        {campi === null ? <p style={{ color: "#8b95a3" }}>Carico…</p> : vista === "campi" ? (
          <Appezzamenti supabase={supabase} inputStyle={inputStyle} clienti={clienti} campi={campi} trattamenti={trattamenti} selezionato={selezionato} setSelezionato={setSelezionato} onCambiati={carica} onLavoro={apriLavoro} onMeteo={apriMeteo} nomeCliente={nomeCliente} bloccato={mancaTabella} />
        ) : vista === "trattamenti" ? (
          <RegistroLavori supabase={supabase} inputStyle={inputStyle} campi={campi} trattamenti={trattamenti} droni={droni} azienda={azienda} iniziale={nuovoLavoro} onIniziale={() => setNuovoLavoro(null)} onCambiati={carica} bloccato={mancaTabella} />
        ) : vista === "scia" ? (
          <FascicoloScia supabase={supabase} inputStyle={inputStyle} campi={campi} droni={droni} azienda={azienda} />
        ) : (
          <MeteoTrattamenti inputStyle={inputStyle} campi={campi} campoId={campoMeteo} setCampoId={setCampoMeteo} onLavoro={apriLavoro} />
        )}
      </div>
    </div>
  );
}

// --- Appezzamenti ------------------------------------------------------------------------------------

function Appezzamenti({ supabase, inputStyle, clienti, campi, trattamenti, selezionato, setSelezionato, onCambiati, onLavoro, onMeteo, nomeCliente, bloccato }) {
  const [importati, setImportati] = useState(null); // anteprima del file di confini
  const [comuni, setComuni] = useState({ cliente_id: "", azienda: "", coltura: "" });
  const [errore, setErrore] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [modifica, setModifica] = useState(null);
  const [filtro, setFiltro] = useState("");

  const scegliFile = async (file) => {
    setErrore("");
    if (!file) return;
    try {
      const trovati = await leggiFileConfini(file);
      setImportati(trovati.map((c, i) => ({ ...c, chiave: `n${i}`, scelto: true })));
    } catch (e) { setErrore(e.message || "File non leggibile."); }
  };

  const salvaImportati = async () => {
    const scelti = importati.filter((c) => c.scelto);
    if (!scelti.length) return;
    setSalvando(true);
    const righe = scelti.map((c) => ({
      nome: testo(c.nome) || "Campo", confini: c.geometry, ettari: c.ettari, centro_lat: c.centro?.lat ?? null, centro_lon: c.centro?.lon ?? null,
      cliente_id: comuni.cliente_id || null, azienda: testo(comuni.azienda), coltura: testo(comuni.coltura),
    }));
    const { error } = await supabase.from("appezzamenti").insert(righe);
    setSalvando(false);
    if (error) { alert(`Salvataggio non riuscito: ${error.message}`); return; }
    setImportati(null);
    setComuni({ cliente_id: "", azienda: "", coltura: "" });
    onCambiati();
  };

  const salvaModifica = async () => {
    const m = modifica;
    if (!testo(m.nome)) { alert("Scrivi il nome del campo."); return; }
    const dati = { nome: testo(m.nome), cliente_id: m.cliente_id || null, azienda: testo(m.azienda), coltura: testo(m.coltura), ettari: num(m.ettari), note: testo(m.note) };
    if (m.punto) { const [la, lo] = String(m.punto).replace(/\s/g, "").split(/[,;]/).map(Number); if (!Number.isNaN(la) && !Number.isNaN(lo)) { dati.centro_lat = la; dati.centro_lon = lo; } }
    setSalvando(true);
    const { error } = m.id ? await supabase.from("appezzamenti").update(dati).eq("id", m.id) : await supabase.from("appezzamenti").insert(dati);
    setSalvando(false);
    if (error) { alert(`Salvataggio non riuscito: ${error.message}`); return; }
    setModifica(null);
    onCambiati();
  };

  const elimina = async (c) => {
    if (!window.confirm(`Eliminare il campo «${c.nome}»? I lavori già registrati restano nel registro.`)) return;
    await supabase.from("appezzamenti").delete().eq("id", c.id);
    setSelezionato(null);
    onCambiati();
  };

  // elenco raggruppato per azienda (o cliente), con il totale degli ettari
  const visibili = campi.filter((c) => !filtro || [c.nome, c.azienda, c.coltura, nomeCliente(c.cliente_id)].join(" ").toLowerCase().includes(filtro.toLowerCase()));
  const gruppi = visibili.reduce((g, c) => { const k = c.azienda || nomeCliente(c.cliente_id) || "Senza azienda"; (g[k] = g[k] || []).push(c); return g; }, {});
  const totale = visibili.reduce((s, c) => s + (Number(c.ettari) || 0), 0);
  const campo = campi.find((c) => c.id === selezionato) || null;
  const lavoriCampo = campo ? trattamenti.filter((t) => t.appezzamento_id === campo.id) : [];

  if (importati) {
    const scelti = importati.filter((c) => c.scelto);
    return (
      <div style={scheda}>
        <h3 style={{ fontSize: 15, margin: "0 0 4px 0" }}>📂 Ho trovato {importati.length === 1 ? "1 campo" : `${importati.length} campi`} nel file</h3>
        <p style={{ fontSize: 12.5, color: "#8b95a3", margin: "0 0 12px 0" }}>Controlla i nomi e togli la spunta a quelli che non ti servono. Gli ettari sono calcolati dal confine.</p>
        <MappaCampi campi={scelti.map((c) => ({ id: c.chiave, nome: c.nome, confini: c.geometry, ettari: c.ettari }))} altezza={260} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "12px 0" }}>
          {importati.map((c, i) => (
            <label key={c.chiave} style={{ display: "flex", alignItems: "center", gap: 8, background: "#161a1f", border: "1px solid #2b313d", borderRadius: 8, padding: "6px 10px" }}>
              <input type="checkbox" checked={c.scelto} onChange={(e) => setImportati(importati.map((x, j) => (j === i ? { ...x, scelto: e.target.checked } : x)))} />
              <input value={c.nome} onChange={(e) => setImportati(importati.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} style={{ ...inputStyle, padding: "6px 8px", flex: 1, minWidth: 0 }} aria-label="Nome del campo" />
              <span className="mono" style={{ fontSize: 12.5, color: "#c3cad4", whiteSpace: "nowrap" }}>{formattaEttari(c.ettari)}</span>
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div><label style={etichetta}>Cliente (per tutti)</label>
            <select value={comuni.cliente_id} onChange={(e) => setComuni({ ...comuni, cliente_id: e.target.value })} style={inputStyle}>
              <option value="">— Nessuno —</option>{clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
          <div><label style={etichetta}>Azienda agricola</label><input value={comuni.azienda} onChange={(e) => setComuni({ ...comuni, azienda: e.target.value })} placeholder="es. Azienda Rossi" style={inputStyle} /></div>
          <div><label style={etichetta}>Coltura</label><input value={comuni.coltura} onChange={(e) => setComuni({ ...comuni, coltura: e.target.value })} placeholder="es. Vite, mais, riso" style={inputStyle} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" onClick={salvaImportati} disabled={salvando || !scelti.length || bloccato} style={btn(true)}>{salvando ? "Salvo…" : `Salva ${scelti.length === 1 ? "1 campo" : `${scelti.length} campi`} · ${formattaEttari(scelti.reduce((s, c) => s + c.ettari, 0))}`}</button>
          <button type="button" onClick={() => setImportati(null)} style={btn(false)}>Annulla</button>
        </div>
      </div>
    );
  }

  if (modifica) {
    const m = modifica;
    return (
      <div style={scheda}>
        <h3 style={{ fontSize: 15, margin: "0 0 12px 0" }}>{m.id ? "✏️ Modifica campo" : "➕ Nuovo campo"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <div><label style={etichetta}>Nome del campo</label><input value={m.nome} onChange={(e) => setModifica({ ...m, nome: e.target.value })} placeholder="es. Vigna sotto casa" style={inputStyle} /></div>
          <div><label style={etichetta}>Cliente</label>
            <select value={m.cliente_id || ""} onChange={(e) => setModifica({ ...m, cliente_id: e.target.value })} style={inputStyle}>
              <option value="">— Nessuno —</option>{clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
          <div><label style={etichetta}>Azienda agricola</label><input value={m.azienda || ""} onChange={(e) => setModifica({ ...m, azienda: e.target.value })} style={inputStyle} /></div>
          <div><label style={etichetta}>Coltura</label><input value={m.coltura || ""} onChange={(e) => setModifica({ ...m, coltura: e.target.value })} style={inputStyle} /></div>
          <div><label style={etichetta}>Ettari{m.confini ? ` (dal confine: ${formattaEttari(ettariDi(m.confini))})` : ""}</label><input inputMode="decimal" value={m.ettari ?? ""} onChange={(e) => setModifica({ ...m, ettari: e.target.value })} style={inputStyle} /></div>
          {!m.confini && <div><label style={etichetta}>Posizione (lat, lon) per il meteo</label><input value={m.punto || ""} onChange={(e) => setModifica({ ...m, punto: e.target.value })} placeholder="es. 45.0703, 7.6869" style={inputStyle} /></div>}
        </div>
        <div style={{ marginTop: 10 }}><label style={etichetta}>Note (accesso, punto di decollo, ostacoli…)</label><textarea value={m.note || ""} onChange={(e) => setModifica({ ...m, note: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={salvaModifica} disabled={salvando || bloccato} style={btn(true)}>{salvando ? "Salvo…" : "Salva"}</button>
          <button type="button" onClick={() => setModifica(null)} style={btn(false)}>Annulla</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ ...btn(true), cursor: bloccato ? "not-allowed" : "pointer", opacity: bloccato ? 0.5 : 1 }}>
          📂 Importa confini (KML, KMZ, GeoJSON, SHP)
          <input type="file" accept=".kml,.kmz,.geojson,.json,.zip,.shp" disabled={bloccato} onChange={(e) => { scegliFile(e.target.files && e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
        </label>
        <button type="button" onClick={() => setModifica({ nome: "", cliente_id: "", azienda: "", coltura: "", ettari: "" })} disabled={bloccato} style={btn(false)}>➕ Campo senza confine</button>
      </div>
      {errore && <p style={{ color: "#ff9c9c", fontSize: 13, margin: "0 0 12px 0" }}>⚠️ {errore}</p>}
      <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 12px 0" }}>I confini li esporti da DJI SmartFarm o DJI Terra, Google Earth, QGIS o dal gestionale aziendale. Per lo shapefile carica lo zip con tutti i file (.shp, .dbf, .prj).</p>

      {campi.length > 0 && <MappaCampi campi={visibili.map((c) => ({ ...c, nome: c.nome }))} selezionato={selezionato} onScegli={setSelezionato} />}

      {campo && (
        <div style={{ ...scheda, marginTop: 12, border: "1px solid #ff8c4266" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{campo.nome}</div>
              <div style={{ fontSize: 12.5, color: "#8b95a3", marginTop: 2 }}>{[campo.azienda, nomeCliente(campo.cliente_id), campo.coltura, campo.ettari ? formattaEttari(campo.ettari) : null].filter(Boolean).join(" · ")}</div>
              {campo.note && <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 6 }}>📝 {campo.note}</div>}
            </div>
            <button type="button" onClick={() => setSelezionato(null)} aria-label="Chiudi" style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 18, alignSelf: "flex-start" }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={() => onLavoro(campo)} style={btn(true)}>🧪 Registra un lavoro</button>
            <button type="button" onClick={() => onMeteo(campo)} style={btn(false)}>🌦️ Si può trattare?</button>
            {campo.centro_lat != null && <a href={`https://www.google.com/maps/dir/?api=1&destination=${campo.centro_lat},${campo.centro_lon}`} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: "none" }}>🧭 Portami lì</a>}
            <button type="button" onClick={() => setModifica({ ...campo })} style={btn(false)}>✏️ Modifica</button>
            <button type="button" onClick={() => elimina(campo)} style={{ ...btn(false), color: "#ff9c9c" }}>Elimina</button>
          </div>
          {lavoriCampo.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: "#8b95a3", marginBottom: 4 }}>Ultimi lavori su questo campo</div>
              {lavoriCampo.slice(0, 5).map((t) => <div key={t.id} style={{ fontSize: 12.5, color: "#c3cad4", padding: "3px 0" }}>{dataIt(t.data)} · {etichettaLavoro(t.tipo)}{t.prodotto ? ` · ${t.prodotto}` : ""}{t.dose != null ? ` ${t.dose} ${t.unita || ""}` : ""}</div>)}
            </div>
          )}
        </div>
      )}

      {campi.length === 0 ? (
        <div style={{ ...scheda, marginTop: 12, textAlign: "center", color: "#8b95a3", fontSize: 13.5 }}>Nessun campo ancora. Importa il file dei confini dei tuoi clienti: in un attimo li vedi tutti sulla mappa, con gli ettari calcolati.</div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="🔎 Cerca campo, azienda o coltura" style={{ ...inputStyle, maxWidth: 320 }} />
            <span style={{ fontSize: 12.5, color: "#8b95a3" }}>{visibili.length === 1 ? "1 campo" : `${visibili.length} campi`} · <strong style={{ color: "#e7eaee" }}>{formattaEttari(totale)}</strong></span>
          </div>
          {Object.entries(gruppi).map(([nome, lista]) => (
            <div key={nome} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b95a3", textTransform: "uppercase", letterSpacing: ".05em", margin: "6px 0 4px" }}>{nome} · {formattaEttari(lista.reduce((s, c) => s + (Number(c.ettari) || 0), 0))}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {lista.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setSelezionato(c.id); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "flex", justifyContent: "space-between", gap: 10, textAlign: "left", background: c.id === selezionato ? "#241d16" : "#161a1f", border: `1px solid ${c.id === selezionato ? "#ff8c42" : "#2b313d"}`, borderRadius: 8, padding: "8px 12px", color: "#e7eaee", fontSize: 13 }}>
                    <span>{c.confini ? "🟩" : "📍"} {c.nome}{c.coltura ? <span style={{ color: "#8b95a3" }}> · {c.coltura}</span> : null}</span>
                    <span className="mono" style={{ color: "#c3cad4", whiteSpace: "nowrap" }}>{c.ettari ? formattaEttari(c.ettari) : "—"}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Registro lavori (trattamenti, concimazioni, semine…) ----------------------------------------------

const LAVORO_VUOTO = { appezzamento_id: "", data: "", ora_inizio: "", ora_fine: "", tipo: "trattamento", coltura: "", avversita: "", prodotto: "", registrazione: "", dose: "", unita: "l/ha", volume_ha: "", ettari: "", quantita_totale: "", drone_id: "", operatore: "", vento_kmh: "", direzione_vento: "", temperatura: "", umidita: "", note: "" };

function RegistroLavori({ supabase, inputStyle, campi, trattamenti, droni, azienda, iniziale, onIniziale, onCambiati, bloccato }) {
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [meteoStato, setMeteoStato] = useState("");
  const [filtro, setFiltro] = useState({ campo: "", azienda: "", da: "", a: "" });
  const [consegna, setConsegna] = useState(null); // dati del report di consegna, quando il riquadro è aperto

  // arrivo da un campo («Registra un lavoro»): apro il modulo già compilato
  useEffect(() => {
    if (!iniziale) return;
    nuovo(iniziale.campo || null);
    onIniziale();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniziale]);

  const ultimoOperatore = trattamenti[0]?.operatore || azienda.nome || "";
  const nuovo = (campo) => setForm({ ...LAVORO_VUOTO, data: oggi(), operatore: ultimoOperatore, ...(campo ? { appezzamento_id: campo.id, coltura: campo.coltura || "", ettari: campo.ettari != null ? String(campo.ettari) : "" } : {}) });
  const campoDi = (id) => campi.find((c) => c.id === id) || null;

  const cambiaCampo = (id) => {
    const c = campoDi(id);
    setForm({ ...form, appezzamento_id: id, coltura: form.coltura || c?.coltura || "", ettari: c?.ettari != null ? String(c.ettari) : form.ettari });
  };

  // meteo dell'ora del lavoro, dal centro del campo (anche per i lavori dei giorni scorsi)
  const compilaMeteo = async () => {
    const c = campoDi(form.appezzamento_id);
    if (!c || c.centro_lat == null) { setMeteoStato("Scegli un campo con la posizione."); return; }
    setMeteoStato("Cerco il meteo…");
    try {
      const ore = await meteoCampo({ lat: c.centro_lat, lon: c.centro_lon });
      const h = form.ora_inizio ? Number(form.ora_inizio.slice(0, 2)) : new Date().getHours();
      const o = ore.find((x) => x.data === form.data && x.ora === h);
      if (!o) { setMeteoStato("Per quella data il meteo non è disponibile (solo gli ultimi 7 giorni e i prossimi 3)."); return; }
      setForm((f) => ({ ...f, vento_kmh: o.vento != null ? String(Math.round(o.vento)) : "", direzione_vento: daDove(o.direzione), temperatura: o.temp != null ? String(Math.round(o.temp)) : "", umidita: o.ur != null ? String(Math.round(o.ur)) : "" }));
      setMeteoStato(`✓ Meteo delle ${String(h).padStart(2, "0")}:00 (previsione Open-Meteo per il centro del campo): controlla e correggi se hai misurato sul posto.`);
    } catch { setMeteoStato("Meteo non disponibile: riprova o scrivilo a mano."); }
  };

  const totaleAuto = (() => { const d = num(form?.dose), e = num(form?.ettari); return d != null && e != null ? Math.round(d * e * 100) / 100 : null; })();

  const salva = async () => {
    const f = form;
    if (!f.data) { alert("Manca la data."); return; }
    const c = campoDi(f.appezzamento_id);
    const drone = droni.find((d) => String(d.id) === String(f.drone_id));
    const dati = {
      appezzamento_id: f.appezzamento_id || null, campo_nome: c ? c.nome : null, azienda: c ? c.azienda || null : null,
      data: f.data, ora_inizio: f.ora_inizio || null, ora_fine: f.ora_fine || null, tipo: f.tipo, coltura: testo(f.coltura), avversita: testo(f.avversita),
      prodotto: testo(f.prodotto), registrazione: testo(f.registrazione), dose: num(f.dose), unita: f.unita, volume_ha: num(f.volume_ha), ettari: num(f.ettari),
      quantita_totale: num(f.quantita_totale) ?? totaleAuto, drone_id: f.drone_id ? String(f.drone_id) : null, drone_nome: drone ? drone.nome : null,
      operatore: testo(f.operatore), vento_kmh: num(f.vento_kmh), direzione_vento: testo(f.direzione_vento), temperatura: num(f.temperatura), umidita: num(f.umidita), note: testo(f.note),
    };
    setSalvando(true);
    const { error } = f.id ? await supabase.from("trattamenti").update(dati).eq("id", f.id) : await supabase.from("trattamenti").insert(dati);
    setSalvando(false);
    if (error) { alert(`Salvataggio non riuscito: ${error.message}`); return; }
    setForm(null); setMeteoStato("");
    onCambiati();
  };

  const elimina = async (t) => {
    if (!window.confirm("Eliminare questo lavoro dal registro?")) return;
    await supabase.from("trattamenti").delete().eq("id", t.id);
    onCambiati();
  };

  const aziende = [...new Set(campi.map((c) => c.azienda).filter(Boolean))].sort();
  const filtrati = trattamenti.filter((t) => (!filtro.campo || t.appezzamento_id === filtro.campo) && (!filtro.azienda || t.azienda === filtro.azienda || (campi.find((c) => c.id === t.appezzamento_id) || {}).azienda === filtro.azienda) && (!filtro.da || t.data >= filtro.da) && (!filtro.a || t.data <= filtro.a));

  if (form) {
    const f = form;
    const campo = (k, t, extra = {}) => <div><label style={etichetta}>{t}</label><input value={f[k] ?? ""} onChange={(e) => setForm({ ...f, [k]: e.target.value })} style={inputStyle} {...extra} /></div>;
    const dt = deltaT(num(f.temperatura), num(f.umidita));
    return (
      <div style={scheda}>
        <h3 style={{ fontSize: 15, margin: "0 0 12px 0" }}>{f.id ? "✏️ Modifica lavoro" : "🧪 Nuovo lavoro in campo"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
          <div><label style={etichetta}>Campo</label>
            <select value={f.appezzamento_id} onChange={(e) => cambiaCampo(e.target.value)} style={inputStyle}>
              <option value="">— Scegli —</option>{campi.map((c) => <option key={c.id} value={c.id}>{c.azienda ? `${c.azienda} · ` : ""}{c.nome}</option>)}
            </select></div>
          <div><label style={etichetta}>Lavoro</label>
            <select value={f.tipo} onChange={(e) => setForm({ ...f, tipo: e.target.value })} style={inputStyle}>{TIPI_LAVORO.map((t) => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}</select></div>
          {campo("data", "Data", { type: "date" })}
          {campo("ora_inizio", "Ora inizio", { type: "time" })}
          {campo("ora_fine", "Ora fine", { type: "time" })}
          {campo("coltura", "Coltura", { placeholder: "es. Vite" })}
          {f.tipo === "trattamento" && campo("avversita", "Avversità / bersaglio", { placeholder: "es. Peronospora" })}
          {campo("prodotto", f.tipo === "semina" ? "Seme / varietà" : "Prodotto", { placeholder: f.tipo === "concimazione" ? "es. Urea 46%" : "es. nome commerciale" })}
          {f.tipo === "trattamento" && campo("registrazione", "N. registrazione", { placeholder: "Min. Salute" })}
          <div><label style={etichetta}>Dose per ettaro</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input inputMode="decimal" value={f.dose} onChange={(e) => setForm({ ...f, dose: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 0 }} />
              <select value={f.unita} onChange={(e) => setForm({ ...f, unita: e.target.value })} style={{ ...inputStyle, width: 90 }}>{UNITA.map((u) => <option key={u}>{u}</option>)}</select>
            </div></div>
          {f.tipo === "trattamento" && campo("volume_ha", "Volume di miscela (l/ha)", { inputMode: "decimal", placeholder: "es. 15" })}
          {campo("ettari", "Ettari lavorati", { inputMode: "decimal" })}
          {campo("quantita_totale", `Quantità totale${totaleAuto != null ? ` (calcolata: ${totaleAuto} ${f.unita.split("/")[0]})` : ""}`, { inputMode: "decimal", placeholder: totaleAuto != null ? String(totaleAuto) : "" })}
          <div><label style={etichetta}>Drone</label>
            <select value={f.drone_id} onChange={(e) => setForm({ ...f, drone_id: e.target.value })} style={inputStyle}>
              <option value="">— Nessuno —</option>{droni.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select></div>
          {campo("operatore", "Operatore / pilota")}
        </div>

        <div style={{ marginTop: 14, background: "#161a1f", border: "1px solid #2b313d", borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <strong style={{ fontSize: 13 }}>🌦️ Meteo durante il lavoro</strong>
            <button type="button" onClick={compilaMeteo} style={{ ...btn(false), padding: "6px 10px", fontSize: 12 }}>Compila dal meteo</button>
          </div>
          {meteoStato && <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "6px 0 0 0" }}>{meteoStato}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginTop: 8 }}>
            {campo("vento_kmh", "Vento (km/h)", { inputMode: "decimal" })}
            {campo("direzione_vento", "Da dove", { placeholder: "es. NO" })}
            {campo("temperatura", "Temperatura (°C)", { inputMode: "decimal" })}
            {campo("umidita", "Umidità (%)", { inputMode: "decimal" })}
          </div>
          {dt != null && <p style={{ fontSize: 12, margin: "8px 0 0 0", color: dt > 10 || dt < 2 ? "#ff9c9c" : dt > 8 ? "#ffd68a" : "#4ade80" }}>Delta T {dt} °C {dt > 10 ? "· troppo secco: la goccia evapora" : dt > 8 ? "· al limite" : dt < 2 ? "· rischio inversione termica" : "· buono per irrorare"}</p>}
        </div>

        <div style={{ marginTop: 10 }}><label style={etichetta}>Note</label><textarea value={f.note} onChange={(e) => setForm({ ...f, note: e.target.value })} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button type="button" onClick={salva} disabled={salvando || bloccato} style={btn(true)}>{salvando ? "Salvo…" : "Salva nel registro"}</button>
          <button type="button" onClick={() => { setForm(null); setMeteoStato(""); }} style={btn(false)}>Annulla</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" onClick={() => nuovo(null)} disabled={bloccato} style={btn(true)}>➕ Nuovo lavoro</button>
        <button type="button" onClick={() => pdfRegistro(filtrati, campi, azienda, filtro)} disabled={!filtrati.length} style={btn(false)}>📄 Scarica il registro in PDF</button>
        <button type="button" onClick={() => setConsegna(consegna ? null : { cliente: filtro.azienda || "", note: "", pilota: azienda?.nome || "", attestato: "", stato: "" })} disabled={!filtrati.length} style={btn(false)}>📦 Report di consegna</button>
      </div>
      {consegna && (
        <div style={{ ...scheda, marginBottom: 12 }}>
          <strong style={{ fontSize: 13.5 }}>📦 Report di consegna per il cliente</strong>
          <p style={{ fontSize: 12, color: "#8b95a3", margin: "4px 0 10px 0" }}>Usa i {filtrati.length === 1 ? "lavoro mostrato" : `${filtrati.length} lavori mostrati`} qui sotto: scegli prima azienda e periodo con i filtri. Nel PDF: riepilogo, mappa dei campi, ogni intervento con meteo, note e firma.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            <div><label style={etichetta}>Cliente</label><input value={consegna.cliente} onChange={(e) => setConsegna({ ...consegna, cliente: e.target.value })} style={inputStyle} placeholder="es. Az. Agricola Rossi" /></div>
            <div><label style={etichetta}>Firma: pilota o operatore</label><input value={consegna.pilota} onChange={(e) => setConsegna({ ...consegna, pilota: e.target.value })} style={inputStyle} /></div>
            <div><label style={etichetta}>Attestato / n. operatore</label><input value={consegna.attestato} onChange={(e) => setConsegna({ ...consegna, attestato: e.target.value })} style={inputStyle} placeholder="es. Operatore ITA-xxxx" /></div>
          </div>
          <div style={{ marginTop: 10 }}><label style={etichetta}>Note per il cliente (se vuoto metto un testo standard)</label><textarea value={consegna.note} onChange={(e) => setConsegna({ ...consegna, note: e.target.value })} rows={3} style={{ ...inputStyle, resize: "vertical" }} /></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" style={btn(true)} onClick={async () => {
              setConsegna((c) => ({ ...c, stato: "Preparo il PDF…" }));
              try {
                const periodo = filtro.da || filtro.a ? `Periodo: ${filtro.da ? dataIt(filtro.da) : "…"} – ${filtro.a ? dataIt(filtro.a) : "…"}` : null;
                const doc = await pdfConsegnaAgricoltura({ lavori: filtrati, campi, azienda, cliente: consegna.cliente, periodo, note: consegna.note, pilota: consegna.pilota, attestato: consegna.attestato });
                doc.save(`consegna-lavori${consegna.cliente ? `-${consegna.cliente.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}-${oggi()}.pdf`);
                setConsegna((c) => ({ ...c, stato: "✓ PDF scaricato" }));
              } catch (e) {
                setConsegna((c) => ({ ...c, stato: "Non sono riuscito a creare il PDF: " + (e?.message || e) }));
              }
            }}>📄 Crea il PDF</button>
            {consegna.stato && <span style={{ fontSize: 12, color: "#8b95a3" }}>{consegna.stato}</span>}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {aziende.length > 0 && (
          <select value={filtro.azienda} onChange={(e) => setFiltro({ ...filtro, azienda: e.target.value, campo: "" })} style={{ ...inputStyle, width: "auto", minWidth: 160 }}>
            <option value="">Tutte le aziende</option>{aziende.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <select value={filtro.campo} onChange={(e) => setFiltro({ ...filtro, campo: e.target.value })} style={{ ...inputStyle, width: "auto", minWidth: 180 }}>
          <option value="">Tutti i campi</option>{campi.filter((c) => !filtro.azienda || c.azienda === filtro.azienda).map((c) => <option key={c.id} value={c.id}>{c.azienda ? `${c.azienda} · ` : ""}{c.nome}</option>)}
        </select>
        <label style={{ fontSize: 12, color: "#8b95a3", display: "flex", alignItems: "center", gap: 6 }}>dal <input type="date" value={filtro.da} onChange={(e) => setFiltro({ ...filtro, da: e.target.value })} style={{ ...inputStyle, width: "auto" }} /></label>
        <label style={{ fontSize: 12, color: "#8b95a3", display: "flex", alignItems: "center", gap: 6 }}>al <input type="date" value={filtro.a} onChange={(e) => setFiltro({ ...filtro, a: e.target.value })} style={{ ...inputStyle, width: "auto" }} /></label>
      </div>
      {filtrati.length === 0 ? (
        <div style={{ ...scheda, textAlign: "center", color: "#8b95a3", fontSize: 13.5 }}>Nessun lavoro registrato{filtro.campo || filtro.da || filtro.a ? " con questi filtri" : ""}. Registra trattamenti, concimazioni e semine: il PDF del registro è pronto per il cliente e per i controlli.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtrati.map((t) => (
            <div key={t.id} style={{ background: "#161a1f", border: "1px solid #2b313d", borderRadius: 8, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{(TIPI_LAVORO.find((x) => x.key === t.tipo) || {}).emoji || "📝"} {dataIt(t.data)}{t.ora_inizio ? ` · ${String(t.ora_inizio).slice(0, 5)}` : ""} · {t.campo_nome || "campo non indicato"}{t.azienda ? <span style={{ color: "#8b95a3" }}> ({t.azienda})</span> : null}</div>
                <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 2 }}>{[t.prodotto, t.dose != null ? `${t.dose} ${t.unita || ""}` : null, t.ettari != null ? formattaEttari(t.ettari) : null, t.quantita_totale != null ? `tot. ${t.quantita_totale} ${(t.unita || "").split("/")[0]}` : null].filter(Boolean).join(" · ")}</div>
                <div style={{ fontSize: 11.5, color: "#8b95a3", marginTop: 2 }}>{[t.vento_kmh != null ? `vento ${t.vento_kmh} km/h${t.direzione_vento ? ` da ${t.direzione_vento}` : ""}` : null, t.temperatura != null ? `${t.temperatura} °C` : null, t.umidita != null ? `UR ${t.umidita}%` : null, t.operatore, t.drone_nome].filter(Boolean).join(" · ")}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <button type="button" onClick={() => setForm({ ...LAVORO_VUOTO, ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v == null ? "" : typeof v === "number" ? String(v) : v])), ora_inizio: t.ora_inizio ? String(t.ora_inizio).slice(0, 5) : "", ora_fine: t.ora_fine ? String(t.ora_fine).slice(0, 5) : "", unita: t.unita || "l/ha", appezzamento_id: t.appezzamento_id || "" })} style={{ ...btn(false), padding: "5px 10px", fontSize: 12 }}>Modifica</button>
                <button type="button" onClick={() => elimina(t)} style={{ ...btn(false), padding: "5px 10px", fontSize: 12, color: "#ff9c9c" }}>Elimina</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// PDF del registro: A4 orizzontale, una riga per lavoro, con meteo e operatore (per il cliente e per i controlli)
function pdfRegistro(lavori, campi, azienda, filtro) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, M = 10;
  const colonne = [
    ["Data / ora", 22], ["Campo · azienda", 38], ["Coltura", 20], ["Lavoro · bersaglio", 30], ["Prodotto (n. reg.)", 40], ["Dose/ha", 18],
    ["Ha", 12], ["Totale", 16], ["Miscela", 16], ["Meteo", 30], ["Operatore · drone", 35],
  ];
  const campo = filtro.campo ? campi.find((c) => c.id === filtro.campo) : null;
  let y = M;
  const intestazione = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.text("Registro dei lavori in campo", M, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const sotto = [azienda.nome, campo ? `Campo: ${campo.nome}` : "Tutti i campi", filtro.da || filtro.a ? `Periodo: ${filtro.da ? dataIt(filtro.da) : "…"} – ${filtro.a ? dataIt(filtro.a) : "…"}` : null, `Stampato il ${dataIt(oggi())}`].filter(Boolean).join("  ·  ");
    doc.text(sotto, M, y + 11);
    y += 16;
    doc.setFillColor(235, 235, 235); doc.rect(M, y, W - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    let x = M + 1; colonne.forEach(([t, w]) => { doc.text(t, x, y + 4.8); x += w; });
    y += 9;
    doc.setFont("helvetica", "normal");
  };
  intestazione();
  const ordinati = [...lavori].sort((a, b) => `${a.data} ${a.ora_inizio || ""}`.localeCompare(`${b.data} ${b.ora_inizio || ""}`));
  ordinati.forEach((t) => {
    const valori = [
      `${dataIt(t.data)}${t.ora_inizio ? `\n${String(t.ora_inizio).slice(0, 5)}${t.ora_fine ? `–${String(t.ora_fine).slice(0, 5)}` : ""}` : ""}`,
      [t.campo_nome, t.azienda].filter(Boolean).join(" · "),
      t.coltura || "",
      [etichettaLavoro(t.tipo), t.avversita].filter(Boolean).join(" · "),
      `${t.prodotto || ""}${t.registrazione ? ` (${t.registrazione})` : ""}`,
      t.dose != null ? `${String(t.dose).replace(".", ",")} ${t.unita || ""}` : "",
      t.ettari != null ? String(t.ettari).replace(".", ",") : "",
      t.quantita_totale != null ? `${String(t.quantita_totale).replace(".", ",")} ${(t.unita || "").split("/")[0]}` : "",
      t.volume_ha != null ? `${String(t.volume_ha).replace(".", ",")} l/ha` : "",
      [t.vento_kmh != null ? `${t.vento_kmh} km/h${t.direzione_vento ? ` ${t.direzione_vento}` : ""}` : null, t.temperatura != null ? `${t.temperatura}°C` : null, t.umidita != null ? `UR ${t.umidita}%` : null].filter(Boolean).join(" · "),
      [t.operatore, t.drone_nome].filter(Boolean).join(" · "),
    ];
    const righe = valori.map((v, i) => doc.splitTextToSize(String(v), colonne[i][1] - 2));
    const h = Math.max(...righe.map((r) => r.length)) * 3.6 + 2.5;
    if (y + h > 200) { doc.addPage(); y = M; intestazione(); }
    doc.setFontSize(8);
    let x = M + 1; righe.forEach((r, i) => { doc.text(r, x, y + 3); x += colonne[i][1]; });
    doc.setDrawColor(220, 220, 220); doc.line(M, y + h - 0.5, W - M, y + h - 0.5);
    y += h;
  });
  const ettariTot = ordinati.reduce((s, t) => s + (Number(t.ettari) || 0), 0);
  if (y > 190) { doc.addPage(); y = M; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text(`Totale: ${ordinati.length === 1 ? "1 lavoro" : `${ordinati.length} lavori`} · ${ettariTot.toLocaleString("it-IT", { maximumFractionDigits: 2 })} ha`, M, y + 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text("Meteo: misurato sul posto o previsione Open-Meteo per il centro del campo. Registro generato con EyeDrones (app.eyedrones.it).", M, y + 11);
  doc.text("Firma dell'operatore: ______________________________", W - M - 80, y + 11);
  const nome = `registro-lavori${campo ? `-${campo.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}-${oggi()}.pdf`;
  doc.save(nome);
}

// --- Meteo per i trattamenti -----------------------------------------------------------------------------

function MeteoTrattamenti({ inputStyle, campi, campoId, setCampoId, onLavoro }) {
  const [soglie, setSoglie] = useState(leggiSoglie);
  const [ore, setOre] = useState(null);
  const [stato, setStato] = useState("");
  const [mostraSoglie, setMostraSoglie] = useState(false);
  const conPosizione = campi.filter((c) => c.centro_lat != null);
  const campo = conPosizione.find((c) => c.id === campoId) || null;

  useEffect(() => {
    if (!campo) { setOre(null); return; }
    let annullato = false;
    setStato("Carico le previsioni…");
    meteoCampo({ lat: campo.centro_lat, lon: campo.centro_lon }).then((o) => { if (!annullato) { setOre(o); setStato(""); } }, () => { if (!annullato) setStato("Meteo non disponibile: riprova tra poco."); });
    return () => { annullato = true; };
  }, [campo && campo.id]);

  const cambiaSoglia = (k, v) => { const s = { ...soglie, [k]: num(v) ?? SOGLIE_BASE[k] }; setSoglie(s); salvaSoglie(s); };

  // dalle prossime ore in avanti, 48 ore, raggruppate per giorno; più le finestre buone di fila (almeno 2 ore verdi)
  const adesso = new Date();
  const chiaveAdesso = `${oggi()}T${String(adesso.getHours()).padStart(2, "0")}`;
  const prossime = useMemo(() => (ore || []).filter((o) => o.quando.slice(0, 13) >= chiaveAdesso).slice(0, 48).map((o) => ({ ...o, v: valutaOraTrattamento(o, soglie) })), [ore, soglie, chiaveAdesso]);
  const giorni = prossime.reduce((g, o) => { (g[o.data] = g[o.data] || []).push(o); return g; }, {});
  const finestre = [];
  let inizio = null;
  prossime.forEach((o, i) => {
    const buona = o.v.livello === 0 && o.ora >= 5 && o.ora <= 21;
    if (buona && !inizio) inizio = o;
    const fine = !buona || i === prossime.length - 1;
    if (inizio && fine) { const ultimo = buona ? o : prossime[i - 1]; if (ultimo.ora - inizio.ora >= 1 || ultimo.data !== inizio.data) finestre.push([inizio, ultimo]); inizio = null; }
  });
  const nomeGiorno = (d) => (d === oggi() ? "Oggi" : new Date(`${d}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "short" }));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={campoId || ""} onChange={(e) => setCampoId(e.target.value || null)} style={{ ...inputStyle, width: "auto", minWidth: 220 }}>
          <option value="">— Scegli il campo —</option>{conPosizione.map((c) => <option key={c.id} value={c.id}>{c.azienda ? `${c.azienda} · ` : ""}{c.nome}</option>)}
        </select>
        <button type="button" onClick={() => setMostraSoglie(!mostraSoglie)} style={{ ...btn(false), padding: "7px 12px", fontSize: 12.5 }}>⚙️ Soglie</button>
      </div>

      {mostraSoglie && (
        <div style={{ ...scheda, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Le tue soglie per irrorare</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {[["ventoMax", "Vento max (km/h)"], ["raffiche", "Raffiche max (km/h)"], ["tempMin", "Temperatura min (°C)"], ["tempMax", "Temperatura max (°C)"], ["urMin", "Umidità min (%)"]].map(([k, t]) => (
              <div key={k}><label style={etichetta}>{t}</label><input inputMode="decimal" defaultValue={soglie[k]} onBlur={(e) => cambiaSoglia(k, e.target.value)} style={inputStyle} /></div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "8px 0 0 0" }}>Il Delta T (differenza tra temperatura e bulbo umido) è calcolato in automatico: tra 2 e 8 °C è ideale, sopra 10 la goccia evapora, sotto 2 c'è rischio di inversione termica. Controlla sempre anche l'etichetta del prodotto e il manuale del drone (Agras: vento massimo di lavoro 6 m/s).</p>
        </div>
      )}

      {conPosizione.length === 0 && <div style={{ ...scheda, color: "#8b95a3", fontSize: 13.5 }}>Prima aggiungi un campo con il confine o la posizione, nella scheda Appezzamenti.</div>}
      {stato && <p style={{ color: "#8b95a3", fontSize: 13 }}>{stato}</p>}

      {campo && prossime.length > 0 && (
        <>
          <div style={{ ...scheda, marginBottom: 12, border: `1px solid ${finestre.length ? "#4ade8066" : "#f5b94266"}` }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: finestre.length ? "#4ade80" : "#ffd68a" }}>{finestre.length ? "✅ Finestre buone per trattare" : "⚠️ Nelle prossime 48 ore nessuna finestra del tutto buona"}</div>
            {finestre.length > 0 && <div style={{ fontSize: 13, color: "#c3cad4", marginTop: 4 }}>{finestre.slice(0, 4).map(([a, b]) => `${nomeGiorno(a.data)} ${String(a.ora).padStart(2, "0")}–${String(b.ora + 1).padStart(2, "0")}`).join(" · ")}</div>}
            <button type="button" onClick={() => onLavoro(campo)} style={{ ...btn(false), marginTop: 10, padding: "6px 12px", fontSize: 12.5 }}>🧪 Registra un lavoro su {campo.nome}</button>
          </div>
          {Object.entries(giorni).map(([d, lista]) => (
            <div key={d} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#c3cad4", marginBottom: 6, textTransform: "capitalize" }}>{nomeGiorno(d)}</div>
              <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 4 }}>
                {lista.map((o) => (
                  <div key={o.quando} title={o.v.motivi.join(", ") || o.v.testo} style={{ flex: "0 0 auto", width: 58, textAlign: "center", background: o.v.colore + "1f", border: `1px solid ${o.v.colore}66`, borderRadius: 6, padding: "5px 2px", fontSize: 10.5, color: "#c3cad4" }}>
                    <div style={{ fontWeight: 700, color: "#e7eaee" }}>{String(o.ora).padStart(2, "0")}</div>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: o.v.colore, margin: "3px auto" }} />
                    <div>💨{Math.round(o.vento ?? 0)} {daDove(o.direzione)}</div>
                    <div>🌡️{Math.round(o.temp ?? 0)}°</div>
                    <div>💧{Math.round(o.ur ?? 0)}%</div>
                    <div style={{ color: "#8b95a3" }}>ΔT {o.v.deltaT ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "#6b7480" }}>Previsioni Open-Meteo per il centro del campo, vento a 10 m in km/h. Passa il dito su un'ora per vedere i motivi del colore.</p>
        </>
      )}
    </div>
  );
}
