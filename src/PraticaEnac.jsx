import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { TestataPagina } from "./VoloHero.jsx";

// «Pratica ENAC»: bozza del Manuale delle Operazioni per gli scenari standard europei STS-01 e STS-02.
// La struttura segue punto per punto l'Appendice 5 dell'Allegato al Reg. (UE) 2019/947 (contenuto minimo del
// manuale per gli STS) e i requisiti degli scenari (UAS.STS-01.020/030, UAS.STS-02.020/030). I dati del pilota
// (azienda, codice operatore, attestati, droni, assicurazione) arrivano dall'app; il resto lo compila qui.
// È una BOZZA: l'operatore la legge, la adatta alle sue operazioni reali e la firma. Non è un documento ENAC.
// Per l'autorizzazione operativa (PDRA/SORA) ENAC chiede invece la struttura AMC1 UAS.SPEC.030(3)(e): qui c'è il link
// al modello EASA; per l'agricoltura ENAC ha pubblicato un manuale predefinito (AltMoC IT-UAS-2026-002).
// Dati salvati in supabase/pratica-enac.sql (se la tabella non c'è ancora, restano sul dispositivo).

const CHIAVE_LOCALE = "eyedrones_pratica_enac";
const FONTI = [
  ["Reg. (UE) 2019/947, Allegato, Appendice 5 — manuale delle operazioni per gli STS", "https://www.easa.europa.eu/en/document-library/easy-access-rules/easy-access-rules-unmanned-aircraft-systems-regulations-eu"],
  ["ENAC — Come operare in Categoria Specifica", "https://www.enac.gov.it/sicurezza-aerea/droni/categoria-specifica-specific-category/come-operare-in-categoria/"],
  ["ENAC — Scenari standard EASA (STS-01 e STS-02)", "https://www.enac.gov.it/sicurezza-aerea/droni/categoria-specifica-specific-category/scenari-standard-easa/"],
  ["ENAC — SPL-21 Droni: segnalazioni inconvenienti (2026)", "https://www.enac.gov.it/app/uploads/2026/06/SPL-21-Droni-segnalazioni-inconvenienti.pdf"],
];
const LINK_PDRA = "https://www.easa.europa.eu/en/document-library/general-publications/easa-operations-manual-example-uas-operations-under-pdra-s-01";
const LINK_AGRI = "https://www.enac.gov.it/sicurezza-aerea/alternative-means-of-compliance/altmoc-enac-it-uas-2026-002";

const ATTIVITA = ["Riprese foto e video", "Ispezioni (tetti, facciate, strutture)", "Termografia (fotovoltaico, edifici)", "Rilievi e fotogrammetria", "Mappatura agricola (senza trattamenti)", "Eventi e cantieri"];
const RUOLI = ["Responsabile delle operazioni", "Pilota remoto", "Osservatore dello spazio aereo", "Assistente a terra"];

const VUOTO = {
  scenario: "STS-01",
  revisione: "0",
  dataRevisione: "",
  operatore: { ragione: "", personaFisica: true, codice: "", indirizzo: "", email: "", telefono: "", responsabile: "" },
  persone: [],
  attivita: [],
  descrizione: "",
  area: "",
  meteo: { vento: "", visibilita: "", tmin: "", tmax: "" },
  droniScelti: [],
  sistemi: "D-Flight (zone geografiche e NOTAM); previsioni meteo e vento in quota nell'app EyeDrones; posizionamento GNSS del drone.",
  delimitazione: "nastro bianco-rosso e coni lungo il perimetro dell'area controllata a terra, cartelli «Area di volo — non oltrepassare», assistente a terra ai varchi",
  comunicazioni: "a voce entro 30 m; oltre, radio PMR446 con canale concordato nel briefing; telefono cellulare come riserva",
  emergenza: { ospedale: "", referente: "", telefonoReferente: "" },
};

const pieno = (v) => String(v ?? "").trim() !== "";
const dataIt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const oggi = () => new Date().toISOString().slice(0, 10);
const scaduto = (d) => !!d && new Date(`${String(d).slice(0, 10)}T23:59:59`) < new Date();
export const unisciPratica = (d) => ({
  ...VUOTO, ...(d || {}),
  operatore: { ...VUOTO.operatore, ...(d?.operatore || {}) },
  meteo: { ...VUOTO.meteo, ...(d?.meteo || {}) },
  emergenza: { ...VUOTO.emergenza, ...(d?.emergenza || {}) },
  persone: Array.isArray(d?.persone) ? d.persone : [],
  attivita: Array.isArray(d?.attivita) ? d.attivita : [],
  droniScelti: Array.isArray(d?.droniScelti) ? d.droniScelti : [],
});

const eSts = (a) => /\bSTS\b|STS-0?[12]|scenari standard/i.test(a?.tipo || "");
const eAssic = (a) => /assicura/i.test(a?.tipo || "");
const classeDi = (d) => String(d?.marcatura_classe || "").toUpperCase().replace(/\s/g, "");

// ---------- cosa manca prima di poter usare il manuale ----------
export function controlliPratica(f, { attestati = [], droni = [] } = {}) {
  const sts = f.scenario;
  const classe = sts === "STS-02" ? "C6" : "C5";
  const scelti = droni.filter((d) => f.droniScelti.includes(d.id));
  const piloti = f.persone.filter((p) => p.ruolo === "Pilota remoto" && pieno(p.nome));
  const assic = attestati.filter(eAssic);
  return [
    { titolo: "Nome dell'operatore (azienda o persona) e codice operatore D-Flight", ok: pieno(f.operatore.ragione) && /^[A-Z]{3}[A-Za-z0-9]{6,}/.test(String(f.operatore.codice || "").trim()), nota: "il codice operatore inizia con ITA e lo trovi su D-Flight" },
    { titolo: f.operatore.personaFisica ? "Operatore persona fisica: nome di chi firma" : "Responsabile (accountable manager) che firma il manuale", ok: pieno(f.operatore.responsabile) },
    { titolo: "Almeno un pilota remoto nell'elenco del personale", ok: piloti.length > 0 },
    { titolo: `Certificato teorico per gli scenari standard e accreditamento pratico ${sts}`, ok: attestati.some(eSts), nota: "aggiungilo in Attestati (tipo con «STS»): servono l'esame teorico STS e il corso pratico presso un'Entità Riconosciuta" },
    { titolo: `Almeno un drone di classe ${classe} scelto`, ok: scelti.length > 0 && scelti.every((d) => classeDi(d).includes(classe)), nota: scelti.length && !scelti.every((d) => classeDi(d).includes(classe)) ? `un drone scelto non risulta ${classe}: controlla la marcatura in «I miei droni»` : `lo ${sts} si fa solo con droni marcati ${classe}${sts === "STS-01" ? " (o C3 con il kit accessorio C5)" : ""}` },
    { titolo: "Assicurazione RC valida", ok: assic.some((a) => !scaduto(a.data_scadenza)), nota: "aggiungila in Attestati (tipo «Assicurazione»)" },
    { titolo: "Limiti meteo (vento massimo, visibilità, temperature)", ok: pieno(f.meteo.vento) && pieno(f.meteo.visibilita) && pieno(f.meteo.tmin) && pieno(f.meteo.tmax) },
    { titolo: "Attività svolte e area tipica delle operazioni", ok: f.attivita.length > 0 && pieno(f.area) },
    { titolo: "Contatti per il piano di emergenza (ospedale/pronto soccorso di riferimento)", ok: pieno(f.emergenza.ospedale) },
  ];
}

