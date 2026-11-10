// Ortaly — chiave pubblica per le notifiche sul telefono (VAPID). Il telefono la chiede prima di attivare le notifiche.
// La coppia di chiavi si ricava da ORTALY_SUPABASE_SECRET: nessuna chiave in più da salvare su Netlify.
// La stessa funzione di calcolo è in ortaly-avviso.js (che firma le notifiche con la chiave privata).
const crypto = require("crypto");

const N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"); // ordine della curva P-256
function chiaviVapid(segreto) {
  for (let i = 0; i < 100; i++) {
    const d = crypto.createHmac("sha256", segreto).update(`ortaly-vapid-${i}`).digest();
    const n = BigInt("0x" + d.toString("hex"));
    if (n === 0n || n >= N) continue;
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(d);
    return { privata: d, pubblica: ecdh.getPublicKey() }; // pubblica: 65 byte, non compressa
  }
  throw new Error("chiave non valida");
}

exports.chiaviVapid = chiaviVapid;
exports.handler = async () => {
  const segreto = process.env.ORTALY_SUPABASE_SECRET;
  if (!segreto) return { statusCode: 500, body: JSON.stringify({ messaggio: "Manca ORTALY_SUPABASE_SECRET" }) };
  const { pubblica } = chiaviVapid(segreto);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    body: JSON.stringify({ chiave: pubblica.toString("base64url") }),
  };
};
