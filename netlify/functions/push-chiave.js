// EyeDrones — notifiche sul telefono (Web Push).
// 1. Come funzione Netlify: dà al telefono la chiave pubblica per attivare le notifiche.
// 2. Come modulo: avviso-lavori lo usa per mandare le notifiche (inviaPush).
// La coppia di chiavi VAPID si ricava da AVVISO_SEGRETO: nessuna chiave in più da salvare su Netlify.
// Il testo della notifica viaggia cifrato (RFC 8291, aes128gcm): lo legge solo il telefono.
const crypto = require("crypto");

const N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551"); // ordine della curva P-256
function chiaviVapid(segreto) {
  for (let i = 0; i < 100; i++) {
    const d = crypto.createHmac("sha256", String(segreto)).update(`eyedrones-vapid-${i}`).digest();
    const n = BigInt("0x" + d.toString("hex"));
    if (n === 0n || n >= N) continue;
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(d);
    return { privata: d, pubblica: ecdh.getPublicKey() };
  }
  throw new Error("chiave non valida");
}

const hmac = (chiave, dati) => crypto.createHmac("sha256", chiave).update(dati).digest();

// cifra il testo per un telefono (RFC 8291 + RFC 8188, un solo blocco)
function cifra(testo, p256dh, auth) {
  const uaPub = Buffer.from(p256dh, "base64url"), segretoAuth = Buffer.from(auth, "base64url");
  const mio = crypto.createECDH("prime256v1"); mio.generateKeys();
  const asPub = mio.getPublicKey();
  const condiviso = mio.computeSecret(uaPub);
  const prkKey = hmac(segretoAuth, condiviso);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])])).subarray(0, 32);
  const sale = crypto.randomBytes(16);
  const prk = hmac(sale, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const corpo = Buffer.concat([c.update(Buffer.concat([Buffer.from(testo, "utf8"), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sale, rs, Buffer.from([asPub.length]), asPub, corpo]);
}

function firmaVapid(endpoint, chiavi) {
  const jwk = { kty: "EC", crv: "P-256", d: chiavi.privata.toString("base64url"), x: chiavi.pubblica.subarray(1, 33).toString("base64url"), y: chiavi.pubblica.subarray(33, 65).toString("base64url") };
  const testa = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const corpo = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:info@eyedrones.it" })).toString("base64url");
  const firma = crypto.sign("sha256", Buffer.from(`${testa}.${corpo}`), { key: crypto.createPrivateKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `vapid t=${testa}.${corpo}.${firma}, k=${chiavi.pubblica.toString("base64url")}`;
}

// manda { titolo, testo, url } a un telefono; risponde "ok", "via" (telefono che non c'è più) o "errore"
async function inviaPush(segreto, telefono, messaggio) {
  let aud;
  try { aud = new URL(telefono.endpoint); } catch { return "via"; }
  if (aud.protocol !== "https:") return "via";
  const chiavi = chiaviVapid(segreto);
  const r = await fetch(telefono.endpoint, {
    method: "POST",
    headers: { TTL: "86400", Urgency: "high", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: firmaVapid(telefono.endpoint, chiavi) },
    body: cifra(JSON.stringify(messaggio).slice(0, 3000), telefono.p256dh, telefono.auth),
  }).catch(() => null);
  if (r && r.ok) return "ok";
  if (r && (r.status === 404 || r.status === 410)) return "via";
  console.error("Notifica rifiutata:", r && r.status, r && (await r.text().catch(() => "")).slice(0, 200));
  return "errore";
}

exports.chiaviVapid = chiaviVapid;
exports.cifra = cifra;
exports.inviaPush = inviaPush;
exports.handler = async () => {
  const segreto = process.env.AVVISO_SEGRETO;
  if (!segreto) return { statusCode: 500, body: JSON.stringify({ messaggio: "Manca AVVISO_SEGRETO" }) };
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    body: JSON.stringify({ chiave: chiaviVapid(segreto).pubblica.toString("base64url") }),
  };
};
