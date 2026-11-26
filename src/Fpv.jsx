import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { TestataPagina } from "./VoloHero.jsx";
import { scenaVuota } from "./Scene.jsx";
import { btn, scheda, campo, Etichetta, griglia, oggi, Linguette, Scorciatoie, Firma, useDocumenti, AvvisoSql, riduciImmagine, condividiPdf } from "./lavoroComune.jsx";

// Cartella «🥽 FPV»: osservatore con firma nel registro voli, percorso disegnato sulla piantina, batterie LiPo,
// canali video per più piloti e la guida alla stabilizzazione (Gyroflow, ReelSteady).

const CHIAVE_VISTA = "eyedrones_fpv_vista";
export const apriFpv = (vista) => { try { sessionStorage.setItem(CHIAVE_VISTA, vista); } catch { /* niente */ } };

export default function Fpv({ supabase, inputStyle, onNav, onVoliCambiati, onNuovoVolo }) {
  const [vista, setVista] = useState(() => { try { const v = sessionStorage.getItem(CHIAVE_VISTA); sessionStorage.removeItem(CHIAVE_VISTA); return v || "osservatore"; } catch { return "osservatore"; } });
  const voci = [["osservatore", "👀 Osservatore"], ["percorso", "🗺️ Percorso sulla piantina"], ["lipo", "🔋 Batterie LiPo"], ["frequenze", "📡 Canali video"], ["stabilizza", "🎥 Stabilizzazione"]];
  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }} data-fpv>
      <div style={{ maxWidth: 1000 }}>
        <TestataPagina titolo="FPV" sigla="VISORE · OSSERVATORE · LIPO · CANALI" foto="/trova-pilota/aziende.webp" info="Per chi vola con il visore: l'osservatore firma nel registro voli, il percorso dentro capannoni e case si disegna sulla piantina, le LiPo sono sotto controllo e ogni pilota ha il suo canale. Da telefono e da computer." />
        <Scorciatoie voci={[
          ["🎬", "Manovre FPV e scaletta", () => onNav("scaletta")],
          ["✅", "Checklist prima del volo", () => onNav("pianificazione")],
          ["📒", "Registro voli", () => onNav("registro-voli")],
          ["🎮", "Simulatore di volo", () => { window.location.href = "/simulatore/"; }],
          ["🕶️", "Filtri ND (otturatore a 180°)", () => onNav("calcolatori")],
          ["📈", "Telemetria sul video", () => onNav("telemetria")],
        ]} />
        <Linguette voci={voci} attiva={vista} onCambia={setVista} />
        {vista === "osservatore" && <Osservatore supabase={supabase} onCambiati={onVoliCambiati} onNuovoVolo={onNuovoVolo} />}
        {vista === "percorso" && <Percorso supabase={supabase} />}
        {vista === "lipo" && <Lipo supabase={supabase} />}
        {vista === "frequenze" && <Frequenze supabase={supabase} />}
        {vista === "stabilizza" && <Stabilizzazione />}
      </div>
    </div>
  );
}

