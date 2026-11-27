// Eyedrones — NDVI dal satellite (Sentinel-2, Copernicus Data Space Ecosystem) per i campi dell'Agricoltura.
// azione "storico": NDVI medio del campo giorno per giorno (solo i giorni con poche nuvole sopra il campo).
// azione "mappa": la mappa NDVI di un giorno come GeoTIFF FLOAT32 in gradi (EPSG 4326): l'app la legge come
// le mappe del drone (leggiMappaIndice) e la salva nello storico del campo.
// Variabili su Netlify: CDSE_CLIENT_ID e CDSE_CLIENT_SECRET (client OAuth creato nella dashboard di Copernicus Data Space).
// La chiave resta sul server: non passa mai dal telefono.

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const SH = "https://sh.dataspace.copernicus.eu/api/v1";
const CRS84 = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";

const json = (statusCode, dati) => ({ statusCode, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(dati) });

async function utenteDa(token) {
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}

// token OAuth di Copernicus, tenuto in memoria finché non scade
let tokenCdse = null;
async function chiaveCdse() {
  if (tokenCdse && tokenCdse.scade > Date.now() + 60000) return tokenCdse.valore;
  const corpo = new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.CDSE_CLIENT_ID, client_secret: process.env.CDSE_CLIENT_SECRET });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: corpo });
  if (!r.ok) throw Object.assign(new Error("chiave"), { stato: r.status });
  const j = await r.json();
  tokenCdse = { valore: j.access_token, scade: Date.now() + (Number(j.expires_in) || 300) * 1000 };
  return tokenCdse.valore;
}

// NDVI con le nuvole tolte (classificazione della scena: ombre di nuvole, nuvole medie e alte, cirri)
const EVAL_STATISTICHE = `//VERSION=3
function setup() { return { input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }], output: [{ id: "ndvi", bands: 1, sampleType: "FLOAT32" }, { id: "dataMask", bands: 1 }] }; }
function evaluatePixel(s) {
  const nuvola = [3, 8, 9, 10].indexOf(s.SCL) >= 0;
  const ndvi = (s.B08 + s.B04) > 0 ? (s.B08 - s.B04) / (s.B08 + s.B04) : 0;
  return { ndvi: [ndvi], dataMask: [s.dataMask && !nuvola ? 1 : 0] };
}`;
const EVAL_MAPPA = `//VERSION=3
function setup() { return { input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }], output: { bands: 1, sampleType: "FLOAT32" }, mosaicking: "SIMPLE" }; }
function evaluatePixel(s) {
  const nuvola = [3, 8, 9, 10].indexOf(s.SCL) >= 0;
  if (!s.dataMask || nuvola || (s.B08 + s.B04) <= 0) return [NaN];
  return [(s.B08 - s.B04) / (s.B08 + s.B04)];
}`;

