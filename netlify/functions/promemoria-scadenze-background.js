// EyeDrones — promemoria via email delle scadenze (attestati, assicurazione, manutenzioni, abbonamento D-Flight)
// e riepilogo giornaliero per l'amministratore (errori dell'app, spazio usato).
// In più, una volta sola, l'email «La nuova EyeDrones è online» a tutti gli iscritti (supabase/email-lavori.sql) e l'email «primi passi» a chi si è iscritto da almeno 2 giorni e non ha ancora messo il drone
// (script supabase/benvenuto-primi-passi.sql).
// La chiama ogni mattina il database (script supabase/errori-spazio-promemoria.sql) con l'elenco già pronto.
// È una funzione «background»: Netlify risponde subito e lei ha fino a 15 minuti per mandare le email.
// Variabili su Netlify (le stesse dell'avviso delle richieste):
//   RESEND_API_KEY   chiave di Resend
//   AVVISO_SEGRETO   il codice mostrato alla fine dello script SQL
//   AVVISO_MITTENTE  facoltativa, es. "EyeDrones <avvisi@eyedrones.it>"
const crypto = require("crypto");
const { inviaPush } = require("./push-chiave.js");
const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";

const APP_URL = "https://app.eyedrones.it";
const MITTENTE_PREDEFINITO = "EyeDrones <avvisi@eyedrones.it>";
const LIMITE_STORAGE_BYTE = 1024 * 1024 * 1024; // 1 GB del piano gratuito di Supabase

function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
const html = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const emailValida = (v) => /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(String(v || ""));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
function dataItaliana(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}
const quando = (g) => (g <= 0 ? "scade oggi" : g === 1 ? "scade domani" : `scade tra ${g} giorni`);