// --- osservatore: nome e firma nel volo (voli.osservatore + voli.dettagli.osservatore) ---------------------
const eFpv = (v) => v.tipo_attivita === "fpv" || v.osservatore != null || !!v.visore || !!v.canale_video;
function Osservatore({ supabase, onCambiati, onNuovoVolo }) {
  const [voli, setVoli] = useState(null);
  const [tutti, setTutti] = useState(false);
  const [sel, setSel] = useState(null);
  const [nome, setNome] = useState("");
  const [firma, setFirma] = useState("");
  const [msg, setMsg] = useState("");
  const carica = async () => { const { data } = await supabase.from("voli").select("*").order("data", { ascending: false }).limit(80); setVoli(data || []); };
  useEffect(() => { carica(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const lista = (voli || []).filter((v) => tutti || eFpv(v));
  const volo = (voli || []).find((v) => v.id === sel);
  const scegli = (v) => { setSel(v.id); setNome(v.dettagli?.osservatore?.nome || ""); setFirma(v.dettagli?.osservatore?.firma || ""); setMsg(""); };
  const salva = async () => {
    if (!volo) return;
    if (!nome.trim()) { setMsg("Scrivi il nome dell'osservatore."); return; }
    const dettagli = { ...(volo.dettagli || {}), osservatore: { nome: nome.trim(), firma: firma || null, quando: new Date().toISOString() } };
    const { error } = await supabase.from("voli").update({ osservatore: true, dettagli }).eq("id", volo.id);
    if (error) { setMsg("Non salvato: " + error.message); return; }
    setMsg("✅ Osservatore salvato nel volo"); await carica(); onCambiati && onCambiati();
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }} data-osservatore>
      <div style={{ ...scheda, flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12.5, color: "#c3cad4", lineHeight: 1.5 }}>Con il visore serve un osservatore accanto a te che tenga sempre il drone in vista. Così resta scritto chi era:<br />1️⃣ registri il volo FPV · 2️⃣ lo scegli qui sotto · 3️⃣ l'osservatore scrive il nome e firma col dito. Lo trovi nel registro voli e nel fascicolo, se ti chiedono spiegazioni.</div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5, color: "#8b95a3" }}><input type="checkbox" checked={tutti} onChange={(e) => setTutti(e.target.checked)} />Mostra anche i voli non FPV</label>
        {voli === null ? <div style={{ color: "#8b95a3" }}>Carico…</div> : !lista.length ? <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#8b95a3" }}>Nessun volo FPV nel registro. Prima registri il volo (tipo «FPV»), poi torni qui e l'osservatore firma.{onNuovoVolo && <button type="button" onClick={onNuovoVolo} style={{ ...btn(true), alignSelf: "flex-start" }} data-nuovo-volo-fpv>📒 Registra un volo FPV</button>}</div> : lista.slice(0, 40).map((v) => (
          <button key={v.id} type="button" onClick={() => scegli(v)} style={{ display: "flex", gap: 8, alignItems: "center", textAlign: "left", background: sel === v.id ? "#241d16" : "#10141f", border: `1px solid ${sel === v.id ? "#ff8c42" : "#232b3f"}`, borderRadius: 8, padding: "8px 10px", color: "#e7eaee", fontSize: 13 }} data-volo-fpv>
            <span style={{ flex: 1 }}>{String(v.data || "").split("-").reverse().join("/")} · {v.luogo || "Volo"}{v.drone_nome ? ` · ${v.drone_nome}` : ""}</span>
            <span style={{ fontSize: 11.5, color: v.dettagli?.osservatore?.nome ? "#4ade80" : "#8b95a3" }}>{v.dettagli?.osservatore?.nome ? `👀 ${v.dettagli.osservatore.nome}${v.dettagli.osservatore.firma ? " ✍️" : ""}` : "senza osservatore"}</span>
          </button>
        ))}
      </div>
      <div style={{ ...scheda, flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {!volo ? <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Scegli un volo dall'elenco.</div> : (<>
          <div style={{ fontWeight: 700 }}>{String(volo.data || "").split("-").reverse().join("/")} · {volo.luogo || "Volo"}</div>
          <Etichetta t="Nome e cognome dell'osservatore"><input value={nome} onChange={(e) => setNome(e.target.value)} style={campo} aria-label="Nome osservatore" /></Etichetta>
          <Firma key={volo.id} valore={firma} onCambia={setFirma} etichetta="Firma dell'osservatore" />
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={salva} style={btn(true)} data-salva-osservatore>💾 Salva nel volo</button>
            {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✅") ? "#4ade80" : "#ffb877" }}>{msg}</span>}
          </div>
        </>)}
      </div>
    </div>
  );
}

// --- percorso sulla piantina: più scene (ognuna una linea col suo colore), segni con le note --------------
const SEGNI = { partenza: ["🛫", "Partenza", "#4ade80"], arrivo: ["🏁", "Arrivo", "#f5b942"], stretto: ["⚠️", "Punto stretto", "#ff4d4d"], persone: ["👥", "Persone", "#3d8bfd"], luce: ["💡", "Luce", "#ffd27a"], nota: ["📝", "Nota", "#c4b5fd"] };
const COLORI_SCENA = ["#ff8c42", "#3d8bfd", "#4ade80", "#e879f9", "#facc15", "#f87171", "#22d3ee", "#a3e635"];
const nuovaScena = (n) => ({ id: Math.random().toString(36).slice(2, 8), nome: `Scena ${n}`, colore: COLORI_SCENA[(n - 1) % COLORI_SCENA.length], punti: [] });
const nuovaPiantina = (n) => ({ id: Math.random().toString(36).slice(2, 8), nome: n === 1 ? "Piano terra" : `Piantina ${n}`, img: null, w: 0, h: 0, scene: [nuovaScena(1)], segni: [] });
const PERCORSO_VUOTO = () => ({ titolo: "", piantine: [nuovaPiantina(1)] });
// i percorsi salvati prima avevano una piantina sola (e ancora prima una linea sola, «punti»)
const daSalvato = (d) => {
  const x = d.dati || {};
  if (Array.isArray(x.piantine) && x.piantine.length) return { titolo: d.titolo || x.titolo || "", piantine: x.piantine };
  const una = { ...nuovaPiantina(1), img: x.img || null, w: x.w || 0, h: x.h || 0, segni: x.segni || [], scene: x.scene && x.scene.length ? x.scene : [{ ...nuovaScena(1), punti: x.punti || [] }] };
  return { titolo: d.titolo || x.titolo || "", piantine: [una] };
};

function Percorso({ supabase }) {
  const docs = useDocumenti(supabase, "percorso");
  const [p, setP] = useState(PERCORSO_VUOTO);
  const [id, setId] = useState(null);
  const [ip, setIp] = useState(0); // piantina aperta
  const [attiva, setAttiva] = useState(0);
  const [strumento, setStrumento] = useState("percorso");
  const [msg, setMsg] = useState("");
  const [piani, setPiani] = useState(null);
  const svg = useRef(null);
  const q = p.piantine[Math.min(ip, p.piantine.length - 1)];
  const setQ = (cambi) => setP((x) => ({ ...x, piantine: x.piantine.map((pi, k) => (k === Math.min(ip, x.piantine.length - 1) ? { ...pi, ...(typeof cambi === "function" ? cambi(pi) : cambi) } : pi)) }));
  const scena = q.scene[Math.min(attiva, q.scene.length - 1)];
  const apriPiantina = (k) => { setIp(k); setAttiva(0); setStrumento("percorso"); };
  const aggiungiPiantina = () => { setP({ ...p, piantine: [...p.piantine, nuovaPiantina(p.piantine.length + 1)] }); apriPiantina(p.piantine.length); };
  const togliPiantina = (k) => { if (p.piantine.length <= 1) { setP({ ...p, piantine: [nuovaPiantina(1)] }); apriPiantina(0); return; } setP({ ...p, piantine: p.piantine.filter((_, j) => j !== k) }); apriPiantina(0); };
  const carica = async (file) => { if (!file) return; try { const r = await riduciImmagine(file, 1600); setQ({ img: r.url, w: r.w, h: r.h, scene: [nuovaScena(1)], segni: [] }); setAttiva(0); setMsg(""); } catch (e) { setMsg(e.message); } };
  const cambiaScena = (k, cambi) => setQ((pi) => ({ scene: pi.scene.map((sc, j) => (j === k ? { ...sc, ...cambi } : sc)) }));
  const tocca = (ev) => {
    if (!q.img) return;
    const r = svg.current.getBoundingClientRect();
    const x = Math.round(((ev.clientX - r.left) / r.width) * q.w), y = Math.round(((ev.clientY - r.top) / r.height) * q.h);
    if (strumento === "percorso") cambiaScena(attiva, { punti: [...scena.punti, [x, y]] });
    else setQ({ segni: [...q.segni, { tipo: strumento, x, y, nota: "" }] });
  };
  const aggiungiScena = () => { setQ({ scene: [...q.scene, nuovaScena(q.scene.length + 1)] }); setAttiva(q.scene.length); setStrumento("percorso"); };
  const togliScena = (k) => { if (q.scene.length <= 1) { cambiaScena(0, { punti: [] }); return; } setQ({ scene: q.scene.filter((_, j) => j !== k) }); setAttiva(0); };
  const s = q.w / 800 || 1;
  const disegnaPng = (pi) => new Promise((ok) => {
    const p = pi; const s = p.w / 800 || 1;
    const c = document.createElement("canvas"); c.width = p.w; c.height = p.h; const g = c.getContext("2d"); const i = new Image();
    i.onload = () => {
      g.drawImage(i, 0, 0);
      p.scene.forEach((sc, n) => {
        if (sc.punti.length > 1) { g.strokeStyle = sc.colore; g.lineWidth = 5 * s; g.lineJoin = "round"; g.setLineDash([14 * s, 8 * s]); g.beginPath(); sc.punti.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]); }
        if (sc.punti.length) { const [x, y] = sc.punti[0]; g.fillStyle = sc.colore; g.beginPath(); g.arc(x, y, 13 * s, 0, Math.PI * 2); g.fill(); g.fillStyle = "#10141f"; g.font = `bold ${14 * s}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`S${n + 1}`, x, y + 1); }
      });
      p.segni.forEach((m, k) => { const [e, , col] = SEGNI[m.tipo]; g.fillStyle = "#0d111c"; g.strokeStyle = col; g.lineWidth = 3 * s; g.beginPath(); g.arc(m.x, m.y, 16 * s, 0, Math.PI * 2); g.fill(); g.stroke(); g.font = `${18 * s}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e, m.x, m.y + 1); g.fillStyle = "#fff"; g.font = `bold ${13 * s}px sans-serif`; g.fillText(String(k + 1), m.x + 20 * s, m.y - 16 * s); });
      ok(c.toDataURL("image/jpeg", 0.88));
    };
    i.src = p.img;
  });
  const pdf = async () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const conImg = p.piantine.filter((pi) => pi.img);
    for (let n = 0; n < conImg.length; n++) {
      const pi = conImg[n];
      if (n) doc.addPage();
      const img = await disegnaPng(pi);
      doc.setTextColor(20); doc.setFontSize(15); doc.text(p.titolo || "Percorso FPV", 15, 16);
      doc.setFontSize(11); doc.setTextColor(110); doc.text(pi.nome || `Piantina ${n + 1}`, 195, 16, { align: "right" });
      const larg = 180, alt = Math.min(175, (larg * pi.h) / pi.w), l2 = (alt * pi.w) / pi.h;
      doc.addImage(img, "JPEG", 15 + (larg - l2) / 2, 22, l2, alt);
      let y = 22 + alt + 8; doc.setTextColor(20);
      const riga = (t, col) => { if (y > 285) { doc.addPage(); y = 20; } if (col) { const c = parseInt(col.slice(1), 16); doc.setFillColor((c >> 16) & 255, (c >> 8) & 255, c & 255); doc.rect(15, y - 3, 4, 4, "F"); } doc.text(t, col ? 22 : 15, y); y += 5.5; };
      doc.setFontSize(11); riga("Scene"); doc.setFontSize(10);
      pi.scene.filter((sc) => sc.punti.length).forEach((sc, k) => riga(`S${k + 1} · ${sc.nome}${sc.note ? `: ${sc.note}` : ""}`, sc.colore));
      if (pi.segni.length) { y += 2; doc.setFontSize(11); riga("Punti segnati"); doc.setFontSize(10); pi.segni.forEach((m, k) => riga(`${k + 1}. ${SEGNI[m.tipo][1]}${m.nota ? `: ${m.nota}` : ""}`)); }
      doc.setFontSize(8); doc.setTextColor(120); doc.text("Linee tratteggiate: il percorso del drone per ogni scena. Tenere libere le zone segnate durante il volo.", 15, 290);
    }
    await condividiPdf(doc, `Percorso-${(p.titolo || "FPV").replace(/[^\w-]+/g, "-")}.pdf`);
  };
  const salva = async () => { if (!p.piantine.some((pi) => pi.img)) return; try { const r = await docs.salva({ id, titolo: p.titolo || "Percorso FPV", dati: p }); setId(r.id); setMsg("✅ Salvato: lo ritrovi in «Percorsi salvati» qui sotto. Puoi anche mettere le scene nella scaletta di un piano."); } catch (e) { setMsg("Non salvato: " + (e.message || e)); } };
  const caricaPiani = async () => { const { data } = await supabase.from("piani_volo").select("id, impianto_nome, data_prevista, checklist_stato").order("data_prevista", { ascending: true }).limit(100); setPiani((data || []).filter((x) => !x.checklist_stato?.fatto)); };
  const nellaScaletta = async (pianoId) => {
    const piano = (piani || []).find((x) => String(x.id) === String(pianoId)); if (!piano) return;
    const nuove = p.piantine.flatMap((pi) => pi.scene.filter((sc) => sc.punti.length).map((sc) => ({ ...scenaVuota("fpv"), titolo: p.piantine.length > 1 ? `${pi.nome} · ${sc.nome}` : sc.nome, note: [`Percorso «${p.titolo || "FPV"}» (vedi il PDF del percorso)`, sc.note].filter(Boolean).join(" · ") })));
    if (!nuove.length) { setMsg("Disegna almeno una scena."); return; }
    const cs = piano.checklist_stato || {};
    const { error } = await supabase.from("piani_volo").update({ checklist_stato: { ...cs, scene: [...(cs.scene || []), ...nuove] } }).eq("id", piano.id);
    setMsg(error ? "Non riesco a metterle nel piano: " + error.message : `✅ ${nuove.length === 1 ? "1 scena aggiunta" : `${nuove.length} scene aggiunte`} alla scaletta di «${piano.impianto_nome || "piano"}»`);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-percorso>
      {docs.manca && <AvvisoSql />}
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "#c3cad4" }}>Per i voli dentro capannoni, negozi e case: carica la piantina (anche una foto del foglio); con «＋ Altra piantina» aggiungi gli altri piani. Ogni <b>scena</b> è un percorso con il suo colore: tocca la piantina per disegnarla, poi «＋ Nuova scena» per la successiva. Segna i punti stretti e manda il PDF al cliente e allo staff.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Etichetta t="Nome del lavoro"><input value={p.titolo} onChange={(e) => setP({ ...p, titolo: e.target.value })} placeholder="es. Capannone Rossi, fly-through" style={{ ...campo, minWidth: 220 }} /></Etichetta>
          {(q.img || id) && <button type="button" onClick={() => { setP(PERCORSO_VUOTO()); setId(null); apriPiantina(0); setMsg(""); }} style={btn(false)}>Nuovo percorso</button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} data-piantine>
          {p.piantine.map((pi, k) => <button key={pi.id} type="button" aria-pressed={k === ip} onClick={() => apriPiantina(k)} style={{ ...btn(false), borderColor: k === ip ? "#ff8c42" : "#343e57", background: k === ip ? "#241d16" : "#1a2133" }}>🗺️ {pi.nome || `Piantina ${k + 1}`}{pi.img ? "" : " (vuota)"}</button>)}
          <button type="button" onClick={aggiungiPiantina} style={btn(false)} data-nuova-piantina>＋ Altra piantina</button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Etichetta t="Nome di questa piantina"><input value={q.nome} onChange={(e) => setQ({ nome: e.target.value })} placeholder="es. Piano terra, Magazzino" style={{ ...campo, minWidth: 180 }} aria-label="Nome piantina" /></Etichetta>
          <label style={{ ...btn(!q.img), cursor: "pointer", display: "inline-flex", alignItems: "center" }}>🖼️ {q.img ? "Cambia immagine" : "Carica la piantina"}<input type="file" accept="image/*" onChange={(e) => { carica(e.target.files?.[0]); e.target.value = ""; }} style={{ display: "none" }} aria-label="Piantina" /></label>
          {p.piantine.length > 1 && <button type="button" onClick={() => togliPiantina(ip)} style={{ ...btn(false), color: "#ff9c9c" }}>Togli questa piantina</button>}
        </div>
        {q.img && (<>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }} data-scene>
            {q.scene.map((sc, k) => (
              <button key={sc.id} type="button" aria-pressed={k === attiva && strumento === "percorso"} onClick={() => { setAttiva(k); setStrumento("percorso"); }} style={{ ...btn(false), display: "inline-flex", alignItems: "center", gap: 6, borderColor: k === attiva && strumento === "percorso" ? sc.colore : "#343e57", background: k === attiva && strumento === "percorso" ? "#241d16" : "#1a2133" }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: sc.colore }} />S{k + 1} {sc.nome}{sc.punti.length ? ` · ${sc.punti.length}` : ""}
              </button>
            ))}
            <button type="button" onClick={aggiungiScena} style={btn(false)} data-nuova-scena>＋ Nuova scena</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(SEGNI).map(([k, [e, t]]) => <button key={k} type="button" aria-pressed={strumento === k} onClick={() => setStrumento(k)} style={{ ...btn(strumento === k) }}>{e} {t}</button>)}
            <button type="button" onClick={() => (strumento === "percorso" ? cambiaScena(attiva, { punti: scena.punti.slice(0, -1) }) : setQ({ segni: q.segni.slice(0, -1) }))} style={btn(false)}>↩️ Annulla l'ultimo</button>
          </div>
          <div style={{ fontSize: 12, color: "#8b95a3" }}>{strumento === "percorso" ? <>Stai disegnando <b style={{ color: scena.colore }}>S{attiva + 1} {scena.nome}</b>: tocca la piantina per aggiungere i punti.</> : <>Tocca la piantina per mettere «{SEGNI[strumento][0]} {SEGNI[strumento][1]}». Per tornare a disegnare tocca una scena.</>}</div>
        </>)}
      </div>
      {q.img && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 520px", minWidth: 0 }}>
            <svg ref={svg} viewBox={`0 0 ${q.w} ${q.h}`} onClick={tocca} style={{ width: "100%", height: "auto", display: "block", borderRadius: 10, border: "1px solid #2a3349", cursor: "crosshair", touchAction: "manipulation", background: "#fff" }} aria-label="Piantina: tocca per disegnare" data-piantina>
              <image href={q.img} x="0" y="0" width={q.w} height={q.h} />
              {q.scene.map((sc, n) => (
                <g key={sc.id} opacity={strumento === "percorso" && n !== attiva ? 0.55 : 1}>
                  {sc.punti.length > 1 && <polyline points={sc.punti.map((q) => q.join(",")).join(" ")} fill="none" stroke={sc.colore} strokeWidth={5 * s} strokeDasharray={`${14 * s} ${8 * s}`} strokeLinejoin="round" />}
                  {sc.punti.map(([x, y], k) => <circle key={k} cx={x} cy={y} r={(k === 0 ? 13 : 5) * s} fill={sc.colore} />)}
                  {sc.punti.length > 0 && <text x={sc.punti[0][0]} y={sc.punti[0][1] + 5 * s} textAnchor="middle" fontSize={13 * s} fontWeight="bold" fill="#10141f">S{n + 1}</text>}
                </g>
              ))}
              {q.segni.map((m, k) => (
                <g key={k}><circle cx={m.x} cy={m.y} r={16 * s} fill="#0d111c" stroke={SEGNI[m.tipo][2]} strokeWidth={3 * s} /><text x={m.x} y={m.y + 6 * s} textAnchor="middle" fontSize={18 * s}>{SEGNI[m.tipo][0]}</text><text x={m.x + 20 * s} y={m.y - 14 * s} fontSize={13 * s} fontWeight="bold" fill="#111" stroke="#fff" strokeWidth={3 * s} paintOrder="stroke">{k + 1}</text></g>
              ))}
            </svg>
          </div>
          <div style={{ flex: "1 1 280px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Scene</div>
              {q.scene.map((sc, k) => (
                <div key={sc.id} style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 6, borderBottom: "1px solid #232b3f" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: sc.colore, flex: "none" }} />
                    <input value={sc.nome} onChange={(e) => cambiaScena(k, { nome: e.target.value })} style={campo} aria-label={`Nome scena ${k + 1}`} />
                    <button type="button" onClick={() => togliScena(k)} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Togli la scena">✕</button>
                  </div>
                  <input value={sc.note || ""} onChange={(e) => cambiaScena(k, { note: e.target.value })} placeholder="Note (velocità, altezza, cosa riprendere)" style={{ ...campo, fontSize: 12.5 }} aria-label={`Note scena ${k + 1}`} />
                </div>
              ))}
            </div>
            <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 700 }}>Punti segnati</div>
              {!q.segni.length && <div style={{ fontSize: 12.5, color: "#8b95a3" }}>Scegli un segno (⚠️ punto stretto, 👥 persone…) e tocca la piantina.</div>}
              {q.segni.map((m, k) => (
                <div key={k} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 13, width: 54, flex: "none" }}>{k + 1}. {SEGNI[m.tipo][0]}</span>
                  <input value={m.nota} onChange={(e) => setQ({ segni: q.segni.map((x, j) => (j === k ? { ...x, nota: e.target.value } : x)) })} placeholder={SEGNI[m.tipo][1]} style={campo} aria-label={`Nota ${k + 1}`} />
                  <button type="button" onClick={() => setQ({ segni: q.segni.filter((_, j) => j !== k) })} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Togli">✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={salva} style={btn(true)} data-salva-percorso>💾 Salva</button>
              <button type="button" onClick={pdf} style={btn(false)} data-pdf-percorso>📄 PDF per cliente e staff</button>
            </div>
            <select defaultValue="" onFocus={() => { if (!piani) caricaPiani(); }} onClick={() => { if (!piani) caricaPiani(); }} onChange={(e) => { if (e.target.value) { nellaScaletta(e.target.value); e.target.value = ""; } }} style={{ ...campo, maxWidth: "100%" }} aria-label="Metti nella scaletta">
              <option value="">🎬 Metti le scene nella scaletta di un piano…</option>
              {(piani || []).map((x) => <option key={x.id} value={x.id}>{x.impianto_nome || "Piano"} · {x.data_prevista || ""}</option>)}
            </select>
            {msg && <span style={{ fontSize: 12.5, color: msg.startsWith("✅") ? "#4ade80" : "#ffb877" }}>{msg}</span>}
          </div>
        </div>
      )}
      {docs.lista && docs.lista.length > 0 && (
        <div style={scheda}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Percorsi salvati</div>
          {docs.lista.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "5px 0", borderBottom: "1px solid #232b3f", fontSize: 13 }}>
              <button type="button" onClick={() => { setP(daSalvato(d)); setId(d.id); apriPiantina(0); setMsg(""); window.scrollTo(0, 0); }} style={{ background: "none", border: "none", color: "#9cc3ff", textAlign: "left", flex: 1 }}>{d.titolo}</button>
              <span style={{ fontSize: 11.5, color: "#8b95a3" }}>{(d.dati?.piantine || [1]).length} {(d.dati?.piantine || [1]).length === 1 ? "piantina" : "piantine"} · {new Date(d.updated_at || d.created_at).toLocaleDateString("it-IT")}</span>
              <button type="button" onClick={() => docs.togli(d.id)} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Elimina">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- batterie LiPo --------------------------------------------------------------------------------------
const EVENTI = { carica: "🔌 Caricata", volata: "🥽 Volata", conservazione: "💤 A conservazione (3,8 V per cella)" };
const giorniDa = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
export function avvisiLipo(b) {
  const ev = [...(b.dati?.eventi || [])].sort((x, y) => String(y.quando).localeCompare(String(x.quando)));
  const out = [];
  if (b.dati?.gonfia) out.push({ grave: true, testo: "Gonfia: non usarla più e portala allo smaltimento." });
  const ultimo = ev[0];
  if (ultimo && ultimo.tipo === "carica" && giorniDa(ultimo.quando) > 2) out.push({ grave: false, testo: `Carica da ${Math.floor(giorniDa(ultimo.quando))} giorni: mettila a conservazione, così dura di più.` });
  const ir = ev.filter((e) => e.ir).map((e) => Number(e.ir)).filter((n) => n > 0);
  if (ir.length >= 2 && ir[0] > ir[ir.length - 1] * 1.5) out.push({ grave: false, testo: `Resistenza interna salita da ${ir[ir.length - 1]} a ${ir[0]} mΩ: sta invecchiando, usala per voli tranquilli.` });
  return out;
}
function Lipo({ supabase }) {
  const docs = useDocumenti(supabase, "lipo");
  const [nuova, setNuova] = useState({ nome: "", celle: "6", mah: "1300" });
  const [ir, setIr] = useState({});
  const aggiungi = async () => { if (!nuova.nome.trim()) return; await docs.salva({ titolo: nuova.nome.trim(), dati: { celle: nuova.celle, mah: nuova.mah, eventi: [], gonfia: false } }); setNuova({ ...nuova, nome: "" }); };
  const evento = async (b, tipo) => { const e = { tipo, quando: new Date().toISOString(), ...(ir[b.id] ? { ir: ir[b.id] } : {}) }; await docs.salva({ id: b.id, titolo: b.titolo, dati: { ...b.dati, eventi: [...(b.dati.eventi || []), e].slice(-300) } }); setIr({ ...ir, [b.id]: "" }); };
  const gonfia = async (b) => docs.salva({ id: b.id, titolo: b.titolo, dati: { ...b.dati, gonfia: !b.dati.gonfia } });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-lipo>
      {docs.manca && <AvvisoSql />}
      <div style={{ ...scheda, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Etichetta t="Nome della batteria"><input value={nuova.nome} onChange={(e) => setNuova({ ...nuova, nome: e.target.value })} placeholder="es. Tattu 6S n.1" style={{ ...campo, minWidth: 180 }} aria-label="Nome LiPo" /></Etichetta>
        <Etichetta t="Celle"><select value={nuova.celle} onChange={(e) => setNuova({ ...nuova, celle: e.target.value })} style={campo}>{["1", "2", "3", "4", "6"].map((c) => <option key={c} value={c}>{c}S</option>)}</select></Etichetta>
        <Etichetta t="mAh"><input inputMode="numeric" value={nuova.mah} onChange={(e) => setNuova({ ...nuova, mah: e.target.value })} style={{ ...campo, width: 90 }} /></Etichetta>
        <button type="button" onClick={aggiungi} style={btn(true)} data-aggiungi-lipo>＋ Aggiungi</button>
      </div>
      {(docs.lista || []).map((b) => {
        const ev = b.dati.eventi || [], avv = avvisiLipo(b), voli = ev.filter((e) => e.tipo === "volata").length, ult = ev[ev.length - 1];
        return (
          <div key={b.id} style={{ ...scheda, display: "flex", flexDirection: "column", gap: 8, borderColor: avv.some((a) => a.grave) ? "#ff4d4d" : avv.length ? "#f5b94288" : "#2a3349" }} data-pacco>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b>{b.titolo}</b><span style={{ fontSize: 12, color: "#8b95a3" }}>{b.dati.celle}S · {b.dati.mah} mAh · {voli} voli{ult ? ` · ultima: ${EVENTI[ult.tipo].split(" (")[0]} ${new Date(ult.quando).toLocaleDateString("it-IT")}` : ""}</span>
              <button type="button" onClick={() => docs.togli(b.id)} style={{ background: "none", border: "none", color: "#ff9c9c", marginLeft: "auto" }} aria-label="Elimina">✕</button>
            </div>
            {avv.map((a) => <div key={a.testo} style={{ fontSize: 12.5, color: a.grave ? "#ff8080" : "#f5b942" }}>⚠️ {a.testo}</div>)}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {Object.entries(EVENTI).map(([k, t]) => <button key={k} type="button" onClick={() => evento(b, k)} style={{ ...btn(false), padding: "6px 10px" }}>{t.split(" (")[0]}</button>)}
              <input inputMode="decimal" value={ir[b.id] || ""} onChange={(e) => setIr({ ...ir, [b.id]: e.target.value })} placeholder="IR mΩ (facoltativo)" style={{ ...campo, width: 150 }} aria-label="Resistenza interna" />
              <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 12.5, color: "#ff9c9c" }}><input type="checkbox" checked={!!b.dati.gonfia} onChange={() => gonfia(b)} />Gonfia</label>
            </div>
          </div>
        );
      })}
      <div style={{ ...scheda, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.55 }}>
        <b style={{ color: "#e7eaee" }}>Regole d'oro delle LiPo.</b> Non lasciarle cariche più di 1–2 giorni: mettile a conservazione (circa 3,8 V per cella). Non scendere sotto 3,5 V per cella in volo. Carica in una borsa ignifuga e mai senza controllo. Se una batteria è gonfia, calda o ammaccata non usarla più.
      </div>
    </div>
  );
}

