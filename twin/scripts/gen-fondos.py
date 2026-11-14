"""Genera los fondos de Qocha Twin en src/assets/:
  - topo.svg / topo-claro.svg: mapa topográfico procedural (cumbres, quebradas y cochas) con curvas de nivel
    cada 40 m, curvas maestras cada 200 m con su cota, y lagunas en las hondonadas.
  - cordillera.svg: silueta de la cordillera en capas, con nevados.
Uso: python twin/scripts/gen-fondos.py   (requiere numpy y contourpy)
"""
from pathlib import Path

import contourpy
import numpy as np

OUT = Path(__file__).resolve().parent.parent / "src" / "assets"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(4300)

# ---------- Mapa de alturas ----------
W, H = 1600, 1000
NX, NY = 320, 200
xs, ys = np.meshgrid(np.linspace(0, W, NX), np.linspace(0, H, NY))


def ruido(octavas=5, base=4):
    z = np.zeros_like(xs)
    amp, total = 1.0, 0.0
    for o in range(octavas):
        n = base * 2**o
        g = rng.standard_normal((n + 1, int(n * 1.6) + 1))
        gx = np.linspace(0, g.shape[1] - 1, NX)
        gy = np.linspace(0, g.shape[0] - 1, NY)
        # interpolación bilineal de la grilla aleatoria
        x0 = np.floor(gx).astype(int).clip(0, g.shape[1] - 2)
        y0 = np.floor(gy).astype(int).clip(0, g.shape[0] - 2)
        fx = (gx - x0)[None, :]
        fy = (gy - y0)[:, None]
        fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
        a = g[np.ix_(y0, x0)]
        b = g[np.ix_(y0, x0 + 1)]
        c = g[np.ix_(y0 + 1, x0)]
        d = g[np.ix_(y0 + 1, x0 + 1)]
        z += amp * ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
        total += amp
        amp *= 0.5
    return z / total


alt = 4100 + 260 * ruido()
# Nevados (cumbres) y hondonadas donde se forman las cochas
for cx, cy, h, s in [(260, 220, 900, 170), (1180, 160, 1100, 210), (1420, 760, 700, 150), (520, 820, 600, 160), (880, 430, 380, 120)]:
    alt += h * np.exp(-(((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * s * s)))
cochas = [(700, 560, 260, 70), (1010, 690, 220, 60), (330, 560, 200, 55)]
for cx, cy, h, s in cochas:
    alt -= h * np.exp(-(((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * s * s)))

contour = contourpy.contour_generator(xs, ys, alt, line_type=contourpy.LineType.Separate)
paso, maestra = 40, 200
niveles = np.arange(np.ceil(alt.min() / paso) * paso, alt.max(), paso)
nivel_agua = {}


def path_d(seg, cerrar=False):
    seg = seg[:: 2] if len(seg) > 12 else seg
    if len(seg) < 3:
        return ""
    d = "M" + " L".join(f"{x:.0f},{y:.0f}" for x, y in seg)
    return d + ("Z" if cerrar else "")


def topo(trazo: str, trazo_m: str, texto: str, agua: str, opac: float) -> str:
    finas, maestras, etiquetas = [], [], []
    for lv in niveles:
        es_m = int(lv) % maestra == 0
        for seg in contour.lines(lv):
            d = path_d(seg)
            if not d:
                continue
            (maestras if es_m else finas).append(d)
            if es_m and len(seg) > 120 and len(etiquetas) < 26:
                x, y = seg[len(seg) // 2]
                if 30 < x < W - 60 and 20 < y < H - 20:
                    etiquetas.append(
                        f'<text x="{x:.0f}" y="{y:.0f}" dy="3" text-anchor="middle">{int(lv)}</text>'
                    )
    # Cochas: la curva más baja alrededor de cada hondonada, rellena de agua
    lagos = []
    for cx, cy, _, s in cochas:
        i, j = int(cy / H * (NY - 1)), int(cx / W * (NX - 1))
        fondo = alt[i, j]
        lv = fondo + 25
        for seg in contour.lines(lv):
            if np.hypot(seg[:, 0].mean() - cx, seg[:, 1].mean() - cy) < s and len(seg) > 8:
                lagos.append(f'<path d="{path_d(seg, True)}"/>')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">
<g fill="{agua}" fill-opacity="{opac * 1.4:.2f}" stroke="{agua}" stroke-opacity="{opac * 2.4:.2f}" stroke-width="1.2">{''.join(lagos)}</g>
<g fill="none" stroke="{trazo}" stroke-opacity="{opac:.2f}" stroke-width="0.8" stroke-linejoin="round">{''.join(f'<path d="{d}"/>' for d in finas)}</g>
<g fill="none" stroke="{trazo_m}" stroke-opacity="{opac * 1.8:.2f}" stroke-width="1.6" stroke-linejoin="round">{''.join(f'<path d="{d}"/>' for d in maestras)}</g>
<g font-family="monospace" font-size="10" fill="{texto}" fill-opacity="{opac * 2.6:.2f}" stroke="none" paint-order="stroke">{''.join(etiquetas)}</g>
</svg>
"""


(OUT / "topo.svg").write_text(topo("#9c8a5e", "#8a7448", "#7a6640", "#2c8c8f", 0.22), encoding="utf-8")
(OUT / "topo-claro.svg").write_text(topo("#f4ecdc", "#f4ecdc", "#f4ecdc", "#4fc1bf", 0.13), encoding="utf-8")

# ---------- Cordillera ----------
CW, CH = 1600, 260
x = np.linspace(0, CW, 400)


def cresta(base, alto, rugos, semilla, picos):
    r = np.random.default_rng(semilla)
    y = np.full_like(x, base, dtype=float)
    for px, ph, pw in picos:
        y -= ph * np.clip(1 - np.abs(x - px) / pw, 0, None) ** 1.25
    detalle = np.cumsum(r.standard_normal(len(x))) * rugos
    detalle -= np.linspace(detalle[0], detalle[-1], len(x))
    return y + detalle


capas = [
    ("#333b74", 0.06, cresta(160, 0, 1.6, 1, [(180, 120, 260), (620, 90, 220), (980, 140, 300), (1420, 110, 260)])),
    ("#1d2242", 0.08, cresta(200, 0, 1.3, 2, [(380, 100, 240), (820, 70, 200), (1240, 95, 230)])),
    ("#1d2242", 0.12, cresta(236, 0, 1.0, 3, [(80, 40, 160), (560, 55, 200), (1080, 45, 180), (1540, 50, 170)])),
]
partes = []
for i, (color, op, y) in enumerate(capas):
    pts = " L".join(f"{a:.0f},{b:.1f}" for a, b in zip(x, y))
    partes.append(f'<path d="M0,{CH} L{pts} L{CW},{CH}Z" fill="{color}" fill-opacity="{op}"/>')
    if i == 0:  # nevados en la capa del fondo
        nieve = np.minimum(y, np.min(y) + 26)
        tope = y <= np.min(y) + 26
        if tope.any():
            pts2 = " L".join(f"{a:.0f},{b:.1f}" for a, b in zip(x, np.where(tope, y, nieve)))
            partes.append(f'<path d="M0,{np.min(y)+26:.0f} L{pts2} L{CW},{np.min(y)+26:.0f}Z" fill="#ffffff" fill-opacity=".35"/>')
(OUT / "cordillera.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {CW} {CH}" preserveAspectRatio="none">{"".join(partes)}</svg>\n',
    encoding="utf-8",
)
for f in ("topo.svg", "topo-claro.svg", "cordillera.svg"):
    print(OUT / f, f"{(OUT / f).stat().st_size // 1024} KB")
