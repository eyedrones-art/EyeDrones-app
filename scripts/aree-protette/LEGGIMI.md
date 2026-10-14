# Riquadri delle aree protette (public/aree-protette)

Dati: Agenzia europea dell'ambiente (EEA), licenza CC BY 4.0.
- Natura 2000 (vector) – version end 2024: https://doi.org/10.2909/91357f39-7866-41ce-b447-43905c364ec8

Per rigenerarli (servono solo Python 3 e il file GPKG scaricato dall'EEA):

    python3 scripts/aree-protette/estrai.py Natura2000_end2024.gpkg public/aree-protette 25

Tiene solo i siti italiani (MS = IT), semplifica i confini a 25 m e li divide in riquadri di 1° x 1°
(`<lat>_<lon>.json`). Va rifatto quando l'EEA pubblica la versione nuova (circa una volta l'anno).
