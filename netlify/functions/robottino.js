// EyeDrones — il robottino assistente da scrivania (ESP32 con schermo rotondo, microfono e altoparlante).
// Il robottino manda la voce registrata (WAV 16 kHz) e riceve la risposta già parlata (PCM 24 kHz, 16 bit, mono).
//   POST ?azione=parla   corpo = audio WAV  → trascrive, risponde con Claude, legge la risposta ad alta voce
//   POST ?azione=novita  corpo vuoto        → riassunto parlato: meteo per volare, numeri del mattino, agenda
// Le chiavi restano qui su Netlify, mai nel robottino. Variabili su Netlify:
//   ROBOTTINO_SEGRETO  una parola lunga inventata, la stessa scritta nel programma del robottino
//   ANTHROPIC_API_KEY  già presente (la usa anche la pagina Solare)
//   OPENAI_API_KEY     per trascrivere la voce e per la voce del robottino (pochi centesimi al mese)
//   ROBOTTINO_LAT / ROBOTTINO_LON  facoltative: dove guardare il meteo (se mancano: Torino)
//   AVVISO_SEGRETO / ORTALY_SUPABASE_SECRET  già presenti: servono per i numeri del mattino
const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
const { messaggioMattino, numeriOrtaly, numeriSolare } = require("./assistente-telegram");

const OPENAI = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const SUPABASE = "https://kywmesdqemxqjasixpzq.supabase.co";
const CHIAVE_PUBBLICA = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const EMOZIONI = ["normale", "felice", "triste", "sorpresa", "pensa"];

const testo = (statusCode, t) => ({ statusCode, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: t });
function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
const conTimeout = (ms) => AbortSignal.timeout(ms);
// per le intestazioni: corto e codificato (il robottino lo rimanda indietro come «storia» della chiacchierata)
const intestazione = (s) => encodeURIComponent(String(s || "").slice(0, 220));

// ——— meteo (Open-Meteo, senza chiave) ———
const CIELO = { 0: "sereno", 1: "quasi sereno", 2: "poco nuvoloso", 3: "coperto", 45: "nebbia", 48: "nebbia con brina", 51: "pioggerella", 53: "pioggerella", 55: "pioggerella fitta", 61: "pioggia debole", 63: "pioggia", 65: "pioggia forte", 71: "neve debole", 73: "neve", 75: "neve forte", 80: "rovesci", 81: "rovesci", 82: "rovesci forti", 95: "temporale", 96: "temporale con grandine", 99: "temporale con grandine" };
async function meteo() {
  const lat = Number(process.env.ROBOTTINO_LAT) || 45.07;
  const lon = Number(process.env.ROBOTTINO_LON) || 7.69;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Europe%2FRome&forecast_days=3&wind_speed_unit=kmh`
    + "&current=temperature_2m,weather_code,wind_speed_10m,wind_gusts_10m"
    + "&daily=weather_code,temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max";
  try {
    const r = await fetch(url, { signal: conTimeout(4000) });
    if (!r.ok) return null;
    const d = await r.json();
    const c = d.current || {};
    const g = d.daily || {};
    const nomi = ["Oggi", "Domani", "Dopodomani"];
    const righe = [`Adesso: ${CIELO[c.weather_code] || "?"}, ${Math.round(c.temperature_2m)}°C, vento ${Math.round(c.wind_speed_10m)} km/h, raffiche ${Math.round(c.wind_gusts_10m)} km/h.`];
    (g.time || []).forEach((_, i) => righe.push(`${nomi[i]}: ${CIELO[g.weather_code[i]] || "?"}, ${Math.round(g.temperature_2m_min[i])}–${Math.round(g.temperature_2m_max[i])}°C, pioggia ${g.precipitation_probability_max[i] ?? "?"}%, vento fino a ${Math.round(g.wind_speed_10m_max[i])} km/h, raffiche fino a ${Math.round(g.wind_gusts_10m_max[i])} km/h.`));
    return righe.join("\n");
  } catch { return null; }
}

// ——— numeri del mattino (gli stessi del messaggio Telegram), senza HTML ———
async function numeri() {
  const segreto = process.env.AVVISO_SEGRETO;
  if (!segreto) return null;
  try {
    const r = await fetch(`${SUPABASE}/rest/v1/rpc/robottino_numeri`, {
      method: "POST", headers: { apikey: CHIAVE_PUBBLICA, "Content-Type": "application/json" },
      body: JSON.stringify({ p_segreto: segreto }), signal: conTimeout(4000),
    });
    const x = r.ok ? await r.json() : {};
    const [o, sol] = await Promise.all([numeriOrtaly(process.env.ORTALY_SUPABASE_SECRET), numeriSolare(segreto)]);
    return messaggioMattino(x || {}, o, sol).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  } catch { return null; }
}

// ——— voce → testo ———
async function trascrivi(audio) {
  const fd = new FormData();
  fd.append("file", new Blob([audio], { type: "audio/wav" }), "voce.wav");
  fd.append("model", "gpt-4o-mini-transcribe");
  fd.append("language", "it");
  fd.append("prompt", "Ivan parla con il suo robottino Bip. Parole frequenti: EyeDrones, Ortaly, drone, volo, vento, meteo, Trova un pilota, Giampower, fotovoltaico, ENAC.");
  const r = await fetch(`${OPENAI}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: fd, signal: conTimeout(8000) });
  if (!r.ok) throw new Error("trascrizione " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  return String((await r.json()).text || "").trim();
}

