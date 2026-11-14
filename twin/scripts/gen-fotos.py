"""Dibuja las fotos SINTÉTICAS de la demo (public/demo/fotos/*.jpg) a partir de public/demo/vision.json.

Imitan una toma cenital de la cámara Qocha Ñawi sobre una cocha de bofedal:
  - agua clara con fondo de turba, reflejo del cielo y ondas;
  - orilla de bofedal (cojines de Distichia, ichu seco, barro húmedo);
  - colonias de cushuro (Nostoc sphaericum): esferas gelatinosas verde oliva, brillantes y con sombra;
  - capa de la visión artificial: contorno de cada colonia detectada y datos de la toma.
Cada cocha es la MISMA laguna en el tiempo: las colonias persisten, crecen y aparecen nuevas.
Uso: python twin/scripts/gen-fotos.py   (requiere numpy y Pillow). Correr después de gen-demo.mjs.
"""
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DEMO = Path(__file__).resolve().parent.parent / "public" / "demo"
W, H = 960, 720
FUENTE = None
for f in ("C:/Windows/Fonts/consola.ttf", "C:/Windows/Fonts/cour.ttf"):
    try:
        FUENTE = lambda s, f=f: ImageFont.truetype(f, s)
        FUENTE(12)
        break
    except OSError:
        FUENTE = None
if FUENTE is None:
    FUENTE = lambda s: ImageFont.load_default(s)


