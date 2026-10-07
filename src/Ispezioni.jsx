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

export function CosaConsegnare({ tipo }) {
  const [copiata, setCopiata] = useState(null);
  const c = CONSEGNA[tipo];
  if (!c) return null;
  const copia = async (f) => {
    try { await navigator.clipboard.writeText(f); setCopiata(f); setTimeout(() => setCopiata(null), 1800); } catch { /* copia non disponibile */ }
  };
  return (
    <div style={{ marginTop: 12, background: "#121a12", border: "1px solid #2c4a2a", borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#a6e3a1" }}>📄 Cosa consegnare al cliente</div>
      <div style={{ fontSize: 12, color: "#c3cad4", margin: "6px 0 2px 0", fontWeight: 600 }}>Foto da mettere nel report</div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5, color: "#d6dde6" }}>{c.foto.map((f) => <li key={f}>{f}</li>)}</ul>
      <div style={{ fontSize: 12, color: "#c3cad4", margin: "8px 0 4px 0", fontWeight: 600 }}>Frasi pronte (tocca per copiarle, poi cambia le parti tra [ ])</div>
      {c.frasi.map((f) => (
        <button key={f} type="button" onClick={() => copia(f)} style={{ display: "block", width: "100%", textAlign: "left", background: copiata === f ? "#1d3a2a" : "#161a1f", color: "#e7eaee", border: `1px solid ${copiata === f ? "#4ade80" : "#2b313d"}`, borderRadius: 6, padding: "6px 8px", fontSize: 12, lineHeight: 1.45, marginBottom: 5, cursor: "pointer" }}>
          {copiata === f ? "✓ Copiata! " : "📋 "}{f}
        </button>
      ))}
      <div style={{ fontSize: 10.5, color: "#6b7480", marginTop: 4 }}>Scrivi solo quello che hai visto davvero: il report descrive le immagini, la diagnosi la fa un tecnico abilitato.</div>
    </div>
  );
}
