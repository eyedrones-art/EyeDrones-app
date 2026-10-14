# Estrae le aree protette nazionali italiane (EEA NatDA, EPSG:4326) e le unisce ai riquadri Natura 2000.
# uso: parchi.py natda.gpkg cartella_n2k cartella_uscita [solo_schema]
import sqlite3, struct, math, json, sys, os, glob

GPKG, N2K, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
TOLL = 25.0
exec(open(os.path.join(os.path.dirname(__file__), "wkb.py")).read())

con = sqlite3.connect(GPKG); cur = con.cursor()
tab = [r[0] for r in cur.execute("select table_name from gpkg_contents where data_type='features'")]
print("tabelle", tab, file=sys.stderr)
T = tab[0]
cols = [r[1] for r in cur.execute(f'pragma table_info("{T}")')]
print("colonne", cols, file=sys.stderr)
if len(sys.argv) > 4:
    for r in cur.execute(f'select * from "{T}" limit 2'): print([x if not isinstance(x, bytes) else "<blob>" for x in r], file=sys.stderr)
    sys.exit()
gcol = [r[0] for r in cur.execute("select column_name from gpkg_geometry_columns where table_name=?", (T,))][0]
import csv
CSV = os.path.join(os.path.dirname(GPKG), "NatDA_2026_v01_public_DesignatedArea.csv")
NOMI_TIPI = {"IT01": "Parco nazionale", "IT02": "Riserva naturale statale", "IT03": "Parco naturale interregionale",
             "IT04": "Parco naturale regionale", "IT05": "Riserva naturale regionale", "IT06": "Monumento naturale",
             "IT30": "Area naturale protetta regionale", "IT37": "Area naturale marina", "IT90": "Area marina protetta"}
TIPO = {r["natDAId"]: r["designationTypeCode"] for r in csv.DictReader(open(CSV, encoding="utf-8-sig")) if r["natDACountryCode"] == "IT"}
PICCOLE = {"di", "del", "della", "dei", "delle", "degli", "dello", "e", "ed", "al", "alla", "alle", "ai", "agli", "allo", "in", "da", "dal", "dalla", "la", "le", "il", "lo", "i", "gli", "a", "sul", "sulla"}
def bel_nome(n):
    n = n.strip()
    pn = n.startswith("P N ")
    if pn: n = n[4:]
    if sum(c.isupper() for c in n) > 0.6 * sum(c.isalpha() for c in n):  # tutto maiuscolo: lo rendo leggibile
        parole = n.lower().replace(",", ", ").split()
        n = " ".join(w if (i and w in PICCOLE) else w[:1].upper() + w[1:] for i, w in enumerate(parole))
        n = n.replace("Parco Nazionale", "Parco nazionale")
    import re
    n = re.sub(r"\b(D|Dell|Dall|Nell|Sull|All|L)'\s*(\w)", lambda m: m.group(1).lower() + "'" + m.group(2).upper(), n) if "'" in n else n
    if n.startswith(("d'", "dell'", "l'")) and not pn: n = n[:1].upper() + n[1:]
    if pn: n = "Parco nazionale " + n[:1].lower() + n[1:] if n.split()[0].lower() in PICCOLE else "Parco nazionale " + n
    return n
siti, tasselli = [], {}
for sid, nome, blob in cur.execute(f'select natDAId, siteName, "{gcol}" from "{T}" where countryCode = \'IT\''):
    tipo = NOMI_TIPI.get(TIPO.get(str(sid)))
    if blob is None or not tipo: continue
    nome = bel_nome(nome)
    poli = []
    for anelli in geom(blob):
        out = []
        for k, r in enumerate(anelli):
            lat0 = r[0][1]; kx = 111320 * math.cos(math.radians(lat0)); ky = 110540
            m = [(x * kx, y * ky) for x, y in r]
            if k > 0 and area(m) < 2500: continue
            if k == 0 and area(m) < 400: break
            s = dp(m, TOLL)
            if len(s) < 4: continue
            out.append([[round(x / kx, 5), round(y / ky, 5)] for x, y in s])
        if out: poli.append(out)
    if not poli: continue
    xs = [p[0] for pl in poli for p in pl[0]]; ys = [p[1] for pl in poli for p in pl[0]]
    bbox = [round(min(xs), 5), round(min(ys), 5), round(max(xs), 5), round(max(ys), 5)]
    i = len(siti)
    siti.append({"c": f"AP-{sid}", "n": nome, "t": tipo, "k": "parco", "b": bbox, "p": poli})
    for gx in range(math.floor(bbox[0]), math.floor(bbox[2]) + 1):
        for gy in range(math.floor(bbox[1]), math.floor(bbox[3]) + 1):
            tasselli.setdefault(f"{gy}_{gx}", []).append(i)
print("parchi", len(siti), "tipi", sorted({s["t"] for s in siti}), file=sys.stderr)

os.makedirs(OUT, exist_ok=True)
chiavi = set(tasselli) | {os.path.basename(f)[:-5] for f in glob.glob(os.path.join(N2K, "*_*.json"))}
for k in chiavi:
    f = os.path.join(N2K, k + ".json")
    n2k = json.load(open(f)) if os.path.exists(f) else []
    with open(os.path.join(OUT, k + ".json"), "w") as fh:
        json.dump([siti[i] for i in tasselli.get(k, [])] + n2k, fh, ensure_ascii=False, separators=(",", ":"))
print("riquadri", len(chiavi), file=sys.stderr)
