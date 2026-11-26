// Multispettrale: mappe di indice (NDVI, NDRE…) da GeoTIFF fatti con DJI Terra, Pix4D, SmartFarm o altri,
// storico per campo, zone di vigore e mappe di prescrizione da esportare (Shapefile, KML, GeoJSON).
// Tutto nel telefono: il file non viene caricato da nessuna parte, salvo solo un'anteprima piccola e una griglia.

const R = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F), K0 = 0.9996;
const gradi = (r) => (r * 180) / Math.PI;

// UTM (WGS84 / ETRS89 / RDN2008) → lat, lon
function utmALatLon(x, y, zona, nord = true) {
  const ep2 = E2 / (1 - E2);
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const xx = x - 500000, yy = nord ? y : y - 10000000;
  const m = yy / K0;
  const mu = m / (R * (1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 ** 3) / 256));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);
  const n1 = R / Math.sqrt(1 - E2 * Math.sin(p1) ** 2);
  const t1 = Math.tan(p1) ** 2, c1 = ep2 * Math.cos(p1) ** 2;
  const r1 = (R * (1 - E2)) / (1 - E2 * Math.sin(p1) ** 2) ** 1.5;
  const d = xx / (n1 * K0);
  const lat = p1 - ((n1 * Math.tan(p1)) / r1) * (d * d / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6 / 720);
  const lon = (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5 / 120) / Math.cos(p1);
  return { lat: gradi(lat), lon: (zona - 1) * 6 - 180 + 3 + gradi(lon) };
}

// dal codice EPSG del file, la funzione che porta le coordinate in gradi
export function convertitore(epsg, geografico) {
  if (geografico || epsg === 4326 || epsg === 4258 || epsg === 6706) return (x, y) => ({ lat: y, lon: x });
  if (epsg === 3857 || epsg === 900913) return (x, y) => ({ lat: gradi(2 * Math.atan(Math.exp(y / R)) - Math.PI / 2), lon: gradi(x / R) });
  if (epsg >= 32601 && epsg <= 32660) return (x, y) => utmALatLon(x, y, epsg - 32600, true);
  if (epsg >= 32701 && epsg <= 32760) return (x, y) => utmALatLon(x, y, epsg - 32700, false);
  if (epsg >= 25828 && epsg <= 25838) return (x, y) => utmALatLon(x, y, epsg - 25800, true);
  if (epsg >= 6707 && epsg <= 6709) return (x, y) => utmALatLon(x, y, epsg - 6675, true); // RDN2008 / UTM 32-34N
  if (epsg >= 3044 && epsg <= 3047) return (x, y) => utmALatLon(x, y, epsg - 3012, true); // ETRS89 / UTM 32-35N (ETRS-TM)
  return null;
}

// colori dal basso vigore (rosso) all'alto vigore (verde)
const RAMPA = [[215, 25, 28], [253, 174, 97], [255, 255, 191], [166, 217, 106], [26, 150, 65]];
export function colore(t) {
  const x = Math.max(0, Math.min(1, t)) * (RAMPA.length - 1);
  const i = Math.min(RAMPA.length - 2, Math.floor(x)), f = x - i;
  return RAMPA[i].map((c, k) => Math.round(c + (RAMPA[i + 1][k] - c) * f));
}
export const coloreCss = (t) => `rgb(${colore(t).join(",")})`;

const quantile = (ordinati, q) => ordinati.length ? ordinati[Math.min(ordinati.length - 1, Math.max(0, Math.floor(q * (ordinati.length - 1))))] : null;

