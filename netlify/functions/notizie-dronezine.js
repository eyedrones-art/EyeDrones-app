// Eyedrones — ultimi articoli di DronEzine (partner) per la scheda «Notizie» e il riquadro in Home.
// Legge il feed RSS del sito e lo restituisce in JSON. La risposta resta in cache un'ora sulla CDN di Netlify,
// così DronEzine riceve al massimo una richiesta all'ora, qualunque sia il numero di utenti.
const FEED = "https://www.dronezine.it/feed/";
const MAX_ARTICOLI = 10;

const ENTITA = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", egrave: "è", eacute: "é", agrave: "à", ograve: "ò", ugrave: "ù", igrave: "ì" };
const decodifica = (t) => String(t || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITA[n.toLowerCase()] ?? m);
const senzaTag = (t) => decodifica(t).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const campo = (xml, nome) => { const m = xml.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, "i")); return m ? m[1] : ""; };

// solo link https del sito di DronEzine (il feed è contenuto esterno)
function linkSicuro(u) {
  try {
    const url = new URL(decodifica(u).trim());
    return url.protocol === "https:" && /(^|\.)dronezine\.it$/i.test(url.hostname) ? url.href : null;
  } catch { return null; }
}
function immagineSicura(u) {
  try {
    const url = new URL(decodifica(u).trim());
    return url.protocol === "https:" ? url.href : null;
  } catch { return null; }
}

function leggiFeed(xml) {
  const voci = xml.split(/<item[\s>]/i).slice(1).map((pezzo) => pezzo.split(/<\/item>/i)[0]);
  return voci.map((v) => {
    const link = linkSicuro(campo(v, "link"));
    const titolo = senzaTag(campo(v, "title")).slice(0, 200);
    if (!link || !titolo) return null;
    const contenuto = decodifica(campo(v, "content:encoded")) + decodifica(campo(v, "description"));
    const img = (v.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i) || v.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image/i) || contenuto.match(/<img[^>]*src="([^"]+)"/i) || [])[1];
    const data = new Date(senzaTag(campo(v, "pubDate")));
    return {
      titolo,
      link,
      data: isNaN(data) ? null : data.toISOString(),
      riassunto: senzaTag(campo(v, "description")).replace(/\s*(L'articolo|The post) .*$/i, "").slice(0, 220),
      immagine: img ? immagineSicura(img) : null,
    };
  }).filter(Boolean).slice(0, MAX_ARTICOLI);
}
exports.leggiFeed = leggiFeed;

exports.handler = async () => {
  try {
    const r = await fetch(FEED, { headers: { "User-Agent": "EyeDrones/1.0 (+https://app.eyedrones.it)", Accept: "application/rss+xml, application/xml, text/xml" } });
    if (!r.ok) throw new Error(`feed ${r.status}`);
    const articoli = leggiFeed(await r.text());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600",
        "Netlify-CDN-Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
      body: JSON.stringify({ fonte: "DronEzine", sito: "https://www.dronezine.it", articoli }),
    };
  } catch (e) {
    return { statusCode: 502, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, body: JSON.stringify({ errore: "Notizie non disponibili", articoli: [] }) };
  }
};
