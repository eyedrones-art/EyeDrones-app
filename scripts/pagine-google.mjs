// Dopo «vite build»: crea una pagina HTML per ogni indirizzo di «Trova un pilota» (generale, per servizio, per provincia)
// con titolo, descrizione, indirizzo canonico, domande frequenti e link giusti. Così Google le legge subito come pagine
// diverse, senza aspettare che parta l'app. L'app poi parte normalmente e sostituisce il contenuto.
import fs from "fs";
import path from "path";
import { PROVINCE_ITALIA, SEO_TROVA, SEO_TROVA_GENERALE } from "../src/seoTrovaPilota.js";

const SITO = "https://app.eyedrones.it";
const DIST = path.resolve("dist");
const base = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const province = Object.entries(PROVINCE_ITALIA).sort((a, b) => a[1].localeCompare(b[1], "it"));
const NOMI = { matrimoni: "Matrimoni", case: "Case e terreni", aziende: "Aziende", ispezioni: "Ispezioni", agricoltura: "Agricoltura" };

function sostituisci(html, cerca, nuovo) {
  if (!cerca.test(html)) throw new Error(`Non trovo ${cerca} in dist/index.html`);
  return html.replace(cerca, nuovo);
}

function pagina({ percorso, titolo, descrizione, h1, sottotitolo, immagine, domande, link }) {
  const url = `${SITO}${percorso}`;
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
  const corpo = `<div id="root">
      <main style="max-width: 640px; margin: 0 auto; padding: 48px 20px; color: #e7eaee; font-family: 'IBM Plex Sans', system-ui, sans-serif; line-height: 1.55;">
        <p style="color: #ffb877; font-size: 12px; letter-spacing: .14em; margin: 0 0 8px 0;">EYEDRONES · TROVA UN PILOTA</p>
        <h1 style="font-size: 26px; margin: 0 0 10px 0;">${esc(h1)}</h1>
        <p style="color: #c3cad4; margin: 0 0 16px 0;">${esc(sottotitolo)}</p>
        <p><a href="${percorso}" style="color: #ff8c42;">Ricevi le offerte dei piloti della zona →</a></p>
        ${domande && domande.length ? `<h2 style="font-size: 20px; margin: 24px 0 8px 0;">Le domande di tutti</h2>
        ${domande.map(([d, r]) => `<h3 style="font-size: 16px; margin: 14px 0 4px 0;">${esc(d)}</h3><p style="color: #c3cad4; margin: 0;">${esc(r)}</p>`).join("\n        ")}` : ""}
        ${link.map(([titoloLink, voci]) => `<h2 style="font-size: 18px; margin: 24px 0 8px 0;">${esc(titoloLink)}</h2>
        <p style="color: #9aa4b1; margin: 0;">${voci.map(([t, u]) => `<a href="${u}" style="color: #9fc5ff;">${esc(t)}</a>`).join(" · ")}</p>`).join("\n        ")}
      </main>
    </div>`;
  h = sostituisci(h, /<div id="root">[\s\S]*?<\/main>\s*<\/div>/, corpo);
  // la pagina va in dist/_pagine/... e Netlify la serve all'indirizzo vero con una riscrittura (status 200) in _redirects:
  // così l'indirizzo resta identico a quello canonico, senza la «/» finale che Netlify aggiunge alle cartelle
  const file = path.join(DIST, "_pagine", `${percorso.replace(/^\//, "")}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, h);
  riscritture.push(`${percorso}  /_pagine${percorso}.html  200`, `${percorso}/  /_pagine${percorso}.html  200`);
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
  pagina({ percorso: `/trova-pilota/${s}`, titolo: G.titoloPagina(nome), descrizione: G.descrizionePagina(nome), h1: G.h1Provincia(nome), sottotitolo: G.sottotitolo, link: linkServizi(s) }); n++;
}
// pagine per servizio, anche per provincia
for (const k of sezioni) {
  const S = SEO_TROVA[k];
  pagina({ percorso: `/trova-pilota/${k}`, titolo: S.titoloPagina(""), descrizione: S.descrizionePagina(""), h1: S.h1, sottotitolo: S.sottotitolo, immagine: S.immagine, domande: S.domande, link: [...linkServizi(""), ...linkProvince(`/trova-pilota/${k}`)] }); n++;
  for (const [sigla, nome] of province) {
    const s = sigla.toLowerCase();
    pagina({ percorso: `/trova-pilota/${k}/${s}`, titolo: S.titoloPagina(nome), descrizione: S.descrizionePagina(nome), h1: S.h1Provincia(nome), sottotitolo: S.sottotitolo, immagine: S.immagine, domande: S.domande, link: linkServizi(s) }); n++;
  }
}
// le riscritture vanno prima delle regole di netlify.toml (/trova-pilota/* → index.html), che restano per tutto il resto
const fileRedirects = path.join(DIST, "_redirects");
const prima = fs.existsSync(fileRedirects) ? fs.readFileSync(fileRedirects, "utf8") : "";
// trovapilota.it (indirizzo corto da volantini e annunci): porta sempre a Trova un pilota su app.eyedrones.it,
// così le pagine per Google restano su un solo dominio. trovapilota.it/to → /trova-pilota/to
const dominiCorti = ["https://trovapilota.it", "https://www.trovapilota.it", "http://trovapilota.it", "http://www.trovapilota.it"]
  .flatMap((d) => [`${d}/ https://app.eyedrones.it/trova-pilota 301!`, `${d}/* https://app.eyedrones.it/trova-pilota/:splat 301!`]);
// ortaly.it (mercato dei produttori): mostra l'app public/ortaly/index.html (con il suo supabase.js e l'avviso degli ordini)
// restando su ortaly.it; http e www passano prima a https://ortaly.it
const ortaly = [
  ...["http://ortaly.it", "http://www.ortaly.it", "https://www.ortaly.it"].map((d) => `${d}/* https://ortaly.it/:splat 301!`),
  "https://ortaly.it/supabase.js /ortaly/supabase.js 200!",
  "https://ortaly.it/ortaly-avviso /.netlify/functions/ortaly-avviso 200!",
  "https://ortaly.it/* /ortaly/index.html 200!",
];
fs.writeFileSync(fileRedirects, `# indirizzo corto trovapilota.it\n${dominiCorti.join("\n")}\n# ortaly.it\n${ortaly.join("\n")}\n# pagine per Google create da scripts/pagine-google.mjs\n${riscritture.join("\n")}\n${prima}`);
console.log(`pagine per Google: ${n} (riscritture: ${riscritture.length})`);

// Tutti gli altri indirizzi (home, pagine dei piloti /p/<nome>, ...) usano dist/index.html: lì l'indirizzo canonico
// fisso diceva a Google «la pagina vera è la home» anche per la pagina di un pilota. Lo scrive invece il browser,
// con l'indirizzo della pagina aperta (senza ?ref=... e simili).
const canonicoDinamico = `<script>(function(){var l=document.createElement("link");l.rel="canonical";l.href="${SITO}"+(location.pathname.replace(/\\/+$/,"")||"/");document.head.appendChild(l);})();</script>`;
fs.writeFileSync(path.join(DIST, "index.html"), sostituisci(base, /<link rel="canonical" href="[^"]*"\s*\/?>/, canonicoDinamico));
