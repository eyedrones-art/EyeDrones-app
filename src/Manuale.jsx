import React, { useEffect, useState } from "react";

// «Manuale foto e video»: dal volo alla consegna. Ogni sezione ha un id, così la lista «Dopo il volo»
// può aprire direttamente quella giusta (sessionStorage «eyedrones_manuale_sezione»).
const CHIAVE_SEZIONE = "eyedrones_manuale_sezione";
export function apriManuale(sezione) {
  try { sessionStorage.setItem(CHIAVE_SEZIONE, sezione); } catch { /* niente */ }
  window.dispatchEvent(new CustomEvent("eyedrones-vai", { detail: { pagina: "impara", scheda: "manuale" } }));
}

const stCard = { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, padding: "12px 14px" };
const stLista = { margin: "8px 0 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: "#d6dde6" };
const Lista = ({ voci }) => <ul style={stLista}>{voci.map((v) => <li key={v} style={{ marginBottom: 3 }}>{v}</li>)}</ul>;
const Sotto = ({ children }) => <div style={{ fontSize: 12.5, fontWeight: 700, color: "#ffb877", margin: "12px 0 0 0" }}>{children}</div>;

function Tabella({ righe, intestazione }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 520, width: "100%" }}>
        <thead><tr>{intestazione.map((h) => <th key={h} style={{ textAlign: "left", color: "#8b95a3", fontWeight: 600, padding: "6px 8px", borderBottom: "1px solid #333a45" }}>{h}</th>)}</tr></thead>
        <tbody>{righe.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} style={{ padding: "6px 8px", borderBottom: "1px solid #262b33", color: i === 0 ? "#e7eaee" : "#c3cad4", fontWeight: i === 0 ? 600 : 400 }}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}


// --- Esempi visivi del colore: lo stesso paesaggio con gli errori più comuni ---------------------
// Un disegno (non una ripresa vera) colorato con filtri, così si vede subito la differenza
function Paesaggio() {
  return (
    <svg viewBox="0 0 300 190" width="100%" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id="mn-cielo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#fbcf8f" /></linearGradient>
        <linearGradient id="mn-lago" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e6fa8" /><stop offset="1" stopColor="#0e3b5c" /></linearGradient>
      </defs>
      <rect width="300" height="190" fill="url(#mn-cielo)" />
      <ellipse cx="80" cy="40" rx="38" ry="9" fill="#ffffff" opacity=".85" />
      <circle cx="232" cy="58" r="17" fill="#fde68a" />
      <path d="M0 112 L56 72 L106 102 L156 62 L212 98 L300 68 L300 190 L0 190Z" fill="#3f6d3a" />
      <path d="M0 128 Q74 112 150 125 T300 122 L300 190 L0 190Z" fill="#4d8b3f" />
      <path d="M20 152 Q150 136 280 154 L280 176 Q150 168 20 176Z" fill="url(#mn-lago)" />
      <rect x="186" y="110" width="30" height="24" fill="#f3efe8" />
      <polygon points="182,111 201,96 220,111" fill="#b91c1c" />
      <rect x="196" y="121" width="8" height="13" fill="#7c4a2d" />
    </svg>
  );
}
const ESEMPI_COLORE = [
  { titolo: "Giusto", ok: true, filtro: "none", testo: "Bianchi bianchi (casa, nuvole), erba verde naturale, cielo azzurro con i dettagli, neri profondi ma non chiusi." },
  { titolo: "D-Log appena girato", ok: null, filtro: "saturate(.35) contrast(.6) brightness(1.12)", testo: "Grigio e piatto: è normale, non è un errore. Serve la LUT per «svilupparlo»." },
  { titolo: "Troppo saturo", ok: false, filtro: "saturate(2.3) contrast(1.15)", testo: "Erba fosforescente e cielo finto. Si vede subito che è ritoccato: usa la vividezza, non la saturazione." },
  { titolo: "Troppo caldo", ok: false, filtro: "sepia(.55) saturate(1.5) hue-rotate(-12deg)", testo: "Tutto arancione: il bianco della casa diventa giallo. Abbassa la temperatura finché i bianchi tornano bianchi." },
  { titolo: "Troppo freddo", ok: false, filtro: "hue-rotate(18deg) saturate(.9) brightness(.97)", sovrapposto: "rgba(70,130,255,.28)", testo: "Tutto azzurro e triste. Alza la temperatura (più verso il giallo)." },
  { titolo: "Cielo bruciato", ok: false, filtro: "brightness(1.55) contrast(.85)", testo: "Il cielo è bianco, senza dettagli: non si recupera. Già quando giri: esposizione −0,7 e guarda l'istogramma." },
  { titolo: "Neri chiusi", ok: false, filtro: "contrast(1.7) brightness(.78)", testo: "Troppo contrasto: le ombre diventano macchie nere senza dettagli. Togli contrasto o schiarisci le ombre." },
  { titolo: "Clip diverse tra loro", ok: false, mezzo: true, testo: "Una ripresa calda e la successiva fredda: nel montaggio «salta». Stesso bianco e stessa correzione per tutte le clip." },
];
function Esempio({ e }) {
  const colore = e.ok === true ? "#4ade80" : e.ok === false ? "#ff6b6b" : "#f5b942";
  return (
    <figure style={{ margin: 0, background: "#161a1f", border: `1px solid ${colore}55`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ position: "relative" }}>
        {e.mezzo ? (
          <div style={{ display: "flex" }}>
            <div style={{ width: "50%", overflow: "hidden", filter: "sepia(.45) saturate(1.4) hue-rotate(-10deg)" }}><div style={{ width: "200%" }}><Paesaggio /></div></div>
            <div style={{ width: "50%", overflow: "hidden", position: "relative" }}><div style={{ width: "200%", marginLeft: "-100%", filter: "hue-rotate(18deg)" }}><Paesaggio /></div><div style={{ position: "absolute", inset: 0, background: "rgba(70,130,255,.25)" }} /></div>
          </div>
        ) : (
          <div style={{ filter: e.filtro }}><Paesaggio /></div>
        )}
        {e.sovrapposto && <div style={{ position: "absolute", inset: 0, background: e.sovrapposto }} />}
        <span style={{ position: "absolute", left: 6, top: 6, background: "rgba(0,0,0,.65)", color: colore, fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5 }}>{e.ok === true ? "✅ " : e.ok === false ? "❌ " : "ℹ️ "}{e.titolo}</span>
      </div>
      <figcaption style={{ fontSize: 11.5, color: "#c3cad4", padding: "6px 8px", lineHeight: 1.4 }}>{e.testo}</figcaption>
    </figure>
  );
}