function emailUtente(u) {
  const voci = (u.voci || []).slice(0, 20);
  const prima = voci[0];
  const oggetto = voci.length === 1 ? `⏰ ${prima.titolo}: ${quando(prima.giorni)}` : `⏰ ${voci.length} scadenze EyeDrones in arrivo`;
  const righeTesto = voci.map((v) => `• ${v.titolo} — ${quando(v.giorni)} (${dataItaliana(v.data)})`);
  const testo = [
    `Ciao${u.nome ? ` ${u.nome}` : ""},`, "",
    "ti ricordiamo queste scadenze:", ...righeTesto, "",
    "Rinnova in tempo per volare in regola e avere i documenti a posto in caso di controllo.",
    `Aggiorna le date in EyeDrones: ${APP_URL}`, "",
    "Non vuoi più questi promemoria? Spegnili in EyeDrones → Impostazioni.",
  ].join("\n");
  const righeHtml = voci.map((v) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px">${html(v.titolo)}</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #eee;font-size:14px;color:${v.giorni <= 7 ? "#c0392b" : "#b9770e"};font-weight:600;white-space:nowrap">${html(quando(v.giorni))}<br><span style="color:#777;font-weight:400">${html(dataItaliana(v.data))}</span></td></tr>`).join("");
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">⏰ Scadenze in arrivo</h2>
    <p style="font-size:15px">Ciao${u.nome ? ` ${html(u.nome)}` : ""}, ti ricordiamo queste scadenze:</p>
    <table style="width:100%;border-collapse:collapse">${righeHtml}</table>
    <p style="font-size:14px;color:#444">Rinnova in tempo per volare in regola e avere i documenti a posto in caso di controllo.</p>
    <p><a href="${APP_URL}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Apri EyeDrones</a></p>
    <p style="font-size:12px;color:#888">Non vuoi più questi promemoria? Spegnili in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
}

// «In regola in 3 minuti»: una sola volta, a chi si è iscritto e non ha ancora messo il drone
function emailPrimiPassi(u) {
  const link = `${APP_URL}/?vai=primi`;
  const ciao = `Ciao${u.nome ? ` ${u.nome}` : ""}!`;
  const oggetto = "Il tuo drone è in regola? Bastano 3 minuti ✈️";
  const testo = [
    ciao, "",
    "ti sei iscritto a EyeDrones: grazie!", "",
    "Se ti fermano per un controllo mentre voli, devi mostrare attestato, assicurazione e dati del drone.",
    "Con EyeDrones li hai tutti in una schermata, anche senza campo.", "",
    "Per prepararla bastano 3 minuti:",
    "1. aggiungi il tuo drone",
    "2. registra il primo volo: scegli foto e video del drone e i voli si creano da soli",
    "3. carica attestato e assicurazione", "",
    `L'app ti guida passo passo. Comincia da qui: ${link}`, "",
    "È tutto gratis fino al 31 gennaio 2027.",
    "Se qualcosa non è chiaro, o manca qualcosa che ti servirebbe, scrivi a info@eyedrones.it: leggo tutto io.", "",
    "Buoni voli!", "Ivan · EyeDrones", "",
    "Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.",
  ].join("\n");
  const passo = (n, t) => `<tr><td style="width:34px;padding:6px 0;vertical-align:top"><span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:#e0552f;color:#fff;text-align:center;font-weight:bold;font-size:14px">${n}</span></td><td style="padding:8px 0;font-size:15px">${t}</td></tr>`;
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">✈️ In regola in 3 minuti</h2>
    <p style="font-size:15px">${html(ciao)} Ti sei iscritto a EyeDrones: grazie!</p>
    <p style="font-size:15px">Se ti fermano per un controllo mentre voli, devi mostrare <b>attestato, assicurazione e dati del drone</b>. Con EyeDrones li hai tutti in una schermata, <b>anche senza campo</b>.</p>
    <p style="font-size:15px;margin-bottom:4px">Per prepararla bastano 3 minuti:</p>
    <table style="border-collapse:collapse">${passo(1, "Aggiungi il tuo drone")}${passo(2, "Registra il primo volo: scegli foto e video del drone e i voli si creano da soli")}${passo(3, "Carica attestato e assicurazione")}</table>
    <p style="font-size:15px">L'app ti guida passo passo.</p>
    <p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">Comincia da qui ›</a></p>
    <p style="font-size:14px;color:#444">È tutto gratis fino al 31 gennaio 2027. Se qualcosa non è chiaro, o manca qualcosa che ti servirebbe, scrivi a <a href="mailto:info@eyedrones.it">info@eyedrones.it</a>: leggo tutto io.</p>
    <p style="font-size:15px">Buoni voli!<br>Ivan · EyeDrones</p>
    <p style="font-size:12px;color:#888">Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
}

// chi ha messo il drone ma dopo 3 giorni non ha ancora un volo nel registro: una sola volta, «registro automatico»
function emailPrimoVolo(u) {
  const link = `${APP_URL}/?vai=importa`;
  const ciao = `Ciao${u.nome ? ` ${u.nome}` : ""}!`;
  const oggetto = "Il tuo primo volo nel registro, senza scrivere niente ✈️";
  const testo = [
    ciao, "",
    "hai già messo il tuo drone in EyeDrones: ottimo!", "",
    "Ora manca il registro dei voli. Non devi scriverlo a mano:",
    "1. apri il registro automatico",
    "2. scegli le foto e i video del drone (dalla scheda SD o quelli scaricati con DJI Fly)",
    "3. l'app crea da sola i voli, con data, ora, durata e luogo", "",
    `Comincia da qui: ${link}`, "",
    "I file restano sul tuo telefono: l'app legge solo data, ora, posizione e altezza.",
    "Se qualcosa non va, scrivi a info@eyedrones.it: leggo tutto io.", "",
    "Buoni voli!", "Ivan · EyeDrones", "",
    "Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.",
  ].join("\n");
  const passo = (n, t) => `<tr><td style="width:34px;padding:6px 0;vertical-align:top"><span style="display:inline-block;width:26px;height:26px;line-height:26px;border-radius:50%;background:#e0552f;color:#fff;text-align:center;font-weight:bold;font-size:14px">${n}</span></td><td style="padding:8px 0;font-size:15px">${t}</td></tr>`;
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">⚡ Il registro si scrive da solo</h2>
    <p style="font-size:15px">${html(ciao)} Hai già messo il tuo drone in EyeDrones: ottimo!</p>
    <p style="font-size:15px">Ora manca il registro dei voli. <b>Non devi scriverlo a mano:</b></p>
    <table style="border-collapse:collapse">${passo(1, "Apri il <b>registro automatico</b>")}${passo(2, "Scegli le foto e i video del drone, dalla scheda SD o scaricati con DJI Fly")}${passo(3, "L'app crea da sola i voli, con data, ora, durata e luogo")}</table>
    <p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">Registra i tuoi voli ›</a></p>
    <p style="font-size:14px;color:#444">I file restano sul tuo telefono: l'app legge solo data, ora, posizione e altezza. Se qualcosa non va, scrivi a <a href="mailto:info@eyedrones.it">info@eyedrones.it</a>: leggo tutto io.</p>
    <p style="font-size:15px">Buoni voli!<br>Ivan · EyeDrones</p>
    <p style="font-size:12px;color:#888">Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
}

// la community dei posti: una sola volta a tutti (con le email di EyeDrones accese), «consiglia un posto»
function emailCommunity(u) {
  const link = `${APP_URL}/?vai=consiglia`;
  const ciao = `Ciao${u.nome ? ` ${u.nome}` : ""}!`;
  const oggetto = "Hai un posto del cuore dove volare? Consiglialo ⭐";
  const testo = [
    ciao, "",
    "ti chiedo un piccolo aiuto per far crescere EyeDrones insieme.", "",
    "Nell'app c'è la mappa dei posti belli dove volare: quelli consigliati dai piloti hanno la stellina ⭐ e si vedono per primi.",
    "Più posti ci sono, più è utile a tutti: quando arrivi in un posto nuovo, trovi subito dove volare, con la zona già controllata.", "",
    "Hai un posto dove hai volato e che consiglieresti? Un belvedere, un lago, un castello, un campo tranquillo?",
    "Bastano 30 secondi: nome, un tocco sulla mappa e, se vuoi, una dritta (parcheggio, vento, orario migliore).",
    "Gli altri piloti vedono il posto e la tua nota, mai il tuo nome.", "",
    `Consiglia un posto da qui: ${link}`, "",
    "Lo trovi anche in Home («⭐ Conosci un bel posto dove volare?») e su ogni volo del registro.", "",
    "Grazie, buoni voli!", "Ivan · EyeDrones", "",
    "Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.",
  ].join("\n");
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">⭐ Il tuo posto del cuore, per gli altri piloti</h2>
    <p style="font-size:15px">${html(ciao)} Ti chiedo un piccolo aiuto per far crescere EyeDrones insieme.</p>
    <p style="font-size:15px">Nell'app c'è la <b>mappa dei posti belli dove volare</b>: quelli consigliati dai piloti hanno la stellina ⭐ e si vedono per primi. Più posti ci sono, più è utile a tutti: quando arrivi in un posto nuovo, trovi subito dove volare, con la zona già controllata.</p>
    <p style="font-size:15px">Hai un posto dove hai volato e che consiglieresti? Un belvedere, un lago, un castello, un campo tranquillo? Bastano <b>30 secondi</b>: nome, un tocco sulla mappa e, se vuoi, una dritta (parcheggio, vento, orario migliore).</p>
    <p style="font-size:14px;color:#444">Gli altri piloti vedono il posto e la tua nota, <b>mai il tuo nome</b>.</p>
    <p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">⭐ Consiglia un posto ›</a></p>
    <p style="font-size:14px;color:#444">Lo trovi anche in Home («⭐ Conosci un bel posto dove volare?») e su ogni volo del registro.</p>
    <p style="font-size:15px">Grazie, buoni voli!<br>Ivan · EyeDrones</p>
    <p style="font-size:12px;color:#888">Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
}

// «La nuova EyeDrones è online»: una sola volta a tutti gli iscritti (script supabase/email-lavori.sql),
// con l'invito ad attivare «La mia pagina» per ricevere i lavori di «Trova un pilota» (se non è già attiva)
const NOVITA = [
  ["🏠", "Una Home nuova", "il prossimo volo e le cose da fare subito in alto, e un menu più semplice."],
  ["⚡", "Registro automatico", "scegli foto e video della scheda SD e i voli si creano da soli, con data, posto e durata."],
  ["📝", "Permessi più veloci", "più aree nella stessa richiesta e il nuovo avviso alla Polizia locale."],
  ["🌤️", "Il weekend giusto per volare", "se la attivi, il giovedì ti arriva un'email con le ore buone di sabato e domenica."],
  ["⭐", "Consiglia un posto", "i posti più belli dove volare, consigliati dagli altri piloti."],
];
function emailLavori(u) {
  const conPagina = !!u.pagina;
  const link = conPagina ? APP_URL : `${APP_URL}/?vai=pagina-pilota`;
  const ciao = `Ciao${u.nome ? ` ${u.nome}` : ""}!`;
  const oggetto = "La nuova EyeDrones è online 🚁";
  const passi = [
    "attivi «La mia pagina» e spunti «Mostrami in Trova un pilota»;",
    "quando un cliente della tua provincia cerca un pilota, ti arriva un'email;",
    "vedi il posto esatto, le zone e la categoria che serve;",
    "mandi la tua offerta con il tuo prezzo: gli altri piloti non lo vedono;",
    "se il cliente ti sceglie, confermi e ricevi i suoi contatti.",
  ];
  const testo = [
    ciao, "",
    "Da oggi c'è la nuova versione di EyeDrones. Ecco le novità:", "",
    ...NOVITA.map(([, t, d]) => `• ${t}: ${d}`), "",
    "E la più grande: «Trova un pilota».",
    "I clienti scrivono cosa gli serve (matrimoni, case, ispezioni, rilievi, termografia, agricoltura) e la richiesta arriva ai piloti della loro provincia.", "",
    ...(conPagina
      ? ["La tua pagina è già in «Trova un pilota»: quando arriva una richiesta nella tua provincia ti scriviamo noi.", "", `Apri EyeDrones: ${link}`]
      : ["Per ricevere i lavori:", ...passi.map((t) => `• ${t}`), "", `Attiva la tua pagina da qui: ${link}`]),
    "",
    `Conosci qualcuno che cerca un pilota? Mandagli questo link: ${APP_URL}/trova-pilota`, "",
    "Buoni voli!", "Ivan · EyeDrones", "",
    "Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.",
  ].join("\n");
  const punto = (t) => `<li style="margin:0 0 6px 0">${t}</li>`;
  const novita = NOVITA.map(([e, t, d]) => `<tr><td style="font-size:20px;padding:6px 10px 6px 0;vertical-align:top">${e}</td><td style="font-size:15px;padding:6px 0"><b>${html(t)}</b><br><span style="color:#555">${html(d)}</span></td></tr>`).join("");
  const bottone = (testoBottone) => `<p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">${testoBottone}</a></p>`;
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">🚁 La nuova EyeDrones è online</h2>
    <p style="font-size:15px">${html(ciao)} Da oggi c'è la nuova versione di EyeDrones. Ecco le novità:</p>
    <table style="border-collapse:collapse;margin:0 0 14px 0">${novita}</table>
    <h3 style="color:#e0552f;margin:18px 0 8px">📍 E la più grande: «Trova un pilota»</h3>
    <p style="font-size:15px">I clienti scrivono cosa gli serve (matrimoni, case, ispezioni, rilievi, termografia, agricoltura) e la richiesta arriva <b>ai piloti della loro provincia</b>.</p>
    ${conPagina
      ? `<p style="font-size:15px">La tua pagina è già in «Trova un pilota»: quando arriva una richiesta nella tua provincia ti scriviamo noi.</p>${bottone("Apri EyeDrones ›")}`
      : `<p style="font-size:15px;margin-bottom:6px"><b>Per ricevere i lavori</b></p>
    <ul style="font-size:15px;padding-left:20px;margin-top:0">${passi.map((t) => punto(html(t))).join("")}</ul>
    ${bottone("Attiva la tua pagina ›")}`}
    <p style="font-size:14px;color:#444">Conosci qualcuno che cerca un pilota? Mandagli questo link: <a href="${APP_URL}/trova-pilota">app.eyedrones.it/trova-pilota</a></p>
    <p style="font-size:15px">Buoni voli!<br>Ivan · EyeDrones</p>
    <p style="font-size:12px;color:#888">Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
}

// --- «Il weekend giusto per volare» (il giovedì, a chi l'ha attivato) -------------------------------------------
// Ore buone: pioggia ≤ 30% e quasi zero, vento ≤ 20 km/h, raffiche ≤ 32 km/h, tra alba e tramonto.
// Se né sabato né domenica hanno almeno un'ora buona, l'email non parte
const GIORNI_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MESI_IT = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const minuti = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

async function meteoWeekend(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover,visibility,temperature_2m&daily=sunrise,sunset&timezone=Europe%2FRome&forecast_days=5`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

// le finestre buone di un giorno (ore piene tra alba e tramonto), con la migliore per prima
function finestreDelGiorno(j, giorno) {
  const h = j.hourly || {}, d = j.daily || {};
  const k = (d.time || []).indexOf(giorno);
  if (k < 0) return null;
  const alba = minuti(d.sunrise[k]), tramonto = minuti(d.sunset[k]);
  const ore = [];
  (h.time || []).forEach((t, i) => {
    if (t.slice(0, 10) !== giorno) return;
    const m = minuti(t);
    if (m < alba - 30 || m > tramonto - 30) return;
    const buona = (h.precipitation_probability[i] ?? 0) <= 30 && (h.precipitation[i] ?? 0) < 0.2 && (h.wind_speed_10m[i] ?? 99) <= 20 && (h.wind_gusts_10m[i] ?? 99) <= 32;
    ore.push({ m, buona, vento: h.wind_speed_10m[i], nuvole: h.cloud_cover[i], vis: h.visibility[i], temp: h.temperature_2m[i] });
  });
  const finestre = [];
  let corrente = null;
  ore.forEach((o) => {
    if (o.buona) { if (!corrente) { corrente = { da: o.m, a: o.m + 60, ore: [o] }; finestre.push(corrente); } else { corrente.a = o.m + 60; corrente.ore.push(o); } }
    else corrente = null;
  });
  finestre.forEach((f) => {
    f.a = Math.min(f.a, tramonto);
    f.oroSera = f.a >= tramonto - 20; f.oroMattina = f.da <= alba + 30;
    f.vento = Math.round(Math.max(...f.ore.map((o) => o.vento ?? 0)));
    f.nuvole = Math.round(f.ore.reduce((s, o) => s + (o.nuvole ?? 0), 0) / f.ore.length);
    f.punti = (f.a - f.da) / 60 + (f.oroSera ? 3 : 0) + (f.oroMattina ? 2 : 0) - f.vento / 10;
  });
  finestre.sort((x, y) => y.punti - x.punti);
  const nebbia = ore.filter((o) => o.m <= alba + 180 && o.vis != null && o.vis < 1000).length > 0;
  const freddo = Math.min(...ore.map((o) => o.temp ?? 20));
  return { giorno, alba, tramonto, finestre: finestre.filter((f) => f.a - f.da >= 45), nebbia, freddo };
}

function consiglioDiStagione(data, giorni) {
  const m = data.getMonth(), settimana = Math.floor(data.getTime() / (7 * 864e5));
  const freddo = giorni.some((g) => g && g.freddo < 5), nebbia = giorni.some((g) => g && g.nebbia);
  if (freddo) return "Sotto i 5 °C le batterie durano meno: tienile al caldo fino al decollo, fai un minuto di hovering e torna con almeno il 30%.";
  if (nebbia) return "Nebbia al mattino nelle valli: sopra la nebbia vengono foto bellissime, ma il drone deve restare sempre in vista. Se la nebbia lo nasconde, si aspetta.";
  const inverno = ["La luce d'inverno è bassa tutto il giorno: le ombre lunghe danno profondità anche a mezzogiorno.", "Il tramonto arriva presto: preparati in anticipo, l'ora d'oro dura meno di un'ora.", "Con la neve la camera sbaglia l'esposizione: alza l'esposizione di +0,7 o +1.", "Entrando al caldo dopo il volo la camera si appanna: lascia il drone nella borsa chiusa per mezz'ora."];
  const resto = ["Fai la foto di riferimento della scena prima di decollare: in montaggio sai già cosa cercare.", "Controlla vento in quota: a 80-120 m spesso è il doppio che a terra.", "Una scheda SD vuota e le batterie cariche la sera prima: la mattina dopo si parte subito."];
  const lista = m >= 10 || m <= 1 ? inverno : resto;
  return lista[((settimana % lista.length) + lista.length) % lista.length];
}

function testoFinestra(g, f) {
  const d = new Date(`${g.giorno}T12:00:00`);
  const nome = `${GIORNI_IT[d.getDay()]} ${d.getDate()} ${MESI_IT[d.getMonth()]}`;
  const luce = f.oroSera ? `luce più bella dalle ${hhmm(g.tramonto - 45)}, tramonto alle ${hhmm(g.tramonto)}` : f.oroMattina ? `luce più bella fino alle ${hhmm(g.alba + 45)}, alba alle ${hhmm(g.alba)}` : `tramonto alle ${hhmm(g.tramonto)}`;
  const cielo = f.nuvole >= 80 ? "cielo coperto" : f.nuvole >= 40 ? "qualche nuvola" : "cielo quasi sereno";
  return { nome, orario: `dalle ${hhmm(f.da)} alle ${hhmm(f.a)}`, dettagli: `vento fino a ${f.vento} km/h · ${cielo} · ${luce}` };
}

function emailWeekend(u, giorni, oggi = new Date()) {
  const buoni = giorni.filter((g) => g && g.finestre.length);
  if (!buoni.length) return null;
  const zona = u.zona || "la tua zona";
  const migliori = buoni.map((g) => ({ g, f: g.finestre[0], t: testoFinestra(g, g.finestre[0]) }));
  const primo = migliori[0];
  const ciao = `Ciao${u.nome ? ` ${u.nome}` : ""}!`;
  const oggetto = `${primo.t.nome.charAt(0).toUpperCase() + primo.t.nome.slice(1).split(" ")[0]} si vola: ${primo.t.orario.replace("dalle ", "").replace(" alle ", "–")} vicino a ${zona} 🌤️`;
  const posti = (u.posti || []).filter((p) => p && p.nome);
  const consiglio = consiglioDiStagione(oggi, giorni);
  const link = `${APP_URL}/?vai=pianificazione`;
  const linkConsiglia = `${APP_URL}/?vai=consiglia`;
  const grazie = Number(u.grazie) || 0;
  const testoGrazie = grazie > 0 ? `👍 Questa settimana ${grazie === 1 ? "un pilota ha" : `${grazie} piloti hanno`} trovato utile un posto che hai consigliato. Grazie!` : "";
  const invitoPosti = posti.length ? "Conosci un altro bel posto qui vicino? Consiglialo agli altri piloti" : `Nessuno ha ancora consigliato un posto vicino a ${zona}: sii il primo, gli altri piloti ti ringrazieranno`;
  const mappa = (p) => `https://www.google.com/maps?q=${Number(p.lat).toFixed(5)},${Number(p.lon).toFixed(5)}`;
  const testo = [
    ciao, "",
    ...(testoGrazie ? [testoGrazie, ""] : []),
    `Il weekend vicino a ${zona}:`,
    ...migliori.map(({ t }) => `• ${t.nome}, ${t.orario}: ${t.dettagli}`), "",
    ...(posti.length ? ["Posti consigliati dagli altri piloti qui vicino:", ...posti.map((p) => `• ${p.nome} (${String(p.km).replace(".", ",")} km)${p.nota ? `: ${p.nota}` : ""} · ${mappa(p)}`), ""] : []),
    `${invitoPosti}: ${linkConsiglia}`, "",
    `Consiglio della settimana: ${consiglio}`, "",
    "Prima di volare controlla la zona e i NOTAM su D-Flight.",
    `Meteo ora per ora, zona e luce del posto: ${link}`, "",
    "Buoni voli!", "Ivan · EyeDrones", "",
    "Non vuoi più questa email? Spegnila in EyeDrones → Impostazioni → «Il weekend giusto per volare».",
  ].join("\n");
  const riga = ({ t, f }) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top"><div style="font-size:15px;font-weight:bold;text-transform:capitalize">${html(t.nome)}</div><div style="font-size:15px;color:#e0552f;font-weight:bold">${html(t.orario)}${f.oroSera || f.oroMattina ? " ✨" : ""}</div><div style="font-size:13px;color:#555">${html(t.dettagli)}</div></td></tr>`;
  const posto = (p) => `<li style="margin-bottom:6px;font-size:14px"><a href="${mappa(p)}" style="color:#e0552f;font-weight:bold">${html(p.nome)}</a> <span style="color:#777">· ${html(String(p.km).replace(".", ","))} km${p.voto ? ` · ${"★".repeat(Math.max(1, Math.min(5, p.voto)))}` : ""}</span>${p.nota ? `<br><span style="color:#555">${html(p.nota)}</span>` : ""}</li>`;
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 6px">🌤️ Il weekend giusto per volare</h2>
    <p style="font-size:15px;margin-top:0">${html(ciao)} Ecco quando conviene volare vicino a <b>${html(zona)}</b>.</p>
    ${testoGrazie ? `<p style="font-size:15px;background:#eafaf0;border-radius:8px;padding:10px 12px;color:#1d6b3a"><b>${html(testoGrazie)}</b></p>` : ""}
    <table style="border-collapse:collapse;width:100%;background:#fff7f2;border-radius:8px">${migliori.map(riga).join("")}</table>
    ${posti.length ? `<p style="font-size:15px;margin:18px 0 6px"><b>📍 Posti consigliati qui vicino</b></p><ul style="padding-left:18px;margin:0">${posti.map(posto).join("")}</ul>` : ""}
    <p style="font-size:14px;margin:12px 0 0">⭐ ${html(invitoPosti)} › <a href="${linkConsiglia}" style="color:#e0552f;font-weight:bold">Consiglia un posto</a></p>
    <p style="font-size:14px;background:#f4f6f8;border-radius:8px;padding:10px 12px;margin-top:18px">💡 <b>Consiglio della settimana:</b> ${html(consiglio)}</p>
    <p style="font-size:13px;color:#a33">Prima di volare controlla la zona e i NOTAM su D-Flight.</p>
    <p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">Prepara il volo ›</a></p>
    <p style="font-size:15px">Buoni voli!<br>Ivan · EyeDrones</p>
    <p style="font-size:12px;color:#888">Non vuoi più questa email? Spegnila in EyeDrones → Impostazioni → «Il weekend giusto per volare».</p>
  </div>`;
  return { oggetto, testo, corpo };
}

// la notifica sul telefono del giovedì: il momento migliore, l'altro giorno buono e il posto consigliato più vicino
function notificaWeekend(u, giorni) {
  const buoni = giorni.filter((g) => g && g.finestre.length);
  if (!buoni.length) return null;
  const zona = u.zona || "la tua zona";
  const [primo, secondo] = buoni.map((g) => testoFinestra(g, g.finestre[0]));
  const giorno = (t) => t.nome.split(" ")[0];
  const ore = (t) => t.orario.replace("dalle ", "").replace(" alle ", "–");
  const posto = (u.posti || []).find((p) => p && p.nome);
  const pezzi = [
    `${giorno(primo).charAt(0).toUpperCase() + giorno(primo).slice(1)} ${ore(primo)}: ${primo.dettagli.split(" · ").slice(0, 2).join(", ")}.`,
    secondo ? `Anche ${giorno(secondo)} ${ore(secondo)}.` : "",
    posto ? `📍 ${posto.nome} (${String(posto.km).replace(".", ",")} km).` : "",
  ].filter(Boolean);
  return {
    titolo: `🌤️ Si vola vicino ${/^a/i.test(zona) ? "ad" : "a"} ${zona}`.slice(0, 90),
    testo: pezzi.join(" ").slice(0, 200),
    url: `${APP_URL}/?vai=pianificazione`,
  };
}

// i telefoni con le notifiche attive di questa persona (stessa funzione del database usata per i lavori)
async function notificaTelefoni(segreto, email, messaggio) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_destinatari`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_segreto: segreto, p_email: [email] }),
  }).catch(() => null);
  if (!r || !r.ok) return 0; // notifiche-push.sql non ancora eseguito: resta l'email
  const telefoni = await r.json().catch(() => []);
  let ok = 0;
  for (const t of (Array.isArray(telefoni) ? telefoni : []).slice(0, 10)) {
    const esito = await inviaPush(segreto, t, messaggio);
    if (esito === "ok") ok++;
    if (esito === "via") await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_togli`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_segreto: segreto, p_endpoint: t.endpoint }),
    }).catch(() => null);
  }
  return ok;
}

// sabato e domenica che vengono (l'email parte il giovedì)
function giorniWeekend(oggi = new Date()) {
  const fmt = (d) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(d);
  const out = [];
  for (let k = 1; k <= 4 && out.length < 2; k++) { const d = new Date(oggi.getTime() + k * 864e5); const g = fmt(d); const wd = new Date(`${g}T12:00:00`).getDay(); if (wd === 6 || wd === 0) out.push(g); }
  return out;
}

function emailAmministratore(a) {
  const e = a.errori || { quanti: 0, esempi: [] };
  const mb = a.spazio_byte != null ? Math.round(a.spazio_byte / 1048576) : null;
  const perc = a.spazio_byte != null ? Math.round((a.spazio_byte / LIMITE_STORAGE_BYTE) * 100) : null;
  const oggetto = `EyeDrones · ieri ${e.quanti} ${e.quanti === 1 ? "errore" : "errori"}${mb != null ? ` · spazio ${mb} MB (${perc}%)` : ""}`;
  const righe = (e.esempi || []).map((x) => `• [${x.pagina || "?"}] ${x.messaggio} (${x.volte}×)`);
  const testo = [
    `Errori nelle ultime 24 ore: ${e.quanti}`, ...righe, "",
    mb != null ? `Spazio usato su Supabase: ${mb} MB su 1024 (${perc}%)${perc >= 80 ? " — è ora di passare a Supabase Pro o liberare spazio" : ""}` : "",
    "", "Il dettaglio è in Supabase → Table editor → errori_app.",
  ].join("\n");
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222"><pre style="white-space:pre-wrap;font-size:13px">${html(testo)}</pre></div>`;
  return { oggetto, testo, corpo };
}