// --- canali video per più piloti ------------------------------------------------------------------------
const BANDE = { R: [5658, 5695, 5732, 5769, 5806, 5843, 5880, 5917], F: [5740, 5760, 5780, 5800, 5820, 5840, 5860, 5880] };
const CANALI = Object.entries(BANDE).flatMap(([b, f]) => f.map((mhz, i) => ({ nome: `${b}${i + 1}`, mhz }))).filter((c, i, a) => a.findIndex((x) => x.mhz === c.mhz) === i);
function combinazioni(arr, k, da = 0, pref = [], out = []) { if (pref.length === k) { out.push(pref); return out; } for (let i = da; i < arr.length; i++) combinazioni(arr, k, i + 1, [...pref, arr[i]], out); return out; }
// il gruppo migliore: meno disturbi tra canali (intermodulazione 2·f1−f2 vicino a un altro canale) e più distanza tra loro
export function canaliMigliori(n) {
  let migliore = null;
  for (const g of combinazioni(CANALI, n)) {
    const f = g.map((c) => c.mhz);
    let dist = Infinity; for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) dist = Math.min(dist, Math.abs(f[i] - f[j]));
    let imd = 0; for (const a of f) for (const b of f) if (a !== b) { const p = 2 * a - b; if (f.some((x) => Math.abs(x - p) < 18)) imd++; }
    const punti = imd * 1000 - dist;
    if (!migliore || punti < migliore.punti) migliore = { g, punti, dist, imd };
  }
  return migliore;
}
function Frequenze({ supabase }) {
  const docs = useDocumenti(supabase, "frequenze");
  const [sistema, setSistema] = useState("analogico");
  const [piloti, setPiloti] = useState(["", "", ""]);
  const [canaliDigitali, setCanaliDigitali] = useState("8");
  const [msg, setMsg] = useState("");
  const n = Math.max(1, Math.min(8, piloti.length));
  const assegnati = useMemo(() => {
    if (sistema === "analogico") { const m = canaliMigliori(n); return { righe: m.g.map((c) => `${c.nome} · ${c.mhz} MHz`), nota: `Distanza minima ${m.dist} MHz${m.imd ? " · qualche disturbo possibile, abbassate la potenza" : " · nessun disturbo tra canali"}` }; }
    const tot = Math.max(1, Number(canaliDigitali) || 1);
    if (n > tot) return { righe: [], nota: `Con ${tot} canali possono volare insieme al massimo ${tot} piloti.` };
    return { righe: Array.from({ length: n }, (_, i) => `Canale ${1 + Math.round((i * (tot - 1)) / Math.max(1, n - 1))}`), nota: "Canali il più lontani possibile tra loro." };
  }, [sistema, n, canaliDigitali]);
  const testo = piloti.map((p, i) => `${p || `Pilota ${i + 1}`}: ${assegnati.righe[i] || "—"}`).join("\n");
  const copia = async () => { try { await navigator.clipboard.writeText(testo); setMsg("Copiato"); } catch { setMsg(testo); } };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-frequenze>
      {docs.manca && <AvvisoSql />}
      <div style={{ ...scheda, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["analogico", "📺 Analogico 5,8 GHz"], ["digitale", "🛰️ Digitale (DJI, Walksnail, HDZero)"]].map(([k, t]) => <button key={k} type="button" aria-pressed={sistema === k} onClick={() => setSistema(k)} style={{ ...btn(false), borderColor: sistema === k ? "#ff8c42" : "#343e57" }}>{t}</button>)}
        </div>
        {sistema === "digitale" && <Etichetta t="Quanti canali ha il tuo visore (guarda nelle impostazioni)"><input inputMode="numeric" value={canaliDigitali} onChange={(e) => setCanaliDigitali(e.target.value)} style={{ ...campo, width: 120 }} /></Etichetta>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {piloti.map((p, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 8, alignItems: "center" }} data-pilota-canale>
              <input value={p} onChange={(e) => setPiloti(piloti.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Pilota ${i + 1}`} style={campo} aria-label={`Pilota ${i + 1}`} />
              <b style={{ fontSize: 13.5, color: "#4ade80", whiteSpace: "nowrap" }}>{assegnati.righe[i] || "—"}</b>
              <button type="button" onClick={() => setPiloti(piloti.filter((_, j) => j !== i))} disabled={piloti.length <= 1} style={{ background: "none", border: "none", color: "#ff9c9c" }} aria-label="Togli">✕</button>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#8b95a3" }}>{assegnati.nota}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {piloti.length < 8 && <button type="button" onClick={() => setPiloti([...piloti, ""])} style={btn(false)}>＋ Pilota</button>}
          <a href={`https://wa.me/?text=${encodeURIComponent(`Canali video di oggi:\n${testo}`)}`} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: "none" }}>WhatsApp al gruppo</a>
          <button type="button" onClick={copia} style={btn(false)}>Copia</button>
          <button type="button" onClick={async () => { try { await docs.salva({ titolo: `Canali del ${oggi().split("-").reverse().join("/")}`, dati: { sistema, piloti, canaliDigitali, righe: assegnati.righe } }); setMsg("✅ Salvato"); } catch (e) { setMsg("Non salvato: " + (e.message || e)); } }} style={btn(true)}>💾 Salva</button>
          {msg && <span style={{ fontSize: 12.5, color: "#4ade80", whiteSpace: "pre-wrap" }}>{msg}</span>}
        </div>
      </div>
      <div style={{ ...scheda, fontSize: 12.5, color: "#c3cad4", lineHeight: 1.55 }}>
        In Europa sulla banda 5,8 GHz la potenza ammessa per il video è bassa (25 mW): usa la modalità CE del visore e della trasmittente. Chi non vola tiene il drone spento, per non disturbare gli altri canali. Prima di decollare, ognuno dice ad alta voce il suo canale.
      </div>
    </div>
  );
}

// --- stabilizzazione ------------------------------------------------------------------------------------
function Stabilizzazione() {
  const passi = [
    ["🎯", "In volo", "Tempo di scatto al doppio dei fotogrammi (a 60 fps circa 1/120) con un filtro ND: le immagini hanno il mosso giusto e la stabilizzazione non «trema». Registra più largo che puoi: dopo si taglia un po' l'inquadratura."],
    ["📴", "Stabilizzazione nella camera", "Se stabilizzi dopo con Gyroflow, spegni la stabilizzazione della camera (RockSteady, EIS). Con le camere DJI O3/O4 e Avata guarda che il file salvi i dati del giroscopio."],
    ["💻", "Gyroflow (computer)", "Programma open source che usa i dati del giroscopio: apri il video, scegli il profilo dell'obiettivo, controlla la sincronizzazione e esporta. Funziona con GoPro, DJI, Insta360, Runcam, Betaflight blackbox."],
    ["🎞️", "GoPro e ReelSteady", "Con le GoPro la stabilizzazione «ReelSteady» è dentro GoPro Player (computer): apri il video, scegli l'orizzonte livellato o libero ed esporta."],
    ["✂️", "Dopo", "Correzione colore dopo la stabilizzazione. Se l'immagine si deforma ai bordi, riduci lo «smoothness» o taglia un po' di più."],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }} data-stabilizza>
      {passi.map(([e, t, x]) => <div key={t} style={{ ...scheda, fontSize: 12.8, color: "#c3cad4", lineHeight: 1.55 }}><div style={{ fontWeight: 800, color: "#e7eaee", marginBottom: 4 }}>{e} {t}</div>{x}</div>)}
    </div>
  );
}
