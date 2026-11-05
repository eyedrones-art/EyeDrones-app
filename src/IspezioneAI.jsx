import React, { useEffect, useRef, useState } from "react";
import { ScanSearch } from "lucide-react";
import { jsPDF } from "jspdf";
import { TestataPagina } from "./VoloHero.jsx";

// Ispezione con AI: il pilota carica tutte le foto di un'ispezione, l'AI propone le segnalazioni foto per foto
// (netlify/functions/ispezione-ai.js), il pilota le conferma, toglie o corregge, poi esce il PDF con il suo logo.
// 1 foto = 1 credito (gli stessi crediti dell'Esperto). Le foto restano nel telefono: non si salvano sul server.

const TIPI = [
  { key: "fotovoltaico", titolo: "☀️ Fotovoltaico", sotto: "Punti caldi, moduli e stringhe" },
  { key: "tetto", titolo: "🏠 Tetto", sotto: "Tegole, guaine, grondaie" },
  { key: "facciata", titolo: "🧱 Facciata", sotto: "Crepe, distacchi, umidità" },
  { key: "campo", titolo: "🌾 Campo", sotto: "Chiazze, diradamenti, ristagni" },
];
const GRAVITA = {
  bassa: { nome: "Bassa", colore: "#3d8bfd", rgb: [61, 139, 253] },
  media: { nome: "Media", colore: "#f5b942", rgb: [214, 150, 20] },
  alta: { nome: "Alta", colore: "#ff8c42", rgb: [230, 110, 40] },
  critica: { nome: "Critica", colore: "#ff4d4d", rgb: [210, 40, 40] },
};
const ORDINE_GRAVITA = ["critica", "alta", "media", "bassa"];
// i pacchetti (gli stessi di netlify/functions/esperto-acquisto.js)
const PACCHETTI = [
  { key: "i30", foto: 30, prezzo: "4,99 €" },
  { key: "i100", foto: 100, prezzo: "12,99 €", nota: "consigliato" },
  { key: "i300", foto: 300, prezzo: "29,99 €" },
];
const MAX_FOTO = 300;
const LATO_MAX = 1568;
const IN_PARALLELO = 2;

// foto → JPG leggero per l'AI e per il PDF
function comprimi(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, LATO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      ok({ url: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height });
    };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("immagine non leggibile")); };
    img.src = url;
  });
}

// la foto con i rettangoli delle segnalazioni confermate, numerati (per il PDF)
function fotoConRiquadri(f, segn) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = f.w; c.height = f.h;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const spessore = Math.max(3, Math.round(f.w / 300));
      segn.forEach((s, i) => {
        const col = GRAVITA[s.gravita]?.colore || "#ff8c42";
        g.strokeStyle = col; g.lineWidth = spessore;
        g.strokeRect(s.x * f.w, s.y * f.h, s.larghezza * f.w, s.altezza * f.h);
        const r = spessore * 5;
        g.fillStyle = col; g.beginPath(); g.arc(s.x * f.w + r, s.y * f.h + r, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.font = `bold ${Math.round(r * 1.2)}px Arial`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(i + 1), s.x * f.w + r, s.y * f.h + r + 1);
      });
      ok(c.toDataURL("image/jpeg", 0.82));
    };
    img.src = f.url;
  });
}

