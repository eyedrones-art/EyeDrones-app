import { useEffect, useState } from "react";

// Elio, il pilota a cartone col cappello DRONE: compare solo in pochi punti (l'esperto e i primi passi).
// Si spegne da Impostazioni (eyedrones_elio = "no"). I disegni sono SVG scritti qui, niente immagini da scaricare.

const OCCHI = {
  aperti: (dx = 0, dy = 0, k = 1) => [-58, 58].map((x) => `
    <ellipse cx="${x}" cy="8" rx="${34 * k}" ry="${44 * k}" fill="#fff"/>
    <circle cx="${x + dx}" cy="${14 + dy}" r="${21 * Math.min(k, 1.05)}" fill="#3b2416"/>
    <circle cx="${x + dx}" cy="${14 + dy}" r="${12 * Math.min(k, 1.05)}" fill="#120a06"/>
    <circle cx="${x + dx + 8}" cy="${4 + dy}" r="7" fill="#fff"/><circle cx="${x + dx - 6}" cy="${22 + dy}" r="3" fill="#fff"/>`).join(""),
  chiusiFelici: () => [-58, 58].map((x) => `<path d="M${x - 30} 18 Q${x} -16 ${x + 30} 18" stroke="#3b2416" stroke-width="11" fill="none" stroke-linecap="round"/>`).join(""),
  mezzi: (dy = 0) => [-58, 58].map((x) => `
    <ellipse cx="${x}" cy="12" rx="34" ry="34" fill="#fff"/><circle cx="${x}" cy="${20 + dy}" r="19" fill="#3b2416"/><circle cx="${x}" cy="${20 + dy}" r="11" fill="#120a06"/>
    <circle cx="${x + 7}" cy="${12 + dy}" r="6" fill="#fff"/>
    <path d="M${x - 38} 2 Q${x} -26 ${x + 38} 2 L${x + 38} -30 L${x - 38} -30 Z" fill="var(--pelle)"/>
    <path d="M${x - 36} 0 Q${x} -22 ${x + 36} 0" stroke="#3b2416" stroke-width="5" fill="none"/>`).join(""),
};
const SOPRACCIGLIA = {
  normali: `<path d="M-90 -48 Q-58 -64 -26 -50" /><path d="M26 -50 Q58 -64 90 -48"/>`,
  su: `<path d="M-90 -62 Q-58 -80 -26 -66"/><path d="M26 -66 Q58 -80 90 -62"/>`,
  preoccupate: `<path d="M-90 -44 Q-60 -52 -28 -70"/><path d="M28 -70 Q60 -52 90 -44"/>`,
  arrabbiate: `<path d="M-90 -64 Q-60 -58 -28 -42"/><path d="M28 -42 Q60 -58 90 -64"/>`,
  una: `<path d="M-90 -50 Q-58 -60 -26 -50"/><path d="M26 -66 Q58 -82 90 -60"/>`,
};
const BOCCHE = {
  sorriso: `<path d="M-46 66 Q0 104 46 66" stroke="#5a2a1a" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  risata: `<path d="M-54 58 Q0 58 54 58 Q50 120 0 122 Q-50 120 -54 58 Z" fill="#6b1f1f"/><path d="M-30 100 Q0 86 30 100 Q20 120 0 120 Q-20 120 -30 100 Z" fill="#ff7f8a"/><path d="M-50 60 L50 60 L46 72 L-46 72 Z" fill="#fff"/>`,
  dritta: `<path d="M-30 78 L30 78" stroke="#5a2a1a" stroke-width="9" stroke-linecap="round"/>`,
  storta: `<path d="M-34 84 Q-6 70 34 76" stroke="#5a2a1a" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  giu: `<path d="M-40 90 Q0 62 40 90" stroke="#5a2a1a" stroke-width="9" fill="none" stroke-linecap="round"/>`,
  onda: `<path d="M-40 82 q10 -12 20 0 t20 0 t20 0 t20 0" stroke="#5a2a1a" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  o: `<ellipse cx="0" cy="84" rx="20" ry="26" fill="#6b1f1f"/>`,
  denti: `<rect x="-44" y="64" width="88" height="34" rx="16" fill="#fff" stroke="#5a2a1a" stroke-width="7"/><path d="M-22 64 V98 M0 64 V98 M22 64 V98" stroke="#5a2a1a" stroke-width="4"/>`,
};
const ESPR = {
  felice: { o: OCCHI.aperti(), s: "normali", b: "risata", guance: .55 },
  contento: { o: OCCHI.chiusiFelici(), s: "su", b: "risata", guance: .7 },
  neutro: { o: OCCHI.aperti(), s: "normali", b: "dritta", guance: .2 },
  pensieroso: { o: OCCHI.aperti(14, -10), s: "una", b: "storta", guance: .15 },
  preoccupato: { o: OCCHI.aperti(0, -4, 1.05), s: "preoccupate", b: "giu", guance: .1, goccia: true },
  seccato: { o: OCCHI.mezzi(4), s: "arrabbiate", b: "storta", guance: 0 },
  imbarazzato: { o: OCCHI.aperti(-16, 8), s: "preoccupate", b: "onda", guance: 1, goccia: true },
  sorpreso: { o: OCCHI.aperti(0, 0, 1.18), s: "su", b: "o", guance: .3 },
  sollevato: { o: OCCHI.chiusiFelici(), s: "su", b: "sorriso", guance: .5 },
  festa: { o: OCCHI.chiusiFelici(), s: "su", b: "risata", guance: .9 },
  oops: { o: OCCHI.aperti(10, -6, 1.12), s: "su", b: "denti", guance: .8, goccia: true },
  scusa: { o: OCCHI.chiusiFelici(), s: "preoccupate", b: "sorriso", guance: .9 },
};

function faccia(e, { pelle, conBaffi = false, occhiali = false }) {
  const x = ESPR[e];
  return `<g style="--pelle:${pelle}">
    <ellipse cx="-80" cy="66" rx="30" ry="18" fill="#ff7b8a" opacity="${x.guance}"/><ellipse cx="80" cy="66" rx="30" ry="18" fill="#ff7b8a" opacity="${x.guance}"/>
    ${x.o}
    <g stroke="#3b2416" stroke-width="10" fill="none" stroke-linecap="round">${SOPRACCIGLIA[x.s]}</g>
    <path d="M-6 30 Q-14 50 0 54 Q10 54 10 48" stroke="#c98b66" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${conBaffi ? `<path d="M-62 62 Q-30 40 0 58 Q30 40 62 62 Q30 70 0 64 Q-30 70 -62 62 Z" fill="#cfcfcf"/>` : ""}
    ${BOCCHE[x.b]}
    ${occhiali ? `<g fill="none" stroke="#2c3440" stroke-width="7"><circle cx="-58" cy="12" r="46"/><circle cx="58" cy="12" r="46"/><path d="M-12 8 Q0 0 12 8"/></g>` : ""}
    ${x.goccia ? `<path d="M128 -60 Q148 -26 128 -14 Q108 -26 128 -60 Z" fill="#7cc4ff" stroke="#3d8bfd" stroke-width="3"/>` : ""}
  </g>`;
}

// il pilota: cappello arancione con DRONE, felpa blu. braccia: "giu", "su" (festa), "telefono"
function pilota(espr, { braccia = "giu" } = {}) {
  const pelle = "#f2c29b";
  const brac = braccia === "su"
    ? `<path d="M-120 250 Q-210 120 -190 20" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/><circle cx="-190" cy="10" r="40" fill="${pelle}"/>
       <path d="M120 250 Q210 120 190 20" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/><circle cx="190" cy="10" r="40" fill="${pelle}"/>`
    : braccia === "telefono"
      ? `<path d="M-120 260 Q-150 360 -40 330" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/>
         <rect x="-40" y="250" width="80" height="140" rx="16" fill="#1b2028" stroke="#2c3440" stroke-width="6"/><rect x="-30" y="262" width="60" height="110" rx="8" fill="#3d8bfd" opacity=".7"/>
         <circle cx="-30" cy="330" r="36" fill="${pelle}"/>`
      : braccia === "radio"
        ? `<path d="M-120 260 Q-170 380 -80 360" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/><path d="M120 260 Q170 380 80 360" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/>
           <rect x="-110" y="300" width="220" height="110" rx="40" fill="#5b6370" stroke="#3a4049" stroke-width="6"/><circle cx="-55" cy="345" r="18" fill="#2c3440"/><circle cx="55" cy="345" r="18" fill="#2c3440"/>
           <rect x="-40" y="230" width="80" height="80" rx="10" fill="#1b2028"/><rect x="-32" y="238" width="64" height="58" rx="6" fill="#7ec8f2"/>
           <circle cx="-95" cy="370" r="34" fill="${pelle}"/><circle cx="95" cy="370" r="34" fill="${pelle}"/>`
      : `<path d="M-130 250 Q-170 360 -150 440" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/><path d="M130 250 Q170 360 150 440" stroke="#3d5a99" stroke-width="64" fill="none" stroke-linecap="round"/>`;
  return `<g class="pers">
    <path d="M-170 560 Q-180 260 0 230 Q180 260 170 560 Z" fill="#3d5a99"/>
    <path d="M-60 238 Q0 300 60 238" fill="#2f4a82"/>
    ${brac}
    <rect x="-40" y="150" width="80" height="90" rx="30" fill="#e3ad84"/>
    <ellipse cx="-150" cy="20" rx="30" ry="42" fill="${pelle}"/><ellipse cx="150" cy="20" rx="30" ry="42" fill="${pelle}"/>
    <ellipse cx="0" cy="10" rx="155" ry="168" fill="${pelle}"/>
    <path d="M-150 -10 Q-160 -70 -120 -90 L-120 -40 Z M150 -10 Q160 -70 120 -90 L120 -40 Z" fill="#5a3a24"/>
    <path d="M-158 -70 Q-150 -210 0 -214 Q150 -210 158 -70 Z" fill="#ff7a3d"/>
    <path d="M-170 -76 Q0 -110 170 -76 Q190 -60 170 -50 Q0 -80 -170 -50 Q-190 -60 -170 -76 Z" fill="#e0552f"/>
    <circle cx="0" cy="-212" r="14" fill="#e0552f"/>
    <text x="0" y="-118" text-anchor="middle" font-family="DejaVu Sans,Arial" font-weight="800" font-size="50" fill="#fff" letter-spacing="4">DRONE</text>
    <g class="volto">${faccia(espr, { pelle })}</g>
  </g>`;
}


const CHIAVE_ELIO = "eyedrones_elio";
export const elioAcceso = () => { try { return localStorage.getItem(CHIAVE_ELIO) !== "no"; } catch { return true; } };
export const accendiElio = (si) => {
  try { if (si) localStorage.removeItem(CHIAVE_ELIO); else localStorage.setItem(CHIAVE_ELIO, "no"); } catch { /* niente */ }
  window.dispatchEvent(new Event("eyedrones-elio"));
};
// per nascondere Elio subito, in tutte le pagine aperte, quando lo spegni
export function useElio() {
  const [acceso, setAcceso] = useState(elioAcceso);
  useEffect(() => {
    const aggiorna = () => setAcceso(elioAcceso());
    window.addEventListener("eyedrones-elio", aggiorna);
    return () => window.removeEventListener("eyedrones-elio", aggiorna);
  }, []);
  return acceso;
}

// solo la testa col cappello (per i riquadri piccoli); intero = anche busto e braccia
export default function Elio({ espr = "felice", size = 56, intero = false, braccia = "giu" }) {
  const vb = intero ? "-230 -260 460 680" : "-190 -250 380 440";
  return (
    <span className="elio" aria-hidden="true" style={{ display: "inline-block", width: size, height: intero ? size * 680 / 460 : size * 440 / 380, flex: "none", lineHeight: 0 }}>
      <svg viewBox={vb} width="100%" height="100%" dangerouslySetInnerHTML={{ __html: pilota(ESPR[espr] ? espr : "felice", { braccia }) }} />
    </span>
  );
}

// Elio che parla: la testa e un fumetto accanto
export function ElioDice({ espr, children, size = 52, style }) {
  return (
    <div className="elio-dice" style={{ display: "flex", gap: 10, alignItems: "flex-end", ...style }}>
      <Elio espr={espr} size={size} />
      <div className="elio-fumetto">{children}</div>
    </div>
  );
}

export const STILE_ELIO = `
  .elio svg { animation: elio-respira 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
  .elio-fumetto { position: relative; flex: 1; min-width: 0; background: #f3f0ea; color: #10141f; border-radius: 14px 14px 14px 4px; padding: 9px 12px; font-size: 13px; line-height: 1.4; animation: elio-fumetto .35s cubic-bezier(.3,1.4,.5,1) both; }
  .elio-fumetto b, .elio-fumetto strong { color: #10141f; }
  @keyframes elio-respira { 50% { transform: translateY(-2px) scale(1.015); } }
  @keyframes elio-fumetto { from { opacity: 0; transform: scale(.85); transform-origin: 0 100%; } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { .elio svg, .elio-fumetto { animation: none; } }
`;
