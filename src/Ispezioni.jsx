import React, { useState } from "react";

// Ispezioni per chi comincia: le foto da fare in ordine (da spuntare sul posto come le manovre video),
// il semaforo «oggi va bene per la termografia?» e cosa consegnare al cliente, con frasi pronte.

export const TIPI_ISPEZIONE = ["danni", "fotovoltaico", "edifici", "elettrico"];

export const INQUADRATURE_ISPEZIONE = {
  danni: [
    { id: "tet-lati", nome: "Foto dei 4 lati", come: "Da 15–20 m, una foto per lato con tutto l'edificio dentro: chi legge il report capisce dove si trova ogni dettaglio.", stick: "Destro di lato per spostarti da un lato all'altro, sinistro di lato per ruotare verso l'edificio.", quando: "Sempre, come prima cosa." },
    { id: "tet-alto", nome: "Tetto intero dall'alto", come: "Camera dritta in giù (90°) e sali finché tutto il tetto entra nella foto.", stick: "Rotella della camera tutta giù, poi solo sinistro in su.", quando: "Per la vista d'insieme del tetto." },
    { id: "tet-falde", nome: "Ogni falda a 45°", come: "Mettiti di fronte a ogni falda con la camera a circa 45°: si vedono coppi o tegole spostati, rotti o con muschio.", stick: "Rotella a metà corsa; destro di lato per passare da una falda all'altra.", quando: "Su tutte le falde, anche quelle che sembrano a posto." },
    { id: "tet-dettagli", nome: "Comignoli, grondaie, lucernari, scossaline", come: "Avvicinati a 3–5 m o usa lo zoom: è lì che nascono quasi tutte le infiltrazioni.", stick: "Destro avanti piano verso il dettaglio, poi fermo in volo stazionario per scattare.", quando: "Soprattutto vicino al punto dove c'è l'infiltrazione in casa." },
    { id: "tet-danni", nome: "Primo piano dei danni con un riferimento", come: "Per ogni danno una foto larga e una stretta, con qualcosa che dia la misura (un coppo, la grondaia, una finestra).", stick: "Fermo in volo stazionario: scatta, poi avvicinati un po' e scatta ancora.", quando: "Per ogni danno trovato." },
  ],
  fotovoltaico: [
    { id: "fv-condizioni", nome: "Annota ora e condizioni", come: "Prima di decollare scrivi ora, sole, vento e, se puoi, l'irraggiamento (dall'inverter o da un solarimetro): serve nel report.", stick: "Nessuno: si fa a terra.", quando: "All'inizio, e di nuovo se il tempo cambia." },
    { id: "fv-insieme", nome: "Foto d'insieme normale", come: "Tutto l'impianto con la camera normale, dall'alto: è la mappa su cui indicherai le anomalie.", stick: "Rotella tutta giù, poi sinistro in su finché l'impianto entra tutto.", quando: "Sempre, prima della termica." },
    { id: "fv-passata", nome: "Passata termica fila per fila", come: "Vola sopra le file a velocità costante e lenta, con la camera inclinata di circa 60–70° (non a 90°, per evitare i riflessi), abbastanza basso da avere almeno 5×5 pixel termici per cella.", stick: "Destro avanti piano lungo la fila, poi di lato per passare alla fila successiva.", quando: "Su tutto l'impianto, senza saltare file." },
    { id: "fv-anomalie", nome: "Ogni anomalia: termica + normale", come: "Per ogni punto caldo fermati e scatta la foto termica e quella normale dalla stessa posizione, così il cliente trova il pannello.", stick: "Fermo in volo stazionario sopra l'anomalia.", quando: "Per ogni punto caldo, cella o stringa anomala." },
  ],
  edifici: [
    { id: "ed-facciate", nome: "Ogni facciata intera, di fronte", come: "Termica e normale di ogni facciata, il più possibile di fronte (non di sbieco): così le temperature sono affidabili.", stick: "Destro di lato per passare lungo la facciata, sinistro per alzarti o abbassarti.", quando: "Tutte le facciate riscaldate." },
    { id: "ed-aperture", nome: "Finestre, balconi e cassonetti", come: "Sono i ponti termici più comuni: avvicinati o usa lo zoom. Attenzione ai vetri, che riflettono e ingannano.", stick: "Destro avanti piano, poi fermo per scattare.", quando: "Dove vedi zone più calde intorno alle aperture." },
    { id: "ed-angoli", nome: "Angoli, piano terra e attacco del tetto", come: "Qui si vedono umidità di risalita e dispersioni tra muro e tetto.", stick: "Sinistro su o giù per l'altezza giusta, destro di lato per spostarti.", quando: "Sempre, anche se le facciate sembrano a posto." },
    { id: "ed-tetto", nome: "Tetto dall'alto in termico", come: "Con la camera a 90°: macchie calde sul tetto indicano dispersioni o isolamento mancante.", stick: "Rotella tutta giù, poi sinistro in su.", quando: "Se il cliente vuole sapere anche dell'isolamento del tetto." },
  ],
  elettrico: [
    { id: "el-insieme", nome: "Foto d'insieme dell'impianto", come: "Da distanza di sicurezza, con la camera normale: è la mappa per il report.", stick: "Fermo in volo stazionario, sinistro di lato per ruotare.", quando: "Sempre, all'inizio." },
    { id: "el-componenti", nome: "Componenti con lo zoom", come: "Morsetti, giunzioni, isolatori: usa lo zoom invece di avvicinarti ai conduttori.", stick: "Fermo in volo stazionario; zoom e rotella della camera.", quando: "Su ogni componente richiesto." },
    { id: "el-anomalie", nome: "Ogni anomalia: termica + normale", come: "Per ogni punto caldo foto termica e normale dalla stessa posizione, con l'impianto sotto carico.", stick: "Fermo in volo stazionario.", quando: "Per ogni punto caldo." },
  ],
};

