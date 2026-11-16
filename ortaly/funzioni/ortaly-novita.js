// Ortaly — iscrizione a «ricette e cosa c'è di stagione» senza fare un ordine.
// Il telefono manda email e provincia; io salvo l'iscrizione «da confermare» e mando un'email con il link di conferma
// (ortaly.it/#conferma-<token>): finché non lo tocca non riceve niente, così nessuno può iscrivere l'email di un altro.
// Al massimo un'email di conferma all'ora per indirizzo. Chi è già iscritto e confermato non riceve niente.
// Variabili su Netlify: ORTALY_SUPABASE_SECRET, RESEND_API_KEY. Da eseguire prima: supabase/ortaly-stagione.sql.
const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";
const SITO = "https://ortaly.it";

const risposta = (code, msg) => ({ statusCode: code, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify({ messaggio: msg }) });
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const emailValida = (e) => typeof e === "string" && e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

function intestazioni(chiave, extra = {}) {
  const h = { apikey: chiave, "Content-Type": "application/json", ...extra };
  if (chiave.startsWith("eyJ")) h.Authorization = `Bearer ${chiave}`;
  return h;
}

const MITTENTI = [process.env.ORTALY_MITTENTE, "Ortaly <avvisi@ortaly.it>", "Ortaly <avvisi@eyedrones.it>"].filter(Boolean);
async function manda(chiaveResend, a, oggetto, html, testo) {
  for (const from of MITTENTI) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiaveResend}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [a], subject: oggetto, html, text: testo, reply_to: "info@ortaly.it" }),
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
  if (!chiave || !resend) return risposta(500, "Iscrizione non disponibile in questo momento");
  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return risposta(400, "Richiesta non valida"); }
  const email = String(dati.email || "").trim().toLowerCase();
  const provincia = /^[A-Z]{2}$/.test(String(dati.provincia || "")) ? dati.provincia : null;
  if (!emailValida(email)) return risposta(400, "Controlla l'email");

  const h = intestazioni(chiave);
  const g = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/novita?email=eq.${encodeURIComponent(email)}&select=id,token,confermato,disiscritto,conferma_inviata`, { headers: h }).catch(() => null);
  if (!g || !g.ok) return risposta(500, "Iscrizione non disponibile in questo momento");
  const [riga] = await g.json();

  if (riga && riga.confermato && !riga.disiscritto) {
    if (provincia) await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/novita?id=eq.${riga.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ provincia }) }).catch(() => null);
    return risposta(200, "Sei già iscritto: ti scriviamo noi due volte al mese 🍅");
  }
  if (riga && riga.conferma_inviata && Date.now() - new Date(riga.conferma_inviata).getTime() < 3600e3) {
    return risposta(200, "Ti abbiamo già mandato l'email di conferma: controlla anche nella posta indesiderata.");
  }

  let token = riga && riga.token;
  const ora = new Date().toISOString();
  if (riga) {
    // ex iscritto che torna, o iscrizione mai confermata: da confermare di nuovo
    await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/novita?id=eq.${riga.id}`, { method: "PATCH", headers: h, body: JSON.stringify({ confermato: false, conferma_inviata: ora, ...(provincia ? { provincia } : {}) }) }).catch(() => null);
  } else {
    const n = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/novita?select=token`, {
      method: "POST", headers: intestazioni(chiave, { Prefer: "return=representation" }),
      body: JSON.stringify({ email, provincia, confermato: false, conferma_inviata: ora }),
    }).catch(() => null);
    if (!n || !n.ok) return risposta(500, "Iscrizione non disponibile in questo momento");
    token = (await n.json())[0].token;
  }

  const link = `${SITO}/#conferma-${token}`;
  const oggetto = "Conferma: ricette e cosa c'è di stagione 🍅";
  const testo = `Ciao!\n\nPer ricevere da Ortaly le ricette e cosa c'è di stagione dai produttori della tua zona, conferma da qui:\n${link}\n\nSe non sei stato tu, ignora questa email: non riceverai niente.\n\nOrtaly · dal produttore a te`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0f2a24">
    <h2 style="color:#047857;margin:0 0 12px">🍅 Manca solo un tocco</h2>
    <p style="font-size:15px">Per ricevere da <b>Ortaly</b> le ricette e cosa c'è di stagione dai produttori della tua zona, conferma qui:</p>
    <p><a href="${esc(link)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold;font-size:16px">Confermo l'iscrizione ›</a></p>
    <p style="font-size:13px;color:#4a675e">Se non sei stato tu, ignora questa email: non riceverai niente.</p>
    <p style="font-size:13px;color:#4a675e">Ortaly · dal produttore a te</p></div>`;
  const ok = await manda(resend, email, oggetto, html, testo);
  if (!ok) return risposta(500, "Non riesco a mandarti l'email adesso: riprova tra poco.");
  return risposta(200, "Ti abbiamo mandato un'email: tocca il link per confermare.");
};
