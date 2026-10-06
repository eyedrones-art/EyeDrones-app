// Contenuti della sezione «Impara»: lezioni A1/A3 e A2, guida per volare in zona rossa, domande di allenamento.
// Testi scritti seguendo gli argomenti d'esame (Reg. UE 2019/947 e indicazioni ENAC): sono per allenarsi,
// non sono le domande ufficiali e non sostituiscono un corso o il materiale ENAC.

export const ESAMI = {
  a1a3: { nome: "A1/A3", domande: 40, minuti: 60, punti: { giusta: 2, sbagliata: -1, vuota: 0 }, soglia: 60, massimo: 80, dove: "online sul portale ENAC, dopo il corso online" },
  a2: { nome: "A2", domande: 30, minuti: 60, punti: { giusta: 2, sbagliata: 0, vuota: 0 }, soglia: 45, massimo: 60, dove: "presso ENAC o un ente riconosciuto (anche online con sorveglianza)" },
};

export const LEZIONI = {
  a1a3: [
    {
      id: "open", titolo: "La categoria Open in breve",
      punti: [
        "È la categoria dei voli «a basso rischio»: niente autorizzazione, ma regole precise da rispettare.",
        "Drone sotto i 25 kg, sempre in vista (VLOS) e al massimo a 120 m dal punto più vicino del suolo.",
        "Mai sopra assembramenti di persone. Niente merci pericolose e niente oggetti lanciati dal drone.",
        "Con il visore FPV serve un osservatore accanto a te che tenga sempre il drone in vista.",
        "Dal 2024, di notte va accesa la luce verde lampeggiante del drone.",
      ],
    },
    {
      id: "sottocategorie", titolo: "Sottocategorie A1, A2, A3 e classi C0–C4",
      punti: [
        "Le classi dipendono dal drone: C0 sotto 250 g, C1 sotto 900 g, C2 sotto 4 kg, C3 e C4 sotto 25 kg.",
        "A1 (C0 e C1): si vola vicino alle persone. Con il C0 il sorvolo di persone non coinvolte è tollerato; con il C1 non va fatto di proposito e, se capita, va ridotto al minimo.",
        "A2 (C2): serve il certificato A2. Almeno 30 m in orizzontale dalle persone non coinvolte, 5 m con la modalità bassa velocità.",
        "A3 (C2, C3, C4 e droni senza classe sotto 25 kg): nessuna persona non coinvolta nell'area e almeno 150 m da zone residenziali, commerciali, industriali o ricreative.",
        "Persone «coinvolte» sono quelle che sanno del volo, hanno ricevuto istruzioni e hanno dato il consenso.",
      ],
    },
    {
      id: "registrazione", titolo: "Registrazione, attestato, assicurazione",
      punti: [
        "L'operatore si registra su D-Flight se il drone pesa da 250 g in su oppure ha una fotocamera (giocattoli esclusi).",
        "Il codice operatore va applicato sul drone (QR D-Flight) e inserito nel Remote ID dei droni che lo hanno (C1, C2, C3).",
        "Con un C0 basta leggere il manuale del costruttore; dal C1 in su serve l'attestato A1/A3.",
        "Attestato A1/A3: corso online ENAC e test di 40 domande in 60 minuti. Vale 5 anni.",
        "In Italia serve un'assicurazione di responsabilità civile verso terzi: tienila sempre a portata di mano.",
      ],
    },
    {
      id: "spazio", titolo: "Spazio aereo e zone geografiche",
      punti: [
        "Le zone geografiche UAS (vietate, soggette ad autorizzazione o con condizioni) le trovi sulla mappa di D-Flight.",
        "Molte zone non vietano tutto: spesso il limite parte da una certa altezza (es. «da 25 a 120 m»).",
        "Controlla anche i NOTAM: sono avvisi temporanei (eventi, esercitazioni, elisoccorso) che possono chiudere una zona.",
        "Gli aeroporti hanno zone di controllo intorno (CTR, ATZ): lì di solito serve coordinarsi con l'ente indicato.",
        "Gli aerei e gli elicotteri hanno sempre la precedenza: se ne arriva uno, allontanati e scendi o atterra.",
      ],
    },
    {
      id: "umani", titolo: "Fattori umani",
      punti: [
        "Non si vola sotto l'effetto di alcol, droghe o farmaci che riducono attenzione e riflessi.",
        "Stanchezza, fretta e distrazione sono tra le prime cause di incidenti: se non sei lucido, rimanda.",
        "VLOS vuol dire vedere il drone a occhio nudo (occhiali da vista sì, binocolo no) e capire come è orientato.",
        "Non esiste una distanza fissa: smetti di allontanarti quando non vedi più bene il drone e la sua direzione.",
      ],
    },
    {
      id: "procedure", titolo: "Procedure prima, durante e dopo il volo",
      punti: [
        "Prima: zone e NOTAM, meteo, batterie cariche, eliche integre, aggiornamenti, punto di ritorno (home) registrato con buon GPS.",
        "Imposta l'altezza del ritorno automatico sopra gli ostacoli più alti della zona.",
        "Durante: tieni d'occhio batteria, vento e segnale. Se perdi il collegamento il drone fa la procedura impostata (di solito torna a casa).",
        "Vicino a strutture metalliche e linee elettriche la bussola può sbagliare: calibra lontano da lì, se il drone lo chiede.",
        "Un indice Kp alto (tempesta geomagnetica) può peggiorare il GPS.",
        "Dopo: annota il volo e gli eventuali problemi. Gli incidenti gravi vanno segnalati entro 72 ore.",
      ],
    },
    {
      id: "privacy", titolo: "Privacy e protezione dei dati",
      punti: [
        "Se riprendi persone riconoscibili, targhe o case private si applicano le regole sulla privacy (GDPR).",
        "Per pubblicare immagini di persone riconoscibili serve il loro consenso o un'altra base valida: nel dubbio sfoca o non pubblicare.",
        "Non usare il drone per guardare dentro proprietà private.",
        "Le liberatorie firmate (anche in EyeDrones) servono proprio a questo.",
      ],
    },
  ],
  a2: [
    {
      id: "requisiti-a2", titolo: "Cos'è l'A2 e come si prende",
      punti: [
        "Serve per volare con un C2 (sotto 4 kg) più vicino alle persone: 30 m in orizzontale, 5 m con la modalità bassa velocità (al massimo 3 m/s).",
        "Requisiti: attestato A1/A3, autoaddestramento pratico (lo dichiari tu) ed esame teorico.",
        "Esame: 30 domande in 60 minuti presso ENAC o un ente riconosciuto. Il certificato vale 5 anni.",
        "Argomenti in più rispetto all'A1/A3: meteorologia, prestazioni del drone, riduzione del rischio per le persone a terra.",
      ],
    },
    {
      id: "meteo", titolo: "Meteorologia",
      punti: [
        "Il vento in quota è quasi sempre più forte che a terra: a 100 m può essere il doppio.",
        "Dietro edifici, alberi e colline (lato sottovento) si formano turbolenze e raffiche improvvise.",
        "Di giorno la brezza soffia dal mare o dal lago verso terra; di notte al contrario.",
        "Nelle giornate calde le termiche fanno salire l'aria e rendono il volo meno stabile.",
        "Nebbia e foschia riducono la visibilità: se non vedi bene il drone non sei più in VLOS.",
        "METAR = osservazione meteo attuale di un aeroporto; TAF = previsione per l'aeroporto. Isobare ravvicinate sulla carta = vento forte.",
      ],
    },
    {
      id: "prestazioni", titolo: "Prestazioni del drone",
      punti: [
        "Più peso (accessori, carichi) vuol dire meno autonomia e risposta più lenta.",
        "Col vento contro la velocità rispetto al suolo cala e consumi di più: per questo si parte controvento.",
        "Col freddo la batteria rende meno e la tensione può calare di colpo.",
        "Aria calda o in montagna è meno densa: le eliche spingono meno e si consuma di più.",
        "L'autonomia dichiarata è misurata in condizioni ideali: nella realtà conta su meno.",
        "Scendere in verticale molto veloce può far perdere spinta alle eliche (vortex ring): scendi piano o in diagonale.",
        "Senza GPS (modalità ATTI) il drone non sta più fermo da solo e il vento lo sposta: devi correggere tu.",
      ],
    },
    {
      id: "rischio-terra", titolo: "Ridurre il rischio per le persone a terra",
      punti: [
        "Prima del volo fai un sopralluogo: ostacoli, persone, vie di passaggio, punto di decollo e di atterraggio d'emergenza.",
        "Scegli traiettorie lontane dalle persone non coinvolte e, se serve, delimita l'area.",
        "Tieni una zona di sicurezza intorno all'area di volo: serve a contenere il drone se qualcosa va storto.",
        "La modalità bassa velocità e i limiti di distanza e quota nel drone aiutano a non uscire dall'area.",
        "In emergenza: allontana il drone dalle persone e atterra nel punto sicuro più vicino.",
      ],
    },
  ],
};

