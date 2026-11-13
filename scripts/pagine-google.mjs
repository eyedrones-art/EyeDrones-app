// Dopo «vite build»: crea una pagina HTML per ogni indirizzo di «Trova un pilota» (generale, per servizio, per provincia)
// con titolo, descrizione, indirizzo canonico, domande frequenti e link giusti. Così Google le legge subito come pagine
// diverse, senza aspettare che parta l'app. L'app poi parte normalmente e sostituisce il contenuto.
import fs from "fs";
import path from "path";
import { PROVINCE_ITALIA, SEO_TROVA, SEO_TROVA_GENERALE } from "../src/seoTrovaPilota.js";

const SITO = "https://app.eyedrones.it";
// trovapilota.it è l'indirizzo di «Trova un pilota» per i clienti: trovapilota.it/to = app.eyedrones.it/trova-pilota/to.
// Con TROVAPILOTA_PRINCIPALE=1 su Netlify (da mettere solo quando il dominio è collegato e funziona) diventa anche
// l'indirizzo che Google mostra: le pagine dicono di essere su trovapilota.it e app.eyedrones.it/trova-pilota rimanda lì.
const TP = "https://trovapilota.it";
const TP_PRINCIPALE = process.env.TROVAPILOTA_PRINCIPALE === "1";
const corto = (percorso) => percorso.replace(/^\/trova-pilota/, "") || "/";
const indirizzo = (percorso) => (TP_PRINCIPALE ? `${TP}${corto(percorso)}` : `${SITO}${percorso}`);
const linkTP = (percorso) => (TP_PRINCIPALE ? corto(percorso) : percorso);
const regoleTP = [];
const urlsTP = [];
const DIST = path.resolve("dist");
const base = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const province = Object.entries(PROVINCE_ITALIA).sort((a, b) => a[1].localeCompare(b[1], "it"));
const NOMI = { matrimoni: "Matrimoni", case: "Case e terreni", aziende: "Aziende", ispezioni: "Ispezioni", agricoltura: "Agricoltura" };

function sostituisci(html, cerca, nuovo) {
  if (!cerca.test(html)) throw new Error(`Non trovo ${cerca} in dist/index.html`);
  return html.replace(cerca, nuovo);
}

