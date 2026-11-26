import React, { useEffect, useMemo, useRef, useState } from "react";
import { TestataPagina } from "./VoloHero.jsx";

// «🌡️ Termocamera»: come il DJI Thermal Analysis Tool, ma nel telefono. Carichi le foto termiche originali (R-JPEG DJI),
// il server legge con l'SDK DJI la temperatura di ogni pixel (thermal-repalette.js, modalità «dati»); qui cambi palette,
// tocchi un punto e leggi la temperatura, misuri aree, regoli emissività e temperatura riflessa, evidenzi sopra una soglia
// ed esporti l'immagine con le misure.

export const PALETTE = {
  ironbow: { nome: "Ironbow", tappe: [[0, [0, 0, 20]], [0.2, [40, 0, 100]], [0.4, [140, 0, 120]], [0.6, [220, 60, 20]], [0.8, [255, 170, 0]], [1, [255, 255, 200]]] },
  rainbow: { nome: "Rainbow", tappe: [[0, [0, 0, 255]], [0.25, [0, 255, 255]], [0.5, [0, 255, 0]], [0.75, [255, 255, 0]], [1, [255, 0, 0]]] },
  rainbowhc: { nome: "Rainbow alto contrasto", tappe: [[0, [20, 0, 60]], [0.15, [0, 0, 255]], [0.3, [0, 200, 255]], [0.45, [0, 255, 0]], [0.6, [255, 255, 0]], [0.75, [255, 120, 0]], [0.9, [255, 0, 0]], [1, [255, 255, 255]]] },
  whitehot: { nome: "White hot", tappe: [[0, [0, 0, 0]], [1, [255, 255, 255]]] },
  blackhot: { nome: "Black hot", tappe: [[0, [255, 255, 255]], [1, [0, 0, 0]]] },
  arctic: { nome: "Arctic", tappe: [[0, [10, 10, 60]], [0.35, [30, 90, 180]], [0.65, [130, 200, 230]], [1, [255, 255, 255]]] },
  lava: { nome: "Lava", tappe: [[0, [0, 0, 0]], [0.4, [120, 0, 0]], [0.7, [230, 90, 0]], [1, [255, 230, 80]]] },
  medical: { nome: "Medical", tappe: [[0, [0, 0, 0]], [0.25, [0, 80, 200]], [0.5, [0, 200, 120]], [0.7, [240, 220, 0]], [0.85, [255, 80, 0]], [1, [255, 0, 0]]] },
};
const LUT = {};
function lut(nome) {
  if (LUT[nome]) return LUT[nome];
  const t = (PALETTE[nome] || PALETTE.ironbow).tappe, out = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let k = 0; while (k < t.length - 2 && x > t[k + 1][0]) k++;
    const [a, ca] = t[k], [b, cb] = t[k + 1], f = b > a ? (x - a) / (b - a) : 0;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = ca[c] + (cb[c] - ca[c]) * Math.max(0, Math.min(1, f));
  }
  return (LUT[nome] = out);
}

// emissività e temperatura riflessa diverse da quelle della foto: correzione con la legge di Stefan-Boltzmann
// (approssimata: non tiene conto della banda della camera né dell'atmosfera)
const K = 273.15;
export function correggi(tFoto, e0, tr0, e1, tr1) {
  if (Math.abs(e0 - e1) < 1e-6 && Math.abs(tr0 - tr1) < 1e-6) return tFoto;
  const w = e0 * (tFoto + K) ** 4 + (1 - e0) * (tr0 + K) ** 4;
  const x = (w - (1 - e1) * (tr1 + K) ** 4) / e1;
  return x > 0 ? x ** 0.25 - K : tFoto;
}

const btn = (p) => ({ background: p ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: p ? "#10141f" : "#e7eaee", border: p ? "none" : "1px solid #343e57", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700 });
const scheda = { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 14 };
const f1 = (t) => (t == null || !Number.isFinite(t) ? "—" : `${t.toFixed(1)} °C`);
const leggiFile = (file) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(file); });

function decodifica(dati) {
  const bin = atob(dati.temperature);
  const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Int16Array(b.buffer);
}

