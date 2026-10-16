// Eyedrones — Stripe avvisa qui quando un pagamento è andato a buon fine: aggiungo i crediti dell'Esperto.
// Su Stripe: Developers → Webhooks → Add endpoint → https://app.eyedrones.it/.netlify/functions/stripe-webhook
//   evento: checkout.session.completed
// Variabili su Netlify: STRIPE_WEBHOOK_SECRET (whsec_..., la dà Stripe creando il webhook), AVVISO_SEGRETO (c'è già)
const crypto = require("crypto");

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const TOLLERANZA = 300; // secondi: avvisi più vecchi li scarto

// il messaggio arriva davvero da Stripe? controllo la firma
function firmaValida(corpo, intestazione, segreto) {
  if (!intestazione || !segreto) return false;
  const parti = Object.fromEntries(String(intestazione).split(",").map((x) => x.split("=")).filter((x) => x.length === 2 && x[0] !== "v1"));
  const firme = String(intestazione).split(",").filter((x) => x.startsWith("v1=")).map((x) => x.slice(3));
  const t = Number(parti.t);
  if (!t || !firme.length || Math.abs(Date.now() / 1000 - t) > TOLLERANZA) return false;
  const attesa = crypto.createHmac("sha256", segreto).update(`${t}.${corpo}`, "utf8").digest("hex");
  return firme.some((f) => f.length === attesa.length && crypto.timingSafeEqual(Buffer.from(f), Buffer.from(attesa)));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  const corpo = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
  const firma = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!firmaValida(corpo, firma, process.env.STRIPE_WEBHOOK_SECRET)) return { statusCode: 400, body: "firma non valida" };

  let ev;
  try { ev = JSON.parse(corpo); } catch { return { statusCode: 400 }; }
  if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return { statusCode: 200, body: "ignorato" };
  const s = ev.data && ev.data.object;
  if (!s || s.payment_status !== "paid") return { statusCode: 200, body: "non ancora pagato" };
  const utente = s.client_reference_id || (s.metadata && s.metadata.user_id);
  const crediti = Number(s.metadata && s.metadata.crediti);
  if (!utente || !crediti) return { statusCode: 200, body: "non è un pacchetto dell'Esperto" };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/aggiungi_crediti_esperto`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_utente: utente, p_crediti: crediti, p_pacchetto: String(s.metadata.pacchetto || ""), p_sessione: s.id, p_importo: s.amount_total || null, p_segreto: process.env.AVVISO_SEGRETO || "" }),
  }).catch(() => null);
  // se il database non risponde, Stripe riprova da solo più tardi (lo stesso pagamento non conta mai due volte)
  if (!r || !r.ok) return { statusCode: 500, body: "database non raggiungibile" };
  const ok = await r.json().catch(() => false);
  if (ok !== true) return { statusCode: 500, body: "crediti non aggiunti" };
  return { statusCode: 200, body: "ok" };
};

exports._prova = { firmaValida };