// ---------- il contenuto del manuale, in blocchi: lo stesso per PDF e Word ----------
export function contenutoManuale(f, { attestati = [], droni = [] } = {}) {
  const sts = f.scenario, due = sts === "STS-02";
  const op = f.operatore;
  const nomeOp = op.ragione || "[nome dell'operatore]";
  const classe = due ? "C6" : "C5";
  const scelti = droni.filter((d) => f.droniScelti.includes(d.id));
  const ventoMax = f.meteo.vento || (scelti.map((d) => d.vento_max_kmh).filter(Boolean).sort((a, b) => a - b)[0] ?? "");
  const persone = f.persone.filter((p) => pieno(p.nome));
  const B = [];
  const h1 = (t) => B.push({ t: "h1", testo: t });
  const h2 = (t) => B.push({ t: "h2", testo: t });
  const p = (t) => B.push({ t: "p", testo: t });
  const li = (righe) => B.push({ t: "li", righe });
  const tab = (colonne, righe) => B.push({ t: "tab", colonne, righe });

  B.push({ t: "copertina", titolo: "Manuale delle Operazioni", sotto: `Scenario standard europeo ${sts}`, righe: [
    ["Operatore UAS", nomeOp], ["Codice operatore", op.codice || "[ITA…]"], ["Revisione", `${f.revisione || "0"} del ${dataIt(f.dataRevisione || oggi())}`],
  ] });
  B.push({ t: "avviso", testo: "Bozza preparata con EyeDrones sulla base dell'Appendice 5 dell'Allegato al Reg. (UE) 2019/947. Va letta, adattata alle operazioni reali dell'operatore e firmata prima dell'uso. Non è un documento rilasciato o approvato da ENAC." });

  h1("0. Registro delle revisioni");
  tab(["Rev.", "Data", "Descrizione", "Approvata da"], [[f.revisione || "0", dataIt(f.dataRevisione || oggi()), "Prima emissione", op.responsabile || ""], ["", "", "", ""], ["", "", "", ""]]);

  h1("1. Dichiarazione di conformità");
  p(`Il presente manuale è conforme ai requisiti applicabili del Regolamento di esecuzione (UE) 2019/947 e alla dichiarazione per lo scenario standard ${sts} presentata dall'operatore sul portale D-Flight. Contiene le istruzioni che il personale coinvolto nelle operazioni di volo è tenuto a rispettare. Ogni persona coinvolta lo legge prima di partecipare alle operazioni e ne conferma la presa visione.`);

  h1("2. Approvazione");
  p(op.personaFisica ? `Approvato dall'operatore UAS, persona fisica: ${op.responsabile || "[nome e cognome]"}.` : `Approvato dal responsabile (accountable manager) di ${nomeOp}: ${op.responsabile || "[nome e cognome]"}.`);
  tab(["Nome e cognome", "Data", "Firma"], [[op.responsabile || "", dataIt(f.dataRevisione || oggi()), ""]]);

  h1("3. Organizzazione dell'operatore");
  p(`${nomeOp}${op.indirizzo ? `, ${op.indirizzo}` : ""}${op.email ? ` — ${op.email}` : ""}${op.telefono ? ` — tel. ${op.telefono}` : ""}. Codice operatore UAS: ${op.codice || "[ITA…]"}.`);
  p(op.personaFisica ? "L'operatore è una persona fisica che svolge personalmente il ruolo di responsabile delle operazioni e di pilota remoto; quando opera con altre persone, ne assegna i ruoli nel briefing." : "L'organizzazione è composta dalle persone elencate di seguito, con i rispettivi ruoli. Il responsabile delle operazioni pianifica i voli, assegna i compiti e verifica che le procedure del manuale siano rispettate.");
  tab(["Nome", "Ruolo", "Titoli e attestati"], persone.length ? persone.map((x) => [x.nome, x.ruolo || "", x.titoli || ""]) : [["[nome]", "Responsabile delle operazioni / Pilota remoto", ""]]);

  h1("4. Concetto delle operazioni");
  h2("4.a Natura delle attività e rischi associati");
  p(`Attività svolte: ${f.attivita.length ? f.attivita.join("; ") : "[elencare le attività]"}.${f.descrizione ? ` ${f.descrizione}` : ""}`);
  p("Rischi associati identificati: impatto con persone non coinvolte a terra; collisione con altri aeromobili; uscita del drone dal volume operativo (fly-away); perdita del collegamento di comando e controllo (C2); avaria di motori, batterie o navigazione; condizioni meteo avverse; interferenze elettromagnetiche; danni a cose e infrastrutture critiche. Le misure per ciascun rischio sono descritte nelle procedure al capitolo 6.");
  h2("4.b Ambiente operativo e area geografica");
  p(`(i) Area sorvolata. ${due ? "Le operazioni si svolgono sopra un'area controllata a terra interamente situata in un ambiente scarsamente popolato." : "Le operazioni si svolgono sopra un'area controllata a terra, anche in ambiente popolato, dove non sono presenti persone non coinvolte."} Area tipica: ${f.area || "[descrivere: tipo di zone, comuni o province]"}. Per ogni volo si valutano topografia, ostacoli (edifici, linee elettriche, alberi, gru) e possibili ostruzioni alla vista.`);
  p("(ii) Spazio aereo. Volo entro 120 m dal suolo. Prima di ogni volo si controllano su D-Flight le zone geografiche UAS, le aree vicino agli aeroporti e i NOTAM; nelle zone che lo richiedono si ottiene il nulla osta dell'autorità responsabile prima del volo. Se il drone ha la funzione di geo-consapevolezza, i dati vengono aggiornati prima dell'operazione.");
  p(`(iii) Condizioni ambientali. Si vola solo con: vento al suolo e in quota non oltre ${ventoMax ? `${ventoMax} km/h` : "[x] km/h"} e comunque entro i limiti del costruttore; nessuna precipitazione${due ? "; visibilità di volo superiore a 5 km (requisito dello STS-02)" : `; visibilità non inferiore a ${f.meteo.visibilita || "[x]"}`}; temperatura tra ${f.meteo.tmin || "[x]"} °C e ${f.meteo.tmax || "[x]"} °C. L'ambiente elettromagnetico si valuta sul posto: si evitano antenne trasmittenti, tralicci dell'alta tensione e grandi masse metalliche vicino al punto di decollo; in caso di disturbi a bussola o GNSS il volo non inizia.${due ? "" : ` La visibilità minima di ${f.meteo.visibilita || "[x]"} è scelta dall'operatore per mantenere sempre il contatto visivo (VLOS).`}`);
  p(due
    ? "(iv) Volume operativo e buffer. Per ogni operazione si definiscono: l'area della geografia di volo; il volume di contingenza, con il limite esterno almeno 10 m oltre la geografia di volo; il buffer di rischio a terra, almeno pari alla distanza che il drone può percorrere dopo l'attivazione della terminazione del volo indicata dal costruttore, nelle condizioni operative previste. L'area controllata a terra copre la proiezione al suolo del volume operativo e del buffer."
    : "(iv) Volume operativo e buffer. Per ogni operazione si definiscono: l'area della geografia di volo; l'area di contingenza, con il limite esterno almeno 10 m oltre la geografia di volo; il buffer di rischio a terra oltre l'area di contingenza, almeno secondo la tabella dello scenario (vedi sotto). L'area controllata a terra copre la proiezione al suolo del volume operativo e del buffer. I volumi si calcolano e si disegnano con il calcolatore STS-01 dell'app EyeDrones.");
  if (!due) tab(["Altezza massima dal suolo", "Buffer con MTOM fino a 10 kg", "Buffer con MTOM oltre 10 kg"], [["30 m", "10 m", "20 m"], ["60 m", "15 m", "30 m"], ["90 m", "20 m", "45 m"], ["120 m", "25 m", "60 m"]]);
  h2("4.c Mezzi tecnici");
  tab(["Drone", "Modello", "Matricola", "Classe", "Vento max"], scelti.length ? scelti.map((d) => [d.nome || "", d.modello || "", d.matricola || "", classeDi(d) || "[da verificare]", d.vento_max_kmh ? `${d.vento_max_kmh} km/h` : ""]) : [["[drone]", "", "", classe, ""]]);
  p(`Ogni drone è marcato in classe ${classe}${due ? "" : " (oppure classe C3 con il kit accessorio C5)"}, è accompagnato dalla dichiarazione UE di conformità con il riferimento alla classe, porta l'etichetta di classe e vola con l'identificazione remota diretta attiva e aggiornata.${due ? " Il sistema che impedisce al drone di uscire dalla geografia di volo è sempre attivo." : ""} Caratteristiche, prestazioni e limitazioni sono quelle del manuale del costruttore, tenuto a disposizione con questo manuale.`);
  p(`Sistemi e servizi esterni: ${f.sistemi || "[elencare]"} Dotazioni: materiale per delimitare l'area controllata, mezzi di comunicazione, kit di primo soccorso, estintore adatto alle batterie al litio, batterie di riserva cariche.`);
  h2("4.d Personale");
  p(`Per ogni operazione è presente almeno un pilota remoto${due ? "; gli osservatori dello spazio aereo si impiegano secondo il punto 6.c" : ""}. Il pilota remoto possiede il certificato di conoscenza teorica per gli scenari standard (valido 5 anni) e l'accreditamento di completamento dell'addestramento pratico ${sts}, rilasciato da un'Entità Riconosciuta.`);
  p("Selezione e formazione: il personale viene scelto in base agli attestati e all'esperienza; prima di partecipare legge questo manuale e svolge almeno un volo di prova con le procedure di contingenza ed emergenza (anche al simulatore, se rappresentativo). Esperienza recente: il pilota che non vola da più di 90 giorni esegue un volo di addestramento in area libera prima di un'operazione. L'addestramento ricorrente sulle procedure di contingenza ed emergenza si ripete almeno una volta l'anno ed è registrato.");

  h1("5. Manutenzione");
  p("La manutenzione segue le istruzioni e i programmi del costruttore. Prima e dopo ogni volo si eseguono le ispezioni del capitolo 6. Il firmware di drone, radiocomando e batterie si aggiorna solo con versioni ufficiali e dopo aver letto le note del costruttore, mai il giorno di un'operazione senza un volo di prova. Gli interventi, le ore di volo, i cicli delle batterie e le prossime scadenze di manutenzione si registrano nell'app EyeDrones («I miei droni», «Batterie»).");
  if (scelti.length) tab(["Drone", "Ore di volo", "Prossima manutenzione"], scelti.map((d) => [d.nome || d.modello || "", d.ore_volo != null ? String(d.ore_volo) : "", dataIt(d.prossima_manutenzione) || ""]));

  h1("6. Procedure operative");
  p("Le procedure si basano sulle istruzioni del costruttore del drone, che prevalgono in caso di contrasto.");
  h2("6.a Riduzione dell'errore umano");
  li(["Nel briefing prima di ogni operazione si assegnano chiaramente i compiti: chi pilota, chi controlla l'area a terra, chi osserva lo spazio aereo, chi tiene i contatti esterni.", "Il responsabile usa una checklist interna per verificare che ciascuno svolga i compiti assegnati (vedi Allegato A).", "Nessuno svolge due compiti essenziali contemporaneamente se questo riduce l'attenzione sul volo."]);
  h2("6.b Degrado dei sistemi esterni");
  li(["D-Flight non disponibile: si usano le zone geografiche salvate nell'app EyeDrones e i dati ufficiali più recenti; se non si può verificare la zona, non si vola.", "Segnale GNSS degradato: il volo non inizia; in volo si passa alla modalità di controllo manuale e si rientra.", "Previsioni meteo non disponibili: si decide solo con misure sul posto (anemometro, osservazione) e con margini più ampi."]);
  h2("6.c Procedure normali");
  p("(i) Preparazione prima del volo e checklist:");
  li([
    "(A) Valutazione del volume operativo e dei buffer: terreno, ostacoli e ostruzioni che possono ridurre la vista sul drone o sullo spazio aereo, possibile sorvolo di persone non coinvolte e di infrastrutture critiche.",
    "(B) Valutazione dell'ambiente circostante e dello spazio aereo: vicinanza di zone geografiche UAS, NOTAM, attività di altri utenti dello spazio aereo (elicotteri di soccorso, aerei agricoli, parapendio).",
    "(C) Condizioni ambientali adatte: vento, raffiche, precipitazioni, visibilità, temperatura entro i limiti del punto 4.b.",
    `(D) Numero minimo di persone: almeno il pilota remoto${due ? " e, se il drone vola oltre 1 km dal pilota, gli osservatori dello spazio aereo necessari" : ""}; ruoli e responsabilità confermati nel briefing.`,
    `(E) Comunicazioni: ${f.comunicazioni || "[descrivere]"}. Prima del decollo si prova il collegamento con ciascuna persona.`,
    "(F) Requisiti delle autorità locali: nulla osta delle zone geografiche, permessi del proprietario o del Comune, sicurezza, privacy, protezione dei dati e dell'ambiente, uso delle frequenze radio consentite.",
    `(G) Area controllata a terra: si determina sulla mappa (geografia di volo, contingenza, buffer) e la si mette in sicurezza con ${f.delimitazione || "[metodo di delimitazione]"}, coordinandosi con le autorità locali quando serve. Le persone presenti nell'area sono informate dei rischi, hanno ricevuto il briefing sulle misure di sicurezza e hanno accettato esplicitamente di partecipare.`,
    "(H) Verifica che il drone sia idoneo: ispezione pre-volo secondo la checklist del costruttore e l'Allegato A, batterie cariche, eliche integre, identificazione remota attiva, firmware aggiornato, calibrazioni.",
  ]);
  p(`(ii) Decollo e recupero: da un punto libero dentro la geografia di volo, con il drone sempre a vista; nessuno entro il raggio di sicurezza delle eliche.${due ? " Nello STS-02 decollo e atterraggio si fanno sempre a vista del pilota, salvo una terminazione di emergenza." : ""}`);
  p(due
    ? "(iii) In volo: il drone resta nella geografia di volo con il sistema di contenimento attivo; senza osservatori resta entro 1 km dal pilota e segue una traiettoria programmata quando non è a vista; con gli osservatori resta entro 2 km dal pilota e entro 1 km dall'osservatore più vicino, e nessun osservatore è a più di 1 km dal pilota."
    : "(iii) In volo: il drone resta sempre a vista (VLOS) e dentro la geografia di volo, con velocità al suolo inferiore a 5 m/s; il pilota controlla di continuo posizione, altezza, batteria e segnale.");
  p("(iv) Dopo il volo: ispezione del drone (struttura, eliche, motori, batterie), registrazione del volo e di eventuali anomalie nel registro voli, batterie messe a riposo a carica di conservazione.");
  p(`(v) Rilevamento di aeromobili in conflitto: il pilota${due ? " e gli osservatori dello spazio aereo" : ""} scrutano di continuo lo spazio aereo; a ogni avvistamento di un aeromobile con equipaggio si abbassa subito il drone e lo si allontana, dando sempre la precedenza.`);
  h2("6.d Procedure di contingenza");
  li([
    "(i) Il drone esce dalla geografia di volo: si riporta subito dentro con comandi manuali, a bassa velocità; se non risponde, si applica la procedura di emergenza.",
    "(ii) Persone non coinvolte entrano nell'area controllata: si ferma il drone in hovering lontano da loro o lo si fa atterrare in un punto sicuro; il volo riprende solo quando l'area è di nuovo libera.",
    "(iii) Condizioni avverse (vento oltre i limiti, pioggia, calo di visibilità): si interrompe il lavoro e si atterra nel punto sicuro più vicino.",
    "(iv) Degrado dei sistemi esterni (GNSS, collegamento C2, schermo): si passa al controllo manuale, si riduce la distanza e si rientra; con perdita del collegamento si attende il ritorno automatico verificando che la rotta sia libera.",
    ...(due ? ["(v) Fraseologia con gli osservatori, frasi brevi concordate nel briefing: «TRAFFICO, ore [x], [alto/basso], [vicino/lontano]» — «DRONE A VISTA» — «PERSO DI VISTA» — «SCENDI ORA» — «AREA LIBERA». Chi riceve ripete il messaggio."] : []),
    `(${due ? "vi" : "v"}) Altri utenti dello spazio aereo: il drone si abbassa e si allontana dal traffico; se il traffico si avvicina all'area si atterra.`,
  ]);
  h2("6.e Procedure di emergenza");
  li([
    "(i) Evitare danni a terzi: se il drone sta per uscire dall'area controllata o è fuori controllo, la priorità è la sicurezza di persone e aeromobili; si avvisano a voce le persone vicine.",
    `(ii) Il drone esce dal volume operativo: si attiva la terminazione del volo prevista dal costruttore del drone ${classe}, prima che superi il buffer di rischio a terra.`,
    "(iii) Recupero di emergenza: si mette in sicurezza il punto di caduta, si scollega la batteria con guanti, si valuta il rischio di incendio della batteria al litio (estintore adatto, contenitore ignifugo), si documenta con foto.",
  ]);
  p("Piano di risposta all'emergenza (ERP): criteri per riconoscere l'emergenza (drone fuori controllo, uscita dal volume operativo, caduta, persona ferita, incendio); compiti: il pilota mette in sicurezza il drone, l'assistente a terra protegge l'area e allerta i soccorsi; si chiama il 112 in caso di feriti o incendio; si informano le autorità secondo il punto 6.i; si limita l'escalation tenendo lontane le persone e bloccando l'accesso all'area.");
  tab(["Contatto", "Numero"], [["Emergenze (soccorso, vigili del fuoco)", "112"], ["Pronto soccorso di riferimento", f.emergenza.ospedale || ""], ["Referente sul posto / committente", [f.emergenza.referente, f.emergenza.telefonoReferente].filter(Boolean).join(" — ")], ["Responsabile delle operazioni", [op.responsabile, op.telefono].filter(Boolean).join(" — ")]]);
  h2("6.f Procedure di sicurezza (security)");
  li(["Drone, radiocomando e batterie sono custoditi sotto chiave quando non usati; il radiocomando e le app sono protetti da codice.", "Prima del volo si verifica che nessuno abbia manomesso il drone; i dati dei voli e del registro sono accessibili solo al personale autorizzato.", "Furti o manomissioni si denunciano alle autorità."]);
  h2("6.g Protezione dei dati personali");
  li(["Si riprende solo quello che serve al lavoro, evitando di inquadrare persone riconoscibili, targhe e proprietà private non interessate.", "Quando serve, si informano le persone presenti; i dati si conservano solo per il tempo necessario e in modo sicuro, nel rispetto del Regolamento (UE) 2016/679 (GDPR)."]);
  h2("6.h Riduzione del disturbo e dell'impatto ambientale");
  li(["Si limitano tempi di volo e passaggi ripetuti vicino alle abitazioni; si evitano gli orari di riposo quando possibile.", "Si rispettano le aree protette e la fauna (nidificazione, animali al pascolo), mantenendo le distanze e le regole delle aree naturali.", "Le batterie esauste si smaltiscono nei centri di raccolta."]);
  h2("6.i Segnalazione degli eventi");
  p("Gli eventi che incidono o possono incidere sulla sicurezza si segnalano all'ENAC tramite il sistema europeo ECCAIRS 2 (E2), dopo l'accredito dell'operatore presso ENAC, senza indebito ritardo e comunque entro 72 ore da quando se ne viene a conoscenza (Reg. (UE) 376/2014). In caso di incidente o inconveniente grave si informa anche l'ANSV, immediatamente e comunque entro 60 minuti (Reg. (UE) 996/2010).");
  p("Eventi da segnalare (elenco ENAC, non esaustivo): perdita involontaria di controllo o di autorità di comando; atterraggio fuori dall'area prevista; operazioni fuori dai limiti dello scenario; perdita del collegamento C2; danni o malfunzionamenti delle batterie; guasto di un motore; danni alla struttura o distacco di parti in volo; errori di configurazione o di programmazione del volo; avarie di display o navigazione; errori di coordinamento e comunicazione tra il personale; conflitti con aeromobili con equipaggio; violazioni di restrizioni dello spazio aereo; voli troppo vicini a persone non coinvolte.");
  h2("6.j Registrazioni");
  li(["Registro voli (data, luogo, pilota, drone, durata, note), manutenzioni, batterie e formazione del personale tenuti nell'app EyeDrones ed esportabili in PDF.", "Le registrazioni si conservano per almeno 2 anni e si mostrano all'ENAC su richiesta.", "Il registro delle revisioni del manuale (capitolo 0) si aggiorna a ogni modifica."]);
  h2("6.k Idoneità al volo del personale");
  p("Prima di ogni operazione il pilota remoto e ogni persona con compiti essenziali si dichiarano idonei: riposati, in buona salute, senza effetti di alcol, farmaci o sostanze psicoattive, senza stress o distrazioni che riducano l'attenzione. Chi non si sente idoneo lo dice nel briefing e non partecipa, senza conseguenze.");

  h1("Allegato A — Checklist del responsabile");
  li(["☐ Zone geografiche e NOTAM verificati su D-Flight; nulla osta ottenuti se richiesti", "☐ Meteo e vento entro i limiti del punto 4.b", "☐ Area controllata a terra disegnata, delimitata e presidiata", "☐ Persone presenti informate, istruite e d'accordo", "☐ Ruoli assegnati e comunicazioni provate", "☐ Drone ispezionato, batterie cariche, identificazione remota attiva", `☐ ${due ? "Contenimento della geografia di volo attivo; osservatori in posizione" : "Velocità al suolo sotto 5 m/s impostata"}`, "☐ Personale idoneo al volo (6.k)", "☐ Volo registrato a fine operazione"]);
  h1("Allegato B — Personale e presa visione del manuale");
  tab(["Nome", "Ruolo", "Data", "Firma per presa visione"], (persone.length ? persone : [{ nome: "", ruolo: "" }]).map((x) => [x.nome, x.ruolo || "", "", ""]));
  const titoli = attestati.filter((a) => !eAssic(a)).map((a) => [a.tipo || "", a.numero_riferimento || "", dataIt(a.data_scadenza) || ""]);
  if (titoli.length) { h1("Allegato C — Attestati del responsabile/pilota"); tab(["Attestato", "Numero", "Scadenza"], titoli); }
  return B;
}

// ---------- PDF ----------
function pdfManuale(blocchi, titoloPiede) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 18, W = 174, FONDO = 280;
  let y = 20;
  const spazio = (h) => { if (y + h > FONDO) { doc.addPage(); y = 20; } };
  const scrivi = (t, { size = 10.5, stile = "normal", colore = [33, 37, 43], rientro = 0, dopo = 2 } = {}) => {
    doc.setFont("helvetica", stile); doc.setFontSize(size); doc.setTextColor(...colore);
    const righe = doc.splitTextToSize(String(t), W - rientro);
    const h = size * 0.42;
    righe.forEach((r) => { spazio(h); doc.text(r, L + rientro, y); y += h; });
    y += dopo;
  };
  for (const b of blocchi) {
    if (b.t === "copertina") {
      doc.setFillColor(20, 23, 28); doc.rect(0, 0, 210, 70, "F");
      doc.setFillColor(255, 122, 47); doc.rect(0, 70, 210, 2.5, "F");
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(26); doc.text(b.titolo, L, 36);
      doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(255, 180, 140); doc.text(b.sotto, L, 48);
      y = 90;
      b.righe.forEach(([k, v]) => { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110, 118, 128); doc.text(k, L, y); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(33, 37, 43); doc.text(String(v), L, y + 6); y += 16; });
      y += 4;
    } else if (b.t === "avviso") {
      const righe = doc.splitTextToSize(b.testo, W - 10);
      const h = righe.length * 4.4 + 8; spazio(h);
      doc.setFillColor(255, 244, 230); doc.setDrawColor(255, 160, 100); doc.roundedRect(L, y, W, h, 2, 2, "FD");
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(120, 60, 20); doc.text(righe, L + 5, y + 6.5);
      y += h + 6; doc.addPage(); y = 20;
    } else if (b.t === "h1") { spazio(18); y += 4; scrivi(b.testo, { size: 15, stile: "bold", colore: [224, 85, 47], dopo: 3 }); }
    else if (b.t === "h2") { spazio(12); y += 1; scrivi(b.testo, { size: 12, stile: "bold", dopo: 2 }); }
    else if (b.t === "p") scrivi(b.testo, { dopo: 3 });
    else if (b.t === "li") {
      b.righe.forEach((r) => {
        spazio(5); doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(33, 37, 43);
        const casella = /^☐\s*/.test(r);   // la casella ☐ non c'è nei caratteri standard del PDF: la disegno
        if (casella) { doc.setDrawColor(90, 98, 110); doc.rect(L + 0.5, y - 3, 3.4, 3.4); } else doc.text("•", L + 1, y);
        scrivi(casella ? r.replace(/^☐\s*/, "") : r, { rientro: casella ? 6 : 5, dopo: casella ? 2.2 : 1.2 });
      });
      y += 2;
    }
    else if (b.t === "tab") {
      const n = b.colonne.length, cw = W / n;
      const riga = (celle, testa) => {
        doc.setFont("helvetica", testa ? "bold" : "normal"); doc.setFontSize(9.5);
        const linee = celle.map((c) => doc.splitTextToSize(String(c ?? ""), cw - 3));
        const h = Math.max(7, Math.max(...linee.map((l) => l.length)) * 4.1 + 3);
        spazio(h);
        if (testa) { doc.setFillColor(238, 241, 245); doc.rect(L, y, W, h, "F"); }
        doc.setDrawColor(210, 215, 222); doc.rect(L, y, W, h);
        linee.forEach((l, i) => { if (i) doc.line(L + cw * i, y, L + cw * i, y + h); doc.setTextColor(33, 37, 43); doc.text(l, L + cw * i + 1.5, y + 4.8); });
        y += h;
      };
      riga(b.colonne, true); b.righe.forEach((r) => riga(r, false)); y += 4;
    }
  }
  const pagine = doc.getNumberOfPages();
  for (let i = 2; i <= pagine; i++) {
    doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(140, 146, 154);
    doc.text(titoloPiede, L, 290); doc.text(`pag. ${i} di ${pagine}`, 210 - L, 290, { align: "right" });
  }
  return doc;
}

