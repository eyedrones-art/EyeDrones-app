// Camere dei droni per il calcolo della fotogrammetria (GSD, impronta, scatti).
// Per ogni camera: larghezza del sensore (mm), focale reale (mm), larghezza della foto (px)
// e rapporto lato corto / lato lungo. Valori indicativi dalle schede tecniche: la focale reale
// è ricavata da quella equivalente quando il costruttore non la scrive.
// «zoom»: focale reale minima e massima dello zoom ottico (lo zoom digitale non aggiunge dettaglio).
const RGB_43 = { sensore: 17.3, focale: 12.29, px: 5280, rapporto: 0.75 }; // 4/3" 20 MP, 24 mm equivalenti
const TERMICA_640 = { nome: "Termica (640 × 512)", sensore: 7.68, focale: 9.1, px: 640, rapporto: 0.8, termica: true };

export const DRONI_CAMERE = [
  {
    key: "m3t", nome: "DJI Mavic 3T (Thermal)", re: /mavic\s*3\s*(t\b|thermal)/,
    camere: [
      { key: "wide", nome: "Grandangolo 48 MP", sensore: 6.4, focale: 4.4, px: 8000, rapporto: 0.75 },
      { key: "tele", nome: "Zoom tele", sensore: 6.4, focale: 30, px: 4000, rapporto: 0.75 },
      { key: "ir", ...TERMICA_640 },
    ],
  },
  {
    key: "m3e", nome: "DJI Mavic 3 Enterprise (3E)", re: /mavic\s*3\s*(e\b|enterprise)/,
    camere: [
      { key: "wide", nome: "Grandangolo 4/3 20 MP", ...RGB_43 },
      { key: "tele", nome: "Zoom tele", sensore: 6.4, focale: 30, px: 4000, rapporto: 0.75 },
    ],
  },
  {
    key: "m3m", nome: "DJI Mavic 3 Multispectral", re: /mavic\s*3\s*(m\b|multispectral|multispettrale)/,
    camere: [{ key: "rgb", nome: "Camera RGB 4/3 20 MP", ...RGB_43 }],
  },
  {
    key: "m4t", nome: "DJI Matrice 4T", re: /(matrice|\bm)\s*4\s*t\b/,
    camere: [
      { key: "wide", nome: "Grandangolo 48 MP", sensore: 9.6, focale: 6.7, px: 8064, rapporto: 0.75 },
      { key: "medio", nome: "Medio tele", sensore: 9.6, focale: 19.4, px: 8064, rapporto: 0.75 },
      { key: "tele", nome: "Tele", sensore: 8.8, focale: 41.5, px: 8192, rapporto: 0.75 },
      { key: "ir", nome: "Termica (640 × 512)", sensore: 7.68, focale: 12, px: 640, rapporto: 0.8, termica: true },
    ],
  },
  {
    key: "m4e", nome: "DJI Matrice 4E", re: /(matrice|\bm)\s*4\s*e?\b/,
    camere: [
      { key: "wide", nome: "Grandangolo 4/3 20 MP", ...RGB_43 },
      { key: "medio", nome: "Medio tele", sensore: 9.6, focale: 19.4, px: 8064, rapporto: 0.75 },
      { key: "tele", nome: "Tele", sensore: 8.8, focale: 41.5, px: 8192, rapporto: 0.75 },
    ],
  },
  {
    key: "m30t", nome: "DJI Matrice 30T", re: /(matrice|\bm)\s*30\s*t\b/,
    camere: [
      { key: "wide", nome: "Grandangolo 12 MP", sensore: 6.4, focale: 4.5, px: 4000, rapporto: 0.75 },
      { key: "zoom", nome: "Zoom 48 MP (5×–16× ottico)", sensore: 6.4, focale: 21, px: 8000, rapporto: 0.75, zoom: [21, 75] },
      { key: "ir", ...TERMICA_640 },
    ],
  },
  {
    key: "m30", nome: "DJI Matrice 30", re: /(matrice|\bm)\s*30\b/,
    camere: [
      { key: "wide", nome: "Grandangolo 12 MP", sensore: 6.4, focale: 4.5, px: 4000, rapporto: 0.75 },
      { key: "zoom", nome: "Zoom 48 MP (5×–16× ottico)", sensore: 6.4, focale: 21, px: 8000, rapporto: 0.75, zoom: [21, 75] },
    ],
  },
  {
    key: "p1", nome: "DJI Matrice 300/350 + Zenmuse P1", re: /(matrice|\bm)\s*3[05]0|zenmuse\s*p1|\bp1\b/,
    camere: [
      { key: "35", nome: "P1 con ottica 35 mm", sensore: 35.9, focale: 35, px: 8192, rapporto: 0.67 },
      { key: "24", nome: "P1 con ottica 24 mm", sensore: 35.9, focale: 24, px: 8192, rapporto: 0.67 },
      { key: "50", nome: "P1 con ottica 50 mm", sensore: 35.9, focale: 50, px: 8192, rapporto: 0.67 },
    ],
  },
  {
    key: "p4rtk", nome: "DJI Phantom 4 RTK", re: /phantom\s*4/,
    camere: [{ key: "rgb", nome: "Camera 1\" 20 MP", sensore: 13.2, focale: 8.8, px: 5472, rapporto: 0.75 }],
  },
  {
    key: "mavic3", nome: "DJI Mavic 3 / 3 Classic / 3 Pro / 4 Pro", re: /mavic\s*[34]/,
    camere: [{ key: "wide", nome: "Camera principale 4/3 20 MP", ...RGB_43 }],
  },
  {
    key: "mini", nome: "DJI Mini 3/4 Pro, Air 3 (12 MP)", re: /mini\s*[34]|air\s*3/,
    camere: [{ key: "rgb", nome: "Camera principale (foto da 12 MP)", sensore: 9.6, focale: 6.72, px: 4032, rapporto: 0.75 }],
  },
];

export const CAMERA_MANUALE = { key: "manuale", nome: "Altra fotocamera (inserisco i dati)", sensore: 13.2, focale: 8.8, px: 5472, rapporto: 0.75 };

// «m3t:tele» → { drone, camera }; null se non esiste
export function trovaCamera(chiave) {
  const [d, c] = String(chiave || "").split(":");
  const drone = DRONI_CAMERE.find((x) => x.key === d);
  const camera = drone && drone.camere.find((x) => x.key === c);
  return camera ? { drone, camera } : null;
}

// il drone del pilota (modello e nome scritti da lui) → la prima camera di quel drone, se lo riconosco
export function cameraDelDrone(...testi) {
  const t = testi.filter(Boolean).join(" ").toLowerCase();
  if (!t.trim()) return null;
  const drone = DRONI_CAMERE.find((x) => x.re.test(t));
  return drone ? `${drone.key}:${drone.camere[0].key}` : null;
}
