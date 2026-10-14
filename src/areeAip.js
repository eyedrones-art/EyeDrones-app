// Zone che D-Flight mostra sulla mappa ma NON mette nel file zone scaricabile (ED-269):
// le aree tattiche per l'attività militare a bassissima quota. Lì le operazioni UAS sono
// limitate a 45 m quando l'area è attiva (così le mostra D-Flight).
// Fonte: AIP Italia ENR 5.2.2.6 «Attività a bassissima quota di aeromobili militari», pag. 3-4
// (AIRAC 30 NOV 2023, ancora in vigore con l'edizione del 01 OCT 2026). Da ricontrollare ad ogni AIRAC.

export const FONTE_AREE_AIP = "AIP Italia ENR 5.2.2.6 (in vigore dal 30 nov 2023, verificata sull'edizione del 1° ott 2026)";

// confini: punti [lat, lon] in gradi e primi, come nell'AIP («to point of origin» = si richiude)
const g = (gradi, primi, secondi = 0) => gradi + primi / 60 + secondi / 3600;
const AREE_TATTICHE = [
  ["PIEMONTE", [[g(43, 55), g(7, 45)], [g(44, 20), g(7, 45)], [g(44, 40), g(8, 10)], [g(44, 35), g(8, 17)], [g(44, 30), g(8, 12)], [g(44, 19), g(8, 10)], [g(44, 24), g(8, 30)]]],
  ["EMILIA", [[g(44, 39), g(9, 0)], [g(45, 0), g(9, 12)], [g(44, 15), g(11, 0)], [g(44, 5), g(11, 0)], [g(44, 30), g(9, 32)], [g(44, 36), g(9, 30)]]],
  ["TOSCANA", [[g(43, 28), g(11, 0)], [g(43, 15), g(11, 18)], [g(43, 25), g(11, 35)], [g(42, 45), g(12, 0)], [g(42, 41), g(11, 38)], [g(42, 59), g(11, 18)], [g(43, 3), g(10, 49)], [g(43, 22), g(10, 33)], [g(43, 27), g(10, 38)]]],
  ["MARCHE NORD", [[g(44, 6), g(11, 27)], [g(44, 15), g(11, 45)], [g(43, 37), g(12, 50)], [g(43, 26), g(12, 40)], [g(43, 50), g(11, 45)]]],
  ["MOLISE", [[g(41, 48), g(14, 0)], [g(42, 2), g(14, 0)], [g(41, 53), g(15, 0)], [g(41, 35), g(15, 15)], [g(41, 24), g(15, 4)], [g(41, 41), g(14, 45)]]],
  ["BASILICATA", [[g(41, 0), g(16, 6)], [g(40, 51), g(15, 50)], [g(40, 42), g(15, 58)], [g(40, 35, 19), g(15, 55)], [g(40, 31, 3), g(15, 58, 16)], [g(40, 31, 34), g(16, 3, 6)], [g(40, 15, 39), g(16, 11, 51)], [g(40, 8, 23), g(16, 3, 41)], [g(40, 7, 17), g(15, 57, 15)], [g(39, 45), g(16, 6)], [g(39, 53), g(16, 24)], [g(40, 30), g(16, 40)], [g(40, 30), g(16, 22)], [g(40, 42), g(16, 25)]]],
  ["SICILIA NORD", [[g(37, 53), g(13, 25)], [g(37, 57), g(14, 45)], [g(37, 48), g(14, 43)], [g(37, 50), g(14, 15)], [g(37, 40), g(14, 0)], [g(37, 40), g(13, 15)]]],
  ["SICILIA SUD", [[g(37, 47), g(14, 36)], [g(37, 45), g(14, 50)], [g(37, 15), g(14, 30)], [g(37, 8), g(14, 5)], [g(37, 17), g(14, 2)], [g(37, 25), g(14, 23)]]],
];

// --- quando è attiva: lun-ven esclusi i festivi, 0600-2200 UTC (0500-2100 con l'ora legale) = 07-23 ora italiana

// Pasqua (calendario gregoriano, metodo di Meeus): serve per il Lunedì dell'Angelo
function pasqua(anno) {
  const a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - gg + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anno, mese - 1, giorno));
}

// festivi nazionali (AIP GEN 2.1): «AAAA-MM-GG»
export function festiviItalia(anno) {
  const fissi = ["01-01", "01-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"].map((x) => `${anno}-${x}`);
  const lunedi = new Date(pasqua(anno).getTime() + 86400000).toISOString().slice(0, 10);
  return new Set([...fissi, lunedi]);
}

// giorno, giorno della settimana e ora in Italia per un istante
function oraItaliana(data) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" })
    .formatToParts(data).map((x) => [x.type, x.value]));
  return { giorno: `${p.year}-${p.month}-${p.day}`, settimana: p.weekday, minuti: Number(p.hour) * 60 + Number(p.minute) };
}

// l'area tattica è attiva in quell'istante? (sul territorio: lun-ven non festivi, 07:00-23:00 ora italiana)
export function areaTatticaAttiva(data) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) return true; // senza data: la considero attiva
  const { giorno, settimana, minuti } = oraItaliana(data);
  if (settimana === "Sat" || settimana === "Sun") return false;
  if (festiviItalia(Number(giorno.slice(0, 4))).has(giorno)) return false;
  return minuti >= 7 * 60 && minuti < 23 * 60;
}

export const ORARIO_AREE_TATTICHE = "dal lunedì al venerdì, esclusi i festivi, dalle 7 alle 23 ora italiana";

// le aree nel formato delle zone dell'app (coordinate [lon, lat] come nel file D-Flight)
export const ZONE_AIP = AREE_TATTICHE.map(([nome, punti]) => {
  const anello = punti.map(([lat, lon]) => [lon, lat]);
  anello.push(anello[0]);
  const xs = anello.map((p) => p[0]), ys = anello.map((p) => p[1]);
  return {
    id: `AIP-TATTICA-${nome.replace(/\s+/g, "-")}`,
    nome: `AREA ${nome} · area militare a bassa quota`,
    codice: "",
    tipoUAS: "militare",
    restrizione: "CONDITIONAL",
    motivo: "MILITARY",
    altroMotivo: "",
    messaggio: `Operazioni UAS altezza max 45 m quando l'area è attiva. Attività di volo militare a bassissima quota ${ORARIO_AREE_TATTICHE}.`,
    condizioni: "",
    tipo: "AREA_TATTICA",
    limiti: null,
    autorita: [],
    validita: null,
    poligoni: [[anello]],
    cerchi: [],
    bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
    fonte: "AIP",
    areaTattica: true,
  };
});

// aggiunge le zone AIP all'archivio delle zone D-Flight (tolgo prima quelle vecchie: così si aggiornano con l'app)
export const conZoneAip = (zone) => (Array.isArray(zone) ? [...zone.filter((z) => !(z && z.fonte === "AIP")), ...ZONE_AIP] : zone);
