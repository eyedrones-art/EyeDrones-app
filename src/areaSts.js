// Area di volo disegnata a mano (poligono) per lo STS-01: superficie, perimetro e le fasce
// di contingenza e buffer «allargate» della distanza giusta tutto attorno, anche su forme irregolari.
// Lavoro in metri su un piano locale (va benissimo per aree di qualche chilometro).

import { controllaPunto, altezzaLibera } from "./zoneUAS.js";

const R_TERRA = 6371008.8;

function piano(punti) {
  const lat0 = punti.reduce((s, p) => s + p[0], 0) / punti.length;
  const lon0 = punti.reduce((s, p) => s + p[1], 0) / punti.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const aMetri = ([lat, lon]) => [((lon - lon0) * Math.PI / 180) * R_TERRA * k, ((lat - lat0) * Math.PI / 180) * R_TERRA];
  const aGradi = ([x, y]) => [lat0 + (y / R_TERRA) * 180 / Math.PI, lon0 + (x / (R_TERRA * k)) * 180 / Math.PI];
  return { aMetri, aGradi };
}

// superficie in m² e perimetro in m di un poligono [[lat, lon], ...]
export function misuraArea(punti) {
  if (!punti || punti.length < 3) return { m2: 0, perimetro: 0 };
  const { aMetri } = piano(punti);
  const m = punti.map(aMetri);
  let a = 0, per = 0;
  for (let i = 0; i < m.length; i++) {
    const [x1, y1] = m[i], [x2, y2] = m[(i + 1) % m.length];
    a += x1 * y2 - x2 * y1;
    per += Math.hypot(x2 - x1, y2 - y1);
  }
  return { m2: Math.abs(a) / 2, perimetro: per };
}

function dentro([x, y], poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function distanzaBordo([x, y], poli) {
  let min = Infinity;
  for (let i = 0; i < poli.length; i++) {
    const [x1, y1] = poli[i], [x2, y2] = poli[(i + 1) % poli.length];
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2)) : 0;
    min = Math.min(min, Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy)));
  }
  return min;
}

