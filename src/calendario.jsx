// «Aggiungi al calendario»: Google Calendar con un link, iPhone e altri calendari con un file .ics (con promemoria)
import React from "react";

export function datiCalendarioPiano({ data, ora, titolo, luogo, dettagli }) {
  if (!data) return null;
  const d = data.replace(/-/g, "");
  let inizio, fine, tuttoIlGiorno = false;
  if (ora) {
    const [h, m] = ora.split(":").map(Number);
    const fineMin = h * 60 + m + 60;
    inizio = `${d}T${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}00`;
    const giornoFine = fineMin >= 1440 ? dataLocaleDa(data, 1).replace(/-/g, "") : d;
    const fm = fineMin % 1440;
    fine = `${giornoFine}T${String(Math.floor(fm / 60)).padStart(2, "0")}${String(fm % 60).padStart(2, "0")}00`;
  } else {
    tuttoIlGiorno = true;
    inizio = d;
    fine = dataLocaleDa(data, 1).replace(/-/g, "");
  }
  return { inizio, fine, tuttoIlGiorno, titolo, luogo: luogo || "", dettagli: dettagli || "" };
}
export function dataLocaleDa(data, giorni) {
  const [y, m, g] = data.split("-").map(Number);
  const x = new Date(y, m - 1, g + giorni);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function linkGoogleCalendar(c) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: c.titolo, dates: `${c.inizio}/${c.fine}`, details: c.dettagli, location: c.luogo });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
export function scaricaIcs(c) {
  const esc = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const dt = (k, v) => (c.tuttoIlGiorno ? `${k};VALUE=DATE:${v}` : `${k}:${v}`);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EyeDrones//Piano di volo//IT", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@app.eyedrones.it`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`,
    dt("DTSTART", c.inizio), dt("DTEND", c.fine),
    `SUMMARY:${esc(c.titolo)}`, `LOCATION:${esc(c.luogo)}`, `DESCRIPTION:${esc(c.dettagli)}`,
    // avvisoSubito: la notifica arriva all'ora dell'evento (es. la fine di un NOTAM), non il giorno prima
    ...(c.avvisoSubito ? ["BEGIN:VALARM", "TRIGGER:PT0M", "ACTION:DISPLAY", `DESCRIPTION:${esc(c.titolo)}`, "END:VALARM"] : [
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${esc("Domani: " + c.titolo)}`, "END:VALARM",
      ...(c.tuttoIlGiorno ? [] : ["BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${esc("Tra un'ora: " + c.titolo)}`, "END:VALARM"]),
    ]),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url; a.download = c.nomeFile || "volo-eyedrones.ics";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export function PulsantiCalendario({ dati, compatto = false }) {
  if (!dati) return null;
  const st = { display: "inline-flex", alignItems: "center", gap: 5, background: compatto ? "none" : "#1f2530", color: compatto ? "#3d8bfd" : "#e7eaee", border: compatto ? "none" : "1px solid #333a45", borderRadius: 6, padding: compatto ? "2px 4px" : "8px 12px", fontSize: 12.5, textDecoration: compatto ? "underline" : "none" };
  return (
    <div style={{ display: "flex", gap: compatto ? 4 : 6, flexWrap: "wrap", alignItems: "center", fontSize: 12.5, color: "#8b95a3" }}>
      {compatto && <span>📅 Aggiungi al calendario:</span>}
      <a href={linkGoogleCalendar(dati)} target="_blank" rel="noreferrer" style={st}>{compatto ? "Google" : "📅 Google Calendar"}</a>
      {compatto && <span>·</span>}
      <button type="button" onClick={() => scaricaIcs(dati)} style={st}>{compatto ? "iPhone / altro" : "📅 iPhone / altro calendario"}</button>
    </div>
  );
}

