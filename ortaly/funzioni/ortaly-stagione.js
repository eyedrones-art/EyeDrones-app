// Ortaly — «Cosa c'è di stagione»: email automatica il 1° e il 15 del mese (schedule in netlify.toml)
// a chi è iscritto alle novità e ha confermato. Dentro: i prodotti del mese, cosa hanno al banco i produttori
// della sua provincia (con foto e prezzo) o, se lì non c'è ancora nessuno, chi spedisce da tutta Italia, e una ricetta semplice.
// Non manda due email di fila alla stessa persona (colonna novita.ultima_stagione, almeno 10 giorni).
// Prova: POST /.netlify/functions/ortaly-stagione con header x-ortaly-prova = ORTALY_PROVA_SEGRETO
//        → manda l'email solo a ORTALY_ADMIN_EMAIL (di solito info@ortaly.it), per vederla prima.
// Variabili su Netlify: ORTALY_SUPABASE_SECRET, RESEND_API_KEY, ORTALY_ADMIN_EMAIL (facoltativa), ORTALY_PROVA_SEGRETO (facoltativa).
// Da eseguire prima: supabase/ortaly-stagione.sql.
const ORTALY_SUPABASE_URL = "https://qqxzqiwxhyyzylmkvdew.supabase.co";
const SITO = "https://ortaly.it";

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const euro = (n) => Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fotoOk = (u) => typeof u === "string" && u.startsWith(`${ORTALY_SUPABASE_URL}/storage/v1/object/public/foto/`);
const EMOJI = { "Verdura": "🥬", "Frutta": "🍎", "Uova e latticini": "🥚", "Formaggi": "🧀", "Carne e salumi": "🥩", "Miele e conserve": "🍯", "Vino e olio": "🍷", "Pane e farine": "🌾", "Altro": "🧺" };

