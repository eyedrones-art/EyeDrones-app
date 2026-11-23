// Fotogrammetria: lettura dei dati delle foto (EXIF + XMP DJI) e controllo della copertura dopo il volo.

// --- dati della foto: posizione, quota, direzione, focale ------------------------------------------------
export async function leggiDatiFoto(file) {
  const out = { nome: file.name, lat: null, lon: null, altGps: null, altRel: null, yaw: null, pitch: null, data: null, f35: null, focale: null, w: null, h: null };
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return out;
    // XMP di DJI: quota relativa al decollo, direzione del gimbal e del drone
    const testo = new TextDecoder("latin1").decode(new Uint8Array(buf));
    const xmp = (k) => { const m = new RegExp(`${k}="?\\s*([-+]?[\\d.]+)`).exec(testo) || new RegExp(`<[^>]*${k}>\\s*([-+]?[\\d.]+)`).exec(testo); return m ? Number(m[1]) : null; };
    out.altRel = xmp("RelativeAltitude");
    out.yaw = xmp("GimbalYawDegree") ?? xmp("FlightYawDegree");
    out.pitch = xmp("GimbalPitchDegree");
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), lung = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = (x) => v.getUint16(x, le), u32 = (x) => v.getUint32(x, le);
        const voci = (ifd) => { if (!ifd || t + ifd + 2 > v.byteLength) return []; const n = u16(t + ifd); return [...Array(n)].map((_, i) => { const e = t + ifd + 2 + i * 12; return { tag: u16(e), tipo: u16(e + 2), n: u32(e + 4), val: e + 8 }; }); };
        const razionale = (e, k = 0) => { const d = t + u32(e.val) + k * 8; return u32(d) / (u32(d + 4) || 1); };
        const intero = (e) => (e.tipo === 3 ? u16(e.val) : u32(e.val));
        const ascii = (e) => { const p = e.n > 4 ? t + u32(e.val) : e.val; let s = ""; for (let i = 0; i < e.n - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
        const ifd0 = voci(u32(t + 4));
        const exifIfd = ifd0.find((e) => e.tag === 0x8769);
        if (exifIfd) {
          const ex = voci(u32(exifIfd.val));
          const trova = (tag) => ex.find((e) => e.tag === tag);
          const dt = trova(0x9003); if (dt) { const m = /(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(ascii(dt)); if (m) out.data = new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime(); }
          const fl = trova(0x920a); if (fl) out.focale = razionale(fl);
          const f35 = trova(0xa405); if (f35) out.f35 = intero(f35);
          const pw = trova(0xa002), ph = trova(0xa003); if (pw) out.w = intero(pw); if (ph) out.h = intero(ph);
        }
        const gpsIfd = ifd0.find((e) => e.tag === 0x8825);
        if (gpsIfd) {
          const g = voci(u32(gpsIfd.val));
          const rif = (tag) => { const e = g.find((x) => x.tag === tag); return e ? String.fromCharCode(v.getUint8(e.val)) : null; };
          const gradi = (tag) => { const e = g.find((x) => x.tag === tag); return e ? razionale(e, 0) + razionale(e, 1) / 60 + razionale(e, 2) / 3600 : null; };
          let lat = gradi(2), lon = gradi(4);
          if (lat != null && lon != null && !(lat === 0 && lon === 0)) { if (rif(1) === "S") lat = -lat; if (rif(3) === "W") lon = -lon; out.lat = lat; out.lon = lon; }
          const alt = g.find((x) => x.tag === 6); if (alt) { out.altGps = razionale(alt); const r = g.find((x) => x.tag === 5); if (r && v.getUint8(r.val) === 1) out.altGps = -out.altGps; }
        }
        break;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      o += 2 + lung;
    }
  } catch { /* foto senza dati leggibili */ }
  return out;
}