export const GUIDA_ZONA_ROSSA = [
  {
    titolo: "1. Cosa vuol dire «zona rossa»",
    punti: [
      "Su D-Flight il rosso indica una zona geografica UAS: può essere vietata, soggetta ad autorizzazione oppure aperta solo con certe condizioni.",
      "Molto spesso il divieto non parte da terra: «da 25 a 120 m» vuol dire che sotto i 25 m si vola senza autorizzazione, con le regole della tua categoria.",
      "In EyeDrones, con il file ufficiale D-Flight caricato, la verifica zona ti dice subito fin dove sei libero e chi è l'ente da contattare.",
    ],
  },
  {
    titolo: "2. Prima prova a evitarla",
    punti: [
      "Resta sotto l'altezza libera della zona, se basta per la ripresa.",
      "Spostati: a volte bastano poche centinaia di metri per uscire dalla zona.",
      "Controlla gli orari: alcune zone valgono solo in certi giorni o fasce orarie.",
      "Le zone «vietate» (per esempio carceri o aree militari) di norma non si possono sorvolare: lì non perdere tempo con la richiesta, cambia posto.",
    ],
  },
  {
    titolo: "3. Chi devi contattare",
    punti: [
      "Vicino agli aeroporti civili (CTR, ATZ) di solito è ENAV o il gestore dell'aeroporto, spesso con la richiesta tramite D-Flight.",
      "Aeroporti e aree militari: l'ente militare indicato nella zona.",
      "Parchi e aree protette: l'ente parco. Ospedali con elisuperficie, porti, siti sensibili: l'ente o il gestore indicato.",
      "Il nome e i contatti dell'ente li trovi nella scheda della zona su D-Flight (e in EyeDrones nella verifica zona).",
    ],
  },
  {
    titolo: "4. Cosa scrivere nella richiesta",
    punti: [
      "Data e fascia oraria del volo, con un margine se il meteo cambia.",
      "Area di volo: indirizzo, coordinate e raggio, quota massima.",
      "Drone: modello, classe, peso e codice operatore D-Flight; pilota con numero dell'attestato.",
      "Scopo del volo (riprese, ispezione...) e un numero di telefono raggiungibile durante il volo.",
      "Chiedi con anticipo: spesso servono diversi giorni lavorativi. Controlla i tempi indicati dall'ente.",
    ],
  },
  {
    titolo: "5. Il giorno del volo",
    punti: [
      "Carica l'autorizzazione in EyeDrones (Permessi): così la ritrovi nei documenti per il controllo, anche senza campo.",
      "Rispetta esattamente orari, quote e area autorizzati e le prescrizioni dell'ente (per esempio una telefonata prima del decollo).",
      "Ricontrolla i NOTAM la mattina stessa: un avviso nuovo può chiudere la zona.",
      "Se l'autorizzazione non arriva in tempo, non volare: sposta il lavoro.",
    ],
  },
];

