// EyeDrones — l'assistente del mattino su Telegram: lo chiama ogni mattina il database (script supabase/assistente-telegram.sql)
// con i numeri del giorno prima già contati, e lui li scrive all'amministratore in un messaggio Telegram.
// Solo numeri: nessun nome, email o telefono di utenti o clienti.
// Variabili su Netlify:
//   TELEGRAM_TOKEN    il token del bot (da @BotFather)
//   TELEGRAM_CHAT_ID  il numero della chat dell'amministratore (da @userinfobot)
//   AVVISO_SEGRETO    lo stesso delle email
const crypto = require("crypto");

const risposta = (statusCode, testo) => ({ statusCode, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: testo });
function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
const html = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v) => Number(v) || 0;
const plurale = (k, uno, tanti) => `${k} ${k === 1 ? uno : tanti}`;

// cose da ricordare in giorni precisi (data in ora italiana, AAAA-MM-GG)
const AGENDA = {
  "2026-10-31": ["Instagram: storia con il conto alla rovescia (sticker al 2 novembre)"],
  "2026-11-02": ["Lancio: video «Cerchiamo piloti», poi «Come funziona Trova un pilota»", "Unire l'aggiornamento e lanciare gli script SQL in Supabase", "YouTube: pubblicare la guida completa sulla zona rossa"],
  "2026-11-03": ["Gmail (fuoriclasseplus): mandare le 10 email ad agenzie e wedding planner, una per una"],
  "2026-11-05": ["YouTube: pubblicare lo Short sulla zona rossa"],
};

function oggiItalia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function messaggioMattino(x) {
  const giorno = new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long" });
  const r = [`☀️ <b>Buongiorno Ivan</b> · ${html(giorno)}`, ""];
  r.push(`👥 <b>Iscritti: ${n(x.iscritti)}</b> · ${n(x.nuovi) ? `+${n(x.nuovi)} da ieri` : "nessun nuovo da ieri"} · ${n(x.nuovi_7)} in 7 giorni`);
  if (x.attivi_ieri != null) r.push(`📱 Hanno usato l'app ieri: ${n(x.attivi_ieri)} · in 7 giorni: ${n(x.attivi_7)}`);
  if (n(x.voli)) r.push(`🛫 ${plurale(n(x.voli), "volo registrato", "voli registrati")}`);
  if (x.richieste != null) {
    r.push("", "<b>Trova un pilota</b>");
    const dove = (x.richieste_dove || []).map((d) => `${html(d.servizio || "lavoro")} (${html(d.provincia || "?")})`).join(", ");
    r.push(n(x.richieste) ? `📍 ${plurale(n(x.richieste), "richiesta nuova", "richieste nuove")}: ${dove}` : "📍 Nessuna richiesta nuova");
    if (n(x.offerte)) r.push(`💬 ${plurale(n(x.offerte), "offerta dei piloti", "offerte dei piloti")}`);
    if (n(x.scelte)) r.push(`👉 ${plurale(n(x.scelte), "cliente ha scelto", "clienti hanno scelto")} un pilota`);
    if (n(x.confermati)) r.push(`✅ ${plurale(n(x.confermati), "lavoro confermato", "lavori confermati")}`);
    if (n(x.senza_offerte)) r.push(`⚠️ ${plurale(n(x.senza_offerte), "richiesta ferma", "richieste ferme")} senza offerte da più di un giorno: servono piloti in quella zona`);
  }
  if (n(x.richieste_pagine)) r.push(`✉️ ${plurale(n(x.richieste_pagine), "richiesta", "richieste")} dalle pagine dei piloti`);
  if (n(x.pagine_nuove)) r.push(`🌐 ${plurale(n(x.pagine_nuove), "pagina pilota nuova", "pagine pilota nuove")}`);
  if (x.errori != null) r.push("", n(x.errori) ? `🐞 ${plurale(n(x.errori), "errore", "errori")} nell'app (dettagli nell'email del mattino)` : "🐞 Nessun errore nell'app");
  const agenda = AGENDA[oggiItalia()];
  if (agenda) r.push("", "<b>Da fare oggi</b>", ...agenda.map((a) => `• ${html(a)}`));
  return r.join("\n");
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const { TELEGRAM_TOKEN: token, TELEGRAM_CHAT_ID: chat, AVVISO_SEGRETO: segreto } = process.env;
  if (!token || !chat || !segreto) return risposta(500, "Mancano TELEGRAM_TOKEN, TELEGRAM_CHAT_ID o AVVISO_SEGRETO nelle variabili di Netlify");
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], segreto)) return risposta(401, "Non autorizzato");
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return risposta(400, "JSON non valido"); }
  if (d.tipo !== "mattino") return risposta(400, "Tipo sconosciuto");
  const invio = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: messaggioMattino(d.numeri || {}), parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => null);
  if (!invio || !invio.ok) {
    console.error("Telegram ha rifiutato il messaggio:", invio && invio.status, invio && (await invio.text().catch(() => "")).slice(0, 300));
    return risposta(502, "Invio non riuscito");
  }
  return risposta(200, "Inviato");
};

exports.messaggioMattino = messaggioMattino;