export default function IspezioneAI({ supabase, azienda, inputStyle, admin }) {
  const [tipo, setTipo] = useState("fotovoltaico");
  const [titolo, setTitolo] = useState("");
  const [cliente, setCliente] = useState("");
  const [nota, setNota] = useState("");
  const [foto, setFoto] = useState([]); // [{ id, nome, url, w, h, stato: "attesa"|"analisi"|"fatta"|"errore", errore, sintesi, qualita, notaQualita, segn: [{..., stato: "proposta"|"confermata"|"tolta"}] }]
  const [lavoro, setLavoro] = useState(null); // null | "carico" | "analisi" | "fermo"
  const [crediti, setCrediti] = useState(null);
  const [errore, setErrore] = useState(null);
  const [acquisto, setAcquisto] = useState(null);
  const [aperta, setAperta] = useState(null); // id della foto aperta nel controllo
  const [pdf, setPdf] = useState(null); // null | "creo" | messaggio
  const stop = useRef(false);
  const fotoRef = useRef(foto);
  fotoRef.current = foto;

  const leggiCrediti = async () => {
    if (admin || !supabase) return;
    const { data, error } = await supabase.rpc("crediti_esperto");
    if (!error && typeof data === "number") setCrediti(data);
  };
  useEffect(() => { leggiCrediti(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // non perdere il lavoro per sbaglio: le foto sono solo nel telefono
  useEffect(() => {
    const avvisa = (e) => { if (fotoRef.current.length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", avvisa);
    return () => window.removeEventListener("beforeunload", avvisa);
  }, []);

  const aggiorna = (id, cambi) => setFoto((l) => l.map((f) => (f.id === id ? { ...f, ...(typeof cambi === "function" ? cambi(f) : cambi) } : f)));

  const scegliFoto = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => /^image\//.test(f.type));
    e.target.value = "";
    if (!files.length) return;
    const posto = MAX_FOTO - foto.length;
    if (posto <= 0) { setErrore(`Al massimo ${MAX_FOTO} foto per ispezione.`); return; }
    setLavoro("carico"); setErrore(null);
    const nuove = [];
    for (const file of files.slice(0, posto)) {
      try { const c = await comprimi(file); nuove.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nome: file.name, ...c, stato: "attesa", segn: [] }); } catch { /* foto non leggibile: la salto */ }
    }
    setFoto((l) => [...l, ...nuove]);
    if (files.length > posto) setErrore(`Ho preso le prime ${posto} foto: al massimo ${MAX_FOTO} per ispezione.`);
    setLavoro(null);
  };

  const analizzaUna = async (f, token) => {
    aggiorna(f.id, { stato: "analisi", errore: null });
    for (let prova = 0; prova < 3; prova++) {
      try {
        const r = await fetch("/.netlify/functions/ispezione-ai", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tipo, immagine: f.url, nota }),
        });
        const j = await r.json().catch(() => null);
        if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 4000 * (prova + 1))); continue; }
        if (r.status === 402) { stop.current = true; aggiorna(f.id, { stato: "attesa" }); setErrore("Hai finito i crediti: scegli un pacchetto e poi tocca «Continua l'analisi»."); setCrediti(0); return; }
        if (!r.ok || !j?.esito) { aggiorna(f.id, { stato: "errore", errore: j?.errore || `Errore ${r.status}` }); return; }
        const e = j.esito;
        aggiorna(f.id, { stato: "fatta", sintesi: e.sintesi, qualita: e.qualita_foto, notaQualita: e.nota_qualita, segn: (e.segnalazioni || []).map((s) => ({ ...s, stato: "proposta" })) });
        if (typeof j.crediti === "number") setCrediti(j.crediti);
        return;
      } catch { await new Promise((ok) => setTimeout(ok, 3000)); }
    }
    aggiorna(f.id, { stato: "errore", errore: "Connessione assente: riprova." });
  };

  const analizza = async () => {
    const daFare = foto.filter((f) => f.stato === "attesa" || f.stato === "errore");
    if (!daFare.length) return;
    if (!admin && crediti != null && crediti < daFare.length) { setErrore(`Servono ${daFare.length} crediti e ne hai ${crediti}: scegli un pacchetto qui sotto, oppure analizzo le prime ${crediti}.`); if (crediti <= 0) return; }
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token || "";
    stop.current = false; setLavoro("analisi"); setErrore(null);
    const coda = [...daFare];
    const operaio = async () => { while (coda.length && !stop.current) await analizzaUna(coda.shift(), token); };
    await Promise.all(Array.from({ length: IN_PARALLELO }, operaio));
    setLavoro(stop.current ? "fermo" : null);
  };

  const compra = async (pacchetto) => {
    setAcquisto(pacchetto);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch("/.netlify/functions/esperto-acquisto", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` }, body: JSON.stringify({ pacchetto }) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.url) { setAcquisto({ errore: j?.errore || `Errore ${r.status}` }); return; }
      window.location.href = j.url;
    } catch { setAcquisto({ errore: "Connessione assente: riprova." }); }
  };

  const cambiaSegn = (idFoto, i, cambi) => aggiorna(idFoto, (f) => ({ segn: f.segn.map((s, k) => (k === i ? { ...s, ...cambi } : s)) }));
  const aggiungiSegn = (idFoto) => aggiorna(idFoto, (f) => ({ segn: [...f.segn, { tipo: "", gravita: "media", descrizione: "", consiglio: "", x: 0.4, y: 0.4, larghezza: 0.2, altezza: 0.2, stato: "confermata", aMano: true }] }));
  const confermaTutte = (idFoto) => aggiorna(idFoto, (f) => ({ segn: f.segn.map((s) => (s.stato === "proposta" ? { ...s, stato: "confermata" } : s)) }));

  const fatte = foto.filter((f) => f.stato === "fatta");
  const daControllare = fatte.reduce((n, f) => n + f.segn.filter((s) => s.stato === "proposta").length, 0);
  const confermate = fatte.flatMap((f) => f.segn.filter((s) => s.stato === "confermata"));
  const perGravita = ORDINE_GRAVITA.map((g) => [g, confermate.filter((s) => s.gravita === g).length]);

  const creaPdf = async () => {
    setPdf("creo");
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const nomeAz = azienda?.nome || "EyeDrones";
      const scuro = [16, 20, 31];
      // copertina
      doc.setFillColor(...scuro); doc.rect(0, 0, 210, 60, "F");
      if (azienda?.logo && /^data:image\/(png|jpe?g)/.test(azienda.logo)) { try { doc.addImage(azienda.logo, azienda.logo.includes("png") ? "PNG" : "JPEG", 15, 12, 36, 36, undefined, "FAST"); } catch { /* logo non valido */ } }
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.text(nomeAz.toUpperCase(), 195, 18, { align: "right" });
      doc.setFontSize(22); doc.text("REPORT DI ISPEZIONE", 195, 34, { align: "right" });
      doc.setFontSize(11); doc.text(TIPI.find((t) => t.key === tipo).titolo.replace(/^\S+\s/, ""), 195, 43, { align: "right" });
      let y = 76;
      doc.setTextColor(30, 30, 30); doc.setFontSize(16);
      doc.text(doc.splitTextToSize(titolo || "Ispezione con drone", 180), 15, y); y += 10;
      doc.setFontSize(10); doc.setTextColor(90, 90, 90);
      doc.text(`Data: ${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`, 15, y); y += 6;
      if (cliente) { doc.text(`Cliente: ${cliente}`, 15, y); y += 6; }
      doc.text(`Foto esaminate: ${fatte.length} · Segnalazioni: ${confermate.length}`, 15, y); y += 12;
      doc.setTextColor(30, 30, 30); doc.setFontSize(12); doc.text("Riepilogo per gravità", 15, y); y += 8;
      perGravita.forEach(([g, n]) => {
        doc.setFillColor(...GRAVITA[g].rgb); doc.roundedRect(15, y - 4.5, 4, 4, 1, 1, "F");
        doc.setFontSize(10.5); doc.setTextColor(40, 40, 40); doc.text(`${GRAVITA[g].nome}: ${n}`, 22, y); y += 7;
      });
      y += 4;
      doc.setFontSize(8.5); doc.setTextColor(120, 120, 120);
      doc.text(doc.splitTextToSize("Bassa: da tenere d'occhio · Media: da sistemare con calma · Alta: da sistemare presto · Critica: rischio per la sicurezza o danni in corso. Le segnalazioni sono state proposte con l'aiuto dell'intelligenza artificiale e controllate una per una dal pilota. Posizioni indicative; le temperature lette sulle immagini a colori non sono misure.", 180), 15, y);

      // una pagina per ogni foto con segnalazioni confermate (numerate)
      let num = 0;
      for (const f of fatte) {
        const segn = f.segn.filter((s) => s.stato === "confermata").sort((a, b) => ORDINE_GRAVITA.indexOf(a.gravita) - ORDINE_GRAVITA.indexOf(b.gravita));
        if (!segn.length) continue;
        num++;
        doc.addPage();
        doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text(`${nomeAz} · ${titolo || "Ispezione"}`, 15, 12); doc.text(`Foto ${num}`, 195, 12, { align: "right" });
        const img = await fotoConRiquadri(f, segn);
        const larg = 180, alt = Math.min(130, (larg * f.h) / f.w), l2 = (alt * f.w) / f.h;
        doc.addImage(img, "JPEG", 15 + (larg - l2) / 2, 18, l2, alt, undefined, "FAST");
        doc.setFontSize(8); doc.setTextColor(140, 140, 140); doc.text(f.nome || "", 15, 18 + alt + 4);
        let yy = 18 + alt + 12;
        segn.forEach((s, i) => {
          const righeD = doc.splitTextToSize(s.descrizione || "", 168), righeC = doc.splitTextToSize(s.consiglio ? `Consiglio: ${s.consiglio}` : "", 168);
          const servono = 7 + righeD.length * 4.4 + righeC.length * 4.4 + 4;
          if (yy + servono > 285) { doc.addPage(); yy = 18; }
          doc.setFillColor(...(GRAVITA[s.gravita]?.rgb || [230, 110, 40])); doc.circle(18, yy - 1.3, 3, "F");
          doc.setTextColor(255, 255, 255); doc.setFontSize(8.5); doc.text(String(i + 1), 18, yy, { align: "center" });
          doc.setTextColor(30, 30, 30); doc.setFontSize(11); doc.text(`${s.tipo || "Segnalazione"}`, 24, yy);
          doc.setFontSize(9); doc.setTextColor(...(GRAVITA[s.gravita]?.rgb || [0, 0, 0])); doc.text(`Gravità: ${GRAVITA[s.gravita]?.nome || "—"}`, 195, yy, { align: "right" });
          yy += 6;
          doc.setTextColor(60, 60, 60); doc.setFontSize(9.5); doc.text(righeD, 24, yy); yy += righeD.length * 4.4;
          if (righeC.length && righeC[0]) { doc.setTextColor(30, 90, 50); doc.text(righeC, 24, yy); yy += righeC.length * 4.4; }
          yy += 4;
        });
      }
      const pagine = doc.getNumberOfPages();
      for (let p = 1; p <= pagine; p++) { doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150, 150, 150); doc.text(`${nomeAz} · pagina ${p} di ${pagine}`, 105, 292, { align: "center" }); }
      const nome = `Report-ispezione-${(titolo || "drone").replace(/[^\w-]+/g, "-").slice(0, 40)}.pdf`;
      const file = new File([doc.output("blob")], nome, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nome }); } catch (e) { if (e?.name !== "AbortError") doc.save(nome); }
      } else doc.save(nome);
      setPdf(null);
    } catch {
      setPdf("Non sono riuscito a creare il PDF: riprova.");
    }
  };

  const st = {
    box: { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 16, marginBottom: 16, maxWidth: 760 },
    titolo: { fontSize: 15, fontWeight: 800, margin: "0 0 10px 0" },
    chip: (on) => ({ background: on ? "#ff8c4222" : "#10141f", border: `1px solid ${on ? "#ff8c42" : "#343e57"}`, color: on ? "#ffb48f" : "#c3cad4", borderRadius: 10, padding: "10px 12px", textAlign: "left", flex: "1 1 150px" }),
    bottone: { background: "linear-gradient(90deg, #e0552f, #ff8c42)", color: "#10141f", border: "none", borderRadius: 8, padding: "11px 16px", fontSize: 14.5, fontWeight: 800, minHeight: 44 },
    secondario: { background: "#232b3f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 700 },
  };
  const analizzate = foto.filter((f) => f.stato === "fatta" || f.stato === "errore").length;
  const daAnalizzare = foto.filter((f) => f.stato === "attesa" || f.stato === "errore").length;
  const fotoAperta = foto.find((f) => f.id === aperta);

  return (
    <div style={{ paddingBottom: 40 }}>
      <TestataPagina titolo="Ispezione con AI" sigla="AI · REPORT DI ISPEZIONE" icona={ScanSearch} info="Carichi le foto dell'ispezione, l'AI propone i difetti foto per foto e tu li controlli uno per uno. Poi esce il report in PDF con il tuo logo. Le foto restano nel telefono." />
      <div style={{ padding: "0 16px" }}>
        {/* 1. l'ispezione */}
        <section style={st.box}>
          <h2 style={st.titolo}>1 · Che ispezione è?</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {TIPI.map((t) => <button key={t.key} type="button" onClick={() => setTipo(t.key)} aria-pressed={tipo === t.key} disabled={lavoro === "analisi"} style={st.chip(tipo === t.key)}><b style={{ display: "block", fontSize: 14 }}>{t.titolo}</b><span style={{ fontSize: 12, color: "#8b95a3" }}>{t.sotto}</span></button>)}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input id="isp-titolo" value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo, es. Impianto 20 kW · Via Roma 5, Chieri" style={inputStyle} />
            <input id="isp-cliente" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Cliente (facoltativo)" style={inputStyle} />
            <input id="isp-nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota per l'AI (facoltativa), es. foto termiche DJI H20T, moduli policristallini" style={inputStyle} />
          </div>
        </section>

        {/* 2. le foto */}
        <section style={st.box}>
          <h2 style={st.titolo}>2 · Le foto {foto.length ? <span style={{ color: "#8b95a3", fontWeight: 600, fontSize: 13 }}>· {foto.length}</span> : null}</h2>
          <label style={{ ...st.secondario, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            📷 {foto.length ? "Aggiungi altre foto" : "Scegli le foto"}
            <input type="file" accept="image/*" multiple onChange={scegliFoto} style={{ display: "none" }} disabled={lavoro === "analisi" || lavoro === "carico"} />
          </label>
          {lavoro === "carico" && <span style={{ marginLeft: 10, fontSize: 13, color: "#8b95a3" }}>Preparo le foto…</span>}
          <p style={{ fontSize: 12, color: "#6b7480", margin: "8px 0 0 0" }}>Fino a {MAX_FOTO} foto. Ogni foto analizzata usa 1 credito.{admin ? " (Amministratore: nessun credito.)" : crediti != null ? ` Crediti rimasti: ${crediti}.` : ""}</p>
          {foto.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 6, marginTop: 12 }}>
              {foto.map((f) => {
                const n = f.segn.filter((s) => s.stato !== "tolta").length;
                return (
                  <button key={f.id} type="button" onClick={() => f.stato === "fatta" && setAperta(f.id)} title={f.nome} style={{ position: "relative", padding: 0, border: `2px solid ${f.stato === "errore" ? "#ff6b6b" : f.stato === "fatta" ? (n ? "#ff8c42" : "#2c5a3f") : "#2a3349"}`, borderRadius: 8, overflow: "hidden", aspectRatio: "1", background: "#10141f", maxWidth: "100%" }}>
                    <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: f.stato === "analisi" ? 0.5 : 1 }} />
                    <span style={{ position: "absolute", left: 3, bottom: 3, background: "rgba(10,13,24,.8)", color: "#fff", fontSize: 11, borderRadius: 6, padding: "1px 5px" }}>
                      {f.stato === "analisi" ? "…" : f.stato === "errore" ? "!" : f.stato === "fatta" ? (n ? `⚠ ${n}` : "✓") : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {foto.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {daAnalizzare > 0 && lavoro !== "analisi" && <button type="button" onClick={analizza} style={st.bottone}>{lavoro === "fermo" ? "Continua l'analisi" : `🔍 Analizza ${daAnalizzare} ${daAnalizzare === 1 ? "foto" : "foto"} con l'AI`}</button>}
              {lavoro === "analisi" && <>
                <div style={{ flex: "1 1 200px", height: 8, background: "#232b3f", borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${Math.round((analizzate / foto.length) * 100)}%`, height: "100%", background: "#ff8c42", transition: "width .3s" }} /></div>
                <span style={{ fontSize: 13, color: "#c3cad4" }}>{analizzate} di {foto.length}</span>
                <button type="button" onClick={() => { stop.current = true; }} style={st.secondario}>Ferma</button>
              </>}
            </div>
          )}
          {lavoro === "analisi" && <p style={{ fontSize: 12, color: "#f5b942", margin: "8px 0 0 0" }}>Tieni aperta questa pagina finché finisce.</p>}
          {errore && <p role="alert" style={{ fontSize: 13, color: "#ff9c9c", margin: "10px 0 0 0" }}>{errore}</p>}
          {!admin && crediti != null && crediti < Math.max(1, daAnalizzare) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {PACCHETTI.map((p) => <button key={p.key} type="button" onClick={() => compra(p.key)} disabled={acquisto === p.key} style={{ ...st.secondario, flex: "1 1 140px", textAlign: "left" }}><b style={{ display: "block" }}>Fino a {p.foto} foto</b><span style={{ color: "#ffb48f" }}>{p.prezzo}</span>{p.nota && <span style={{ color: "#8b95a3", fontSize: 11.5 }}> · {p.nota}</span>}</button>)}
              {acquisto?.errore && <p style={{ fontSize: 12.5, color: "#ff9c9c", margin: 0, flexBasis: "100%" }}>{acquisto.errore}</p>}
            </div>
          )}
        </section>

        {/* 3. il controllo del pilota */}
        {fatte.length > 0 && (
          <section style={st.box}>
            <h2 style={st.titolo}>3 · Controlla le segnalazioni</h2>
            <p style={{ fontSize: 13, color: "#c3cad4", margin: "0 0 10px 0" }}>L'AI propone, tu decidi: nel report vanno solo quelle che confermi. {daControllare > 0 ? <b style={{ color: "#ffb48f" }}>{daControllare} da controllare.</b> : <b style={{ color: "#4ade80" }}>Tutte controllate.</b>}</p>
            <div style={{ display: "grid", gap: 6 }}>
              {fatte.map((f, i) => {
                const prop = f.segn.filter((s) => s.stato === "proposta").length, conf = f.segn.filter((s) => s.stato === "confermata").length;
                return (
                  <button key={f.id} type="button" onClick={() => setAperta(aperta === f.id ? null : f.id)} style={{ display: "flex", gap: 10, alignItems: "center", textAlign: "left", background: aperta === f.id ? "#1d2633" : "#10141f", border: "1px solid #2a3349", borderRadius: 8, padding: 6, color: "#e7eaee" }}>
                    <img src={f.url} alt="" style={{ width: 56, height: 42, objectFit: "cover", borderRadius: 4, flex: "none" }} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}><b>Foto {i + 1}</b> <span style={{ color: "#8b95a3" }}>{f.sintesi ? `· ${f.sintesi}` : ""}</span></span>
                    <span style={{ fontSize: 12, color: prop ? "#ffb48f" : conf ? "#4ade80" : "#8b95a3", flex: "none" }}>{prop ? `${prop} da vedere` : conf ? `${conf} ✓` : "niente"}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {fotoAperta && (
          <section style={{ ...st.box, borderColor: "#ff8c4288" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ ...st.titolo, margin: 0 }}>Foto {fatte.indexOf(fotoAperta) + 1}</h2>
              <button type="button" onClick={() => setAperta(null)} style={{ ...st.secondario, padding: "6px 10px" }}>Chiudi</button>
            </div>
            <div style={{ position: "relative", width: "100%", maxWidth: 720, aspectRatio: `${fotoAperta.w} / ${fotoAperta.h}`, borderRadius: 8, overflow: "hidden" }}>
              <img src={fotoAperta.url} alt="" style={{ width: "100%", height: "100%", display: "block" }} />
              {fotoAperta.segn.map((s, i) => s.stato !== "tolta" && (
                <div key={i} style={{ position: "absolute", left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.larghezza * 100}%`, height: `${s.altezza * 100}%`, border: `2px ${s.stato === "proposta" ? "dashed" : "solid"} ${GRAVITA[s.gravita]?.colore || "#ff8c42"}`, borderRadius: 3 }}>
                  <span style={{ position: "absolute", left: -2, top: -2, background: GRAVITA[s.gravita]?.colore || "#ff8c42", color: "#10141f", fontSize: 11, fontWeight: 800, borderRadius: 3, padding: "0 4px" }}>{i + 1}</span>
                </div>
              ))}
            </div>
            {fotoAperta.qualita === "scarsa" && <p style={{ fontSize: 12.5, color: "#f5b942", margin: "8px 0 0 0" }}>⚠ Foto poco utilizzabile: {fotoAperta.notaQualita}</p>}
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              {fotoAperta.segn.map((s, i) => (
                <div key={i} style={{ background: "#10141f", border: `1px solid ${s.stato === "confermata" ? "#2c5a3f" : s.stato === "tolta" ? "#2a3349" : "#ff8c4266"}`, borderRadius: 8, padding: 10, opacity: s.stato === "tolta" ? 0.55 : 1, display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13, color: GRAVITA[s.gravita]?.colore }}>{i + 1}</b>
                    <input value={s.tipo} onChange={(e) => cambiaSegn(fotoAperta.id, i, { tipo: e.target.value })} placeholder="Che difetto è" style={{ ...inputStyle, flex: "1 1 160px", padding: "6px 9px" }} />
                    <select value={s.gravita} onChange={(e) => cambiaSegn(fotoAperta.id, i, { gravita: e.target.value })} style={{ ...inputStyle, width: "auto", padding: "6px 9px" }}>{ORDINE_GRAVITA.map((g) => <option key={g} value={g}>{GRAVITA[g].nome}</option>)}</select>
                  </div>
                  <textarea rows={2} value={s.descrizione} onChange={(e) => cambiaSegn(fotoAperta.id, i, { descrizione: e.target.value })} placeholder="Cosa si vede" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                  <input value={s.consiglio} onChange={(e) => cambiaSegn(fotoAperta.id, i, { consiglio: e.target.value })} placeholder="Consiglio per il cliente" style={inputStyle} />
                  <div style={{ display: "flex", gap: 6 }}>
                    {s.stato !== "confermata" && <button type="button" onClick={() => cambiaSegn(fotoAperta.id, i, { stato: "confermata" })} style={{ ...st.secondario, borderColor: "#2c5a3f", color: "#86efac" }}>✓ Conferma</button>}
                    {s.stato !== "tolta" && <button type="button" onClick={() => cambiaSegn(fotoAperta.id, i, { stato: "tolta" })} style={{ ...st.secondario, color: "#ff9c9c" }}>✕ Togli</button>}
                    {s.stato === "tolta" && <button type="button" onClick={() => cambiaSegn(fotoAperta.id, i, { stato: "proposta" })} style={st.secondario}>Rimetti</button>}
                  </div>
                </div>
              ))}
              {!fotoAperta.segn.length && <p style={{ fontSize: 13, color: "#8b95a3", margin: 0 }}>L'AI non ha visto difetti in questa foto.</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {fotoAperta.segn.some((s) => s.stato === "proposta") && <button type="button" onClick={() => confermaTutte(fotoAperta.id)} style={{ ...st.secondario, borderColor: "#2c5a3f", color: "#86efac" }}>✓ Conferma tutte</button>}
                <button type="button" onClick={() => aggiungiSegn(fotoAperta.id)} style={st.secondario}>＋ Aggiungi una segnalazione</button>
              </div>
            </div>
          </section>
        )}

        {/* 4. il report */}
        {fatte.length > 0 && (
          <section style={st.box}>
            <h2 style={st.titolo}>4 · Il report in PDF</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {perGravita.map(([g, n]) => <span key={g} style={{ fontSize: 12.5, border: `1px solid ${GRAVITA[g].colore}`, color: GRAVITA[g].colore, borderRadius: 14, padding: "3px 10px" }}>{GRAVITA[g].nome}: {n}</span>)}
            </div>
            {daControllare > 0 && <p style={{ fontSize: 12.5, color: "#f5b942", margin: "0 0 10px 0" }}>Ci sono ancora {daControllare} segnalazioni da controllare: nel report vanno solo quelle confermate.</p>}
            <button type="button" onClick={creaPdf} disabled={pdf === "creo" || !confermate.length} style={{ ...st.bottone, opacity: confermate.length ? 1 : 0.5 }}>{pdf === "creo" ? "Creo il PDF…" : "📄 Crea il report PDF"}</button>
            {!confermate.length && <p style={{ fontSize: 12, color: "#6b7480", margin: "8px 0 0 0" }}>Conferma almeno una segnalazione per creare il report.</p>}
            {pdf && pdf !== "creo" && <p role="alert" style={{ fontSize: 12.5, color: "#ff9c9c", margin: "8px 0 0 0" }}>{pdf}</p>}
            <p style={{ fontSize: 12, color: "#6b7480", margin: "10px 0 0 0" }}>Con il tuo logo (Impostazioni azienda), foto numerate, gravità e consigli. Per consegnarlo con «Trova un pilota»: in «Consegna il lavoro» tocca «📄 Carica un file» e scegli il PDF.</p>
          </section>
        )}
      </div>
    </div>
  );
}
