// EyeDrones — «Manda una prova»: una notifica di prova sui telefoni della persona collegata.
// Serve a capire se le notifiche arrivano davvero. Chi chiama deve essere collegato (token di Supabase):
// la notifica va solo ai telefoni del suo account, mai ad altri.
const { inviaPush } = require("./push-chiave.js");

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(dati) });

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Solo POST" });
  const segreto = process.env.AVVISO_SEGRETO;
  if (!segreto) return json(500, { errore: "Manca AVVISO_SEGRETO" });
  const token = String(event.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { errore: "Non collegato" });
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }).catch(() => null);
  const utente = u && u.ok ? await u.json().catch(() => null) : null;
  if (!utente || !utente.email) return json(401, { errore: "Non collegato" });

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_destinatari`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_segreto: segreto, p_email: [utente.email] }),
  }).catch(() => null);
  const telefoni = r && r.ok ? await r.json().catch(() => []) : [];
  const lista = Array.isArray(telefoni) ? telefoni.slice(0, 10) : [];
  let inviate = 0;
  for (const t of lista) {
    const esito = await inviaPush(segreto, t, { titolo: "🔔 Prova riuscita", testo: "Le notifiche di EyeDrones arrivano su questo telefono.", url: "https://app.eyedrones.it/?vai=impostazioni" });
    if (esito === "ok") inviate++;
    if (esito === "via") await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_togli`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_segreto: segreto, p_endpoint: t.endpoint }),
    }).catch(() => null);
  }
  return json(200, { telefoni: lista.length, inviate });
};
