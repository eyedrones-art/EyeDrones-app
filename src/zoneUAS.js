// Zone geografiche UAS dal file ufficiale di D-Flight (standard EUROCAE ED-269, oppure GeoJSON in stile ED-318).
// Il file lo scarica ogni pilota dal proprio profilo D-Flight ("Download UAS Zone Geo"): qui lo semplifico,
// lo salvo solo su questo dispositivo (IndexedDB) e controllo se un punto cade dentro o vicino a una zona.

const DB_NOME = "eyedrones-zone";
const DB_STORE = "dati";
const CHIAVE = "zone-uas";

function apriDb() {
  return new Promise((ok, ko) => {
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => ko(req.error);
  });
}

export async function leggiZoneSalvate() {
  try {
    const db = await apriDb();
    return await new Promise((ok) => {
      const req = db.transaction(DB_STORE).objectStore(DB_STORE).get(CHIAVE);
      req.onsuccess = () => ok(req.result || null);
      req.onerror = () => ok(null);
    });
  } catch (e) {
    return null;
  }
}

// chiedo al browser di non cancellare da solo i dati salvati (su Android può farlo quando manca spazio)
export async function chiediSpazioPermanente() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch (e) { /* non supportato */ }
}
const SEGNO_ZONE = "eyedrones_zone_caricate"; // data dell'ultimo caricamento, per accorgersi se il file sparisce
export const zoneCaricatePrima = () => { try { return localStorage.getItem(SEGNO_ZONE); } catch (e) { return null; } };

export async function salvaZone(dati) {
  chiediSpazioPermanente();
  try { localStorage.setItem(SEGNO_ZONE, dati.caricato || new Date().toISOString()); } catch (e) { /* solo comodità */ }
  try {
    const db = await apriDb();
    await new Promise((ok, ko) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(dati, CHIAVE);
      tx.oncomplete = ok;
      tx.onerror = () => ko(tx.error);
    });
    return true;
  } catch (e) {
    return false;
  }
}

export async function cancellaZone() {
  try {
    const db = await apriDb();
    await new Promise((ok) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(CHIAVE);
      tx.oncomplete = ok;
      tx.onerror = ok;
    });
  } catch (e) { /* niente da fare */ }
}

// --- lettura del file ---------------------------------------------------------------------------

const num = (v) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const inMetri = (v, uom) => (v == null ? null : /^ft/i.test(String(uom || "")) ? Math.round(v * 0.3048) : Math.round(v));
const testo = (v) => (Array.isArray(v) ? v.filter(Boolean).join(", ") : v == null ? "" : String(v));

// in Italia la latitudine (35–48) e la longitudine (6–19) non si sovrappongono: se la coppia è [lat, lon] la giro
function lonLat(c) {
  if (!Array.isArray(c) || c.length < 2) return null;
  let [a, b] = [Number(c[0]), Number(c[1])];
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (Math.abs(a) > 30 && Math.abs(b) < 30) [a, b] = [b, a];
  return [a, b];
}

// trasforma una geometria (Polygon, MultiPolygon, Circle, Point con raggio) in poligoni [[anello esterno], [buchi]...] e cerchi
function leggiGeometria(g, raggioExtra, out) {
  if (!g || typeof g !== "object") return;
  const tipo = String(g.type || "").toLowerCase();
  if (tipo === "polygon" && Array.isArray(g.coordinates)) {
    out.poligoni.push(g.coordinates.map((anello) => anello.map(lonLat).filter(Boolean)).filter((a) => a.length >= 3));
  } else if (tipo === "multipolygon" && Array.isArray(g.coordinates)) {
    g.coordinates.forEach((pol) => out.poligoni.push(pol.map((anello) => anello.map(lonLat).filter(Boolean)).filter((a) => a.length >= 3)));
  } else if (tipo === "circle" || (tipo === "point" && (g.radius || raggioExtra))) {
    const centro = lonLat(g.center || g.coordinates);
    const raggio = num(g.radius ?? raggioExtra);
    if (centro && raggio) out.cerchi.push({ c: centro, r: raggio });
  } else if (tipo === "geometrycollection" && Array.isArray(g.geometries)) {
    g.geometries.forEach((x) => leggiGeometria(x, raggioExtra, out));
  }
  out.poligoni = out.poligoni.filter((p) => p.length > 0);
}

