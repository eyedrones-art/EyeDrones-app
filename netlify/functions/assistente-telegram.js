// EyeDrones — l'assistente del mattino su Telegram: lo chiama ogni mattina il database (script supabase/assistente-telegram.sql)
// con i numeri del giorno prima già contati, e lui li scrive all'amministratore in un messaggio Telegram.
// Solo numeri: nessun nome, email o telefono di utenti o clienti.
// Variabili su Netlify:
//   TELEGRAM_TOKEN    il token del bot (da @BotFather)
//   TELEGRAM_CHAT_ID  il numero della chat dell'amministratore (da @userinfobot)
//   AVVISO_SEGRETO    lo stesso delle email
//   PARTNER_CSV_URL   facoltativa: il foglio Google «Promemoria partner» pubblicato come CSV (File → Condividi → Pubblica sul web)
//   PARTNER_CHAT_ID   facoltativa: un gruppo Telegram per i partner; se manca, i partner finiscono nel messaggio di Ivan
//   PARTNER_EMAIL     facoltativa: indirizzi email (separati da virgola) che ricevono il promemoria partner ogni mattina
//                     (es. Stefano, che non usa Telegram). Usa RESEND_API_KEY e AVVISO_MITTENTE, come le altre email
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

// ---- Promemoria partner: un foglio Google che Ivan e Stefano scrivono dal telefono ----
// Colonne: Azienda | Tipo | Chi | Primo contatto | Ultimo contatto | Stato | Note
// Stato: Da contattare · Scritto · Richiamare · Interessato · Sì · No
function leggiCsv(testo) {
  const righe = []; let riga = [], campo = "", virgolette = false;
  const t = String(testo || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (virgolette) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') virgolette = false; else campo += c;
    } else if (c === '"') virgolette = true;
    else if (c === ",") { riga.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; riga.push(campo); righe.push(riga); riga = []; campo = ""; }
    else campo += c;
  }
  if (campo !== "" || riga.length) { riga.push(campo); righe.push(riga); }
  return righe.filter((r) => r.some((x) => String(x).trim() !== ""));
}
const norm = (v) => String(v || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// 15/11/2026, 15/11/26, 15-11-2026 o 2026-11-15 → giorni da oggi (ora italiana); null se non è una data
function giorniFa(v, oggi) {
  const s = String(v || "").trim(); let a, m, g;
  let x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (x) [a, m, g] = [+x[1], +x[2], +x[3]];
  else if ((x = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/))) [g, m, a] = [+x[1], +x[2], +x[3] < 100 ? 2000 + +x[3] : +x[3]];
  else return null;
  const d = Date.UTC(a, m - 1, g); if (isNaN(d)) return null;
  const [oa, om, og] = oggi.split("-").map(Number);
  return Math.round((Date.UTC(oa, om - 1, og) - d) / 864e5);
}
function messaggioPartner(csv, oggi = oggiItalia()) {
  const righe = leggiCsv(csv);
  if (righe.length < 2) return null;
  const testa = righe[0].map(norm);
  const col = (...nomi) => testa.findIndex((h) => nomi.some((n) => h.startsWith(n)));
  const c = { az: col("azienda", "nome"), tipo: col("tipo"), chi: col("chi"), primo: col("primo"), ultimo: col("ultimo"), stato: col("stato"), note: col("note") };
  if (c.az < 0 || c.stato < 0) return null;
  const v = (r, k) => (c[k] >= 0 ? String(r[c[k]] || "").trim() : "");
  const nuovi = [], richiami = [], seguire = []; let si = 0, tot = 0;
  for (const r of righe.slice(1)) {
    const az = v(r, "az"); if (!az) continue; tot++;
    const st = norm(v(r, "stato")), chi = v(r, "chi"), tipo = v(r, "tipo");
    const fa = giorniFa(v(r, "ultimo"), oggi) ?? giorniFa(v(r, "primo"), oggi);
    const riga = `${html(az)}${tipo ? ` · ${html(tipo)}` : ""}${chi ? ` → <b>${html(chi)}</b>` : ""}`;
    if (st === "si") si++;
    else if (!st || st.startsWith("da contatt")) nuovi.push(riga);
    else if ((st.startsWith("scritto") || st.startsWith("richiam")) && (fa == null || fa >= 5)) richiami.push(`${riga}${fa != null ? ` (${fa} giorni fa)` : ""}`);
    else if (st.startsWith("interess") && (fa == null || fa >= 3)) seguire.push(`${riga}${fa != null ? ` (${fa} giorni fa)` : ""}`);
  }
  if (!nuovi.length && !richiami.length && !seguire.length) return null;
  const out = ["🤝 <b>Partner · da fare oggi</b>"];
  if (richiami.length) out.push("", "<b>Da ricontattare</b> (nessuna risposta da 5 giorni)", ...richiami.slice(0, 8).map((x) => `• ${x}`));
  if (seguire.length) out.push("", "<b>Interessati da seguire</b>", ...seguire.slice(0, 8).map((x) => `• ${x}`));
  if (nuovi.length) out.push("", `<b>Da contattare</b>${nuovi.length > 5 ? ` (${nuovi.length}, i primi 5)` : ""}`, ...nuovi.slice(0, 5).map((x) => `• ${x}`));
  out.push("", `📊 ${tot} in lista · ${si} ${si === 1 ? "ha" : "hanno"} detto sì`);
  return out.join("\n");
}

