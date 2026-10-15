import React, { useEffect, useRef, useState } from "react";

// Analisi di una foto con l'AI: difetti di foto/video, foto termiche, colore.
// La foto viene rimpicciolita nel telefono e mandata alla funzione analisi-foto (la chiave dell'AI resta sul server)
// ogni spazio vede le sue analisi (senza spazio scelto: tutte)
const TIPI = [
  { key: "problema", titolo: "🔧 Cosa non va?", sotto: "Bande, righe, macchie, immagine mossa, colori strani", spazi: ["video", "ispezioni", "rilievi", "agricoltura"] },
  { key: "colore", titolo: "🎨 Colore e LUT", sotto: "Esposizione, bilanciamento, che look usare", spazi: ["video"] },
  { key: "termica", titolo: "🌡️ Foto termica", sotto: "Pannelli, tetti, facciate: punti caldi e anomalie", spazi: ["ispezioni"] },
  { key: "coltura", titolo: "🌱 Cosa ha il campo?", sotto: "Chiazze gialle, piante secche, macchie sulle foglie", spazi: ["agricoltura"] },
  { key: "trattamento", titolo: "💧 Trattamento venuto bene?", sotto: "Strisce, zone saltate o passate due volte, deriva", spazi: ["agricoltura"] },
  { key: "erbacce", titolo: "🌿 Erbacce", sotto: "Dove sono e quanto sono fitte: tutto il campo o solo zone?", spazi: ["agricoltura"] },
  { key: "rilievo", titolo: "📐 Foto buone per il rilievo?", sotto: "Mosse, bruciate, ombre forti, poca texture: rifare il volo?", spazi: ["rilievi"] },
];
const PRIMO = { video: "problema", ispezioni: "termica", agricoltura: "coltura", rilievi: "rilievo" };
const TITOLI = {
  video: ["L'Esperto di foto e video", "Carica una foto o un video: l'AI ti dice cosa non va e come sistemare il colore."],
  ispezioni: ["L'Esperto per le ispezioni", "Carica una foto termica o normale: l'AI ti dice cosa vede e cosa controllare."],
  agricoltura: ["L'Esperto per l'agricoltura", "Carica una foto del campo: l'AI ti dice cosa sembra e cosa controllare. Non dà dosi né prodotti: quelli li dicono l'etichetta e l'agronomo."],
  rilievi: ["L'Esperto per i rilievi", "Carica alcune foto del volo: l'AI ti dice se vanno bene per la fotogrammetria o se conviene rifare."],
};

const DOMANDE = {
  problema: [
    ["C'è anche nel file salvato sulla scheda?", ["Sì", "No, solo sul radiocomando", "Non so"]],
    ["Il difetto si muove o resta fermo?", ["Si muove", "Resta fermo", "Non so"]],
    ["Quando capita?", ["Sempre", "Solo lontano o dietro ostacoli", "A volte", "Prima volta"]],
  ],
  termica: [
    ["Che cosa stai riprendendo?", ["Pannelli fotovoltaici", "Tetto o facciata", "Altro"]],
    ["Com'era il cielo?", ["Sole pieno", "Velato", "Nuvoloso", "Non so"]],
  ],
  colore: [
    ["Hai girato in profilo piatto (D-Log o simili)?", ["Sì", "No, colore normale", "Non so"]],
    ["Che risultato vuoi?", ["Naturale", "Caldo / cinematografico", "Freddo / moderno", "Consigliami tu"]],
  ],
  coltura: [
    ["Che coltura è?", ["Vite", "Cereali", "Mais", "Frutteto", "Ortaggi", "Altro"]],
    ["Da dove è fatta la foto?", ["Dal drone, dall'alto", "Da terra, da vicino"]],
    ["Il problema è…", ["A chiazze", "A righe o file", "Su tutto il campo", "Solo ai bordi"]],
    ["Che tempo ha fatto di recente?", ["Secco, caldo", "Molta pioggia", "Grandine o gelo", "Normale"]],
  ],
  trattamento: [
    ["Cosa hai distribuito?", ["Fitofarmaco", "Concime fogliare", "Seme o granulare", "Altro"]],
    ["Quanti giorni fa?", ["Oggi", "2-5 giorni", "Più di una settimana"]],
    ["Com'era il vento?", ["Calmo", "Leggero", "A raffiche", "Non so"]],
  ],
  erbacce: [
    ["Che coltura è?", ["Vite", "Cereali", "Mais", "Frutteto", "Ortaggi", "Altro"]],
    ["Da dove è fatta la foto?", ["Dal drone, dall'alto", "Da terra, da vicino"]],
  ],
  rilievo: [
    ["Che cosa stai rilevando?", ["Terreno o cava", "Edificio o facciata", "Strada o cantiere", "Altro"]],
    ["Che otturatore ha il drone?", ["Meccanico", "Elettronico (rolling)", "Non so"]],
    ["Com'era la luce?", ["Sole pieno", "Velato", "Nuvoloso uniforme", "Sole basso"]],
  ],
};

