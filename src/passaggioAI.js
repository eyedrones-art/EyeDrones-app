// Passaggio in memoria dalla Termocamera all'«Ispezione con AI»: foto colorate, temperature misurate e un modo
// per leggere la temperatura dentro ogni riquadro proposto dall'AI. Resta nel telefono o nel computer, non va al server.
let pacco = null;
export const consegnaAllAI = (p) => { pacco = p; };
export const ritiraPerAI = () => { const p = pacco; pacco = null; return p; };
