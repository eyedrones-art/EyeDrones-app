// Parchi e siti Natura 2000: D-Flight li mostra sulla mappa ma NON li mette nel file zone (ED-269).
// Li prendo dai dati pubblici dell'Agenzia europea dell'ambiente (CC BY 4.0), semplificati e divisi
// in riquadri di 1° x 1° in /aree-protette/<lat>_<lon>.json: l'app scarica solo il riquadro che serve.
// Non sono zone vietate: dentro un'area protetta ci possono essere limiti al volo decisi dall'ente.

export const FONTE_AREE_PROTETTE = "Agenzia europea dell'ambiente (EEA): Natura 2000 fine 2024 e aree protette nazionali luglio 2026, licenza CC BY 4.0";

// tipo del sito Natura 2000: A = ZPS (uccelli), B = SIC/ZSC (habitat), C = tutte e due
export const TIPI_NATURA = { A: "ZPS", B: "ZSC/SIC", C: "ZSC/SIC e ZPS" };

const riquadri = new Map();
function riquadro(lat, lon) {
  const chiave = `${Math.floor(lat)}_${Math.floor(lon)}`;
  if (!riquadri.has(chiave)) {
    const p = fetch(`/aree-protette/${chiave}.json`)
      .then((r) => (r.ok ? r.json() : r.status === 404 ? [] : Promise.reject(new Error(`HTTP ${r.status}`))))
      .catch((e) => { riquadri.delete(chiave); throw e; });
    riquadri.set(chiave, p);
  }
  return riquadri.get(chiave);
}

function dentroAnello(x, y, anello) {
  let c = false;
  for (let i = 0, j = anello.length - 1; i < anello.length; j = i++) {
    const [xi, yi] = anello[i], [xj, yj] = anello[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// distanza in metri dal bordo (approssimazione piana, va bene per poche centinaia di metri)
function distanzaBordo(lon, lat, anello) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180), ky = 110540;
  let min = Infinity;
  for (let i = 1; i < anello.length; i++) {
    const ax = (anello[i - 1][0] - lon) * kx, ay = (anello[i - 1][1] - lat) * ky;
    const bx = (anello[i][0] - lon) * kx, by = (anello[i][1] - lat) * ky;
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    const t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

const dentroSito = (s, lon, lat) => s.p.some((pol) => dentroAnello(lon, lat, pol[0]) && !pol.slice(1).some((buco) => dentroAnello(lon, lat, buco)));

// in quali aree protette cade il punto, e quali sono vicine (entro «raggio» metri)
export function areeNelPunto(siti, { lat, lon }, { raggio = 300 } = {}) {
  const dLat = raggio / 110540, dLon = raggio / (111320 * Math.cos((lat * Math.PI) / 180));
  const dentro = [], vicine = [], visti = new Set();
  for (const s of siti || []) {
    if (visti.has(s.c)) continue;
    visti.add(s.c);
    const [x0, y0, x1, y1] = s.b;
    if (lon < x0 - dLon || lon > x1 + dLon || lat < y0 - dLat || lat > y1 + dLat) continue;
    const area = { codice: s.c, nome: s.n, tipo: s.k === "parco" ? s.t : TIPI_NATURA[s.t] || "Natura 2000", parco: s.k === "parco" };
    if (dentroSito(s, lon, lat)) { dentro.push(area); continue; }
    if (raggio > 0) {
      const d = Math.min(...s.p.map((pol) => distanzaBordo(lon, lat, pol[0])));
      if (d <= raggio) vicine.push({ ...area, distanza: Math.round(d / 10) * 10 });
    }
  }
  // prima i parchi, poi i siti Natura 2000
  dentro.sort((a, b) => Number(b.parco) - Number(a.parco));
  vicine.sort((a, b) => a.distanza - b.distanza);
  return { dentro, vicine };
}

// scarica il riquadro del punto (e quelli accanto, se il punto è vicino al bordo) e controlla
export async function cercaAreeProtette({ lat, lon }, { raggio = 300 } = {}) {
  const m = 0.01; // circa 1 km
  const chiavi = new Set();
  for (const dy of [-m, 0, m]) for (const dx of [-m, 0, m]) chiavi.add(`${Math.floor(lat + dy)}|${Math.floor(lon + dx)}`);
  const liste = await Promise.all([...chiavi].map((k) => { const [y, x] = k.split("|").map(Number); return riquadro(y + 0.5, x + 0.5); }));
  return areeNelPunto(liste.flat(), { lat, lon }, { raggio });
}
