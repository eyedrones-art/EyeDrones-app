import { useEffect, useRef, useState } from "react";

// la testata della Home «in volo»: quattro foto a strati (lago, nebbia, pini, drone).
// Se muovi il telefono (o il mouse) gli strati vicini si spostano più di quelli lontani;
// se scorri, il drone sale e la camera vola in avanti. Niente re-render: solo transform via ref.
const STRATI = {
  sfondo: "/volo/sfondo.webp",
  nebbia: "/volo/nebbia.webp",
  primo: "/volo/primo-piano.webp",
  drone: "/volo/drone.webp",
};

const fermo = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches || localStorage.getItem("eyedrones_animazioni") === "no"; } catch { return false; }
};

export default function VoloHero({ data, titolo, sottotitolo, children }) {
  const radice = useRef(null);
  const sfondo = useRef(null), nebbia = useRef(null), primo = useRef(null), nebbia2 = useRef(null), drone = useRef(null), hud = useRef(null), alt = useRef(null), orizzonte = useRef(null), testo = useRef(null);
  const [chiedi, setChiedi] = useState(false);
  const stato = useRef({ x: 0, y: 0, tx: 0, ty: 0, p: 0, giro: 0 });

  useEffect(() => {
    if (fermo()) return undefined;
    const s = stato.current;
    const disegna = () => {
      s.giro = 0;
      // movimento morbido verso la posizione del telefono
      s.x += (s.tx - s.x) * 0.12; s.y += (s.ty - s.y) * 0.12;
      // telefono fermo: il drone «galleggia» da solo, piano (solo finché la testata si vede)
      const { p } = s;
      const t = performance.now() / 1000, fermoDa = t - (s.ultimo || 0);
      const galleggia = fermoDa > 2 && p < 1 ? Math.min(1, (fermoDa - 2) / 2) : 0;
      const x = s.x + galleggia * Math.sin(t * 0.55) * 0.35, y = s.y + galleggia * Math.sin(t * 0.8 + 1) * 0.4;
      const strato = (el, d, zoom, extra = "") => { if (el) el.style.transform = `translate3d(${(-x * 46 * d).toFixed(1)}px, ${(-y * 42 * d + p * 110 * d).toFixed(1)}px, 0) scale(${(1 + p * zoom).toFixed(3)})${extra}`; };
      strato(sfondo.current, 0.3, 0.2);
      strato(nebbia.current, 0.55, 0.7);
      strato(primo.current, 1, 1.7);
      if (primo.current) primo.current.style.opacity = String(Math.max(0, 1 - Math.max(0, p - 0.5) * 2.4));
      if (nebbia2.current) {
        nebbia2.current.style.transform = `translate3d(${(-x * 60).toFixed(1)}px, ${(-y * 36).toFixed(1)}px, 0) scale(${(1.6 + p * 3.5).toFixed(2)}) scaleX(-1)`;
        nebbia2.current.style.opacity = String(Math.max(0, Math.sin(p * Math.PI) * 0.8));
      }
      if (drone.current) drone.current.style.transform = `translate3d(${(x * 30).toFixed(1)}px, ${(-p * 260 + y * 26).toFixed(1)}px, 0) rotate(${(x * 9).toFixed(1)}deg) scale(${(1 - p * 0.5).toFixed(2)})`;
      if (hud.current) hud.current.style.opacity = String(Math.min(1, p * 2.4));
      if (alt.current) alt.current.textContent = String(Math.round(2 + p * 118));
      if (orizzonte.current) orizzonte.current.style.transform = `rotate(${(x * 14).toFixed(1)}deg)`;
      if (testo.current) { testo.current.style.opacity = String(Math.max(0, 1 - p * 1.5)); testo.current.style.transform = `translateY(${(-p * 60).toFixed(0)}px)`; }
      if (Math.abs(s.tx - s.x) > 0.002 || Math.abs(s.ty - s.y) > 0.002 || (p < 1 && !document.hidden)) chiama();
    };
    const chiama = () => { if (!s.giro) s.giro = requestAnimationFrame(disegna); };
    // scorrere: vale sia per la finestra sia per un contenitore che scorre
    const suScorri = () => {
      const r = radice.current && radice.current.getBoundingClientRect();
      if (!r) return;
      s.p = Math.max(0, Math.min(1, -r.top / (r.height * 0.85)));
      chiama();
    };
    const suInclina = (e) => {
      if (e.gamma == null) return;
      s.tx = Math.max(-1, Math.min(1, e.gamma / 25)); s.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 22));
      if (Math.abs(e.gamma) > 1.5 || Math.abs(e.beta - 45) > 1.5) s.ultimo = performance.now() / 1000;
      chiama();
    };
    const suMouse = (e) => {
      if (e.pointerType === "touch") return;
      s.tx = (e.clientX / window.innerWidth - 0.5) * 2; s.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      s.ultimo = performance.now() / 1000;
      chiama();
    };
    document.addEventListener("scroll", suScorri, { capture: true, passive: true });
    window.addEventListener("pointermove", suMouse, { passive: true });
    // su iPhone il giroscopio serve un tocco per il permesso; altrove parte da solo
    const ios = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
    if (ios) setChiedi(true); else window.addEventListener("deviceorientation", suInclina);
    s.suInclina = suInclina;
    suScorri();
    return () => {
      document.removeEventListener("scroll", suScorri, { capture: true });
      window.removeEventListener("pointermove", suMouse);
      window.removeEventListener("deviceorientation", suInclina);
      if (s.giro) cancelAnimationFrame(s.giro);
    };
  }, []);

  const permesso = () => {
    try {
      DeviceOrientationEvent.requestPermission().then((r) => {
        if (r === "granted") window.addEventListener("deviceorientation", stato.current.suInclina);
        setChiedi(false);
      }, () => setChiedi(false));
    } catch { setChiedi(false); }
  };

  const strato = { position: "absolute", left: "-14%", top: "-9%", width: "128%", height: "118%", objectFit: "cover", willChange: "transform", pointerEvents: "none" };
  return (
    <section ref={radice} className="volo-hero" aria-label="Benvenuto">
      <img ref={sfondo} src={STRATI.sfondo} alt="" style={strato} />
      <img ref={nebbia} src={STRATI.nebbia} alt="" style={{ ...strato, opacity: 0.5 }} />
      <img ref={primo} src={STRATI.primo} alt="" style={strato} />
      <img ref={nebbia2} src={STRATI.nebbia} alt="" style={{ ...strato, opacity: 0, transform: "scale(1.6) scaleX(-1)" }} />
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,8,16,.55) 0%, rgba(6,8,16,0) 24%, rgba(6,8,16,0) 46%, rgba(6,8,16,.78) 82%, rgba(6,8,16,.95) 100%)", pointerEvents: "none" }} />
      <img ref={drone} src={STRATI.drone} alt="" className="volo-drone" />
      <div ref={hud} aria-hidden="true" className="volo-hud" style={{ opacity: 0 }}>
        <div ref={orizzonte} className="volo-orizzonte" />
        <div className="volo-mirino" />
        <div className="volo-alt mono">ALT <span ref={alt}>2</span> M</div>
      </div>
      <div ref={testo} className="volo-testo">
        {data && <div className="mono volo-data">{data}</div>}
        <h1 className="volo-titolo">{titolo}</h1>
        {sottotitolo && <p className="volo-sotto">{sottotitolo}</p>}
        {children}
        {chiedi && <button type="button" onClick={permesso} className="volo-permesso mono">📱 Muovi il telefono</button>}
      </div>
    </section>
  );
}