// ——— testo → voce (PCM 24 kHz, 16 bit, mono: il robottino lo suona così com'è) ———
async function parla(frase) {
  const r = await fetch(`${OPENAI}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts", voice: "coral", input: frase, response_format: "pcm",
      instructions: "Parla in italiano, con voce allegra, gentile e un po' buffa, come un piccolo robot simpatico. Ritmo calmo e chiaro.",
    }),
    signal: conTimeout(12000),
  });
  if (!r.ok) throw new Error("voce " + r.status + " " + (await r.text().catch(() => "")).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

// ——— il cervello ———
const SISTEMA = `Sei Bip, il robottino assistente da scrivania di Ivan. Ivan è un pilota di droni in Piemonte e ha creato EyeDrones (app per piloti di droni, con «Trova un pilota» per i clienti), Ortaly (vendita di frutta e verdura dei produttori locali) e la pagina Solare (preventivi fotovoltaico per l'installatore Giampower).
Le tue risposte vengono lette ad alta voce da un altoparlantino: frasi corte e semplici, al massimo 3 frasi (circa 50 parole), niente elenchi, niente emoji, niente simboli, numeri scritti in modo facile da dire.
Ivan balbetta: la trascrizione della sua voce può avere parole ripetute, spezzate o sbagliate. Capisci il senso e rispondi; non farglielo mai notare e non chiedergli di ripetere se il senso si capisce.
Sul volo con il drone: guarda vento, raffiche e pioggia; con raffiche sopra i 35 chilometri orari o pioggia probabile consiglia di non volare con i droni piccoli. Ricorda di controllare le zone su d-flight. Non inventare regole: se non sei sicuro, dillo.
Sii simpatico e incoraggiante, a volte con una battuta leggera. Non dire mai «gratis» o «gratuito».
Inizia SEMPRE la risposta con l'emozione tra parentesi quadre, scelta tra: [normale] [felice] [triste] [sorpresa] [pensa]. Esempio: «[felice] Domani è perfetto per volare!»`;

async function pensa(richiesta, contesto, storia) {
  const client = new Anthropic();
  const messaggi = [];
  if (storia) messaggi.push({ role: "user", content: storia.domanda || "…" }, { role: "assistant", content: storia.risposta || "…" });
  messaggi.push({ role: "user", content: `${contesto}\n\n${richiesta}` });
  const r = await client.messages.create({ model: "claude-haiku-5-5", max_tokens: 300, system: SISTEMA, messages: messaggi });
  const grezzo = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  const m = grezzo.match(/^\s*\[(\w+)\]\s*/);
  const emozione = m && EMOZIONI.includes(m[1].toLowerCase()) ? m[1].toLowerCase() : "normale";
  const frase = grezzo.replace(/^\s*\[\w+\]\s*/, "").replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim().slice(0, 600);
  return { emozione, frase: frase || "Bip bup! Non so cosa dire." };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return testo(405, "Solo POST");
  const { ROBOTTINO_SEGRETO, ANTHROPIC_API_KEY, OPENAI_API_KEY } = process.env;
  if (!ROBOTTINO_SEGRETO || !ANTHROPIC_API_KEY || !OPENAI_API_KEY) return testo(500, "Mancano ROBOTTINO_SEGRETO, ANTHROPIC_API_KEY o OPENAI_API_KEY nelle variabili di Netlify");
  if (!stessoSegreto(event.headers["x-robottino-segreto"], ROBOTTINO_SEGRETO)) return testo(401, "Non autorizzato");
  const azione = (event.queryStringParameters || {}).azione;
  if (azione !== "parla" && azione !== "novita") return testo(400, "Azione sconosciuta");

  // l'ultima domanda e risposta, rimandate dal robottino (così capisce «e domani?»)
  let storia = null;
  const s = String(event.headers["x-storia"] || "").split("|");
  if (s.length === 2 && s[0] && s[1]) { try { storia = { domanda: decodeURIComponent(s[0]), risposta: decodeURIComponent(s[1]) }; } catch { /* storia rovinata: si riparte */ } }

  try {
    const ora = new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    let domanda = "";
    let richiesta;
    if (azione === "parla") {
      const audio = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "binary");
      if (audio.length > 6000) domanda = await trascrivi(audio);
      richiesta = domanda ? `Ivan ti dice: «${domanda}»` : "Ivan ha tenuto premuto il pulsante ma non si è sentito niente: diglielo con simpatia e ricordagli di parlare vicino al microfono.";
    } else {
      richiesta = "Ivan ha premuto il pulsante delle novità. Fai un riassunto parlato di al massimo 4 frasi: com'è il tempo per volare oggi e domani, i numeri più importanti di ieri e, se c'è, cosa c'è da fare oggi.";
    }
    const [tempo, conti] = await Promise.all([meteo(), azione === "novita" || /numer|iscritt|ortaly|ordin|solare|fotovolt|contatt|richiest|novit|app/i.test(domanda) ? numeri() : null]);
    const contesto = [`Adesso è ${ora}.`, tempo ? `Meteo nella zona di Ivan:\n${tempo}` : "Meteo non disponibile in questo momento.", conti ? `Numeri del mattino:\n${conti}` : ""].filter(Boolean).join("\n\n");
    const { emozione, frase } = await pensa(richiesta, contesto, storia);
    const pcm = await parla(frase);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Emozione": emozione, "X-Testo": intestazione(frase), "X-Domanda": intestazione(domanda) },
      body: pcm.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error("robottino:", e.message);
    return testo(502, "Il robottino non riesce a rispondere");
  }
};
