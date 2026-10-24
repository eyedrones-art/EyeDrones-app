// Eyedrones — email di «Trova un pilota»: le chiama il database (script supabase/trova-pilota.sql).
//   nuovo_lavoro       ai piloti della provincia: c'è una richiesta (senza i contatti del cliente)
//   richiesta_inviata  al cliente: il link privato per vedere le offerte
//   nuova_offerta      al cliente: è arrivata un'offerta
//   scelto             al pilota: il cliente ha scelto la sua offerta, conferma entro 48 ore
//   confermato         al cliente: il pilota ha confermato, ecco i suoi contatti
//   decaduta           al cliente: il pilota non ha confermato, può sceglierne un altro
//   rinuncia           al cliente: il pilota scelto non può fare il lavoro (con il motivo), può sceglierne un altro
//   consegnato         al cliente: il pilota ha consegnato il lavoro (link alla galleria, a Drive o al report)
//   recensione         al cliente: «com'è andata?», con le stelle da toccare
//   miei_lavori        al cliente: il link a «I miei lavori» (tutte le sue richieste)
// Alle email per i clienti il database aggiunge «cliente»: il codice del loro link «I miei lavori».
// Variabili su Netlify: RESEND_API_KEY, AVVISO_SEGRETO, AVVISO_MITTENTE (facoltativa), come per avviso-richiesta.js
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
const euro = (n) => (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const codiceValido = (c) => /^[a-f0-9]{32,64}$/.test(String(c || ""));

function dataItaliana(iso) {
  if (!iso) return "";
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return isNaN(d) ? "" : d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// lo stesso aspetto per tutte le email
function impagina({ etichetta, titolo, sottotitolo, righe = [], riquadro, bottone, stelle, secondo, nota, piede }) {
  const corpo = `<!doctype html>
<html lang="it"><body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d232b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e6ea;">
<tr><td style="background:linear-gradient(90deg,#7e3af2,#ff8c42);height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:24px 24px 8px 24px;">
  <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#e0552f;">${html(etichetta)}</div>
  <h1 style="font-size:21px;line-height:1.3;margin:6px 0 4px 0;">${html(titolo)}</h1>
  ${sottotitolo ? `<p style="font-size:14px;color:#5b6572;margin:0;line-height:1.5;">${html(sottotitolo)}</p>` : ""}
</td></tr>
${righe.length || riquadro ? `<tr><td style="padding:12px 24px 4px 24px;">
  ${righe.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;">${righe.map(([k, v]) => `<tr><td style="padding:5px 12px 5px 0;color:#8b95a3;white-space:nowrap;vertical-align:top;">${html(k)}</td><td style="padding:5px 0;font-weight:600;">${html(v)}</td></tr>`).join("")}</table>` : ""}
  ${riquadro ? `<div style="margin:12px 0 0 0;padding:12px 14px;background:#f6f7f9;border-radius:8px;font-size:14px;line-height:1.55;white-space:pre-wrap;">${html(riquadro)}</div>` : ""}
</td></tr>` : ""}
${bottone ? `<tr><td style="padding:16px 24px 8px 24px;"><a href="${html(bottone.href)}" style="display:inline-block;padding:12px 20px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;background:#ff8c42;color:#161a1f;">${html(bottone.testo)}</a></td></tr>` : ""}
${stelle ? `<tr><td style="padding:14px 24px 6px 24px;">${[1, 2, 3, 4, 5].map((n) => `<a href="${html(`${stelle}?stelle=${n}`)}" title="${n} ${n === 1 ? "stella" : "stelle"}" style="display:inline-block;font-size:34px;line-height:1;text-decoration:none;color:#f5a623;padding:0 4px 0 0;">★</a>`).join("")}<div style="font-size:12.5px;color:#8b95a3;margin-top:6px;">Tocca una stella: da 1 (male) a 5 (benissimo)</div></td></tr>` : ""}
${secondo ? `<tr><td style="padding:6px 24px 0 24px;font-size:13.5px;"><a href="${html(secondo.href)}" style="color:#e0552f;font-weight:700;text-decoration:none;">${html(secondo.testo)} ›</a></td></tr>` : ""}
${nota ? `<tr><td style="padding:4px 24px 22px 24px;font-size:12.5px;color:#8b95a3;line-height:1.5;">${html(nota)}</td></tr>` : `<tr><td style="height:14px;"></td></tr>`}
</table>
<p style="font-size:11.5px;color:#9aa4b2;margin:14px 0 0 0;">${html(piede || "EyeDrones · Trova un pilota · app.eyedrones.it")}</p>
</td></tr></table>
</body></html>`;
  const testo = [
    titolo, sottotitolo, "",
    ...righe.map(([k, v]) => `${k}: ${v}`),
    ...(riquadro ? ["", riquadro] : []),
    ...(bottone ? ["", `${bottone.testo}: ${bottone.href}`] : []),
    ...(stelle ? ["", ...[5, 4, 3, 2, 1].map((n) => `${"★".repeat(n)} ${stelle}?stelle=${n}`)] : []),
    ...(secondo ? ["", `${secondo.testo}: ${secondo.href}`] : []),
    ...(nota ? ["", nota] : []),
  ].filter((x) => x !== undefined && x !== null).join("\n");
  return { html: corpo, testo };
}

// le email, una per tipo: { a: [destinatari], oggetto, html, testo }
function componiEmail(d) {
  const nome = pulisci(d.nome, 80);
  const servizio = pulisci(d.servizio, 80);
  const luogo = pulisci(d.luogo, 120);
  const quando = dataItaliana(d.data_desiderata);
  const pilota = pulisci(d.pilota, 80) || "Il pilota";
  const linkOfferte = codiceValido(d.codice) ? `${APP_URL}/offerte/${d.codice}` : APP_URL;
  const linkPilota = `${APP_URL}/?vai=richieste`;
  const lavoro = [servizio && ["Servizio", servizio], luogo && ["Dove", luogo], quando && ["Quando", quando]].filter(Boolean);
  // «I miei lavori»: il link personale del cliente, in tutte le sue email
  const linkMiei = codiceValido(d.cliente) ? `${APP_URL}/miei-lavori/${d.cliente}` : null;
  const miei = linkMiei ? { href: linkMiei, testo: "Tutte le tue richieste: I miei lavori" } : null;
  const httpsValido = (u) => /^https:\/\/[^\s<>"]{4,}$/.test(String(u || ""));

  if (d.tipo === "nuovo_lavoro" && d.diretto) {
    const a = (Array.isArray(d.piloti) ? d.piloti : []).filter(emailValida).slice(0, 1);
    const cliente = pulisci(d.cliente_nome, 80) || "Un tuo cliente";
    const m = impagina({
      etichetta: "Un cliente ti richiede",
      titolo: `${cliente} vuole lavorare di nuovo con te`,
      sottotitolo: "Ha già lavorato con te tramite EyeDrones e ha mandato la richiesta solo a te. Manda la tua offerta.",
      righe: lavoro,
      riquadro: String(d.descrizione || "").trim().slice(0, 400),
      bottone: { href: linkPilota, testo: "Manda la tua offerta" },
      nota: "Se non rispondi, il cliente può mandare la richiesta anche agli altri piloti della zona.",
    });
    return { a, oggetto: `${cliente} ti richiede: ${servizio || "nuovo lavoro"}`, ...m };
  }
  if (d.tipo === "nuovo_lavoro") {
    const a = (Array.isArray(d.piloti) ? d.piloti : []).filter(emailValida).slice(0, 30);
    const m = impagina({
      etichetta: "Nuovo lavoro nella tua zona",
      titolo: `${servizio || "Una richiesta"}${luogo ? ` · ${luogo}` : ""}`,
      sottotitolo: `Un cliente in provincia di ${pulisci(d.provincia, 2)} cerca un pilota. Manda la tua offerta: se ti sceglie, il lavoro è tuo.`,
      righe: lavoro,
      riquadro: String(d.descrizione || "").trim().slice(0, 400),
      bottone: { href: linkPilota, testo: "Manda la tua offerta" },
      nota: "I contatti del cliente li vedi quando ti sceglie e confermi. Chi risponde prima ha più possibilità.",
      piede: "Ricevi questo avviso perché hai una pagina pubblica su EyeDrones. Puoi toglierti da «Trova un pilota» in «La mia pagina».",
    });
    return { a, oggetto: `Nuovo lavoro: ${servizio || "richiesta"}${luogo ? ` a ${luogo}` : ""}`, ...m };
  }
  if (d.tipo === "richiesta_inviata") {
    const n = Number(d.piloti) || 0;
    const m = impagina({
      etichetta: "Richiesta inviata",
      titolo: `Ciao ${nome || ""}, ci siamo!`,
      sottotitolo: d.diretto_pilota
        ? `La tua richiesta è arrivata a ${pulisci(d.diretto_pilota, 80)}. Ti scriviamo appena manda l'offerta.`
        : n > 0
          ? `La tua richiesta è arrivata a ${n === 1 ? "1 pilota" : `${n} piloti`} della tua provincia. Ti scriviamo appena arriva un'offerta.`
          : "Nella tua provincia i piloti stanno arrivando ora: ti scriviamo appena arriva la prima offerta.",
      bottone: { href: linkOfferte, testo: "Vedi le offerte" },
      secondo: miei,
      nota: "Conserva questa email: il link è solo tuo. Confronti le offerte, scegli il pilota che preferisci e solo allora vi scambiate i contatti. È gratis e senza impegno.",
    });
    return { a: [d.a], oggetto: "La tua richiesta è arrivata ai piloti della zona", ...m };
  }
  if (d.tipo === "nuova_offerta") {
    const m = impagina({
      etichetta: "Nuova offerta",
      titolo: `${pilota}: ${euro(d.prezzo)}`,
      sottotitolo: `Hai una nuova offerta${servizio ? ` per «${servizio}»` : ""}. Guarda i suoi lavori e confrontala con le altre.`,
      bottone: { href: linkOfferte, testo: "Vedi le offerte" },
      secondo: miei,
      nota: "Non devi rispondere subito: puoi aspettare altre offerte e scegliere quando vuoi.",
    });
    return { a: [d.a], oggetto: `Nuova offerta da ${pilota}: ${euro(d.prezzo)}`, ...m };
  }
  if (d.tipo === "scelto") {
    const comm = Number(d.commissione) || 0;
    const m = impagina({
      etichetta: "Sei stato scelto!",
      titolo: `Il cliente ha scelto la tua offerta`,
      sottotitolo: `Conferma entro 48 ore${comm > 0 ? ` (commissione ${euro(comm)})` : ""}: subito dopo vedi i contatti del cliente.`,
      righe: [...lavoro, ["La tua offerta", euro(d.prezzo)]],
      bottone: { href: linkPilota, testo: "Conferma il lavoro" },
      nota: "Se non confermi entro 48 ore, il cliente potrà scegliere un altro pilota.",
    });
    return { a: [d.a], oggetto: `Sei stato scelto: ${servizio || "nuovo lavoro"}${luogo ? ` a ${luogo}` : ""}`, ...m };
  }
  if (d.tipo === "confermato") {
    const righe = [
      ["Pilota", pilota],
      d.pilota_telefono && ["Telefono", pulisci(d.pilota_telefono, 30)],
      emailValida(d.pilota_email) && ["Email", pulisci(d.pilota_email, 120)],
      ["Offerta", euro(d.prezzo)],
    ].filter(Boolean);
    const m = impagina({
      etichetta: "Lavoro confermato",
      titolo: `${pilota} ha confermato!`,
      sottotitolo: "Ti contatterà a breve per mettervi d'accordo. Ecco anche i suoi contatti:",
      righe,
      bottone: d.pilota_slug ? { href: `${APP_URL}/p/${encodeURIComponent(d.pilota_slug)}`, testo: `La pagina di ${pilota}` } : { href: linkOfferte, testo: "Vedi i dettagli" },
      secondo: miei,
      nota: "Quando il pilota ti consegna il lavoro, lo ritrovi in «I miei lavori». La prossima volta puoi richiederlo di nuovo con un tocco.",
    });
    return { a: [d.a], oggetto: `${pilota} ha confermato il tuo lavoro`, ...m, replyTo: emailValida(d.pilota_email) ? d.pilota_email : null };
  }
  if (d.tipo === "rinuncia") {
    const m = impagina({
      etichetta: "Scegli un'altra offerta",
      titolo: `${pilota} non può fare il lavoro`,
      sottotitolo: "Ha controllato il posto e ci ha avvisato subito, così non perdi tempo. Le altre offerte sono ancora lì.",
      riquadro: pulisci(d.motivo, 300) ? `Il motivo: ${pulisci(d.motivo, 300)}` : "",
      bottone: { href: linkOfferte, testo: "Vedi le altre offerte" },
      secondo: miei,
    });
    return { a: [d.a], oggetto: "Scegli un'altra offerta per il tuo lavoro", ...m };
  }
  if (d.tipo === "decaduta") {
    const m = impagina({
      etichetta: "Scegli un altro pilota",
      titolo: `${pilota} non ha confermato`,
      sottotitolo: "Succede: forse non è più libero. Le altre offerte sono ancora lì, puoi sceglierne un'altra.",
      bottone: { href: linkOfferte, testo: "Vedi le offerte" },
      secondo: miei,
      nota: `Una domanda veloce: ${pilota} ti ha contattato lo stesso, fuori da EyeDrones? Rispondi con un tocco nella pagina delle offerte: ci aiuti a tenere solo piloti seri.`,
    });
    return { a: [d.a], oggetto: "Scegli un altro pilota per il tuo lavoro", ...m };
  }
  if (d.tipo === "consegnato") {
    const m = impagina({
      etichetta: "Il tuo lavoro è pronto",
      titolo: `${pilota} ti ha consegnato il lavoro`,
      sottotitolo: `${servizio ? `«${servizio}»: ` : ""}foto, video o report sono pronti da guardare e scaricare.`,
      riquadro: pulisci(d.nota, 500) ? `${pilota}: ${pulisci(d.nota, 500)}` : "",
      bottone: httpsValido(d.link) ? { href: d.link, testo: "Guarda il lavoro" } : (linkMiei ? { href: linkMiei, testo: "Guarda il lavoro" } : null),
      secondo: miei,
      nota: "Lo ritrovi sempre in «I miei lavori», anche tra qualche mese.",
    });
    return { a: [d.a], oggetto: `${pilota} ti ha consegnato il lavoro`, ...m };
  }
  if (d.tipo === "recensione") {
    const m = impagina({
      etichetta: "Com'è andata?",
      titolo: `Com'è andata con ${pilota}?`,
      sottotitolo: "Bastano 5 secondi: le tue stelle aiutano gli altri clienti a scegliere e premiano i piloti che lavorano bene.",
      stelle: linkOfferte,
      secondo: miei,
      nota: "Se vuoi, dopo puoi scrivere anche due righe. Il tuo nome compare abbreviato (per esempio «Laura B.»).",
    });
    return { a: [d.a], oggetto: `Com'è andata con ${pilota}? ⭐`, ...m };
  }
  if (d.tipo === "miei_lavori") {
    if (!linkMiei) return null;
    const m = impagina({
      etichetta: "I miei lavori",
      titolo: `Ciao ${nome || ""}, ecco le tue richieste`,
      sottotitolo: "Con questo link trovi tutte le tue richieste, le offerte, i piloti scelti e i lavori consegnati.",
      bottone: { href: linkMiei, testo: "Apri «I miei lavori»" },
      nota: "Il link è solo tuo: non inoltrarlo. Se non hai chiesto tu questa email, puoi ignorarla.",
    });
    return { a: [d.a], oggetto: "Le tue richieste su EyeDrones", ...m };
  }
  return null;
}

exports.componiEmail = componiEmail;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return risposta(405, "Solo POST");
  const segreto = process.env.AVVISO_SEGRETO;
  const chiave = process.env.RESEND_API_KEY;
  if (!segreto || !chiave) return risposta(500, "Mancano AVVISO_SEGRETO o RESEND_API_KEY nelle variabili di Netlify");
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], segreto)) return risposta(401, "Non autorizzato");

  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return risposta(400, "JSON non valido"); }
  const m = componiEmail(d);
  if (!m) return risposta(400, "Tipo sconosciuto");
  const a = m.a.filter(emailValida);
  if (!a.length) return risposta(200, "Nessun destinatario");

  // un'email per destinatario: i piloti non vedono gli indirizzi degli altri
  let errori = 0;
  for (const dest of a) {
    const invio = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.AVVISO_MITTENTE || MITTENTE_PREDEFINITO,
        to: [dest], subject: m.oggetto, html: m.html, text: m.testo,
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      }),
    }).catch(() => null);
    if (!invio || !invio.ok) {
      errori++;
      console.error("Resend ha rifiutato l'email:", invio && invio.status, invio && (await invio.text().catch(() => "")).slice(0, 300));
    }
  }
  return errori === a.length ? risposta(502, "Invio non riuscito") : risposta(200, `Inviate ${a.length - errori}`);
};
