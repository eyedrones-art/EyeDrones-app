// Calcoli della SORA 2.0 (AMC1 all'art. 11 del Reg. UE 2019/947) e del NOTAM: tabelle e conti, senza interfaccia.
// È un aiuto per preparare la valutazione: i valori vanno controllati sulla versione della SORA che chiede ENAC.

// --- rischio a terra ---------------------------------------------------------------------------------------
// colonne della tabella del GRC intrinseco: dimensione caratteristica massima ed energia cinetica tipica
export const COLONNE_GRC = [
  { dim: 1, energia: 700, nome: "fino a 1 m (circa 3 ft), sotto 700 J" },
  { dim: 3, energia: 34000, nome: "fino a 3 m (circa 10 ft), sotto 34 kJ" },
  { dim: 8, energia: 1084000, nome: "fino a 8 m (circa 25 ft), sotto 1084 kJ" },
  { dim: Infinity, energia: Infinity, nome: "oltre 8 m o oltre 1084 kJ" },
];
export const SCENARI_TERRA = [
  { k: "controllata", nome: "Area a terra controllata (nessuna persona estranea)", valori: [1, 2, 3, 4], bvlos: [1, 2, 3, 4] },
  { k: "scarsa", nome: "Area scarsamente popolata (campagna)", valori: [2, 3, 4, 5], bvlos: [3, 4, 5, 6] },
  { k: "popolata", nome: "Area popolata (paesi, città)", valori: [4, 5, 6, 8], bvlos: [5, 6, 8, 10] },
  { k: "assembramento", nome: "Sopra un assembramento di persone", valori: [7, null, null, null], bvlos: [8, null, null, null] },
];
export const MITIGAZIONI = {
  m1: { nome: "M1 · Riduzione strategica del rischio a terra (area delimitata, persone tenute lontane, orari)", livelli: [["", "Nessuna", 0], ["bassa", "Bassa", -1], ["media", "Media", -2], ["alta", "Alta", -4]] },
  m2: { nome: "M2 · Riduzione degli effetti dell'impatto (es. paracadute)", livelli: [["", "Nessuna", 0], ["media", "Media", -1], ["alta", "Alta", -2]] },
  m3: { nome: "M3 · Piano di risposta alle emergenze (ERP)", livelli: [["", "Nessuno", 1], ["bassa", "Bassa", 1], ["media", "Media", 0], ["alta", "Alta", -1]] },
};

export const energiaCinetica = (massaKg, velocitaMs) => 0.5 * (Number(massaKg) || 0) * (Number(velocitaMs) || 0) ** 2;
export function colonnaGrc(dimensioneM, energiaJ) {
  const d = COLONNE_GRC.findIndex((c) => (Number(dimensioneM) || 0) <= c.dim);
  const e = COLONNE_GRC.findIndex((c) => energiaJ < c.energia);
  return Math.max(d < 0 ? 3 : d, e < 0 ? 3 : e);
}
export function grc({ dimensione, massa, velocita, scenario, bvlos, m1 = "", m2 = "", m3 = "" }) {
  const energia = energiaCinetica(massa, velocita);
  const col = colonnaGrc(dimensione, energia);
  const sc = SCENARI_TERRA.find((s) => s.k === scenario) || SCENARI_TERRA[1];
  const iniziale = (bvlos ? sc.bvlos : sc.valori)[col];
  if (iniziale == null) return { energia, col, iniziale: null, finale: null, certificata: true };
  const val = (k, liv) => (MITIGAZIONI[k].livelli.find((x) => x[0] === liv) || MITIGAZIONI[k].livelli[0])[2];
  let finale = iniziale + val("m1", m1) + val("m2", m2) + val("m3", m3);
  // il GRC finale non può scendere sotto quello dell'area controllata della stessa colonna
  finale = Math.max(finale, SCENARI_TERRA[0].valori[col]);
  return { energia, col, iniziale, finale, certificata: finale > 7 };
}