function intestazioni(chiave, extra = {}) {
  const h = { apikey: chiave, "Content-Type": "application/json", ...extra };
  if (chiave.startsWith("eyJ")) h.Authorization = `Bearer ${chiave}`;
  return h;
}

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
// gli stessi prodotti di stagione che mostra la pagina di Ortaly
const STAGIONI = ["cavolo nero, porri, arance, mandarini e radicchio", "cavoli, finocchi, arance e topinambur", "asparagi selvatici, spinaci, carciofi e uova fresche", "asparagi, fave, piselli e le prime fragole", "fragole, ciliegie, piselli e zucchine", "albicocche, zucchine, fagiolini e i primi pomodori", "pesche, pomodori, peperoni, melanzane e meloni", "pesche, fichi, pomodori e angurie", "uva, fichi, peperoni e i primi funghi", "uva, castagne, zucca, mele e pere", "zucca, castagne, cachi, mele, porri e cavolo nero", "cavoli, porri, arance, mandarini e miele"];
// una ricetta semplice per mese, con i prodotti di stagione (per 4 persone)
const RICETTE = [
  { nome: "Vellutata di porri e patate", ingredienti: "3 porri, 4 patate, 1 litro di brodo vegetale, olio extravergine, sale e pepe", passi: ["Taglia i porri a rondelle e falli appassire in pentola con un filo d'olio.", "Aggiungi le patate a cubetti e il brodo; cuoci 25 minuti.", "Frulla tutto, aggiusta di sale e servi con un filo d'olio a crudo."] },
  { nome: "Finocchi gratinati", ingredienti: "3 finocchi, 40 g di formaggio grattugiato, pangrattato, olio extravergine, sale", passi: ["Taglia i finocchi a spicchi e lessali 8 minuti in acqua salata.", "Mettili in una teglia con olio, formaggio e pangrattato.", "Gratina in forno a 200 °C per 15 minuti, finché sono dorati."] },
  { nome: "Frittata di spinaci", ingredienti: "6 uova fresche, 300 g di spinaci, 40 g di formaggio grattugiato, olio, sale", passi: ["Fai appassire gli spinaci in padella con un filo d'olio e strizzali.", "Sbatti le uova con il formaggio e un pizzico di sale, poi unisci gli spinaci.", "Cuoci in padella a fuoco basso, coperta, girandola a metà cottura."] },
  { nome: "Risotto agli asparagi", ingredienti: "320 g di riso, 1 mazzo di asparagi, 1 cipolla, 1 litro di brodo, burro, formaggio grattugiato", passi: ["Taglia le punte degli asparagi e fai a rondelle i gambi; soffriggi la cipolla.", "Tosta il riso, aggiungi i gambi e cuoci 16 minuti aggiungendo brodo caldo.", "Unisci le punte negli ultimi 5 minuti, poi manteca con burro e formaggio."] },
  { nome: "Pasta con zucchine e piselli", ingredienti: "320 g di pasta, 3 zucchine, 200 g di piselli, 1 cipollotto, olio, formaggio grattugiato", passi: ["Soffriggi il cipollotto, aggiungi piselli e zucchine a dadini; cuoci 10 minuti.", "Cuoci la pasta e scolala al dente, tenendo un po' d'acqua di cottura.", "Salta la pasta con il sugo, un po' d'acqua di cottura e il formaggio."] },
  { nome: "Insalata di fagiolini e pomodori", ingredienti: "400 g di fagiolini, 300 g di pomodori, basilico, olio extravergine, sale", passi: ["Lessa i fagiolini 8 minuti in acqua salata e raffreddali.", "Taglia i pomodori a spicchi e unisci i fagiolini.", "Condisci con olio, sale e basilico spezzettato."] },
  { nome: "Peperonata", ingredienti: "4 peperoni, 2 cipolle, 3 pomodori, olio extravergine, sale, basilico", passi: ["Taglia i peperoni a strisce e le cipolle a fettine.", "Cuoci tutto in padella con l'olio per 10 minuti, poi aggiungi i pomodori a pezzi.", "Continua 20 minuti a fuoco basso, aggiusta di sale e finisci con il basilico."] },
  { nome: "Panzanella", ingredienti: "300 g di pane raffermo, 4 pomodori maturi, 1 cetriolo, 1 cipolla rossa, basilico, olio, aceto, sale", passi: ["Bagna il pane in acqua e aceto, poi strizzalo e sbriciolalo.", "Aggiungi pomodori, cetriolo e cipolla a pezzetti.", "Condisci con olio, sale e basilico e lascia riposare 30 minuti in frigo."] },
  { nome: "Pasta con funghi", ingredienti: "320 g di pasta, 400 g di funghi, 1 spicchio d'aglio, prezzemolo, olio, sale", passi: ["Pulisci i funghi con un panno e tagliali a fettine.", "Cuocili in padella con olio e aglio per 10 minuti, poi aggiungi il prezzemolo.", "Salta la pasta al dente con i funghi e un po' d'acqua di cottura."] },
  { nome: "Risotto alla zucca", ingredienti: "320 g di riso, 500 g di zucca, 1 cipolla, 1 litro di brodo, burro, formaggio grattugiato", passi: ["Soffriggi la cipolla, aggiungi la zucca a cubetti e cuoci 10 minuti.", "Tosta il riso e cuoci 17 minuti aggiungendo brodo caldo poco alla volta.", "Manteca con burro e formaggio e lascia riposare 2 minuti."] },
  { nome: "Pasta con cavolo nero", ingredienti: "320 g di pasta, 1 mazzo di cavolo nero, 1 spicchio d'aglio, olio extravergine, formaggio grattugiato", passi: ["Togli la costa centrale al cavolo nero e lessa le foglie 5 minuti.", "Frulla le foglie con aglio, olio e un po' d'acqua di cottura.", "Condisci la pasta con la crema e il formaggio."] },
  { nome: "Insalata di arance e finocchi", ingredienti: "3 arance, 2 finocchi, olive nere, olio extravergine, sale e pepe", passi: ["Pela le arance a vivo e tagliale a fette.", "Affetta sottili i finocchi e unisci le olive.", "Condisci con olio, sale e pepe poco prima di servire."] },
];

