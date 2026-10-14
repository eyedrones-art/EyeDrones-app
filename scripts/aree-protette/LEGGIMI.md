# Riquadri delle aree protette (public/aree-protette)

Dati: Agenzia europea dell'ambiente (EEA), licenza CC BY 4.0.
- Natura 2000 (vector), versione fine 2024: https://doi.org/10.2909/91357f39-7866-41ce-b447-43905c364ec8
- Nationally designated areas (vector), luglio 2026: https://doi.org/10.2909/028003e7-7585-4d69-92fc-7f81e0cc2340
  più la tabella NatDA_2026_v01_public_DesignatedArea.csv (tipo di area) da https://sdi.eea.europa.eu/catalogue/srv/api/records/e92c2b84-abee-4da2-b3fe-5be5f0f91066

Per rigenerarli servono solo Python 3 e i file scaricati dall'EEA:

    python3 scripts/aree-protette/estrai.py Natura2000_end2024.gpkg /tmp/n2k 25
    python3 scripts/aree-protette/parchi.py NatDA_2026_v01_public_EPSG4326.gpkg /tmp/n2k public/aree-protette

(il CSV va messo nella stessa cartella del GPKG delle aree nazionali)

Tengono solo l'Italia: siti Natura 2000 (MS = IT) e parchi, riserve, monumenti naturali e aree marine
protette (codici IT01-IT06, IT30, IT37, IT90). Confini semplificati a 25 m, riquadri di 1° x 1°
(`<lat>_<lon>.json`). Da rifare quando l'EEA pubblica le versioni nuove (circa una volta l'anno).
