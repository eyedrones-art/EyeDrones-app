import React, { useEffect, useState } from "react";

// Piccola animazione di una manovra: a sinistra i due stick (modo 2), a destra il drone che fa il movimento,
// visto di lato o dall'alto. Gira in loop: 4 secondi di manovra e una breve pausa.

const DURATA = 4000, PAUSA = 700;
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const onda = (t) => Math.sin(Math.PI * t); // 0 → 1 → 0: stick che va e torna
const gradi = (a) => (a * Math.PI) / 180;
const SUOLO = 112;

// ogni manovra: vista ("lato" o "alto"), stick sinistro e destro [x, y] da -1 a 1 (y negativo = in avanti / su),
// drone {x, y, dir} (dir in gradi: 0 = verso destra), camera (gradi rispetto all'orizzonte, solo vista di lato),
// soggetti da disegnare, eventuale «mira» (la camera punta sempre lì) e scatti (foto)
const MANOVRE = {
  rivelazione: { vista: "lato", nota: "camera piano verso l'alto", s: () => [0, 0], d: () => [0, -0.35], camera: (t) => -60 + 60 * ease(t), drone: (t) => ({ x: 182 + 55 * ease(t), y: 74 }), soggetti: [{ tipo: "albero", x: 222 }, { tipo: "casa", x: 292 }] },
  allontanamento: { vista: "lato", s: () => [0, -0.5], d: () => [0, 0.5], drone: (t) => ({ x: 262 - 75 * ease(t), y: 92 - 50 * ease(t) }), mira: { x: 296, y: 102 }, soggetti: [{ tipo: "persona", x: 296 }] },
  orbita: { vista: "alto", s: () => [-0.5, 0], d: () => [0.6, 0], orbita: { cx: 240, cy: 66, r: 40 }, soggetti: [{ tipo: "casa-alto", x: 240, y: 66 }] },
  dallalto: { vista: "lato", nota: "camera tutta giù", s: () => [0, -0.5], d: () => [0, 0], camera: () => -90, drone: (t) => ({ x: 240, y: 92 - 52 * ease(t) }), soggetti: [{ tipo: "piscina", x: 240 }] },
  parallasse: { vista: "alto", s: () => [0, 0], d: () => [0.5, 0], drone: (t) => ({ x: 185 + 95 * ease(t), y: 104, dir: -90 }), soggetti: [{ tipo: "alberi-fila", y: 80 }, { tipo: "case-fila", y: 22 }] },
  salita: { vista: "lato", s: () => [0, -0.6], d: () => [0, 0], camera: () => 0, drone: (t) => ({ x: 222, y: 100 - 66 * ease(t) }), soggetti: [{ tipo: "torre", x: 286 }] },
  basso: { vista: "lato", s: () => [0, 0], d: () => [0, -0.6], camera: () => -8, drone: (t) => ({ x: 176 + 118 * ease(t), y: 103 }), soggetti: [{ tipo: "acqua" }] },
  hyperlapse: { vista: "lato", nota: "automatico: mani pronte sugli stick", s: () => [0, 0], d: () => [0, 0], camera: () => -12, drone: () => ({ x: 214, y: 58 }), soggetti: [{ tipo: "nuvole" }, { tipo: "casa", x: 292 }], scatti: 8 },
  "fpv-inseguimento": { vista: "alto", s: (t) => [0.25 * Math.sin(2 * Math.PI * t), 0], d: () => [0, -0.6], drone: (t) => ({ x: 240 + 12 * Math.sin(2 * Math.PI * t), y: 118 - 70 * t, dir: -90 }), soggetti: [{ tipo: "auto", segue: true }] },
  "fpv-passaggio": { vista: "lato", s: () => [0, 0], d: () => [0, -0.6], camera: () => 0, drone: (t) => ({ x: 172 + 134 * t, y: 92 }), soggetti: [{ tipo: "arco", x: 250 }] },
  "fpv-tuffo": { vista: "lato", s: () => [0, 0.4], d: () => [0, -0.15], camera: () => -55, drone: (t) => ({ x: 232 + 14 * ease(t), y: 14 + 80 * ease(t) }), soggetti: [{ tipo: "parete", x: 214 }] },
  "fpv-orbita-bassa": { vista: "alto", s: () => [-0.6, 0], d: () => [0.7, 0], orbita: { cx: 240, cy: 66, r: 28 }, soggetti: [{ tipo: "persona-alto", x: 240, y: 66 }] },
  "fpv-rivelazione": { vista: "lato", s: () => [0, -0.5], d: () => [0, -0.5], camera: () => 0, drone: (t) => ({ x: 182 + 100 * ease(t), y: 108 - 62 * ease(t) }), soggetti: [{ tipo: "muro", x: 214 }, { tipo: "casa", x: 296 }] },
  "foto-90": { vista: "lato", nota: "camera tutta giù", s: (t) => [0.5 * onda(t), 0], d: () => [0, 0], camera: () => -90, drone: () => ({ x: 240, y: 44 }), soggetti: [{ tipo: "piscina", x: 240 }], scatti: 1 },
  "foto-45": { vista: "lato", nota: "camera a metà (45°)", s: (t) => [0, -0.5 * Math.sin(2 * Math.PI * t)], d: () => [0, 0], camera: () => -45, drone: (t) => ({ x: 214, y: 58 - 18 * Math.sin(Math.PI * t) }), soggetti: [{ tipo: "casa", x: 286 }], scatti: 1 },
  "foto-pano": { vista: "alto", nota: "automatico: il drone ruota e scatta", s: () => [0, 0], d: () => [0, 0], drone: (t) => ({ x: 240, y: 66, dir: -90 + 360 * t }), soggetti: [{ tipo: "paesaggio" }], scatti: 6 },
  "foto-hdr": { vista: "lato", nota: "automatico: 3 o 5 scatti", s: () => [0, 0], d: () => [0, 0], camera: () => -20, drone: () => ({ x: 214, y: 56 }), soggetti: [{ tipo: "casa", x: 288 }, { tipo: "sole" }], scatti: 3 },
  "foto-altezze": { vista: "lato", s: (t) => [0, [0.05, 0.38, 0.71].some((a) => t > a && t < a + 0.2) ? -0.6 : 0], d: () => [0, 0], camera: () => -25, drone: (t) => ({ x: 214, y: 98 - 22 * Math.min(1, Math.max(0, (t - 0.05) / 0.2)) - 22 * Math.min(1, Math.max(0, (t - 0.38) / 0.2)) - 22 * Math.min(1, Math.max(0, (t - 0.71) / 0.2)) }), soggetti: [{ tipo: "casa", x: 288 }], scattiA: [0.3, 0.63, 0.96] },
};

