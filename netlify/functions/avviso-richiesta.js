// Eyedrones — email al pilota quando un cliente gli chiede un preventivo dalla pagina pubblica.
// La chiama il database (script supabase/avviso-richieste-email.sql) a ogni nuova richiesta.
// Variabili su Netlify (Site configuration → Environment variables):
//   RESEND_API_KEY   chiave di Resend (resend.com → API Keys)
//   AVVISO_SEGRETO   il codice mostrato alla fine dello script SQL
//   AVVISO_MITTENTE  facoltativa, es. "Eyedrones <avvisi@eyedrones.it>" (il dominio va verificato su Resend)
const crypto = require("crypto");

const APP_URL = "https://app.eyedrones.it";
const MITTENTE_PREDEFINITO = "Eyedrones <avvisi@eyedrones.it>";

const risposta = (statusCode, testo) => ({ statusCode, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: testo });

function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

const pulisci = (v, max = 300) => String(v == null ? "" : v).replace(/[\r\n]+/g, " ").trim().slice(0, max);
const html = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const emailValida = (v) => /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(String(v || ""));

function dataItaliana(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function numeroWhatsapp(v) {
  let n = String(v || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  if (/^3\d{8,9}$/.test(n)) n = "39" + n;
  return n.length >= 8 ? n : null;
}

// testo e HTML dell'email (separati dall'invio, così si possono provare da soli)
function componiEmail(r) {
  const nome = pulisci(r.nome, 80) || "Un cliente";
  const servizio = pulisci(r.servizio, 80);
  const luogo = pulisci(r.luogo, 120);
  const quando = dataItaliana(r.data_desiderata);
  const descrizione = String(r.descrizione || "").trim().slice(0, 2000);
  const email = emailValida(r.email) ? pulisci(r.email, 120) : "";
  const telefono = pulisci(r.telefono, 30);
  const wa = numeroWhatsapp(telefono);
  const linkApp = `${APP_URL}/?vai=richieste`;

  const oggetto = `Nuova richiesta di preventivo da ${nome}${servizio ? ` · ${servizio}` : ""}`;

  const righe = [
    servizio && ["Servizio", servizio],
    luogo && ["Dove", luogo],
    quando && ["Quando", quando],
    telefono && ["Telefono", telefono],
    email && ["Email", email],
  ].filter(Boolean);

  const testo = [
    `Ciao${r.pilota_nome ? ` ${pulisci(r.pilota_nome, 80)}` : ""},`,
    "",
    `${nome} ti ha chiesto un preventivo dalla tua pagina Eyedrones.`,
    "",
    ...righe.map(([k, v]) => `${k}: ${v}`),
    ...(descrizione ? ["", descrizione] : []),
    "",
    email ? "Rispondi a questa email per scrivere direttamente al cliente." : "Contatta il cliente al telefono indicato.",
    `Oppure apri la richiesta su Eyedrones e crea il preventivo: ${linkApp}`,
  ].join("\n");

  const bottone = (href, etichetta, principale) =>
    `<a href="${html(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none;${principale ? "background:#ff8c42;color:#161a1f;" : "background:#eef0f3;color:#1d232b;"}">${html(etichetta)}</a>`;

  const corpo = `<!doctype html>
<html lang="it"><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d232b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e6ea;">
<tr><td style="background:linear-gradient(90deg,#7e3af2,#ff8c42);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:24px 24px 8px 24px;">
  <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#e0552f;">Nuova richiesta di preventivo</div>
  <h1 style="font-size:21px;line-height:1.3;margin:6px 0 4px 0;">${html(nome)}</h1>
  <p style="font-size:14px;color:#5b6572;margin:0;">ti ha scritto dalla tua pagina Eyedrones.</p>
</td></tr>
<tr><td style="padding:12px 24px 4px 24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">
    ${righe.map(([k, v]) => `<tr><td style="padding:5px 12px 5px 0;color:#8b95a3;white-space:nowrap;vertical-align:top;">${html(k)}</td><td style="padding:5px 0;font-weight:600;">${html(v)}</td></tr>`).join("")}
  </table>
  ${descrizione ? `<div style="margin:12px 0 0 0;padding:12px 14px;background:#f6f7f9;border-radius:8px;font-size:14px;line-height:1.55;white-space:pre-wrap;">${html(descrizione)}</div>` : ""}
</td></tr>
<tr><td style="padding:16px 24px 8px 24px;">
  ${bottone(linkApp, "Crea il preventivo", true)}
  ${wa ? bottone(`https://wa.me/${wa}?text=${encodeURIComponent(`Ciao ${nome}, ti scrivo per la tua richiesta${servizio ? ` di ${servizio.toLowerCase()}` : ""}.`)}`, "Scrivi su WhatsApp", false) : ""}
  ${telefono && !wa ? bottone(`tel:${telefono.replace(/[^\d+]/g, "")}`, "Chiama", false) : ""}
</td></tr>
<tr><td style="padding:0 24px 22px 24px;font-size:12.5px;color:#8b95a3;line-height:1.5;">
  ${email ? "Puoi anche rispondere direttamente a questa email: arriva al cliente." : "Il cliente non ha lasciato un'email: contattalo al telefono."}<br>
  Rispondere entro poche ore aumenta molto le probabilità di ottenere il lavoro.
</td></tr>
</table>
<p style="font-size:11.5px;color:#9aa4b2;margin:14px 0 0 0;">Ricevi questo avviso perché hai una pagina pubblica su Eyedrones. Puoi spegnerlo da «La mia pagina».</p>
</td></tr></table>
</body></html>`;

  return { oggetto, testo, html: corpo, replyTo: email || null };
}

exports.componiEmail = componiEmail;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const segreto = process.env.AVVISO_SEGRETO;
  const chiave = process.env.RESEND_API_KEY;
  if (!segreto || !chiave) return risposta(500, "Mancano AVVISO_SEGRETO o RESEND_API_KEY nelle variabili di Netlify");
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], segreto)) return risposta(401, "Non autorizzato");

  let r;
  try { r = JSON.parse(event.body || "{}"); } catch (e) { return risposta(400, "JSON non valido"); }
  if (!emailValida(r.pilota_email)) return risposta(400, "Email del pilota mancante");

  const m = componiEmail(r);
  const invio = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.AVVISO_MITTENTE || MITTENTE_PREDEFINITO,
      to: [r.pilota_email],
      subject: m.oggetto,
      html: m.html,
      text: m.testo,
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
    }),
  });
  if (!invio.ok) {
    const dettaglio = await invio.text().catch(() => "");
    console.error("Resend ha rifiutato l'email:", invio.status, dettaglio.slice(0, 500));
    return risposta(502, "Invio non riuscito");
  }
  return risposta(200, "Inviata");
};
