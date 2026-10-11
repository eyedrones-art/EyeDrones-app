// Leaflet a volte, se la mappa viene chiusa durante un'animazione di zoom, cerca la posizione di un pezzo
// che non c'è più ed esce l'errore «Cannot read properties of undefined (reading '_leaflet_pos')».
// Se il pezzo non c'è, rispondo «posizione 0,0»: la mappa è già chiusa, non cambia niente per chi usa l'app.
import L from "leaflet";

if (!L.DomUtil.__protetto) {
  const originale = L.DomUtil.getPosition;
  L.DomUtil.getPosition = (el) => (el ? originale(el) : new L.Point(0, 0));
  L.DomUtil.__protetto = true;
}

export default L;