const MITTENTI = [process.env.ORTALY_MITTENTE, "Ortaly <avvisi@ortaly.it>", "Ortaly <avvisi@eyedrones.it>"].filter(Boolean);
// Resend: fino a 100 email per chiamata (batch). Se il primo mittente non è verificato provo il successivo
async function mandaGruppo(chiaveResend, email) {
  for (const from of MITTENTI) {
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiaveResend}`, "Content-Type": "application/json" },
      body: JSON.stringify(email.map((e) => ({ from, reply_to: "info@ortaly.it", ...e }))),
    }).catch(() => null);
    if (r && r.ok) return true;
    console.error("Resend ha rifiutato il gruppo da", from, ":", r && r.status, r ? (await r.text().catch(() => "")).slice(0, 300) : "rete");
    if (!r || !(r.status === 403 || r.status === 422)) return false;
  }
  return false;
}

function schedaProdotto(a, b) {
  const img = fotoOk(a.foto)
    ? `<img src="${esc(a.foto)}" alt="" width="64" height="64" style="width:64px;height:64px;border-radius:10px;object-fit:cover;display:block">`
    : `<div style="width:64px;height:64px;border-radius:10px;background:#dcf2e8;font-size:30px;line-height:64px;text-align:center">${EMOJI[a.categoria] || "🧺"}</div>`;
  return `<tr><td style="padding:6px 12px 6px 0;vertical-align:top;width:64px">${img}</td>
    <td style="padding:6px 0;font-size:15px;vertical-align:top"><b>${esc(a.nome)}</b> · ${esc(euro(a.prezzo))}/${esc(a.unita)}<br>
    <a href="${SITO}/#bottega-${esc(b.id)}" style="color:#047857;font-size:14px">${esc(b.nome)} · ${esc(b.paese || "")}</a></td></tr>`;
}

function componi(u, mese, vicini, lontani) {
  const r = RICETTE[mese];
  const titolo = `🍅 ${MESI[mese].charAt(0).toUpperCase() + MESI[mese].slice(1)}: cosa c'è di stagione`;
  const fuori = `${SITO}/#disiscrivi-${u.token}`;
  const blocco = (titoletto, righe) => righe.length ? `<h3 style="font-size:17px;margin:22px 0 6px">${titoletto}</h3><table style="border-collapse:collapse">${righe.map(([a, b]) => schedaProdotto(a, b)).join("")}</table>` : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f2a24">
    <h2 style="color:#047857;margin:0 0 8px">${esc(titolo)}</h2>
    <p style="font-size:15px">A ${esc(MESI[mese])} è il momento di <b>${esc(STAGIONI[mese])}</b>.</p>
    ${vicini.length ? blocco("Al banco vicino a te", vicini) : `<p style="font-size:15px;background:#f2faf6;border-radius:8px;padding:12px">Nella tua provincia i produttori stanno arrivando su Ortaly. Intanto ecco chi spedisce da tutta Italia.</p>`}
    ${blocco(vicini.length ? "Spediti da tutta Italia" : "Dall'Italia, con il corriere", lontani)}
    <p style="margin:20px 0"><a href="${SITO}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:15px">Guarda tutto il banco ›</a></p>
    <div style="background:#fff7d6;border-radius:10px;padding:14px 16px">
      <h3 style="font-size:17px;margin:0 0 6px">🍳 La ricetta: ${esc(r.nome)}</h3>
      <p style="font-size:14px;margin:0 0 8px"><b>Per 4 persone:</b> ${esc(r.ingredienti)}</p>
      <ol style="font-size:14px;padding-left:20px;margin:0">${r.passi.map((p) => `<li style="margin:0 0 4px">${esc(p)}</li>`).join("")}</ol>
    </div>
    <p style="font-size:13px;color:#4a675e;margin-top:22px">Ortaly · dal produttore a te. Ti scriviamo il 1° e il 15 del mese.<br><a href="${esc(fuori)}" style="color:#4a675e">Non vuoi più queste email? Toglimi</a></p></div>`;
  const testo = [
    titolo, "", `A ${MESI[mese]} è il momento di ${STAGIONI[mese]}.`, "",
    ...(vicini.length ? ["Al banco vicino a te:", ...vicini.map(([a, b]) => `• ${a.nome} · ${euro(a.prezzo)}/${a.unita} — ${b.nome}: ${SITO}/#bottega-${b.id}`), ""] : ["Nella tua provincia i produttori stanno arrivando su Ortaly.", ""]),
    ...(lontani.length ? ["Dall'Italia, con il corriere:", ...lontani.map(([a, b]) => `• ${a.nome} · ${euro(a.prezzo)}/${a.unita} — ${b.nome}: ${SITO}/#bottega-${b.id}`), ""] : []),
    `La ricetta: ${r.nome}`, `Per 4 persone: ${r.ingredienti}`, ...r.passi.map((p, i) => `${i + 1}. ${p}`), "",
    `Guarda tutto il banco: ${SITO}`, "", `Non vuoi più queste email? ${fuori}`,
  ].join("\n");
  return { to: [u.email], subject: titolo, html, text: testo, headers: { "List-Unsubscribe": `<${fuori}>` } };
}