export const haAnimazione = (id) => !!MANOVRE[id];

function Stick({ cx, v, etichetta }) {
  const [x, y] = v;
  const kx = cx + x * 18, ky = 64 + y * 18;
  const fermo = Math.abs(x) < 0.02 && Math.abs(y) < 0.02;
  return (
    <g>
      <rect x={cx - 24} y={40} width={48} height={48} rx={10} fill="#11151b" stroke="#333a45" />
      <line x1={cx} y1={44} x2={cx} y2={84} stroke="#262b33" />
      <line x1={cx - 20} y1={64} x2={cx + 20} y2={64} stroke="#262b33" />
      {!fermo && <line x1={cx} y1={64} x2={kx} y2={ky} stroke="#ff8c42" strokeWidth={3} strokeLinecap="round" />}
      <circle cx={kx} cy={ky} r={9} fill={fermo ? "#4b5563" : "#ff8c42"} stroke="#e7eaee" strokeWidth={1.5} />
      <text x={cx} y={100} textAnchor="middle" fontSize={9} fill="#c3cad4" fontWeight={700}>{etichetta[0]}</text>
      <text x={cx} y={110} textAnchor="middle" fontSize={7.5} fill="#8b95a3">{etichetta[1]}</text>
    </g>
  );
}

function Drone({ x, y, dir = 0, vista, camera, mira }) {
  // direzione del cono della camera
  let ang = vista === "alto" ? dir : camera ?? 0;
  if (mira) ang = (Math.atan2(mira.y - y, mira.x - x) * 180) / Math.PI;
  else if (vista === "lato") ang = -ang; // nella vista di lato il «giù» è verso il basso dello schermo
  const a1 = gradi(ang - 18), a2 = gradi(ang + 18), L = 46;
  const cono = `${x},${y} ${x + L * Math.cos(a1)},${y + L * Math.sin(a1)} ${x + L * Math.cos(a2)},${y + L * Math.sin(a2)}`;
  return (
    <g>
      <polygon points={cono} fill="#ffd166" opacity={0.22} />
      {vista === "alto" ? (
        <g transform={`translate(${x} ${y}) rotate(${dir + 90})`}>
          <line x1={-6} y1={-6} x2={6} y2={6} stroke="#e7eaee" strokeWidth={2} />
          <line x1={6} y1={-6} x2={-6} y2={6} stroke="#e7eaee" strokeWidth={2} />
          {[[-6, -6], [6, -6], [-6, 6], [6, 6]].map(([a, b]) => <circle key={a + "" + b} cx={a} cy={b} r={3.4} fill="none" stroke="#c4b5fd" strokeWidth={1.2} />)}
          <circle cx={0} cy={-3} r={1.6} fill="#ff8c42" />
        </g>
      ) : (
        <g>
          <rect x={x - 8} y={y - 2} width={16} height={4} rx={2} fill="#e7eaee" />
          <ellipse cx={x - 8} cy={y - 4} rx={5} ry={1.3} fill="#c4b5fd" />
          <ellipse cx={x + 8} cy={y - 4} rx={5} ry={1.3} fill="#c4b5fd" />
          <circle cx={x + (mira && mira.x < x ? -4 : 4)} cy={y + 3} r={1.8} fill="#ff8c42" />
        </g>
      )}
    </g>
  );
}

