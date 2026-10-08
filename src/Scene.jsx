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
    foto: null, // { url, lat, lon, quando, segni }: foto di riferimento fatta al sopralluogo
    altreFoto: [], // le altre foto della stessa scena (fino a MAX_FOTO_SCENA in tutto)
  };
}

// le foto di una scena: la prima resta in «foto» (così i piani vecchi funzionano), le altre in «altreFoto»
export const MAX_FOTO_SCENA = 3;
export const fotoDellaScena = (s) => [s && s.foto, ...((s && s.altreFoto) || [])].filter((f) => f && f.url);
const conFoto = (lista) => ({ foto: lista[0] || null, altreFoto: lista.slice(1) });

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

// indirizzo vero della foto: arriva da «visibile» (lo spazio riservato dà link temporanei)
function useIndirizzo(foto, visibile) {
  const [href, setHref] = useState(null);
  useEffect(() => {
    let vivo = true;
    setHref(null);
    if (!foto || !foto.url) return undefined;
    Promise.resolve(visibile ? visibile(foto.url) : foto.url).then((h) => { if (vivo) setHref(h); }, () => {});
    return () => { vivo = false; };
  }, [foto && foto.url]);
  return href;
}

// foto con i disegni sopra, intera (non ritagliata) così i segni restano al loro posto
function FotoConSegni({ foto, href, alta, larghezza, onClick, alt = "Foto di riferimento della scena" }) {
  const [aspetto, setAspetto] = useState(null);
  return (
    <div style={{ position: "relative", width: larghezza || "100%", maxWidth: alta && aspetto ? alta * aspetto : "100%", cursor: onClick ? "zoom-in" : "default", margin: larghezza ? "0 auto" : 0 }} onClick={onClick}>
      <img src={href} alt={alt} onLoad={(e) => setAspetto(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} draggable={false} style={{ display: "block", width: "100%", height: "auto", borderRadius: 6, background: "#000" }} />
      <SegniSvg segni={foto.segni || []} aspetto={aspetto} />
    </div>
  );
}

// a tutto schermo, per guardarla bene sul posto; con più foto si passa dall'una all'altra
export function FotoGrande({ foto, indice = 0, visibile, onChiudi }) {
  const [i, setI] = useState(indice);
  const f = foto[i];
  const href = useIndirizzo(f, visibile);
  const [aspetto, setAspetto] = useState(null);
  useEffect(() => {
    if (!f || !f.url) return undefined;
    let vivo = true;
    Promise.resolve(visibile ? visibile(f.url) : f.url).then((h) => { const im = new Image(); im.onload = () => vivo && setAspetto(im.naturalWidth / im.naturalHeight); im.src = h; }, () => {});
    return () => { vivo = false; };
  }, [f && f.url]);
  if (!f) return null;
  const freccia = { background: "rgba(0,0,0,.55)", color: "#fff", border: "1px solid #444", borderRadius: "50%", width: 52, height: 52, fontSize: 26, flex: "none" };
  return (
    <div role="dialog" aria-label="Foto a tutto schermo" style={{ position: "fixed", inset: 0, zIndex: 3100, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
        <span style={{ flex: 1, color: "#c3cad4", fontSize: 13 }}>{foto.length > 1 ? `Foto ${i + 1} di ${foto.length}` : "Foto della scena"}</span>
        <button type="button" onClick={onChiudi} style={{ background: "#1b2028", color: "#fff", border: "1px solid #333a45", borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 700, minHeight: 44 }}>✕ Chiudi</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 6, minHeight: 0 }}>
        {href && aspetto ? (
          <div style={{ width: `min(100%, calc((100vh - 150px) * ${aspetto}))` }}>
            <FotoConSegni foto={f} href={href} />
          </div>
        ) : <span style={{ color: "#8b95a3" }}>Carico la foto…</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "8px 12px 16px", minHeight: 60 }}>
        {foto.length > 1 && <>
          <button type="button" aria-label="Foto prima" onClick={() => setI((i - 1 + foto.length) % foto.length)} style={freccia}>‹</button>
          {foto.map((_, j) => <span key={j} style={{ width: 9, height: 9, borderRadius: "50%", background: j === i ? "#fff" : "#555" }} />)}
          <button type="button" aria-label="Foto dopo" onClick={() => setI((i + 1) % foto.length)} style={freccia}>›</button>
        </>}
        {f.lat != null && <a href={`https://www.google.com/maps?q=${f.lat},${f.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "#7fb0ff", marginLeft: 6 }}>📍 Punto della foto ↗</a>}
      </div>
    </div>
  );
}

// foto di riferimento nella scheda della scena: toccandola si apre grande
export function FotoScena({ foto, visibile, alta = 120, onApri, onDisegna, onTogli, tutte }) {
  const href = useIndirizzo(foto, visibile);
  const [editor, setEditor] = useState(false);
  const [grande, setGrande] = useState(false);
  if (!foto || !foto.url) return null;
  const segni = foto.segni || [];
  const elenco = tutte && tutte.length ? tutte : [foto];
  return (
    <div style={{ marginTop: 6 }}>
      {href ? (
        <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
          <FotoConSegni foto={foto} href={href} alta={alta} onClick={onApri || (() => setGrande(true))} />
        </div>
      ) : <div style={{ height: 60, borderRadius: 6, background: "#251e33", color: "#a8a2bd", fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center" }}>Carico la foto…</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
        {href && <button type="button" onClick={onApri || (() => setGrande(true))} style={{ background: "#251e33", color: "#c4b5fd", border: "1px solid #3d2f5a", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600, minHeight: 36 }}>🔍 Guarda grande{elenco.length > 1 ? ` (${elenco.length} foto)` : ""}</button>}
        {onDisegna && href && <button type="button" onClick={() => setEditor(true)} style={{ background: "#ff8c42", color: "#161a1f", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 700, minHeight: 36 }}>✏️ {segni.length ? "Modifica il disegno" : "Disegna la ripresa sulla foto"}</button>}
        {onTogli && <button type="button" onClick={() => { if (window.confirm("Tolgo questa foto?")) onTogli(); }} style={{ background: "none", color: "#a8a2bd", border: "1px solid #3d2f5a", borderRadius: 6, padding: "6px 10px", fontSize: 12, minHeight: 36 }}>Togli</button>}
        {foto.lat != null && (
          <a href={`https://www.google.com/maps?q=${foto.lat},${foto.lon}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#7fb0ff" }}>📍 Punto della foto ({Number(foto.lat).toFixed(5)}, {Number(foto.lon).toFixed(5)}) ↗</a>
        )}
      </div>
      {editor && <EditorSegni href={href} segniIniziali={segni} onChiudi={() => setEditor(false)} onSalva={(nuovi) => { setEditor(false); onDisegna(nuovi); }} />}
      {grande && <FotoGrande foto={elenco} indice={Math.max(0, elenco.indexOf(foto))} visibile={visibile} onChiudi={() => setGrande(false)} />}
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
      const nuova = { url, ...(pos || {}), quando: new Date().toISOString() };
      onCambia(scene.map((x) => (x.id === s.id ? { ...x, ...conFoto([...fotoDellaScena(x), nuova].slice(0, MAX_FOTO_SCENA)) } : x)));
      if (daGalleria && !pos) alert("Foto aggiunta. Questa foto non ha il punto GPS salvato dentro (succede se la posizione era spenta nella fotocamera o se l'app che l'ha passata l'ha tolto).");
    } catch (e) {
      alert(e && e.message && e.message !== "caricamento" ? e.message : "Non sono riuscito a caricare la foto: riprova quando c'è campo.");
    }
    setCaricando(null);
  };
  // cambia o toglie (null) la foto numero j della scena
  const cambiaFoto = (s, j, nuova) => {
    const lista = fotoDellaScena(s).map((f, k) => (k === j ? nuova : f)).filter(Boolean);
    onCambia(scene.map((x) => (x.id === s.id ? { ...x, ...conFoto(lista) } : x)));
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
                  {s.foto && <span style={{ display: "block", fontSize: 11, color: "#4ade80" }}>📷 {fotoDellaScena(s).length > 1 ? `${fotoDellaScena(s).length} foto` : "Foto"} del sopralluogo{s.foto.lat != null ? " con GPS" : ""}{fotoDellaScena(s).some((f) => (f.segni || []).length) ? " · ✏️ con il disegno" : ""}</span>}
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
                      <span style={etich}>Foto di riferimento (fatte al sopralluogo, fino a {MAX_FOTO_SCENA})</span>
                      {fotoDellaScena(s).map((f, j, tutte) => (
                        <div key={f.url} style={{ marginTop: j ? 10 : 0 }}>
                          {tutte.length > 1 && <span style={{ fontSize: 11, color: "#a8a2bd" }}>Foto {j + 1}</span>}
                          <FotoScena foto={f} tutte={tutte} visibile={servizi.visibile} alta={220} onDisegna={(segni) => cambiaFoto(s, j, { ...f, segni })} onTogli={() => cambiaFoto(s, j, null)} />
                        </div>
                      ))}
                      {fotoDellaScena(s).length < MAX_FOTO_SCENA && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        <label style={{ ...piccolo, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12, cursor: "pointer" }}>
                          {caricando === s.id ? "Carico…" : s.foto ? "📷 Un'altra foto qui" : "📷 Foto qui (con GPS)"}
                          <input type="file" accept="image/*" capture="environment" disabled={caricando === s.id} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; fotoQui(s, f); }} style={{ display: "none" }} />
                        </label>
                        <label style={{ ...piccolo, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px", fontSize: 12, cursor: "pointer" }}>
                          🖼️ Dalla galleria
                          <input type="file" accept="image/*" disabled={caricando === s.id} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; fotoQui(s, f, true); }} style={{ display: "none" }} />
                        </label>
                      </div>}
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

