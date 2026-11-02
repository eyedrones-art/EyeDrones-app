// Eyedrones — acquisto di un pacchetto di analisi dell'Esperto (AI): apre la pagina di pagamento di Stripe.
// I crediti NON li aggiunge questa funzione: arrivano da stripe-webhook.js quando Stripe conferma il pagamento.
// Variabili su Netlify: STRIPE_SECRET_KEY (la chiave segreta di Stripe, sk_live_... o sk_test_... per provare)
const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const APP = "https://app.eyedrones.it";

// gli stessi pacchetti mostrati nell'app (prezzi finali in centesimi)
const PACCHETTI = {
  p10: { crediti: 10, centesimi: 299, nome: "Esperto EyeDrones · 10 analisi" },
  p30: { crediti: 30, centesimi: 699, nome: "Esperto EyeDrones · 30 analisi" },
  p100: { crediti: 100, centesimi: 1799, nome: "Esperto EyeDrones · 100 analisi" },
};

const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(dati) });

async function utenteDa(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Usa POST." });
  if (!process.env.STRIPE_SECRET_KEY) return json(503, { errore: "I pagamenti non sono ancora attivi." });
  const token = String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const utente = await utenteDa(token).catch(() => null);
  if (!utente || !utente.id) return json(401, { errore: "Accedi a EyeDrones per comprare un pacchetto." });
  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non leggibile." }); }
  const p = PACCHETTI[dati.pacchetto];
  if (!p) return json(400, { errore: "Pacchetto sconosciuto." });

  const campi = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(p.centesimi),
    "line_items[0][price_data][product_data][name]": p.nome,
    "line_items[0][quantity]": "1",
    success_url: `${APP}/?vai=analisi-ai&esperto=grazie`,
    cancel_url: `${APP}/?vai=analisi-ai`,
    client_reference_id: utente.id,
    "metadata[pacchetto]": dati.pacchetto,
    "metadata[crediti]": String(p.crediti),
    "metadata[user_id]": utente.id,
    locale: "it",
  });
  if (utente.email) campi.set("customer_email", utente.email);
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: campi.toString(),
    });
    const s = await r.json();
    if (!r.ok || !s.url) return json(502, { errore: "Non riesco ad aprire il pagamento, riprova tra poco." });
    return json(200, { url: s.url });
  } catch {
    return json(502, { errore: "Non riesco ad aprire il pagamento, riprova tra poco." });
  }
};
