// EyeDrones — notifiche sul telefono di voli pianificati, lavori di Trova un pilota, pagamenti e consegne.
// La chiama il database due volte al giorno (supabase/notifiche-promemoria.sql) con l'elenco già pronto,
// compresi i telefoni di ogni pilota. Qui aggiungo il meteo (Open-Meteo) all'ora del volo e mando le notifiche.
// Variabile su Netlify: AVVISO_SEGRETO (la stessa delle email).
const crypto = require("crypto");
const { inviaPush } = require("./push-chiave.js");

const APP_URL = "https://app.eyedrones.it";
const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const GIORNI_IT = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function stessoSegreto(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}
const corto = (t, n) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, n);
const euro = (n) => `${Number(n || 0).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;

function coordinate(testo) {
  const m = String(testo || "").trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(",", ".")), lon = parseFloat(m[2].replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}
// senza coordinate: cerco il nome del posto in Italia (solo città e paesi)
async function cercaPosto(nome) {
  const q = corto(String(nome || "").split(/[,(]/)[0], 60);
  if (q.length < 3) return null;
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=it&countryCode=IT`).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  const x = j && j.results && j.results[0];
  return x ? { lat: x.latitude, lon: x.longitude } : null;
}

// il meteo del giorno all'ora del volo (o, senza ora, le ore migliori tra le 9 e le 17)
async function meteo(punto, giorno, ora) {
  if (!punto) return null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${punto.lat.toFixed(3)}&longitude=${punto.lon.toFixed(3)}&hourly=precipitation_probability,wind_speed_10m,wind_gusts_10m,temperature_2m&daily=sunset&timezone=Europe%2FRome&start_date=${giorno}&end_date=${giorno}`;
  const r = await fetch(url).catch(() => null);
  const j = r && r.ok ? await r.json().catch(() => null) : null;
  if (!j || !j.hourly || !j.hourly.time) return null;
  const h = j.hourly;
  const ore = h.time.map((t, i) => ({ h: Number(t.slice(11, 13)), pioggia: h.precipitation_probability[i] ?? 0, vento: h.wind_speed_10m[i] ?? 0, raffiche: h.wind_gusts_10m[i] ?? 0, temp: h.temperature_2m[i] }));
  const hOra = ora ? Number(String(ora).slice(0, 2)) : null;
  const scelte = hOra != null ? ore.filter((o) => o.h === hOra) : ore.filter((o) => o.h >= 9 && o.h <= 17);
  if (!scelte.length) return null;
  const peggio = (k) => Math.round(Math.max(...scelte.map((o) => o[k])));
  const m = { vento: peggio("vento"), raffiche: peggio("raffiche"), pioggia: peggio("pioggia"), temp: Math.round(scelte.reduce((s, o) => s + (o.temp ?? 0), 0) / scelte.length), tramonto: j.daily && j.daily.sunset && j.daily.sunset[0] ? j.daily.sunset[0].slice(11, 16) : null };
  m.giudizio = m.pioggia > 60 || m.vento > 30 || m.raffiche > 45 ? "⛔" : m.pioggia > 30 || m.vento > 20 || m.raffiche > 32 ? "⚠️" : "✅";
  m.frase = m.giudizio === "⛔" ? "meglio spostare il volo" : m.giudizio === "⚠️" ? "si vola con attenzione" : "tempo buono per volare";
  return m;
}
const testoMeteo = (m) => m ? `${m.giudizio} ${m.frase}: vento ${m.vento} km/h (raffiche ${m.raffiche}), pioggia ${m.pioggia}%, ${m.temp} °C${m.tramonto ? `, tramonto ${m.tramonto}` : ""}.` : "Meteo non disponibile: controllalo nell'app.";

async function messaggio(a) {
  const nome = corto(a.nome, 60) || "il posto del volo";
  if (a.tipo === "volo_domani" || a.tipo === "volo_oggi") {
    const punto = coordinate(a.coordinate) || (await cercaPosto(a.zona)) || (await cercaPosto(a.nome));
    const m = await meteo(punto, a.data, a.ora);
    const quando = a.tipo === "volo_domani" ? `Domani${a.ora ? ` alle ${a.ora}` : ""}` : `Oggi${a.ora ? ` alle ${a.ora}` : ""}`;
    const dopo = a.tipo === "volo_domani" ? " Carica le batterie e controlla D-Flight." : " Controlla D-Flight prima di decollare.";
    return { titolo: `🛫 ${quando} voli: ${nome}`, testo: (testoMeteo(m) + dopo).slice(0, 220), url: `${APP_URL}/?vai=voli` };
  }
  if (a.tipo === "lavoro_domani") {
    const m = await meteo(coordinate(a.coordinate) || (await cercaPosto(a.luogo)), a.data, null);
    return { titolo: `📅 Domani: ${corto(a.servizio, 40) || "lavoro"} per ${nome}`, testo: `${a.luogo ? `${corto(a.luogo, 60)}. ` : ""}${testoMeteo(m)}`.slice(0, 220), url: `${APP_URL}/?vai=richieste` };
  }
  if (a.tipo === "pagamento") {
    const r = Number(a.ritardo) || 0;
    return { titolo: r ? `💶 ${nome} non ha ancora pagato` : `💶 Oggi scade il pagamento di ${nome}`, testo: `${euro(a.prezzo)}${r ? `, in ritardo di ${r} giorni` : ""}. Se ti ha pagato, segnalalo come pagato, se no mandagli un promemoria da Preventivi.`, url: `${APP_URL}/?vai=preventivi` };
  }
  if (a.tipo === "consegna") {
    const d = a.data ? new Date(`${a.data}T12:00:00`) : null;
    return { titolo: `📦 Consegna il lavoro a ${nome}`, testo: `${corto(a.servizio, 40) || "Il lavoro"}${d ? ` di ${GIORNI_IT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : ""}: carica il link o le foto in «Richieste» e il cliente ti lascia la recensione.`, url: `${APP_URL}/?vai=richieste` };
  }
  if (a.tipo === "pagina") {
    const n = Number(a.richieste) || 0;
    const quanti = n >= 3 ? `Nell'ultimo mese ${n} clienti hanno cercato un pilota su EyeDrones. ` : "";
    return a.ha_pagina
      ? { titolo: "📣 La tua pagina non è ancora visibile", testo: `${quanti}Attivala e compari in «Trova un pilota»: le richieste della tua zona arrivano a te.`, url: `${APP_URL}/?vai=pagina-pilota` }
      : { titolo: "📣 I clienti cercano piloti: fatti trovare", testo: `${quanti}Crea la tua pagina in 2 minuti: compari in «Trova un pilota» e ricevi le richieste della tua zona.`, url: `${APP_URL}/?vai=pagina-pilota` };
  }
  return null;
}

async function togli(segreto, endpoint) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/push_togli`, {
    method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_segreto: segreto, p_endpoint: endpoint }),
  }).catch(() => null);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405 };
  const segreto = process.env.AVVISO_SEGRETO;
  if (!stessoSegreto(event.headers["x-eyedrones-segreto"], segreto)) return { statusCode: 401 };
  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400 }; }
  let inviate = 0;
  for (const a of (Array.isArray(dati.avvisi) ? dati.avvisi : []).slice(0, 300)) {
    const m = await messaggio(a).catch((e) => { console.error("avviso", a.tipo, e.message); return null; });
    if (!m) continue;
    for (const t of (Array.isArray(a.telefoni) ? a.telefoni : []).slice(0, 10)) {
      const esito = await inviaPush(segreto, t, m);
      if (esito === "ok") inviate++;
      if (esito === "via") await togli(segreto, t.endpoint);
    }
  }
  return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviate }) };
};
exports._prova = { messaggio, meteo };