// domande di allenamento: { d: domanda, r: [risposte], ok: indice giusta, perche: spiegazione, tema }
export const DOMANDE = {
  a1a3: [
    { tema: "Regole", d: "Qual è l'altezza massima di volo nella categoria Open?", r: ["150 m sul livello del mare", "120 m dal punto più vicino della superficie terrestre", "50 m dal punto di decollo", "Nessun limite per i droni C0"], ok: 1, perche: "In Open si vola al massimo a 120 m dal punto più vicino del suolo, per tutte le classi." },
    { tema: "Regole", d: "Cosa vuol dire volare in VLOS?", r: ["Con il drone sempre in vista, a occhio nudo", "Guardando solo lo schermo del radiocomando", "Con un binocolo per vederlo meglio", "Entro 1 km dal pilota"], ok: 0, perche: "VLOS = Visual Line Of Sight: il pilota vede il drone a occhio nudo (occhiali da vista ammessi), senza strumenti come il binocolo." },
    { tema: "Regole", d: "Voli con il visore FPV in categoria Open. Cosa serve?", r: ["Niente, il visore basta", "Un osservatore accanto a te che tenga il drone in vista", "Un'autorizzazione ENAC", "Il certificato A2"], ok: 1, perche: "Con il visore non vedi il drone direttamente: serve un osservatore accanto a te che mantenga il contatto visivo." },
    { tema: "Classi", d: "Qual è la massa massima di un drone in categoria Open?", r: ["4 kg", "10 kg", "Meno di 25 kg", "Non c'è limite"], ok: 2, perche: "La categoria Open vale per droni con massa al decollo inferiore a 25 kg." },
    { tema: "Classi", d: "Un drone di classe C0 pesa:", r: ["Meno di 250 g", "Meno di 900 g", "Meno di 4 kg", "Meno di 25 kg"], ok: 0, perche: "C0 sotto 250 g, C1 sotto 900 g, C2 sotto 4 kg, C3 e C4 sotto 25 kg." },
    { tema: "Classi", d: "Un drone di classe C1 pesa:", r: ["Meno di 250 g", "Meno di 900 g", "Meno di 4 kg", "Meno di 25 kg"], ok: 1, perche: "La classe C1 comprende droni sotto i 900 g." },
    { tema: "Classi", d: "Un drone di classe C2 pesa:", r: ["Meno di 900 g", "Meno di 2 kg", "Meno di 4 kg", "Meno di 25 kg"], ok: 2, perche: "La classe C2 comprende droni sotto i 4 kg." },
    { tema: "Sottocategorie", d: "In sottocategoria A3, a che distanza minima devi stare da zone residenziali, commerciali, industriali o ricreative?", r: ["30 m", "50 m", "150 m", "500 m"], ok: 2, perche: "In A3 si vola lontano dalla gente: almeno 150 m da queste aree e nessuna persona non coinvolta nell'area di volo." },
    { tema: "Sottocategorie", d: "In A2 con un C2, a che distanza orizzontale minima dalle persone non coinvolte?", r: ["5 m sempre", "30 m, oppure 5 m con la modalità bassa velocità", "50 m", "150 m"], ok: 1, perche: "In A2 servono 30 m in orizzontale; con la modalità bassa velocità attiva bastano 5 m." },
    { tema: "Sottocategorie", d: "Si può sorvolare un assembramento di persone in categoria Open?", r: ["Sì, con un C0", "Sì, sotto i 30 m", "No, mai", "Sì, con l'A2"], ok: 2, perche: "In Open il sorvolo di assembramenti di persone non è mai consentito, con nessuna classe." },
    { tema: "Sottocategorie", d: "In A1 con un drone C1, cosa vale per le persone non coinvolte?", r: ["Puoi sorvolarle quando vuoi", "Non devi sorvolarle di proposito; se capita, riduci il tempo sopra di loro", "Devi stare a 150 m", "Devi avere il loro consenso scritto"], ok: 1, perche: "Con il C1 il sorvolo di persone non coinvolte non va pianificato; se succede, va ridotto al minimo." },
    { tema: "Sottocategorie", d: "Chi è una persona «coinvolta»?", r: ["Chiunque si trovi nell'area", "Chi sa del volo, ha ricevuto istruzioni e ha dato il consenso", "Solo il pilota", "Chi guarda il volo da lontano"], ok: 1, perche: "Le persone coinvolte partecipano consapevolmente all'operazione: informate, istruite e consenzienti." },
    { tema: "Registrazione", d: "Chi deve registrarsi su D-Flight?", r: ["Il costruttore del drone", "L'operatore UAS, se il drone pesa da 250 g in su o ha una fotocamera", "Solo chi lavora con il drone", "Nessuno, è facoltativo"], ok: 1, perche: "La registrazione è dell'operatore ed è obbligatoria per droni da 250 g in su o dotati di fotocamera (giocattoli esclusi)." },
    { tema: "Registrazione", d: "Dove va il codice operatore D-Flight?", r: ["Solo nel portafoglio", "Applicato sul drone e inserito nel Remote ID, se presente", "Sul radiocomando", "Non serve portarlo"], ok: 1, perche: "Il codice operatore (QR D-Flight) va applicato sul drone e caricato nel sistema di identificazione remota dei droni che lo hanno." },
    { tema: "Registrazione", d: "Quanto vale l'attestato A1/A3?", r: ["1 anno", "2 anni", "5 anni", "Per sempre"], ok: 2, perche: "L'attestato A1/A3 vale 5 anni." },
    { tema: "Registrazione", d: "Com'è fatto il test ENAC per l'A1/A3?", r: ["10 domande in 15 minuti", "40 domande in 60 minuti", "30 domande in 30 minuti", "Una prova pratica"], ok: 1, perche: "Il test online A1/A3 ha 40 domande a risposta multipla da completare in 60 minuti." },
    { tema: "Registrazione", d: "Con un drone C0 cosa serve come formazione?", r: ["Il certificato A2", "Leggere il manuale del costruttore", "Un corso in aula", "Nulla, nemmeno il manuale"], ok: 1, perche: "Per il C0 basta leggere le istruzioni del costruttore. Dal C1 in su serve l'attestato A1/A3." },
    { tema: "Registrazione", d: "In Italia l'assicurazione per il drone:", r: ["Non serve mai", "Serve: responsabilità civile verso terzi", "Serve solo sopra 4 kg", "Serve solo per i voli notturni"], ok: 1, perche: "In Italia per operare serve una polizza di responsabilità civile verso terzi." },
    { tema: "Spazio aereo", d: "Prima di volare, dove controlli le zone in cui il volo è limitato?", r: ["Solo su Google Maps", "Sulla mappa D-Flight e nei NOTAM", "Basta chiedere a chi abita lì", "Non serve controllare sotto 120 m"], ok: 1, perche: "Le zone geografiche UAS sono pubblicate su D-Flight; i NOTAM segnalano limitazioni temporanee." },
    { tema: "Spazio aereo", d: "Cos'è un NOTAM?", r: ["Il manuale del drone", "Un avviso temporaneo per chi vola (eventi, esercitazioni, chiusure)", "Il codice operatore", "Un tipo di batteria"], ok: 1, perche: "I NOTAM sono avvisi temporanei agli utenti dello spazio aereo: possono chiudere o limitare una zona per un certo periodo." },
    { tema: "Spazio aereo", d: "Mentre voli si avvicina un elicottero. Cosa fai?", r: ["Continui, sei sotto i 120 m", "Gli dai la precedenza: allontani il drone e scendi o atterri", "Sali per farti vedere", "Lo filmi"], ok: 1, perche: "Gli aeromobili con equipaggio hanno sempre la precedenza: il pilota del drone deve evitare ogni rischio di collisione." },
    { tema: "Spazio aereo", d: "Una zona D-Flight dice «da 25 a 120 m». Cosa significa?", r: ["È vietato volare in tutta la zona", "Sotto i 25 m puoi volare con le regole della tua categoria; sopra serve rispettare la zona", "Puoi volare solo sopra i 25 m", "Vale solo di notte"], ok: 1, perche: "Il limite inferiore della zona è 25 m: sotto quella quota la zona non si applica." },
    { tema: "Fattori umani", d: "Hai bevuto un paio di bicchieri di vino. Puoi volare?", r: ["Sì, se il drone è piccolo", "No: non si vola sotto l'effetto di alcol", "Sì, se voli in A3", "Sì, se c'è un osservatore"], ok: 1, perche: "Il pilota deve essere in condizioni adatte: alcol, droghe e farmaci che riducono le capacità sono incompatibili con il volo." },
    { tema: "Fattori umani", d: "Sei molto stanco dopo una giornata di lavoro. Cosa fai?", r: ["Voli più veloce per finire prima", "Rimandi o fai volare qualcun altro", "Voli più in alto per sicurezza", "Voli solo in modalità Sport"], ok: 1, perche: "La stanchezza riduce attenzione e riflessi: è una delle cause più comuni di incidenti." },
    { tema: "Fattori umani", d: "Fino a che distanza puoi allontanare il drone in VLOS?", r: ["500 m esatti", "Finché lo vedi chiaramente e capisci come è orientato", "2 km", "Finché il segnale radio è buono"], ok: 1, perche: "Non c'è una distanza fissa: vale la capacità di vedere il drone e il suo orientamento a occhio nudo." },
    { tema: "Procedure", d: "Perché si imposta l'altezza del ritorno automatico (RTH)?", r: ["Per fare video migliori", "Perché tornando non urti gli ostacoli più alti", "Per consumare meno batteria", "Non serve"], ok: 1, perche: "Se il drone torna da solo (batteria o segnale perso) deve passare sopra gli ostacoli della zona." },
    { tema: "Procedure", d: "Perdi il collegamento con il drone. Cosa succede di solito?", r: ["Cade subito", "Fa la procedura impostata, di solito torna al punto di partenza", "Continua da solo la missione", "Atterra sempre dove si trova"], ok: 1, perche: "I droni moderni eseguono la procedura impostata in caso di perdita del segnale, di solito il ritorno automatico." },
    { tema: "Procedure", d: "Quando registri il punto di ritorno (home point)?", r: ["Dopo il volo", "Prima del decollo, con un buon segnale GPS", "Non serve", "Solo di notte"], ok: 1, perche: "Senza home point preciso il ritorno automatico non sa dove riportare il drone." },
    { tema: "Procedure", d: "Dove è meglio calibrare la bussola?", r: ["Vicino all'auto", "Sopra un tombino di ferro", "Lontano da metalli, auto e linee elettriche", "Dentro casa"], ok: 2, perche: "Metalli e campi elettromagnetici disturbano la bussola: calibra in un posto libero." },
    { tema: "Procedure", d: "L'indice Kp è a 6. Cosa può succedere?", r: ["Niente", "Il GPS può essere meno preciso", "Il drone va più veloce", "La batteria dura di più"], ok: 1, perche: "Un Kp alto indica tempesta geomagnetica, che può degradare il posizionamento satellitare." },
    { tema: "Procedure", d: "Vuoi volare di notte in Open. Cosa serve sul drone?", r: ["Nulla", "La luce verde lampeggiante accesa", "Una luce rossa fissa", "Un faro bianco"], ok: 1, perche: "Dal 2024, di notte la luce verde lampeggiante dei droni con classe va tenuta accesa." },
    { tema: "Procedure", d: "In categoria Open puoi lanciare oggetti dal drone?", r: ["Sì, se leggeri", "No", "Sì, in A3", "Sì, con il consenso del proprietario"], ok: 1, perche: "In Open non si trasportano merci pericolose e non si sganciano oggetti." },
    { tema: "Procedure", d: "Durante il volo il drone avvisa batteria bassa. Cosa fai?", r: ["Continui fino all'atterraggio automatico", "Torni e atterri", "Sali di quota", "Spegni i motori"], ok: 1, perche: "Con la batteria bassa si rientra subito: la tensione può calare in fretta, soprattutto col freddo o col vento." },
    { tema: "Meteo", d: "Rispetto a terra, il vento a 100 m di quota di solito è:", r: ["Uguale", "Più debole", "Più forte", "Assente"], ok: 2, perche: "Il vento aumenta con la quota: quello che senti a terra non basta per giudicare." },
    { tema: "Meteo", d: "Col freddo la batteria del drone:", r: ["Dura di più", "Dura meno e può calare di colpo", "Non cambia", "Si ricarica da sola"], ok: 1, perche: "Le basse temperature riducono capacità e tensione delle batterie al litio." },
    { tema: "Privacy", d: "Riprendi persone riconoscibili in un parco. Quali regole si applicano?", r: ["Nessuna, è luogo pubblico", "Quelle sulla protezione dei dati (GDPR)", "Solo quelle ENAC", "Solo se le riprese durano più di 5 minuti"], ok: 1, perche: "Le immagini di persone identificabili sono dati personali: si applicano le norme sulla privacy." },
    { tema: "Privacy", d: "Vuoi pubblicare un video dove si riconoscono delle persone. Cosa serve?", r: ["Nulla", "Il loro consenso o un'altra base valida; nel dubbio sfoca", "Un permesso ENAC", "Basta citarle nei titoli"], ok: 1, perche: "Per diffondere immagini di persone riconoscibili serve una base giuridica, di solito il consenso." },
    { tema: "Eventi", d: "Hai un incidente grave con il drone. Entro quando va segnalato?", r: ["Entro 72 ore", "Entro 30 giorni", "Non serve segnalarlo", "Entro un anno"], ok: 0, perche: "Gli eventi gravi vanno segnalati entro 72 ore da quando se ne viene a conoscenza." },
    { tema: "Drone", d: "A cosa serve il Remote ID?", r: ["A pilotare con lo smartphone", "A trasmettere identificativo dell'operatore e posizione del drone", "A registrare i video", "A ricaricare la batteria"], ok: 1, perche: "Il Remote ID trasmette in tempo reale chi è l'operatore e dove si trova il drone." },
    { tema: "Responsabilità", d: "Chi deve assicurarsi che il volo sia sicuro?", r: ["Il costruttore", "Il pilota remoto", "ENAC", "Chi viene ripreso"], ok: 1, perche: "Il pilota remoto è responsabile della condotta sicura del volo." },
  ],
  a2: [
    { tema: "Requisiti", d: "Cosa serve per ottenere il certificato A2?", r: ["Solo l'attestato A1/A3", "Attestato A1/A3, autoaddestramento pratico ed esame teorico", "Una visita medica", "Un'autorizzazione ENAC per ogni volo"], ok: 1, perche: "L'A2 richiede l'A1/A3, l'autoaddestramento pratico dichiarato e il superamento dell'esame teorico." },
    { tema: "Requisiti", d: "Com'è fatto l'esame teorico A2?", r: ["40 domande in 60 minuti", "30 domande in 60 minuti", "20 domande in 20 minuti", "Solo prova pratica"], ok: 1, perche: "L'esame A2 ha 30 domande a risposta multipla in 60 minuti." },
    { tema: "Requisiti", d: "Quanto vale il certificato A2?", r: ["1 anno", "3 anni", "5 anni", "10 anni"], ok: 2, perche: "Il certificato A2 vale 5 anni." },
    { tema: "Distanze", d: "In A2 con un C2, distanza orizzontale minima dalle persone non coinvolte senza bassa velocità:", r: ["5 m", "15 m", "30 m", "150 m"], ok: 2, perche: "Senza la modalità bassa velocità servono almeno 30 m." },
    { tema: "Distanze", d: "Con la modalità bassa velocità attiva, la distanza minima scende a:", r: ["1 m", "5 m", "10 m", "20 m"], ok: 1, perche: "Con la bassa velocità attiva puoi stare fino a 5 m dalle persone non coinvolte." },
    { tema: "Distanze", d: "La modalità bassa velocità dei C2 limita la velocità a:", r: ["3 m/s", "10 m/s", "19 m/s", "Non limita la velocità"], ok: 0, perche: "La modalità bassa velocità dei C2 limita la velocità a non più di 3 m/s." },
    { tema: "Classi", d: "Un drone C2 ha massa al decollo:", r: ["Sotto 900 g", "Sotto 4 kg", "Sotto 10 kg", "Sotto 25 kg"], ok: 1, perche: "La classe C2 comprende droni sotto i 4 kg." },
    { tema: "Meteo", d: "Dove si forma turbolenza vicino a un edificio con vento?", r: ["Sul lato da cui arriva il vento (sopravento)", "Dietro l'edificio, sul lato sottovento", "Solo sul tetto", "Da nessuna parte"], ok: 1, perche: "Il vento che scavalca un ostacolo crea vortici e raffiche sul lato sottovento." },
    { tema: "Meteo", d: "Di giorno, al mare, la brezza di solito soffia:", r: ["Dal mare verso terra", "Da terra verso il mare", "Sempre da nord", "Non c'è brezza di giorno"], ok: 0, perche: "Di giorno la terra si scalda più del mare: l'aria si muove dal mare verso terra." },
    { tema: "Meteo", d: "Cos'è un METAR?", r: ["Una previsione per 5 giorni", "L'osservazione meteo attuale di un aeroporto", "Un tipo di drone", "La mappa delle zone"], ok: 1, perche: "Il METAR riporta le condizioni osservate in un aeroporto: vento, visibilità, nuvole, temperatura." },
    { tema: "Meteo", d: "Cos'è un TAF?", r: ["La previsione meteo per un aeroporto", "L'osservazione attuale", "Il codice operatore", "Un avviso di chiusura"], ok: 0, perche: "Il TAF è la previsione meteo per un aeroporto nelle ore successive." },
    { tema: "Meteo", d: "Cos'è una raffica?", r: ["Un vento costante", "Un aumento improvviso e breve della velocità del vento", "Una pioggia forte", "Un calo di temperatura"], ok: 1, perche: "La raffica è un picco breve di vento: può spostare il drone all'improvviso." },
    { tema: "Meteo", d: "Su una carta meteo le isobare sono molto vicine. Cosa ti aspetti?", r: ["Calma di vento", "Vento forte", "Nebbia", "Neve sicura"], ok: 1, perche: "Isobare ravvicinate indicano una forte differenza di pressione, quindi vento forte." },
    { tema: "Meteo", d: "Nelle giornate calde e soleggiate le termiche:", r: ["Rendono il volo più stabile", "Possono creare correnti ascensionali e turbolenza", "Non esistono", "Raffreddano la batteria"], ok: 1, perche: "L'aria scaldata dal suolo sale e crea correnti e turbolenza, soprattutto nelle ore centrali." },
    { tema: "Meteo", d: "C'è nebbia e il drone si vede appena. Cosa fai?", r: ["Continui guardando lo schermo", "Ti avvicini o atterri: non sei più in VLOS", "Sali sopra la nebbia", "Accendi la luce verde e continui"], ok: 1, perche: "Se la visibilità non ti permette di vedere bene il drone non rispetti il VLOS." },
    { tema: "Meteo", d: "La pioggia per un drone non impermeabile:", r: ["Non è un problema", "Può danneggiare l'elettronica e i sensori", "Migliora il raffreddamento", "Aumenta l'autonomia"], ok: 1, perche: "Acqua e umidità possono causare guasti: la maggior parte dei droni non è fatta per la pioggia." },
    { tema: "Prestazioni", d: "Aggiungi un accessorio pesante al drone. Cosa succede?", r: ["Più autonomia", "Meno autonomia e reazioni più lente", "Nulla", "Più velocità"], ok: 1, perche: "Più massa richiede più spinta: consumi di più e il drone è meno agile." },
    { tema: "Prestazioni", d: "Perché si consiglia di partire controvento?", r: ["Per fare video migliori", "Per tornare con il vento a favore quando la batteria è più scarica", "Perché è obbligatorio", "Per avere più GPS"], ok: 1, perche: "Al ritorno, con meno batteria, il vento a favore riduce consumi e rischi." },
    { tema: "Prestazioni", d: "In montagna, con aria calda e meno densa, il drone:", r: ["Consuma meno", "Consuma di più perché le eliche spingono meno", "Non cambia", "Vola più alto da solo"], ok: 1, perche: "Con aria meno densa serve più potenza per sostenersi: l'autonomia cala." },
    { tema: "Prestazioni", d: "L'autonomia scritta sulla scatola del drone:", r: ["È garantita in ogni condizione", "È misurata in condizioni ideali: nella realtà è minore", "È sempre più bassa del reale", "Vale solo d'inverno"], ok: 1, perche: "Vento, freddo, manovre e peso riducono la durata rispetto al dato dichiarato." },
    { tema: "Prestazioni", d: "Scendi in verticale molto veloce e il drone sbanda. Cosa può essere?", r: ["Batteria nuova", "Le eliche nel loro stesso flusso d'aria (vortex ring): scendi piano o in diagonale", "Troppo GPS", "Il Remote ID"], ok: 1, perche: "In discesa verticale rapida le eliche possono perdere spinta: meglio scendere lentamente o in diagonale." },
    { tema: "Prestazioni", d: "Il drone perde il GPS e passa in modalità ATTI. Cosa succede?", r: ["Atterra da solo", "Non sta più fermo da solo e il vento lo sposta: devi correggere tu", "Torna a casa", "Si spegne"], ok: 1, perche: "In ATTI il drone mantiene solo la quota: la posizione la devi tenere tu con gli stick." },
    { tema: "Prestazioni", d: "Il costruttore indica una resistenza al vento massima. Come la usi?", r: ["Puoi superarla di poco", "Resta ben sotto, considerando anche le raffiche e il vento in quota", "Vale solo a terra", "Non conta"], ok: 1, perche: "È un limite tecnico: con raffiche e vento in quota conviene tenere margine." },
    { tema: "Prestazioni", d: "Col freddo, cosa fai con le batterie?", r: ["Le lasci in auto al freddo", "Le tieni al caldo fino al decollo e conti su meno autonomia", "Le carichi al massimo e voli più a lungo", "Nulla"], ok: 1, perche: "Batterie fredde rendono meno e possono avere cali improvvisi di tensione." },
    { tema: "Rischio a terra", d: "Prima di un volo A2 vicino alle persone, cosa fai per primo?", r: ["Decolli e guardi dall'alto", "Un sopralluogo: ostacoli, persone, punti di decollo e d'emergenza", "Niente, basta l'A2", "Chiedi ai passanti di allontanarsi dopo il decollo"], ok: 1, perche: "La valutazione dell'area prima del volo è la base per ridurre i rischi." },
    { tema: "Rischio a terra", d: "A cosa serve la zona di sicurezza intorno all'area di volo?", r: ["A parcheggiare", "A contenere il drone se qualcosa va storto, senza rischi per le persone", "A tenere le batterie", "Non serve"], ok: 1, perche: "È uno spazio di margine: se il drone esce dall'area prevista non arriva subito sulle persone." },
    { tema: "Rischio a terra", d: "Durante il volo qualcosa non va vicino alle persone. Cosa fai?", r: ["Atterri subito dove sei", "Allontani il drone dalle persone e atterri nel punto sicuro più vicino", "Sali di quota e aspetti", "Spegni i motori in volo"], ok: 1, perche: "Prima ci si allontana dalle persone, poi si atterra in sicurezza." },
    { tema: "Rischio a terra", d: "Come riduci il rischio di uscire dall'area prevista?", r: ["Volando in modalità Sport", "Con limiti di distanza e quota nel drone e traiettorie lontane dalle persone", "Spegnendo i sensori", "Volando più veloce"], ok: 1, perche: "I limiti impostati nel drone e una buona pianificazione delle traiettorie aiutano a restare nell'area." },
    { tema: "Rischio a terra", d: "Le persone coinvolte nel volo devono:", r: ["Non sapere niente", "Essere informate, istruite e d'accordo", "Stare sotto il drone", "Avere l'attestato"], ok: 1, perche: "Le persone coinvolte partecipano consapevolmente: sanno del volo e sanno cosa fare." },
    { tema: "Rischio a terra", d: "Vuoi ridurre la distanza dalle persone a 5 m con il tuo C2. Cosa attivi?", r: ["La modalità Sport", "La modalità bassa velocità", "Il Remote ID", "La luce verde"], ok: 1, perche: "Solo con la modalità bassa velocità attiva puoi scendere da 30 m a 5 m." },
  ],
};

