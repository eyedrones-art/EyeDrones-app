# Estrae i siti Natura 2000 italiani dal GPKG EEA (EPSG:3035), semplifica e scrive tasselli 1°x1° in JSON.
import sqlite3, struct, math, json, sys, os

GPKG, OUT = sys.argv[1], sys.argv[2]
TOLL = float(sys.argv[3]) if len(sys.argv) > 3 else 25.0  # metri

# --- LAEA ETRS89 (EPSG:3035) inversa, EPSG guidance note 7-2
a = 6378137.0; f = 1 / 298.257222101; e2 = 2 * f - f * f; e = math.sqrt(e2)
p0 = math.radians(52); l0 = math.radians(10); FE, FN = 4321000.0, 3210000.0
def q(phi):
    s = math.sin(phi)
    return (1 - e2) * (s / (1 - e2 * s * s) - (1 / (2 * e)) * math.log((1 - e * s) / (1 + e * s)))
qP = q(math.pi / 2); q0 = q(p0); b0 = math.asin(q0 / qP); Rq = a * math.sqrt(qP / 2)
D = a * (math.cos(p0) / math.sqrt(1 - e2 * math.sin(p0) ** 2)) / (Rq * math.cos(b0))
c1 = e2 / 3 + 31 * e2 ** 2 / 180 + 517 * e2 ** 3 / 5040
c2 = 23 * e2 ** 2 / 360 + 251 * e2 ** 3 / 3780
c3 = 761 * e2 ** 3 / 45360
def inv(E, N):
    x, y = E - FE, N - FN
    rho = math.sqrt((x / D) ** 2 + (D * y) ** 2)
    if rho == 0: return (math.degrees(l0), math.degrees(p0))
    C = 2 * math.asin(rho / (2 * Rq))
    bb = math.asin(math.cos(C) * math.sin(b0) + (D * y * math.sin(C) * math.cos(b0)) / rho)
    lam = l0 + math.atan2(x * math.sin(C), D * rho * math.cos(b0) * math.cos(C) - D * D * y * math.sin(b0) * math.sin(C))
    phi = bb + c1 * math.sin(2 * bb) + c2 * math.sin(4 * bb) + c3 * math.sin(6 * bb)
    return (math.degrees(lam), math.degrees(phi))

# --- GPKG blob -> anelli
def leggi_wkb(b, o):
    bo = '<' if b[o] == 1 else '>'
    t = struct.unpack_from(bo + 'I', b, o + 1)[0]; o += 5
    dim = 2
    if t > 1000: dim = 3 if t // 1000 in (1, 2) else 4; t %= 1000
    if t & 0x80000000: dim = 3; t &= 0xFFFF
    if t == 3:
        n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4; anelli = []
        for _ in range(n):
            m = struct.unpack_from(bo + 'I', b, o)[0]; o += 4
            v = struct.unpack_from(bo + 'd' * (m * dim), b, o); o += 8 * m * dim
            anelli.append([(v[i], v[i + 1]) for i in range(0, m * dim, dim)])
        return [anelli], o
    if t in (6, 7):
        n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4; tutti = []
        for _ in range(n):
            pp, o = leggi_wkb(b, o); tutti += pp
        return tutti, o
    return [], o
def geom(blob):
    flags = blob[3]; env = (flags >> 1) & 7
    o = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    return leggi_wkb(blob, o)[0]

# --- Douglas-Peucker (metri, in 3035)
def dp(pts, tol):
    if len(pts) < 5: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; st = [(0, len(pts) - 1)]
    while st:
        i, j = st.pop(); (x1, y1), (x2, y2) = pts[i], pts[j]; dx, dy = x2 - x1, y2 - y1; L = dx * dx + dy * dy
        dmax, k = -1, -1
        for m in range(i + 1, j):
            px, py = pts[m]
            if L == 0: d = (px - x1) ** 2 + (py - y1) ** 2
            else:
                t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / L)); d = (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2
            if d > dmax: dmax, k = d, m
        if dmax > tol * tol: keep[k] = True; st += [(i, k), (k, j)]
    return [p for p, kk in zip(pts, keep) if kk]
def area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2

con = sqlite3.connect(GPKG)
cur = con.cursor()
tab = [r[0] for r in cur.execute("select table_name from gpkg_contents where data_type='features'")]
print("tabelle", tab, file=sys.stderr)
T = tab[0]
cols = [r[1] for r in cur.execute(f'pragma table_info("{T}")')]
print("colonne", cols, file=sys.stderr)
gcol = [r[0] for r in cur.execute("select column_name from gpkg_geometry_columns where table_name=?", (T,))][0]
sel = f'select SITECODE, SITENAME, SITETYPE, "{gcol}" from "{T}" where MS = \'IT\''
siti, tasselli, punti_tot = [], {}, 0
for code, nome, tipo, blob in cur.execute(sel):
    poli = []
    for anelli in geom(blob):
        out = []
        for k, r in enumerate(anelli):
            if k > 0 and area(r) < 2500: continue  # buchi piccolissimi via
            if k == 0 and area(r) < 400: break
            s = dp(r, TOLL)
            if len(s) < 4: continue
            out.append([[round(lon, 5), round(lat, 5)] for lon, lat in (inv(x, y) for x, y in s)])
        if out: poli.append(out)
    if not poli: continue
    xs = [p[0] for pl in poli for p in pl[0]]; ys = [p[1] for pl in poli for p in pl[0]]
    bbox = [min(xs), min(ys), max(xs), max(ys)]
    punti_tot += sum(len(r) for pl in poli for r in pl)
    i = len(siti)
    siti.append({"c": code, "n": nome, "t": tipo, "b": [round(v, 5) for v in bbox], "p": poli})
    for gx in range(math.floor(bbox[0]), math.floor(bbox[2]) + 1):
        for gy in range(math.floor(bbox[1]), math.floor(bbox[3]) + 1):
            tasselli.setdefault(f"{gy}_{gx}", []).append(i)
os.makedirs(OUT, exist_ok=True)
for k, idx in tasselli.items():
    with open(os.path.join(OUT, k + ".json"), "w") as fh:
        json.dump([siti[i] for i in idx], fh, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(OUT, "indice.json"), "w") as fh:
    json.dump({"fonte": "EEA Natura 2000 end 2024 (CC BY 4.0)", "siti": len(siti), "tasselli": sorted(tasselli)}, fh, separators=(",", ":"))
print("siti", len(siti), "punti", punti_tot, "tasselli", len(tasselli), file=sys.stderr)
