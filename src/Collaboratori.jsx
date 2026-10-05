import React, { useState, useEffect } from "react";

// «Collaboratori»: la rubrica privata dei piloti con cui lavori (secondo operatore, sostituti, chi copre altre zone).
// Ognuno vede solo i suoi: dove lavorano, fin dove si spostano, cosa fanno e con quali attestati.

const PROVINCE = "AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV".split(" ");
const STATI = [
  { key: "contatto", label: "Contatto", colore: "#3d8bfd" },
  { key: "prova", label: "In prova", colore: "#f5b942" },
  { key: "collabora", label: "Collabora", colore: "#4ade80" },
  { key: "non_adatto", label: "Non adatto ora", colore: "#8b95a3" },
];
const ATTESTATI_PRONTI = ["Attestato A1/A3", "Certificato A2", "Dichiarazione STS", "Autorizzazione categoria Specifica", "Termografia", "Assicurazione RC"];
const FILTRI_ATTESTATO = [
  { key: "A1/A3", test: /a1\s*\/?\s*a3/i },
  { key: "A2", test: /\ba2\b/i },
  { key: "STS / Specifica", test: /sts|specifica|pdra/i },
  { key: "Termografia", test: /termograf/i },
  { key: "Assicurazione", test: /assicura/i },
];
const scaduto = (d) => d && d < new Date().toISOString().slice(0, 10);
const numeroWa = (t) => { let n = String(t || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, ""); if (/^3\d{8,9}$/.test(n) || /^0\d{5,10}$/.test(n)) n = "39" + n; return n.length >= 8 ? n : ""; };

const stCard = { background: "#1b2028", border: "1px solid #2b313d", borderRadius: 10, padding: "14px 16px" };
const stChip = (on) => ({ background: on ? "#ff8c42" : "#1f2530", color: on ? "#161a1f" : "#e7eaee", border: on ? "none" : "1px solid #333a45", borderRadius: 16, padding: "5px 11px", fontSize: 12, fontWeight: on ? 700 : 500, whiteSpace: "nowrap" });
const stLabel = { fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 };
const stLink = { fontSize: 12, color: "#3d8bfd", textDecoration: "none", border: "1px solid #2b313d", borderRadius: 5, padding: "4px 8px" };
const VUOTO = { nome: "", citta: "", provincia: "", raggio_km: 50, servizi: [], attestati: [], droni: "", esperienza: "", disponibilita: "", portfolio: "", telefono: "", email: "", stato: "contatto", note: "" };

