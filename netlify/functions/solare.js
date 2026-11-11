// EyeDrones Solare — pagina /solare: stima del fotovoltaico, assistente AI e richiesta di preventivo.
//   POST { azione: "config" }                     → nome dell'installatore partner (per la frase del consenso)
//   POST { azione: "stima", lat, lon, bolletta, batteria }  → kW consigliati, produzione (PVGIS, JRC UE), risparmio
//   POST { azione: "chat", messaggi: [...] }      → risposta breve dell'assistente (Claude)
//   POST { azione: "contatto", dati: {...} }      → salva il contatto (con il consenso) e avvisa su Telegram/email
// Variabili su Netlify:
//   ANTHROPIC_API_KEY, AVVISO_SEGRETO, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, RESEND_API_KEY (già presenti)
//   SOLARE_PARTNER_NOME   facoltativa: nome dell'installatore a cui vanno i contatti (es. «Giampower»), solo dopo il suo sì
//   SOLARE_PARTNER_EMAIL  facoltativa: email dell'installatore che riceve i contatti
// I contatti si salvano nel database con supabase/solare.sql.
const Anthropic = require("@anthropic-ai/sdk");
const crypto = require("crypto");

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const MITTENTE = process.env.AVVISO_MITTENTE || "EyeDrones <avvisi@eyedrones.it>";
// ipotesi della stima, dette chiaramente nella pagina
const PREZZO_KWH = 0.27;        // €/kWh pagato in bolletta (energia + oneri), indicativo
const PREZZO_VENDITA = 0.09;    // €/kWh per l'energia ceduta alla rete, indicativo
const AUTOCONSUMO = { no: 0.35, si: 0.7 }; // quota di energia usata in casa, senza o con batteria

