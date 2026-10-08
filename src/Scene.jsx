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
// --- Disegni sopra la foto: percorso del drone, punti numerati, pericoli, soggetto e scritte -------------
// Coordinate da 0 a 1 rispetto alla foto, così valgono a ogni grandezza. La foto originale resta pulita.
export const STRUMENTI_SEGNI = {
  freccia: { nome: "Percorso", emoji: "➜", colore: "#ff8c42" },
  punto: { nome: "Punto", emoji: "①", colore: "#a78bfa" },
  pericolo: { nome: "Pericolo", emoji: "⚠️", colore: "#ff4d4d" },
  soggetto: { nome: "Soggetto", emoji: "🎯", colore: "#4ade80" },
  testo: { nome: "Scritta", emoji: "✍️", colore: "#ffffff" },
};

export function SegniSvg({ segni, aspetto, scala = 1 }) {
  if (!segni || !segni.length || !aspetto) return null;
  const W = 1000, H = 1000 / aspetto, k = scala;
  const xy = (x, y) => [x * W, y * H];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden="true">
      <defs>
        <marker id="freccia-punta" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ff8c42" stroke="#fff" strokeWidth="1" /></marker>
      </defs>
      {segni.map((g, i) => {
        if (g.t === "freccia" && g.p && g.p.length > 1) {
          const d = g.p.map(([x, y], j) => `${j ? "L" : "M"}${(x * W).toFixed(1)} ${(y * H).toFixed(1)}`).join(" ");
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#fff" strokeWidth={16 * k} strokeLinecap="round" strokeLinejoin="round" opacity=".9" />
              <path d={d} fill="none" stroke="#ff8c42" strokeWidth={9 * k} strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#freccia-punta)" />
            </g>
          );
        }
        const [x, y] = xy(g.x, g.y);
        const r = 30 * k;
        if (g.t === "punto") return <g key={i}><circle cx={x} cy={y} r={r} fill="#7c5cd6" stroke="#fff" strokeWidth={5 * k} /><text x={x} y={y + 12 * k} textAnchor="middle" fontSize={34 * k} fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">{g.n}</text></g>;
        if (g.t === "pericolo") return <g key={i}><path d={`M${x} ${y - r * 1.15} L${x + r * 1.1} ${y + r * 0.8} L${x - r * 1.1} ${y + r * 0.8} Z`} fill="#ff4d4d" stroke="#fff" strokeWidth={5 * k} strokeLinejoin="round" /><text x={x} y={y + 16 * k} textAnchor="middle" fontSize={36 * k} fontWeight="900" fill="#fff" fontFamily="Arial, sans-serif">!</text></g>;
        if (g.t === "soggetto") return <g key={i}><circle cx={x} cy={y} r={r * 1.2} fill="none" stroke="#fff" strokeWidth={10 * k} /><circle cx={x} cy={y} r={r * 1.2} fill="none" stroke="#4ade80" strokeWidth={6 * k} /><circle cx={x} cy={y} r={r * 0.35} fill="#4ade80" stroke="#fff" strokeWidth={3 * k} /></g>;
        if (g.t === "testo") {
          const lung = Math.max(2, String(g.s || "").length);
          const w = Math.min(W * 0.9, lung * 17 * k + 30 * k);
          return <g key={i}><rect x={x - w / 2} y={y - 26 * k} width={w} height={44 * k} rx={10 * k} fill="rgba(0,0,0,.72)" /><text x={x} y={y + 6 * k} textAnchor="middle" fontSize={28 * k} fontWeight="700" fill="#fff" fontFamily="Arial, sans-serif">{g.s}</text></g>;
        }
        return null;
      })}
    </svg>
  );
}

