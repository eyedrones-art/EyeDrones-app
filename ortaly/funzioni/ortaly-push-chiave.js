// Ortaly — notifiche sul telefono (Web Push).
// 1. Come funzione Netlify: dà al telefono la chiave pubblica per attivare le notifiche.
// 2. Come modulo: ortaly-avviso e ortaly-messaggio lo usano per mandare le notifiche (notificaBottega).
// La coppia di chiavi VAPID si ricava da ORTALY_SUPABASE_SECRET: nessuna chiave in più da salvare su Netlify.
// Se il telefono ha dato le sue chiavi (p256dh, auth) il testo viaggia cifrato (RFC 8291) e lo legge solo lui;
// altrimenti la notifica arriva vuota e il telefono mostra un testo generico.
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

const hmac = (chiave, dati) => crypto.createHmac("sha256", chiave).update(dati).digest();
function cifra(testo, p256dh, auth) {
  const uaPub = Buffer.from(p256dh, "base64url"), segretoAuth = Buffer.from(auth, "base64url");
  const mio = crypto.createECDH("prime256v1"); mio.generateKeys();
  const asPub = mio.getPublicKey();
  const ikm = hmac(hmac(segretoAuth, mio.computeSecret(uaPub)), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])])).subarray(0, 32);
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
  const corpo = Buffer.from(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:info@ortaly.it" })).toString("base64url");
  const firma = crypto.sign("sha256", Buffer.from(`${testa}.${corpo}`), { key: crypto.createPrivateKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `vapid t=${testa}.${corpo}.${firma}, k=${chiavi.pubblica.toString("base64url")}`;
}

// manda { titolo, testo, url } a tutti i telefoni di una bottega; toglie quelli che non esistono più
async function notificaBottega({ supabaseUrl, chiave, intestazioni, bottega, messaggio }) {
  const r = await fetch(`${supabaseUrl}/rest/v1/notifiche?bottega=eq.${bottega}&select=id,endpoint,p256dh,auth`, { headers: intestazioni(chiave) }).catch(() => null);
  const lista = r && r.ok ? await r.json() : [];
  if (!lista.length) return 0;
  const chiavi = chiaviVapid(chiave);
  let mandate = 0;
  for (const n of lista) {
    let u;
    try { u = new URL(n.endpoint); } catch { continue; }
    if (u.protocol !== "https:") continue;
    const conTesto = n.p256dh && n.auth;
    const invio = await fetch(n.endpoint, {
      method: "POST",
      headers: { TTL: "86400", Urgency: "high", Authorization: firmaVapid(n.endpoint, chiavi), ...(conTesto ? { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream" } : {}) },
      ...(conTesto ? { body: cifra(JSON.stringify(messaggio).slice(0, 3000), n.p256dh, n.auth) } : {}),
    }).catch(() => null);
    if (invio && invio.ok) mandate++;
    else if (invio && (invio.status === 404 || invio.status === 410))
      await fetch(`${supabaseUrl}/rest/v1/notifiche?id=eq.${n.id}`, { method: "DELETE", headers: intestazioni(chiave) }).catch(() => null);
    else console.error("Notifica rifiutata:", invio && invio.status, invio && (await invio.text().catch(() => "")).slice(0, 200));
  }
  return mandate;
}

exports.chiaviVapid = chiaviVapid;
exports.cifra = cifra;
exports.notificaBottega = notificaBottega;
exports.handler = async () => {
  const segreto = process.env.ORTALY_SUPABASE_SECRET;
  if (!segreto) return { statusCode: 500, body: JSON.stringify({ messaggio: "Manca ORTALY_SUPABASE_SECRET" }) };
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    body: JSON.stringify({ chiave: chiaviVapid(segreto).pubblica.toString("base64url") }),
  };
};