// Le sigle che si incontrano su D-Flight e nelle zone, spiegate come a chi vola per passione
export const SIGLE_ZONE = [
  { sigla: "D-Flight", nome: "Il portale ufficiale dei droni in Italia", cosa: "Ci si registra come operatore, si stampa il QR da attaccare al drone e si guarda la mappa delle zone.", fare: "Guardalo sempre prima di volare in un posto nuovo." },
  { sigla: "ENAC", nome: "Ente Nazionale per l'Aviazione Civile", cosa: "Fa le regole, rilascia gli attestati e le autorizzazioni per i voli fuori dalla categoria Open.", fare: "Lo contatti per la categoria Specifica o per segnalare un incidente." },
  { sigla: "ENAV", nome: "Chi gestisce il traffico aereo civile", cosa: "Controlla gli aerei intorno agli aeroporti. In molte zone vicino agli aeroporti è l'ente indicato per le autorizzazioni.", fare: "Se la zona dice ENAV, segui la procedura indicata nella scheda della zona (spesso la richiesta parte da D-Flight)." },
  { sigla: "AM", nome: "Aeronautica Militare", cosa: "Gestisce aeroporti e zone militari.", fare: "Nelle zone militari contatta il comando indicato nella zona; se è vietata, cambia posto." },
  { sigla: "UAS", nome: "Drone", cosa: "Sta per «sistema aeromobile senza equipaggio». «Zona geografica UAS» = zona con regole speciali per i droni.", fare: "Quando leggi UAS pensa semplicemente «drone»." },
  { sigla: "CTR", nome: "Zona di controllo di un aeroporto", cosa: "Lo spazio intorno a un aeroporto dove gli aerei decollano e atterrano. Per i droni di solito si può volare solo molto bassi (es. 25, 45 o 60 m) e sopra serve l'autorizzazione.", fare: "Leggi l'altezza libera nella verifica zona e resta sotto." },
  { sigla: "ATZ", nome: "Zona di traffico di un aeroporto", cosa: "Una zona più piccola intorno ad aeroporti e campi di volo.", fare: "Stesse attenzioni della CTR: guarda limiti e ente nella scheda della zona." },
  { sigla: "ATM-09", nome: "Le zone ENAC intorno agli aeroporti", cosa: "Indicano fino a che altezza si può volare senza autorizzazione vicino agli aeroporti.", fare: "Se la zona dice «da 25 m», sotto i 25 m sei a posto con le regole della tua categoria." },
  { sigla: "NFZ", nome: "No Fly Zone", cosa: "Zona dove il volo dei droni non è consentito.", fare: "Non volare: scegli un altro posto." },
  { sigla: "R · P · D", nome: "Zone Regolamentate, Proibite, Pericolose", cosa: "Zone dello spazio aereo (in Italia hanno nomi come LI-R…, LI-P…, LI-D…). P = proibita, R = con regole o orari, D = attività pericolose (es. esercitazioni).", fare: "P: non si vola. R e D: leggi orari e condizioni nella scheda; nel dubbio non volare." },
  { sigla: "NOTAM", nome: "Avviso temporaneo", cosa: "Comunicazione che chiude o limita una zona per un periodo: eventi, esercitazioni, elisoccorso, manifestazioni aeree.", fare: "Controllali su D-Flight il giorno prima e la mattina del volo." },
  { sigla: "AGL / SFC", nome: "Altezza dal suolo", cosa: "AGL = sopra il terreno, SFC = dal suolo. È l'altezza che vedi sul radiocomando.", fare: "Se il limite è in AGL, confrontalo con l'altezza del drone." },
  { sigla: "AMSL / MSL", nome: "Quota sul livello del mare", cosa: "Il limite è misurato dal mare, non da dove sei. In collina o in montagna cambia tutto.", fare: "Togli la quota del terreno: se la zona parte da 500 m AMSL e tu sei su un terreno a 300 m sul mare, la zona inizia 200 m sopra di te. Con il limite di 120 m della categoria Open resti sotto." },
  { sigla: "FL · UNL", nome: "Livelli molto alti", cosa: "FL = livello di volo, quote da aerei (migliaia di metri). UNL = senza limite superiore.", fare: "Per i droni conta solo il limite in basso della zona." },
  { sigla: "Vietato / Serve autorizzazione / Condizionata / Informativa", nome: "I tipi di zona su D-Flight", cosa: "Vietato = non si vola. Serve autorizzazione = si vola solo con il permesso dell'ente. Condizionata = si vola rispettando condizioni (altezza, orari). Informativa = solo un avviso.", fare: "In EyeDrones la verifica zona te lo dice già in parole semplici." },
  { sigla: "Elisoccorso / HEMS", nome: "Elicotteri di emergenza", cosa: "Intorno agli ospedali con elisuperficie possono atterrare elicotteri in qualsiasi momento.", fare: "Stai lontano; se senti un elicottero, scendi e atterra." },
];

