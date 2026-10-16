// Giro della giornata: i dati (senza mappe né componenti), così si possono usare ovunque senza caricare Leaflet.
// Salvato in piani_volo.checklist_stato.giro = { sostaPartenza, tappe: [{ id, nome, lat, lon, sosta }] }

export const GIRO_VUOTO = { sostaPartenza: 45, tappe: [] };
export const giroUsato = (g) => !!(g && Array.isArray(g.tappe) && g.tappe.length > 0);
export const MAX_TAPPE = 9; // Google Maps apre al massimo 9 tappe intermedie

// altre parti dell'app (Posti) mettono qui i posti da aggiungere: il giro li prende quando si apre Pianifica
const CHIAVE_CODA = "eyedrones_giro_coda";
export function aggiungiAllaCoda(p) {
  try {
    const coda = JSON.parse(localStorage.getItem(CHIAVE_CODA) || "[]");
    if (!coda.some((x) => Math.abs(x.lat - p.lat) < 1e-5 && Math.abs(x.lon - p.lon) < 1e-5)) coda.push({ nome: p.nome, lat: p.lat, lon: p.lon });
    localStorage.setItem(CHIAVE_CODA, JSON.stringify(coda.slice(-MAX_TAPPE)));
    return coda.length;
  } catch { return 0; }
}
export function prendiCoda() {
  try { const c = JSON.parse(localStorage.getItem(CHIAVE_CODA) || "[]"); localStorage.removeItem(CHIAVE_CODA); return Array.isArray(c) ? c : []; } catch { return []; }
}

const nuovoId = () => Math.random().toString(36).slice(2, 9);
export const tappaDa = (p) => ({ id: nuovoId(), nome: String(p.nome || "Tappa").slice(0, 80), lat: Number(p.lat), lon: Number(p.lon), sosta: 30 });