// Piemonte (dove c'è EyeDrones): nelle pagine per provincia anche i comuni principali e una domanda in più sul posto,
// così non sono pagine tutte uguali e chi cerca «drone Moncalieri» trova la provincia giusta
const COMUNI_PIEMONTE = JSON.parse(fs.readFileSync(path.resolve("scripts/dati/comuni-piemonte.json"), "utf8"));
const AEROPORTI = { TO: "aeroporto di Torino-Caselle", CN: "aeroporto di Cuneo-Levaldigi" };
function locale(sigla) {
  const comuni = COMUNI_PIEMONTE.filter((c) => c.sigla === sigla).sort((a, b) => (b.abitanti || 0) - (a.abitanti || 0));
  if (!comuni.length) return null;
  const capoluogo = comuni.find((c) => c.capoluogo) || comuni[0];
  const principali = comuni.slice(0, 14).map((c) => c.nome);
  const aeroporto = AEROPORTI[sigla];
  return {
    testo: `I piloti EyeDrones lavorano in tutta la provincia di ${capoluogo.provincia} (${comuni.length} comuni), anche a ${principali.slice(0, 6).join(", ")} e dintorni.`,
    comuni: principali,
    domanda: [`Si può volare con il drone a ${capoluogo.nome} e in provincia?`, `Sì, in gran parte della provincia. Ci sono zone con limiti o permessi${aeroporto ? `, per esempio vicino all'${aeroporto}` : ", per esempio vicino agli aeroporti"} e in alcune aree protette o centri abitati: il pilota controlla la zona su D-Flight prima del lavoro e, se servono, chiede i permessi. Voi raccontate solo cosa vi serve.`],
  };
}

function pagina({ percorso, titolo, descrizione, h1, sottotitolo, immagine, domande, link, posto }) {
  if (posto) domande = [...(domande || []), posto.domanda];
  const url = indirizzo(percorso);
  const grafo = [
    { "@type": "Organization", "@id": `${SITO}/#org`, name: "EyeDrones", url: `${SITO}/`, logo: `${SITO}/icon-512.png` },
    { "@type": "WebPage", "@id": `${url}#pagina`, url, name: titolo, description: descrizione, inLanguage: "it", isPartOf: { "@id": `${SITO}/#org` } },
    ...(domande && domande.length ? [{ "@type": "FAQPage", mainEntity: domande.map(([d, r]) => ({ "@type": "Question", name: d, acceptedAnswer: { "@type": "Answer", text: r } })) }] : []),
  ];
  let h = base;
  h = sostituisci(h, /<title>[\s\S]*?<\/title>/, `<title>${esc(titolo)}</title>`);
  h = sostituisci(h, /<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(descrizione)}" />`);
  h = sostituisci(h, /<link rel="canonical" href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);
  h = sostituisci(h, /<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(titolo)}" />`);
  h = sostituisci(h, /<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(descrizione)}" />`);
  h = sostituisci(h, /<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${url}" />`);
  if (immagine) h = sostituisci(h, /<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${SITO}${immagine}" />`);
  h = sostituisci(h, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": grafo }).replace(/</g, "\\u003c")}</script>`);
  // come in index.html: con JavaScript acceso si vede il logo di avvio e il testo per Google resta nascosto finché parte l'app
  const corpo = `<div id="root">
      <div class="avvio" aria-hidden="true"><img src="/icon-192.png" alt="" /><span>EyeDrones</span></div>
      <main id="testo-google" style="max-width: 640px; margin: 0 auto; padding: 48px 20px; color: #e7eaee; font-family: 'IBM Plex Sans', system-ui, sans-serif; line-height: 1.55;">
        <p style="color: #ffb877; font-size: 12px; letter-spacing: .14em; margin: 0 0 8px 0;">EYEDRONES · TROVA UN PILOTA</p>
        <h1 style="font-size: 26px; margin: 0 0 10px 0;">${esc(h1)}</h1>
        <p style="color: #c3cad4; margin: 0 0 16px 0;">${esc(sottotitolo)}</p>
        <p><a href="${linkTP(percorso)}" style="color: #ff8c42;">Ricevi le offerte dei piloti della zona →</a></p>
        ${posto ? `<p style="color: #c3cad4; margin: 0 0 8px 0;">${esc(posto.testo)}</p>
        <p style="color: #9aa4b1; font-size: 14px; margin: 0 0 16px 0;">Comuni principali: ${posto.comuni.map(esc).join(", ")}.</p>` : ""}
        ${domande && domande.length ? `<h2 style="font-size: 20px; margin: 24px 0 8px 0;">Le domande di tutti</h2>
        ${domande.map(([d, r]) => `<h3 style="font-size: 16px; margin: 14px 0 4px 0;">${esc(d)}</h3><p style="color: #c3cad4; margin: 0;">${esc(r)}</p>`).join("\n        ")}` : ""}
        ${link.map(([titoloLink, voci]) => `<h2 style="font-size: 18px; margin: 24px 0 8px 0;">${esc(titoloLink)}</h2>
        <p style="color: #9aa4b1; margin: 0;">${voci.map(([t, u]) => `<a href="${linkTP(u)}" style="color: #9fc5ff;">${esc(t)}</a>`).join(" · ")}</p>`).join("\n        ")}
      </main>
    </div>`;
  h = sostituisci(h, /<div id="root">[\s\S]*?<\/main>\s*<\/div>/, corpo);
  // la pagina va in dist/_pagine/... e Netlify la serve all'indirizzo vero con una riscrittura (status 200) in _redirects:
  // così l'indirizzo resta identico a quello canonico, senza la «/» finale che Netlify aggiunge alle cartelle
  const file = path.join(DIST, "_pagine", `${percorso.replace(/^\//, "")}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, h);
  riscritture.push(`${percorso}  /_pagine${percorso}.html  200`, `${percorso}/  /_pagine${percorso}.html  200`);
  // la stessa pagina su trovapilota.it, con l'indirizzo corto
  const c = corto(percorso);
  regoleTP.push(`${TP}${c}  /_pagine${percorso}.html  200!`);
  urlsTP.push(`${TP}${c === "/" ? "/" : c}`);
  if (c !== "/") regoleTP.push(`${TP}${c}/  /_pagine${percorso}.html  200!`);
}
const riscritture = [];

const sezioni = Object.keys(SEO_TROVA);
const linkServizi = (sigla) => [["Servizi", [["Tutti i servizi", sigla ? `/trova-pilota/${sigla}` : "/trova-pilota"], ...sezioni.map((k) => [NOMI[k] || k, sigla ? `/trova-pilota/${k}/${sigla}` : `/trova-pilota/${k}`])]]];
const linkProvince = (prefisso) => [["Per provincia", province.map(([sigla, nome]) => [nome, `${prefisso}/${sigla.toLowerCase()}`])]];
let n = 0;

// pagina generale e per provincia
const G = SEO_TROVA_GENERALE;
pagina({ percorso: "/trova-pilota", titolo: G.titoloPagina(""), descrizione: G.descrizionePagina(""), h1: G.h1, sottotitolo: G.sottotitolo, link: [...linkServizi(""), ...linkProvince("/trova-pilota")] }); n++;
for (const [sigla, nome] of province) {
  const s = sigla.toLowerCase();
  pagina({ percorso: `/trova-pilota/${s}`, titolo: G.titoloPagina(nome), descrizione: G.descrizionePagina(nome), h1: G.h1Provincia(nome), sottotitolo: G.sottotitolo, link: linkServizi(s), posto: locale(sigla) }); n++;
}
// pagine per servizio, anche per provincia
for (const k of sezioni) {
  const S = SEO_TROVA[k];
  pagina({ percorso: `/trova-pilota/${k}`, titolo: S.titoloPagina(""), descrizione: S.descrizionePagina(""), h1: S.h1, sottotitolo: S.sottotitolo, immagine: S.immagine, domande: S.domande, link: [...linkServizi(""), ...linkProvince(`/trova-pilota/${k}`)] }); n++;
  for (const [sigla, nome] of province) {
    const s = sigla.toLowerCase();
    pagina({ percorso: `/trova-pilota/${k}/${s}`, titolo: S.titoloPagina(nome), descrizione: S.descrizionePagina(nome), h1: S.h1Provincia(nome), sottotitolo: S.sottotitolo, immagine: S.immagine, domande: S.domande, link: linkServizi(s), posto: locale(sigla) }); n++;
  }
}
// le riscritture vanno prima delle regole di netlify.toml (/trova-pilota/* → index.html), che restano per tutto il resto
const fileRedirects = path.join(DIST, "_redirects");
const prima = fs.existsSync(fileRedirects) ? fs.readFileSync(fileRedirects, "utf8") : "";
// trovapilota.it: www e http portano all'indirizzo giusto; le pagine si aprono con l'indirizzo corto;
// i vecchi link trovapilota.it/trova-pilota/... diventano corti (senza «!»: le immagini in /trova-pilota/ restano dove sono).
// Tutto il resto (I miei lavori, offerte, privacy) usa le stesse regole dell'app (netlify.toml).
const testaTP = [
  "https://www.trovapilota.it/*  https://trovapilota.it/:splat  301!",
  "http://www.trovapilota.it/*  https://trovapilota.it/:splat  301!",
  ...regoleTP,
  `${TP}/trova-pilota/*  ${TP}/:splat  301`,
  `${TP}/trova-pilota  ${TP}/  301!`,
];
// quando trovapilota.it è l'indirizzo principale, app.eyedrones.it/trova-pilota rimanda lì (le immagini no: sono file veri)
const rimandiApp = TP_PRINCIPALE ? [`${SITO}/trova-pilota  ${TP}/  301!`, `${SITO}/trova-pilota/*  ${TP}/:splat  301`] : [];
fs.writeFileSync(fileRedirects, `# trovapilota.it: Trova un pilota per i clienti\n${testaTP.join("\n")}\n${rimandiApp.join("\n")}\n# pagine per Google create da scripts/pagine-google.mjs\n${riscritture.join("\n")}\n${prima}`);
// mappa per Google delle pagine su trovapilota.it (la legge Search Console della proprietà trovapilota.it)
if (TP_PRINCIPALE) {
  const oggi = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(DIST, "sitemap-trovapilota.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsTP.map((u) => `  <url><loc>${u}</loc><lastmod>${oggi}</lastmod></url>`).join("\n")}\n</urlset>\n`);
  // nella mappa di app.eyedrones.it le pagine di Trova un pilota non ci sono più (ora sono su trovapilota.it)
  const fm = path.join(DIST, "sitemap.xml");
  if (fs.existsSync(fm)) fs.writeFileSync(fm, fs.readFileSync(fm, "utf8").replace(/\s*<url>\s*<loc>https:\/\/app\.eyedrones\.it\/trova-pilota[^<]*<\/loc>[\s\S]*?<\/url>/g, ""));
  const fr = path.join(DIST, "robots.txt");
  if (fs.existsSync(fr) && !/sitemap-trovapilota/.test(fs.readFileSync(fr, "utf8"))) fs.appendFileSync(fr, `\nSitemap: ${TP}/sitemap-trovapilota.xml\n`);
}
console.log(`pagine per Google: ${n} (riscritture: ${riscritture.length})`);

// Tutti gli altri indirizzi (home, pagine dei piloti /p/<nome>, ...) usano dist/index.html: lì l'indirizzo canonico
// fisso diceva a Google «la pagina vera è la home» anche per la pagina di un pilota. Lo scrive invece il browser,
// con l'indirizzo della pagina aperta (senza ?ref=... e simili).
const canonicoDinamico = `<script>(function(){var l=document.createElement("link");l.rel="canonical";l.href="${SITO}"+(location.pathname.replace(/\\/+$/,"")||"/");document.head.appendChild(l);})();</script>`;
fs.writeFileSync(path.join(DIST, "index.html"), sostituisci(base, /<link rel="canonical" href="[^"]*"\s*\/?>/, canonicoDinamico));
