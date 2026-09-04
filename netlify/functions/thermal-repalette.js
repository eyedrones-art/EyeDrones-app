const path = require("path");

// indico dove trovare la libreria di sistema mancante (libgomp.so.1),
// che includiamo insieme alla funzione perché i server di Netlify non ce l'hanno di default
const cartellaLib = path.join(__dirname, "lib");
process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
  ? `${cartellaLib}:${process.env.LD_LIBRARY_PATH}`
  : cartellaLib;

const { getTemperatureData } = require("dji-thermal-sdk");
const { PNG } = require("pngjs");

// --- palette termiche: array di tappe [posizione 0-1, [r,g,b]] ---
const PALETTE = {
  ironbow: [
    [0.00, [0, 0, 20]], [0.20, [40, 0, 100]], [0.40, [140, 0, 120]],
    [0.60, [220, 60, 20]], [0.80, [255, 170, 0]], [1.00, [255, 255, 200]],
  ],
  rainbow: [
    [0.00, [0, 0, 255]], [0.25, [0, 255, 255]], [0.50, [0, 255, 0]],
    [0.75, [255, 255, 0]], [1.00, [255, 0, 0]],
  ],
  whitehot: [[0.00, [0, 0, 0]], [1.00, [255, 255, 255]]],
  blackhot: [[0.00, [255, 255, 255]], [1.00, [0, 0, 0]]],
  arctic: [
    [0.00, [10, 10, 60]], [0.35, [30, 90, 180]], [0.65, [130, 200, 230]], [1.00, [255, 255, 255]],
  ],
  lava: [
    [0.00, [0, 0, 0]], [0.40, [120, 0, 0]], [0.70, [230, 90, 0]], [1.00, [255, 230, 80]],
  ],
};

function coloreDaPalette(nomePalette, t) {
  const tappe = PALETTE[nomePalette] || PALETTE.ironbow;
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < tappe.length - 1; i++) {
    const [p0, c0] = tappe[i];
    const [p1, c1] = tappe[i + 1];
    if (t >= p0 && t <= p1) {
      const f = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * f),
        Math.round(c0[1] + (c1[1] - c0[1]) * f),
        Math.round(c0[2] + (c1[2] - c0[2]) * f),
      ];
    }
  }
  return tappe[tappe.length - 1][1];
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Metodo non consentito" };
  }
  try {
    const body = JSON.parse(event.body);
    const { imageBase64, palette } = body;
    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ errore: "Manca l'immagine (imageBase64)." }) };
    }

    const buffer = Buffer.from(imageBase64, "base64");

    // estrazione dei dati radiometrici reali con l'SDK ufficiale DJI
    const { width, height, parameters, data } = getTemperatureData(buffer);

    // data è un Uint16Array, ogni valore = temperatura in decimi di grado (es. 234 => 23.4°C)
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const t = data[i] / 10;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    const range = max - min || 1;

    const png = new PNG({ width, height });
    for (let i = 0; i < data.length; i++) {
      const temp = data[i] / 10;
      const norm = (temp - min) / range;
      const [r, g, b] = coloreDaPalette(palette, norm);
      const idx = i * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }

    const pngBuffer = PNG.sync.write(png);
    const imageOutBase64 = pngBuffer.toString("base64");

    return {
      statusCode: 200,
      body: JSON.stringify({
        imageBase64: imageOutBase64,
        width,
        height,
        minTemp: Number(min.toFixed(1)),
        maxTemp: Number(max.toFixed(1)),
        parametri: parameters,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ errore: "Non sono riuscito a leggere i dati radiometrici. Verifica che la foto sia un R-JPEG DJI originale (non modificata/esportata da altri software). Dettaglio: " + (err?.message || String(err)) }),
    };
  }
};
