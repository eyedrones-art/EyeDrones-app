// Eyedrones — Ispezione con AI: l'AI (Claude) guarda UNA foto dell'ispezione (tetto, fotovoltaico, facciata, campo)
// e propone le segnalazioni in JSON (tipo, gravità, descrizione, consiglio, posizione indicativa nella foto).
// L'app la chiama una foto alla volta; il pilota poi conferma, toglie o corregge ogni segnalazione: l'ultima parola è sua.
// Usa gli stessi crediti dell'Esperto (1 foto = 1 credito; pacchetti in esperto-acquisto.js).
// Variabili su Netlify: ANTHROPIC_API_KEY, AI_UTENTI (amministratori, senza crediti), ESPERTO_PER_TUTTI ("si" per aprirla a tutti).
const Anthropic = require("@anthropic-ai/sdk");

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const MAX_FOTO = 4.5 * 1024 * 1024; // byte dopo la decodifica: il telefono la rimpicciolisce prima di mandarla

const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(dati) });

async function utenteDa(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}
async function rpc(nome, token, corpo = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`rpc ${nome}: ${r.status}`);
  return r.json();
}
const aperto = () => String(process.env.ESPERTO_PER_TUTTI || "").trim().toLowerCase() === "si";

const ISTRUZIONI = `Sei l'assistente di EyeDrones per le ispezioni con drone. Un pilota professionista ti manda una foto alla volta di un'ispezione.
Il tuo compito è proporre le segnalazioni: i difetti o le anomalie visibili nella foto. Il pilota le controlla una per una prima di consegnarle al cliente.
Regole:
- Segnala solo quello che si vede davvero nella foto. Se non c'è niente di anomalo, restituisci un elenco vuoto: è una risposta valida e frequente.
- Non inventare misure, temperature o cause certe: scrivi «sembra», «probabile». Le temperature lette su un'immagine colorata non sono misure.
- Descrizione e consiglio in italiano semplice, frasi brevi, adatti a un cliente che non è un tecnico.
- Il consiglio indica cosa fare (verifica da vicino, intervento di un tecnico, pulizia, sostituzione), mai prodotti o marche.
- La gravità: bassa = da tenere d'occhio; media = da sistemare con calma; alta = da sistemare presto; critica = rischio per la sicurezza o danni in corso.
- La posizione è un rettangolo indicativo nella foto, con x, y, larghezza e altezza da 0 a 1 rispetto alla foto intera (x e y dall'angolo in alto a sinistra).
- Se la foto è inutilizzabile (mossa, sfocata, troppo lontana, controluce), dillo in qualita_foto.`;

const COMPITI = {
  fotovoltaico: "Impianto fotovoltaico (foto termica o normale). Cerca: punti caldi su singole celle, moduli interi più caldi, stringhe spente, diodi di bypass, sporco o ombre, vetri rotti, moduli staccati o danneggiati, vegetazione che fa ombra.",
  tetto: "Tetto di un edificio. Cerca: tegole o coppi rotti, spostati o mancanti, lamiere sollevate, guaine rovinate, muschio o vegetazione, grondaie e pluviali ostruiti o staccati, camini e lucernari danneggiati, segni di infiltrazioni o ristagni.",
  facciata: "Facciata o struttura di un edificio. Cerca: crepe, distacchi di intonaco o rivestimento, ferri scoperti, cornicioni e balconi rovinati, macchie di umidità, infissi danneggiati. In una foto termica: dispersioni di calore e ponti termici.",
  campo: "Campo coltivato visto dall'alto. Cerca: chiazze con piante più chiare, gialle o secche, zone diradate, ristagni d'acqua, erbe infestanti, danni da grandine o vento, file mancanti. Mai prodotti, principi attivi o dosi.",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sintesi", "qualita_foto", "nota_qualita", "segnalazioni"],
  properties: {
    sintesi: { type: "string", description: "Una frase: cosa si vede nella foto." },
    qualita_foto: { type: "string", enum: ["buona", "scarsa"] },
    nota_qualita: { type: "string", description: "Se la qualità è scarsa: perché e cosa rifare. Altrimenti vuota." },
    segnalazioni: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["tipo", "gravita", "descrizione", "consiglio", "x", "y", "larghezza", "altezza"],
        properties: {
          tipo: { type: "string", description: "Nome breve del difetto, es. «Punto caldo su una cella», «Tegola rotta»." },
          gravita: { type: "string", enum: ["bassa", "media", "alta", "critica"] },
          descrizione: { type: "string", description: "Cosa si vede e dove, una o due frasi." },
          consiglio: { type: "string", description: "Cosa fare, una frase." },
          x: { type: "number" }, y: { type: "number" }, larghezza: { type: "number" }, altezza: { type: "number" },
        },
      },
    },
  },
};

