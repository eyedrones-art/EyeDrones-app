// Report di consegna per il cliente: rilievo fotogrammetrico e lavori agricoli.
// PDF A4 con logo, mappa dell'area, dati del lavoro, file consegnati, note e firma.
import { jsPDF } from "jspdf";

const dataIt = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const numIt = (n, cifre = 2) => {
  const v = Number(String(n ?? "").replace(",", "."));
  return n == null || n === "" || Number.isNaN(v) ? String(n ?? "") : v.toLocaleString("it-IT", { maximumFractionDigits: cifre });
};

// --- Mappa: aree (anelli [[lat, lon], ...]) disegnate su satellite o strade, pronta per il PDF --------------

const TESSERE = {
  satellite: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  strade: (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
};

export async function mappaAree(aree, { larghezza = 1000, altezza = 620, sfondo = "satellite" } = {}) {
  const tutti = aree.flatMap((a) => a.punti || []);
  if (tutti.length < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = larghezza; canvas.height = altezza;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#dfe3e8"; ctx.fillRect(0, 0, larghezza, altezza);
  const mx = (lon, s) => ((lon + 180) / 360) * s;
  const my = (lat, s) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s; };
  const la = tutti.map((p) => p[0]), lo = tutti.map((p) => p[1]);
  // lo zoom più alto in cui tutto sta nel riquadro, con un margine
  let z = 19;
  for (; z > 3; z--) {
    const s = 256 * 2 ** z;
    if (mx(Math.max(...lo), s) - mx(Math.min(...lo), s) < larghezza * 0.8 && my(Math.min(...la), s) - my(Math.max(...la), s) < altezza * 0.8) break;
  }
  const s = 256 * 2 ** z;
  const cx = (mx(Math.min(...lo), s) + mx(Math.max(...lo), s)) / 2, cy = (my(Math.min(...la), s) + my(Math.max(...la), s)) / 2;
  const x0 = cx - larghezza / 2, y0 = cy - altezza / 2;
  let tessere = 0;
  const url = TESSERE[sfondo] || TESSERE.satellite;
  const attese = [];
  for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + larghezza) / 256); tx++) {
    for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + altezza) / 256); ty++) {
      attese.push(new Promise((ok) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const t = setTimeout(ok, 7000);
        img.onload = () => { clearTimeout(t); ctx.drawImage(img, tx * 256 - x0, ty * 256 - y0); tessere++; ok(); };
        img.onerror = () => { clearTimeout(t); ok(); };
        img.src = url(z, ((tx % 2 ** z) + 2 ** z) % 2 ** z, ty);
      }));
    }
  }
  await Promise.all(attese);
  const px = ([lat, lon]) => [mx(lon, s) - x0, my(lat, s) - y0];
  aree.forEach((a) => {
    if (!a.punti || a.punti.length < 3) return;
    ctx.beginPath();
    a.punti.forEach((p, i) => { const [x, y] = px(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.closePath();
    ctx.fillStyle = a.riempi || "rgba(46,160,90,0.25)"; ctx.fill();
    ctx.lineWidth = a.spessore || 3; ctx.strokeStyle = a.colore || "#2e7d32"; ctx.stroke();
  });
  // etichette dei campi, al centro di ognuno
  ctx.font = "bold 15px sans-serif"; ctx.textAlign = "center";
  aree.forEach((a) => {
    if (!a.etichetta || !a.punti?.length) return;
    const [x, y] = px([a.punti.reduce((t, p) => t + p[0], 0) / a.punti.length, a.punti.reduce((t, p) => t + p[1], 0) / a.punti.length]);
    const w = ctx.measureText(a.etichetta).width + 10;
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(x - w / 2, y - 12, w, 19);
    ctx.fillStyle = "#111"; ctx.fillText(a.etichetta, x, y + 2);
  });
  ctx.textAlign = "left";
  // scala
  const mpp = (156543.03392 * Math.cos((((Math.min(...la) + Math.max(...la)) / 2) * Math.PI) / 180)) / 2 ** z;
  const passi = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const m = passi.find((v) => v / mpp >= 90) || 5000;
  ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(10, altezza - 36, m / mpp + 24, 26);
  ctx.fillStyle = "#111"; ctx.fillRect(22, altezza - 19, m / mpp, 4);
  ctx.font = "bold 12px sans-serif"; ctx.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, 22, altezza - 23);
  ctx.font = "11px sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(larghezza - 200, altezza - 16, 200, 16);
  ctx.fillStyle = "#333"; ctx.fillText(sfondo === "strade" ? "© OpenStreetMap contributors" : "Immagini © Esri, Maxar, Earthstar", larghezza - 194, altezza - 4);
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.86), conSfondo: tessere > 0 };
}

