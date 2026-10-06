import React from "react";

// Informativa privacy e condizioni d'uso di EyeDrones (pagine pubbliche: /privacy e /termini)
const TITOLARE = { nome: "Ivan Ravinale", luogo: "Grugliasco (TO), Italia", email: "info@eyedrones.it" };
const AGGIORNATA = "6 ottobre 2026";

const stPagina = { minHeight: "100vh", background: "#12151c", color: "#e7eaee", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: "32px 18px 60px" };
const stCorpo = { maxWidth: 760, margin: "0 auto", fontSize: 14.5, lineHeight: 1.65 };
const H2 = ({ children }) => <h2 style={{ fontSize: 17, margin: "26px 0 8px", color: "#ffb877" }}>{children}</h2>;
const Lista = ({ voci }) => <ul style={{ paddingLeft: 20, margin: "6px 0" }}>{voci.map((v, i) => <li key={i} style={{ marginBottom: 4 }}>{v}</li>)}</ul>;

function Testata({ titolo }) {
  return (
    <>
      <a href="/" style={{ color: "#8b95a3", fontSize: 13, textDecoration: "none" }}>← EyeDrones</a>
      <h1 style={{ fontSize: 26, margin: "12px 0 4px" }}>{titolo}</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: 0 }}>Ultimo aggiornamento: {AGGIORNATA}</p>
    </>
  );
}

