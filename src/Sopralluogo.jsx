import React, { Suspense, lazy, useState } from "react";

// «Sopralluogo»: quello che si guarda prima del lavoro (matrimoni, eventi, FPV, pubblicità, ispezioni).
// Si salva nel piano (checklist_stato.sopralluogo = { voci, note, punti, orari }).
const MappaSopralluogo = lazy(() => import("./MappaSopralluogo.jsx"));

export const SOPRALLUOGO_VUOTO = { voci: {}, note: "", punti: [], orari: [] };

const VOCI = [
  { id: "decollo", testo: "Punto di decollo e atterraggio scelto: piano, libero, lontano dalle persone" },
  { id: "ostacoli", testo: "Ostacoli segnati: fili, alberi, antenne, lampioni" },
  { id: "persone", testo: "Dove staranno le persone e da dove passeranno" },
  { id: "zona", testo: "Zona D-Flight controllata (e permessi chiesti, se servono)" },
  { id: "proprietario", testo: "Permesso del proprietario o del custode per decollare" },
  { id: "accesso", testo: "Parcheggio e accesso con l'attrezzatura" },
  { id: "segnale", testo: "Segnale GPS e disturbi (antenne, wi-fi, strutture in metallo)" },
  { id: "sole", testo: "Luce: dove sarà il sole all'ora delle riprese" },
  { id: "pioggia", testo: "Piano B se piove o c'è troppo vento" },
  { id: "referente", testo: "Contatto del referente sul posto (custode, wedding planner, organizzatore)" },
];
const VOCE_FPV = { id: "fpv", testo: "FPV: spazio di sicurezza, osservatore accanto e percorso provato senza persone" };

export const TIPI_PUNTO = {
  decollo: { emoji: "🛫", nome: "Decollo", colore: "#4ade80" },
  ostacolo: { emoji: "⚠️", nome: "Ostacolo", colore: "#ff4d4d" },
  persone: { emoji: "👥", nome: "Persone", colore: "#3d8bfd" },
  parcheggio: { emoji: "🅿️", nome: "Parcheggio", colore: "#a8a2bd" },
  altro: { emoji: "📍", nome: "Altro", colore: "#f5b942" },
};
export const vociSopralluogo = (tipo) => (tipo === "fpv" ? [...VOCI, VOCE_FPV] : VOCI);