// toglie i punti quasi allineati (Douglas–Peucker) per non avere contorni da migliaia di punti
function semplifica(punti, tolleranza) {
  if (punti.length < 4) return punti;
  const dist = ([x, y], [x1, y1], [x2, y2]) => {
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
    return l ? Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / l : Math.hypot(x - x1, y - y1);
  };
  const tieni = new Array(punti.length).fill(false);
  tieni[0] = tieni[punti.length - 1] = true;
  const pila = [[0, punti.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = dist(punti[i], punti[a], punti[b]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > tolleranza && idx > 0) { tieni[idx] = true; pila.push([a, idx], [idx, b]); }
  }
  return punti.filter((_, i) => tieni[i]);
}

// il contorno di tutti i punti a non più di «distanza» metri dall'area (l'area «allargata»).
// Calcolo la distanza su una griglia fitta e ne traccio la linea di livello (marching squares).
export function allargaArea(punti, distanza) {
  if (!punti || punti.length < 3 || !(distanza > 0)) return punti || [];
  const { aMetri, aGradi } = piano(punti);
  const poli = punti.map(aMetri);
  const xs = poli.map((p) => p[0]), ys = poli.map((p) => p[1]);
  const margine = distanza * 1.2 + 2;
  const minX = Math.min(...xs) - margine, maxX = Math.max(...xs) + margine;
  const minY = Math.min(...ys) - margine, maxY = Math.max(...ys) + margine;
  const passo = Math.max(0.5, Math.max(maxX - minX, maxY - minY) / 260);
  const nx = Math.ceil((maxX - minX) / passo) + 1, ny = Math.ceil((maxY - minY) / passo) + 1;
  // valore < 0 dentro l'area allargata, > 0 fuori
  const v = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = [minX + i * passo, minY + j * passo];
      v[j * nx + i] = dentro(p, poli) ? -distanza : distanzaBordo(p, poli) - distanza;
    }
  }
  const val = (i, j) => v[j * nx + i];
  // i punti del contorno stanno sui lati delle celle: «h:i:j» lato orizzontale, «v:i:j» verticale
  const punto = new Map();
  const suLato = (id) => {
    if (punto.has(id)) return id;
    const [t, a, b] = id.split(":");
    const i = Number(a), j = Number(b);
    let p;
    if (t === "h") { const v1 = val(i, j), v2 = val(i + 1, j); const f = v1 / (v1 - v2); p = [minX + (i + f) * passo, minY + j * passo]; }
    else { const v1 = val(i, j), v2 = val(i, j + 1); const f = v1 / (v1 - v2); p = [minX + i * passo, minY + (j + f) * passo]; }
    punto.set(id, p);
    return id;
  };
  const vicini = new Map();
  const unisci = (a, b) => {
    a = suLato(a); b = suLato(b);
    (vicini.get(a) || vicini.set(a, []).get(a)).push(b);
    (vicini.get(b) || vicini.set(b, []).get(b)).push(a);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const c = (val(i, j) < 0 ? 1 : 0) | (val(i + 1, j) < 0 ? 2 : 0) | (val(i + 1, j + 1) < 0 ? 4 : 0) | (val(i, j + 1) < 0 ? 8 : 0);
      if (c === 0 || c === 15) continue;
      const S = `h:${i}:${j}`, N = `h:${i}:${j + 1}`, W = `v:${i}:${j}`, E = `v:${i + 1}:${j}`;
      const casi = {
        1: [[W, S]], 2: [[S, E]], 3: [[W, E]], 4: [[E, N]], 5: [[W, N], [S, E]], 6: [[S, N]], 7: [[W, N]],
        8: [[N, W]], 9: [[N, S]], 10: [[N, E], [W, S]], 11: [[N, E]], 12: [[E, W]], 13: [[E, S]], 14: [[S, W]],
      };
      casi[c].forEach(([a, b]) => unisci(a, b));
    }
  }
  // percorro gli anelli e tengo il più lungo (il contorno esterno)
  const visto = new Set();
  let migliore = [];
  for (const inizio of vicini.keys()) {
    if (visto.has(inizio)) continue;
    const anello = [];
    let prec = null, cur = inizio;
    while (cur && !visto.has(cur)) {
      visto.add(cur);
      anello.push(punto.get(cur));
      const prossimo = (vicini.get(cur) || []).find((x) => x !== prec && !visto.has(x));
      prec = cur; cur = prossimo;
    }
    if (anello.length > migliore.length) migliore = anello;
  }
  return semplifica(migliore, passo * 0.4).map(aGradi);
}

// le tre aree dello STS-01 a partire dall'area di volo disegnata
export function areeSts(punti, sts) {
  if (!punti || punti.length < 3) return null;
  return {
    volo: punti,
    contingenza: allargaArea(punti, sts.contingenza),
    buffer: sts.buffer != null ? allargaArea(punti, sts.contingenza + sts.buffer) : null,
  };
}

// --- Zone D-Flight su tutta l'area (non solo nel punto) -------------------------------------------

