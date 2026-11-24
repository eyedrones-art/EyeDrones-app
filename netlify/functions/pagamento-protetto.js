// EyeDrones — «🛡️ Pagamento protetto» (script supabase/pagamento-protetto.sql), come Vinted:
// il cliente paga nell'app, i soldi restano fermi su Stripe e vanno al pilota quando il cliente conferma
// (o da soli qualche giorno dopo la consegna). Il pilota riceve il 100% del suo prezzo; il cliente paga in più
// la «Protezione EyeDrones». I soldi non passano mai da un conto di EyeDrones: Stripe Connect li tiene e li trasferisce.
//
// Azioni (POST, JSON { azione, ... }):
//   paga         il cliente (con il codice del suo link) apre il pagamento: tipo anticipo | saldo | totale
//   ricevuto     il cliente conferma «ho ricevuto il lavoro»: i soldi partono subito verso il pilota
//   collega      il pilota (con l'accesso) apre la pagina di Stripe per collegare il suo conto
//   stato        il pilota torna da Stripe: controllo se il conto è pronto a ricevere
//   esegui       l'amministratore: esegue subito trasferimenti e rimborsi decisi
// La conferma del pagamento NON arriva da qui ma da stripe-webhook.js (Stripe la firma).
// Ogni ora protetto-rilascio.js esegue i trasferimenti scaduti (consegna da N giorni senza problemi).
// Variabili su Netlify: STRIPE_SECRET_KEY, AVVISO_SEGRETO (ci sono già).
const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const APP = "https://app.eyedrones.it";
const ADMIN = ["eyedrones@libero.it", "ravinale.ivan@libero.it"];

const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(dati) });
const codiceValido = (c) => /^[a-f0-9]{32,64}$/.test(String(c || ""));
const centesimi = (euro) => Math.round(Number(euro) * 100);

async function rpc(nome, corpo, token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token || SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const testo = await r.text();
  let dati = null;
  try { dati = testo ? JSON.parse(testo) : null; } catch { dati = testo; }
  return { ok: r.ok, dati };
}