const nuovoId = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const minuti = (h) => { const m = /^(\d{1,2}):(\d{2})/.exec(h || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; };

export default function Sopralluogo({ tipo, dati, onCambia, scene, centro, sole, mostraOrari }) {
  const d = { ...SOPRALLUOGO_VUOTO, ...(dati || {}) };
  const set = (campo, valore) => onCambia({ ...d, [campo]: valore });
  const voci = vociSopralluogo(tipo);
  const fatte = voci.filter((v) => d.voci[v.id]).length;
  const [tipoPunto, setTipoPunto] = useState("decollo");
  const [mappa, setMappa] = useState(false);
  const [gps, setGps] = useState(false);
  const [nuovoOrario, setNuovoOrario] = useState({ ora: "", evento: "" });

  const aggiungiPunto = (lat, lon) => set("punti", [...d.punti, { id: nuovoId("p"), tipo: tipoPunto, lat, lon, nota: "" }]);
  const puntoQui = () => {
    if (!navigator.geolocation) { alert("Questo telefono non dà la posizione."); return; }
    setGps(true);
    navigator.geolocation.getCurrentPosition((p) => { setGps(false); aggiungiPunto(p.coords.latitude, p.coords.longitude); }, () => { setGps(false); alert("Non riesco a leggere la posizione: controlla il permesso del GPS."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 });
  };
  const cambiaPunto = (id, campo, v) => set("punti", d.punti.map((p) => (p.id === id ? { ...p, [campo]: v } : p)));
  const aggiungiOrario = () => {
    if (!nuovoOrario.ora || !nuovoOrario.evento.trim()) return;
    set("orari", [...d.orari, { id: nuovoId("o"), ora: nuovoOrario.ora, evento: nuovoOrario.evento.trim() }].sort((a, b) => minuti(a.ora) - minuti(b.ora)));
    setNuovoOrario({ ora: "", evento: "" });
  };
  // giornata: orari dell'evento e scene con l'ora, tutti insieme in ordine
  const giornata = [
    ...d.orari.map((o) => ({ ora: o.ora, testo: o.evento, scena: false })),
    ...(scene || []).filter((s) => s.ora).map((s) => ({ ora: s.ora, testo: s.titolo || "Scena", scena: true })),
  ].sort((a, b) => minuti(a.ora) - minuti(b.ora));

  const campo = { background: "#12151a", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 5, padding: "6px 8px", fontSize: 12.5, boxSizing: "border-box", minHeight: 36 };
  const titoletto = { fontSize: 13, fontWeight: 700, color: "#7fb0ff", margin: "14px 0 6px 0" };
  const puntiMappa = [
    ...d.punti,
    ...(scene || []).filter((s) => s.foto && s.foto.lat != null).map((s, i) => ({ id: "s-" + s.id, tipo: "scena", lat: s.foto.lat, lon: s.foto.lon, nota: s.titolo || `Scena ${i + 1}` })),
  ];

  return (
    <details style={{ background: "#141c26", border: "1px solid #2a4562", borderRadius: 8, padding: "10px 14px", margin: "14px 0" }}>
      <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#7fb0ff" }}>📋 Sopralluogo · {fatte} di {voci.length}{d.punti.length ? ` · ${d.punti.length} punti` : ""}</summary>
      <p style={{ fontSize: 12, color: "#9fb4d6", margin: "6px 0 0 0" }}>Quando vai a vedere il posto prima del lavoro: spunta, segna i punti e scrivi le note. Ritrovi tutto il giorno del volo.</p>

      <div style={titoletto}>✅ Cosa controllare</div>
      {voci.map((v) => (
        <label key={v.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: d.voci[v.id] ? "#6b7480" : "#e7eaee", padding: "5px 0", cursor: "pointer", textDecoration: d.voci[v.id] ? "line-through" : "none" }}>
          <input type="checkbox" checked={!!d.voci[v.id]} onChange={() => set("voci", { ...d.voci, [v.id]: !d.voci[v.id] })} style={{ width: 18, height: 18, flex: "none", marginTop: 1 }} /> {v.testo}
        </label>
      ))}

      {mostraOrari && (
        <>
          <div style={titoletto}>🕐 Orari della giornata</div>
          <div style={{ fontSize: 11.5, color: "#9fb4d6", marginBottom: 6 }}>Es. cerimonia 16:00, uscita 16:45, foto sposi 18:30. Le scene con l'ora finiscono qui in mezzo, in ordine.</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input type="time" value={nuovoOrario.ora} onChange={(e) => setNuovoOrario({ ...nuovoOrario, ora: e.target.value })} aria-label="Ora" style={{ ...campo, width: 110 }} />
            <input value={nuovoOrario.evento} onChange={(e) => setNuovoOrario({ ...nuovoOrario, evento: e.target.value })} onKeyDown={(e) => e.key === "Enter" && aggiungiOrario()} placeholder="Cosa succede (es. uscita dalla chiesa)" style={{ ...campo, flex: 1, minWidth: 170 }} />
            <button type="button" onClick={aggiungiOrario} style={{ background: "#2a4562", color: "#e7eaee", border: "none", borderRadius: 5, padding: "0 14px", fontSize: 12.5, fontWeight: 700, minHeight: 36 }}>＋ Aggiungi</button>
          </div>
          {giornata.length > 0 && (
            <div style={{ marginTop: 8, borderLeft: "2px solid #2a4562", paddingLeft: 10 }}>
              {giornata.map((g, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, padding: "4px 0" }}>
                  <strong style={{ width: 44, color: g.scena ? "#c4b5fd" : "#7fb0ff" }}>{g.ora}</strong>
                  <span style={{ flex: 1, color: g.scena ? "#c4b5fd" : "#e7eaee" }}>{g.scena ? "🎬 " : ""}{g.testo}</span>
                  {!g.scena && <button type="button" onClick={() => set("orari", d.orari.filter((o) => !(o.ora === g.ora && o.evento === g.testo)))} aria-label={`Togli ${g.testo}`} style={{ background: "none", border: "none", color: "#6b7480", fontSize: 15, minWidth: 32, minHeight: 32 }}>×</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div style={titoletto}>📍 Punti sul posto</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {Object.entries(TIPI_PUNTO).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTipoPunto(k)} aria-pressed={tipoPunto === k} style={{ background: tipoPunto === k ? t.colore + "33" : "#1b2028", border: `1px solid ${tipoPunto === k ? t.colore : "#333a45"}`, color: "#e7eaee", borderRadius: 14, padding: "4px 10px", fontSize: 12, minHeight: 32 }}>{t.emoji} {t.nome}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <button type="button" onClick={puntoQui} disabled={gps} style={{ background: "#2a4562", color: "#e7eaee", border: "none", borderRadius: 6, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, minHeight: 40 }}>{gps ? "Leggo il GPS…" : `${TIPI_PUNTO[tipoPunto].emoji} Segna qui dove sono`}</button>
        <button type="button" onClick={() => setMappa(!mappa)} style={{ background: "none", border: "1px solid #2a4562", color: "#7fb0ff", borderRadius: 6, padding: "8px 12px", fontSize: 12.5, minHeight: 40 }}>{mappa ? "Chiudi la mappa" : "🗺️ Apri la mappa del sopralluogo"}</button>
      </div>
      {mappa && (
        <Suspense fallback={<p style={{ fontSize: 12, color: "#8b95a3" }}>Carico la mappa…</p>}>
          <MappaSopralluogo centro={centro} punti={puntiMappa} sole={sole} onTocca={aggiungiPunto} tipoNuovo={TIPI_PUNTO[tipoPunto]} />
        </Suspense>
      )}
      {d.punti.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {d.punti.map((p) => {
            const t = TIPI_PUNTO[p.tipo] || TIPI_PUNTO.altro;
            return (
              <div key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 16, width: 24, textAlign: "center" }} title={t.nome}>{t.emoji}</span>
                <input value={p.nota} onChange={(e) => cambiaPunto(p.id, "nota", e.target.value)} placeholder={`${t.nome}: cosa c'è (es. fili della luce a 8 m)`} style={{ ...campo, flex: 1, minWidth: 0 }} />
                <a href={`https://www.google.com/maps?q=${p.lat},${p.lon}`} target="_blank" rel="noreferrer" aria-label="Apri sulla mappa" style={{ color: "#7fb0ff", fontSize: 12, minWidth: 32, textAlign: "center" }}>↗</a>
                <button type="button" onClick={() => set("punti", d.punti.filter((x) => x.id !== p.id))} aria-label="Togli il punto" style={{ background: "none", border: "none", color: "#6b7480", fontSize: 16, minWidth: 32, minHeight: 32 }}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={titoletto}>📝 Note del sopralluogo</div>
      <textarea rows={3} value={d.note} onChange={(e) => set("note", e.target.value)} placeholder="es. il custode apre alle 14, decollo dal prato dietro la fontana, la luce sulla facciata arriva dopo le 17" style={{ ...campo, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
    </details>
  );
}
