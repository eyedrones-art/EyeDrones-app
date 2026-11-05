// EyeDrones — riepilogo fiscale del preventivo secondo il regime del pilota.
// È un aiuto per preparare il preventivo: la fattura e i conti vanno controllati con il proprio commercialista.
// Regole verificate a novembre 2026 (guide dell'Agenzia delle Entrate e dei principali servizi fiscali):
// - forfettario: niente IVA (art. 1, commi 54-89, L. 190/2014), niente ritenuta d'acconto (comma 67),
//   marca da bollo 2 € sopra 77,47 € (sul totale del documento, rivalsa compresa);
// - prestazione occasionale: fuori campo IVA (art. 5 DPR 633/72), ritenuta 20% solo se il cliente è un'azienda
//   o un professionista (sostituto d'imposta, art. 25 DPR 600/73), bollo 2 € sopra 77,47 €, contributi INPS
//   (Gestione separata) solo sulla parte che supera 5.000 € l'anno;
// - ordinario: IVA (22% di base), rivalsa INPS 4% facoltativa per chi è in Gestione separata, ritenuta 20% solo
//   per i professionisti e solo con cliente azienda.

export const REGIMI = [
  { key: "", label: "Non lo so / non indicarlo", breve: "come oggi: «IVA esclusa, se dovuta»" },
  { key: "ordinario", label: "Ordinario (con IVA)", breve: "partita IVA con IVA in fattura" },
  { key: "forfettario", label: "Forfettario (senza IVA)", breve: "partita IVA in regime forfettario" },
  { key: "occasionale", label: "Prestazione occasionale", breve: "senza partita IVA" },
];

export const FISCO_DEFAULT = { regime: "", iva: 22, rivalsa: false, ritenuta: false };
export const SOGLIA_BOLLO = 77.47;
export const BOLLO = 2;

const arr = (n) => Math.round((Number(n) || 0) * 100) / 100;

// p.iva o codice fiscale di 11 cifre = azienda (o professionista)
export const sembraAzienda = (pivaCf) => /^(IT)?\d{11}$/i.test(String(pivaCf || "").replace(/\s/g, ""));

// importo = prezzo del preventivo (compenso, già scontato)
// cliente: "privato" | "azienda"
export function calcolaFisco(importo, fisco, cliente) {
  const f = { ...FISCO_DEFAULT, ...(fisco || {}) };
  const imp = arr(importo);
  const azienda = cliente === "azienda";
  const righe = [];
  const frasi = [];
  let totale = imp;
  let ritenuta = 0;
  let bollo = 0;

  if (f.regime === "ordinario") {
    const rivalsa = f.rivalsa ? arr(imp * 0.04) : 0;
    const base = arr(imp + rivalsa);
    const aliquota = Number(f.iva) >= 0 && f.iva !== "" ? Number(f.iva) : 22;
    const iva = arr(base * aliquota / 100);
    righe.push(["Imponibile", imp]);
    if (rivalsa) righe.push(["Rivalsa INPS 4% (art. 1, c. 212, L. 662/1996)", rivalsa]);
    righe.push([`IVA ${aliquota}%`, iva]);
    totale = arr(base + iva);
    if (f.ritenuta && azienda) ritenuta = arr(base * 0.2);
  } else if (f.regime === "forfettario") {
    const rivalsa = f.rivalsa ? arr(imp * 0.04) : 0;
    const base = arr(imp + rivalsa);
    righe.push(["Compenso", imp]);
    if (rivalsa) righe.push(["Rivalsa INPS 4% (art. 1, c. 212, L. 662/1996)", rivalsa]);
    if (base > SOGLIA_BOLLO) bollo = BOLLO;
    totale = arr(base + bollo);
    frasi.push("Operazione senza applicazione dell'IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014 (regime forfettario). Compenso non soggetto a ritenuta d'acconto ai sensi dell'art. 1, comma 67, L. 190/2014.");
  } else if (f.regime === "occasionale") {
    righe.push(["Compenso lordo", imp]);
    if (imp > SOGLIA_BOLLO) bollo = BOLLO;
    totale = arr(imp + bollo);
    if (azienda) ritenuta = arr(imp * 0.2);
    frasi.push("Prestazione di lavoro autonomo occasionale, fuori campo IVA ai sensi dell'art. 5 DPR 633/1972.");
    if (azienda) frasi.push("Ritenuta d'acconto del 20% (art. 25 DPR 600/1973) trattenuta e versata dal committente.");
  } else {
    righe.push(["Totale", imp]);
    return { regime: "", righe, bollo: 0, totale: imp, ritenuta: 0, netto: imp, frasi: [], dicitura: "I prezzi indicati si intendono IVA esclusa, se dovuta." };
  }
  if (bollo) {
    righe.push(["Marca da bollo (importo oltre 77,47 €)", bollo]);
    frasi.push("Imposta di bollo da 2 € addebitata al cliente.");
  }
  const netto = arr(totale - ritenuta);
  return { regime: f.regime, righe, bollo, totale, ritenuta, netto, frasi, dicitura: "" };
}

// la frase sull'IVA delle note legali di partenza, adattata al regime
export function fraseIvaNoteLegali(fisco) {
  const r = (fisco || {}).regime;
  if (r === "ordinario") return "I prezzi indicati sono al netto dell'IVA, esposta nel riepilogo.";
  if (r === "forfettario") return "Operazione senza IVA (regime forfettario, art. 1, commi 54-89, L. 190/2014).";
  if (r === "occasionale") return "Prestazione occasionale fuori campo IVA (art. 5 DPR 633/1972).";
  return "I prezzi indicati si intendono IVA esclusa, se dovuta.";
}

// dal prezzo finale pagato dal cliente al compenso del pilota (l'inverso di calcolaFisco, cliente privato)
export function compensoDaFinale(finale, fisco) {
  const f = { ...FISCO_DEFAULT, ...(fisco || {}) };
  const tot = arr(finale);
  const r = f.rivalsa ? 0.04 : 0;
  if (f.regime === "ordinario") {
    const aliquota = Number(f.iva) >= 0 && f.iva !== "" ? Number(f.iva) : 22;
    return arr(tot / ((1 + r) * (1 + aliquota / 100)));
  }
  if (f.regime === "forfettario") {
    const base = tot - BOLLO > SOGLIA_BOLLO ? tot - BOLLO : tot;
    return arr(base / (1 + r));
  }
  if (f.regime === "occasionale") return arr(tot - BOLLO > SOGLIA_BOLLO ? tot - BOLLO : tot);
  return tot;
}

// cosa leggono il pilota e il cliente sotto il prezzo finale
export function notaPrezzoFinale(regime, fisco) {
  if (regime === "ordinario") return `IVA${fisco?.iva !== undefined && fisco?.iva !== "" ? ` ${fisco.iva}%` : ""} compresa`;
  if (regime === "forfettario") return "senza IVA (regime forfettario)";
  if (regime === "occasionale") return "senza IVA (prestazione occasionale)";
  return "";
}