// controllo le zone su punti fitti lungo il bordo e dentro l'area: una zona che tocca anche solo
// un angolo dell'area (o che ci sta tutta dentro) viene trovata.
// Restituisce le zone toccate, ognuna col suo limite, e l'altezza massima senza autorizzazione su tutta l'area
export function zoneDellArea(zone, punti, { quando = null } = {}) {
  if (!zone || !punti || punti.length < 3) return null;
  const la = punti.map((p) => p[0]), lo = punti.map((p) => p[1]);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)];
  const vicine = zone.filter((z) => z.bbox && !(z.bbox[0] > maxLon || z.bbox[2] < minLon || z.bbox[1] > maxLat || z.bbox[3] < minLat));
  const { aMetri, aGradi } = piano(punti);
  const poli = punti.map(aMetri);
  const { m2, perimetro } = misuraArea(punti);
  const campioni = [];
  // bordo: un punto ogni pochi metri
  const passoBordo = Math.max(3, perimetro / 400);
  for (let i = 0; i < poli.length; i++) {
    const [x1, y1] = poli[i], [x2, y2] = poli[(i + 1) % poli.length];
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / passoBordo));
    for (let k = 0; k < n; k++) campioni.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
  }
  // dentro: una griglia (per le zone piccole che stanno tutte all'interno)
  const passo = Math.max(5, Math.sqrt(m2 / 600));
  const xs = poli.map((p) => p[0]), ys = poli.map((p) => p[1]);
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += passo) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += passo) if (dentro([x, y], poli)) campioni.push([x, y]);
  }
  const trovate = new Map();
  if (vicine.length) {
    for (const c of campioni) {
      const [lat, lon] = aGradi(c);
      for (const z of controllaPunto(vicine, { lat, lon }, { raggio: 0, quando }).dentro) {
        const k = z.id || z.identificativo || z.nome;
        const t = trovate.get(k);
        if (t) t.punti++;
        else trovate.set(k, { zona: z, punti: 1, dove: [lat, lon] });
      }
    }
  }
  const elenco = [...trovate.values()].map((t) => ({ ...t, altezza: altezzaLibera([t.zona]), tutta: t.punti >= campioni.length }));
  elenco.sort((a, b) => a.altezza - b.altezza);
  return { zone: elenco, altezzaMax: altezzaLibera(elenco.map((t) => t.zona)), campioni: campioni.length };
}

// --- Missione esportata da DJI Pilot 2 (KMZ con wpmz/template.kml e waylines.wpml) ----------------

const coordinateDa = (el) => (el ? el.textContent.trim().split(/\s+/).map((t) => t.split(",").map(Number)).filter((c) => c.length >= 2 && !Number.isNaN(c[0]) && !Number.isNaN(c[1])) : []);

