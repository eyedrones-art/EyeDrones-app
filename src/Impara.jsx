import React, { useState, useEffect } from "react";
import { ESAMI, LEZIONI, GUIDA_ZONA_ROSSA, DOMANDE, SIGLE_ZONE, CONTATTI_ZONE } from "./impara";
import Notizie from "./Notizie.jsx";
import Manuale from "./Manuale.jsx";

// Sezione «Impara»: lezioni A1/A3 e A2, quiz con spiegazioni e simulazione d'esame, guida zona rossa, consigli di volo.
const SCHEDE = [
  { key: "notizie", label: "📰 Notizie" },
  { key: "manuale", label: "🎬 Foto e video" },
  { key: "a1a3", label: "📘 A1/A3" },
  { key: "a2", label: "📗 A2" },
  { key: "quiz", label: "📝 Quiz" },
  { key: "zona-rossa", label: "🔴 Zona rossa" },
  { key: "consigli", label: "💡 Consigli di volo" },
];
const CHIAVE_ERRORI = "eyedrones_quiz_errori";
const leggiErrori = () => { try { return JSON.parse(localStorage.getItem(CHIAVE_ERRORI) || "[]"); } catch { return []; } };
const scriviErrori = (l) => { try { localStorage.setItem(CHIAVE_ERRORI, JSON.stringify(l)); } catch { /* niente */ } };
const mescola = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const AVVISO = "Domande di allenamento scritte sugli argomenti d'esame: non sono quelle ufficiali e non sostituiscono il corso ENAC o una scuola.";

const stCard = { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, padding: "14px 16px" };
const stBtn = (attivo) => ({ background: attivo ? "#ff8c42" : "#1f2530", color: attivo ? "#161a1f" : "#e7eaee", border: attivo ? "none" : "1px solid #333a45", borderRadius: 18, padding: "6px 12px", fontSize: 12.5, fontWeight: attivo ? 700 : 500, whiteSpace: "nowrap" });
const stAzione = { background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 13, fontWeight: 700 };
const stSecondario = { background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 6, padding: "9px 14px", fontSize: 13 };

function Lezioni({ esame, onQuiz }) {
  const lezioni = LEZIONI[esame];
  const e = ESAMI[esame];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...stCard, background: "#14251b", borderColor: "#2c5a3a", fontSize: 12.5, color: "#bfe8cc" }}>
        🎓 Esame {e.nome}: {e.domande} domande in {e.minuti} minuti, {e.dove}. Si passa con {e.soglia} punti su {e.massimo} (risposta giusta +{e.punti.giusta}{e.punti.sbagliata ? `, sbagliata ${e.punti.sbagliata}` : ""}).
      </div>
      {lezioni.map((l, i) => (
        <details key={l.id} open={i === 0} style={stCard}>
          <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700 }}>{i + 1}. {l.titolo}</summary>
          <ul style={{ margin: "10px 0 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#d6dde6" }}>
            {l.punti.map((p) => <li key={p} style={{ marginBottom: 4 }}>{p}</li>)}
          </ul>
        </details>
      ))}
      <button type="button" onClick={onQuiz} style={{ ...stAzione, alignSelf: "flex-start", marginTop: 4 }}>📝 Mettiti alla prova con il quiz {e.nome}</button>
      <p style={{ fontSize: 10.5, color: "#6b7480", margin: 0 }}>Riassunto per ripassare: per l'esame segui il materiale ufficiale ENAC.</p>
    </div>
  );
}

function Domanda({ q, scelta, onScegli, mostraEsito }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8b95a3", marginBottom: 4 }}>{q.tema}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, lineHeight: 1.4 }}>{q.d}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {q.r.map((r, i) => {
          const giusta = mostraEsito && i === q.ok;
          const sbagliata = mostraEsito && i === scelta && i !== q.ok;
          return (
            <button key={i} type="button" disabled={mostraEsito} onClick={() => onScegli(i)} style={{ textAlign: "left", background: giusta ? "#1d3a2a" : sbagliata ? "#3a1d1d" : scelta === i ? "#2a3446" : "#161a1f", border: `1px solid ${giusta ? "#4ade80" : sbagliata ? "#ff6b6b" : scelta === i ? "#7fb0ff" : "#333a45"}`, color: "#e7eaee", borderRadius: 8, padding: "10px 12px", fontSize: 13.5 }}>
              {String.fromCharCode(65 + i)}. {r} {giusta ? "✓" : sbagliata ? "✗" : ""}
            </button>
          );
        })}
      </div>
      {mostraEsito && <div style={{ marginTop: 10, fontSize: 12.5, color: "#c3cad4", background: "#161a1f", borderRadius: 8, padding: "8px 10px" }}>💡 {q.perche}</div>}
    </div>
  );
}

