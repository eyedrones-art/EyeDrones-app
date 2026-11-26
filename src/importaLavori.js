// Importazione dei lavori agricoli da file esportati (DJI SmartFarm / DJI Agriculture, XAG, gestionali):
// CSV o Excel (.xlsx). Non conosco ogni formato: riconosco le colonne dal nome (italiano, inglese, cinese)
// e quelle che non riconosco le fa scegliere il pilota. Niente librerie nuove: l'xlsx è uno zip di XML.

const pulito = (s) => String(s ?? "").replace(/^﻿/, "").trim();

// --- CSV ---------------------------------------------------------------------------------------------
export function leggiCsv(testo) {
  const t = pulito(testo).replace(/\r\n?/g, "\n");
  const prima = t.split("\n").find((r) => r.trim()) || "";
  const sep = [";", "\t", ","].map((s) => [s, prima.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const righe = [];
  let riga = [], campo = "", tra = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (tra) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') tra = false; else campo += c;
    } else if (c === '"') tra = true;
    else if (c === sep) { riga.push(campo); campo = ""; }
    else if (c === "\n") { riga.push(campo); righe.push(riga); riga = []; campo = ""; }
    else campo += c;
  }
  if (campo || riga.length) { riga.push(campo); righe.push(riga); }
  return righe.map((r) => r.map(pulito));
}

// --- XLSX (primo foglio) -------------------------------------------------------------------------------
const colonnaIndice = (rif) => { const l = String(rif).match(/^[A-Z]+/)[0]; let n = 0; for (const ch of l) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
export async function leggiXlsx(byte) {
  const { iter } = await import("but-unzip");
  const file = {};
  for (const e of iter(byte)) {
    const nome = e.filename || e.name || "";
    if (/^xl\/(sharedStrings\.xml|workbook\.xml|worksheets\/sheet\d+\.xml|_rels\/workbook\.xml\.rels)$/.test(nome)) file[nome] = new TextDecoder().decode(await e.read());
  }
  const xml = (s) => new DOMParser().parseFromString(s, "application/xml");
  const condivise = file["xl/sharedStrings.xml"] ? [...xml(file["xl/sharedStrings.xml"]).getElementsByTagName("si")].map((si) => [...si.getElementsByTagName("t")].map((x) => x.textContent).join("")) : [];
  const foglio = Object.keys(file).filter((n) => /worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]))[0];
  if (!foglio) throw new Error("Nel file Excel non trovo nessun foglio.");
  const righe = [];
  for (const r of xml(file[foglio]).getElementsByTagName("row")) {
    const riga = [];
    for (const c of r.getElementsByTagName("c")) {
      const i = c.getAttribute("r") ? colonnaIndice(c.getAttribute("r")) : riga.length;
      const tipo = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0];
      let val = "";
      if (tipo === "s" && v) val = condivise[Number(v.textContent)] ?? "";
      else if (tipo === "inlineStr") val = [...c.getElementsByTagName("t")].map((x) => x.textContent).join("");
      else if (v) val = v.textContent;
      riga[i] = pulito(val);
    }
    righe.push(Array.from(riga, (x) => x ?? ""));
  }
  return righe;
}

export async function leggiTabella(file) {
  const nome = (file.name || "").toLowerCase();
  if (nome.endsWith(".xlsx")) return leggiXlsx(new Uint8Array(await file.arrayBuffer()));
  if (nome.endsWith(".xls")) throw new Error("Questo è il vecchio formato Excel (.xls): aprilo e salvalo come .xlsx o .csv, poi riprova.");
  return leggiCsv(await file.text());
}

