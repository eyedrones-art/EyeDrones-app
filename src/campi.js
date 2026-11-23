// Agricoltura: lettura dei confini degli appezzamenti (KML, KMZ, GeoJSON, SHP in zip), ettari e meteo per i trattamenti.
// Tutto gira nel telefono: i file dei confini non vengono caricati da nessuna parte, salvo i poligoni nell'account.

// --- Confini ---------------------------------------------------------------------------------------

// nome del campo dalle proprietà del file (ogni programma usa un nome diverso)
const nomeDa = (p, i) => {
  const chiavi = ["name", "Name", "NAME", "nome", "Nome", "NOME", "label", "Label", "descr", "DESCR", "campo", "CAMPO", "id", "ID"];
  for (const k of chiavi) if (p && p[k] != null && String(p[k]).trim()) return String(p[k]).trim().slice(0, 80);
  return `Campo ${i + 1}`;
};

// tengo solo poligoni e multipoligoni (i punti e le linee non sono appezzamenti), con coordinate [lon, lat]
function soloPoligoni(geojson) {
  const features = geojson.type === "FeatureCollection" ? geojson.features : geojson.type === "Feature" ? [geojson] : [{ type: "Feature", properties: {}, geometry: geojson }];
  const out = [];
  features.forEach((f, i) => {
    const g = f && f.geometry;
    if (!g) return;
    if (g.type === "Polygon" || g.type === "MultiPolygon") out.push({ nome: nomeDa(f.properties, i), geometry: pulisciGeometria(g) });
    else if (g.type === "GeometryCollection") (g.geometries || []).filter((x) => x.type === "Polygon" || x.type === "MultiPolygon").forEach((x) => out.push({ nome: nomeDa(f.properties, i), geometry: pulisciGeometria(x) }));
  });
  return out;
}

// via la quota (z) e i numeri con troppe cifre: il poligono pesa meno nel database
const arrotonda = (c) => [Math.round(c[0] * 1e7) / 1e7, Math.round(c[1] * 1e7) / 1e7];
function pulisciGeometria(g) {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates.map((r) => r.map(arrotonda)) };
  return { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map((r) => r.map(arrotonda))) };
}

// KML (Google Earth, DJI Terra, SmartFarm): Placemark con Polygon, anche dentro MultiGeometry
function leggiKml(testo) {
  const doc = new DOMParser().parseFromString(testo, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Il file KML non è leggibile.");
  const coord = (el) => (el ? el.textContent.trim().split(/\s+/).map((t) => t.split(",").map(Number)).filter((c) => c.length >= 2 && !Number.isNaN(c[0]) && !Number.isNaN(c[1])).map((c) => [c[0], c[1]]) : []);
  const anello = (lr) => { const r = coord(lr.getElementsByTagName("coordinates")[0]); if (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]); return r; };
  const out = [];
  const placemarks = [...doc.getElementsByTagName("Placemark")];
  placemarks.forEach((pm, i) => {
    const nomeEl = [...pm.children].find((c) => c.localName === "name");
    const poligoni = [...pm.getElementsByTagName("Polygon")].map((pg) => {
      const esterno = pg.getElementsByTagName("outerBoundaryIs")[0];
      const ext = esterno ? anello(esterno.getElementsByTagName("LinearRing")[0]) : [];
      const buchi = [...pg.getElementsByTagName("innerBoundaryIs")].map((ib) => anello(ib.getElementsByTagName("LinearRing")[0])).filter((r) => r.length >= 4);
      return ext.length >= 4 ? [ext, ...buchi] : null;
    }).filter(Boolean);
    if (!poligoni.length) return;
    const geometry = poligoni.length === 1 ? { type: "Polygon", coordinates: poligoni[0] } : { type: "MultiPolygon", coordinates: poligoni };
    out.push({ nome: nomeEl && nomeEl.textContent.trim() ? nomeEl.textContent.trim().slice(0, 80) : `Campo ${i + 1}`, geometry: pulisciGeometria(geometry) });
  });
  return out;
}