function Quiz({ esameIniziale = "a1a3" }) {
  const [esame, setEsame] = useState(esameIniziale);
  const [modo, setModo] = useState(null); // null | "allenamento" | "errori" | "simulazione"
  const [ordine, setOrdine] = useState([]);
  const [pos, setPos] = useState(0);
  const [scelte, setScelte] = useState({});
  const [mostra, setMostra] = useState(false);
  const [fine, setFine] = useState(false);
  const [scadenza, setScadenza] = useState(null);
  const [adesso, setAdesso] = useState(Date.now());
  const [errori, setErrori] = useState(leggiErrori);
  const banca = DOMANDE[esame];
  const conf = ESAMI[esame];
  const erroriEsame = errori.filter((k) => k.startsWith(esame + "-"));

  useEffect(() => { if (modo !== "simulazione" || fine) return; const t = setInterval(() => setAdesso(Date.now()), 1000); return () => clearInterval(t); }, [modo, fine]);
  useEffect(() => { if (modo === "simulazione" && scadenza && adesso >= scadenza && !fine) setFine(true); }, [adesso, scadenza, modo, fine]);
  // a fine simulazione aggiorno l'elenco degli errori da ripassare (una volta sola)
  useEffect(() => {
    if (!fine || modo !== "simulazione") return;
    const sbagliate = new Set(ordine.filter((i) => scelte[i] != null && scelte[i] !== banca[i].ok).map((i) => `${esame}-${i}`));
    const giuste = new Set(ordine.filter((i) => scelte[i] === banca[i].ok).map((i) => `${esame}-${i}`));
    const nuovi = [...new Set([...errori.filter((k) => !giuste.has(k)), ...sbagliate])];
    setErrori(nuovi); scriviErrori(nuovi);
  }, [fine]);

  const avvia = (m) => {
    const indici = m === "errori" ? erroriEsame.map((k) => Number(k.split("-")[1])).filter((i) => banca[i]) : banca.map((_, i) => i);
    setOrdine(m === "simulazione" ? mescola(indici).slice(0, conf.domande) : mescola(indici));
    setPos(0); setScelte({}); setMostra(false); setFine(false); setModo(m);
    if (m === "simulazione") { setScadenza(Date.now() + conf.minuti * 60000); setAdesso(Date.now()); }
  };
  const segnaErrore = (i, sbagliata) => {
    const k = `${esame}-${i}`;
    const nuovi = sbagliata ? [...new Set([...errori, k])] : errori.filter((x) => x !== k);
    setErrori(nuovi); scriviErrori(nuovi);
  };
  const scegli = (r) => {
    const i = ordine[pos];
    setScelte({ ...scelte, [i]: r });
    if (modo !== "simulazione") { setMostra(true); segnaErrore(i, r !== banca[i].ok); }
  };
  const avanti = () => { if (pos + 1 >= ordine.length) setFine(true); else { setPos(pos + 1); setMostra(false); } };

  if (!modo) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(ESAMI).map(([k, e]) => <button key={k} type="button" onClick={() => setEsame(k)} style={stBtn(esame === k)}>{e.nome}</button>)}
        </div>
        <div style={stCard}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>🎯 Allenamento</div>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "4px 0 10px 0" }}>Una domanda alla volta: dopo ogni risposta vedi subito quella giusta e perché. {banca.length} domande.</p>
          <button type="button" onClick={() => avvia("allenamento")} style={stAzione}>Inizia</button>
        </div>
        <div style={stCard}>
          <div style={{ fontSize: 14.5, fontWeight: 700 }}>⏱️ Simulazione d'esame {conf.nome}</div>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "4px 0 10px 0" }}>{Math.min(conf.domande, banca.length)} domande in {conf.minuti} minuti, punteggio come all'esame: giusta +{conf.punti.giusta}{conf.punti.sbagliata ? `, sbagliata ${conf.punti.sbagliata}` : ""}, non data 0. Si passa con {conf.soglia} su {conf.massimo}. Le soluzioni alla fine.</p>
          <button type="button" onClick={() => avvia("simulazione")} style={stAzione}>Inizia la simulazione</button>
        </div>
        {erroriEsame.length > 0 && (
          <div style={stCard}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>🔁 Ripassa gli errori</div>
            <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "4px 0 10px 0" }}>{erroriEsame.length} {erroriEsame.length === 1 ? "domanda sbagliata" : "domande sbagliate"}: quando le indovini spariscono dall'elenco.</p>
            <button type="button" onClick={() => avvia("errori")} style={stSecondario}>Ripassa</button>
          </div>
        )}
        <p style={{ fontSize: 10.5, color: "#6b7480", margin: 0 }}>{AVVISO}</p>
      </div>
    );
  }

  if (fine) {
    const date = ordine.map((i) => ({ i, q: banca[i], s: scelte[i] }));
    const giuste = date.filter((x) => x.s === x.q.ok).length;
    const sbagliate = date.filter((x) => x.s != null && x.s !== x.q.ok).length;
    const punti = giuste * conf.punti.giusta + sbagliate * conf.punti.sbagliata;
    const massimo = date.length * conf.punti.giusta;
    const soglia = Math.ceil(massimo * 0.75);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ ...stCard, borderColor: modo !== "simulazione" ? "#2b313d" : punti >= soglia ? "#4ade80" : "#ff6b6b" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{modo !== "simulazione" ? `Fatto! ${giuste} giuste su ${date.length}` : punti >= soglia ? "✅ Superato!" : "❌ Non ancora"}</div>
          {modo === "simulazione" && <div style={{ fontSize: 13, color: "#c3cad4", marginTop: 4 }}>{punti} punti su {massimo} (serve {soglia}) · {giuste} giuste, {sbagliate} sbagliate, {date.length - giuste - sbagliate} non date</div>}
        </div>
        {modo === "simulazione" && date.filter((x) => x.s !== x.q.ok).map((x) => (
          <div key={x.i} style={stCard}><Domanda q={x.q} scelta={x.s} onScegli={() => {}} mostraEsito /></div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => avvia(modo)} style={stAzione}>Rifai</button>
          <button type="button" onClick={() => setModo(null)} style={stSecondario}>Torna ai quiz</button>
        </div>
      </div>
    );
  }

  const i = ordine[pos];
  const q = banca[i];
  const restano = scadenza ? Math.max(0, Math.round((scadenza - adesso) / 1000)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#8b95a3" }}>
        <span>Domanda {pos + 1} di {ordine.length}</span>
        {modo === "simulazione" && <span style={{ color: restano < 300 ? "#ff8c42" : "#8b95a3" }}>⏱️ {Math.floor(restano / 60)}:{String(restano % 60).padStart(2, "0")}</span>}
        <button type="button" onClick={() => (modo === "simulazione" ? setFine(true) : setModo(null))} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12, padding: 0 }}>{modo === "simulazione" ? "Consegna" : "Esci"}</button>
      </div>
      <div style={{ height: 4, background: "#262b33", borderRadius: 2 }}><div style={{ height: 4, width: `${((pos + 1) / ordine.length) * 100}%`, background: "#ff8c42", borderRadius: 2 }} /></div>
      <div style={stCard}><Domanda q={q} scelta={scelte[i]} onScegli={scegli} mostraEsito={mostra} /></div>
      {(mostra || modo === "simulazione") && (
        <button type="button" onClick={avanti} style={{ ...stAzione, alignSelf: "flex-end" }}>{pos + 1 >= ordine.length ? (modo === "simulazione" ? "Consegna" : "Fine") : modo === "simulazione" && scelte[i] == null ? "Salta →" : "Avanti →"}</button>
      )}
    </div>
  );
}

