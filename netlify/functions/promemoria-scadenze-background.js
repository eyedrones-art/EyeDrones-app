// EyeDrones — promemoria via email delle scadenze (attestati, assicurazione, manutenzioni, abbonamento D-Flight)
// e riepilogo giornaliero per l'amministratore (errori dell'app, spazio usato).
// In più, una volta sola, l'email «Trova un pilota» a chi lavora con il drone (supabase/email-lavori.sql) e l'email «primi passi» a chi si è iscritto da almeno 2 giorni e non ha ancora messo il drone
// (script supabase/benvenuto-primi-passi.sql).
// La chiama ogni mattina il database (script supabase/errori-spazio-promemoria.sql) con l'elenco già pronto.
// È una funzione «background»: Netlify risponde subito e lei ha fino a 15 minuti per mandare le email.
// Variabili su Netlify (le stesse dell'avviso delle richieste):
//   RESEND_API_KEY   chiave di Resend
//   AVVISO_SEGRETO   il codice mostrato alla fine dello script SQL
//   AVVISO_MITTENTE  facoltativa, es. "EyeDrones <avvisi@eyedrones.it>"
const crypto = require("crypto");

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
    "2. carica attestato e assicurazione",
    "3. carica il file zone di D-Flight (così sai subito dove puoi volare)", "",
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
    <table style="border-collapse:collapse">${passo(1, "Aggiungi il tuo drone")}${passo(2, "Carica attestato e assicurazione")}${passo(3, "Carica il file zone di D-Flight, così sai subito dove puoi volare")}</table>
    <p style="font-size:15px">L'app ti guida passo passo.</p>
    <p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">Comincia da qui ›</a></p>
    <p style="font-size:14px;color:#444">È tutto gratis fino al 31 gennaio 2027. Se qualcosa non è chiaro, o manca qualcosa che ti servirebbe, scrivi a <a href="mailto:info@eyedrones.it">info@eyedrones.it</a>: leggo tutto io.</p>
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

// «Trova un pilota»: una sola volta a chi lavora con il drone (script supabase/email-lavori.sql)
function emailLavori(u) {
  const link = `${APP_URL}/?vai=pagina-pilota`;
  const ciao = `Ciao${u.nome ? ` ${u.nome}` : ""}!`;
  const oggetto = "I clienti della tua zona ora ti scrivono su EyeDrones 🚁";
  const testo = [
    ciao, "",
    "in EyeDrones c'è una novità per chi lavora con il drone: «Trova un pilota».",
    "I clienti della tua provincia scrivono cosa gli serve (matrimoni, case, ispezioni, rilievi, termografia, agricoltura) e la richiesta arriva ai piloti della zona.", "",
    "Come funziona per te:",
    "• attivi «La mia pagina» e spunti «Mostrami in Trova un pilota»;",
    "• per ogni richiesta nella tua provincia ti arriva un'email;",
    "• vedi subito il posto esatto, le zone e la categoria che serve (con il tuo file D-Flight);",
    "• mandi la tua offerta: cosa comprende e il tuo prezzo. Gli altri piloti non vedono il tuo prezzo;",
    "• se il cliente ti sceglie, confermi entro 48 ore e ricevi i suoi contatti.", "",
    "Commissione EyeDrones: 5% del prezzo, minimo 5 €, massimo 50 €, solo sui lavori che ottieni.", "",
    `Attiva la tua pagina da qui: ${link}`, "",
    `Conosci qualcuno che cerca un pilota? Mandagli questo link: ${APP_URL}/trova-pilota`, "",
    "Buoni voli!", "Ivan · EyeDrones", "",
    "Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.",
  ].join("\n");
  const punto = (t) => `<li style="margin:0 0 6px 0">${t}</li>`;
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">🚁 I clienti della tua zona ti scrivono</h2>
    <p style="font-size:15px">${html(ciao)} In EyeDrones c'è una novità per chi lavora con il drone: <b>«Trova un pilota»</b>.</p>
    <p style="font-size:15px">I clienti della tua provincia scrivono cosa gli serve (matrimoni, case, ispezioni, rilievi, termografia, agricoltura) e la richiesta arriva <b>ai piloti della zona</b>.</p>
    <p style="font-size:15px;margin-bottom:6px"><b>Come funziona per te</b></p>
    <ul style="font-size:15px;padding-left:20px;margin-top:0">
      ${punto("attivi <b>«La mia pagina»</b> e spunti <b>«Mostrami in Trova un pilota»</b>;")}
      ${punto("per ogni richiesta nella tua provincia ti arriva un'email;")}
      ${punto("vedi subito il <b>posto esatto</b>, le zone e la categoria che serve (con il tuo file D-Flight);")}
      ${punto("mandi la tua offerta: cosa comprende e <b>il tuo prezzo</b>. Gli altri piloti non vedono il tuo prezzo;")}
      ${punto("se il cliente ti sceglie, confermi entro 48 ore e ricevi i suoi contatti.")}
    </ul>
    <p style="font-size:14px;color:#444">Commissione EyeDrones: 5% del prezzo, minimo 5 €, massimo 50 €, solo sui lavori che ottieni.</p>
    <p><a href="${link}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:6px;font-weight:bold;font-size:16px">Attiva la tua pagina ›</a></p>
    <p style="font-size:14px;color:#444">Conosci qualcuno che cerca un pilota? Mandagli questo link: <a href="${APP_URL}/trova-pilota">app.eyedrones.it/trova-pilota</a></p>
    <p style="font-size:15px">Buoni voli!<br>Ivan · EyeDrones</p>
    <p style="font-size:12px;color:#888">Non vuoi più email da EyeDrones? Spegnile in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
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

exports._prova = { emailUtente, emailAmministratore, emailPrimiPassi, emailCommunity, emailLavori };
