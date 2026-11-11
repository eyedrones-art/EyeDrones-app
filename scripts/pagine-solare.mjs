// Dopo «vite build»: crea le pagine «Fotovoltaico a <comune>» per tutti i comuni del Piemonte, più una pagina per
// provincia e una per la regione, partendo da public/solare/index.html (calcolatore, assistente e modulo restano gli stessi).
// Ogni pagina ha dati suoi: provincia, CAP, posizione, produzione indicativa per 3 / 4,5 / 6 kW, comuni vicini.
// Elenco comuni: scripts/dati/comuni-piemonte.json (dal pacchetto open source italian-cap-comuni-province, licenza MIT,
// dati ISTAT con coordinate). Le pagine vanno in dist/fotovoltaico/… e in dist/sitemap-fotovoltaico.xml.
import fs from "fs";
import path from "path";

const SITO = "https://app.eyedrones.it";
const DIST = path.resolve("dist");
const base = fs.readFileSync(path.join(DIST, "solare", "index.html"), "utf8");
const comuni = JSON.parse(fs.readFileSync(path.resolve("scripts/dati/comuni-piemonte.json"), "utf8"));
const OGGI = new Date().toISOString().slice(0, 10);

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (t) => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’`]/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const a = (nome) => (/^[aA]/.test(nome) ? `ad ${nome}` : `a ${nome}`);           // «ad Avigliana», «a Torino»
const num = (n) => Math.round(n).toLocaleString("it-IT");
// resa indicativa (kWh l'anno per kW, pannelli orientati bene): la stessa formula della funzione «solare» quando PVGIS non risponde
const resa = (lat) => Math.round(1550 - (lat - 37) * 38);
const PREZZO_KWH = 0.27, PREZZO_VENDITA = 0.09, AUTO = 0.35;
const risparmio = (kw, r) => { const prod = kw * r; return Math.round(prod * AUTO * PREZZO_KWH + prod * (1 - AUTO) * PREZZO_VENDITA); };
const km = (x, y) => { const R = 6371, d = Math.PI / 180; const h = Math.sin(((y.lat - x.lat) * d) / 2) ** 2 + Math.cos(x.lat * d) * Math.cos(y.lat * d) * Math.sin(((y.lon - x.lon) * d) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

function sostituisci(html, cerca, nuovo) {
  if (!cerca.test(html)) throw new Error(`pagine-solare: non trovo ${cerca}`);
  return html.replace(cerca, nuovo);
}

// indirizzi: /fotovoltaico/<comune>, /fotovoltaico/provincia-di-<provincia>, /fotovoltaico/piemonte
const usati = new Set();
for (const c of comuni) { let s = slug(c.nome); if (usati.has(s)) s = `${s}-${c.sigla.toLowerCase()}`; usati.add(s); c.slug = s; }
const province = [...new Map(comuni.map((c) => [c.sigla, c.provincia])).entries()].map(([sigla, nome]) => ({ sigla, nome, slug: `provincia-di-${slug(nome)}`, comuni: comuni.filter((c) => c.sigla === sigla) })).sort((x, y) => x.nome.localeCompare(y.nome, "it"));
const urlComune = (c) => `/fotovoltaico/${c.slug}`;

function pagina({ percorso, titolo, descrizione, testa, locale, link, prefill, domande }) {
  const url = `${SITO}${percorso}`;
  let h = base;
  h = sostituisci(h, /<title>[\s\S]*?<\/title>/, `<title>${esc(titolo)}</title>`);
  h = sostituisci(h, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(descrizione)}">`);
  h = sostituisci(h, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(titolo)}">`);
  h = sostituisci(h, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(descrizione)}">`);
  h = sostituisci(h, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">\n<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${url}#pagina`, url, name: titolo, description: descrizione, inLanguage: "it", isPartOf: { "@type": "WebSite", name: "EyeDrones", url: `${SITO}/` } },
      ...(domande && domande.length ? [{ "@type": "FAQPage", mainEntity: domande.map(([d, r]) => ({ "@type": "Question", name: d, acceptedAnswer: { "@type": "Answer", text: r } })) }] : []),
    ],
  }).replace(/</g, "\\u003c")}</script>`);
  h = sostituisci(h, /<!--TESTA-->[\s\S]*?<!--\/TESTA-->/, testa);
  h = sostituisci(h, /<!--LOCALE--><!--\/LOCALE-->/, locale);
  h = sostituisci(h, /<!--LINK--><!--\/LINK-->/, link);
  if (prefill) h = sostituisci(h, /required value="">/, `required value="${esc(prefill)}">`);
  const file = path.join(DIST, `${percorso.replace(/^\//, "")}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, h);
  return url;
}

const faq = (luogo, r) => [
  [`Quanto produce un impianto fotovoltaico ${luogo}?`, `Indicativamente circa ${num(r)} kWh l'anno per ogni kW installato, con pannelli orientati a sud e senza ombre. Un impianto da 3 kW produce circa ${num(3 * r)} kWh l'anno. Con il calcolatore di questa pagina ottieni la stima per il tuo indirizzo con i dati solari ufficiali europei (PVGIS).`],
  ["Quanto si risparmia con il fotovoltaico?", "Dipende da quanta energia usi mentre i pannelli producono: senza batteria se ne usa in casa circa un terzo, con la batteria molto di più. Il calcolatore ti dà una stima dalla tua bolletta; il preventivo dell'installatore la precisa."],
  ["A cosa serve il sopralluogo con il drone?", "Il drone fotografa il tetto dall'alto: orientamento, spazio libero, ombre di alberi e camini, stato delle tegole. Nessuno deve salire sul tetto e l'installatore prepara un preventivo più preciso."],
  ["Ci sono incentivi o detrazioni?", "Incentivi e detrazioni cambiano spesso: l'installatore ti dice cosa vale oggi per il tuo caso, prima di firmare."],
];
const schedaNumeri = (luogo, r) => `<div class="scheda tab-scroll"><table class="tabella"><tr><th>Impianto</th><th>Pannelli (circa)</th><th>Energia in un anno</th><th>Risparmio indicativo</th></tr>${[3, 4.5, 6].map((kw) => `<tr><td>${String(kw).replace(".", ",")} kW</td><td>${Math.ceil((kw * 1000) / 450)}</td><td>${num(kw * r)} kWh</td><td>circa ${num(risparmio(kw, r))} € l'anno</td></tr>`).join("")}</table>
      <p class="nota">Stime indicative per ${esc(luogo)}: ${num(r)} kWh per kW, pannelli orientati bene, autoconsumo 35% senza batteria, 0,27 €/kWh in bolletta e 0,09 €/kWh per l'energia ceduta. Per il tuo tetto usa il calcolatore qui sopra.</p></div>`;
const blocchiFaq = (domande) => `<div class="faq">${domande.map(([d, r]) => `<h3>${esc(d)}</h3><p>${esc(r)}</p>`).join("")}</div>`;

const urls = [];
// ---------- comuni ----------
for (const c of comuni) {
  const r = resa(c.lat);
  const vicini = comuni.filter((x) => x !== c).map((x) => [x, km(c, x)]).sort((x, y) => x[1] - y[1]).slice(0, 8);
  const prov = province.find((p) => p.sigla === c.sigla);
  const luogo = a(c.nome);
  const domande = faq(luogo, r);
  urls.push(pagina({
    percorso: urlComune(c),
    titolo: `Fotovoltaico ${luogo} (${c.sigla}): quanto produce il tuo tetto`,
    descrizione: `Fotovoltaico ${luogo}: circa ${num(r)} kWh l'anno per kW. Calcola produzione e risparmio per il tuo tetto, chiedi il sopralluogo con il drone e il preventivo di un installatore della zona.`,
    testa: `<h1>Fotovoltaico ${esc(luogo)}: <span>il tuo tetto, visto dal drone.</span></h1>
    <p>${esc(c.nome)} (${esc(c.provincia)}): ogni kW di pannelli produce circa ${num(r)} kWh l'anno. Calcola quanto produce e quanto risparmi con il tuo tetto; se ti interessa, un pilota lo fotografa dall'alto e un installatore della zona ti prepara il preventivo.</p>`,
    locale: `<section class="sezione"><h2>Il fotovoltaico ${esc(luogo)} in numeri</h2>
      <p class="sotto">${esc(c.nome)}, provincia di ${esc(c.provincia)}${c.cap.length ? `, CAP ${esc(c.cap.slice(0, 3).join(", "))}${c.cap.length > 3 ? "…" : ""}` : ""}${c.kmq ? `, ${String(c.kmq).replace(".", ",")} km²` : ""}. Posizione ${c.lat.toFixed(3).replace(".", ",")}° N, ${c.lon.toFixed(3).replace(".", ",")}° E.</p>
      ${schedaNumeri(c.nome, r)}
      <h2 style="margin-top:26px">Domande frequenti</h2>${blocchiFaq(domande)}</section>`,
    link: `<b>Comuni vicini:</b><span class="vicini">${vicini.map(([x, d]) => `<a href="${urlComune(x)}">${esc(x.nome)}</a>`).join("")}</span><a href="/fotovoltaico/${prov.slug}">Fotovoltaico in provincia di ${esc(c.provincia)}</a> · <a href="/fotovoltaico/piemonte">Piemonte</a><br>`,
    prefill: c.nome,
    domande,
  }));
}
// ---------- province ----------
for (const p of province) {
  const latMedia = p.comuni.reduce((s, c) => s + c.lat, 0) / p.comuni.length;
  const r = resa(latMedia);
  const capo = p.comuni.find((c) => c.capoluogo) || p.comuni.find((c) => c.nome === p.nome);
  const domande = faq(`in provincia di ${p.nome}`, r);
  urls.push(pagina({
    percorso: `/fotovoltaico/${p.slug}`,
    titolo: `Fotovoltaico in provincia di ${p.nome}: produzione, risparmio e preventivo`,
    descrizione: `Fotovoltaico in provincia di ${p.nome}: circa ${num(r)} kWh l'anno per kW. Calcola produzione e risparmio del tuo tetto e chiedi il sopralluogo con il drone. ${p.comuni.length} comuni.`,
    testa: `<h1>Fotovoltaico in provincia di ${esc(p.nome)}: <span>il tuo tetto, visto dal drone.</span></h1>
    <p>In provincia di ${esc(p.nome)} ogni kW di pannelli produce in media circa ${num(r)} kWh l'anno. Calcola quanto produce il tuo tetto e chiedi il sopralluogo con il drone e il preventivo.</p>`,
    locale: `<section class="sezione"><h2>Il fotovoltaico in provincia di ${esc(p.nome)}</h2>${schedaNumeri(`la provincia di ${p.nome}`, r)}
      <h2 style="margin-top:26px">Scegli il tuo comune</h2><p class="vicini">${p.comuni.map((c) => `<a href="${urlComune(c)}">${esc(c.nome)}</a>`).join("")}</p>
      <h2 style="margin-top:26px">Domande frequenti</h2>${blocchiFaq(domande)}</section>`,
    link: `<b>Altre province:</b><span class="vicini">${province.filter((x) => x !== p).map((x) => `<a href="/fotovoltaico/${x.slug}">${esc(x.nome)}</a>`).join("")}</span><a href="/fotovoltaico/piemonte">Piemonte</a><br>`,
    prefill: capo ? capo.nome : "",
    domande,
  }));
}
// ---------- regione ----------
{
  const r = resa(comuni.reduce((s, c) => s + c.lat, 0) / comuni.length);
  const domande = faq("in Piemonte", r);
  urls.push(pagina({
    percorso: "/fotovoltaico/piemonte",
    titolo: "Fotovoltaico in Piemonte: quanto produce il tuo tetto e quanto risparmi",
    descrizione: `Fotovoltaico in Piemonte: circa ${num(r)} kWh l'anno per kW in media. Calcola produzione e risparmio del tuo tetto in ogni comune e chiedi il sopralluogo con il drone.`,
    testa: `<h1>Fotovoltaico in Piemonte: <span>il tuo tetto, visto dal drone.</span></h1>
    <p>In Piemonte ogni kW di pannelli produce in media circa ${num(r)} kWh l'anno, un po' di più al sud e in pianura. Calcola quanto produce il tuo tetto e chiedi il sopralluogo con il drone e il preventivo.</p>`,
    locale: `<section class="sezione"><h2>Il fotovoltaico in Piemonte</h2>${schedaNumeri("il Piemonte", r)}
      <h2 style="margin-top:26px">Scegli la tua provincia</h2><p class="vicini">${province.map((p) => `<a href="/fotovoltaico/${p.slug}">${esc(p.nome)} (${p.comuni.length} comuni)</a>`).join("")}</p>
      <h2 style="margin-top:26px">Domande frequenti</h2>${blocchiFaq(domande)}</section>`,
    link: "",
    prefill: "",
    domande,
  }));
}

fs.writeFileSync(path.join(DIST, "sitemap-fotovoltaico.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[`${SITO}/solare`, ...urls].map((u) => `  <url><loc>${u}</loc><lastmod>${OGGI}</lastmod></url>`).join("\n")}\n</urlset>\n`);
console.log(`pagine fotovoltaico: ${urls.length} (${comuni.length} comuni, ${province.length} province, 1 regione)`);