// --- riconoscimento delle colonne ------------------------------------------------------------------------
export const CAMPI_IMPORT = [
  { k: "data", label: "Data", parole: ["data", "date", "giorno", "日期", "作业时间", "operation time", "start time", "inizio", "ora"] },
  { k: "ora_fine", label: "Ora di fine", parole: ["fine", "end time", "结束"] },
  { k: "ettari", label: "Superficie", parole: ["superficie", "area", "ettari", "ha", "acre", "mu", "面积", "亩"] },
  { k: "quantita", label: "Prodotto o miscela usata", parole: ["dosaggio", "dosage", "dose", "quantit", "litri", "volume", "consumo", "usage", "spray", "用量", "用药", "kg"] },
  { k: "campo", label: "Campo", parole: ["campo", "field", "plot", "appezzamento", "terreno", "parcella", "lotto", "地块", "田块", "name", "nome"] },
  { k: "pilota", label: "Pilota", parole: ["pilota", "pilot", "operatore", "operator", "飞手", "account", "utente", "user"] },
  { k: "drone", label: "Drone", parole: ["drone", "aircraft", "velivolo", "aeromobile", "uav", "sn", "serial", "nickname", "飞机", "无人机", "model", "modello"] },
  { k: "prodotto", label: "Prodotto (nome)", parole: ["prodotto", "product", "pesticide", "fitofarmaco", "farmaco", "concime", "seme", "药剂"] },
  { k: "durata", label: "Durata", parole: ["durata", "duration", "flight time", "tempo di volo", "时长"] },
];

const norma = (s) => pulito(s).toLowerCase();
export function trovaIntestazione(righe) {
  const i = righe.findIndex((r) => r.filter((x) => pulito(x)).length >= 3);
  return i < 0 ? 0 : i;
}
export function riconosciColonne(intestazione) {
  const usate = new Set();
  const mappa = {};
  // prima i campi con parole più precise, così «Pilot name» va al pilota e non al campo
  const ordine = ["pilota", "drone", "prodotto", "durata", "ora_fine", "quantita", "ettari", "data", "campo"];
  for (const campo of ordine.map((k) => CAMPI_IMPORT.find((c) => c.k === k))) {
    let migliore = -1, punti = 0;
    intestazione.forEach((h, i) => {
      if (usate.has(i)) return;
      const n = norma(h);
      // «Quantità prodotto (L)» è una quantità, non il nome del prodotto
      if (campo.k === "prodotto" && /quantit|litr|\(l\)|\bkg\b|dos|volume|consum|用量/.test(n)) return;
      for (const p of campo.parole) {
        const pp = p.toLowerCase();
        const ok = pp.length <= 3 ? new RegExp(`(^|[^a-z])${pp}([^a-z]|$)`).test(n) : n.includes(pp);
        if (ok && pp.length + 1 > punti) { migliore = i; punti = pp.length + 1; }
      }
    });
    if (migliore >= 0) { mappa[campo.k] = migliore; usate.add(migliore); }
  }
  return mappa;
}

// unità della superficie dall'intestazione: ettari, mu cinesi o acri
export function fattoreEttari(intestazione) {
  const n = norma(intestazione);
  if (/亩|\bmu\b/.test(n)) return 1 / 15;
  if (/acre/.test(n)) return 0.404686;
  if (/m2|m²|mq|metri quadr/.test(n)) return 0.0001;
  return 1;
}

export const numero = (v) => {
  let s = pulito(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

// data e ora da testo («2026-05-12 08:30», «12/05/2026 8:30») o numero di serie di Excel
export function dataOra(v) {
  const s = pulito(v);
  if (!s) return { data: null, ora: null };
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    const d = new Date(Math.round((n - 25569) * 86400000));
    const iso = d.toISOString();
    return { data: iso.slice(0, 10), ora: n % 1 ? iso.slice(11, 16) : null };
  }
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return { data: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`, ora: m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : null };
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) { const a = m[3].length === 2 ? `20${m[3]}` : m[3]; return { data: `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, ora: m[4] ? `${m[4].padStart(2, "0")}:${m[5]}` : null }; }
  m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return { data: null, ora: `${m[1].padStart(2, "0")}:${m[2]}` };
  return { data: null, ora: null };
}