async function stripe(metodo, percorso, campi, chiaveUnica) {
  const r = await fetch(`https://api.stripe.com/v1/${percorso}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(chiaveUnica ? { "Idempotency-Key": chiaveUnica } : {}),
    },
    body: metodo === "GET" ? undefined : new URLSearchParams(campi || {}).toString(),
  });
  const dati = await r.json().catch(() => ({}));
  return { ok: r.ok, dati };
}

async function utenteDa(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : null;
}

// il conto è pronto quando Stripe ha controllato i documenti e può mandare i soldi in banca
const contoPronto = (a) => Boolean(a && a.details_submitted && a.payouts_enabled && a.capabilities && a.capabilities.transfers === "active");

// trasferimenti al pilota e rimborsi al cliente decisi dal database. Le chiavi uniche evitano doppioni se gira due volte
async function esegui() {
  const segreto = process.env.AVVISO_SEGRETO || "";
  if (!process.env.STRIPE_SECRET_KEY || !segreto) return { rilasciati: 0, rimborsati: 0, errori: 0 };
  const { ok, dati } = await rpc("protezione_da_fare", { p_segreto: segreto });
  if (!ok || !dati) return { rilasciati: 0, rimborsati: 0, errori: 1 };
  let rilasciati = 0, rimborsati = 0, errori = 0;
  for (const p of dati.rilasciare || []) {
    // il trasferimento parte dal pagamento del cliente: si può fare anche prima che Stripe abbia accreditato i soldi
    const pi = p.intent ? await stripe("GET", `payment_intents/${encodeURIComponent(p.intent)}`) : null;
    const carica = pi && pi.ok ? pi.dati.latest_charge : null;
    const t = await stripe("POST", "transfers", {
      amount: String(p.centesimi), currency: "eur", destination: p.account, transfer_group: p.offerta,
      ...(carica ? { source_transaction: typeof carica === "string" ? carica : carica.id } : {}),
      "metadata[pagamento]": p.id, "metadata[offerta]": p.offerta,
    }, `rilascio-${p.id}`);
    if (!t.ok) { errori++; console.error("trasferimento non riuscito", p.id, t.dati && t.dati.error && t.dati.error.message); continue; }
    await rpc("protezione_fatto", { p_id: p.id, p_esito: "rilasciato", p_riferimento: t.dati.id, p_segreto: segreto });
    rilasciati++;
  }
  for (const p of dati.rimborsare || []) {
    if (!p.intent) { errori++; continue; }
    const r = await stripe("POST", "refunds", { payment_intent: p.intent, "metadata[pagamento]": p.id }, `rimborso-${p.id}`);
    if (!r.ok) { errori++; console.error("rimborso non riuscito", p.id, r.dati && r.dati.error && r.dati.error.message); continue; }
    await rpc("protezione_fatto", { p_id: p.id, p_esito: "rimborsato", p_riferimento: r.dati.id, p_segreto: segreto });
    rimborsati++;
  }
  return { rilasciati, rimborsati, errori };
}
exports.esegui = esegui;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Usa POST." });
  if (!process.env.STRIPE_SECRET_KEY) return json(503, { errore: "I pagamenti non sono ancora attivi." });
  const segreto = process.env.AVVISO_SEGRETO || "";
  let d;
  try { d = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non leggibile." }); }
  const token = String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");

  // ---- il cliente paga (anticipo, resto o tutto) ----
  if (d.azione === "paga") {
    if (!codiceValido(d.codice) || !["anticipo", "saldo", "totale"].includes(d.tipo)) return json(400, { errore: "Richiesta non valida." });
    const { ok, dati: x } = await rpc("protezione_importi", { p_codice: d.codice, p_tipo: d.tipo, p_segreto: segreto });
    if (!ok || !x || !x.offerta) return json(409, { errore: "Il pagamento non è disponibile: ricarica la pagina." });
    const lavoro = ["Lavoro con il drone", x.servizio, x.luogo].filter(Boolean).join(" · ").slice(0, 110);
    const quale = d.tipo === "anticipo" ? "anticipo" : d.tipo === "saldo" ? "resto" : "importo completo";
    const campi = {
      mode: "payment",
      locale: "it",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(centesimi(x.pilota)),
      "line_items[0][price_data][product_data][name]": `${lavoro} (${quale})`,
      "line_items[0][quantity]": "1",
      "line_items[1][price_data][currency]": "eur",
      "line_items[1][price_data][unit_amount]": String(centesimi(x.protezione)),
      "line_items[1][price_data][product_data][name]": "Protezione EyeDrones",
      "line_items[1][price_data][product_data][description]": "I soldi arrivano al pilota solo quando confermi di aver ricevuto il lavoro.",
      "line_items[1][quantity]": "1",
      "payment_intent_data[transfer_group]": x.offerta,
      "payment_intent_data[description]": `Pagamento protetto · ${lavoro}`.slice(0, 200),
      success_url: `${APP}/offerte/${d.codice}?protetto=pagato`,
      cancel_url: `${APP}/offerte/${d.codice}`,
      "metadata[tipo]": "protetto",
      "metadata[offerta]": x.offerta,
      "metadata[quale]": d.tipo,
      "metadata[pilota]": String(centesimi(x.pilota)),
      "metadata[protezione]": String(centesimi(x.protezione)),
    };
    if (x.email) campi.customer_email = x.email;
    const s = await stripe("POST", "checkout/sessions", campi);
    if (!s.ok || !s.dati.url) return json(502, { errore: "Non riesco ad aprire il pagamento, riprova tra poco." });
    return json(200, { url: s.dati.url });
  }

  // ---- il cliente conferma: i soldi partono subito ----
  if (d.azione === "ricevuto") {
    if (!codiceValido(d.codice)) return json(400, { errore: "Richiesta non valida." });
    const { ok } = await rpc("protezione_ricevuto", { p_codice: d.codice });
    if (!ok) return json(409, { errore: "Non è stato possibile: ricarica la pagina." });
    await esegui().catch((e) => console.error("esegui", e.message));
    return json(200, { ok: true });
  }

  // ---- il pilota collega il suo conto o torna da Stripe ----
  if (d.azione === "collega" || d.azione === "stato") {
    const utente = await utenteDa(token).catch(() => null);
    if (!utente || !utente.id) return json(401, { errore: "Accedi a EyeDrones." });
    const { dati: esistente } = await rpc("protezione_account", { p_uid: utente.id, p_segreto: segreto });
    let account = typeof esistente === "string" && esistente.startsWith("acct_") ? esistente : null;

    if (d.azione === "stato") {
      if (!account) return json(200, { collegato: false, pronto: false });
      const a = await stripe("GET", `accounts/${account}`);
      if (!a.ok) return json(502, { errore: "Stripe non risponde, riprova tra poco." });
      const pronto = contoPronto(a.dati);
      await rpc("protezione_salva_account", { p_uid: utente.id, p_account: account, p_pronto: pronto, p_segreto: segreto });
      return json(200, { collegato: true, pronto });
    }

    if (!account) {
      // conto Express solo per ricevere: i documenti il pilota li mette sul sito di Stripe, mai su EyeDrones
      const campi = {
        type: "express", country: "IT",
        "capabilities[transfers][requested]": "true",
        "tos_acceptance[service_agreement]": "recipient",
        "business_profile[product_description]": "Lavori con il drone tramite EyeDrones",
        "metadata[user_id]": utente.id,
      };
      if (utente.email) campi.email = utente.email;
      const a = await stripe("POST", "accounts", campi, `conto-${utente.id}`);
      if (!a.ok || !a.dati.id) return json(502, { errore: "Non riesco a creare il conto su Stripe, riprova tra poco." });
      account = a.dati.id;
      await rpc("protezione_salva_account", { p_uid: utente.id, p_account: account, p_pronto: false, p_segreto: segreto });
    }
    const link = await stripe("POST", "account_links", {
      account, type: "account_onboarding",
      refresh_url: `${APP}/?vai=richieste&protetto=riprova`,
      return_url: `${APP}/?vai=richieste&protetto=collegato`,
    });
    if (!link.ok || !link.dati.url) return json(502, { errore: "Non riesco ad aprire Stripe, riprova tra poco." });
    return json(200, { url: link.dati.url });
  }

  // ---- l'amministratore esegue subito le decisioni ----
  if (d.azione === "esegui") {
    const utente = await utenteDa(token).catch(() => null);
    if (!utente || !ADMIN.includes(String(utente.email || "").toLowerCase())) return json(403, { errore: "Solo per l'amministratore." });
    return json(200, await esegui());
  }

  return json(400, { errore: "Azione sconosciuta." });
};