export default function Termocamera({ supabase, piano }) {
  const [foto, setFoto] = useState([]); // [{ nome, stato, errore, w, h, t: Int16Array, par }]
  const [scelta, setScelta] = useState(0);
  const [palette, setPalette] = useState(() => { try { return localStorage.getItem("eyedrones_palette") || "ironbow"; } catch { return "ironbow"; } });
  const [scala, setScala] = useState({ auto: true, min: "", max: "" });
  const [soglia, setSoglia] = useState("");
  const [corr, setCorr] = useState({ e: "", tr: "" });
  const [modo, setModo] = useState("punto"); // punto | area
  const [misure, setMisure] = useState({}); // per foto: [{ tipo, x, y, x2, y2 }]
  const [sotto, setSotto] = useState(null); // ultimo punto toccato { x, y }
  const [primoAngolo, setPrimoAngolo] = useState(null);
  const [passa, setPassa] = useState(null); // al computer: temperatura sotto il mouse
  const canvas = useRef(null);
  useEffect(() => { try { localStorage.setItem("eyedrones_palette", palette); } catch { /* niente */ } }, [palette]);

  const carica = async (files) => {
    const nuove = [...files].map((f) => ({ nome: f.name, file: f, stato: "attesa" }));
    const base = foto.length;
    setFoto((x) => [...x, ...nuove]);
    if (!foto.length) setScelta(0);
    const { data: s } = await supabase.auth.getSession();
    for (let i = 0; i < nuove.length; i++) {
      const idx = base + i;
      setFoto((x) => x.map((f, k) => (k === idx ? { ...f, stato: "leggo" } : f)));
      try {
        if (nuove[i].file.size > 5.4 * 1024 * 1024) throw new Error("Foto troppo grande (massimo circa 5 MB).");
        const img = await leggiFile(nuove[i].file);
        const r = await fetch("/.netlify/functions/thermal-repalette", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.session?.access_token || ""}` }, body: JSON.stringify({ imageBase64: img, dati: true }) });
        const testo = await r.text(); let j = null; try { j = JSON.parse(testo); } catch { /* niente */ }
        if (!r.ok || !j || !j.temperature) throw new Error((j && j.errore) || "Non sono riuscito a leggere la foto.");
        const t = decodifica(j);
        setFoto((x) => x.map((f, k) => (k === idx ? { nome: f.nome, stato: "ok", w: j.width, h: j.height, t, par: j.parametri || {} } : f)));
      } catch (e) {
        setFoto((x) => x.map((f, k) => (k === idx ? { nome: f.nome, stato: "errore", errore: e.message } : f)));
      }
    }
  };

  const f = foto[scelta] && foto[scelta].stato === "ok" ? foto[scelta] : null;
  const e0 = f ? Number(f.par.emissivity) || 1 : 1, tr0 = f ? Number(f.par.reflection ?? 23) : 23;
  const e1 = Math.min(1, Math.max(0.1, Number(String(corr.e).replace(",", ".")) || e0));
  const tr1 = corr.tr === "" ? tr0 : Number(String(corr.tr).replace(",", ".")) || 0;
  const temp = (x, y) => (f ? correggi(f.t[y * f.w + x] / 10, e0, tr0, e1, tr1) : null);

  // statistiche della foto (con la correzione) e posizioni del più caldo e del più freddo
  const stat = useMemo(() => {
    if (!f) return null;
    let mn = Infinity, mx = -Infinity, imn = 0, imx = 0;
    for (let i = 0; i < f.t.length; i++) { const v = f.t[i]; if (v < mn) { mn = v; imn = i; } if (v > mx) { mx = v; imx = i; } }
    const c = (v) => correggi(v / 10, e0, tr0, e1, tr1);
    return { min: c(mn), max: c(mx), pMin: { x: imn % f.w, y: Math.floor(imn / f.w) }, pMax: { x: imx % f.w, y: Math.floor(imx / f.w) } };
  }, [f, e0, tr0, e1, tr1]);
  const lo = scala.auto || scala.min === "" ? stat && stat.min : Number(String(scala.min).replace(",", "."));
  const hi = scala.auto || scala.max === "" ? stat && stat.max : Number(String(scala.max).replace(",", "."));
  const sogliaN = soglia === "" ? null : Number(String(soglia).replace(",", "."));
  const lista = (f && misure[scelta]) || [];

  const misuraArea = (m) => {
    const xa = Math.min(m.x, m.x2), xb = Math.max(m.x, m.x2), ya = Math.min(m.y, m.y2), yb = Math.max(m.y, m.y2);
    let mn = Infinity, mx = -Infinity, s = 0, n = 0, pmx = null;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { const t = temp(x, y); s += t; n++; if (t < mn) mn = t; if (t > mx) { mx = t; pmx = { x, y }; } }
    return { min: mn, max: mx, media: s / n, pmx };
  };

  // disegno: palette, soglia, punti caldo/freddo, misure, punto toccato
  useEffect(() => {
    const cv = canvas.current; if (!cv || !f) return;
    cv.width = f.w; cv.height = f.h;
    const ctx = cv.getContext("2d");
    const img = ctx.createImageData(f.w, f.h), L = lut(palette), d = img.data, span = hi - lo || 1;
    // tabella dai decimi grezzi al colore (veloce anche con la correzione)
    let vmin = Infinity, vmax = -Infinity; for (let i = 0; i < f.t.length; i++) { if (f.t[i] < vmin) vmin = f.t[i]; if (f.t[i] > vmax) vmax = f.t[i]; }
    const tab = new Int16Array(vmax - vmin + 1), sopra = new Uint8Array(vmax - vmin + 1);
    for (let v = vmin; v <= vmax; v++) { const t = correggi(v / 10, e0, tr0, e1, tr1); tab[v - vmin] = Math.max(0, Math.min(255, Math.round(((t - lo) / span) * 255))); sopra[v - vmin] = sogliaN != null && t >= sogliaN ? 1 : 0; }
    for (let i = 0; i < f.t.length; i++) {
      const k = f.t[i] - vmin, c = tab[k] * 3;
      if (sogliaN != null) {
        if (sopra[k]) { d[i * 4] = 255; d[i * 4 + 1] = 40; d[i * 4 + 2] = 40; } else { const g = tab[k] * 0.8; d[i * 4] = g; d[i * 4 + 1] = g; d[i * 4 + 2] = g; }
      } else { d[i * 4] = L[c]; d[i * 4 + 1] = L[c + 1]; d[i * 4 + 2] = L[c + 2]; }
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const s = f.w / 640;
    const etichetta = (x, y, testo, colore) => {
      ctx.font = `bold ${Math.round(13 * s)}px sans-serif`;
      const w = ctx.measureText(testo).width + 8 * s, h = 18 * s, bx = Math.min(f.w - w - 2, x + 8 * s), by = Math.max(2, y - h - 6 * s);
      ctx.fillStyle = "rgba(10,13,22,0.8)"; ctx.fillRect(bx, by, w, h); ctx.fillStyle = colore; ctx.fillText(testo, bx + 4 * s, by + 13 * s);
    };
    const croce = (x, y, colore, r = 7) => { ctx.strokeStyle = "#000"; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(x - r * s, y); ctx.lineTo(x + r * s, y); ctx.moveTo(x, y - r * s); ctx.lineTo(x, y + r * s); ctx.stroke(); ctx.strokeStyle = colore; ctx.lineWidth = 1.5 * s; ctx.stroke(); };
    if (stat) {
      croce(stat.pMax.x, stat.pMax.y, "#ff3b3b"); etichetta(stat.pMax.x, stat.pMax.y, `▲ ${f1(stat.max)}`, "#ff8080");
      croce(stat.pMin.x, stat.pMin.y, "#3d8bfd"); etichetta(stat.pMin.x, stat.pMin.y, `▼ ${f1(stat.min)}`, "#9cc4ff");
    }
    lista.forEach((m, i) => {
      if (m.tipo === "punto") { croce(m.x, m.y, "#ffffff", 9); etichetta(m.x, m.y, `P${i + 1} ${f1(temp(m.x, m.y))}`, "#fff"); }
      else { const a = misuraArea(m); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 * s; ctx.setLineDash([6 * s, 4 * s]); ctx.strokeRect(Math.min(m.x, m.x2), Math.min(m.y, m.y2), Math.abs(m.x2 - m.x) + 1, Math.abs(m.y2 - m.y) + 1); ctx.setLineDash([]); etichetta(Math.min(m.x, m.x2), Math.min(m.y, m.y2), `A${i + 1} max ${f1(a.max)}`, "#fff"); }
    });
    if (sotto) croce(sotto.x, sotto.y, "#4ade80", 11);
    if (primoAngolo) croce(primoAngolo.x, primoAngolo.y, "#facc15", 9);
  }, [f, palette, lo, hi, sogliaN, e1, tr1, lista, sotto, primoAngolo, stat]);

  const pixel = (ev) => {
    const r = canvas.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(f.w - 1, Math.floor(((ev.clientX - r.left) / r.width) * f.w)));
    const y = Math.max(0, Math.min(f.h - 1, Math.floor(((ev.clientY - r.top) / r.height) * f.h)));
    return { x, y };
  };
  const tocca = (ev) => {
    if (!f) return;
    const p = pixel(ev);
    if (modo === "punto") { setSotto(p); return; }
    if (!primoAngolo) { setPrimoAngolo(p); return; }
    setMisure({ ...misure, [scelta]: [...lista, { tipo: "area", x: primoAngolo.x, y: primoAngolo.y, x2: p.x, y2: p.y }] });
    setPrimoAngolo(null);
  };
  const fissa = () => { if (!sotto) return; setMisure({ ...misure, [scelta]: [...lista, { tipo: "punto", ...sotto }] }); setSotto(null); };
  const togli = (i) => setMisure({ ...misure, [scelta]: lista.filter((_, k) => k !== i) });

  const esporta = () => {
    const cv = canvas.current; if (!cv) return;
    const pad = Math.round(f.w * 0.06), out = document.createElement("canvas");
    out.width = f.w + pad * 2; out.height = f.h + pad * 3;
    const c = out.getContext("2d"); c.fillStyle = "#0b0f19"; c.fillRect(0, 0, out.width, out.height);
    c.drawImage(cv, pad, pad);
    const L = lut(palette), y0 = f.h + pad * 1.4, lw = f.w * 0.6;
    for (let i = 0; i < lw; i++) { const k = Math.round((i / lw) * 255) * 3; c.fillStyle = sogliaN != null ? "#888" : `rgb(${L[k]},${L[k + 1]},${L[k + 2]})`; c.fillRect(pad + i, y0, 1, pad * 0.35); }
    c.fillStyle = "#e7eaee"; c.font = `${Math.round(pad * 0.32)}px sans-serif`;
    c.fillText(f1(lo), pad, y0 + pad * 0.8); c.fillText(f1(hi), pad + lw - c.measureText(f1(hi)).width, y0 + pad * 0.8);
    c.fillText(`${foto[scelta].nome} · ε ${e1.toFixed(2)} · T rifl. ${tr1.toFixed(1)} °C${sogliaN != null ? ` · sopra ${sogliaN} °C in rosso` : ""} · EyeDrones`, pad, out.height - pad * 0.4);
    const a = document.createElement("a"); a.href = out.toDataURL("image/png"); a.download = foto[scelta].nome.replace(/\.[^.]+$/, "") + "-termica.png"; document.body.appendChild(a); a.click(); a.remove();
  };

  if (piano !== "pro") {
    return <div style={{ padding: "28px 32px" }}><TestataPagina titolo="Termocamera" sigla="R-JPEG · TEMPERATURE · PALETTE" /><div style={{ ...scheda, maxWidth: 460 }}>Legge la temperatura di ogni punto dalle foto termiche originali DJI e cambia la palette: è inclusa nel piano Pro.</div></div>;
  }
  const valoreSotto = sotto ? temp(sotto.x, sotto.y) : null;
  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ maxWidth: 980 }}>
        <TestataPagina titolo="Termocamera" sigla="R-JPEG · TEMPERATURE · PALETTE" info="Da telefono e da computer. Carica le foto termiche originali DJI (R-JPEG): tocca o clicca un punto per leggere la temperatura, misura le aree, cambia palette ed esporta l'immagine con le misure." />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <label style={{ ...btn(true), cursor: "pointer" }}>📷 Carica foto termiche (R-JPEG)
            <input type="file" accept=".jpg,.jpeg,image/jpeg" multiple onChange={(e) => { carica(e.target.files || []); e.target.value = ""; }} style={{ display: "none" }} aria-label="Foto termiche" />
          </label>
          <span style={{ fontSize: 12, color: "#8b95a3" }}>Le foto originali con «_T» nel nome (Mavic 3T, Matrice 30T, Matrice 4T, H20T…), non modificate.</span>
        </div>
        {foto.length > 0 && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
            {foto.map((x, i) => <button key={i} type="button" onClick={() => { setScelta(i); setSotto(null); setPrimoAngolo(null); }} style={{ ...btn(false), whiteSpace: "nowrap", borderColor: i === scelta ? "#ff8c42" : "#343e57", opacity: x.stato === "errore" ? 0.6 : 1 }}>{x.stato === "leggo" || x.stato === "attesa" ? "⏳ " : x.stato === "errore" ? "⚠️ " : "🌡️ "}{x.nome}</button>)}
          </div>
        )}
        {foto[scelta] && foto[scelta].stato === "errore" && <div style={{ ...scheda, color: "#ffb877", fontSize: 13, marginBottom: 12 }}>{foto[scelta].errore}</div>}
        {foto[scelta] && (foto[scelta].stato === "leggo" || foto[scelta].stato === "attesa") && <div style={{ fontSize: 13, color: "#9cc4ff", marginBottom: 12 }}>Leggo le temperature…</div>}
        {f && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }} data-termo>
            <div style={{ flex: "1 1 520px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 8 }}>
            <div style={{ position: "relative" }}>
              <canvas ref={canvas} onClick={tocca} onPointerMove={(ev) => { if (f && ev.pointerType === "mouse") { const p = pixel(ev); setPassa({ ...p, t: temp(p.x, p.y), cx: ev.nativeEvent.offsetX, cy: ev.nativeEvent.offsetY }); } }} onPointerLeave={() => setPassa(null)} style={{ width: "100%", height: "auto", borderRadius: 10, border: "1px solid #2a3349", cursor: "crosshair", touchAction: "manipulation", display: "block" }} aria-label="Foto termica: tocca per leggere la temperatura" />
              {passa && <div style={{ position: "absolute", left: passa.cx + 14, top: passa.cy + 14, background: "#0a0d16dd", border: "1px solid #343e57", borderRadius: 6, padding: "2px 7px", fontSize: 12.5, fontWeight: 700, color: "#e7eaee", pointerEvents: "none", whiteSpace: "nowrap" }} data-temp-mouse>{f1(passa.t)}</div>}
              {sotto && modo === "punto" && <div style={{ position: "absolute", top: 8, left: 8, background: "#0a0d16dd", border: "1px solid #4ade80", borderRadius: 8, padding: "6px 10px", fontSize: 15, fontWeight: 800, color: "#4ade80" }} data-temp-punto>{f1(valoreSotto)}</div>}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "#c3cad4" }}>
              <span>▲ max <b style={{ color: "#ff8080" }}>{f1(stat.max)}</b></span><span>▼ min <b style={{ color: "#9cc4ff" }}>{f1(stat.min)}</b></span><span>Δ {(stat.max - stat.min).toFixed(1)} °C</span>
            </div>
            </div>
            <div style={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(PALETTE).map(([k, p]) => { const L = lut(k); const g = [0, 64, 128, 192, 255].map((i) => `rgb(${L[i * 3]},${L[i * 3 + 1]},${L[i * 3 + 2]})`).join(","); return (
                  <button key={k} type="button" aria-pressed={palette === k} onClick={() => setPalette(k)} style={{ ...btn(false), padding: "6px 10px", borderColor: palette === k ? "#ff8c42" : "#343e57", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 34, height: 10, borderRadius: 3, background: `linear-gradient(90deg, ${g})` }} />{p.nome}</button>); })}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" aria-pressed={modo === "punto"} onClick={() => { setModo("punto"); setPrimoAngolo(null); }} style={{ ...btn(modo === "punto") }}>🎯 Punto</button>
                <button type="button" aria-pressed={modo === "area"} onClick={() => { setModo("area"); setSotto(null); }} style={{ ...btn(modo === "area") }}>⬚ Area</button>
                {modo === "punto" && <button type="button" disabled={!sotto} onClick={fissa} style={{ ...btn(false), opacity: sotto ? 1 : 0.5 }}>📌 Fissa il punto</button>}
                <span style={{ fontSize: 12, color: "#8b95a3" }}>{modo === "punto" ? "Tocca o clicca la foto per leggere la temperatura (al computer basta passarci sopra)." : primoAngolo ? "Tocca l'angolo opposto." : "Tocca il primo angolo dell'area."}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, fontSize: 12, color: "#8b95a3" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Scala<select value={scala.auto ? "auto" : "man"} onChange={(e) => setScala({ ...scala, auto: e.target.value === "auto", min: scala.min || (stat.min).toFixed(1), max: scala.max || (stat.max).toFixed(1) })} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 6 }}><option value="auto">Automatica</option><option value="man">Scelgo io</option></select></label>
                {!scala.auto && <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Da °C<input inputMode="decimal" value={scala.min} onChange={(e) => setScala({ ...scala, min: e.target.value })} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 6 }} /></label>}
                {!scala.auto && <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>A °C<input inputMode="decimal" value={scala.max} onChange={(e) => setScala({ ...scala, max: e.target.value })} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 6 }} /></label>}
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Evidenzia sopra °C<input inputMode="decimal" value={soglia} onChange={(e) => setSoglia(e.target.value)} placeholder="es. 45" style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 6 }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>Emissività (foto: {e0.toFixed(2)})<input inputMode="decimal" value={corr.e} onChange={(e) => setCorr({ ...corr, e: e.target.value })} placeholder={e0.toFixed(2)} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 6 }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>T riflessa °C (foto: {tr0})<input inputMode="decimal" value={corr.tr} onChange={(e) => setCorr({ ...corr, tr: e.target.value })} placeholder={String(tr0)} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 6 }} /></label>
              </div>
              <div style={{ fontSize: 11.5, color: "#8b95a3", lineHeight: 1.5 }}>Emissività tipiche: pannelli fotovoltaici (vetro) 0,85–0,90 · mattoni e intonaco 0,90–0,95 · metallo verniciato 0,90 · metallo lucido 0,05–0,30 (misura poco affidabile). Distanza {f.par.distance} m e umidità {f.par.humidity}% sono quelle salvate nella foto. Cambiando emissività e temperatura riflessa la correzione è approssimata.</div>
            </div>
            {lista.length > 0 && (
              <div style={scheda}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>📏 Misure</div>
                {lista.map((m, i) => { const a = m.tipo === "area" ? misuraArea(m) : null; return (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "5px 0", borderBottom: "1px solid #232b3f" }}>
                    <span>{m.tipo === "punto" ? `P${i + 1} · ${f1(temp(m.x, m.y))}` : `A${i + 1} · max ${f1(a.max)} · min ${f1(a.min)} · media ${f1(a.media)}`}</span>
                    <button type="button" onClick={() => togli(i)} style={{ background: "none", border: "none", color: "#ff9c9c", fontSize: 13 }}>✕</button>
                  </div>); })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={esporta} style={btn(true)}>⬇️ Scarica l'immagine con le misure</button>
              {lista.length > 0 && <button type="button" onClick={() => setMisure({ ...misure, [scelta]: [] })} style={btn(false)}>Togli le misure</button>}
            </div>
            </div>
          </div>
        )}
        {!foto.length && <div style={{ ...scheda, fontSize: 13, color: "#c3cad4", lineHeight: 1.6 }}>Come il DJI Thermal Analysis Tool, ma nel telefono: <b>tocca un punto</b> e leggi la temperatura, <b>misura un'area</b> (massima, minima e media), <b>cambia palette</b> e scala, <b>evidenzia</b> quello che supera una soglia, correggi <b>emissività</b> e <b>temperatura riflessa</b>, poi scarica l'immagine con le misure per il report.</div>}
      </div>
    </div>
  );
}
