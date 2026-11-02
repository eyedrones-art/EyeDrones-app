// Eyedrones — «Trova un pilota»: il pilota scelto dal cliente paga la commissione e il lavoro è suo.
// Apre la pagina di pagamento di Stripe; la conferma NON la fa questa funzione: arriva da stripe-webhook.js
// quando Stripe conferma il pagamento. La commissione la calcola il database (supabase/trova-pilota.sql).
// Variabili su Netlify: STRIPE_SECRET_KEY (come per l'Esperto)
const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const APP = "https://app.eyedrones.it";

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
  if (!utente || !utente.id) return json(401, { errore: "Accedi a EyeDrones per confermare il lavoro." });
  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non leggibile." }); }
  if (!/^[0-9a-f-]{36}$/i.test(String(dati.offerta || ""))) return json(400, { errore: "Offerta sconosciuta." });

  // quanto pagare: lo chiedo al database come il pilota (così vale solo per la sua offerta scelta e non scaduta)
  const c = await fetch(`${SUPABASE_URL}/rest/v1/rpc/commissione_lavoro`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_offerta: dati.offerta }),
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const centesimi = c && Math.round(Number(c.commissione) * 100);
  if (!centesimi || centesimi < 50) return json(409, { errore: "Questo lavoro non è più da confermare: ricarica la pagina." });

  const descrizione = ["Trova un pilota", c.servizio, c.luogo].filter(Boolean).join(" · ").slice(0, 120);
  const campi = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(centesimi),
    "line_items[0][price_data][product_data][name]": `Commissione lavoro · ${descrizione}`,
    "line_items[0][quantity]": "1",
    success_url: `${APP}/?vai=richieste&lavoro=confermato`,
    cancel_url: `${APP}/?vai=richieste`,
    client_reference_id: utente.id,
    "metadata[tipo]": "lavoro",
    "metadata[offerta]": dati.offerta,
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