// ---------- Word (.doc in HTML: si apre con Word, LibreOffice e Google Documenti) ----------
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function docManuale(blocchi, titolo) {
  const parti = blocchi.map((b) => {
    if (b.t === "copertina") return `<h1 style="font-size:28pt;margin:0">${esc(b.titolo)}</h1><p style="font-size:15pt;color:#e0552f;margin:4pt 0 18pt">${esc(b.sotto)}</p>${b.righe.map(([k, v]) => `<p style="margin:0;color:#6e7680;font-size:9pt">${esc(k)}</p><p style="margin:0 0 10pt;font-size:13pt"><b>${esc(v)}</b></p>`).join("")}`;
    if (b.t === "avviso") return `<p style="border:1pt solid #ffa064;background:#fff4e6;padding:8pt;color:#783c14">${esc(b.testo)}</p><br style="page-break-before:always">`;
    if (b.t === "h1") return `<h1 style="color:#e0552f;font-size:16pt;margin-top:18pt">${esc(b.testo)}</h1>`;
    if (b.t === "h2") return `<h2 style="font-size:12.5pt;margin-top:12pt">${esc(b.testo)}</h2>`;
    if (b.t === "p") return `<p>${esc(b.testo)}</p>`;
    if (b.t === "li") return `<ul>${b.righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>`;
    if (b.t === "tab") return `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;width:100%;font-size:9.5pt"><tr>${b.colonne.map((c) => `<th style="background:#eef1f5;text-align:left">${esc(c)}</th>`).join("")}</tr>${b.righe.map((r) => `<tr>${r.map((c) => `<td>${esc(c) || "&nbsp;"}</td>`).join("")}</tr>`).join("")}</table>`;
    return "";
  }).join("\n");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(titolo)}</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.35}</style></head><body>${parti}</body></html>`;
}

function scarica(blob, nome) {
  const u = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = u; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}

// ---------- pagina ----------
const scheda = { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 16, marginBottom: 14 };
const etichetta = { fontSize: 11.5, color: "#8b95a3", display: "block", marginBottom: 4 };
const btn = (primario) => ({ background: primario ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: primario ? "#10141f" : "#e7eaee", border: primario ? "none" : "1px solid #343e57", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer" });

export default function PraticaEnac({ supabase, inputStyle, azienda, attestati = [], droni = [], emailUtente }) {
  const [f, setF] = useState(null);
  const [stato, setStato] = useState(""); // "" | "salvo" | "salvato" | "locale"
  const tabellaOk = useRef(true);
  const primoGiro = useRef(true);

  // carico la pratica salvata; se è la prima volta, la riempio con i dati dell'app
  useEffect(() => {
    let annullato = false;
    (async () => {
      let salvata = null;
      const { data, error } = await supabase.from("pratica_enac").select("dati").maybeSingle();
      if (error) { tabellaOk.current = false; try { salvata = JSON.parse(localStorage.getItem(CHIAVE_LOCALE) || "null"); } catch { /* niente */ } }
      else salvata = data?.dati || null;
      if (!salvata) {
        const pag = await supabase.from("pagine_pilota").select("nome, codice_operatore, telefono, email, citta, provincia").maybeSingle().then((r) => r.data, () => null);
        const titoliPilota = attestati.filter((a) => !eAssic(a) && !scaduto(a.data_scadenza)).map((a) => a.tipo).filter(Boolean).join(", ");
        const nome = (pag && pag.nome) || (azienda?.nomeImpostato ? azienda.nome : "");
        salvata = {
          operatore: { ragione: nome, personaFisica: true, codice: (pag && pag.codice_operatore) || "", indirizzo: pag ? [pag.citta, pag.provincia].filter(Boolean).join(" ") : "", email: (pag && pag.email) || emailUtente || "", telefono: (pag && pag.telefono) || "", responsabile: "" },
          persone: [{ nome: "", ruolo: "Pilota remoto", titoli: titoliPilota }],
          droniScelti: droni.filter((d) => /C5|C6/i.test(d.marcatura_classe || "")).map((d) => d.id),
          dataRevisione: oggi(),
        };
        const c6 = droni.some((d) => /C6/i.test(d.marcatura_classe || "")), c5 = droni.some((d) => /C5/i.test(d.marcatura_classe || ""));
        if (c6 && !c5) salvata.scenario = "STS-02";
      }
      if (!annullato) setF(unisciPratica(salvata));
    })();
    return () => { annullato = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // salvataggio automatico (dopo un attimo di pausa)
  useEffect(() => {
    if (!f) return;
    if (primoGiro.current) { primoGiro.current = false; return; }
    setStato("salvo");
    const t = setTimeout(async () => {
      try { localStorage.setItem(CHIAVE_LOCALE, JSON.stringify(f)); } catch { /* niente */ }
      if (tabellaOk.current) {
        const uid = (await supabase.auth.getUser()).data?.user?.id;
        const { error } = await supabase.from("pratica_enac").upsert({ user_id: uid, dati: f, updated_at: new Date().toISOString() });
        if (error) { tabellaOk.current = false; setStato("locale"); return; }
        setStato("salvato");
      } else setStato("locale");
    }, 900);
    return () => clearTimeout(t);
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const controlli = useMemo(() => (f ? controlliPratica(f, { attestati, droni }) : []), [f, attestati, droni]);
  if (!f) return <div style={{ padding: 24, color: "#8b95a3" }}>Carico la pratica…</div>;

  const cambia = (percorso, valore) => setF((x) => {
    const n = { ...x };
    if (percorso.includes(".")) { const [a, b] = percorso.split("."); n[a] = { ...n[a], [b]: valore }; } else n[percorso] = valore;
    return n;
  });
  const campo = (percorso, label, extra = {}) => {
    const [a, b] = percorso.split(".");
    const v = b ? f[a][b] : f[a];
    return <label style={{ display: "block", ...(extra.box || {}) }}><span style={etichetta}>{label}</span><input value={v ?? ""} onChange={(e) => cambia(percorso, e.target.value)} placeholder={extra.placeholder || ""} inputMode={extra.inputMode} style={inputStyle} /></label>;
  };
  const fatte = controlli.filter((c) => c.ok).length;
  const nomeFile = `Manuale-Operazioni-${f.scenario}-${(f.operatore.ragione || "operatore").replace(/[^A-Za-z0-9]+/g, "-")}-rev${f.revisione || 0}`;
  const genera = (tipo) => {
    const blocchi = contenutoManuale(f, { attestati, droni });
    const piede = `Manuale delle Operazioni ${f.scenario} · ${f.operatore.ragione || ""} · Rev. ${f.revisione || 0}`;
    if (tipo === "pdf") pdfManuale(blocchi, piede).save(`${nomeFile}.pdf`);
    else scarica(new Blob(["﻿", docManuale(blocchi, piede)], { type: "application/msword" }), `${nomeFile}.doc`);
  };
  const griglia = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 };

  return (
    <div style={{ maxWidth: 860 }}>
      <TestataPagina titolo="Pratica ENAC" sigla="STS · MANUALE DELLE OPERAZIONI" info="Prepara la bozza del Manuale delle Operazioni per gli scenari standard europei STS-01 e STS-02, con i tuoi dati già inseriti." />

      <div style={{ ...scheda, background: "#1b1a14", borderColor: "#5a4a22" }}>
        <div style={{ fontWeight: 700, color: "#ffd68a", fontSize: 14 }}>Che cos'è</div>
        <p style={{ fontSize: 13, color: "#d8d2bf", margin: "6px 0 0 0", lineHeight: 1.55 }}>Per volare negli scenari standard (STS-01 e STS-02) serve un <b>Manuale delle Operazioni</b> con i contenuti dell'Appendice 5 del Reg. (UE) 2019/947. Qui lo prepari in pochi minuti: i tuoi dati arrivano dall'app, il resto lo completi sotto. Ottieni una <b>bozza in PDF e in Word</b> da leggere, adattare e firmare. Non è un documento ENAC e non sostituisce la tua valutazione.</p>
        <p style={{ fontSize: 12.5, color: "#bdb69f", margin: "8px 0 0 0", lineHeight: 1.5 }}>Altri percorsi: <b>autorizzazione operativa</b> con PDRA o SORA → ENAC chiede la struttura AMC1 (<a href={LINK_PDRA} target="_blank" rel="noreferrer" style={{ color: "#ffb877" }}>modello EASA</a>). <b>Agricoltura</b> → ENAC ha un manuale predefinito (<a href={LINK_AGRI} target="_blank" rel="noreferrer" style={{ color: "#ffb877" }}>AltMoC IT-UAS-2026-002</a>).</p>
      </div>

      <div style={scheda}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Cosa manca · {fatte} su {controlli.length}</div>
          <span style={{ fontSize: 12, color: "#8b95a3" }}>{stato === "salvo" ? "Salvo…" : stato === "salvato" ? "✓ Salvato" : stato === "locale" ? "Salvato su questo dispositivo" : ""}</span>
        </div>
        <div style={{ height: 6, background: "#232b3f", borderRadius: 4, margin: "10px 0 12px", overflow: "hidden" }}><div style={{ width: `${(fatte / controlli.length) * 100}%`, height: "100%", background: fatte === controlli.length ? "#4ade80" : "#ff8c42" }} /></div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 7 }}>
          {controlli.map((c) => <li key={c.titolo} style={{ display: "flex", gap: 8, fontSize: 13.5, color: c.ok ? "#c3cad4" : "#e7eaee" }}><span>{c.ok ? "✅" : "⬜"}</span><span>{c.titolo}{!c.ok && c.nota ? <span style={{ display: "block", fontSize: 12, color: "#8b95a3" }}>{c.nota}</span> : null}</span></li>)}
        </ul>
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>1 · Scenario</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["STS-01", "A vista, area controllata a terra, anche in zona abitata · drone C5"], ["STS-02", "Oltre la vista con osservatori, zona poco abitata · drone C6"]].map(([k, t]) => (
            <button key={k} type="button" onClick={() => cambia("scenario", k)} style={{ flex: "1 1 240px", textAlign: "left", background: f.scenario === k ? "#2a1d14" : "#10141f", border: `1px solid ${f.scenario === k ? "#ff8c42" : "#343e57"}`, color: "#e7eaee", borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}>
              <b style={{ fontSize: 15 }}>{k}</b><span style={{ display: "block", fontSize: 12.5, color: "#aab3bf", marginTop: 2 }}>{t}</span>
            </button>))}
        </div>
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>2 · Operatore</div>
        <div style={griglia}>
          {campo("operatore.ragione", "Nome dell'operatore (azienda o nome e cognome)")}
          {campo("operatore.codice", "Codice operatore D-Flight", { placeholder: "ITA…" })}
          {campo("operatore.indirizzo", "Indirizzo / sede")}
          {campo("operatore.email", "Email")}
          {campo("operatore.telefono", "Telefono", { inputMode: "tel" })}
          {campo("operatore.responsabile", f.operatore.personaFisica ? "Chi firma (nome e cognome)" : "Responsabile — accountable manager")}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13.5 }}><input type="checkbox" checked={!!f.operatore.personaFisica} onChange={(e) => cambia("operatore.personaFisica", e.target.checked)} /> Sono un operatore persona fisica (lavoro da solo o con qualche aiuto)</label>
        <div style={{ ...griglia, marginTop: 10 }}>
          {campo("revisione", "Numero di revisione", { inputMode: "numeric" })}
          <label style={{ display: "block" }}><span style={etichetta}>Data della revisione</span><input type="date" value={f.dataRevisione || ""} onChange={(e) => cambia("dataRevisione", e.target.value)} style={inputStyle} /></label>
        </div>
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>3 · Personale</div>
        {f.persone.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 8, alignItems: "end" }}>
            <label><span style={etichetta}>Nome e cognome</span><input value={p.nome} onChange={(e) => cambia("persone", f.persone.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} style={inputStyle} /></label>
            <label><span style={etichetta}>Ruolo</span><select value={p.ruolo} onChange={(e) => cambia("persone", f.persone.map((x, j) => (j === i ? { ...x, ruolo: e.target.value } : x)))} style={inputStyle}>{RUOLI.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label><span style={etichetta}>Titoli e attestati</span><input value={p.titoli || ""} onChange={(e) => cambia("persone", f.persone.map((x, j) => (j === i ? { ...x, titoli: e.target.value } : x)))} style={inputStyle} /></label>
            <button type="button" onClick={() => cambia("persone", f.persone.filter((_, j) => j !== i))} style={{ ...btn(false), padding: "9px 10px" }} aria-label="Togli">✕</button>
          </div>))}
        <button type="button" onClick={() => cambia("persone", [...f.persone, { nome: "", ruolo: f.persone.length ? (f.scenario === "STS-02" ? "Osservatore dello spazio aereo" : "Assistente a terra") : "Pilota remoto", titoli: "" }])} style={btn(false)}>+ Aggiungi persona</button>
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>4 · Attività e area</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ATTIVITA.map((a) => { const si = f.attivita.includes(a); return <button key={a} type="button" onClick={() => cambia("attivita", si ? f.attivita.filter((x) => x !== a) : [...f.attivita, a])} style={{ background: si ? "#2a1d14" : "#10141f", border: `1px solid ${si ? "#ff8c42" : "#343e57"}`, color: "#e7eaee", borderRadius: 20, padding: "7px 12px", fontSize: 13, cursor: "pointer" }}>{si ? "✓ " : ""}{a}</button>; })}
        </div>
        <label style={{ display: "block", marginTop: 10 }}><span style={etichetta}>Descrizione delle attività (facoltativa)</span><textarea rows={3} value={f.descrizione} onChange={(e) => cambia("descrizione", e.target.value)} placeholder="Es. riprese di immobili e cantieri per agenzie e imprese edili" style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} /></label>
        {campo("area", "Area tipica delle operazioni", { placeholder: "Es. provincia di Torino, zone urbane e periferiche", box: { marginTop: 10 } })}
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>5 · Limiti meteo</div>
        <div style={griglia}>
          {campo("meteo.vento", "Vento massimo (km/h)", { inputMode: "decimal", placeholder: "dal manuale del drone" })}
          {f.scenario === "STS-01" ? campo("meteo.visibilita", "Visibilità minima", { placeholder: "Es. 3 km" }) : <label><span style={etichetta}>Visibilità minima</span><input value="oltre 5 km (STS-02)" readOnly style={{ ...inputStyle, opacity: 0.7 }} /></label>}
          {campo("meteo.tmin", "Temperatura minima (°C)", { inputMode: "decimal" })}
          {campo("meteo.tmax", "Temperatura massima (°C)", { inputMode: "decimal" })}
        </div>
        {f.scenario === "STS-02" && !pieno(f.meteo.visibilita) && <button type="button" onClick={() => cambia("meteo.visibilita", "5 km")} style={{ ...btn(false), marginTop: 10 }}>Usa «oltre 5 km»</button>}
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>6 · Droni</div>
        {droni.length === 0 ? <p style={{ fontSize: 13, color: "#8b95a3", margin: 0 }}>Nessun drone: aggiungilo prima in «I miei droni», con la marcatura di classe.</p> : droni.map((d) => {
          const si = f.droniScelti.includes(d.id); const cl = classeDi(d);
          return <label key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #232b3f", fontSize: 13.5 }}>
            <input type="checkbox" checked={si} onChange={() => cambia("droniScelti", si ? f.droniScelti.filter((x) => x !== d.id) : [...f.droniScelti, d.id])} />
            <span style={{ flex: 1 }}><b>{d.nome}</b>{d.modello ? ` · ${d.modello}` : ""}<span style={{ display: "block", fontSize: 12, color: "#8b95a3" }}>Classe: {cl || "non indicata"}{d.vento_max_kmh ? ` · vento max ${d.vento_max_kmh} km/h` : ""}</span></span>
          </label>;
        })}
      </div>

      <div style={scheda}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>7 · Procedure sul posto</div>
        <label style={{ display: "block" }}><span style={etichetta}>Come delimiti l'area controllata a terra</span><textarea rows={2} value={f.delimitazione} onChange={(e) => cambia("delimitazione", e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} /></label>
        <label style={{ display: "block", marginTop: 10 }}><span style={etichetta}>Come comunicate tra voi</span><textarea rows={2} value={f.comunicazioni} onChange={(e) => cambia("comunicazioni", e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} /></label>
        <label style={{ display: "block", marginTop: 10 }}><span style={etichetta}>Sistemi e servizi esterni che usi</span><textarea rows={2} value={f.sistemi} onChange={(e) => cambia("sistemi", e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} /></label>
        <div style={{ ...griglia, marginTop: 10 }}>
          {campo("emergenza.ospedale", "Pronto soccorso di riferimento", { placeholder: "Es. Ospedale di Rivoli" })}
          {campo("emergenza.referente", "Referente sul posto (facoltativo)")}
          {campo("emergenza.telefonoReferente", "Telefono del referente", { inputMode: "tel" })}
        </div>
      </div>

      <div style={{ ...scheda, borderColor: "#ff8c4266" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Scarica la bozza</div>
        <p style={{ fontSize: 13, color: "#aab3bf", margin: "6px 0 12px 0" }}>{fatte === controlli.length ? "Ci sono tutti i dati. Leggila con calma, adattala e firmala." : "Puoi scaricarla anche ora: dove mancano dati trovi [segnaposto] da completare."}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={() => genera("pdf")} style={btn(true)}>📄 Scarica PDF</button>
          <button type="button" onClick={() => genera("doc")} style={btn(false)}>📝 Scarica Word (da modificare)</button>
        </div>
        <p style={{ fontSize: 12, color: "#8b95a3", margin: "12px 0 0 0", lineHeight: 1.5 }}>Dopo: 1) leggi e adatta il manuale alle tue operazioni reali; 2) firmalo; 3) fai la dichiarazione {f.scenario} su D-Flight; 4) tienilo con te durante i voli: ENAC può chiederlo in qualsiasi momento.</p>
      </div>

      <div style={{ fontSize: 11.5, color: "#6b7480", lineHeight: 1.6, margin: "4px 2px 24px" }}>
        Fonti: {FONTI.map(([t, u], i) => <span key={u}>{i ? " · " : ""}<a href={u} target="_blank" rel="noreferrer" style={{ color: "#8b95a3" }}>{t}</a></span>)}
      </div>
    </div>
  );
}
