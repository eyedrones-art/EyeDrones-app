// «Avvisami quando finisce»: il pilota segna un NOTAM; quando la data di fine passa lo avviso in Home
// e, se vuole, mette la fine nel calendario del telefono (così la notifica arriva anche ad app chiusa)
import React, { useState } from "react";
import { datiCalendarioPiano, PulsantiCalendario } from "./calendario.jsx";

const CHIAVE = "eyedrones_avvisi_notam";
export const leggiAvvisiNotam = () => { try { const l = JSON.parse(localStorage.getItem(CHIAVE) || "[]"); return Array.isArray(l) ? l : []; } catch { return []; } };
const scrivi = (l) => { try { localStorage.setItem(CHIAVE, JSON.stringify(l)); } catch { /* niente */ } };
export const fineNotam = (z) => (z && z.validita ? z.validita.map((v) => v.a).filter(Boolean).sort().pop() : null) || null;
const quando = (t) => new Date(t).toLocaleString("it-IT", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const due = (n) => String(n).padStart(2, "0");

export function AvvisaFineNotam({ zona, posto = "" }) {
  const fine = fineNotam(zona);
  const id = zona.id || zona.nome;
  const [attivo, setAttivo] = useState(() => leggiAvvisiNotam().some((a) => a.id === id));
  if (!fine || new Date(fine).getTime() < Date.now()) return null;
  const d = new Date(fine);
  const titolo = `✅ Finito il ${zona.nome}${posto ? ` (${posto})` : ""}: si torna a volare`;
  const calendario = { ...datiCalendarioPiano({ data: `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`, ora: `${due(d.getHours())}:${due(d.getMinutes())}`, titolo, luogo: posto, dettagli: "Prima di volare riscarica il file zone di D-Flight in EyeDrones: potrebbe esserci un NOTAM nuovo.\nhttps://app.eyedrones.it" }), avvisoSubito: true, nomeFile: "fine-notam.ics" };
  const segna = (si) => {
    const altri = leggiAvvisiNotam().filter((a) => a.id !== id);
    scrivi(si ? [...altri, { id, nome: zona.nome, fine, posto }] : altri);
    setAttivo(si);
  };
  const bottone = { background: "#1d2633", border: "1px solid #3d8bfd66", color: "#9fc5ff", borderRadius: 6, padding: "6px 11px", fontSize: 12, fontWeight: 600 };
  return (
    <div style={{ marginTop: 8, fontSize: 12, color: "#c3cad4" }}>
      {!attivo ? (
        <button type="button" onClick={() => segna(true)} style={bottone}>🔔 Avvisami quando finisce</button>
      ) : (
        <div style={{ background: "#141c28", border: "1px solid #3d8bfd44", borderRadius: 8, padding: "8px 10px" }}>
          <div>🔔 <strong>Ti avviso</strong> qui nell'app quando finisce, il {quando(fine)}.</div>
          <div style={{ color: "#8b95a3", margin: "4px 0" }}>Per avere la notifica sul telefono anche ad app chiusa, mettilo nel calendario:</div>
          <PulsantiCalendario dati={calendario} compatto />
          <button type="button" onClick={() => segna(false)} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 11.5, padding: 0, marginTop: 4, textDecoration: "underline" }}>Non avvisarmi più</button>
        </div>
      )}
    </div>
  );
}

// in Home: i NOTAM segnati che sono finiti
export function NotamFiniti() {
  const [lista, setLista] = useState(leggiAvvisiNotam);
  const finiti = lista.filter((a) => new Date(a.fine).getTime() < Date.now());
  if (finiti.length === 0) return null;
  const ok = (id) => { const l = lista.filter((a) => a.id !== id); scrivi(l); setLista(l); };
  return finiti.map((a) => (
    <div key={a.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#0f2a1c", border: "1px solid #4ade8066", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#d7f5e3" }}>
      <span style={{ fontSize: 18 }}>✅</span>
      <span style={{ flex: 1 }}><strong>È finito il {a.nome}</strong>{a.posto ? ` (${a.posto})` : ""}: da adesso lì quel divieto non c'è più. Prima di volare riscarica il file zone di D-Flight: potrebbe essere uscito un NOTAM nuovo.</span>
      <button type="button" onClick={() => ok(a.id)} style={{ background: "none", border: "1px solid #4ade8066", color: "#4ade80", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600 }}>Ok</button>
    </div>
  ));
}
