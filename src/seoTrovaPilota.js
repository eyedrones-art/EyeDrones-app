// Testi delle pagine di «Trova un pilota» per i clienti: li usa l'app (App.jsx) e lo script che prepara
// le pagine per Google dopo la build (scripts/pagine-google.mjs). Solo testo semplice, niente JSX.
export const PROVINCE_ITALIA = { AG: "Agrigento", AL: "Alessandria", AN: "Ancona", AO: "Aosta", AP: "Ascoli Piceno", AQ: "L'Aquila", AR: "Arezzo", AT: "Asti", AV: "Avellino", BA: "Bari", BG: "Bergamo", BI: "Biella", BL: "Belluno", BN: "Benevento", BO: "Bologna", BR: "Brindisi", BS: "Brescia", BT: "Barletta-Andria-Trani", BZ: "Bolzano", CA: "Cagliari", CB: "Campobasso", CE: "Caserta", CH: "Chieti", CL: "Caltanissetta", CN: "Cuneo", CO: "Como", CR: "Cremona", CS: "Cosenza", CT: "Catania", CZ: "Catanzaro", EN: "Enna", FC: "Forlì-Cesena", FE: "Ferrara", FG: "Foggia", FI: "Firenze", FM: "Fermo", FR: "Frosinone", GE: "Genova", GO: "Gorizia", GR: "Grosseto", IM: "Imperia", IS: "Isernia", KR: "Crotone", LC: "Lecco", LE: "Lecce", LI: "Livorno", LO: "Lodi", LT: "Latina", LU: "Lucca", MB: "Monza e Brianza", MC: "Macerata", ME: "Messina", MI: "Milano", MN: "Mantova", MO: "Modena", MS: "Massa-Carrara", MT: "Matera", NA: "Napoli", NO: "Novara", NU: "Nuoro", OR: "Oristano", PA: "Palermo", PC: "Piacenza", PD: "Padova", PE: "Pescara", PG: "Perugia", PI: "Pisa", PN: "Pordenone", PO: "Prato", PR: "Parma", PT: "Pistoia", PU: "Pesaro e Urbino", PV: "Pavia", PZ: "Potenza", RA: "Ravenna", RC: "Reggio Calabria", RE: "Reggio Emilia", RG: "Ragusa", RI: "Rieti", RM: "Roma", RN: "Rimini", RO: "Rovigo", SA: "Salerno", SI: "Siena", SO: "Sondrio", SP: "La Spezia", SR: "Siracusa", SS: "Sassari", SU: "Sud Sardegna", SV: "Savona", TA: "Taranto", TE: "Teramo", TN: "Trento", TO: "Torino", TP: "Trapani", TR: "Terni", TS: "Trieste", TV: "Treviso", UD: "Udine", VA: "Varese", VB: "Verbano-Cusio-Ossola", VC: "Vercelli", VE: "Venezia", VI: "Vicenza", VR: "Verona", VT: "Viterbo", VV: "Vibo Valentia" };