// --- geometria in metri attorno a un punto ---------------------------------------------------------------
const R = 6371000;
function proiezione(lat0, lon0) {
  const kx = (Math.PI / 180) * R * Math.cos((lat0 * Math.PI) / 180), ky = (Math.PI / 180) * R;
  return (lat, lon) => [(lon - lon0) * kx, (lat - lat0) * ky];
}
const rotta = (a, b) => (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI; // 0 = nord, in senso orario
const diffAngolo = (a, b) => { let d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
function involucro(punti) { // convex hull (monotone chain)
  const p = [...punti].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const croce = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const giu = [], su = [];
  for (const q of p) { while (giu.length >= 2 && croce(giu[giu.length - 2], giu[giu.length - 1], q) <= 0) giu.pop(); giu.push(q); }
  for (const q of [...p].reverse()) { while (su.length >= 2 && croce(su[su.length - 2], su[su.length - 1], q) <= 0) su.pop(); su.push(q); }
  return giu.slice(0, -1).concat(su.slice(0, -1));
}
function dentro(p, poli) {
  let d = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) if ((poli[i][1] > p[1]) !== (poli[j][1] > p[1]) && p[0] < ((poli[j][0] - poli[i][0]) * (p[1] - poli[i][1])) / (poli[j][1] - poli[i][1]) + poli[i][0]) d = !d;
  return d;
}

// impronta a terra della foto (lato lungo e corto, in metri) dalla quota e dalla focale equivalente
export function improntaFoto(f, altezza, camera) {
  const r = f.w && f.h ? Math.max(f.w, f.h) / Math.min(f.w, f.h) : 4 / 3;
  let lungo;
  if (f.f35) lungo = (altezza * (43.27 * r / Math.sqrt(1 + r * r))) / f.f35;
  else if (camera) lungo = (altezza * camera.sensore) / camera.focale;
  else return null;
  const px = f.w && f.h ? Math.max(f.w, f.h) : camera ? camera.px : null;
  return { lungo, corto: lungo / r, gsd: px ? (lungo / px) * 100 : null };
}

// controllo dopo il volo: sovrapposizioni, buchi, quota e GSD
export function analizzaVolo(foto, { altezzaManuale = null, camera = null } = {}) {
  const valide = foto.filter((f) => f.lat != null);
  if (valide.length < 3) return { errore: valide.length ? "Servono almeno 3 foto con la posizione GPS." : "Nelle foto non c'è la posizione GPS: controlla di aver caricato le foto originali del drone." };
  valide.sort((a, b) => (a.data ?? 0) - (b.data ?? 0) || a.nome.localeCompare(b.nome, undefined, { numeric: true }));
  const lat0 = valide.reduce((s, f) => s + f.lat, 0) / valide.length, lon0 = valide.reduce((s, f) => s + f.lon, 0) / valide.length;
  const m = proiezione(lat0, lon0);
  const minGps = Math.min(...valide.map((f) => f.altGps ?? Infinity));
  const altezze = valide.map((f) => (altezzaManuale ? altezzaManuale : f.altRel != null ? f.altRel : f.altGps != null && Number.isFinite(minGps) ? f.altGps - minGps : null));
  if (altezze.some((a) => a == null || a <= 1)) return { errore: "Non trovo la quota di volo nelle foto: scrivila tu (altezza dal suolo in metri).", serveAltezza: true };
  const pts = valide.map((f) => m(f.lat, f.lon));
  const impronte = valide.map((f, i) => improntaFoto(f, altezze[i], camera));
  if (impronte.some((x) => !x)) return { errore: "Non riesco a calcolare l'impronta delle foto: scegli la fotocamera.", serveCamera: true };
  const obliqueTot = valide.filter((f) => f.pitch != null && f.pitch > -70).length;
  // direzione di ogni foto: gimbal se c'è, altrimenti verso la foto successiva
  const dir = valide.map((f, i) => (f.yaw != null ? f.yaw : rotta(pts[Math.max(0, i - (i === valide.length - 1 ? 1 : 0))], pts[Math.min(valide.length - 1, i + (i === valide.length - 1 ? 0 : 1))])));
  // strisciate: si spezzano quando la direzione cambia molto o c'è un salto
  const strisce = [[0]];
  for (let i = 1; i < valide.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const giro = diffAngolo(rotta(pts[i - 1], pts[i]), i > 1 ? rotta(pts[i - 2], pts[i - 1]) : rotta(pts[i - 1], pts[i])) > 35;
    if (giro || d > impronte[i].corto * 2.5) strisce.push([i]); else strisce[strisce.length - 1].push(i);
  }
  // sovrapposizione frontale tra foto vicine della stessa strisciata
  const frontali = [], salti = [];
  strisce.forEach((s) => { for (let k = 1; k < s.length; k++) { const a = s[k - 1], b = s[k]; const d = Math.hypot(pts[b][0] - pts[a][0], pts[b][1] - pts[a][1]); const ov = Math.max(0, 1 - d / impronte[a].corto); frontali.push(ov); if (ov < 0.5) salti.push([a, b]); } });
  // sovrapposizione laterale tra strisciate parallele vicine
  const lunghe = strisce.filter((s) => s.length >= 3);
  const laterali = [];
  for (let k = 1; k < lunghe.length; k++) {
    const a = lunghe[k - 1], b = lunghe[k];
    const p1 = pts[a[0]], p2 = pts[a[a.length - 1]];
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], lu = Math.hypot(dx, dy) || 1;
    const meta = pts[b[Math.floor(b.length / 2)]];
    const dist = Math.abs((meta[0] - p1[0]) * dy - (meta[1] - p1[1]) * dx) / lu;
    if (dist > 0.5) laterali.push(Math.max(0, 1 - dist / impronte[b[0]].lungo));
  }
  // copertura su una griglia: quante foto vedono ogni punto dell'area volata
  const hull = involucro(pts);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const marg = Math.max(...impronte.map((x) => x.lungo)) / 2;
  const x0 = Math.min(...xs) - marg, x1 = Math.max(...xs) + marg, y0 = Math.min(...ys) - marg, y1 = Math.max(...ys) + marg;
  const passo = Math.max(0.5, Math.max(x1 - x0, y1 - y0) / 140);
  const nx = Math.ceil((x1 - x0) / passo), ny = Math.ceil((y1 - y0) / passo);
  const conta = new Uint16Array(nx * ny);
  valide.forEach((f, i) => {
    const { lungo, corto } = impronte[i]; const a = (dir[i] * Math.PI) / 180;
    const ux = [Math.sin(a), Math.cos(a)], vx = [Math.cos(a), -Math.sin(a)]; // avanti (lato corto) e di lato (lato lungo)
    const r = Math.hypot(lungo, corto) / 2;
    const ix0 = Math.max(0, Math.floor((pts[i][0] - r - x0) / passo)), ix1 = Math.min(nx - 1, Math.ceil((pts[i][0] + r - x0) / passo));
    const iy0 = Math.max(0, Math.floor((pts[i][1] - r - y0) / passo)), iy1 = Math.min(ny - 1, Math.ceil((pts[i][1] + r - y0) / passo));
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
      const px = x0 + (ix + 0.5) * passo - pts[i][0], py = y0 + (iy + 0.5) * passo - pts[i][1];
      if (Math.abs(px * ux[0] + py * ux[1]) <= corto / 2 && Math.abs(px * vx[0] + py * vx[1]) <= lungo / 2) conta[iy * nx + ix]++;
    }
  });
  let dentroArea = 0, deboli = 0, buoni = 0;
  const nellArea = new Uint8Array(nx * ny);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    const c = [x0 + (ix + 0.5) * passo, y0 + (iy + 0.5) * passo];
    if (hull.length >= 3 && dentro(c, hull)) { nellArea[iy * nx + ix] = 1; dentroArea++; const n = conta[iy * nx + ix]; if (n < 3) deboli++; if (n >= 5) buoni++; }
  }
  const media = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const min = (a) => (a.length ? Math.min(...a) : null);
  const altMedia = media(altezze), gsd = media(impronte.map((x) => x.gsd).filter(Boolean));
  const areaHa = (dentroArea * passo * passo) / 10000;
  const ris = {
    foto: valide.length, senzaGps: foto.length - valide.length, oblique: obliqueTot, strisciate: lunghe.length, altMedia, altMin: Math.min(...altezze), altMax: Math.max(...altezze), gsd, areaHa,
    frontale: media(frontali), frontaleMin: min(frontali), laterale: media(laterali), lateraleMin: min(laterali),
    deboliPct: dentroArea ? deboli / dentroArea : 0, buoniPct: dentroArea ? buoni / dentroArea : 0,
    griglia: { nx, ny, conta, nellArea }, punti: pts.map((p) => [(p[0] - x0) / passo, (p[1] - y0) / passo]), valide, salti,
    durataMin: valide[valide.length - 1].data && valide[0].data ? (valide[valide.length - 1].data - valide[0].data) / 60000 : null,
  };
  const avvisi = [];
  if (ris.senzaGps) avvisi.push(`${ris.senzaGps} foto senza posizione GPS: non le ho contate.`);
  if (ris.frontale != null && ris.frontale < 0.7) avvisi.push(`Sovrapposizione frontale media ${Math.round(ris.frontale * 100)}%: per la fotogrammetria serve almeno il 70-75%.`);
  if (ris.frontaleMin != null && ris.frontaleMin < 0.5) avvisi.push(`In qualche punto la sovrapposizione frontale scende fino a ${Math.round(ris.frontaleMin * 100)}% (foto mancanti o volo interrotto): lì il modello può avere buchi.`);
  if (ris.laterale != null && ris.laterale < 0.6) avvisi.push(`Sovrapposizione laterale media ${Math.round(ris.laterale * 100)}%: meglio almeno il 60-70%.`);
  if (ris.deboliPct > 0.05) avvisi.push(`Il ${Math.round(ris.deboliPct * 100)}% dell'area è visto da meno di 3 foto (zone rosse sulla mappa): valuta di rivolare quella parte.`);
  if (ris.altMax - ris.altMin > Math.max(8, ris.altMedia * 0.15)) avvisi.push(`La quota cambia molto durante il volo (${Math.round(ris.altMin)}–${Math.round(ris.altMax)} m): il dettaglio non è uniforme.`);
  if (!avvisi.length || (avvisi.length === 1 && ris.senzaGps)) avvisi.push("✓ Copertura buona: puoi andare a elaborare.");
  ris.avvisi = avvisi;
  ris.ok = !avvisi.some((a) => !a.startsWith("✓") && !a.includes("senza posizione"));
  return ris;
}

