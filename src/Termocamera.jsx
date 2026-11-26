import React, { useEffect, useMemo, useRef, useState } from "react";
import { TestataPagina } from "./VoloHero.jsx";
import { consegnaAllAI } from "./passaggioAI.js";

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

// nomi DJI: «_T» è la termica; «_W», «_Z», «_V», «_S» sono le foto normali dello stesso scatto
const NORMALE = /_(W|Z|V|S)\.(jpe?g)$/i;
const baseNome = (n) => String(n).replace(/_(T|W|Z|V|S)\.(jpe?g)$/i, "").replace(/\.(jpe?g)$/i, "");
const caricaImmagine = (file) => new Promise((ok, ko) => { const u = URL.createObjectURL(file); const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error("Non riesco ad aprire la foto normale.")); i.src = u; });
const inBlob = (cv, tipo = "image/jpeg") => new Promise((ok) => cv.toBlob(ok, tipo, 0.9));

function decodifica(dati) {
  const bin = atob(dati.temperature);
  const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Int16Array(b.buffer);
}

// una foto termica colorata per l'AI (scala automatica, niente segni) e le sue temperature misurate
function perAI(ff, palette, eNuova, trNuova) {
  const e0 = Number(ff.par.emissivity) || 1, tr0 = Number(ff.par.reflection ?? 23);
  const e1 = eNuova || e0, tr1 = trNuova ?? tr0;
  let vmin = Infinity, vmax = -Infinity, somma = 0, imx = 0;
  for (let i = 0; i < ff.t.length; i++) { const v = ff.t[i]; if (v < vmin) vmin = v; if (v > vmax) { vmax = v; imx = i; } somma += v; }
  const c = (v) => correggi(v / 10, e0, tr0, e1, tr1);
  const lo = c(vmin), hi = c(vmax), span = hi - lo || 1, L = lut(palette);
  const tab = new Uint8Array(vmax - vmin + 1); const tC = new Float32Array(vmax - vmin + 1);
  for (let v = vmin; v <= vmax; v++) { const t = c(v); tC[v - vmin] = t; tab[v - vmin] = Math.max(0, Math.min(255, Math.round(((t - lo) / span) * 255))); }
  const cv = document.createElement("canvas"); cv.width = ff.w; cv.height = ff.h;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(ff.w, ff.h), d = img.data;
  for (let i = 0; i < ff.t.length; i++) { const k = tab[ff.t[i] - vmin] * 3; d[i * 4] = L[k]; d[i * 4 + 1] = L[k + 1]; d[i * 4 + 2] = L[k + 2]; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  const media = c(somma / ff.t.length);
  const px = (imx % ff.w) / ff.w, py = Math.floor(imx / ff.w) / ff.h;
  const dove = `${py < 0.33 ? "in alto" : py > 0.66 ? "in basso" : "al centro"}${px < 0.33 ? " a sinistra" : px > 0.66 ? " a destra" : ""}`;
  const dati = `Foto radiometrica: temperature vere lette dal file originale (emissività ${e1.toFixed(2)}, temperatura riflessa ${tr1.toFixed(1)} °C). Massima ${hi.toFixed(1)} °C ${dove} (x ${px.toFixed(2)}, y ${py.toFixed(2)}), minima ${lo.toFixed(1)} °C, media della foto ${media.toFixed(1)} °C. Colori: palette ${PALETTE[palette].nome}, scala da ${lo.toFixed(1)} a ${hi.toFixed(1)} °C.`;
  // temperatura dentro un riquadro (x, y, larghezza, altezza da 0 a 1)
  const tempRiquadro = (q) => {
    const xa = Math.max(0, Math.floor(q.x * ff.w)), ya = Math.max(0, Math.floor(q.y * ff.h));
    const xb = Math.min(ff.w - 1, Math.ceil((q.x + q.larghezza) * ff.w)), yb = Math.min(ff.h - 1, Math.ceil((q.y + q.altezza) * ff.h));
    let mx = -Infinity, s = 0, n = 0;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { const t = tC[ff.t[y * ff.w + x] - vmin]; if (t > mx) mx = t; s += t; n++; }
    return n ? { max: mx, media: s / n, mediaFoto: media } : null;
  };
  return { url: cv.toDataURL("image/jpeg", 0.88), w: ff.w, h: ff.h, dati, tempRiquadro };
}

export default function Termocamera({ supabase, piano, impianti = [], ispezioni = [], onReload, onApriImpianto, usaAI, onAI }) {
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
  const [normali, setNormali] = useState([]); // foto normali caricate: [{ nome, file, base }]
  const [abbinate, setAbbinate] = useState({}); // foto termica (indice) → nome della foto normale scelta a mano ("" = nessuna)
  const [anteprimaNormale, setAnteprimaNormale] = useState("");
  const [report, setReport] = useState({ aperto: false, ispezione: "", cosa: { misure: true, pulita: false, normale: false, affiancate: true }, stato: "", errore: "", fatto: null });
  const canvas = useRef(null);
  useEffect(() => { try { localStorage.setItem("eyedrones_palette", palette); } catch { /* niente */ } }, [palette]);

  const carica = async (files) => {
    const tutte = [...files];
    const vis = tutte.filter((f) => NORMALE.test(f.name));
    if (vis.length) setNormali((x) => [...x.filter((v) => !vis.some((n) => n.name === v.nome)), ...vis.map((f) => ({ nome: f.name, file: f, base: baseNome(f.name) }))]);
    const nuove = tutte.filter((f) => !NORMALE.test(f.name)).map((f) => ({ nome: f.name, file: f, stato: "attesa" }));
    if (!nuove.length) return;
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
  const normale = foto[scelta] ? (scelta in abbinate ? normali.find((v) => v.nome === abbinate[scelta]) : normali.find((v) => v.base === baseNome(foto[scelta].nome))) || null : null;
  useEffect(() => {
    if (!normale) { setAnteprimaNormale(""); return undefined; }
    const u = URL.createObjectURL(normale.file); setAnteprimaNormale(u);
    return () => URL.revokeObjectURL(u);
  }, [normale]);
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

  // disegno: palette, soglia, punti caldo/freddo, misure, punto toccato (senza segni: solo i colori)
  const disegna = (cv, segni = true) => {
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
    if (!segni) return;
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
    if (sotto && segni !== "report") croce(sotto.x, sotto.y, "#4ade80", 11);
    if (primoAngolo && segni !== "report") croce(primoAngolo.x, primoAngolo.y, "#facc15", 9);
  };
  useEffect(() => {
    const cv = canvas.current; if (!cv || !f) return;
    disegna(cv);
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

  // immagine con la barra dei colori e i dati sotto, pronta per il report o da scaricare
  const conLegenda = (segni) => {
    const cv = document.createElement("canvas"); disegna(cv, segni);
    const pad = Math.round(f.w * 0.06), out = document.createElement("canvas");
    out.width = f.w + pad * 2; out.height = f.h + pad * 3;
    const c = out.getContext("2d"); c.fillStyle = "#0b0f19"; c.fillRect(0, 0, out.width, out.height);
    c.drawImage(cv, pad, pad);
    const L = lut(palette), y0 = f.h + pad * 1.4, lw = f.w * 0.6;
    for (let i = 0; i < lw; i++) { const k = Math.round((i / lw) * 255) * 3; c.fillStyle = sogliaN != null ? "#888" : `rgb(${L[k]},${L[k + 1]},${L[k + 2]})`; c.fillRect(pad + i, y0, 1, pad * 0.35); }
    c.fillStyle = "#e7eaee"; c.font = `${Math.round(pad * 0.32)}px sans-serif`;
    c.fillText(f1(lo), pad, y0 + pad * 0.8); c.fillText(f1(hi), pad + lw - c.measureText(f1(hi)).width, y0 + pad * 0.8);
    c.fillText(`${foto[scelta].nome} · ε ${e1.toFixed(2)} · T rifl. ${tr1.toFixed(1)} °C${sogliaN != null ? ` · sopra ${sogliaN} °C in rosso` : ""} · EyeDrones`, pad, out.height - pad * 0.4);
    return out;
  };
  const esporta = () => {
    const out = conLegenda(true);
    const a = document.createElement("a"); a.href = out.toDataURL("image/png"); a.download = foto[scelta].nome.replace(/\.[^.]+$/, "") + "-termica.png"; document.body.appendChild(a); a.click(); a.remove();
  };

  // affiancate: a sinistra la termica con le misure, a destra la foto normale alla stessa altezza
  const affianca = async () => {
    const t = conLegenda("report"), img = await caricaImmagine(normale.file);
    const h = t.height, w2 = Math.round(img.naturalWidth * (h / img.naturalHeight)), gap = Math.round(h * 0.02);
    const out = document.createElement("canvas"); out.width = t.width + gap + w2; out.height = h;
    const c = out.getContext("2d"); c.fillStyle = "#0b0f19"; c.fillRect(0, 0, out.width, out.height);
    c.drawImage(t, 0, 0); c.drawImage(img, t.width + gap, 0, w2, h);
    return out;
  };
  const didascalia = () => {
    const pezzi = [`Termica ${baseNome(foto[scelta].nome)}`, `max ${f1(stat.max)}`, `min ${f1(stat.min)}`];
    lista.forEach((m, i) => { if (m.tipo === "punto") pezzi.push(`P${i + 1} ${f1(temp(m.x, m.y))}`); else { const a = misuraArea(m); pezzi.push(`A${i + 1} max ${f1(a.max)}, media ${f1(a.media)}`); } });
    pezzi.push(`ε ${e1.toFixed(2)}`);
    return pezzi.join(" · ");
  };
  const ispezioniOrdinate = useMemo(() => [...ispezioni].sort((a, b) => String(b.data || "").localeCompare(String(a.data || ""))), [ispezioni]);
  const nomeIspezione = (i) => `${(impianti.find((x) => x.id === i.impianto_id) || {}).nome || "Impianto"} · ${i.data ? new Date(i.data).toLocaleDateString("it-IT") : "senza data"}`;
  const mettiNelReport = async () => {
    const isp = ispezioni.find((i) => String(i.id) === String(report.ispezione));
    if (!isp) { setReport({ ...report, errore: "Scegli l'ispezione." }); return; }
    const cosa = report.cosa, d = didascalia();
    const elenco = [];
    if (cosa.misure) elenco.push({ cv: () => conLegenda("report"), dida: d });
    if (cosa.pulita) elenco.push({ cv: () => conLegenda(false), dida: `Termica ${baseNome(foto[scelta].nome)} · max ${f1(stat.max)} · min ${f1(stat.min)}` });
    if (normale && cosa.normale) elenco.push({ file: normale.file, dida: `Foto normale ${baseNome(normale.nome)}` });
    if (normale && cosa.affiancate) elenco.push({ cv: affianca, dida: `${d} · a destra la foto normale` });
    if (!elenco.length) { setReport({ ...report, errore: "Scegli almeno una foto da mettere." }); return; }
    setReport({ ...report, stato: "invio", errore: "", fatto: null });
    try {
      let n = 0;
      for (const x of elenco) {
        const blob = x.file || (await inBlob(await x.cv()));
        const nomeFile = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, blob, { contentType: "image/jpeg" });
        if (eUp) throw eUp;
        const url = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile).data?.publicUrl;
        const { error: eIns } = await supabase.from("foto").insert({ ispezione_id: isp.id, url, didascalia: x.dida.slice(0, 500) });
        if (eIns) throw eIns;
        n++;
      }
      setReport((r) => ({ ...r, stato: "", fatto: { n, isp } }));
      onReload && onReload();
    } catch (e) {
      setReport((r) => ({ ...r, stato: "", errore: "Non sono riuscito a metterle nel report: " + (e?.message || e) }));
    }
  };

  const pronte = foto.filter((x) => x.stato === "ok");
  const mandaAllAI = () => {
    const eN = corr.e === "" ? null : e1, trN = corr.tr === "" ? null : tr1;
    consegnaAllAI({ tipo: "fotovoltaico", foto: pronte.map((x) => ({ nome: x.nome, ...perAI(x, palette, eN, trN) })) });
    onAI && onAI();
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
          {usaAI && onAI && pronte.length > 0 && <button type="button" onClick={mandaAllAI} style={{ ...btn(false), borderColor: "#7c5cff", color: "#d6ccff" }} data-manda-ai>🤖 Controlla con l'AI ({pronte.length === 1 ? "1 foto" : `${pronte.length} foto`})</button>}
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
            <div style={{ ...scheda, padding: 10, display: "flex", flexDirection: "column", gap: 8 }} data-normale>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "#c3cad4" }}>
                <span>🖼️ Foto normale: <b>{normale ? normale.nome : "nessuna"}</b></span>
                <label style={{ ...btn(false), padding: "5px 10px", cursor: "pointer" }}>{normale ? "Cambia" : "Aggiungi la foto normale"}
                  <input type="file" accept=".jpg,.jpeg,image/jpeg" onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ""; if (!x) return; setNormali((v) => [...v.filter((n) => n.nome !== x.name), { nome: x.name, file: x, base: baseNome(x.name) }]); setAbbinate({ ...abbinate, [scelta]: x.name }); }} style={{ display: "none" }} aria-label="Foto normale" />
                </label>
                {normale && <button type="button" onClick={() => setAbbinate({ ...abbinate, [scelta]: "" })} style={{ ...btn(false), padding: "5px 10px" }}>Togli</button>}
              </div>
              {!normale && <span style={{ fontSize: 11.5, color: "#8b95a3" }}>La foto dello stesso scatto con «_W», «_Z» o «_V» nel nome: se la carichi insieme alle termiche si abbina da sola.</span>}
              {anteprimaNormale && <img src={anteprimaNormale} alt="Foto normale dello stesso scatto" style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 8, background: "#000" }} />}
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
              <button type="button" onClick={() => setReport({ ...report, aperto: !report.aperto, fatto: null, errore: "", cosa: { ...report.cosa, affiancate: !!normale && report.cosa.affiancate, misure: report.cosa.misure || !normale } })} style={btn(true)} data-apri-report>📄 Metti nel report</button>
              <button type="button" onClick={esporta} style={btn(false)}>⬇️ Scarica l'immagine</button>
              {lista.length > 0 && <button type="button" onClick={() => setMisure({ ...misure, [scelta]: [] })} style={btn(false)}>Togli le misure</button>}
            </div>
            {report.aperto && (
              <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10, borderColor: "#ff8c42" }} data-report>
                <div style={{ fontWeight: 700 }}>📄 Metti nel report</div>
                {!ispezioni.length ? (
                  <div style={{ fontSize: 12.5, color: "#c3cad4" }}>Non hai ancora ispezioni. Crea l'ispezione da «Nuova ispezione», poi torna qui e mettici le foto.</div>
                ) : (<>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#8b95a3" }}>In quale ispezione
                    <select value={report.ispezione} onChange={(e) => setReport({ ...report, ispezione: e.target.value, errore: "", fatto: null })} style={{ background: "#10141f", color: "#e7eaee", border: "1px solid #343e57", borderRadius: 6, padding: 7 }} aria-label="Ispezione">
                      <option value="">Scegli…</option>
                      {ispezioniOrdinate.map((i) => <option key={i.id} value={i.id}>{nomeIspezione(i)}</option>)}
                    </select>
                  </label>
                  <div style={{ fontSize: 12, color: "#8b95a3" }}>Cosa metto</div>
                  {[["misure", "Foto termica con le misure", true], ["pulita", "Foto termica senza segni", true], ["normale", "Foto normale", !!normale], ["affiancate", "Termica e normale affiancate", !!normale]].map(([k, testo, ok]) => (
                    <label key={k} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: ok ? "#e7eaee" : "#6b7480" }}>
                      <input type="checkbox" disabled={!ok} checked={ok && report.cosa[k]} onChange={(e) => setReport({ ...report, cosa: { ...report.cosa, [k]: e.target.checked }, errore: "", fatto: null })} />
                      {testo}{!ok && " (aggiungi prima la foto normale)"}
                    </label>
                  ))}
                  <div style={{ fontSize: 11.5, color: "#8b95a3", lineHeight: 1.5 }}>Sotto ogni foto scrivo i dati: {didascalia()}. Poi nell'ispezione puoi cambiarli e segnare le anomalie.</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button type="button" disabled={report.stato === "invio"} onClick={mettiNelReport} style={{ ...btn(true), opacity: report.stato === "invio" ? 0.6 : 1 }}>{report.stato === "invio" ? "Le metto…" : "Metti nel report"}</button>
                    <button type="button" onClick={() => setReport({ ...report, aperto: false })} style={btn(false)}>Chiudi</button>
                  </div>
                </>)}
                {report.errore && <div style={{ fontSize: 12.5, color: "#ffb877" }}>{report.errore}</div>}
                {report.fatto && (
                  <div style={{ fontSize: 13, color: "#4ade80", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }} data-report-fatto>
                    ✅ {report.fatto.n === 1 ? "1 foto messa" : `${report.fatto.n} foto messe`} nel report di {nomeIspezione(report.fatto.isp)}.
                    {onApriImpianto && <button type="button" onClick={() => onApriImpianto(report.fatto.isp.impianto_id)} style={{ ...btn(false), padding: "5px 10px" }}>Apri l'ispezione</button>}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        )}
        {!foto.length && <div style={{ ...scheda, fontSize: 13, color: "#c3cad4", lineHeight: 1.6 }}>Come il DJI Thermal Analysis Tool, ma nel telefono: <b>tocca un punto</b> e leggi la temperatura, <b>misura un'area</b> (massima, minima e media), <b>cambia palette</b> e scala, <b>evidenzia</b> quello che supera una soglia, correggi <b>emissività</b> e <b>temperatura riflessa</b>, poi mettila nel report (anche affiancata alla foto normale) o scaricala. Carica insieme anche le foto normali («_W», «_Z», «_V»): si abbinano da sole.</div>}
      </div>
    </div>
  );
}