const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify(dati) });
const pulisci = (v, max = 200) => String(v == null ? "" : v).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);
const partner = () => pulisci(process.env.SOLARE_PARTNER_NOME, 60);
const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- stima con PVGIS (Commissione europea, Joint Research Centre) ----------
async function stima({ lat, lon, bolletta, batteria }) {
  lat = Number(lat); lon = Number(lon); bolletta = Number(bolletta);
  if (!(lat > 35 && lat < 48 && lon > 6 && lon < 19.5)) return { errore: "Indirizzo non trovato in Italia" };
  if (!(bolletta >= 20 && bolletta <= 2000)) return { errore: "Scrivi quanto spendi di luce al mese (tra 20 e 2000 €)" };
  const consumo = (bolletta * 12) / PREZZO_KWH; // kWh l'anno, stima dalla bolletta
  const url = `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
  let resa = null; // kWh l'anno per ogni kW installato
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const j = r.ok ? await r.json() : null;
    resa = j && j.outputs && j.outputs.totals && j.outputs.totals.fixed && j.outputs.totals.fixed.E_y;
  } catch { /* PVGIS lento o giù: uso un valore medio per la latitudine */ }
  const fonte = resa ? "PVGIS (Commissione europea)" : "media per la tua zona";
  if (!resa) resa = Math.round(1550 - (lat - 37) * 38); // da ~1550 kWh/kW al sud a ~1150 al nord
  const kw = Math.min(20, Math.max(2, Math.round((consumo / resa) * 2) / 2));
  const produzione = Math.round(kw * resa);
  const quota = batteria ? AUTOCONSUMO.si : AUTOCONSUMO.no;
  const usata = Math.min(produzione * quota, consumo);
  const risparmio = Math.round(usata * PREZZO_KWH + (produzione - usata) * PREZZO_VENDITA);
  return { kw, produzione, risparmio, consumo: Math.round(consumo), resa: Math.round(resa), fonte, batteria: !!batteria, pannelli: Math.ceil((kw * 1000) / 450) };
}

// ---------- assistente ----------
const ISTRUZIONI = `Sei l'assistente della pagina «Il tuo tetto, visto dal drone» di EyeDrones. Aiuti privati e piccole aziende in Italia a capire se il fotovoltaico conviene e a chiedere un preventivo.

Come rispondi:
- In italiano semplice, frasi brevi, al massimo 4-5 frasi. Niente elenchi lunghi, niente tabelle.
- Dai cifre solo come stime indicative e dillo. Non promettere risparmi, prezzi o tempi precisi.
- Incentivi, detrazioni fiscali e regole cambiano ogni anno: spiega in generale e di' che l'installatore conferma cosa vale oggi per il suo caso. Non inventare percentuali o scadenze.
- Non dare consulenze fiscali o legali precise. Non parlare di altre aziende o marche.
- Se la persona sembra interessata, invitala a calcolare la stima sulla pagina e a lasciare il contatto nel modulo per il sopralluogo con il drone e il preventivo, senza impegno. Non chiedere tu nome, telefono o email nella chat.
- Non usare mai la parola «gratis» o «gratuito».
- Se ti chiedono cose che non c'entrano con fotovoltaico, batterie, risparmio energetico o il sopralluogo con il drone, rispondi gentilmente che puoi aiutare solo su questo.

Cosa sai del servizio: la persona calcola una stima con i dati solari ufficiali europei (PVGIS); se vuole, un pilota di droni fa le foto del tetto dall'alto e un installatore della zona prepara il preventivo. La stima usa ipotesi medie: circa 0,27 €/kWh in bolletta, circa 0,09 €/kWh per l'energia ceduta alla rete, autoconsumo circa 35% senza batteria e 70% con batteria.`;

async function chat(messaggi) {
  if (!process.env.ANTHROPIC_API_KEY) return { errore: "Assistente non disponibile in questo momento" };
  if (!Array.isArray(messaggi) || !messaggi.length || messaggi.length > 16) return { errore: "Conversazione troppo lunga: ricarica la pagina" };
  const pulita = messaggi.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: pulisci(m.content, 700) })).filter((m) => m.content);
  if (!pulita.length || pulita[0].role !== "user" || pulita[pulita.length - 1].role !== "user") return { errore: "Messaggio non valido" };
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const r = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 1200,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system: [{ type: "text", text: ISTRUZIONI, cache_control: { type: "ephemeral" } }],
      messages: pulita,
    });
    if (r.stop_reason === "refusal") return { testo: "Su questo non posso aiutarti. Se vuoi, chiedimi del fotovoltaico o del preventivo." };
    const testo = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return { testo: testo || "Non ho capito bene: puoi riformulare?" };
  } catch (e) {
    console.error("assistente solare:", e && e.status, e && e.message);
    return { errore: "L'assistente non risponde, riprova tra poco" };
  }
}

// ---------- contatto ----------
function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
async function telegram(testo) {
  const token = String(process.env.TELEGRAM_TOKEN || "").match(/\d{5,}:[A-Za-z0-9_-]{30,}/)?.[0];
  const chat = String(process.env.TELEGRAM_CHAT_ID || "").trim();
  if (!token || !chat) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: testo, parse_mode: "HTML", disable_web_page_preview: true }) }).catch(() => null);
  return !!(r && r.ok);
}
async function email(a, oggetto, html, testo) {
  if (!process.env.RESEND_API_KEY || !a) return false;
  const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: MITTENTE, to: [a], subject: oggetto, html, text: testo }) }).catch(() => null);
  return !!(r && r.ok);
}

async function contatto(d) {
  const dati = {
    nome: pulisci(d.nome, 80), telefono: pulisci(d.telefono, 30), email: pulisci(d.email, 120).toLowerCase(),
    indirizzo: pulisci(d.indirizzo, 160), tipo: d.tipo === "azienda" ? "azienda" : "casa", tetto: pulisci(d.tetto, 40),
    bolletta: Number(d.bolletta) || null, nota: pulisci(d.nota, 500), fascia: pulisci(d.fascia, 30),
    origine: d.origine && typeof d.origine === "object" ? Object.fromEntries(["pagina", "source", "medium", "campaign", "da"].filter((k) => d.origine[k]).map((k) => [k, pulisci(d.origine[k], 80)])) : null,
    stima: d.stima && typeof d.stima === "object" ? { kw: Number(d.stima.kw) || null, produzione: Number(d.stima.produzione) || null, risparmio: Number(d.stima.risparmio) || null } : null,
    consenso: d.consenso === true, partner: partner() || null, quando: new Date().toISOString(),
  };
  if (dati.nome.length < 2) return { errore: "Scrivi nome e cognome" };
  if (!/^[+\d][\d\s./-]{6,}$/.test(dati.telefono)) return { errore: "Scrivi un numero di telefono valido" };
  if (dati.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dati.email)) return { errore: "L'email non sembra giusta" };
  if (dati.indirizzo.length < 4) return { errore: "Scrivi il comune o l'indirizzo dell'impianto" };
  if (!dati.consenso) return { errore: "Serve il consenso per poterti ricontattare" };
  if (pulisci(d.sito, 50)) return { ok: true }; // campo trappola compilato dai robot: faccio finta di niente

  const segreto = process.env.AVVISO_SEGRETO;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/solare_salva`, { method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_segreto: segreto, p_dati: dati }) }).catch(() => null);
  const salvato = !!(r && r.ok);
  const esito = salvato ? await r.json().catch(() => "ok") : null;
  if (!salvato) console.error("contatto solare non salvato:", r && r.status, r && (await r.text().catch(() => "")).slice(0, 200));
  if (esito === "doppione") return { ok: true, doppione: true }; // già arrivato nelle ultime 24 ore: niente avvisi doppi

  const s = dati.stima;
  const o = dati.origine || {};
  const daDove = [o.source, o.campaign, o.pagina && o.pagina !== "/solare/" && o.pagina !== "/solare" ? o.pagina.replace("/fotovoltaico/", "pagina ") : "", o.da && !o.source ? o.da : ""].filter(Boolean).join(" · ");
  const cifre = dati.telefono.replace(/\D/g, "");
  const wa = cifre.length >= 9 ? `https://wa.me/${cifre.startsWith("39") && cifre.length > 10 ? cifre : `39${cifre.replace(/^0+(?=3)/, "")}`}` : "";
  const righe = [
    `☀️ <b>Nuovo contatto fotovoltaico</b>${dati.partner ? ` → ${esc(dati.partner)}` : ""}`,
    `${esc(dati.nome)} · ${esc(dati.telefono)}${dati.email ? ` · ${esc(dati.email)}` : ""}`,
    `📍 ${esc(dati.indirizzo)} · ${dati.tipo === "azienda" ? "azienda" : "casa"}${dati.tetto ? ` · tetto ${esc(dati.tetto)}` : ""}`,
    dati.bolletta ? `💡 bolletta circa ${dati.bolletta} €/mese` : "",
    s && s.kw ? `🔆 stima: ${s.kw} kW · ${s.produzione} kWh/anno · risparmio ~${s.risparmio} €/anno` : "",
    dati.fascia ? `🕑 preferisce essere chiamato: ${esc(dati.fascia)}` : "",
    dati.nota ? `📝 ${esc(dati.nota)}` : "",
    daDove ? `🔎 arrivato da: ${esc(daDove)}` : "",
    wa ? `<a href="${wa}">💬 Scrivigli su WhatsApp</a>` : "",
    salvato ? "" : "⚠️ non salvato nel database: controlla supabase/solare.sql",
  ].filter(Boolean);
  await telegram(righe.join("\n"));
  const dest = pulisci(process.env.SOLARE_PARTNER_EMAIL, 120);
  if (dest && dati.partner) {
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d232b"><h2 style="margin:0 0 8px">Nuova richiesta di preventivo fotovoltaico</h2>${righe.slice(1).map((x) => `<p style="margin:4px 0">${x}</p>`).join("")}<p style="font-size:12px;color:#777;margin-top:16px">Contatto raccolto da EyeDrones sulla pagina app.eyedrones.it/solare, con il consenso della persona a essere ricontattata da ${esc(dati.partner)} per un preventivo.</p></div>`;
    await email(dest, `Nuovo contatto fotovoltaico: ${dati.nome} (${dati.indirizzo})`, html, righe.slice(1).join("\n").replace(/<[^>]+>/g, ""));
  }
  // conferma alla persona, se ha lasciato l'email: sa chi la chiamerà e ritrova la sua stima
  if (dati.email) {
    const chi = dati.partner ? esc(dati.partner) : "un installatore fotovoltaico della tua zona";
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2430;max-width:540px"><h2 style="margin:0 0 8px">☀️ Abbiamo ricevuto la tua richiesta</h2><p>Ciao ${esc(dati.nome.split(" ")[0])}, ti chiamerà ${chi}${dati.fascia ? ` (preferibilmente ${esc(dati.fascia)})` : ""} per fissare il sopralluogo con il drone e prepararti il preventivo, senza impegno.</p>${s && s.kw ? `<p style="background:#fff3e0;border-radius:10px;padding:12px">La tua stima: <b>${s.kw} kW</b>, circa <b>${s.produzione} kWh</b> l'anno, risparmio indicativo circa <b>${s.risparmio} € l'anno</b>.</p>` : ""}<p style="font-size:12.5px;color:#777">Hai ricevuto questa email perché hai chiesto un preventivo su app.eyedrones.it/solare. Per cancellare i tuoi dati scrivi a info@eyedrones.it.</p></div>`;
    await email(dati.email, "Abbiamo ricevuto la tua richiesta di preventivo fotovoltaico", html, `Ciao, ti chiamerà ${dati.partner || "un installatore fotovoltaico della tua zona"} per fissare il sopralluogo con il drone e il preventivo.${s && s.kw ? ` La tua stima: ${s.kw} kW, circa ${s.produzione} kWh l'anno, risparmio indicativo circa ${s.risparmio} € l'anno.` : ""}`);
  }
  return { ok: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Solo POST" });
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non valida" }); }
  if (String(event.body || "").length > 20000) return json(413, { errore: "Richiesta troppo grande" });
  if (d.azione === "config") return json(200, { partner: partner() || null });
  if (d.azione === "stima") { const x = await stima(d); return json(x.errore ? 400 : 200, x); }
  if (d.azione === "chat") { const x = await chat(d.messaggi); return json(x.errore ? 400 : 200, x); }
  if (d.azione === "contatto") { const x = await contatto(d.dati || {}); return json(x.errore ? 400 : 200, x); }
  return json(400, { errore: "Azione sconosciuta" });
};
exports._prova = { stima, ISTRUZIONI, stessoSegreto };
