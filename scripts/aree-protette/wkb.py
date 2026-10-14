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