// gli stessi segni disegnati su un canvas (per il PDF): coordinate come SegniSvg, larghezza 1000
export function disegnaSegni(ctx, segni, w, h) {
  if (!segni || !segni.length) return;
  const f = w / 1000, k = f;
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.textAlign = "center";
  const scritta = (t, x, y, size, peso) => { ctx.font = `${peso} ${size}px Arial, sans-serif`; ctx.fillStyle = "#fff"; ctx.fillText(t, x, y); };
  segni.forEach((g) => {
    if (g.t === "freccia" && g.p && g.p.length > 1) {
      const pts = g.p.map(([x, y]) => [x * w, y * h]);
      const linea = (colore, spess) => { ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = colore; ctx.lineWidth = spess; ctx.stroke(); };
      linea("rgba(255,255,255,.9)", 16 * k); linea("#ff8c42", 9 * k);
      // punta nella direzione dell'ultimo tratto
      const [x2, y2] = pts[pts.length - 1];
      let [x1, y1] = pts[pts.length - 2];
      for (let j = pts.length - 2; j >= 0 && Math.hypot(x2 - pts[j][0], y2 - pts[j][1]) < 15 * k; j--) [x1, y1] = pts[j];
      const a = Math.atan2(y2 - y1, x2 - x1), L = 36 * k;
      ctx.beginPath();
      ctx.moveTo(x2 + Math.cos(a) * L * 0.4, y2 + Math.sin(a) * L * 0.4);
      ctx.lineTo(x2 + Math.cos(a + 2.4) * L, y2 + Math.sin(a + 2.4) * L);
      ctx.lineTo(x2 + Math.cos(a - 2.4) * L, y2 + Math.sin(a - 2.4) * L);
      ctx.closePath(); ctx.fillStyle = "#ff8c42"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * k; ctx.stroke();
      return;
    }
    const x = g.x * w, y = g.y * h, r = 30 * k;
    ctx.strokeStyle = "#fff";
    if (g.t === "punto") {
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = "#7c5cd6"; ctx.fill(); ctx.lineWidth = 5 * k; ctx.stroke();
      scritta(String(g.n), x, y + 12 * k, 34 * k, 800);
    } else if (g.t === "pericolo") {
      ctx.beginPath(); ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath();
      ctx.fillStyle = "#ff4d4d"; ctx.fill(); ctx.lineWidth = 5 * k; ctx.stroke();
      scritta("!", x, y + 16 * k, 36 * k, 900);
    } else if (g.t === "soggetto") {
      ctx.beginPath(); ctx.arc(x, y, r * 1.2, 0, 7); ctx.lineWidth = 10 * k; ctx.stroke(); ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 6 * k; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, 7); ctx.fillStyle = "#4ade80"; ctx.fill(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3 * k; ctx.stroke();
    } else if (g.t === "testo") {
      const lung = Math.max(2, String(g.s || "").length);
      const bw = Math.min(w * 0.9, lung * 17 * k + 30 * k);
      ctx.fillStyle = "rgba(0,0,0,.72)";
      ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(x - bw / 2, y - 26 * k, bw, 44 * k, 10 * k) : ctx.rect(x - bw / 2, y - 26 * k, bw, 44 * k)); ctx.fill();
      scritta(String(g.s || ""), x, y + 6 * k, 28 * k, 700);
    }
  });
  ctx.restore();
}

// a schermo intero: si disegna col dito sopra la foto
export function EditorSegni({ href, segniIniziali, onSalva, onChiudi }) {
  const [segni, setSegni] = useState(segniIniziali || []);
  const [strumento, setStrumento] = useState("freccia");
  const [aspetto, setAspetto] = useState(null);
  const [traccia, setTraccia] = useState(null); // freccia in corso
  const area = React.useRef(null);
  const pos = (e) => { const b = area.current.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))]; };
  const giu = (e) => {
    e.preventDefault();
    if (strumento === "freccia") { area.current.setPointerCapture?.(e.pointerId); setTraccia([pos(e)]); }
  };
  const muovi = (e) => {
    if (!traccia) return;
    const p = pos(e), u = traccia[traccia.length - 1];
    if (Math.hypot(p[0] - u[0], p[1] - u[1]) > 0.012) setTraccia([...traccia, p]);
  };
  const su = (e) => {
    if (strumento === "freccia") {
      if (traccia && traccia.length > 1) {
        // tengo un punto ogni tanto, così la linea è morbida e leggera
        const p = traccia.filter((_, i) => i % 2 === 0 || i === traccia.length - 1).map(([x, y]) => [Number(x.toFixed(4)), Number(y.toFixed(4))]);
        setSegni([...segni, { t: "freccia", p }]);
      }
      setTraccia(null);
      return;
    }
    const [x, y] = pos(e);
    if (strumento === "testo") {
      const s = (window.prompt("Cosa scrivo sulla foto? (breve)", "") || "").trim().slice(0, 40);
      if (s) setSegni([...segni, { t: "testo", x, y, s }]);
      return;
    }
    const n = strumento === "punto" ? segni.filter((g) => g.t === "punto").length + 1 : undefined;
    setSegni([...segni, { t: strumento, x, y, ...(n ? { n } : {}) }]);
  };
  const tutti = traccia ? [...segni, { t: "freccia", p: traccia }] : segni;
  const bottone = (attivo) => ({ background: attivo ? "#7c5cd6" : "#1b2028", color: "#fff", border: `1px solid ${attivo ? "#a78bfa" : "#333a45"}`, borderRadius: 10, padding: "6px 10px", minWidth: 56, minHeight: 48, fontSize: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 });
  return (
    <div role="dialog" aria-label="Disegna sulla foto" style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#0b0d11", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #262b33" }}>
        <button type="button" onClick={onChiudi} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 8, padding: "8px 12px", fontSize: 13, minHeight: 40 }}>Annulla</button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "#e7eaee" }}>✏️ Disegna la ripresa</span>
        <button type="button" onClick={() => onSalva(segni)} style={{ background: "#4ade80", border: "none", color: "#0a1a0f", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 800, minHeight: 40 }}>✓ Salva</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 10, overflow: "hidden" }}>
        <div ref={area} onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} style={{ position: "relative", touchAction: "none", maxWidth: "100%", maxHeight: "100%", aspectRatio: aspetto || "auto", width: aspetto ? `min(100%, calc((100vh - 190px) * ${aspetto}))` : "100%", cursor: "crosshair" }}>
          <img src={href} alt="Foto da disegnare" onLoad={(e) => setAspetto(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} draggable={false} style={{ display: "block", width: "100%", height: "auto", userSelect: "none", borderRadius: 6 }} />
          <SegniSvg segni={tutti} aspetto={aspetto} />
        </div>
      </div>
      <div style={{ padding: "8px 10px 14px", borderTop: "1px solid #262b33" }}>
        <div style={{ fontSize: 11.5, color: "#8b95a3", textAlign: "center", marginBottom: 8 }}>
          {strumento === "freccia" ? "Trascina il dito per disegnare il percorso del drone" : strumento === "testo" ? "Tocca dove mettere la scritta" : `Tocca la foto per mettere: ${STRUMENTI_SEGNI[strumento].nome.toLowerCase()}`}
        </div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {Object.entries(STRUMENTI_SEGNI).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setStrumento(k)} aria-pressed={strumento === k} style={bottone(strumento === k)}><span style={{ fontSize: 18, color: t.colore }}>{t.emoji}</span>{t.nome}</button>
          ))}
          <button type="button" onClick={() => setSegni(segni.slice(0, -1))} disabled={!segni.length} style={{ ...bottone(false), opacity: segni.length ? 1 : 0.4 }}><span style={{ fontSize: 18 }}>↶</span>Indietro</button>
          <button type="button" onClick={() => { if (window.confirm("Cancello tutti i disegni?")) setSegni([]); }} disabled={!segni.length} style={{ ...bottone(false), opacity: segni.length ? 1 : 0.4 }}><span style={{ fontSize: 18 }}>🗑️</span>Tutto</button>
        </div>
      </div>
    </div>
  );
}