// legge un file di confini e restituisce [{ nome, geometry, ettari, centro }]
export async function leggiFileConfini(file) {
  const nome = (file.name || "").toLowerCase();
  let campi;
  if (nome.endsWith(".kml")) campi = leggiKml(await file.text());
  else if (nome.endsWith(".geojson") || nome.endsWith(".json")) campi = soloPoligoni(JSON.parse(await file.text()));
  else if (nome.endsWith(".kmz")) {
    const { iter } = await import("but-unzip");
    const byte = new Uint8Array(await file.arrayBuffer());
    let kml = null;
    for (const e of iter(byte)) if (/\.kml$/i.test(e.filename || e.name || "")) { kml = new TextDecoder().decode(await e.read()); break; }
    if (!kml) throw new Error("Nel file KMZ non c'è nessun KML.");
    campi = leggiKml(kml);
  } else if (nome.endsWith(".zip")) {
    // shapefile: lo zip deve avere .shp, .dbf e (meglio) .prj, così le coordinate vengono convertite in automatico
    const { default: shp } = await import("shpjs");
    const risultato = await shp(await file.arrayBuffer());
    campi = (Array.isArray(risultato) ? risultato : [risultato]).flatMap(soloPoligoni);
  } else if (nome.endsWith(".shp")) {
    throw new Error("Per lo shapefile carica lo zip con tutti i file insieme (.shp, .dbf, .prj, .shx).");
  } else {
    throw new Error("Formato non riconosciuto: usa KML, KMZ, GeoJSON oppure lo shapefile in uno zip.");
  }
  campi = campi.filter((c) => fuoriDalMondo(c.geometry) === false);
  if (!campi.length) throw new Error("Nel file non ho trovato nessun poligono (confine di un campo).");
  return campi.map((c) => ({ ...c, ettari: ettariDi(c.geometry), centro: centroDi(c.geometry) }));
}

// coordinate fuori da lat/lon (shapefile senza .prj, in metri): meglio dirlo che mettere il campo in mezzo all'oceano
function fuoriDalMondo(g) {
  const tutti = anelli(g).flat();
  return tutti.some(([lon, lat]) => Math.abs(lon) > 180 || Math.abs(lat) > 90);
}

const anelli = (g) => (g.type === "Polygon" ? g.coordinates : g.coordinates.flat());

// area di un anello sulla sfera (stesso metodo di turf.js), in m²
function areaAnello(r) {
  const R = 6378137, rad = Math.PI / 180;
  let area = 0;
  for (let i = 0; i < r.length - 1; i++) {
    const [lon1, lat1] = r[i], [lon2, lat2] = r[i + 1];
    area += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad));
  }
  return Math.abs((area * R * R) / 2);
}

export function ettariDi(g) {
  if (!g) return 0;
  const poligoni = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const m2 = poligoni.reduce((s, p) => s + areaAnello(p[0]) - p.slice(1).reduce((b, r) => b + areaAnello(r), 0), 0);
  return Math.round((m2 / 10000) * 100) / 100;
}

// centro del campo (media dei vertici del contorno esterno più grande): per meteo e navigazione
export function centroDi(g) {
  if (!g) return null;
  const poligoni = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const maggiore = poligoni.reduce((a, p) => (areaAnello(p[0]) > areaAnello(a[0]) ? p : a), poligoni[0]);
  const r = maggiore[0].slice(0, -1);
  const lon = r.reduce((s, c) => s + c[0], 0) / r.length, lat = r.reduce((s, c) => s + c[1], 0) / r.length;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}

export const formattaEttari = (ha) => `${Number(ha || 0).toLocaleString("it-IT", { maximumFractionDigits: 2 })} ha`;

// --- Meteo per i trattamenti --------------------------------------------------------------------------

// Delta T = temperatura − temperatura di bulbo umido (formula di Stull): dice quanto evapora la goccia.
// 2–8 °C ideale; sopra 10 la goccia evapora prima di arrivare; sotto 2 rischio di inversione termica e deriva
export function deltaT(t, ur) {
  if (t == null || ur == null) return null;
  const tw = t * Math.atan(0.151977 * Math.sqrt(ur + 8.313659)) + Math.atan(t + ur) - Math.atan(ur - 1.676331) + 0.00391838 * Math.pow(ur, 1.5) * Math.atan(0.023101 * ur) - 4.686035;
  return Math.round((t - tw) * 10) / 10;
}

// soglie predefinite, modificabili dal pilota (si salvano sul telefono)
export const SOGLIE_BASE = { ventoMax: 10, raffiche: 20, tempMin: 5, tempMax: 28, urMin: 45 };
const CHIAVE_SOGLIE = "eyedrones_soglie_trattamenti";
export const leggiSoglie = () => { try { return { ...SOGLIE_BASE, ...JSON.parse(localStorage.getItem(CHIAVE_SOGLIE) || "{}") }; } catch { return { ...SOGLIE_BASE }; } };
export const salvaSoglie = (s) => { try { localStorage.setItem(CHIAVE_SOGLIE, JSON.stringify(s)); } catch { /* resta per questa volta */ } };

