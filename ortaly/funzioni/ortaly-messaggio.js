// Ortaly — dopo un messaggio nella chat di un ordine il telefono chiama qui con l'id del messaggio.
// • messaggio del cliente → notifica sui telefoni del produttore; email al produttore se non gli abbiamo già scritto nell'ultima mezz'ora
// • messaggio del produttore → notifica sui telefoni del cliente che la ha attivata; email al cliente, al massimo una ogni mezz'ora
// Le email non contengono il testo né i contatti dell'altro: dicono solo «hai un messaggio» e portano alla chat.
// Ogni messaggio si avvisa una volta sola (colonna «avvisato»).
const { notificaBottega, notificaCliente } = require("./ortaly-push-chiave.js");

const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";
const SITO = "https://ortaly.it";
const MITTENTI = [process.env.ORTALY_MITTENTE, "Ortaly <avvisi@ortaly.it>", "Ortaly <avvisi@eyedrones.it>"].filter(Boolean);

const risposta = (code, msg) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messaggio: msg }) });
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailValida = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
function intestazioni(chiave, extra = {}) {
  const h = { apikey: chiave, "Content-Type": "application/json", ...extra };
  if (chiave.startsWith("eyJ")) h.Authorization = `Bearer ${chiave}`;
  return h;
}
async function manda(chiaveResend, a, oggetto, html, testo) {
  for (const from of MITTENTI) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${chiaveResend}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [a], subject: oggetto, html, text: testo }),
    }).catch(() => null);
    if (r && r.ok) return true;
    console.error("Resend ha rifiutato l'email da", from, ":", r && r.status, r ? (await r.text().catch(() => "")).slice(0, 300) : "rete");
    if (!r || !(r.status === 403 || r.status === 422)) return false;
  }
  return false;
}
const pagina = (titolo, sotto, href, bottone) => `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
  <h2 style="margin:0 0 6px">${esc(titolo)}</h2><p style="margin:0;color:#5d6a57">${esc(sotto)}</p>
  <p style="margin:18px 0"><a href="${href}" style="background:#3c6a2c;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">${esc(bottone)}</a></p>
  <p style="color:#5d6a57;font-size:13px">Per la tua privacy il testo del messaggio lo leggi solo nella chat di Ortaly.</p></div>`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const chiave = process.env.ORTALY_SUPABASE_SECRET, resend = process.env.RESEND_API_KEY;
  if (!chiave) return risposta(500, "Manca ORTALY_SUPABASE_SECRET");

  let id;
  try { id = String(JSON.parse(event.body || "{}").id || ""); } catch { return risposta(400, "JSON non valido"); }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return risposta(400, "Messaggio non valido");

  // segno il messaggio come avvisato (solo se recente e non ancora avvisato)
  const da = encodeURIComponent(new Date(Date.now() - 10 * 60e3).toISOString());
  const presa = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/messaggi?id=eq.${id}&avvisato=eq.false&creato=gt.${da}&select=id,ordine,da,creato,ordini(codice,cliente_nome,cliente_email,segreto,bottega,botteghe(nome,utente))`, {
    method: "PATCH", headers: intestazioni(chiave, { Prefer: "return=representation" }), body: JSON.stringify({ avvisato: true }),
  }).catch(() => null);
  if (!presa || !presa.ok) return risposta(502, "Database non raggiungibile");
  const [m] = await presa.json();
  if (!m) return risposta(200, "Già avvisato");
  const o = m.ordini || {}, b = o.botteghe || {};

  // c'era già un messaggio nello stesso verso nell'ultima mezz'ora? allora niente email (la notifica sì)
  const mezzora = encodeURIComponent(new Date(new Date(m.creato).getTime() - 30 * 60e3).toISOString());
  const prima = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/messaggi?ordine=eq.${m.ordine}&da=eq.${m.da}&id=neq.${m.id}&creato=gt.${mezzora}&select=id&limit=1`, { headers: intestazioni(chiave) })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const email = resend && !prima.length;

  if (m.da === "cliente") {
    const telefoni = await notificaBottega({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, bottega: o.bottega,
      messaggio: { titolo: `Messaggio da ${String(o.cliente_nome || "un cliente").slice(0, 40)}`, testo: `Ordine ${o.codice}: tocca per leggere e rispondere`, url: "/#vendo" } });
    let inviata = false;
    if (email) {
      const u = await fetch(`${ORTALY_SUPABASE_URL}/auth/v1/admin/users/${b.utente}`, { headers: intestazioni(chiave) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (u && emailValida(u.email)) inviata = await manda(resend, u.email, `Messaggio da ${o.cliente_nome} · ordine ${o.codice}`,
        pagina(`${o.cliente_nome} ti ha scritto`, `Un messaggio sull'ordine ${o.codice}.`, `${SITO}/#vendo`, "Leggi e rispondi"),
        `${o.cliente_nome} ti ha scritto sull'ordine ${o.codice}.\nLeggi e rispondi: ${SITO}/#vendo`);
    }
    return risposta(200, `notifiche ${telefoni}, email ${inviata ? 1 : 0}`);
  }

  const telefoni = await notificaCliente({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, ordine: m.ordine,
    messaggio: { titolo: `${String(b.nome || "Il produttore").slice(0, 40)} ti ha scritto`, testo: `Ordine ${o.codice}: tocca per leggere e rispondere`, url: `/#ordine-${o.segreto}` } });
  let inviata = false;
  if (email && emailValida(o.cliente_email)) {
    const link = `${SITO}/#ordine-${o.segreto}`;
    inviata = await manda(resend, o.cliente_email, `${b.nome} ti ha risposto · ordine ${o.codice}`,
      pagina(`${b.nome} ti ha scritto`, `Un messaggio sul tuo ordine ${o.codice}.`, link, "Leggi e rispondi"),
      `${b.nome} ti ha scritto sul tuo ordine ${o.codice}.\nLeggi e rispondi: ${link}`);
  }
  return risposta(200, `notifiche ${telefoni}, email ${inviata ? 1 : 0}`);
};