function Soggetto({ s, t, vista }) {
  const verde = "#2f6b45", grigio = "#5b6472", mattone = "#8a5a44";
  switch (s.tipo) {
    case "casa": return <g><rect x={s.x - 13} y={SUOLO - 20} width={26} height={20} fill={mattone} /><polygon points={`${s.x - 16},${SUOLO - 20} ${s.x},${SUOLO - 33} ${s.x + 16},${SUOLO - 20}`} fill="#b45309" /></g>;
    case "albero": return <g><rect x={s.x - 2} y={SUOLO - 14} width={4} height={14} fill="#6b4f2a" /><circle cx={s.x} cy={SUOLO - 24} r={12} fill={verde} /></g>;
    case "persona": return <g><circle cx={s.x} cy={SUOLO - 17} r={3.5} fill="#f5d0a9" /><line x1={s.x} y1={SUOLO - 13} x2={s.x} y2={SUOLO - 4} stroke="#3d8bfd" strokeWidth={3} /><line x1={s.x} y1={SUOLO - 4} x2={s.x - 3} y2={SUOLO} stroke="#e7eaee" strokeWidth={1.5} /><line x1={s.x} y1={SUOLO - 4} x2={s.x + 3} y2={SUOLO} stroke="#e7eaee" strokeWidth={1.5} /></g>;
    case "torre": return <g><rect x={s.x - 8} y={SUOLO - 62} width={16} height={62} fill={grigio} />{[0, 1, 2, 3].map((i) => <rect key={i} x={s.x - 3} y={SUOLO - 55 + i * 14} width={6} height={6} fill="#ffd166" opacity={0.7} />)}</g>;
    case "piscina": return <g><rect x={s.x - 22} y={SUOLO - 3} width={44} height={3} fill="#38bdf8" /><text x={s.x} y={SUOLO + 10} textAnchor="middle" fontSize={7} fill="#8b95a3">soggetto sotto</text></g>;
    case "acqua": return <rect x={164} y={SUOLO} width={152} height={14} fill="#1e5a7a" />;
    case "arco": return <path d={`M ${s.x - 18} ${SUOLO} L ${s.x - 18} ${SUOLO - 26} A 18 18 0 0 1 ${s.x + 18} ${SUOLO - 26} L ${s.x + 18} ${SUOLO} L ${s.x + 10} ${SUOLO} L ${s.x + 10} ${SUOLO - 26} A 10 10 0 0 0 ${s.x - 10} ${SUOLO - 26} L ${s.x - 10} ${SUOLO} Z`} fill={grigio} />;
    case "parete": return <polygon points={`164,10 ${s.x},10 ${s.x + 10},${SUOLO} 164,${SUOLO}`} fill="#57534e" />;
    case "muro": return <rect x={s.x - 4} y={SUOLO - 22} width={8} height={22} fill={grigio} />;
    case "nuvole": { const dx = (t * 60) % 160; return <g opacity={0.8}>{[[180, 22], [250, 14], [300, 28]].map(([x, y], i) => <ellipse key={i} cx={164 + ((x - 164 + dx) % 152)} cy={y} rx={14} ry={5} fill="#cbd5e1" />)}</g>; }
    case "sole": return <circle cx={300} cy={20} r={8} fill="#ffd166" />;
    case "casa-alto": return <g><rect x={s.x - 10} y={s.y - 10} width={20} height={20} fill="#b45309" /><line x1={s.x - 10} y1={s.y} x2={s.x + 10} y2={s.y} stroke="#7c2d12" /></g>;
    case "persona-alto": return <g><circle cx={s.x} cy={s.y} r={4} fill="#3d8bfd" /><circle cx={s.x} cy={s.y} r={2} fill="#f5d0a9" /></g>;
    case "alberi-fila": return <g>{[180, 210, 240, 270, 300].map((x) => <circle key={x} cx={x} cy={s.y} r={7} fill={verde} />)}<text x={168} y={s.y + 16} fontSize={7} fill="#8b95a3">vicino</text></g>;
    case "case-fila": return <g>{[185, 225, 265, 300].map((x) => <rect key={x} x={x - 7} y={s.y - 6} width={14} height={12} fill={mattone} opacity={0.7} />)}<text x={168} y={s.y + 16} fontSize={7} fill="#8b95a3">lontano</text></g>;
    case "auto": { const y = 118 - 70 * t - 24; return <g><rect x={234 + 12 * Math.sin(2 * Math.PI * t)} y={y - 7} width={12} height={16} rx={3} fill="#ef4444" /></g>; }
    case "paesaggio": return <g>{[[190, 30], [290, 40], [200, 105], [295, 100]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={9} fill={verde} />)}<rect x={260} y={70} width={30} height={14} fill="#1e5a7a" /></g>;
    default: return null;
  }
}