// semaforo di un'ora per irrorare: verde, giallo (con attenzione) o rosso (meglio di no), con i motivi
export function valutaOraTrattamento(o, s = SOGLIE_BASE) {
  const motivi = [];
  let livello = 0; // 0 verde, 1 giallo, 2 rosso
  const segna = (l, m) => { livello = Math.max(livello, l); motivi.push(m); };
  if (o.vento != null) { if (o.vento > s.ventoMax * 1.5) segna(2, `vento ${Math.round(o.vento)} km/h`); else if (o.vento > s.ventoMax) segna(1, `vento ${Math.round(o.vento)} km/h`); }
  if (o.raffiche != null && o.raffiche > s.raffiche) segna(o.raffiche > s.raffiche * 1.4 ? 2 : 1, `raffiche ${Math.round(o.raffiche)} km/h`);
  if (o.temp != null) { if (o.temp > s.tempMax + 4) segna(2, `${Math.round(o.temp)} °C`); else if (o.temp > s.tempMax) segna(1, `${Math.round(o.temp)} °C`); else if (o.temp < s.tempMin) segna(1, `${Math.round(o.temp)} °C, freddo`); }
  if (o.ur != null && o.ur < s.urMin) segna(o.ur < s.urMin - 15 ? 2 : 1, `umidità ${Math.round(o.ur)}%`);
  const dt = deltaT(o.temp, o.ur);
  if (dt != null) { if (dt > 10) segna(2, `Delta T ${dt}`); else if (dt > 8) segna(1, `Delta T ${dt}`); else if (dt < 2) segna(1, `Delta T ${dt}: rischio inversione`); }
  if ((o.pioggia || 0) >= 0.2) segna(2, "pioggia");
  else if ((o.probPioggia || 0) >= 50) segna(1, `pioggia ${o.probPioggia}%`);
  return { livello, colore: ["#4ade80", "#f5b942", "#ff4d4d"][livello], testo: ["Si può trattare", "Con attenzione", "Meglio di no"][livello], motivi, deltaT: dt };
}