async function inviaTelegram(token, chat, testo) {
  const invio = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: testo, parse_mode: "HTML", disable_web_page_preview: true }),
  }).catch(() => null);
  if (!invio || !invio.ok) console.error("Telegram ha rifiutato il messaggio:", invio && invio.status, invio && (await invio.text().catch(() => "")).slice(0, 300));
  return !!(invio && invio.ok);
}

// la stessa sezione, per email: dal testo Telegram (HTML semplice) a un'email leggibile
async function inviaEmailPartner(indirizzi, testoTelegram) {
  const chiave = process.env.RESEND_API_KEY;
  const a = indirizzi.split(/[,;\s]+/).map((x) => x.trim()).filter((x) => /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(x)).slice(0, 5);
  if (!chiave || !a.length) return false;
  const testo = testoTelegram.replace(/<\/?b>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222;font-size:15px;line-height:1.55">${testoTelegram.split("\n").map((l) => l || "&nbsp;").join("<br>")}<p style="color:#888;font-size:12px;margin-top:18px">Il foglio si aggiorna dall'app Fogli: cambia Stato e Ultimo contatto dopo ogni messaggio.</p></div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.AVVISO_MITTENTE || "Eyedrones <avvisi@eyedrones.it>", to: a, subject: "Partner · da fare oggi", html: corpo, text: testo }),
  }).catch(() => null);
  if (!r || !r.ok) console.error("Email partner non inviata:", r && r.status);
  return !!(r && r.ok);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const { TELEGRAM_TOKEN: grezzo, TELEGRAM_CHAT_ID: chatGrezza, AVVISO_SEGRETO: segreto } = process.env;
  // il token copiato può avere spazi, «a capo» o altro testo intorno (es. il messaggio di BotFather): teniamo solo «numeri:lettere»
  const token = String(grezzo || "").match(/\d{5,}:[A-Za-z0-9_-]{30,}/)?.[0] || "";
  const chat = String(chatGrezza || "").trim();
  if (grezzo && !token) return risposta(500, "TELEGRAM_TOKEN non sembra un token di BotFather (numeri, due punti, lettere)");
  if (!token || !chat || !segreto) return risposta(500, "Mancano TELEGRAM_TOKEN, TELEGRAM_CHAT_ID o AVVISO_SEGRETO nelle variabili di Netlify");
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], segreto)) return risposta(401, "Non autorizzato");
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return risposta(400, "JSON non valido"); }
  if (d.tipo !== "mattino") return risposta(400, "Tipo sconosciuto");
  // il foglio dei partner (se c'è): se si rompe, il messaggio del mattino parte lo stesso
  let partner = null;
  const urlCsv = String(process.env.PARTNER_CSV_URL || "").trim();
  if (/^https:\/\/docs\.google\.com\//.test(urlCsv)) {
    try {
      const r = await fetch(urlCsv, { redirect: "follow", signal: AbortSignal.timeout(8000) });
      if (r.ok) partner = messaggioPartner(await r.text());
      else console.error("Foglio partner non raggiungibile:", r.status);
    } catch (e) { console.error("Foglio partner non letto:", e.message); }
  }
  const gruppo = String(process.env.PARTNER_CHAT_ID || "").trim();
  const mattino = messaggioMattino(d.numeri || {}) + (partner && !gruppo ? `\n\n${partner}` : "");
  if (!(await inviaTelegram(token, chat, mattino))) return risposta(502, "Invio non riuscito");
  if (partner && gruppo) await inviaTelegram(token, gruppo, partner);
  const emailPartner = String(process.env.PARTNER_EMAIL || "").trim();
  if (partner && emailPartner) await inviaEmailPartner(emailPartner, partner);
  return risposta(200, "Inviato");
};

exports.messaggioMattino = messaggioMattino;
exports._prova = { leggiCsv, giorniFa, messaggioPartner };
