import { useEffect, useRef, useState } from "react";

// il menu rotondo: un radar al centro e le funzioni principali in cerchio.
// Tocchi un cerchio: l'anello gira per portarlo in alto, si accende e la pagina si apre da lì.

const fermo = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches || localStorage.getItem("eyedrones_animazioni") === "no"; } catch { return false; }
};

export default function MenuRotondo({ voci, onScegli }) {
  const [sel, setSel] = useState(-1);
  const [rot, setRot] = useState(0);
  const [apre, setApre] = useState(false);
  const tempi = useRef([]);
  useEffect(() => () => tempi.current.forEach(clearTimeout), []);
  // fino a 8 cerchi: quando aggiungiamo una funzione nuova basta metterla nella lista
  const lista = voci.slice(0, 8);
  const PASSO = 360 / lista.length;

  const tocca = (i) => {
    if (sel === i && apre) return;
    if (fermo()) { onScegli(lista[i]); return; }
    // gira dalla parte più corta
    let dest = -i * PASSO;
    while (dest - rot > 180) dest -= 360;
    while (dest - rot < -180) dest += 360;
    setSel(i); setRot(dest); setApre(false);
    tempi.current.forEach(clearTimeout);
    tempi.current = [
      setTimeout(() => setApre(true), 620),
      setTimeout(() => onScegli(lista[i]), 1080),
    ];
  };

  return (
    <div className="mr" aria-label="Funzioni principali">
      <svg className="mr-anelli" viewBox="0 0 300 300" aria-hidden="true">
        <g className="mr-giro1"><circle cx="150" cy="150" r="146" fill="none" stroke="#9fb4d9" strokeOpacity=".2" strokeDasharray="1 7" /></g>
        <g className="mr-giro2">
          <circle cx="150" cy="150" r="104" fill="none" stroke="#9fb4d9" strokeOpacity=".16" />
          <path d="M150 46 A104 104 0 0 1 240 98" fill="none" stroke="#ff8c42" strokeOpacity=".75" strokeWidth="2" strokeLinecap="round" />
          <path d="M60 202 A104 104 0 0 1 46 150" fill="none" stroke="#cfe3ff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
      <div className="mr-radar" aria-hidden="true"><div className="mr-scia" /></div>
      <div className="mr-onda" aria-hidden="true" />
      <div className="mr-centro mono" aria-live="polite">{sel >= 0 ? lista[sel].sigla : "MENU"}</div>

      <div className="mr-ruota" style={{ transform: `rotate(${rot}deg)` }}>
        {lista.map((v, i) => {
          const Icona = v.icon;
          const on = i === sel;
          return (
            <div key={v.key} className="mr-posto" style={{ transform: `rotate(${i * PASSO}deg) translateY(-128px) rotate(${-i * PASSO}deg)` }}>
              <div className="mr-dritto" style={{ transform: `rotate(${-rot}deg)` }}>
                {/* all'apertura i cerchi escono dal radar uno dopo l'altro */}
                <div className="mr-esce" style={{ animationDelay: `${120 + i * 55}ms`, "--da-x": `${(-Math.sin((i * PASSO) * Math.PI / 180) * 128).toFixed(0)}px`, "--da-y": `${(Math.cos((i * PASSO) * Math.PI / 180) * 128).toFixed(0)}px` }}>
                  <button type="button" onClick={() => tocca(i)} className={`mr-cerchio${on ? " on" : ""}`} aria-label={v.label}>
                    {Icona ? <Icona size={21} strokeWidth={1.8} /> : <span className="mono">{v.sigla}</span>}
                    {v.nuovo && <span className="mr-nuovo mono">NEW</span>}
                  </button>
                  <span className={`mr-etichetta${on ? " on" : ""}`}>{v.corto || v.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mr-apri${apre ? " on" : ""}`} aria-hidden="true" />
    </div>
  );
}

export const STILE_MENU_ROTONDO = `
  .mr { position: relative; width: 300px; height: 300px; margin: 26px auto 40px; }
  .mr-anelli { position: absolute; inset: -14px; width: calc(100% + 28px); height: calc(100% + 28px); }
  .mr-giro1 { transform-origin: 150px 150px; animation: mr-gira 40s linear infinite; }
  .mr-giro2 { transform-origin: 150px 150px; animation: mr-gira 26s linear infinite reverse; }
  .mr-radar { position: absolute; left: 95px; top: 95px; width: 110px; height: 110px; border-radius: 50%; overflow: hidden; background: radial-gradient(circle, #1d2640 0%, #111628 70%); border: 1px solid rgba(207,227,255,.25); }
  .mr-scia { position: absolute; inset: 0; background: conic-gradient(from 0deg, rgba(255,140,66,0) 0deg, rgba(255,140,66,0) 300deg, rgba(255,140,66,.38) 360deg); animation: mr-gira 6s linear infinite; }
  .mr-onda { position: absolute; left: 95px; top: 95px; width: 110px; height: 110px; border-radius: 50%; border: 1px solid rgba(255,140,66,.5); animation: mr-pulsa 2.8s ease-out infinite; pointer-events: none; }
  .mr-centro { position: absolute; left: 95px; top: 95px; width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; font-size: 12px; letter-spacing: .18em; color: #ff8c42; pointer-events: none; }
  .mr-ruota { position: absolute; inset: 0; transition: transform .7s cubic-bezier(.2,.8,.2,1); }
  .mr-posto { position: absolute; left: 150px; top: 150px; width: 0; height: 0; }
  .mr-dritto { position: absolute; left: -29px; top: -29px; width: 58px; display: flex; flex-direction: column; align-items: center; transition: transform .7s cubic-bezier(.2,.8,.2,1); }
  .mr-esce { display: flex; flex-direction: column; align-items: center; animation: mr-esce .55s cubic-bezier(.2,.9,.3,1.2) both; }
  .mr-nuovo { position: absolute; top: -4px; right: -8px; font-size: 8.5px; letter-spacing: .08em; background: #ff8c42; color: #140b06; border-radius: 6px; padding: 1px 4px; }
  .mr-cerchio { position: relative; width: 58px; height: 58px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #eef1f6; background: rgba(17,21,33,.9); border: 1px solid rgba(207,227,255,.3); transition: transform .45s ease, background .45s ease, box-shadow .45s ease, color .45s ease; }
  .mr-cerchio.on { background: #ff8c42; color: #140b06; border-color: #ff8c42; transform: scale(1.2); box-shadow: 0 0 26px rgba(255,140,66,.65); }
  .mr-cerchio:focus-visible { outline: 2px solid #ff8c42; outline-offset: 4px; }
  .mr-etichetta { margin-top: 6px; font-size: 11.5px; font-weight: 700; white-space: nowrap; color: #eef1f6; transition: color .4s; }
  .mr-etichetta.on { color: #ff8c42; }
  .mr-apri { position: fixed; inset: 0; z-index: 5; background: #0b0e16; clip-path: circle(0px at 50% 30%); transition: clip-path .5s cubic-bezier(.5,0,.2,1); pointer-events: none; }
  .mr-apri.on { clip-path: circle(150% at 50% 30%); }
  @keyframes mr-gira { to { transform: rotate(360deg); } }
  @keyframes mr-esce { from { opacity: 0; transform: translate(var(--da-x), var(--da-y)) scale(.2); } to { opacity: 1; transform: none; } }
  @keyframes mr-pulsa { from { transform: scale(1); opacity: .55; } to { transform: scale(1.9); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .mr-giro1, .mr-giro2, .mr-scia, .mr-onda, .mr-esce { animation: none; } .mr-ruota, .mr-dritto, .mr-apri { transition: none; } }
`;