function SigleZone() {
  const [cerca, setCerca] = useState("");
  const elenco = SIGLE_ZONE.filter((x) => !cerca || `${x.sigla} ${x.nome} ${x.cosa}`.toLowerCase().includes(cerca.toLowerCase()));
  return (
    <details style={stCard}>
      <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700 }}>🔤 Le sigle spiegate</summary>
      <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "8px 0" }}>Su D-Flight trovi tante sigle: ecco cosa vogliono dire e cosa fare, senza giri di parole.</p>
      <input placeholder="🔍 Cerca una sigla (es. CTR, NOTAM, AMSL)" value={cerca} onChange={(e) => setCerca(e.target.value)} style={{ width: "100%", background: "#161a1f", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 8, padding: "8px 10px", fontSize: 13, marginBottom: 8 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {elenco.map((x) => (
          <div key={x.sigla} style={{ background: "#161a1f", borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}><span style={{ color: "#ff8c42" }}>{x.sigla}</span> · {x.nome}</div>
            <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 2 }}>{x.cosa}</div>
            <div style={{ fontSize: 12.5, color: "#4ade80", marginTop: 2 }}>✅ {x.fare}</div>
          </div>
        ))}
        {elenco.length === 0 && <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Sigla non trovata: guardala nella scheda della zona su D-Flight.</div>}
      </div>
    </details>
  );
}

