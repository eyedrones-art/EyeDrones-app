import React, { useState, useRef, useEffect } from "react";
import { LayoutDashboard, Zap, Plus, Camera, FileDown, ChevronRight, X, MapPin, TrendingUp, Sun, Settings, Upload, Loader2, FileText, ShieldCheck, Award, Plane, Thermometer, LogOut, BookOpen, BatteryCharging, CalendarDays, MoreHorizontal } from "lucide-react";
import { jsPDF } from "jspdf";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const LOGO_EYEDRONES = "data:image/png;base64,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9mVaKB+cCYZhmFiDtE80gVkAGYaJRTJFJ2huAjMME3MI7bNJksQCyDBMzCG0T3iA3ARmGCbmENpn4zqADMPEIkL7bGAYholRWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWAAZholZWACZkJESl06PDKTEpyPekgirJY4eNsSJpWSDzb20el+L6ant8hjGHKOw00NZql/Tc7tjDMP2QfSP9qB/pFdZMkwoYAFkfBJnTURmQj4yEnLokYd0WqbFZyGZhC6VhE4shdgpoheXBiFmbiT3cwnKemWhsrufS5J6vfF9vuz9o04hdIqic9lH4tg70oXu4XZ0D3Wga7gDnUNtGLEPg2HMkLLzSmUwMUtJ2nwUpc5DbnIJMhPzkR4vxC6XxC4XibZkyLKDREjIjqyIkSw7l1CW0pTaoX4f1J/Tf49TIs3sYjliHyIxJFFUBLEdXfRo6W9EfW8NznVXg4ldWABjBCFss0joZqXOIcGbi6K0echLLoVFssLrWRGSrKiJuec1CbvkejlBO1x2SdJ6kdI4dtPvBzyfc8h2NPc1KGJY11OD+p5a1NHznuFuMDMfFsAZSKItFbMzlqEsfbHyKE1fiCRap/G84PK8ZB+emctu9LSE6IgVobV73uey+9w/l+g5PcLJ2833D9Sk7kNt9xmc7jyJmq4zONVxAoNjA2BmFiyAUY7w4IpSq0joltBjEcoyliA3qdhldV/08L52LQO1u107w+cMdj+eWQB2T0wQvvZPZ1eJ1mTsPvfPxN7S34zqrlM403ka1fQ4R96ig5rwTPTCAhiFFKbMwbysdZiXsw4VGSuQQMkKr8fjx/MKwO6JyZl5TtNoj8TjG3EM43jbURxpO4zDrYfR2NsAJrpgAYwCUuKyUJW9AfOy1ynCJ7KxZp6S+mJ1B8XMPSIfdrOYnur7p8buLxustcsGD3X8bLPePpntj2fvHOxQhPBI6xEcaj1EWek+MJENC2AEYrPEozJzFYndehK9tUryQh+j0mZFJR8xrtDb1SLkFV3JsH9Gu8szC9Bu3L4qWzyeXX0zCNJunm3W7V8AdvF9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";
// inizio del logo precedente (stemma con ali): chi lo aveva salvato come logo azienda passa automaticamente al nuovo
const LOGO_PRECEDENTE_PREFISSO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAUAAAAFACAYAAADNkKWqAADN0ElEQVR42uz9V5ccV5YmCn77mLl7aB2BENBaEwRAkAS11kkmmU";

const SUPPORT_EMAIL = "eyedrones@libero.it";

function formatData(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

// converte l'URL remoto di una foto salvata in una dataURL utilizzabile dal PDF
async function urlToDataUrl(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// carica un'immagine da dataUrl e restituisce l'oggetto Image pronto (per ritagliarne pezzi con canvas)
function caricaImmagine(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ritaglia un primo piano quadrato attorno al punto (xPercent, yPercent) di un'immagine già caricata
// checklist di base pre-volo, personalizzabile da ogni pilota
// risorse consigliate a TUTTI i piloti che usano l'app — link di affiliazione/partnership,
// diversi da quelli personali che ogni utente può salvare nei propri attestati.
// aggiorna qui gli URL quando sono pronti i link di affiliazione veri.
// stesso principio di RISORSE_CONSIGLIATE, ma per corsi di formazione (es. il corso di Andrea Pinotti, o altri): {nome, descrizione, url}
const CORSI_CONSIGLIATI = [
];

const OBIETTIVI_FORMATIVI = [
  { key: "", label: "Nessun obiettivo particolare al momento" },
  { key: "a2", label: "Passare da Open A1/A3 a Open A2" },
  { key: "sts", label: "Ottenere gli attestati per gli scenari Specific (STS)" },
  { key: "termografia", label: "Certificazione termografica (Livello 1 o 2)" },
  { key: "altro", label: "Altro" },
];

const RISORSE_CONSIGLIATE = [
  // esempio (da riempire quando pronto):
  // { nome: "Assicurazione RC drone — Coverdrone", url: "https://www.coverdrone.com/it/?ref=IL_TUO_CODICE", descrizione: "Polizza RC obbligatoria per uso professionale." },
  // { nome: "Corso A2 online", url: "https://...", descrizione: "Prepara l'esame A2 e sostienilo online." },
];

const CHECKLIST_DEFAULT = [
  "Batteria drone carica",
  "Batteria radiocomando/schermo carica",
  "Schede di memoria libere e funzionanti",
  "Eliche/rotori controllati visivamente",
  "GPS agganciato correttamente",
  "Area di volo verificata su D-Flight",
  "Permessi/autorizzazioni necessarie ottenute",
  "Meteo verificato (vento, pioggia, visibilità)",
  "Assicurazione RC in corso di validità",
  "Zona di atterraggio di emergenza individuata",
];

// recupera il meteo in tempo reale per una zona (servizio pubblico gratuito, nessuna chiave richiesta)
// ---- Piani e limiti -----------------------------------------------------------
// Free: tutto funziona ma con quantità limitate. Pilota toglie i limiti di quantità. Pro aggiunge gli strumenti di lavoro.
const LIMITI_FREE = { voli: 15, batterie: 2, reportMese: 4 };
// Link di pagamento Stripe (Payment Link): quando li crei su Stripe, incollali qui e i pulsanti "Passa a..." li useranno.
const LINK_PAGAMENTO = { pilota: { mese: "", anno: "" }, pro: { mese: "", anno: "" } };
// prezzi in euro: cambiali solo qui, la pagina Abbonamento calcola da sola "al mese" e "mesi gratis"
const PREZZI_PIANO = { pilota: { mese: 5.9, anno: 59 }, pro: { mese: 9.9, anno: 89 } };
const euro = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const mesiGratisAnnuale = (chiave) => Math.round(12 - PREZZI_PIANO[chiave].anno / PREZZI_PIANO[chiave].mese);
const NOME_PIANO = { free: "Free", pilota: "Pilota", pro: "Pro" };
const ORDINE_PIANO = { free: 0, pilota: 1, pro: 2 };
const COLORE_PIANO = { free: "#f5b942", pilota: "#3d8bfd", pro: "#4ade80" };

// legge "45.0703, 7.6869" (anche con la virgola decimale) e restituisce { lat, lon } oppure null
function leggiCoordinate(testo) {
  const m = String(testo || "").trim().match(/^(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)$/);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(",", "."));
  const lon = parseFloat(m[2].replace(",", "."));
  if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

// semaforo meteo: il limite di vento può essere quello del drone scelto (30 km/h se non indicato)
function valutaGiorno(g, limiteVento = 30) {
  return g.ventoMax < limiteVento && g.raffiche < Math.round(limiteVento * 1.5) && g.pioggia < 1;
}

// istante (Date) in cui il sole raggiunge l'altezza indicata (gradi) il giorno dato, al mattino o alla sera.
// formula astronomica standard (equazione dell'alba), precisa a 1-2 minuti: nessun servizio esterno.
// restituisce null se quel giorno il sole non arriva a quell'altezza (es. estate/inverno polare)
function istanteSole(dataIso, lat, lon, altezza, mattina) {
  const rad = Math.PI / 180;
  const [a, m, g] = dataIso.split("-").map(Number);
  const n = Math.round(Date.UTC(a, m - 1, g, 12) / 86400000 + 2440587.5 - 2451545.0);
  const jStar = n + 0.0009 - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransito = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinDecl = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosDecl = Math.cos(Math.asin(sinDecl));
  const cosOmega = (Math.sin(altezza * rad) - Math.sin(lat * rad) * sinDecl) / (Math.cos(lat * rad) * cosDecl);
  if (cosOmega < -1 || cosOmega > 1) return null;
  const omega = Math.acos(cosOmega) / rad;
  const j = mattina ? jTransito - omega / 360 : jTransito + omega / 360;
  return new Date((j - 2440587.5) * 86400000);
}

// orari di luce utili per le riprese: alba, tramonto, ora d'oro (sole tra -4° e +6°) e ora blu (tra -6° e -4°)
function calcolaLuce(dataIso, lat, lon) {
  const t = (alt, mattina) => istanteSole(dataIso, lat, lon, alt, mattina);
  return {
    alba: t(-0.833, true),
    tramonto: t(-0.833, false),
    oraBluMattina: [t(-6, true), t(-4, true)],
    oraOroMattina: [t(-4, true), t(6, true)],
    oraOroSera: [t(6, false), t(-4, false)],
    oraBluSera: [t(-4, false), t(-6, false)],
  };
}

// ora locale del luogo del volo (non del telefono), es. "18:42"
function formattaOraLuogo(d, timeZone) {
  if (!d) return "—";
  try {
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone });
  } catch (e) {
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }
}

async function recuperaMeteo(zona) {
  let latitude, longitude, name;
  if (zona && typeof zona === "object") {
    latitude = zona.lat; longitude = zona.lon; name = zona.nome;
  } else {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zona)}&count=1&language=it`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) throw new Error("Località non trovata: controlla il nome, oppure scrivi le coordinate (es. 45.0703, 7.6869).");
    ({ latitude, longitude, name } = geoData.results[0]);
  }
  const meteoRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,weather_code&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max,precipitation_sum,precipitation_probability_max&forecast_days=16&timezone=auto`);
  const meteoData = await meteoRes.json();

  // per ogni giorno, indico se le condizioni sembrano adatte al volo (vento e pioggia entro soglie ragionevoli)
  const prossimiGiorni = (meteoData.daily?.time || []).map((data, i) => {
    const ventoMax = meteoData.daily.wind_speed_10m_max[i];
    const raffiche = meteoData.daily.wind_gusts_10m_max[i];
    const pioggia = meteoData.daily.precipitation_sum[i];
    const probPioggia = meteoData.daily.precipitation_probability_max?.[i] ?? null;
    const adatto = ventoMax < 30 && raffiche < 45 && pioggia < 1;
    return {
      data,
      tMax: meteoData.daily.temperature_2m_max[i],
      tMin: meteoData.daily.temperature_2m_min[i],
      ventoMax, raffiche, pioggia, probPioggia, adatto,
    };
  });

  return { nomeLocalita: name, ...meteoData.current, prossimiGiorni, lat: latitude, lon: longitude, fusoOrario: meteoData.timezone };
}

// recupera l'indice geomagnetico planetario Kp, attuale e previsto nei prossimi giorni (servizio pubblico NOAA, nessuna chiave richiesta)
async function recuperaMeteoSpaziale() {
  const descriviKp = (kp) => {
    if (kp < 5) return { livello: "tranquilla", colore: "#4ade80", testo: "Attività geomagnetica nella norma." };
    if (kp < 6) return { livello: "minore", colore: "#f5b942", testo: "Tempesta geomagnetica minore — possibile lieve degrado del GPS." };
    if (kp < 7) return { livello: "moderata", colore: "#ff8c42", testo: "Tempesta geomagnetica moderata — valutare cautela extra con il GPS." };
    return { livello: "forte", colore: "#ff4d4d", testo: "Tempesta geomagnetica forte — possibile perdita di precisione GPS, valutare rinvio del volo." };
  };

  const res = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json");
  const data = await res.json();
  const ultimo = data[data.length - 1];
  const kp = parseFloat(ultimo[1]);
  const attuale = { kp, orario: ultimo[0], ...descriviKp(kp) };

  // previsione sui prossimi giorni: raggruppo i valori previsti per data e prendo il picco massimo di ciascun giorno
  let previsioneGiorni = [];
  try {
    const resPrev = await fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json");
    const dataPrev = await resPrev.json();
    const righe = dataPrev.slice(1); // la prima riga è l'intestazione delle colonne
    const perGiorno = {};
    righe.forEach((r) => {
      const giorno = String(r[0]).slice(0, 10);
      const valoreKp = parseFloat(r[1]);
      if (isNaN(valoreKp)) return;
      if (!perGiorno[giorno] || valoreKp > perGiorno[giorno]) perGiorno[giorno] = valoreKp;
    });
    previsioneGiorni = Object.entries(perGiorno).slice(0, 3).map(([giorno, kpMax]) => ({ giorno, kpMax, ...descriviKp(kpMax) }));
  } catch (e) { /* se la previsione non si carica, resta comunque il dato attuale */ }

  return { ...attuale, previsioneGiorni };
}

function ritagliaZona(img, xPercent, yPercent, dimensionePercentuale = 30) {
  const lato = Math.round(Math.min(img.naturalWidth, img.naturalHeight) * (dimensionePercentuale / 100));
  let sx = Math.round((xPercent / 100) * img.naturalWidth - lato / 2);
  let sy = Math.round((yPercent / 100) * img.naturalHeight - lato / 2);
  sx = Math.max(0, Math.min(sx, img.naturalWidth - lato));
  sy = Math.max(0, Math.min(sy, img.naturalHeight - lato));

  const risoluzione = 700; // più alta di prima, per reggere lo zoom nel lettore PDF senza sgranarsi
  const canvas = document.createElement("canvas");
  canvas.width = risoluzione;
  canvas.height = risoluzione;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, lato, lato, 0, 0, risoluzione, risoluzione);
  return canvas.toDataURL("image/png");
}

// analizza i colori di una foto termica già colorata (ironbow/rainbow) e suggerisce le zone più "calde"
// non è vera intelligenza artificiale: è un'analisi statistica dei colori, pensata come suggerimento da confermare, non come diagnosi automatica
function rilevaPuntiCaldi(img, maxSuggerimenti = 8) {
  const scala = Math.min(1, 300 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scala));
  const h = Math.max(1, Math.round(img.naturalHeight * scala));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h).data;

  // punteggio di "calore" per pixel: privilegia rosso/giallo (caldo), penalizza il blu (freddo) — tipico delle palette ironbow/rainbow
  const heat = new Float32Array(w * h);
  let somma = 0;
  for (let i = 0; i < w * h; i++) {
    const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
    const punteggio = r * 0.6 + g * 0.3 - b * 0.4;
    heat[i] = punteggio;
    somma += punteggio;
  }
  const media = somma / (w * h);
  let sqDiff = 0;
  for (let i = 0; i < w * h; i++) sqDiff += (heat[i] - media) ** 2;
  const dev = Math.sqrt(sqDiff / (w * h));
  const soglia = media + dev * 1.6;

  const visitato = new Uint8Array(w * h);
  const blob = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (visitato[idx] || heat[idx] < soglia) continue;
      const stack = [idx];
      visitato[idx] = 1;
      let sx = 0, sy = 0, count = 0, picco = heat[idx];
      while (stack.length) {
        const cur = stack.pop();
        const cx = cur % w, cy = Math.floor(cur / w);
        sx += cx; sy += cy; count++;
        if (heat[cur] > picco) picco = heat[cur];
        const vicini = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
        for (const [nx, ny] of vicini) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nidx = ny * w + nx;
          if (!visitato[nidx] && heat[nidx] >= soglia) {
            visitato[nidx] = 1;
            stack.push(nidx);
          }
        }
      }
      // scarto rumore troppo piccolo e falsi positivi troppo grandi (es. l'intera foto molto chiara)
      if (count >= 3 && count <= w * h * 0.12) {
        blob.push({ x: (sx / count / w) * 100, y: (sy / count / h) * 100, intensita: picco });
      }
    }
  }

  blob.sort((a, b) => b.intensita - a.intensita);
  return blob.slice(0, maxSuggerimenti);
}

// genera i primi piani di tutte le anomalie di un report, raggruppando per foto per non ricaricare l'immagine più volte
async function generaRitagliAnomalie(fotoConDataUrl, anomalieList) {
  const ritagli = new Map();
  for (const f of fotoConDataUrl) {
    const anomalieFoto = anomalieList.filter((a) => a.fotoId === f.id);
    if (anomalieFoto.length === 0) continue;
    try {
      const img = await caricaImmagine(f.dataUrl);
      anomalieFoto.forEach((a) => {
        ritagli.set(a.id, ritagliaZona(img, a.x, a.y));
      });
    } catch (e) { /* se una foto non si carica, semplicemente niente primo piano per quelle anomalie */ }
  }
  return ritagli;
}

// costruisce il documento PDF del report, condiviso tra nuova ispezione e visualizzazione di un report salvato
function costruisciPDF({ azienda, impianto, dati, fotoConDataUrl, anomalieList, piano, ritagli, tipoIspezione }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const oranje = [255, 140, 66];
  const grigio = [110, 120, 130];
  let y = 20;

  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", (210 - 26) / 2, 10, 26, 16, undefined, "FAST"); } catch (e) {}
    y = 34;
  }

  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text("Report ispezione termografica", 15, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(...grigio);
  doc.text(`${azienda.nome} — ispezioni con drone e termocamera`, 15, y);
  y += 12;

  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const righe = [
    ["Impianto", `${impianto?.nome}`],
    ["Località", impianto?.zona],
    ...(impianto?.kwp ? [["Potenza installata", `${impianto?.kwp} kWp`]] : []),
    ["Cliente", impianto?.cliente],
    ["Data ispezione", dati.dataFormattata],
    ["Ora ispezione", dati.ora || "—"],
    ["Eseguita da", dati.operatore || "—"],
    ["Coordinate GPS", dati.coordinateGps || "—"],
    ...(tipoIspezione === "fotovoltaico" ? [["Irraggiamento solare", dati.irraggiamento ? `${dati.irraggiamento} W/m²` : "—"]] : []),
    ...(tipoIspezione === "danni" && anomalieList.length === 0 ? [] : [["Anomalie rilevate", String(anomalieList.length)]]),
    ...(tipoIspezione !== "danni" ? [["Prossimo controllo", dati.prossimoControlloFormattato || "—"]] : []),
  ];
  righe.forEach(([label, val]) => {
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    doc.text(String(val), 70, y);
    y += 7;
  });

  y += 6;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 10;

  const disegnaAnomalia = (a, numero, fotoNumero) => {
    const info = TUTTE_LE_CATEGORIE.find((c) => c.key === a.categoria);
    const sev = SEVERITY.find((s) => s.key === a.gravita);
    const ritaglio = ritagli && ritagli.get ? ritagli.get(a.id) : null;
    const latoImg = 75; // grande e a piena larghezza, sopra il testo
    const xTesto = 15;
    const larghezzaTesto = 180;
    const altezzaBlocco = ritaglio ? latoImg + 8 : 0;
    if (y + altezzaBlocco > (ritaglio ? 250 : 265)) { doc.addPage(); y = 20; }

    if (ritaglio) {
      const xImg = 15 + (180 - latoImg) / 2; // centrato orizzontalmente
      try { doc.addImage(ritaglio, "PNG", xImg, y - 5, latoImg, latoImg); } catch (e) {}
      doc.setDrawColor(220, 220, 220);
      doc.rect(xImg, y - 5, latoImg, latoImg);
      const hex = sev.color.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
      doc.setFillColor(r, g, b);
      doc.circle(xImg + 7, y - 5 + 7, 5, "F");
      doc.setFontSize(10);
      doc.setFont(undefined, "bold");
      doc.setTextColor(22, 26, 31);
      doc.text(String(numero), xImg + 7, y - 5 + 8.5, { align: "center" });
      doc.setFont(undefined, "normal");
      if (fotoNumero) {
        doc.setFillColor(0, 0, 0);
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(`Foto ${fotoNumero}`, xImg + latoImg - 3, y - 5 + 6, { align: "right" });
      }
      y += latoImg + 8;
    } else {
      doc.setFillColor(...oranje);
      doc.circle(17, y - 1.5, 1.4, "F");
    }

    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);
    doc.text(`${fotoNumero ? `Foto ${fotoNumero} — ` : ""}${numero}. ${a.categoria}`, xTesto, y);
    doc.setFontSize(9);
    doc.setTextColor(sev.color === "#ff4d4d" ? 220 : 150, 90, 60);
    doc.text(`[${sev.label.toUpperCase()}]`, xTesto + larghezzaTesto - 30, y);
    y += 6;

    doc.setFontSize(9.5);
    doc.setTextColor(...grigio);
    const descLines = doc.splitTextToSize(info.descrizione, larghezzaTesto);
    doc.text(descLines, xTesto, y);
    y += descLines.length * 4.5 + 2;

    doc.setTextColor(...oranje);
    const azLines = doc.splitTextToSize(`Azione consigliata: ${info.azione}`, larghezzaTesto);
    doc.text(azLines, xTesto, y);
    y += azLines.length * 4.5 + 8;
  };

  fotoConDataUrl.forEach((f, idx) => {
    const imgW = 170;
    const imgH = imgW * (300 / 480);
    if (y + 7 + imgH > 280) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text(fotoConDataUrl.length > 1 ? `${tipoIspezione === "danni" ? "Foto" : "Foto termica"} ${idx + 1}` : (tipoIspezione === "danni" ? "Foto" : "Foto termica"), 15, y);
    y += 7;
    try {
      doc.addImage(f.dataUrl, "PNG", 15, y, imgW, imgH);
      anomalieList.filter((a) => a.fotoId === f.id).forEach((a, i) => {
        const sev = SEVERITY.find((s) => s.key === a.gravita);
        const hex = sev.color.replace("#", "");
        const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
        const cx = 15 + (a.x / 100) * imgW;
        const cy = y + (a.y / 100) * imgH;
        // anello piccolo e vuoto esattamente sul punto, così non copre il dettaglio della foto sotto
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.9);
        doc.circle(cx, cy, 1.4, "D");
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.4);
        doc.circle(cx, cy, 1.4, "D");
        // il numero va in un'etichetta spostata di lato, non sopra al punto stesso
        const ex = cx + 3.5, ey = cy - 3.5;
        doc.setFillColor(r, g, b);
        doc.circle(ex, ey, 2.4, "F");
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(0.3);
        doc.line(cx, cy, ex, ey);
        doc.circle(ex, ey, 2.4, "D");
        doc.setFontSize(7);
        doc.setFont(undefined, "bold");
        doc.setTextColor(22, 26, 31);
        doc.text(String(i + 1), ex, ey + 0.8, { align: "center" });
        doc.setFont(undefined, "normal");
      });
    } catch (e) {}
    y += imgH + 4;

    if (f.didascalia) {
      doc.setFontSize(9.5);
      doc.setFont(undefined, "italic");
      doc.setTextColor(...grigio);
      const righeDidascalia = doc.splitTextToSize(f.didascalia, 170);
      doc.text(righeDidascalia, 15, y);
      doc.setFont(undefined, "normal");
      y += righeDidascalia.length * 4.5 + 4;
    }
    y += 6;

    const anomalieFoto = anomalieList.filter((a) => a.fotoId === f.id);
    if (anomalieFoto.length > 0) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFontSize(11.5);
      doc.setTextColor(20, 20, 20);
      doc.text("Anomalie rilevate in questa foto", 15, y);
      y += 8;
      anomalieFoto.forEach((a, i) => {
        disegnaAnomalia(a, i + 1, fotoConDataUrl.length > 1 ? idx + 1 : null);
      });
    }
  });

  const anomalieSenzaFoto = anomalieList.filter((a) => !fotoConDataUrl.some((f) => f.id === a.fotoId));
  if (anomalieSenzaFoto.length > 0) {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Altre anomalie", 15, y);
    y += 9;
    anomalieSenzaFoto.forEach((a, i) => {
      disegnaAnomalia(a, i + 1);
    });
  }

  if (anomalieList.length === 0 && tipoIspezione !== "danni") {
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Anomalie e raccomandazioni", 15, y);
    y += 9;
    doc.setFontSize(10.5);
    doc.setTextColor(...grigio);
    doc.text("Nessuna anomalia rilevata durante l'ispezione.", 15, y);
    y += 7;
  }

  if (dati.note) {
    doc.setFontSize(10);
    const noteLines = doc.splitTextToSize(dati.note, 170);
    if (y + 7 + noteLines.length * 4.5 > 280) { doc.addPage(); y = 20; }
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Note", 15, y);
    y += 7;
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text(noteLines, 15, y);
    y += noteLines.length * 4.5 + 10;
  }

  if (piano !== "pro") {
    doc.setFontSize(8);
    doc.setTextColor(...grigio);
    doc.text(`Generato da ${azienda.nome}`, 15, 290);
  }

  return doc;
}

// costruisce il PDF di un preventivo
// costruisce il PDF del registro voli (dati interni, mai inviati al cliente)
function costruisciPDFRegistroVolo({ azienda, impianto, ispezione, dflightDataUrl }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grigio = [110, 120, 130];
  let y = 20;

  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("Registro voli — documentazione interna", 15, y);
  y += 6;
  doc.setFontSize(9.5);
  doc.setTextColor(...grigio);
  doc.text("Non destinato al cliente — solo per la propria documentazione di volo.", 15, y);
  y += 10;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 8;

  const scrivi = (label, val) => {
    if (val === null || val === undefined || val === "" || val === false) return;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10.5);
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    const testo = String(val);
    const righe = doc.splitTextToSize(testo, 110);
    doc.text(righe, 70, y);
    y += Math.max(7, righe.length * 5);
  };

  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Dati generali", 15, y);
  y += 8;
  scrivi("Impianto", impianto?.nome);
  scrivi("Località", impianto?.zona);
  scrivi("Data ispezione", formatData(ispezione.data));
  scrivi("Operatore/pilota", ispezione.operatore);
  y += 4;

  doc.setFontSize(12);
  doc.setTextColor(20, 20, 20);
  doc.text("Dati di volo", 15, y);
  y += 8;
  scrivi("Drone utilizzato", ispezione.drone_usato);
  scrivi("Ora decollo", ispezione.ora);
  scrivi("Ora atterraggio", ispezione.ora_atterraggio);
  scrivi("Coordinate GPS stazione a terra", ispezione.coordinate_gps);
  scrivi("Scenario operativo", { aperta: "Categoria Aperta", sts01: "STS-01", sts02: "STS-02", specifica: "Operazione specifica" }[ispezione.scenario_volo] || ispezione.scenario_volo);
  scrivi("Altezza massima di volo", ispezione.altezza_volo ? `${ispezione.altezza_volo} m` : null);
  scrivi("Buffer di sicurezza", ispezione.buffer_sicurezza ? `${ispezione.buffer_sicurezza} m` : null);
  y += 4;

  if (ispezione.zona_rossa) {
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text("Zona rossa / area soggetta a restrizioni", 15, y);
    y += 8;
    scrivi("Permessi richiesti", ispezione.permessi_richiesti);
    scrivi("Ente/soggetto contattato", ispezione.ente_contattato);
    scrivi("Richiesta inviata", ispezione.data_inizio_permesso ? `${formatData(ispezione.data_inizio_permesso)}${ispezione.ora_inizio_permesso ? " alle " + ispezione.ora_inizio_permesso : ""}` : null);
    scrivi("Risposta ricevuta", ispezione.data_fine_permesso ? `${formatData(ispezione.data_fine_permesso)}${ispezione.ora_fine_permesso ? " alle " + ispezione.ora_fine_permesso : ""}` : null);
    scrivi("Esito", { in_attesa: "In attesa", autorizzato: "Autorizzato", negato: "Negato" }[ispezione.stato_permesso] || ispezione.stato_permesso);
    if (ispezione.stato_permesso === "negato") scrivi("Motivo del rifiuto", ispezione.motivo_negazione);
    if (ispezione.stato_permesso === "autorizzato" && ispezione.permesso_valido_dal) {
      scrivi("Permesso valido", `dal ${formatData(ispezione.permesso_valido_dal)} al ${ispezione.permesso_valido_al ? formatData(ispezione.permesso_valido_al) : "—"}${ispezione.permesso_ora_dalle ? `, dalle ${ispezione.permesso_ora_dalle} alle ${ispezione.permesso_ora_alle || "—"}` : ""}`);
    }
    y += 4;
  }

  if (ispezione.dflight_screenshot_url) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Screenshot D-Flight", 15, y);
    y += 6;
    if (dflightDataUrl) {
      try {
        const imgW = 120;
        const imgH = imgW * (300 / 480);
        if (y + imgH > 280) { doc.addPage(); y = 20; }
        doc.addImage(dflightDataUrl, "PNG", 15, y, imgW, imgH);
        y += imgH + 6;
      } catch (e) {}
    }
  }

  doc.setFontSize(8);
  doc.setTextColor(...grigio);
  doc.text(`Generato da ${azienda.nome} — documento a uso interno`, 15, 290);

  return doc;
}

// costruisce il PDF riassuntivo con tutto lo storico ispezioni di un impianto
function costruisciPDFRiassuntoImpianto({ azienda, impianto, storico, piano }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const oranje = [255, 140, 66];
  const grigio = [110, 120, 130];
  let y = 20;

  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", (210 - 26) / 2, 10, 26, 16, undefined, "FAST"); } catch (e) {}
    y = 34;
  }

  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text("Riepilogo storico ispezioni", 15, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(...grigio);
  doc.text(`${azienda.nome} — ispezioni con drone e termocamera`, 15, y);
  y += 12;

  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const righeInfo = [
    ["Impianto", impianto?.nome],
    ["Località", impianto?.zona],
    ...(impianto?.kwp ? [["Potenza installata", `${impianto?.kwp} kWp`]] : []),
    ["Cliente", impianto?.cliente],
    ["Ispezioni totali", String(storico.length)],
    ["Anomalie totali rilevate", String(storico.reduce((s, i) => s + i.anomalie, 0))],
  ];
  righeInfo.forEach(([label, val]) => {
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    doc.text(String(val), 70, y);
    y += 7;
  });

  y += 6;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 10;

  doc.setFontSize(13);
  doc.setTextColor(20, 20, 20);
  doc.text("Elenco ispezioni", 15, y);
  y += 9;

  // intestazione tabella
  doc.setFontSize(9.5);
  doc.setTextColor(...grigio);
  doc.text("Data", 15, y);
  doc.text("Operatore", 55, y);
  doc.text("Anomalie", 105, y);
  doc.text("Gravità max", 135, y);
  doc.text("Prossimo controllo", 165, y);
  y += 4;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 6;

  const coloreGravita = { bassa: [61, 139, 253], media: [245, 185, 66], alta: [255, 140, 66], critica: [255, 77, 77] };
  const etichettaGravita = { bassa: "Bassa", media: "Media", alta: "Alta", critica: "Critica" };

  storico.forEach((s) => {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(s.data, 15, y);
    doc.text(s.operatore || "—", 55, y);
    doc.text(String(s.anomalie), 105, y);
    const col = coloreGravita[s.gravitaMax] || grigio;
    doc.setTextColor(...col);
    doc.text(s.anomalie > 0 ? (etichettaGravita[s.gravitaMax] || "—") : "—", 135, y);
    doc.setTextColor(30, 30, 30);
    doc.text(s.prossimoControllo || "—", 165, y);
    y += 7;
  });

  if (storico.length === 0) {
    doc.setFontSize(10.5);
    doc.setTextColor(...grigio);
    doc.text("Nessuna ispezione ancora registrata per questo impianto.", 15, y);
    y += 7;
  }

  if (piano !== "pro") {
    doc.setFontSize(8);
    doc.setTextColor(...grigio);
    doc.text(`Generato da ${azienda.nome}`, 15, 290);
  }

  return doc;
}

// costruisce il PDF di una richiesta di permesso
// costruisce il PDF di un attestato/patentino
// costruisce il PDF della scheda di un drone (dati + manutenzione)
// costruisce un PDF riepilogativo dei documenti da mostrare in caso di controllo delle forze dell'ordine
function costruisciPDFControllo({ azienda, operatore, attestati, drone, permessi, impianto }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grigio = [110, 120, 130];
  let y = 20;

  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", (210 - 26) / 2, 10, 26, 16, undefined, "FAST"); } catch (e) {}
    y = 34;
  }

  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text("Documenti per un controllo", 15, y);
  y += 6;
  doc.setFontSize(9.5);
  doc.setTextColor(...grigio);
  doc.text(`${operatore || azienda.nome} — ${impianto?.nome || ""}`, 15, y);
  y += 10;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 9;

  const sottotitolo = (testo) => {
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(testo, 15, y);
    y += 7;
  };
  const riga = (label, val, colore) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(...(colore || [20, 20, 20]));
    const righe = doc.splitTextToSize(String(val), 110);
    doc.text(righe, 75, y);
    y += Math.max(6.5, righe.length * 4.5);
  };

  sottotitolo("Attestati e patentini");
  if (attestati.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text("Nessun attestato registrato nell'app.", 15, y);
    y += 7;
  }
  attestati.forEach((a) => {
    const oggi = new Date();
    const scaduto = a.data_scadenza && new Date(a.data_scadenza) < oggi;
    riga(a.tipo, a.data_scadenza ? `${scaduto ? "SCADUTO il " : "valido fino al "}${formatData(a.data_scadenza)}` : "senza scadenza registrata", scaduto ? [220, 60, 60] : [60, 160, 90]);
  });
  y += 5;

  sottotitolo("Drone utilizzato");
  if (drone) {
    riga("Nome/etichetta", drone.nome);
    riga("Modello", drone.modello || "—");
    riga("Matricola", drone.matricola || "—");
    riga("Marcatura classe", drone.marcatura_classe || "—");
    riga("Registrazione D-Flight", drone.registrazione_dflight || "—");
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text("Nessun drone selezionato per questa missione.", 15, y);
    y += 7;
  }
  y += 5;

  sottotitolo("Permessi collegati a questa zona");
  if (permessi.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text("Nessun permesso specifico registrato per questa zona.", 15, y);
    y += 7;
  }
  permessi.forEach((p) => {
    const coloreStato = p.stato === "autorizzato" ? [60, 160, 90] : p.stato === "negato" ? [220, 60, 60] : [200, 140, 40];
    riga(p.impianto, `${{ in_attesa: "In attesa", autorizzato: "Autorizzato", negato: "Negato" }[p.stato] || p.stato}${p.ente_contattato ? " — " + p.ente_contattato : ""}`, coloreStato);
  });

  doc.setFontSize(8);
  doc.setTextColor(...grigio);
  doc.text(`Generato da ${azienda.nome} — documento a uso personale del pilota`, 15, 290);

  return doc;
}

function costruisciPDFDrone({ azienda, drone, documentoDataUrl, documentoEImmagine }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grigio = [110, 120, 130];
  let y = 20;

  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", (210 - 26) / 2, 10, 26, 16, undefined, "FAST"); } catch (e) {}
    y = 34;
  }

  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text(drone.nome, 15, y);
  y += 8;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 10;

  const scrivi = (label, val) => {
    if (val === null || val === undefined || val === "") return;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10.5);
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    const righe = doc.splitTextToSize(String(val), 110);
    doc.text(righe, 70, y);
    y += Math.max(7, righe.length * 5);
  };

  scrivi("Modello", drone.modello);
  scrivi("Matricola", drone.matricola);
  scrivi("Marcatura classe (C0-C5)", drone.marcatura_classe);
  scrivi("Registrazione D-Flight", drone.registrazione_dflight);
  scrivi("Data acquisto", drone.data_acquisto ? formatData(drone.data_acquisto) : null);
  scrivi("Ore di volo", drone.ore_volo ? `${drone.ore_volo} h` : null);
  scrivi("Prossima manutenzione", drone.prossima_manutenzione ? formatData(drone.prossima_manutenzione) : null);
  scrivi("Note", drone.note);
  y += 6;

  if (documentoDataUrl && documentoEImmagine) {
    if (y > 180) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Documento allegato", 15, y);
    y += 6;
    try {
      const imgW = 170;
      const imgProps = doc.getImageProperties(documentoDataUrl);
      const imgH = Math.min(220, imgW * (imgProps.height / imgProps.width));
      if (y + imgH > 285) { doc.addPage(); y = 20; }
      doc.addImage(documentoDataUrl, "PNG", 15, y, imgW, imgH);
      y += imgH + 6;
    } catch (e) {}
  } else if (drone.documento_url) {
    doc.setFontSize(9.5);
    doc.setTextColor(...grigio);
    doc.text("Documento originale disponibile nell'app (formato non incorporabile in questo PDF).", 15, y);
    y += 8;
  }

  doc.setFontSize(8);
  doc.setTextColor(...grigio);
  doc.text(`Generato da ${azienda.nome} — documento a uso interno`, 15, 290);

  return doc;
}

function costruisciPDFAttestato({ azienda, attestato, documentoDataUrl, documentoEImmagine }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grigio = [110, 120, 130];
  let y = 20;

  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", (210 - 26) / 2, 10, 26, 16, undefined, "FAST"); } catch (e) {}
    y = 34;
  }

  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text(attestato.tipo, 15, y);
  y += 8;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 10;

  const scrivi = (label, val) => {
    if (val === null || val === undefined || val === "") return;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10.5);
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    const righe = doc.splitTextToSize(String(val), 110);
    doc.text(righe, 70, y);
    y += Math.max(7, righe.length * 5);
  };

  scrivi("Numero / riferimento", attestato.numero_riferimento);
  scrivi("Data conseguimento", attestato.data_conseguimento ? formatData(attestato.data_conseguimento) : null);
  scrivi("Data scadenza", attestato.data_scadenza ? formatData(attestato.data_scadenza) : null);
  scrivi("Note", attestato.note);
  y += 6;

  if (documentoDataUrl && documentoEImmagine) {
    if (y > 180) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Documento allegato", 15, y);
    y += 6;
    try {
      const imgW = 170;
      const imgProps = doc.getImageProperties(documentoDataUrl);
      const imgH = Math.min(220, imgW * (imgProps.height / imgProps.width));
      if (y + imgH > 285) { doc.addPage(); y = 20; }
      doc.addImage(documentoDataUrl, "PNG", 15, y, imgW, imgH);
      y += imgH + 6;
    } catch (e) {}
  } else if (attestato.documento_url) {
    doc.setFontSize(9.5);
    doc.setTextColor(...grigio);
    doc.text("Documento originale disponibile nell'app (formato non incorporabile in questo PDF).", 15, y);
    y += 8;
  }

  doc.setFontSize(8);
  doc.setTextColor(...grigio);
  doc.text(`Generato da ${azienda.nome} — documento a uso interno`, 15, 290);

  return doc;
}

function costruisciPDFPermesso({ azienda, permesso, dflightDataUrl, piano }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grigio = [110, 120, 130];
  let y = 20;

  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", (210 - 26) / 2, 10, 26, 16, undefined, "FAST"); } catch (e) {}
    y = 34;
  }

  doc.setFontSize(17);
  doc.setTextColor(20, 20, 20);
  doc.text("Richiesta permesso di volo", 15, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(...grigio);
  doc.text(`${azienda.nome} — ispezioni con drone e termocamera`, 15, y);
  y += 12;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, 195, y);
  y += 8;

  const scrivi = (label, val) => {
    if (val === null || val === undefined || val === "") return;
    if (y > 275) { doc.addPage(); y = 20; }
    doc.setFontSize(10.5);
    doc.setTextColor(...grigio);
    doc.text(label, 15, y);
    doc.setTextColor(20, 20, 20);
    const righe = doc.splitTextToSize(String(val), 110);
    doc.text(righe, 70, y);
    y += Math.max(7, righe.length * 5);
  };

  const stati = { in_attesa: "In attesa", autorizzato: "Autorizzato", negato: "Negato" };

  scrivi("Impianto / zona", permesso.impianto);
  scrivi("Ente / soggetto contattato", permesso.ente_contattato);
  scrivi("Permessi richiesti", permesso.permessi_richiesti);
  scrivi("Buffer di sicurezza", permesso.buffer_sicurezza ? `${permesso.buffer_sicurezza} m` : null);
  scrivi("Richiesta inviata", permesso.data_richiesta ? `${formatData(permesso.data_richiesta)}${permesso.ora_richiesta ? " alle " + permesso.ora_richiesta : ""}` : null);
  scrivi("Esito", stati[permesso.stato] || permesso.stato);
  if (permesso.stato === "negato") scrivi("Motivo del rifiuto", permesso.motivo_negazione);
  if (permesso.stato === "autorizzato" && permesso.valido_dal) {
    scrivi("Permesso valido", `dal ${formatData(permesso.valido_dal)} al ${permesso.valido_al ? formatData(permesso.valido_al) : "—"}${permesso.ora_dalle ? `, dalle ${permesso.ora_dalle} alle ${permesso.ora_alle || "—"}` : ""}`);
  }
  scrivi("Note", permesso.note);
  y += 6;

  if (dflightDataUrl) {
    if (y > 200) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text("Screenshot D-Flight", 15, y);
    y += 6;
    try {
      const imgW = 120;
      const imgH = imgW * (300 / 480);
      if (y + imgH > 280) { doc.addPage(); y = 20; }
      doc.addImage(dflightDataUrl, "PNG", 15, y, imgW, imgH);
      y += imgH + 6;
    } catch (e) {}
  }

  doc.setFontSize(8);
  doc.setTextColor(...grigio);
  doc.text(`Generato da ${azienda.nome} — documento a uso interno`, 15, 290);

  return doc;
}

function costruisciPDFPreventivo({ azienda, preventivo, piano }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const scuro = [22, 26, 31];
  const grigio = [110, 120, 130];
  const grigioChiaro = [130, 138, 148];
  const nero = [20, 20, 20];
  let y = 0;

  // --- fascia superiore scura con logo e nome azienda ---
  doc.setFillColor(...scuro);
  doc.rect(0, 0, 210, 30, "F");
  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", 15, 6, 18, 18); } catch (e) {}
  }
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(azienda.nome.toUpperCase(), 38, 15);
  doc.setFontSize(9);
  doc.setTextColor(180, 186, 194);
  doc.text("Ispezioni aeree con termocamera", 38, 21);

  y = 46;

  // --- titolo preventivo ---
  doc.setFontSize(17);
  doc.setTextColor(...nero);
  doc.text(`Preventivo N. ${preventivo.numero || "—"}`, 15, y);
  y += 7;
  doc.setFontSize(10);
  doc.setTextColor(...grigio);
  const dataEmissione = new Date(preventivo.data);
  doc.text(`Data: ${formatData(dataEmissione)}   ·   Validità: ${preventivo.validita_giorni || 30} giorni`, 15, y);
  y += 8;
  doc.setDrawColor(225, 225, 225);
  doc.line(15, y, 195, y);
  y += 10;

  // --- luogo intervento ---
  if (preventivo.luogo_intervento) {
    doc.setFontSize(9.5);
    doc.setTextColor(...grigio);
    doc.text("LUOGO INTERVENTO", 15, y);
    y += 5.5;
    doc.setFontSize(11);
    doc.setTextColor(...nero);
    const righeLuogo = doc.splitTextToSize(preventivo.luogo_intervento, 175);
    doc.text(righeLuogo, 15, y);
    y += righeLuogo.length * 5.5 + 6;
  }

  // --- oggetto ---
  if (preventivo.oggetto) {
    doc.setFontSize(9.5);
    doc.setTextColor(...grigio);
    doc.text("OGGETTO", 15, y);
    y += 5.5;
    doc.setFontSize(11);
    doc.setTextColor(...nero);
    const righeOggetto = doc.splitTextToSize(preventivo.oggetto, 175);
    doc.text(righeOggetto, 15, y);
    y += righeOggetto.length * 5.5 + 8;
  }

  // --- dettaglio servizio (tabella voci) ---
  const voci = Array.isArray(preventivo.voci) ? preventivo.voci : [];
  if (voci.length > 0) {
    doc.setFontSize(11.5);
    doc.setTextColor(...nero);
    doc.text("DETTAGLIO SERVIZIO", 15, y);
    y += 7;

    doc.setFillColor(...scuro);
    doc.rect(15, y - 5, 180, 8, "F");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("Descrizione", 18, y);
    doc.text("Importo", 192, y, { align: "right" });
    y += 7;

    voci.forEach((v, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const sfondoRiga = idx % 2 === 0 ? [248, 249, 250] : [255, 255, 255];
      doc.setFillColor(...sfondoRiga);
      const righeDesc = doc.splitTextToSize(v.descrizione || "", 140);
      const altezzaRiga = Math.max(8, righeDesc.length * 5 + 3);
      doc.rect(15, y - 5, 180, altezzaRiga, "F");
      doc.setFontSize(10);
      doc.setTextColor(...nero);
      doc.text(righeDesc, 18, y);
      doc.text(`€ ${Number(v.importo || 0).toFixed(2)}`, 192, y, { align: "right" });
      y += altezzaRiga;
    });
    y += 8;
  }

  // --- totali ---
  const listino = voci.reduce((s, v) => s + (Number(v.importo) || 0), 0);
  const sconto = Number(preventivo.sconto_importo) || 0;
  const totale = Number(preventivo.prezzo) || (listino - sconto);

  if (y > 260) { doc.addPage(); y = 20; }

  doc.setFontSize(10);
  doc.setTextColor(...grigio);
  doc.text("Prezzo di listino", 15, y);
  if (sconto > 0) {
    doc.setTextColor(...grigioChiaro);
    const testoListino = `€ ${listino.toFixed(2)}`;
    doc.text(testoListino, 192, y, { align: "right" });
    const largh = doc.getTextWidth(testoListino);
    doc.setDrawColor(...grigioChiaro);
    doc.line(192 - largh, y - 1.3, 192, y - 1.3);
  } else {
    doc.setTextColor(...nero);
    doc.text(`€ ${listino.toFixed(2)}`, 192, y, { align: "right" });
  }
  y += 6.5;

  if (sconto > 0) {
    doc.setTextColor(...grigio);
    doc.text("Sconto applicato", 15, y);
    doc.setTextColor(230, 90, 60);
    doc.text(`− € ${sconto.toFixed(2)}`, 192, y, { align: "right" });
    y += 6.5;
  }

  y += 3;
  doc.setDrawColor(225, 225, 225);
  doc.line(15, y, 195, y);
  y += 10;

  doc.setFontSize(12.5);
  doc.setTextColor(...nero);
  doc.text(sconto > 0 ? "TOTALE SCONTATO" : "TOTALE", 15, y);
  doc.setFontSize(16);
  doc.setTextColor(...scuro);
  doc.text(`€ ${totale.toFixed(2)}`, 195, y, { align: "right" });
  y += 16;

  // --- note ---
  if (preventivo.note) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(10.5);
    doc.setTextColor(...nero);
    doc.text("NOTE", 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...grigio);
    const noteLines = doc.splitTextToSize(preventivo.note, 175);
    doc.text(noteLines, 15, y);
    y += noteLines.length * 4.5 + 8;
  }

  // --- diciture legali (personalizzabili in Impostazioni) ---
  const testoLegale = (azienda.noteLegaliPreventivo || NOTE_LEGALI_PREVENTIVO_DEFAULT).replace("{validita}", String(preventivo.validita_giorni || 30));
  if (testoLegale) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setDrawColor(225, 225, 225);
    doc.line(15, y, 195, y);
    y += 7;
    doc.setFontSize(7.5);
    doc.setTextColor(...grigioChiaro);
    const righeLegali = doc.splitTextToSize(testoLegale, 180);
    doc.text(righeLegali, 15, y);
    y += righeLegali.length * 3.6 + 8;
  }

  if (y > 250) { doc.addPage(); y = 20; }
  doc.setDrawColor(225, 225, 225);
  doc.line(15, y, 195, y);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(...grigio);
  doc.text("Per accettazione del preventivo, si prega di confermare via email o telefono.", 15, y);
  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(...nero);
  doc.text(`${azienda.nome}${preventivo.operatore ? " — " + preventivo.operatore : ""}`, 15, y);

  // --- fascia inferiore scura ---
  doc.setFillColor(...scuro);
  doc.rect(0, 283, 210, 14, "F");
  doc.setFontSize(8);
  doc.setTextColor(200, 205, 212);
  doc.text(`${azienda.nome}  ·  Generato automaticamente`, 105, 291, { align: "center" });

  return doc;
}

// --- Dati statici (non cambiano tra ispezioni) -----------------------------------------------------------

const SEVERITY = [
  { key: "bassa", label: "Bassa", color: "#3d8bfd" },
  { key: "media", label: "Media", color: "#f5b942" },
  { key: "alta", label: "Alta", color: "#ff8c42" },
  { key: "critica", label: "Critica", color: "#ff4d4d" },
];

const CATEGORIE_FOTOVOLTAICO = [
  { key: "Hotspot singolo (classe A)", descrizione: "Punto isolato di surriscaldamento su una singola cella, spesso per micro-fratture interne o difetti di saldatura.", azione: "Verifica visiva ravvicinata; se persiste, sostituzione del pannello." },
  { key: "Hotspot multipli (classe B)", descrizione: "Più punti di surriscaldamento all'interno dello stesso modulo, tipico di celle multiple danneggiate o disconnesse.", azione: "Ispezione approfondita del modulo; probabile sostituzione." },
  { key: "Sotto-stringa calda (classe C)", descrizione: "Porzione del modulo (sotto-stringa) uniformemente più calda del resto, spesso per diodo di bypass attivo o guasto.", azione: "Controllo elettrico della scatola di giunzione e del diodo di bypass." },
  { key: "Modulo uniformemente caldo (classe D)", descrizione: "L'intero modulo risulta più caldo rispetto ai moduli adiacenti, possibile cella in cortocircuito o degrado diffuso.", azione: "Test elettrico approfondito del modulo (verifica delle prestazioni) e valutazione sostituzione." },
  { key: "Stringa disconnessa (classe E)", descrizione: "Intera serie di moduli fredda o scollegata, tipico di un guasto a monte (fusibile, connettore, cablaggio).", azione: "Controllo del quadro stringhe e della continuità elettrica." },
  { key: "Cella fratturata", descrizione: "Rottura fisica visibile della cella, riduce la produzione e può peggiorare nel tempo.", azione: "Sostituzione del pannello consigliata." },
  { key: "Ombreggiamento", descrizione: "Zona d'ombra ricorrente (vegetazione, strutture) che abbassa la resa del modulo.", azione: "Valutare potatura o rimozione dell'ostacolo." },
  { key: "Diodo di bypass guasto", descrizione: "Malfunzionamento del diodo di bypass, il pannello si scalda a strisce.", azione: "Controllo elettrico della scatola di giunzione." },
  { key: "Sporcizia/detriti", descrizione: "Accumulo di polvere, foglie o depositi che riduce l'irraggiamento captato.", azione: "Pianificare pulizia del modulo." },
  { key: "Delaminazione", descrizione: "Distacco degli strati protettivi del pannello, rischio infiltrazioni.", azione: "Ispezione approfondita e possibile sostituzione." },
];

const CATEGORIE_ELETTRICO = [
  { key: "Connessione/morsetto surriscaldato", descrizione: "Punto di giunzione elettrica con temperatura anomala, spesso per contatto allentato o ossidato.", azione: "Serraggio o sostituzione del morsetto; intervento prioritario se la temperatura è molto più alta rispetto alle zone vicine." },
  { key: "Interruttore/sezionatore anomalo", descrizione: "Componente di manovra con segnatura termica fuori norma rispetto ai componenti adiacenti.", azione: "Verifica elettrica del componente da parte di tecnico abilitato." },
  { key: "Trasformatore in sovratemperatura", descrizione: "Temperatura del trasformatore superiore ai valori attesi in relazione al carico.", azione: "Controllo del carico e del sistema di raffreddamento." },
  { key: "Cavo/conduttore anomalo", descrizione: "Tratto di cavo con riscaldamento localizzato, possibile sovraccarico o danneggiamento dell'isolante.", azione: "Verifica della sezione del cavo rispetto al carico e dello stato dell'isolamento." },
  { key: "Quadro elettrico in anomalia", descrizione: "Punto caldo all'interno o sull'involucro di un quadro elettrico.", azione: "Ispezione interna del quadro da parte di elettricista qualificato." },
  { key: "Motore/cuscinetto surriscaldato", descrizione: "Temperatura anomala su motore elettrico o cuscinetto, possibile segnale di usura o disallineamento.", azione: "Programmare manutenzione meccanica; verificare lubrificazione." },
  { key: "Dispersione su tubazione/serbatoio", descrizione: "Segnatura termica compatibile con perdita di fluido o difetto di coibentazione su tubazioni o serbatoi industriali.", azione: "Ispezione ravvicinata del tratto interessato." },
];

const CATEGORIE_EDIFICI = [
  { key: "Ponte termico", descrizione: "Zona localizzata con dispersione di calore maggiore, dovuta a elementi strutturali che bypassano l'isolamento (es. pilastri, solai, cordoli).", azione: "Valutare intervento di isolamento a cappotto nella zona interessata." },
  { key: "Isolamento mancante o insufficiente", descrizione: "Ampia porzione di parete o copertura con dispersione termica diffusa, tipica di isolamento assente o degradato.", azione: "Verificare lo spessore e lo stato dell'isolante; valutare integrazione." },
  { key: "Infiltrazione d'aria", descrizione: "Zona con passaggio d'aria non controllato, spesso attorno a serramenti, prese elettriche o giunti.", azione: "Sigillare i punti di infiltrazione individuati." },
  { key: "Difetto di tenuta serramenti", descrizione: "Dispersione localizzata attorno a finestre o porte, per guarnizioni usurate o posa non corretta.", azione: "Verifica e sostituzione delle guarnizioni; controllo della posa." },
  { key: "Infiltrazione/umidità di risalita", descrizione: "Segnatura termica compatibile con presenza di umidità nella muratura.", azione: "Approfondire con igrometro; individuare la fonte dell'infiltrazione." },
  { key: "Rischio muffa/condensa superficiale", descrizione: "Zona con temperatura superficiale sufficientemente bassa da favorire condensa e formazione di muffa.", azione: "Migliorare isolamento e/o ventilazione della zona." },
  { key: "Guasto impianto radiante", descrizione: "Anomalia nella distribuzione del calore di un impianto a pavimento/parete radiante (tratti freddi o surriscaldati).", azione: "Verifica dell'impianto con tecnico specializzato." },
];

const CATEGORIE_DANNI = [
  { key: "Danno da grandine", descrizione: "Ammaccature o fori sul manto di copertura causati da grandine, riducono la tenuta e la vita utile del materiale.", azione: "Documentare estensione e numero di impatti; valutare sostituzione della porzione colpita." },
  { key: "Distacco tegola/scandola", descrizione: "Elemento di copertura spostato, sollevato o mancante, espone la struttura sottostante a infiltrazioni.", azione: "Ripristino o sostituzione dell'elemento mancante." },
  { key: "Infiltrazione/macchia di umidità", descrizione: "Segno visibile di penetrazione d'acqua sulla copertura o sulla guaina impermeabilizzante.", azione: "Individuare il punto di ingresso e ripristinare la tenuta." },
  { key: "Usura/degrado del materiale", descrizione: "Deterioramento diffuso del manto di copertura dovuto a età, esposizione UV o agenti atmosferici.", azione: "Valutare la vita utile residua e pianificare manutenzione o rifacimento." },
  { key: "Danno strutturale", descrizione: "Deformazione, cedimento o avvallamento visibile della struttura di copertura.", azione: "Richiedere verifica strutturale approfondita da tecnico abilitato." },
  { key: "Grondaia/scarico danneggiato", descrizione: "Elemento di raccolta o scarico delle acque piovane ammaccato, ostruito o distaccato.", azione: "Ripristino o sostituzione del componente." },
  { key: "Camino/abbaino compromesso", descrizione: "Danno visibile su elementi verticali della copertura (camini, abbaini, lucernari).", azione: "Verifica della tenuta e delle guarnizioni perimetrali." },
];

// combino entrambe le liste per la ricerca: così un'anomalia resta leggibile anche se la vedi in un contesto diverso da quando è stata creata
const TUTTE_LE_CATEGORIE = [...CATEGORIE_FOTOVOLTAICO, ...CATEGORIE_DANNI, ...CATEGORIE_EDIFICI, ...CATEGORIE_ELETTRICO];

const CATEGORIE_PER_TIPO = {
  fotovoltaico: CATEGORIE_FOTOVOLTAICO,
  danni: CATEGORIE_DANNI,
  edifici: CATEGORIE_EDIFICI,
  elettrico: CATEGORIE_ELETTRICO,
};

// --- Shell -----------------------------------------------------------

export default function App() {
  // link di consegna al cliente: pagina pubblica, senza login
  const tokenGalleria = new URLSearchParams(window.location.search).get("galleria");
  if (tokenGalleria) return <GalleriaCondivisa token={tokenGalleria} />;
  return <AppAutenticata />;
}

function AppAutenticata() {
  const [session, setSession] = useState(undefined); // undefined = ancora in caricamento, null = non loggato

  useEffect(() => {
    // memorizzo eventuale provenienza (?ref=nomeaffiliato) per collegarla all'account al momento della registrazione
    const refParam = new URLSearchParams(window.location.search).get("ref");
    if (refParam) localStorage.setItem("eyedrones_ref", refParam);

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: "#8b95a3", fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13 }}>
        Caricamento...
      </div>
    );
  }

  if (!session) {
    return <Accesso />;
  }

  return <AppShell session={session} />;
}

function AppShell({ session }) {
  const [page, setPage] = useState("dashboard");
  const [impiantoAttivo, setImpiantoAttivo] = useState(null);
  const [azienda, setAzienda] = useState({ nome: "Eyedrones", logo: LOGO_EYEDRONES, tariffaBase: 150, tariffaKwp: 0.12, noteLegaliPreventivo: "" });
  const [piano, setPiano] = useState("free");
  const [profiloCaricato, setProfiloCaricato] = useState(false);

  const [impianti, setImpianti] = useState([]);
  const [ispezioni, setIspezioni] = useState([]);
  const [anomalieAll, setAnomalieAll] = useState([]);
  const [fotoAll, setFotoAll] = useState([]);
  const [reportLog, setReportLog] = useState([]);
  const [preventivi, setPreventivi] = useState([]);
  const [permessi, setPermessi] = useState([]);
  const [attestati, setAttestati] = useState([]);
  const [droni, setDroni] = useState([]);
  const [moduli, setModuli] = useState(null); // null = non ancora scelto ("ispezioni", "riprese" o entrambi separati da virgola)
  const [obiettivoFormativo, setObiettivoFormativo] = useState("");
  const [voliManuali, setVoliManuali] = useState([]);
  const [nuovoVolo, setNuovoVolo] = useState(false);
  const [vistaVoli, setVistaVoli] = useState("voli"); // "voli" | "galleria"
  const [fileRapidi, setFileRapidi] = useState(null); // file scelti dalla prima pagina, da allegare a un nuovo volo
  const [prefillVolo, setPrefillVolo] = useState(null); // dati di un piano di volo, da precompilare aprendo "Nuovo volo"
  const [batterie, setBatterie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  const caricaProfilo = async () => {
    let { data: profilo } = await supabase.from("profili").select("*").eq("user_id", session.user.id).maybeSingle();
    if (!profilo) {
      const referral = localStorage.getItem("eyedrones_ref");
      const { data: nuovo } = await supabase.from("profili").insert({ user_id: session.user.id, referral: referral || null, email: session.user.email }).select().single();
      profilo = nuovo;
    } else if (!profilo.email) {
      await supabase.from("profili").update({ email: session.user.email }).eq("user_id", session.user.id);
    }
    if (profilo) {
      setPiano(profilo.piano || "free");
      setModuli(profilo.moduli || null);
      setObiettivoFormativo(profilo.obiettivo_formativo || "");
      setAzienda({
        nome: profilo.azienda_nome || "Eyedrones",
        logo: profilo.azienda_logo && !profilo.azienda_logo.startsWith(LOGO_PRECEDENTE_PREFISSO) ? profilo.azienda_logo : LOGO_EYEDRONES,
        tariffaBase: profilo.tariffa_base ?? 150,
        tariffaKwp: profilo.tariffa_kwp ?? 0.12,
        noteLegaliPreventivo: profilo.preventivo_note_legali || "",
      });
    }
    setProfiloCaricato(true);
  };

  const salvaProfiloAzienda = async (nuovaAzienda) => {
    setAzienda(nuovaAzienda);
    await supabase.from("profili").update({
      azienda_nome: nuovaAzienda.nome,
      azienda_logo: nuovaAzienda.logo,
      tariffa_base: nuovaAzienda.tariffaBase,
      tariffa_kwp: nuovaAzienda.tariffaKwp,
      preventivo_note_legali: nuovaAzienda.noteLegaliPreventivo,
    }).eq("user_id", session.user.id);
  };

  const salvaModuli = async (nuovi) => {
    setModuli(nuovi);
    const { error } = await supabase.from("profili").update({ moduli: nuovi }).eq("user_id", session.user.id);
    if (error) alert("Non sono riuscito a salvare la scelta sul tuo account (" + error.message + "). Per ora vale solo finché tieni aperta l'app: controlla di aver eseguito lo script SQL degli aggiornamenti.");
  };

  const salvaObiettivoFormativo = async (valore) => {
    setObiettivoFormativo(valore);
    const { error } = await supabase.from("profili").update({ obiettivo_formativo: valore }).eq("user_id", session.user.id);
    if (error) alert("Non sono riuscito a salvare l'obiettivo sul tuo account (" + error.message + "). Controlla di aver eseguito lo script SQL degli aggiornamenti.");
  };

  // i voli si leggono a parte: se la tabella non esiste ancora, il resto dell'app funziona lo stesso
  const caricaVoli = async () => {
    const { data } = await supabase.from("voli").select("*").order("data", { ascending: false });
    setVoliManuali(data || []);
  };

  // come i voli, anche le batterie si leggono a parte: se la tabella non esiste ancora, il resto dell'app funziona lo stesso
  const caricaBatterie = async () => {
    const { data } = await supabase.from("batterie").select("*").order("created_at", { ascending: true });
    setBatterie(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [{ data: imp, error: e1 }, { data: isp, error: e2 }, { data: ano, error: e3 }, { data: fot, error: e4 }, { data: log, error: e5 }, { data: prev, error: e6 }, { data: perm, error: e7 }, { data: att, error: e8 }, { data: drn, error: e9 }] = await Promise.all([
        supabase.from("impianti").select("*").order("created_at"),
        supabase.from("ispezioni").select("*").order("data", { ascending: false }),
        supabase.from("anomalie").select("*"),
        supabase.from("foto").select("*"),
        supabase.from("report_log").select("*"),
        supabase.from("preventivi").select("*").order("created_at", { ascending: false }),
        supabase.from("permessi").select("*").order("created_at", { ascending: false }),
        supabase.from("attestati").select("*").order("data_scadenza", { ascending: true }),
        supabase.from("droni").select("*").order("created_at", { ascending: false }),
      ]);
      if (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9) throw (e1 || e2 || e3 || e4 || e5 || e6 || e7 || e8 || e9);
      setImpianti(imp || []);
      setIspezioni(isp || []);
      setAnomalieAll(ano || []);
      setFotoAll(fot || []);
      setReportLog(log || []);
      setPreventivi(prev || []);
      setPermessi(perm || []);
      setAttestati(att || []);
      setDroni(drn || []);
    } catch (err) {
      setDbError(err.message || "Errore di connessione al database");
    }
    setLoading(false);
  };

  useEffect(() => { caricaProfilo(); loadData(); caricaVoli(); caricaBatterie(); }, []);

  // quanti report ha gi\u00e0 generato l'utente nel mese corrente (log persistente: non si azzera cancellando impianti/ispezioni)
  const oggi = new Date();
  const reportQuestoMese = reportLog.filter((r) => {
    const d = new Date(r.creato_at);
    return d.getMonth() === oggi.getMonth() && d.getFullYear() === oggi.getFullYear();
  }).length;

  // arricchisco ogni impianto con ultima ispezione e numero anomalie, calcolati dai dati reali
  const impiantiConStat = impianti.map((imp) => {
    const ispezioniImp = ispezioni.filter((i) => i.impianto_id === imp.id);
    const idsIsp = ispezioniImp.map((i) => i.id);
    const anomalieImp = anomalieAll.filter((a) => idsIsp.includes(a.ispezione_id));
    return { ...imp, ultima: ispezioniImp[0] ? formatData(ispezioniImp[0].data) : "Nessuna ispezione", anomalie: anomalieImp.length };
  });

  // l'impianto selezionato è "in diretta": se lo modifichi altrove (es. svuoti il kWp), qui non resta mai una fotografia vecchia
  const impiantoCorrente = impiantoAttivo ? impiantiConStat.find((i) => i.id === impiantoAttivo.id) : null;

  // navigazione: "Foto e video" nel menu è la galleria del registro voli
  const vai = (chiave) => {
    if (chiave === "galleria") { setVistaVoli("galleria"); setPage("registro-voli"); return; }
    if (chiave === "registro-voli") setVistaVoli("voli");
    setPage(chiave);
  };
  const paginaMenu = page === "registro-voli" && vistaVoli === "galleria" ? "galleria" : page;

  const usaIspezioni = !moduli || moduli.includes("ispezioni");
  const usaRiprese = !moduli || moduli.includes("riprese");
  const voliDashboard = [...voliManuali, ...costruisciVoliDaIspezioni(ispezioni, impianti)].sort((a, b) => {
    const da = `${a.data || ""} ${a.ora ? String(a.ora).slice(0, 5) : "00:00"}`;
    const db = `${b.data || ""} ${b.ora ? String(b.ora).slice(0, 5) : "00:00"}`;
    return db.localeCompare(da);
  });

  return (
    <div className="app-shell" style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "transparent", color: "#e7eaee", minHeight: "100vh", display: "flex", width: "100%" }}>
      <style>{`
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        button { font-family: inherit; cursor: pointer; transition: filter .12s ease, transform .12s ease, opacity .12s ease; }
        button:not(:disabled):hover { filter: brightness(1.1); }
        button:not(:disabled):active { filter: brightness(0.94); transform: translateY(0.5px); }
        input, select, textarea { transition: border-color .15s ease, background .15s ease; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #ff8c42 !important; }
        h1, h2, h3 { letter-spacing: -0.012em; }
        ::selection { background: #ff8c4255; }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #333a45; border-radius: 8px; }
        ::-webkit-scrollbar-thumb:hover { background: #454c59; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .app-shell { flex-direction: row; }
        .sidebar { width: 220px; flex-direction: column; }
        .sidebar-label { display: inline; }
        .sidebar-brand-label { display: inline; }
        .main-content { padding: 28px 32px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        .menu-telefono { display: none; }
        @media (max-width: 680px) {
          .app-shell { flex-direction: column; }
          .sidebar { display: none !important; }
          .menu-telefono { display: contents; }
          .mt-topbar { position: sticky; top: 0; z-index: 800; display: flex; align-items: center; gap: 8px; padding: 10px 16px; padding-top: calc(10px + env(safe-area-inset-top)); background: rgba(18, 21, 26, 0.92); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-bottom: 1px solid #262b33; }
          .mt-tabbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 900; display: flex; background: rgba(18, 21, 26, 0.96); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border-top: 1px solid #262b33; padding-bottom: env(safe-area-inset-bottom); }
          .mt-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 2px 7px 2px; background: none; border: none; color: #7c8694; font-size: 10.5px; font-weight: 500; min-height: 56px; justify-content: center; }
          .mt-tab.on { color: #ff8c42; font-weight: 700; }
          .mt-overlay { position: fixed; inset: 0; z-index: 950; background: rgba(0, 0, 0, 0.55); display: flex; align-items: flex-end; }
          .mt-sheet { width: 100%; max-height: 82vh; overflow-y: auto; background: #161a20; border-top: 1px solid #2b313d; border-radius: 16px 16px 0 0; padding: 10px 14px calc(16px + env(safe-area-inset-bottom)) 14px; }
          .app-shell > div:last-child { padding-bottom: calc(64px + env(safe-area-inset-bottom)); }
          .main-content { padding: 18px 16px; }
        }
      `}</style>

      <Sidebar page={paginaMenu} setPage={vai} userEmail={session.user.email} piano={piano} reportQuestoMese={reportQuestoMese} attestatiInScadenza={attestati.filter((a) => a.data_scadenza && new Date(a.data_scadenza) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length} droniInScadenza={droni.filter((d) => d.prossima_manutenzione && new Date(d.prossima_manutenzione) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).length} usaIspezioni={usaIspezioni} batterieAvvisi={batterie.reduce((n, b) => n + avvisiBatteria(b).length, 0)} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {dbError && (
          <div style={{ margin: 16, padding: "10px 14px", background: "#2a1616", border: "1px solid #5a2a2a", borderRadius: 8, color: "#ff9c9c", fontSize: 12.5 }}>
            Impossibile leggere il database: {dbError}. Controlla di aver eseguito lo script SQL su Supabase.
          </div>
        )}
        {page === "dashboard" && <Dashboard impianti={impiantiConStat} loading={loading} onOpenImpianto={(i) => { setImpiantoAttivo(i); setPage("impianto"); }} onNuova={() => setPage("nuova")} numIspezioni={ispezioni.length} usaIspezioni={usaIspezioni} usaRiprese={usaRiprese} moduli={moduli} onSalvaModuli={salvaModuli} voli={voliDashboard} attestati={attestati} droni={droni} batterie={batterie} onNav={vai} onNuovoVolo={() => { setVistaVoli("voli"); setNuovoVolo(true); setPage("registro-voli"); }} onAggiungiFile={(files) => { setFileRapidi(files); setVistaVoli("voli"); setNuovoVolo(true); setPage("registro-voli"); }} />}
        {page === "impianti" && <ListaImpianti impianti={impiantiConStat} loading={loading} onReload={loadData} onOpenImpianto={(i) => { setImpiantoAttivo(i); setPage("impianto"); }} ispezioni={ispezioni} fotoAll={fotoAll} />}
        {page === "impianto" && impiantoCorrente && <DettaglioImpianto impianto={impiantoCorrente} ispezioni={ispezioni.filter((i) => i.impianto_id === impiantoCorrente.id)} anomalieAll={anomalieAll} fotoAll={fotoAll} azienda={azienda} piano={piano} onBack={() => setPage("impianti")} onReload={loadData} />}
        {page === "nuova" && <NuovaIspezione impianti={impiantiConStat} onSaved={loadData} onDone={() => setPage("dashboard")} azienda={azienda} piano={piano} reportQuestoMese={reportQuestoMese} />}
        {page === "pianificazione" && <PianificazioneVolo azienda={azienda} impianti={impianti} session={session} onVaiRegistroConDati={(dati) => { setPrefillVolo(dati); setVistaVoli("voli"); setNuovoVolo(true); setPage("registro-voli"); }} />}
        {page === "registro-voli" && <RegistroVoli azienda={azienda} droni={droni} ispezioni={ispezioni} impianti={impianti} aprireNuovo={nuovoVolo} onAperto={() => { setNuovoVolo(false); setFileRapidi(null); setPrefillVolo(null); }} onCambiato={caricaVoli} vista={vistaVoli} onVista={setVistaVoli} fileIniziali={fileRapidi} prefillIniziale={prefillVolo} batterie={batterie} onBatterieCambiate={caricaBatterie} piano={piano} onVaiAbbonamento={() => setPage("abbonamento")} />}
        {page === "documenti-controllo" && <DocumentiControllo azienda={azienda} impianti={impianti} />}
        {page === "impostazioni" && <Impostazioni azienda={azienda} setAzienda={salvaProfiloAzienda} piano={piano} moduli={moduli} onSalvaModuli={salvaModuli} />}
        {page === "abbonamento" && <Abbonamento piano={piano} />}
        {page === "preventivi" && <Preventivi preventivi={preventivi} azienda={azienda} piano={piano} onReload={loadData} onVaiAbbonamento={() => setPage("abbonamento")} />}
        {page === "batterie" && <Batterie batterie={batterie} droni={droni} piano={piano} onReload={caricaBatterie} onVaiAbbonamento={() => setPage("abbonamento")} />}
        {page === "permessi" && <Permessi permessi={permessi} impianti={impianti} azienda={azienda} piano={piano} onReload={loadData} />}
        {page === "attestati" && <Attestati attestati={attestati} azienda={azienda} onReload={loadData} obiettivoFormativo={obiettivoFormativo} onSalvaObiettivo={salvaObiettivoFormativo} />}
        {page === "droni" && <Droni droni={droni} azienda={azienda} onReload={loadData} />}
      </div>
    </div>
  );
}

// --- Pagina di presentazione (prima del login) -----------------------------------------------

const FUNZIONI_PRESENTAZIONE = [
  { emoji: "📒", titolo: "Registro voli", testo: "Ogni volo con data, luogo, drone, batterie e durata. Foto e video allegati, esportazione PDF e CSV." },
  { emoji: "🌅", titolo: "Pianificazione e ora d'oro", testo: "Meteo, vento rispetto al tuo drone, indice Kp, alba, tramonto, ora d'oro e ora blu del luogo in cui voli." },
  { emoji: "📤", titolo: "Consegna al cliente", testo: "Un link con la galleria di foto e video del volo, col tuo logo. Il cliente scarica i file senza account." },
  { emoji: "🔋", titolo: "Batterie sotto controllo", testo: "Cicli, stato di carica e avvisi quando una batteria resta troppo a lungo carica o va sostituita." },
  { emoji: "🪪", titolo: "Pilota in regola", testo: "Attestati, assicurazione, droni e permessi in un posto solo, con avvisi di scadenza e documenti pronti per i controlli." },
  { emoji: "🔍", titolo: "Ispezioni e report", testo: "Fotovoltaico, edifici, danni: anomalie sulle foto termiche e report PDF professionali per il cliente." },
];

function Presentazione({ onAccedi, onRegistrati }) {
  const bottonePrimario = { background: "linear-gradient(90deg, #e0552f, #ff8c42)", color: "#161a1f", border: "none", borderRadius: 8, padding: "12px 22px", fontWeight: 700, fontSize: 15 };
  const bottoneSecondario = { background: "transparent", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 8, padding: "12px 22px", fontWeight: 600, fontSize: 15 };
  const riquadro = { background: "#1b2028", border: "1px solid #262b33", borderRadius: 12 };

  return (
    <div className="lp" style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: "#e7eaee", minHeight: "100vh" }}>
      <style>{`
        .lp button { cursor: pointer; font-family: inherit; }
        .lp button:hover { filter: brightness(1.08); }
        .lp-wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
        .lp-hero { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px; align-items: center; padding-top: 56px; padding-bottom: 64px; }
        .lp-hero h1 { font-size: 46px; line-height: 1.08; margin: 0 0 18px 0; letter-spacing: -0.02em; }
        .lp-griglia { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .lp-solo-largo { display: inline; }
        @media (max-width: 820px) {
          .lp-hero { grid-template-columns: 1fr; gap: 32px; padding-top: 32px; padding-bottom: 44px; }
          .lp-hero h1 { font-size: 34px; }
          .lp-griglia { grid-template-columns: 1fr; }
          .lp-solo-largo { display: none; }
        }
      `}</style>

      <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(16, 18, 26, 0.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid #1f242c" }}>
        <div className="lp-wrap" style={{ display: "flex", alignItems: "center", gap: 10, height: 64 }}>
          <img src={LOGO_EYEDRONES} alt="" style={{ width: 34, height: 34 }} />
          <span style={{ fontWeight: 700, fontSize: 17 }}>Eyedrones</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={onAccedi} style={{ ...bottoneSecondario, padding: "8px 14px", fontSize: 14, border: "none" }}>Accedi</button>
            <button onClick={onRegistrati} style={{ ...bottonePrimario, padding: "8px 14px", fontSize: 14 }}>Registrati<span className="lp-solo-largo"> gratis</span></button>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div>
            <div style={{ display: "inline-block", fontSize: 12.5, fontWeight: 600, color: "#ffb877", background: "#ff8c4218", border: "1px solid #ff8c4240", borderRadius: 999, padding: "4px 12px", marginBottom: 16 }}>Per riprese, FPV e ispezioni</div>
            <h1>L'app per piloti di droni.<br /><span style={{ background: "linear-gradient(90deg, #a06bff, #ff8c42)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Tutto il tuo volo, in un posto solo.</span></h1>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "#aab3bf", margin: "0 0 26px 0", maxWidth: 520 }}>
              Pianifica con meteo e ora d'oro, registra voli e batterie, tieni in ordine attestati e documenti e consegna foto e video ai tuoi clienti con un link.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={onRegistrati} style={bottonePrimario}>Inizia gratis</button>
              <button onClick={onAccedi} style={bottoneSecondario}>Ho già un account</button>
            </div>
            <p style={{ fontSize: 13, color: "#6b7480", marginTop: 14 }}>Gratis per iniziare, senza carta di credito. Funziona su telefono e computer.</p>
          </div>

          {/* anteprima illustrativa dell'app */}
          <div style={{ ...riquadro, padding: 18, boxShadow: "0 30px 80px rgba(126, 58, 242, 0.18)", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #7e3af2, #ff8c42)" }} />
            <p style={{ fontSize: 12, color: "#6b7480", margin: "4px 0 10px 0" }}>Sabato · Lago di Viverone</p>
            <div style={{ background: "#161a1f", border: "1px solid #4ade8055", borderRadius: 8, padding: 12, fontSize: 13.5, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div>💨 max 14 km/h</div><div>🌧️ 0 mm</div>
              <div>🧲 Kp 2 · GPS ok</div><div style={{ color: "#4ade80", fontWeight: 700 }}>✓ Si vola</div>
            </div>
            <div style={{ background: "#161a1f", border: "1px solid #f5b94255", borderRadius: 8, padding: 12, fontSize: 13.5, marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <div>🌅 Alba 07:21</div><div>🌇 Tramonto 19:04</div>
              <div style={{ color: "#f5b942" }}>✨ 06:58 – 08:02</div><div style={{ color: "#f5b942" }}>✨ 18:22 – 19:27</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {[["🎬", "Video", "#a78bfa", "DJI Mini 4 Pro · 22 min"], ["🥽", "FPV", "#ff8c42", "Avata 2 · 9 min"]].map(([e, t, c, d]) => (
                <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>
                  <span style={{ color: "#aab3bf" }}>{d}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: c + "22", color: c }}>{e} {t}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-wrap" style={{ paddingBottom: 56 }}>
          <h2 style={{ fontSize: 26, margin: "0 0 6px 0" }}>Cosa puoi fare con Eyedrones</h2>
          <p style={{ color: "#8b95a3", margin: "0 0 22px 0", fontSize: 15 }}>Scegli tu cosa usare: solo riprese, solo ispezioni o entrambe.</p>
          <div className="lp-griglia">
            {FUNZIONI_PRESENTAZIONE.map((f) => (
              <div key={f.titolo} style={{ ...riquadro, padding: 20 }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{f.emoji}</div>
                <h3 style={{ fontSize: 16, margin: "0 0 6px 0" }}>{f.titolo}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: "#aab3bf", margin: 0 }}>{f.testo}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-wrap" style={{ paddingBottom: 64 }}>
          <div style={{ ...riquadro, padding: "32px 24px", textAlign: "center", background: "linear-gradient(135deg, rgba(126, 58, 242, 0.16), rgba(255, 140, 66, 0.12)), #1b2028" }}>
            <h2 style={{ fontSize: 26, margin: "0 0 8px 0" }}>Pronto a decollare?</h2>
            <p style={{ color: "#aab3bf", margin: "0 0 20px 0", fontSize: 15 }}>Crea l'account in un minuto e registra il tuo primo volo.</p>
            <button onClick={onRegistrati} style={bottonePrimario}>Registrati gratis</button>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid #1f242c" }}>
        <div className="lp-wrap" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", padding: "20px", fontSize: 13, color: "#6b7480" }}>
          <span>© {new Date().getFullYear()} Eyedrones</span>
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#8b95a3", textDecoration: "none" }}>Contatti</a>
          <a href="https://www.d-flight.it/web-app/" target="_blank" rel="noreferrer" style={{ color: "#8b95a3", textDecoration: "none" }}>D-Flight ↗</a>
        </div>
      </footer>
    </div>
  );
}

// schermata di chi non ha fatto l'accesso: presentazione, poi login o registrazione
function Accesso() {
  const iniziale = () => {
    const h = window.location.hash;
    return h === "#accedi" ? "login" : h === "#registrati" ? "registrati" : null;
  };
  const [modo, setModo] = useState(iniziale);

  useEffect(() => {
    const suCambio = () => setModo(iniziale());
    window.addEventListener("hashchange", suCambio);
    return () => window.removeEventListener("hashchange", suCambio);
  }, []);

  // uso l'hash dell'indirizzo, così il tasto "indietro" del telefono riporta alla presentazione
  const apri = (m) => { window.location.hash = m === "login" ? "accedi" : "registrati"; window.scrollTo(0, 0); };
  const torna = () => { if (window.location.hash) window.history.back(); else setModo(null); };

  if (!modo) return <Presentazione onAccedi={() => apri("login")} onRegistrati={() => apri("registrati")} />;
  return <Login key={modo} modoIniziale={modo} onTorna={torna} />;
}

// --- Login / Registrazione -----------------------------------------------------------

function Login({ modoIniziale = "login", onTorna }) {
  const [modo, setModo] = useState(modoIniziale); // login | registrati | recupera
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState(null);
  const [caricamento, setCaricamento] = useState(false);
  const [messaggio, setMessaggio] = useState(null);

  const invia = async (e) => {
    e.preventDefault();
    setErrore(null);
    setMessaggio(null);
    setCaricamento(true);
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (modo === "registrati") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessaggio("Account creato — controlla la tua email per confermare, poi accedi.");
      } else if (modo === "recupera") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessaggio("Ti abbiamo inviato una email con il link per reimpostare la password.");
      }
    } catch (err) {
      setErrore(err.message || "Errore durante l'accesso");
    }
    setCaricamento(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", fontFamily: "'IBM Plex Sans', sans-serif", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 340 }}>
        {onTorna && (
          <button type="button" onClick={onTorna} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 13, padding: 0, marginBottom: 18, cursor: "pointer", fontFamily: "inherit" }}>&larr; Torna alla presentazione</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 26, position: "relative" }}>
          <div style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,140,66,0.22), rgba(126,58,242,0.14) 60%, transparent 75%)", filter: "blur(2px)", zIndex: 0 }} />
          <img src={LOGO_EYEDRONES} alt="Eyedrones" style={{ width: 52, height: 52, objectFit: "contain", position: "relative", zIndex: 1 }} />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, position: "relative", zIndex: 1 }}>Eyedrones</span>
        </div>
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 22, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #7e3af2, #ff8c42)" }} />
          {modo !== "recupera" && (
            <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              <button type="button" onClick={() => setModo("login")} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: modo === "login" ? "linear-gradient(90deg, #e0552f, #ff8c42)" : "#262b33", color: modo === "login" ? "#161a1f" : "#8b95a3", fontWeight: 600, fontSize: 12.5 }}>Accedi</button>
              <button type="button" onClick={() => setModo("registrati")} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "none", background: modo === "registrati" ? "linear-gradient(90deg, #e0552f, #ff8c42)" : "#262b33", color: modo === "registrati" ? "#161a1f" : "#8b95a3", fontWeight: 600, fontSize: 12.5 }}>Registrati</button>
            </div>
          )}
          {modo === "recupera" && (
            <p style={{ fontSize: 12.5, color: "#8b95a3", margin: "0 0 14px 0" }}>Inserisci la tua email, ti mandiamo un link per reimpostare la password.</p>
          )}
          <form onSubmit={invia} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            {modo !== "recupera" && (
              <input type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} minLength={6} />
            )}
            {errore && <p style={{ color: "#ff9c9c", fontSize: 12, margin: 0 }}>{errore}</p>}
            {messaggio && <p style={{ color: "#4ade80", fontSize: 12, margin: 0 }}>{messaggio}</p>}
            <button type="submit" disabled={caricamento} style={{ marginTop: 4, background: "linear-gradient(90deg, #e0552f, #ff8c42)", color: "#161a1f", border: "none", padding: "10px 0", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
              {caricamento ? "Attendi..." : modo === "login" ? "Accedi" : modo === "registrati" ? "Crea account" : "Invia link"}
            </button>
          </form>
          {modo === "login" && (
            <button type="button" onClick={() => { setModo("recupera"); setErrore(null); setMessaggio(null); }} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12, marginTop: 12, padding: 0, width: "100%", textAlign: "center" }}>
              Password dimenticata?
            </button>
          )}
          {modo === "recupera" && (
            <button type="button" onClick={() => { setModo("login"); setErrore(null); setMessaggio(null); }} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12, marginTop: 12, padding: 0, width: "100%", textAlign: "center" }}>
              &larr; Torna al login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sidebar -----------------------------------------------------------

function Sidebar({ page, setPage, userEmail, piano, reportQuestoMese, attestatiInScadenza, droniInScadenza, usaIspezioni, batterieAvvisi }) {
  const items = [
    { key: "dashboard", label: "Panoramica", icon: LayoutDashboard },
    ...(usaIspezioni ? [
      { intestazione: "Ispezioni" },
      { key: "impianti", label: "Impianti", icon: Sun },
      { key: "nuova", label: "Nuova ispezione", icon: Plus },
    ] : []),
    { intestazione: "Voli e riprese" },
    { key: "pianificazione", label: "Pianificazione volo", icon: CalendarDays },
    { key: "registro-voli", label: "Registro voli", icon: BookOpen },
    { key: "galleria", label: "Foto e video", icon: Camera },
    { key: "batterie", label: "Batterie", icon: BatteryCharging },
    { intestazione: "Pilota" },
    { key: "documenti-controllo", label: "Documenti controllo", icon: ShieldCheck },
    { key: "dflight", label: "D-Flight", icon: MapPin, esterno: "https://www.d-flight.it/web-app/" },
    { key: "permessi", label: "Permessi", icon: ShieldCheck },
    { key: "attestati", label: "Attestati", icon: Award },
    { key: "droni", label: "I miei droni", icon: Plane },
    { intestazione: "Lavoro" },
    { key: "preventivi", label: "Preventivi", icon: FileText },
    { intestazione: "Account" },
    { key: "abbonamento", label: "Abbonamento", icon: Zap },
    { key: "impostazioni", label: "Impostazioni azienda", icon: Settings },
  ];
  const avvisi = { attestati: attestatiInScadenza, droni: droniInScadenza, batterie: batterieAvvisi };
  return (
    <>
    <div className="sidebar" style={{ background: "#12151a", borderRight: "1px solid #262b33", padding: "20px 14px", display: "flex", flexShrink: 0 }}>
      <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 18px 8px", marginBottom: 4, borderBottom: "1px solid #262b33", position: "relative" }}>
        <img src={LOGO_EYEDRONES} alt="Eyedrones" style={{ width: 36, height: 36, objectFit: "contain", flexShrink: 0 }} />
        <span className="sidebar-brand-label" style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Eyedrones</span>
        <div style={{ position: "absolute", bottom: -1, left: 0, width: 46, height: 2, background: "linear-gradient(90deg, #7e3af2, #ff8c42)" }} />
      </div>
      {items.map((it) => {
        if (it.intestazione) {
          return (
            <div key={"h-" + it.intestazione} className="sidebar-label" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#5b6572", padding: "14px 10px 4px 10px" }}>
              {it.intestazione}
            </div>
          );
        }
        const Icon = it.icon;
        if (it.esterno) {
          return (
            <a
              key={it.key}
              href={it.esterno}
              target="_blank"
              rel="noreferrer"
              className="nav-item"
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6,
                background: "transparent", border: "none", color: "#9aa4b2",
                fontSize: 13.5, fontWeight: 500, textAlign: "left", whiteSpace: "nowrap",
                borderLeft: "2px solid transparent", textDecoration: "none",
              }}
            >
              <Icon size={16} strokeWidth={2} />
              <span className="sidebar-label">{it.label}</span>
              <span className="sidebar-label" style={{ fontSize: 10.5, marginLeft: "auto", color: "#6b7480" }}>↗</span>
            </a>
          );
        }
        const active = page === it.key || (page === "impianto" && it.key === "impianti");
        return (
          <button
            key={it.key}
            className={`nav-item${active ? " active" : ""}`}
            onClick={() => setPage(it.key)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6,
              background: active ? "#1f2530" : "transparent", border: "none", color: active ? "#fff" : "#9aa4b2",
              fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: "left", whiteSpace: "nowrap",
              borderLeft: active ? "2px solid #ff8c42" : "2px solid transparent",
            }}
          >
            <Icon size={16} strokeWidth={2} />
            <span className="sidebar-label">{it.label}</span>
            {it.key === "preventivi" && piano !== "pro" && <span className="sidebar-label" style={{ fontSize: 11, marginLeft: "auto" }}>🔒</span>}
            {it.key === "attestati" && attestatiInScadenza > 0 && (
              <span className="sidebar-label" style={{ fontSize: 10.5, fontWeight: 700, marginLeft: "auto", background: "#ff4d4d", color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{attestatiInScadenza}</span>
            )}
            {it.key === "droni" && droniInScadenza > 0 && (
              <span className="sidebar-label" style={{ fontSize: 10.5, fontWeight: 700, marginLeft: "auto", background: "#ff4d4d", color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{droniInScadenza}</span>
            )}
            {it.key === "batterie" && batterieAvvisi > 0 && (
              <span className="sidebar-label" style={{ fontSize: 10.5, fontWeight: 700, marginLeft: "auto", background: "#ff4d4d", color: "#fff", borderRadius: 10, padding: "1px 7px" }}>{batterieAvvisi}</span>
            )}
          </button>
        );
      })}
      <div className="sidebar-label" style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid #262b33" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px 8px 10px" }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: piano === "pro" ? "#1d3a2a" : piano === "pilota" ? "#16263d" : "#2a2416", color: COLORE_PIANO[piano] || "#f5b942" }}>{(NOME_PIANO[piano] || "Free").toUpperCase()}</span>
          {piano !== "pro" && <span style={{ fontSize: 10.5, color: "#6b7480" }}>{reportQuestoMese}/{LIMITI_FREE.reportMese} report</span>}
        </div>
        <div style={{ fontSize: 11, color: "#6b7480", padding: "0 10px 8px 10px", wordBreak: "break-all" }}>{userEmail}</div>
        <a href={`mailto:${SUPPORT_EMAIL}`} style={{ display: "block", fontSize: 11, color: "#3d8bfd", padding: "0 10px 8px 10px", textDecoration: "none" }}>
          Assistenza
        </a>
        <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#2a1616", border: "1px solid #5a2a2a", color: "#ff9c9c", borderRadius: 6, padding: "9px 10px", fontSize: 13, fontWeight: 600 }}>
          <LogOut size={14} /> Esci
        </button>
      </div>
    </div>
    <MenuTelefono items={items} page={page} setPage={setPage} userEmail={userEmail} piano={piano} usaIspezioni={usaIspezioni} avvisi={avvisi} />
    </>
  );
}

// menu per il telefono: barra fissa in basso con le 5 voci principali, il resto nel pannello "Altro"
function MenuTelefono({ items, page, setPage, userEmail, piano, usaIspezioni, avvisi }) {
  const [altroAperto, setAltroAperto] = useState(false);
  const principali = [
    { key: "dashboard", label: "Home", icon: LayoutDashboard },
    usaIspezioni ? { key: "impianti", label: "Impianti", icon: Sun } : { key: "galleria", label: "Galleria", icon: Camera },
    { key: "registro-voli", label: "Registro", icon: BookOpen },
    { key: "pianificazione", label: "Pianifica", icon: CalendarDays },
  ];
  const chiaviPrincipali = principali.map((p) => p.key);
  const attivo = (key) => page === key || (page === "impianto" && key === "impianti");
  const altroAttivo = !chiaviPrincipali.some(attivo) && page !== "impianto";
  const totaleAvvisi = Object.values(avvisi).reduce((s, n) => s + (n || 0), 0);
  const titoloPagina = (items.find((it) => it.key === page) || {}).label || (page === "impianto" ? "Impianto" : "");

  useEffect(() => {
    if (!altroAperto) return;
    const chiudi = (e) => e.key === "Escape" && setAltroAperto(false);
    window.addEventListener("keydown", chiudi);
    return () => window.removeEventListener("keydown", chiudi);
  }, [altroAperto]);

  const scegli = (key) => { setAltroAperto(false); setPage(key); window.scrollTo(0, 0); };

  const bollino = (n) => n > 0 && (
    <span style={{ fontSize: 10, fontWeight: 700, background: "#ff4d4d", color: "#fff", borderRadius: 10, padding: "1px 6px", marginLeft: "auto" }}>{n}</span>
  );

  return (
    <div className="menu-telefono">
      <header className="mt-topbar">
        <img src={LOGO_EYEDRONES} alt="" style={{ width: 28, height: 28 }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Eyedrones</span>
        {titoloPagina && titoloPagina !== "Panoramica" && <span style={{ color: "#6b7480", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {titoloPagina}</span>}
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: piano === "pro" ? "#1d3a2a" : piano === "pilota" ? "#16263d" : "#2a2416", color: COLORE_PIANO[piano] || "#f5b942" }}>{(NOME_PIANO[piano] || "Free").toUpperCase()}</span>
      </header>

      <nav className="mt-tabbar" aria-label="Menu principale">
        {principali.map((it) => {
          const Icon = it.icon;
          const on = attivo(it.key);
          return (
            <button key={it.key} onClick={() => scegli(it.key)} className={`mt-tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
              <Icon size={21} strokeWidth={on ? 2.4 : 2} />
              <span>{it.label}</span>
            </button>
          );
        })}
        <button onClick={() => setAltroAperto(true)} className={`mt-tab${altroAttivo || altroAperto ? " on" : ""}`} aria-expanded={altroAperto}>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <MoreHorizontal size={21} strokeWidth={2} />
            {totaleAvvisi > 0 && <span style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: "50%", background: "#ff4d4d" }} />}
          </span>
          <span>Altro</span>
        </button>
      </nav>

      {altroAperto && (
        <div className="mt-overlay" onClick={() => setAltroAperto(false)}>
          <div className="mt-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Altre sezioni">
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#333a45", margin: "0 auto 10px auto" }} />
            {items.filter((it) => it.intestazione || !chiaviPrincipali.includes(it.key)).map((it, idx, arr) => {
              if (it.intestazione) {
                const prossima = arr[idx + 1];
                if (!prossima || prossima.intestazione) return null; // intestazione rimasta senza voci
                return <div key={"h-" + it.intestazione} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#5b6572", padding: "12px 6px 4px 6px" }}>{it.intestazione}</div>;
              }
              const Icon = it.icon;
              const stile = { display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "11px 8px", borderRadius: 8, background: page === it.key ? "#1f2530" : "transparent", border: "none", color: page === it.key ? "#fff" : "#c3cad4", fontSize: 14.5, textAlign: "left", textDecoration: "none" };
              if (it.esterno) {
                return <a key={it.key} href={it.esterno} target="_blank" rel="noreferrer" style={stile}><Icon size={18} /> {it.label} <span style={{ marginLeft: "auto", color: "#6b7480", fontSize: 12 }}>↗</span></a>;
              }
              return (
                <button key={it.key} onClick={() => scegli(it.key)} style={stile}>
                  <Icon size={18} /> {it.label}
                  {it.key === "preventivi" && piano !== "pro" && <span style={{ marginLeft: "auto", fontSize: 12 }}>🔒</span>}
                  {bollino(avvisi[it.key])}
                </button>
              );
            })}
            <div style={{ borderTop: "1px solid #262b33", marginTop: 10, paddingTop: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#6b7480", flex: 1, minWidth: 0, wordBreak: "break-all" }}>{userEmail}</span>
              <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontSize: 13, color: "#3d8bfd", textDecoration: "none" }}>Assistenza</a>
              <button onClick={() => supabase.auth.signOut()} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 6, padding: "7px 12px", fontSize: 13 }}>
                <LogOut size={14} /> Esci
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Dashboard -----------------------------------------------------------

function TitoloSezione({ emoji, titolo, azione }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 12px 0", paddingBottom: 8, borderBottom: "1px solid #262b33" }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 8 }}><span>{emoji}</span>{titolo}</h2>
      {azione}
    </div>
  );
}

// scelta di cosa fa il pilota con il drone: decide quali sezioni vedere nel menu e nella prima pagina
function SelettoreModuli({ moduli, onSave, testoBottone = "Conferma" }) {
  const daModuli = (m) => ({ ispezioni: !m || m.includes("ispezioni"), riprese: !m || m.includes("riprese") });
  const [sel, setSel] = useState(daModuli(moduli));
  const [salvando, setSalvando] = useState(false);
  const [salvato, setSalvato] = useState(false);
  useEffect(() => { setSel(daModuli(moduli)); }, [moduli]);
  const nessuno = !sel.ispezioni && !sel.riprese;

  const salva = async () => {
    if (nessuno) return;
    setSalvando(true);
    await onSave([sel.ispezioni ? "ispezioni" : null, sel.riprese ? "riprese" : null].filter(Boolean).join(","));
    setSalvando(false);
    setSalvato(true);
    setTimeout(() => setSalvato(false), 2500);
  };

  const opzione = (chiave, emoji, titolo, testo) => (
    <button
      type="button"
      onClick={() => setSel({ ...sel, [chiave]: !sel[chiave] })}
      style={{ textAlign: "left", flex: 1, minWidth: 230, background: sel[chiave] ? "#241d16" : "#161a1f", border: sel[chiave] ? "1px solid #ff8c42" : "1px solid #333a45", borderRadius: 8, padding: "12px 14px", color: "#e7eaee" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>
        <span style={{ fontSize: 18 }}>{emoji}</span>{titolo}
        <span style={{ marginLeft: "auto", color: sel[chiave] ? "#ff8c42" : "#4a505a", fontSize: 15 }}>{sel[chiave] ? "✓" : "○"}</span>
      </div>
      <div style={{ fontSize: 11.5, color: "#8b95a3", marginTop: 4, lineHeight: 1.4 }}>{testo}</div>
    </button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {opzione("ispezioni", "🔍", "Ispezioni tecniche", "Fotovoltaico, edifici, danni, impianti elettrici: impianti, report con foto e anomalie, pianificazione dei voli.")}
        {opzione("riprese", "🎬", "Video, foto e FPV", "Registro voli con galleria di foto e video, per chi vola per riprese, lavoro o passione.")}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" onClick={salva} disabled={nessuno || salvando} style={{ background: nessuno ? "#333a45" : "#ff8c42", color: nessuno ? "#6b7480" : "#161a1f", border: "none", padding: "8px 18px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {salvando ? "Salvataggio..." : testoBottone}
        </button>
        {nessuno && <span style={{ fontSize: 11.5, color: "#f5b942" }}>Scegline almeno una.</span>}
        {salvato && <span style={{ fontSize: 11.5, color: "#4ade80" }}>✓ Salvato</span>}
      </div>
    </div>
  );
}

function Dashboard({ impianti, loading, onOpenImpianto, onNuova, numIspezioni, usaIspezioni, usaRiprese, moduli, onSalvaModuli, voli, attestati, droni, batterie, onNav, onNuovoVolo, onAggiungiFile }) {
  const totKwp = impianti.reduce((s, i) => s + (Number(i.kwp) || 0), 0);
  const totAnomalie = impianti.reduce((s, i) => s + i.anomalie, 0);

  const minutiVoli = voli.reduce((s, v) => s + (Number(v.durata_minuti) || 0), 0);
  const annoCorrente = String(new Date().getFullYear());
  const voliAnno = voli.filter((v) => (v.data || "").startsWith(annoCorrente)).length;
  const ultimiVoli = voli.slice(0, 4);

  // scadenze di attestati e manutenzioni dei droni (valide per tutti i piloti)
  const voci = [
    ...attestati.filter((a) => a.data_scadenza).map((a) => ({ id: "a" + a.id, nome: a.tipo, stato: statoScadenza(a.data_scadenza), vai: "attestati" })),
    ...droni.filter((d) => d.prossima_manutenzione).map((d) => ({ id: "d" + d.id, nome: `Manutenzione — ${d.nome}`, stato: statoManutenzione(d.prossima_manutenzione), vai: "droni" })),
    ...(batterie || []).flatMap((b) => avvisiBatteria(b).map((a, i) => ({ id: `b${b.id}-${i}`, nome: `Batteria — ${b.nome}`, stato: a, vai: "batterie" }))),
  ];
  const batterieAttive = (batterie || []).filter((b) => !b.ritirata).length;
  const urgenti = voci.filter((v) => v.stato && v.stato.livello !== "ok");

  const bloccoScadenze = (
    <section style={{ marginBottom: 28 }}>
      <TitoloSezione emoji="🪪" titolo="Scadenze e avvisi" />
      {urgenti.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {urgenti.map((v) => (
            <button key={v.id} onClick={() => onNav(v.vai)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", textAlign: "left", background: "#1b2028", border: `1px solid ${v.stato.colore}55`, borderRadius: 8, padding: "10px 14px", color: "#e7eaee", fontSize: 13 }}>
              <span>{v.nome}</span>
              <span style={{ color: v.stato.colore, fontWeight: 600, fontSize: 12 }}>{v.stato.testo}</span>
            </button>
          ))}
        </div>
      ) : voci.length > 0 || batterieAttive > 0 ? (
        <div style={{ background: "#16221b", border: "1px solid #24422f", borderRadius: 8, padding: "10px 14px", color: "#4ade80", fontSize: 12.5 }}>
          ✓ Tutto in regola: nessun attestato, manutenzione o batteria da controllare.
        </div>
      ) : (
        <EmptyState text="Aggiungi i tuoi attestati, droni e batterie per tenere d'occhio scadenze e manutenzioni." />
      )}
    </section>
  );

  const sottotitolo = [
    usaIspezioni ? `${impianti.length} ${impianti.length === 1 ? "impianto monitorato" : "impianti monitorati"}` : null,
    usaRiprese ? `${voli.length} ${voli.length === 1 ? "volo registrato" : "voli registrati"}` : null,
  ].filter(Boolean).join(" · ");
  const btnPrimario = { display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Panoramica</h1>
        <p style={{ color: "#8b95a3", fontSize: 13.5, margin: "4px 0 0 0" }}>{sottotitolo}</p>
      </div>

      {moduli === null && (
        <div style={{ background: "linear-gradient(135deg, #241d16, #1b2028)", border: "1px solid #4a2f16", borderRadius: 10, padding: 18, marginBottom: 28, maxWidth: 720 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0" }}>Come usi il drone?</h3>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "0 0 14px 0" }}>Scegli cosa ti serve: mostreremo solo le sezioni giuste nel menu e in questa pagina. Puoi cambiare idea quando vuoi da Impostazioni.</p>
          <SelettoreModuli moduli={moduli} onSave={onSalvaModuli} testoBottone="Conferma" />
        </div>
      )}

      {urgenti.length > 0 && bloccoScadenze}

      {usaIspezioni && (
        <section style={{ marginBottom: 28 }}>
          <TitoloSezione emoji="🔍" titolo="Ispezioni" azione={<button onClick={onNuova} style={btnPrimario}><Plus size={14} /> Nuova ispezione</button>} />
          {loading ? (
            <LoadingBlock />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 18 }}>
                <StatCard label="Potenza monitorata" value={`${(totKwp / 1000).toFixed(2)} MWp`} sub={`su ${impianti.length} ${impianti.length === 1 ? "impianto" : "impianti"}`} />
                <StatCard label="Anomalie aperte" value={totAnomalie} sub={`su ${impianti.filter((i) => i.anomalie > 0).length} ${impianti.filter((i) => i.anomalie > 0).length === 1 ? "impianto" : "impianti"}`} accent="#ff8c42" />
                <StatCard label="Ispezioni totali" value={numIspezioni} sub="registrate a sistema" />
              </div>
              {impianti.length === 0 ? (
                <EmptyState text="Nessun impianto ancora. Vai su 'Impianti' per aggiungerne uno." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {impianti.map((imp) => (
                    <ImpiantoRow key={imp.id} imp={imp} onClick={() => onOpenImpianto(imp)} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {usaRiprese && (
        <section style={{ marginBottom: 28 }}>
          <TitoloSezione emoji="🎬" titolo="Voli e riprese" azione={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...btnPrimario, cursor: "pointer" }}>
                <Camera size={14} /> Aggiungi foto o video
                <input type="file" accept="image/*,video/*" multiple onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ""; if (files.length > 0) onAggiungiFile(files); }} style={{ display: "none" }} />
              </label>
              <button onClick={onNuovoVolo} style={{ ...btnPrimario, background: "#262b33", color: "#e7eaee", border: "1px solid #333a45" }}><Plus size={14} /> Nuovo volo</button>
            </div>
          } />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 14 }}>
            <StatCard label="Voli registrati" value={voli.length} sub="nel tuo registro" />
            <StatCard label="Tempo di volo" value={formattaDurata(minutiVoli)} sub="dove la durata è indicata" accent="#ff8c42" />
            <StatCard label={`Voli nel ${annoCorrente}`} value={voliAnno} sub="da inizio anno" />
          </div>
          {ultimiVoli.length === 0 ? (
            <EmptyState text="Nessun volo ancora. Tocca «Aggiungi foto o video» per iniziare: creiamo noi il volo di oggi con quello che scegli." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {ultimiVoli.map((v) => {
                const tipo = TIPI_ATTIVITA_VOLO.find((t) => t.key === v.tipo_attivita) || TIPI_ATTIVITA_VOLO[TIPI_ATTIVITA_VOLO.length - 1];
                const dettaglio = [v.luogo, v.drone_nome, v.durata_minuti ? formattaDurata(v.durata_minuti) : null].filter(Boolean).join(" · ");
                return (
                  <button key={v.id} onClick={() => onNav("registro-voli")} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", textAlign: "left", background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "10px 14px", color: "#e7eaee" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{formatData(v.data)}</div>
                      <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>{dettaglio || "—"}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: tipo.colore + "22", color: tipo.colore }}>{tipo.emoji} {tipo.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={() => onNav("registro-voli")} style={{ marginTop: 10, background: "none", border: "none", color: "#3d8bfd", fontSize: 12.5, padding: 0 }}>
            Apri il registro voli e la galleria →
          </button>
        </section>
      )}

      {urgenti.length === 0 && bloccoScadenze}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b95a3", fontSize: 13, padding: "30px 0" }}>
      <Loader2 size={16} className="spin" /> Caricamento dati dal database...
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ border: "1px dashed #333a45", borderRadius: 8, padding: "24px 16px", textAlign: "center", color: "#8b95a3", fontSize: 13 }}>
      {text}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#8b95a3", marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: accent || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#6b7480", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function ImpiantoRow({ imp, onClick, onDelete, onEdit }) {
  return (
    <div onClick={onClick} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "13px 16px", textAlign: "left", flexWrap: "wrap", gap: 8, cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: imp.anomalie > 4 ? "#ff4d4d" : imp.anomalie > 0 ? "#f5b942" : "#4ade80", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{imp.nome}</div>
          <div style={{ fontSize: 12, color: "#8b95a3", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <MapPin size={11} /> {imp.zona} &middot; {imp.cliente}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {imp.kwp ? <div className="mono" style={{ fontSize: 12.5, color: "#c3cad4" }}>{imp.kwp} kWp</div> : null}
        <div style={{ fontSize: 12.5, color: imp.anomalie > 0 ? "#ff8c42" : "#4ade80" }}>{imp.anomalie} anomalie</div>
        <div style={{ fontSize: 12, color: "#6b7480" }}>{imp.ultima}</div>
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
            Apri
          </button>
        )}
        {onEdit && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
            Modifica
          </button>
        )}
        {onDelete && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
            Elimina
          </button>
        )}
        <ChevronRight size={15} color="#6b7480" />
      </div>
    </div>
  );
}

// --- Lista impianti -----------------------------------------------------------

function ListaImpianti({ impianti, loading, onReload, onOpenImpianto, ispezioni, fotoAll }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nome: "", zona: "", kwp: "", cliente: "" });
  const [saving, setSaving] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);

  const resetForm = () => {
    setForm({ nome: "", zona: "", kwp: "", cliente: "" });
    setEditingId(null);
  };

  const apriModifica = (imp) => {
    setEditingId(imp.id);
    setForm({ nome: imp.nome || "", zona: imp.zona || "", kwp: imp.kwp != null ? String(imp.kwp) : "", cliente: imp.cliente || "" });
    setShowForm(true);
  };

  const salva = async () => {
    if (!form.nome) return;
    setSaving(true);
    const payload = { nome: form.nome, zona: form.zona, kwp: form.kwp ? Number(form.kwp) : null, cliente: form.cliente };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("impianti").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("impianti").insert(payload));
    }
    setSaving(false);
    if (error) { alert("Salvataggio non riuscito: " + error.message); return; }
    resetForm();
    setShowForm(false);
    onReload();
  };

  const eliminaImpianto = async (id, nome) => {
    if (!window.confirm(`Eliminare "${nome}"? Verranno eliminate anche tutte le sue ispezioni e anomalie. L'operazione non è reversibile.`)) return;
    setEliminandoId(id);
    const idIspezioniImpianto = ispezioni.filter((i) => i.impianto_id === id).map((i) => i.id);
    const percorsiFoto = fotoAll.filter((f) => idIspezioniImpianto.includes(f.ispezione_id)).map((f) => percorsoStorageDaUrl(f.url)).filter(Boolean);
    if (percorsiFoto.length > 0) await supabase.storage.from("foto-ispezioni").remove(percorsiFoto);
    const { error } = await supabase.from("impianti").delete().eq("id", id);
    setEliminandoId(null);
    if (error) { alert("Eliminazione non riuscita: " + error.message); return; }
    onReload();
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Impianti</h1>
        <button onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm ? "Annulla" : <><Plus size={14} /> Nuovo impianto</>}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 16, marginBottom: 20, maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 }}>
          {editingId && <div style={{ fontSize: 12, color: "#ff8c42", fontWeight: 600 }}>Stai modificando un impianto esistente</div>}
          <input placeholder="Nome impianto" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          <input placeholder="Zona / località" value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })} style={inputStyle} />
          <input placeholder="Potenza (kWp)" type="number" value={form.kwp} onChange={(e) => setForm({ ...form, kwp: e.target.value })} style={inputStyle} />
          <input placeholder="Cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} style={inputStyle} />
          <button onClick={salva} disabled={!form.nome || saving} style={{ marginTop: 6, background: form.nome ? "#ff8c42" : "#333a45", color: form.nome ? "#161a1f" : "#6b7480", border: "none", padding: "9px 0", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {saving ? "Salvataggio..." : editingId ? "Aggiorna impianto" : "Salva impianto"}
          </button>
        </div>
      )}

      {loading ? <LoadingBlock /> : impianti.length === 0 ? (
        <EmptyState text="Nessun impianto ancora. Aggiungine uno con il pulsante qui sopra." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {impianti.map((imp) => (
            <ImpiantoRow key={imp.id} imp={imp} onClick={() => onOpenImpianto(imp)} onEdit={() => apriModifica(imp)} onDelete={eliminandoId === imp.id ? undefined : () => eliminaImpianto(imp.id, imp.nome)} />
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: "100%", background: "#161a1f", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 8, padding: "9px 12px", fontSize: 13.5, transition: "border-color .15s ease, background .15s ease" };

// --- Dettaglio impianto -----------------------------------------------------------

function DettaglioImpianto({ impianto, ispezioni, anomalieAll, fotoAll, azienda, piano, onBack, onReload }) {
  const [eliminandoId, setEliminandoId] = useState(null);
  const [ispezioneAperta, setIspezioneAperta] = useState(null);
  const [generandoRiassunto, setGenerandoRiassunto] = useState(false);
  const [pdfUrlRiassunto, setPdfUrlRiassunto] = useState(null);

  const storico = [...ispezioni]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map((isp) => {
      const anomalieIsp = anomalieAll.filter((a) => a.ispezione_id === isp.id);
      const ordine = ["bassa", "media", "alta", "critica"];
      const gravitaMax = anomalieIsp.reduce((max, a) => (ordine.indexOf(a.gravita) > ordine.indexOf(max) ? a.gravita : max), "bassa");
      const oggi = new Date();
      const inRitardo = isp.prossimo_controllo && new Date(isp.prossimo_controllo) < oggi;
      return { id: isp.id, data: formatData(isp.data), operatore: isp.operatore, anomalie: anomalieIsp.length, gravitaMax, fotoUrl: isp.foto_url, prossimoControllo: isp.prossimo_controllo ? formatData(isp.prossimo_controllo) : null, inRitardo };
    });

  const scaricaRiassuntoPDF = () => {
    setGenerandoRiassunto(true);
    try {
      const doc = costruisciPDFRiassuntoImpianto({ azienda, impianto, storico, piano });
      const url = doc.output("bloburl");
      setPdfUrlRiassunto(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerandoRiassunto(false);
  };

  const eliminaIspezione = async (id) => {
    if (!window.confirm("Eliminare questa ispezione e le sue anomalie? L'operazione non è reversibile.")) return;
    setEliminandoId(id);
    const percorsiFoto = fotoAll.filter((f) => f.ispezione_id === id).map((f) => percorsoStorageDaUrl(f.url)).filter(Boolean);
    if (percorsiFoto.length > 0) await supabase.storage.from("foto-ispezioni").remove(percorsiFoto);
    const { error } = await supabase.from("ispezioni").delete().eq("id", id);
    setEliminandoId(null);
    if (error) { alert("Eliminazione non riuscita: " + error.message); return; }
    onReload && onReload();
  };

  if (ispezioneAperta) {
    const ispezione = ispezioni.find((i) => i.id === ispezioneAperta);
    return (
      <VisualizzaReport
        impianto={impianto}
        ispezione={ispezione}
        fotoIspezione={fotoAll.filter((f) => f.ispezione_id === ispezioneAperta)}
        anomalieIspezione={anomalieAll.filter((a) => a.ispezione_id === ispezioneAperta)}
        azienda={azienda}
        piano={piano}
        onReload={onReload}
        onBack={() => setIspezioneAperta(null)}
      />
    );
  }

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12.5, marginBottom: 14, padding: 0 }}>&larr; Impianti</button>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>{impianto.nome}</h1>
        <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 0 0" }}>{[impianto.zona, impianto.cliente, impianto.kwp ? `${impianto.kwp} kWp` : null].filter(Boolean).join(" \u00b7 ")}</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: "#c3cad4", margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
          <TrendingUp size={14} /> Storico ispezioni
        </h2>
        {storico.length > 0 && (
          <div>
            <button onClick={scaricaRiassuntoPDF} disabled={generandoRiassunto} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
              <FileDown size={13} /> {generandoRiassunto ? "Preparazione..." : "Riepilogo PDF impianto"}
            </button>
            {pdfUrlRiassunto && (
              <a href={pdfUrlRiassunto} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11, color: "#3d8bfd", textAlign: "right" }}>
                Apri il PDF qui
              </a>
            )}
          </div>
        )}
      </div>
      {storico.length === 0 ? (
        <EmptyState text="Nessuna ispezione ancora registrata per questo impianto." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {storico.map((s) => {
            const sev = SEVERITY.find((sv) => sv.key === s.gravitaMax);
            return (
              <div key={s.id} onClick={() => setIspezioneAperta(s.id)} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "11px 16px", flexWrap: "wrap", gap: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {s.fotoUrl && <img src={s.fotoUrl} alt="" style={{ width: 40, height: 26, objectFit: "cover", borderRadius: 4 }} />}
                  <div>
                    <div style={{ fontSize: 13, color: "#e7eaee" }}>{s.data}</div>
                    {s.prossimoControllo && (
                      <div style={{ fontSize: 10.5, color: s.inRitardo ? "#ff9c9c" : "#6b7480", marginTop: 1 }}>
                        {s.inRitardo ? "Controllo in ritardo dal " : "Prossimo controllo: "}{s.prossimoControllo}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 12.5, color: "#8b95a3" }}>{s.anomalie} anomalie</span>
                  <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 4, background: sev.color + "22", color: sev.color, fontWeight: 600 }}>{sev.label}</span>
                  <button onClick={(e) => { e.stopPropagation(); eliminaIspezione(s.id); }} disabled={eliminandoId === s.id} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    {eliminandoId === s.id ? "..." : "Elimina"}
                  </button>
                  <ChevronRight size={15} color="#6b7480" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Visualizzazione di un report salvato -----------------------------------------------------------

function VisualizzaReport({ impianto, ispezione, fotoIspezione, anomalieIspezione, azienda, piano, onReload, onBack }) {
  const [generando, setGenerando] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [modificaPermesso, setModificaPermesso] = useState(false);
  const [nuovoStato, setNuovoStato] = useState(ispezione.stato_permesso || "in_attesa");
  const [nuovoMotivo, setNuovoMotivo] = useState(ispezione.motivo_negazione || "");
  const [nuovoValidoDal, setNuovoValidoDal] = useState(ispezione.permesso_valido_dal || "");
  const [nuovoValidoAl, setNuovoValidoAl] = useState(ispezione.permesso_valido_al || "");
  const [nuovoOraDalle, setNuovoOraDalle] = useState(ispezione.permesso_ora_dalle || "");
  const [nuovoOraAlle, setNuovoOraAlle] = useState(ispezione.permesso_ora_alle || "");
  const [salvandoPermesso, setSalvandoPermesso] = useState(false);
  const [generandoRegistro, setGenerandoRegistro] = useState(false);
  const [pdfUrlRegistro, setPdfUrlRegistro] = useState(null);
  const [ritagliSchermo, setRitagliSchermo] = useState(new Map());
  const [modificaReport, setModificaReport] = useState(false);
  const [fotoAttivaModificaId, setFotoAttivaModificaId] = useState(null);
  const [pendingPinModifica, setPendingPinModifica] = useState(null);
  const [caricandoFoto, setCaricandoFoto] = useState(false);
  const [campiModificabili, setCampiModificabili] = useState({
    ora: ispezione.ora || "",
    operatore: ispezione.operatore || "",
    irraggiamento: ispezione.irraggiamento || "",
    coordinate_gps: ispezione.coordinate_gps || "",
    note: ispezione.note || "",
  });
  const [salvandoCampi, setSalvandoCampi] = useState(false);
  const [campiSalvatiOk, setCampiSalvatiOk] = useState(false);
  const [didascalieModifica, setDidascalieModifica] = useState({});
  const [salvandoDidascaliaId, setSalvandoDidascaliaId] = useState(null);
  const imgRefModifica = useRef(null);

  useEffect(() => {
    let annullato = false;
    (async () => {
      try {
        const fotoConDataUrlLocali = await Promise.all(
          fotoIspezione.map(async (f) => ({ id: f.id, dataUrl: await urlToDataUrl(f.url) }))
        );
        const anomalieNorm = anomalieIspezione.map((a) => ({ ...a, fotoId: a.foto_id, x: a.pos_x, y: a.pos_y }));
        const ritagli = await generaRitagliAnomalie(fotoConDataUrlLocali, anomalieNorm);
        if (!annullato) setRitagliSchermo(ritagli);
      } catch (e) { /* se fallisce, l'anteprima resta solo testuale, non è bloccante */ }
    })();
    return () => { annullato = true; };
  }, [ispezione.id]);

  const salvaStatoPermesso = async () => {
    setSalvandoPermesso(true);
    const { error } = await supabase.from("ispezioni").update({
      stato_permesso: nuovoStato,
      motivo_negazione: nuovoStato === "negato" ? (nuovoMotivo || null) : null,
      permesso_valido_dal: nuovoStato === "autorizzato" ? (nuovoValidoDal || null) : null,
      permesso_valido_al: nuovoStato === "autorizzato" ? (nuovoValidoAl || null) : null,
      permesso_ora_dalle: nuovoStato === "autorizzato" ? (nuovoOraDalle || null) : null,
      permesso_ora_alle: nuovoStato === "autorizzato" ? (nuovoOraAlle || null) : null,
    }).eq("id", ispezione.id);
    setSalvandoPermesso(false);
    if (error) { alert("Aggiornamento non riuscito: " + error.message); return; }
    setModificaPermesso(false);
    onReload && onReload();
  };

  const aggiungiFotoAlReport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCaricandoFoto(true);
    try {
      const nomeFile = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${file.name.split(".").pop()}`;
      const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, file);
      if (eUp) throw eUp;
      const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
      const { error: eIns } = await supabase.from("foto").insert({ ispezione_id: ispezione.id, url: pub.publicUrl });
      if (eIns) throw eIns;
      onReload && onReload();
    } catch (err) {
      alert("Non sono riuscito a caricare la foto: " + (err?.message || err));
    }
    setCaricandoFoto(false);
    e.target.value = "";
  };

  const eliminaFotoDalReport = async (fotoId) => {
    if (!window.confirm("Eliminare questa foto? Verranno eliminate anche le anomalie segnate su di essa.")) return;
    const fotoDaRimuovere = fotoIspezione.find((f) => f.id === fotoId);
    if (fotoDaRimuovere) {
      const percorso = percorsoStorageDaUrl(fotoDaRimuovere.url);
      if (percorso) await supabase.storage.from("foto-ispezioni").remove([percorso]);
    }
    await supabase.from("anomalie").delete().eq("foto_id", fotoId);
    await supabase.from("foto").delete().eq("id", fotoId);
    onReload && onReload();
  };

  const salvaDidascalia = async (fotoId) => {
    setSalvandoDidascaliaId(fotoId);
    await supabase.from("foto").update({ didascalia: didascalieModifica[fotoId] || null }).eq("id", fotoId);
    setSalvandoDidascaliaId(null);
    onReload && onReload();
  };

  const handleImgClickModifica = (e, fotoId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFotoAttivaModificaId(fotoId);
    setPendingPinModifica({ x, y });
  };

  const confermaNuovaAnomalia = async (categoria, gravita) => {
    if (!pendingPinModifica) return;
    await supabase.from("anomalie").insert({
      ispezione_id: ispezione.id,
      foto_id: fotoAttivaModificaId,
      categoria, gravita,
      pos_x: pendingPinModifica.x,
      pos_y: pendingPinModifica.y,
    });
    setPendingPinModifica(null);
    setFotoAttivaModificaId(null);
    onReload && onReload();
  };

  const eliminaAnomaliaEsistente = async (anomaliaId) => {
    if (!window.confirm("Eliminare questa anomalia dal report? L'operazione non è reversibile.")) return;
    await supabase.from("anomalie").delete().eq("id", anomaliaId);
    onReload && onReload();
  };

  const salvaCampiBase = async () => {
    setSalvandoCampi(true);
    setCampiSalvatiOk(false);
    const { error } = await supabase.from("ispezioni").update({
      ora: campiModificabili.ora || null,
      operatore: campiModificabili.operatore || null,
      irraggiamento: campiModificabili.irraggiamento ? Number(campiModificabili.irraggiamento) : null,
      coordinate_gps: campiModificabili.coordinate_gps || null,
      note: campiModificabili.note || null,
    }).eq("id", ispezione.id);
    setSalvandoCampi(false);
    if (error) { alert("Salvataggio non riuscito: " + error.message); return; }
    setCampiSalvatiOk(true);
    onReload && onReload();
  };

  const scaricaPDF = async () => {
    setGenerando(true);
    try {
      const fotoConDataUrl = await Promise.all(
        fotoIspezione.map(async (f) => ({ id: f.id, dataUrl: await urlToDataUrl(f.url), didascalia: f.didascalia }))
      );
      const anomalieNormalizzate = anomalieIspezione.map((a) => ({ ...a, fotoId: a.foto_id, x: a.pos_x, y: a.pos_y }));
      const ritagli = await generaRitagliAnomalie(fotoConDataUrl, anomalieNormalizzate);
      const doc = costruisciPDF({
        azienda,
        impianto,
        dati: {
          dataFormattata: formatData(ispezione.data),
          ora: ispezione.ora,
          operatore: ispezione.operatore,
          irraggiamento: ispezione.irraggiamento,
          note: ispezione.note,
          prossimoControlloFormattato: ispezione.prossimo_controllo ? formatData(ispezione.prossimo_controllo) : null,
          coordinateGps: ispezione.coordinate_gps,
        },
        fotoConDataUrl,
        anomalieList: anomalieNormalizzate,
        piano,
        ritagli,
        tipoIspezione: ispezione.tipo_ispezione,
      });
      const url = doc.output("bloburl");
      setPdfUrl(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerando(false);
  };

  const scaricaPDFRegistroVolo = async () => {
    setGenerandoRegistro(true);
    try {
      let dflightDataUrl = null;
      if (ispezione.dflight_screenshot_url) {
        dflightDataUrl = await urlToDataUrl(ispezione.dflight_screenshot_url);
      }
      const doc = costruisciPDFRegistroVolo({ azienda, impianto, ispezione, dflightDataUrl });
      const url = doc.output("bloburl");
      setPdfUrlRegistro(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerandoRegistro(false);
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12.5, marginBottom: 14, padding: 0 }}>&larr; {impianto.nome}</button>

      <div style={{ maxWidth: 520, marginBottom: 12 }}>
        <button onClick={() => setModificaReport(!modificaReport)} style={{ display: "flex", alignItems: "center", gap: 6, background: modificaReport ? "#ff8c42" : "#1f2530", color: modificaReport ? "#161a1f" : "#e7eaee", border: "1px solid #333a45", padding: "8px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}>
          {modificaReport ? "✓ Modalità modifica attiva" : "✏️ Modifica report"}
        </button>
        {modificaReport && <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "6px 0 0 0" }}>Tocca una foto per aggiungere un'anomalia, o la × su un pallino per toglierla. Carica nuove foto sotto.</p>}
      </div>

      <div style={{ background: "#ffffff", color: "#1a1a1a", width: "100%", maxWidth: 520, borderRadius: 4, padding: "28px 30px", boxShadow: "0 4px 24px rgba(0,0,0,0.35)" }}>
        {azienda.logo && (
          <img src={azienda.logo} alt="logo" style={{ height: 34, maxWidth: 130, objectFit: "contain", marginBottom: 14, marginLeft: "auto", marginRight: "auto", display: "block" }} />
        )}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 3px 0", fontFamily: "'IBM Plex Sans', sans-serif" }}>Report ispezione termografica</h2>
        <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 18px 0" }}>{azienda.nome} — ispezioni con drone e termocamera</p>

        {!modificaReport ? (
          <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 12 }}>
            {[
              ["Impianto", impianto?.nome],
              ["Località", impianto?.zona],
              ...(impianto?.kwp ? [["Potenza installata", `${impianto?.kwp} kWp`]] : []),
              ["Cliente", impianto?.cliente],
              ["Data ispezione", formatData(ispezione.data)],
              ["Ora ispezione", ispezione.ora || "—"],
              ["Eseguita da", ispezione.operatore || "—"],
              ["Coordinate GPS", ispezione.coordinate_gps || "—"],
              ...(ispezione.tipo_ispezione === "fotovoltaico" ? [["Irraggiamento solare", ispezione.irraggiamento ? `${ispezione.irraggiamento} W/m²` : "—"]] : []),
              ...(ispezione.tipo_ispezione === "danni" && anomalieIspezione.length === 0 ? [] : [["Anomalie rilevate", String(anomalieIspezione.length)]]),
              ...(ispezione.tipo_ispezione !== "danni" ? [["Prossimo controllo", ispezione.prossimo_controllo ? formatData(ispezione.prossimo_controllo) : "—"]] : []),
            ].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                <span style={{ color: "#6b7480" }}>{label}</span>
                <span className="mono" style={{ color: "#1a1a1a" }}>{val}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
              <span style={{ color: "#6b7480" }}>Impianto / Cliente</span>
              <span style={{ color: "#999" }}>{impianto?.nome} — modifica in "Impianti"</span>
            </div>
            <label style={{ fontSize: 11.5, color: "#6b7480" }}>Ora ispezione</label>
            <input type="time" value={campiModificabili.ora} onChange={(e) => setCampiModificabili({ ...campiModificabili, ora: e.target.value })} style={{ ...inputStyle, background: "#f5f5f5", color: "#1a1a1a", border: "1px solid #ddd" }} />
            <label style={{ fontSize: 11.5, color: "#6b7480" }}>Eseguita da</label>
            <input type="text" value={campiModificabili.operatore} onChange={(e) => setCampiModificabili({ ...campiModificabili, operatore: e.target.value })} style={{ ...inputStyle, background: "#f5f5f5", color: "#1a1a1a", border: "1px solid #ddd" }} />
            <label style={{ fontSize: 11.5, color: "#6b7480" }}>Coordinate GPS</label>
            <input type="text" value={campiModificabili.coordinate_gps} onChange={(e) => setCampiModificabili({ ...campiModificabili, coordinate_gps: e.target.value })} style={{ ...inputStyle, background: "#f5f5f5", color: "#1a1a1a", border: "1px solid #ddd" }} />
            {ispezione.tipo_ispezione === "fotovoltaico" && (
              <>
                <label style={{ fontSize: 11.5, color: "#6b7480" }}>Irraggiamento (W/m²)</label>
                <input type="number" value={campiModificabili.irraggiamento} onChange={(e) => setCampiModificabili({ ...campiModificabili, irraggiamento: e.target.value })} style={{ ...inputStyle, background: "#f5f5f5", color: "#1a1a1a", border: "1px solid #ddd" }} />
              </>
            )}
            <label style={{ fontSize: 11.5, color: "#6b7480" }}>Note</label>
            <textarea rows={3} value={campiModificabili.note} onChange={(e) => { setCampiModificabili({ ...campiModificabili, note: e.target.value }); setCampiSalvatiOk(false); }} style={{ ...inputStyle, background: "#f5f5f5", color: "#1a1a1a", border: "1px solid #ddd", resize: "vertical", fontFamily: "inherit" }} />
            <button onClick={salvaCampiBase} disabled={salvandoCampi} style={{ marginTop: 4, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "8px 0", borderRadius: 6, fontWeight: 600, fontSize: 12.5 }}>
              {salvandoCampi ? "Salvataggio..." : "Salva questi dati"}
            </button>
            {campiSalvatiOk && <p style={{ fontSize: 11.5, color: "#2e7d32", fontWeight: 600, margin: 0 }}>✓ Salvato correttamente</p>}
          </div>
        )}

        {fotoIspezione.length > 0 && ispezione.tipo_ispezione !== "danni" && (
          <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
            <div style={{ background: "#eef6ed", border: "1px solid #cfe8cc", borderRadius: 6, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 11.5, color: "#2e5c2b" }}>🌡️ Vuoi cambiare palette o leggere la temperatura esatta di un punto?</span>
              <a href={LINK_DJI_THERMAL_TOOL} target="_blank" rel="noreferrer" style={{ background: "#2e7d32", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "6px 12px", borderRadius: 5, textDecoration: "none", whiteSpace: "nowrap" }}>Apri DJI Thermal Analysis Tool ↗</a>
            </div>
          </div>
        )}

        {fotoIspezione.map((f, idx) => {
          const anomalieFoto = anomalieIspezione.filter((a) => a.foto_id === f.id);
          return (
            <div key={f.id} style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>{fotoIspezione.length > 1 ? `${ispezione.tipo_ispezione === "danni" ? "Foto" : "Foto termica"} ${idx + 1}` : (ispezione.tipo_ispezione === "danni" ? "Foto" : "Foto termica")}</h3>
                {modificaReport && (
                  <button onClick={() => eliminaFotoDalReport(f.id)} style={{ background: "none", border: "1px solid #ddd", color: "#c62828", borderRadius: 5, padding: "3px 9px", fontSize: 11 }}>
                    🗑️ Elimina foto
                  </button>
                )}
              </div>
              <div style={{ position: "relative", width: "100%" }}>
                <img
                  src={f.url}
                  alt="foto ispezione"
                  onClick={modificaReport ? (e) => handleImgClickModifica(e, f.id) : undefined}
                  style={{ width: "100%", borderRadius: 4, display: "block", cursor: modificaReport ? "crosshair" : "default" }}
                />
                {anomalieFoto.map((a, i) => {
                  const sev = SEVERITY.find((s) => s.key === a.gravita);
                  return (
                    <React.Fragment key={a.id}>
                      <div style={{ position: "absolute", left: `${a.pos_x}%`, top: `${a.pos_y}%`, width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${sev.color}`, boxShadow: "0 0 0 1.5px rgba(0,0,0,0.6)", transform: "translate(-50%,-50%)" }} />
                      <div style={{ position: "absolute", left: `${a.pos_x}%`, top: `${a.pos_y}%`, width: 20, height: 20, borderRadius: "50%", background: sev.color, border: "2px solid #fff", transform: "translate(6px, -22px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#161a1f", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                        {i + 1}
                      </div>
                      {modificaReport && (
                        <button
                          onClick={(e) => { e.stopPropagation(); eliminaAnomaliaEsistente(a.id); }}
                          title="Elimina questa anomalia"
                          style={{ position: "absolute", left: `${a.pos_x}%`, top: `${a.pos_y}%`, transform: "translate(14px, -34px)", width: 16, height: 16, borderRadius: "50%", background: "#c62828", border: "1px solid #fff", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                        >×</button>
                      )}
                    </React.Fragment>
                  );
                })}
                {pendingPinModifica && fotoAttivaModificaId === f.id && (
                  <div style={{ position: "absolute", left: `${pendingPinModifica.x}%`, top: `${pendingPinModifica.y}%`, transform: "translate(-50%,-50%)" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "linear-gradient(135deg, #ff9d5c, #e0552f)", border: "2px solid #161a1f" }} />
                  </div>
                )}
              </div>
              {pendingPinModifica && fotoAttivaModificaId === f.id && (
                <AnomaliaPopup onConfirm={confermaNuovaAnomalia} onCancel={() => { setPendingPinModifica(null); setFotoAttivaModificaId(null); }} categorie={CATEGORIE_PER_TIPO[ispezione.tipo_ispezione] || CATEGORIE_FOTOVOLTAICO} />
              )}
              {modificaReport ? (
                <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder="Didascalia (facoltativa)"
                    value={didascalieModifica[f.id] !== undefined ? didascalieModifica[f.id] : (f.didascalia || "")}
                    onChange={(e) => setDidascalieModifica({ ...didascalieModifica, [f.id]: e.target.value })}
                    style={{ ...inputStyle, flex: 1, background: "#f5f5f5", color: "#1a1a1a", border: "1px solid #ddd", fontSize: 12 }}
                  />
                  <button onClick={() => salvaDidascalia(f.id)} disabled={salvandoDidascaliaId === f.id} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 5, padding: "0 12px", fontSize: 11.5, fontWeight: 600 }}>
                    {salvandoDidascaliaId === f.id ? "..." : "Salva"}
                  </button>
                </div>
              ) : f.didascalia && (
                <p style={{ fontSize: 12, color: "#555", fontStyle: "italic", margin: "8px 0 0 0" }}>{f.didascalia}</p>
              )}
              {anomalieFoto.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  {anomalieFoto.map((a, i) => (
                    <BloccoAnomalia key={a.id} a={{ categoria: a.categoria, gravita: a.gravita }} numero={i + 1} ritaglio={ritagliSchermo.get(a.id)} fotoNumero={fotoIspezione.length > 1 ? idx + 1 : undefined} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {modificaReport && (
          <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #ccc", borderRadius: 6, padding: "10px 16px", color: "#6b7480", fontSize: 12.5, cursor: "pointer" }}>
              <Upload size={13} /> {caricandoFoto ? "Caricamento..." : "+ Aggiungi foto al report"}
              <input type="file" accept="image/*" onChange={aggiungiFotoAlReport} disabled={caricandoFoto} style={{ display: "none" }} />
            </label>
          </div>
        )}

        {(() => {
          const anomalieSenzaFoto = anomalieIspezione.filter((a) => !fotoIspezione.some((f) => f.id === a.foto_id));
          if (anomalieSenzaFoto.length === 0) return null;
          return (
            <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 10px 0" }}>Altre anomalie</h3>
              {anomalieSenzaFoto.map((a, i) => (
                <BloccoAnomalia key={a.id} a={{ categoria: a.categoria, gravita: a.gravita }} numero={i + 1} ritaglio={ritagliSchermo.get(a.id)} />
              ))}
            </div>
          );
        })()}

        {anomalieIspezione.length === 0 && ispezione.tipo_ispezione !== "danni" && (
          <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 10px 0" }}>Anomalie e raccomandazioni</h3>
            <p style={{ fontSize: 12, color: "#6b7480" }}>Nessuna anomalia rilevata durante l'ispezione.</p>
          </div>
        )}

        {!modificaReport && ispezione.note && (
          <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 8px 0" }}>Note</h3>
            <p style={{ fontSize: 12, color: "#333", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{ispezione.note}</p>
          </div>
        )}

        {piano !== "pro" && (
          <p style={{ fontSize: 9.5, color: "#9aa4b2", marginTop: 18, borderTop: "1px solid #e5e5e5", paddingTop: 10 }}>Generato da {azienda.nome}</p>
        )}
      </div>

      {(ispezione.drone_usato || ispezione.scenario_volo || ispezione.altezza_volo || ispezione.buffer_sicurezza || ispezione.dflight_screenshot_url || ispezione.ora_atterraggio || ispezione.coordinate_gps || ispezione.zona_rossa) && (
        <div style={{ maxWidth: 520, marginTop: 16, background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px 0", color: "#c3cad4" }}>📋 Dati di volo — registro interno</h3>
          <p style={{ fontSize: 10.5, color: "#6b7480", margin: "0 0 12px 0" }}>Non incluso nel report per il cliente — solo per la tua documentazione.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {ispezione.drone_usato && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Drone utilizzato</span><span>{ispezione.drone_usato}</span></div>}
            {ispezione.ora_atterraggio && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Ora atterraggio</span><span>{ispezione.ora_atterraggio}</span></div>}
            {ispezione.coordinate_gps && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Coordinate GPS</span><span>{ispezione.coordinate_gps}</span></div>}
            {ispezione.scenario_volo && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Scenario operativo</span><span>{{ aperta: "Categoria Aperta", sts01: "STS-01", sts02: "STS-02", specifica: "Operazione specifica" }[ispezione.scenario_volo] || ispezione.scenario_volo}</span></div>}
            {ispezione.altezza_volo && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Altezza max volo</span><span>{ispezione.altezza_volo} m</span></div>}
            {ispezione.buffer_sicurezza && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Buffer di sicurezza</span><span>{ispezione.buffer_sicurezza} m</span></div>}
          </div>
          {ispezione.dflight_screenshot_url && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "#8b95a3", display: "block", marginBottom: 6 }}>Screenshot D-Flight</span>
              <a href={ispezione.dflight_screenshot_url} target="_blank" rel="noreferrer">
                <img src={ispezione.dflight_screenshot_url} alt="D-Flight" style={{ width: "100%", maxWidth: 300, borderRadius: 6, border: "1px solid #333a45" }} />
              </a>
            </div>
          )}
          {ispezione.zona_rossa && (
            <div style={{ marginTop: 12, borderTop: "1px solid #262b33", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#ffb877" }}>⚠️ Zona rossa / area soggetta a restrizioni</span>
                {!modificaPermesso && (
                  <button onClick={() => setModificaPermesso(true)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "3px 9px", fontSize: 11 }}>
                    Modifica esito
                  </button>
                )}
              </div>
              {ispezione.permessi_richiesti && <div style={{ fontSize: 12, marginBottom: 4 }}><span style={{ color: "#8b95a3" }}>Permessi: </span>{ispezione.permessi_richiesti}</div>}
              {ispezione.ente_contattato && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Ente contattato</span><span>{ispezione.ente_contattato}</span></div>}
              {ispezione.data_inizio_permesso && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Richiesta inviata</span><span>{formatData(ispezione.data_inizio_permesso)}{ispezione.ora_inizio_permesso ? ` alle ${ispezione.ora_inizio_permesso}` : ""}</span></div>}
              {ispezione.data_fine_permesso && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Risposta ricevuta</span><span>{formatData(ispezione.data_fine_permesso)}{ispezione.ora_fine_permesso ? ` alle ${ispezione.ora_fine_permesso}` : ""}</span></div>}

              {!modificaPermesso ? (
                <>
                  {ispezione.stato_permesso && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Esito</span><span style={{ color: ispezione.stato_permesso === "autorizzato" ? "#4ade80" : ispezione.stato_permesso === "negato" ? "#ff4d4d" : "#f5b942" }}>{{ in_attesa: "In attesa", autorizzato: "Autorizzato", negato: "Negato" }[ispezione.stato_permesso] || ispezione.stato_permesso}</span></div>}
                  {ispezione.stato_permesso === "negato" && ispezione.motivo_negazione && (
                    <div style={{ fontSize: 12, marginTop: 4, color: "#ff9c9c" }}>Motivo: {ispezione.motivo_negazione}</div>
                  )}
                  {ispezione.stato_permesso === "autorizzato" && ispezione.permesso_valido_dal && (
                    <div style={{ fontSize: 12, marginTop: 4, color: "#4ade80" }}>
                      Valido dal {formatData(ispezione.permesso_valido_dal)} al {ispezione.permesso_valido_al ? formatData(ispezione.permesso_valido_al) : "—"}
                      {ispezione.permesso_ora_dalle && `, dalle ${ispezione.permesso_ora_dalle} alle ${ispezione.permesso_ora_alle || "—"}`}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ marginTop: 8, background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Esito permesso</label>
                    <select value={nuovoStato} onChange={(e) => setNuovoStato(e.target.value)} style={inputStyle}>
                      <option value="in_attesa">In attesa</option>
                      <option value="autorizzato">Autorizzato</option>
                      <option value="negato">Negato</option>
                    </select>
                  </div>
                  {nuovoStato === "negato" && (
                    <div>
                      <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Motivo del rifiuto</label>
                      <textarea value={nuovoMotivo} onChange={(e) => setNuovoMotivo(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                  )}
                  {nuovoStato === "autorizzato" && (
                    <div>
                      <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Permesso valido</label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input type="date" value={nuovoValidoDal} onChange={(e) => setNuovoValidoDal(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <span style={{ fontSize: 11, color: "#6b7480" }}>al</span>
                        <input type="date" value={nuovoValidoAl} onChange={(e) => setNuovoValidoAl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                        <input type="time" value={nuovoOraDalle} onChange={(e) => setNuovoOraDalle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                        <span style={{ fontSize: 11, color: "#6b7480" }}>alle</span>
                        <input type="time" value={nuovoOraAlle} onChange={(e) => setNuovoOraAlle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={salvaStatoPermesso} disabled={salvandoPermesso} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "7px 14px", borderRadius: 5, fontWeight: 600, fontSize: 12 }}>
                      {salvandoPermesso ? "Salvataggio..." : "Salva"}
                    </button>
                    <button onClick={() => setModificaPermesso(false)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", padding: "7px 14px", borderRadius: 5, fontSize: 12 }}>
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div style={{ marginTop: 14, borderTop: "1px solid #262b33", paddingTop: 12 }}>
            <button onClick={scaricaPDFRegistroVolo} disabled={generandoRegistro} style={{ display: "flex", alignItems: "center", gap: 6, background: "#161a1f", color: "#c3cad4", border: "1px solid #333a45", padding: "8px 14px", borderRadius: 6, fontSize: 12.5 }}>
              <FileDown size={13} /> {generandoRegistro ? "Preparazione..." : "Scarica PDF registro voli"}
            </button>
            {pdfUrlRegistro && (
              <a href={pdfUrlRegistro} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11.5, color: "#3d8bfd" }}>
                Se non si è aperto automaticamente, apri il PDF qui
              </a>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 520, marginTop: 16 }}>
        <button onClick={scaricaPDF} disabled={generando} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "9px 16px", borderRadius: 6, fontSize: 13 }}>
          <FileDown size={14} /> {generando ? "Preparazione..." : "Scarica PDF"}
        </button>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, fontSize: 12, color: "#3d8bfd" }}>
            Se non si è aperto automaticamente, apri il PDF qui
          </a>
        )}
      </div>
    </div>
  );
}

// --- Impostazioni (white label) -----------------------------------------------------------

// --- Abbonamento -----------------------------------------------------------

function BloccoPiano({ titolo, testo, pianoRichiesto = "Pro", onVai }) {
  return (
    <div style={{ padding: "28px 32px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px 0" }}>{titolo}</h1>
      <div style={{ maxWidth: 440, background: "#241d16", border: "1px solid #4a2f16", borderRadius: 10, padding: 20 }}>
        <p style={{ fontSize: 13.5, color: "#ffb877", margin: "0 0 10px 0", fontWeight: 600 }}>🔒 Funzione del piano {pianoRichiesto}</p>
        <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "0 0 14px 0", lineHeight: 1.5 }}>{testo}</p>
        {onVai && <button onClick={onVai} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>Vedi i piani</button>}
      </div>
    </div>
  );
}

function Abbonamento({ piano }) {
  const [periodo, setPeriodo] = useState("mese"); // mese | anno
  const [mesiPausa, setMesiPausa] = useState(1);
  const nomePeriodo = periodo === "anno" ? "annuale" : "mensile";
  const linkDiretto = (chiave) => (LINK_PAGAMENTO[chiave] || {})[periodo];
  const linkUpgrade = (chiave) => linkDiretto(chiave)
    ? linkDiretto(chiave)
    : `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Richiesta upgrade piano ${NOME_PIANO[chiave]} (${nomePeriodo})`)}&body=${encodeURIComponent(`Ciao, vorrei passare al piano ${NOME_PIANO[chiave]} con pagamento ${nomePeriodo} sul mio account Eyedrones.`)}`;
  // finché i pagamenti non sono automatici, la pausa si chiede per email come l'upgrade
  const linkPausa = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Pausa abbonamento ${NOME_PIANO[piano] || ""}`)}&body=${encodeURIComponent(`Ciao, vorrei mettere in pausa il mio abbonamento Eyedrones per ${mesiPausa} ${mesiPausa === 1 ? "mese" : "mesi"}. I miei dati restano salvati e l'abbonamento riparte da solo alla fine della pausa.`)}`;
  const prezzo = (chiave) => {
    const pr = PREZZI_PIANO[chiave];
    if (periodo === "anno") return { grande: `${euro(pr.anno / 12)}/mese`, dettaglio: `${euro(pr.anno)} una volta all'anno · ${mesiGratisAnnuale(chiave)} mesi gratis` };
    return { grande: `${euro(pr.mese)}/mese`, dettaglio: `oppure ${euro(pr.anno)} all'anno (${mesiGratisAnnuale(chiave)} mesi gratis)` };
  };

  const piani = [
    {
      chiave: "free", nome: "Free", grande: "Gratis", sotto: "Per provare l'app",
      caratteristiche: [
        { testo: `Fino a ${LIMITI_FREE.voli} voli nel registro`, incluso: true },
        { testo: "Foto e video senza limite di numero", incluso: true },
        { testo: `Fino a ${LIMITI_FREE.batterie} batterie con conteggio dei cicli`, incluso: true },
        { testo: "Pianificazione volo con meteo e indice Kp", incluso: true },
        { testo: "Attestati, droni e documenti per i controlli", incluso: true },
        { testo: `${LIMITI_FREE.reportMese} report di ispezione al mese`, incluso: true },
        { testo: "Esportazione CSV del registro voli", incluso: false },
        { testo: "Preventivi e logo personalizzato", incluso: false },
      ],
    },
    {
      chiave: "pilota", nome: "Pilota", ...prezzo("pilota"), sotto: "Per foto, video e FPV",
      caratteristiche: [
        { testo: "Voli, foto e video senza limiti di numero", incluso: true },
        { testo: "Batterie illimitate con avvisi su cicli e stoccaggio", incluso: true },
        { testo: "Pianificazione volo con meteo e indice Kp", incluso: true },
        { testo: "Attestati, droni e documenti per i controlli", incluso: true },
        { testo: `${LIMITI_FREE.reportMese} report di ispezione al mese`, incluso: true },
        { testo: "Esportazione CSV del registro voli", incluso: true },
        { testo: "Preventivi e logo personalizzato", incluso: false },
      ],
    },
    {
      chiave: "pro", nome: "Pro", ...prezzo("pro"), sotto: "Per chi lavora con i clienti", badge: "Tutto incluso",
      caratteristiche: [
        { testo: "Tutto quello che c'è nel piano Pilota", incluso: true },
        { testo: "Report di ispezione illimitati, senza filigrana", incluso: true },
        { testo: "Logo e nome azienda nei report", incluso: true },
        { testo: "Calcolatore preventivi automatico", incluso: true },
      ],
    },
  ];

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Abbonamento</h1>
      <p style={{ color: "#8b95a3", fontSize: 13.5, margin: "0 0 24px 0" }}>Sei attualmente sul piano <strong style={{ color: COLORE_PIANO[piano] || "#f5b942" }}>{NOME_PIANO[piano] || "Free"}</strong>.</p>

      <div role="group" aria-label="Periodo di pagamento" style={{ display: "inline-flex", background: "#161a1f", border: "1px solid #333a45", borderRadius: 999, padding: 3, marginBottom: 22 }}>
        {[["mese", "Mensile"], ["anno", "Annuale"]].map(([k, label]) => (
          <button key={k} onClick={() => setPeriodo(k)} aria-pressed={periodo === k} style={{ border: "none", borderRadius: 999, padding: "7px 16px", fontSize: 13, fontWeight: 600, background: periodo === k ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "transparent", color: periodo === k ? "#161a1f" : "#8b95a3" }}>
            {label}{k === "anno" && <span style={{ marginLeft: 6, fontSize: 11, color: periodo === k ? "#161a1f" : "#4ade80" }}>mesi gratis</span>}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, maxWidth: 820 }}>
        {piani.map((p) => {
          const attivo = piano === p.chiave;
          const superiore = ORDINE_PIANO[p.chiave] > (ORDINE_PIANO[piano] ?? 0);
          return (
            <div key={p.chiave} style={{ background: "#1b2028", border: attivo ? "2px solid #ff8c42" : "1px solid #262b33", borderRadius: 10, padding: 20, position: "relative", display: "flex", flexDirection: "column" }}>
              {attivo && (
                <span style={{ position: "absolute", top: -10, left: 16, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>PIANO ATTUALE</span>
              )}
              {!attivo && p.badge && (
                <span style={{ position: "absolute", top: -10, left: 16, background: "#4ade80", color: "#161a1f", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>{p.badge}</span>
              )}
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: "4px 0 2px 0" }}>{p.nome}</h2>
              <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "0 0 10px 0" }}>{p.sotto}</p>
              <p className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#ff8c42", margin: 0 }}>{p.grande}</p>
              <p style={{ fontSize: 11, color: periodo === "anno" && p.dettaglio ? "#4ade80" : "#6b7480", margin: "2px 0 16px 0", minHeight: 14 }}>{p.dettaglio || ""}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {p.caratteristiche.map((c) => (
                  <div key={c.testo} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: c.incluso ? "#e7eaee" : "#6b7480" }}>
                    <span style={{ color: c.incluso ? "#4ade80" : "#5a5f66", flexShrink: 0 }}>{c.incluso ? "✓" : "—"}</span>
                    {c.testo}
                  </div>
                ))}
              </div>
              {superiore && (
                <a href={linkUpgrade(p.chiave)} target={linkDiretto(p.chiave) ? "_blank" : undefined} rel="noreferrer" style={{ display: "block", textAlign: "center", marginTop: 18, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", padding: "9px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
                  Passa a {p.nome}{periodo === "anno" ? " (annuale)" : ""}
                </a>
              )}
            </div>
          );
        })}
      </div>

      {piano === "free" && <p style={{ fontSize: 12.5, color: "#8b95a3", margin: "16px 0 0 0", maxWidth: 820 }}>
        ⏸️ Non voli d'inverno? Puoi <strong style={{ color: "#c3cad4" }}>mettere in pausa</strong> l'abbonamento da 1 a 3 mesi invece di disdirlo: i tuoi voli e documenti restano salvati e alla fine riparte da solo.
      </p>}

      {piano !== "free" && (
        <div style={{ background: "#1b2028", border: "1px solid #262b33", borderRadius: 10, padding: 18, marginTop: 20, maxWidth: 820 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px 0" }}>⏸️ Metti in pausa l'abbonamento</h3>
          <p style={{ fontSize: 12.5, color: "#8b95a3", margin: "0 0 12px 0" }}>Durante la pausa non paghi e l'app torna alle funzioni del piano Free, ma non perdi nulla: voli, foto, batterie e documenti restano dove sono.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={mesiPausa} onChange={(e) => setMesiPausa(Number(e.target.value))} style={{ ...inputStyle, width: "auto" }}>
              <option value={1}>1 mese</option>
              <option value={2}>2 mesi</option>
              <option value={3}>3 mesi</option>
            </select>
            <a href={linkPausa} style={{ background: "#262b33", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 6, padding: "9px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Chiedi la pausa</a>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #262b33", marginTop: 28, paddingTop: 20, maxWidth: 480 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 6px 0" }}>Serve assistenza?</h3>
        <p style={{ fontSize: 12.5, color: "#8b95a3", margin: 0 }}>
          Per problemi tecnici o altre domande scrivi a{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#3d8bfd" }}>{SUPPORT_EMAIL}</a>
        </p>
      </div>
    </div>
  );
}

// --- Impostazioni (white label) -----------------------------------------------------------

// --- Preventivi -----------------------------------------------------------

// righe tipiche di un preventivo per riprese aeree: solo descrizioni, l'importo lo decide il pilota caso per caso
const VOCI_MODELLO_RIPRESE = [
  "Sopralluogo e pianificazione del volo",
  "Ripresa aerea — foto",
  "Ripresa aerea — video",
  "Montaggio e color correction",
  "Consegna file (formato e risoluzione da concordare)",
  "Licenza d'uso commerciale",
];

// Testo di partenza, generico: Ivan può modificarlo liberamente da Impostazioni. Non è una consulenza legale.
const NOTE_LEGALI_PREVENTIVO_DEFAULT = "Il presente preventivo ha validità di {validita} giorni dalla data di emissione, salvo diversa indicazione. I prezzi indicati si intendono IVA esclusa, se dovuta. Il documento non costituisce fattura. L'accettazione si intende tramite conferma scritta (email o messaggio) prima dell'inizio dei lavori. Eventuali variazioni delle condizioni operative (meteo, permessi aggiuntivi, accessibilità del sito) potranno comportare un adeguamento dei tempi o dei costi, da concordare preventivamente.";

// Link ufficiale DJI: cambia palette e legge le temperature esatte dalle foto termiche originali (R-JPEG), gratis, sul computer.
// Punta alla pagina download del Matrice 4 (drone di Ivan): elenco semplice con link .exe diretto, niente pagine che si bloccano.
// Le versioni più recenti (dalla 3.4) leggono anche i file del Matrice 4T. Verificare periodicamente che il link resti valido.
const LINK_DJI_THERMAL_TOOL = "https://enterprise.dji.com/matrice-4-series/downloads";

const STATI_PREVENTIVO = [
  { key: "inviato", label: "Inviato", color: "#3d8bfd" },
  { key: "accettato", label: "Accettato", color: "#4ade80" },
  { key: "rifiutato", label: "Rifiutato", color: "#ff4d4d" },
];

function Preventivi({ preventivi, azienda, piano, onReload, onVaiAbbonamento }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cliente, setCliente] = useState("");
  const [luogoIntervento, setLuogoIntervento] = useState("");
  const [oggetto, setOggetto] = useState("");
  const [voci, setVoci] = useState([{ descrizione: "", importo: "" }]);
  const [scontoImporto, setScontoImporto] = useState("");
  const [validitaGiorni, setValiditaGiorni] = useState("30");
  const [note, setNote] = useState("");
  const [kwp, setKwp] = useState("");
  const [dataPreventivo, setDataPreventivo] = useState(() => new Date().toISOString().slice(0, 10));
  const [salvataggio, setSalvataggio] = useState(false);
  const [cambiandoStato, setCambiandoStato] = useState(null);

  const listino = voci.reduce((s, v) => s + (Number(v.importo) || 0), 0);
  const scontoVal = Number(scontoImporto) || 0;
  const totale = Math.max(0, listino - scontoVal);

  const aggiungiVoce = () => setVoci([...voci, { descrizione: "", importo: "" }]);
  const rimuoviVoce = (idx) => setVoci(voci.filter((_, i) => i !== idx));

  const aggiungiVociDaKwp = () => {
    const kwpVal = Number(kwp) || 0;
    if (kwpVal <= 0) return;
    const tariffaBaseVal = Number(azienda.tariffaBase) || 0;
    const tariffaKwpVal = Number(azienda.tariffaKwp) || 0;
    const nuoveVoci = [
      { descrizione: "Tariffa base ispezione", importo: String(tariffaBaseVal) },
      { descrizione: `Tariffa per potenza (${kwpVal} kWp × ${tariffaKwpVal.toFixed(2)} €)`, importo: String((kwpVal * tariffaKwpVal).toFixed(2)) },
    ];
    // rimuovo eventuali righe vuote residue prima di aggiungere quelle calcolate
    const vociPulite = voci.filter((v) => v.descrizione || v.importo);
    setVoci([...vociPulite, ...nuoveVoci]);
  };
  // modello per riprese (video/foto/FPV): solo le voci tipiche, senza importo — lo scegli tu in base al lavoro
  const aggiungiVociRiprese = () => {
    const vociPulite = voci.filter((v) => v.descrizione || v.importo);
    const nuoveVoci = VOCI_MODELLO_RIPRESE.map((descrizione) => ({ descrizione, importo: "" }));
    setVoci([...vociPulite, ...nuoveVoci]);
  };
  const aggiornaVoce = (idx, campo, valore) => {
    const nuove = [...voci];
    nuove[idx] = { ...nuove[idx], [campo]: valore };
    setVoci(nuove);
  };

  const resetForm = () => {
    setCliente(""); setLuogoIntervento(""); setOggetto("");
    setVoci([{ descrizione: "", importo: "" }]); setScontoImporto("");
    setValiditaGiorni("30"); setNote(""); setKwp(""); setEditingId(null);
    setDataPreventivo(new Date().toISOString().slice(0, 10));
  };

  const apriModifica = (p) => {
    setEditingId(p.id);
    setCliente(p.cliente || "");
    setLuogoIntervento(p.luogo_intervento || "");
    setOggetto(p.oggetto || "");
    setVoci(p.voci && p.voci.length > 0 ? p.voci.map((v) => ({ descrizione: v.descrizione || "", importo: v.importo != null ? String(v.importo) : "" })) : [{ descrizione: "", importo: "" }]);
    setScontoImporto(p.sconto_importo ? String(p.sconto_importo) : "");
    setValiditaGiorni(p.validita_giorni ? String(p.validita_giorni) : "30");
    setNote(p.note || "");
    setDataPreventivo(p.data ? String(p.data).slice(0, 10) : new Date().toISOString().slice(0, 10));
    setShowForm(true);
  };

  const generaNumero = () => {
    const anno = new Date().getFullYear();
    const stessoAnno = preventivi.filter((p) => p.numero && p.numero.includes(String(anno)));
    return `EYD-${anno}-${String(stessoAnno.length + 1).padStart(3, "0")}`;
  };

  const salvaPreventivo = async () => {
    if (!cliente || voci.every((v) => !v.descrizione && !v.importo)) return;
    setSalvataggio(true);
    const vociPulite = voci.filter((v) => v.descrizione || v.importo).map((v) => ({ descrizione: v.descrizione, importo: Number(v.importo) || 0 }));
    const payload = {
      cliente,
      data: dataPreventivo,
      luogo_intervento: luogoIntervento || null,
      oggetto: oggetto || null,
      voci: vociPulite,
      sconto_importo: scontoVal,
      prezzo: totale,
      validita_giorni: Number(validitaGiorni) || 30,
      note: note || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("preventivi").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("preventivi").insert({ ...payload, numero: generaNumero() }));
    }
    setSalvataggio(false);
    if (error) { alert("Salvataggio non riuscito: " + error.message); return; }
    resetForm();
    setShowForm(false);
    onReload();
  };

  const cambiaStato = async (id, nuovoStato) => {
    setCambiandoStato(id);
    await supabase.from("preventivi").update({ stato: nuovoStato }).eq("id", id);
    setCambiandoStato(null);
    onReload();
  };

  const eliminaPreventivo = async (id) => {
    if (!window.confirm("Eliminare questo preventivo?")) return;
    await supabase.from("preventivi").delete().eq("id", id);
    onReload();
  };

  const scaricaPDF = (p) => {
    const doc = costruisciPDFPreventivo({ azienda, preventivo: p, piano });
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  };

  if (piano !== "pro") {
    return <BloccoPiano titolo="Preventivi" testo="Crea preventivi professionali in PDF con voci, sconti e numerazione automatica, e tieni traccia di quelli accettati. Disponibile con il piano Pro." onVai={onVaiAbbonamento} />;
  }

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Preventivi</h1>
        <button onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm ? "Annulla" : <><Plus size={14} /> Nuovo preventivo</>}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, marginBottom: 20, maxWidth: 540, display: "flex", flexDirection: "column", gap: 12 }}>
          {editingId && <div style={{ fontSize: 12, color: "#ff8c42", fontWeight: 600 }}>Stai modificando un preventivo esistente</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Nome cliente</label>
              <input placeholder="es. Mario Rossi" value={cliente} onChange={(e) => setCliente(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Data preventivo</label>
              <input type="date" value={dataPreventivo} onChange={(e) => setDataPreventivo(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Luogo intervento</label>
            <input placeholder="es. Via Roma 4, Torino" value={luogoIntervento} onChange={(e) => setLuogoIntervento(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Oggetto</label>
            <textarea placeholder="es. Rilievo aereo con drone dei danni da grandine su coperture — 7 villette" value={oggetto} onChange={(e) => setOggetto(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: "10px 12px" }}>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 6 }}>Calcolo rapido per impianto fotovoltaico (opzionale)</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="number" placeholder="Potenza (kWp)" value={kwp} onChange={(e) => setKwp(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={aggiungiVociDaKwp} disabled={!kwp} style={{ background: kwp ? "#ff8c42" : "#333a45", color: kwp ? "#161a1f" : "#6b7480", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                Aggiungi voci
              </button>
            </div>
            <p style={{ fontSize: 10.5, color: "#6b7480", margin: "6px 0 0 0" }}>Usa le tue tariffe da Impostazioni ({Number(azienda.tariffaBase) || 0}€ base + {Number(azienda.tariffaKwp) || 0}€/kWp) e aggiunge le righe qui sotto, che restano modificabili.</p>
          </div>

          <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: "10px 12px" }}>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 6 }}>Modello rapido per riprese aeree — video, foto, FPV (opzionale)</label>
            <button type="button" onClick={aggiungiVociRiprese} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 6, padding: "9px 14px", fontSize: 12.5, fontWeight: 600 }}>
              Aggiungi voci standard
            </button>
            <p style={{ fontSize: 10.5, color: "#6b7480", margin: "6px 0 0 0" }}>Aggiunge le righe tipiche di un lavoro di ripresa, senza importo: lo scrivi tu, perché varia molto da caso a caso.</p>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 6 }}>Voci del preventivo</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {voci.map((v, idx) => (
                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input placeholder="es. Diritto di uscita" value={v.descrizione} onChange={(e) => aggiornaVoce(idx, "descrizione", e.target.value)} style={{ ...inputStyle, flex: 3 }} />
                  <input type="number" step="0.01" placeholder="€" value={v.importo} onChange={(e) => aggiornaVoce(idx, "importo", e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  {voci.length > 1 && (
                    <button onClick={() => rimuoviVoce(idx)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "8px 10px", fontSize: 13 }}>×</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={aggiungiVoce} style={{ marginTop: 8, background: "none", border: "1px dashed #333a45", color: "#8b95a3", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}>
              + Aggiungi voce
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Sconto (€)</label>
              <input type="number" step="0.01" placeholder="0" value={scontoImporto} onChange={(e) => setScontoImporto(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Validità (giorni)</label>
              <input type="number" value={validitaGiorni} onChange={(e) => setValiditaGiorni(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: "10px 12px", fontSize: 12.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#8b95a3" }}>
              <span>Prezzo di listino</span><span className="mono">{listino.toFixed(2)} €</span>
            </div>
            {scontoVal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", color: "#ff8c42", marginTop: 3 }}>
                <span>Sconto</span><span className="mono">− {scontoVal.toFixed(2)} €</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", color: "#e7eaee", fontWeight: 700, fontSize: 14.5, marginTop: 6, paddingTop: 6, borderTop: "1px solid #262b33" }}>
              <span>Totale</span><span className="mono">{totale.toFixed(2)} €</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Note (opzionale)</label>
            <textarea placeholder="es. Zona di volo verificata, sopralluogo da concordare, importo non comprensivo di IVA..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <button onClick={salvaPreventivo} disabled={!cliente || salvataggio} style={{ marginTop: 4, background: cliente ? "#ff8c42" : "#333a45", color: cliente ? "#161a1f" : "#6b7480", border: "none", padding: "9px 0", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {salvataggio ? "Salvataggio..." : editingId ? "Aggiorna preventivo" : "Salva preventivo"}
          </button>
        </div>
      )}

      {preventivi.length === 0 ? (
        <EmptyState text="Nessun preventivo ancora. Creane uno con il pulsante qui sopra." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {preventivi.map((p) => {
            const stato = STATI_PREVENTIVO.find((s) => s.key === p.stato) || STATI_PREVENTIVO[0];
            let promemoria = null;
            if (p.stato === "inviato" && p.data) {
              const scadenza = new Date(p.data);
              scadenza.setDate(scadenza.getDate() + (p.validita_giorni || 30));
              const giorni = Math.ceil((scadenza - new Date()) / (1000 * 60 * 60 * 24));
              if (giorni < 0) promemoria = { testo: `Scaduto da ${Math.abs(giorni)} giorni, nessuna risposta`, colore: "#ff4d4d" };
              else if (giorni <= 5) promemoria = { testo: `Scade tra ${giorni} giorni, nessuna risposta`, colore: "#f5b942" };
            }
            return (
              <div key={p.id} style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.cliente} {p.numero && <span style={{ color: "#6b7480", fontWeight: 400, fontSize: 12 }}>· {p.numero}</span>}</div>
                  <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>
                    {p.luogo_intervento && <>{p.luogo_intervento} &middot; </>}{formatData(p.data)} &middot; <span className="mono">{Number(p.prezzo).toFixed(2)} €</span>
                  </div>
                  {promemoria && (
                    <div style={{ fontSize: 11.5, color: promemoria.colore, fontWeight: 600, marginTop: 3 }}>⏰ {promemoria.testo}</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <select
                    value={p.stato}
                    onChange={(e) => cambiaStato(p.id, e.target.value)}
                    disabled={cambiandoStato === p.id}
                    style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 8px", borderRadius: 4, background: stato.color + "22", color: stato.color, border: `1px solid ${stato.color}55` }}
                  >
                    {STATI_PREVENTIVO.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <button onClick={() => apriModifica(p)} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    Modifica
                  </button>
                  <button onClick={() => scaricaPDF(p)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    <FileDown size={12} /> PDF
                  </button>
                  <button onClick={() => eliminaPreventivo(p.id)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    Elimina
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Permessi -----------------------------------------------------------

const STATI_PERMESSO = [
  { key: "in_attesa", label: "In attesa", color: "#f5b942" },
  { key: "autorizzato", label: "Autorizzato", color: "#4ade80" },
  { key: "negato", label: "Negato", color: "#ff4d4d" },
];

function Permessi({ permessi, impianti, azienda, piano, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [impiantoIdSel, setImpiantoIdSel] = useState("");
  const [impianto, setImpianto] = useState("");
  const [enteContattato, setEnteContattato] = useState("");
  const [permessiRichiesti, setPermessiRichiesti] = useState("");
  const [bufferSicurezza, setBufferSicurezza] = useState("");
  const [dataRichiesta, setDataRichiesta] = useState("");
  const [oraRichiesta, setOraRichiesta] = useState("");
  const [note, setNote] = useState("");
  const [documento, setDocumento] = useState(null); // { nome, blob }
  const [dflightShot, setDflightShot] = useState(null); // { dataUrl, blob }
  const [salvataggio, setSalvataggio] = useState(false);
  const [cambiandoId, setCambiandoId] = useState(null);
  const [espansoId, setEspansoId] = useState(null);

  const resetForm = () => {
    setImpiantoIdSel(""); setImpianto(""); setEnteContattato(""); setPermessiRichiesti("");
    setBufferSicurezza(""); setDataRichiesta(""); setOraRichiesta(""); setNote("");
    setDocumento(null); setDflightShot(null);
  };

  const selezionaImpianto = (id) => {
    setImpiantoIdSel(id);
    const imp = impianti.find((i) => i.id === id);
    if (imp) setImpianto(`${imp.nome} — ${imp.zona || ""}`.replace(/ — $/, ""));
  };

  const caricaDocumento = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumento({ nome: file.name, blob: file });
    e.target.value = "";
  };

  const caricaDflightShot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDflightShot({ dataUrl: reader.result, blob: file });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const salvaPermesso = async () => {
    if (!impianto) return;
    setSalvataggio(true);
    try {
      let documentoUrl = null;
      if (documento?.blob) {
        const estensione = documento.nome.split(".").pop();
        const nomeFile = `permesso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${estensione}`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, documento.blob);
        if (!eUp) {
          const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
          documentoUrl = pub?.publicUrl || null;
        }
      }
      let dflightUrl = null;
      if (dflightShot?.blob) {
        const nomeFileD = `dflight-permesso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const { error: eUpD } = await supabase.storage.from("foto-ispezioni").upload(nomeFileD, dflightShot.blob, { contentType: "image/png" });
        if (!eUpD) {
          const { data: pubD } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFileD);
          dflightUrl = pubD?.publicUrl || null;
        }
      }
      const { error } = await supabase.from("permessi").insert({
        impianto,
        impianto_id: impiantoIdSel || null,
        ente_contattato: enteContattato || null,
        permessi_richiesti: permessiRichiesti || null,
        buffer_sicurezza: bufferSicurezza ? Number(bufferSicurezza) : null,
        data_richiesta: dataRichiesta || null,
        ora_richiesta: oraRichiesta || null,
        note: note || null,
        documento_url: documentoUrl,
        dflight_screenshot_url: dflightUrl,
      });
      if (error) throw error;
      resetForm();
      setShowForm(false);
      onReload();
    } catch (err) {
      alert("Salvataggio non riuscito: " + (err?.message || err));
    }
    setSalvataggio(false);
  };

  const eliminaPermesso = async (id) => {
    if (!window.confirm("Eliminare questo permesso?")) return;
    const p = permessi.find((x) => x.id === id);
    if (p?.documento_url) {
      const percorso = percorsoStorageDaUrl(p.documento_url);
      if (percorso) await supabase.storage.from("foto-ispezioni").remove([percorso]);
    }
    await supabase.from("permessi").delete().eq("id", id);
    onReload();
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Permessi</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm ? "Annulla" : <><Plus size={14} /> Nuova richiesta</>}
        </button>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 20px 0" }}>Richiedi e traccia i permessi di volo per zone soggette a restrizioni, prima ancora di fare il rilievo.</p>

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 16, marginBottom: 20, maxWidth: 460, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Collega a un impianto esistente (opzionale)</label>
            <select value={impiantoIdSel} onChange={(e) => selezionaImpianto(e.target.value)} style={inputStyle}>
              <option value="">— Nessuno / scrivi a mano —</option>
              {impianti.map((imp) => <option key={imp.id} value={imp.id}>{imp.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Impianto / zona</label>
            <input placeholder="es. Impianto FV Torino Nord" value={impianto} onChange={(e) => setImpianto(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Ente / soggetto contattato</label>
            <input placeholder="es. Aeroclub Torino, Aeroporto Caselle - Torre" value={enteContattato} onChange={(e) => setEnteContattato(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Permessi richiesti</label>
            <textarea placeholder="es. NOTAM, autorizzazione ENAC, coordinamento torre di controllo..." value={permessiRichiesti} onChange={(e) => setPermessiRichiesti(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Buffer di sicurezza (m)</label>
            <input type="number" placeholder="es. 5" value={bufferSicurezza} onChange={(e) => setBufferSicurezza(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Richiesta inviata il</label>
              <input type="date" value={dataRichiesta} onChange={(e) => setDataRichiesta(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Ora invio</label>
              <input type="time" value={oraRichiesta} onChange={(e) => setOraRichiesta(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Foglio del permesso (facoltativo, immagine o PDF)</label>
            {documento ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#c3cad4" }}>{documento.nome}</span>
                <button onClick={() => setDocumento(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
              </div>
            ) : (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                <Upload size={13} /> Carica documento
                <input type="file" accept="image/*,.pdf" onChange={caricaDocumento} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Screenshot D-Flight (facoltativo)</label>
            {dflightShot ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={dflightShot.dataUrl} alt="D-Flight" style={{ width: 70, height: 46, objectFit: "cover", borderRadius: 4, border: "1px solid #333a45" }} />
                <button onClick={() => setDflightShot(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
              </div>
            ) : (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                <Upload size={13} /> Carica screenshot
                <input type="file" accept="image/*" onChange={caricaDflightShot} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Note (opzionale)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <button onClick={salvaPermesso} disabled={!impianto || salvataggio} style={{ marginTop: 4, background: impianto ? "#ff8c42" : "#333a45", color: impianto ? "#161a1f" : "#6b7480", border: "none", padding: "9px 0", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {salvataggio ? "Salvataggio..." : "Salva richiesta"}
          </button>
        </div>
      )}

      {permessi.length === 0 ? (
        <EmptyState text="Nessuna richiesta di permesso ancora registrata." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {permessi.map((p) => (
            <PermessoRow key={p.id} p={p} azienda={azienda} piano={piano} espanso={espansoId === p.id} onToggle={() => setEspansoId(espansoId === p.id ? null : p.id)} onDelete={() => eliminaPermesso(p.id)} cambiando={cambiandoId === p.id} setCambiando={setCambiandoId} onReload={onReload} />
          ))}
        </div>
      )}
    </div>
  );
}

function PermessoRow({ p, azienda, piano, espanso, onToggle, onDelete, cambiando, setCambiando, onReload }) {
  const [nuovoStato, setNuovoStato] = useState(p.stato);
  const [nuovoMotivo, setNuovoMotivo] = useState(p.motivo_negazione || "");
  const [nuovoValidoDal, setNuovoValidoDal] = useState(p.valido_dal || "");
  const [nuovoValidoAl, setNuovoValidoAl] = useState(p.valido_al || "");
  const [nuovoOraDalle, setNuovoOraDalle] = useState(p.ora_dalle || "");
  const [nuovoOraAlle, setNuovoOraAlle] = useState(p.ora_alle || "");
  const [modificaStato, setModificaStato] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const stato = STATI_PERMESSO.find((s) => s.key === p.stato) || STATI_PERMESSO[0];

  const salvaStato = async () => {
    setCambiando(p.id);
    await supabase.from("permessi").update({
      stato: nuovoStato,
      motivo_negazione: nuovoStato === "negato" ? (nuovoMotivo || null) : null,
      valido_dal: nuovoStato === "autorizzato" ? (nuovoValidoDal || null) : null,
      valido_al: nuovoStato === "autorizzato" ? (nuovoValidoAl || null) : null,
      ora_dalle: nuovoStato === "autorizzato" ? (nuovoOraDalle || null) : null,
      ora_alle: nuovoStato === "autorizzato" ? (nuovoOraAlle || null) : null,
    }).eq("id", p.id);
    setCambiando(null);
    setModificaStato(false);
    onReload();
  };

  const scaricaPDF = async () => {
    setGenerandoPDF(true);
    try {
      let dflightDataUrl = null;
      if (p.dflight_screenshot_url) {
        dflightDataUrl = await urlToDataUrl(p.dflight_screenshot_url);
      }
      const doc = costruisciPDFPermesso({ azienda, permesso: p, dflightDataUrl, piano });
      const url = doc.output("bloburl");
      setPdfUrl(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerandoPDF(false);
  };

  return (
    <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "13px 16px" }}>
      <div onClick={onToggle} role="button" tabIndex={0} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{p.impianto}</div>
          <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>
            {p.ente_contattato && <>{p.ente_contattato} &middot; </>}
            {p.data_richiesta ? formatData(p.data_richiesta) : "—"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 4, background: stato.color + "22", color: stato.color }}>{stato.label}</span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>Elimina</button>
          <ChevronRight size={15} color="#6b7480" style={{ transform: espanso ? "rotate(90deg)" : "none" }} />
        </div>
      </div>

      {espanso && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #262b33", display: "flex", flexDirection: "column", gap: 6 }}>
          {p.permessi_richiesti && <div style={{ fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Permessi: </span>{p.permessi_richiesti}</div>}
          {p.buffer_sicurezza && <div style={{ fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Buffer di sicurezza: </span>{p.buffer_sicurezza} m</div>}
          {p.ora_richiesta && <div style={{ fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Ora invio richiesta: </span>{p.ora_richiesta}</div>}
          {p.note && <div style={{ fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>Note: </span>{p.note}</div>}
          {p.documento_url && (
            <a href={p.documento_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "#3d8bfd", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <FileDown size={12} /> Apri il foglio del permesso caricato
            </a>
          )}
          {p.dflight_screenshot_url && (
            <div style={{ marginTop: 4 }}>
              <span style={{ fontSize: 11, color: "#8b95a3", display: "block", marginBottom: 6 }}>Screenshot D-Flight</span>
              <a href={p.dflight_screenshot_url} target="_blank" rel="noreferrer">
                <img src={p.dflight_screenshot_url} alt="D-Flight" style={{ width: "100%", maxWidth: 280, borderRadius: 6, border: "1px solid #333a45" }} />
              </a>
            </div>
          )}
          {p.stato === "negato" && p.motivo_negazione && <div style={{ fontSize: 12.5, color: "#ff9c9c" }}>Motivo: {p.motivo_negazione}</div>}
          {p.stato === "autorizzato" && p.valido_dal && (
            <div style={{ fontSize: 12.5, color: "#4ade80" }}>
              Valido dal {formatData(p.valido_dal)} al {p.valido_al ? formatData(p.valido_al) : "—"}
              {p.ora_dalle && `, dalle ${p.ora_dalle} alle ${p.ora_alle || "—"}`}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {!modificaStato && (
              <button onClick={() => setModificaStato(true)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                Modifica esito
              </button>
            )}
            <button onClick={scaricaPDF} disabled={generandoPDF} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
              <FileDown size={12} /> {generandoPDF ? "Preparazione..." : "Scarica PDF"}
            </button>
          </div>
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3d8bfd" }}>
              Se non si è aperto automaticamente, apri il PDF qui
            </a>
          )}

          {modificaStato && (
            <div style={{ marginTop: 8, background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Esito</label>
                <select value={nuovoStato} onChange={(e) => setNuovoStato(e.target.value)} style={inputStyle}>
                  {STATI_PERMESSO.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              {nuovoStato === "negato" && (
                <div>
                  <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Motivo del rifiuto</label>
                  <textarea value={nuovoMotivo} onChange={(e) => setNuovoMotivo(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                </div>
              )}
              {nuovoStato === "autorizzato" && (
                <div>
                  <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Permesso valido</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="date" value={nuovoValidoDal} onChange={(e) => setNuovoValidoDal(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <span style={{ fontSize: 11, color: "#6b7480" }}>al</span>
                    <input type="date" value={nuovoValidoAl} onChange={(e) => setNuovoValidoAl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                    <input type="time" value={nuovoOraDalle} onChange={(e) => setNuovoOraDalle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                    <span style={{ fontSize: 11, color: "#6b7480" }}>alle</span>
                    <input type="time" value={nuovoOraAlle} onChange={(e) => setNuovoOraAlle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={salvaStato} disabled={cambiando} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "7px 14px", borderRadius: 5, fontWeight: 600, fontSize: 12 }}>
                  {cambiando ? "Salvataggio..." : "Salva"}
                </button>
                <button onClick={() => setModificaStato(false)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", padding: "7px 14px", borderRadius: 5, fontSize: 12 }}>
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// --- Attestati -----------------------------------------------------------

const TIPI_ATTESTATO_SUGGERITI = [
  "Patentino A1/A3", "Patentino A2", "Assicurazione", "Termografia Livello 1 (UNI EN ISO 9712)", "Termografia Livello 2 (UNI EN ISO 9712)",
  "Attestato teorico STS ENAC", "Attestato pratico STS (VLOS/BVLOS)",
  "UAS CRM", "Comunicazioni Aeronautiche UAS", "Registrazione operatore D-Flight", "Altro",
];

function statoScadenza(dataScadenza) {
  if (!dataScadenza) return null;
  const oggi = new Date();
  const scadenza = new Date(dataScadenza);
  const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
  if (giorni < 0) return { livello: "scaduto", testo: `Scaduto da ${Math.abs(giorni)} giorni`, colore: "#ff4d4d" };
  if (giorni <= 30) return { livello: "in_scadenza", testo: `Scade tra ${giorni} giorni`, colore: "#f5b942" };
  return { livello: "ok", testo: `Valido fino al ${formatData(dataScadenza)}`, colore: "#4ade80" };
}

function Attestati({ attestati, azienda, onReload, obiettivoFormativo, onSalvaObiettivo }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tipo, setTipo] = useState(TIPI_ATTESTATO_SUGGERITI[0]);
  const [tipoAltro, setTipoAltro] = useState("");
  const [numeroRiferimento, setNumeroRiferimento] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [dataConseguimento, setDataConseguimento] = useState("");
  const [dataScadenza, setDataScadenza] = useState("");
  const [note, setNote] = useState("");
  const [documento, setDocumento] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);
  const [obiettivoSel, setObiettivoSel] = useState(obiettivoFormativo || "");
  const [salvandoObiettivo, setSalvandoObiettivo] = useState(false);
  const [obiettivoSalvatoOk, setObiettivoSalvatoOk] = useState(false);

  const salvaObiettivo = async (valore) => {
    setObiettivoSel(valore);
    setSalvandoObiettivo(true);
    await onSalvaObiettivo(valore);
    setSalvandoObiettivo(false);
    setObiettivoSalvatoOk(true);
    setTimeout(() => setObiettivoSalvatoOk(false), 2000);
  };

  const resetForm = () => {
    setTipo(TIPI_ATTESTATO_SUGGERITI[0]); setTipoAltro(""); setNumeroRiferimento("");
    setDataConseguimento(""); setDataScadenza(""); setNote(""); setLinkUrl(""); setDocumento(null); setEditingId(null);
  };

  const apriModifica = (a) => {
    setEditingId(a.id);
    setTipo(TIPI_ATTESTATO_SUGGERITI.includes(a.tipo) ? a.tipo : "Altro");
    setTipoAltro(TIPI_ATTESTATO_SUGGERITI.includes(a.tipo) ? "" : a.tipo);
    setNumeroRiferimento(a.numero_riferimento || "");
    setLinkUrl(a.link_url || "");
    setDataConseguimento(a.data_conseguimento || "");
    setDataScadenza(a.data_scadenza || "");
    setNote(a.note || "");
    setDocumento(null);
    setShowForm(true);
  };

  const caricaDocumento = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumento({ nome: file.name, blob: file });
    e.target.value = "";
  };

  const salvaAttestato = async () => {
    const tipoFinale = tipo === "Altro" ? tipoAltro : tipo;
    if (!tipoFinale) return;
    setSalvataggio(true);
    try {
      let documentoUrl = null;
      if (documento?.blob) {
        const estensione = documento.nome.split(".").pop();
        const nomeFile = `attestato-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${estensione}`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, documento.blob);
        if (!eUp) {
          const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
          documentoUrl = pub?.publicUrl || null;
        }
      }
      const payload = {
        tipo: tipoFinale,
        numero_riferimento: numeroRiferimento || null,
        data_conseguimento: dataConseguimento || null,
        data_scadenza: dataScadenza || null,
        note: note || null,
        link_url: linkUrl || null,
      };
      if (documentoUrl) payload.documento_url = documentoUrl;
      let error;
      if (editingId) {
        ({ error } = await supabase.from("attestati").update(payload).eq("id", editingId));
      } else {
        ({ error } = await supabase.from("attestati").insert(payload));
      }
      if (error) throw error;
      resetForm();
      setShowForm(false);
      onReload();
    } catch (err) {
      alert("Salvataggio non riuscito: " + (err?.message || err));
    }
    setSalvataggio(false);
  };

  const eliminaAttestato = async (id) => {
    if (!window.confirm("Eliminare questo attestato?")) return;
    const a = attestati.find((x) => x.id === id);
    if (a?.documento_url) {
      const percorso = percorsoStorageDaUrl(a.documento_url);
      if (percorso) await supabase.storage.from("foto-ispezioni").remove([percorso]);
    }
    await supabase.from("attestati").delete().eq("id", id);
    onReload();
  };

  const scaricaPDFAttestato = async (a) => {
    try {
      let documentoDataUrl = null;
      let documentoEImmagine = false;
      if (a.documento_url) {
        const estensione = a.documento_url.split(".").pop().toLowerCase().split("?")[0];
        documentoEImmagine = ["png", "jpg", "jpeg", "webp", "gif"].includes(estensione);
        if (documentoEImmagine) {
          documentoDataUrl = await urlToDataUrl(a.documento_url);
        }
      }
      const doc = costruisciPDFAttestato({ azienda, attestato: a, documentoDataUrl, documentoEImmagine });
      const url = doc.output("bloburl");
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Attestati</h1>
        <button onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm ? "Annulla" : <><Plus size={14} /> Nuovo attestato</>}
        </button>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 16px 0" }}>Tieni traccia di patentini, attestati e scadenze. Per le operazioni in categoria Specific (scenari standard STS) controlla sempre i requisiti aggiornati sul sito ENAC.</p>

      <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 14, marginBottom: 20, maxWidth: 460 }}>
        <label style={{ fontSize: 11.5, fontWeight: 600, color: "#c3cad4", display: "block", marginBottom: 6 }}>Il tuo prossimo obiettivo formativo</label>
        <select value={obiettivoSel} onChange={(e) => salvaObiettivo(e.target.value)} disabled={salvandoObiettivo} style={inputStyle}>
          {OBIETTIVI_FORMATIVI.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {obiettivoSalvatoOk && <p style={{ fontSize: 11, color: "#4ade80", margin: "6px 0 0 0" }}>✓ Salvato</p>}
      </div>

      <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: 14, marginBottom: 20, maxWidth: 460 }}>
        <p style={{ fontSize: 11.5, fontWeight: 600, color: "#8b95a3", margin: "0 0 8px 0" }}>Corsi consigliati</p>
        {CORSI_CONSIGLIATI.length === 0 ? (
          <p style={{ fontSize: 11.5, color: "#6b7480", margin: 0, lineHeight: 1.5 }}>Nessun corso ancora aggiunto — qui compariranno, ad esempio, corsi di fotogrammetria o FPV.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CORSI_CONSIGLIATI.map((c) => (
              <a key={c.nome} href={c.url} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
                <div style={{ fontSize: 12.5, color: "#4ade80", fontWeight: 600 }}>{c.nome} ↗</div>
                {c.descrizione && <div style={{ fontSize: 11.5, color: "#6b7480" }}>{c.descrizione}</div>}
              </a>
            ))}
          </div>
        )}
      </div>

      {RISORSE_CONSIGLIATE.length > 0 && (
        <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: 14, marginBottom: 20, maxWidth: 460 }}>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: "#8b95a3", margin: "0 0 8px 0" }}>Servizi consigliati</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {RISORSE_CONSIGLIATE.map((r) => (
              <a key={r.nome} href={r.url} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
                <div style={{ fontSize: 12.5, color: "#4ade80", fontWeight: 600 }}>{r.nome} ↗</div>
                {r.descrizione && <div style={{ fontSize: 11.5, color: "#6b7480" }}>{r.descrizione}</div>}
              </a>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 16, marginBottom: 20, maxWidth: 460, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Tipo di attestato</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
              {TIPI_ATTESTATO_SUGGERITI.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {tipo === "Altro" && (
            <div>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Specifica</label>
              <input value={tipoAltro} onChange={(e) => setTipoAltro(e.target.value)} style={inputStyle} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Numero / riferimento (opzionale)</label>
            <input value={numeroRiferimento} onChange={(e) => setNumeroRiferimento(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Data conseguimento</label>
              <input type="date" value={dataConseguimento} onChange={(e) => setDataConseguimento(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Data scadenza</label>
              <input type="date" value={dataScadenza} onChange={(e) => setDataScadenza(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Documento (facoltativo, immagine o PDF)</label>
            {documento ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#c3cad4" }}>{documento.nome}</span>
                <button onClick={() => setDocumento(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
              </div>
            ) : (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                <Upload size={13} /> Carica documento
                <input type="file" accept="image/*,.pdf" onChange={caricaDocumento} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Link utile (opzionale — es. sito assicuratore, portale rinnovo)</label>
            <input type="url" placeholder="https://..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Note (opzionale)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <button onClick={salvaAttestato} disabled={salvataggio} style={{ marginTop: 4, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "9px 0", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {salvataggio ? "Salvataggio..." : editingId ? "Aggiorna attestato" : "Salva attestato"}
          </button>
        </div>
      )}

      {attestati.length === 0 ? (
        <EmptyState text="Nessun attestato ancora registrato." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {attestati.map((a) => {
            const stato = statoScadenza(a.data_scadenza);
            return (
              <div key={a.id} style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{a.tipo}</div>
                  <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>
                    {a.numero_riferimento && <>{a.numero_riferimento} &middot; </>}
                    {stato ? <span style={{ color: stato.colore, fontWeight: 600 }}>{stato.testo}</span> : "Nessuna scadenza impostata"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {a.link_url && (
                    <a href={a.link_url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #333a45", color: "#4ade80", borderRadius: 5, padding: "5px 10px", fontSize: 11.5, textDecoration: "none" }}>
                      🔗 Link
                    </a>
                  )}
                  {a.documento_url && (
                    <a href={a.documento_url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #333a45", color: "#3d8bfd", borderRadius: 5, padding: "5px 10px", fontSize: 11.5, textDecoration: "none" }}>
                      <FileDown size={12} /> Documento
                    </a>
                  )}
                  <button onClick={() => scaricaPDFAttestato(a)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    <FileDown size={12} /> PDF
                  </button>
                  <button onClick={() => apriModifica(a)} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    Modifica
                  </button>
                  <button onClick={() => eliminaAttestato(a.id)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    Elimina
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Droni -----------------------------------------------------------

function statoManutenzione(dataScadenza) {
  if (!dataScadenza) return null;
  const oggi = new Date();
  const scadenza = new Date(dataScadenza);
  const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
  if (giorni < 0) return { livello: "scaduto", testo: `Manutenzione in ritardo di ${Math.abs(giorni)} giorni`, colore: "#ff4d4d" };
  if (giorni <= 30) return { livello: "in_scadenza", testo: `Manutenzione tra ${giorni} giorni`, colore: "#f5b942" };
  return { livello: "ok", testo: `Prossima manutenzione: ${formatData(dataScadenza)}`, colore: "#4ade80" };
}

function Droni({ droni, azienda, onReload }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [modello, setModello] = useState("");
  const [matricola, setMatricola] = useState("");
  const [marcaturaClasse, setMarcaturaClasse] = useState("");
  const [registrazioneDflight, setRegistrazioneDflight] = useState("");
  const [dataAcquisto, setDataAcquisto] = useState("");
  const [oreVolo, setOreVolo] = useState("");
  const [prossimaManutenzione, setProssimaManutenzione] = useState("");
  const [ventoMax, setVentoMax] = useState("");
  const [note, setNote] = useState("");
  const [documento, setDocumento] = useState(null);
  const [salvataggio, setSalvataggio] = useState(false);

  const resetForm = () => {
    setVentoMax("");
    setNome(""); setModello(""); setMatricola(""); setMarcaturaClasse("");
    setRegistrazioneDflight(""); setDataAcquisto(""); setOreVolo("");
    setProssimaManutenzione(""); setNote(""); setDocumento(null); setEditingId(null);
  };

  const apriModifica = (d) => {
    setEditingId(d.id);
    setNome(d.nome || "");
    setModello(d.modello || "");
    setMatricola(d.matricola || "");
    setMarcaturaClasse(d.marcatura_classe || "");
    setRegistrazioneDflight(d.registrazione_dflight || "");
    setDataAcquisto(d.data_acquisto || "");
    setOreVolo(d.ore_volo ? String(d.ore_volo) : "");
    setProssimaManutenzione(d.prossima_manutenzione || "");
    setVentoMax(d.vento_max_kmh != null ? String(d.vento_max_kmh) : "");
    setNote(d.note || "");
    setDocumento(null);
    setShowForm(true);
  };

  const caricaDocumento = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumento({ nome: file.name, blob: file });
    e.target.value = "";
  };

  const salvaDrone = async () => {
    if (!nome) return;
    setSalvataggio(true);
    try {
      let documentoUrl = null;
      if (documento?.blob) {
        const estensione = documento.nome.split(".").pop();
        const nomeFile = `drone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${estensione}`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, documento.blob);
        if (!eUp) {
          const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
          documentoUrl = pub?.publicUrl || null;
        }
      }
      const payload = {
        nome,
        modello: modello || null,
        matricola: matricola || null,
        marcatura_classe: marcaturaClasse || null,
        registrazione_dflight: registrazioneDflight || null,
        data_acquisto: dataAcquisto || null,
        ore_volo: oreVolo ? Number(oreVolo) : null,
        prossima_manutenzione: prossimaManutenzione || null,
        note: note || null,
      };
      // il limite di vento si salva solo se lo indichi (o se lo stai togliendo): così l'app funziona anche prima dello script SQL
      const droneInModifica = editingId ? droni.find((x) => x.id === editingId) : null;
      if (ventoMax !== "" || (droneInModifica && droneInModifica.vento_max_kmh != null)) payload.vento_max_kmh = ventoMax !== "" ? Number(ventoMax) : null;
      if (documentoUrl) payload.documento_url = documentoUrl;
      let error;
      if (editingId) {
        ({ error } = await supabase.from("droni").update(payload).eq("id", editingId));
      } else {
        ({ error } = await supabase.from("droni").insert(payload));
      }
      if (error) throw error;
      resetForm();
      setShowForm(false);
      onReload();
    } catch (err) {
      alert("Salvataggio non riuscito: " + (err?.message || err));
    }
    setSalvataggio(false);
  };

  const eliminaDrone = async (id) => {
    if (!window.confirm("Eliminare questo drone dal registro?")) return;
    const d = droni.find((x) => x.id === id);
    if (d?.documento_url) {
      const percorso = percorsoStorageDaUrl(d.documento_url);
      if (percorso) await supabase.storage.from("foto-ispezioni").remove([percorso]);
    }
    await supabase.from("droni").delete().eq("id", id);
    onReload();
  };

  const scaricaPDFDrone = async (d) => {
    try {
      let documentoDataUrl = null;
      let documentoEImmagine = false;
      if (d.documento_url) {
        const estensione = d.documento_url.split(".").pop().toLowerCase().split("?")[0];
        documentoEImmagine = ["png", "jpg", "jpeg", "webp", "gif"].includes(estensione);
        if (documentoEImmagine) documentoDataUrl = await urlToDataUrl(d.documento_url);
      }
      const doc = costruisciPDFDrone({ azienda, drone: d, documentoDataUrl, documentoEImmagine });
      const url = doc.output("bloburl");
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>I miei droni</h1>
        <button onClick={() => { if (showForm) { resetForm(); setShowForm(false); } else { resetForm(); setShowForm(true); } }} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm ? "Annulla" : <><Plus size={14} /> Nuovo drone</>}
        </button>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 20px 0" }}>Tieni traccia di modelli, matricole, registrazione D-Flight e scadenze di manutenzione della tua flotta.</p>

      {showForm && !editingId && (() => {
        const assicurazioneConsigliata = RISORSE_CONSIGLIATE.find((r) => r.nome.toLowerCase().includes("assicura"));
        return (
          <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: "10px 14px", marginBottom: 14, maxWidth: 460, fontSize: 12, color: "#c3cad4" }}>
            💡 Ricorda: ogni drone dev'essere assicurato, anche in categoria Aperta.{" "}
            {assicurazioneConsigliata ? (
              <a href={assicurazioneConsigliata.url} target="_blank" rel="noreferrer" style={{ color: "#4ade80", fontWeight: 600 }}>{assicurazioneConsigliata.nome} ↗</a>
            ) : (
              <span style={{ color: "#6b7480" }}>Trovi il link per un preventivo in "Attestati".</span>
            )}
          </div>
        );
      })()}

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 16, marginBottom: 20, maxWidth: 460, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Nome / etichetta</label>
            <input placeholder="es. Matrice 4T principale" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Modello</label>
              <input placeholder="es. DJI Matrice 4T" value={modello} onChange={(e) => setModello(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Matricola</label>
              <input value={matricola} onChange={(e) => setMatricola(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Marcatura classe (C0-C5)</label>
              <input placeholder="es. C1" value={marcaturaClasse} onChange={(e) => setMarcaturaClasse(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Registrazione D-Flight</label>
              <input value={registrazioneDflight} onChange={(e) => setRegistrazioneDflight(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Data acquisto</label>
              <input type="date" value={dataAcquisto} onChange={(e) => setDataAcquisto(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Ore di volo</label>
              <input type="number" value={oreVolo} onChange={(e) => setOreVolo(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Prossima manutenzione</label>
            <input type="date" value={prossimaManutenzione} onChange={(e) => setProssimaManutenzione(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Vento massimo consigliato (km/h)</label>
            <input type="number" min="0" placeholder="es. 38 (lo trovi nel manuale)" value={ventoMax} onChange={(e) => setVentoMax(e.target.value)} style={inputStyle} />
            <p style={{ fontSize: 10.5, color: "#6b7480", margin: "4px 0 0 0" }}>Lo usa il semaforo meteo in «Pianificazione volo». Se lo lasci vuoto vale il limite standard di 30 km/h.</p>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Documento (facoltativo, es. certificato di conformità)</label>
            {documento ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, color: "#c3cad4" }}>{documento.nome}</span>
                <button onClick={() => setDocumento(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
              </div>
            ) : (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                <Upload size={13} /> Carica documento
                <input type="file" accept="image/*,.pdf" onChange={caricaDocumento} style={{ display: "none" }} />
              </label>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Note (opzionale)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <button onClick={salvaDrone} disabled={!nome || salvataggio} style={{ marginTop: 4, background: nome ? "#ff8c42" : "#333a45", color: nome ? "#161a1f" : "#6b7480", border: "none", padding: "9px 0", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {salvataggio ? "Salvataggio..." : editingId ? "Aggiorna drone" : "Salva drone"}
          </button>
        </div>
      )}

      {droni.length === 0 ? (
        <EmptyState text="Nessun drone ancora registrato." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {droni.map((d) => {
            const stato = statoManutenzione(d.prossima_manutenzione);
            return (
              <div key={d.id} style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{d.nome}</div>
                  <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>
                    {d.modello && <>{d.modello} &middot; </>}
                    {d.matricola && <>{d.matricola} &middot; </>}
                    {stato ? <span style={{ color: stato.colore, fontWeight: 600 }}>{stato.testo}</span> : "Nessuna manutenzione programmata"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {d.documento_url && (
                    <a href={d.documento_url} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #333a45", color: "#3d8bfd", borderRadius: 5, padding: "5px 10px", fontSize: 11.5, textDecoration: "none" }}>
                      <FileDown size={12} /> Documento
                    </a>
                  )}
                  <button onClick={() => scaricaPDFDrone(d)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    <FileDown size={12} /> PDF
                  </button>
                  <button onClick={() => apriModifica(d)} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    Modifica
                  </button>
                  <button onClick={() => eliminaDrone(d.id)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>
                    Elimina
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Analisi termica (dati radiometrici reali) -----------------------------------------------------------

const PALETTE_TERMICHE = [
  { key: "ironbow", label: "Ironbow (classico)" },
  { key: "rainbow", label: "Rainbow" },
  { key: "whitehot", label: "White hot" },
  { key: "blackhot", label: "Black hot" },
  { key: "arctic", label: "Arctic" },
  { key: "lava", label: "Lava" },
];

function AnalisiTermica({ piano }) {
  const [fotoOriginale, setFotoOriginale] = useState(null); // { nome, base64 }
  const [palette, setPalette] = useState("ironbow");
  const [risultato, setRisultato] = useState(null); // { imageBase64, width, height, minTemp, maxTemp, parametri }
  const [elaborando, setElaborando] = useState(false);
  const [errore, setErrore] = useState(null);

  const caricaFoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrore(null);
    setRisultato(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      setFotoOriginale({ nome: file.name, base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const elabora = async () => {
    if (!fotoOriginale) return;
    setElaborando(true);
    setErrore(null);
    try {
      const res = await fetch("/.netlify/functions/thermal-repalette", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: fotoOriginale.base64, palette }),
      });
      const testoRisposta = await res.text();
      let dati = null;
      try { dati = JSON.parse(testoRisposta); } catch (e) { /* risposta non era JSON pulito */ }
      if (!res.ok) {
        throw new Error((dati && dati.errore) || `Errore del server (status ${res.status}): ${testoRisposta.slice(0, 400)}`);
      }
      if (!dati) throw new Error("Risposta del server non valida: " + testoRisposta.slice(0, 400));
      setRisultato(dati);
    } catch (err) {
      setErrore(err.message || "Non sono riuscito a elaborare la foto.");
    }
    setElaborando(false);
  };

  if (piano !== "pro") {
    return (
      <div style={{ padding: "28px 32px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px 0" }}>Analisi termica</h1>
        <div style={{ maxWidth: 420, background: "#241d16", border: "1px solid #4a2f16", borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 13.5, color: "#ffb877", margin: "0 0 10px 0", fontWeight: 600 }}>🔒 Funzione riservata al piano Pro</p>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: 0, lineHeight: 1.5 }}>
            Ricalcola davvero la temperatura di ogni pixel dalla foto radiometrica originale e cambia la palette di colori — disponibile solo con il piano Pro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Analisi termica</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 20px 0", maxWidth: 560 }}>
        Carica una foto termica radiometrica originale del drone (R-JPEG, non modificata da altri software). Ricalcoliamo la temperatura reale di ogni pixel e la ricoloriamo con la palette che scegli.
      </p>

      <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: "#8b95a3", display: "block", marginBottom: 6 }}>Foto termica (R-JPEG)</label>
          {fotoOriginale ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12.5, color: "#c3cad4" }}>{fotoOriginale.nome}</span>
              <button onClick={() => { setFotoOriginale(null); setRisultato(null); }} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
            </div>
          ) : (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "10px 16px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
              <Upload size={13} /> Carica foto termica
              <input type="file" accept="image/jpeg,.jpg" onChange={caricaFoto} style={{ display: "none" }} />
            </label>
          )}
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#8b95a3", display: "block", marginBottom: 6 }}>Palette</label>
          <select value={palette} onChange={(e) => setPalette(e.target.value)} style={inputStyle}>
            {PALETTE_TERMICHE.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>

        <button onClick={elabora} disabled={!fotoOriginale || elaborando} style={{ background: fotoOriginale ? "#ff8c42" : "#333a45", color: fotoOriginale ? "#161a1f" : "#6b7480", border: "none", padding: "10px 0", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
          {elaborando ? "Elaborazione..." : "Genera"}
        </button>

        {errore && (
          <p style={{ fontSize: 12, color: "#ff9c9c", background: "#2a1616", border: "1px solid #5a2a2a", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
            {errore}
          </p>
        )}
      </div>

      {risultato && (
        <div style={{ marginTop: 20, maxWidth: 480 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8, color: "#8b95a3" }}>
            <span>Min: <strong style={{ color: "#3d8bfd" }}>{risultato.minTemp}°C</strong></span>
            <span>Max: <strong style={{ color: "#ff4d4d" }}>{risultato.maxTemp}°C</strong></span>
          </div>
          <img src={`data:image/png;base64,${risultato.imageBase64}`} alt="Foto termica ricolorata" style={{ width: "100%", borderRadius: 8, border: "1px solid #333a45" }} />
          <a
            href={`data:image/png;base64,${risultato.imageBase64}`}
            download={`termica-${palette}.png`}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "9px 16px", borderRadius: 6, fontSize: 13, textDecoration: "none" }}
          >
            <FileDown size={14} /> Scarica immagine
          </a>
        </div>
      )}
    </div>
  );
}

// --- Pianificazione volo (separata dall'ispezione vera e propria: si fa giorni prima) -----------------------------------------------------------

const ETICHETTE_TIPO_PIANO = {
  fotovoltaico: "Fotovoltaico termico", danni: "Danni / assicurativa", edifici: "Termografia edifici", elettrico: "Impianti elettrici",
  video: "Video", foto: "Foto", fpv: "FPV", altro: "Altro",
};
// il vocabolario dei tipi nella Pianificazione (ispezioni + riprese) non è lo stesso del Registro voli: le 4 ispezioni diventano genericamente "ispezione" là
const MAPPA_TIPO_PIANO_A_REGISTRO = { fotovoltaico: "ispezione", danni: "ispezione", edifici: "ispezione", elettrico: "ispezione", video: "video", foto: "foto", fpv: "fpv", altro: "altro" };

function PianificazioneVolo({ azienda, impianti, onVaiRegistroConDati, session }) {
  const [impiantoSel, setImpiantoSel] = useState(null);
  const [tipoIspezione, setTipoIspezione] = useState("fotovoltaico");
  const [dataPrevista, setDataPrevista] = useState(() => new Date().toISOString().slice(0, 10));
  const [meteo, setMeteo] = useState(null);
  const [meteoSpaziale, setMeteoSpaziale] = useState(null);
  const [caricandoMeteo, setCaricandoMeteo] = useState(false);
  const [erroreMeteo, setErroreMeteo] = useState(null);
  const [checklistItems, setChecklistItems] = useState(null);
  const [checklistSpuntati, setChecklistSpuntati] = useState({});
  const [nuovaVoceChecklist, setNuovaVoceChecklist] = useState("");
  const [attestatiUtente, setAttestatiUtente] = useState([]);
  const [droniUtente, setDroniUtente] = useState([]);
  const [permessiUtente, setPermessiUtente] = useState([]);
  const [droneSelId, setDroneSelId] = useState("");
  const [dflightShot, setDflightShot] = useState(null);
  const [generandoPdfControllo, setGenerandoPdfControllo] = useState(false);
  const [pdfUrlControllo, setPdfUrlControllo] = useState(null);
  const [mostraSchermoControllo, setMostraSchermoControllo] = useState(false);
  const [salvandoPiano, setSalvandoPiano] = useState(false);
  const [pianiSalvati, setPianiSalvati] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [modoLibero, setModoLibero] = useState(false); // true = un luogo scelto a mano, senza impianto
  const [luogoLibero, setLuogoLibero] = useState("");
  const [coordinateLibere, setCoordinateLibere] = useState("");
  const [gpsInCorso, setGpsInCorso] = useState(false);

  const caricaTutto = async () => {
    const [{ data: checklist }, { data: att }, { data: drn }, { data: perm }, { data: piani }] = await Promise.all([
      supabase.from("checklist_voli").select("*").eq("user_id", session.user.id).order("ordine", { ascending: true }),
      supabase.from("attestati").select("*"),
      supabase.from("droni").select("*"),
      supabase.from("permessi").select("*"),
      supabase.from("piani_volo").select("*").order("data_prevista", { ascending: true }),
    ]);
    setChecklistItems(checklist && checklist.length > 0 ? checklist.map((d) => d.testo) : CHECKLIST_DEFAULT);
    setAttestatiUtente(att || []);
    setDroniUtente(drn || []);
    setPermessiUtente(perm || []);
    setPianiSalvati(piani || []);
  };

  useEffect(() => { caricaTutto(); }, []);

  const droneSelezionato = droniUtente.find((d) => d.id === droneSelId) || null;
  const coordinateValide = modoLibero ? leggiCoordinate(coordinateLibere) : null;
  // il posto del volo: un impianto oppure un luogo scritto a mano (nome e/o coordinate)
  const destinazione = impiantoSel
    ? { nome: impiantoSel.nome, zona: impiantoSel.zona, id: impiantoSel.id }
    : modoLibero && (luogoLibero.trim() || coordinateValide)
      ? { nome: luogoLibero.trim() || `${coordinateValide.lat.toFixed(4)}, ${coordinateValide.lon.toFixed(4)}`, zona: luogoLibero.trim(), id: null }
      : null;
  const permessiZona = !destinazione ? [] : permessiUtente.filter((p) =>
    (destinazione.id && p.impianto_id === destinazione.id) || (p.impianto && p.impianto.toLowerCase().includes(destinazione.nome.toLowerCase()))
  );
  const lblPian = { fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 };

  const usaPosizione = () => {
    if (!navigator.geolocation) { alert("Questo dispositivo non supporta la posizione."); return; }
    setGpsInCorso(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoordinateLibere(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`); setGpsInCorso(false); },
      () => { alert("Non riesco a leggere la posizione. Controlla di aver dato il permesso al browser."); setGpsInCorso(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const controllaMeteo = async () => {
    const target = coordinateValide
      ? { lat: coordinateValide.lat, lon: coordinateValide.lon, nome: destinazione ? destinazione.nome : "" }
      : (destinazione && destinazione.zona) || null;
    if (!target) {
      setErroreMeteo(impiantoSel ? "Questo impianto non ha una località: aggiungila in «Impianti»." : "Scrivi il nome del luogo oppure le coordinate.");
      return;
    }
    setCaricandoMeteo(true);
    setErroreMeteo(null);
    try {
      const [datiMeteo, datiSpaziali] = await Promise.all([
        recuperaMeteo(target),
        recuperaMeteoSpaziale().catch(() => null),
      ]);
      setMeteo(datiMeteo);
      setMeteoSpaziale(datiSpaziali);
    } catch (err) {
      setErroreMeteo(err.message || "Non sono riuscito a recuperare il meteo.");
    }
    setCaricandoMeteo(false);
  };

  // il semaforo usa il limite di vento del drone scelto (30 km/h se non è indicato)
  const limiteVento = Number(droneSelezionato && droneSelezionato.vento_max_kmh) > 0 ? Number(droneSelezionato.vento_max_kmh) : 30;
  const giornoPrevistoBase = meteo?.prossimiGiorni?.find((g) => g.data === dataPrevista);
  const giornoPrevisto = giornoPrevistoBase ? { ...giornoPrevistoBase, adatto: valutaGiorno(giornoPrevistoBase, limiteVento) } : undefined;
  const kpPrevisto = meteoSpaziale?.previsioneGiorni?.find((g) => g.giorno === dataPrevista);
  const luce = meteo && meteo.lat != null && dataPrevista ? calcolaLuce(dataPrevista, meteo.lat, meteo.lon) : null;
  const oraLuce = (d) => formattaOraLuogo(d, meteo?.fusoOrario);
  const fasciaLuce = ([da, a]) => (da && a ? `${oraLuce(da)} – ${oraLuce(a)}` : "—");

  const toggleChecklist = (idx) => setChecklistSpuntati((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const salvaChecklistSuDb = async (lista) => {
    const { error: eDel } = await supabase.from("checklist_voli").delete().eq("user_id", session.user.id);
    if (eDel) { alert("Non sono riuscito a salvare la checklist: " + eDel.message); return; }
    if (lista.length > 0) {
      const { error: eIns } = await supabase.from("checklist_voli").insert(lista.map((testo, ordine) => ({ testo, ordine, user_id: session.user.id })));
      if (eIns) alert("Non sono riuscito a salvare la checklist: " + eIns.message);
    }
  };
  const aggiungiVoceChecklist = async () => {
    if (!nuovaVoceChecklist.trim()) return;
    const nuovaLista = [...(checklistItems || []), nuovaVoceChecklist.trim()];
    setChecklistItems(nuovaLista);
    setNuovaVoceChecklist("");
    await salvaChecklistSuDb(nuovaLista);
  };
  const rimuoviVoceChecklist = async (idx) => {
    const nuovaLista = checklistItems.filter((_, i) => i !== idx);
    setChecklistItems(nuovaLista);
    await salvaChecklistSuDb(nuovaLista);
  };

  const caricaDflightShot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDflightShot({ nome: file.name, blob: file, dataUrl: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scaricaPdfControllo = () => {
    setGenerandoPdfControllo(true);
    try {
      const doc = costruisciPDFControllo({ azienda, operatore: azienda.nome, attestati: attestatiUtente, drone: droneSelezionato, permessi: permessiZona, impianto: destinazione });
      const url = doc.output("bloburl");
      setPdfUrlControllo(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerandoPdfControllo(false);
  };

  const salvaPiano = async () => {
    if (!destinazione) return;
    setSalvandoPiano(true);
    try {
      let dflightUrl = dflightShot?.remota ? dflightShot.dataUrl : null;
      if (dflightShot?.blob) {
        const nomeFile = `dflight-piano-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, dflightShot.blob);
        if (!eUp) {
          const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
          dflightUrl = pub?.publicUrl || null;
        }
      }
      const payload = {
        impianto_id: impiantoSel ? impiantoSel.id : null,
        impianto_nome: destinazione.nome,
        tipo_ispezione: tipoIspezione,
        data_prevista: dataPrevista,
        drone_id: droneSelId || null,
        dflight_screenshot_url: dflightUrl,
        checklist_stato: { voci: checklistItems || [], spuntati: checklistSpuntati },
      };
      // le coordinate si salvano solo per un luogo scelto a mano
      if (!impiantoSel) payload.luogo_coordinate = coordinateValide ? `${coordinateValide.lat}, ${coordinateValide.lon}` : null;
      const { error } = editingId
        ? await supabase.from("piani_volo").update(payload).eq("id", editingId)
        : await supabase.from("piani_volo").insert(payload);
      if (error) throw error;
      await caricaTutto();
      const eraModifica = !!editingId;
      setEditingId(null);
      alert(eraModifica ? "Piano di volo aggiornato." : "Piano di volo salvato.");
    } catch (err) {
      alert("Non sono riuscito a salvare il piano: " + (err?.message || err));
    }
    setSalvandoPiano(false);
  };

  const apriPiano = (p) => {
    setEditingId(p.id);
    const imp = p.impianto_id ? impianti.find((i) => i.id === p.impianto_id) : null;
    if (imp) {
      setImpiantoSel(imp); setModoLibero(false); setLuogoLibero(""); setCoordinateLibere("");
    } else {
      setImpiantoSel(null); setModoLibero(true); setLuogoLibero(p.impianto_nome || ""); setCoordinateLibere(p.luogo_coordinate || "");
    }
    setTipoIspezione(p.tipo_ispezione || "fotovoltaico");
    setDataPrevista(p.data_prevista || new Date().toISOString().slice(0, 10));
    setDroneSelId(p.drone_id || "");
    setDflightShot(p.dflight_screenshot_url ? { dataUrl: p.dflight_screenshot_url, remota: true } : null);
    if (p.checklist_stato && p.checklist_stato.voci) {
      setChecklistItems(p.checklist_stato.voci);
      setChecklistSpuntati(p.checklist_stato.spuntati || {});
    } else {
      setChecklistSpuntati({});
    }
    setMeteo(null);
    setMeteoSpaziale(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const annullaModifica = () => {
    setEditingId(null);
    setImpiantoSel(null);
    setModoLibero(false);
    setLuogoLibero("");
    setCoordinateLibere("");
    setDroneSelId("");
    setDflightShot(null);
    setMeteo(null);
    setMeteoSpaziale(null);
  };

  const eliminaPiano = async (id) => {
    if (!window.confirm("Eliminare questo piano di volo?")) return;
    if (editingId === id) annullaModifica();
    const p = pianiSalvati.find((x) => x.id === id);
    if (p?.dflight_screenshot_url) {
      const percorso = percorsoStorageDaUrl(p.dflight_screenshot_url);
      if (percorso) await supabase.storage.from("foto-ispezioni").remove([percorso]);
    }
    await supabase.from("piani_volo").delete().eq("id", id);
    caricaTutto();
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Pianificazione volo</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 20px 0", maxWidth: 560 }}>
        Prepara un volo con giorni di anticipo: scegli dove (un tuo impianto oppure un posto qualsiasi), il drone e la data; controlla meteo e attività solare e spunta la checklist. Vale per ispezioni, video, foto e FPV.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: modoLibero ? 8 : 16 }}>
        <div style={{ minWidth: 220 }}>
          <label style={lblPian}>Dove voli</label>
          <select
            value={impiantoSel ? impiantoSel.id : (modoLibero ? "__libero" : "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__libero") { setImpiantoSel(null); setModoLibero(true); }
              else { setModoLibero(false); setImpiantoSel(impianti.find((i) => i.id === v) || null); }
              setMeteo(null); setMeteoSpaziale(null);
            }}
            style={inputStyle}
          >
            <option value="">— Seleziona —</option>
            {impianti.length > 0 && <optgroup label="I tuoi impianti">{impianti.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}</optgroup>}
            <option value="__libero">📍 Un altro luogo (lo scrivo io)</option>
          </select>
        </div>
        <div style={{ minWidth: 190 }}>
          <label style={lblPian}>Drone</label>
          <select value={droneSelId} onChange={(e) => setDroneSelId(e.target.value)} style={inputStyle}>
            <option value="">— Nessuno —</option>
            {droniUtente.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 190 }}>
          <label style={lblPian}>Tipo di volo</label>
          <select value={tipoIspezione} onChange={(e) => setTipoIspezione(e.target.value)} style={inputStyle}>
            <optgroup label="Ispezioni">
              <option value="fotovoltaico">Fotovoltaico termico</option>
              <option value="danni">Danni / ispezione assicurativa</option>
              <option value="edifici">Termografia edifici</option>
              <option value="elettrico">Impianti elettrici/industriali</option>
            </optgroup>
            <optgroup label="Riprese">
              <option value="video">Video</option>
              <option value="foto">Foto</option>
              <option value="fpv">FPV</option>
              <option value="altro">Altro</option>
            </optgroup>
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={lblPian}>Data prevista</label>
          <input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} style={inputStyle} />
        </div>
      </div>

      {modoLibero && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, maxWidth: 620 }}>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={lblPian}>Nome del luogo</label>
            <input type="text" placeholder="es. Lago di Viverone" value={luogoLibero} onChange={(e) => { setLuogoLibero(e.target.value); setMeteo(null); }} style={inputStyle} />
          </div>
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={lblPian}>Oppure le coordinate</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" placeholder="45.0703, 7.6869" value={coordinateLibere} onChange={(e) => { setCoordinateLibere(e.target.value); setMeteo(null); }} style={inputStyle} />
              <button type="button" onClick={usaPosizione} disabled={gpsInCorso} title="Usa la mia posizione" style={{ background: "#262b33", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "0 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                {gpsInCorso ? "..." : "📍"}
              </button>
            </div>
          </div>
          {coordinateLibere.trim() && !coordinateValide && (
            <p style={{ flexBasis: "100%", fontSize: 11.5, color: "#f5b942", margin: 0 }}>Formato delle coordinate non riconosciuto: scrivi per esempio 45.0703, 7.6869</p>
          )}
        </div>
      )}

      {destinazione && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, maxWidth: 620 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={controllaMeteo} disabled={caricandoMeteo} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 12.5, fontWeight: 600 }}>
              {caricandoMeteo ? "Controllo in corso..." : "Controlla meteo e attività solare"}
            </button>
            <a href="https://www.d-flight.it/web-app/" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 6, padding: "8px 16px", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}>
              🗺️ Apri D-Flight
            </a>
          </div>

          {erroreMeteo && <p style={{ fontSize: 11.5, color: "#ff9c9c", marginTop: 8 }}>{erroreMeteo}</p>}

          {giornoPrevisto && (
            <div style={{ marginTop: 12, background: "#161a1f", border: `1px solid ${giornoPrevisto.adatto ? "#4ade8055" : "#ff9c9c55"}`, borderRadius: 6, padding: 12 }}>
              <p style={{ fontSize: 11, color: "#6b7480", margin: "0 0 6px 0" }}>Previsione per il {formatData(dataPrevista)} · soglia vento {limiteVento} km/h{droneSelezionato && droneSelezionato.vento_max_kmh ? ` (da ${droneSelezionato.nome})` : " (standard)"}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12.5 }}>
                <div>🌡️ {giornoPrevisto.tMin}° / {giornoPrevisto.tMax}°</div>
                <div>💨 max {giornoPrevisto.ventoMax} km/h (raffiche {giornoPrevisto.raffiche})</div>
                <div>🌧️ {giornoPrevisto.pioggia} mm{giornoPrevisto.probPioggia != null ? ` (${giornoPrevisto.probPioggia}%)` : ""}</div>
                <div style={{ fontWeight: 700, color: giornoPrevisto.adatto ? "#4ade80" : "#ff9c9c" }}>{giornoPrevisto.adatto ? "✓ Condizioni favorevoli" : "⚠ Valuta di rimandare"}</div>
              </div>
            </div>
          )}
          {meteo && !giornoPrevisto && (
            <p style={{ fontSize: 11.5, color: "#ff9c9c", marginTop: 8 }}>La data scelta è oltre i 16 giorni di previsione disponibile — riprova più vicino alla data.</p>
          )}

          {luce && (
            <div style={{ marginTop: 10, background: "#161a1f", border: "1px solid #f5b94255", borderRadius: 6, padding: 12 }}>
              <p style={{ fontSize: 11, color: "#6b7480", margin: "0 0 6px 0" }}>Luce del {formatData(dataPrevista)} · orari del luogo del volo</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12.5 }}>
                <div>🌅 Alba {oraLuce(luce.alba)}</div>
                <div>🌇 Tramonto {oraLuce(luce.tramonto)}</div>
                <div style={{ color: "#f5b942" }}>✨ Ora d'oro {fasciaLuce(luce.oraOroMattina)}</div>
                <div style={{ color: "#f5b942" }}>✨ Ora d'oro {fasciaLuce(luce.oraOroSera)}</div>
                <div style={{ color: "#7fa8ff" }}>🔵 Ora blu {fasciaLuce(luce.oraBluMattina)}</div>
                <div style={{ color: "#7fa8ff" }}>🔵 Ora blu {fasciaLuce(luce.oraBluSera)}</div>
              </div>
              {["video", "foto", "fpv"].includes(tipoIspezione) && (
                <p style={{ fontSize: 11, color: "#6b7480", margin: "8px 0 0 0" }}>L'ora d'oro dà la luce più calda e morbida per le riprese. Prima dell'alba e dopo il tramonto controlla le regole per il volo notturno e le luci anticollisione del drone.</p>
              )}
            </div>
          )}

          {kpPrevisto ? (
            <div style={{ marginTop: 10, background: "#161a1f", border: `1px solid ${kpPrevisto.colore}55`, borderRadius: 6, padding: 12 }}>
              <p style={{ fontSize: 11, color: "#6b7480", margin: "0 0 4px 0" }}>Attività geomagnetica prevista per il {formatData(dataPrevista)}</p>
              <p style={{ fontSize: 12.5, color: kpPrevisto.colore, margin: 0, fontWeight: 600 }}>Kp {kpPrevisto.kpMax} — {kpPrevisto.testo}</p>
            </div>
          ) : meteoSpaziale && (
            <p style={{ fontSize: 11, color: "#6b7480", marginTop: 8 }}>Previsione geomagnetica affidabile solo fino a 3 giorni prima — per date più lontane, ricontrolla vicino al volo.</p>
          )}

          <div style={{ marginTop: 16, borderTop: "1px solid #262b33", paddingTop: 14 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 8px 0" }}>Checklist pre-volo</p>
            {(checklistItems || []).map((voce, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: checklistSpuntati[idx] ? "#4ade80" : "#c3cad4", flex: 1, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!checklistSpuntati[idx]} onChange={() => toggleChecklist(idx)} />
                  {voce}
                </label>
                <button type="button" onClick={() => rimuoviVoceChecklist(idx)} title="Rimuovi voce" style={{ background: "none", border: "none", color: "#6b7480", fontSize: 13, padding: "0 4px" }}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="text" placeholder="Aggiungi voce personalizzata..." value={nuovaVoceChecklist} onChange={(e) => setNuovaVoceChecklist(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aggiungiVoceChecklist()} style={{ ...inputStyle, flex: 1, fontSize: 12.5, padding: "6px 10px" }} />
              <button type="button" onClick={aggiungiVoceChecklist} style={{ background: "#262b33", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "6px 12px", fontSize: 12.5 }}>+ Aggiungi</button>
            </div>
          </div>

          <div style={{ marginTop: 16, borderTop: "1px solid #262b33", paddingTop: 14 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, margin: "0 0 4px 0" }}>🚔 In caso di controllo</p>
            <p style={{ fontSize: 11, color: "#6b7480", margin: "0 0 10px 0" }}>Riepilogo dei documenti da mostrare a chi ti ferma.</p>

            <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 6 }}>
              <strong>Drone:</strong> {droneSelezionato ? droneSelezionato.nome : <span style={{ color: "#8b95a3" }}>nessuno scelto (sceglilo in alto)</span>}
            </div>

            <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 4 }}>
              <strong>Attestati:</strong>{" "}
              {attestatiUtente.length === 0 ? "nessuno registrato" : attestatiUtente.map((a) => {
                const scaduto = a.data_scadenza && new Date(a.data_scadenza) < new Date();
                return <span key={a.id} style={{ color: scaduto ? "#ff9c9c" : "#4ade80" }}>{a.tipo}{scaduto ? " (scaduto!) " : " ✓ "}</span>;
              })}
            </div>
            {(() => {
              const assicurazione = attestatiUtente.find((a) => a.tipo.toLowerCase().includes("assicura"));
              const scadutaAssicurazione = assicurazione?.data_scadenza && new Date(assicurazione.data_scadenza) < new Date();
              return (
                <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 4 }}>
                  <strong>Assicurazione:</strong>{" "}
                  {assicurazione
                    ? <span style={{ color: scadutaAssicurazione ? "#ff9c9c" : "#4ade80" }}>{scadutaAssicurazione ? "SCADUTA il " : "valida fino al "}{assicurazione.data_scadenza ? formatData(assicurazione.data_scadenza) : "—"}</span>
                    : <span style={{ color: "#ff9c9c" }}>non registrata — aggiungila in "Attestati"</span>}
                </div>
              );
            })()}
            <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 4 }}>
              <strong>Permessi per questa zona:</strong> {permessiZona.length === 0 ? "nessuno specifico registrato" : `${permessiZona.length} trovato/i`}
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Screenshot D-Flight per questa missione (facoltativo)</label>
              {dflightShot ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={dflightShot.dataUrl} alt="D-Flight" style={{ width: 90, borderRadius: 6, border: "1px solid #333a45" }} />
                  <button onClick={() => setDflightShot(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
                </div>
              ) : (
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                  <Upload size={13} /> Carica screenshot
                  <input type="file" accept="image/*" onChange={caricaDflightShot} style={{ display: "none" }} />
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
              <button type="button" onClick={() => setMostraSchermoControllo(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "9px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}>
                📱 Mostra a schermo pieno
              </button>
              <button type="button" onClick={scaricaPdfControllo} disabled={generandoPdfControllo} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "9px 14px", borderRadius: 6, fontSize: 12.5 }}>
                <FileDown size={13} /> {generandoPdfControllo ? "Preparazione..." : "Scarica PDF"}
              </button>
            </div>
            {pdfUrlControllo && (
              <a href={pdfUrlControllo} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11, color: "#3d8bfd" }}>
                Se non si è aperto automaticamente, apri il PDF qui
              </a>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
            <button type="button" onClick={salvaPiano} disabled={salvandoPiano} style={{ flex: 1, background: "#4ade80", color: "#0a1a0f", border: "none", padding: "10px 0", borderRadius: 6, fontWeight: 700, fontSize: 13.5 }}>
              {salvandoPiano ? "Salvataggio..." : editingId ? "💾 Aggiorna piano di volo" : "💾 Salva questo piano di volo"}
            </button>
            {editingId && (
              <button type="button" onClick={annullaModifica} style={{ background: "transparent", border: "1px solid #333a45", color: "#8b95a3", padding: "10px 16px", borderRadius: 6, fontSize: 13.5 }}>
                Annulla
              </button>
            )}
          </div>
        </div>
      )}

      {pianiSalvati.length > 0 && (
        <div style={{ marginTop: 28, maxWidth: 620 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px 0" }}>Piani di volo salvati</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pianiSalvati.map((p) => (
              <div key={p.id} style={{ background: "#1b2028", border: editingId === p.id ? "1px solid #ff8c42" : "1px solid #262b33", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.impianto_nome} {editingId === p.id && <span style={{ color: "#ff8c42", fontWeight: 400, fontSize: 11.5 }}>— in modifica</span>}</div>
                  <div style={{ fontSize: 12, color: "#8b95a3" }}>{formatData(p.data_prevista)} · {ETICHETTE_TIPO_PIANO[p.tipo_ispezione] || p.tipo_ispezione}</div>
                  {p.checklist_stato?.voci?.length > 0 && (() => {
                    const tot = p.checklist_stato.voci.length;
                    const fatti = Object.values(p.checklist_stato.spuntati || {}).filter(Boolean).length;
                    return <div style={{ fontSize: 11, color: fatti === tot ? "#4ade80" : "#f5b942", marginTop: 2 }}>Checklist: {fatti}/{tot} {fatti === tot ? "✓ completa" : ""}</div>;
                  })()}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => onVaiRegistroConDati({
                    data: p.data_prevista || new Date().toISOString().slice(0, 10),
                    luogo: p.impianto_nome || "",
                    drone_id: p.drone_id || "",
                    tipo_attivita: MAPPA_TIPO_PIANO_A_REGISTRO[p.tipo_ispezione] || "altro",
                  })} style={{ background: "#241d16", border: "1px solid #ff8c42", color: "#ffb877", borderRadius: 5, padding: "5px 10px", fontSize: 11.5, fontWeight: 600 }}>📷 Aggiungi foto/video</button>
                  <button onClick={() => apriPiano(p)} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>Apri / Modifica</button>
                  <button onClick={() => eliminaPiano(p.id)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>Elimina</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostraSchermoControllo && (() => {
        const assicurazione = attestatiUtente.find((a) => a.tipo.toLowerCase().includes("assicura"));
        return (
          <div style={{ position: "fixed", inset: 0, background: "#fff", color: "#161a1f", zIndex: 1000, overflow: "auto", padding: "20px 18px" }}>
            <button onClick={() => setMostraSchermoControllo(false)} style={{ position: "sticky", top: 0, float: "right", background: "#161a1f", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
              Chiudi ✕
            </button>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0" }}>Documenti pilota</h1>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 20px 0" }}>{azienda.nome} — {destinazione?.nome}</p>

            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0", borderTop: "2px solid #eee", paddingTop: 16 }}>Attestati</h2>
            {attestatiUtente.length === 0 ? <p style={{ fontSize: 13, color: "#888" }}>Nessuno registrato.</p> : attestatiUtente.map((a) => {
              const scaduto = a.data_scadenza && new Date(a.data_scadenza) < new Date();
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14, borderBottom: "1px solid #f0f0f0" }}>
                  <span>{a.tipo}</span>
                  <span style={{ color: scaduto ? "#d32f2f" : "#2e7d32", fontWeight: 600 }}>{a.data_scadenza ? `${scaduto ? "SCADUTO " : ""}${formatData(a.data_scadenza)}` : "senza scadenza"}</span>
                </div>
              );
            })}

            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Assicurazione</h2>
            {assicurazione ? (
              <p style={{ fontSize: 15, fontWeight: 700, color: (assicurazione.data_scadenza && new Date(assicurazione.data_scadenza) < new Date()) ? "#d32f2f" : "#2e7d32" }}>
                {formatData(assicurazione.data_scadenza)}
              </p>
            ) : <p style={{ fontSize: 13, color: "#d32f2f" }}>Non registrata</p>}

            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Drone</h2>
            {droneSelezionato ? (
              <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                <div><strong>{droneSelezionato.nome}</strong></div>
                <div>Modello: {droneSelezionato.modello || "—"}</div>
                <div>Matricola: {droneSelezionato.matricola || "—"}</div>
                <div>Classe: {droneSelezionato.marcatura_classe || "—"}</div>
                <div>D-Flight: {droneSelezionato.registrazione_dflight || "—"}</div>
              </div>
            ) : <p style={{ fontSize: 13, color: "#888" }}>Nessun drone selezionato.</p>}

            <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Permessi per questa zona</h2>
            {permessiZona.length === 0 ? <p style={{ fontSize: 13, color: "#888" }}>Nessuno specifico registrato.</p> : permessiZona.map((p) => (
              <div key={p.id} style={{ fontSize: 14, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                {p.impianto} — <strong>{{ in_attesa: "In attesa", autorizzato: "Autorizzato", negato: "Negato" }[p.stato] || p.stato}</strong>
              </div>
            ))}

            {dflightShot && (
              <>
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Screenshot D-Flight</h2>
                <img src={dflightShot.dataUrl} alt="D-Flight" style={{ width: "100%", maxWidth: 400, borderRadius: 8, border: "1px solid #ddd" }} />
              </>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// --- Documenti controllo (accesso rapido dal menu, senza dover pianificare prima un volo) -----------------------------------------------------------

function DocumentiControllo({ azienda, impianti }) {
  const [impiantoSel, setImpiantoSel] = useState(null);
  const [attestatiUtente, setAttestatiUtente] = useState([]);
  const [droniUtente, setDroniUtente] = useState([]);
  const [permessiUtente, setPermessiUtente] = useState([]);
  const [pianiUtente, setPianiUtente] = useState([]);
  const [droneSelId, setDroneSelId] = useState("");
  const [dflightShot, setDflightShot] = useState(null);
  const [generandoPdfControllo, setGenerandoPdfControllo] = useState(false);
  const [pdfUrlControllo, setPdfUrlControllo] = useState(null);
  const [mostraSchermoControllo, setMostraSchermoControllo] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: att }, { data: drn }, { data: perm }, { data: piani }] = await Promise.all([
        supabase.from("attestati").select("*"),
        supabase.from("droni").select("*"),
        supabase.from("permessi").select("*"),
        supabase.from("piani_volo").select("*"),
      ]);
      setAttestatiUtente(att || []);
      setDroniUtente(drn || []);
      setPermessiUtente(perm || []);
      setPianiUtente(piani || []);
    })();
  }, []);

  const droneSelezionato = droniUtente.find((d) => d.id === droneSelId) || null;
  const assicurazione = attestatiUtente.find((a) => a.tipo.toLowerCase().includes("assicura"));

  // permessi collegati all'impianto scelto (se ne hai scelto uno), altrimenti tutti
  const permessiFiltrati = impiantoSel
    ? permessiUtente.filter((p) => p.impianto_id === impiantoSel.id || (p.impianto && p.impianto.toLowerCase().includes(impiantoSel.nome.toLowerCase())))
    : permessiUtente;

  // recupero automaticamente l'ultimo screenshot D-Flight collegato a questo impianto (da un permesso o da un piano di volo), se ce n'è uno e non ne hai caricato uno nuovo a mano
  const screenshotAutomatico = impiantoSel && !dflightShot
    ? [...permessiUtente.filter((p) => p.impianto_id === impiantoSel.id && p.dflight_screenshot_url), ...pianiUtente.filter((p) => p.impianto_id === impiantoSel.id && p.dflight_screenshot_url)]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.dflight_screenshot_url
    : null;

  const caricaDflightShot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDflightShot({ nome: file.name, dataUrl: reader.result });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scaricaPdfControllo = () => {
    setGenerandoPdfControllo(true);
    try {
      const doc = costruisciPDFControllo({ azienda, operatore: azienda.nome, attestati: attestatiUtente, drone: droneSelezionato, permessi: permessiFiltrati, impianto: impiantoSel });
      const url = doc.output("bloburl");
      setPdfUrlControllo(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerandoPdfControllo(false);
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>🚔 Documenti controllo</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 16px 0", maxWidth: 560 }}>
        Accesso rapido a tutto quello che potrebbero chiederti le forze dell'ordine — sempre a portata di mano, senza dover pianificare prima un volo.
      </p>

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Impianto su cui stai lavorando (opzionale)</label>
        <select value={impiantoSel?.id || ""} onChange={(e) => { setImpiantoSel(impianti.find((i) => i.id === e.target.value) || null); setDflightShot(null); }} style={inputStyle}>
          <option value="">— Nessuno / vedi tutto —</option>
          {impianti.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
        </select>
      </div>

      <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, maxWidth: 560 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Drone che stai usando</label>
          <select value={droneSelId} onChange={(e) => setDroneSelId(e.target.value)} style={{ ...inputStyle, fontSize: 12.5 }}>
            <option value="">— Nessuno selezionato —</option>
            {droniUtente.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 6 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>Attestati:</strong>
          {attestatiUtente.length === 0 ? "nessuno registrato" : (
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {attestatiUtente.map((a) => {
                const scaduto = a.data_scadenza && new Date(a.data_scadenza) < new Date();
                return (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: scaduto ? "#ff9c9c" : "#4ade80" }}>{a.tipo}{scaduto ? " (scaduto!)" : " ✓"}</span>
                    {a.documento_url && (
                      <a href={a.documento_url} target="_blank" rel="noreferrer" style={{ color: "#3d8bfd", fontSize: 11, textDecoration: "none" }}>📄 apri documento</a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 6 }}>
          <strong>Assicurazione:</strong>{" "}
          {assicurazione
            ? (() => {
                const scaduta = assicurazione.data_scadenza && new Date(assicurazione.data_scadenza) < new Date();
                return (
                  <>
                    <span style={{ color: scaduta ? "#ff9c9c" : "#4ade80" }}>{scaduta ? "SCADUTA il " : "valida fino al "}{assicurazione.data_scadenza ? formatData(assicurazione.data_scadenza) : "—"}</span>
                    {assicurazione.documento_url && <a href={assicurazione.documento_url} target="_blank" rel="noreferrer" style={{ color: "#3d8bfd", fontSize: 11, marginLeft: 8, textDecoration: "none" }}>📄 apri documento</a>}
                  </>
                );
              })()
            : <span style={{ color: "#ff9c9c" }}>non registrata — aggiungila in "Attestati"</span>}
        </div>
        {droneSelezionato && (
          <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 6 }}>
            <strong>Documento del drone:</strong>{" "}
            {droneSelezionato.documento_url ? (
              <a href={droneSelezionato.documento_url} target="_blank" rel="noreferrer" style={{ color: "#3d8bfd", fontSize: 11.5, textDecoration: "none" }}>📄 apri documento</a>
            ) : <span style={{ color: "#8b95a3" }}>nessuno caricato</span>}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#c3cad4", marginBottom: 4 }}>
          <strong>Permessi{impiantoSel ? " per questo impianto" : ""}:</strong> {permessiFiltrati.length === 0 ? "nessuno" : `${permessiFiltrati.length}`}
        </div>

        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Screenshot D-Flight {impiantoSel ? "di questo impianto" : "di oggi"} (facoltativo)</label>
          {dflightShot ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={dflightShot.dataUrl} alt="D-Flight" style={{ width: 90, borderRadius: 6, border: "1px solid #333a45" }} />
              <button onClick={() => setDflightShot(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "4px 9px", fontSize: 11 }}>Rimuovi</button>
            </div>
          ) : screenshotAutomatico ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href={screenshotAutomatico} target="_blank" rel="noreferrer">
                <img src={screenshotAutomatico} alt="D-Flight" style={{ width: 90, borderRadius: 6, border: "1px solid #333a45" }} />
              </a>
              <span style={{ fontSize: 10.5, color: "#6b7480" }}>recuperato automaticamente da un permesso/piano di volo</span>
            </div>
          ) : (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
              <Upload size={13} /> Carica screenshot
              <input type="file" accept="image/*" onChange={caricaDflightShot} style={{ display: "none" }} />
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" onClick={() => setMostraSchermoControllo(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "9px 14px", borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}>
            📱 Mostra a schermo pieno
          </button>
          <button type="button" onClick={scaricaPdfControllo} disabled={generandoPdfControllo} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "9px 14px", borderRadius: 6, fontSize: 12.5 }}>
            <FileDown size={13} /> {generandoPdfControllo ? "Preparazione..." : "Scarica PDF"}
          </button>
          <a href="https://www.d-flight.it/web-app/" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", borderRadius: 6, padding: "9px 14px", fontSize: 12.5, textDecoration: "none" }}>
            🗺️ Apri D-Flight
          </a>
        </div>
        {pdfUrlControllo && (
          <a href={pdfUrlControllo} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 6, fontSize: 11, color: "#3d8bfd" }}>
            Se non si è aperto automaticamente, apri il PDF qui
          </a>
        )}
      </div>

      {mostraSchermoControllo && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", color: "#161a1f", zIndex: 1000, overflow: "auto", padding: "20px 18px" }}>
          <button onClick={() => setMostraSchermoControllo(false)} style={{ position: "sticky", top: 0, float: "right", background: "#161a1f", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
            Chiudi ✕
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px 0" }}>Documenti pilota</h1>
          <p style={{ fontSize: 13, color: "#555", margin: "0 0 20px 0" }}>{azienda.nome}{impiantoSel ? ` — ${impiantoSel.nome}` : ""}</p>

          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 8px 0", borderTop: "2px solid #eee", paddingTop: 16 }}>Attestati</h2>
          {attestatiUtente.length === 0 ? <p style={{ fontSize: 13, color: "#888" }}>Nessuno registrato.</p> : attestatiUtente.map((a) => {
            const scaduto = a.data_scadenza && new Date(a.data_scadenza) < new Date();
            return (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", fontSize: 14, borderBottom: "1px solid #f0f0f0" }}>
                <span>{a.tipo}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: scaduto ? "#d32f2f" : "#2e7d32", fontWeight: 600 }}>{a.data_scadenza ? `${scaduto ? "SCADUTO " : ""}${formatData(a.data_scadenza)}` : "senza scadenza"}</span>
                  {a.documento_url && <a href={a.documento_url} target="_blank" rel="noreferrer" style={{ color: "#1565c0", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>Apri documento →</a>}
                </div>
              </div>
            );
          })}

          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Assicurazione</h2>
          {assicurazione ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <p style={{ fontSize: 15, fontWeight: 700, margin: 0, color: (assicurazione.data_scadenza && new Date(assicurazione.data_scadenza) < new Date()) ? "#d32f2f" : "#2e7d32" }}>
                {formatData(assicurazione.data_scadenza)}
              </p>
              {assicurazione.documento_url && <a href={assicurazione.documento_url} target="_blank" rel="noreferrer" style={{ color: "#1565c0", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>Apri documento →</a>}
            </div>
          ) : <p style={{ fontSize: 13, color: "#d32f2f" }}>Non registrata</p>}

          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Drone</h2>
          {droneSelezionato ? (
            <div style={{ fontSize: 14, lineHeight: 1.8 }}>
              <div><strong>{droneSelezionato.nome}</strong></div>
              <div>Modello: {droneSelezionato.modello || "—"}</div>
              <div>Matricola: {droneSelezionato.matricola || "—"}</div>
              <div>Classe: {droneSelezionato.marcatura_classe || "—"}</div>
              <div>D-Flight: {droneSelezionato.registrazione_dflight || "—"}</div>
              {droneSelezionato.documento_url && <a href={droneSelezionato.documento_url} target="_blank" rel="noreferrer" style={{ color: "#1565c0", fontSize: 14, fontWeight: 600, textDecoration: "underline", display: "inline-block", marginTop: 4 }}>Apri documento drone →</a>}
            </div>
          ) : <p style={{ fontSize: 13, color: "#888" }}>Nessun drone selezionato.</p>}

          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Permessi{impiantoSel ? ` — ${impiantoSel.nome}` : ""}</h2>
          {permessiFiltrati.length === 0 ? <p style={{ fontSize: 13, color: "#888" }}>Nessuno registrato.</p> : permessiFiltrati.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span>{p.impianto} — <strong>{{ in_attesa: "In attesa", autorizzato: "Autorizzato", negato: "Negato" }[p.stato] || p.stato}</strong></span>
              {p.documento_url && <a href={p.documento_url} target="_blank" rel="noreferrer" style={{ color: "#1565c0", fontSize: 13, fontWeight: 600, textDecoration: "underline" }}>Apri foglio →</a>}
            </div>
          ))}

          {(dflightShot || screenshotAutomatico) && (
            <>
              <h2 style={{ fontSize: 14, fontWeight: 700, margin: "18px 0 8px 0" }}>Screenshot D-Flight</h2>
              <img src={dflightShot ? dflightShot.dataUrl : screenshotAutomatico} alt="D-Flight" style={{ width: "100%", maxWidth: 400, borderRadius: 8, border: "1px solid #ddd" }} />
            </>
          )}
        </div>
      )}
    </div>
  );
}


// --- Registro voli generale (video / foto / FPV / ispezioni) -----------------------------------------------------------

// --- Consegna al cliente: link pubblico alla galleria di un volo -------------------------------
// i dati vivono nella tabella "condivisioni" (script supabase/condivisioni-galleria.sql);
// la pagina pubblica legge solo tramite la funzione galleria_condivisa, mai le tabelle direttamente.

const SCADENZE_CONDIVISIONE = [
  { giorni: 7, label: "7 giorni" },
  { giorni: 30, label: "30 giorni" },
  { giorni: 90, label: "90 giorni" },
  { giorni: 0, label: "Nessuna scadenza" },
];

function linkCondivisione(token) {
  return `${window.location.origin}/?galleria=${token}`;
}

async function copiaNegliAppunti(testo) {
  try {
    await navigator.clipboard.writeText(testo);
    return true;
  } catch (e) {
    window.prompt("Copia il link:", testo);
    return false;
  }
}

function CondivisioneVolo({ volo, nMedia }) {
  const [links, setLinks] = useState(null);
  const [aperto, setAperto] = useState(false);
  const [scadenza, setScadenza] = useState(30);
  const [messaggio, setMessaggio] = useState("");
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState(null);
  const [copiatoId, setCopiatoId] = useState(null);

  const carica = async () => {
    const { data, error } = await supabase.from("condivisioni").select("*").eq("volo_id", String(volo.id)).order("created_at", { ascending: false });
    if (error) {
      setErrore(/relation|does not exist|schema cache/i.test(error.message) ? "Per usare i link di consegna esegui prima lo script SQL «condivisioni-galleria.sql» in Supabase." : error.message);
      setLinks([]);
      return;
    }
    setErrore(null);
    setLinks(data || []);
  };

  useEffect(() => { carica(); }, [volo.id]);

  const crea = async () => {
    setCreando(true);
    setErrore(null);
    const titolo = [volo.luogo, formatData(volo.data)].filter(Boolean).join(" · ");
    const scade_il = scadenza > 0 ? new Date(Date.now() + scadenza * 86400000).toISOString() : null;
    const { data, error } = await supabase.from("condivisioni").insert({ volo_id: String(volo.id), titolo, messaggio: messaggio.trim() || null, scade_il }).select().single();
    setCreando(false);
    if (error) { setErrore(error.message); return; }
    setMessaggio("");
    setAperto(false);
    await carica();
    if (await copiaNegliAppunti(linkCondivisione(data.token))) setCopiatoId(data.id);
  };

  const disattiva = async (c) => {
    if (!window.confirm("Disattivare questo link? Il cliente non potrà più aprire la galleria.")) return;
    const { error } = await supabase.from("condivisioni").update({ attiva: false }).eq("id", c.id);
    if (error) { setErrore(error.message); return; }
    carica();
  };

  const copia = async (c) => {
    if (await copiaNegliAppunti(linkCondivisione(c.token))) {
      setCopiatoId(c.id);
      setTimeout(() => setCopiatoId((id) => (id === c.id ? null : id)), 2000);
    }
  };

  const ora = new Date();
  const attivi = (links || []).filter((c) => c.attiva && (!c.scade_il || new Date(c.scade_il) > ora));

  return (
    <div style={{ marginTop: 8, background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>📤 Consegna al cliente</span>
        {!aperto && (
          <button onClick={() => setAperto(true)} disabled={nMedia === 0} title={nMedia === 0 ? "Aggiungi prima foto o video a questo volo" : "Crea un link da mandare al cliente"} style={{ background: nMedia === 0 ? "#262b33" : "#ff8c42", color: nMedia === 0 ? "#6b7480" : "#161a1f", border: "none", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
            + Crea link
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#6b7480", margin: "4px 0 0 0" }}>Il cliente apre la galleria di questo volo senza account e può scaricare foto e video.</p>

      {aperto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Scadenza del link</label>
            <select value={scadenza} onChange={(e) => setScadenza(Number(e.target.value))} style={inputStyle}>
              {SCADENZE_CONDIVISIONE.map((s) => <option key={s.giorni} value={s.giorni}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Messaggio per il cliente (facoltativo)</label>
            <textarea rows={2} placeholder="es. Ecco le riprese di sabato, i file sono in 4K." value={messaggio} onChange={(e) => setMessaggio(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={crea} disabled={creando} style={{ background: "#ff8c42", color: "#161a1f", border: "none", borderRadius: 5, padding: "7px 14px", fontSize: 12.5, fontWeight: 600 }}>{creando ? "Creazione..." : "Crea e copia il link"}</button>
            <button onClick={() => setAperto(false)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "7px 14px", fontSize: 12.5 }}>Annulla</button>
          </div>
        </div>
      )}

      {errore && <p style={{ fontSize: 11.5, color: "#ff9c9c", margin: "8px 0 0 0" }}>{errore}</p>}

      {attivi.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          {attivi.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
              <span className="mono" style={{ color: "#c3cad4", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkCondivisione(c.token)}</span>
              <span style={{ color: "#6b7480" }}>{c.scade_il ? `scade il ${formatData(c.scade_il)}` : "senza scadenza"}</span>
              <button onClick={() => copia(c)} style={{ background: "#262b33", border: "1px solid #333a45", color: copiatoId === c.id ? "#4ade80" : "#c3cad4", borderRadius: 5, padding: "4px 10px", fontSize: 11.5 }}>{copiatoId === c.id ? "✓ Copiato" : "Copia"}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`${c.titolo ? c.titolo + " — " : ""}ecco le tue foto e i tuoi video: ${linkCondivisione(c.token)}`)}`} target="_blank" rel="noreferrer" style={{ background: "#262b33", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "4px 10px", fontSize: 11.5, textDecoration: "none" }}>WhatsApp</a>
              <button onClick={() => disattiva(c)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "4px 10px", fontSize: 11.5 }}>Disattiva</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// pagina pubblica aperta dal cliente (?galleria=TOKEN): nessun login richiesto
function GalleriaCondivisa({ token }) {
  const [dati, setDati] = useState(undefined); // undefined = caricamento, null = link non valido
  const [errore, setErrore] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("galleria_condivisa", { p_token: token });
      if (error) {
        // token non nel formato giusto = link sbagliato, non un errore da mostrare
        if (/uuid/i.test(error.message)) setDati(null);
        else { setErrore(error.message); setDati(null); }
        return;
      }
      setDati(data || null);
    })();
  }, [token]);

  // link per scaricare direttamente il file (Supabase Storage lo consente con ?download)
  const linkDownload = (m) => (/\/storage\/v1\/object\/public\//.test(m.url) ? `${m.url}${m.url.includes("?") ? "&" : "?"}download=${encodeURIComponent(m.nome || "")}` : m.url);

  const pagina = { minHeight: "100vh", background: "#12151a", color: "#e7eaee", fontFamily: "'IBM Plex Sans', sans-serif", padding: "24px 16px" };

  if (dati === undefined) {
    return <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b95a3" }}>Caricamento...</div>;
  }
  if (!dati) {
    return (
      <div style={{ ...pagina, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ maxWidth: 380 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 18, margin: "0 0 8px 0" }}>Galleria non disponibile</h1>
          <p style={{ fontSize: 13, color: "#8b95a3", margin: 0 }}>Il link è scaduto, è stato disattivato oppure non è corretto. Chiedi un nuovo link a chi ti ha fatto le riprese.</p>
          {errore && <p style={{ fontSize: 11, color: "#6b7480", marginTop: 12 }}>{errore}</p>}
        </div>
      </div>
    );
  }

  const media = dati.media || [];
  const file = media.filter((m) => m.tipo !== "link");
  const links = media.filter((m) => m.tipo === "link");

  return (
    <div style={pagina}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <img src={dati.azienda_logo && !dati.azienda_logo.startsWith(LOGO_PRECEDENTE_PREFISSO) ? dati.azienda_logo : LOGO_EYEDRONES} alt={dati.azienda_nome || "Eyedrones"} style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 6 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "#8b95a3" }}>{dati.azienda_nome || "Eyedrones"}</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{dati.titolo || [dati.luogo, formatData(dati.data)].filter(Boolean).join(" · ") || "Le tue riprese"}</h1>
          </div>
        </div>

        {dati.messaggio && <p style={{ fontSize: 14, color: "#c3cad4", whiteSpace: "pre-wrap", margin: "0 0 16px 0" }}>{dati.messaggio}</p>}
        <p style={{ fontSize: 12, color: "#6b7480", margin: "0 0 16px 0" }}>
          {file.length} file{dati.scade_il ? ` · disponibile fino al ${formatData(dati.scade_il)}: scarica i file prima di questa data` : ""}
        </p>

        {media.length === 0 && <p style={{ fontSize: 13, color: "#8b95a3" }}>Non ci sono ancora file in questa galleria.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          {file.map((m) => (
            <div key={m.id} style={{ gridColumn: m.tipo === "video" ? "span 2" : undefined, minWidth: 0 }}>
              {m.tipo === "foto" && (
                <img src={m.url} alt={m.nome || "foto"} loading="lazy" onClick={() => setLightbox(m)} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 6, cursor: "pointer", display: "block", background: "#000" }} />
              )}
              {m.tipo === "video" && (
                <video src={m.url} controls preload="metadata" playsInline style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 6, background: "#000", display: "block" }} />
              )}
              <a href={linkDownload(m)} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 4, fontSize: 12, color: "#ffb877" }}>⬇ Scarica</a>
            </div>
          ))}
        </div>

        {links.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px 0" }}>Link ai file</p>
            {links.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 13, color: "#3d8bfd", marginBottom: 6, wordBreak: "break-all" }}>🔗 {m.nome || m.url}</a>
            ))}
          </div>
        )}

        <p style={{ fontSize: 11, color: "#5b6572", marginTop: 32, textAlign: "center" }}>Galleria condivisa con Eyedrones</p>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50, cursor: "zoom-out" }}>
          <img src={lightbox.url} alt={lightbox.nome || "foto"} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

const TIPI_ATTIVITA_VOLO = [
  { key: "video", label: "Video", emoji: "🎬", colore: "#a78bfa" },
  { key: "foto", label: "Foto", emoji: "📷", colore: "#3d8bfd" },
  { key: "fpv", label: "FPV", emoji: "🥽", colore: "#ff8c42" },
  { key: "ispezione", label: "Ispezione", emoji: "🔍", colore: "#4ade80" },
  { key: "altro", label: "Altro", emoji: "✈️", colore: "#8b95a3" },
];

const CATEGORIE_OPERATIVE_VOLO = [
  { key: "aperta_a1", label: "Aperta A1" },
  { key: "aperta_a2", label: "Aperta A2" },
  { key: "aperta_a3", label: "Aperta A3" },
  { key: "sts01", label: "STS-01" },
  { key: "sts02", label: "STS-02" },
  { key: "specifica", label: "Operazione specifica" },
  { key: "altro", label: "Altro" },
];

// Non c'è più un tetto impostato da noi sui video: carichiamo qualunque file e, se Supabase lo rifiuta perché supera
// il "Global file size limit" del progetto (nella pagina Storage → Settings), mostriamo il messaggio d'errore reale.

function etichettaCategoriaVolo(k) {
  if (!k) return "—";
  if (k === "aperta") return "Categoria Aperta"; // arriva dalle ispezioni, dove A1/A2/A3 non è specificato
  return CATEGORIE_OPERATIVE_VOLO.find((c) => c.key === k)?.label || k;
}

function formVoloVuoto() {
  return {
    data: new Date().toISOString().slice(0, 10),
    ora: new Date().toTimeString().slice(0, 5),
    durata: "", drone_id: "", drone_nome: "", luogo: "", coordinate_gps: "",
    tipo_attivita: "video", categoria_operativa: "aperta_a1",
    altezza_max: "", cliente: "", note: "", batterie_usate: [],
  };
}

// minuti tra due orari "HH:MM" (per ricavare la durata delle ispezioni da decollo/atterraggio)
function minutiTra(ora1, ora2) {
  if (!ora1 || !ora2) return null;
  const [h1, m1] = String(ora1).split(":").map(Number);
  const [h2, m2] = String(ora2).split(":").map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return null;
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  return diff > 0 ? diff : null;
}

function formattaDurata(min) {
  const m = Number(min);
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

// riduce le foto molto grandi (max 2400px sul lato lungo) per non consumare spazio inutilmente
function ridimensionaImmagine(file, maxLato = 2400) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scala = Math.min(1, maxLato / Math.max(img.naturalWidth, img.naturalHeight));
      if (scala === 1 && file.size < 3 * 1024 * 1024) { URL.revokeObjectURL(url); resolve(file); return; }
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scala);
      canvas.height = Math.round(img.naturalHeight * scala);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => { URL.revokeObjectURL(url); resolve(blob || file); }, "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function percorsoStorageDaUrl(url) {
  const parti = String(url).split("/foto-ispezioni/");
  return parti.length > 1 ? decodeURIComponent(parti[1].split("?")[0]) : null;
}

// le ispezioni sono voli a tutti gli effetti: le trasformo in voci di registro (sola lettura)
function costruisciVoliDaIspezioni(ispezioni, impianti) {
  return (ispezioni || []).map((i) => {
    const imp = (impianti || []).find((x) => x.id === i.impianto_id);
    return {
      id: "isp-" + i.id, _derived: true, data: i.data, ora: i.ora,
      durata_minuti: minutiTra(i.ora, i.ora_atterraggio),
      drone_nome: i.drone_usato || null,
      luogo: imp ? `${imp.nome}${imp.zona ? " — " + imp.zona : ""}` : null,
      coordinate_gps: i.coordinate_gps || null,
      tipo_attivita: "ispezione", categoria_operativa: i.scenario_volo || null,
      altezza_max: i.altezza_volo || null, cliente: imp?.cliente || null, note: null,
    };
  });
}

// PDF del registro voli in ordine cronologico (logbook stampabile)
function costruisciPDFLogbook({ azienda, voli, titolo }) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const grigio = [110, 120, 130];
  const colonne = [
    { t: "Data", w: 26 }, { t: "Ora", w: 14 }, { t: "Durata", w: 20 }, { t: "Drone", w: 42 },
    { t: "Luogo", w: 62 }, { t: "Attività", w: 24 }, { t: "Categoria", w: 36 }, { t: "Cliente", w: 43 },
  ];
  const larghezzaTot = colonne.reduce((s, c) => s + c.w, 0);
  const taglia = (txt, w) => {
    const righe = doc.splitTextToSize(String(txt || "—"), w - 2);
    return righe.length > 1 ? righe[0].replace(/\s+$/, "") + "…" : (righe[0] || "—");
  };

  const ordinati = [...voli].sort((a, b) => {
    const da = `${a.data || ""} ${a.ora ? String(a.ora).slice(0, 5) : "00:00"}`;
    const db = `${b.data || ""} ${b.ora ? String(b.ora).slice(0, 5) : "00:00"}`;
    return da.localeCompare(db);
  });
  const minutiTotali = ordinati.reduce((s, v) => s + (Number(v.durata_minuti) || 0), 0);

  let xTitolo = 15;
  if (azienda.logo) {
    try { doc.addImage(azienda.logo, "PNG", 15, 8, 18, 11, undefined, "FAST"); xTitolo = 38; } catch (e) {}
  }
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(titolo || "Registro voli", xTitolo, 15);
  doc.setFontSize(9);
  doc.setTextColor(...grigio);
  doc.text(`${azienda.nome} — ${ordinati.length} voli — tempo di volo totale: ${formattaDurata(minutiTotali)}`, xTitolo, 20);

  let y = 30;
  const disegnaIntestazione = () => {
    doc.setFillColor(235, 237, 240);
    doc.rect(15, y - 5, larghezzaTot, 7.5, "F");
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    doc.setTextColor(30, 30, 30);
    let x = 15;
    colonne.forEach((c) => { doc.text(c.t, x + 1, y); x += c.w; });
    doc.setFont(undefined, "normal");
    y += 7;
  };
  disegnaIntestazione();

  ordinati.forEach((v, idx) => {
    if (y > 192) { doc.addPage(); y = 18; disegnaIntestazione(); }
    if (idx % 2 === 1) {
      doc.setFillColor(248, 249, 250);
      doc.rect(15, y - 4.5, larghezzaTot, 6.5, "F");
    }
    const tipo = TIPI_ATTIVITA_VOLO.find((t) => t.key === v.tipo_attivita);
    const valori = [
      formatData(v.data),
      v.ora ? String(v.ora).slice(0, 5) : "—",
      formattaDurata(v.durata_minuti),
      v.drone_nome,
      v.luogo,
      tipo ? tipo.label : "—",
      etichettaCategoriaVolo(v.categoria_operativa),
      v.cliente,
    ];
    doc.setFontSize(8.5);
    doc.setTextColor(30, 30, 30);
    let x = 15;
    colonne.forEach((c, i) => { doc.text(taglia(valori[i], c.w), x + 1, y); x += c.w; });
    y += 6.5;
  });

  if (ordinati.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text("Nessun volo registrato per i filtri selezionati.", 15, y + 4);
  } else {
    if (y > 188) { doc.addPage(); y = 18; }
    y += 3;
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y - 3, 15 + larghezzaTot, y - 3);
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(`Totale: ${ordinati.length} voli — ${formattaDurata(minutiTotali)}`, 15, y + 3);
    doc.setFont(undefined, "normal");
  }

  const pagine = doc.getNumberOfPages();
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grigio);
    doc.text(`Generato da ${azienda.nome}`, 15, 203);
    doc.text(`Pagina ${i}/${pagine}`, 15 + larghezzaTot, 203, { align: "right" });
  }
  return doc;
}

// --- Batterie ----------------------------------------------------------------------------------------------------
const TIPI_BATTERIA = [
  { key: "lipo", label: "LiPo (FPV, racing)" },
  { key: "lihv", label: "LiPo HV (LiHV)" },
  { key: "liion", label: "Li-ion" },
  { key: "intelligent", label: "Batteria intelligente (DJI e simili)" },
];
const STATI_CARICA = [
  { key: "carica", label: "Carica", emoji: "🔋", colore: "#4ade80" },
  { key: "storage", label: "Storage", emoji: "🟡", colore: "#f5b942" },
  { key: "usata", label: "Usata", emoji: "⚪", colore: "#8b95a3" },
];
const GIORNI_AVVISO_CARICA = 2; // batteria lasciata carica da più di 2 giorni
const GIORNI_AVVISO_USATA = 3; // batteria usata e non ricaricata/portata a stoccaggio da più di 3 giorni

function giorniDa(dataIso) {
  if (!dataIso) return null;
  const t = new Date(dataIso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

// avvisi di una batteria: cicli oltre la soglia, oppure lasciata carica/usata per troppi giorni
function avvisiBatteria(b) {
  const out = [];
  if (!b || b.ritirata) return out;
  const soglia = Number(b.soglia_cicli) || 150;
  const cicli = Number(b.cicli) || 0;
  if (cicli >= soglia) out.push({ livello: "scaduto", colore: "#ff4d4d", testo: `${cicli}/${soglia} cicli: controllala o sostituiscila` });
  if (b.tipo !== "intelligent" && b.stato_carica && b.stato_dal) {
    const g = giorniDa(b.stato_dal);
    if (b.stato_carica === "carica" && g >= GIORNI_AVVISO_CARICA) out.push({ livello: "in_scadenza", colore: "#f5b942", testo: `carica da ${g} giorni: portala a stoccaggio` });
    if (b.stato_carica === "usata" && g >= GIORNI_AVVISO_USATA) out.push({ livello: "in_scadenza", colore: "#f5b942", testo: `usata da ${g} giorni: ricaricala o portala a stoccaggio` });
  }
  return out;
}

function formBatteriaVuoto() {
  return { nome: "", tipo: "lipo", celle: "", capacita: "", drone_id: "", soglia: "150", cicli: "0", note: "" };
}

function Batterie({ batterie, droni, piano, onReload, onVaiAbbonamento }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(formBatteriaVuoto());
  const [salvando, setSalvando] = useState(false);
  const [mostraRitirate, setMostraRitirate] = useState(false);
  const [mostraLimite, setMostraLimite] = useState(false);

  const attive = batterie.filter((b) => !b.ritirata);
  const ritirate = batterie.filter((b) => b.ritirata);
  const limiteRaggiunto = piano === "free" && attive.length >= LIMITI_FREE.batterie;
  const nomeDrone = (id) => ((droni || []).find((d) => d.id === id) || {}).nome || null;

  const lbl = { fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 };

  const apriNuova = () => {
    if (showForm && !editingId) { setShowForm(false); return; }
    if (limiteRaggiunto) { setMostraLimite(true); setShowForm(false); return; }
    setMostraLimite(false); setEditingId(null); setForm(formBatteriaVuoto()); setShowForm(true);
  };
  const apriModifica = (b) => {
    setMostraLimite(false);
    setEditingId(b.id);
    setForm({
      nome: b.nome || "", tipo: b.tipo || "lipo", celle: b.celle != null ? String(b.celle) : "",
      capacita: b.capacita_mah != null ? String(b.capacita_mah) : "", drone_id: b.drone_id || "",
      soglia: String(b.soglia_cicli || 150), cicli: String(b.cicli || 0), note: b.note || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const chiudi = () => { setShowForm(false); setEditingId(null); setForm(formBatteriaVuoto()); };

  const salva = async () => {
    if (!form.nome.trim()) return;
    if (!editingId && limiteRaggiunto) { setMostraLimite(true); setShowForm(false); return; }
    setSalvando(true);
    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      celle: form.tipo !== "intelligent" && form.celle ? Number(form.celle) : null,
      capacita_mah: form.capacita ? Number(form.capacita) : null,
      drone_id: form.drone_id || null,
      soglia_cicli: Number(form.soglia) > 0 ? Number(form.soglia) : 150,
      cicli: Math.max(0, Number(form.cicli) || 0),
      note: form.note.trim() || null,
    };
    const { error } = editingId
      ? await supabase.from("batterie").update(payload).eq("id", editingId)
      : await supabase.from("batterie").insert(payload);
    setSalvando(false);
    if (error) { alert("Salvataggio non riuscito: " + error.message); return; }
    chiudi();
    onReload && onReload();
  };

  const aggiorna = async (b, campi) => {
    const { error } = await supabase.from("batterie").update(campi).eq("id", b.id);
    if (error) { alert("Aggiornamento non riuscito: " + error.message); return; }
    onReload && onReload();
  };
  const aggiungiCiclo = (b) => aggiorna(b, {
    cicli: (Number(b.cicli) || 0) + 1,
    ultimo_uso: new Date().toISOString().slice(0, 10),
    ...(b.tipo !== "intelligent" ? { stato_carica: "usata", stato_dal: new Date().toISOString() } : {}),
  });
  const togliCiclo = (b) => aggiorna(b, { cicli: Math.max(0, (Number(b.cicli) || 0) - 1) });
  const impostaStato = (b, key) => aggiorna(b, { stato_carica: key, stato_dal: new Date().toISOString() });
  const ritira = (b, valore) => aggiorna(b, { ritirata: valore });
  const elimina = async (b) => {
    if (!window.confirm(`Eliminare la batteria "${b.nome}"? L'operazione non è reversibile.`)) return;
    const { error } = await supabase.from("batterie").delete().eq("id", b.id);
    if (error) { alert("Eliminazione non riuscita: " + error.message); return; }
    onReload && onReload();
  };

  const piccolo = { background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 };

  const scheda = (b) => {
    const soglia = Number(b.soglia_cicli) || 150;
    const cicli = Number(b.cicli) || 0;
    const perc = Math.min(100, Math.round((cicli / soglia) * 100));
    const colBarra = cicli >= soglia ? "#ff4d4d" : perc >= 70 ? "#f5b942" : "#4ade80";
    const avvisi = avvisiBatteria(b);
    const tipo = TIPI_BATTERIA.find((t) => t.key === b.tipo);
    const dettagli = [tipo ? tipo.label.split(" (")[0] : null, b.celle ? `${b.celle}S` : null, b.capacita_mah ? `${b.capacita_mah} mAh` : null, nomeDrone(b.drone_id)].filter(Boolean).join(" · ");
    const conStato = b.tipo !== "intelligent";
    const statoAttuale = STATI_CARICA.find((x) => x.key === b.stato_carica);
    const giorni = giorniDa(b.stato_dal);
    return (
      <div key={b.id} data-batteria={b.nome} style={{ background: "#1b2028", border: avvisi.length > 0 ? `1px solid ${avvisi[0].colore}66` : "1px solid #262b33", borderRadius: 8, padding: "13px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{b.nome}</div>
            <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>{dettagli || "—"}</div>
          </div>
          <div className="mono" style={{ fontSize: 13, color: colBarra, fontWeight: 600 }}>{cicli} / {soglia} cicli</div>
        </div>

        <div style={{ height: 6, background: "#262b33", borderRadius: 3, margin: "10px 0 8px 0", overflow: "hidden" }}>
          <div style={{ width: `${perc}%`, height: "100%", background: colBarra }} />
        </div>

        {avvisi.map((a, i) => (
          <div key={i} style={{ fontSize: 12, color: a.colore, fontWeight: 600, marginBottom: 4 }}>⚠ {a.testo}</div>
        ))}

        <div style={{ fontSize: 11.5, color: "#6b7480", marginBottom: 8 }}>
          {b.ultimo_uso ? `Ultimo utilizzo: ${formatData(b.ultimo_uso)}` : "Mai utilizzata"}
          {conStato && statoAttuale && giorni !== null ? ` · ${statoAttuale.emoji} ${statoAttuale.label} ${giorni === 0 ? "da oggi" : giorni === 1 ? "da 1 giorno" : `da ${giorni} giorni`}` : ""}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => aggiungiCiclo(b)} title="Un volo fatto con questa batteria" style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", borderRadius: 5, padding: "6px 12px", fontSize: 12, fontWeight: 700 }}>+1 ciclo</button>
          <button onClick={() => togliCiclo(b)} disabled={cicli === 0} title="Correggi un ciclo aggiunto per errore" style={{ ...piccolo, opacity: cicli === 0 ? 0.4 : 1 }}>−1</button>
          {conStato && (
            <div style={{ display: "flex", gap: 4, marginLeft: 6 }}>
              {STATI_CARICA.map((st) => {
                const on = b.stato_carica === st.key;
                return (
                  <button key={st.key} onClick={() => impostaStato(b, st.key)} style={{ background: on ? st.colore + "22" : "transparent", border: `1px solid ${on ? st.colore : "#333a45"}`, color: on ? st.colore : "#8b95a3", borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 600 }}>
                    {st.emoji} {st.label}
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => apriModifica(b)} style={piccolo}>Modifica</button>
            <button onClick={() => ritira(b, true)} style={piccolo}>Ritira</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Batterie</h1>
        <button onClick={apriNuova} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm && !editingId ? "transparent" : "#ff8c42", color: showForm && !editingId ? "#8b95a3" : "#161a1f", border: showForm && !editingId ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm && !editingId ? "Annulla" : <><Plus size={14} /> Nuova batteria</>}
        </button>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 6px 0", maxWidth: 600 }}>
        Conta i cicli di ogni batteria e ricordati di non lasciarla carica o scarica per giorni: le LiPo si rovinano. Nel registro voli scegli le batterie usate e il ciclo si aggiunge da solo.
      </p>
      <p style={{ color: "#6b7480", fontSize: 11.5, margin: "0 0 18px 0", maxWidth: 600 }}>
        Regola pratica per le LiPo: per lo stoccaggio circa 3,8 V per cella. La soglia dei cicli è indicativa: impostala in base alla tua batteria e a come la usi.
      </p>
      {piano === "free" && (
        <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "-8px 0 14px 0" }}>
          Piano Free: {attive.length}/{LIMITI_FREE.batterie} batterie.{" "}
          <button onClick={onVaiAbbonamento} style={{ background: "none", border: "none", color: "#3d8bfd", padding: 0, fontSize: 11.5 }}>Togli il limite con Pilota →</button>
        </p>
      )}

      {mostraLimite && (
        <div style={{ maxWidth: 460, background: "#241d16", border: "1px solid #4a2f16", borderRadius: 10, padding: 16, marginBottom: 18 }}>
          <p style={{ fontSize: 13.5, color: "#ffb877", margin: "0 0 8px 0", fontWeight: 600 }}>Hai raggiunto il limite del piano Free</p>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: "0 0 12px 0", lineHeight: 1.5 }}>Il piano Free include fino a {LIMITI_FREE.batterie} batterie. Con il piano Pilota ({euro(PREZZI_PIANO.pilota.mese)} al mese) puoi aggiungerne quante vuoi.</p>
          <button onClick={onVaiAbbonamento} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>Vedi i piani</button>
        </div>
      )}

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, marginBottom: 20, maxWidth: 520, display: "flex", flexDirection: "column", gap: 12 }}>
          {editingId && <div style={{ fontSize: 12, color: "#ff8c42", fontWeight: 600 }}>Stai modificando una batteria esistente</div>}
          <div>
            <label style={lbl}>Nome / etichetta</label>
            <input type="text" placeholder="es. Tattu 6S #1" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={lbl}>Tipo</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={inputStyle}>
                {TIPI_BATTERIA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            {form.tipo !== "intelligent" && (
              <div style={{ flex: 1, minWidth: 90 }}>
                <label style={lbl}>Celle (S)</label>
                <input type="number" min="1" placeholder="es. 6" value={form.celle} onChange={(e) => setForm({ ...form, celle: e.target.value })} style={inputStyle} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 110 }}>
              <label style={lbl}>Capacità (mAh)</label>
              <input type="number" min="0" placeholder="es. 1300" value={form.capacita} onChange={(e) => setForm({ ...form, capacita: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={lbl}>Drone</label>
            <select value={form.drone_id} onChange={(e) => setForm({ ...form, drone_id: e.target.value })} style={inputStyle}>
              <option value="">Condivisa tra più droni</option>
              {(droni || []).map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>Avvisami dopo (cicli)</label>
              <input type="number" min="1" value={form.soglia} onChange={(e) => setForm({ ...form, soglia: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={lbl}>Cicli già fatti</label>
              <input type="number" min="0" value={form.cicli} onChange={(e) => setForm({ ...form, cicli: e.target.value })} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={lbl}>Note (facoltativo)</label>
            <textarea rows={2} placeholder="es. leggermente gonfia, resistenza interna alta..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <button onClick={salva} disabled={!form.nome.trim() || salvando} style={{ marginTop: 2, background: form.nome.trim() ? "#ff8c42" : "#333a45", color: form.nome.trim() ? "#161a1f" : "#6b7480", border: "none", padding: "10px 0", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
            {salvando ? "Salvataggio..." : editingId ? "Aggiorna batteria" : "Salva batteria"}
          </button>
        </div>
      )}

      {attive.length === 0 && !showForm ? (
        <EmptyState text="Nessuna batteria ancora. Aggiungi le tue: conteremo i cicli a ogni volo." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {attive.map(scheda)}
        </div>
      )}

      {ritirate.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <button onClick={() => setMostraRitirate(!mostraRitirate)} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12.5, padding: 0 }}>
            {mostraRitirate ? "▾" : "▸"} Batterie ritirate ({ritirate.length})
          </button>
          {mostraRitirate && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {ritirate.map((b) => (
                <div key={b.id} style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: 0.8 }}>
                  <div>
                    <div style={{ fontSize: 13, color: "#c3cad4" }}>{b.nome}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7480" }}>{Number(b.cicli) || 0} cicli fatti</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => ritira(b, false)} style={piccolo}>Riattiva</button>
                    <button onClick={() => elimina(b)} style={{ ...piccolo, color: "#ff9c9c" }}>Elimina</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RegistroVoli({ azienda, droni, ispezioni, impianti, aprireNuovo, onAperto, onCambiato, vista, onVista, fileIniziali, prefillIniziale, batterie, onBatterieCambiate, piano, onVaiAbbonamento }) {
  const [voli, setVoli] = useState([]);
  const [media, setMedia] = useState([]);
  const [caricando, setCaricando] = useState(true);
  const [errore, setErrore] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(formVoloVuoto());
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("tutti");
  const [filtroAnno, setFiltroAnno] = useState("tutti");
  const [cerca, setCerca] = useState("");
  const [includiIspezioni, setIncludiIspezioni] = useState(true);
  const [espansoId, setEspansoId] = useState(null);
  const [caricandoMediaId, setCaricandoMediaId] = useState(null);
  const [linkNuovo, setLinkNuovo] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [gpsInCorso, setGpsInCorso] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const setVista = (v) => { if (onVista) onVista(v); }; // voli | galleria (lo stato vive nell'app, così il menu può aprire la galleria)
  const [fileInAttesa, setFileInAttesa] = useState([]); // allegati scelti nel modulo, caricati al salvataggio
  const [linkInAttesa, setLinkInAttesa] = useState([]);
  const [linkFormNuovo, setLinkFormNuovo] = useState("");

  const carica = async () => {
    setCaricando(true);
    setErrore(null);
    const [{ data: v, error: e1 }, { data: m, error: e2 }] = await Promise.all([
      supabase.from("voli").select("*").order("data", { ascending: false }),
      supabase.from("voli_media").select("*").order("created_at", { ascending: true }),
    ]);
    if (e1 || e2) setErrore((e1 || e2).message);
    setVoli(v || []);
    setMedia(m || []);
    setCaricando(false);
    onCambiato && onCambiato();
  };

  useEffect(() => { carica(); }, []);
  useEffect(() => {
    if (aprireNuovo) {
      apriNuovo();
      if (prefillIniziale) setForm((f) => ({ ...f, ...prefillIniziale }));
      if (fileIniziali && fileIniziali.length > 0) aggiungiFileAlModulo(fileIniziali);
      onAperto && onAperto();
    }
  }, [aprireNuovo]);

  // le ispezioni sono voli a tutti gli effetti: le mostro nel registro (sola lettura)
  const voliDaIspezioni = includiIspezioni ? costruisciVoliDaIspezioni(ispezioni, impianti) : [];

  const tutti = [...voli, ...voliDaIspezioni].sort((a, b) => {
    const da = `${a.data || ""} ${a.ora ? String(a.ora).slice(0, 5) : "00:00"}`;
    const db = `${b.data || ""} ${b.ora ? String(b.ora).slice(0, 5) : "00:00"}`;
    return db.localeCompare(da);
  });
  const anni = [...new Set(tutti.map((v) => (v.data || "").slice(0, 4)).filter(Boolean))].sort().reverse();
  const q = cerca.trim().toLowerCase();
  const visibili = tutti.filter((v) =>
    (filtroTipo === "tutti" || v.tipo_attivita === filtroTipo) &&
    (filtroAnno === "tutti" || (v.data || "").startsWith(filtroAnno)) &&
    (!q || [v.luogo, v.cliente, v.note, v.drone_nome].some((t) => t && String(t).toLowerCase().includes(q)))
  );
  const minutiTotali = visibili.reduce((s, v) => s + (Number(v.durata_minuti) || 0), 0);
  const annoCorrente = String(new Date().getFullYear());
  const voliQuestAnno = tutti.filter((v) => (v.data || "").startsWith(annoCorrente)).length;
  const perDrone = {};
  visibili.forEach((v) => {
    if (v.drone_nome && v.durata_minuti) perDrone[v.drone_nome] = (perDrone[v.drone_nome] || 0) + Number(v.durata_minuti);
  });

  const azzeraAllegati = () => {
    fileInAttesa.forEach((x) => { if (x.anteprima) URL.revokeObjectURL(x.anteprima); });
    setFileInAttesa([]);
    setLinkInAttesa([]);
    setLinkFormNuovo("");
  };

  const apriNuovo = () => { azzeraAllegati(); setEditingId(null); setForm(formVoloVuoto()); setShowForm(true); };

  const apriModifica = (v) => {
    azzeraAllegati();
    setEditingId(v.id);
    const inElenco = v.drone_id && (droni || []).some((d) => d.id === v.drone_id);
    setForm({
      data: v.data || "",
      ora: v.ora ? String(v.ora).slice(0, 5) : "",
      durata: v.durata_minuti != null ? String(v.durata_minuti) : "",
      drone_id: inElenco ? v.drone_id : (v.drone_nome ? "__altro" : ""),
      drone_nome: inElenco ? "" : (v.drone_nome || ""),
      luogo: v.luogo || "", coordinate_gps: v.coordinate_gps || "",
      tipo_attivita: v.tipo_attivita || "video",
      categoria_operativa: v.categoria_operativa || "aperta_a1",
      altezza_max: v.altezza_max != null ? String(v.altezza_max) : "",
      cliente: v.cliente || "", note: v.note || "", batterie_usate: [],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chiudiForm = () => { azzeraAllegati(); setShowForm(false); setEditingId(null); setForm(formVoloVuoto()); };

  const aggiungiFileAlModulo = (files) => {
    const nuovi = [];
    const scartati = [];
    files.forEach((file) => {
      const isVideo = file.type.startsWith("video/");
      const isFoto = file.type.startsWith("image/");
      if (!isVideo && !isFoto) { scartati.push(`${file.name} (formato non supportato)`); return; }
      nuovi.push({ file, anteprima: isFoto ? URL.createObjectURL(file) : null });
    });
    if (scartati.length > 0) alert("Alcuni file non sono stati aggiunti:\n- " + scartati.join("\n- "));
    setFileInAttesa((prev) => [...prev, ...nuovi]);
  };

  const scegliFileForm = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    aggiungiFileAlModulo(files);
  };

  // pulsante in cima: scegli i file e si apre il modulo già con gli allegati dentro
  const scegliFileRapido = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    if (!showForm) apriNuovo();
    aggiungiFileAlModulo(files);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const rimuoviFileInAttesa = (indice) => {
    setFileInAttesa((prev) => {
      const x = prev[indice];
      if (x && x.anteprima) URL.revokeObjectURL(x.anteprima);
      return prev.filter((_, i) => i !== indice);
    });
  };

  const aggiungiLinkInAttesa = () => {
    const t = linkFormNuovo.trim();
    if (!t) return;
    setLinkInAttesa((prev) => [...prev, t]);
    setLinkFormNuovo("");
  };

  const salva = async () => {
    if (!form.data) return;
    if (!editingId && piano === "free" && voli.length >= LIMITI_FREE.voli) {
      if (window.confirm(`Hai raggiunto i ${LIMITI_FREE.voli} voli del piano Free. Con il piano Pilota (${euro(PREZZI_PIANO.pilota.mese)} al mese) puoi registrarne senza limiti. Vuoi vedere i piani?`)) onVaiAbbonamento && onVaiAbbonamento();
      return;
    }
    setSalvando(true);
    const droneScelto = (droni || []).find((d) => d.id === form.drone_id);
    const payload = {
      data: form.data,
      ora: form.ora || null,
      durata_minuti: form.durata ? Number(form.durata) : null,
      drone_id: droneScelto ? droneScelto.id : null,
      drone_nome: droneScelto ? droneScelto.nome : (form.drone_nome.trim() || null),
      luogo: form.luogo.trim() || null,
      coordinate_gps: form.coordinate_gps.trim() || null,
      tipo_attivita: form.tipo_attivita,
      categoria_operativa: form.categoria_operativa,
      altezza_max: form.altezza_max ? Number(form.altezza_max) : null,
      cliente: form.cliente.trim() || null,
      note: form.note.trim() || null,
    };
    const idsBatterie = editingId ? [] : (form.batterie_usate || []);
    if (idsBatterie.length > 0) payload.batterie_ids = idsBatterie;
    let voloId = editingId;
    let erroreSalvataggio = null;
    if (editingId) {
      const { error } = await supabase.from("voli").update(payload).eq("id", editingId);
      erroreSalvataggio = error;
    } else {
      const { data: nuovo, error } = await supabase.from("voli").insert(payload).select().single();
      erroreSalvataggio = error;
      voloId = nuovo ? nuovo.id : null;
    }
    if (erroreSalvataggio || !voloId) {
      setSalvando(false);
      alert("Salvataggio non riuscito: " + ((erroreSalvataggio && erroreSalvataggio.message) || "errore sconosciuto"));
      return;
    }
    const problemi = [];
    // ogni batteria usata: un ciclo in più, ultimo utilizzo aggiornato, e lo stato diventa "usata"
    if (idsBatterie.length > 0) {
      for (const id of idsBatterie) {
        const b = (batterie || []).find((x) => x.id === id);
        if (!b) continue;
        const upd = { cicli: (Number(b.cicli) || 0) + 1, ultimo_uso: form.data };
        if (b.tipo !== "intelligent") { upd.stato_carica = "usata"; upd.stato_dal = new Date().toISOString(); }
        const { error: eb } = await supabase.from("batterie").update(upd).eq("id", id);
        if (eb) problemi.push(`batteria ${b.nome} (${eb.message})`);
      }
      onBatterieCambiate && onBatterieCambiate();
    }
    if (fileInAttesa.length > 0) {
      const scartati = await caricaFileVolo(voloId, fileInAttesa.map((x) => x.file));
      problemi.push(...scartati);
    }
    for (const l of linkInAttesa) {
      const errLink = await inserisciLinkVolo(voloId, l);
      if (errLink) problemi.push(`${l} (${errLink})`);
    }
    setSalvando(false);
    if (problemi.length > 0) alert("Il volo è stato salvato, ma alcuni allegati no:\n- " + problemi.join("\n- "));
    chiudiForm();
    setEspansoId(voloId);
    carica();
  };

  const eliminaVolo = async (v) => {
    if (!window.confirm("Eliminare questo volo e tutti i suoi media? L'operazione non è reversibile.")) return;
    const files = media.filter((m) => m.volo_id === v.id && m.tipo !== "link").map((m) => percorsoStorageDaUrl(m.url)).filter(Boolean);
    if (files.length) await supabase.storage.from("foto-ispezioni").remove(files);
    const { error } = await supabase.from("voli").delete().eq("id", v.id);
    if (error) { alert("Eliminazione non riuscita: " + error.message); return; }
    if (espansoId === v.id) setEspansoId(null);
    carica();
  };

  const usaPosizione = () => {
    if (!navigator.geolocation) { alert("Questo dispositivo non supporta la posizione."); return; }
    setGpsInCorso(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, coordinate_gps: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` }));
        setGpsInCorso(false);
      },
      () => {
        alert("Non riesco a leggere la posizione. Controlla di aver dato il permesso al browser.");
        setGpsInCorso(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // carica una lista di file per un volo; restituisce l'elenco dei file scartati, con il motivo (nessun limite di numero: solo un file che Supabase stesso rifiuta finisce qui)
  const caricaFileVolo = async (voloId, files) => {
    const scartati = [];
    for (const file of files) {
      try {
        const isVideo = file.type.startsWith("video/");
        const isFoto = file.type.startsWith("image/");
        if (!isVideo && !isFoto) { scartati.push(`${file.name} (formato non supportato)`); continue; }
        const daCaricare = isFoto ? await ridimensionaImmagine(file) : file;
        const convertita = isFoto && daCaricare !== file;
        const ext = convertita ? "jpg" : ((file.name.split(".").pop() || (isVideo ? "mp4" : "jpg")).toLowerCase());
        const nomeFile = `volo-${voloId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, daCaricare, { contentType: convertita ? "image/jpeg" : file.type });
        if (eUp) throw eUp;
        const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
        const { error: eIns } = await supabase.from("voli_media").insert({ volo_id: voloId, tipo: isVideo ? "video" : "foto", url: pub.publicUrl, nome: file.name });
        if (eIns) throw eIns;
      } catch (err) {
        scartati.push(`${file.name} (${(err && err.message) || "errore"})`);
      }
    }
    return scartati;
  };

  // salva un link esterno; restituisce il messaggio d'errore oppure null se è andato bene
  const inserisciLinkVolo = async (voloId, testo) => {
    let url = String(testo || "").trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const { error } = await supabase.from("voli_media").insert({ volo_id: voloId, tipo: "link", url, nome: url.replace(/^https?:\/\//i, "").slice(0, 60) });
    return error ? error.message : null;
  };

  const aggiungiMedia = async (voloId, e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setCaricandoMediaId(voloId);
    const scartati = await caricaFileVolo(voloId, files);
    setCaricandoMediaId(null);
    setEspansoId(voloId);
    if (scartati.length > 0) alert("Alcuni file non sono stati caricati:\n- " + scartati.join("\n- "));
    carica();
  };

  const aggiungiLink = async (voloId) => {
    const errLink = await inserisciLinkVolo(voloId, linkNuovo);
    if (errLink) { alert("Non sono riuscito a salvare il link: " + errLink); return; }
    setLinkNuovo("");
    carica();
  };

  const eliminaMedia = async (m) => {
    if (!window.confirm("Eliminare questo elemento?")) return;
    if (m.tipo !== "link") {
      const percorso = percorsoStorageDaUrl(m.url);
      if (percorso) await supabase.storage.from("foto-ispezioni").remove([percorso]);
    }
    await supabase.from("voli_media").delete().eq("id", m.id);
    carica();
  };

  const scaricaPdf = () => {
    setGenerandoPdf(true);
    try {
      const titolo = filtroAnno !== "tutti" ? `Registro voli ${filtroAnno}` : "Registro voli";
      const doc = costruisciPDFLogbook({ azienda, voli: visibili, titolo });
      const url = doc.output("bloburl");
      setPdfUrl(url);
      window.open(url, "_blank");
    } catch (err) {
      alert("Non sono riuscito a generare il PDF: " + (err?.message || err));
    }
    setGenerandoPdf(false);
  };

  // esportazione CSV: dati grezzi, comodi per backup, un datore di lavoro/cliente, o importarli altrove
  const scaricaCsv = () => {
    if (piano === "free") { onVaiAbbonamento && onVaiAbbonamento(); return; }
    const intestazione = ["Data", "Ora", "Durata (min)", "Drone", "Luogo", "Coordinate GPS", "Tipo attività", "Categoria operativa", "Altezza max (m)", "Cliente", "Note"];
    const escapeCsv = (v) => { const t = String(v ?? "").replace(/"/g, '""'); return /[",\n;]/.test(t) ? `"${t}"` : t; };
    const righe = visibili.map((v) => [
      v.data || "", v.ora ? String(v.ora).slice(0, 5) : "", v.durata_minuti ?? "", v.drone_nome || "",
      v.luogo || "", v.coordinate_gps || "", (TIPI_ATTIVITA_VOLO.find((t) => t.key === v.tipo_attivita) || {}).label || v.tipo_attivita || "",
      etichettaCategoriaVolo(v.categoria_operativa), v.altezza_max ?? "", v.cliente || "", v.note || "",
    ].map(escapeCsv).join(";"));
    const csv = "\uFEFF" + [intestazione.map(escapeCsv).join(";"), ...righe].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registro-voli${filtroAnno !== "tutti" ? "-" + filtroAnno : ""}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const lbl = { fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 };
  const chip = (attivo, colore) => ({
    background: attivo ? colore + "22" : "transparent",
    border: `1px solid ${attivo ? colore : "#333a45"}`,
    color: attivo ? colore : "#8b95a3",
    borderRadius: 999, padding: "5px 12px", fontSize: 12, fontWeight: 600,
  });
  const riga = (label, valore) => (
    <div style={{ fontSize: 12.5 }}><span style={{ color: "#8b95a3" }}>{label}: </span>{valore}</div>
  );
  const mediaGalleria = media
    .map((m) => ({ m, volo: visibili.find((v) => v.id === m.volo_id) }))
    .filter((x) => x.volo)
    .sort((a, b) => String(b.volo.data || "").localeCompare(String(a.volo.data || "")));

  const galleriaJsx = mediaGalleria.length === 0 ? (
    <EmptyState text="Nessuna foto o video ancora. Tocca «Aggiungi foto / video» qui in alto: crei subito il volo di oggi con quello che scegli." />
  ) : (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
      {mediaGalleria.map(({ m, volo }) => (
        <div key={m.id} style={{ gridColumn: m.tipo === "video" ? "span 2" : undefined }}>
          {m.tipo === "foto" && (
            <img src={m.url} alt={m.nome || "foto"} loading="lazy" onClick={() => setLightbox(m)} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 6, cursor: "pointer", display: "block", background: "#000" }} />
          )}
          {m.tipo === "video" && (
            <video src={m.url} controls preload="metadata" playsInline style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 6, background: "#000", display: "block" }} />
          )}
          {m.tipo === "link" && (
            <a href={m.url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, aspectRatio: "1 / 1", background: "#161a1f", border: "1px solid #333a45", borderRadius: 6, color: "#3d8bfd", fontSize: 11, textDecoration: "none", padding: 6, textAlign: "center", wordBreak: "break-all", overflow: "hidden" }}>
              <span style={{ fontSize: 20 }}>🔗</span>{m.nome}
            </a>
          )}
          <button onClick={() => { setVista("voli"); setEspansoId(volo.id); }} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 11, padding: "4px 0 0 0", textAlign: "left", width: "100%" }}>
            {formatData(volo.data)}{volo.luogo ? ` · ${volo.luogo}` : ""}
          </button>
        </div>
      ))}
    </div>
  );

  const nessunDroneInElenco = (droni || []).length === 0;
  const mostraNomeDroneLibero = nessunDroneInElenco || form.drone_id === "__altro";

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Registro voli</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, background: "#241d16", color: "#ffb877", border: "1px solid #ff8c42", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <Camera size={14} /> Aggiungi foto / video
            <input type="file" accept="image/*,video/*" multiple onChange={scegliFileRapido} style={{ display: "none" }} />
          </label>
          <button onClick={scaricaPdf} disabled={generandoPdf || visibili.length === 0} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "8px 14px", borderRadius: 6, fontSize: 13, opacity: visibili.length === 0 ? 0.5 : 1 }}>
            <FileDown size={14} /> {generandoPdf ? "Preparazione..." : "PDF"}
          </button>
          <button onClick={scaricaCsv} disabled={visibili.length === 0} title={piano === "free" ? "Esportazione CSV: disponibile dal piano Pilota" : "Scarica i dati in formato CSV"} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: piano === "free" ? "#8b95a3" : "#e7eaee", border: "1px solid #333a45", padding: "8px 14px", borderRadius: 6, fontSize: 13, opacity: visibili.length === 0 ? 0.5 : 1 }}>
            {piano === "free" ? "🔒" : <FileDown size={14} />} CSV
          </button>
          <button onClick={() => (showForm ? chiudiForm() : apriNuovo())} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {showForm ? "Annulla" : <><Plus size={14} /> Nuovo volo</>}
          </button>
        </div>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "0 0 18px 0", maxWidth: 600 }}>
        Il tuo diario di volo: video, foto, FPV o ispezioni. Per ogni volo salvi dove, quando e con quale drone, e alleghi le foto e i video di quel giorno.
      </p>
      {piano === "free" && (
        <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "-8px 0 16px 0" }}>
          Piano Free: {voli.length}/{LIMITI_FREE.voli} voli. Foto, video e link non hanno un limite di numero.{" "}
          <button onClick={onVaiAbbonamento} style={{ background: "none", border: "none", color: "#3d8bfd", padding: 0, fontSize: 11.5 }}>Togli il limite dei voli con Pilota →</button>
        </p>
      )}
      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer" style={{ display: "block", margin: "-10px 0 14px 0", fontSize: 11.5, color: "#3d8bfd" }}>
          Se non si è aperto automaticamente, apri il PDF qui
        </a>
      )}

      {errore && (
        <div style={{ margin: "0 0 16px 0", padding: "10px 14px", background: "#2a1616", border: "1px solid #5a2a2a", borderRadius: 8, color: "#ff9c9c", fontSize: 12.5, maxWidth: 560 }}>
          Impossibile leggere il registro voli: {errore}. Controlla di aver eseguito lo script SQL "registro voli" su Supabase.
        </div>
      )}

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, marginBottom: 20, maxWidth: 560, display: "flex", flexDirection: "column", gap: 12 }}>
          {editingId && <div style={{ fontSize: 12, color: "#ff8c42", fontWeight: 600 }}>Stai modificando un volo esistente</div>}

          <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#c3cad4" }}>📎 Foto e video di questo volo <span style={{ color: "#6b7480", fontWeight: 400 }}>(facoltativo)</span></div>
            <label style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "9px 14px", color: "#c3cad4", fontSize: 12.5, cursor: "pointer" }}>
              <Upload size={14} /> Scegli foto e video
              <input type="file" accept="image/*,video/*" multiple onChange={scegliFileForm} style={{ display: "none" }} />
            </label>
            {fileInAttesa.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))", gap: 8 }}>
                {fileInAttesa.map((x, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {x.anteprima ? (
                      <img src={x.anteprima} alt={x.file.name} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 6, display: "block" }} />
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 6, background: "#0e1116", border: "1px solid #333a45", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: 4, overflow: "hidden" }}>
                        <span style={{ fontSize: 20 }}>🎬</span>
                        <span style={{ fontSize: 9.5, color: "#8b95a3", textAlign: "center", wordBreak: "break-all", lineHeight: 1.2 }}>{x.file.name.slice(0, 22)}</span>
                      </div>
                    )}
                    <button type="button" onClick={() => rimuoviFileInAttesa(i)} title="Togli" style={{ position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.75)", color: "#fff", border: "none", fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" placeholder="Oppure incolla il link di un video (Drive, YouTube, WeTransfer...)" value={linkFormNuovo} onChange={(e) => setLinkFormNuovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aggiungiLinkInAttesa(); } }} style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px" }} />
              <button type="button" onClick={aggiungiLinkInAttesa} style={{ background: "#262b33", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "0 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>+ Link</button>
            </div>
            {linkInAttesa.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {linkInAttesa.map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#3d8bfd" }}>
                    <span style={{ flex: 1, wordBreak: "break-all" }}>🔗 {l}</span>
                    <button type="button" onClick={() => setLinkInAttesa((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {(fileInAttesa.length > 0 || linkInAttesa.length > 0) && (
              <div>
                <button type="button" onClick={salva} disabled={!form.data || salvando} style={{ width: "100%", background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "10px 0", borderRadius: 6, fontWeight: 700, fontSize: 13.5 }}>
                  {salvando ? "Salvataggio..." : "💾 Salva subito"}
                </button>
                <p style={{ fontSize: 10.5, color: "#8b95a3", margin: "5px 0 0 0" }}>Data e ora sono già quelle di adesso: luogo, drone e il resto puoi completarli anche dopo.</p>
              </div>
            )}
            <p style={{ fontSize: 10.5, color: "#6b7480", margin: 0 }}>I file vengono caricati quando salvi. Se un video molto pesante non si carica, o carichi il link, oppure alza il "Global file size limit" nelle impostazioni Storage di Supabase.</p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 130 }}>
              <label style={lbl}>Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label style={lbl}>Ora decollo</label>
              <input type="time" value={form.ora} onChange={(e) => setForm({ ...form, ora: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <label style={lbl}>Durata (minuti)</label>
              <input type="number" min="0" placeholder="es. 18" value={form.durata} onChange={(e) => setForm({ ...form, durata: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={lbl}>Tipo di attività</label>
              <select value={form.tipo_attivita} onChange={(e) => setForm({ ...form, tipo_attivita: e.target.value })} style={inputStyle}>
                {TIPI_ATTIVITA_VOLO.map((t) => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 150 }}>
              <label style={lbl}>Categoria operativa</label>
              <select value={form.categoria_operativa} onChange={(e) => setForm({ ...form, categoria_operativa: e.target.value })} style={inputStyle}>
                {CATEGORIE_OPERATIVE_VOLO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Drone</label>
            {!nessunDroneInElenco && (
              <select value={form.drone_id} onChange={(e) => setForm({ ...form, drone_id: e.target.value })} style={inputStyle}>
                <option value="">— Nessuno —</option>
                {droni.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                <option value="__altro">Altro (scrivo il nome a mano)</option>
              </select>
            )}
            {mostraNomeDroneLibero && (
              <input type="text" placeholder="es. DJI Avata 2" value={form.drone_nome} onChange={(e) => setForm({ ...form, drone_nome: e.target.value })} style={{ ...inputStyle, marginTop: nessunDroneInElenco ? 0 : 8 }} />
            )}
            {nessunDroneInElenco && <p style={{ fontSize: 10.5, color: "#6b7480", margin: "4px 0 0 0" }}>Registra i tuoi droni in "I miei droni" per sceglierli da un elenco.</p>}
          </div>

          {!editingId && (batterie || []).filter((b) => !b.ritirata).length > 0 && (
            <div>
              <label style={lbl}>🔋 Batterie usate (aggiungiamo un ciclo a ciascuna)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {batterie.filter((b) => !b.ritirata).map((b) => {
                  const on = (form.batterie_usate || []).includes(b.id);
                  return (
                    <button type="button" key={b.id} onClick={() => setForm({ ...form, batterie_usate: on ? form.batterie_usate.filter((x) => x !== b.id) : [...(form.batterie_usate || []), b.id] })} style={chip(on, "#4ade80")}>
                      {on ? "✓ " : ""}{b.nome} <span style={{ opacity: 0.7, fontWeight: 400 }}>({Number(b.cicli) || 0})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>Luogo</label>
            <input type="text" placeholder="es. Lago di Viverone" value={form.luogo} onChange={(e) => setForm({ ...form, luogo: e.target.value })} style={inputStyle} />
          </div>

          <div>
            <label style={lbl}>Coordinate GPS (facoltativo)</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="text" placeholder="es. 45.0703, 7.6869" value={form.coordinate_gps} onChange={(e) => setForm({ ...form, coordinate_gps: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
              <button type="button" onClick={usaPosizione} disabled={gpsInCorso} style={{ background: "#262b33", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "0 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                {gpsInCorso ? "Cerco..." : "📍 Usa la mia posizione"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={lbl}>Altezza max (m)</label>
              <input type="number" min="0" placeholder="es. 60" value={form.altezza_max} onChange={(e) => setForm({ ...form, altezza_max: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={lbl}>Cliente / committente (facoltativo)</label>
              <input type="text" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={lbl}>Note (facoltativo)</label>
            <textarea rows={3} placeholder="es. vento debole, batterie usate: 3, autorizzazione ottenuta..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <button onClick={salva} disabled={!form.data || salvando} style={{ marginTop: 2, background: form.data ? "#ff8c42" : "#333a45", color: form.data ? "#161a1f" : "#6b7480", border: "none", padding: "10px 0", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
            {salvando ? "Salvataggio..." : editingId ? "Aggiorna volo" : "Salva volo"}
          </button>
        </div>
      )}

      {caricando ? <LoadingBlock /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16, maxWidth: 620 }}>
            <StatCard label="Voli mostrati" value={visibili.length} sub={filtroTipo === "tutti" && filtroAnno === "tutti" && !q ? "in totale" : "con i filtri attivi"} />
            <StatCard label="Tempo di volo" value={formattaDurata(minutiTotali)} sub="dove la durata è indicata" accent="#ff8c42" />
            <StatCard label={`Voli nel ${annoCorrente}`} value={voliQuestAnno} sub="da inizio anno" />
          </div>

          {Object.keys(perDrone).length > 0 && (
            <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 8, padding: "10px 14px", marginBottom: 16, maxWidth: 620 }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, color: "#8b95a3", margin: "0 0 6px 0" }}>Tempo di volo per drone</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
                {Object.entries(perDrone).map(([nome, min]) => (
                  <span key={nome} style={{ fontSize: 12.5, color: "#c3cad4" }}>{nome}: <strong style={{ color: "#fff" }}>{formattaDurata(min)}</strong></span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <button onClick={() => setVista("voli")} style={chip(vista === "voli", "#ff8c42")}>📋 Voli</button>
            <button onClick={() => setVista("galleria")} style={chip(vista === "galleria", "#ff8c42")}>🖼️ Galleria ({media.length})</button>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <button onClick={() => setFiltroTipo("tutti")} style={chip(filtroTipo === "tutti", "#e7eaee")}>Tutti</button>
            {TIPI_ATTIVITA_VOLO.map((t) => (
              <button key={t.key} onClick={() => setFiltroTipo(t.key)} style={chip(filtroTipo === t.key, t.colore)}>{t.emoji} {t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16, maxWidth: 620 }}>
            <input type="text" placeholder="Cerca per luogo, cliente, drone, note..." value={cerca} onChange={(e) => setCerca(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200, fontSize: 12.5, padding: "7px 10px" }} />
            {anni.length > 1 && (
              <select value={filtroAnno} onChange={(e) => setFiltroAnno(e.target.value)} style={{ ...inputStyle, width: "auto", fontSize: 12.5, padding: "7px 10px" }}>
                <option value="tutti">Tutti gli anni</option>
                {anni.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8b95a3", cursor: "pointer" }}>
              <input type="checkbox" checked={includiIspezioni} onChange={(e) => setIncludiIspezioni(e.target.checked)} />
              Includi le ispezioni
            </label>
          </div>

          {vista === "galleria" ? galleriaJsx : tutti.length === 0 ? (
            <EmptyState text="Nessun volo registrato. Premi «Nuovo volo» per aggiungere il primo." />
          ) : visibili.length === 0 ? (
            <EmptyState text="Nessun volo corrisponde ai filtri scelti." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visibili.map((v) => {
                const tipo = TIPI_ATTIVITA_VOLO.find((t) => t.key === v.tipo_attivita) || TIPI_ATTIVITA_VOLO[TIPI_ATTIVITA_VOLO.length - 1];
                const mediaVolo = v._derived ? [] : media.filter((m) => m.volo_id === v.id);
                const nFoto = mediaVolo.filter((m) => m.tipo === "foto").length;
                const nVideo = mediaVolo.filter((m) => m.tipo === "video").length;
                const nLink = mediaVolo.filter((m) => m.tipo === "link").length;
                const aperto = espansoId === v.id;
                const sottotitolo = [v.luogo, v.drone_nome, v.durata_minuti ? formattaDurata(v.durata_minuti) : null].filter(Boolean).join(" · ");
                return (
                  <div key={v.id} style={{ background: "#1b2028", border: aperto ? "1px solid #ff8c42" : "1px solid #262b33", borderRadius: 8, padding: "12px 16px" }}>
                    <div
                      onClick={() => { if (v._derived) return; setEspansoId(aperto ? null : v.id); setLinkNuovo(""); }}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", cursor: v._derived ? "default" : "pointer" }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span>{formatData(v.data)}{v.ora ? ` · ${String(v.ora).slice(0, 5)}` : ""}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: tipo.colore + "22", color: tipo.colore }}>{tipo.emoji} {tipo.label}</span>
                          {v._derived && <span style={{ fontSize: 10.5, color: "#6b7480" }}>da ispezione</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 3 }}>{sottotitolo || "—"}</div>
                      </div>
                      {!v._derived && (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#8b95a3" }}>
                          <label onClick={(e) => e.stopPropagation()} title="Aggiungi foto o video a questo volo" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #ff8c4288", borderRadius: 6, padding: "5px 10px", color: "#ffb877", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                            <Camera size={13} /> {caricandoMediaId === v.id ? "Carico..." : "Foto/video"}
                            <input type="file" accept="image/*,video/*" multiple disabled={caricandoMediaId === v.id} onChange={(e) => aggiungiMedia(v.id, e)} style={{ display: "none" }} />
                          </label>
                          {nFoto > 0 && <span>📷 {nFoto}</span>}
                          {nVideo > 0 && <span>🎬 {nVideo}</span>}
                          {nLink > 0 && <span>🔗 {nLink}</span>}
                          <ChevronRight size={15} color="#6b7480" style={{ transform: aperto ? "rotate(90deg)" : "none" }} />
                        </div>
                      )}
                    </div>

                    {aperto && !v._derived && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #262b33", display: "flex", flexDirection: "column", gap: 6 }}>
                        {riga("Categoria", etichettaCategoriaVolo(v.categoria_operativa))}
                        {Array.isArray(v.batterie_ids) && v.batterie_ids.length > 0 ? riga("Batterie", v.batterie_ids.map((id) => ((batterie || []).find((b) => b.id === id) || {}).nome).filter(Boolean).join(", ") || "—") : null}
                        {v.altezza_max ? riga("Altezza max", `${v.altezza_max} m`) : null}
                        {v.cliente ? riga("Cliente", v.cliente) : null}
                        {v.coordinate_gps ? (
                          <div style={{ fontSize: 12.5 }}>
                            <span style={{ color: "#8b95a3" }}>GPS: </span>
                            <a href={`https://www.google.com/maps?q=${encodeURIComponent(v.coordinate_gps)}`} target="_blank" rel="noreferrer" style={{ color: "#3d8bfd" }}>{v.coordinate_gps} ↗</a>
                          </div>
                        ) : null}
                        {v.note ? <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap" }}><span style={{ color: "#8b95a3" }}>Note: </span>{v.note}</div> : null}

                        {mediaVolo.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginTop: 6 }}>
                            {mediaVolo.map((m) => (
                              <div key={m.id} style={{ position: "relative", gridColumn: m.tipo === "video" ? "span 2" : undefined }}>
                                {m.tipo === "foto" && (
                                  <img src={m.url} alt={m.nome || "foto"} loading="lazy" onClick={() => setLightbox(m)} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 6, cursor: "pointer", display: "block", background: "#000" }} />
                                )}
                                {m.tipo === "video" && (
                                  <video src={m.url} controls preload="metadata" playsInline style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: 6, background: "#000", display: "block" }} />
                                )}
                                {m.tipo === "link" && (
                                  <a href={m.url} target="_blank" rel="noreferrer" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, aspectRatio: "1 / 1", background: "#161a1f", border: "1px solid #333a45", borderRadius: 6, color: "#3d8bfd", fontSize: 11, textDecoration: "none", padding: 6, textAlign: "center", wordBreak: "break-all", overflow: "hidden" }}>
                                    <span style={{ fontSize: 20 }}>🔗</span>{m.nome}
                                  </a>
                                )}
                                <button onClick={() => eliminaMedia(m)} title="Elimina" style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.75)", color: "#fff", border: "none", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                            <Upload size={13} /> {caricandoMediaId === v.id ? "Caricamento..." : "Aggiungi foto / video"}
                            <input type="file" accept="image/*,video/*" multiple disabled={caricandoMediaId === v.id} onChange={(e) => aggiungiMedia(v.id, e)} style={{ display: "none" }} />
                          </label>
                          <div style={{ display: "flex", gap: 6, flex: 1, minWidth: 220 }}>
                            <input type="text" placeholder="Link video (Drive, YouTube, WeTransfer...)" value={linkNuovo} onChange={(e) => setLinkNuovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aggiungiLink(v.id)} style={{ ...inputStyle, fontSize: 12.5, padding: "7px 10px" }} />
                            <button onClick={() => aggiungiLink(v.id)} style={{ background: "#262b33", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "0 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>+ Link</button>
                          </div>
                        </div>
                        <p style={{ fontSize: 10.5, color: "#6b7480", margin: "2px 0 0 0" }}>
                          Se un video molto pesante non si carica, salvalo su Drive o YouTube e incolla il link, oppure alza il "Global file size limit" nelle impostazioni Storage di Supabase.
                        </p>

                        <CondivisioneVolo volo={v} nMedia={mediaVolo.length} />

                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => apriModifica(v)} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "6px 12px", fontSize: 12 }}>Modifica</button>
                          <button onClick={() => eliminaVolo(v)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "6px 12px", fontSize: 12 }}>Elimina</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <img src={lightbox.url} alt={lightbox.nome || "foto"} style={{ maxWidth: "96vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 6 }} />
          <button onClick={() => setLightbox(null)} style={{ position: "fixed", top: 12, right: 12, background: "#161a1f", color: "#fff", border: "1px solid #333a45", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>Chiudi ✕</button>
        </div>
      )}
    </div>
  );
}

function Impostazioni({ azienda, setAzienda, piano, moduli, onSalvaModuli }) {
  const proAttivo = piano === "pro";

  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAzienda({ ...azienda, logo: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Impostazioni azienda</h1>
      <p style={{ color: "#8b95a3", fontSize: 13.5, margin: "0 0 24px 0" }}>Personalizza i report con il tuo brand — verranno usati in tutti i PDF generati.</p>

      <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 16, marginBottom: 24, maxWidth: 560 }}>
        <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 4px 0" }}>Come usi l'app</h3>
        <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 12px 0" }}>Scegli cosa ti serve: nel menu e nella prima pagina vedrai solo le sezioni giuste.</p>
        <SelettoreModuli moduli={moduli} onSave={onSalvaModuli} testoBottone="Salva" />
      </div>

      {!proAttivo && (
        <div style={{ maxWidth: 420, background: "#241d16", border: "1px solid #4a2f16", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 12.5, color: "#ffb877" }}>
          Sei sul piano <strong>Free</strong>: il logo personalizzato è disponibile solo con il piano Pro.
        </div>
      )}

      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 12, color: "#8b95a3", display: "block", marginBottom: 6 }}>Nome azienda / pilota</label>
          <input
            value={azienda.nome}
            onChange={(e) => setAzienda({ ...azienda, nome: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#8b95a3", display: "block", marginBottom: 6 }}>Logo (comparirà in alto nei report PDF)</label>
          {!proAttivo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: 0.6 }}>
              {azienda.logo && <img src={azienda.logo} alt="logo" style={{ height: 48, maxWidth: 140, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 6 }} />}
              <span style={{ fontSize: 12, color: "#6b7480" }}>🔒 Sblocca con il piano Pro</span>
            </div>
          ) : azienda.logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={azienda.logo} alt="logo" style={{ height: 48, maxWidth: 140, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 6 }} />
              <button onClick={() => setAzienda({ ...azienda, logo: null })} style={{ fontSize: 12.5, color: "#8b95a3", background: "none", border: "1px solid #333a45", borderRadius: 6, padding: "7px 12px" }}>Rimuovi</button>
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "center", gap: 8, width: "fit-content", border: "1px dashed #333a45", borderRadius: 8, padding: "10px 16px", color: "#8b95a3", fontSize: 13, cursor: "pointer" }}>
              <Upload size={15} /> Carica logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            </label>
          )}
        </div>

        <div style={{ borderTop: "1px solid #262b33", paddingTop: 18 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 4px 0" }}>Tariffe per i preventivi</h3>
          <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 12px 0" }}>Usate per calcolare il prezzo suggerito in "Preventivi" — puoi comunque modificare ogni prezzo a mano.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Tariffa base (€)</label>
              <input type="number" value={azienda.tariffaBase} onChange={(e) => setAzienda({ ...azienda, tariffaBase: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Tariffa per kWp (€)</label>
              <input type="number" step="0.01" value={azienda.tariffaKwp} onChange={(e) => setAzienda({ ...azienda, tariffaKwp: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #262b33", paddingTop: 18 }}>
          <h3 style={{ fontSize: 13.5, fontWeight: 600, margin: "0 0 4px 0" }}>Diciture legali nei preventivi</h3>
          <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 12px 0", lineHeight: 1.5 }}>
            Compare in fondo a ogni preventivo in PDF. Il testo qui sotto è un punto di partenza generico, non una consulenza legale: fattelo controllare da un commercialista o da chi ti segue, soprattutto una volta aperta la partita IVA. "{"{validita}"}" viene sostituito con i giorni di validità che imposti su ogni preventivo.
          </p>
          <textarea
            rows={5}
            placeholder={NOTE_LEGALI_PREVENTIVO_DEFAULT}
            value={azienda.noteLegaliPreventivo}
            onChange={(e) => setAzienda({ ...azienda, noteLegaliPreventivo: e.target.value })}
            style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          />
          {!azienda.noteLegaliPreventivo && (
            <p style={{ fontSize: 10.5, color: "#6b7480", margin: "6px 0 0 0" }}>Campo vuoto: nei PDF viene usato il testo di partenza mostrato come suggerimento qui sopra.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function NuovaIspezione({ onDone, azienda, impianti, onSaved, piano, reportQuestoMese }) {
  const [step, setStep] = useState(1);
  const [dataIspezione, setDataIspezione] = useState(() => new Date().toISOString().slice(0, 10));
  const [impiantoSel, setImpiantoSel] = useState(null);
  const [tipoIspezione, setTipoIspezione] = useState("fotovoltaico");
  const [ora, setOra] = useState(() => new Date().toTimeString().slice(0, 5));
  const [irraggiamento, setIrraggiamento] = useState("");
  const [note, setNote] = useState("");
  const [didascalieFoto, setDidascalieFoto] = useState({}); // { [id locale foto]: testo }
  const [prossimoControllo, setProssimoControllo] = useState("");
  const [operatore, setOperatore] = useState("");
  const [droneUsato, setDroneUsato] = useState("");
  const [oraAtterraggio, setOraAtterraggio] = useState("");
  const [coordinateGps, setCoordinateGps] = useState("");
  const [zonaRossa, setZonaRossa] = useState(false);
  const [permessiRichiesti, setPermessiRichiesti] = useState("");
  const [enteContattato, setEnteContattato] = useState("");
  const [statoPermesso, setStatoPermesso] = useState("in_attesa");
  const [dataInizioPermesso, setDataInizioPermesso] = useState("");
  const [oraInizioPermesso, setOraInizioPermesso] = useState("");
  const [dataFinePermesso, setDataFinePermesso] = useState("");
  const [oraFinePermesso, setOraFinePermesso] = useState("");
  const [motivoNegazione, setMotivoNegazione] = useState("");
  const [permessoValidoDal, setPermessoValidoDal] = useState("");
  const [permessoValidoAl, setPermessoValidoAl] = useState("");
  const [permessoOraDalle, setPermessoOraDalle] = useState("");
  const [permessoOraAlle, setPermessoOraAlle] = useState("");
  const [scenarioVolo, setScenarioVolo] = useState("aperta");
  const [altezzaVolo, setAltezzaVolo] = useState("");
  const [bufferSicurezza, setBufferSicurezza] = useState("");
  const [dflightShot, setDflightShot] = useState(null); // { dataUrl, blob }
  const [mostraDatiVolo, setMostraDatiVolo] = useState(false);
  const [foto, setFoto] = useState([]); // [{ id, dataUrl, blob }]
  const [fotoAttivaId, setFotoAttivaId] = useState(null);
  const [anomalie, setAnomalie] = useState([]); // [{ id, fotoId, x, y, categoria, gravita }]
  const [pendingPin, setPendingPin] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [salvataggio, setSalvataggio] = useState("idle"); // idle | saving | saved | error
  const [erroreSalvataggio, setErroreSalvataggio] = useState(null);
  const [suggerimenti, setSuggerimenti] = useState([]);
  const [rilevandoPunti, setRilevandoPunti] = useState(false);
  const [ritagliSchermo, setRitagliSchermo] = useState(new Map());
  const imgRef = useRef(null);

  const nuovoIdLocale = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const fotoAttiva = foto.find((f) => f.id === fotoAttivaId) || null;

  useEffect(() => { setSuggerimenti([]); }, [fotoAttivaId]);

  const salvaSuDb = async () => {
    if (!impiantoSel) return;
    setSalvataggio("saving");
    try {
      let dflightUrl = null;
      if (dflightShot?.blob) {
        const nomeFileDflight = `dflight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const { error: eUpD } = await supabase.storage.from("foto-ispezioni").upload(nomeFileDflight, dflightShot.blob, { contentType: "image/png" });
        if (!eUpD) {
          const { data: pubD } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFileDflight);
          dflightUrl = pubD?.publicUrl || null;
        }
      }

      const { data: isp, error: e1 } = await supabase.from("ispezioni").insert({
        impianto_id: impiantoSel.id,
        data: dataIspezione,
        ora: ora || null,
        irraggiamento: irraggiamento ? Number(irraggiamento) : null,
        note: note || null,
        operatore: operatore || null,
        prossimo_controllo: tipoIspezione !== "danni" && prossimoControllo ? (() => { const d = new Date(); d.setMonth(d.getMonth() + Number(prossimoControllo)); return d.toISOString().slice(0, 10); })() : null,
        tipo_ispezione: tipoIspezione,
        drone_usato: droneUsato || null,
        scenario_volo: scenarioVolo || null,
        altezza_volo: altezzaVolo ? Number(altezzaVolo) : null,
        buffer_sicurezza: bufferSicurezza ? Number(bufferSicurezza) : null,
        dflight_screenshot_url: dflightUrl,
        ora_atterraggio: oraAtterraggio || null,
        coordinate_gps: coordinateGps || null,
        zona_rossa: zonaRossa,
        permessi_richiesti: zonaRossa ? (permessiRichiesti || null) : null,
        ente_contattato: zonaRossa ? (enteContattato || null) : null,
        stato_permesso: zonaRossa ? statoPermesso : null,
        data_inizio_permesso: zonaRossa && dataInizioPermesso ? dataInizioPermesso : null,
        ora_inizio_permesso: zonaRossa ? (oraInizioPermesso || null) : null,
        data_fine_permesso: zonaRossa && dataFinePermesso ? dataFinePermesso : null,
        ora_fine_permesso: zonaRossa ? (oraFinePermesso || null) : null,
        motivo_negazione: zonaRossa && statoPermesso === "negato" ? (motivoNegazione || null) : null,
        permesso_valido_dal: zonaRossa && permessoValidoDal ? permessoValidoDal : null,
        permesso_valido_al: zonaRossa && permessoValidoAl ? permessoValidoAl : null,
        permesso_ora_dalle: zonaRossa ? (permessoOraDalle || null) : null,
        permesso_ora_alle: zonaRossa ? (permessoOraAlle || null) : null,
      }).select().single();
      if (e1) throw e1;

      // carico ogni foto e la collego a questa ispezione
      const mappaIdLocaleADb = {};
      let primoUrlFoto = null;
      for (const f of foto) {
        if (!f.blob) continue;
        const nomeFile = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const { error: eUp } = await supabase.storage.from("foto-ispezioni").upload(nomeFile, f.blob, { contentType: "image/png" });
        if (eUp) continue;
        const { data: pub } = supabase.storage.from("foto-ispezioni").getPublicUrl(nomeFile);
        const url = pub?.publicUrl || null;
        if (!url) continue;
        const { data: fotoRow, error: eFoto } = await supabase.from("foto").insert({ ispezione_id: isp.id, url, didascalia: didascalieFoto[f.id] || null }).select().single();
        if (eFoto) continue;
        mappaIdLocaleADb[f.id] = fotoRow.id;
        if (!primoUrlFoto) primoUrlFoto = url;
      }
      if (primoUrlFoto) {
        await supabase.from("ispezioni").update({ foto_url: primoUrlFoto }).eq("id", isp.id);
      }

      if (anomalie.length > 0) {
        const rows = anomalie.map((a) => ({
          ispezione_id: isp.id,
          foto_id: mappaIdLocaleADb[a.fotoId] || null,
          categoria: a.categoria,
          gravita: a.gravita,
          pos_x: a.x,
          pos_y: a.y,
        }));
        const { error: e2 } = await supabase.from("anomalie").insert(rows);
        if (e2) throw e2;
      }
      await supabase.from("report_log").insert({});
      setSalvataggio("saved");
      onSaved && onSaved();
    } catch (err) {
      setErroreSalvataggio(err?.message || JSON.stringify(err));
      setSalvataggio("error");
    }
  };

  const generaPDF = async () => {
    let prossimoControlloFormattato = null;
    if (prossimoControllo) {
      const d = new Date();
      d.setMonth(d.getMonth() + Number(prossimoControllo));
      prossimoControlloFormattato = formatData(d);
    }
    const ritagli = await generaRitagliAnomalie(foto, anomalie);
    const doc = costruisciPDF({
      azienda,
      impianto: impiantoSel,
      dati: { dataFormattata: formatData(dataIspezione), ora, operatore, irraggiamento, note, prossimoControlloFormattato, coordinateGps },
      fotoConDataUrl: foto.map((f) => ({ ...f, didascalia: didascalieFoto[f.id] || null })),
      anomalieList: anomalie,
      piano,
      ritagli,
      tipoIspezione,
    });
    const url = doc.output("bloburl");
    setPdfUrl(url);
    window.open(url, "_blank");
  };


  const aggiungiFotoDaFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = nuovoIdLocale();
    const reader = new FileReader();
    reader.onload = () => {
      setFoto((prev) => [...prev, { id, dataUrl: reader.result, blob: file }]);
      setFotoAttivaId(id);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const caricaDflightShot = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDflightShot({ dataUrl: reader.result, blob: file });
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const rimuoviFoto = (id) => {
    setFoto((prev) => prev.filter((f) => f.id !== id));
    setAnomalie((prev) => prev.filter((a) => a.fotoId !== id));
    setFotoAttivaId((attuale) => {
      if (attuale !== id) return attuale;
      const restanti = foto.filter((f) => f.id !== id);
      return restanti.length ? restanti[restanti.length - 1].id : null;
    });
  };

  const handleImgClick = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
  };

  const rilevaAutomaticamente = () => {
    if (!imgRef.current) return;
    setRilevandoPunti(true);
    setTimeout(() => {
      try {
        const risultati = rilevaPuntiCaldi(imgRef.current);
        setSuggerimenti(risultati);
      } catch (e) {
        alert("Non sono riuscito ad analizzare questa foto.");
      }
      setRilevandoPunti(false);
    }, 30); // piccolo ritardo per far comparire subito l'indicatore di caricamento
  };

  const accettaSuggerimento = (s, idx) => {
    setSuggerimenti(suggerimenti.filter((_, i) => i !== idx));
    setPendingPin({ x: s.x, y: s.y });
  };

  const scartaSuggerimento = (idx) => {
    setSuggerimenti(suggerimenti.filter((_, i) => i !== idx));
  };

  const confermaPin = (categoria, gravita) => {
    setAnomalie([...anomalie, { ...pendingPin, fotoId: fotoAttivaId, categoria, gravita, id: nuovoIdLocale() }]);
    setPendingPin(null);
  };

  const vaiAlReport = () => {
    setStep(3);
    salvaSuDb();
    generaRitagliAnomalie(foto, anomalie).then(setRitagliSchermo).catch(() => {});
  };

  const limiteRaggiunto = piano !== "pro" && reportQuestoMese >= LIMITI_FREE.reportMese;

  if (limiteRaggiunto) {
    return (
      <div style={{ padding: "28px 32px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px 0" }}>Nuova ispezione</h1>
        <div style={{ maxWidth: 420, background: "#241d16", border: "1px solid #4a2f16", borderRadius: 10, padding: 20 }}>
          <p style={{ fontSize: 13.5, color: "#ffb877", margin: "0 0 10px 0", fontWeight: 600 }}>Limite mensile raggiunto</p>
          <p style={{ fontSize: 12.5, color: "#c3cad4", margin: 0, lineHeight: 1.5 }}>
            Hai già generato {reportQuestoMese} report questo mese — il tuo piano include fino a {LIMITI_FREE.reportMese} report al mese. Passa al piano Pro per continuare senza limiti.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Nuova ispezione</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {["Impianto", tipoIspezione === "danni" ? "Foto" : "Foto termica", "Report"].map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: step === i + 1 ? "#ff8c42" : step > i + 1 ? "#3d8bfd" : "#262b33", color: step >= i + 1 ? "#161a1f" : "#8b95a3", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }} className="mono">{i + 1}</div>
            <span style={{ fontSize: 12.5, color: step === i + 1 ? "#fff" : "#8b95a3" }}>{label}</span>
            {i < 2 && <div style={{ width: 24, height: 1, background: "#262b33", margin: "0 4px" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ maxWidth: 420 }}>
          <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Tipo di ispezione</label>
          <select value={tipoIspezione} onChange={(e) => setTipoIspezione(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }}>
            <option value="fotovoltaico">Fotovoltaico termico</option>
            <option value="danni">Danni / ispezione assicurativa</option>
            <option value="edifici">Termografia edifici</option>
            <option value="elettrico">Impianti elettrici/industriali</option>
          </select>
          <p style={{ fontSize: 13, color: "#8b95a3", marginBottom: 12 }}>Seleziona l'impianto da ispezionare</p>
          {impianti.length === 0 ? (
            <EmptyState text="Nessun impianto ancora. Vai su 'Impianti' per aggiungerne uno prima di iniziare." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {impianti.map((imp) => (
                <button key={imp.id} onClick={() => setImpiantoSel(imp)} style={{ textAlign: "left", padding: "11px 14px", borderRadius: 7, border: impiantoSel?.id === imp.id ? "1px solid #ff8c42" : "1px solid #262b33", background: impiantoSel?.id === imp.id ? "#241d16" : "#1b2028", color: "#e7eaee", fontSize: 13.5 }}>
                  {imp.nome} <span style={{ color: "#6b7480", fontSize: 12 }}>&middot; {imp.zona}</span>
                </button>
              ))}
            </div>
          )}
          {impiantoSel && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Eseguita da (operatore/pilota)</label>
              <input type="text" placeholder="Nome e cognome" value={operatore} onChange={(e) => setOperatore(e.target.value)} style={inputStyle} />
            </div>
          )}
          {impiantoSel && (
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Data ispezione</label>
                <input type="date" value={dataIspezione} onChange={(e) => setDataIspezione(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Ora ispezione</label>
                <input type="time" value={ora} onChange={(e) => setOra(e.target.value)} style={inputStyle} />
              </div>
              {tipoIspezione === "fotovoltaico" && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Irraggiamento (W/m²)</label>
                  <input type="number" placeholder="es. 850" value={irraggiamento} onChange={(e) => setIrraggiamento(e.target.value)} style={inputStyle} />
                </div>
              )}
            </div>
          )}
          {impiantoSel && (
            <div style={{ marginTop: 18 }}>
              <button type="button" onClick={() => setMostraDatiVolo(!mostraDatiVolo)} style={{ width: "100%", background: "#1b2028", border: "1px solid #333a45", borderRadius: 8, color: "#e7eaee", fontSize: 14, fontWeight: 600, padding: "12px 16px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span style={{ fontSize: 16 }}>{mostraDatiVolo ? "▾" : "▸"}</span> 📋 Dati di volo (per il registro voli) <span style={{ fontWeight: 400, color: "#8b95a3", fontSize: 12.5 }}>— opzionale</span>
              </button>
              {mostraDatiVolo && (
                <div style={{ marginTop: 10, background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.24)", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 5, fontWeight: 500 }}>Drone utilizzato</label>
                    <input type="text" placeholder="es. DJI Matrice 4T" value={droneUsato} onChange={(e) => setDroneUsato(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 5, fontWeight: 500 }}>Ora atterraggio</label>
                      <input type="time" value={oraAtterraggio} onChange={(e) => setOraAtterraggio(e.target.value)} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Coordinate GPS stazione a terra</label>
                      <input type="text" placeholder="es. 45.0703, 7.6869" value={coordinateGps} onChange={(e) => setCoordinateGps(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Scenario operativo</label>
                      <select value={scenarioVolo} onChange={(e) => setScenarioVolo(e.target.value)} style={inputStyle}>
                        <option value="aperta">Categoria Aperta</option>
                        <option value="sts01">STS-01</option>
                        <option value="sts02">STS-02</option>
                        <option value="specifica">Operazione specifica (altro)</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Altezza max volo (m)</label>
                      <input type="number" placeholder="es. 60" value={altezzaVolo} onChange={(e) => setAltezzaVolo(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  {(scenarioVolo === "sts01" || scenarioVolo === "sts02") && (
                    <div>
                      <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Buffer di sicurezza usato (m)</label>
                      <input type="number" placeholder="es. 5" value={bufferSicurezza} onChange={(e) => setBufferSicurezza(e.target.value)} style={inputStyle} />
                      <p style={{ fontSize: 12, color: "#8b95a3", margin: "4px 0 0 0", lineHeight: 1.4 }}>
                        Il valore minimo dipende da altezza e peso del drone secondo l'Appendice 1 del Regolamento (UE) 2019/947 — verificalo sul tuo manuale operativo, qui lo registriamo solo per lo storico.
                      </p>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Screenshot D-Flight (facoltativo)</label>
                    {dflightShot ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={dflightShot.dataUrl} alt="D-Flight" style={{ width: 70, height: 46, objectFit: "cover", borderRadius: 4, border: "1px solid #333a45" }} />
                        <button onClick={() => setDflightShot(null)} style={{ background: "none", border: "1px solid #333a45", color: "#8b95a3", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>Rimuovi</button>
                      </div>
                    ) : (
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px dashed #333a45", borderRadius: 6, padding: "8px 14px", color: "#8b95a3", fontSize: 12.5, cursor: "pointer" }}>
                        <Upload size={13} /> Carica screenshot
                        <input type="file" accept="image/*" onChange={caricaDflightShot} style={{ display: "none" }} />
                      </label>
                    )}
                  </div>

                  <div style={{ borderTop: "1px solid #262b33", paddingTop: 10 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#e7eaee", cursor: "pointer" }}>
                      <input type="checkbox" checked={zonaRossa} onChange={(e) => setZonaRossa(e.target.checked)} />
                      Zona rossa / area soggetta a restrizioni
                    </label>
                    {zonaRossa && (
                      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Permessi richiesti</label>
                          <textarea placeholder="es. NOTAM, autorizzazione ENAC, coordinamento torre di controllo..." value={permessiRichiesti} onChange={(e) => setPermessiRichiesti(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Ente / soggetto contattato</label>
                          <input type="text" placeholder="es. Aeroclub Torino, Aeroporto Caselle - Torre" value={enteContattato} onChange={(e) => setEnteContattato(e.target.value)} style={inputStyle} />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Richiesta inviata il</label>
                            <input type="date" value={dataInizioPermesso} onChange={(e) => setDataInizioPermesso(e.target.value)} style={inputStyle} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Ora invio</label>
                            <input type="time" value={oraInizioPermesso} onChange={(e) => setOraInizioPermesso(e.target.value)} style={inputStyle} />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Risposta ricevuta il</label>
                            <input type="date" value={dataFinePermesso} onChange={(e) => setDataFinePermesso(e.target.value)} style={inputStyle} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Ora risposta</label>
                            <input type="time" value={oraFinePermesso} onChange={(e) => setOraFinePermesso(e.target.value)} style={inputStyle} />
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Esito permesso</label>
                          <select value={statoPermesso} onChange={(e) => setStatoPermesso(e.target.value)} style={inputStyle}>
                            <option value="in_attesa">In attesa</option>
                            <option value="autorizzato">Autorizzato</option>
                            <option value="negato">Negato</option>
                          </select>
                        </div>
                        {statoPermesso === "negato" && (
                          <div>
                            <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Motivo del rifiuto</label>
                            <textarea placeholder="es. area già impegnata, mancanza requisiti..." value={motivoNegazione} onChange={(e) => setMotivoNegazione(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
                          </div>
                        )}
                        {statoPermesso === "autorizzato" && (
                          <div>
                            <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Permesso valido</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input type="date" value={permessoValidoDal} onChange={(e) => setPermessoValidoDal(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                              <span style={{ fontSize: 13, color: "#8b95a3" }}>al</span>
                              <input type="date" value={permessoValidoAl} onChange={(e) => setPermessoValidoAl(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                              <input type="time" value={permessoOraDalle} onChange={(e) => setPermessoOraDalle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                              <span style={{ fontSize: 13, color: "#8b95a3" }}>alle</span>
                              <input type="time" value={permessoOraAlle} onChange={(e) => setPermessoOraAlle(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          <button disabled={!impiantoSel} onClick={() => setStep(2)} style={{ marginTop: 18, background: impiantoSel ? "#ff8c42" : "#333a45", color: impiantoSel ? "#161a1f" : "#6b7480", border: "none", padding: "9px 18px", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
            Continua
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          {tipoIspezione !== "danni" && (
            <div style={{ maxWidth: 460, background: "#16211a", border: "1px solid #2e5c2b", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "#c3cad4", margin: "0 0 8px 0" }}>🌡️ Per cambiare palette o leggere la temperatura esatta di un punto, apri la foto originale (R-JPEG) sul computer, gratis. Qui carichi l'immagine così com'è.</p>
              <a href={LINK_DJI_THERMAL_TOOL} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#4ade80", color: "#0a1a0f", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 6, textDecoration: "none" }}>Apri DJI Thermal Analysis Tool ↗</a>
            </div>
          )}
          {foto.length === 0 ? (
            <div style={{ maxWidth: 420 }}>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 220, border: "1px dashed #333a45", borderRadius: 10, color: "#8b95a3", fontSize: 13, cursor: "pointer" }}>
                <Camera size={26} strokeWidth={1.5} />
                Carica una foto termica dell'impianto
                <input type="file" accept="image/*" onChange={aggiungiFotoDaFile} style={{ display: "none" }} />
              </label>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12.5, color: "#8b95a3", marginBottom: 8 }}>
                {foto.length} {foto.length === 1 ? "foto" : "foto"} &middot; clicca sull'immagine attiva per segnare un'anomalia &middot; {anomalie.filter((a) => a.fotoId === fotoAttivaId).length} segnate su questa foto
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {foto.map((f, idx) => (
                  <div key={f.id} style={{ position: "relative" }}>
                    <button onClick={() => setFotoAttivaId(f.id)} style={{ width: 64, height: 44, borderRadius: 6, overflow: "hidden", border: fotoAttivaId === f.id ? "2px solid #ff8c42" : "2px solid #262b33", padding: 0, background: "#000" }}>
                      <img src={f.dataUrl} alt={`foto ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    </button>
                    <button onClick={() => rimuoviFoto(f.id)} title="Rimuovi foto" style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ff4d4d", border: "2px solid #161a1f", color: "#161a1f", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <label style={{ width: 64, height: 44, borderRadius: 6, border: "1px dashed #333a45", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#8b95a3" }} title="Carica un'altra foto">
                  <Plus size={16} />
                  <input type="file" accept="image/*" onChange={aggiungiFotoDaFile} style={{ display: "none" }} />
                </label>
              </div>

              {fotoAttiva && (
                <div style={{ marginBottom: 10 }}>
                  <button type="button" onClick={rilevaAutomaticamente} disabled={rilevandoPunti} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1b2028", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 6, padding: "8px 14px", fontSize: 12.5 }}>
                    🔍 {rilevandoPunti ? "Analisi in corso..." : "Rileva punti caldi automaticamente"}
                  </button>
                  <p style={{ fontSize: 10.5, color: "#6b7480", margin: "5px 0 0 0" }}>Individua automaticamente le zone più calde della foto — sono suggerimenti da confermare, non una diagnosi definitiva.</p>
                </div>
              )}
              {fotoAttiva && (
                <div style={{ position: "relative", width: "100%", maxWidth: 480, display: "block" }}>
                  <img ref={imgRef} src={fotoAttiva.dataUrl} onClick={handleImgClick} style={{ width: "100%", borderRadius: 8, display: "block", cursor: "crosshair" }} />
                  {anomalie.filter((a) => a.fotoId === fotoAttivaId).map((a, i) => {
                    const sev = SEVERITY.find((s) => s.key === a.gravita);
                    return (
                      <React.Fragment key={a.id}>
                        <div title={a.categoria} style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${sev.color}`, boxShadow: "0 0 0 1.5px #161a1f", transform: "translate(-50%,-50%)" }} />
                        <div style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, width: 20, height: 20, borderRadius: "50%", background: sev.color, border: "2px solid #161a1f", transform: "translate(6px, -22px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#161a1f" }}>
                          {i + 1}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {suggerimenti.map((s, idx) => (
                    <div key={idx} onClick={(e) => { e.stopPropagation(); accettaSuggerimento(s, idx); }} title="Suggerito: tocca per confermare" style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, width: 22, height: 22, borderRadius: "50%", border: "2px dashed #ff8c42", transform: "translate(-50%,-50%)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); scartaSuggerimento(idx); }}
                        title="Scarta suggerimento"
                        style={{ position: "absolute", top: -8, right: -8, width: 16, height: 16, borderRadius: "50%", background: "#333a45", border: "1px solid #161a1f", color: "#c3cad4", fontSize: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      >×</button>
                    </div>
                  ))}
                  {pendingPin && (
                    <div style={{ position: "absolute", left: `${pendingPin.x}%`, top: `${pendingPin.y}%`, transform: "translate(-50%,-50%)" }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "2px solid #161a1f" }} />
                    </div>
                  )}
                </div>
              )}
              {suggerimenti.length > 0 && (
                <p style={{ fontSize: 11.5, color: "#ff8c42", marginTop: 8 }}>
                  {suggerimenti.length} zona{suggerimenti.length > 1 ? "e" : ""} sospetta{suggerimenti.length > 1 ? "e" : ""} trovata{suggerimenti.length > 1 ? "e" : ""} (cerchi tratteggiati) — tocca per confermare come anomalia, o sulla × per scartare.
                </p>
              )}
              {pendingPin && <AnomaliaPopup onConfirm={confermaPin} onCancel={() => setPendingPin(null)} categorie={CATEGORIE_PER_TIPO[tipoIspezione] || CATEGORIE_FOTOVOLTAICO} />}
              {fotoAttiva && (
                <div style={{ marginTop: 12, maxWidth: 480 }}>
                  <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Didascalia sotto questa foto (facoltativa)</label>
                  <input
                    type="text"
                    placeholder="es. Tegole rotte sul lato sud del tetto"
                    value={didascalieFoto[fotoAttiva.id] || ""}
                    onChange={(e) => setDidascalieFoto({ ...didascalieFoto, [fotoAttiva.id]: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              )}
              <div style={{ marginTop: 16, maxWidth: 480 }}>
                <label style={{ fontSize: 13, color: "#8b95a3", display: "block", marginBottom: 4 }}>Note / commenti (opzionale)</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Osservazioni aggiuntive sull'ispezione..." rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", width: "100%" }} />
              </div>
              {tipoIspezione !== "danni" && (
                <div style={{ marginTop: 12, maxWidth: 240 }}>
                  <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Prossimo controllo tra</label>
                  <select value={prossimoControllo} onChange={(e) => setProssimoControllo(e.target.value)} style={inputStyle}>
                    <option value="">Nessuno</option>
                    <option value="1">1 mese</option>
                    <option value="3">3 mesi</option>
                    <option value="6">6 mesi</option>
                    <option value="12">1 anno</option>
                  </select>
                </div>
              )}
              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ background: "transparent", border: "1px solid #333a45", color: "#c3cad4", padding: "9px 16px", borderRadius: 6, fontSize: 13 }}>Indietro</button>
                <button onClick={vaiAlReport} style={{ background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "9px 18px", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>Genera report</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <p style={{ fontSize: 12.5, color: "#8b95a3", margin: 0 }}>Così apparirà il report che riceve il cliente:</p>
            {salvataggio === "saving" && <span style={{ fontSize: 11.5, color: "#8b95a3", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={12} className="spin" /> salvataggio...</span>}
            {salvataggio === "saved" && <span style={{ fontSize: 11.5, color: "#4ade80" }}>salvato nel database ✓</span>}
            {salvataggio === "error" && <span style={{ fontSize: 11.5, color: "#ff4d4d" }}>errore nel salvataggio</span>}
          </div>
          {salvataggio === "error" && erroreSalvataggio && (
            <p style={{ fontSize: 11, color: "#ff9c9c", background: "#2a1616", border: "1px solid #5a2a2a", borderRadius: 6, padding: "8px 10px", marginBottom: 14, maxWidth: 480, wordBreak: "break-word" }}>
              Dettaglio: {erroreSalvataggio}
            </p>
          )}

          <div style={{ background: "#ffffff", color: "#1a1a1a", width: "100%", maxWidth: 520, borderRadius: 4, padding: "28px 30px", boxShadow: "0 4px 24px rgba(0,0,0,0.35)" }}>
            {azienda.logo && (
              <img src={azienda.logo} alt="logo" style={{ height: 34, maxWidth: 130, objectFit: "contain", marginBottom: 14, marginLeft: "auto", marginRight: "auto", display: "block" }} />
            )}
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 3px 0", fontFamily: "'IBM Plex Sans', sans-serif" }}>Report ispezione termografica</h2>
            <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 18px 0" }}>{azienda.nome} — ispezioni con drone e termocamera</p>

            <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 12 }}>
              {[
                ["Impianto", impiantoSel?.nome],
                ["Località", impiantoSel?.zona],
                ...(impiantoSel?.kwp ? [["Potenza installata", `${impiantoSel?.kwp} kWp`]] : []),
                ["Cliente", impiantoSel?.cliente],
                ["Data ispezione", formatData(dataIspezione)],
                ["Ora ispezione", ora || "—"],
                ["Eseguita da", operatore || "—"],
                ["Coordinate GPS", coordinateGps || "—"],
                ...(tipoIspezione === "fotovoltaico" ? [["Irraggiamento solare", irraggiamento ? `${irraggiamento} W/m²` : "—"]] : []),
                ...(tipoIspezione === "danni" && anomalie.length === 0 ? [] : [["Anomalie rilevate", String(anomalie.length)]]),
                ...(tipoIspezione !== "danni" ? [["Prossimo controllo", prossimoControllo ? (() => { const d = new Date(); d.setMonth(d.getMonth() + Number(prossimoControllo)); return formatData(d); })() : "—"]] : []),
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                  <span style={{ color: "#6b7480" }}>{label}</span>
                  <span className="mono" style={{ color: "#1a1a1a" }}>{val}</span>
                </div>
              ))}
            </div>

            {foto.map((f, idx) => {
              const anomalieFoto = anomalie.filter((a) => a.fotoId === f.id);
              return (
                <div key={f.id} style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 10px 0" }}>{foto.length > 1 ? `${tipoIspezione === "danni" ? "Foto" : "Foto termica"} ${idx + 1}` : (tipoIspezione === "danni" ? "Foto" : "Foto termica")}</h3>
                  <div style={{ position: "relative", width: "100%" }}>
                    <img src={f.dataUrl} alt="foto ispezione" style={{ width: "100%", borderRadius: 4, display: "block" }} />
                    {anomalieFoto.map((a, i) => {
                      const sev = SEVERITY.find((s) => s.key === a.gravita);
                      return (
                        <React.Fragment key={a.id}>
                          <div style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, width: 14, height: 14, borderRadius: "50%", border: `2.5px solid ${sev.color}`, boxShadow: "0 0 0 1.5px rgba(0,0,0,0.6)", transform: "translate(-50%,-50%)" }} />
                          <div style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, width: 20, height: 20, borderRadius: "50%", background: sev.color, border: "2px solid #fff", transform: "translate(6px, -22px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#161a1f", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                            {i + 1}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  {didascalieFoto[f.id] && (
                    <p style={{ fontSize: 12, color: "#555", fontStyle: "italic", margin: "8px 0 0 0" }}>{didascalieFoto[f.id]}</p>
                  )}
                  {anomalieFoto.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      {anomalieFoto.map((a, i) => (
                        <BloccoAnomalia key={a.id} a={a} numero={i + 1} ritaglio={ritagliSchermo.get(a.id)} fotoNumero={foto.length > 1 ? idx + 1 : undefined} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {(() => {
              const anomalieSenzaFoto = anomalie.filter((a) => !foto.some((f) => f.id === a.fotoId));
              if (anomalieSenzaFoto.length === 0) return null;
              return (
                <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 10px 0" }}>Altre anomalie</h3>
                  {anomalieSenzaFoto.map((a, i) => (
                    <BloccoAnomalia key={a.id} a={a} numero={i + 1} ritaglio={ritagliSchermo.get(a.id)} />
                  ))}
                </div>
              );
            })()}

            {anomalie.length === 0 && tipoIspezione !== "danni" && (
              <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 10px 0" }}>Anomalie e raccomandazioni</h3>
                <p style={{ fontSize: 12, color: "#6b7480" }}>Nessuna anomalia rilevata durante l'ispezione.</p>
              </div>
            )}

            {note && (
              <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 8px 0" }}>Note</h3>
                <p style={{ fontSize: 12, color: "#333", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{note}</p>
              </div>
            )}

            {piano !== "pro" && (
              <p style={{ fontSize: 9.5, color: "#9aa4b2", marginTop: 18, borderTop: "1px solid #e5e5e5", paddingTop: 10 }}>Generato da {azienda.nome}</p>
            )}
          </div>

          <div style={{ maxWidth: 520, marginTop: 16 }}>
            <button onClick={generaPDF}  style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "9px 16px", borderRadius: 6, fontSize: 13 }}>
              <FileDown size={14} /> Scarica PDF
            </button>
            <button onClick={onDone} style={{ display: "block", marginTop: 10, background: "transparent", color: "#8b95a3", border: "none", padding: "8px 0", fontSize: 12.5 }}>
              Torna alla dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BloccoAnomalia({ a, numero, ritaglio, fotoNumero }) {
  const info = TUTTE_LE_CATEGORIE.find((c) => c.key === a.categoria);
  const sev = SEVERITY.find((s) => s.key === a.gravita);
  return (
    <div style={{ marginBottom: 18 }}>
      {ritaglio && (
        <div style={{ position: "relative", marginBottom: 8, maxWidth: 320 }}>
          <img src={ritaglio} alt="Primo piano anomalia" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 8, border: "1px solid #e5e5e5", display: "block" }} />
          <div style={{ position: "absolute", top: 8, left: 8, width: 26, height: 26, borderRadius: "50%", background: sev.color, color: "#161a1f", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
            {numero}
          </div>
          {fotoNumero && (
            <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4 }}>
              Foto {fotoNumero}
            </div>
          )}
        </div>
      )}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{fotoNumero ? `Foto ${fotoNumero} — ` : ""}{numero}. {a.categoria}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: sev.color }}>{sev.label.toUpperCase()}</span>
        </div>
        <p style={{ fontSize: 11.5, color: "#555", margin: "3px 0" }}>{info.descrizione}</p>
        <p style={{ fontSize: 11.5, color: "#ff8c42", margin: 0, fontWeight: 500 }}>Azione consigliata: {info.azione}</p>
      </div>
    </div>
  );
}

function AnomaliaPopup({ onConfirm, onCancel, categorie = CATEGORIE_FOTOVOLTAICO }) {
  const [categoria, setCategoria] = useState(categorie[0].key);
  const [gravita, setGravita] = useState("media");
  const info = categorie.find((c) => c.key === categoria) || TUTTE_LE_CATEGORIE.find((c) => c.key === categoria);
  return (
    <div style={{ marginTop: 12, background: "#1b2028", border: "1px solid #333a45", borderRadius: 8, padding: 14, width: "100%", maxWidth: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Nuova anomalia</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#6b7480" }}><X size={14} /></button>
      </div>
      <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Tipo di anomalia</label>
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: "100%", background: "#161a1f", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 5, padding: "6px 8px", fontSize: 12.5, marginBottom: 8 }}>
        {categorie.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
      </select>
      <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
        <p style={{ fontSize: 11.5, color: "#9aa4b2", margin: "0 0 6px 0", lineHeight: 1.4 }}>{info.descrizione}</p>
        <p style={{ fontSize: 11.5, color: "#ff8c42", margin: 0, lineHeight: 1.4 }}><strong>Azione consigliata:</strong> {info.azione}</p>
      </div>
      <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Gravità</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {SEVERITY.map((s) => (
          <button key={s.key} onClick={() => setGravita(s.key)} style={{ flex: 1, padding: "5px 0", borderRadius: 5, fontSize: 11, border: gravita === s.key ? `1px solid ${s.color}` : "1px solid #333a45", background: gravita === s.key ? s.color + "22" : "transparent", color: gravita === s.key ? s.color : "#8b95a3" }}>
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={() => onConfirm(categoria, gravita)} style={{ width: "100%", background: "linear-gradient(135deg, #ff9d5c, #e0552f)", color: "#161a1f", border: "none", padding: "7px 0", borderRadius: 5, fontWeight: 600, fontSize: 12.5 }}>Conferma</button>
    </div>
  );
}