const LATO_MAX = 1568; // oltre non serve: l'AI la rimpicciolirebbe comunque

// da un'immagine o un fotogramma a un JPG leggero (base64 senza intestazione)
function comprimi(sorgente, larghezza, altezza) {
  const k = Math.min(1, LATO_MAX / Math.max(larghezza, altezza));
  const c = document.createElement("canvas");
  c.width = Math.round(larghezza * k); c.height = Math.round(altezza * k);
  c.getContext("2d").drawImage(sorgente, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.85);
  return { anteprima: url, dati: url.split(",")[1] };
}

function caricaImmagine(file) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { const r = comprimi(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(url); ok(r); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error("Non riesco ad aprire questa immagine: usa un JPG o PNG.")); };
    img.src = url;
  });
}

const PROBABILITA = { alta: ["#f87171", "molto probabile"], media: ["#f5b942", "possibile"], bassa: ["#8b95a3", "meno probabile"] };
const VOLO = {
  si: ["#4ade80", "✓ Puoi volare: non riguarda la sicurezza del volo"],
  con_attenzione: ["#f5b942", "⚠ Puoi volare con attenzione"],
  no: ["#f87171", "⛔ Meglio non volare finché non è risolto"],
};

export default function AnalisiAI({ supabase, droni, inputStyle, spazio }) {
  const tipi = TIPI.filter((t) => !spazio || t.spazi.includes(spazio));
  const [tipo, setTipo] = useState(PRIMO[spazio] || "problema");
  const [titolo, sottotitolo] = TITOLI[spazio] || ["Analisi foto con l'AI", "Carica una foto o un video, rispondi a qualche domanda e l'AI ti dice cosa vede e cosa controllare."];
  const [foto, setFoto] = useState(null); // { anteprima, dati }
  const [video, setVideo] = useState(null); // url del video da cui prendere un fotogramma
  const [risposte, setRisposte] = useState({});
  const [droneId, setDroneId] = useState(() => (droni && droni[0] ? droni[0].id : ""));
  const [nota, setNota] = useState("");
  const [stato, setStato] = useState(null); // "invio" | { esito, costo } | { errore }
  const videoRef = useRef(null);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video); }, [video]);

  const scegliFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStato(null);
    if (file.type.startsWith("video/")) { setFoto(null); setVideo(URL.createObjectURL(file)); return; }
    try { setVideo(null); setFoto(await caricaImmagine(file)); } catch (err) { setStato({ errore: err.message }); }
  };
  const usaFotogramma = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    setFoto(comprimi(v, v.videoWidth, v.videoHeight));
    setVideo(null);
  };

  const analizza = async () => {
    if (!foto) return;
    setStato("invio");
    try {
      const { data } = await supabase.auth.getSession();
      const drone = (droni || []).find((d) => d.id === droneId);
      const r = await fetch("/.netlify/functions/analisi-foto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ tipo, immagine: foto.dati, formato: "image/jpeg", risposte, nota, drone: drone ? [drone.modello, drone.nome].filter(Boolean).join(" · ") : "" }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.esito) {
        const lento = r.status === 502 || r.status === 504;
        setStato({ errore: (j && j.errore) || (lento ? "L'analisi ci ha messo troppo. Riprova: la seconda volta di solito va." : `Errore ${r.status}, riprova tra poco.`) });
        return;
      }
      setStato({ esito: j.esito, costo: j.costo_centesimi });
    } catch {
      setStato({ errore: "Connessione assente o interrotta: riprova quando hai campo." });
    }
  };

  const bottone = (attivo) => ({ background: attivo ? "#a78bfa22" : "#262b33", border: `1px solid ${attivo ? "#a78bfa" : "#333a45"}`, color: attivo ? "#c4b5fd" : "#c3cad4", borderRadius: 6, padding: "6px 10px", fontSize: 12 });
  const esito = stato && stato.esito;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px 0" }}>{titolo} <span style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", border: "1px solid #a78bfa66", borderRadius: 4, padding: "1px 6px", verticalAlign: "middle" }}>PROVA</span></h1>
      <p style={{ fontSize: 13, color: "#8b95a3", margin: "0 0 14px 0" }}>{sottotitolo}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8 }}>
        {tipi.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTipo(t.key); setRisposte({}); setStato(null); }} style={{ ...bottone(tipo === t.key), textAlign: "left", padding: "10px 12px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>{t.titolo}</div>
            <div style={{ fontSize: 11.5, color: "#8b95a3", marginTop: 2 }}>{t.sotto}</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12, background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: 12 }}>
        <label style={{ display: "inline-block", background: "#a78bfa", color: "#161a1f", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          📷 {foto ? "Cambia foto" : "Scegli foto o video"}
          <input type="file" accept="image/*,video/*" onChange={scegliFile} style={{ display: "none" }} />
        </label>
        {video && (
          <div style={{ marginTop: 10 }}>
            <video ref={videoRef} src={video} controls playsInline muted style={{ width: "100%", maxHeight: 320, borderRadius: 6, background: "#000" }} />
            <p style={{ fontSize: 12, color: "#c3cad4", margin: "6px 0" }}>Porta il video sul punto dove si vede il problema, poi:</p>
            <button type="button" onClick={usaFotogramma} style={{ ...bottone(true), fontWeight: 700 }}>✓ Usa questo fotogramma</button>
          </div>
        )}
        {foto && <img src={foto.anteprima} alt="Foto da analizzare" style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 6, marginTop: 10, background: "#0e1116" }} />}

        {(DOMANDE[tipo] || []).map(([domanda, scelte]) => (
          <div key={domanda} style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12.5, color: "#c3cad4", marginBottom: 5 }}>{domanda}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {scelte.map((s) => <button key={s} type="button" onClick={() => setRisposte({ ...risposte, [domanda]: s })} style={bottone(risposte[domanda] === s)}>{s}</button>)}
            </div>
          </div>
        ))}

        {droni && droni.length > 0 && (
          <label style={{ display: "block", fontSize: 12.5, color: "#c3cad4", marginTop: 12 }}>
            Drone
            <select value={droneId} onChange={(e) => setDroneId(e.target.value)} style={{ ...inputStyle, marginTop: 4 }}>
              <option value="">Non dirlo</option>
              {droni.map((d) => <option key={d.id} value={d.id}>{d.nome || d.modello}</option>)}
            </select>
          </label>
        )}
        <label style={{ display: "block", fontSize: 12.5, color: "#c3cad4", marginTop: 12 }}>
          Vuoi aggiungere qualcosa? <span style={{ color: "#6b7480" }}>(facoltativo)</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} placeholder={{ agricoltura: "es. passata a 3 m di altezza, larghezza 6 m", rilievi: "es. volo a 80 m, sovrapposizione 75%", ispezioni: "es. impianto da 200 kW, ore 12" }[spazio] || "es. è successo volando vicino a un traliccio"} style={{ ...inputStyle, marginTop: 4, resize: "vertical" }} />
        </label>

        <button type="button" onClick={analizza} disabled={!foto || stato === "invio"} style={{ marginTop: 12, background: foto ? "#a78bfa" : "#333a45", color: foto ? "#161a1f" : "#6b7480", border: "none", borderRadius: 6, padding: "9px 16px", fontSize: 13.5, fontWeight: 700 }}>
          {stato === "invio" ? "Analizzo… (qualche secondo)" : "✨ Analizza"}
        </button>
      </div>

      {stato && stato.errore && <p style={{ marginTop: 10, fontSize: 13, color: "#ff9c9c" }}>{stato.errore}</p>}

      {esito && (
        <div style={{ marginTop: 12, background: "#161a1f", border: "1px solid #a78bfa55", borderRadius: 8, padding: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{esito.cosa_sembra}</div>
          {VOLO[esito.si_puo_volare] && (
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: VOLO[esito.si_puo_volare][0] }}>
              {VOLO[esito.si_puo_volare][1]}{esito.nota_sicurezza ? <span style={{ fontWeight: 400, color: "#c3cad4" }}> · {esito.nota_sicurezza}</span> : null}
            </div>
          )}
          {esito.cause?.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b95a3", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 14 }}>{tipo === "rilievo" || tipo === "erbacce" ? "Cosa ho notato" : "Cause probabili"}</div>
              {esito.cause.map((c, i) => {
                const [col, et] = PROBABILITA[c.probabilita] || PROBABILITA.bassa;
                return (
                  <div key={i} style={{ marginTop: 8, borderLeft: `3px solid ${col}`, paddingLeft: 10 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.causa} <span style={{ fontSize: 11, color: col, fontWeight: 600 }}>· {et}</span></div>
                    <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 2, lineHeight: 1.5 }}>{c.perche}</div>
                  </div>
                );
              })}
            </>
          )}
          {esito.controlli?.length > 0 && (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8b95a3", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 14 }}>Cosa fare, in ordine</div>
              <ol style={{ margin: "6px 0 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.6, color: "#e7eaee" }}>
                {esito.controlli.map((c, i) => <li key={i}>{c}</li>)}
              </ol>
            </>
          )}
          {esito.serve_sapere && <p style={{ fontSize: 12.5, color: "#fde68a", margin: "12px 0 0 0" }}>💬 Per esserne sicuri: {esito.serve_sapere}</p>}
          <p style={{ fontSize: 10.5, color: "#6b7480", margin: "12px 0 0 0" }}>
            Analisi automatica: indica le cause più probabili, non è una certezza né una perizia.{stato.costo != null ? ` Costo di questa analisi: circa ${String(stato.costo).replace(".", ",")} centesimi.` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
