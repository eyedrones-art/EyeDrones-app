// Piani e prezzi in un posto solo: li usano App, Impara e Telemetria.
// NotaPiano: la riga che mostra il piano giusto nel momento in cui serve (durante il lancio: incluso, poi con Pilota/Pro).

// prezzi in euro: cambiali solo qui, le pagine calcolano da sole "al mese" e "mesi risparmiati"
export const PREZZI_PIANO = { pilota: { mese: 6.9, anno: 69 }, pro: { mese: 12.9, anno: 119 } };
// Lancio: fino a questa data tutti hanno le funzioni Pro senza costi. Chi si iscrive entro la data è "fondatore":
// quando partono gli abbonamenti paga il primo anno scontato, solo con l'annuale. Per chiudere il lancio: attivo: false.
export const LANCIO = { attivo: true, fino: "2027-01-31", scontoFondatori: 0.5 };
const oggi = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const lancioInCorso = () => LANCIO.attivo && oggi() <= LANCIO.fino;
export const fineLancio = () => new Date(`${LANCIO.fino}T12:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
export const euro = (n) => n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
export const NOME_PIANO = { free: "Free", pilota: "Pilota", pro: "Pro" };
export const ORDINE_PIANO = { free: 0, pilota: 1, pro: 2 };

// il piano pagato davvero (non quello «Pro per tutti» del lancio): lo imposta App a ogni caricamento
let pianoPagato = "free";
export const impostaPianoPagato = (p) => { pianoPagato = p || "free"; };

export function NotaPiano({ quale = "pilota", cosa, prima, stile }) {
  if ((ORDINE_PIANO[pianoPagato] ?? 0) >= ORDINE_PIANO[quale]) return null; // ce l'ha già
  const pro = quale === "pro";
  const nome = NOME_PIANO[quale];
  const alMese = euro(PREZZI_PIANO[quale].anno / 12);
  const vai = () => window.dispatchEvent(new CustomEvent("eyedrones-vai", { detail: { pagina: "abbonamento" } }));
  const lancio = lancioInCorso();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: pro ? "#0f1a13" : "#0f1726", border: `1px solid ${pro ? "#24432f" : "#22385c"}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, lineHeight: 1.45, color: "#d5dbe5", margin: "0 0 14px 0", ...stile }}>
      <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: "0.04em", color: pro ? "#4ade80" : "#7cb3ff", border: `1px solid ${pro ? "#2f6b47" : "#2c4f80"}`, borderRadius: 5, padding: "1px 5px", flexShrink: 0 }}>{pro ? "PRO" : "PILOTA"}</span>
      <span style={{ flex: "1 1 220px", minWidth: 0 }}>
        {prima ? <>{prima} </> : null}
        {lancio
          ? <><strong>{cosa}</strong>: incluso senza costi fino al {fineLancio()}. Poi con {nome} da {alMese} al mese, e da fondatore con l'annuale il primo anno paghi la metà.</>
          : <><strong>{cosa}</strong> è nel piano {nome}: da {alMese} al mese con l'annuale.</>}
      </span>
      <button type="button" onClick={vai} style={{ background: "none", border: `1px solid ${pro ? "#2f6b47" : "#2c4f80"}`, color: pro ? "#4ade80" : "#7cb3ff", borderRadius: 8, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, minHeight: 36, flexShrink: 0 }}>{lancio ? "Vedi i piani ›" : `Passa a ${nome} ›`}</button>
    </div>
  );
}