export const SCALETTE_ISPEZIONE = {
  danni: [
    { id: "tetto", titolo: "Tetto e infiltrazioni", manovre: ["tet-lati", "tet-alto", "tet-falde", "tet-dettagli", "tet-danni"] },
    { id: "perizia", titolo: "Perizia danni (grandine, vento)", manovre: ["tet-lati", "tet-alto", "tet-falde", "tet-danni"] },
  ],
  fotovoltaico: [{ id: "fv", titolo: "Fotovoltaico termico", manovre: ["fv-condizioni", "fv-insieme", "fv-passata", "fv-anomalie"] }],
  edifici: [{ id: "ed", titolo: "Termografia edificio", manovre: ["ed-facciate", "ed-aperture", "ed-angoli", "ed-tetto"] }],
  elettrico: [{ id: "el", titolo: "Impianto elettrico", manovre: ["el-insieme", "el-componenti", "el-anomalie"] }],
};

// ---------------------------------------------------------------------------------------------
// Semaforo: dalle previsioni ora per ora capisco se il giorno scelto va bene per la termografia
const SOGLIE = {
  fotovoltaico: { dalle: 10, alle: 15 },
  edifici: { interno: 20, deltaMin: 10 },
};
function valutaOra(tipo, o, prima) {
  const motivi = [];
  let voto = 2; // 2 verde, 1 giallo, 0 rosso
  const peggio = (v, m) => { voto = Math.min(voto, v); motivi.push(m); };
  if ((o.pioggia ?? 0) > 0 || (o.probPioggia ?? 0) >= 50) peggio(0, "pioggia");
  if (tipo === "fotovoltaico") {
    if (o.ora < SOGLIE.fotovoltaico.dalle || o.ora > SOGLIE.fotovoltaico.alle) peggio(0, "sole troppo basso");
    if (o.nuvole > 40) peggio(0, `nuvole ${o.nuvole}%`); else if (o.nuvole > 20) peggio(1, `qualche nuvola (${o.nuvole}%)`);
    if (o.vento > 28) peggio(0, `vento ${Math.round(o.vento)} km/h`); else if (o.vento > 15) peggio(1, `vento ${Math.round(o.vento)} km/h`);
  } else {
    const delta = SOGLIE.edifici.interno - o.temperatura;
    if (delta < 5) peggio(0, `poca differenza dentro/fuori (${Math.round(delta)} °C)`); else if (delta < SOGLIE.edifici.deltaMin) peggio(1, `differenza dentro/fuori solo ${Math.round(delta)} °C`);
    if (o.ora >= 9 && o.ora <= 17) peggio(1, "di giorno il sole scalda le facciate");
    if (o.vento > 20) peggio(0, `vento ${Math.round(o.vento)} km/h`); else if (o.vento > 10) peggio(1, `vento ${Math.round(o.vento)} km/h`);
    if (prima.some((p) => (p.pioggia ?? 0) > 0)) peggio(1, "ha piovuto nelle ore prima (muri bagnati)");
  }
  return { voto, motivi };
}
const COLORI = ["#ff6b6b", "#f5b942", "#4ade80"];
const SIMBOLI = ["🔴", "🟡", "🟢"];

