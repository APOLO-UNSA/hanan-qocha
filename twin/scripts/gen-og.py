"""Genera twin/public/og.png (1200x630): imagen de vista previa al compartir el enlace.
Uso: python twin/scripts/gen-og.py   (requiere Pillow)
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
OUT = Path(__file__).resolve().parent.parent / "public" / "og.png"
FONTS = Path("C:/Windows/Fonts")


def font(name: str, size: int):
    try:
        return ImageFont.truetype(str(FONTS / name), size)
    except OSError:
        return ImageFont.load_default(size)


random.seed(2026)
img = Image.new("RGB", (W, H), "#163f35")
d = ImageDraw.Draw(img)

# Fondo: degradado vertical verde oscuro
for y in range(H):
    t = y / H
    c = (int(22 + 9 * t), int(63 + 48 * t), int(53 + 39 * t))
    d.line([(0, y), (W, y)], fill=c)

# Cocha (derecha): agua con colonias de cushuro marcadas
cx, cy, rx, ry = 975, 315, 200, 205
water = Image.new("RGBA", (W, H), (0, 0, 0, 0))
wd = ImageDraw.Draw(water)
wd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(70, 120, 125, 255))
wd.ellipse([cx - rx + 30, cy - ry + 20, cx + rx - 60, cy + ry - 70], fill=(93, 138, 140, 255))
water = water.filter(ImageFilter.GaussianBlur(6))
img.paste(water, (0, 0), water)
d = ImageDraw.Draw(img)

placed = []
for _ in range(400):
    r = random.uniform(9, 26)
    a = random.uniform(0, 2 * math.pi)
    k = math.sqrt(random.uniform(0, 1)) * 0.82
    x, y = cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k
    if any((x - px) ** 2 + (y - py) ** 2 < (r + pr - 4) ** 2 for px, py, pr in placed):
        continue
    placed.append((x, y, r))
    if len(placed) >= 38:
        break
for x, y, r in placed:
    d.ellipse([x - r, y - r, x + r, y + r], fill="#4f7a2a")
    d.ellipse([x - r * 0.75, y - r * 0.8, x + r * 0.35, y + r * 0.3], fill="#7fa83c")
    d.ellipse([x - r - 4, y - r - 4, x + r + 4, y + r + 4], outline="#ffd23f", width=2)

# Texto (izquierda)
d.text((70, 120), "Hanan Qocha", font=font("segoeuib.ttf", 82), fill="#ffffff")
d.text((74, 222), "Qocha Twin · gemelo digital del cushuro", font=font("segoeui.ttf", 34), fill="#cfe9dd")
d.text(
    (74, 300),
    "Satélite NASA + sensor in situ +\nvisión artificial para encontrar y\nmanejar las cochas donde mejor\ncrece el cushuro.",
    font=font("segoeui.ttf", 30),
    fill="#ffffff",
    spacing=10,
)
d.rounded_rectangle([70, 500, 520, 556], radius=28, fill="#ffd23f")
d.text((95, 508), "NASA Space Apps 2026 · Arequipa", font=font("segoeuib.ttf", 26), fill="#163f35")

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, optimize=True)
print(f"{OUT} ({OUT.stat().st_size // 1024} KB)")