export const STILE_VOLO = `
  .volo-hero { position: relative; overflow: hidden; border-radius: 22px; height: 440px; margin-bottom: 18px; background: #0a0d18; isolation: isolate; }
  .volo-drone { position: absolute; left: 50%; top: 38%; width: 170px; margin-left: -85px; pointer-events: none; will-change: transform; filter: drop-shadow(0 10px 18px rgba(0,0,0,.35)); }
  .volo-hud { position: absolute; inset: 0; pointer-events: none; }
  .volo-orizzonte { position: absolute; left: 25%; right: 25%; top: 46%; height: 1px; background: rgba(243,240,234,.55); }
  .volo-mirino { position: absolute; left: 50%; top: 46%; width: 26px; height: 26px; margin: -13px 0 0 -13px; border: 1px solid rgba(255,140,66,.9); border-radius: 50%; }
  .volo-alt { position: absolute; left: 16px; top: 46%; transform: translateY(-50%); font-size: 11px; letter-spacing: .14em; color: #f3f0ea; }
  .volo-testo { position: absolute; left: 0; right: 0; bottom: 0; padding: 22px 26px; will-change: transform, opacity; }
  .volo-data { font-size: 11.5px; letter-spacing: .16em; text-transform: uppercase; color: #ffb48f; }
  .volo-titolo { font-family: 'Archivo', 'IBM Plex Sans', sans-serif; font-stretch: 122%; font-weight: 900; font-size: 44px; line-height: .98; text-transform: uppercase; margin: 8px 0 0 0; letter-spacing: -.005em; color: #f6f2ec; text-shadow: 0 2px 18px rgba(0,0,0,.35); }
  .volo-sotto { color: #d9d2c7; font-size: 13px; margin: 8px 0 12px 0; }
  .volo-permesso { display: block; margin-top: 10px; background: rgba(10,13,24,.55); border: 1px solid rgba(243,240,234,.4); color: #f3f0ea; border-radius: 20px; padding: 8px 14px; font-size: 11px; letter-spacing: .12em; }
  @media (max-width: 680px) {
    .volo-hero { height: min(74vh, 620px); border-radius: 0 0 26px 26px; margin: -16px -16px 18px -16px; }
    .volo-titolo { font-size: 38px; }
    .volo-testo { padding: 20px 18px 22px; }
    .volo-drone { width: 150px; margin-left: -75px; }
  }
  @media (prefers-reduced-motion: reduce) { .volo-hud { display: none; } }
`;

