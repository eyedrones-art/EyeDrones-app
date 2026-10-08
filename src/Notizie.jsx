import React, { useEffect, useState } from "react";

// Notizie dal mondo droni, a cura di DronEzine (partner): gli articoli arrivano dalla funzione Netlify
// notizie-dronezine, che legge il feed del loro sito. Una copia resta sul telefono, così si vedono anche senza rete.
const INDIRIZZO = "/.netlify/functions/notizie-dronezine";
const CHIAVE = "eyedrones_notizie_dronezine";
const DURATA = 60 * 60 * 1000; // un'ora
const SITO = "https://www.dronezine.it";
const UTM = "utm_source=eyedrones&utm_medium=app&utm_campaign=partner";

const conUtm = (link) => link + (link.includes("?") ? "&" : "?") + UTM;
const leggiCopia = () => { try { return JSON.parse(localStorage.getItem(CHIAVE) || "null"); } catch { return null; } };

let inCorso = null;
async function caricaNotizie() {
  const copia = leggiCopia();
  if (copia && Date.now() - copia.quando < DURATA) return copia.articoli;
  if (!inCorso) {
    inCorso = fetch(INDIRIZZO)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("notizie"))))
      .then((d) => {
        const articoli = Array.isArray(d.articoli) ? d.articoli : [];
        if (articoli.length > 0) { try { localStorage.setItem(CHIAVE, JSON.stringify({ quando: Date.now(), articoli })); } catch { /* niente */ } }
        return articoli;
      })
      .catch(() => (copia ? copia.articoli : []))
      .finally(() => { inCorso = null; });
  }
  return inCorso;
}

function useNotizie() {
  const [articoli, setArticoli] = useState(() => leggiCopia()?.articoli || null);
  useEffect(() => {
    let annullato = false;
    // sul telefono la prima richiesta può fallire (rete lenta o appena riaperta): riprovo un paio di volte
    let tentativi = 0, timer = null;
    const prova = () => caricaNotizie().then((a) => {
      if (annullato) return;
      if (a.length > 0 || tentativi >= 2) { setArticoli((prima) => (a.length > 0 ? a : prima && prima.length ? prima : a)); return; }
      tentativi += 1; timer = setTimeout(prova, 4000 * tentativi);
    });
    prova();
    return () => { annullato = true; clearTimeout(timer); };
  }, []);
  return articoli;
}

const quando = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const giorni = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (giorni <= 0) return "oggi";
  if (giorni === 1) return "ieri";
  if (giorni < 7) return `${giorni} giorni fa`;
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
};

// logo di DronEzine (blu e rosso): sullo sfondo scuro dell'app va su una targhetta bianca, colori originali
function Marchio({ altezza = 22 }) {
  return (
    <a href={conUtm(SITO)} target="_blank" rel="noreferrer" aria-label="DronEzine, la prima rivista italiana sui droni" style={{ display: "inline-flex", alignItems: "center", background: "#ffffff", borderRadius: 6, padding: "4px 8px", lineHeight: 0, verticalAlign: "middle" }}>
      <img src="/partner/dronezine-logo.png" alt="DronEzine" style={{ height: altezza, width: "auto", display: "block" }} />
    </a>
  );
}

// riquadro piccolo in Home: solo l'ultimo articolo
export function UltimaNotizia({ onTutte }) {
  const articoli = useNotizie();
  const a = articoli && articoli[0];
  // il riquadro di DronEzine c'è sempre: se le notizie non arrivano, porta al loro sito
  if (!a) {
    return (
      <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 12, padding: "12px 14px", marginBottom: 18, maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#8b95a3" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>📰 Notizie da <Marchio altezza={18} /></span>
          {onTutte && <button type="button" onClick={onTutte} style={{ background: "none", border: "none", color: "#3d8bfd", fontSize: 12, padding: "6px 0", minHeight: 32 }}>Tutte ›</button>}
        </div>
        <a href={conUtm(SITO)} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", color: "#e7eaee" }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{articoli === null ? "Carico le ultime notizie…" : "Le ultime notizie dal mondo droni"}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "#6b7480", marginTop: 3 }}>la prima rivista italiana sui droni · leggi su DronEzine ↗</span>
        </a>
      </div>
    );
  }
  return (
    <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 12, padding: "12px 14px", marginBottom: 18, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 12, color: "#8b95a3" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>📰 Ultima notizia da <Marchio altezza={18} /></span>
        {onTutte && <button type="button" onClick={onTutte} style={{ background: "none", border: "none", color: "#3d8bfd", fontSize: 12, padding: "6px 0", minHeight: 32 }}>Tutte ›</button>}
      </div>
      <a href={conUtm(a.link)} target="_blank" rel="noreferrer" style={{ display: "flex", gap: 12, alignItems: "center", textDecoration: "none", color: "#e7eaee" }}>
        {a.immagine && <img src={a.immagine} alt="" loading="lazy" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 6, flex: "none", background: "#262b33" }} />}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{a.titolo}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "#6b7480", marginTop: 3 }}>{quando(a.data)} · leggi su DronEzine ↗</span>
        </span>
      </a>
    </div>
  );
}

// scheda «Notizie» in Impara: gli ultimi 10 articoli
export default function Notizie() {
  const articoli = useNotizie();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>📰 Notizie dal mondo droni</div>
          <div style={{ fontSize: 12.5, color: "#8b95a3", marginTop: 2 }}>a cura di DronEzine, la prima rivista italiana sui droni. Gli articoli si aprono sul loro sito.</div>
        </div>
        <Marchio altezza={34} />
      </div>
      {articoli === null && <p style={{ fontSize: 12.5, color: "#8b95a3", margin: 0 }}>Carico le notizie…</p>}
      {articoli && articoli.length === 0 && (
        <p style={{ fontSize: 12.5, color: "#8b95a3", margin: 0 }}>
          In questo momento le notizie non si caricano. Le trovi sul sito di <a href={conUtm(SITO)} target="_blank" rel="noreferrer" style={{ color: "#3d8bfd" }}>DronEzine ↗</a>
        </p>
      )}
      {articoli && articoli.map((a) => (
        <a key={a.link} href={conUtm(a.link)} target="_blank" rel="noreferrer" style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#1b2028", border: "1px solid #262b33", borderRadius: 10, padding: 10, textDecoration: "none", color: "#e7eaee" }}>
          {a.immagine && <img src={a.immagine} alt="" loading="lazy" style={{ width: 96, height: 72, objectFit: "cover", borderRadius: 6, flex: "none", background: "#262b33" }} />}
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>{a.titolo}</span>
            {a.riassunto && <span style={{ fontSize: 12, color: "#aab3bf", marginTop: 4, lineHeight: 1.45, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{a.riassunto}</span>}
            <span style={{ display: "block", fontSize: 11.5, color: "#6b7480", marginTop: 4 }}>{quando(a.data)} · DronEzine ↗</span>
          </span>
        </a>
      ))}
      {articoli && articoli.length > 0 && (
        <a href={conUtm(SITO)} target="_blank" rel="noreferrer" style={{ alignSelf: "flex-start", color: "#3d8bfd", fontSize: 13, padding: "8px 0" }}>Tutte le notizie su dronezine.it ↗</a>
      )}
    </div>
  );
}