export function SemaforoTermografia({ tipo, orari, data, ora }) {
  if (!["fotovoltaico", "edifici"].includes(tipo) || !Array.isArray(orari) || !data) return null;
  const delGiorno = orari.filter((o) => o.data === data && o.temperatura != null);
  if (delGiorno.length === 0) return null;
  const valutate = delGiorno.map((o) => ({ ...o, ...valutaOra(tipo, o, orari.filter((p) => (p.data === data && p.ora < o.ora && p.ora >= o.ora - 6))) }));
  const buone = valutate.filter((o) => o.voto === 2).map((o) => o.ora);
  const oraScelta = ora ? Number(ora.slice(0, 2)) : null;
  const scelta = oraScelta != null ? valutate.find((o) => o.ora === oraScelta) : null;
  const migliore = Math.max(...valutate.map((o) => o.voto));
  const giudizio = scelta || valutate.find((o) => o.voto === migliore);
  const fasce = [];
  for (const h of buone) { const u = fasce[fasce.length - 1]; if (u && h === u[1] + 1) u[1] = h; else fasce.push([h, h]); }
  const testoFasce = fasce.map(([a, b]) => (a === b ? `${a}:00` : `${a}:00–${b + 1}:00`)).join(", ");
  return (
    <div style={{ marginTop: 12, background: "#161a1f", border: `1px solid ${COLORI[giudizio.voto]}66`, borderRadius: 6, padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: COLORI[giudizio.voto] }}>
        {SIMBOLI[giudizio.voto]} {tipo === "fotovoltaico" ? "Termografia fotovoltaico" : "Termografia edificio"}: {scelta ? `alle ${scelta.ora}:00 ` : ""}{["meglio rimandare", "si può, ma non è l'ideale", "condizioni buone"][giudizio.voto]}
      </div>
      {giudizio.motivi.length > 0 && <div style={{ fontSize: 12, color: "#c3cad4", marginTop: 4 }}>{giudizio.motivi.join(" · ")}</div>}
      <div style={{ fontSize: 12, color: "#c3cad4", marginTop: 6 }}>
        {buone.length ? <>✅ Ore migliori quel giorno: <strong style={{ color: "#4ade80" }}>{testoFasce}</strong></> : "❌ Quel giorno nessuna ora è davvero adatta: prova un altro giorno."}
      </div>
      <div style={{ fontSize: 10.5, color: "#6b7480", marginTop: 6 }}>
        {tipo === "fotovoltaico"
          ? "Calcolato da previsioni di nuvole, vento e pioggia (ore 10–15). Sul posto conta l'irraggiamento vero: almeno 600 W/m², letto dall'inverter o da un solarimetro."
          : `Calcolato pensando a 20 °C dentro casa: servono almeno 10 °C di differenza con fuori. Se dentro c'è meno caldo, la differenza è più piccola.`}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Cosa consegnare: foto da mettere nel report e frasi pronte da adattare
const CONSEGNA = {
  danni: {
    foto: ["Le 4 foto dei lati, per orientarsi", "Il tetto intero dall'alto", "Una foto per ogni falda", "Per ogni danno: foto larga + primo piano con riferimento"],
    frasi: [
      "Il sopralluogo con drone del [data] ha interessato l'intera copertura dell'edificio in [indirizzo].",
      "Si rilevano tegole/coppi spostati o rotti in corrispondenza della falda [lato], in prossimità di [comignolo/grondaia/colmo].",
      "In corrispondenza del comignolo lato [nord/sud…] la scossalina risulta sollevata/danneggiata: possibile punto di infiltrazione.",
      "Le grondaie risultano ostruite da foglie e detriti in [punto]: si consiglia la pulizia.",
      "Non si rilevano danni evidenti nelle restanti parti della copertura.",
      "Si consiglia la verifica da parte di un tecnico/impresa per la riparazione dei punti indicati.",
    ],
  },
  fotovoltaico: {
    foto: ["Foto d'insieme dell'impianto, con le anomalie segnate", "Per ogni anomalia: foto termica + foto normale", "Tabella con data, ora, irraggiamento, temperatura e vento"],
    frasi: [
      "L'ispezione termografica è stata eseguita il [data] alle ore [ora], con irraggiamento di circa [W/m²] e vento [debole/moderato].",
      "Sono stati ispezionati [numero] moduli: si rilevano [numero] anomalie termiche.",
      "Il modulo [posizione] presenta un punto caldo (hot spot) di circa [ΔT] °C rispetto ai moduli vicini: possibile cella danneggiata.",
      "La stringa [numero] risulta più calda nel suo insieme: si consiglia la verifica elettrica della stringa.",
      "Il modulo [posizione] presenta un riscaldamento del diodo di bypass / della scatola di giunzione.",
      "Si consiglia la verifica delle anomalie da parte dell'installatore o di un tecnico abilitato.",
    ],
  },
  edifici: {
    foto: ["Ogni facciata: termica + normale", "Dettagli dei ponti termici (finestre, balconi, cassonetti)", "Data, ora, temperatura esterna e interna"],
    frasi: [
      "Il rilievo termografico è stato eseguito il [data] alle ore [ora], con temperatura esterna di [°C] e interna di circa [°C].",
      "Si rilevano dispersioni termiche in corrispondenza dei cassonetti delle tapparelle e dei contorni dei serramenti.",
      "Le solette dei balconi presentano un ponte termico evidente sulla facciata [lato].",
      "Nella parte bassa della facciata [lato] si nota una zona più fredda compatibile con umidità di risalita.",
      "Si consiglia una verifica dell'isolamento da parte di un tecnico.",
    ],
  },
  elettrico: {
    foto: ["Foto d'insieme dell'impianto", "Per ogni anomalia: foto termica + normale", "Carico dell'impianto al momento dell'ispezione"],
    frasi: [
      "L'ispezione è stata eseguita il [data] con l'impianto sotto carico.",
      "Si rileva un riscaldamento anomalo in corrispondenza di [componente], circa [ΔT] °C rispetto ai componenti simili.",
      "Si consiglia la verifica da parte del gestore o di un tecnico abilitato.",
    ],
  },
};

// copia un testo: prima gli appunti del browser, poi il vecchio metodo, e se il browser blocca tutto
// una finestrella con il testo da copiare a mano. Restituisce true se è stato copiato davvero
export async function copiaTesto(testo) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(testo); return true; } } catch { /* provo l'altro modo */ }
  try {
    const t = document.createElement("textarea");
    t.value = testo; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.top = "-1000px"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); t.setSelectionRange(0, testo.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(t);
    if (ok) return true;
  } catch { /* ultima possibilità qui sotto */ }
  window.prompt("Copia il testo (tieni premuto o Ctrl+C):", testo);
  return false;
}

