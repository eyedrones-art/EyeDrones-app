import React from "react";

// Strumenti meteo per chi fa riprese: vento in quota e previsione dei colori di alba e tramonto.
// I dati arrivano da open-meteo (orari con vento a 10, 80 e 120 m e nuvole basse, medie e alte).

// --- Vento in quota ------------------------------------------------------------------------------
// A terra può esserci poco vento e a 120 m il doppio: il drone fatica, consuma di più e al ritorno può non farcela
export function VentoInQuota({ orari, data, ora, limite = 30, compatto }) {
  if (!Array.isArray(orari) || !data) return null;
  const delGiorno = orari.filter((o) => o.data === data && o.vento120 != null);
  if (delGiorno.length === 0) return null;
  const h = ora ? Number(String(ora).slice(0, 2)) : null;
  // con l'ora prevista guardo quella, altrimenti l'ora peggiore tra le 7 e le 20
  const o = h != null ? delGiorno.find((x) => x.ora === h) : [...delGiorno].filter((x) => x.ora >= 7 && x.ora <= 20).sort((a, b) => b.vento120 - a.vento120)[0];
  if (!o) return null;
  const v10 = Math.round(o.vento ?? 0), v80 = Math.round(o.vento80 ?? o.vento120), v120 = Math.round(o.vento120);
  const [colore, testo] = v120 > limite
    ? (v80 <= limite
      ? ["#f5b942", `A 120 m il vento supera il limite del drone (${limite} km/h): resta sotto gli 80 m.`]
      : v10 <= limite * 0.7
        ? ["#ff8c42", `Sopra gli 80 m il vento supera il limite del drone (${limite} km/h): vola basso, sotto i 30–40 m, e tieni il drone vicino.`]
        : ["#ff4d4d", `Vento forte anche in basso: meglio non volare (limite del drone ${limite} km/h).`])
    : v120 > limite * 0.75
      ? ["#f5b942", `In alto il vento è vicino al limite del drone (${limite} km/h): attento al ritorno controvento.`]
      : ["#4ade80", "Vento tranquillo anche in alto."];
  const valore = (etichetta, v) => (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", minWidth: 62, padding: "4px 6px", borderRadius: 6, background: (v > limite ? "#ff4d4d" : v > limite * 0.75 ? "#f5b942" : "#4ade80") + "1a" }}>
      <span style={{ fontSize: 10.5, color: "#8b95a3" }}>{etichetta}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#e7eaee" }}>{v} km/h</span>
    </span>
  );
  return (
    <div style={{ marginTop: compatto ? 8 : 10, background: "#161a1f", border: `1px solid ${colore}55`, borderRadius: 6, padding: compatto ? "8px 10px" : 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: colore }}>💨 Vento in quota{h != null ? ` alle ${String(h).padStart(2, "0")}:00` : ` (ora peggiore: ${String(o.ora).padStart(2, "0")}:00)`}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
        {valore("a terra", v10)}{valore("a 80 m", v80)}{valore("a 120 m", v120)}
      </div>
      <div style={{ fontSize: 12, color: "#c3cad4", marginTop: 6 }}>{testo}</div>
      {!compatto && <div style={{ fontSize: 10.5, color: "#6b7480", marginTop: 4 }}>Il vento in alto di solito è più forte che a terra: decolla con la batteria piena e torna controvento con almeno il 30%.</div>}
    </div>
  );
}

// --- Alba e tramonto: ci saranno colori? ----------------------------------------------------------
// Regola pratica dei fotografi: nuvole medie e alte (20–70%) si colorano, nuvole basse e cielo coperto spengono tutto,
// cielo limpido dà una bella luce calda ma il cielo resta senza colori
function giudizioCielo(o) {
  if (!o || o.nuvoleBasse == null) return null;
  const basse = o.nuvoleBasse ?? 0, alte = Math.max(o.nuvoleMedie ?? 0, o.nuvoleAlte ?? 0), tot = o.nuvole ?? Math.max(basse, alte);
  if (basse >= 70 || tot >= 90) return { voto: 0, emoji: "☁️", titolo: "Probabilmente grigio", testo: "Nuvole basse o cielo coperto: il sole non riesce a colorare il cielo." };
  if (alte >= 20 && alte <= 75 && basse < 40) return { voto: 3, emoji: "🔥", titolo: "Promettente", testo: `Nuvole alte e medie al ${Math.round(alte)}% con poche nuvole basse: possono accendersi di arancio e rosa.` };
  if (tot < 15) return { voto: 2, emoji: "🌤️", titolo: "Cielo limpido", testo: "Luce calda e pulita, ma pochi colori in cielo: punta sul soggetto illuminato e sulle ombre lunghe." };
  return { voto: 1, emoji: "🙂", titolo: "Qualche colore possibile", testo: "Nuvole miste: i colori ci possono essere, ma non è garantito. Guarda il cielo a ovest mezz'ora prima." };
}

export function PrevisioneCielo({ orari, data, albaMin, tramontoMin, compatto }) {
  if (!Array.isArray(orari) || !data) return null;
  const all = (min) => (min == null ? null : orari.find((o) => o.data === data && o.ora === Math.min(23, Math.round(min / 60))));
  const alba = giudizioCielo(all(albaMin)), tramonto = giudizioCielo(all(tramontoMin));
  if (!alba && !tramonto) return null;
  const COLORI = ["#8b95a3", "#c3cad4", "#f5b942", "#ff8c42"];
  const riga = (nome, g) => g && (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 6 }}>
      <span style={{ fontSize: 18, lineHeight: 1.2 }}>{g.emoji}</span>
      <span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORI[g.voto] }}>{nome}: {g.titolo}</span>
        {!compatto && <span style={{ display: "block", fontSize: 12, color: "#c3cad4" }}>{g.testo}</span>}
      </span>
    </div>
  );
  return (
    <div style={{ marginTop: compatto ? 6 : 10, background: "#161a1f", border: "1px solid #ff8c4244", borderRadius: 6, padding: compatto ? "6px 10px" : 12 }}>
      {!compatto && <div style={{ fontSize: 12.5, fontWeight: 700, color: "#ffb877" }}>🌅 Il cielo si colorerà?</div>}
      {riga("Alba", alba)}
      {riga("Tramonto", tramonto)}
      {!compatto && <div style={{ fontSize: 10.5, color: "#6b7480", marginTop: 6 }}>Previsione indicativa, calcolata dalle nuvole previste a quell'ora: il cielo può sempre sorprendere.</div>}
    </div>
  );
}
