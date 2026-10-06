// EyeDrones — promemoria via email delle scadenze (attestati, assicurazione, manutenzioni, abbonamento D-Flight)
// e riepilogo giornaliero per l'amministratore (errori dell'app, spazio usato).
// La chiama ogni mattina il database (script supabase/errori-spazio-promemoria.sql) con l'elenco già pronto.
// È una funzione «background»: Netlify risponde subito e lei ha fino a 15 minuti per mandare le email.
// Variabili su Netlify (le stesse dell'avviso delle richieste):
//   RESEND_API_KEY   chiave di Resend
//   AVVISO_SEGRETO   il codice mostrato alla fine dello script SQL
//   AVVISO_MITTENTE  facoltativa, es. "EyeDrones <avvisi@eyedrones.it>"
const crypto = require("crypto");

const APP_URL = "https://app.eyedrones.it";
const MITTENTE_PREDEFINITO = "EyeDrones <avvisi@eyedrones.it>";
const LIMITE_STORAGE_BYTE = 1024 * 1024 * 1024; // 1 GB del piano gratuito di Supabase

function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
const html = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const emailValida = (v) => /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(String(v || ""));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
function dataItaliana(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}
const quando = (g) => (g <= 0 ? "scade oggi" : g === 1 ? "scade domani" : `scade tra ${g} giorni`);

function emailUtente(u) {
  const voci = (u.voci || []).slice(0, 20);
  const prima = voci[0];
  const oggetto = voci.length === 1 ? `⏰ ${prima.titolo}: ${quando(prima.giorni)}` : `⏰ ${voci.length} scadenze EyeDrones in arrivo`;
  const righeTesto = voci.map((v) => `• ${v.titolo} — ${quando(v.giorni)} (${dataItaliana(v.data)})`);
  const testo = [
    `Ciao${u.nome ? ` ${u.nome}` : ""},`, "",
    "ti ricordiamo queste scadenze:", ...righeTesto, "",
    "Rinnova in tempo per volare in regola e avere i documenti a posto in caso di controllo.",
    `Aggiorna le date in EyeDrones: ${APP_URL}`, "",
    "Non vuoi più questi promemoria? Spegnili in EyeDrones → Impostazioni.",
  ].join("\n");
  const righeHtml = voci.map((v) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px">${html(v.titolo)}</td><td style="padding:8px 0 8px 12px;border-bottom:1px solid #eee;font-size:14px;color:${v.giorni <= 7 ? "#c0392b" : "#b9770e"};font-weight:600;white-space:nowrap">${html(quando(v.giorni))}<br><span style="color:#777;font-weight:400">${html(dataItaliana(v.data))}</span></td></tr>`).join("");
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#222">
    <h2 style="color:#e0552f;margin:0 0 12px">⏰ Scadenze in arrivo</h2>
    <p style="font-size:15px">Ciao${u.nome ? ` ${html(u.nome)}` : ""}, ti ricordiamo queste scadenze:</p>
    <table style="width:100%;border-collapse:collapse">${righeHtml}</table>
    <p style="font-size:14px;color:#444">Rinnova in tempo per volare in regola e avere i documenti a posto in caso di controllo.</p>
    <p><a href="${APP_URL}" style="display:inline-block;background:#e0552f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">Apri EyeDrones</a></p>
    <p style="font-size:12px;color:#888">Non vuoi più questi promemoria? Spegnili in EyeDrones → Impostazioni.</p>
  </div>`;
  return { oggetto, testo, corpo };
}

function emailAmministratore(a) {
  const e = a.errori || { quanti: 0, esempi: [] };
  const mb = a.spazio_byte != null ? Math.round(a.spazio_byte / 1048576) : null;
  const perc = a.spazio_byte != null ? Math.round((a.spazio_byte / LIMITE_STORAGE_BYTE) * 100) : null;
  const oggetto = `EyeDrones · ieri ${e.quanti} ${e.quanti === 1 ? "errore" : "errori"}${mb != null ? ` · spazio ${mb} MB (${perc}%)` : ""}`;
  const righe = (e.esempi || []).map((x) => `• [${x.pagina || "?"}] ${x.messaggio} (${x.volte}×)`);
  const testo = [
    `Errori nelle ultime 24 ore: ${e.quanti}`, ...righe, "",
    mb != null ? `Spazio usato su Supabase: ${mb} MB su 1024 (${perc}%)${perc >= 80 ? " — è ora di passare a Supabase Pro o liberare spazio" : ""}` : "",
    "", "Il dettaglio è in Supabase → Table editor → errori_app.",
  ].join("\n");
  const corpo = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222"><pre style="white-space:pre-wrap;font-size:13px">${html(testo)}</pre></div>`;
  return { oggetto, testo, corpo };
}

async function invia(chiave, mittente, a, { oggetto, testo, corpo }) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: mittente, to: [a], subject: oggetto, text: testo, html: corpo }),
  });
  if (!r.ok) console.error("invio non riuscito", a, r.status, (await r.text()).slice(0, 200));
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], process.env.AVVISO_SEGRETO)) return { statusCode: 401 };
  const chiave = process.env.RESEND_API_KEY;
  if (!chiave) { console.error("manca RESEND_API_KEY"); return { statusCode: 500 }; }
  const mittente = process.env.AVVISO_MITTENTE || MITTENTE_PREDEFINITO;
  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400 }; }

  for (const u of (dati.utenti || []).slice(0, 90)) { // Resend gratuito: 100 email al giorno
    if (!emailValida(u.email) || !(u.voci || []).length) continue;
    await invia(chiave, mittente, u.email, emailUtente(u));
    await pausa(600); // Resend gratuito: al massimo 2 invii al secondo
  }
  const amm = dati.amministratore;
  if (amm && emailValida(amm.email)) {
    const spazioAlto = amm.spazio_byte != null && amm.spazio_byte / LIMITE_STORAGE_BYTE >= 0.7;
    if ((amm.errori && amm.errori.quanti > 0) || spazioAlto) await invia(chiave, mittente, amm.email, emailAmministratore(amm));
  }
  return { statusCode: 202 };
};

exports._prova = { emailUtente, emailAmministratore };
