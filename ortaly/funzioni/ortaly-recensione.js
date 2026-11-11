// Ortaly — il cliente ha lasciato una valutazione o ha segnalato un problema: avviso il produttore
// (notifica sul telefono ed email) e, per le segnalazioni, anche Ortaly (ORTALY_ADMIN_EMAIL, predefinito info@ortaly.it).
// Ogni valutazione/segnalazione si avvisa una volta sola (colonna «avvisato»).
const { notificaBottega } = require("./ortaly-push-chiave.js");

const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";
const SITO = "https://ortaly.it";
const MITTENTI = [process.env.ORTALY_MITTENTE, "Ortaly <avvisi@ortaly.it>", "Ortaly <avvisi@eyedrones.it>"].filter(Boolean);
const TIPI = { mancava: "Mancava qualcosa", qualita: "Qualità non buona", ritardo: "Ritardo o consegna", quantita: "Quantità o peso sbagliati", altro: "Altro" };

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
const pagina = (titolo, righe, href, bottone) => `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
  <h2 style="margin:0 0 8px">${esc(titolo)}</h2>${righe.filter(Boolean).map((r) => `<p style="margin:4px 0">${r}</p>`).join("")}
  <p style="margin:18px 0"><a href="${href}" style="background:#047857;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">${esc(bottone)}</a></p></div>`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const chiave = process.env.ORTALY_SUPABASE_SECRET, resend = process.env.RESEND_API_KEY;
  if (!chiave) return risposta(500, "Manca ORTALY_SUPABASE_SECRET");
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return risposta(400, "JSON non valido"); }
  const id = String(d.id || ""), tipo = d.tipo === "problema" ? "segnalazioni" : "recensioni";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return risposta(400, "Non valido");
  const admin = emailValida(process.env.ORTALY_ADMIN_EMAIL) ? process.env.ORTALY_ADMIN_EMAIL : "info@ortaly.it";

  // il produttore segnala una valutazione che gli sembra falsa: email a Ortaly, una volta sola
  if (d.tipo === "contesta") {
    const c = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/recensioni?id=eq.${id}&contestata=eq.true&contestata_avvisata=eq.false&select=id,stelle,commento,nome,ordini(codice,cliente_nome,cliente_email,botteghe(nome))`, {
      method: "PATCH", headers: intestazioni(chiave, { Prefer: "return=representation" }), body: JSON.stringify({ contestata_avvisata: true }),
    }).catch(() => null);
    const [x] = c && c.ok ? await c.json() : [];
    if (!x) return risposta(200, "Già avvisato");
    const o = x.ordini || {}, nb = (o.botteghe || {}).nome;
    const righe = [`${"★".repeat(x.stelle)}${"☆".repeat(5 - x.stelle)} da <b>${esc(x.nome)}</b>`, x.commento ? `«${esc(x.commento)}»` : "",
      `Ordine ${esc(o.codice)} di ${esc(o.cliente_nome)} (${esc(o.cliente_email)}) · bottega ${esc(nb)}`,
      `Per nasconderla: Supabase Ortaly → Table Editor → recensioni → riga con id ${esc(x.id)} → nascosta = true.`];
    const ok = resend && await manda(resend, admin, `Valutazione contestata da ${nb}`, pagina(`${nb} segnala una valutazione come falsa`, righe, SITO, "Apri Ortaly"),
      `${nb} segnala come falsa la valutazione di ${x.nome} (${x.stelle} stelle)${x.commento ? `: «${x.commento}»` : ""}\nOrdine ${o.codice} di ${o.cliente_nome} (${o.cliente_email})\nPer nasconderla: Supabase → recensioni → id ${x.id} → nascosta = true`);
    return risposta(200, `email ${ok ? 1 : 0}`);
  }

  const recente = encodeURIComponent(new Date(Date.now() - 15 * 60e3).toISOString());
  const campi = tipo === "recensioni" ? "id,stelle,commento,nome,ordini(codice,bottega,botteghe(nome,utente))" : "id,tipo,testo,ordini(codice,cliente_nome,bottega,botteghe(nome,utente))";
  const presa = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/${tipo}?id=eq.${id}&avvisato=eq.false&creata=gt.${recente}&select=${campi}`, {
    method: "PATCH", headers: intestazioni(chiave, { Prefer: "return=representation" }), body: JSON.stringify({ avvisato: true }),
  }).catch(() => null);
  if (!presa || !presa.ok) return risposta(502, "Database non raggiungibile");
  const [x] = await presa.json();
  if (!x) return risposta(200, "Già avvisato");
  const o = x.ordini || {}, b = o.botteghe || {};
  const u = await fetch(`${ORTALY_SUPABASE_URL}/auth/v1/admin/users/${b.utente}`, { headers: intestazioni(chiave) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const emailProduttore = u && u.email;
  let email = 0;

  if (tipo === "recensioni") {
    const stelle = "★".repeat(x.stelle) + "☆".repeat(5 - x.stelle);
    const telefoni = await notificaBottega({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, bottega: o.bottega,
      messaggio: { titolo: `Nuova valutazione ${stelle}`, testo: x.commento ? `${x.nome}: «${String(x.commento).slice(0, 100)}»` : `Da ${x.nome}, ordine ${o.codice}`, url: "/#vendo" } });
    if (resend && emailValida(emailProduttore) && await manda(resend, emailProduttore, `Nuova valutazione ${stelle} · Ortaly`,
      pagina(`${x.nome} ti ha dato ${x.stelle} ${x.stelle === 1 ? "stella" : "stelle"}`, [esc(stelle), x.commento ? `«${esc(x.commento)}»` : "", `Ordine ${esc(o.codice)}. Puoi rispondere: la risposta la vedono tutti nella tua bottega.`], `${SITO}/#vendo`, "Leggi e rispondi"),
      `${x.nome} ti ha dato ${x.stelle} stelle sull'ordine ${o.codice}.${x.commento ? `\n«${x.commento}»` : ""}\nRispondi: ${SITO}/#vendo`)) email++;
    return risposta(200, `notifiche ${telefoni}, email ${email}`);
  }

  const motivo = TIPI[x.tipo] || x.tipo;
  const telefoni = await notificaBottega({ supabaseUrl: ORTALY_SUPABASE_URL, chiave, intestazioni, bottega: o.bottega,
    messaggio: { titolo: `Segnalazione sull'ordine ${o.codice}`, testo: `${motivo}: tocca per leggere e scrivere al cliente`, url: "/#vendo" } });
  const righe = [`<b>${esc(motivo)}</b>`, `«${esc(x.testo)}»`, `Ordine ${esc(o.codice)} di ${esc(o.cliente_nome)} · bottega ${esc(b.nome)}`];
  const testo = `${motivo}\n«${x.testo}»\nOrdine ${o.codice} di ${o.cliente_nome} · bottega ${b.nome}`;
  if (resend && emailValida(emailProduttore) && await manda(resend, emailProduttore, `Segnalazione sull'ordine ${o.codice} · Ortaly`,
    pagina("Un cliente ha segnalato un problema", [...righe, "Scrivigli nella chat dell'ordine per sistemare: una risposta veloce evita una valutazione negativa."], `${SITO}/#vendo`, "Apri l'ordine"),
    `${testo}\nScrivigli nella chat dell'ordine: ${SITO}/#vendo`)) email++;
  if (resend && await manda(resend, admin, `Segnalazione: ${motivo} · ${b.nome}`,
    pagina(`Segnalazione su ${b.nome}`, righe, `${SITO}/#vendo`, "Apri Ortaly"), testo)) email++;
  return risposta(200, `notifiche ${telefoni}, email ${email}`);
};