const tra01 = (n) => Math.min(1, Math.max(0, Number(n) || 0));

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Usa POST." });
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { errore: "L'analisi con l'AI non è ancora attiva (manca la chiave sul server)." });

  const token = String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const utente = await utenteDa(token).catch(() => null);
  if (!utente || !utente.email) return json(401, { errore: "Accedi a EyeDrones per usare l'ispezione con AI." });
  const ammessi = String(process.env.AI_UTENTI || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean);
  const admin = ammessi.includes(String(utente.email).toLowerCase());
  if (!admin && !aperto()) return json(403, { errore: "L'ispezione con AI per ora è in prova solo su alcuni account." });
  if (!admin) {
    const crediti = await rpc("crediti_esperto", token).catch(() => null);
    if (crediti == null) return json(503, { errore: "Non riesco a leggere i tuoi crediti, riprova tra poco." });
    if (crediti <= 0) return json(402, { errore: "Hai finito i crediti: scegli un pacchetto per continuare.", servePacchetto: true, crediti: 0 });
  }

  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non leggibile." }); }
  const tipo = COMPITI[dati.tipo] ? dati.tipo : "tetto";
  const immagine = String(dati.immagine || "").replace(/^data:[^,]*,/, "");
  if (!immagine) return json(400, { errore: "Manca la foto." });
  if (Buffer.byteLength(immagine, "base64") > MAX_FOTO) return json(413, { errore: "Foto troppo grande." });
  const nota = String(dati.nota || "").replace(/\s+/g, " ").trim().slice(0, 400);

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const risposta = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      // se l'AI rifiuta per i suoi filtri di sicurezza, il server riprova da solo con un modello di riserva
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      system: ISTRUZIONI,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: immagine } },
          { type: "text", text: `Tipo di ispezione: ${COMPITI[tipo]}${nota ? `\n\nNota del pilota sull'ispezione: ${nota}` : ""}` },
        ],
      }],
    });
    if (risposta.stop_reason === "refusal") return json(422, { errore: "L'AI non ha voluto analizzare questa foto." });
    if (risposta.stop_reason === "max_tokens") return json(502, { errore: "Risposta troppo lunga, riprova." });
    const blocco = risposta.content.find((b) => b.type === "text");
    if (!blocco) return json(502, { errore: "L'AI non ha risposto, riprova tra poco." });
    const esito = JSON.parse(blocco.text);
    // posizioni dentro la foto e al massimo 12 segnalazioni per foto
    esito.segnalazioni = (Array.isArray(esito.segnalazioni) ? esito.segnalazioni : []).slice(0, 12).map((s) => {
      const x = tra01(s.x), y = tra01(s.y);
      return { ...s, x, y, larghezza: Math.min(1 - x, tra01(s.larghezza)) || 0.05, altezza: Math.min(1 - y, tra01(s.altezza)) || 0.05 };
    });
    const u = risposta.usage || {};
    const centesimi = Math.round((((u.input_tokens || 0) * 4 + (u.output_tokens || 0) * 20) / 1e6) * 1000) / 10;
    const crediti = admin ? null : await rpc("usa_credito_esperto", token, { p_tipo: `ispezione_${tipo}`, p_costo: centesimi }).catch(() => null);
    return json(200, { esito, costo_centesimi: centesimi, crediti });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json(429, { errore: "Troppe richieste: riprovo tra poco." });
    if (e instanceof Anthropic.AuthenticationError) return json(503, { errore: "La chiave dell'AI sul server non è valida." });
    if (e instanceof Anthropic.BadRequestError) return json(400, { errore: "Foto non accettata." });
    if (e instanceof Anthropic.APIError) return json(502, { errore: `Servizio AI non disponibile (${e.status}).` });
    return json(500, { errore: "Qualcosa è andato storto nell'analisi." });
  }
};
