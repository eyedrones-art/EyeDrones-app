import React, { useEffect, useState } from "react";
import AnimazioneManovra, { haAnimazione } from "./AnimazioneManovra.jsx";
import { copiaTesto } from "./Ispezioni.jsx";

// «Piano delle scene» per video, foto e FPV: ogni scena con manovra, luce, durata, altezza, velocità, fps e note.
// Si salva nel piano (checklist_stato.scene); sul posto le scene si spuntano una per una (DaGirare in Home).
export const LUCI_SCENA = { qualsiasi: "Qualsiasi luce", oro: "✨ Ora d'oro", blu: "🔵 Ora blu", giorno: "☀️ Giorno pieno", notte: "🌙 Notte" };
const VELOCITA = { lenta: "Lenta", media: "Media", veloce: "Veloce" };
const nuovoId = () => `sc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function scenaVuota(tipo, manovra = null) {
  return {
    id: nuovoId(),
    manovra: manovra ? manovra.id : "",
    titolo: manovra ? manovra.nome.replace(/ \(.*\)$/, "") : "",
    luce: "qualsiasi",
    durata: tipo === "foto" ? 0 : 6,
    altezza: tipo === "fpv" ? 10 : 40,
    velocita: tipo === "fpv" ? "veloce" : "lenta",
    fps: tipo === "foto" ? "" : tipo === "fpv" ? "60" : "25",
    note: "",
    ora: "",
    foto: null, // { url, lat, lon, quando }: foto di riferimento fatta al sopralluogo
  };
}

// foto di riferimento: l'indirizzo vero arriva da «visibile» (lo spazio riservato dà link temporanei)
export function FotoScena({ foto, visibile, alta = 120, onApri }) {
  const [href, setHref] = useState(null);
  useEffect(() => {
    let vivo = true;
    if (!foto || !foto.url) { setHref(null); return undefined; }
    Promise.resolve(visibile ? visibile(foto.url) : foto.url).then((h) => { if (vivo) setHref(h); }, () => {});
    return () => { vivo = false; };
  }, [foto && foto.url]);
  if (!foto || !foto.url) return null;
  return (
    <div style={{ marginTop: 6 }}>
      {href
        ? <img src={href} alt="Foto di riferimento della scena" onClick={onApri} style={{ display: "block", width: "100%", maxHeight: alta, objectFit: "cover", borderRadius: 6, background: "#000", cursor: onApri ? "pointer" : "default" }} />
        : <div style={{ height: 60, borderRadius: 6, background: "#251e33", color: "#a8a2bd", fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center" }}>Carico la foto…</div>}
      {foto.lat != null && (
        <a href={`https://www.google.com/maps?q=${foto.lat},${foto.lon}`} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 11, color: "#7fb0ff", marginTop: 3 }}>📍 Punto della foto ({Number(foto.lat).toFixed(5)}, {Number(foto.lon).toFixed(5)}) ↗</a>
      )}
    </div>
  );
}

// punto GPS salvato dentro una foto JPG (dati EXIF), per le foto prese dalla galleria. null se non c'è
export async function leggiGpsFoto(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), lung = v.getUint16(o + 2);
      if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) { // «Exif»
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = (x) => v.getUint16(x, le), u32 = (x) => v.getUint32(x, le);
        const voci = (ifd) => { const n = u16(t + ifd); return [...Array(n)].map((_, i) => { const e = t + ifd + 2 + i * 12; return { tag: u16(e), tipo: u16(e + 2), n: u32(e + 4), val: e + 8 }; }); };
        const gpsIfd = voci(u32(t + 4)).find((e) => e.tag === 0x8825);
        if (!gpsIfd) return null;
        const g = voci(u32(gpsIfd.val));
        const rif = (tag) => { const e = g.find((x) => x.tag === tag); return e ? String.fromCharCode(v.getUint8(e.val)) : null; };
        const gradi = (tag) => {
          const e = g.find((x) => x.tag === tag); if (!e) return null;
          const d = t + u32(e.val); const r = (k) => u32(d + k * 8) / (u32(d + k * 8 + 4) || 1);
          return r(0) + r(1) / 60 + r(2) / 3600;
        };
        let lat = gradi(2), lon = gradi(4);
        if (lat == null || lon == null || (lat === 0 && lon === 0)) return null;
        if (rif(1) === "S") lat = -lat;
        if (rif(3) === "W") lon = -lon;
        return { lat, lon };
      }
      if ((marker & 0xff00) !== 0xff00) return null;
      o += 2 + lung;
    }
  } catch { /* foto senza dati leggibili */ }
  return null;
}

