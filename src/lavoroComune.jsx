import React, { useEffect, useRef, useState } from "react";

// Pezzi in comune per le cartelle «Foto e video» e «FPV»: stili, linguette, scorciatoie, firma col dito,
// posizione del sole e il salvataggio dei documenti (tabella documenti_lavoro, script supabase/riprese-fpv.sql).

export const btn = (p) => ({ background: p ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: p ? "#10141f" : "#e7eaee", border: p ? "none" : "1px solid #343e57", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, minHeight: 38 });
export const scheda = { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 14 };
export const campo = { background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: "7px 9px", fontSize: 13.5, width: "100%", minWidth: 0, boxSizing: "border-box" };
export const Etichetta = ({ t, children, largo }) => <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#8b95a3", minWidth: 0, gridColumn: largo ? "1 / -1" : undefined }}>{t}{children}</label>;
export const griglia = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 };
export const oggi = () => new Date().toISOString().slice(0, 10);

export function Linguette({ voci, attiva, onCambia }) {
  return (
    <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
      {voci.map(([k, t]) => (
        <button key={k} role="tab" aria-selected={attiva === k} type="button" onClick={() => onCambia(k)} style={{ ...btn(false), background: attiva === k ? "#241d16" : "#1a2133", border: attiva === k ? "1px solid #ff8c42" : "1px solid #343e57" }}>{t}</button>
      ))}
    </div>
  );
}

export function Scorciatoie({ voci }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }} data-scorciatoie>
      {voci.map(([e, t, f]) => (
        <button key={t} type="button" onClick={f} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: "#10141f", border: "1px solid #2a3349", borderRadius: 10, padding: "11px 12px", color: "#e7eaee", fontSize: 13, fontWeight: 700, minHeight: 48 }}>
          <span style={{ fontSize: 20 }}>{e}</span><span>{t}</span>
        </button>
      ))}
    </div>
  );
}

// firma col dito (telefono) o col mouse (computer): restituisce un PNG in base64
export function Firma({ valore, onCambia, etichetta = "Firma qui" }) {
  const cv = useRef(null), dis = useRef(false), vuota = useRef(!valore);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const r = c.getBoundingClientRect(); c.width = Math.round(r.width * 2); c.height = Math.round(r.height * 2);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    if (valore) { const i = new Image(); i.onload = () => g.drawImage(i, 0, 0, c.width, c.height); i.src = valore; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const punto = (e) => { const r = cv.current.getBoundingClientRect(); return [(e.clientX - r.left) * 2, (e.clientY - r.top) * 2]; };
  const giu = (e) => { e.preventDefault(); cv.current.setPointerCapture?.(e.pointerId); dis.current = true; const g = cv.current.getContext("2d"); const [x, y] = punto(e); g.beginPath(); g.moveTo(x, y); };
  const muovi = (e) => { if (!dis.current) return; const g = cv.current.getContext("2d"); g.lineWidth = 4; g.lineCap = "round"; g.strokeStyle = "#111"; const [x, y] = punto(e); g.lineTo(x, y); g.stroke(); vuota.current = false; };
  const su = () => { if (!dis.current) return; dis.current = false; if (!vuota.current) onCambia(cv.current.toDataURL("image/png")); };
  const cancella = () => { const c = cv.current, g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); vuota.current = true; onCambia(""); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, color: "#8b95a3" }}>{etichetta}</span>
      <canvas ref={cv} onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerLeave={su} style={{ width: "100%", height: 140, background: "#fff", borderRadius: 8, touchAction: "none", cursor: "crosshair", border: "1px solid #343e57" }} aria-label={etichetta} />
      <button type="button" onClick={cancella} style={{ ...btn(false), alignSelf: "flex-start", padding: "5px 10px" }}>Cancella la firma</button>
    </div>
  );
}

