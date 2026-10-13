// Eyedrones — analisi di una foto con l'AI (Claude): «cosa c'è che non va nella mia foto o video?»,
// lettura di una foto termica, consigli sul colore. La chiave resta qui sul server, mai nel telefono.
// Variabili su Netlify (Site configuration → Environment variables):
//   ANTHROPIC_API_KEY  la chiave creata su console.anthropic.com
//   AI_UTENTI          le email che possono usarla, separate da virgola (all'inizio solo la tua)
const Anthropic = require("@anthropic-ai/sdk");

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const MAX_FOTO = 4.5 * 1024 * 1024; // byte dopo la decodifica: le foto le rimpicciolisce già il telefono

const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(dati) });

// chi chiama è davvero un iscritto? chiedo a Supabase di chi è il token
async function utenteDa(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}

const ISTRUZIONI = `Sei l'assistente di EyeDrones, un'app italiana per piloti di droni (hobbisti e professionisti).
Ricevi una foto o un fotogramma (a volte uno screenshot del radiocomando) e le risposte del pilota a qualche domanda.
Scrivi in italiano semplice, frasi brevi, senza gergo tecnico non spiegato: chi legge può essere alle prime armi.
Sii onesto: indica le cause più probabili, non certezze. Se dall'immagine non si capisce, dillo e chiedi cosa serve (per esempio «c'è anche nel file salvato?»).
Ordina i controlli dal più facile e veloce al più complicato. Non inventare menu o impostazioni specifiche di un'app se non sei sicuro che esistano: descrivili in modo generico.
Sicurezza: se il problema può far perdere il controllo del drone (segnale, GPS, bussola, motori, eliche, batteria), dillo chiaramente e consiglia di non volare finché non è risolto.`;

const COMPITI = {
  problema: "Il pilota vede un difetto nella foto o nel video (bande, righe, macchie, immagine mossa, colori strani, rumore, sfocatura...). Capisci che cosa sembra e da cosa dipende più probabilmente.",
  termica: "È una foto termica (per esempio di pannelli fotovoltaici o di un edificio). Spiega che cosa si vede, se ci sono punti caldi o anomalie e quanto sono affidabili, e cosa controllare o rifare nel volo. Ricorda che le temperature lette su un'immagine colorata non sono misure: per i valori servono i file radiometrici originali.",
  colore: "Il pilota vuole migliorare il colore della foto o del video. Valuta esposizione, bilanciamento del bianco, contrasto, saturazione e se il materiale sembra girato in profilo piatto (D-Log o simili); suggerisci come correggere e che tipo di LUT o look userebbe.",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cosa_sembra", "cause", "controlli", "si_puo_volare", "nota_sicurezza", "serve_sapere"],
  properties: {
    cosa_sembra: { type: "string", description: "Una o due frasi: che cosa si vede e che cosa sembra." },
    cause: {
      type: "array",
      description: "Le cause più probabili, dalla più probabile.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["causa", "probabilita", "perche"],
        properties: {
          causa: { type: "string" },
          probabilita: { type: "string", enum: ["alta", "media", "bassa"] },
          perche: { type: "string", description: "Che cosa nell'immagine o nelle risposte lo fa pensare." },
        },
      },
    },
    controlli: { type: "array", description: "Cosa fare, in ordine, dal più facile.", items: { type: "string" } },
    si_puo_volare: { type: "string", enum: ["si", "con_attenzione", "no", "non_riguarda"], description: "Se il problema riguarda la sicurezza del volo." },
    nota_sicurezza: { type: "string", description: "Frase sulla sicurezza del volo, vuota se non serve." },
    serve_sapere: { type: "string", description: "Che cosa servirebbe sapere o vedere per esserne sicuri, vuota se non serve." },
  },
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Usa POST." });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { errore: "L'analisi con l'AI non è ancora attiva (manca la chiave sul server)." });

  const token = String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const utente = await utenteDa(token).catch(() => null);
  if (!utente || !utente.email) return json(401, { errore: "Accedi a EyeDrones per usare l'analisi." });
  const ammessi = String(process.env.AI_UTENTI || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  if (!ammessi.includes(String(utente.email).toLowerCase())) return json(403, { errore: "L'analisi con l'AI per ora è in prova solo su alcuni account." });

  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non leggibile." }); }
  const tipo = COMPITI[dati.tipo] ? dati.tipo : "problema";
  const tipoImmagine = ["image/jpeg", "image/png", "image/webp"].includes(dati.formato) ? dati.formato : "image/jpeg";
  const immagine = String(dati.immagine || "").replace(/^data:[^,]*,/, "");
  if (!immagine) return json(400, { errore: "Manca la foto." });
  if (Buffer.byteLength(immagine, "base64") > MAX_FOTO) return json(413, { errore: "Foto troppo grande: riprova con una più piccola." });

  // le risposte del pilota: testo breve, solo quello che serve
  const pulisci = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
  const risposte = Object.entries(dati.risposte || {}).slice(0, 10).map(([k, v]) => `- ${pulisci(k, 80)}: ${pulisci(v, 200)}`).join("\n");
  const testo = [
    `Compito: ${COMPITI[tipo]}`,
    dati.drone ? `Drone: ${pulisci(dati.drone, 80)}` : "",
    risposte ? `Risposte del pilota:\n${risposte}` : "",
    dati.nota ? `Nota del pilota: ${pulisci(dati.nota, 600)}` : "",
  ].filter(Boolean).join("\n\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const risposta = await client.beta.messages.create({
      model: "claude-opus-5-5",
      // risposta corta e veloce: le funzioni di Netlify hanno un tempo massimo per rispondere
      max_tokens: 4000,
      // se l'AI rifiuta per i suoi filtri di sicurezza, il server riprova da solo con un modello di riserva
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: ISTRUZIONI,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: tipoImmagine, data: immagine } },
          { type: "text", text: testo },
        ],
      }],
    });
    if (risposta.stop_reason === "refusal") return json(422, { errore: "L'AI non ha voluto analizzare questa immagine. Prova con un'altra." });
    if (risposta.stop_reason === "max_tokens") return json(502, { errore: "Risposta troppo lunga, riprova." });
    const blocco = risposta.content.find((b) => b.type === "text");
    if (!blocco) return json(502, { errore: "L'AI non ha risposto, riprova tra poco." });
    const esito = JSON.parse(blocco.text);
    const u = risposta.usage || {};
    // costo indicativo in centesimi di dollaro (4 $ e 20 $ per milione di token)
    const centesimi = Math.round((((u.input_tokens || 0) * 4 + (u.output_tokens || 0) * 20) / 1e6) * 1000) / 10;
    return json(200, { esito, costo_centesimi: centesimi });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(429, { errore: "Troppe richieste in questo momento: riprova tra un minuto." });
    if (e instanceof Anthropic.AuthenticationError) return json(503, { errore: "La chiave dell'AI sul server non è valida." });
    if (e instanceof Anthropic.BadRequestError) return json(400, { errore: "L'immagine non è stata accettata: prova con un JPG o PNG." });
    if (e instanceof Anthropic.APIError) return json(502, { errore: `Servizio AI non disponibile (${e.status}), riprova tra poco.` });
    return json(500, { errore: "Qualcosa è andato storto nell'analisi." });
  }
};