// frasi scelte sul posto (dalla Home o dal piano): finiscono da sole nelle Note della prossima «Nuova ispezione».
// Si scelgono col telefono sul posto e il report spesso si fa a casa sul computer: per questo, oltre alla copia sul
// telefono, App le salva anche nell'account (evento «eyedrones-frasi-report»), con data e ora di quando eri lì
const CHIAVE_FRASI = "eyedrones_frasi_report";
export function leggiFrasiReport() {
  try { const d = JSON.parse(localStorage.getItem(CHIAVE_FRASI) || "null"); return d && Array.isArray(d.frasi) ? d : null; } catch { return null; }
}
function salvaFrasiReport(tipo, frasi) {
  const prima = leggiFrasiReport();
  const adesso = new Date();
  // data e ora sono quelle della prima frase scelta, cioè di quando eri sul posto
  const quando = prima && prima.tipo === tipo && prima.data
    ? { data: prima.data, ora: prima.ora }
    : { data: adesso.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }), ora: adesso.toTimeString().slice(0, 5) };
  const d = frasi.length ? { tipo, frasi, ...quando } : null;
  try { if (d) localStorage.setItem(CHIAVE_FRASI, JSON.stringify(d)); else localStorage.removeItem(CHIAVE_FRASI); } catch { /* niente */ }
  window.dispatchEvent(new CustomEvent("eyedrones-frasi-report", { detail: d }));
}
export function svuotaFrasiReport() {
  try { localStorage.removeItem(CHIAVE_FRASI); } catch { /* niente */ }
  window.dispatchEvent(new CustomEvent("eyedrones-frasi-report", { detail: null }));
}