// legge il GeoTIFF: anteprima colorata (PNG), limiti in gradi, statistiche e una griglia per le zone
export async function leggiMappaIndice(file, { maxLato = 640, celle = 44 } = {}) {
  const { fromArrayBuffer } = await import("geotiff");
  const tiff = await fromArrayBuffer(await file.arrayBuffer());
  const img = await tiff.getImage();
  const W = img.getWidth(), H = img.getHeight();
  const chiavi = img.getGeoKeys() || {};
  const epsg = chiavi.ProjectedCSTypeGeoKey || chiavi.GeographicTypeGeoKey || null;
  const geografico = chiavi.GTModelTypeGeoKey === 2;
  const conv = convertitore(epsg, geografico);
  if (!conv) throw new Error(`Il file usa un sistema di coordinate che non so leggere (EPSG ${epsg || "?"}). Esportalo da DJI Terra o Pix4D in WGS84 (EPSG 4326) o in UTM.`);
  const [x0, y0, x1, y1] = img.getBoundingBox();
  const angoli = { no: conv(x0, y1), ne: conv(x1, y1), so: conv(x0, y0), se: conv(x1, y0) };
  if (![angoli.no, angoli.se].every((p) => Math.abs(p.lat) <= 85 && Math.abs(p.lon) <= 180)) throw new Error("Le coordinate del file non sembrano giuste: controlla il sistema di riferimento.");
  const bande = img.getSamplesPerPixel();
  const scala = Math.max(1, Math.max(W, H) / maxLato);
  const w = Math.max(1, Math.round(W / scala)), h = Math.max(1, Math.round(H / scala));
  const nodata = img.getGDALNoData();
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  let valori = null, colorata = false;
  if (bande >= 3 && img.getBitsPerSample() === 8) {
    // immagine già colorata (es. mappa esportata come foto): la mostro così com'è, senza zone
    const ras = await img.readRasters({ width: w, height: h, interleave: true, resampleMethod: "nearest" });
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      px[i * 4] = ras[i * bande]; px[i * 4 + 1] = ras[i * bande + 1]; px[i * 4 + 2] = ras[i * bande + 2];
      px[i * 4 + 3] = bande >= 4 ? ras[i * bande + 3] : (ras[i * bande] + ras[i * bande + 1] + ras[i * bande + 2] === 0 ? 0 : 255);
    }
    colorata = true;
    return { colorata, angoli, epsg, immagine: canvas ? aPng(canvas, px, w, h) : null, statistiche: null, griglia: null, larghezza: W, altezza: H };
  }
  const [banda] = await img.readRasters({ samples: [0], width: w, height: h, resampleMethod: "nearest" });
  valori = banda;
  const valido = (v) => Number.isFinite(v) && (nodata == null || Math.abs(v - nodata) > 1e-9) && v > -1.5 && v < 1.5;
  const lista = [];
  for (let i = 0; i < valori.length; i++) if (valido(valori[i])) lista.push(valori[i]);
  if (lista.length < 10) throw new Error("Nel file non trovo valori di indice validi (tra -1 e 1). Carica la mappa NDVI/NDRE a una banda, non la foto.");
  const ordinati = Float32Array.from(lista).sort();
  const p2 = quantile(ordinati, 0.02), p98 = quantile(ordinati, 0.98);
  const media = lista.reduce((a, b) => a + b, 0) / lista.length;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = valori[i];
    if (!valido(v)) continue;
    const [r, g, b] = colore(p98 > p2 ? (v - p2) / (p98 - p2) : 0.5);
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255;
  }
  // griglia: media dei pixel di ogni cella (per le zone di prescrizione)
  const nx = Math.max(4, Math.min(celle, w)), ny = Math.max(4, Math.round(nx * (h / w)));
  const griglia = [];
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    let s = 0, n = 0;
    const xa = Math.floor((gx * w) / nx), xb = Math.floor(((gx + 1) * w) / nx), ya = Math.floor((gy * h) / ny), yb = Math.floor(((gy + 1) * h) / ny);
    for (let y = ya; y < Math.max(yb, ya + 1); y++) for (let x = xa; x < Math.max(xb, xa + 1); x++) { const v = valori[y * w + x]; if (valido(v)) { s += v; n++; } }
    griglia.push(n ? Math.round((s / n) * 1000) / 1000 : null);
  }
  return {
    colorata, angoli, epsg, larghezza: W, altezza: H,
    immagine: canvas ? aPng(canvas, px, w, h) : null,
    statistiche: { min: ordinati[0], max: ordinati[ordinati.length - 1], media: Math.round(media * 1000) / 1000, p2, p98, validi: lista.length },
    griglia: { nx, ny, valori: griglia },
  };
}