function leggiAutorita(a) {
  const lista = Array.isArray(a) ? a : a ? [a] : [];
  return lista.map((x) => ({
    nome: testo(x.name || x.nome),
    servizio: testo(x.service),
    email: testo(x.email),
    telefono: testo(x.phone),
    sito: testo(x.siteURL || x.siteUrl || x.url),
    scopo: testo(x.purpose),
    preavviso: testo(x.intervalBefore),
  })).filter((x) => x.nome || x.email || x.telefono || x.sito);
}

function leggiValidita(a) {
  const lista = Array.isArray(a) ? a : a ? [a] : [];
  if (lista.length === 0) return null;
  const v = lista.map((x) => ({ permanente: x.permanent === true || x.permanent === "YES", da: x.startDateTime || null, a: x.endDateTime || null }));
  return v.some((x) => x.permanente || (!x.da && !x.a)) ? null : v;
}

function zonaDa(p, geometrie) {
  const out = { poligoni: [], cerchi: [] };
  let limiti = null;
  geometrie.forEach((g) => {
    if (!g) return;
    const uom = g.uomDimensions || g.uom || p.uomDimensions || p.uom;
    const giu = inMetri(num(g.lowerLimit ?? p.lowerLimit), uom);
    const su = inMetri(num(g.upperLimit ?? p.upperLimit), uom);
    if (!limiti && (giu != null || su != null)) {
      limiti = { da: giu, a: su, rifDa: g.lowerVerticalReference || p.lowerVerticalReference || "", rifA: g.upperVerticalReference || p.upperVerticalReference || "" };
    }
    leggiGeometria(g.horizontalProjection || g.geometry || g, g.radius, out);
  });
  if (out.poligoni.length === 0 && out.cerchi.length === 0) return null;
  // riquadro per scartare subito le zone lontane
  let [x1, y1, x2, y2] = [180, 90, -180, -90];
  const allarga = (lon, lat, m = 0) => {
    const dLat = m / 111320, dLon = m / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
    x1 = Math.min(x1, lon - dLon); x2 = Math.max(x2, lon + dLon); y1 = Math.min(y1, lat - dLat); y2 = Math.max(y2, lat + dLat);
  };
  out.poligoni.forEach((pol) => pol[0].forEach(([lon, lat]) => allarga(lon, lat)));
  out.cerchi.forEach(({ c, r }) => allarga(c[0], c[1], r));
  return {
    id: testo(p.identifier || p.id || p.name),
    nome: testo(p.name || p.nome || p.identifier) || "Zona senza nome",
    restrizione: String(p.restriction || p.restrizione || "").toUpperCase(),
    condizioni: testo(p.restrictionConditions),
    motivo: testo(p.reason),
    altroMotivo: testo(p.otherReasonInfo),
    messaggio: testo(p.message),
    tipo: testo(p.type),
    limiti,
    autorita: leggiAutorita(p.zoneAuthority || p.authority),
    validita: leggiValidita(p.applicability || p.limitedApplicability),
    poligoni: out.poligoni,
    cerchi: out.cerchi,
    bbox: [x1, y1, x2, y2],
  };
}

// accetta il JSON di D-Flight (ED-269: { features: [{ name, restriction, geometry: [{ horizontalProjection }] }] })
// oppure un GeoJSON (FeatureCollection con properties); restituisce l'elenco semplificato delle zone
export function leggiFileZone(json) {
  const radice = Array.isArray(json) ? { features: json } : json || {};
  const elementi = radice.features || radice.UASZoneList || radice.zones || radice.data || [];
  const zone = [];
  (Array.isArray(elementi) ? elementi : []).forEach((f) => {
    if (!f || typeof f !== "object") return;
    if (f.type === "Feature" || f.properties) {
      const z = zonaDa(f.properties || {}, [f.geometry]);
      if (z) zone.push(z);
      return;
    }
    const geometrie = Array.isArray(f.geometry) ? f.geometry : f.geometry ? [f.geometry] : [];
    const z = zonaDa(f, geometrie);
    if (z) zone.push(z);
  });
  return zone;
}

// --- controllo di un punto ------------------------------------------------------------------------