// foto di riferimento: l'indirizzo vero arriva da «visibile» (lo spazio riservato dà link temporanei)
export function FotoScena({ foto, visibile, alta = 120, onApri, onDisegna }) {
  const [href, setHref] = useState(null);
  const [aspetto, setAspetto] = useState(null);
  const [editor, setEditor] = useState(false);
  useEffect(() => {
    let vivo = true;
    if (!foto || !foto.url) { setHref(null); return undefined; }
    Promise.resolve(visibile ? visibile(foto.url) : foto.url).then((h) => { if (vivo) setHref(h); }, () => {});
    return () => { vivo = false; };
  }, [foto && foto.url]);
  if (!foto || !foto.url) return null;
  const segni = foto.segni || [];
  return (
    <div style={{ marginTop: 6 }}>
      {href ? (
        // foto intera (non ritagliata), così i disegni restano al loro posto
        <div style={{ position: "relative", width: "100%", maxWidth: aspetto ? alta * aspetto : "100%", cursor: onApri ? "pointer" : "default" }} onClick={onApri}>
          <img src={href} alt="Foto di riferimento della scena" onLoad={(e) => setAspetto(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} style={{ display: "block", width: "100%", height: "auto", borderRadius: 6, background: "#000" }} />
          <SegniSvg segni={segni} aspetto={aspetto} />
        </div>
      ) : <div style={{ height: 60, borderRadius: 6, background: "#251e33", color: "#a8a2bd", fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center" }}>Carico la foto…</div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 3 }}>
        {foto.lat != null && (
          <a href={`https://www.google.com/maps?q=${foto.lat},${foto.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#7fb0ff" }}>📍 Punto della foto ({Number(foto.lat).toFixed(5)}, {Number(foto.lon).toFixed(5)}) ↗</a>
        )}
        {onDisegna && href && <button type="button" onClick={() => setEditor(true)} style={{ background: "#ff8c42", color: "#161a1f", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, minHeight: 36 }}>✏️ {segni.length ? "Modifica il disegno" : "Disegna la ripresa sulla foto"}</button>}
      </div>
      {editor && <EditorSegni href={href} segniIniziali={segni} onChiudi={() => setEditor(false)} onSalva={(nuovi) => { setEditor(false); onDisegna(nuovi); }} />}
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
                  {s.foto && <span style={{ display: "block", fontSize: 11, color: "#4ade80" }}>📷 Foto del sopralluogo{s.foto.lat != null ? " con GPS" : ""}{(s.foto.segni || []).length ? " · ✏️ con il disegno" : ""}</span>}
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
                      <FotoScena foto={s.foto} visibile={servizi.visibile} alta={220} onDisegna={(segni) => cambiaScena(s.id, "foto", { ...s.foto, segni })} />
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