// prima/dopo: trascina per vedere il D-Log diventare colore con la LUT
function PrimaDopo() {
  const [x, setX] = useState(50);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #333a45" }}>
        <div style={{ filter: "saturate(.35) contrast(.6) brightness(1.12)" }}><Paesaggio /></div>
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${x}%)` }}><Paesaggio /></div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x}%`, width: 3, marginLeft: -1, background: "#fff", boxShadow: "0 0 8px #000" }} />
        <span style={{ position: "absolute", left: 6, bottom: 6, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5 }}>D-Log</span>
        <span style={{ position: "absolute", right: 6, bottom: 6, background: "rgba(255,140,66,.9)", color: "#12151c", fontSize: 11.5, fontWeight: 800, padding: "2px 7px", borderRadius: 5 }}>Con la LUT ✨</span>
      </div>
      <label style={{ display: "block", fontSize: 11.5, color: "#8b95a3", marginTop: 6 }}>
        Trascina per confrontare
        <input type="range" min="0" max="100" value={x} onChange={(e) => setX(Number(e.target.value))} style={{ width: "100%", marginTop: 4 }} />
      </label>
    </div>
  );
}

const SEZIONI = [
  {
    id: "backup", titolo: "📦 1. Appena torni: la copia di sicurezza",
    corpo: () => (
      <>
        <Lista voci={[
          "Copia tutta la scheda del drone sul computer, in una cartella con data e luogo (es. «2026-10-08 Cascina Bianca»).",
          "Fai una seconda copia: un disco esterno o il cloud (Google Drive, iCloud, OneDrive). Una copia sola non basta: i dischi si rompono.",
          "Solo quando hai due copie, formatta la scheda nel drone (non dal computer).",
          "Tieni gli originali almeno finché il cliente non ha approvato il lavoro.",
        ]} />
      </>
    ),
  },
  {
    id: "montaggio", titolo: "✂️ 2. Montaggio: come fare un video che piace",
    corpo: () => (
      <>
        <Sotto>Quanto deve durare</Sotto>
        <Tabella intestazione={["Video", "Durata giusta"]} righe={[
          ["Reel, TikTok, Storie", "15–30 secondi"],
          ["Matrimonio (video riassunto)", "3–5 minuti"],
          ["Immobile, agriturismo, struttura", "1–2 minuti"],
          ["Promozionale per un'azienda", "30–90 secondi, più una versione corta da 15 s"],
          ["Ispezione (per il cliente)", "1–3 minuti con le parti importanti"],
        ]} />
        <Sotto>Come costruirlo</Sotto>
        <Lista voci={[
          "Apri con la ripresa più bella: i primi 2–3 secondi decidono se la gente continua a guardare.",
          "Poi racconta: dal largo al vicino (luogo → edificio → dettagli), oppure segui l'ordine delle riprese del piano.",
          "Chiudi con un allontanamento: il drone indietreggia e sale, con la camera sempre sul soggetto (in inglese «dronie»). Oppure chiudi con il logo del cliente.",
          "Taglia a ritmo di musica: cambia ripresa sui colpi forti.",
          "Ogni ripresa 3–6 secondi: le riprese dal drone sono lente, più lunghe annoiano.",
          "Transizioni semplici: il taglio netto quasi sempre va meglio degli effetti.",
          "Se hai girato a 50 o 60 fps puoi rallentare al 50% in un progetto a 25 fps: diventa fluido ed elegante.",
        ]} />
      </>
    ),
  },
  {
    id: "musica", titolo: "🎵 3. Musica senza problemi di diritti",
    corpo: () => (
      <Lista voci={[
        "Per Instagram e TikTok usa la musica della loro libreria, aggiunta dentro l'app: è autorizzata su quel social.",
        "Per YouTube: la «Libreria audio» di YouTube Studio è gratuita.",
        "Musica gratuita da scaricare: Pixabay Music e simili. Leggi sempre la licenza: alcune chiedono di citare l'autore.",
        "Per i clienti (matrimoni, pubblicità) meglio un abbonamento a una libreria con licenza commerciale: il video del cliente può finire ovunque.",
        "Mai canzoni famose prese da Spotify o da YouTube: i video vengono bloccati o tolti, e il problema è tuo.",
      ]} />
    ),
  },
  {
    id: "colore", titolo: "🎨 4. Colore: D-Log, LUT e correzione",
    corpo: ({ colore }) => (
      <>
        <Lista voci={[
          "Hai girato normale? Bastano piccoli ritocchi: bianco, esposizione e un po' di contrasto.",
          "Hai girato in D-Log o D-Log M? Il video è grigio apposta: va «sviluppato» con la LUT ufficiale del tuo drone (una specie di filtro che rimette i colori giusti, si scarica gratis dal sito del produttore), poi si ritocca.",
          "Correggi prima esposizione e bianco, poi la LUT, poi il «look» (contrasto, saturazione).",
          "Usa le stesse correzioni su tutte le clip dello stesso momento: copia e incolla la correzione.",
        ]} />
        <PrimaDopo />
        <Sotto>Come usare la LUT, passo per passo</Sotto>
        <Lista voci={[
          "Scarica la LUT ufficiale del tuo drone dal sito del produttore (per i DJI: «D-Log M to Rec.709» o «D-Log to Rec.709»). È gratis.",
          "Prima della LUT sistema esposizione e bianco: la LUT funziona bene solo se il video di partenza è esposto giusto.",
          "Applica la LUT. Se il risultato è troppo forte, abbassane l'intensità al 70–90%.",
          "Solo dopo, se vuoi, aggiungi un «look» creativo (cinema, caldo, freddo), ma piano: 20–40% di intensità.",
          "Mai una LUT creativa direttamente sul D-Log senza quella ufficiale: i colori diventano strani e la pelle arancione.",
          "Alla fine guarda il video anche sul telefono: è lì che lo vedrà quasi tutta la gente.",
        ]} />
        <Sotto>Le regole dei fotografi per un colore giusto</Sotto>
        <Lista voci={[
          "Istogramma: la «montagnetta» non deve toccare i bordi. Se tocca a destra il cielo è bruciato, se tocca a sinistra le ombre sono chiuse.",
          "I bianchi devono essere bianchi: guarda nuvole, muri chiari e strade. Se sono gialli o azzurri, sistema il bilanciamento del bianco.",
          "Il verde dell'erba e degli alberi deve sembrare vero, mai fosforescente. Il cielo azzurro, non viola.",
          "La pelle delle persone non deve essere mai arancione o grigia: è la prima cosa che si nota in un matrimonio.",
          "Neri profondi ma con i dettagli: né grigi (piatto) né macchie nere (troppo contrasto).",
          "Tutte le clip dello stesso momento devono avere lo stesso colore.",
          "Il tramonto può essere caldo, un'ispezione o un immobile no: lì servono colori veri e neutri.",
        ]} />
        <Sotto>Riconosci gli errori a colpo d'occhio</Sotto>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8, marginTop: 8 }}>
          {ESEMPI_COLORE.map((e) => <Esempio key={e.titolo} e={e} />)}
        </div>
        <p style={{ fontSize: 10.5, color: "#6b7480", margin: "6px 0 0 0" }}>Il paesaggio è un disegno, non una ripresa vera: serve solo a far vedere la differenza.</p>
        {colore && <div style={{ marginTop: 10 }}>{colore}</div>}
      </>
    ),
  },
  {
    id: "esporta", titolo: "📤 5. Esportare: le impostazioni giuste",
    corpo: () => (
      <>
        <Tabella intestazione={["Dove va", "Formato", "Risoluzione", "Qualità"]} righe={[
          ["Reel, TikTok, Storie", "Verticale 9:16, MP4 (H.264)", "1080 × 1920", "Circa 15–20 Mbps"],
          ["Post Instagram", "4:5 o quadrato, MP4", "1080 × 1350", "Circa 15 Mbps"],
          ["YouTube", "16:9, MP4 (H.264)", "3840 × 2160 o 1920 × 1080", "4K circa 45 Mbps, Full HD circa 12 Mbps"],
          ["Cliente (versione «master»)", "16:9, MP4 (H.265) o il formato che chiede", "4K", "Alta, 60–100 Mbps"],
          ["WhatsApp", "Meglio mandare il link della galleria", "—", "WhatsApp comprime e rovina il video"],
          ["Foto per social", "JPG, qualità 90%", "Lato lungo 2048 px", "—"],
          ["Foto per stampa", "JPG o TIFF alla massima qualità", "Originale", "—"],
        ]} />
        <Lista voci={[
          "Esporta con gli stessi fotogrammi al secondo del progetto (25 o 30), a meno che tu non voglia rallentare.",
          "Per i social, carica dal telefono con l'opzione «alta qualità» attiva nelle impostazioni dell'app.",
        ]} />
      </>
    ),
  },
  {
    id: "programmi", titolo: "💻 Programmi gratuiti per iniziare",
    corpo: () => (
      <>
        <Tabella intestazione={["Programma", "Dove", "Per cosa"]} righe={[
          ["DaVinci Resolve", "Computer", "Montaggio e colore professionale, gratis. Ottimo per il D-Log"],
          ["CapCut", "Telefono e computer", "Montaggi veloci per i social, con scritte e musica"],
          ["DJI LightCut", "Telefono", "Montaggi automatici dalle clip del drone"],
          ["Lightroom (versione base)", "Telefono e computer", "Foto: ritocco, HDR, panorami"],
          ["Snapseed", "Telefono", "Foto: ritocchi rapidi"],
        ]} />
        <Sotto>DaVinci Resolve in 4 passi</Sotto>
        <Lista voci={[
          "«Media»: importa la cartella del volo.",
          "«Edit»: trascina le clip sulla linea del tempo, nell'ordine del piano, e taglia.",
          "«Color»: correggi esposizione e bianco, poi aggiungi la LUT se hai girato in D-Log.",
          "«Deliver»: scegli formato e qualità (vedi la tabella qui sopra) ed esporta.",
        ]} />
      </>
    ),
  },
  {
    id: "foto", titolo: "📷 Foto: il ritocco in ordine",
    corpo: () => (
      <>
        <Lista voci={[
          "Raddrizza l'orizzonte e ritaglia: è l'errore che si nota di più nelle foto da drone.",
          "Esposizione, poi ombre più chiare e luci più scure, così recuperi cielo e dettagli (meglio se hai scattato in RAW, il formato DNG che tiene molti più dettagli del JPG).",
          "Bilanciamento del bianco: caldo per tramonti e case, neutro per ispezioni e immobili.",
          "Un po' di vividezza (non saturazione), poca nitidezza.",
          "Riduzione del rumore se hai scattato di sera.",
          "HDR: se hai scattato più foto con esposizioni diverse (AEB), uniscile in Lightroom con «Unisci foto → HDR».",
          "Panorama: uniscile con «Unisci foto → Panorama», se il drone non l'ha già fatto da solo.",
        ]} />
      </>
    ),
  },
  {
    id: "speciali", titolo: "🌄 Riprese speciali: impostazioni pronte",
    corpo: () => (
      <>
        <Tabella intestazione={["Ripresa", "Come impostare", "Consiglio"]} righe={[
          ["Panorama / 360°", "Modalità Pano (sferica, 180° o grandangolo), ISO 100, esposizione bloccata", "Con poco vento: il drone deve restare fermo"],
          ["Hyperlapse", "Modalità Hyperlapse, intervallo 2 s, circa 10 s di video finale", "Soggetti che si muovono: nuvole, traffico, ombre"],
          ["Timelapse da fermo", "Foto a intervalli (2–5 s) dal drone fermo, ISO 100", "Batteria piena: dura molto"],
          ["Foto di sera / notte", "ISO 100–400, tempo 1–2 s da fermo, oppure la modalità notte o scatto multiplo", "Vento debole. Di notte serve la luce verde lampeggiante accesa"],
          ["Lunga esposizione (scie)", "Filtro ND forte, tempo 1–2 s, ISO 100", "Acqua che scorre e auto diventano scie"],
          ["Verticale per i social", "Modalità verticale del drone, oppure gira in 4K e ritaglia in 9:16", "Lascia spazio sopra e sotto per le scritte"],
        ]} />
      </>
    ),
  },
  {
    id: "problemi", titolo: "🛠️ Problemi comuni e come sistemarli",
    corpo: () => (
      <Tabella intestazione={["Problema", "Perché succede", "Cosa fare"]} righe={[
        ["L'immagine «trema» (effetto gelatina)", "Eliche rovinate o vento forte", "Cambia le eliche. In montaggio usa la stabilizzazione"],
        ["La luce sfarfalla", "Luci artificiali e tempo di scatto sbagliato", "In Italia (corrente a 50 Hz) usa 1/50 o 1/100 a 25 fps"],
        ["Orizzonte storto", "Gimbal da calibrare", "Calibra il gimbal nell'app del drone, poi raddrizza in montaggio"],
        ["Clip con colori diversi tra loro", "Bianco ed esposizione automatici", "Bianco manuale e stesse impostazioni per tutto il volo"],
        ["Cielo bianco «bruciato»", "Esposizione troppo alta", "Esposizione −0,7 e guarda l'istogramma"],
        ["Foto di sera piene di puntini", "ISO troppo alti", "ISO bassi, tempo più lungo da fermo e riduzione rumore"],
        ["Si vedono le eliche nell'inquadratura", "Volo veloce in avanti con camera alta", "Rallenta o inclina un po' la camera verso il basso"],
      ]} />
    ),
  },
  {
    id: "consegna", titolo: "🎁 6. Consegna al cliente",
    corpo: () => (
      <Lista voci={[
        "Consegna con la galleria di EyeDrones (Registro voli → il volo → «📤 Manda al cliente»): link con PIN, filigrana fino al pagamento, e il cliente sceglie le preferite.",
        "Cosa consegnare: il video lungo, una versione corta per i social, le foto migliori (non tutte).",
        "Nomi dei file chiari: «Cascina-Bianca-video-4K.mp4», non «DJI_0042.MP4».",
        "Scrivi cosa può farne il cliente: uso personale, social, pubblicità, e per quanto tempo.",
        "Dopo la consegna chiedi una recensione o una frase da usare sulla tua pagina.",
      ]} />
    ),
  },
];

