// Ortaly — dopo un ordine il telefono del cliente chiama qui con l'id dell'ordine.
// Mando l'email al produttore (e al cliente, se ha lasciato l'email). Ogni ordine si avvisa una volta sola:
// prima segno «avvisato» nel database, poi scrivo; un secondo invio per lo stesso ordine non fa nulla.
// Variabili su Netlify: ORTALY_SUPABASE_SECRET (chiave segreta del progetto Supabase di Ortaly), RESEND_API_KEY (c'è già).
// indirizzo del progetto Supabase di Ortaly (lo stesso scritto in public/ortaly/index.html)
const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";

const MITTENTE_PREDEFINITO = "Ortaly <avvisi@eyedrones.it>";
const SITO = "https://ortaly.it";
const MODI = { casa: "Consegna a casa", ritiro: "Ritiro in azienda", spedizione: "Spedizione con corriere" };

const risposta = (code, msg) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messaggio: msg }) });
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const euro = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const emailValida = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

function intestazioni(chiave, extra = {}) {
  const h = { apikey: chiave, "Content-Type": "application/json", ...extra };
  if (chiave.startsWith("eyJ")) h.Authorization = `Bearer ${chiave}`; // vecchia chiave service_role
  return h;
}

async function manda(chiaveResend, a, oggetto, html, testo, replyTo) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiaveResend}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.ORTALY_MITTENTE || MITTENTE_PREDEFINITO, to: [a], subject: oggetto, html, text: testo, ...(replyTo ? { reply_to: replyTo } : {}) }),
  }).catch(() => null);
  if (!r || !r.ok) console.error("Resend ha rifiutato l'email:", r && r.status, r && (await r.text().catch(() => "")).slice(0, 300));
  return !!(r && r.ok);
}

function riepilogo(o) {
  const righe = (o.righe || []).map((r) => `${r.qta} × ${r.nome} (${r.unita}) — ${euro(r.prezzo * r.qta)}`);
  return { righe, html: `<ul style="padding-left:18px;margin:8px 0">${righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p style="margin:4px 0"><b>Totale prodotti: ${esc(euro(o.totale))}</b></p>` };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const chiave = process.env.ORTALY_SUPABASE_SECRET;
  const resend = process.env.RESEND_API_KEY;
  if (!ORTALY_SUPABASE_URL || !chiave || !resend) return risposta(500, "Manca la configurazione di Ortaly o RESEND_API_KEY");

  let id;
  try { id = String(JSON.parse(event.body || "{}").id || ""); } catch { return risposta(400, "JSON non valido"); }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return risposta(400, "Ordine non valido");

  // 1. segno l'ordine come avvisato (solo se non lo era): così ogni ordine manda le email una volta sola
  const presa = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/ordini?id=eq.${id}&avvisato=eq.false&creato=gt.${encodeURIComponent(new Date(Date.now() - 3600e3).toISOString())}&select=*,botteghe(nome,utente,telefono)`, {
    method: "PATCH", headers: intestazioni(chiave, { Prefer: "return=representation" }), body: JSON.stringify({ avvisato: true }),
  }).catch(() => null);
  if (!presa || !presa.ok) return risposta(502, "Database non raggiungibile");
  const [o] = await presa.json();
  if (!o) return risposta(200, "Già avvisato");
  const b = o.botteghe || {};

  // 2. email del produttore (da Supabase Auth)
  const u = await fetch(`${ORTALY_SUPABASE_URL}/auth/v1/admin/users/${b.utente}`, { headers: intestazioni(chiave) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const emailProduttore = u && u.email;

  const { righe, html: lista } = riepilogo(o);
  const consegna = `${MODI[o.modo] || o.modo}${o.indirizzo ? ` — ${o.indirizzo}` : ""}`;
  let inviate = 0;

  if (emailValida(emailProduttore)) {
    const testo = [`Nuovo ordine ${o.codice} da ${o.cliente_nome}`, "", ...righe, `Totale prodotti: ${euro(o.totale)}`, "", `Come: ${consegna}`,
      `Telefono del cliente: ${o.cliente_telefono}`, o.nota ? `Nota: ${o.nota}` : "", "", `Accettalo dall'app: ${SITO}/#vendo`].filter((x) => x !== "").join("\n");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 6px">Nuovo ordine da ${esc(o.cliente_nome)}</h2><p style="margin:0;color:#5d6a57">Ordine ${esc(o.codice)} · ${esc(b.nome)}</p>${lista}
      <p style="margin:4px 0"><b>Come:</b> ${esc(consegna)}</p><p style="margin:4px 0"><b>Telefono del cliente:</b> ${esc(o.cliente_telefono)}</p>
      ${o.nota ? `<p style="margin:4px 0"><b>Nota:</b> ${esc(o.nota)}</p>` : ""}
      <p style="margin:18px 0"><a href="${SITO}/#vendo" style="background:#3c6a2c;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Apri i tuoi ordini</a></p>
      <p style="color:#5d6a57;font-size:13px">Il cliente paga a te alla consegna o al ritiro. Chiamalo o scrivigli per confermare giorno e ora.</p></div>`;
    if (await manda(resend, emailProduttore, `Nuovo ordine da ${o.cliente_nome} · Ortaly`, html, testo, emailValida(o.cliente_email) ? o.cliente_email : undefined)) inviate++;
  }

  if (emailValida(o.cliente_email)) {
    const testo = [`Il tuo ordine ${o.codice} è arrivato a ${b.nome}.`, "", ...righe, `Totale prodotti: ${euro(o.totale)}`, "", `Come: ${consegna}`,
      `Telefono del produttore: ${b.telefono}`, "", "Il produttore ti contatta per confermare. Paghi a lui alla consegna o al ritiro."].join("\n");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 6px">Ordine inviato a ${esc(b.nome)}</h2><p style="margin:0;color:#5d6a57">Codice ${esc(o.codice)}</p>${lista}
      <p style="margin:4px 0"><b>Come:</b> ${esc(consegna)}</p><p style="margin:4px 0"><b>Telefono del produttore:</b> ${esc(b.telefono)}</p>
      <p style="color:#5d6a57;font-size:13px">Il produttore ti contatta per confermare giorno e ora. Paghi a lui alla consegna o al ritiro.</p></div>`;
    if (await manda(resend, o.cliente_email, `Ordine ${o.codice} inviato a ${b.nome} · Ortaly`, html, testo, emailValida(emailProduttore) ? emailProduttore : undefined)) inviate++;
  }
  return risposta(200, `Email inviate: ${inviate}`);
};