export function ZonaRossa() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 13, color: "#c3cad4", margin: 0 }}>Hai trovato una zona rossa sulla mappa D-Flight o nella verifica zona di EyeDrones? Ecco cosa fare, passo per passo.</p>
      {GUIDA_ZONA_ROSSA.map((s, i) => (
        <details key={s.titolo} open={i < 2} style={stCard}>
          <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700 }}>{s.titolo}</summary>
          <ul style={{ margin: "10px 0 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#d6dde6" }}>
            {s.punti.map((p) => <li key={p} style={{ marginBottom: 4 }}>{p}</li>)}
          </ul>
        </details>
      ))}
      <SigleZone />

      <details style={stCard}>
        <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700 }}>📞 Chi contattare</summary>
        <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "8px 0" }}>Il contatto giusto è quasi sempre scritto nella scheda della zona su D-Flight (e nella verifica zona di EyeDrones). Ecco chi è, caso per caso:</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CONTATTI_ZONE.map((c) => (
            <div key={c.dove} style={{ background: "#161a1f", borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{c.emoji} {c.dove}</div>
              <div style={{ fontSize: 12.5, color: "#ffb877", marginTop: 2 }}>👉 {c.chi}</div>
              <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 2 }}>{c.come}</div>
            </div>
          ))}
        </div>
      </details>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href="https://www.d-flight.it/web-app/" target="_blank" rel="noreferrer" style={{ ...stSecondario, textDecoration: "none" }}>🗺️ Apri la mappa D-Flight ↗</a>
        <a href="https://www.enac.gov.it/sicurezza-aerea/droni/" target="_blank" rel="noreferrer" style={{ ...stSecondario, textDecoration: "none" }}>🏛️ Pagina droni ENAC ↗</a>
      </div>
      <p style={{ fontSize: 10.5, color: "#6b7480", margin: 0 }}>Guida pratica: le condizioni esatte di ogni zona e le procedure dell'ente prevalgono sempre. Controlla D-Flight prima di ogni volo.</p>
    </div>
  );
}

export default function Impara({ schedaIniziale = "a1a3", consigli, colore }) {
  const [scheda, setScheda] = useState(SCHEDE.some((s) => s.key === schedaIniziale) ? schedaIniziale : "a1a3");
  const [esameQuiz, setEsameQuiz] = useState("a1a3");
  useEffect(() => { if (SCHEDE.some((s) => s.key === schedaIniziale)) setScheda(schedaIniziale); }, [schedaIniziale]);
  const vaiQuiz = (e) => { setEsameQuiz(e); setScheda("quiz"); window.scrollTo(0, 0); };
  const corpo = scheda;
  return (
    <div style={{ padding: "28px 32px", maxWidth: 780 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Impara</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 14px 0" }}>Le regole spiegate semplici, i quiz per l'attestato, come muoverti in zona rossa e i consigli per volare meglio.</p>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        {SCHEDE.map((s) => <button key={s.key} type="button" onClick={() => setScheda(s.key)} style={stBtn(scheda === s.key)}>{s.label}</button>)}
      </div>
      {corpo === "a1a3" && <Lezioni esame="a1a3" onQuiz={() => vaiQuiz("a1a3")} />}
      {corpo === "a2" && <Lezioni esame="a2" onQuiz={() => vaiQuiz("a2")} />}
      {corpo === "quiz" && <Quiz key={esameQuiz} esameIniziale={esameQuiz} />}
      {corpo === "zona-rossa" && <ZonaRossa />}
      {corpo === "consigli" && <div style={{ margin: "0 -32px" }}>{consigli}</div>}
      {corpo === "notizie" && <Notizie />}
      {corpo === "manuale" && <Manuale colore={colore} />}
    </div>
  );
}
