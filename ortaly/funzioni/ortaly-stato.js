// Ortaly — il produttore ha cambiato lo stato di un ordine (accettato, pronto, consegnato, annullato):
// avviso il cliente con la notifica sul telefono (se l'ha attivata) e con un'email.
// Se l'ha annullato il cliente, avviso invece il produttore.
// Ogni stato si avvisa una volta sola: confronto con «stato_avvisato» e lo aggiorno prima di scrivere.
const { notificaCliente, notificaBottega } = require("./ortaly-push-chiave.js");

const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";
const SITO = "https://ortaly.it";
const MITTENTI = [process.env.ORTALY_MITTENTE, "Ortaly <avvisi@ortaly.it>", "Ortaly <avvisi@eyedrones.it>"].filter(Boolean);
const TESTI = {
  accettato: ["ha accettato il tuo ordine", "Il produttore lo prepara: mettetevi d'accordo su giorno e ora nella chat."],
  pronto: ["ha preparato il tuo ordine", "È pronto: controlla nella chat quando passare o quando arriva."],
  consegnato: ["ha segnato il tuo ordine come consegnato", "Buon appetito! Se qualcosa non va, scrivi al produttore nella chat."],
  non_ritirato: ["ha segnato il tuo ordine come non ritirato", "Se è un errore, scrivi al produttore nella chat o a info@ortaly.it: chi non ritira più ordini non può più ordinare su Ortaly."],
  annullato: ["non può preparare il tuo ordine", "L'ordine è annullato: nella chat trovi il motivo, se il produttore l'ha scritto."],
};

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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const chiave = process.env.ORTALY_SUPABASE_SECRET, resend = process.env.RESEND_API_KEY;
  if (!chiave) return risposta(500, "Manca ORTALY_SUPABASE_SECRET");

  let id;
  try { id = String(JSON.parse(event.body || "{}").id || ""); } catch { return risposta(400, "JSON non valido"); }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return risposta(400, "Ordine non valido");

  const r = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/ordini?id=eq.${id}&select=stato,stato_avvisato`, { headers: intestazioni(chiave) }).catch(() => null);
  if (!r || !r.ok) return risposta(502, "Database non raggiungibile");
  const [ora] = await r.json();
  if (!ora || ora.stato === ora.stato_avvisato || !TESTI[ora.stato]) return risposta(200, "Niente da avvisare");

  // aggiorno solo se nessun altro l'ha già fatto nel frattempo
  const presa = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/ordini?id=eq.${id}&stato=eq.${ora.stato}&stato_avvisato=eq.${encodeURIComponent(ora.stato_avvisato)}&select=codice,stato,modo,corriere,tracking,cliente_nome,cliente_email,segreto,annullato_da,motivo_annullo,bottega,pagamento,pagato,totale,botteghe(nome,utente,link_pagamento)`, {
    method: "PATCH", headers: intestazioni(chiave, { Prefer: "return=representation" }), body: JSON.stringify({ stato_avvisato: ora.stato }),
  }).catch(() => null);
  const [o] = presa && presa.ok ? await presa.json() : [];
  if (!o) return risposta(200, "Già avvisato");

  const nome = (o.botteghe && o.botteghe.nome) || "Il produttore";
  if (o.stato === "annullato" && o.annullato_da === "cliente") {
    const telefoni = await notificaBottega({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, bottega: o.bottega,
      messaggio: { titolo: `Ordine ${o.codice} annullato dal cliente`, testo: o.motivo_annullo ? `${o.cliente_nome}: «${String(o.motivo_annullo).slice(0, 100)}»` : `${o.cliente_nome} ha annullato l'ordine`, url: "/#vendo" } });
    const u = await fetch(`${ORTALY_SUPABASE_URL}/auth/v1/admin/users/${o.botteghe && o.botteghe.utente}`, { headers: intestazioni(chiave) }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    let inviata = false;
    if (resend && u && emailValida(u.email)) {
      const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
        <h2 style="margin:0 0 6px">${esc(o.cliente_nome)} ha annullato l'ordine ${esc(o.codice)}</h2>
        ${o.motivo_annullo ? `<p style="margin:4px 0">Motivo: «${esc(o.motivo_annullo)}»</p>` : ""}<p style="margin:0;color:#5d6a57">Non serve prepararlo.</p>
        <p style="margin:18px 0"><a href="${SITO}/#vendo" style="background:#047857;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Apri i tuoi ordini</a></p></div>`;
      inviata = await manda(resend, u.email, `Ordine ${o.codice} annullato dal cliente · Ortaly`, html,
        `${o.cliente_nome} ha annullato l'ordine ${o.codice}.${o.motivo_annullo ? `\nMotivo: «${o.motivo_annullo}»` : ""}\nNon serve prepararlo.\n${SITO}/#vendo`);
    }
    return risposta(200, `produttore: notifiche ${telefoni}, email ${inviata ? 1 : 0}`);
  }
  let [cosa, poi] = TESTI[o.stato];
  // spedizione con corriere: «ha spedito il tuo ordine» con il numero per seguire il pacco
  let linkPacco = null;
  if (o.modo === "spedizione" && o.stato === "pronto") {
    cosa = "ha spedito il tuo ordine";
    if (o.tracking) { linkPacco = "https://t.17track.net/it#nums=" + encodeURIComponent(String(o.tracking).replace(/\s+/g, "")); poi = `Corriere ${o.corriere || ""}, numero di spedizione ${o.tracking}.`; }
    else poi = "Il produttore ti scrive nella chat il numero per seguire il pacco.";
  }
  if (o.modo === "spedizione" && o.stato === "consegnato") cosa = "ha segnato il tuo ordine come arrivato";
  // ordine da pagare online: quando il produttore accetta, il cliente riceve il link per pagare
  let linkPaga = null;
  const lp = o.botteghe && o.botteghe.link_pagamento;
  if (o.stato === "accettato" && o.pagamento === "online" && !o.pagato && lp && /^https:\/\/([a-z0-9-]+\.)*(stripe\.com|paypal\.me|paypal\.com|sumup\.com|sumup\.link|satispay\.com|revolut\.me)(\/[^\s<>"]*)?$/i.test(lp)) {
    linkPaga = lp;
    try { const u = new URL(lp); if (/(^|\.)paypal\.me$/i.test(u.hostname) && u.pathname.split("/").filter(Boolean).length === 1) linkPaga = lp.replace(/\/$/, "") + "/" + Number(o.totale).toFixed(2) + "EUR"; } catch {}
    poi = `Ora puoi pagare ${Number(o.totale).toLocaleString("it-IT", { minimumFractionDigits: 2 })} € con il link del produttore (nella causale scrivi ${o.codice}).`;
  }
  const link = `${SITO}/#ordine-${o.segreto}`;
  const telefoni = await notificaCliente({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, ordine: id,
    messaggio: { titolo: `${String(nome).slice(0, 40)} ${cosa}`, testo: `Ordine ${o.codice}: ${poi}`, url: `/#ordine-${o.segreto}` } });

  let inviata = false;
  if (resend && emailValida(o.cliente_email)) {
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 6px">${esc(nome)} ${esc(cosa)}</h2><p style="margin:0;color:#5d6a57">Ordine ${esc(o.codice)}. ${esc(poi)}</p>
      ${linkPacco ? `<p style="margin:18px 0 0"><a href="${esc(linkPacco)}" style="background:#fbbf24;color:#1e2a1d;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:800">📦 Segui il pacco</a></p>` : ""}
      ${linkPaga ? `<p style="margin:18px 0 0"><a href="${esc(linkPaga)}" style="background:#fbbf24;color:#1e2a1d;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:800">💳 Paga ora</a></p>` : ""}
      <p style="margin:18px 0"><a href="${link}" style="background:#047857;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Apri l'ordine e la chat</a></p></div>`;
    inviata = await manda(resend, o.cliente_email, `${nome} ${cosa} · ordine ${o.codice}`, html, `${nome} ${cosa}.\nOrdine ${o.codice}. ${poi}${linkPaga ? `\nPaga ora: ${linkPaga}` : ""}${linkPacco ? `\nSegui il pacco: ${linkPacco}` : ""}\n\nApri l'ordine e la chat: ${link}`);
  }
  return risposta(200, `notifiche ${telefoni}, email ${inviata ? 1 : 0}`);
};
