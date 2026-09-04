const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { PNG } = require("pngjs");

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

  const idTemp = crypto.randomBytes(6).toString("hex");
  const inputPath = path.join(os.tmpdir(), `termica-in-${idTemp}.jpg`);

  try {
    const body = JSON.parse(event.body);
    const { imageBase64, palette } = body;
    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ errore: "Manca l'immagine (imageBase64)." }) };
    }

    const buffer = Buffer.from(imageBase64, "base64");
    fs.writeFileSync(inputPath, buffer);

    const workerPath = path.join(__dirname, "thermal-worker.js");
    let output;
    try {
      output = execFileSync(process.execPath, [workerPath, inputPath], {
        env: { ...process.env, LD_LIBRARY_PATH: `${__dirname}:${process.env.LD_LIBRARY_PATH || ""}` },
        maxBuffer: 40 * 1024 * 1024,
        timeout: 25000,
      });
    } catch (errEsecuzione) {
      let elencoCartella = [];
      try { elencoCartella = fs.readdirSync(__dirname); } catch (e) {}
      return {
        statusCode: 500,
        body: JSON.stringify({
          errore: "Il processo di lettura dati termici non è partito correttamente: " +
            (errEsecuzione?.message || String(errEsecuzione)) +
            " | stdout=" + (errEsecuzione?.stdout ? errEsecuzione.stdout.toString().slice(0, 500) : "") +
            " | stderr=" + (errEsecuzione?.stderr ? errEsecuzione.stderr.toString().slice(0, 500) : "") +
            " | file presenti=" + JSON.stringify(elencoCartella),
        }),
      };
    }

    let risultato;
    try {
      risultato = JSON.parse(output.toString());
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ errore: "Risposta del processo dati non valida: " + output.toString().slice(0, 500) }) };
    }

    if (!risultato.ok) {
      return { statusCode: 500, body: JSON.stringify({ errore: "Non sono riuscito a leggere i dati radiometrici. Verifica che la foto sia un R-JPEG DJI originale (non modificata/esportata da altri software). Dettaglio: " + risultato.errore }) };
    }

    const { width, height, parameters, data } = risultato;
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
      body: JSON.stringify({ errore: "Errore generico durante l'elaborazione. Dettaglio: " + (err?.message || String(err)) }),
    };
  } finally {
    try { fs.unlinkSync(inputPath); } catch (e) {}
  }
};