// posizione del sole (algoritmo standard, circa un grado): azimut da nord in senso orario, altezza sull'orizzonte
export function posizioneSole(data, lat, lon) {
  const rad = Math.PI / 180;
  const d = data.getTime() / 86400000 - 0.5 + 2440588 - 2451545;
  const M = rad * (357.5291 + 0.98560028 * d);
  const L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI;
  const e = rad * 23.4397;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L));
  const H = rad * (280.16 + 360.9856235 * d) + rad * lon - ra;
  const phi = rad * lat;
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  return { azimut: ((az / rad) + 180 + 360) % 360, altezza: alt / rad };
}
const CARDINALI = ["Nord", "Nord-Est", "Est", "Sud-Est", "Sud", "Sud-Ovest", "Ovest", "Nord-Ovest"];
export const cardinale = (az) => CARDINALI[Math.round(((az % 360) + 360) % 360 / 45) % 8];
// che luce c'è con il sole a questa altezza
export function luce(altezza) {
  if (altezza < -6) return { nome: "Notte", colore: "#6b7ab0", emoji: "🌙" };
  if (altezza < -4) return { nome: "Ora blu", colore: "#5b8cff", emoji: "🔵" };
  if (altezza < 0) return { nome: "Crepuscolo", colore: "#a78bfa", emoji: "🌆" };
  if (altezza < 6) return { nome: "Ora d'oro", colore: "#ffb547", emoji: "✨" };
  if (altezza < 30) return { nome: "Luce morbida", colore: "#ffd27a", emoji: "🌤️" };
  return { nome: "Sole alto, ombre corte e dure", colore: "#fff1a8", emoji: "☀️" };
}
// orari della giornata (alba, tramonto, ora d'oro) cercando minuto per minuto quando il sole passa le altezze giuste
export function oraridelSole(dataIso, lat, lon) {
  const base = new Date(`${dataIso}T00:00:00`);
  const alt = (m) => posizioneSole(new Date(base.getTime() + m * 60000), lat, lon).altezza;
  const passa = (soglia, sale) => { for (let m = 1; m < 1440; m++) { const a = alt(m - 1), b = alt(m); if (sale ? a < soglia && b >= soglia : a >= soglia && b < soglia) return m; } return null; };
  const hhmm = (m) => (m == null ? "—" : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return { alba: hhmm(passa(-0.83, true)), oroMattinaFine: hhmm(passa(6, true)), oroSeraInizio: hhmm(passa(6, false)), tramonto: hhmm(passa(-0.83, false)), bluSeraFine: hhmm(passa(-6, false)) };
}

// documenti salvati di un tipo (contratti, giornate, percorsi…). manca = la tabella non c'è ancora (riprese-fpv.sql)
export function useDocumenti(supabase, tipo) {
  const [lista, setLista] = useState(null);
  const [manca, setManca] = useState(false);
  const carica = async () => {
    const { data, error } = await supabase.from("documenti_lavoro").select("*").eq("tipo", tipo).order("created_at", { ascending: false }).limit(200);
    if (error) { setManca(/documenti_lavoro|relation|schema cache/i.test(error.message || "")); setLista([]); return; }
    setLista(data || []);
  };
  useEffect(() => { carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tipo]);
  const salva = async (doc) => {
    const riga = { tipo, titolo: doc.titolo || null, dati: doc.dati || {}, stato: doc.stato || "bozza", updated_at: new Date().toISOString() };
    const r = doc.id ? await supabase.from("documenti_lavoro").update(riga).eq("id", doc.id).select().single() : await supabase.from("documenti_lavoro").insert(riga).select().single();
    if (r.error) throw r.error;
    await carica();
    return r.data;
  };
  const togli = async (id) => { await supabase.from("documenti_lavoro").delete().eq("id", id); await carica(); };
  return { lista, manca, carica, salva, togli };
}

export function AvvisoSql() {
  return <div style={{ ...scheda, border: "1px solid #f5b94266", background: "#211a0c", marginBottom: 14, fontSize: 13, color: "#ffe2a8" }}>⚙️ Per salvare serve una cosa da fare <b>una volta sola</b>: in Supabase apri <b>SQL Editor</b>, incolla lo script <b>supabase/riprese-fpv.sql</b> e premi <b>Run</b>. Intanto puoi provare tutto, ma non resta salvato.</div>;
}

// immagine (foto, piantina) ridotta a JPG leggero per salvarla nel documento
export function riduciImmagine(file, lato = 1600) {
  return new Promise((ok, ko) => {
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => { const k = Math.min(1, lato / Math.max(i.naturalWidth, i.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok({ url: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height }); };
    i.onerror = () => { URL.revokeObjectURL(u); ko(new Error("Immagine non leggibile")); };
    i.src = u;
  });
}

// PDF condiviso dal telefono (WhatsApp, email) o scaricato dal computer
export async function condividiPdf(doc, nome) {
  const file = new File([doc.output("blob")], nome, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  doc.save(nome);
}