// CSV delle posizioni delle foto (Pix4D «image geolocation», Agisoft Metashape «Reference», WebODM geo.txt)
export function csvPosizioni(foto, formato = "pix4d") {
  const valide = foto.filter((f) => f.lat != null);
  const alt = (f) => (f.altGps ?? f.altRel ?? 0).toFixed(3);
  if (formato === "webodm") return ["EPSG:4326", ...valide.map((f) => `${f.nome} ${f.lon.toFixed(8)} ${f.lat.toFixed(8)} ${alt(f)}`)].join("\n");
  return ["imagename,latitude,longitude,altitude", ...valide.map((f) => `${f.nome},${f.lat.toFixed(8)},${f.lon.toFixed(8)},${alt(f)}`)].join("\n");
}

// --- punti di controllo a terra (GCP) ----------------------------------------------------------------------
export function leggiCsvPunti(testo) {
  const righe = String(testo || "").split(/\r?\n/).map((r) => r.trim()).filter(Boolean);
  const punti = [];
  for (const r of righe) {
    // con ; o tab la virgola è il decimale (45,0703); altrimenti separano virgole o spazi
    const c = (/[;\t]/.test(r) ? r.split(/[;\t]/) : r.split(/,| +/)).map((x) => x.trim()).filter((x) => x !== "");
    if (c.length < 3) continue;
    const numeri = c.map((x) => Number(x.replace(",", ".")));
    let nome, x, y, z;
    if (Number.isNaN(numeri[0])) { nome = c[0]; [x, y, z] = numeri.slice(1, 4); } else { [x, y, z] = numeri.slice(0, 3); nome = Number.isNaN(numeri[3]) && c[3] ? c[3] : `P${punti.length + 1}`; }
    if ([x, y].some((n) => n == null || Number.isNaN(n))) continue; // intestazione o riga sbagliata
    punti.push({ nome, x, y, z: z == null || Number.isNaN(z) ? "" : z, tipo: "GCP", posato: false, misurato: true });
  }
  return punti;
}
export function csvPunti(punti, formato = "pix4d") {
  const r = (p) => [p.nome, p.x, p.y, p.z === "" ? "" : p.z];
  if (formato === "webodm") return punti.map((p) => r(p).join(" ")).join("\n");
  return ["label,x,y,z,tipo", ...punti.map((p) => [...r(p), p.tipo === "verifica" ? "check" : "gcp"].join(","))].join("\n");
}