// minuti da "HH:MM"
const minutiDa = (h) => { const m = /^(\d{1,2}):(\d{2})/.exec(h || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// avviso se la luce scelta non torna con l'ora della scena (finestre in minuti dal luogo del volo)
export function avvisoLuce(s, finestre) {
  const m = minutiDa(s.ora);
  if (m == null || !finestre) return null;
  const dentro = (f) => (f || []).some(([a, b]) => a != null && b != null && m >= a && m <= b);
  const testo = (f) => (f || []).filter(([a, b]) => a != null && b != null).map(([a, b]) => `${hhmm(a)}–${hhmm(b)}`).join(" o ");
  if (s.luce === "oro" && !dentro(finestre.oro)) return `Alle ${s.ora} non è ora d'oro (${testo(finestre.oro)})`;
  if (s.luce === "blu" && !dentro(finestre.blu)) return `Alle ${s.ora} non è ora blu (${testo(finestre.blu)})`;
  if (s.luce === "notte" && finestre.tramonto != null && m < finestre.tramonto + 30 && m > (finestre.alba ?? 0)) return `Alle ${s.ora} non è ancora notte`;
  return null;
}

// riassunto di una scena in una riga (per la scaletta da copiare e per la Home)
export function dettagliScena(s, tipo) {
  return [
    s.ora ? `🕐 ${s.ora}` : null,
    s.luce && s.luce !== "qualsiasi" ? LUCI_SCENA[s.luce].replace(/^\S+ /, "") : null,
    tipo !== "foto" && Number(s.durata) > 0 ? `${s.durata} s` : null,
    Number(s.altezza) > 0 ? `${s.altezza} m` : null,
    s.velocita && tipo !== "foto" ? `velocità ${VELOCITA[s.velocita].toLowerCase()}` : null,
    s.fps ? `${s.fps} fps` : null,
  ].filter(Boolean).join(" · ");
}

// tempo di volo stimato: preparazione + 3 tentativi per scena; batterie da circa 18 minuti utili
function stima(scene, tipo) {
  const minuti = scene.reduce((t, s) => t + 1.5 + (tipo === "foto" ? 1 : (3 * Math.max(3, Number(s.durata) || 0)) / 60), 0);
  return { minuti: Math.round(minuti), batterie: Math.max(1, Math.ceil(minuti / 18)), secondi: scene.reduce((t, s) => t + (Number(s.durata) || 0), 0) };
}

export default function PianoScene({ tipo, scene, onCambia, libreria, scalette, onLavoro, servizi, finestre }) {
  const [caricando, setCaricando] = useState(null);
  const [aperta, setAperta] = useState(null);
  const [scaletta, setScaletta] = useState("");
  const [copiato, setCopiato] = useState(false);
  const [inVisione, setInVisione] = useState(null);
  const tutte = [...(libreria.video || []), ...(libreria.fpv || []), ...(libreria.foto || [])];
  const trova = (id) => tutte.find((m) => m.id === id);
  const gruppi = tipo === "foto" ? [["Foto", libreria.foto]] : tipo === "fpv" ? [["FPV", libreria.fpv], ["Video", libreria.video]] : [["Video", libreria.video], ["FPV", libreria.fpv]];
  const cambiaScena = (id, campo, valore) => onCambia(scene.map((s) => (s.id === id ? { ...s, [campo]: valore, ...(campo === "manovra" && !s.titolo && trova(valore) ? { titolo: trova(valore).nome.replace(/ \(.*\)$/, "") } : {}) } : s)));
  const sposta = (i, d) => { const l = [...scene]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); onCambia(l); };
  const aggiungi = () => { const s = scenaVuota(tipo); onCambia([...scene, s]); setAperta(s.id); };
  const duplica = (s) => { const c = { ...s, id: nuovoId(), titolo: `${s.titolo} (2)` }; const i = scene.findIndex((x) => x.id === s.id); const l = [...scene]; l.splice(i + 1, 0, c); onCambia(l); };
  const togli = (id) => onCambia(scene.filter((s) => s.id !== id));
  const daScaletta = () => {
    const sc = (scalette || []).find((x) => x.id === scaletta);
    if (!sc) return;
    onCambia([...scene, ...sc.manovre.map((id) => scenaVuota(tipo, trova(id))).filter((s) => s.manovra)]);
    if (onLavoro) onLavoro(sc.titolo);
    setScaletta("");
  };
  const fotoQui = async (s, file, daGalleria) => {
    if (!file || !servizi) return;
    setCaricando(s.id);
    // scattata adesso: il punto GPS è dove sei (lo leggo mentre la foto si carica);
    // dalla galleria: il punto salvato dentro la foto (letto prima che venga rimpicciolita)
    const gps = daGalleria ? leggiGpsFoto(file) : new Promise((ok) => {
      if (!navigator.geolocation) { ok(null); return; }
      navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }), () => ok(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
    });
    try {
      const [url, pos] = await Promise.all([servizi.carica(file), gps]);
      if (!url) throw new Error("caricamento");
      onCambia(scene.map((x) => (x.id === s.id ? { ...x, foto: { url, ...(pos || {}), quando: new Date().toISOString() } } : x)));
      if (daGalleria && !pos) alert("Foto aggiunta. Questa foto non ha il punto GPS salvato dentro (succede se la posizione era spenta nella fotocamera o se l'app che l'ha passata l'ha tolto).");
    } catch (e) {
      alert(e && e.message && e.message !== "caricamento" ? e.message : "Non sono riuscito a caricare la foto: riprova quando c'è campo.");
    }
    setCaricando(null);
  };
  const ordinaPerOra = () => onCambia([...scene].sort((a, b) => (minutiDa(a.ora) ?? 9999) - (minutiDa(b.ora) ?? 9999)));
  const { minuti, batterie, secondi } = stima(scene, tipo);
  const testoScaletta = () => scene.map((s, i) => {
    const m = trova(s.manovra);
    const det = dettagliScena(s, tipo);
    return `${i + 1}. ${s.titolo || (m ? m.nome : "Scena")}${m && s.titolo !== m.nome.replace(/ \(.*\)$/, "") ? ` (${m.nome})` : ""}${det ? ` — ${det}` : ""}${s.note ? `\n   ${s.note}` : ""}${s.foto && s.foto.lat != null ? `\n   📍 https://www.google.com/maps?q=${s.foto.lat},${s.foto.lon}` : ""}`;
  }).join("\n");
  const copia = async () => { if (await copiaTesto(testoScaletta())) { setCopiato(true); setTimeout(() => setCopiato(false), 2500); } };

  const campo = { background: "#12151a", border: "1px solid #3d2f5a", color: "#e7eaee", borderRadius: 5, padding: "6px 8px", fontSize: 12.5, width: "100%", boxSizing: "border-box", minHeight: 36 };
  const etich = { fontSize: 10.5, color: "#a8a2bd", display: "block", marginBottom: 2 };
  const piccolo = { background: "#251e33", border: "1px solid #3d2f5a", color: "#c4b5fd", borderRadius: 5, minWidth: 36, minHeight: 36, fontSize: 13 };

  return (
    <details open style={{ background: "#1c1726", border: "1px solid #7c5cd6", borderRadius: 8, padding: "10px 14px", margin: "14px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#c4b5fd" }}>🎬 Piano delle scene{scene.length ? ` · ${scene.length} ${scene.length === 1 ? "scena" : "scene"}` : ""}</summary>
      <p style={{ fontSize: 12, color: "#a8a2bd", margin: "6px 0 0 0" }}>Prepara a casa le scene che vuoi girare, nell'ordine del montaggio. Sul posto le spunti una per una dalla Home.</p>

      {scene.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, fontSize: 12.5 }}>
          {tipo !== "foto" && <span style={{ background: "#251e33", borderRadius: 6, padding: "6px 10px" }}>🎞️ Video finale ≈ <strong>{secondi} s</strong></span>}
          <span style={{ background: "#251e33", borderRadius: 6, padding: "6px 10px" }}>⏱️ In volo ≈ <strong>{minuti} min</strong></span>
          <span style={{ background: "#251e33", borderRadius: 6, padding: "6px 10px" }}>🔋 Porta <strong>{batterie + 1} batterie</strong> <span style={{ color: "#a8a2bd" }}>({batterie} + 1 di scorta)</span></span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {scene.map((s, i) => {
          const m = trova(s.manovra);
          const ap = aperta === s.id;
          const det = dettagliScena(s, tipo);
          return (
            <div key={s.id} style={{ background: "#151220", border: `1px solid ${ap ? "#7c5cd6" : "#2e2540"}`, borderRadius: 8, padding: "8px 10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 26, height: 26, flex: "none", borderRadius: "50%", background: "#7c5cd6", color: "#fff", fontSize: 12.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <button type="button" onClick={() => setAperta(ap ? null : s.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", color: "#e7eaee", padding: "4px 0" }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{s.titolo || (m ? m.nome : "Scena senza nome")}</span>
                  {avvisoLuce(s, finestre) && <span style={{ display: "block", fontSize: 11.5, color: "#f5b942" }}>⚠ {avvisoLuce(s, finestre)}</span>}
                  {s.foto && <span style={{ display: "block", fontSize: 11, color: "#4ade80" }}>📷 Foto del sopralluogo{s.foto.lat != null ? " con GPS" : ""}</span>}
                  <span style={{ display: "block", fontSize: 11.5, color: "#a8a2bd" }}>{[m && s.titolo && s.titolo !== m.nome.replace(/ \(.*\)$/, "") ? m.nome.replace(/ \(.*\)$/, "") : null, det].filter(Boolean).join(" · ") || "Tocca per scegliere manovra, luce e durata"}</span>
                </button>
                <button type="button" onClick={() => sposta(i, -1)} disabled={i === 0} aria-label="Sposta su" style={{ ...piccolo, opacity: i === 0 ? 0.35 : 1 }}>↑</button>
                <button type="button" onClick={() => sposta(i, 1)} disabled={i === scene.length - 1} aria-label="Sposta giù" style={{ ...piccolo, opacity: i === scene.length - 1 ? 0.35 : 1 }}>↓</button>
              </div>
              {ap && (
                <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  <label style={{ gridColumn: "1 / -1" }}><span style={etich}>Titolo della scena</span><input value={s.titolo} onChange={(e) => cambiaScena(s.id, "titolo", e.target.value)} placeholder="es. Apertura sul castello" style={campo} /></label>
                  <label style={{ gridColumn: "1 / -1" }}><span style={etich}>Manovra</span>
                    <select value={s.manovra} onChange={(e) => cambiaScena(s.id, "manovra", e.target.value)} style={campo}>
                      <option value="">Libera (la decido io)</option>
                      {gruppi.map(([nome, l]) => <optgroup key={nome} label={nome}>{(l || []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</optgroup>)}
                    </select>
                  </label>
                  <label><span style={etich}>Ora (se la sai)</span><input type="time" value={s.ora || ""} onChange={(e) => cambiaScena(s.id, "ora", e.target.value)} style={campo} /></label>
                  <label><span style={etich}>Luce</span><select value={s.luce} onChange={(e) => cambiaScena(s.id, "luce", e.target.value)} style={campo}>{Object.entries(LUCI_SCENA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                  {tipo !== "foto" && <label><span style={etich}>Durata nel video (s)</span><input type="number" inputMode="numeric" min="0" value={s.durata} onChange={(e) => cambiaScena(s.id, "durata", e.target.value)} style={campo} /></label>}
                  <label><span style={etich}>Altezza (m)</span><input type="number" inputMode="numeric" min="0" value={s.altezza} onChange={(e) => cambiaScena(s.id, "altezza", e.target.value)} style={campo} /></label>
                  {tipo !== "foto" && <label><span style={etich}>Velocità</span><select value={s.velocita} onChange={(e) => cambiaScena(s.id, "velocita", e.target.value)} style={campo}>{Object.entries(VELOCITA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
                  {tipo !== "foto" && <label><span style={etich}>Fotogrammi al secondo</span><select value={s.fps} onChange={(e) => cambiaScena(s.id, "fps", e.target.value)} style={campo}>{["25", "30", "50", "60", "100", "120"].map((f) => <option key={f} value={f}>{f} fps{f === "50" || f === "60" ? " (rallentabile)" : f === "100" || f === "120" ? " (ralenti)" : ""}</option>)}</select></label>}
                  <label style={{ gridColumn: "1 / -1" }}><span style={etich}>Note: cosa inquadrare, persone, dove partire</span><textarea rows={2} value={s.note} onChange={(e) => cambiaScena(s.id, "note", e.target.value)} placeholder="es. parto dietro gli alberi, sposi sul ponte, camera a 20°" style={{ ...campo, resize: "vertical", fontFamily: "inherit" }} /></label>
                  {servizi && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={etich}>Foto di riferimento (fatta al sopralluogo)</span>
                      <FotoScena foto={s.foto} visibile={servizi.visibile} alta={180} />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <label style={{ ...piccolo, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12, cursor: "pointer" }}>
                          {caricando === s.id ? "Carico…" : s.foto ? "📷 Rifai la foto" : "📷 Foto qui (con GPS)"}
                          <input type="file" accept="image/*" capture="environment" disabled={caricando === s.id} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; fotoQui(s, f); }} style={{ display: "none" }} />
                        </label>
                        <label style={{ ...piccolo, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12, cursor: "pointer" }}>
                          🖼️ Dalla galleria
                          <input type="file" accept="image/*" disabled={caricando === s.id} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; fotoQui(s, f, true); }} style={{ display: "none" }} />
                        </label>
                        {s.foto && <button type="button" onClick={() => cambiaScena(s.id, "foto", null)} style={{ ...piccolo, padding: "0 10px", fontSize: 12 }}>Togli la foto</button>}
                      </div>
                    </div>
                  )}
                  {m && (
                    <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#c4b5fd", lineHeight: 1.45 }}>
                      🕹️ {m.stick}
                      {haAnimazione(m.id) && <div><button type="button" onClick={() => setInVisione(inVisione === s.id ? null : s.id)} style={{ marginTop: 4, background: inVisione === s.id ? "#7c5cd6" : "#251e33", color: inVisione === s.id ? "#fff" : "#c4b5fd", border: "1px solid #3d2f5a", borderRadius: 12, padding: "3px 10px", fontSize: 11.5, fontWeight: 600 }}>{inVisione === s.id ? "✕ Chiudi" : "▶️ Guarda come si fa"}</button></div>}
                      {inVisione === s.id && <AnimazioneManovra id={m.id} />}
                    </div>
                  )}
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => duplica(s)} style={{ ...piccolo, padding: "0 10px", fontSize: 12 }}>⧉ Duplica</button>
                    <button type="button" onClick={() => togli(s.id)} style={{ ...piccolo, padding: "0 10px", fontSize: 12, color: "#ff9c9c", borderColor: "#5a2f3a" }}>🗑️ Togli</button>
                    <button type="button" onClick={() => setAperta(null)} style={{ ...piccolo, padding: "0 12px", fontSize: 12, background: "#7c5cd6", color: "#fff", borderColor: "#7c5cd6", marginLeft: "auto" }}>✓ Fatto</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <button type="button" onClick={aggiungi} style={{ background: "#7c5cd6", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, minHeight: 40 }}>＋ Nuova scena</button>
        {(scalette || []).length > 0 && (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <select value={scaletta} onChange={(e) => setScaletta(e.target.value)} style={{ ...campo, width: "auto", minWidth: 170 }}>
              <option value="">Parti da una scaletta pronta…</option>
              {scalette.map((sc) => <option key={sc.id} value={sc.id}>{sc.titolo}</option>)}
            </select>
            {scaletta && <button type="button" onClick={daScaletta} style={{ background: "#251e33", color: "#c4b5fd", border: "1px solid #7c5cd6", borderRadius: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, minHeight: 40 }}>Aggiungi</button>}
          </span>
        )}
        {scene.some((x) => x.ora) && <button type="button" onClick={ordinaPerOra} style={{ background: "none", border: "1px solid #3d2f5a", color: "#c4b5fd", borderRadius: 6, padding: "8px 12px", fontSize: 12.5, minHeight: 40 }}>🕐 Metti in ordine di ora</button>}
        {scene.length > 0 && <button type="button" onClick={copia} style={{ background: "none", border: "1px solid #3d2f5a", color: "#c4b5fd", borderRadius: 6, padding: "8px 12px", fontSize: 12.5, minHeight: 40, marginLeft: "auto" }}>{copiato ? "✓ Copiata" : "📋 Copia la scaletta"}</button>}
      </div>
      {scene.length > 0 && <p style={{ fontSize: 10.5, color: "#6b7480", margin: "8px 0 0 0" }}>Tempo e batterie sono una stima (3 tentativi per scena, circa 18 minuti per batteria): dipendono dal drone, dal vento e dal freddo. La scaletta copiata la puoi mandare al cliente o a chi vola con te.</p>}
    </details>
  );
}