// involucro convesso (per le missioni a waypoint, che non hanno un'area)
function involucro(punti) {
  const p = [...punti].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  if (p.length < 3) return p;
  const croce = (o, a, b) => (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
  const giu = [], su = [];
  for (const q of p) { while (giu.length >= 2 && croce(giu[giu.length - 2], giu[giu.length - 1], q) <= 0) giu.pop(); giu.push(q); }
  for (const q of [...p].reverse()) { while (su.length >= 2 && croce(su[su.length - 2], su[su.length - 1], q) <= 0) su.pop(); su.push(q); }
  return [...giu.slice(0, -1), ...su.slice(0, -1)];
}

const tag = (doc, nome) => [...doc.getElementsByTagName("*")].filter((e) => e.localName === nome);

function leggiKmlMissione(testo) {
  const doc = new DOMParser().parseFromString(testo, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Il file della missione non è leggibile.");
  const valore = (nome) => { const e = tag(doc, nome)[0]; return e ? e.textContent.trim() : null; };
  // area (mappatura, obliqua, rilievo): il poligono più grande
  let area = null;
  for (const pg of tag(doc, "Polygon")) {
    const esterno = tag(pg, "outerBoundaryIs")[0] || pg;
    const anello = coordinateDa(tag(esterno, "coordinates")[0]).map(([lon, lat]) => [lat, lon]);
    if (anello.length >= 3 && (!area || misuraArea(anello).m2 > misuraArea(area).m2)) area = anello;
  }
  if (area && area.length > 3 && area[0][0] === area[area.length - 1][0] && area[0][1] === area[area.length - 1][1]) area = area.slice(0, -1);
  // altrimenti waypoint e linee (missioni a punti, strisciate): prendo l'involucro dei punti
  const tutti = [...tag(doc, "Point"), ...tag(doc, "LineString")].flatMap((e) => coordinateDa(tag(e, "coordinates")[0])).map(([lon, lat]) => [lat, lon]);
  const altezze = tag(doc, "executeHeight").concat(tag(doc, "height")).map((e) => Number(e.textContent)).filter((n) => Number.isFinite(n) && n > 0);
  // traccia di un volo vero (AirData, registri esportati): quote sul livello del mare e un punto «Home» del decollo.
  // L'altezza del volo è la quota più alta meno quella del decollo
  let altezzaTraccia = null;
  if (!altezze.length) {
    const home = tag(doc, "Placemark").find((pm) => /^home/i.test((tag(pm, "name")[0] || {}).textContent || "") && tag(pm, "Point").length);
    const zHome = home ? (coordinateDa(tag(tag(home, "Point")[0], "coordinates")[0])[0] || [])[2] : null;
    const zTraccia = tag(doc, "LineString").flatMap((e) => coordinateDa(tag(e, "coordinates")[0])).map((c) => c[2]).filter(Number.isFinite);
    if (Number.isFinite(zHome) && zTraccia.length) { const h = Math.max(...zTraccia) - zHome; if (h > 0 && h < 1000) altezzaTraccia = h; }
  }
  return {
    area, punti: tutti,
    altezza: altezze.length ? Math.max(...altezze) : altezzaTraccia || Number(valore("globalHeight")) || Number(valore("globalShootHeight")) || null,
    modoAltezza: altezzaTraccia ? "relativeToStartPoint" : valore("executeHeightMode") || valore("heightMode") || null,
    tipo: valore("templateType"),
  };
}

// legge un file .kmz o .kml di DJI Pilot 2 (va bene anche un KML qualsiasi con un'area)
// → { punti: [[lat, lon], ...], daPunti, altezza, altezzaDalSuolo, tipo }
export async function leggiMissioneDji(file) {
  const nome = (file.name || "").toLowerCase();
  const letti = [];
  if (nome.endsWith(".kmz") || nome.endsWith(".zip")) {
    const { iter } = await import("but-unzip");
    const byte = new Uint8Array(await file.arrayBuffer());
    for (const e of iter(byte)) {
      const n = (e.filename || e.name || "").toLowerCase();
      if (/\.(kml|wpml)$/.test(n)) letti.push({ n, testo: new TextDecoder().decode(await e.read()) });
    }
    if (!letti.length) throw new Error("Nel file non c'è nessuna missione (KML o WPML).");
  } else if (nome.endsWith(".kml") || nome.endsWith(".wpml")) {
    letti.push({ n: nome, testo: await file.text() });
  } else {
    throw new Error("Carica il file della missione esportato da DJI Pilot 2 (.kmz) oppure un .kml.");
  }
  // prima il modello (template.kml), poi le rotte (waylines.wpml)
  letti.sort((a, b) => (a.n.includes("template") ? -1 : 0) - (b.n.includes("template") ? -1 : 0));
  const parti = letti.map((l) => leggiKmlMissione(l.testo));
  const conArea = parti.find((x) => x.area);
  const punti = parti.flatMap((x) => x.punti);
  const area = conArea ? conArea.area : punti.length >= 3 ? involucro(punti) : null;
  if (!area || area.length < 3 || misuraArea(area).m2 < 1) throw new Error("Nel file non ho trovato un'area o abbastanza punti della missione.");
  const conAltezza = parti.find((x) => x.altezza);
  const modo = (conAltezza && conAltezza.modoAltezza) || (parti.find((x) => x.modoAltezza) || {}).modoAltezza || "";
  return {
    punti: area.map(([a, b]) => [Math.round(a * 1e7) / 1e7, Math.round(b * 1e7) / 1e7]),
    daPunti: !conArea,
    altezza: conAltezza ? Math.round(conAltezza.altezza) : null,
    // relativa al decollo o dal suolo: la posso usare; se è sul livello del mare (EGM96/WGS84) no
    altezzaUsabile: !/egm96|wgs84/i.test(modo),
    modoAltezza: modo,
    tipo: (parti.find((x) => x.tipo) || {}).tipo || null,
  };
}
