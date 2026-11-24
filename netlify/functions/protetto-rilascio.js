// EyeDrones — «🛡️ Pagamento protetto»: ogni ora (orario in netlify.toml) manda al pilota i soldi dei lavori
// consegnati da qualche giorno senza problemi segnalati, ed esegue i rimborsi decisi. Senza STRIPE_SECRET_KEY non fa nulla.
const { esegui } = require("./pagamento-protetto.js");

exports.handler = async () => {
  const esito = await esegui().catch((e) => ({ errore: e.message }));
  if (esito.rilasciati || esito.rimborsati || esito.errori || esito.errore) console.log("pagamento protetto", JSON.stringify(esito));
  return { statusCode: 200 };
};