async function invia(chiave, mittente, a, { oggetto, testo, corpo }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: mittente, to: [a], subject: oggetto, text: testo, html: corpo }),
  });
  if (!r.ok) console.error("invio non riuscito", a, r.status, (await r.text()).slice(0, 200));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], process.env.AVVISO_SEGRETO)) return { statusCode: 401 };
  const chiave = process.env.RESEND_API_KEY;
  if (!chiave) { console.error("manca RESEND_API_KEY"); return { statusCode: 500 }; }
  const mittente = process.env.AVVISO_MITTENTE || MITTENTE_PREDEFINITO;
  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400 }; }

  // Resend gratuito: 100 email al giorno in tutto. Prima le scadenze, poi i «primi passi» con quelle che restano
  let restano = 90;
  for (const u of (dati.utenti || []).slice(0, restano)) {
    if (!emailValida(u.email) || !(u.voci || []).length) continue;
    await invia(chiave, mittente, u.email, emailUtente(u));
    restano -= 1;
    await pausa(600); // Resend gratuito: al massimo 2 invii al secondo
  }
  for (const u of (dati.primi_passi || []).slice(0, Math.max(0, restano))) {
    if (!emailValida(u.email)) continue;
    await invia(chiave, mittente, u.email, emailPrimiPassi(u));
    restano -= 1;
    await pausa(600);
  }
  for (const u of (dati.primo_volo || []).slice(0, Math.max(0, restano))) {
    if (!emailValida(u.email)) continue;
    await invia(chiave, mittente, u.email, emailPrimoVolo(u));
    restano -= 1;
    await pausa(600);
  }
  const weekend = giorniWeekend();
  // la notifica sul telefono parte a tutti (non conta nel limite di Resend), l'email finché ce ne sono
  for (const u of (dati.weekend || [])) {
    if (!emailValida(u.email) || u.lat == null || u.lon == null) continue;
    let j = null;
    try { j = await meteoWeekend(u.lat, u.lon); } catch (e) { console.error("meteo non disponibile", e.message); }
    if (!j) continue;
    const giorni = weekend.map((g) => finestreDelGiorno(j, g));
    const e = emailWeekend(u, giorni);
    if (!e) continue; // weekend brutto: niente email e niente notifica
    const n = notificaWeekend(u, giorni);
    if (n) await notificaTelefoni(process.env.AVVISO_SEGRETO, u.email, n).catch((x) => console.error("notifica weekend", x.message));
    if (restano <= 0) continue;
    await invia(chiave, mittente, u.email, e);
    restano -= 1;
    await pausa(600);
  }
  for (const u of (dati.community || []).slice(0, Math.max(0, restano))) {
    if (!emailValida(u.email)) continue;
    await invia(chiave, mittente, u.email, emailCommunity(u));
    restano -= 1;
    await pausa(600);
  }
  for (const u of (dati.lavori || []).slice(0, Math.max(0, restano))) {
    if (!emailValida(u.email)) continue;
    await invia(chiave, mittente, u.email, emailLavori(u));
    restano -= 1;
    await pausa(600);
  }
  const amm = dati.amministratore;
  if (amm && emailValida(amm.email)) {
    const spazioAlto = amm.spazio_byte != null && amm.spazio_byte / LIMITE_STORAGE_BYTE >= 0.7;
    if ((amm.errori && amm.errori.quanti > 0) || spazioAlto) await invia(chiave, mittente, amm.email, emailAmministratore(amm));
  }
  return { statusCode: 202 };
};

exports._prova = { emailUtente, emailAmministratore, emailPrimiPassi, emailPrimoVolo, emailCommunity, emailLavori, emailWeekend, notificaWeekend, finestreDelGiorno, giorniWeekend };