export default function Manuale({ colore }) {
  const [aperta, setAperta] = useState(() => { try { return sessionStorage.getItem(CHIAVE_SEZIONE) || "backup"; } catch { return "backup"; } });
  useEffect(() => {
    let id = null;
    try { id = sessionStorage.getItem(CHIAVE_SEZIONE); sessionStorage.removeItem(CHIAVE_SEZIONE); } catch { /* niente */ }
    if (id) setTimeout(() => document.getElementById(`manuale-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...stCard, background: "linear-gradient(135deg, #241d16, #1b2028)", borderColor: "#4a2f16" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>🎬 Manuale foto e video</div>
        <div style={{ fontSize: 12.5, color: "#c3cad4", marginTop: 3 }}>Dal volo alla consegna: copia di sicurezza, montaggio, musica, colore, esportazione e consegna al cliente. Più le impostazioni per le riprese speciali e i problemi più comuni.</div>
      </div>
      {SEZIONI.map((s) => (
        <details key={s.id} id={`manuale-${s.id}`} open={aperta === s.id} onToggle={(e) => { if (e.currentTarget.open) setAperta(s.id); }} style={stCard}>
          <summary style={{ cursor: "pointer", fontSize: 14.5, fontWeight: 700 }}>{s.titolo}</summary>
          {s.corpo({ colore })}
        </details>
      ))}
      <p style={{ fontSize: 10.5, color: "#6b7480", margin: 0 }}>Consigli pratici e valori indicativi: dipendono dal drone, dal programma e dal lavoro. Le licenze della musica vanno sempre controllate.</p>
    </div>
  );
}

// --- «Dopo il volo»: la lista per il lavoro a casa, salvata nel volo (dettagli.dopo) ------------------
const PASSI_VIDEO = [
  { id: "backup", testo: "Copia di sicurezza fatta (2 copie)", sezione: "backup" },
  { id: "clip", testo: "Clip scelte e montate", sezione: "montaggio" },
  { id: "colore", testo: "Colore sistemato", sezione: "colore" },
  { id: "musica", testo: "Musica senza problemi di diritti", sezione: "musica" },
  { id: "esporta", testo: "Video esportato", sezione: "esporta" },
  { id: "consegna", testo: "Consegnato al cliente", sezione: "consegna", consegna: true },
];
const PASSI_FOTO = [
  { id: "backup", testo: "Copia di sicurezza fatta (2 copie)", sezione: "backup" },
  { id: "scelta", testo: "Foto migliori scelte", sezione: "foto" },
  { id: "ritocco", testo: "Foto ritoccate", sezione: "foto" },
  { id: "esporta", testo: "Foto esportate", sezione: "esporta" },
  { id: "consegna", testo: "Consegnate al cliente", sezione: "consegna", consegna: true },
];

export function DopoIlVolo({ volo, onSalva, onConsegna }) {
  const passi = volo.tipo_attivita === "foto" ? PASSI_FOTO : PASSI_VIDEO;
  const [fatti, setFatti] = useState(() => (Array.isArray(volo.dettagli?.dopo) ? volo.dettagli.dopo : []));
  const cambia = (id) => {
    const nuovi = fatti.includes(id) ? fatti.filter((x) => x !== id) : [...fatti, id];
    setFatti(nuovi);
    onSalva({ ...(volo.dettagli || {}), dopo: nuovi });
  };
  const n = passi.filter((p) => fatti.includes(p.id)).length;
  const ordine = /Ordine per il montaggio: (.*)/.exec(volo.note || "")?.[1];
  return (
    <details open={n < passi.length} style={{ background: "#141c26", border: "1px solid #2a4562", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: n === passi.length ? "#4ade80" : "#8fc1ff" }}>
        {n === passi.length ? "✅ Lavoro finito e consegnato" : `🏠 Dopo il volo · ${n} di ${passi.length}`}
      </summary>
      {ordine && <div style={{ fontSize: 12, color: "#c4b5fd", margin: "8px 0 0 0" }}>🎬 Ordine per il montaggio: {ordine}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
        {passi.map((p) => {
          const ok = fatti.includes(p.id);
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 40 }}>
              <button type="button" onClick={() => cambia(p.id)} aria-pressed={ok} aria-label={p.testo} style={{ width: 26, height: 26, flex: "none", borderRadius: 6, border: ok ? "none" : "1.5px solid #4a5d80", background: ok ? "#4ade80" : "transparent", color: "#12151a", fontWeight: 800, fontSize: 14 }}>{ok ? "✓" : ""}</button>
              <button type="button" onClick={() => cambia(p.id)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", color: ok ? "#6b7480" : "#e7eaee", textDecoration: ok ? "line-through" : "none", fontSize: 13, padding: "6px 0" }}>{p.testo}</button>
              {p.consegna && onConsegna
                ? <button type="button" onClick={onConsegna} style={{ background: "#ff8c42", color: "#161a1f", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700 }}>📤 Consegna</button>
                : <button type="button" onClick={() => apriManuale(p.sezione)} style={{ background: "none", border: "1px solid #2a4562", color: "#8fc1ff", borderRadius: 6, padding: "6px 10px", fontSize: 12 }}>Come si fa ›</button>}
            </div>
          );
        })}
      </div>
    </details>
  );
}