def ruido(rng, w, h, escalas=(4, 8, 16, 32, 64), pesos=None):
    """Ruido fractal suave (suma de rejillas aleatorias ampliadas)."""
    pesos = pesos or [1 / (i + 1) ** 1.2 for i in range(len(escalas))]
    z = np.zeros((h, w), np.float32)
    for e, p in zip(escalas, pesos):
        g = rng.random((max(2, h * e // w), e)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        z += p * (np.asarray(img, np.float32) / 255)
    z -= z.min()
    return z / max(z.max(), 1e-6)


def mezcla(a, b, t):
    t = t[..., None]
    return a * (1 - t) + b * t


def color(c):
    return np.array(c, np.float32)


def escena(rng):
    """Fondo de la cocha: devuelve (imagen float HxWx3, máscara de agua HxW, centro, radios)."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W * rng.uniform(0.47, 0.53), H * rng.uniform(0.48, 0.54)
    rx, ry = W * rng.uniform(0.40, 0.44), H * rng.uniform(0.39, 0.43)
    ang = np.arctan2((yy - cy) / ry, (xx - cx) / rx)
    dist = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    borde = 1 + 0.07 * np.sin(3 * ang + rng.uniform(0, 6)) + 0.05 * np.sin(5 * ang + rng.uniform(0, 6)) + 0.03 * np.sin(9 * ang)
    borde += 0.06 * (ruido(rng, W, H, (6, 12, 24)) - 0.5)
    agua = np.clip((borde - dist) * 18, 0, 1)  # 1 dentro, transición suave en la orilla

    # Bofedal: cojines verdes con manchas amarillentas de ichu y sombras
    n1 = ruido(rng, W, H, (24, 48, 96, 192), [1, 0.8, 0.6, 0.5])
    n2 = ruido(rng, W, H, (8, 16, 32))
    cojin = mezcla(color((52, 82, 34)), color((112, 132, 52)), n1)
    cojin = mezcla(cojin, color((176, 152, 86)), np.clip((n2 - 0.62) * 3.2, 0, 1))  # ichu seco
    cojin *= (0.78 + 0.32 * ruido(rng, W, H, (96, 192, 384), [1, 1, 1]))[..., None]  # textura fina
    # Orilla: barro húmedo oscuro
    orilla = np.clip(1 - np.abs(dist - borde) * 9, 0, 1) ** 1.5
    tierra = mezcla(cojin, color((58, 46, 32)), orilla * 0.85)

    # Agua: fondo de turba visto a través del agua, más hondo al centro
    turba = mezcla(color((54, 46, 30)), color((92, 92, 52)), ruido(rng, W, H, (6, 12, 24, 48)))
    prof = np.clip(1 - dist / borde, 0, 1)
    tinte = mezcla(color((70, 120, 112)), color((22, 62, 70)), prof ** 0.8)
    aguaimg = turba * 0.42 + tinte * 0.58
    # cáusticas suaves y reflejo del cielo
    caust = ruido(rng, W, H, (32, 64, 128), [1, 0.7, 0.5])
    aguaimg += (np.clip(caust - 0.6, 0, 1) * 40)[..., None]
    cielo = np.exp(-(((xx - W * 0.28) / (W * 0.30)) ** 2 + ((yy - H * 0.30) / (H * 0.22)) ** 2))
    aguaimg = mezcla(aguaimg, color((190, 215, 230)), cielo * 0.28)
    viento = np.asarray(Image.fromarray((rng.random((H // 3, 24)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC), np.float32) / 255
    aguaimg += ((viento - 0.5) * 9)[..., None]

    img = mezcla(tierra, aguaimg, agua)
    img = cojines(rng, img, agua)
    return img, agua, (cx, cy, rx, ry, borde, dist)


def cojines(rng, arr, agua):
    """Cojines de bofedal (Distichia) e ichu: miles de matas pequeñas con luz y sombra, fuera del agua."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    for _ in range(5200):
        x, y = rng.uniform(0, W), rng.uniform(0, H)
        if agua[int(y) % H, int(x) % W] > 0.05:
            continue
        r = rng.uniform(2.5, 8.5)
        if rng.random() < 0.18:  # mata de ichu: trazos secos
            c = tuple(int(v) for v in rng.uniform((150, 125, 70), (205, 180, 110)))
            for _ in range(5):
                a = rng.uniform(-2.4, -0.7)
                d.line([x, y, x + math.cos(a) * r * 2.2, y + math.sin(a) * r * 2.2], fill=c + (170,), width=1)
            continue
        g = rng.uniform(0, 1)
        base = (int(40 + 60 * g), int(70 + 60 * g), int(26 + 22 * g))
        d.ellipse([x - r + 1.5, y - r * 0.8 + 2, x + r + 1.5, y + r * 0.8 + 2], fill=(18, 26, 12, 90))
        d.ellipse([x - r, y - r * 0.85, x + r, y + r * 0.85], fill=base + (235,))
        d.ellipse([x - r * 0.55, y - r * 0.6, x + r * 0.2, y - r * 0.05], fill=(min(255, base[0] + 45), min(255, base[1] + 50), base[2] + 20, 150))
    capa = capa.filter(ImageFilter.GaussianBlur(0.6))
    img.alpha_composite(capa)
    return np.asarray(img.convert("RGB"), np.float32)


def colonias_base(rng, geo, n=170):
    """Posiciones fijas de colonias para una cocha, separadas entre sí (muestreo con distancia mínima).
    El orden de aparición va desde unos pocos manchones hacia afuera, como coloniza el cushuro."""
    cx, cy, rx, ry, _, _ = geo
    grupos = [(cx + rng.uniform(-0.5, 0.5) * rx, cy + rng.uniform(-0.45, 0.45) * ry) for _ in range(4)]
    pts, intentos = [], 0
    dmin = rx * 0.085
    while len(pts) < n and intentos < 20000:
        intentos += 1
        x, y = cx + rng.uniform(-1, 1) * rx * 0.86, cy + rng.uniform(-1, 1) * ry * 0.86
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 0.74:
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < dmin * dmin for px, py, _, _ in pts):
            continue
        pts.append((x, y, 0.35 + rng.beta(1.5, 2.8) * 1.35, rng.uniform(0, 1)))
    cerca = lambda p: min(math.hypot(p[0] - gx, p[1] - gy) for gx, gy in grupos) * rng.uniform(0.8, 1.25)
    return sorted(pts, key=cerca)


def dibujar_colonia(capa, sombra, x, y, r, tono):
    """Esfera gelatinosa: cuerpo con degradado radial, borde translúcido, brillo especular y sombra."""
    sd = ImageDraw.Draw(sombra)
    sd.ellipse([x - r * 0.9 + r * 0.25, y - r * 0.75 + r * 0.32, x + r * 0.9 + r * 0.25, y + r * 0.75 + r * 0.32], fill=110)
    s = int(r * 2) + 2
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    d = np.hypot(xx - s / 2, yy - s / 2) / r
    luz = np.hypot(xx - s / 2 + r * 0.35, yy - s / 2 + r * 0.4) / r
    oscuro = color((28 + 10 * tono, 44 + 6 * tono, 14))
    claro = color((118 + 30 * tono, 138 + 10 * tono, 46 + 10 * tono))
    cuerpo = mezcla(claro, oscuro, np.clip(luz / 1.5, 0, 1) ** 1.2)
    cuerpo = mezcla(cuerpo, color((160, 175, 90)), np.clip((d - 0.86) * 7, 0, 1) * 0.5)  # borde gelatinoso
    alfa = np.clip((1 - d) * r * 0.9, 0, 1) * 255
    rgba = np.dstack([np.clip(cuerpo, 0, 255), alfa]).astype(np.uint8)
    capa.alpha_composite(Image.fromarray(rgba, "RGBA"), (int(x - s / 2), int(y - s / 2)))
    hd = ImageDraw.Draw(capa)
    hx, hy, hr = x - r * 0.38, y - r * 0.42, max(1.5, r * 0.22)
    hd.ellipse([hx - hr, hy - hr * 0.7, hx + hr, hy + hr * 0.7], fill=(255, 255, 240, 170))
    hd.ellipse([hx - hr * 0.45, hy - hr * 0.3, hx + hr * 0.45, hy + hr * 0.3], fill=(255, 255, 255, 230))


def render(id_, n, total, cobertura, base_img, agua, geo, pts):
    cx, cy, rx, ry, _, _ = geo
    area_agua = float(agua.sum())
    objetivo = cobertura / 100 * area_agua
    # Las primeras colonias del orden ya existen; con más cobertura, más colonias y más grandes
    k = max(5, int(len(pts) * min(1, 0.07 + cobertura / 100 * 0.95)))
    usadas = pts[:k]
    suma = sum(math.pi * (s ** 2) for _, _, s, _ in usadas)
    escala = math.sqrt(objetivo / max(suma, 1e-6)) * 1.08
    escala = min(escala, rx * 0.085 * 0.75 if cobertura < 70 else 64)

    img = Image.fromarray(np.clip(base_img, 0, 255).astype(np.uint8)).convert("RGBA")
    sombra = Image.new("L", (W, H), 0)
    capa = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    marcas = []
    for x, y, s, tono in sorted(usadas, key=lambda p: p[1]):
        r = max(3.0, s * escala)
        dibujar_colonia(capa, sombra, x, y, r, tono)
        marcas.append((x, y, r))
    sombra = sombra.filter(ImageFilter.GaussianBlur(4))
    img = Image.composite(Image.new("RGBA", (W, H), (10, 20, 18, 255)), img, sombra.point(lambda v: v * 0.55))
    img.alpha_composite(capa)
    # una película de agua encima de las colonias (están semisumergidas)
    vel = Image.new("RGBA", (W, H), (60, 120, 125, 0))
    va = Image.fromarray((agua * 38).astype(np.uint8))
    vel.putalpha(va)
    img.alpha_composite(vel)

    # Óptica de cámara: viñeta + grano
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    vig = 1 - 0.38 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    arr = np.asarray(img.convert("RGB"), np.float32) * vig[..., None]
    arr += np.random.default_rng(hash((id_, n)) % 2**32).normal(0, 4.5, arr.shape)
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")

    # Capa de la visión artificial
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for x, y, r in marcas:
        od.ellipse([x - r - 3, y - r - 3, x + r + 3, y + r + 3], outline=(255, 210, 63, 235), width=2)
    aisladas = sorted(marcas, key=lambda m: -min((math.hypot(m[0] - o[0], m[1] - o[1]) - m[2] - o[2] for o in marcas if o is not m), default=99))
    for x, y, r in aisladas[:3]:
        od.line([x + r * 0.7, y - r * 0.7, x + r + 10, y - r - 10], fill=(255, 210, 63, 200), width=1)
        etq = f"{2 * r / escala * 1.1:.1f} cm"
        tx, ty = x + r + 12, y - r - 24
        od.rectangle([tx - 3, ty - 2, tx + od.textlength(etq, font=FUENTE(12)) + 3, ty + 15], fill=(10, 12, 26, 170))
        od.text((tx, ty), etq, font=FUENTE(12), fill=(255, 230, 150, 240))
    od.rectangle([0, 0, W, 30], fill=(10, 12, 26, 175))
    od.text((12, 7), f"QOCHA ÑAWI · CAM-01 · {id_} · {n}/{total}", font=FUENTE(15), fill=(244, 236, 220, 255))
    txt = f"{len(marcas)} colonias · cobertura {cobertura:.1f} %"
    tw = od.textlength(txt, font=FUENTE(15))
    od.text((W - tw - 12, 7), txt, font=FUENTE(15), fill=(255, 210, 63, 255))
    od.rectangle([0, H - 26, W, H], fill=(10, 12, 26, 150))
    od.text((12, H - 21), "IMAGEN SINTÉTICA · DEMO DE CONCEPTO", font=FUENTE(13), fill=(244, 236, 220, 220))
    od.text((W - 190, H - 21), "SEGMENTACIÓN HSV v0.1", font=FUENTE(13), fill=(244, 236, 220, 160))
    img.alpha_composite(ov)
    return img.convert("RGB")


def main():
    vision = json.loads((DEMO / "vision.json").read_text(encoding="utf-8"))
    por_cocha = defaultdict(list)
    for v in vision:
        por_cocha[v["cocha_id"]].append(v)
    (DEMO / "fotos").mkdir(parents=True, exist_ok=True)
    for id_, serie in por_cocha.items():
        rng = np.random.default_rng(abs(hash(id_)) % 2**32 if False else sum(map(ord, id_)) * 7919)
        base, agua, geo = escena(rng)
        pts = colonias_base(rng, geo)
        serie.sort(key=lambda v: v["timestamp"])
        for n, v in enumerate(serie, 1):
            img = render(id_, n, len(serie), v["cobertura_pct"], base, agua, geo, pts)
            out = DEMO / v["foto"].removeprefix("demo/")
            img.save(out, quality=82, optimize=True, progressive=True)
            print(out.name, f"{out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