exports.handler = async (event) => {
  const chiave = process.env.ORTALY_SUPABASE_SECRET, resend = process.env.RESEND_API_KEY;
  if (!chiave || !resend) { console.error("mancano ORTALY_SUPABASE_SECRET o RESEND_API_KEY"); return { statusCode: 500 }; }
  // chiamata a mano: solo la prova verso l'amministratore, e solo con il codice giusto
  const prova = !!(event && event.headers && event.headers["x-ortaly-prova"]);
  if (prova && (!process.env.ORTALY_PROVA_SEGRETO || event.headers["x-ortaly-prova"] !== process.env.ORTALY_PROVA_SEGRETO)) return { statusCode: 401 };
  if (!prova && event && event.httpMethod && !(event.body && String(event.body).includes("next_run"))) return { statusCode: 405 };

  const h = intestazioni(chiave);
  const leggi = async (q) => { const r = await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/${q}`, { headers: h }); if (!r.ok) throw new Error(`${q}: ${r.status}`); return r.json(); };
  let iscritti, botteghe, prodotti;
  try {
    [botteghe, prodotti] = await Promise.all([leggi("vetrina_botteghe?select=*"), leggi("vetrina_prodotti?select=*&order=creato.desc&limit=2000")]);
    iscritti = prova
      ? [{ id: null, email: process.env.ORTALY_ADMIN_EMAIL || "info@ortaly.it", provincia: "TO", token: "0".repeat(64) }]
      : await leggi(`novita?select=id,email,provincia,token&disiscritto=is.null&confermato=is.true&or=(ultima_stagione.is.null,ultima_stagione.lt.${new Date(Date.now() - 10 * 864e5).toISOString()})&limit=2000`);
  } catch (e) { console.error("dati non disponibili:", e.message); return { statusCode: 500 }; }

  const bot = new Map(botteghe.map((b) => [b.id, b]));
  const conBottega = prodotti.filter((a) => bot.has(a.bottega)).map((a) => [a, bot.get(a.bottega)]);
  // al massimo 2 prodotti per produttore, prima quelli con la foto
  const scegli = (lista, n) => {
    const perB = {}, out = [];
    for (const x of [...lista].sort((p, q) => (fotoOk(q[0].foto) ? 1 : 0) - (fotoOk(p[0].foto) ? 1 : 0))) {
      perB[x[1].id] = (perB[x[1].id] || 0) + 1;
      if (perB[x[1].id] <= 2) out.push(x);
      if (out.length >= n) break;
    }
    return out;
  };
  const mese = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" })).getMonth();

  const email = iscritti.map((u) => {
    const vicini = scegli(conBottega.filter(([, b]) => b.provincia && b.provincia === u.provincia), 6);
    const lontani = scegli(conBottega.filter(([, b]) => b.spedizione && b.provincia !== u.provincia), vicini.length ? 3 : 6);
    return { u, msg: componi(u, mese, vicini, lontani) };
  });

  let inviate = 0;
  for (let i = 0; i < email.length; i += 100) {
    const gruppo = email.slice(i, i + 100);
    if (!(await mandaGruppo(resend, gruppo.map((x) => x.msg)))) continue;
    inviate += gruppo.length;
    const ids = gruppo.map((x) => x.u.id).filter(Boolean);
    if (ids.length) await fetch(`${ORTALY_SUPABASE_URL}/rest/v1/novita?id=in.(${ids.join(",")})`, { method: "PATCH", headers: h, body: JSON.stringify({ ultima_stagione: new Date().toISOString() }) }).catch(() => null);
  }
  console.log(`email di stagione: ${inviate} su ${email.length}`);
  return { statusCode: 200, body: JSON.stringify({ inviate, iscritti: email.length }) };
};

exports._prova = { componi, RICETTE, STAGIONI };