// --- Struttura comune del PDF ---------------------------------------------------------------------------

function nuovoDoc({ azienda, titolo, sottotitolo }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const grigio = [110, 120, 130];
  const st = { doc, y: 18 };
  st.spazio = (h) => { if (st.y + h > 278) { doc.addPage(); st.y = 18; } };
  st.titolo = (t) => { st.spazio(16); st.y += 3; doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(20, 20, 20); doc.text(t, 15, st.y); doc.setFont("helvetica", "normal"); st.y += 2; doc.setDrawColor(225, 225, 225); doc.line(15, st.y, 195, st.y); st.y += 6; };
  st.riga = (label, val) => {
    if (val == null || val === "") return;
    const righe = doc.splitTextToSize(String(val), 122);
    st.spazio(righe.length * 4.6 + 2);
    doc.setFontSize(9.5); doc.setTextColor(...grigio); doc.text(String(label), 15, st.y);
    doc.setTextColor(20, 20, 20); doc.text(righe, 70, st.y);
    st.y += Math.max(6, righe.length * 4.6 + 1.4);
  };
  st.paragrafo = (t, colore = [40, 40, 40], dim = 9.5) => {
    if (!t) return;
    const r = doc.splitTextToSize(String(t), 180);
    st.spazio(r.length * 4.6 + 2);
    doc.setFontSize(dim); doc.setTextColor(...colore); doc.text(r, 15, st.y); st.y += r.length * 4.6 + 2;
  };
  st.immagine = (dataUrl, didascalia, rapporto = 0.62) => {
    if (!dataUrl) return;
    const w = 180, h = Math.min(150, w * rapporto);
    st.spazio(h + 10);
    try { doc.addImage(dataUrl, dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG", 15, st.y, w, h, undefined, "FAST"); } catch { return; }
    st.y += h + 4;
    if (didascalia) { doc.setFontSize(8.5); doc.setTextColor(...grigio); doc.text(didascalia, 15, st.y); st.y += 5; }
  };
  st.firma = ({ pilota, attestato }) => {
    st.spazio(34);
    st.y += 8;
    doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
    doc.text(`Luogo e data: ____________________`, 15, st.y);
    doc.text(`Il pilota / operatore`, 125, st.y);
    st.y += 6;
    doc.setTextColor(...grigio);
    if (pilota) doc.text(pilota, 125, st.y);
    if (attestato) doc.text(attestato, 125, st.y + 5);
    st.y += 14;
    doc.setDrawColor(150, 150, 150); doc.line(125, st.y, 195, st.y);
    st.y += 4;
  };
  st.chiudi = (pieDiPagina) => {
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(150, 150, 150);
      doc.text(`${pieDiPagina} — pagina ${i} di ${n}`, 15, 290);
      doc.text("Preparato con EyeDrones · app.eyedrones.it", 195, 290, { align: "right" });
    }
    return doc;
  };

  // intestazione
  if (azienda?.logo) { try { doc.addImage(azienda.logo, azienda.logo.startsWith("data:image/jp") ? "JPEG" : "PNG", 15, 10, 26, 16, undefined, "FAST"); st.y = 34; } catch { /* logo non valido */ } }
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(20, 20, 20); doc.text(titolo, 15, st.y); doc.setFont("helvetica", "normal"); st.y += 6;
  doc.setFontSize(10); doc.setTextColor(...grigio);
  doc.splitTextToSize(sottotitolo, 180).forEach((r) => { doc.text(r, 15, st.y); st.y += 5; });
  return st;
}

// --- Rilievo fotogrammetrico ---------------------------------------------------------------------------

export const FILE_RILIEVO = [
  "Ortofoto (GeoTIFF)", "Modello digitale della superficie – DSM (GeoTIFF)", "Modello digitale del terreno – DTM (GeoTIFF)",
  "Nuvola di punti (LAS/LAZ)", "Modello 3D (OBJ)", "Curve di livello (DXF/SHP)", "Report di elaborazione del software (PDF)", "Foto originali",
];

export const SISTEMI_RIFERIMENTO = [
  "ETRF2000 (RDN2008) · UTM 32N – EPSG:6707", "ETRF2000 (RDN2008) · UTM 33N – EPSG:6708", "WGS84 · UTM 32N – EPSG:32632", "WGS84 · UTM 33N – EPSG:32633",
  "Gauss-Boaga Monte Mario · Fuso Ovest – EPSG:3003", "Gauss-Boaga Monte Mario · Fuso Est – EPSG:3004", "WGS84 geografiche – EPSG:4326",
];

// d = dati del form (vedi ReportConsegnaRilievo in App.jsx)
export async function pdfConsegnaRilievo({ volo, d, azienda, drone, area, immagini = [] }) {
  const st = nuovoDoc({
    azienda,
    titolo: "Relazione di consegna — Rilievo fotogrammetrico",
    sottotitolo: [d.cliente ? `Cliente: ${d.cliente}` : null, volo.luogo, `rilievo del ${dataIt(volo.data)}`, `${azienda?.nome || ""}`].filter(Boolean).join(" · "),
  });
  if (d.oggetto) st.paragrafo(d.oggetto);

  st.titolo("1. Il lavoro");
  st.riga("Cliente", d.cliente);
  st.riga("Luogo", volo.luogo);
  st.riga("Coordinate", volo.coordinate_gps);
  st.riga("Data del rilievo", `${dataIt(volo.data)}${volo.ora ? ` · ore ${String(volo.ora).slice(0, 5)}` : ""}`);
  st.riga("Area rilevata", d.area_ha ? `${numIt(d.area_ha)} ha` : "");
  if (area && area.length >= 3) {
    const mappa = await mappaAree([{ punti: area, colore: "#ffb020", riempi: "rgba(255,176,32,0.18)" }]);
    if (mappa) st.immagine(mappa.dataUrl, mappa.conSfondo ? "Area del rilievo" : "Area del rilievo (mappa di sfondo non disponibile)");
  }

  st.titolo("2. Acquisizione");
  st.riga("Drone", [drone?.nome, drone?.modello].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || volo.drone_nome);
  st.riga("Camera", d.camera);
  st.riga("Altezza di volo", d.altezza ? `${d.altezza} m dal suolo${d.segue_terreno ? " (volo che segue il terreno)" : ""}` : "");
  st.riga("Dettaglio (GSD)", d.gsd ? `${String(d.gsd).replace(".", ",")} cm/pixel` : "");
  st.riga("Sovrapposizione", d.frontale || d.laterale ? `frontale ${d.frontale || "—"}% · laterale ${d.laterale || "—"}%` : "");
  st.riga("Foto acquisite", d.foto);
  st.riga("Voli / batterie", d.voli);
  st.riga("Condizioni", d.condizioni);

  st.titolo("3. Georeferenziazione e precisione");
  st.riga("Sistema di riferimento", d.sistema);
  st.riga("Quote", d.quote);
  st.riga("Metodo", d.metodo);
  st.riga("Punti di controllo (GCP)", d.gcp);
  st.riga("Punti di verifica", d.verifica);
  st.riga("Precisione ottenuta", [d.precisione ? `${String(d.precisione).replace(".", ",")} cm` : null, d.rmse_xy ? `RMSE planimetrico ${String(d.rmse_xy).replace(".", ",")} cm` : null, d.rmse_z ? `RMSE in quota ${String(d.rmse_z).replace(".", ",")} cm` : null].filter(Boolean).join(" · "));
  st.riga("Elaborazione", d.software);

  st.titolo("4. File consegnati");
  const files = [...(d.files || []), ...String(d.altri_file || "").split("\n").map((x) => x.trim()).filter(Boolean)];
  if (files.length) files.forEach((f, i) => st.riga(i === 0 ? "Elenco" : "", `• ${f}`));
  else st.paragrafo("—");
  st.riga("Dove scaricarli", d.link);
  st.riga("Disponibili fino al", d.scadenza_link ? dataIt(d.scadenza_link) : "");

  immagini.forEach((img, i) => { if (i === 0) st.titolo("5. Anteprima"); st.immagine(img.dataUrl, img.didascalia, img.rapporto); });

  st.titolo(immagini.length ? "6. Note e limiti" : "5. Note e limiti");
  st.paragrafo(d.note || "Le precisioni indicate valgono per l'area coperta dai punti di controllo. I prodotti sono adatti agli usi concordati con il cliente; per usi diversi (es. progettazione esecutiva, frazionamenti) va verificata l'idoneità con un tecnico abilitato.");
  st.firma({ pilota: d.pilota || azienda?.nome, attestato: d.attestato });
  return st.chiudi(`Relazione di consegna · ${volo.luogo || ""} · ${dataIt(volo.data)}`);
}

// --- Agricoltura: lavori in campo per un'azienda -------------------------------------------------------

export async function pdfConsegnaAgricoltura({ lavori, campi, azienda, cliente, periodo, note, pilota, attestato }) {
  const ordinati = [...lavori].sort((a, b) => `${a.data} ${a.ora_inizio || ""}`.localeCompare(`${b.data} ${b.ora_inizio || ""}`));
  const idCampi = new Set(ordinati.map((t) => t.appezzamento_id).filter(Boolean));
  const campiUsati = campi.filter((c) => idCampi.has(c.id));
  const st = nuovoDoc({
    azienda,
    titolo: "Relazione di consegna — Lavori in campo",
    sottotitolo: [cliente ? `Cliente: ${cliente}` : null, periodo, azienda?.nome].filter(Boolean).join(" · "),
  });

  // riepilogo
  const ettari = ordinati.reduce((s, t) => s + (Number(t.ettari) || 0), 0);
  const perTipo = ordinati.reduce((m, t) => { m[t.tipo] = (m[t.tipo] || 0) + 1; return m; }, {});
  st.titolo("1. Riepilogo");
  st.riga("Interventi", `${ordinati.length}${Object.keys(perTipo).length ? ` (${Object.entries(perTipo).map(([k, n]) => `${n} ${etichetta(k)}`).join(", ")})` : ""}`);
  st.riga("Superficie lavorata", `${numIt(ettari)} ha (somma degli interventi)`);
  st.riga("Campi", campiUsati.length ? campiUsati.map((c) => `${c.nome}${c.ettari ? ` (${numIt(c.ettari)} ha)` : ""}`).join(", ") : [...new Set(ordinati.map((t) => t.campo_nome).filter(Boolean))].join(", "));
  st.riga("Periodo", ordinati.length ? `dal ${dataIt(ordinati[0].data)} al ${dataIt(ordinati[ordinati.length - 1].data)}` : "");
  const prodotti = [...new Set(ordinati.map((t) => t.prodotto).filter(Boolean))];
  st.riga("Prodotti usati", prodotti.join(", "));

  // mappa dei campi
  const aree = campiUsati.flatMap((c) => {
    const g = c.confini;
    const poligoni = !g ? [] : g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return poligoni.map((p, i) => ({ punti: p[0].map(([lon, lat]) => [lat, lon]), colore: "#4ade80", riempi: "rgba(74,222,128,0.22)", etichetta: i === 0 ? c.nome : null }));
  });
  if (aree.length) {
    const mappa = await mappaAree(aree);
    if (mappa) st.immagine(mappa.dataUrl, mappa.conSfondo ? "Campi lavorati" : "Campi lavorati (mappa di sfondo non disponibile)");
  }

  st.titolo("2. Interventi");
  ordinati.forEach((t) => {
    st.spazio(30);
    st.doc.setFont("helvetica", "bold"); st.doc.setFontSize(10); st.doc.setTextColor(20, 20, 20);
    st.doc.text(`${dataIt(t.data)}${t.ora_inizio ? ` · ${String(t.ora_inizio).slice(0, 5)}${t.ora_fine ? `–${String(t.ora_fine).slice(0, 5)}` : ""}` : ""} · ${etichetta(t.tipo)} · ${t.campo_nome || "campo"}`, 15, st.y);
    st.doc.setFont("helvetica", "normal"); st.y += 6;
    st.riga("Coltura", [t.coltura, t.avversita ? `bersaglio: ${t.avversita}` : null].filter(Boolean).join(" · "));
    st.riga("Prodotto", `${t.prodotto || ""}${t.registrazione ? ` (n. reg. ${t.registrazione})` : ""}`);
    st.riga("Dose", [t.dose != null ? `${numIt(t.dose)} ${t.unita || ""}` : null, t.volume_ha != null ? `miscela ${numIt(t.volume_ha)} l/ha` : null, t.quantita_totale != null ? `totale ${numIt(t.quantita_totale)} ${(t.unita || "").split("/")[0]}` : null].filter(Boolean).join(" · "));
    st.riga("Superficie", t.ettari != null ? `${numIt(t.ettari)} ha` : "");
    st.riga("Meteo", [t.vento_kmh != null ? `vento ${t.vento_kmh} km/h${t.direzione_vento ? ` da ${t.direzione_vento}` : ""}` : null, t.temperatura != null ? `${t.temperatura} °C` : null, t.umidita != null ? `umidità ${t.umidita}%` : null].filter(Boolean).join(" · "));
    st.riga("Operatore · drone", [t.operatore, t.drone_nome].filter(Boolean).join(" · "));
    st.riga("Note", t.note);
    st.y += 2;
  });

  st.titolo("3. Note");
  st.paragrafo(note || "I dati meteo sono misurati sul posto o, dove indicato, ricavati dalla previsione per il centro del campo. Le dosi riportate sono quelle impostate per il lavoro.");
  st.firma({ pilota: pilota || azienda?.nome, attestato });
  return st.chiudi(`Relazione lavori in campo${cliente ? ` · ${cliente}` : ""}`);
}

const ETICHETTE_LAVORO = { trattamento: "trattamento", concimazione: "concimazione", semina: "semina", rilievo: "rilievo / mappatura", altro: "altro lavoro" };
const etichetta = (k) => ETICHETTE_LAVORO[k] || k || "lavoro";
