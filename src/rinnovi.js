// Rinnovo degli attestati che scadono dopo 5 anni (A1/A3, A2, STS): come si fa, link ENAC e corso per ripassare.
// Piccolo e separato da impara.js, così la pagina Attestati non carica tutte le lezioni e i quiz.
// Le regole possono cambiare (verificate a ottobre 2026 su ENAC e DronEzine): per i dettagli si rimanda sempre alla pagina ENAC.
const DRONEXT = "https://dronext.idevaffiliate.com/idevaffiliate.php?id=626&url=";

export const RINNOVI = {
  a1a3: {
    nome: "A1/A3",
    testo: "L'attestato A1/A3 vale 5 anni. Per rinnovarlo basta rifare il test online sul portale ENAC, da casa con lo SPID: costa 31 € e non serve nessun corso, basta ripassare. Se hai anche l'A2 preso in Italia, rinnovando l'A2 si rinnova anche l'A1/A3.",
    scaduto: "Con l'attestato A1/A3 scaduto non si vola in categoria Open: per tornare in regola basta rifare il test online sul portale ENAC (31 €, da casa con lo SPID).",
    enac: "https://www.enac.gov.it/sicurezza-aerea/droni/piloti-uas/come-si-diventa-pilota-uas-drone-open-a1a3/",
    // «Rinnova ora»: dove si fa davvero il rinnovo. A1/A3 sul portale ENAC con lo SPID (31 €)
    rinnova: { url: "https://serviziweb.enac.gov.it", testo: "Rinnova ora sul portale ENAC", nota: "Entri con lo SPID, paghi il diritto di 31 € e rifai il test da casa. Non serve un corso." },
    corso: DRONEXT + "1064",
    // gratis all'estero: un A1/A3 preso in un altro paese EASA vale anche in Italia
    gratis: { url: "https://dac.gouvernement.lu/en/drones/train-where-how.html", testo: "🇱🇺 Gratis in Lussemburgo", nota: "Corso e test online gratis su LearningZone di Eurocontrol, valido in tutta Europa. Attenzione: se hai l'A2 italiano conviene rinnovare l'A2, che rinnova anche l'A1/A3." },
  },
  a2: {
    nome: "A2",
    testo: "Il certificato A2 vale 5 anni. Per rinnovarlo si rifà l'esame A2, da 60 giorni prima della scadenza. L'esame non si fa da soli: va fatto tramite un'entità riconosciuta da ENAC (31 € di diritti ENAC più il costo dell'entità). Non serve rifare il corso, basta ripassare. Se l'A1/A3 è italiano, rinnovando l'A2 si rinnova anche quello.",
    scaduto: "Con il certificato A2 scaduto non si vola in sottocategoria A2: per tornare in regola si rifà l'esame A2 tramite un'entità riconosciuta da ENAC. Non serve rifare il corso.",
    enac: "https://www.enac.gov.it/sicurezza-aerea/droni/piloti-uas/come-si-diventa-pilota-uas-drone-open-a2/",
    // A2: serve un'entità riconosciuta; DroneXT fa l'esame A2 online
    rinnova: { url: DRONEXT + "1065", testo: "Rinnova l'A2 con DroneXT", nota: "DroneXT è un'entità che fa l'esame A2 online. Se ti basta l'esame non serve comprare il corso.", partner: true },
    corso: DRONEXT + "1065",
  },
  sts: {
    nome: "STS",
    testo: "L'attestato teorico STS vale 5 anni. Per rinnovarlo, prima della scadenza, serve l'aggiornamento o il nuovo esame presso un'entità riconosciuta da ENAC.",
    enac: "https://www.enac.gov.it/sicurezza-aerea/droni/piloti-uas/",
    rinnova: { url: DRONEXT + "1066", testo: "Rinnova ora con DroneXT", nota: "Percorso per l'attestato Specific STS.", partner: true },
    scaduto: "Con l'attestato STS scaduto non si vola in scenario standard: per tornare in regola serve il nuovo esame presso un'entità riconosciuta da ENAC.",
    corso: DRONEXT + "1066",
  },
};

// dal nome dell'attestato salvato capisco quale rinnovo mostrare
export function rinnovoPer(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (/\bsts\b/.test(t) && !/pratic/.test(t)) return { chiave: "sts", ...RINNOVI.sts };
  if (/\ba2\b/.test(t)) return { chiave: "a2", ...RINNOVI.a2 };
  if (/a1\s*\/?\s*a3|\ba1\b|\ba3\b/.test(t)) return { chiave: "a1a3", ...RINNOVI.a1a3 };
  return null;
}