// previsioni ora per ora per il punto del campo (anche i 7 giorni passati, per compilare il registro dopo il lavoro)
export async function meteoCampo({ lat, lon }) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,precipitation_probability&past_days=7&forecast_days=3&timezone=auto`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("meteo non disponibile");
  const j = await r.json();
  const h = j.hourly || {};
  return (h.time || []).map((t, i) => ({
    quando: t, data: t.slice(0, 10), ora: Number(t.slice(11, 13)),
    temp: h.temperature_2m?.[i], ur: h.relative_humidity_2m?.[i], vento: h.wind_speed_10m?.[i], raffiche: h.wind_gusts_10m?.[i],
    direzione: h.wind_direction_10m?.[i], pioggia: h.precipitation?.[i], probPioggia: h.precipitation_probability?.[i],
  }));
}

export const PUNTI_CARDINALI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const daDove = (gradi) => (gradi == null ? "" : PUNTI_CARDINALI[Math.round(gradi / 45) % 8]);

// tipi di lavoro in campo, come nel registro e nei preventivi
export const TIPI_LAVORO = [
  { key: "trattamento", label: "Trattamento fitosanitario", emoji: "🧪" },
  { key: "concimazione", label: "Concimazione", emoji: "🌱" },
  { key: "semina", label: "Semina", emoji: "🌾" },
  { key: "rilievo", label: "Rilievo / mappatura", emoji: "🛰️" },
  { key: "altro", label: "Altro", emoji: "📝" },
];
export const etichettaLavoro = (k) => (TIPI_LAVORO.find((t) => t.key === k) || {}).label || k || "";

// --- Esportazione dei confini in KML (per DJI SmartFarm / radiocomando Agras, Google Earth, QGIS) ---------
const xml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function anelliKml(geom) {
  const poligoni = geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
  return poligoni.map((p) => `<Polygon><outerBoundaryIs><LinearRing><coordinates>${p[0].map(([lo, la]) => `${lo},${la},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs>${p.slice(1).map((r) => `<innerBoundaryIs><LinearRing><coordinates>${r.map(([lo, la]) => `${lo},${la},0`).join(" ")}</coordinates></LinearRing></innerBoundaryIs>`).join("")}</Polygon>`);
}
export function campiInKml(campi, titolo = "Campi") {
  const segni = campi.filter((c) => c.confini && c.confini.type).map((c) => {
    const pol = anelliKml(c.confini);
    if (!pol.length) return "";
    const geo = pol.length === 1 ? pol[0] : `<MultiGeometry>${pol.join("")}</MultiGeometry>`;
    const descr = [c.azienda, c.coltura, c.ettari ? `${Number(c.ettari).toLocaleString("it-IT", { maximumFractionDigits: 2 })} ha` : null].filter(Boolean).join(" · ");
    return `<Placemark><name>${xml(c.nome || "Campo")}</name><description>${xml(descr)}</description><styleUrl>#campo</styleUrl>${geo}</Placemark>`;
  }).filter(Boolean);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(titolo)}</name><Style id="campo"><LineStyle><color>ff42a5f5</color><width>2</width></LineStyle><PolyStyle><color>4042a5f5</color></PolyStyle></Style>${segni.join("")}</Document></kml>`;
}

// --- Fasce di rispetto: cosa c'è vicino al campo (case, acqua, strade, scuole) ---------------------------
// Dati OpenStreetMap tramite Overpass: indicativi, da controllare sul posto. Le distanze obbligatorie
// le stabiliscono il Piano d'azione nazionale, le norme regionali e l'etichetta del prodotto.
const R_TERRA = 6371000;
function inMetri(lat0, lon0) {
  const kx = (Math.PI / 180) * R_TERRA * Math.cos((lat0 * Math.PI) / 180), ky = (Math.PI / 180) * R_TERRA;
  return ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky];
}
function distPuntoSegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function siIncrociano(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
function dentroAnello(p, r) {
  let dentro = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    if ((r[i][1] > p[1]) !== (r[j][1] > p[1]) && p[0] < ((r[j][0] - r[i][0]) * (p[1] - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) dentro = !dentro;
  }
  return dentro;
}
export const CATEGORIE_RISPETTO = [
  { key: "sensibili", nome: "Scuole, ospedali, parchi giochi", emoji: "🏫" },
  { key: "case", nome: "Case ed edifici", emoji: "🏠" },
  { key: "acqua", nome: "Corsi d'acqua, laghi, pozzi", emoji: "💧" },
  { key: "strade", nome: "Strade", emoji: "🛣️" },
];
function categoria(tag) {
  if (/^(school|kindergarten|hospital|clinic|nursing_home)$/.test(tag.amenity || "") || tag.leisure === "playground") return "sensibili";
  if (tag.building) return "case";
  if (tag.waterway || tag.natural === "water" || tag.man_made === "water_well" || tag.amenity === "drinking_water") return "acqua";
  if (tag.highway) return "strade";
  return null;
}
export async function fasceRispetto(geom, metri = 50) {
  const poligoni = geom.type === "MultiPolygon" ? geom.coordinates : geom.type === "Polygon" ? [geom.coordinates] : [];
  if (!poligoni.length) throw new Error("Questo campo non ha il confine disegnato.");
  const tutti = poligoni.flatMap((p) => p[0]);
  const lats = tutti.map((c) => c[1]), lons = tutti.map((c) => c[0]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2, lon0 = (Math.min(...lons) + Math.max(...lons)) / 2;
  const dLat = (metri + 20) / 111320, dLon = (metri + 20) / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const bb = `${Math.min(...lats) - dLat},${Math.min(...lons) - dLon},${Math.max(...lats) + dLat},${Math.max(...lons) + dLon}`;
  const q = `[out:json][timeout:25];(way["building"](${bb});nwr["amenity"~"^(school|kindergarten|hospital|clinic|nursing_home)$"](${bb});nwr["leisure"="playground"](${bb});way["waterway"](${bb});nwr["natural"="water"](${bb});node["man_made"="water_well"](${bb});way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"](${bb}););out tags geom;`;
  const server = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  let dati = null;
  for (const s of server) {
    try { const r = await fetch(s, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded" } }); if (r.ok) { dati = await r.json(); break; } } catch { /* provo il prossimo */ }
  }
  if (!dati) throw new Error("Il servizio delle mappe non risponde: riprova tra poco.");
  const m = inMetri(lat0, lon0);
  const anelli = poligoni.map((p) => p[0].map(m));
  const distanza = (pt) => {
    if (anelli.some((r) => dentroAnello(pt, r))) return 0;
    let d = Infinity;
    anelli.forEach((r) => { for (let i = 0; i < r.length - 1; i++) d = Math.min(d, distPuntoSegmento(pt, r[i], r[i + 1])); });
    return d;
  };
  const ris = Object.fromEntries(CATEGORIE_RISPETTO.map((c) => [c.key, { vicini: 0, minima: null, nomi: [] }]));
  for (const el of dati.elements || []) {
    const cat = categoria(el.tags || {});
    if (!cat) continue;
    const punti = (el.geometry || (el.lat != null ? [{ lat: el.lat, lon: el.lon }] : [])).map((g) => m([g.lon, g.lat]));
    if (!punti.length) continue;
    let d = Math.min(...punti.map(distanza));
    for (let i = 0; i < punti.length - 1 && d > 0; i++) anelli.forEach((r) => {
      r.forEach((v) => { d = Math.min(d, distPuntoSegmento(v, punti[i], punti[i + 1])); });
      for (let j = 0; j < r.length - 1 && d > 0; j++) if (siIncrociano(punti[i], punti[i + 1], r[j], r[j + 1])) d = 0; // es. un fosso che attraversa il campo
    });
    if (d > metri) continue;
    const r = ris[cat];
    r.vicini += 1;
    r.minima = r.minima == null ? d : Math.min(r.minima, d);
    const nome = el.tags.name;
    if (nome && !r.nomi.includes(nome) && r.nomi.length < 4) r.nomi.push(nome);
  }
  return ris;
}
