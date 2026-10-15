// Gli «spazi» di EyeDrones: ognuno ha la sua Home, il secondo tasto in basso e le sue voci del menu.
// Restano in comune Registro voli, Pianifica, Controllo, droni, attestati e Impara.
// In profili.moduli ci sono gli spazi attivati (separati da virgola); quello aperto adesso si ricorda nel telefono.

export const SPAZI = [
  { key: "video", modulo: "riprese", emoji: "🎬", nome: "Foto e video", testo: "Riprese, matrimoni, eventi, FPV: scaletta e manovre, colore, galleria per i clienti e liberatorie.", tab: { key: "galleria", label: "Galleria" }, tipoPiano: "video", link: "video" },
  { key: "ispezioni", modulo: "ispezioni", emoji: "🔍", nome: "Ispezioni", testo: "Fotovoltaico, tetti, facciate, impianti: termografia, anomalie e report PDF per il cliente.", tab: { key: "impianti", label: "Impianti" }, tipoPiano: "fotovoltaico", link: "ispezioni" },
  { key: "agricoltura", modulo: "agricoltura", emoji: "🌾", nome: "Agricoltura", testo: "Appezzamenti con i confini, registro trattamenti, meteo per irrorare e fascicolo per la SCIA.", tab: { key: "campi", label: "Campi" }, tipoPiano: "agricoltura", link: "agri" },
  { key: "rilievi", modulo: "rilievi", emoji: "📐", nome: "Fotogrammetria", testo: "Rilievi e ortofoto: GSD e sovrapposizioni, area STS e report di consegna con i file.", tab: { key: "rilievi", label: "Rilievi" }, tipoPiano: "rilievo", link: "rilievi" },
];

const CHIAVE = "eyedrones_spazio";
const CHIAVE_LINK = "eyedrones_spazio_link";

export const moduliDa = (moduli) => String(moduli || "").split(",").map((x) => x.trim()).filter(Boolean);
export const spaziAttivi = (moduli) => { const m = moduliDa(moduli); return SPAZI.filter((s) => m.includes(s.modulo)); };
export const spazio = (key) => SPAZI.find((s) => s.key === key) || null;

export const leggiSpazio = () => { try { return localStorage.getItem(CHIAVE); } catch { return null; } };
export const scriviSpazio = (key) => { try { localStorage.setItem(CHIAVE, key); } catch { /* niente */ } };

// link diretti: app.eyedrones.it/agri, /ispezioni, /video, /rilievi aprono quello spazio (anche dopo il login)
export function spazioDalLink() {
  try {
    const parte = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
    const s = SPAZI.find((x) => x.link === parte || x.key === parte);
    if (s) { sessionStorage.setItem(CHIAVE_LINK, s.key); window.history.replaceState(null, "", "/" + window.location.search); return s.key; }
    return sessionStorage.getItem(CHIAVE_LINK);
  } catch { return null; }
}
export const linkUsato = () => { try { sessionStorage.removeItem(CHIAVE_LINK); } catch { /* niente */ } };
