const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { PNG } = require("pngjs");

// solo per gli iscritti: chiedo a Supabase di chi è il token (come analisi-foto.js)
const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const MAX_FOTO = 5.5 * 1024 * 1024; // byte dopo la decodifica (Netlify accetta al massimo 6 MB)
async function iscritto(token) {
  if (!token) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    return r.ok;
  } catch { return false; }
}

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
  const token = String(event.headers.authorization || event.headers.Authorization || "").replace(/^Bearer\s+/i, "");
  if (!(await iscritto(token))) {
    return { statusCode: 401, body: JSON.stringify({ errore: "Accedi a EyeDrones per elaborare la foto termica." }) };
  }

  const idTemp = crypto.randomBytes(6).toString("hex");
  const inputPath = path.join(os.tmpdir(), `termica-in-${idTemp}.jpg`);

  try {
    const body = JSON.parse(event.body);
    const { imageBase64, palette } = body;
    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ errore: "Manca l'immagine (imageBase64)." }) };
    }

    const buffer = Buffer.from(String(imageBase64), "base64");
    if (buffer.length > MAX_FOTO) {
      return { statusCode: 413, body: JSON.stringify({ errore: "Foto troppo grande." }) };
    }
    fs.writeFileSync(inputPath, buffer);

    const workerPath = path.join(__dirname, "thermal-worker.js");
    let output;
    try {
      output = execFileSync(process.execPath, [workerPath, inputPath], {
        // al processo che legge la foto passo solo quello che serve, nessuna chiave segreta
        env: { PATH: process.env.PATH || "", LD_LIBRARY_PATH: `${__dirname}:${process.env.LD_LIBRARY_PATH || ""}` },
        maxBuffer: 40 * 1024 * 1024,
        timeout: 25000,
      });
    } catch (errEsecuzione) {
      // i dettagli tecnici restano nei log di Netlify, non vanno a chi chiama
      console.error("thermal-worker:", errEsecuzione?.message, errEsecuzione?.stderr ? errEsecuzione.stderr.toString().slice(0, 500) : "");
      return { statusCode: 500, body: JSON.stringify({ errore: "Non sono riuscito a leggere la foto termica, riprova tra poco." }) };
    }

    let risultato;
    try {
      risultato = JSON.parse(output.toString());
    } catch (e) {
      console.error("thermal-worker: risposta non valida", output.toString().slice(0, 500));
      return { statusCode: 500, body: JSON.stringify({ errore: "Non sono riuscito a leggere la foto termica, riprova tra poco." }) };
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
    console.error("thermal-repalette:", err?.message || String(err));
    return {
      statusCode: 500,
      body: JSON.stringify({ errore: "Errore durante l'elaborazione della foto, riprova." }),
    };
  } finally {
    try { fs.unlinkSync(inputPath); } catch (e) {}
  }
};
