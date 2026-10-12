// Rinnovo degli attestati che scadono dopo 5 anni (A1/A3, A2, STS): come si fa, link ENAC e corso per ripassare.
// Piccolo e separato da impara.js, così la pagina Attestati non carica tutte le lezioni e i quiz.
// Le regole possono cambiare: per i dettagli si rimanda sempre alla pagina ENAC.
const DRONEXT = "https://dronext.idevaffiliate.com/idevaffiliate.php?id=626&url=";

export const RINNOVI = {
  a1a3: {
    nome: "A1/A3",
    testo: "L'attestato A1/A3 vale 5 anni. Per rinnovarlo, prima della scadenza, si rifà il test online sul portale ENAC: conviene ripassare, perché le regole nel frattempo possono essere cambiate.",
    scaduto: "Con l'attestato A1/A3 scaduto non si vola in categoria Open: per tornare in regola si rifà il test online sul portale ENAC.",
    enac: "https://www.enac.gov.it/sicurezza-aerea/droni/piloti-uas/come-si-diventa-pilota-uas-drone-open-a1a3/",
    // «Rinnova ora»: dove si fa davvero il rinnovo. A1/A3 sul portale ENAC con lo SPID (31 €)
    rinnova: { url: "https://serviziweb.enac.gov.it", testo: "Rinnova ora sul portale ENAC", nota: "Entri con lo SPID, paghi il diritto di 31 € e rifai il test da casa." },
    corso: DRONEXT + "1064",
  },
  a2: {
    nome: "A2",
    testo: "Il certificato A2 vale 5 anni. Per rinnovarlo, prima della scadenza, si rifà l'esame presso ENAC o un'entità riconosciuta (oppure l'aggiornamento previsto): conviene ripassare con calma.",
    enac: "https://www.enac.gov.it/sicurezza-aerea/droni/piloti-uas/",
    // A2: DroneXT ha il corso con l'accesso all'esame online da casa
    rinnova: { url: DRONEXT + "1065", testo: "Rinnova ora con DroneXT", nota: "Corso A2 con l'accesso all'esame online da casa.", partner: true },
    scaduto: "Con il certificato A2 scaduto non si vola in sottocategoria A2: per tornare in regola si rifà l'esame presso ENAC o un'entità riconosciuta.",
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
