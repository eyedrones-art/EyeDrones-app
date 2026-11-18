// Telemetria sul video: il pilota sceglie il video DJI e il suo file .SRT (sottotitoli) e ottiene un nuovo video
// con quota, velocità, distanza, dati della camera e la traccia del volo disegnati sopra.
// Tutto avviene nel telefono o nel computer: il video non viene caricato da nessuna parte.
import { useEffect, useRef, useState } from "react";
import { Gauge } from "lucide-react";
import { TestataPagina } from "./VoloHero.jsx";

// --- lettura del file .SRT -------------------------------------------------------------------------
// I droni DJI scrivono un sottotitolo per fotogramma (o per secondo) con data, GPS, quota e camera.
// I formati cambiano da modello a modello: provo tutti quelli che conosco.
const numero = (testo, re) => { const m = testo.match(re); return m ? Number(m[1]) : null; };
const metriTra = (a, b) => {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

export function leggiTelemetriaSRT(testoGrezzo) {
  const testo = String(testoGrezzo || "").replace(/\r/g, "");
  const campioni = [];
  for (const blocco of testo.split(/\n\s*\n/)) {
    const tempo = blocco.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->/);
    if (!tempo) continue;
    const t = Number(tempo[1]) * 3600 + Number(tempo[2]) * 60 + Number(tempo[3]) + Number(tempo[4].padEnd(3, "0")) / 1000;
    const b = blocco.replace(/<[^>]+>/g, " ");
    let lat = numero(b, /latitude\s*[:=]\s*(-?\d+\.\d+)/i);
    let lon = numero(b, /longt?itude\s*[:=]\s*(-?\d+\.\d+)/i);
    if (lat == null) {
      const gps = b.match(/GPS\s*\(\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/i); // formato vecchio: GPS(lon, lat, …)
      if (gps) { lon = Number(gps[1]); lat = Number(gps[2]); }
    }
    if (lat != null && (Math.abs(lat) < 0.01 || Math.abs(lon || 0) < 0.01)) { lat = null; lon = null; } // GPS non ancora agganciato
    const alt = numero(b, /rel_alt\s*[:=]\s*(-?\d+(?:\.\d+)?)/i) ?? numero(b, /\bH\s*:?\s*(-?\d+(?:\.\d+)?)\s*m\b/) ?? numero(b, /BAROMETER\s*:\s*(-?\d+(?:\.\d+)?)/i) ?? numero(b, /\baltitude\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
    let fnum = numero(b, /fnum\s*[:=]\s*(\d+(?:\.\d+)?)/i);
    if (fnum != null && fnum > 50) fnum = fnum / 100; // alcuni modelli scrivono 280 per f/2.8
    const data = b.match(/(\d{4})[-.](\d{2})[-.](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    campioni.push({
      t, lat, lon, alt,
      vh: numero(b, /H\.S\s*:?\s*(-?\d+(?:\.\d+)?)\s*m\/s/i), // velocità orizzontale scritta dal drone (m/s)
      vv: numero(b, /V\.S\s*:?\s*(-?\d+(?:\.\d+)?)\s*m\/s/i), // velocità verticale (m/s)
      iso: numero(b, /\biso\s*[:=]?\s*(\d+)/i),
      otturatore: ((b.match(/shutter\s*[:=]\s*([\d./]+)/i) || b.match(/\bSS\s+([\d./]+)/) || [])[1] || "").replace(/\.0+$/, "") || null, // 1/800.0 → 1/800
      fnum,
      ev: (b.match(/\bev\s*[:=]\s*(-?[\d./]+)/i) || [])[1] ?? null,
      focale: numero(b, /focal_len\s*[:=]\s*(\d+(?:\.\d+)?)/i),
      data: data ? `${data[3]}/${data[2]}/${data[1]} ${data[4]}:${data[5]}:${data[6]}` : null,
    });
  }
  campioni.sort((a, b) => a.t - b.t);
  // valori calcolati: distanza dal decollo, velocità e salita/discesa (media sull'ultimo secondo)
  const casa = campioni.find((c) => c.lat != null);
  let j = 0;
  for (let i = 0; i < campioni.length; i++) {
    const c = campioni[i];
    c.dist = casa && c.lat != null ? metriTra(casa, c) : null;
    while (j < i && c.t - campioni[j].t > 1) j++;
    const p = campioni[j];
    const dt = c.t - p.t;
    if (c.vh == null && dt > 0.2 && c.lat != null && p.lat != null) c.vh = metriTra(p, c) / dt;
    if (c.vv == null && dt > 0.2 && c.alt != null && p.alt != null) c.vv = (c.alt - p.alt) / dt;
  }
  // un filo di media mobile sulla velocità, così i numeri non ballano
  for (let i = 0; i < campioni.length; i++) {
    const vicini = campioni.slice(Math.max(0, i - 4), i + 5).map((c) => c.vh).filter((v) => v != null);
    campioni[i].vhMedia = vicini.length ? vicini.reduce((s, v) => s + v, 0) / vicini.length : null;
  }
  return campioni;
}

// il campione da mostrare al secondo t del video
function campioneA(campioni, t) {
  let lo = 0, hi = campioni.length - 1, r = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (campioni[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  return { c: campioni[r], i: r };
}

// --- disegno della grafica sopra il fotogramma ------------------------------------------------------
function rettangolo(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const f0 = (n) => (n == null ? "—" : Math.round(n).toLocaleString("it-IT"));
const f1 = (n) => (n == null ? "—" : n.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function disegnaTelemetria(ctx, W, H, campioni, t, o) {
  if (!campioni.length) return;
  const { c, i } = campioneA(campioni, t);
  const u = Math.min(W, H) / 1080; // tutto in proporzione: uguale in 4K, 1080p o verticale
  const m = 40 * u;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  const font = (peso, px) => `${peso} ${Math.round(px * u)}px Inter, "Segoe UI", Roboto, Arial, sans-serif`;
  const ombra = () => { ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = 8 * u; };
  const niente = () => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; };

  // in alto: data e ora del volo
  if (o.data && c.data) {
    ctx.font = font(600, 30); ctx.fillStyle = "#fff"; ombra();
    ctx.fillText(c.data, m, m + 30 * u); niente();
  }
  // i numeri: quota, velocità, distanza, salita
  const voci = [
    o.quota && ["QUOTA", c.alt == null ? "—" : `${f0(c.alt)} m`],
    o.velocita && ["VELOCITÀ", c.vhMedia == null ? "—" : `${f0(c.vhMedia * 3.6)} km/h`],
    o.distanza && ["DISTANZA", c.dist == null ? "—" : c.dist >= 1000 ? `${f1(c.dist / 1000)} km` : `${f0(c.dist)} m`],
    o.salita && ["SALITA", c.vv == null ? "—" : `${c.vv > 0.2 ? "↑" : c.vv < -0.2 ? "↓" : ""} ${f1(Math.abs(c.vv))} m/s`],
  ].filter(Boolean);
  const cam = o.camera ? [c.iso && `ISO ${c.iso}`, c.otturatore && `${c.otturatore}${/\//.test(c.otturatore) ? "" : " s"}`, c.fnum && `f/${f1(c.fnum)}`, c.ev != null && `EV ${c.ev}`, c.focale && `${f0(c.focale)} mm`].filter(Boolean).join("  ·  ") : "";
  // ogni casella larga quanto serve (etichetta o numero, il più largo), con uno spazio fisso tra l'una e l'altra
  const larghezze = voci.map(([etichetta, valore]) => { ctx.font = font(700, 20); const a = ctx.measureText(etichetta).width; ctx.font = font(800, 46); return Math.max(a, ctx.measureText(valore).width, 130 * u) + 44 * u; });
  const altezzaNumeri = voci.length ? 112 * u : 0, altezzaCam = cam ? 46 * u : 0;
  if (voci.length || cam) {
    const w = Math.max(larghezze.reduce((t, x) => t + x, 0) + 4 * u, cam ? (ctx.font = font(600, 26), ctx.measureText(cam).width + 48 * u) : 0) + 4 * u;
    const h = altezzaNumeri + altezzaCam + 20 * u;
    const x = o.lato === "destra" ? W - m - w : m, y = H - m - h;
    rettangolo(ctx, x, y, w, h, 22 * u); ctx.fillStyle = "rgba(10,14,24,.58)"; ctx.fill();
    voci.forEach(([etichetta, valore], k) => {
      const cx = x + 24 * u + larghezze.slice(0, k).reduce((t, v) => t + v, 0);
      ctx.font = font(700, 20); ctx.fillStyle = "#ffb877"; ctx.fillText(etichetta, cx, y + 42 * u);
      ctx.font = font(800, 46); ctx.fillStyle = "#fff"; ctx.fillText(valore, cx, y + 94 * u);
    });
    if (cam) { ctx.font = font(600, 26); ctx.fillStyle = "#d5dae1"; ctx.fillText(cam, x + 24 * u, y + altezzaNumeri + 40 * u); }
  }
  // la traccia del volo (senza mappa): tutto il percorso in chiaro, la parte già fatta in arancione
  const conGps = o.traccia ? campioni.filter((s) => s.lat != null) : [];
  if (conGps.length > 2) {
    const lati = 230 * u, x0 = o.lato === "destra" ? m : W - m - lati, y0 = H - m - lati;
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const s of conGps) { minLat = Math.min(minLat, s.lat); maxLat = Math.max(maxLat, s.lat); minLon = Math.min(minLon, s.lon); maxLon = Math.max(maxLon, s.lon); }
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const span = Math.max((maxLon - minLon) * kx, maxLat - minLat) || 1e-6;
    const pad = 26 * u, area = lati - 2 * pad;
    const px = (s) => x0 + pad + (((s.lon - minLon) * kx) / span) * area + (area - ((maxLon - minLon) * kx / span) * area) / 2;
    const py = (s) => y0 + pad + ((maxLat - s.lat) / span) * area + (area - ((maxLat - minLat) / span) * area) / 2;
    rettangolo(ctx, x0, y0, lati, lati, 22 * u); ctx.fillStyle = "rgba(10,14,24,.58)"; ctx.fill();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); conGps.forEach((s, k) => (k ? ctx.lineTo(px(s), py(s)) : ctx.moveTo(px(s), py(s))));
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 4 * u; ctx.stroke();
    const fatti = conGps.filter((s) => s.t <= campioni[i].t);
    if (fatti.length > 1) {
      ctx.beginPath(); fatti.forEach((s, k) => (k ? ctx.lineTo(px(s), py(s)) : ctx.moveTo(px(s), py(s))));
      ctx.strokeStyle = "#ff8c42"; ctx.lineWidth = 6 * u; ctx.stroke();
    }
    const casa = conGps[0];
    ctx.fillStyle = "#fff"; ctx.font = font(800, 20); ctx.fillText("H", px(casa) - 6 * u, py(casa) + 7 * u);
    const qui = fatti[fatti.length - 1] || casa;
    ctx.beginPath(); ctx.arc(px(qui), py(qui), 10 * u, 0, Math.PI * 2); ctx.fillStyle = "#ff8c42"; ctx.fill();
    ctx.lineWidth = 4 * u; ctx.strokeStyle = "#fff"; ctx.stroke();
  }
  // il logo, piccolo, in alto a destra
  if (o.logo) {
    ctx.font = font(800, 28); ombra();
    const w1 = ctx.measureText("Eye").width, w2 = ctx.measureText("Drones").width;
    ctx.fillStyle = "#fff"; ctx.fillText("Eye", W - m - w1 - w2, m + 30 * u);
    ctx.fillStyle = "#ff8c42"; ctx.fillText("Drones", W - m - w2, m + 30 * u); niente();
  }
  ctx.restore();
}

// --- la pagina ----------------------------------------------------------------------------------------
const OPZIONI_BASE = { quota: true, velocita: true, distanza: true, salita: false, camera: false, traccia: true, data: false, logo: true, lato: "sinistra" };
const NOMI = [["quota", "Quota"], ["velocita", "Velocità"], ["distanza", "Distanza"], ["salita", "Salita/discesa"], ["camera", "Dati camera"], ["traccia", "Traccia del volo"], ["data", "Data e ora"], ["logo", "Logo EyeDrones"]];
const formatoRegistrazione = () => {
  if (typeof MediaRecorder === "undefined") return null;
  return ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || null;
};

export default function Telemetria() {
  const [video, setVideo] = useState(null); // { url, nome }
  const [campioni, setCampioni] = useState([]);
  const [nomeSrt, setNomeSrt] = useState("");
  const [o, setO] = useState(OPZIONI_BASE);
  const [errore, setErrore] = useState(null);
  const [esporto, setEsporto] = useState(null); // null | numero 0..1
  const [risultato, setRisultato] = useState(null); // { url, nome, blob }
  const vRef = useRef(null), cRef = useRef(null), recRef = useRef(null), oRef = useRef(o), campRef = useRef(campioni);
  oRef.current = o; campRef.current = campioni;

  // il ciclo di disegno: fotogramma del video + grafica, sia in anteprima sia durante l'esportazione
  useEffect(() => {
    const v = vRef.current, cv = cRef.current;
    if (!video || !v || !cv) return undefined;
    let fermo = false, idCb = null;
    const disegna = () => {
      if (fermo) return;
      const ctx = cv.getContext("2d");
      if (v.videoWidth) {
        if (cv.width !== CANVAS.w || cv.height !== CANVAS.h) { cv.width = CANVAS.w; cv.height = CANVAS.h; }
        ctx.drawImage(v, 0, 0, cv.width, cv.height);
        disegnaTelemetria(ctx, cv.width, cv.height, campRef.current, v.currentTime, oRef.current);
        if (recRef.current && v.duration) setEsporto(Math.min(1, v.currentTime / v.duration));
      }
      idCb = v.requestVideoFrameCallback ? v.requestVideoFrameCallback(disegna) : requestAnimationFrame(disegna);
    };
    const CANVAS = { w: 0, h: 0 };
    const misura = () => {
      const lungo = Math.max(v.videoWidth, v.videoHeight), k = lungo > 1920 ? 1920 / lungo : 1;
      CANVAS.w = Math.round((v.videoWidth * k) / 2) * 2; CANVAS.h = Math.round((v.videoHeight * k) / 2) * 2;
      disegnaFermo();
    };
    // a video fermo requestVideoFrameCallback non scatta: ridisegno a mano (anche quando cambio le opzioni)
    const disegnaFermo = () => {
      if (!v.videoWidth) return;
      if (cv.width !== CANVAS.w || cv.height !== CANVAS.h) { cv.width = CANVAS.w; cv.height = CANVAS.h; }
      const ctx = cv.getContext("2d");
      ctx.drawImage(v, 0, 0, cv.width, cv.height);
      disegnaTelemetria(ctx, cv.width, cv.height, campRef.current, v.currentTime, oRef.current);
    };
    v.addEventListener("loadeddata", misura);
    v.addEventListener("seeked", disegnaFermo);
    if (v.readyState >= 2) misura();
    disegna();
    cv._ridisegna = disegnaFermo;
    return () => {
      fermo = true;
      v.removeEventListener("loadeddata", misura); v.removeEventListener("seeked", disegnaFermo);
      if (idCb != null) { if (v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(idCb); else cancelAnimationFrame(idCb); }
    };
  }, [video]);
  useEffect(() => { cRef.current?._ridisegna?.(); }, [o, campioni]);
  useEffect(() => () => { if (video) URL.revokeObjectURL(video.url); }, [video]);
  useEffect(() => () => { if (risultato) URL.revokeObjectURL(risultato.url); }, [risultato]);

  const scegli = async (e) => {
    const file = [...(e.target.files || [])];
    e.target.value = "";
    if (!file.length) return;
    setErrore(null); setRisultato(null);
    const vid = file.find((f) => /^video\//.test(f.type) || /\.(mp4|mov)$/i.test(f.name));
    const radice = (n) => n.replace(/\.[^.]+$/, "").toLowerCase();
    const srts = file.filter((f) => /\.srt$/i.test(f.name));
    const srt = (vid && srts.find((f) => radice(f.name) === radice(vid.name))) || srts[0];
    if (vid) setVideo({ url: URL.createObjectURL(vid), nome: vid.name });
    if (srt) {
      const c = leggiTelemetriaSRT(await srt.text());
      if (!c.length) { setErrore("In questo file .SRT non trovo i dati di volo. Scegli il file .SRT che ha lo stesso nome del video."); setCampioni([]); setNomeSrt(""); }
      else { setCampioni(c); setNomeSrt(srt.name); }
    }
    if (!vid && !srt) setErrore("Scegli il video (.MP4) e il suo file .SRT.");
  };

  const esporta = async () => {
    const v = vRef.current, cv = cRef.current, tipo = formatoRegistrazione();
    if (!v || !cv || !cv.captureStream || !tipo) { setErrore("Questo browser non riesce a creare il video. Prova con Chrome aggiornato."); return; }
    setErrore(null); setRisultato(null);
    const pezzi = [];
    const rec = new MediaRecorder(cv.captureStream(30), { mimeType: tipo, videoBitsPerSecond: 12_000_000 });
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) pezzi.push(ev.data); };
    const finito = new Promise((ok) => { rec.onstop = ok; });
    v.pause(); v.currentTime = 0;
    await new Promise((ok) => { const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); setTimeout(ok, 800); });
    recRef.current = rec; setEsporto(0);
    rec.start(500);
    v.muted = true; v.playbackRate = 1;
    const fine = () => { if (rec.state !== "inactive") rec.stop(); };
    v.addEventListener("ended", fine, { once: true });
    try { await v.play(); } catch { fine(); }
    await finito;
    v.removeEventListener("ended", fine);
    recRef.current = null;
    if (!pezzi.length || v.currentTime < Math.min(1, v.duration * 0.5)) { setEsporto(null); if (!pezzi.length) setErrore("Il video non è stato creato. Tieni la pagina aperta fino alla fine."); return; }
    const blob = new Blob(pezzi, { type: tipo.split(";")[0] });
    const est = tipo.startsWith("video/mp4") ? "mp4" : "webm";
    setRisultato({ url: URL.createObjectURL(blob), nome: `${video.nome.replace(/\.[^.]+$/, "")}-telemetria.${est}`, blob });
    setEsporto(null);
  };
  const annulla = () => { const v = vRef.current; recRef.current?.stop(); v?.pause(); setEsporto(null); };
  const condividi = async () => {
    try {
      const f = new File([risultato.blob], risultato.nome, { type: risultato.blob.type });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: "Video con telemetria" });
    } catch { /* condivisione annullata */ }
  };

  const st = { scheda: { background: "#151b2b", border: "1px solid #2a3349", borderRadius: 12, padding: 16, display: "grid", gap: 12 }, bott: { background: "#ff8c42", color: "#10141f", border: "none", borderRadius: 8, padding: "11px 16px", fontSize: 14.5, fontWeight: 800, minHeight: 44, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" } };
  const pronto = video && campioni.length > 0;
  return (
    <div style={{ maxWidth: 900, display: "grid", gap: 16 }}>
      <TestataPagina titolo="Telemetria sul video" sigla="SRT · QUOTA, VELOCITÀ E TRACCIA SUL VIDEO" icona={Gauge} info="Scegli il video del drone e il suo file .SRT: esce un nuovo video con quota, velocità, distanza e traccia del volo disegnate sopra. Tutto resta nel tuo telefono o computer." />

      <div style={st.scheda}>
        <div style={{ fontSize: 14, color: "#c3cad4", lineHeight: 1.55 }}>
          <b style={{ color: "#e7eaee" }}>1.</b> In DJI Fly attiva <b style={{ color: "#e7eaee" }}>«Sottotitoli video»</b> (impostazioni della fotocamera): insieme a ogni video il drone salva un file <b>.SRT</b> con lo stesso nome.<br />
          <b style={{ color: "#e7eaee" }}>2.</b> Scegli qui il video <b>e</b> il suo file .SRT (anche tutti e due insieme).
        </div>
        <label style={{ ...st.bott, width: "fit-content" }}>
          🎬 Scegli video e file .SRT
          <input type="file" multiple accept="video/mp4,video/quicktime,.mp4,.MP4,.mov,.MOV,.srt,.SRT" onChange={scegli} style={{ display: "none" }} />
        </label>
        <div style={{ fontSize: 13, color: "#8b95a3", display: "grid", gap: 2 }}>
          <span>{video ? `✓ Video: ${video.nome}` : "Video: non ancora scelto"}</span>
          <span>{nomeSrt ? `✓ Telemetria: ${nomeSrt} · ${campioni.length} punti${campioni.some((c) => c.lat != null) ? " · con GPS" : " · senza GPS"}` : "File .SRT: non ancora scelto"}</span>
        </div>
        {errore && <div role="alert" style={{ fontSize: 13.5, color: "#ff9c9c" }}>{errore}</div>}
      </div>

      {video && (
        <div style={st.scheda}>
          <canvas ref={cRef} style={{ width: "100%", height: "auto", borderRadius: 10, background: "#000", display: "block" }} />
          <video ref={vRef} src={video.url} playsInline muted preload="auto" controls={!esporto && esporto !== 0}
            onError={() => setErrore("Il browser non riesce ad aprire questo video. Se è in H.265 (HEVC), in DJI Fly scegli H.264 oppure convertilo prima.")}
            style={{ width: "100%", maxHeight: 60, background: "#000", borderRadius: 8 }} />
          {!pronto && <div style={{ fontSize: 13.5, color: "#ffb877" }}>Manca il file .SRT: senza, non ci sono dati da mostrare.</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {NOMI.map(([k, nome]) => (
              <button key={k} type="button" aria-pressed={o[k]} onClick={() => setO({ ...o, [k]: !o[k] })}
                style={{ background: o[k] ? "#ff8c4222" : "none", border: `1px solid ${o[k] ? "#ff8c42" : "#343e57"}`, color: o[k] ? "#ffb48f" : "#c3cad4", borderRadius: 14, padding: "6px 11px", fontSize: 12.5 }}>{o[k] ? "✓ " : ""}{nome}</button>
            ))}
            <button type="button" onClick={() => setO({ ...o, lato: o.lato === "destra" ? "sinistra" : "destra" })}
              style={{ background: "none", border: "1px solid #343e57", color: "#c3cad4", borderRadius: 14, padding: "6px 11px", fontSize: 12.5 }}>⇄ Numeri a {o.lato === "destra" ? "destra" : "sinistra"}</button>
          </div>
          {esporto != null ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ height: 10, borderRadius: 5, background: "#232b3f", overflow: "hidden" }}><div style={{ width: `${Math.round(esporto * 100)}%`, height: "100%", background: "#ff8c42" }} /></div>
              <div style={{ fontSize: 13, color: "#c3cad4" }}>Creo il video… {Math.round(esporto * 100)}% · tieni la pagina aperta e lo schermo acceso: ci vuole quanto dura il video.</div>
              <button type="button" onClick={annulla} style={{ ...st.bott, background: "#232b3f", color: "#e7eaee", width: "fit-content" }}>Annulla</button>
            </div>
          ) : (
            <button type="button" disabled={!pronto} onClick={esporta} style={{ ...st.bott, opacity: pronto ? 1 : 0.5, width: "fit-content" }}>⬇️ Crea il video con la telemetria</button>
          )}
          {risultato && (
            <div style={{ background: "#14231a", border: "1px solid #4ade8077", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#4ade80" }}>✓ Video pronto</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={risultato.url} download={risultato.nome} style={st.bott}>Scarica il video</a>
                {typeof navigator !== "undefined" && navigator.canShare && <button type="button" onClick={condividi} style={{ ...st.bott, background: "#232b3f", color: "#e7eaee" }}>Condividi</button>}
              </div>
              {/\.webm$/.test(risultato.nome) && <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Il file è in formato WebM: Instagram, YouTube e i programmi di montaggio lo aprono. Se un programma non lo apre, convertilo in MP4.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