export const SEO_TROVA = {
  matrimoni: {
    h1: "Il vostro matrimonio, visto dall'alto.",
    h1Provincia: (p) => `Riprese con il drone per il matrimonio a ${p}`,
    sottotitolo: "La chiesa, l'uscita degli sposi, la location e tutti gli invitati in una foto sola. Raccontateci il vostro giorno: i piloti della zona vi mandano un'offerta e scegliete voi.",
    titoloPagina: (p) => (p ? `Drone per il matrimonio a ${p}: riprese aeree — EyeDrones` : "Drone per il matrimonio: riprese e foto aeree — EyeDrones"),
    descrizionePagina: (p) => `Riprese e foto aeree con il drone per il vostro matrimonio${p ? ` in provincia di ${p}` : ""}: chiesa, uscita degli sposi, location e foto di gruppo dall'alto. Ricevete le offerte dei piloti della zona e scegliete voi. Senza costi e senza impegno.`,
    immagine: "/trova-pilota/matrimoni.webp",
    domande: [
        ["Si può volare al matrimonio?", "Quasi sempre sì. Il pilota controlla le zone di volo del posto (per esempio vicino agli aeroporti o in alcuni centri storici), chiede i permessi se servono e sceglie da dove riprendere in sicurezza. Voi non dovete fare niente."],
        ["Quanto costa?", "Dipende da cosa volete: di solito tra 300 e 1.500 €. Nell'offerta trovate scritto cosa comprende: minuti di video, foto, reel, consegna."],
        ["Quando conviene prenotare?", "Meglio qualche mese prima, soprattutto da maggio a settembre, quando i piloti hanno più matrimoni."],
        ["Abbiamo già il fotografo: va bene lo stesso?", "Sì. Il pilota si mette d'accordo con il fotografo e il videomaker, così ognuno fa la sua parte."],
        ["Ci sono costi per noi?", "No. Mandare la richiesta e ricevere le offerte non costa niente ed è senza impegno: se nessuna offerta vi convince, non scegliete nessuno."],
    ],
  },
  case: {
    h1: "La tua casa, vista dall'alto.",
    h1Provincia: (p) => `Foto e video con il drone per case e terreni a ${p}`,
    sottotitolo: "Per vendere o affittare prima: la casa, il giardino, il terreno e quello che c'è intorno, in foto e video dall'alto. Racconta cosa ti serve: i piloti della zona ti mandano un'offerta e scegli tu.",
    titoloPagina: (p) => (p ? `Foto aeree con il drone per case e terreni a ${p} — EyeDrones` : "Foto aeree con il drone per case, terreni e B&B — EyeDrones"),
    descrizionePagina: (p) => `Foto e video con il drone per vendere o affittare casa${p ? ` in provincia di ${p}` : ""}: casa, giardino, confini del terreno e dintorni dall'alto, anche per B&B e agriturismi. Ricevi le offerte dei piloti della zona e scegli tu. Senza costi e senza impegno.`,
    immagine: "/trova-pilota/case.webp",
    domande: [
        ["Si può volare sopra casa?", "Quasi sempre sì. Il pilota controlla le zone di volo del posto e, se la casa è in centro abitato o vicino a un aeroporto, chiede i permessi che servono. Tu non devi fare niente."],
        ["Quanto costa?", "Dipende da quante foto e video vuoi: nell'offerta trovi scritto cosa comprende e il prezzo."],
        ["Quanto tempo ci vuole?", "Di solito il volo dura meno di un'ora. Foto e video sono pronti in pochi giorni: il pilota ti scrive nell'offerta quando li consegna."],
        ["Posso usare le foto negli annunci?", "Sì. Scrivilo nella richiesta, così il pilota lo mette nell'offerta."],
        ["Ci sono costi per me?", "No. Mandare la richiesta e ricevere le offerte non costa niente ed è senza impegno: se nessuna offerta ti convince, non scegli nessuno."],
    ],
  },
  aziende: {
    h1: "La vostra azienda, vista dall'alto.",
    h1Provincia: (p) => `Video con il drone per aziende a ${p}`,
    sottotitolo: "Lo stabilimento, i prodotti, gli eventi e i cantieri, in video e foto dall'alto per il sito, i social e le fiere. Raccontateci cosa vi serve: i piloti della zona vi mandano un'offerta e scegliete voi.",
    titoloPagina: (p) => (p ? `Video aziendali con il drone a ${p} — EyeDrones` : "Video aziendali, eventi e cantieri con il drone — EyeDrones"),
    descrizionePagina: (p) => `Video e foto con il drone per aziende${p ? ` in provincia di ${p}` : ""}: stabilimento, eventi, contenuti per i social, avanzamento dei cantieri e voli FPV. Ricevete le offerte dei piloti della zona e scegliete voi. Senza costi e senza impegno.`,
    immagine: "/trova-pilota/aziende.webp",
    domande: [
        ["Si può volare sopra la nostra sede?", "Quasi sempre sì. Il pilota controlla le zone di volo: vicino agli aeroporti o in alcune zone servono permessi, e li chiede lui. Voi non dovete fare niente."],
        ["Quanto costa?", "Dipende da cosa vi serve: nell'offerta trovate scritto cosa comprende e il prezzo."],
        ["Possiamo usare il video per la pubblicità?", "Sì. Scrivetelo nella richiesta, così il pilota lo mette nell'offerta."],
        ["Fate anche riprese regolari di un cantiere?", "Sì: scegliete «Avanzamento di un cantiere». Il pilota vi propone voli ogni settimana o ogni mese, sempre dagli stessi punti."],
        ["Ci sono costi per noi?", "No. Mandare la richiesta e ricevere le offerte non costa niente ed è senza impegno: se nessuna offerta vi convince, non scegliete nessuno."],
    ],
  },
  ispezioni: {
    h1: "Il tetto controllato, senza salire.",
    h1Provincia: (p) => `Ispezioni con il drone a ${p}`,
    sottotitolo: "Tetti, facciate, grondaie e impianti fotovoltaici controllati dall'alto, con foto da vicino e un report. Senza ponteggi e senza salire sul tetto. Racconta cosa ti serve: i piloti della zona ti mandano un'offerta e scegli tu.",
    titoloPagina: (p) => (p ? `Ispezione tetti e fotovoltaico con il drone a ${p} — EyeDrones` : "Ispezione di tetti, facciate e fotovoltaico con il drone — EyeDrones"),
    descrizionePagina: (p) => `Ispezioni con il drone${p ? ` in provincia di ${p}` : ""}: tetti dopo la grandinata, facciate, grondaie, termografia dei pannelli fotovoltaici e rilievi 3D, senza ponteggi. Ricevi le offerte dei piloti della zona e scegli tu. Senza costi e senza impegno.`,
    immagine: "/trova-pilota/ispezioni.webp",
    domande: [
        ["Serve salire sul tetto?", "No. Il drone vola vicino al tetto o alla facciata e fa foto e video da vicino: nessuno deve salire e non servono ponteggi."],
        ["Quanto costa?", "Dipende da quanto è grande e da cosa ti serve: nell'offerta trovi scritto cosa comprende e il prezzo."],
        ["Mi date un report?", "Nell'offerta trovi se comprende il report in PDF con le foto e i problemi trovati. Se ti serve, scrivilo nella richiesta."],
        ["Si può fare in un condominio o in centro?", "Sì. Il pilota controlla le zone di volo, chiede i permessi se servono e organizza il volo in sicurezza per chi passa sotto."],
        ["Ci sono costi per me?", "No. Mandare la richiesta e ricevere le offerte non costa niente ed è senza impegno: se nessuna offerta ti convince, non scegli nessuno."],
    ],
  },
  agricoltura: {
    h1: "I tuoi campi, visti dall'alto.",
    h1Provincia: (p) => `Trattamenti e mappe con il drone a ${p}`,
    sottotitolo: "Trattamenti con drone su vigneti, oliveti e campi difficili da raggiungere, e mappe per vedere dove le piante soffrono. Racconta cosa ti serve: i piloti della zona ti mandano un'offerta e scegli tu.",
    titoloPagina: (p) => (p ? `Trattamenti e mappe dei campi con il drone a ${p} — EyeDrones` : "Trattamenti agricoli e mappe dei campi con il drone — EyeDrones"),
    descrizionePagina: (p) => `Trattamenti con drone, mappe NDVI e rilievi dei campi${p ? ` in provincia di ${p}` : ""}: vigneti in collina, oliveti, frutteti e campi difficili da raggiungere. Ricevi le offerte dei piloti della zona e scegli tu. Senza costi e senza impegno.`,
    immagine: "/trova-pilota/agricoltura.webp",
    domande: [
        ["Si può trattare con il drone?", "Sì, rispettando le regole: il pilota deve avere le autorizzazioni per i trattamenti con drone e usare prodotti adatti. Nell'offerta trovi cosa è a suo carico."],
        ["Quanto costa?", "Dipende dagli ettari, dalla coltura e dal lavoro: il pilota te lo scrive nell'offerta, di solito a ettaro."],
        ["Il prodotto lo devo comprare io?", "Di solito sì. Scrivilo nella richiesta: il pilota ti dice cosa serve e quanto."],
        ["Mi danno il registro del trattamento?", "Nell'offerta trovi se comprende il registro del trattamento. Se ti serve, scrivilo nella richiesta."],
        ["Ci sono costi per me?", "No. Mandare la richiesta e ricevere le offerte non costa niente ed è senza impegno: se nessuna offerta ti convince, non scegli nessuno."],
    ],
  },
};

// la pagina generale /trova-pilota (anche per provincia)
export const SEO_TROVA_GENERALE = {
  h1: "Il tuo momento, visto dall'alto.",
  h1Provincia: (p) => `Il tuo pilota di droni in provincia di ${p}`,
  sottotitolo: "Matrimoni, case, eventi, ispezioni, rilievi e agricoltura. Racconta cosa ti serve: i piloti della tua zona ti mandano un'offerta e scegli tu.",
  titoloPagina: (p) => (p ? `Pilota di droni in provincia di ${p} — EyeDrones` : "Trova un pilota di droni — EyeDrones"),
  descrizionePagina: (p) => `Cerchi un pilota di droni${p ? ` in provincia di ${p}` : ""}? Matrimoni, eventi, case, ispezioni e riprese aeree: descrivi cosa ti serve, ricevi le offerte dei piloti della zona e scegli tu. Senza costi e senza impegno.`,
};