// riempie da sola le parti tra [ ] che l'app conosce già (data, ora, irraggiamento, indirizzo)
export function compilaFrase(f, valori = {}) {
  let t = f;
  if (valori.data) t = (/^(8|11)\b/.test(valori.data) ? t.replace("il [data]", "l'[data]") : t).replace("[data]", valori.data); // «l'8 ottobre», «l'11 maggio»
  if (valori.ora) t = t.replace("[ora]", valori.ora);
  if (valori.irraggiamento) t = t.replace("[W/m²]", `${valori.irraggiamento} W/m²`);
  if (valori.indirizzo) t = t.replace("[indirizzo]", valori.indirizzo);
  return t;
}

// elenco di frasi da toccare dentro il report: ognuna si aggiunge alle Note già compilata
export function FrasiReport({ tipo, valori, onAggiungi, chiaro }) {
  const [aggiunta, setAggiunta] = useState(null);
  const c = CONSEGNA[tipo];
  if (!c) return null;
  const aggiungi = (f) => { onAggiungi(compilaFrase(f, valori)); setAggiunta(f); setTimeout(() => setAggiunta(null), 1800); };
  return (
    <details style={{ marginTop: 6 }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: chiaro ? "#2e7d32" : "#a6e3a1" }}>📋 Aggiungi una frase pronta</summary>
      <div style={{ fontSize: 11.5, color: chiaro ? "#555" : "#8b95a3", margin: "4px 0 6px 0" }}>Tocca: si scrive nelle note con data, ora e irraggiamento già messi. Poi cambia le parti rimaste tra [ ].</div>
      {c.frasi.map((f) => (
        <button key={f} type="button" onClick={() => aggiungi(f)} style={{ display: "block", width: "100%", textAlign: "left", background: aggiunta === f ? (chiaro ? "#e3f4e4" : "#1d3a2a") : (chiaro ? "#fff" : "#161a1f"), color: chiaro ? "#1a1a1a" : "#e7eaee", border: `1px solid ${aggiunta === f ? "#4ade80" : chiaro ? "#ddd" : "#2b313d"}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, lineHeight: 1.45, marginBottom: 5, cursor: "pointer" }}>
          {aggiunta === f ? "✓ Aggiunta! " : "➕ "}{compilaFrase(f, valori)}
        </button>
      ))}
    </details>
  );
}

export function CosaConsegnare({ tipo }) {
  const [copiata, setCopiata] = useState(null);
  const [scelte, setScelte] = useState(() => { const d = leggiFrasiReport(); return d && d.tipo === tipo ? d.frasi : []; });
  const c = CONSEGNA[tipo];
  if (!c) return null;
  const copia = async (f) => {
    if (await copiaTesto(f)) { setCopiata(f); setTimeout(() => setCopiata(null), 2500); }
  };
  const cambia = (f) => {
    const nuove = scelte.includes(f) ? scelte.filter((x) => x !== f) : [...scelte, f];
    setScelte(nuove);
    salvaFrasiReport(tipo, nuove);
  };
  return (
    <div style={{ marginTop: 12, background: "#121a12", border: "1px solid #2c4a2a", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#a6e3a1" }}>📄 Cosa consegnare al cliente</div>
      <div style={{ fontSize: 12, color: "#c3cad4", margin: "6px 0 2px 0", fontWeight: 600 }}>Foto da mettere nel report</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5, color: "#d6dde6" }}>{c.foto.map((f) => <li key={f}>{f}</li>)}</ul>
      <div style={{ fontSize: 12, color: "#c3cad4", margin: "8px 0 4px 0", fontWeight: 600 }}>Frasi pronte: tocca quelle che servono e vanno da sole nel report</div>
      {c.frasi.map((f) => {
        const dentro = scelte.includes(f);
        return (
          <div key={f} style={{ display: "flex", gap: 5, marginBottom: 5 }}>
            <button type="button" onClick={() => cambia(f)} aria-pressed={dentro} style={{ flex: 1, textAlign: "left", background: dentro ? "#1d3a2a" : "#161a1f", color: "#e7eaee", border: `1px solid ${dentro ? "#4ade80" : "#2b313d"}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, lineHeight: 1.45, cursor: "pointer" }}>
              <span style={{ color: dentro ? "#4ade80" : "#8b95a3", fontWeight: 700 }}>{dentro ? "✓ Nel report · " : "➕ "}</span>{f}
            </button>
            <button type="button" onClick={() => copia(f)} aria-label="Copia la frase" title="Copia" style={{ flex: "none", width: 40, background: copiata === f ? "#1d3a2a" : "#161a1f", color: copiata === f ? "#4ade80" : "#8b95a3", border: "1px solid #2b313d", borderRadius: 6, fontSize: 13 }}>{copiata === f ? "✓" : "📋"}</button>
          </div>
        );
      })}
      {scelte.length > 0 && (
        <div style={{ fontSize: 12, color: "#a6e3a1", background: "#1d3a2a55", border: "1px solid #4ade8044", borderRadius: 6, padding: "6px 8px", marginTop: 4 }}>
          📝 {scelte.length === 1 ? "1 frase pronta" : `${scelte.length} frasi pronte`} per il report: le trovi già scritte nelle Note quando fai la <strong>Nuova ispezione</strong>, anche dal computer.{" "}
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("eyedrones-vai", { detail: { pagina: "nuova" } }))} style={{ background: "none", border: "none", color: "#4ade80", fontWeight: 700, padding: 0, fontSize: 12, textDecoration: "underline" }}>Vai al report ›</button>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: "#6b7480", marginTop: 4 }}>Scrivi solo quello che hai visto davvero: il report descrive le immagini, la diagnosi la fa un tecnico abilitato.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Come impostare la camera, cosa portare e consigli, per ogni tipo di ispezione (come «Come impostare la camera»
// per video e foto). Valori indicativi: dipendono dalla termocamera e dal drone.
const CAMERA_ISPEZIONE = {
  fotovoltaico: {
    camera: [
      ["Modalità", "Foto termica radiometrica (R-JPEG) insieme alla foto normale"],
      ["Palette", "Ironbow o White hot: le celle calde saltano subito all'occhio"],
      ["Scala", "Bloccata e uguale per tutte le foto (per esempio da 20 a 70 °C): con la scala automatica ogni foto ha colori diversi e non si confrontano"],
      ["Emissività", "Circa 0,85 (vetro del modulo, lato anteriore)"],
      ["Temp. riflessa", "Quella dell'aria, oppure misurata su un foglio di alluminio stropicciato"],
      ["Angolo", "Non perpendicolare: inclina di 10–30° per non riprendere il riflesso del sole o del drone"],
      ["Altezza", "Di solito 15–30 m sopra i pannelli, abbastanza vicino da distinguere le singole celle (circa 3 cm per pixel): controlla il GSD del tuo drone"],
      ["Velocità", "Lenta, 2–3 m/s, e foto da fermo sopra ogni anomalia"],
    ],
    portare: [
      "Batterie cariche: i passaggi lenti consumano molto",
      "Solarimetro, oppure la lettura dell'irraggiamento dall'inverter (almeno 600 W/m²)",
      "La planimetria dell'impianto con stringhe e numerazione dei moduli",
      "Termometro per la temperatura dell'aria",
      "Scheda di memoria vuota e veloce",
      "Il contatto di chi gestisce l'impianto e l'ok del proprietario",
    ],
    consigli: [
      "L'impianto deve essere in produzione: inverter acceso, niente manutenzioni in corso.",
      "Annota irraggiamento, temperatura e ora all'inizio e alla fine del volo: servono nel report.",
      "Per ogni anomalia fai anche la foto normale: il cliente deve capire dov'è il modulo.",
      "Sporco, foglie ed escrementi fanno macchie calde: guarda la foto normale prima di chiamarli difetti.",
    ],
  },
  edifici: {
    camera: [
      ["Modalità", "Foto termica radiometrica (R-JPEG) insieme alla foto normale"],
      ["Palette", "Ironbow o Rainbow ad alto contrasto"],
      ["Scala", "Bloccata per tutta la facciata (per esempio da −5 a 20 °C, dipende dalla stagione)"],
      ["Emissività", "0,90–0,95 per intonaco, mattone e tegole. Vetri e metalli riflettono: lì la temperatura non è affidabile"],
      ["Temp. riflessa", "Quella dell'aria, oppure misurata su un foglio di alluminio stropicciato"],
      ["Angolo", "Il più possibile di fronte alla facciata, ma non dritto davanti alle finestre"],
      ["Distanza", "5–15 m dalla facciata, più una foto larga di riferimento per ogni lato"],
    ],
    portare: [
      "Batterie cariche",
      "Termometro per dentro e fuori: servono almeno 10 °C di differenza",
      "Luce verde lampeggiante del drone accesa, se voli dopo il tramonto",
      "L'elenco dei punti sospetti (macchie, muffa, stanze fredde) chiesto al cliente",
      "Scheda di memoria vuota",
    ],
    consigli: [
      "Chiedi al cliente di tenere il riscaldamento acceso da diverse ore e le finestre chiuse.",
      "Niente sole sulle facciate da alcune ore: meglio la sera tardi o prima dell'alba.",
      "Superfici bagnate falsano tutto: evita le ore dopo la pioggia.",
      "Fai prima il giro dei 4 lati in largo, poi i dettagli: nel report si capisce subito dove sei.",
    ],
  },
  elettrico: {
    camera: [
      ["Modalità", "Foto termica radiometrica (R-JPEG) insieme alla foto normale con zoom"],
      ["Palette", "White hot o Ironbow"],
      ["Scala", "Automatica per cercare i punti caldi, poi bloccala per le foto del report"],
      ["Emissività", "Circa 0,95 su isolatori e parti verniciate. I metalli lucidi riflettono: misura su connessioni e parti non lucide"],
      ["Distanza", "Resta lontano dai conduttori e usa lo zoom invece di avvicinarti: le linee disturbano la bussola"],
      ["Angolo", "Evita di avere il sole o il cielo riflesso sulle parti metalliche"],
    ],
    portare: [
      "Le autorizzazioni del gestore della linea o dell'impianto",
      "Il carico della linea in quel momento: con poco carico i difetti non si scaldano (di solito si consiglia almeno il 40%)",
      "Batterie cariche e scheda di memoria vuota",
      "Il contatto di un referente sul posto",
    ],
    consigli: [
      "Confronta lo stesso componente sulle tre fasi: conta la differenza di temperatura, più del valore da solo.",
      "Annota il carico e l'ora per ogni foto: senza quei dati la misura vale poco.",
      "Mantieni sempre la distanza di sicurezza indicata dal gestore.",
    ],
  },
  danni: {
    camera: [
      ["Modalità", "Foto, in RAW (DNG) + JPG"],
      ["ISO", "100–200"],
      ["Tempo", "Almeno 1/500 s se scatti mentre il drone si muove"],
      ["Messa a fuoco", "Tocca sul tetto prima di ogni scatto"],
      ["Bilanciamento", "Automatico va bene"],
      ["Distanza", "10–20 m per le foto d'insieme, 3–5 m per i dettagli (attento a fili e antenne)"],
      ["Zoom", "Se il drone ce l'ha, usalo per i dettagli invece di avvicinarti"],
    ],
    portare: [
      "Batterie cariche e scheda di memoria vuota",
      "L'ok del proprietario e, se serve, dei vicini",
      "Gli appunti di dove entra l'acqua dentro casa: ti dicono dove guardare sul tetto",
    ],
    consigli: [
      "Il cielo coperto è ottimo: niente ombre dure e niente riflessi.",
      "Fai sempre prima le 4 foto dei lati e il tetto intero, poi i dettagli.",
      "Per ogni danno: una foto larga per capire dov'è e un primo piano con un riferimento (comignolo, grondaia).",
    ],
  },
};

const NOMI_ISPEZIONE = { fotovoltaico: "Fotovoltaico", edifici: "Termografia edifici", elettrico: "Impianti elettrici", danni: "Tetti e danni" };
export function ImpostazioniIspezione({ tipo, conNome }) {
  const d = CAMERA_ISPEZIONE[tipo];
  if (!d) return null;
  const titolo = { color: "#8fc1ff", fontSize: 12.5, fontWeight: 700, margin: "12px 0 4px 0" };
  return (
    <details style={{ background: "#141c26", border: "1px solid #2a4562", borderRadius: 8, padding: "10px 14px", margin: "14px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#8fc1ff" }}>📷 {conNome ? `${NOMI_ISPEZIONE[tipo]}: camera, cosa portare e consigli` : "Come impostare la camera, cosa portare e consigli"}</summary>
      <div style={titolo}>{tipo === "danni" ? "📷 Camera" : "🌡️ Termocamera"}</div>
      {d.camera.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 8, fontSize: 12.5, padding: "4px 0", borderBottom: "1px solid #24303d" }}>
          <span style={{ width: 110, flexShrink: 0, color: "#8fb3d9" }}>{k}</span><span style={{ color: "#e7eaee" }}>{v}</span>
        </div>
      ))}
      <div style={titolo}>🎒 Cosa portare</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#e7eaee", lineHeight: 1.5 }}>{d.portare.map((x) => <li key={x}>{x}</li>)}</ul>
      <div style={titolo}>💡 Consigli</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.5 }}>{d.consigli.map((x) => <li key={x}>{x}</li>)}</ul>
      <p style={{ fontSize: 10.5, color: "#6b7480", margin: "8px 0 0 0" }}>Valori indicativi: cambiano con la termocamera e il drone. Controlla sempre il manuale.</p>
    </details>
  );
}
