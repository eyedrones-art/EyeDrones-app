import React, { useState, useRef, useEffect } from "react";
import { LayoutDashboard, Zap, Plus, Camera, FileDown, ChevronRight, X, MapPin, TrendingUp, Sun, Settings, Upload, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kywmesdqemxqjasixpzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_TuA4NliBCPZ8ggPAfIvF1w_JNd1qQcZ";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function formatData(d) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

// --- Dati statici (non cambiano tra ispezioni) -----------------------------------------------------------

const SEVERITY = [
  { key: "bassa", label: "Bassa", color: "#3d8bfd" },
  { key: "media", label: "Media", color: "#f5b942" },
  { key: "alta", label: "Alta", color: "#ff8c42" },
  { key: "critica", label: "Critica", color: "#ff4d4d" },
];

const CATEGORIE = [
  { key: "Hotspot cella", descrizione: "Punto anomalo di surriscaldamento su una singola cella, spesso per micro-fratture interne.", azione: "Verifica visiva ravvicinata; se persiste, sostituzione del pannello." },
  { key: "Cella fratturata", descrizione: "Rottura fisica visibile della cella, riduce la produzione e può peggiorare nel tempo.", azione: "Sostituzione del pannello consigliata." },
  { key: "Ombreggiamento", descrizione: "Zona d'ombra ricorrente (vegetazione, strutture) che abbassa la resa del modulo.", azione: "Valutare potatura o rimozione dell'ostacolo." },
  { key: "Diodo bypass", descrizione: "Malfunzionamento del diodo di bypass, il pannello si scalda a strisce.", azione: "Controllo elettrico della scatola di giunzione." },
  { key: "Sporcizia/detriti", descrizione: "Accumulo di polvere, foglie o depositi che riduce l'irraggiamento captato.", azione: "Pianificare pulizia del modulo." },
  { key: "Delaminazione", descrizione: "Distacco degli strati protettivi del pannello, rischio infiltrazioni.", azione: "Ispezione approfondita e possibile sostituzione." },
];

// --- Shell -----------------------------------------------------------

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [impiantoAttivo, setImpiantoAttivo] = useState(null);
  const [azienda, setAzienda] = useState({ nome: "Eyedrones", logo: null });

  const [impianti, setImpianti] = useState([]);
  const [ispezioni, setIspezioni] = useState([]);
  const [anomalieAll, setAnomalieAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setDbError(null);
    try {
      const [{ data: imp, error: e1 }, { data: isp, error: e2 }, { data: ano, error: e3 }] = await Promise.all([
        supabase.from("impianti").select("*").order("created_at"),
        supabase.from("ispezioni").select("*").order("data", { ascending: false }),
        supabase.from("anomalie").select("*"),
      ]);
      if (e1 || e2 || e3) throw (e1 || e2 || e3);
      setImpianti(imp || []);
      setIspezioni(isp || []);
      setAnomalieAll(ano || []);
    } catch (err) {
      setDbError(err.message || "Errore di connessione al database");
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // arricchisco ogni impianto con ultima ispezione e numero anomalie, calcolati dai dati reali
  const impiantiConStat = impianti.map((imp) => {
    const ispezioniImp = ispezioni.filter((i) => i.impianto_id === imp.id);
    const idsIsp = ispezioniImp.map((i) => i.id);
    const anomalieImp = anomalieAll.filter((a) => idsIsp.includes(a.ispezione_id));
    return { ...imp, ultima: ispezioniImp[0] ? formatData(ispezioniImp[0].data) : "Nessuna ispezione", anomalie: anomalieImp.length };
  });

  return (
    <div className="app-shell" style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#161a1f", color: "#e7eaee", minHeight: "600px", display: "flex", width: "100%" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .app-shell { flex-direction: row; }
        .sidebar { width: 220px; flex-direction: column; }
        .sidebar-label { display: inline; }
        .sidebar-brand-label { display: inline; }
        .main-content { padding: 28px 32px; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
        @media (max-width: 680px) {
          .app-shell { flex-direction: column; }
          .sidebar { width: 100%; flex-direction: row; padding: 10px 12px; align-items: center; gap: 6px; overflow-x: auto; border-right: none; border-bottom: 1px solid #262b33; }
          .sidebar-brand { padding: 0 10px 0 0 !important; margin: 0 !important; }
          .sidebar-brand-label { display: none; }
          .sidebar-label { display: none; }
          .nav-item { flex-direction: column; gap: 3px !important; padding: 6px 10px !important; font-size: 10px !important; border-left: none !important; border-bottom: 2px solid transparent; }
          .nav-item.active { border-bottom: 2px solid #ff8c42 !important; }
          .main-content { padding: 18px 16px; }
        }
      `}</style>

      <Sidebar page={page} setPage={setPage} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {dbError && (
          <div style={{ margin: 16, padding: "10px 14px", background: "#2a1616", border: "1px solid #5a2a2a", borderRadius: 8, color: "#ff9c9c", fontSize: 12.5 }}>
            Impossibile leggere il database: {dbError}. Controlla di aver eseguito lo script SQL su Supabase.
          </div>
        )}
        {page === "dashboard" && <Dashboard impianti={impiantiConStat} loading={loading} onOpenImpianto={(i) => { setImpiantoAttivo(i); setPage("impianto"); }} onNuova={() => setPage("nuova")} />}
        {page === "impianti" && <ListaImpianti impianti={impiantiConStat} loading={loading} onReload={loadData} onOpenImpianto={(i) => { setImpiantoAttivo(i); setPage("impianto"); }} />}
        {page === "impianto" && impiantoAttivo && <DettaglioImpianto impianto={impiantoAttivo} ispezioni={ispezioni.filter((i) => i.impianto_id === impiantoAttivo.id)} anomalieAll={anomalieAll} onBack={() => setPage("impianti")} />}
        {page === "nuova" && <NuovaIspezione impianti={impiantiConStat} onSaved={loadData} onDone={() => setPage("dashboard")} azienda={azienda} />}
        {page === "impostazioni" && <Impostazioni azienda={azienda} setAzienda={setAzienda} />}
      </div>
    </div>
  );
}

// --- Sidebar -----------------------------------------------------------

function Sidebar({ page, setPage }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "impianti", label: "Impianti", icon: Sun },
    { key: "nuova", label: "Nuova ispezione", icon: Plus },
    { key: "impostazioni", label: "Impostazioni azienda", icon: Settings },
  ];
  return (
    <div className="sidebar" style={{ background: "#12151a", borderRight: "1px solid #262b33", padding: "20px 14px", display: "flex", flexShrink: 0 }}>
      <div className="sidebar-brand" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px 22px 8px" }}>
        <div style={{ width: 26, height: 26, borderRadius: 5, background: "linear-gradient(135deg, #3d8bfd 0%, #ff8c42 60%, #ff4d4d 100%)", flexShrink: 0 }} />
        <span className="sidebar-brand-label" style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>Eyedrones</span>
      </div>
      {items.map((it) => {
        const Icon = it.icon;
        const active = page === it.key || (page === "impianto" && it.key === "impianti");
        return (
          <button
            key={it.key}
            className={`nav-item${active ? " active" : ""}`}
            onClick={() => setPage(it.key)}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 6,
              background: active ? "#1f2530" : "transparent", border: "none", color: active ? "#fff" : "#9aa4b2",
              fontSize: 13.5, fontWeight: active ? 600 : 500, textAlign: "left", whiteSpace: "nowrap",
              borderLeft: active ? "2px solid #ff8c42" : "2px solid transparent",
            }}
          >
            <Icon size={16} strokeWidth={2} />
            <span className="sidebar-label">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// --- Dashboard -----------------------------------------------------------

function Dashboard({ impianti, loading, onOpenImpianto, onNuova }) {
  const totKwp = impianti.reduce((s, i) => s + (Number(i.kwp) || 0), 0);
  const totAnomalie = impianti.reduce((s, i) => s + i.anomalie, 0);
  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Panoramica</h1>
          <p style={{ color: "#8b95a3", fontSize: 13.5, margin: "4px 0 0 0" }}>{impianti.length} impianti monitorati</p>
        </div>
        <button onClick={onNuova} style={{ display: "flex", alignItems: "center", gap: 6, background: "#ff8c42", color: "#161a1f", border: "none", padding: "9px 16px", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
          <Plus size={15} /> Nuova ispezione
        </button>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 26 }}>
            <StatCard label="Potenza monitorata" value={`${(totKwp / 1000).toFixed(2)} MWp`} sub={`su ${impianti.length} impianti`} />
            <StatCard label="Anomalie aperte" value={totAnomalie} sub={`su ${impianti.filter((i) => i.anomalie > 0).length} impianti`} accent="#ff8c42" />
            <StatCard label="Ispezioni totali" value={impianti.reduce((s, i) => s + (i.anomalie >= 0 ? 1 : 0), 0)} sub="registrate a sistema" />
          </div>

          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#c3cad4", marginBottom: 12 }}>Impianti</h2>
          {impianti.length === 0 ? (
            <EmptyState text="Nessun impianto ancora. Vai su 'Impianti' per aggiungerne uno." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {impianti.map((imp) => (
                <ImpiantoRow key={imp.id} imp={imp} onClick={() => onOpenImpianto(imp)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LoadingBlock() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#8b95a3", fontSize: 13, padding: "30px 0" }}>
      <Loader2 size={16} className="spin" /> Caricamento dati dal database...
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ border: "1px dashed #333a45", borderRadius: 8, padding: "24px 16px", textAlign: "center", color: "#8b95a3", fontSize: 13 }}>
      {text}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#1b2028", border: "1px solid #262b33", borderRadius: 8, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "#8b95a3", marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: accent || "#fff" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#6b7480", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function ImpiantoRow({ imp, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1b2028", border: "1px solid #262b33", borderRadius: 8, padding: "13px 16px", textAlign: "left", flexWrap: "wrap", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: imp.anomalie > 4 ? "#ff4d4d" : imp.anomalie > 0 ? "#f5b942" : "#4ade80", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{imp.nome}</div>
          <div style={{ fontSize: 12, color: "#8b95a3", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
            <MapPin size={11} /> {imp.zona} &middot; {imp.cliente}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div className="mono" style={{ fontSize: 12.5, color: "#c3cad4" }}>{imp.kwp} kWp</div>
        <div style={{ fontSize: 12.5, color: imp.anomalie > 0 ? "#ff8c42" : "#4ade80" }}>{imp.anomalie} anomalie</div>
        <div style={{ fontSize: 12, color: "#6b7480" }}>{imp.ultima}</div>
        <ChevronRight size={15} color="#6b7480" />
      </div>
    </button>
  );
}

// --- Lista impianti -----------------------------------------------------------

function ListaImpianti({ impianti, loading, onReload, onOpenImpianto }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", zona: "", kwp: "", cliente: "" });
  const [saving, setSaving] = useState(false);

  const salva = async () => {
    if (!form.nome) return;
    setSaving(true);
    await supabase.from("impianti").insert({ nome: form.nome, zona: form.zona, kwp: form.kwp ? Number(form.kwp) : null, cliente: form.cliente });
    setSaving(false);
    setForm({ nome: "", zona: "", kwp: "", cliente: "" });
    setShowForm(false);
    onReload();
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Impianti</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ display: "flex", alignItems: "center", gap: 6, background: showForm ? "transparent" : "#ff8c42", color: showForm ? "#8b95a3" : "#161a1f", border: showForm ? "1px solid #333a45" : "none", padding: "8px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
          {showForm ? "Annulla" : <><Plus size={14} /> Nuovo impianto</>}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "#1b2028", border: "1px solid #262b33", borderRadius: 8, padding: 16, marginBottom: 20, maxWidth: 420, display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Nome impianto" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} />
          <input placeholder="Zona / località" value={form.zona} onChange={(e) => setForm({ ...form, zona: e.target.value })} style={inputStyle} />
          <input placeholder="Potenza (kWp)" type="number" value={form.kwp} onChange={(e) => setForm({ ...form, kwp: e.target.value })} style={inputStyle} />
          <input placeholder="Cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} style={inputStyle} />
          <button onClick={salva} disabled={!form.nome || saving} style={{ marginTop: 6, background: form.nome ? "#ff8c42" : "#333a45", color: form.nome ? "#161a1f" : "#6b7480", border: "none", padding: "9px 0", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
            {saving ? "Salvataggio..." : "Salva impianto"}
          </button>
        </div>
      )}

      {loading ? <LoadingBlock /> : impianti.length === 0 ? (
        <EmptyState text="Nessun impianto ancora. Aggiungine uno con il pulsante qui sopra." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {impianti.map((imp) => (
            <ImpiantoRow key={imp.id} imp={imp} onClick={() => onOpenImpianto(imp)} />
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: "100%", background: "#161a1f", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 6, padding: "9px 12px", fontSize: 13.5 };

// --- Dettaglio impianto -----------------------------------------------------------

function DettaglioImpianto({ impianto, ispezioni, anomalieAll, onBack }) {
  const storico = [...ispezioni]
    .sort((a, b) => new Date(b.data) - new Date(a.data))
    .map((isp) => {
      const anomalieIsp = anomalieAll.filter((a) => a.ispezione_id === isp.id);
      const ordine = ["bassa", "media", "alta", "critica"];
      const gravitaMax = anomalieIsp.reduce((max, a) => (ordine.indexOf(a.gravita) > ordine.indexOf(max) ? a.gravita : max), "bassa");
      return { data: formatData(isp.data), anomalie: anomalieIsp.length, gravitaMax };
    });

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#8b95a3", fontSize: 12.5, marginBottom: 14, padding: 0 }}>&larr; Impianti</button>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0 }}>{impianto.nome}</h1>
        <p style={{ color: "#8b95a3", fontSize: 13, margin: "4px 0 0 0" }}>{impianto.zona} &middot; {impianto.cliente} &middot; {impianto.kwp} kWp</p>
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 600, color: "#c3cad4", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
        <TrendingUp size={14} /> Storico ispezioni
      </h2>
      {storico.length === 0 ? (
        <EmptyState text="Nessuna ispezione ancora registrata per questo impianto." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {storico.map((s, idx) => {
            const sev = SEVERITY.find((sv) => sv.key === s.gravitaMax);
            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1b2028", border: "1px solid #262b33", borderRadius: 8, padding: "11px 16px", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 13, color: "#e7eaee" }}>{s.data}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 12.5, color: "#8b95a3" }}>{s.anomalie} anomalie</span>
                  <span style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 4, background: sev.color + "22", color: sev.color, fontWeight: 600 }}>{sev.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Impostazioni (white label) -----------------------------------------------------------

function Impostazioni({ azienda, setAzienda }) {
  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAzienda({ ...azienda, logo: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Impostazioni azienda</h1>
      <p style={{ color: "#8b95a3", fontSize: 13.5, margin: "0 0 24px 0" }}>Personalizza i report con il tuo brand — verranno usati in tutti i PDF generati.</p>

      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 12, color: "#8b95a3", display: "block", marginBottom: 6 }}>Nome azienda / pilota</label>
          <input
            value={azienda.nome}
            onChange={(e) => setAzienda({ ...azienda, nome: e.target.value })}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#8b95a3", display: "block", marginBottom: 6 }}>Logo (comparirà in alto nei report PDF)</label>
          {azienda.logo ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={azienda.logo} alt="logo" style={{ height: 48, maxWidth: 140, objectFit: "contain", background: "#fff", borderRadius: 6, padding: 6 }} />
              <button onClick={() => setAzienda({ ...azienda, logo: null })} style={{ fontSize: 12.5, color: "#8b95a3", background: "none", border: "1px solid #333a45", borderRadius: 6, padding: "7px 12px" }}>Rimuovi</button>
            </div>
          ) : (
            <label style={{ display: "flex", alignItems: "center", gap: 8, width: "fit-content", border: "1px dashed #333a45", borderRadius: 8, padding: "10px 16px", color: "#8b95a3", fontSize: 13, cursor: "pointer" }}>
              <Upload size={15} /> Carica logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            </label>
          )}
        </div>

        <p style={{ fontSize: 11.5, color: "#6b7480", lineHeight: 1.5 }}>
          Per gli account abbonati sarà disponibile l'opzione: logo e nome dell'azienda o del pilota compariranno sui report che generano.
        </p>
      </div>
    </div>
  );
}

function NuovaIspezione({ onDone, azienda, impianti, onSaved }) {
  const [step, setStep] = useState(1);
  const [impiantoSel, setImpiantoSel] = useState(null);
  const [foto, setFoto] = useState(null);
  const [anomalie, setAnomalie] = useState([]);
  const [pendingPin, setPendingPin] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [salvataggio, setSalvataggio] = useState("idle"); // idle | saving | saved | error
  const imgRef = useRef(null);

  const salvaSuDb = async () => {
    if (!impiantoSel) return;
    setSalvataggio("saving");
    try {
      const { data: isp, error: e1 } = await supabase.from("ispezioni").insert({ impianto_id: impiantoSel.id, data: new Date().toISOString().slice(0, 10) }).select().single();
      if (e1) throw e1;
      if (anomalie.length > 0) {
        const rows = anomalie.map((a) => ({ ispezione_id: isp.id, categoria: a.categoria, gravita: a.gravita, pos_x: a.x, pos_y: a.y }));
        const { error: e2 } = await supabase.from("anomalie").insert(rows);
        if (e2) throw e2;
      }
      setSalvataggio("saved");
      onSaved && onSaved();
    } catch (err) {
      setSalvataggio("error");
    }
  };

  const generaPDF = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const oranje = [255, 140, 66];
    const grigio = [110, 120, 130];
    let y = 20;

    if (azienda.logo) {
      try { doc.addImage(azienda.logo, "PNG", 15, 10, 26, 16, undefined, "FAST"); } catch (e) {}
      y = 34;
    }

    doc.setFontSize(18);
    doc.setTextColor(20, 20, 20);
    doc.text("Report ispezione termografica", 15, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(...grigio);
    doc.text(`${azienda.nome} — ispezioni con drone e termocamera`, 15, y);
    y += 12;

    doc.setDrawColor(230, 230, 230);
    doc.line(15, y, 195, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    const righe = [
      ["Impianto", `${impiantoSel?.nome}`],
      ["Località", impiantoSel?.zona],
      ["Potenza installata", `${impiantoSel?.kwp} kWp`],
      ["Cliente", impiantoSel?.cliente],
      ["Data ispezione", formatData(new Date())],
      ["Anomalie rilevate", String(anomalie.length)],
    ];
    righe.forEach(([label, val]) => {
      doc.setTextColor(...grigio);
      doc.text(label, 15, y);
      doc.setTextColor(20, 20, 20);
      doc.text(String(val), 70, y);
      y += 7;
    });

    y += 6;
    doc.setDrawColor(230, 230, 230);
    doc.line(15, y, 195, y);
    y += 10;

    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("Anomalie e raccomandazioni", 15, y);
    y += 9;

    if (anomalie.length === 0) {
      doc.setFontSize(10.5);
      doc.setTextColor(...grigio);
      doc.text("Nessuna anomalia rilevata durante l'ispezione.", 15, y);
      y += 7;
    }

    anomalie.forEach((a, idx) => {
      const info = CATEGORIE.find((c) => c.key === a.categoria);
      const sev = SEVERITY.find((s) => s.key === a.gravita);
      if (y > 265) { doc.addPage(); y = 20; }

      doc.setFillColor(...oranje);
      doc.circle(17, y - 1.5, 1.4, "F");
      doc.setFontSize(11.5);
      doc.setTextColor(20, 20, 20);
      doc.text(`${idx + 1}. ${a.categoria}`, 22, y);
      doc.setFontSize(9);
      doc.setTextColor(sev.color === "#ff4d4d" ? 220 : 150, 90, 60);
      doc.text(`[${sev.label.toUpperCase()}]`, 165, y);
      y += 6;

      doc.setFontSize(9.5);
      doc.setTextColor(...grigio);
      const descLines = doc.splitTextToSize(info.descrizione, 170);
      doc.text(descLines, 22, y);
      y += descLines.length * 4.5 + 2;

      doc.setTextColor(...oranje);
      const azLines = doc.splitTextToSize(`Azione consigliata: ${info.azione}`, 170);
      doc.text(azLines, 22, y);
      y += azLines.length * 4.5 + 8;
    });

    doc.setFontSize(8);
    doc.setTextColor(...grigio);
    doc.text(`Generato da ${azienda.nome} — report a scopo dimostrativo`, 15, 290);

    const url = doc.output("bloburl");
    setPdfUrl(url);
    window.open(url, "_blank");
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setFoto(URL.createObjectURL(file));
  };

  const generaFotoDemo = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 300;
    const ctx = canvas.getContext("2d");
    const base = ctx.createLinearGradient(0, 0, 480, 300);
    base.addColorStop(0, "#1a1f6b");
    base.addColorStop(0.5, "#7a1fa2");
    base.addColorStop(1, "#2a0845");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 480, 300);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    for (let x = 20; x < 460; x += 46) {
      ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 280); ctx.stroke();
    }
    for (let y = 20; y < 280; y += 40) {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(460, y); ctx.stroke();
    }
    const spots = [[130, 90, 26], [340, 150, 34], [230, 220, 20]];
    spots.forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "#fff59d");
      g.addColorStop(0.4, "#ff8c42");
      g.addColorStop(1, "rgba(255,77,77,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    });
    setFoto(canvas.toDataURL());
  };

  const handleImgClick = (e) => {
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
  };

  const confermaPin = (categoria, gravita) => {
    setAnomalie([...anomalie, { ...pendingPin, categoria, gravita, id: Date.now() }]);
    setPendingPin(null);
  };

  const vaiAlReport = () => {
    setStep(3);
    salvaSuDb();
  };

  return (
    <div style={{ padding: "28px 32px", overflow: "auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0" }}>Nuova ispezione</h1>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {["Impianto", "Foto termica", "Report"].map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: step === i + 1 ? "#ff8c42" : step > i + 1 ? "#3d8bfd" : "#262b33", color: step >= i + 1 ? "#161a1f" : "#8b95a3", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }} className="mono">{i + 1}</div>
            <span style={{ fontSize: 12.5, color: step === i + 1 ? "#fff" : "#8b95a3" }}>{label}</span>
            {i < 2 && <div style={{ width: 24, height: 1, background: "#262b33", margin: "0 4px" }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 13, color: "#8b95a3", marginBottom: 12 }}>Seleziona l'impianto da ispezionare</p>
          {impianti.length === 0 ? (
            <EmptyState text="Nessun impianto ancora. Vai su 'Impianti' per aggiungerne uno prima di iniziare." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {impianti.map((imp) => (
                <button key={imp.id} onClick={() => setImpiantoSel(imp)} style={{ textAlign: "left", padding: "11px 14px", borderRadius: 7, border: impiantoSel?.id === imp.id ? "1px solid #ff8c42" : "1px solid #262b33", background: impiantoSel?.id === imp.id ? "#241d16" : "#1b2028", color: "#e7eaee", fontSize: 13.5 }}>
                  {imp.nome} <span style={{ color: "#6b7480", fontSize: 12 }}>&middot; {imp.zona}</span>
                </button>
              ))}
            </div>
          )}
          <button disabled={!impiantoSel} onClick={() => setStep(2)} style={{ marginTop: 18, background: impiantoSel ? "#ff8c42" : "#333a45", color: impiantoSel ? "#161a1f" : "#6b7480", border: "none", padding: "9px 18px", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>
            Continua
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          {!foto ? (
            <div style={{ maxWidth: 420 }}>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 220, border: "1px dashed #333a45", borderRadius: 10, color: "#8b95a3", fontSize: 13, cursor: "pointer" }}>
                <Camera size={26} strokeWidth={1.5} />
                Carica una foto termica dell'impianto
                <input type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0", width: "100%" }}>
                <div style={{ flex: 1, height: 1, background: "#262b33" }} />
                <span style={{ fontSize: 11.5, color: "#6b7480" }}>oppure</span>
                <div style={{ flex: 1, height: 1, background: "#262b33" }} />
              </div>
              <button onClick={generaFotoDemo} style={{ width: "100%", background: "#1b2028", border: "1px solid #333a45", color: "#c3cad4", padding: "10px 0", borderRadius: 8, fontSize: 13 }}>
                Usa una foto termica demo
              </button>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: 12.5, color: "#8b95a3", marginBottom: 8 }}>Clicca sull'immagine per segnare un'anomalia &middot; {anomalie.length} segnate</p>
              <div style={{ position: "relative", width: "100%", maxWidth: 480, display: "block" }}>
                <img ref={imgRef} src={foto} onClick={handleImgClick} style={{ width: "100%", borderRadius: 8, display: "block", cursor: "crosshair" }} />
                {anomalie.map((a) => {
                  const sev = SEVERITY.find((s) => s.key === a.gravita);
                  return <div key={a.id} title={a.categoria} style={{ position: "absolute", left: `${a.x}%`, top: `${a.y}%`, width: 12, height: 12, borderRadius: "50%", background: sev.color, border: "2px solid #161a1f", transform: "translate(-50%,-50%)" }} />;
                })}
                {pendingPin && (
                  <div style={{ position: "absolute", left: `${pendingPin.x}%`, top: `${pendingPin.y}%`, transform: "translate(-50%,-50%)" }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fff", border: "2px solid #161a1f" }} />
                  </div>
                )}
              </div>
              {pendingPin && <AnomaliaPopup onConfirm={confermaPin} onCancel={() => setPendingPin(null)} />}
              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <button onClick={() => setStep(1)} style={{ background: "transparent", border: "1px solid #333a45", color: "#c3cad4", padding: "9px 16px", borderRadius: 6, fontSize: 13 }}>Indietro</button>
                <button onClick={vaiAlReport} style={{ background: "#ff8c42", color: "#161a1f", border: "none", padding: "9px 18px", borderRadius: 6, fontWeight: 600, fontSize: 13.5 }}>Genera report</button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: "#8b95a3", margin: 0 }}>Così apparirà il report che riceve il cliente:</p>
            {salvataggio === "saving" && <span style={{ fontSize: 11.5, color: "#8b95a3", display: "flex", alignItems: "center", gap: 4 }}><Loader2 size={12} className="spin" /> salvataggio...</span>}
            {salvataggio === "saved" && <span style={{ fontSize: 11.5, color: "#4ade80" }}>salvato nel database ✓</span>}
            {salvataggio === "error" && <span style={{ fontSize: 11.5, color: "#ff4d4d" }}>errore nel salvataggio</span>}
          </div>

          <div style={{ background: "#ffffff", color: "#1a1a1a", width: "100%", maxWidth: 520, borderRadius: 4, padding: "28px 30px", boxShadow: "0 4px 24px rgba(0,0,0,0.35)" }}>
            {azienda.logo && (
              <img src={azienda.logo} alt="logo" style={{ height: 34, maxWidth: 130, objectFit: "contain", marginBottom: 14, display: "block" }} />
            )}
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 3px 0", fontFamily: "'IBM Plex Sans', sans-serif" }}>Report ispezione termografica</h2>
            <p style={{ fontSize: 11.5, color: "#6b7480", margin: "0 0 18px 0" }}>{azienda.nome} — ispezioni con drone e termocamera</p>

            <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 12 }}>
              {[
                ["Impianto", impiantoSel?.nome],
                ["Località", impiantoSel?.zona],
                ["Potenza installata", `${impiantoSel?.kwp} kWp`],
                ["Cliente", impiantoSel?.cliente],
                ["Data ispezione", formatData(new Date())],
                ["Anomalie rilevate", String(anomalie.length)],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
                  <span style={{ color: "#6b7480" }}>{label}</span>
                  <span className="mono" style={{ color: "#1a1a1a" }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e5e5e5", marginTop: 14, paddingTop: 14 }}>
              <h3 style={{ fontSize: 13.5, fontWeight: 700, margin: "0 0 10px 0" }}>Anomalie e raccomandazioni</h3>
              {anomalie.length === 0 && <p style={{ fontSize: 12, color: "#6b7480" }}>Nessuna anomalia rilevata durante l'ispezione.</p>}
              {anomalie.map((a, idx) => {
                const info = CATEGORIE.find((c) => c.key === a.categoria);
                const sev = SEVERITY.find((s) => s.key === a.gravita);
                return (
                  <div key={a.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{idx + 1}. {a.categoria}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: sev.color }}>{sev.label.toUpperCase()}</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: "#555", margin: "3px 0" }}>{info.descrizione}</p>
                    <p style={{ fontSize: 11.5, color: "#ff8c42", margin: 0, fontWeight: 500 }}>Azione consigliata: {info.azione}</p>
                  </div>
                );
              })}
            </div>

            <p style={{ fontSize: 9.5, color: "#9aa4b2", marginTop: 18, borderTop: "1px solid #e5e5e5", paddingTop: 10 }}>Generato da {azienda.nome} — report a scopo dimostrativo</p>
          </div>

          <div style={{ maxWidth: 520, marginTop: 16 }}>
            <button onClick={generaPDF}  style={{ display: "flex", alignItems: "center", gap: 6, background: "#1f2530", color: "#e7eaee", border: "1px solid #333a45", padding: "9px 16px", borderRadius: 6, fontSize: 13 }}>
              <FileDown size={14} /> Prova a scaricare il PDF
            </button>
            <button onClick={onDone} style={{ display: "block", marginTop: 10, background: "transparent", color: "#8b95a3", border: "none", padding: "8px 0", fontSize: 12.5 }}>
              Torna alla dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnomaliaPopup({ onConfirm, onCancel }) {
  const [categoria, setCategoria] = useState(CATEGORIE[0].key);
  const [gravita, setGravita] = useState("media");
  const info = CATEGORIE.find((c) => c.key === categoria);
  return (
    <div style={{ marginTop: 12, background: "#1b2028", border: "1px solid #333a45", borderRadius: 8, padding: 14, width: "100%", maxWidth: 320 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Nuova anomalia</span>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#6b7480" }}><X size={14} /></button>
      </div>
      <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Tipo di anomalia</label>
      <select value={categoria} onChange={(e) => setCategoria(e.target.value)} style={{ width: "100%", background: "#161a1f", border: "1px solid #333a45", color: "#e7eaee", borderRadius: 5, padding: "6px 8px", fontSize: 12.5, marginBottom: 8 }}>
        {CATEGORIE.map((c) => <option key={c.key} value={c.key}>{c.key}</option>)}
      </select>
      <div style={{ background: "#161a1f", border: "1px solid #262b33", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
        <p style={{ fontSize: 11.5, color: "#9aa4b2", margin: "0 0 6px 0", lineHeight: 1.4 }}>{info.descrizione}</p>
        <p style={{ fontSize: 11.5, color: "#ff8c42", margin: 0, lineHeight: 1.4 }}><strong>Azione consigliata:</strong> {info.azione}</p>
      </div>
      <label style={{ fontSize: 11, color: "#6b7480", display: "block", marginBottom: 4 }}>Gravità</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {SEVERITY.map((s) => (
          <button key={s.key} onClick={() => setGravita(s.key)} style={{ flex: 1, padding: "5px 0", borderRadius: 5, fontSize: 11, border: gravita === s.key ? `1px solid ${s.color}` : "1px solid #333a45", background: gravita === s.key ? s.color + "22" : "transparent", color: gravita === s.key ? s.color : "#8b95a3" }}>
            {s.label}
          </button>
        ))}
      </div>
      <button onClick={() => onConfirm(categoria, gravita)} style={{ width: "100%", background: "#ff8c42", color: "#161a1f", border: "none", padding: "7px 0", borderRadius: 5, fontWeight: 600, fontSize: 12.5 }}>Conferma</button>
    </div>
  );
}
