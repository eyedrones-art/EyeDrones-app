// Ortaly — dopo che un produttore ha creato la sua bottega il telefono chiama qui con l'id della bottega.
// Mando: a Ortaly (ORTALY_ADMIN_EMAIL, di solito info@ortaly.it) «nuovo produttore» con i dati da controllare;
// al produttore «benvenuto» con il link della sua bottega. Una volta sola per produttore: lo segno nei dati
// dell'account (app_metadata.benvenuto), che il produttore non può cambiare.
// Variabili su Netlify: ORTALY_SUPABASE_SECRET, RESEND_API_KEY, ORTALY_ADMIN_EMAIL (facoltativa).
const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";
const ADMIN_PREDEFINITO = "info@ortaly.it";
const SITO = "https://ortaly.it";

const risposta = (code, msg) => ({ statusCode: code, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messaggio: msg }) });
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailValida = (e) => typeof e === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

function intestazioni(chiave, extra = {}) {
  const h = { apikey: chiave, "Content-Type": "application/json", ...extra };
  if (chiave.startsWith("eyJ")) h.Authorization = `Bearer ${chiave}`;
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const chiave = process.env.ORTALY_SUPABASE_SECRET, resend = process.env.RESEND_API_KEY;
  if (!chiave || !resend) return risposta(500, "Mancano ORTALY_SUPABASE_SECRET o RESEND_API_KEY");
  const admin = emailValida(process.env.ORTALY_ADMIN_EMAIL) ? process.env.ORTALY_ADMIN_EMAIL : ADMIN_PREDEFINITO;

  let id;
  try { id = String(JSON.parse(event.body || "{}").id || ""); } catch { return risposta(400, "JSON non valido"); }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return risposta(400, "Bottega non valida");

  // solo botteghe create nell'ultima ora
  const da = encodeURIComponent(new Date(Date.now() - 3600e3).toISOString());
  const rb = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/botteghe?id=eq.${id}&creata=gt.${da}&select=*`, { headers: intestazioni(chiave) }).catch(() => null);
  if (!rb || !rb.ok) return risposta(502, "Database non raggiungibile");
  const [b] = await rb.json();
  if (!b) return risposta(200, "Niente da avvisare");

  // una volta sola per produttore
  const ru = await fetch(`${ORTALY_SUPABASE_URL}/auth/v1/admin/users/${b.utente}`, { headers: intestazioni(chiave) }).catch(() => null);
  const u = ru && ru.ok ? await ru.json() : null;
  if (!u) return risposta(502, "Utente non trovato");
  if (u.app_metadata && u.app_metadata.benvenuto) return risposta(200, "Già avvisato");
  const segna = await fetch(`${ORTALY_SUPABASE_URL}/auth/v1/admin/users/${b.utente}`, {
    method: "PUT", headers: intestazioni(chiave), body: JSON.stringify({ app_metadata: { ...(u.app_metadata || {}), benvenuto: true } }),
  }).catch(() => null);
  if (!segna || !segna.ok) return risposta(502, "Non riesco a segnare l'avviso");

  const link = `${SITO}/#bottega-${b.id}`;
  const prova = new Date(b.prova_fino + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const consegne = [["Consegna a casa", b.consegna_casa], ["Ritiro in azienda", b.ritiro], ["Spedizione", b.spedizione]].filter((x) => x[1]);
  let inviate = 0;

  // a Ortaly: nuovo produttore da controllare
  {
    const righe = [["Bottega", b.nome], ["Dove", `${b.paese} (${b.provincia})`], ["Cosa produce", b.tipo || "—"], ["Email", u.email], ["Telefono", b.telefono],
      ["Partita IVA", b.piva], ["Bio", b.bio ? "sì" : "no"], ...consegne, ["Prova fino al", prova]];
    const testo = [`Nuovo produttore iscritto su Ortaly`, "", ...righe.map(([k, v]) => `${k}: ${v}`), "", `Bottega: ${link}`,
      "Controlla la partita IVA (es. su telemaco o sul sito dell'Agenzia delle Entrate). Per nasconderla: Supabase → Table Editor → botteghe → visibile = false."].join("\n");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 10px">Nuovo produttore: ${esc(b.nome)}</h2>
      <table style="border-collapse:collapse">${righe.map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#5d6a57">${esc(k)}</td><td style="padding:3px 0"><b>${esc(v)}</b></td></tr>`).join("")}</table>
      <p style="margin:18px 0"><a href="${link}" style="background:#047857;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Guarda la bottega</a></p>
      <p style="color:#5d6a57;font-size:13px">Controlla la partita IVA. Per nascondere la bottega: Supabase → Table Editor → botteghe → visibile = false.</p></div>`;
    if (await manda(resend, admin, `Nuovo produttore su Ortaly: ${b.nome}`, html, testo, u.email)) inviate++;
  }

  // al produttore: benvenuto
  if (emailValida(u.email)) {
    const testo = [`Benvenuto su Ortaly, ${b.nome}!`, "", "La tua bottega è aperta: i clienti della tua zona la vedono e possono ordinare.",
      `Il link della tua bottega, da mandare ai tuoi clienti: ${link}`, "", `Primi 3 mesi inclusi, fino al ${prova}. Dopo, 19 € al mese, solo se lo confermi tu.`,
      "", "Quando arriva un ordine ti scriviamo qui. Per qualsiasi cosa rispondi a questa email."].join("\n");
    const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1e2a1d;max-width:560px">
      <h2 style="margin:0 0 8px">Benvenuto su Ortaly, ${esc(b.nome)}!</h2>
      <p style="margin:0 0 10px">La tua bottega è aperta: i clienti della tua zona la vedono e possono ordinare.</p>
      <p style="margin:0 0 6px"><b>Il link della tua bottega</b>, da mandare ai tuoi clienti su WhatsApp o da mettere sul cartello al banco:</p>
      <p style="margin:0 0 16px"><a href="${link}" style="color:#047857;font-weight:700;word-break:break-all">${esc(link)}</a></p>
      <p style="margin:0 0 10px">Primi 3 mesi inclusi, fino al <b>${esc(prova)}</b>. Dopo, 19 € al mese, solo se lo confermi tu.</p>
      <p style="margin:18px 0"><a href="${SITO}/#vendo" style="background:#047857;color:#fff;padding:11px 18px;border-radius:12px;text-decoration:none;font-weight:700">Metti i tuoi prodotti</a></p>
      <p style="color:#5d6a57;font-size:13px">Quando arriva un ordine ti scriviamo qui. Per qualsiasi cosa rispondi a questa email.</p></div>`;
    if (await manda(resend, u.email, "Benvenuto su Ortaly", html, testo, admin)) inviate++;
  }
  return risposta(200, `Email inviate: ${inviate}`);
};