// --- volumi --------------------------------------------------------------------------------------------------
export const FORME_CUMULO = [
  { key: "cono", nome: "Cono (cumulo tondo)", campi: [["diametro", "Diametro alla base", "m"], ["altezza", "Altezza", "m"]], volume: (v) => (Math.PI * (v.diametro / 2) ** 2 * v.altezza) / 3 },
  { key: "allungato", nome: "Cumulo allungato", campi: [["lunghezza", "Lunghezza alla base", "m"], ["larghezza", "Larghezza alla base", "m"], ["altezza", "Altezza", "m"]], volume: (v) => (v.larghezza * v.altezza / 2) * Math.max(0, v.lunghezza - v.larghezza) + (Math.PI * (v.larghezza / 2) ** 2 * v.altezza) / 3 },
  { key: "tronco", nome: "Tronco di piramide (cassone, vasca)", campi: [["lunghezza", "Lunghezza alla base", "m"], ["larghezza", "Larghezza alla base", "m"], ["lunghezzaSopra", "Lunghezza in cima", "m"], ["larghezzaSopra", "Larghezza in cima", "m"], ["altezza", "Altezza", "m"]], volume: (v) => { const a1 = v.lunghezza * v.larghezza, a2 = v.lunghezzaSopra * v.larghezzaSopra; return (v.altezza / 3) * (a1 + a2 + Math.sqrt(a1 * a2)); } },
];
export const MATERIALI = [["Sabbia", 1.6], ["Ghiaia", 1.7], ["Terra", 1.5], ["Inerti misti", 1.8], ["Compost / biomassa", 0.6], ["Altro (scrivo io)", null]];