// controllo del confine: un poligono (o multipoligono) GeoJSON in gradi, non troppo grande
function geometriaValida(g) {
  if (!g || !["Polygon", "MultiPolygon"].includes(g.type) || !Array.isArray(g.coordinates)) return null;
  const punti = (g.type === "Polygon" ? g.coordinates : g.coordinates.flat()).flat();
  if (!punti.length || punti.length > 5000 || !punti.every((p) => Array.isArray(p) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90)) return null;
  const lon = punti.map((p) => p[0]), lat = punti.map((p) => p[1]);
  const bbox = [Math.min(...lon), Math.min(...lat), Math.max(...lon), Math.max(...lat)];
  if (bbox[2] - bbox[0] > 0.2 || bbox[3] - bbox[1] > 0.2) return null; // più di 15-20 km: non è un campo
  return { geometry: { type: g.type, coordinates: g.coordinates }, bbox };
}
const giorno = (d) => new Date(d).toISOString().slice(0, 10);
const piu = (iso, giorni) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + giorni * 86400000).toISOString();

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { errore: "Usa POST." });
  if (!process.env.CDSE_CLIENT_ID || !process.env.CDSE_CLIENT_SECRET) return json(503, { errore: "Il satellite non è ancora attivo: manca la chiave di Copernicus sul server." });
  const token = String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  const utente = await utenteDa(token).catch(() => null);
  if (!utente || !utente.id) return json(401, { errore: "Accedi a EyeDrones per usare il satellite." });

  let dati;
  try { dati = JSON.parse(event.body || "{}"); } catch { return json(400, { errore: "Richiesta non leggibile." }); }
  const g = geometriaValida(dati.geometria);
  if (!g) return json(400, { errore: "Serve il confine del campo (disegnalo o importalo negli Appezzamenti)." });

  let chiave;
  try { chiave = await chiaveCdse(); } catch (e) { return json(503, { errore: "La chiave di Copernicus sul server non funziona: controllala su Netlify." }); }
  const intestazioni = { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" };

  try {
    if (dati.azione === "storico") {
      const giorni = Math.min(365, Math.max(15, Number(dati.giorni) || 120));
      const al = new Date(); const dal = new Date(al.getTime() - giorni * 86400000);
      const r = await fetch(`${SH}/statistics`, {
        method: "POST", headers: intestazioni,
        body: JSON.stringify({
          input: { bounds: { geometry: g.geometry, properties: { crs: CRS84 } }, data: [{ type: "sentinel-2-l2a", dataFilter: { maxCloudCoverage: 90 } }] },
          aggregation: { timeRange: { from: dal.toISOString(), to: al.toISOString() }, aggregationInterval: { of: "P1D" }, evalscript: EVAL_STATISTICHE, resx: 0.0001, resy: 0.0001 },
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) return json(502, { errore: `Copernicus non ha risposto (${r.status}). Riprova tra poco.` });
      const serie = (j.data || []).map((x) => {
        const st = x.outputs && x.outputs.ndvi && x.outputs.ndvi.bands && x.outputs.ndvi.bands.B0 && x.outputs.ndvi.bands.B0.stats;
        if (!st || !st.sampleCount) return null;
        const validi = st.sampleCount - (st.noDataCount || 0);
        const coperto = validi / st.sampleCount;
        if (coperto < 0.6 || !Number.isFinite(st.mean)) return null; // troppe nuvole sul campo quel giorno
        return { data: giorno(x.interval.from), media: Math.round(st.mean * 1000) / 1000, min: Math.round(st.min * 1000) / 1000, max: Math.round(st.max * 1000) / 1000, sereno: Math.round(coperto * 100) };
      }).filter(Boolean);
      return json(200, { serie, giorni });
    }

    if (dati.azione === "mappa") {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(String(dati.data || "")) ? dati.data : giorno(Date.now());
      const [x0, y0, x1, y1] = g.bbox;
      const mx = (x1 - x0) * 111320 * Math.cos(((y0 + y1) / 2) * Math.PI / 180), my = (y1 - y0) * 110540;
      const larg = Math.max(16, Math.min(600, Math.round(mx / 10))), alt = Math.max(16, Math.min(600, Math.round(my / 10)));
      const r = await fetch(`${SH}/process`, {
        method: "POST", headers: { ...intestazioni, Accept: "image/tiff" },
        body: JSON.stringify({
          input: { bounds: { bbox: g.bbox, geometry: g.geometry, properties: { crs: CRS84 } }, data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: `${d}T00:00:00Z`, to: piu(d, 1) }, mosaickingOrder: "leastCC" } }] },
          output: { width: larg, height: alt, responses: [{ identifier: "default", format: { type: "image/tiff" } }] },
          evalscript: EVAL_MAPPA,
        }),
      });
      if (!r.ok) { const t = await r.text().catch(() => ""); return json(502, { errore: `Copernicus non ha dato la mappa (${r.status}).`, dettaglio: t.slice(0, 200) }); }
      const buf = Buffer.from(await r.arrayBuffer());
      return json(200, { data: d, tiff: buf.toString("base64"), larghezza: larg, altezza: alt });
    }
    return json(400, { errore: "Azione sconosciuta." });
  } catch (e) {
    return json(500, { errore: "Qualcosa è andato storto con il satellite." });
  }
};