// --- rischio in aria (ARC iniziale, albero della SORA 2.0) ------------------------------------------------
export function arcIniziale({ atipico, aeroporto, classeAeroporto, oltre150, controllato, tmz, urbano }) {
  if (atipico) return "a";
  if (aeroporto) return ["B", "C", "D"].includes(classeAeroporto) ? "d" : "c";
  if (oltre150) return controllato ? "d" : "c";
  if (controllato || tmz || urbano) return "c";
  return "b";
}
const SAIL = { // righe: GRC finale 1-7, colonne: ARC a b c d
  1: ["I", "II", "IV", "VI"], 2: ["I", "II", "IV", "VI"], 3: ["II", "II", "IV", "VI"], 4: ["III", "III", "IV", "VI"],
  5: ["IV", "IV", "IV", "VI"], 6: ["V", "V", "V", "VI"], 7: ["VI", "VI", "VI", "VI"],
};
export const sail = (grcFinale, arc) => (grcFinale >= 1 && grcFinale <= 7 ? SAIL[grcFinale]["abcd".indexOf(arc)] : null);

// --- volumi: area di volo, contingenza e buffer per il rischio a terra (stima semplificata per multirotori) ---
export function volumi({ velocita, altezza, reazione = 1, gnss = 3 }) {
  const v = Number(velocita) || 0, h = Number(altezza) || 0;
  const frenata = (v * v) / (2 * 9.81); // arresto con assetto a 45°
  const contingenzaOrizz = Math.ceil(gnss + v * reazione + frenata);
  const contingenzaVert = Math.ceil(3 + 0.7 * v * reazione);
  const buffer = Math.ceil(h + contingenzaVert); // regola 1:1 per i multirotori
  return { contingenzaOrizz, contingenzaVert, buffer, frenata };
}

// --- NOTAM ------------------------------------------------------------------------------------------------
const pad = (n, l) => String(Math.floor(n)).padStart(l, "0");
export function coordNotam(lat, lon) {
  const parte = (v, gradiCifre) => { const a = Math.abs(v); const g = Math.floor(a); const mf = (a - g) * 60; let m = Math.floor(mf); let s = Math.round((mf - m) * 60); if (s === 60) { s = 0; m += 1; } return `${pad(g, gradiCifre)}${pad(m, 2)}${pad(s, 2)}`; };
  return `${parte(lat, 2)}${lat >= 0 ? "N" : "S"}${parte(lon, 3)}${lon >= 0 ? "E" : "W"}`;
}
// FIR italiane: al nord è Milano; al centro-sud i confini tra Roma e Brindisi non sono dritti, quindi la scelta resta al pilota
export function firSuggerita(lat) {
  return lat >= 44.2 ? "LIMM" : "";
}
export const FIR = [["LIMM", "Milano (nord)"], ["LIRR", "Roma (centro, Sardegna)"], ["LIBB", "Brindisi (sud, Sicilia)"]];
export const metriInNm = (m) => Math.max(0.1, Math.ceil((Number(m) / 1852) * 10) / 10);
export const piediAmsl = (quotaTerreno, altezza) => Math.ceil(((Number(quotaTerreno) || 0) + (Number(altezza) || 0)) * 3.28084 / 100) * 100;
// data e ora italiane → formato NOTAM in UTC (AAMMGGhhmm)
export function utcNotam(data, ora) {
  if (!data || !ora) return "";
  const d = new Date(`${data}T${ora}:00`);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad(d.getUTCFullYear() % 100, 2)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}${pad(d.getUTCHours(), 2)}${pad(d.getUTCMinutes(), 2)}`;
}
export const oraUtc = (data, ora) => { const t = utcNotam(data, ora); return t ? t.slice(6) : ""; };
export function testoNotam(n) {
  const coord = coordNotam(n.lat, n.lon);
  const piu = n.dataFine && n.dataFine !== n.dataInizio;
  const righe = [
    `A) ${n.fir}`,
    `B) ${utcNotam(n.dataInizio, n.oraInizio)}`,
    `C) ${utcNotam(n.dataFine || n.dataInizio, n.oraFine)}`,
    piu ? `D) DLY ${oraUtc(n.dataInizio, n.oraInizio)}-${oraUtc(n.dataInizio, n.oraFine)}` : null,
    `E) UAS OPS WI AREA RADIUS ${metriInNm(n.raggio).toFixed(1)}NM CENTRED ON ${coord}${n.luogo ? ` (${String(n.luogo).toUpperCase()})` : ""}.${n.attivita ? ` ${String(n.attivita).toUpperCase()}.` : ""}${n.operatore ? ` OPR: ${String(n.operatore).toUpperCase()}` : ""}${n.telefono ? ` TEL ${n.telefono}` : ""}`,
    "F) GND",
    `G) ${piediAmsl(n.quota, n.altezza)}FT AMSL`,
  ].filter(Boolean);
  return righe.join("\n");
}