export default function AnimazioneManovra({ id }) {
  const m = MANOVRE[id];
  const [p, setP] = useState(0);
  useEffect(() => {
    if (!m) return undefined;
    let raf, inizio = performance.now();
    const passo = (ora) => { setP(Math.min(1, ((ora - inizio) % (DURATA + PAUSA)) / DURATA)); raf = requestAnimationFrame(passo); };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [id]);
  if (!m) return null;
  const inMovimento = p > 0 && p < 1;
  const sv = inMovimento ? m.s(p) : [0, 0];
  const dv = inMovimento ? m.d(p) : [0, 0];
  let dr;
  if (m.orbita) { const a = gradi(-90 + 300 * ease(p)); dr = { x: m.orbita.cx + m.orbita.r * Math.cos(a), y: m.orbita.cy + m.orbita.r * Math.sin(a) }; dr.dir = (Math.atan2(m.orbita.cy - dr.y, m.orbita.cx - dr.x) * 180) / Math.PI; }
  else dr = m.drone(p);
  const camera = m.camera ? m.camera(p) : 0;
  const scatto = m.scattiA ? m.scattiA.some((a) => Math.abs(p - a) < 0.03) : m.scatti ? inMovimento && (p * m.scatti) % 1 < 0.08 : false;
  return (
    <svg viewBox="0 0 320 130" style={{ width: "100%", maxWidth: 420, display: "block", background: "#0f1318", border: "1px solid #2b313d", borderRadius: 8, marginTop: 6 }} role="img" aria-label="Animazione della manovra">
      <rect x={4} y={4} width={154} height={122} rx={10} fill="#171c24" />
      <text x={81} y={20} textAnchor="middle" fontSize={8.5} fill="#8b95a3">🕹️ radiocomando (modo 2)</text>
      {m.camera && camera !== 0 && <text x={81} y={32} textAnchor="middle" fontSize={8} fill="#ffd166">📷 camera {camera <= -85 ? "dritta giù" : camera < -5 ? `giù ${Math.round(-camera)}°` : "dritta avanti"}</text>}
      <Stick cx={44} v={sv} etichetta={["Sinistro", "sali · ruota"]} />
      <Stick cx={118} v={dv} etichetta={["Destro", "avanti · di lato"]} />
      {m.nota && <text x={81} y={122} textAnchor="middle" fontSize={7.5} fill="#c4b5fd">{m.nota}</text>}
      <rect x={164} y={4} width={152} height={122} rx={8} fill={m.vista === "alto" ? "#1a2a1f" : "#16202c"} />
      <text x={170} y={14} fontSize={7.5} fill="#8b95a3">{m.vista === "alto" ? "visto dall'alto" : "visto di lato"}</text>
      {m.vista === "lato" && !m.soggetti.some((s) => s.tipo === "acqua") && <rect x={164} y={SUOLO} width={152} height={14} fill="#24331f" />}
      <defs><clipPath id={`scena-${id}`}><rect x={164} y={4} width={152} height={122} rx={8} /></clipPath></defs>
      <g clipPath={`url(#scena-${id})`}>
        {m.soggetti.map((s, i) => <Soggetto key={i} s={s} t={p} vista={m.vista} />)}
        <Drone {...dr} vista={m.vista} camera={camera} mira={m.mira} />
        {scatto && <circle cx={dr.x} cy={dr.y} r={14} fill="#fff" opacity={0.55} />}
      </g>
    </svg>
  );
}