// volume da un DSM GeoTIFF (ritagliato attorno al cumulo): sopra e sotto una quota di base
export async function volumeDaDsm(file, { base = null } = {}) {
  const { fromArrayBuffer } = await import("geotiff");
  const tiff = await fromArrayBuffer(await file.arrayBuffer());
  const img = await tiff.getImage();
  const w = img.getWidth(), h = img.getHeight();
  if (w * h > 40e6) throw new Error("Il file è troppo grande: ritaglia il DSM attorno al cumulo e riprova.");
  const [rx, ry] = img.getResolution();
  const chiavi = img.getGeoKeys() || {};
  let pxX = Math.abs(rx), pxY = Math.abs(ry);
  const geografico = chiavi.GTModelTypeGeoKey === 2 || (!chiavi.ProjectedCSTypeGeoKey && pxX < 0.01);
  if (geografico) { const [, minY, , maxY] = img.getBoundingBox(); const lat = (minY + maxY) / 2; pxX *= 111320 * Math.cos((lat * Math.PI) / 180); pxY *= 110540; }
  const nodata = img.getGDALNoData();
  const [banda] = await img.readRasters({ samples: [0] });
  const valido = (z) => Number.isFinite(z) && z > -1000 && z < 10000 && (nodata == null || Math.abs(z - nodata) > 1e-6);
  // quota di base: la mediana dei pixel validi sul bordo esterno del cumulo
  let quotaBase = base;
  if (quotaBase == null) {
    const bordo = [];
    for (let y = 0; y < h; y++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (valido(banda[y * w + x])) { if (a < 0) a = x; b = x; } if (a >= 0) { bordo.push(banda[y * w + a], banda[y * w + b]); } }
    for (let x = 0; x < w; x += 1) { let a = -1, b = -1; for (let y = 0; y < h; y++) if (valido(banda[y * w + x])) { if (a < 0) a = y; b = y; } if (a >= 0) { bordo.push(banda[a * w + x], banda[b * w + x]); } }
    if (!bordo.length) throw new Error("Nel file non ci sono quote valide.");
    bordo.sort((p, q) => p - q);
    quotaBase = bordo[Math.floor(bordo.length / 2)];
  }
  const areaPx = pxX * pxY;
  let sopra = 0, sotto = 0, area = 0, zMax = -Infinity, zMin = Infinity, validi = 0;
  for (let i = 0; i < w * h; i++) {
    const z = banda[i]; if (!valido(z)) continue;
    validi++; zMax = Math.max(zMax, z); zMin = Math.min(zMin, z);
    const d = z - quotaBase;
    if (d > 0) { sopra += d * areaPx; if (d > 0.05) area += areaPx; } else sotto += -d * areaPx;
  }
  // anteprima: colori dalla quota (piccola)
  const scala = Math.max(1, Math.ceil(Math.max(w, h) / 360));
  const aw = Math.ceil(w / scala), ah = Math.ceil(h / scala);
  const anteprima = new Uint8ClampedArray(aw * ah * 4);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const z = banda[(y * scala) * w + x * scala], k = (y * aw + x) * 4;
    if (!valido(z)) { anteprima[k + 3] = 0; continue; }
    const t = zMax > zMin ? (z - zMin) / (zMax - zMin) : 0;
    const d = z - quotaBase;
    anteprima[k] = d > 0.05 ? 255 : 60 + 120 * t; anteprima[k + 1] = d > 0.05 ? 140 - 100 * t : 80 + 120 * t; anteprima[k + 2] = d > 0.05 ? 66 : 120 + 100 * t; anteprima[k + 3] = 255;
  }
  return { sopra, sotto, area, quotaBase, zMin, zMax, pixel: validi, risoluzione: Math.sqrt(areaPx), geografico, anteprima: { w: aw, h: ah, dati: anteprima } };
}
