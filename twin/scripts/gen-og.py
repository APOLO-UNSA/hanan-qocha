"""Genera la imagen de vista previa (public/og.png, 1200x630) y los íconos de la app (public/icon-*.png)
con la identidad de Qocha Twin. Uso: python twin/scripts/gen-og.py   (requiere Pillow)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

PUB = Path(__file__).resolve().parent.parent / "public"
FONTS = Path("C:/Windows/Fonts")
NOCHE, NOCHE2, PAPEL = "#1d2242", "#333b74", "#f4ecdc"
ICHU, BOFEDAL, BOFEDAL_CL, QOCHA, ARCILLA = "#d9a23f", "#3b7a4c", "#8cc084", "#2c8c8f", "#c4552d"


def font(name: str, size: int):
    for n in (name, "georgiab.ttf", "segoeuib.ttf"):
        try:
            return ImageFont.truetype(str(FONTS / n), size)
        except OSError:
            pass
    return ImageFont.load_default(size)


def logo(d: ImageDraw.ImageDraw, x: float, y: float, s: float):
    """Nevado sobre la laguna con colonias (mismo dibujo que src/art.ts, en una caja de 40x40)."""
    P = lambda pts: [(x + px * s, y + py * s) for px, py in pts]
    d.polygon(P([(3, 24), (14, 9), (19, 15), (24, 8), (37, 24)]), fill=ICHU)
    d.polygon(P([(14, 9), (17.5, 13.6), (15.8, 13), (14, 15), (12, 12.6)]), fill=PAPEL)
    d.polygon(P([(24, 8), (28.2, 13.4), (26, 12.6), (24, 14.5), (22, 12.8)]), fill=PAPEL)
    d.ellipse([x + 3 * s, y + 21 * s, x + 37 * s, y + 37 * s], fill=QOCHA)
    for cx, cy, r in ((14, 29, 2.6), (21, 31, 3.2), (27, 28, 2)):
        d.ellipse([x + (cx - r) * s, y + (cy - r) * s, x + (cx + r) * s, y + (cy + r) * s], fill=BOFEDAL_CL)


def awayu(d: ImageDraw.ImageDraw, y: int, w: int, h: int = 16):
    """Franja tejida tipo awayu."""
    d.rectangle([0, y, w, y + h], fill=ARCILLA)
    d.rectangle([0, y, w, y + h * 0.16], fill=ICHU)
    d.rectangle([0, y + h * 0.84, w, y + h], fill=BOFEDAL)
    step = h * 1.34
    i = 0
    x = 0.0
    while x < w:
        cx, cy, r = x + step / 2, y + h / 2, h * 0.3
        d.polygon([(cx - step / 2, cy), (cx, cy - r), (cx + step / 2, cy), (cx, cy + r)], fill=NOCHE)
        rr = r * 0.4
        d.polygon([(cx - rr, cy), (cx, cy - rr), (cx + rr, cy), (cx, cy + rr)], fill=PAPEL if i % 2 == 0 else ICHU)
        x += step
        i += 1


# ---------- og.png ----------
random.seed(2026)
W, H = 1200, 630
img = Image.new("RGB", (W, H), NOCHE)
d = ImageDraw.Draw(img)
for yy in range(H):
    t = yy / H
    a, b = (29, 34, 66), (51, 59, 116)
    d.line([(0, yy), (W, yy)], fill=tuple(int(a[k] + (b[k] - a[k]) * t) for k in range(3)))

# curvas de nivel
cont = Image.new("RGBA", (W, H), (0, 0, 0, 0))
cd = ImageDraw.Draw(cont)
for k in range(9):
    rx, ry = 120 + k * 70, 80 + k * 52
    cd.ellipse([960 - rx, 300 - ry, 960 + rx, 300 + ry], outline=(244, 236, 220, 26), width=2)
img.paste(cont, (0, 0), cont)
d = ImageDraw.Draw(img)

# cocha con colonias marcadas
cx, cy, rx, ry = 960, 300, 190, 190
water = Image.new("RGBA", (W, H), (0, 0, 0, 0))
wd = ImageDraw.Draw(water)
wd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(44, 140, 143, 255))
wd.ellipse([cx - rx + 26, cy - ry + 18, cx + rx - 60, cy + ry - 70], fill=(80, 165, 165, 255))
water = water.filter(ImageFilter.GaussianBlur(5))
img.paste(water, (0, 0), water)
d = ImageDraw.Draw(img)
placed = []
for _ in range(500):
    r = random.uniform(9, 24)
    a = random.uniform(0, 2 * math.pi)
    k = math.sqrt(random.uniform(0, 1)) * 0.8
    x, y = cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k
    if any((x - px) ** 2 + (y - py) ** 2 < (r + pr - 3) ** 2 for px, py, pr in placed):
        continue
    placed.append((x, y, r))
    if len(placed) >= 36:
        break
for x, y, r in placed:
    d.ellipse([x - r, y - r, x + r, y + r], fill=BOFEDAL)
    d.ellipse([x - r * 0.75, y - r * 0.8, x + r * 0.35, y + r * 0.3], fill=BOFEDAL_CL)
    d.ellipse([x - r - 4, y - r - 4, x + r + 4, y + r + 4], outline=ICHU, width=2)

logo(d, 70, 92, 2.2)
d.text((70, 190), "Hanan Qocha", font=font("georgiab.ttf", 80), fill=PAPEL)
d.text((74, 290), "QOCHA TWIN · GEMELO DIGITAL DEL CUSHURO", font=font("consola.ttf", 22), fill=ICHU)
d.text(
    (74, 340),
    "Satélite NASA + sensor in situ +\nvisión artificial para encontrar y\nmanejar las cochas del cushuro.",
    font=font("segoeui.ttf", 30),
    fill=PAPEL,
    spacing=10,
)
d.rounded_rectangle([70, 500, 520, 552], radius=26, fill=PAPEL)
d.text((96, 508), "NASA Space Apps 2026 · Arequipa", font=font("segoeuib.ttf", 25), fill=NOCHE)
awayu(d, H - 18, W, 18)
img.save(PUB / "og.png", optimize=True)
print(PUB / "og.png")

# ---------- íconos ----------
for size in (192, 512):
    ic = Image.new("RGB", (size, size), NOCHE)
    di = ImageDraw.Draw(ic)
    s = size / 40 * 0.72
    off = (size - 40 * s) / 2
    logo(di, off, off - size * 0.02, s)
    ic.save(PUB / f"icon-{size}.png", optimize=True)
    print(PUB / f"icon-{size}.png")
