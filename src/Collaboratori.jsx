import React, { useState, useEffect } from "react";

// «Collabora con EyeDrones»: il pilota si candida. «Rete piloti»: l'amministratore vede chi c'è, dove lavora, cosa fa e con quali attestati.
export const EMAIL_AMMINISTRATORI = ["eyedrones@libero.it", "ravinale.ivan@libero.it"];
export const eAmministratore = (email) => EMAIL_AMMINISTRATORI.includes(String(email || "").toLowerCase());

const PROVINCE = "AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV".split(" ");
const STATI = [
  { key: "nuova", label: "Nuova", colore: "#3d8bfd" },
  { key: "contattato", label: "Contattato", colore: "#f5b942" },
  { key: "collabora", label: "Collabora", colore: "#4ade80" },
  { key: "non_adatto", label: "Non adatto ora", colore: "#8b95a3" },
];
// famiglie di attestati per i filtri
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

export function CandidaturaCollaborazione({ supabase, inputStyle, attestati = [], droni = [], azienda, email, servizi = [] }) {
  const [form, setForm] = useState(null);
  const [esistente, setEsistente] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mancaTabella, setMancaTabella] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: c, error }, { data: pag }] = await Promise.all([
        supabase.from("candidature_collaborazione").select("*").maybeSingle(),
        supabase.from("pagine_pilota").select("*").maybeSingle(),
      ]);
      if (error && /candidature_collaborazione|relation|schema cache/i.test(error.message)) setMancaTabella(true);
      setEsistente(c || null);
      setForm({
        nome: c?.nome || pag?.nome || (azienda?.nome && azienda.nome !== "EyeDrones" ? azienda.nome : ""),
        citta: c?.citta || pag?.citta || "",
        provincia: c?.provincia || pag?.provincia || "",
        raggio_km: c?.raggio_km ?? pag?.raggio_km ?? 50,
        servizi: c?.servizi?.length ? c.servizi : pag?.servizi || [],
        esperienza: c?.esperienza || "",
        disponibilita: c?.disponibilita || "",
        portfolio: c?.portfolio || pag?.sito || pag?.instagram || "",
        telefono: c?.telefono || pag?.whatsapp || pag?.telefono || "",
        email: c?.email || pag?.email || email || "",
        note: c?.note || "",
        pagina_slug: pag?.attiva ? pag.slug : c?.pagina_slug || null,
      });
    })();
  }, []);

  const salva = async () => {
    if (!form.nome.trim()) return;
    setSalvando(true); setOk(false);
    const riga = {
      ...form,
      nome: form.nome.trim(),
      provincia: form.provincia || null,
      raggio_km: Number(form.raggio_km) || null,
      attestati: attestati.map((a) => ({ tipo: a.tipo, scadenza: a.data_scadenza || null })),
      droni: droni.map((d) => ({ nome: d.nome, classe: d.marcatura_classe || null })),
      aggiornata_il: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("candidature_collaborazione").upsert(riga, { onConflict: "user_id" }).select().single();
    setSalvando(false);
    if (error) { alert(/candidature_collaborazione|relation|schema cache/i.test(error.message) ? "La pagina non è ancora attiva: riprova tra qualche giorno." : "Invio non riuscito: " + error.message); return; }
    setEsistente(data); setOk(true);
  };
  const ritira = async () => {
    if (!window.confirm("Ritirare la tua candidatura?")) return;
    await supabase.from("candidature_collaborazione").delete().eq("user_id", esistente.user_id);
    setEsistente(null); setOk(false);
  };

  if (!form) return <div style={{ padding: 32, color: "#8b95a3" }}>Carico…</div>;
  const campo = (k, label, extra = {}) => (
    <div style={{ flex: "1 1 200px" }}>
      <label style={stLabel}>{label}</label>
      <input value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={inputStyle} {...extra} />
    </div>
  );
  return (
    <div style={{ padding: "28px 32px", maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Collabora con EyeDrones</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 16px 0" }}>Vuoi ricevere proposte di lavoro dalla rete EyeDrones nella tua zona? Lascia qui i tuoi dati: li vede solo il team EyeDrones, che ti scrive quando c'è un lavoro adatto a te.</p>
      {mancaTabella && <div style={{ ...stCard, borderColor: "#5a4a16", color: "#f5b942", fontSize: 12.5, marginBottom: 12 }}>La pagina non è ancora attiva: riprova tra qualche giorno.</div>}
      {esistente && <div style={{ ...stCard, borderColor: "#2c5a3a", background: "#14251b", color: "#bfe8cc", fontSize: 12.5, marginBottom: 12 }}>✓ {ok ? "Inviata! " : ""}Candidatura aggiornata il {new Date(esistente.aggiornata_il).toLocaleDateString("it-IT")}. Puoi modificarla quando vuoi: attestati e droni si aggiornano da soli quando la salvi.</div>}
      <div style={{ ...stCard, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{campo("nome", "Nome o nome dell'attività *")}{campo("citta", "Città")}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 120px" }}>
            <label style={stLabel}>Provincia</label>
            <select value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} style={inputStyle}>
              <option value="">—</option>{PROVINCE.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {campo("raggio_km", "Fino a quanti km ti sposti", { type: "number", min: 0 })}
        </div>
        <div>
          <label style={stLabel}>Cosa fai</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {servizi.map((s) => <button key={s} type="button" onClick={() => setForm({ ...form, servizi: form.servizi.includes(s) ? form.servizi.filter((x) => x !== s) : [...form.servizi, s] })} style={stChip(form.servizi.includes(s))}>{s}</button>)}
          </div>
        </div>
        <div>
          <label style={stLabel}>Attestati e droni (dai tuoi dati in EyeDrones)</label>
          <div style={{ fontSize: 12.5, color: "#c3cad4", lineHeight: 1.6 }}>
            {attestati.length ? attestati.map((a) => <span key={a.id} style={{ marginRight: 10, color: scaduto(a.data_scadenza) ? "#ff9c9c" : "#4ade80" }}>🪪 {a.tipo}{scaduto(a.data_scadenza) ? " (scaduto)" : ""}</span>) : <span style={{ color: "#8b95a3" }}>Nessun attestato: aggiungili nella pagina Attestati.</span>}
            <br />
            {droni.length ? droni.map((d) => <span key={d.id} style={{ marginRight: 10 }}>🚁 {d.nome}{d.marcatura_classe ? ` (${d.marcatura_classe})` : ""}</span>) : <span style={{ color: "#8b95a3" }}>Nessun drone: aggiungili in I miei droni.</span>}
          </div>
        </div>
        {campo("esperienza", "Esperienza", { placeholder: "es. 3 anni, 200 ore di volo, 40 matrimoni" })}
        {campo("disponibilita", "Disponibilità", { placeholder: "es. weekend, anche in settimana, trasferte" })}
        {campo("portfolio", "Portfolio (sito, Instagram, YouTube)")}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{campo("telefono", "Telefono / WhatsApp", { type: "tel" })}{campo("email", "Email", { type: "email" })}</div>
        <div>
          <label style={stLabel}>Note</label>
          <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Attrezzatura particolare, lingue, altro..." style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <button type="button" onClick={salva} disabled={!form.nome.trim() || salvando} style={{ background: form.nome.trim() ? "#ff8c42" : "#333a45", color: form.nome.trim() ? "#161a1f" : "#6b7480", border: "none", borderRadius: 6, padding: "10px 0", fontSize: 13.5, fontWeight: 700 }}>{salvando ? "Invio..." : esistente ? "Aggiorna la candidatura" : "Invia la candidatura"}</button>
        {esistente && <button type="button" onClick={ritira} style={{ background: "none", border: "none", color: "#ff9c9c", fontSize: 12 }}>Ritira la candidatura</button>}
        <p style={{ fontSize: 10.5, color: "#6b7480", margin: 0 }}>I tuoi dati restano tra te e il team EyeDrones e servono solo per proporti collaborazioni. Puoi ritirarli quando vuoi.</p>
      </div>
    </div>
  );
}

export function RetePiloti({ supabase, inputStyle, servizi = [] }) {
  const [righe, setRighe] = useState(null);
  const [note, setNote] = useState({});
  const [errore, setErrore] = useState(null);
  const [cerca, setCerca] = useState("");
  const [provincia, setProvincia] = useState("");
  const [servizio, setServizio] = useState("");
  const [attestato, setAttestato] = useState("");
  const [stato, setStato] = useState("");
  const [aperto, setAperto] = useState(null);

  const carica = async () => {
    const [{ data, error }, { data: n }] = await Promise.all([
      supabase.from("candidature_collaborazione").select("*").order("aggiornata_il", { ascending: false }),
      supabase.from("note_collaboratori").select("*"),
    ]);
    if (error) { setErrore(/relation|schema cache/i.test(error.message) ? "Esegui prima lo script supabase/pagamenti-collaboratori.sql su Supabase." : error.message); setRighe([]); return; }
    setRighe(data || []);
    setNote(Object.fromEntries((n || []).map((x) => [x.candidato_id, x])));
  };
  useEffect(() => { carica(); }, []);
  const salvaNota = async (id, cambi) => {
    const riga = { candidato_id: id, stato: note[id]?.stato || "nuova", nota: note[id]?.nota || null, ...cambi, aggiornata_il: new Date().toISOString() };
    setNote({ ...note, [id]: riga });
    const { error } = await supabase.from("note_collaboratori").upsert(riga, { onConflict: "candidato_id" });
    if (error) alert("Non salvato: " + error.message);
  };

  if (!righe) return <div style={{ padding: 32, color: "#8b95a3" }}>Carico…</div>;
  const valido = (r, f) => (r.attestati || []).some((a) => f.test.test(a.tipo || "") && !scaduto(a.scadenza));
  const elenco = righe.filter((r) => {
    const testo = [r.nome, r.citta, r.provincia, r.note, r.esperienza, ...(r.servizi || [])].join(" ").toLowerCase();
    if (cerca && !testo.includes(cerca.toLowerCase())) return false;
    if (provincia && r.provincia !== provincia) return false;
    if (servizio && !(r.servizi || []).includes(servizio)) return false;
    if (attestato && !valido(r, FILTRI_ATTESTATO.find((f) => f.key === attestato))) return false;
    if (stato && (note[r.user_id]?.stato || "nuova") !== stato) return false;
    return true;
  });
  const perProvincia = Object.entries(righe.reduce((m, r) => { const k = r.provincia || "?"; m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  const perServizio = servizi.map((s) => [s, righe.filter((r) => (r.servizi || []).includes(s)).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Rete piloti</h1>
      <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 14px 0" }}>Visibile solo a te. I piloti che si sono candidati da «Collabora con EyeDrones»: dove lavorano, cosa fanno e con quali attestati.</p>
      {errore && <div style={{ ...stCard, color: "#f5b942", fontSize: 12.5, marginBottom: 12 }}>{errore}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ ...stCard, flex: "1 1 260px", padding: "10px 14px" }}>
          <div style={{ fontSize: 11.5, color: "#8b95a3", marginBottom: 6 }}>📍 Dove sono ({righe.length} piloti)</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{perProvincia.map(([p, n]) => <button key={p} type="button" onClick={() => setProvincia(provincia === p ? "" : p)} style={stChip(provincia === p)}>{p} · {n}</button>)}</div>
        </div>
        <div style={{ ...stCard, flex: "1 1 260px", padding: "10px 14px" }}>
          <div style={{ fontSize: 11.5, color: "#8b95a3", marginBottom: 6 }}>🛠️ Cosa fanno</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{perServizio.map(([s, n]) => <button key={s} type="button" onClick={() => setServizio(servizio === s ? "" : s)} style={stChip(servizio === s)}>{s} · {n}</button>)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <input placeholder="🔍 Cerca nome, città, esperienza..." value={cerca} onChange={(e) => setCerca(e.target.value)} style={{ ...inputStyle, flex: "1 1 220px", maxWidth: 320 }} />
        {FILTRI_ATTESTATO.map((f) => <button key={f.key} type="button" onClick={() => setAttestato(attestato === f.key ? "" : f.key)} style={stChip(attestato === f.key)}>🪪 {f.key}</button>)}
        <select value={stato} onChange={(e) => setStato(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="">Tutti gli stati</option>{STATI.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div style={{ fontSize: 12, color: "#8b95a3", marginBottom: 8 }}>{elenco.length} {elenco.length === 1 ? "pilota" : "piloti"}{provincia || servizio || attestato || stato || cerca ? " con i filtri" : ""}</div>

      {righe.length === 0 && !errore && <div style={{ ...stCard, color: "#8b95a3", fontSize: 13, textAlign: "center" }}>Ancora nessuna candidatura. Ai piloti che ti scrivono manda il link: app.eyedrones.it → menu → «Collabora con EyeDrones».</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {elenco.map((r) => {
          const n = note[r.user_id] || {};
          const st = STATI.find((s) => s.key === (n.stato || "nuova"));
          const ap = aperto === r.user_id;
          const wa = numeroWa(r.telefono);
          return (
            <div key={r.user_id} style={stCard}>
              <div onClick={() => setAperto(ap ? null : r.user_id)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.nome} <span style={{ fontSize: 11, fontWeight: 700, color: st.colore, border: `1px solid ${st.colore}66`, borderRadius: 10, padding: "1px 8px", marginLeft: 4 }}>{st.label}</span></div>
                  <div style={{ fontSize: 12, color: "#8b95a3", marginTop: 2 }}>📍 {[r.citta, r.provincia].filter(Boolean).join(" · ") || "zona non indicata"}{r.raggio_km ? ` · fino a ${r.raggio_km} km` : ""}</div>
                  <div style={{ fontSize: 12, color: "#c3cad4", marginTop: 4 }}>{(r.servizi || []).join(" · ") || "Servizi non indicati"}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {(r.attestati || []).map((a, i) => <span key={i} style={{ fontSize: 11, color: scaduto(a.scadenza) ? "#ff9c9c" : "#4ade80", border: `1px solid ${scaduto(a.scadenza) ? "#5a2a2a" : "#2c5a3a"}`, borderRadius: 10, padding: "1px 8px" }}>{a.tipo}{scaduto(a.scadenza) ? " · scaduto" : ""}</span>)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#6b7480" }}>{new Date(r.aggiornata_il).toLocaleDateString("it-IT")}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={stLink}>💬 WhatsApp</a>}
                {r.email && <a href={`mailto:${r.email}`} style={stLink}>✉️ Email</a>}
                {r.pagina_slug && <a href={`https://app.eyedrones.it/p/${r.pagina_slug}`} target="_blank" rel="noreferrer" style={stLink}>🌐 La sua pagina</a>}
                {r.portfolio && <a href={/^https?:\/\//.test(r.portfolio) ? r.portfolio : `https://${r.portfolio}`} target="_blank" rel="noreferrer" style={stLink}>🎬 Portfolio</a>}
              </div>
              {ap && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #2b313d", display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "#c3cad4" }}>
                  {(r.droni || []).length > 0 && <div>🚁 {(r.droni || []).map((d) => `${d.nome}${d.classe ? ` (${d.classe})` : ""}`).join(" · ")}</div>}
                  {r.esperienza && <div>🎓 {r.esperienza}</div>}
                  {r.disponibilita && <div>🗓️ {r.disponibilita}</div>}
                  {r.note && <div>📝 {r.note}</div>}
                  {r.telefono && <div>📞 {r.telefono}</div>}
                  {r.email && <div>✉️ {r.email}</div>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                    <span style={{ fontSize: 11.5, color: "#8b95a3" }}>Stato:</span>
                    {STATI.map((s) => <button key={s.key} type="button" onClick={() => salvaNota(r.user_id, { stato: s.key })} style={stChip((n.stato || "nuova") === s.key)}>{s.label}</button>)}
                  </div>
                  <textarea rows={2} defaultValue={n.nota || ""} onBlur={(e) => e.target.value !== (n.nota || "") && salvaNota(r.user_id, { nota: e.target.value })} placeholder="Nota privata (la vedi solo tu): es. bravo nei matrimoni, ha già lavorato con noi..." style={{ ...inputStyle, resize: "vertical" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