function aPng(canvas, px, w, h) {
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").putImageData(new ImageData(px, w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

// limiti per sovrapporre l'immagine sulla mappa
export const limitiDa = (a) => [[Math.min(a.so.lat, a.se.lat, a.no.lat, a.ne.lat), Math.min(a.so.lon, a.no.lon, a.se.lon, a.ne.lon)], [Math.max(a.no.lat, a.ne.lat, a.so.lat, a.se.lat), Math.max(a.ne.lon, a.se.lon, a.no.lon, a.so.lon)]];

// punto della griglia (u, v da 0 a 1, v = 0 in alto) → lat, lon (interpolando i quattro angoli)
const lerp = (a, b, t) => a + (b - a) * t;
function punto(a, u, v) {
  const top = { lat: lerp(a.no.lat, a.ne.lat, u), lon: lerp(a.no.lon, a.ne.lon, u) };
  const bot = { lat: lerp(a.so.lat, a.se.lat, u), lon: lerp(a.so.lon, a.se.lon, u) };
  return { lat: lerp(top.lat, bot.lat, v), lon: lerp(top.lon, bot.lon, v) };
}

// punto dentro un confine GeoJSON (Polygon o MultiPolygon)?
function dentroAnello(lon, lat, anello) {
  let dentro = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, yi] = anello[i], [xj, yj] = anello[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
export function dentroConfine(lon, lat, geom) {
  if (!geom) return true;
  const poligoni = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
  return poligoni.some((p) => dentroAnello(lon, lat, p[0]) && !p.slice(1).some((buco) => dentroAnello(lon, lat, buco)));
}

const metri = (a, b) => { const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180); return Math.hypot((b.lon - a.lon) * 111320 * k, (b.lat - a.lat) * 110540); };

// zone di vigore: celle dentro il campo, divise in n gruppi con lo stesso numero di celle (dal più basso al più alto)
export function zoneVigore(mappa, confini, nZone = 3) {
  const { griglia, angoli } = mappa;
  if (!griglia) return null;
  const { nx, ny, valori } = griglia;
  const celle = [];
  for (let gy = 0; gy < ny; gy++) for (let gx = 0; gx < nx; gx++) {
    const v = valori[gy * nx + gx];
    if (v == null) continue;
    const c = punto(angoli, (gx + 0.5) / nx, (gy + 0.5) / ny);
    if (!dentroConfine(c.lon, c.lat, confini)) continue;
    const no = punto(angoli, gx / nx, gy / ny), ne = punto(angoli, (gx + 1) / nx, gy / ny), se = punto(angoli, (gx + 1) / nx, (gy + 1) / ny), so = punto(angoli, gx / nx, (gy + 1) / ny);
    celle.push({ v, anello: [no, ne, se, so, no].map((p) => [Math.round(p.lon * 1e7) / 1e7, Math.round(p.lat * 1e7) / 1e7]), ha: (metri(no, ne) * metri(no, so)) / 10000 });
  }
  if (!celle.length) return null;
  const ordinati = celle.map((c) => c.v).sort((a, b) => a - b);
  const soglie = Array.from({ length: nZone - 1 }, (_, i) => quantile(ordinati, (i + 1) / nZone));
  celle.forEach((c) => { c.zona = 1 + soglie.filter((s) => c.v > s).length; });
  const zone = Array.from({ length: nZone }, (_, i) => {
    const qui = celle.filter((c) => c.zona === i + 1);
    return { zona: i + 1, celle: qui.length, ha: qui.reduce((t, c) => t + c.ha, 0), media: qui.length ? qui.reduce((t, c) => t + c.v, 0) / qui.length : null };
  });
  return { celle, zone, soglie };
}

// GeoJSON della prescrizione (una cella = un poligono con zona, dose e vigore)
export function prescrizioneGeoJson(celle, dosi) {
  return {
    type: "FeatureCollection",
    features: celle.map((c) => ({ type: "Feature", properties: { ZONA: c.zona, DOSE: Number(dosi[c.zona - 1]) || 0, VIGORE: c.v }, geometry: { type: "Polygon", coordinates: [c.anello] } })),
  };
}

export function prescrizioneKml(celle, dosi, nome, nZone) {
  const stili = Array.from({ length: nZone }, (_, i) => { const [r, g, b] = colore(nZone === 1 ? 0.5 : i / (nZone - 1)); const hex = (n) => n.toString(16).padStart(2, "0"); return `<Style id="z${i + 1}"><LineStyle><color>00ffffff</color></LineStyle><PolyStyle><color>b4${hex(b)}${hex(g)}${hex(r)}</color></PolyStyle></Style>`; }).join("");
  const pm = celle.map((c) => `<Placemark><styleUrl>#z${c.zona}</styleUrl><ExtendedData><Data name="ZONA"><value>${c.zona}</value></Data><Data name="DOSE"><value>${Number(dosi[c.zona - 1]) || 0}</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>${c.anello.map(([x, y]) => `${x},${y},0`).join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`).join("");
  const esc = (s) => String(s).replace(/[<>&]/g, (m) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[m]));
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nome)}</name>${stili}${pm}</Document></kml>`;
}

// Shapefile (poligoni, WGS84) in uno zip: .shp .shx .dbf .prj — campi ZONA, DOSE, VIGORE
export async function prescrizioneShapefile(celle, dosi, nome = "prescrizione") {
  const n = celle.length;
  const lunghezzaRec = 4 + 32 + 4 + 4 + 4 + 5 * 16; // byte del contenuto di un poligono a 5 punti
  const shp = new DataView(new ArrayBuffer(100 + n * (8 + lunghezzaRec)));
  const shx = new DataView(new ArrayBuffer(100 + n * 8));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  celle.forEach((c) => c.anello.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }));
  const testata = (dv, lunghezzaByte) => {
    dv.setInt32(0, 9994); dv.setInt32(24, lunghezzaByte / 2); dv.setInt32(28, 1000, true); dv.setInt32(32, 5, true);
    [minX, minY, maxX, maxY].forEach((v, i) => dv.setFloat64(36 + i * 8, v, true));
  };
  testata(shp, shp.byteLength); testata(shx, shx.byteLength);
  let o = 100;
  celle.forEach((c, i) => {
    shx.setInt32(100 + i * 8, o / 2); shx.setInt32(104 + i * 8, lunghezzaRec / 2);
    shp.setInt32(o, i + 1); shp.setInt32(o + 4, lunghezzaRec / 2);
    const b = o + 8;
    shp.setInt32(b, 5, true);
    const xs = c.anello.map((p) => p[0]), ys = c.anello.map((p) => p[1]);
    [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].forEach((v, k) => shp.setFloat64(b + 4 + k * 8, v, true));
    shp.setInt32(b + 36, 1, true); shp.setInt32(b + 40, 5, true); shp.setInt32(b + 44, 0, true);
    // nello shapefile l'anello esterno va in senso orario: no → ne → se → so → no lo è già
    c.anello.forEach(([x, y], k) => { shp.setFloat64(b + 48 + k * 16, x, true); shp.setFloat64(b + 56 + k * 16, y, true); });
    o += 8 + lunghezzaRec;
  });
  // dbf: tre campi numerici
  const campi = [["ZONA", 3, 0], ["DOSE", 10, 2], ["VIGORE", 8, 3]];
  const lungRiga = 1 + campi.reduce((t, c) => t + c[1], 0);
  const testataDbf = 32 + campi.length * 32 + 1;
  const dbf = new Uint8Array(testataDbf + n * lungRiga + 1);
  const dv = new DataView(dbf.buffer);
  const oggi = new Date();
  dbf[0] = 3; dbf[1] = oggi.getFullYear() - 1900; dbf[2] = oggi.getMonth() + 1; dbf[3] = oggi.getDate();
  dv.setUint32(4, n, true); dv.setUint16(8, testataDbf, true); dv.setUint16(10, lungRiga, true);
  campi.forEach(([nomeCampo, lung, dec], i) => {
    const p = 32 + i * 32;
    for (let k = 0; k < nomeCampo.length; k++) dbf[p + k] = nomeCampo.charCodeAt(k);
    dbf[p + 11] = 78; dbf[p + 16] = lung; dbf[p + 17] = dec; // 'N'
  });
  dbf[testataDbf - 1] = 0x0d;
  celle.forEach((c, i) => {
    let p = testataDbf + i * lungRiga;
    dbf[p++] = 0x20;
    [c.zona, Number(dosi[c.zona - 1]) || 0, c.v].forEach((v, k) => {
      const [, lung, dec] = campi[k];
      const s = Number(v).toFixed(dec).slice(0, lung).padStart(lung, " ");
      for (let q = 0; q < lung; q++) dbf[p + q] = s.charCodeAt(q);
      p += lung;
    });
  });
  dbf[dbf.length - 1] = 0x1a;
  const prj = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  const { zipSync, strToU8 } = await import("fflate");
  return zipSync({ [`${nome}.shp`]: new Uint8Array(shp.buffer), [`${nome}.shx`]: new Uint8Array(shx.buffer), [`${nome}.dbf`]: dbf, [`${nome}.prj`]: strToU8(prj), [`${nome}.cpg`]: strToU8("UTF-8") });
}

export function scaricaFile(dati, nome, tipo) {
  const blob = dati instanceof Blob ? dati : new Blob([dati], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
