// Ortaly — dopo un ordine il telefono del cliente chiama qui con l'id dell'ordine.
// Mando l'email al produttore (e al cliente, se ha lasciato l'email, con il link segreto del suo ordine) e la notifica sui telefoni del produttore.
// Nessun telefono o indirizzo email passa tra cliente e produttore: si scrivono nella chat dell'ordine.
// Ogni ordine si avvisa una volta sola: prima segno «avvisato» nel database, poi scrivo; un secondo invio per lo stesso ordine non fa nulla.
// Variabili su Netlify: ORTALY_SUPABASE_SECRET (chiave segreta del progetto Supabase di Ortaly), RESEND_API_KEY (c'è già).
// indirizzo del progetto Supabase di Ortaly (lo stesso scritto in public/ortaly/index.html)
const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";

const SITO = "https://ortaly.it";
const { notificaBottega } = require("./ortaly-push-chiave.js");
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

// email: prima da avvisi@ortaly.it; se Resend non ha ancora verificato ortaly.it, riprova dal dominio già verificato
const MITTENTI = [process.env.ORTALY_MITTENTE, "Ortaly <avvisi@ortaly.it>", "Ortaly <avvisi@eyedrones.it>"].filter(Boolean);
async function manda(chiaveResend, a, oggetto, html, testo, replyTo) {
  for (const from of MITTENTI) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiaveResend}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [a], subject: oggetto, html, text: testo, ...(replyTo ? { reply_to: replyTo } : {}) }),
    }).catch(() => null);
    if (r && r.ok) return true;
    const dettaglio = r ? (await r.text().catch(() => "")).slice(0, 300) : "rete";
    console.error("Resend ha rifiutato l'email da", from, ":", r && r.status, dettaglio);
    if (!r || !(r.status === 403 || r.status === 422)) return false; // solo un dominio non verificato fa riprovare
  }
  return false;
}

