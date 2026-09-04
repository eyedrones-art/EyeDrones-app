// Questo file gira come processo separato (non richiesto direttamente da thermal-repalette.js),
// così può ricevere LD_LIBRARY_PATH fin dalla propria nascita invece di doverlo cambiare a processo già avviato.
const fs = require("fs");

try {
  const inputPath = process.argv[2];
  const buffer = fs.readFileSync(inputPath);
  const { getTemperatureData } = require("dji-thermal-sdk");
  const { width, height, parameters, data } = getTemperatureData(buffer);
  process.stdout.write(JSON.stringify({
    ok: true,
    width,
    height,
    parameters,
    data: Array.from(data),
  }));
} catch (err) {
  process.stdout.write(JSON.stringify({ ok: false, errore: err?.message || String(err) }));
}