// --- Modalità riprese: sul posto, una scena alla volta a tutto schermo --------------------------------
// voci: [{ id, nome, det, note, stick, anim, foto: [..] }]; girate: id già fatte; onSegna(id) le spunta
const PRIMA_DI_PARTIRE = [
  { id: "sd", emoji: "💾", testo: "Scheda SD nel drone, ed è vuota", sotto: "Senza scheda il drone non registra niente. Se ci sono file vecchi: copiali e poi formattala dal drone." },
  { id: "batterie", emoji: "🔋", testo: "Batterie cariche: drone, radiocomando e telefono", sotto: "" },
  { id: "eliche", emoji: "🌀", testo: "Eliche integre e montate bene", sotto: "" },
  { id: "camera", emoji: "🎥", testo: "Impostazioni della camera controllate", sotto: "Risoluzione, fps, profilo colore e filtro ND giusti per la luce di adesso." },
  { id: "home", emoji: "🏠", testo: "Punto di ritorno (home) registrato prima di partire", sotto: "" },
];

export function ModalitaRiprese({ voci, girate, onSegna, onChiudi, visibile, ispezione, fpv }) {
  const [passo, setPasso] = useState(-1); // -1 = prima di partire, voci.length = fine
  const [pronti, setPronti] = useState({});
  const [fotoN, setFotoN] = useState(0);
  const [grande, setGrande] = useState(false);
  const [guarda, setGuarda] = useState(false);
  // lo schermo resta acceso finché sei qui
  useEffect(() => {
    let blocco = null, vivo = true;
    const chiedi = () => { try { navigator.wakeLock?.request("screen").then((b) => { if (vivo) blocco = b; else b.release(); }, () => {}); } catch { /* non supportato */ } };
    chiedi();
    const torna = () => { if (document.visibilityState === "visible") chiedi(); };
    document.addEventListener("visibilitychange", torna);
    return () => { vivo = false; document.removeEventListener("visibilitychange", torna); try { blocco && blocco.release(); } catch { /* niente */ } };
  }, []);
  const vai = (n) => { setPasso(n); setFotoN(0); setGuarda(false); };
  const prossima = (da) => { for (let k = da + 1; k < voci.length; k++) if (!girate.includes(voci[k].id)) return k; return voci.length; };
  const lista = fpv ? [...PRIMA_DI_PARTIRE.slice(0, 1), { id: "sd2", emoji: "💾", testo: "Scheda SD anche nella camera (GoPro o DVR del visore), vuota", sotto: "" }, ...PRIMA_DI_PARTIRE.slice(1)] : PRIMA_DI_PARTIRE;
  const parti = () => {
    if (!pronti.sd && !window.confirm("Hai controllato la scheda SD? Senza scheda, o con la scheda piena, il drone non registra niente.\n\nVuoi partire lo stesso?")) return;
    vai(girate.includes(voci[0]?.id) ? prossima(0) : 0);
  };
  const fatte = voci.filter((v) => girate.includes(v.id)).length;
  const v = voci[passo];
  const grosso = { border: "none", borderRadius: 12, fontSize: 17, fontWeight: 800, minHeight: 58, padding: "0 14px" };

  let corpo;
  if (passo < 0) {
    corpo = (
      <div style={{ padding: "6px 16px 20px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#e7eaee", marginTop: 6 }}>Prima di partire</div>
        <div style={{ fontSize: 14, color: "#a8a2bd", marginTop: 4 }}>Tocca ogni voce quando l'hai controllata.</div>
        {lista.map((x) => (
          <button key={x.id} type="button" onClick={() => setPronti({ ...pronti, [x.id]: !pronti[x.id] })} aria-pressed={!!pronti[x.id]}
            style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%", textAlign: "left", marginTop: 10, padding: "12px 14px", borderRadius: 12, background: pronti[x.id] ? "#12301f" : x.id.startsWith("sd") ? "#2a1f0c" : "#1b2028", border: `1px solid ${pronti[x.id] ? "#4ade80" : x.id.startsWith("sd") ? "#f5b942" : "#333a45"}`, color: "#e7eaee" }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>{pronti[x.id] ? "✅" : x.emoji}</span>
            <span>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{x.testo}</span>
              {x.sotto && <span style={{ display: "block", fontSize: 13, color: "#c3cad4", marginTop: 3 }}>{x.sotto}</span>}
            </span>
          </button>
        ))}
      </div>
    );
  } else if (passo >= voci.length) {
    const mancano = voci.filter((x) => !girate.includes(x.id));
    corpo = (
      <div style={{ padding: "10px 16px 20px" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: mancano.length ? "#f5b942" : "#4ade80", marginTop: 10 }}>{mancano.length ? `Ne ${mancano.length === 1 ? "manca 1" : `mancano ${mancano.length}`}` : ispezione ? "✅ Tutte le foto fatte!" : "✅ Tutto girato!"}</div>
        {mancano.length > 0 && <div style={{ marginTop: 10 }}>{mancano.map((x) => (
          <button key={x.id} type="button" onClick={() => vai(voci.indexOf(x))} style={{ display: "block", width: "100%", textAlign: "left", marginTop: 8, padding: "12px 14px", borderRadius: 12, background: "#1b2028", border: "1px solid #333a45", color: "#e7eaee", fontSize: 16, fontWeight: 700 }}>{voci.indexOf(x) + 1}. {x.nome} ›</button>
        ))}</div>}
        {!ispezione && !mancano.length && <div style={{ fontSize: 15, color: "#c3cad4", marginTop: 10 }}>In montaggio mettile in quest'ordine: {voci.map((x) => x.nome.replace(/ \(.*\)$/, "")).join(" → ")}</div>}
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "#2a1f0c", border: "1px solid #f5b942", color: "#ffe2a8", fontSize: 15 }}>💾 A casa: <strong>copia la scheda SD in due posti</strong> (computer e disco o cloud). Formattala solo dopo, dal drone.</div>
      </div>
    );
  } else {
    const foto = v.foto || [];
    const f = foto[Math.min(fotoN, foto.length - 1)];
    const fatta = girate.includes(v.id);
    corpo = (
      <div style={{ padding: "0 0 16px" }}>
        {f && <FotoModalita foto={f} visibile={visibile} onApri={() => setGrande(true)} />}
        {foto.length > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            {foto.map((_, j) => <button key={j} type="button" onClick={() => setFotoN(j)} style={{ background: j === fotoN ? "#7c5cd6" : "#1b2028", color: "#fff", border: "1px solid #3d2f5a", borderRadius: 8, minWidth: 44, minHeight: 40, fontSize: 14, fontWeight: 700 }}>{j + 1}</button>)}
          </div>
        )}
        <div style={{ padding: "8px 16px 0" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: fatta ? "#4ade80" : "#e7eaee", lineHeight: 1.2 }}>{fatta ? "✓ " : ""}{v.nome}</div>
          {v.det && <div style={{ fontSize: 17, color: "#e7eaee", marginTop: 8 }}>{v.det.startsWith("🕐") ? "" : "🎯 "}{v.det}</div>}
          {v.note && <div style={{ fontSize: 17, color: "#ffe2a8", marginTop: 8, background: "#2a2310", borderRadius: 10, padding: "10px 12px" }}>📝 {v.note}</div>}
          {v.stick && <div style={{ fontSize: 15, color: "#c4b5fd", marginTop: 10, lineHeight: 1.45 }}>🕹️ {v.stick}</div>}
          {haAnimazione(v.anim ?? v.id) && <button type="button" onClick={() => setGuarda(!guarda)} style={{ marginTop: 10, background: guarda ? "#7c5cd6" : "#251e33", color: "#fff", border: "1px solid #3d2f5a", borderRadius: 10, padding: "8px 14px", fontSize: 15, fontWeight: 600, minHeight: 44 }}>{guarda ? "✕ Chiudi" : "▶️ Guarda come si fa"}</button>}
          {guarda && <AnimazioneManovra id={v.anim ?? v.id} />}
        </div>
        {grande && <FotoGrande foto={foto} indice={fotoN} visibile={visibile} onChiudi={() => setGrande(false)} />}
      </div>
    );
  }

  return (
    <div role="dialog" aria-label="Modalità riprese" style={{ position: "fixed", inset: 0, zIndex: 3000, background: "#0b0d11", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #262b33" }}>
        <button type="button" onClick={onChiudi} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 8, padding: "8px 12px", fontSize: 14, minHeight: 44 }}>✕ Esci</button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 16, fontWeight: 800, color: "#e7eaee" }}>{passo < 0 ? "🎬 Modalità riprese" : passo >= voci.length ? "Fine" : `${ispezione ? "Foto" : "Scena"} ${passo + 1} di ${voci.length}`}</span>
        <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 700, minWidth: 54, textAlign: "right" }}>{fatte}/{voci.length} ✓</span>
      </div>
      <div style={{ height: 4, background: "#1b2028" }}><div style={{ height: 4, width: `${(fatte / Math.max(1, voci.length)) * 100}%`, background: "#4ade80", transition: "width .3s" }} /></div>
      <div style={{ flex: 1, overflowY: "auto" }}>{corpo}</div>
      <div style={{ display: "flex", gap: 8, padding: "10px 12px 16px", borderTop: "1px solid #262b33" }}>
        {passo < 0 && <button type="button" onClick={parti} style={{ ...grosso, flex: 1, background: "#7c5cd6", color: "#fff" }}>Iniziamo ▶</button>}
        {passo >= 0 && passo < voci.length && <>
          <button type="button" aria-label="Scena prima" onClick={() => vai(passo - 1)} style={{ ...grosso, background: "#1b2028", color: "#c3cad4", border: "1px solid #333a45", minWidth: 58 }}>‹</button>
          <button type="button" onClick={() => vai(passo + 1)} style={{ ...grosso, background: "#1b2028", color: "#c3cad4", border: "1px solid #333a45" }}>{girate.includes(v.id) ? "Avanti" : "Salta"}</button>
          <button type="button" onClick={() => { if (!girate.includes(v.id)) onSegna(v.id); vai(prossima(passo)); }} style={{ ...grosso, flex: 1, background: "#4ade80", color: "#0a1a0f" }}>{girate.includes(v.id) ? "✓ Già fatta" : ispezione ? "✓ Fatta" : "✓ Girata"}</button>
        </>}
        {passo >= voci.length && <>
          <button type="button" onClick={() => vai(voci.length - 1)} style={{ ...grosso, background: "#1b2028", color: "#c3cad4", border: "1px solid #333a45", minWidth: 58 }}>‹</button>
          <button type="button" onClick={onChiudi} style={{ ...grosso, flex: 1, background: "#7c5cd6", color: "#fff" }}>Chiudi</button>
        </>}
      </div>
    </div>
  );
}

// foto grande in cima alla scena: alta al massimo metà schermo, tocchi e si apre a tutto schermo
function FotoModalita({ foto, visibile, onApri }) {
  const href = useIndirizzo(foto, visibile);
  const [aspetto, setAspetto] = useState(null);
  useEffect(() => { if (!href) return; const im = new Image(); im.onload = () => setAspetto(im.naturalWidth / im.naturalHeight); im.src = href; }, [href]);
  if (!href || !aspetto) return <div style={{ height: 200, background: "#151a20", color: "#8b95a3", display: "flex", alignItems: "center", justifyContent: "center" }}>Carico la foto…</div>;
  return (
    <div style={{ background: "#000", padding: "6px 0", position: "relative" }}>
      <div style={{ width: `min(100%, calc(48vh * ${aspetto}))`, margin: "0 auto" }}>
        <FotoConSegni foto={foto} href={href} onClick={onApri} />
      </div>
      <span style={{ position: "absolute", right: 10, bottom: 12, background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12, borderRadius: 8, padding: "4px 8px", pointerEvents: "none" }}>🔍 tocca per ingrandire</span>
    </div>
  );
}