function riepilogo(o) {
  const righe = (o.righe || []).map((r) => `${r.qta} × ${r.nome} (${r.unita}) — ${euro(r.prezzo * r.qta)}`);
  const spese = Number(o.spese) || 0;
  if (o.modo !== "ritiro") righe.push(spese ? `Consegna: ${euro(spese)}` : "Consegna: inclusa");
  return { righe, html: `<ul style="padding-left:18px;margin:8px 0">${righe.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p style="margin:4px 0"><b>Totale: ${esc(euro(o.totale))}</b></p>` };
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
  const presa = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/ordini?id=eq.${id}&avvisato=eq.false&creato=gt.${encodeURIComponent(new Date(Date.now() - 3600e3).toISOString())}&select=*,botteghe(nome,utente,link_pagamento)`, {
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

  const linkCliente = `${SITO}/#ordine-${o.segreto}`;
  // pagamento online: il link per pagare arriva al cliente quando il produttore accetta (vedi ortaly-stato)
  const pagaTesto = o.pagamento === "online" ? "Pagamento: online, prima della consegna" : "Pagamento: alla consegna o al ritiro";
  // iscritto alle novità? allora nell'email metto il link per togliersi
  const iscr = emailValida(o.cliente_email) ? await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/novita?email=eq.${encodeURIComponent(String(o.cliente_email).trim().toLowerCase())}&disiscritto=is.null&select=token`, { headers: intestazioni(chiave) })
    .then((r) => (r.ok ? r.json() : [])).catch(() => []) : [];
  const linkVia = iscr[0] && /^[0-9a-f]{64}$/.test(iscr[0].token) ? `${SITO}/#disiscrivi-${iscr[0].token}` : null;
  if (emailValida(emailProduttore)) {
    const testo = [`Nuovo ordine ${o.codice} da ${o.cliente_nome}`, "", ...righe, `Totale: ${euro(o.totale)}`, "", `Come: ${consegna}`,
      o.nota ? `Nota: ${o.nota}` : "", pagaTesto + (o.pagamento === "online" ? " (il cliente paga dopo che accetti: controlla di averlo ricevuto e segnalo come pagato nell'app)" : ""), "", `Accettalo e scrivi al cliente dall'app: ${SITO}/#vendo`].filter((x) => x !== "").join("\n");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 6px">Nuovo ordine da ${esc(o.cliente_nome)}</h2><p style="margin:0;color:#5d6a57">Ordine ${esc(o.codice)} · ${esc(b.nome)}</p>${lista}
      <p style="margin:4px 0"><b>Come:</b> ${esc(consegna)}</p>
      ${o.nota ? `<p style="margin:4px 0"><b>Nota:</b> ${esc(o.nota)}</p>` : ""}
      <p style="margin:4px 0"><b>${esc(pagaTesto)}</b>${o.pagamento === "online" ? " — controlla di averlo ricevuto e segnalo come pagato nell'app" : ""}</p>
      <p style="margin:18px 0"><a href="${SITO}/#vendo" style="background:#3c6a2c;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Apri l'ordine</a></p>
      <p style="color:#5d6a57;font-size:13px">Accettalo e mettiti d'accordo con il cliente su giorno e ora nella chat dell'ordine. Il cliente paga a te alla consegna o al ritiro.</p></div>`;
    if (await manda(resend, emailProduttore, `Nuovo ordine da ${o.cliente_nome} · Ortaly`, html, testo)) inviate++;
  }

  if (emailValida(o.cliente_email)) {
    const testo = [`Il tuo ordine ${o.codice} è arrivato a ${b.nome}.`, "", ...righe, `Totale: ${euro(o.totale)}`, "", `Come: ${consegna}`,
      "", ...(o.pagamento === "online" ? ["Paghi online: quando il produttore accetta l'ordine ti mandiamo il link per pagare.", ""] : []), `Segui l'ordine e scrivi al produttore: ${linkCliente}`, "", o.pagamento === "online" ? "Paghi direttamente al produttore con il suo link di pagamento." : "Paghi al produttore alla consegna o al ritiro.",
      ...(linkVia ? ["", "Ti sei iscritto a ricette, promozioni e novità di stagione. Per toglierti: " + linkVia] : [])].join("\n");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 6px">Ordine inviato a ${esc(b.nome)}</h2><p style="margin:0;color:#5d6a57">Codice ${esc(o.codice)}</p>${lista}
      <p style="margin:4px 0"><b>Come:</b> ${esc(consegna)}</p>
      ${o.pagamento === "online" ? `<p style="margin:8px 0;color:#5d6a57">💳 Paghi online: quando il produttore accetta l'ordine ti mandiamo il link per pagare.</p>` : ""}
      <p style="margin:18px 0"><a href="${linkCliente}" style="background:#3c6a2c;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Segui l'ordine e scrivi al produttore</a></p>
      <p style="color:#5d6a57;font-size:13px">Conserva questa email: il link è solo tuo. Il produttore ti risponde lì per giorno e ora.${o.pagamento === "online" ? "" : " Paghi a lui alla consegna o al ritiro."}</p>
      ${linkVia ? `<p style="color:#5d6a57;font-size:12px">Ti sei iscritto a ricette, promozioni e novità di stagione. <a href="${linkVia}" style="color:#5d6a57">Non le voglio più</a></p>` : ""}</div>`;
    if (await manda(resend, o.cliente_email, `Ordine ${o.codice} inviato a ${b.nome} · Ortaly`, html, testo)) inviate++;
  }
  const telefoni = await notificaBottega({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, bottega: o.bottega,
    messaggio: { titolo: `Nuovo ordine da ${String(o.cliente_nome).slice(0, 40)}`, testo: `${(o.righe || []).length} prodotti · ${euro(o.totale)} · tocca per accettarlo`, url: "/#vendo" } });
  // pulizia: gli ordini più vecchi di 24 mesi si cancellano (come scritto nell'informativa privacy)
  await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/ordini?creato=lt.${encodeURIComponent(new Date(Date.now() - 730 * 864e5).toISOString())}`, { method: "DELETE", headers: intestazioni(chiave) }).catch(() => null);
  return risposta(200, `Email inviate: ${inviate}, notifiche: ${telefoni}`);
};