export function Privacy() {
  return (
    <div style={stPagina}>
      <div style={stCorpo}>
        <Testata titolo="Informativa sulla privacy" />
        <p>Questa informativa spiega quali dati personali tratta l'app EyeDrones (app.eyedrones.it), perché, per quanto tempo e quali diritti hai, come previsto dal Regolamento UE 2016/679 (GDPR) e dalla normativa italiana.</p>

        <H2>1. Chi è il titolare del trattamento</H2>
        <p>{TITOLARE.nome}, {TITOLARE.luogo}. Per qualsiasi domanda sulla privacy o per esercitare i tuoi diritti scrivi a <a href={`mailto:${TITOLARE.email}`} style={{ color: "#3d8bfd" }}>{TITOLARE.email}</a>.</p>

        <H2>2. Quali dati trattiamo</H2>
        <Lista voci={[
          <><strong>Account</strong>: email e password (la password è conservata cifrata e nessuno può leggerla).</>,
          <><strong>Profilo e attività</strong>: nome dell'attività, logo, tariffe e impostazioni che inserisci.</>,
          <><strong>Dati operativi che inserisci tu</strong>: droni, attestati e documenti (anche assicurazione e permessi), voli con data, luogo e coordinate GPS, foto e video, batterie, manutenzioni, piani di volo, preventivi, incassi.</>,
          <><strong>Dati di altre persone che inserisci tu</strong>: clienti (rubrica), collaboratori, persone riprese e liberatorie firmate, richieste di preventivo ricevute dalla tua pagina pubblica. Vedi il punto 6.</>,
          <><strong>Posizione del telefono</strong>: solo quando tocchi un pulsante che la usa (es. «Vicino a me» o «Usa la mia posizione»), per cercare luoghi, meteo e zone. Viene salvata solo se la usi per riempire un volo, un piano o un posto consigliato.</>,
          <><strong>Posti consigliati</strong>: nome, coordinate, nota e voto dei posti che consigli. Sono visibili agli altri utenti registrati, senza il tuo nome né la tua email.</>,
          <><strong>Dati tecnici</strong>: quando l'app ha un errore annotiamo la pagina, il messaggio d'errore e il tipo di browser o dispositivo (gli indirizzi email nel messaggio vengono oscurati). Annotiamo anche da quale link sei arrivato quando ti registri (es. un post o una galleria condivisa).</>,
        ]} />

        <H2>3. Perché li trattiamo e su quale base</H2>
        <Lista voci={[
          <><strong>Fornirti il servizio</strong> (creare l'account, salvare e mostrare i tuoi dati, generare PDF, condividere gallerie): esecuzione del contratto, cioè delle condizioni d'uso che accetti registrandoti.</>,
          <><strong>Avvisi di servizio</strong>: email per confermare l'account e reimpostare la password, promemoria delle tue scadenze (attestati, assicurazione, manutenzioni, D-Flight). Base: esecuzione del contratto e legittimo interesse; i promemoria si spengono in Impostazioni.</>,
          <><strong>Sicurezza e correzione degli errori</strong>, statistiche anonime su come arrivano gli iscritti: legittimo interesse a far funzionare bene l'app.</>,
          <><strong>Obblighi di legge</strong> (per esempio fiscali, quando ci saranno abbonamenti a pagamento).</>,
          <><strong>Comunicazioni sulle novità per email</strong>: solo se in futuro darai il consenso, che potrai ritirare in ogni momento.</>,
        ]} />
        <p>Non vendiamo i tuoi dati, non li usiamo per pubblicità e non li condividiamo con altri utenti, salvo quello che decidi tu di rendere pubblico (pagina pilota, gallerie condivise, posti consigliati).</p>

        <H2>4. Chi ci aiuta a far funzionare l'app</H2>
        <p>Usiamo fornitori che trattano i dati per nostro conto, con contratti che li obbligano a proteggerli:</p>
        <Lista voci={[
          <><strong>Supabase</strong>: database, accesso all'account e archiviazione di file e foto.</>,
          <><strong>Netlify</strong>: pubblicazione dell'app e funzioni che inviano le email.</>,
          <><strong>Resend</strong>: invio delle email (server in Irlanda).</>,
          <><strong>OpenStreetMap, Nominatim e Overpass</strong>: mappe, ricerca degli indirizzi e dei posti. Ricevono il testo cercato o le coordinate.</>,
          <><strong>Open-Meteo</strong> e <strong>NOAA</strong>: meteo e indice geomagnetico. Ricevono solo le coordinate del luogo, nessun dato personale.</>,
          <><strong>Google Fonts</strong>: i caratteri dell'app. Il browser li scarica dai server di Google, che vedono l'indirizzo IP.</>,
        ]} />
        <p>Alcuni di questi fornitori hanno sede negli Stati Uniti: in quel caso il trasferimento avviene con le garanzie previste dal GDPR (decisione di adeguatezza EU-USA o clausole contrattuali standard). Quando tocchi un collegamento esterno (WhatsApp, Google Calendar, Google Maps, D-Flight) passi al servizio di quell'azienda, con la sua informativa.</p>

        <H2>5. Per quanto tempo li conserviamo</H2>
        <Lista voci={[
          "I dati dell'account e quelli che inserisci: finché l'account è attivo. Se lo elimini, li cancelliamo entro 30 giorni (le copie di sicurezza si sovrascrivono nei giorni successivi).",
          "Le segnalazioni di errore: 60 giorni.",
          "I dati che la legge ci obbliga a tenere (per esempio fatture): per il tempo previsto dalla legge.",
        ]} />

        <H2>6. Dati delle persone che inserisci (clienti, persone riprese, collaboratori)</H2>
        <p>Quando inserisci dati di altre persone (rubrica clienti, liberatorie, collaboratori, foto in cui si riconoscono persone) <strong>sei tu il titolare di quei dati</strong>: devi avere una base valida (contratto, consenso, liberatoria) e informare le persone. EyeDrones li conserva solo per conto tuo, come responsabile del trattamento, e non li usa per altri scopi. Le regole di questo rapporto sono nelle condizioni d'uso.</p>

        <H2>7. Memorie del browser e cookie</H2>
        <p>L'app usa solo memorie tecniche del browser (localStorage e sessionStorage) per tenerti collegato, ricordare le tue preferenze, salvare la copia dei documenti di controllo da usare senza campo, i progressi dei quiz e i file delle zone D-Flight. Non usiamo cookie di profilazione, pubblicità o strumenti di analisi di terze parti: per questo non serve un banner dei cookie. Uscendo dall'account la copia dei documenti viene cancellata dal telefono.</p>

        <H2>8. I tuoi diritti</H2>
        <p>Puoi chiedere in qualsiasi momento di accedere ai tuoi dati, correggerli, cancellarli, limitarne l'uso, riceverli in un formato leggibile (portabilità) e opporti ai trattamenti basati sul legittimo interesse. Scrivi a <a href={`mailto:${TITOLARE.email}`} style={{ color: "#3d8bfd" }}>{TITOLARE.email}</a>: rispondiamo entro 30 giorni. Puoi eliminare l'account da Impostazioni. Se ritieni che i tuoi dati non siano trattati correttamente puoi fare reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noreferrer" style={{ color: "#3d8bfd" }}>garanteprivacy.it</a>).</p>

        <H2>9. Minori</H2>
        <p>EyeDrones è pensata per chi ha almeno 14 anni. Sotto i 18 anni serve il permesso di un genitore.</p>

        <H2>10. Modifiche</H2>
        <p>Se cambiamo questa informativa aggiorniamo la data in alto e, per i cambiamenti importanti, te lo segnaliamo nell'app.</p>
      </div>
    </div>
  );
}

export function Termini() {
  return (
    <div style={stPagina}>
      <div style={stCorpo}>
        <Testata titolo="Condizioni d'uso" />
        <p>Queste condizioni regolano l'uso dell'app EyeDrones (app.eyedrones.it), offerta da {TITOLARE.nome}, {TITOLARE.luogo} (contatti: <a href={`mailto:${TITOLARE.email}`} style={{ color: "#3d8bfd" }}>{TITOLARE.email}</a>). Creando un account le accetti.</p>

        <H2>1. Cos'è EyeDrones</H2>
        <p>EyeDrones è uno strumento di supporto per piloti di droni: pianificazione, registro dei voli, documenti, preventivi, consegna di foto e video ai clienti, consigli e materiale per imparare.</p>

        <H2>2. Sei tu il responsabile dei tuoi voli</H2>
        <p><strong>L'app non sostituisce D-Flight, ENAC, le norme in vigore, il manuale del drone né la tua valutazione.</strong> Zone di volo, meteo, regole, consigli, quiz, calcoli (filtri ND, STS, fotogrammetria) e prezzi suggeriti sono indicativi e possono essere incompleti o non aggiornati. Prima di ogni volo verifica sempre le fonti ufficiali. Il pilota e l'operatore restano gli unici responsabili del rispetto delle regole e della sicurezza dei voli.</p>

        <H2>3. Account</H2>
        <Lista voci={[
          "Inserisci dati veri e tieni al sicuro la password: sei responsabile di quello che avviene con il tuo account.",
          "L'account è personale. Possiamo sospenderlo se viene usato in modo illecito o contrario a queste condizioni.",
          "Puoi eliminarlo quando vuoi da Impostazioni.",
        ]} />

        <H2>4. I tuoi contenuti</H2>
        <Lista voci={[
          "Foto, video, documenti e dati che carichi restano tuoi. Ci dai solo il permesso di conservarli e mostrarli a te e alle persone con cui li condividi, per far funzionare l'app.",
          "Sei responsabile di avere i diritti sui contenuti e i consensi delle persone riprese o inserite (clienti, collaboratori, liberatorie).",
          "Non caricare contenuti illeciti, offensivi o che violano la privacy o i diritti di altri.",
        ]} />

        <H2>5. Dati di altre persone (responsabile del trattamento)</H2>
        <p>Per i dati di clienti, persone riprese e collaboratori che inserisci, tu sei il titolare del trattamento e EyeDrones agisce come responsabile del trattamento (art. 28 GDPR). Ci impegniamo a: trattarli solo per fornirti il servizio e secondo le tue istruzioni (cioè l'uso che fai dell'app); farli trattare solo a persone e fornitori tenuti alla riservatezza; proteggerli con misure adeguate; aiutarti a rispondere alle richieste delle persone interessate; avvisarti senza ritardo in caso di violazione; cancellarli quando elimini i dati o l'account. Ci avvaliamo dei fornitori indicati nell'informativa privacy.</p>

        <H2>6. Cose visibili ad altri</H2>
        <Lista voci={[
          "Le gallerie e i link che condividi sono visibili a chi riceve il link (con PIN, se lo imposti).",
          "La tua pagina pilota, se la attivi, è pubblica.",
          "I posti che consigli sono visibili agli altri utenti registrati, senza il tuo nome.",
        ]} />

        <H2>7. Piani e prezzi</H2>
        <p>Durante il lancio tutte le funzioni sono gratuite fino al 31 gennaio 2027. Dopo potranno esserci piani a pagamento: i prezzi e le condizioni saranno indicati chiaramente nell'app prima di qualsiasi pagamento, e nulla ti verrà addebitato senza una tua scelta esplicita. Alcuni limiti (per esempio spazio per foto e video o numero di voli) possono cambiare con avviso.</p>

        <H2>8. Disponibilità del servizio</H2>
        <p>Facciamo il possibile perché l'app funzioni sempre, ma possono esserci interruzioni, errori o perdite di dati per cause tecniche o di fornitori esterni. Ti consigliamo di tenere una copia dei documenti importanti (PDF, CSV e originali di foto e video).</p>

        <H2>9. Responsabilità</H2>
        <p>Nei limiti consentiti dalla legge, EyeDrones non risponde di danni derivanti dall'uso delle informazioni indicative fornite dall'app, da voli o lavori eseguiti, da interruzioni del servizio o da contenuti inseriti dagli utenti. Restano salvi i casi di dolo o colpa grave e i diritti che la legge riconosce ai consumatori.</p>

        <H2>10. Modifiche e chiusura</H2>
        <p>Possiamo aggiornare queste condizioni: per i cambiamenti importanti ti avvisiamo nell'app o per email. Se non sei d'accordo puoi eliminare l'account.</p>

        <H2>11. Legge applicabile</H2>
        <p>Si applica la legge italiana. Per i consumatori è competente il tribunale del luogo di residenza o domicilio del consumatore; negli altri casi il tribunale di Torino.</p>
      </div>
    </div>
  );
}
