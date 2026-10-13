// Area di volo disegnata a mano (poligono) per lo STS-01: superficie, perimetro e le fasce
// di contingenza e buffer «allargate» della distanza giusta tutto attorno, anche su forme irregolari.
// Lavoro in metri su un piano locale (va benissimo per aree di qualche chilometro).

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