// la testata delle pagine principali: foto sottile con il titolo grande, nello stile della Home.
// Scorrendo, la foto scende più piano del testo (profondità) e si avvicina un poco.
export function TestataPagina({ titolo, sigla, foto, sotto, children }) {
  const radice = useRef(null), img = useRef(null), testo = useRef(null);
  useEffect(() => {
    if (fermo()) return undefined;
    let giro = 0;
    const disegna = () => {
      giro = 0;
      const r = radice.current && radice.current.getBoundingClientRect();
      if (!r || !img.current) return;
      const p = Math.max(0, Math.min(1, -r.top / r.height));
      img.current.style.transform = `translate3d(0, ${(p * r.height * 0.45).toFixed(1)}px, 0) scale(${(1.06 + p * 0.12).toFixed(3)})`;
      if (testo.current) testo.current.style.opacity = String(1 - p * 1.2);
    };
    const chiama = () => { if (!giro) giro = requestAnimationFrame(disegna); };
    document.addEventListener("scroll", chiama, { capture: true, passive: true });
    chiama();
    return () => { document.removeEventListener("scroll", chiama, { capture: true }); if (giro) cancelAnimationFrame(giro); };
  }, []);
  return (
    <section ref={radice} className="testata-pagina">
      <img ref={img} src={foto} alt="" className="testata-foto" />
      <div aria-hidden="true" className="testata-velo" />
      <div ref={testo} className="testata-testo">
        {sigla && <div className="mono testata-sigla">{sigla}</div>}
        <h1 className="volo-titolo testata-titolo">{titolo}</h1>
        {sotto && <div className="mono testata-sotto">{sotto}</div>}
      </div>
      {children && <div className="testata-azioni">{children}</div>}
    </section>
  );
}

export const STILE_TESTATA = `
  .testata-pagina { position: relative; overflow: hidden; border-radius: 20px; min-height: 190px; margin-bottom: 16px; background: #0a0d18; display: flex; flex-direction: column; justify-content: flex-end; isolation: isolate; }
  .testata-foto { position: absolute; left: 0; top: -12%; width: 100%; height: 124%; object-fit: cover; transform: scale(1.06); will-change: transform; animation: testata-entra 1.4s cubic-bezier(.2,.8,.2,1) both; }
  .testata-velo { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,8,16,.3) 0%, rgba(6,8,16,.3) 30%, rgba(6,8,16,.93) 100%), linear-gradient(90deg, rgba(6,8,16,.55) 0%, rgba(6,8,16,0) 70%); }
  .testata-testo { position: relative; padding: 18px 20px 14px; }
  .testata-sigla { font-size: 11px; letter-spacing: .16em; color: #ffc4a6; text-shadow: 0 1px 6px rgba(0,0,0,.8); animation: testata-sale .7s .15s ease-out both; }
  .testata-titolo { font-size: 32px !important; margin-top: 4px !important; animation: testata-sale .8s .25s cubic-bezier(.2,.8,.2,1) both; }
  .testata-sotto { font-size: 11.5px; letter-spacing: .12em; color: #d9d2c7; margin-top: 8px; animation: testata-sale .7s .4s ease-out both; }
  .testata-azioni { position: relative; display: flex; gap: 8px; flex-wrap: wrap; padding: 0 20px 18px; animation: testata-sale .7s .5s ease-out both; }
  @keyframes testata-entra { from { opacity: 0; transform: scale(1.18); } to { opacity: 1; } }
  @keyframes testata-sale { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
  @media (max-width: 680px) { .testata-pagina { margin: -18px -16px 16px; border-radius: 0 0 22px 22px; min-height: 200px; } .testata-titolo { font-size: 30px !important; } }
  @media (prefers-reduced-motion: reduce) { .testata-foto, .testata-sigla, .testata-titolo, .testata-sotto, .testata-azioni { animation: none; } }
`;