// Chi contattare in base al tipo di zona
export const CONTATTI_ZONE = [
  { emoji: "✈️", dove: "Vicino a un aeroporto civile (CTR, ATZ, zone ATM-09)", chi: "ENAV o il gestore indicato nella zona", come: "Il contatto e la procedura sono nella scheda della zona su D-Flight (e nella verifica zona di EyeDrones). Chiedi con diversi giorni di anticipo." },
  { emoji: "🪖", dove: "Aeroporti e zone militari", chi: "Il comando dell'Aeronautica Militare indicato nella zona", come: "Usa il contatto scritto nella scheda della zona. Se la zona è vietata, non serve chiedere: cambia posto." },
  { emoji: "🌲", dove: "Parchi nazionali e regionali, riserve naturali", chi: "L'ente parco", come: "Cerca sul sito dell'ente la pagina «autorizzazioni» o «nulla osta riprese»: spesso c'è un modulo da mandare via email o PEC." },
  { emoji: "🏛️", dove: "Siti archeologici, musei, monumenti", chi: "L'ente che gestisce il sito", come: "Per le riprese (soprattutto se professionali) chiedi il permesso al gestore del sito." },
  { emoji: "⚓", dove: "Porti e zone portuali", chi: "Capitaneria di porto o autorità portuale indicata nella zona", come: "Contatto nella scheda della zona su D-Flight o sul sito della Capitaneria." },
  { emoji: "🏥", dove: "Ospedali con elisuperficie", chi: "L'ente indicato nella zona", come: "Meglio evitare: se proprio serve, usa il contatto della scheda della zona e vola solo con l'ok." },
  { emoji: "🏠", dove: "Proprietà private, ville, agriturismi", chi: "Il proprietario", come: "Per decollare o atterrare in un terreno privato serve il permesso del proprietario. Per le riprese di persone, la liberatoria (anche in EyeDrones)." },
  { emoji: "🎉", dove: "Eventi, manifestazioni, ordinanze comunali", chi: "Gli organizzatori e, se c'è un'ordinanza, il Comune", come: "Sopra gli assembramenti non si vola mai in categoria Open. Per eventi chiedi agli organizzatori e controlla eventuali ordinanze del Comune." },
  { emoji: "📋", dove: "Voli fuori dalle regole Open (oltre 120 m, sopra persone, drone grande)", chi: "ENAC", come: "Servono la categoria Specifica, una dichiarazione STS o un'autorizzazione operativa: di solito con l'aiuto di un operatore o di una scuola." },
];
