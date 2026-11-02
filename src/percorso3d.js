// Percorso del volo per l'anteprima 3D: griglia «a strisciate» dentro l'area (come una missione di mappatura)
// e posizione del drone lungo il percorso. Punti come [lat, lon]; i conti in metri su un piano locale.

const M_LAT = 110540;
const mLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

function piano(punti) {
  const lat0 = punti.reduce((s, p) => s + p[0], 0) / punti.length;
  const lon0 = punti.reduce((s, p) => s + p[1], 0) / punti.length;
  const kx = mLon(lat0);
  return {
    xy: ([lat, lon]) => [(lon - lon0) * kx, (lat - lat0) * M_LAT],
    ll: ([x, y]) => [lat0 + y / M_LAT, lon0 + x / kx],
  };
}

// distanza tra le strisciate in base all'altezza: foto con circa il 70% di sovrapposizione laterale
export const passoDaAltezza = (h) => Math.max(5, Math.round((Number(h) || 60) * 0.55));

// griglia a strisciate dentro il poligono, parallela al lato più lungo, percorsa avanti e indietro
export function grigliaDiVolo(poligono, passo) {
  if (!Array.isArray(poligono) || poligono.length < 3) return [];
  const { xy, ll } = piano(poligono);
  const pts = poligono.map(xy);
  // orientamento: il lato più lungo
  let ang = 0, lmax = -1;
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > lmax) { lmax = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  });
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const ruota = ([x, y], cc, ss) => [x * cc - y * ss, x * ss + y * cc];
  const r = pts.map((p) => ruota(p, c, s));
  const ys = r.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const linee = [];
  for (let y = y0 + passo / 2; y < y1; y += passo) {
    const xs = [];
    r.forEach((a, i) => {
      const b = r[(i + 1) % r.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    });
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) linee.push([[xs[i], y], [xs[i + 1], y]]);
  }
  if (linee.length > 400) return [];
  const rotta = [];
  linee.forEach((l, i) => { const seg = i % 2 ? [l[1], l[0]] : l; rotta.push(...seg); });
  return rotta.map((p) => ll(ruota(p, Math.cos(ang), Math.sin(ang)))).map(([a, b]) => [Math.round(a * 1e7) / 1e7, Math.round(b * 1e7) / 1e7]);
}

// distanze cumulate lungo il percorso, in metri
export function misuraPercorso(rotta) {
  const cum = [0];
  for (let i = 1; i < rotta.length; i++) {
    const [a, b] = [rotta[i - 1], rotta[i]];
    const dx = (b[1] - a[1]) * mLon((a[0] + b[0]) / 2), dy = (b[0] - a[0]) * M_LAT;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return cum;
}

// dove si trova il drone dopo «d» metri: posizione, punto della rotta e direzione (gradi, 0 = nord)
export function lungoIlPercorso(rotta, cum, d) {
  if (!rotta.length) return null;
  const tot = cum[cum.length - 1];
  const dd = Math.max(0, Math.min(d, tot));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dd) i++;
  const a = rotta[i - 1] || rotta[0], b = rotta[i] || rotta[0];
  const seg = (cum[i] || 0) - (cum[i - 1] || 0);
  const k = seg > 0 ? (dd - cum[i - 1]) / seg : 0;
  const dx = (b[1] - a[1]) * mLon(a[0]), dy = (b[0] - a[0]) * M_LAT;
  const dir = (Math.atan2(dx, dy) * 180) / Math.PI;
  return { lat: a[0] + (b[0] - a[0]) * k, lon: a[1] + (b[1] - a[1]) * k, punto: Math.min(i, rotta.length), direzione: Math.round((dir + 360) % 360) };
}

// percorso troppo fitto (tracce GPX lunghe): tengo al massimo «n» punti
export function sfoltisci(rotta, n = 1500) {
  if (rotta.length <= n) return rotta;
  const passo = rotta.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(rotta[Math.floor(i * passo)]);
  out.push(rotta[rotta.length - 1]);
  return out;
}
