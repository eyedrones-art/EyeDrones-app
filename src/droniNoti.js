// Droni più diffusi: resistenza al vento dichiarata dal costruttore (m/s, dal manuale) e classe UE dove è sicura.
// Serve a compilare da solo il «vento massimo» quando il pilota scrive il modello: lo può sempre cambiare.
// Dal più specifico al più generico: «Mini 4 Pro» va controllato prima di «Mini 4».
const DRONI = [
  ["Mini 4 Pro", /mini\s*4\s*pro/, 10.7, "C0"],
  ["Mini 4K", /mini\s*4\s*k/, 10.7],
  ["Mini 3 Pro", /mini\s*3\s*pro/, 10.7, "C0"],
  ["Mini 3", /mini\s*3\b/, 10.7, "C0"],
  ["Mini 2 SE", /mini\s*2\s*se/, 10.7],
  ["Mini 2", /mini\s*2\b/, 8.5],
  ["Mini SE", /mini\s*se\b/, 8],
  ["Neo", /\bneo\b/, 8, "C0"],
  ["Flip", /\bflip\b/, 10.7, "C0"],
  ["Air 3S", /air\s*3\s*s\b/, 12, "C1"],
  ["Air 3", /air\s*3\b/, 12, "C1"],
  ["Air 2S", /air\s*2\s*s\b/, 10.7],
  ["Mavic 3 Classic", /mavic\s*3\s*classic/, 12, "C1"],
  ["Mavic 3 Pro", /mavic\s*3\s*pro/, 12],
  ["Mavic 3 Enterprise", /mavic\s*3\s*(enterprise|e\b|t\b|thermal|m\b)/, 12],
  ["Mavic 3", /mavic\s*3\b/, 12],
  ["Mavic 4 Pro", /mavic\s*4/, 12],
  ["Avata 2", /avata\s*2/, 10.7, "C1"],
  ["Avata", /avata\b/, 10.7],
  ["DJI FPV", /dji\s*fpv/, 13.8],
  ["Matrice 30", /(matrice|\bm)\s*30/, 15],
  ["Matrice 4", /(matrice|\bm)\s*4\s*(e|t|td)?\b/, 12],
  ["Matrice 350 RTK", /(matrice|\bm)\s*350/, 12],
];

// i nomi corti (Neo, Flip) valgono solo se c'è anche «DJI», per non confonderli con droni di altre marche
const SOLO_CON_DJI = ["Neo", "Flip"];

export function droneNoto(...testi) {
  const t = testi.filter(Boolean).join(" ").toLowerCase();
  if (!t.trim()) return null;
  for (const [nome, re, ms, classe] of DRONI) {
    if (!re.test(t)) continue;
    if (SOLO_CON_DJI.includes(nome) && !/dji/.test(t)) continue;
    return { nome: nome.startsWith("DJI") ? nome : `DJI ${nome}`, ms, kmh: Math.round(ms * 3.6), classe: classe || null };
  }
  return null;
}