export default function Collaboratori({ supabase, inputStyle, servizi = [] }) {
  const [righe, setRighe] = useState(null);
  const [errore, setErrore] = useState(null);
  const [form, setForm] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [cerca, setCerca] = useState("");
  const [provincia, setProvincia] = useState("");
  const [servizio, setServizio] = useState("");
  const [attestato, setAttestato] = useState("");
  const [stato, setStato] = useState("");
  const [aperto, setAperto] = useState(null);

  const carica = async () => {
    const { data, error } = await supabase.from("collaboratori").select("*").order("nome", { ascending: true });
    if (error) { setErrore(/relation|schema cache/i.test(error.message) ? "Per usare i collaboratori esegui prima lo script supabase/pagamenti-collaboratori.sql su Supabase." : error.message); setRighe([]); return; }
    setRighe(data || []);
  };
  useEffect(() => { carica(); }, []);

  const salva = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true);
    const riga = {
      ...form, nome: form.nome.trim(), provincia: form.provincia || null, raggio_km: Number(form.raggio_km) || null,
      attestati: form.attestati.filter((a) => a.tipo.trim()), aggiornato_il: new Date().toISOString(),
    };
    const { error } = editingId ? await supabase.from("collaboratori").update(riga).eq("id", editingId) : await supabase.from("collaboratori").insert(riga);
    setSalvando(false);
    if (error) { alert(/relation|schema cache/i.test(error.message) ? "Esegui prima lo script supabase/pagamenti-collaboratori.sql su Supabase." : "Salvataggio non riuscito: " + error.message); return; }
    setForm(null); setEditingId(null); carica();
  };
  const cambiaStato = async (r, s) => {
    setRighe(righe.map((x) => (x.id === r.id ? { ...x, stato: s } : x)));
    await supabase.from("collaboratori").update({ stato: s }).eq("id", r.id);
  };
  const elimina = async (r) => {
    if (!window.confirm(`Togliere ${r.nome} dai collaboratori?`)) return;
    await supabase.from("collaboratori").delete().eq("id", r.id);
    carica();
  };

  if (!righe) return <div style={{ padding: 32, color: "#8b95a3" }}>Carico…</div>;
  const valido = (r, f) => (r.attestati || []).some((a) => f.test.test(a.tipo || "") && !scaduto(a.scadenza));
  const elenco = righe.filter((r) => {
    const testo = [r.nome, r.citta, r.provincia, r.note, r.esperienza, r.droni, ...(r.servizi || [])].join(" ").toLowerCase();
    if (cerca && !testo.includes(cerca.toLowerCase())) return false;
    if (provincia && r.provincia !== provincia) return false;
    if (servizio && !(r.servizi || []).includes(servizio)) return false;
    if (attestato && !valido(r, FILTRI_ATTESTATO.find((f) => f.key === attestato))) return false;
    if (stato && (r.stato || "contatto") !== stato) return false;
    return true;
  });
  const perProvincia = Object.entries(righe.reduce((m, r) => { if (r.provincia) m[r.provincia] = (m[r.provincia] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const campo = (k, label, extra = {}) => (
    <div style={{ flex: "1 1 200px" }}>
      <label style={stLabel}>{label}</label>
      <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={inputStyle} {...extra} />
    </div>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Collaboratori</h1>
        <button type="button" onClick={() => { setForm(form ? null : { ...VUOTO }); setEditingId(null); }} style={{ background: form ? "transparent" : "#ff8c42", color: form ? "#8b95a3" : "#161a1f", border: form ? "1px solid #333a45" : "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>{form ? "Annulla" : "+ Nuovo collaboratore"}</button>
      </div>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 14px 0" }}>I piloti con cui lavori o vorresti lavorare: dove sono, fin dove si spostano, cosa fanno e con quali attestati. Li vedi solo tu.</p>
      {errore && <div style={{ ...stCard, color: "#f5b942", fontSize: 12.5, marginBottom: 12 }}>{errore}</div>}

      {form && (
        <div style={{ ...stCard, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{campo("nome", "Nome o studio *", { placeholder: "es. Geom. Andrea Curci" })}{campo("citta", "Città")}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label style={stLabel}>Provincia</label>
              <select value={form.provincia || ""} onChange={(e) => setForm({ ...form, provincia: e.target.value })} style={inputStyle}>
                <option value="">—</option>{PROVINCE.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {campo("raggio_km", "Fino a quanti km si sposta", { type: "number", min: 0 })}
          </div>
          <div>
            <label style={stLabel}>Cosa fa</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {servizi.map((s) => <button key={s} type="button" onClick={() => setForm({ ...form, servizi: form.servizi.includes(s) ? form.servizi.filter((x) => x !== s) : [...form.servizi, s] })} style={stChip(form.servizi.includes(s))}>{s}</button>)}
            </div>
          </div>
          <div>
            <label style={stLabel}>Attestati (con scadenza, se la sai)</label>
            {form.attestati.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input value={a.tipo} onChange={(e) => setForm({ ...form, attestati: form.attestati.map((x, j) => (j === i ? { ...x, tipo: e.target.value } : x)) })} style={{ ...inputStyle, flex: 2 }} />
                <input type="date" value={a.scadenza || ""} onChange={(e) => setForm({ ...form, attestati: form.attestati.map((x, j) => (j === i ? { ...x, scadenza: e.target.value || null } : x)) })} style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={() => setForm({ ...form, attestati: form.attestati.filter((_, j) => j !== i) })} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 6, padding: "0 10px" }}>×</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ATTESTATI_PRONTI.filter((t) => !form.attestati.some((a) => a.tipo === t)).map((t) => <button key={t} type="button" onClick={() => setForm({ ...form, attestati: [...form.attestati, { tipo: t, scadenza: null }] })} style={stChip(false)}>+ {t}</button>)}
              <button type="button" onClick={() => setForm({ ...form, attestati: [...form.attestati, { tipo: "", scadenza: null }] })} style={stChip(false)}>+ Altro</button>
            </div>
          </div>
          {campo("droni", "Droni e attrezzatura", { placeholder: "es. Mavic 3 Enterprise RTK, laser scanner, GCP" })}
          {campo("esperienza", "Esperienza", { placeholder: "es. geometra da 20 anni, rilievi e fotogrammetria" })}
          {campo("disponibilita", "Disponibilità", { placeholder: "es. weekend, trasferte" })}
          {campo("portfolio", "Portfolio o sito")}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{campo("telefono", "Telefono / WhatsApp", { type: "tel" })}{campo("email", "Email", { type: "email" })}</div>
          <div>
            <label style={stLabel}>Note</label>
            <textarea rows={2} value={form.note || ""} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="es. molto preciso nei rilievi, tariffa concordata, ha P.IVA" style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <button type="button" onClick={salva} disabled={!form.nome.trim() || salvando} style={{ background: form.nome.trim() ? "#ff8c42" : "#333a45", color: form.nome.trim() ? "#161a1f" : "#6b7480", border: "none", borderRadius: 6, padding: "10px 0", fontSize: 13.5, fontWeight: 700 }}>{salvando ? "Salvataggio..." : editingId ? "Aggiorna" : "Salva collaboratore"}</button>
        </div>
      )}

      {righe.length > 0 && (
        <>
          {perProvincia.length > 1 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11.5, color: "#8b95a3" }}>📍</span>
              {perProvincia.map(([p, n]) => <button key={p} type="button" onClick={() => setProvincia(provincia === p ? "" : p)} style={stChip(provincia === p)}>{p} · {n}</button>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            {righe.length > 5 && <input placeholder="🔍 Cerca nome, città, esperienza..." value={cerca} onChange={(e) => setCerca(e.target.value)} style={{ ...inputStyle, flex: "1 1 220px", maxWidth: 320 }} />}
            <select value={servizio} onChange={(e) => setServizio(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="">Tutti i servizi</option>{servizi.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={attestato} onChange={(e) => setAttestato(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="">Tutti gli attestati</option>{FILTRI_ATTESTATO.map((f) => <option key={f.key} value={f.key}>🪪 {f.key} valido</option>)}
            </select>
            <select value={stato} onChange={(e) => setStato(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="">Tutti gli stati</option>{STATI.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </>
      )}

      {righe.length === 0 && !errore && !form && <div style={{ ...stCard, color: "#8b95a3", fontSize: 13, textAlign: "center" }}>Nessun collaboratore ancora. Aggiungi i piloti che ti contattano o con cui lavori: così, quando arriva un lavoro lontano, sai subito chi chiamare.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {elenco.map((r) => {
          const st = STATI.find((s) => s.key === (r.stato || "contatto")) || STATI[0];
          const ap = aperto === r.id;
          const wa = numeroWa(r.telefono);
          return (
            <div key={r.id} style={stCard}>
              <div onClick={() => setAperto(ap ? null : r.id)} style={{ cursor: "pointer" }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.nome} <span style={{ fontSize: 11, fontWeight: 700, color: st.colore, border: `1px solid ${st.colore}66`, borderRadius: 10, padding: "1px 8px", marginLeft: 4 }}>{st.label}</span></div>
                <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>📍 {[r.citta, r.provincia].filter(Boolean).join(" · ") || "zona non indicata"}{r.raggio_km ? ` · fino a ${r.raggio_km} km` : ""}</div>
                {(r.servizi || []).length > 0 && <div style={{ fontSize: 12, color: "#c3cad4", marginTop: 4 }}>{r.servizi.join(" · ")}</div>}
                {(r.attestati || []).length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {r.attestati.map((a, i) => <span key={i} style={{ fontSize: 11, color: scaduto(a.scadenza) ? "#ff9c9c" : "#4ade80", border: `1px solid ${scaduto(a.scadenza) ? "#5a2a2a" : "#2c5a3a"}`, borderRadius: 10, padding: "1px 8px" }}>{a.tipo}{scaduto(a.scadenza) ? " · scaduto" : ""}</span>)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={stLink}>💬 WhatsApp</a>}
                {r.email && <a href={`mailto:${r.email}`} style={stLink}>✉️ Email</a>}
                {r.portfolio && <a href={/^https?:\/\//.test(r.portfolio) ? r.portfolio : `https://${r.portfolio}`} target="_blank" rel="noreferrer" style={stLink}>🎬 Portfolio</a>}
              </div>
              {ap && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2b313d", display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "#c3cad4" }}>
                  {r.droni && <div>🚁 {r.droni}</div>}
                  {r.esperienza && <div>🎓 {r.esperienza}</div>}
                  {r.disponibilita && <div>🗓️ {r.disponibilita}</div>}
                  {r.telefono && <div>📞 {r.telefono}</div>}
                  {r.note && <div>📝 {r.note}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {STATI.map((s) => <button key={s.key} type="button" onClick={() => cambiaStato(r, s.key)} style={stChip((r.stato || "contatto") === s.key)}>{s.label}</button>)}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" onClick={() => { setForm({ ...VUOTO, ...Object.fromEntries(Object.keys(VUOTO).map((k) => [k, r[k] ?? VUOTO[k]])) }); setEditingId(r.id); window.scrollTo(0, 0); }} style={{ background: "none", border: "1px solid #333a45", color: "#c3cad4", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>Modifica</button>
                    <button type="button" onClick={() => elimina(r)} style={{ background: "none", border: "1px solid #333a45", color: "#ff9c9c", borderRadius: 5, padding: "5px 10px", fontSize: 11.5 }}>Togli</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