function distanzaMetri([lon1, lat1], [lon2, lat2]) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function dentroAnello([x, y], anello) {
  let dentro = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, yi] = anello[i], [xj, yj] = anello[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// distanza dal bordo di un anello, in metri (proiezione piana locale: va bene per poche decine di km)
function distanzaDaAnello([lon, lat], anello) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110540;
  let min = Infinity;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const ax = (anello[j][0] - lon) * kx, ay = (anello[j][1] - lat) * ky;
    const bx = (anello[i][0] - lon) * kx, by = (anello[i][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

// 0 se il punto è dentro la zona, altrimenti la distanza in metri dal bordo più vicino
function distanzaZona(punto, z) {
  let min = Infinity;
  for (const pol of z.poligoni) {
    const [esterno, ...buchi] = pol;
    if (dentroAnello(punto, esterno) && !buchi.some((b) => dentroAnello(punto, b))) return 0;
    min = Math.min(min, distanzaDaAnello(punto, esterno));
  }
  for (const { c, r } of z.cerchi) {
    const d = distanzaMetri(punto, c) - r;
    if (d <= 0) return 0;
    min = Math.min(min, d);
  }
  return min;
}

// la zona vale nel giorno scelto? (le zone temporanee hanno date di inizio e fine)
function validaIl(z, quando) {
  if (!z.validita || !quando) return { valida: true };
  const t = quando.getTime();
  const attiva = z.validita.some((v) => (!v.da || new Date(v.da).getTime() <= t + 86400000) && (!v.a || new Date(v.a).getTime() >= t));
  return { valida: attiva, temporanea: true };
}

// zone che contengono il punto e quelle entro `raggio` metri, già ordinate
export function controllaPunto(zone, { lat, lon }, { raggio = 500, quando = null } = {}) {
  const punto = [lon, lat];
  const mLat = raggio / 111320, mLon = raggio / (111320 * Math.cos((lat * Math.PI) / 180));
  const dentro = [], vicine = [];
  for (const z of zone || []) {
    const [x1, y1, x2, y2] = z.bbox;
    if (lon < x1 - mLon || lon > x2 + mLon || lat < y1 - mLat || lat > y2 + mLat) continue;
    // se secondo il file la zona non vale il giorno del volo NON la tolgo: le date del file possono essere
    // solo quelle di validità dei dati (il file è vecchio). La tengo, segnata, e chiedo di controllare
    const { valida, temporanea } = validaIl(z, quando);
    const fuoriPeriodo = !valida;
    const d = distanzaZona(punto, z);
    if (d === 0) dentro.push({ ...z, temporanea, fuoriPeriodo });
    else if (d <= raggio) vicine.push({ ...z, temporanea, fuoriPeriodo, distanza: Math.round(d) });
  }
  const peso = (z) => GRAVITA[z.restrizione] ?? 1;
  dentro.sort((a, b) => peso(b) - peso(a));
  vicine.sort((a, b) => a.distanza - b.distanza);
  return { dentro, vicine };
}

const GRAVITA = { PROHIBITED: 4, REQ_AUTHORISATION: 3, CONDITIONAL: 2, NO_RESTRICTION: 0 };

// colori e frasi semplici per ogni tipo di restrizione
export function descriviRestrizione(r) {
  switch (r) {
    case "PROHIBITED": return { colore: "#ff4d4d", etichetta: "Volo vietato", consiglio: "Qui non si vola, salvo esenzioni particolari concesse dall'ente indicato." };
    case "REQ_AUTHORISATION": return { colore: "#ff8c42", etichetta: "Serve un'autorizzazione", consiglio: "Prima del volo chiedi l'autorizzazione all'ente indicato (spesso tramite D-Flight) e tieni la risposta tra i documenti del piano." };
    case "CONDITIONAL": return { colore: "#f5b942", etichetta: "Volo con condizioni", consiglio: "Si può volare rispettando le condizioni della zona (altezza, orari, distanze): leggi il messaggio qui sotto." };
    case "NO_RESTRICTION": return { colore: "#3d8bfd", etichetta: "Informativa", consiglio: "Zona solo informativa: valgono le regole generali della tua categoria." };
    default: return { colore: "#f5b942", etichetta: r ? r.replace(/_/g, " ").toLowerCase() : "Zona geografica", consiglio: "Controlla le condizioni di questa zona su D-Flight." };
  }
}

export function formattaLimiti(l) {
  if (!l) return null;
  const rif = (x) => (x ? ` ${String(x).toUpperCase() === "AMSL" ? "s.l.m." : String(x).toUpperCase() === "AGL" ? "dal suolo" : x}` : "");
  if (l.a != null && (l.da == null || l.da === 0)) return `fino a ${l.a} m${rif(l.rifA)}`;
  if (l.da != null && l.a != null) return `da ${l.da} m${rif(l.rifDa)} a ${l.a} m${rif(l.rifA)}`;
  if (l.da != null) return `sopra ${l.da} m${rif(l.rifDa)}`;
  return null;
}

// --- lettura del file scelto: JSON semplice oppure .zip con dentro il JSON ----------------------

async function estraiDaZip(buf) {
  const v = new DataView(buf);
  // cerco la fine della directory centrale (firma 0x06054b50) partendo dal fondo
  let fine = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fine = i; break; }
  }
  if (fine < 0) throw new Error("Lo zip sembra danneggiato: scaricalo di nuovo da D-Flight.");
  const quanti = v.getUint16(fine + 10, true);
  let p = v.getUint32(fine + 16, true);
  const voci = [];
  for (let n = 0; n < quanti && v.getUint32(p, true) === 0x02014b50; n++) {
    const metodo = v.getUint16(p + 10, true);
    const compresso = v.getUint32(p + 20, true);
    const lNome = v.getUint16(p + 28, true), lExtra = v.getUint16(p + 30, true), lComm = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(new Uint8Array(buf, p + 46, lNome));
    voci.push({ nome, metodo, compresso, offset });
    p += 46 + lNome + lExtra + lComm;
  }
  const voce = voci.find((x) => /\.(geo)?json$/i.test(x.nome)) || voci.find((x) => !x.nome.endsWith("/"));
  if (!voce) throw new Error("Nello zip non c'è nessun file delle zone.");
  const inizio = voce.offset + 30 + v.getUint16(voce.offset + 26, true) + v.getUint16(voce.offset + 28, true);
  const dati = new Uint8Array(buf, inizio, voce.compresso);
  if (voce.metodo === 0) return new TextDecoder().decode(dati);
  if (voce.metodo !== 8 || typeof DecompressionStream === "undefined") throw new Error("Non riesco ad aprire questo zip sul telefono: estrai il file .json dall'app File e carica quello.");
  const flusso = new Blob([dati]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(flusso).text();
}

// accetta qualsiasi file: lo riconosco dal contenuto e non dal nome (alcuni Android non riconoscono i .json)
export async function testoDaFileZone(file) {
  const buf = await file.arrayBuffer();
  const b = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  if (b[0] === 0x50 && b[1] === 0x4b) return estraiDaZip(buf); // "PK": è uno zip
  if (b[0] === 0x1f && b[1] === 0x8b && typeof DecompressionStream !== "undefined") {
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
  }
  return new TextDecoder().decode(buf).replace(/^﻿/, "");
}

// la zona parte da una certa altezza (es. "da 25 m a 120 m")? sotto quel limite non vale: restituisce i metri, altrimenti 0
export function partenzaZona(z) {
  const l = z && z.limiti;
  if (!l || !(l.da > 0)) return 0;
  return String(l.rifDa || "").toUpperCase() === "AMSL" ? 0 : l.da; // quota sul mare: non so convertirla senza il terreno
}

// altezza massima scritta a parole nel messaggio o nelle condizioni della zona
// (es. «max 45 m AGL», «altezza massima 45 metri», «volo consentito fino a 150 ft»). null se non c'è
export function altezzaDaTesto(z) {
  const t = [z && z.messaggio, z && z.condizioni].map((x) => valoreReale(x)).filter(Boolean).join(" ");
  if (!t) return null;
  const valori = [];
  const prendi = (n, u) => {
    const v = Number(String(n).replace(",", "."));
    if (!(v > 0)) return;
    const m = /^(ft|feet|piedi)/i.test(u) ? Math.round(v * 0.3048) : Math.round(v);
    if (m >= 5 && m < 120) valori.push(m);
  };
  const UNITA = "(m\\b|mt\\b|metri|meters|ft\\b|feet|piedi)";
  const conParola = new RegExp(`(?:max(?:imum|\\.)?|massim[ao]|non oltre|non superiore|fino a|altezza|height|quota|limite|limit)[^0-9\\n]{0,25}(\\d{1,3}(?:[.,]\\d+)?)\\s*${UNITA}`, "gi");
  const conRif = new RegExp(`(\\d{1,3}(?:[.,]\\d+)?)\\s*${UNITA}\\s*(?:agl|dal suolo|sul suolo|above ground)`, "gi");
  for (const r of [conParola, conRif]) for (const x of t.matchAll(r)) prendi(x[1], x[2]);
  return valori.length ? Math.min(...valori) : null;
}

// altezza massima senza autorizzazione nel punto: 120 m (regola Open), ridotta da:
// - zone vietate o con autorizzazione (sotto la loro partenza si vola libero)
// - zone «con condizioni» che partono sopra il suolo (es. da 45 m: sopra valgono le condizioni)
// - un'altezza massima scritta nel messaggio o nelle condizioni della zona (es. «max 45 m»)
export function altezzaLibera(dentro) {
  let max = 120;
  for (const z of dentro || []) {
    if (z.restrizione === "NO_RESTRICTION") continue;
    const parte = partenzaZona(z);
    if (z.restrizione === "PROHIBITED" || z.restrizione === "REQ_AUTHORISATION") max = Math.min(max, parte);
    else if (parte > 0) max = Math.min(max, parte);
    const scritta = altezzaDaTesto(z);
    if (scritta != null) max = Math.min(max, scritta);
  }
  return max;
}

// zone con limiti a pochi metri dal punto: se l'area di volo ci entra, valgono anche quelle
export function limiteVicino(vicine, entro = 150) {
  let peggiore = null;
  for (const z of vicine || []) {
    if (z.distanza > entro || z.restrizione === "NO_RESTRICTION") continue;
    const h = altezzaLibera([z]);
    if (h >= 120) continue;
    if (!peggiore || h < peggiore.altezza) peggiore = { altezza: h, distanza: z.distanza, nome: z.nome, restrizione: z.restrizione };
  }
  return peggiore;
}

// D-Flight riempie i campi vuoti con "N.A." o "-": li tratto come vuoti
export const valoreReale = (v) => (v && !/^\s*(n\.?\s*a\.?|n\/a|na|-+|null|none|nd|n\.?d\.?)\s*$/i.test(String(v)) ? v : "");

// altezza a cui si vola senza chiedere permessi in un punto (Open, 120 m al massimo), guardando anche le zone
// entro `margine` metri: l'area di volo non è un punto. 0 = qui serve un permesso anche a pochi metri da terra
export function altezzaSenzaPermessi(zone, punto, margine = 100) {
  const { dentro, vicine } = controllaPunto(zone, punto, { raggio: margine });
  let h = 120;
  for (const z of [...dentro, ...vicine]) {
    if (z.restrizione === "NO_RESTRICTION") continue;
    h = Math.min(h, partenzaZona(z));
    const scritta = altezzaDaTesto(z);
    if (scritta != null) h = Math.min(h, scritta);
  }
  return h;
}

const DIREZIONI = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ovest", "ovest", "nord-ovest"];

// posti vicini dove si vola senza permessi: giro attorno al punto a cerchi sempre più larghi e tengo
// il primo libero fino a 120 m e, se è più vicino, il primo dove si sale almeno a `minimo` metri
export function postiLiberiVicini(zone, { lat, lon }, { maxKm = 8, passo = 250, margine = 100, minimo = 30 } = {}) {
  const kLat = 111320, kLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const largo = maxKm * 1000 + margine + 200;
  const mLat = largo / kLat, mLon = largo / kLon;
  const qui = (zone || []).filter((z) => !(z.bbox[2] < lon - mLon || z.bbox[0] > lon + mLon || z.bbox[3] < lat - mLat || z.bbox[1] > lat + mLat));
  let tutto = null, basso = null;
  for (let r = passo; r <= maxKm * 1000 && !tutto; r += passo) {
    const n = Math.min(48, Math.max(8, Math.round((2 * Math.PI * r) / passo)));
    let migliore = null;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      const q = { lat: lat + (Math.cos(a) * r) / kLat, lon: lon + (Math.sin(a) * r) / kLon };
      const h = altezzaSenzaPermessi(qui, q, margine);
      if (h >= 120) { tutto = { ...q, distanza: r, altezza: 120, direzione: DIREZIONI[Math.round((a * 8) / (2 * Math.PI)) % 8] }; break; }
      if (!basso && h >= minimo && (!migliore || h > migliore.altezza)) migliore = { ...q, distanza: r, altezza: h, direzione: DIREZIONI[Math.round((a * 8) / (2 * Math.PI)) % 8] };
    }
    if (!basso && !tutto && migliore) basso = migliore;
  }
  return [basso, tutto].filter(Boolean);
}
