import React, { useEffect, useRef, useState } from "react";
import { leggiDatiFoto, analizzaVolo, csvPosizioni, leggiCsvPunti, csvPunti, FORME_CUMULO, MATERIALI, volumeDaDsm } from "./fotogrammetria.js";
import { DRONI_CAMERE, CAMERA_MANUALE } from "./camereRilievo.js";

// Strumenti per la fotogrammetria: controllo delle foto dopo il volo, punti di controllo (GCP) e volumi.

const scheda = { background: "#10141f", border: "1px solid #232b3f", borderRadius: 10, padding: 14 };
const btn = (primario) => ({ background: primario ? "linear-gradient(135deg, #ff9d5c, #e0552f)" : "#1a2133", color: primario ? "#10141f" : "#e7eaee", border: primario ? "none" : "1px solid #343e57", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: primario ? 800 : 600, cursor: "pointer" });
const etichetta = { fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 };
const pct = (x) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const f1 = (x, c = 1) => (x == null ? "—" : Number(x).toLocaleString("it-IT", { maximumFractionDigits: c }));
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return v === "" || v == null || Number.isNaN(n) ? null : n; };
function scarica(testo, nome, tipo = "text/csv") {
  const url = URL.createObjectURL(new Blob([testo], { type: tipo }));
  const a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const TUTTE_CAMERE = [...DRONI_CAMERE.flatMap((d) => d.camere.filter((c) => !c.termica).map((c) => ({ ...c, chiave: `${d.key}:${c.key}`, etichetta: `${d.nome} · ${c.nome}` }))), { ...CAMERA_MANUALE, chiave: "manuale", etichetta: "Altra fotocamera" }];

// --- 1. Controllo dopo il volo -----------------------------------------------------------------------------
export function ControlloFoto({ inputStyle }) {
  const [foto, setFoto] = useState([]);
  const [leggo, setLeggo] = useState(null);
  const [altezza, setAltezza] = useState("");
  const [camera, setCamera] = useState("");
  const [ris, setRis] = useState(null);
  const tela = useRef(null);

  const carica = async (lista) => {
    const files = [...(lista || [])].filter((f) => /\.jpe?g$/i.test(f.name));
    if (!files.length) { setRis({ errore: "Scegli le foto JPG del volo (quelle originali del drone)." }); return; }
    setRis(null); setLeggo({ fatte: 0, tot: files.length });
    const dati = [];
    for (let i = 0; i < files.length; i++) { dati.push(await leggiDatiFoto(files[i])); if (i % 10 === 0) setLeggo({ fatte: i + 1, tot: files.length }); }
    setLeggo(null); setFoto(dati);
  };
  useEffect(() => {
    if (!foto.length) return;
    const cam = TUTTE_CAMERE.find((c) => c.chiave === camera) || null;
    setRis(analizzaVolo(foto, { altezzaManuale: num(altezza), camera: cam }));
  }, [foto, altezza, camera]);
  useEffect(() => {
    const c = tela.current; if (!c || !ris || !ris.griglia) return;
    const { nx, ny, conta, nellArea } = ris.griglia;
    const lato = Math.min(640, Math.max(260, c.parentElement.clientWidth));
    const s = lato / Math.max(nx, ny);
    c.width = Math.round(nx * s); c.height = Math.round(ny * s);
    const g = c.getContext("2d");
    g.fillStyle = "#0b0f19"; g.fillRect(0, 0, c.width, c.height);
    for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
      const n = conta[iy * nx + ix], a = nellArea[iy * nx + ix];
      if (!n && !a) continue;
      g.fillStyle = a && n < 3 ? (n === 0 ? "#ef4444" : "#f97316") : n >= 5 ? "#16a34a" : n >= 3 ? "#65a30d" : "#334155";
      g.fillRect(ix * s, c.height - (iy + 1) * s, Math.ceil(s), Math.ceil(s));
    }
    g.fillStyle = "#ffffff";
    ris.punti.forEach(([x, y]) => { g.beginPath(); g.arc(x * s, c.height - y * s, Math.max(1.5, s * 0.6), 0, Math.PI * 2); g.fill(); });
    // tratti con foto mancanti (sovrapposizione frontale sotto il 50%)
    g.strokeStyle = "#ef4444"; g.lineWidth = Math.max(3, s * 1.2); g.setLineDash([6, 4]);
    (ris.salti || []).forEach(([i, j]) => { const [x1, y1] = ris.punti[i], [x2, y2] = ris.punti[j]; g.beginPath(); g.moveTo(x1 * s, c.height - y1 * s); g.lineTo(x2 * s, c.height - y2 * s); g.stroke(); });
    g.setLineDash([]);
  }, [ris]);

  return (
    <div style={scheda}>
      <p style={{ fontSize: 12.5, color: "#aab3bf", margin: "0 0 10px 0", lineHeight: 1.5 }}>Prima di andare via dal posto: scegli le foto del volo. Leggo posizione e quota di ognuna e ti dico se la sovrapposizione è buona o se ci sono buchi da rivolare. Le foto restano sul tuo telefono: non le carico da nessuna parte.</p>
      <label style={{ ...btn(true), display: "inline-block" }}>
        📷 Scegli le foto del volo
        <input type="file" accept="image/jpeg" multiple onChange={(e) => { carica(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
      </label>
      {leggo && <p style={{ fontSize: 12.5, color: "#8b95a3", marginTop: 10 }}>Leggo le foto… {leggo.fatte} di {leggo.tot}</p>}
      {foto.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ flex: "1 1 160px" }}><label style={etichetta}>Altezza dal suolo (se non la trovo)</label><input inputMode="decimal" value={altezza} onChange={(e) => setAltezza(e.target.value)} placeholder="es. 80 m" style={inputStyle} /></div>
          <div style={{ flex: "2 1 240px" }}><label style={etichetta}>Fotocamera (se nelle foto manca la focale)</label>
            <select value={camera} onChange={(e) => setCamera(e.target.value)} style={inputStyle}><option value="">Dalle foto (automatico)</option>{TUTTE_CAMERE.map((c) => <option key={c.chiave} value={c.chiave}>{c.etichetta}</option>)}</select></div>
        </div>
      )}
      {ris && ris.errore && <p style={{ fontSize: 13, color: "#ffd68a", marginTop: 12 }}>⚠️ {ris.errore}</p>}
      {ris && !ris.errore && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: ris.ok ? "#4ade80" : "#ffd68a", marginBottom: 8 }}>{ris.ok ? "✅ Volo buono per l'elaborazione" : "⚠️ Controlla prima di andare via"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
            {[["foto", ris.foto], ["strisciate", ris.strisciate], ["area", `${f1(ris.areaHa, 2)} ha`], ["quota media", `${f1(ris.altMedia, 0)} m`], ["GSD stimato", ris.gsd ? `${f1(ris.gsd, 2)} cm/px` : "—"], ["frontale", `${pct(ris.frontale)} (min ${pct(ris.frontaleMin)})`], ["laterale", `${pct(ris.laterale)}${ris.lateraleMin != null ? ` (min ${pct(ris.lateraleMin)})` : ""}`], ["area vista da 5+ foto", pct(ris.buoniPct)]].map(([t, v]) => (
              <div key={t} style={{ background: "#151b2b", border: "1px solid #2a3349", borderRadius: 8, padding: "8px 10px" }}><div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{v}</div><div style={{ fontSize: 11, color: "#8b95a3" }}>{t}</div></div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>{ris.avvisi.map((a) => <div key={a} style={{ fontSize: 12.5, color: a.startsWith("✓") ? "#8fdcaa" : "#ffd68a" }}>{a.startsWith("✓") ? a : `⚠️ ${a}`}</div>)}</div>
          <div style={{ marginTop: 12 }}><canvas ref={tela} style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #2a3349" }} /></div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11.5, color: "#8b95a3", marginTop: 4 }}>
            <span><b style={{ color: "#16a34a" }}>■</b> 5+ foto</span><span><b style={{ color: "#65a30d" }}>■</b> 3-4 foto</span><span><b style={{ color: "#f97316" }}>■</b> 1-2 foto</span><span><b style={{ color: "#ef4444" }}>■</b> nessuna</span><span>● posizione di ogni foto</span><span><b style={{ color: "#ef4444" }}>- - -</b> foto mancanti</span><span>nord in alto</span>
          </div>
          {ris.oblique > 0 && <p style={{ fontSize: 11.5, color: "#8b95a3", margin: "6px 0 0 0" }}>{ris.oblique} foto inclinate (non a piombo): per la copertura le conto come se fossero dritte.</p>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <button type="button" onClick={() => scarica(csvPosizioni(ris.valide, "pix4d"), "posizioni-foto.csv")} style={btn(false)}>⬇️ Posizioni per Pix4D / Metashape</button>
            <button type="button" onClick={() => scarica(csvPosizioni(ris.valide, "webodm"), "geo.txt", "text/plain")} style={btn(false)}>⬇️ geo.txt per WebODM</button>
          </div>
          <p style={{ fontSize: 11, color: "#6b7480", margin: "8px 0 0 0", lineHeight: 1.45 }}>Stima dalle posizioni GPS delle foto, considerate a piombo: utile per capire subito se manca qualcosa, non sostituisce il report del programma di elaborazione.</p>
        </div>
      )}
    </div>
  );
}

// --- 2. Punti di controllo a terra (GCP), salvati nel volo di rilievo -------------------------------------
export function PuntiGCP({ volo, inputStyle, onSalva }) {
  const det = volo.dettagli || {};
  const [punti, setPunti] = useState(() => det.gcp_lista || []);
  const [sistema, setSistema] = useState(det.gcp_sistema || "WGS84 (EPSG:4326) · lat/lon");
  const [incolla, setIncolla] = useState(null);
  const [stato, setStato] = useState("");
  const salva = async (lista, sis = sistema) => {
    setPunti(lista); setStato("Salvo…");
    const ok = await onSalva({ ...det, gcp_lista: lista, gcp_sistema: sis, gcp: String(lista.filter((p) => p.tipo !== "verifica").length || det.gcp || "") });
    setStato(ok ? "✓ Salvato" : "Non sono riuscito a salvare: riprova.");
  };
  const cambia = (i, k, v) => salva(punti.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const gcp = punti.filter((p) => p.tipo !== "verifica").length, ver = punti.length - gcp;
  const fatti = punti.filter((p) => p.posato).length;
  return (
    <div style={{ marginTop: 12, ...scheda }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 13.5 }}>📍 Punti di controllo a terra</strong>
        <span style={{ fontSize: 12, color: "#8b95a3" }}>{gcp} GCP · {ver} di verifica · {fatti}/{punti.length} posati {stato && `· ${stato}`}</span>
      </div>
      <div style={{ marginTop: 8 }}><label style={etichetta}>Sistema di riferimento delle coordinate</label><input value={sistema} onChange={(e) => setSistema(e.target.value)} onBlur={() => salva(punti, sistema)} style={inputStyle} /></div>
      {punti.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 10 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, minWidth: 560, width: "100%" }}>
            <thead><tr style={{ color: "#8b95a3", textAlign: "left" }}>{["Nome", "X / Lat / Est", "Y / Lon / Nord", "Quota", "Tipo", "Posato", ""].map((t) => <th key={t} style={{ padding: "4px 6px", fontWeight: 600 }}>{t}</th>)}</tr></thead>
            <tbody>{punti.map((p, i) => (
              <tr key={i} style={{ borderTop: "1px solid #232b3f" }}>
                {["nome", "x", "y", "z"].map((k) => <td key={k} style={{ padding: 4 }}><input value={p[k]} onChange={(e) => setPunti(punti.map((q, j) => (j === i ? { ...q, [k]: e.target.value } : q)))} onBlur={() => salva(punti)} style={{ ...inputStyle, padding: "5px 7px", minWidth: k === "nome" ? 70 : 100 }} /></td>)}
                <td style={{ padding: 4 }}><select value={p.tipo} onChange={(e) => cambia(i, "tipo", e.target.value)} style={{ ...inputStyle, padding: "5px 7px" }}><option value="GCP">GCP</option><option value="verifica">Verifica</option></select></td>
                <td style={{ padding: 4, textAlign: "center" }}><input type="checkbox" checked={!!p.posato} onChange={(e) => cambia(i, "posato", e.target.checked)} style={{ width: 20, height: 20 }} aria-label={`Punto ${p.nome} posato`} /></td>
                <td style={{ padding: 4 }}><button type="button" onClick={() => salva(punti.filter((_, j) => j !== i))} aria-label={`Togli ${p.nome}`} style={{ background: "none", border: "none", color: "#ff9c9c", fontSize: 16 }}>×</button></td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button type="button" onClick={() => salva([...punti, { nome: `P${punti.length + 1}`, x: "", y: "", z: "", tipo: "GCP", posato: false }])} style={btn(false)}>＋ Punto</button>
        <button type="button" onClick={() => setIncolla(incolla == null ? "" : null)} style={btn(false)}>📋 Incolla dal ricevitore GNSS</button>
        {punti.length > 0 && <button type="button" onClick={() => scarica(csvPunti(punti, "pix4d"), `gcp-${volo.data || "rilievo"}.csv`)} style={btn(false)}>⬇️ CSV per Pix4D / Metashape</button>}
        {punti.length > 0 && <button type="button" onClick={() => scarica(csvPunti(punti, "webodm"), `gcp-${volo.data || "rilievo"}.txt`, "text/plain")} style={btn(false)}>⬇️ Elenco per WebODM</button>}
      </div>
      {incolla != null && (
        <div style={{ marginTop: 10 }}>
          <textarea value={incolla} onChange={(e) => setIncolla(e.target.value)} rows={5} placeholder={"Una riga per punto: nome, X, Y, quota\nGCP1;45.0703;7.6869;239.12"} style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace" }} />
          <button type="button" onClick={() => { const nuovi = leggiCsvPunti(incolla); if (!nuovi.length) { setStato("Non ho trovato punti: controlla il formato."); return; } salva([...punti, ...nuovi]); setIncolla(null); }} style={{ ...btn(true), marginTop: 6 }}>Aggiungi i punti</button>
        </div>
      )}
      <p style={{ fontSize: 11, color: "#6b7480", margin: "8px 0 0 0", lineHeight: 1.45 }}>Nel programma di elaborazione importi il CSV e poi segni ogni punto nelle foto. Per qualche ettaro bastano 6-8 GCP ben distribuiti, anche ai bordi, più 2-3 punti di verifica.</p>
    </div>
  );
}

// --- 3. Volumi dei cumuli ------------------------------------------------------------------------------------
export function VolumiCumuli({ inputStyle }) {
  const [forma, setForma] = useState("cono");
  const [v, setV] = useState({ diametro: "10", altezza: "3", lunghezza: "20", larghezza: "8", lunghezzaSopra: "14", larghezzaSopra: "4" });
  const [materiale, setMateriale] = useState("1.6");
  const [densitaLibera, setDensitaLibera] = useState("");
  const [dsm, setDsm] = useState(null);
  const [base, setBase] = useState("");
  const [fileDsm, setFileDsm] = useState(null);
  const tela = useRef(null);
  const F = FORME_CUMULO.find((x) => x.key === forma);
  const valori = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x) || 0]));
  const volRapido = F.volume(valori);
  const densita = materiale === "" ? num(densitaLibera) : Number(materiale);
  const calcolaDsm = async (file, quota) => {
    setDsm("calcolo");
    try { setDsm(await volumeDaDsm(file, { base: quota })); } catch (e) { setDsm({ errore: e.message || "Non riesco a leggere il file." }); }
  };
  useEffect(() => {
    const c = tela.current; if (!c || !dsm || !dsm.anteprima) return;
    const { w, h, dati } = dsm.anteprima; c.width = w; c.height = h;
    c.getContext("2d").putImageData(new ImageData(dati, w, h), 0, 0);
  }, [dsm]);
  const t = (m3) => (densita ? ` · circa ${f1(m3 * densita, 0)} t` : "");
  return (
    <div style={scheda}>
      <strong style={{ fontSize: 13.5 }}>📏 Stima veloce sul posto</strong>
      <p style={{ fontSize: 12, color: "#8b95a3", margin: "4px 0 10px 0" }}>Per un preventivo al volo: scegli la forma del cumulo e misura base e altezza (anche dalla foto del drone).</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 220px" }}><label style={etichetta}>Forma</label><select value={forma} onChange={(e) => setForma(e.target.value)} style={inputStyle}>{FORME_CUMULO.map((x) => <option key={x.key} value={x.key}>{x.nome}</option>)}</select></div>
        <div style={{ flex: "1 1 160px" }}><label style={etichetta}>Materiale (densità)</label><select value={materiale} onChange={(e) => setMateriale(e.target.value)} style={inputStyle}>{MATERIALI.map(([n, d]) => <option key={n} value={d == null ? "" : String(d)}>{n}{d ? ` · ${String(d).replace(".", ",")} t/m³` : ""}</option>)}</select></div>
        {materiale === "" && <div style={{ flex: "1 1 120px" }}><label style={etichetta}>Densità (t/m³)</label><input inputMode="decimal" value={densitaLibera} onChange={(e) => setDensitaLibera(e.target.value)} style={inputStyle} /></div>}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
        {F.campi.map(([k, et, u]) => <div key={k} style={{ flex: "1 1 120px" }}><label style={etichetta}>{et} ({u})</label><input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={inputStyle} /></div>)}
      </div>
      <div className="mono" style={{ fontSize: 15, marginTop: 10 }}>📦 circa <strong style={{ color: "#ff8c42" }}>{f1(volRapido, 1)} m³</strong>{t(volRapido)}</div>

      <div style={{ borderTop: "1px solid #232b3f", marginTop: 14, paddingTop: 14 }}>
        <strong style={{ fontSize: 13.5 }}>🗻 Volume preciso dal modello (DSM)</strong>
        <p style={{ fontSize: 12, color: "#8b95a3", margin: "4px 0 10px 0", lineHeight: 1.5 }}>Dal programma di elaborazione (WebODM, Pix4D, Metashape, DJI Terra) esporta il DSM in GeoTIFF <strong>ritagliato attorno al cumulo</strong>, con un po' di terreno intorno. La base la calcolo dal bordo, oppure scrivila tu.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ ...btn(true), display: "inline-block" }}>🗂️ Scegli il DSM (.tif)<input type="file" accept=".tif,.tiff,image/tiff" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) { setFileDsm(f); calcolaDsm(f, num(base)); } }} style={{ display: "none" }} /></label>
          <div style={{ flex: "1 1 160px" }}><label style={etichetta}>Quota della base (facoltativa, m)</label><input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)} onBlur={() => fileDsm && calcolaDsm(fileDsm, num(base))} placeholder="automatica dal bordo" style={inputStyle} /></div>
        </div>
        {dsm === "calcolo" && <p style={{ fontSize: 12.5, color: "#8b95a3", marginTop: 10 }}>Calcolo il volume…</p>}
        {dsm && dsm.errore && <p style={{ fontSize: 12.5, color: "#ffd68a", marginTop: 10 }}>⚠️ {dsm.errore}</p>}
        {dsm && dsm.sopra != null && (
          <div style={{ marginTop: 12 }}>
            <div className="mono" style={{ display: "flex", gap: "6px 18px", flexWrap: "wrap", fontSize: 14 }}>
              <span>⬆️ sopra la base: <strong style={{ color: "#ff8c42" }}>{f1(dsm.sopra, 1)} m³</strong>{t(dsm.sopra)}</span>
              {dsm.sotto > 0.5 && <span>⬇️ sotto la base (scavo): {f1(dsm.sotto, 1)} m³</span>}
              <span>📐 impronta {f1(dsm.area, 0)} m²</span>
              <span>base {f1(dsm.quotaBase, 2)} m · cima {f1(dsm.zMax, 2)} m</span>
              <span>pixel {f1(dsm.risoluzione * 100, 1)} cm</span>
            </div>
            <canvas ref={tela} style={{ marginTop: 10, maxWidth: "100%", width: 360, imageRendering: "pixelated", borderRadius: 8, border: "1px solid #2a3349" }} />
            <p style={{ fontSize: 11, color: "#6b7480", margin: "6px 0 0 0", lineHeight: 1.45 }}>In arancione quello che sta sopra la base. {dsm.geografico ? "Il file è in gradi: ho convertito la dimensione dei pixel in metri (precisione un po' minore: meglio esportare in UTM). " : ""}La precisione dipende dal rilievo (GCP o RTK) e dalla scelta della base.</p>
          </div>
        )}
      </div>
    </div>
  );
}
