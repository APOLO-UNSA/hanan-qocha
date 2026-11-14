"""Dibuja las fotos SINTÉTICAS de la demo (public/demo/fotos/*.jpg) a partir de public/demo/vision.json.

Simulan la cámara Qocha Ñawi montada en un poste a la orilla, mirando la cocha en diagonal:
  1. Se arma la cocha vista desde arriba: agua con fondo de turba, orilla de barro, cojines de bofedal e ichu,
     y colonias de cushuro (Nostoc sphaericum) irregulares, translúcidas, en tonos oliva a pardo.
  2. Se proyecta con perspectiva (homografía) a la vista oblicua de la cámara; arriba quedan la orilla lejana,
     los cerros nevados y el cielo, con neblina de distancia y desenfoque de lo lejano.
  3. El agua refleja el cielo más hacia el fondo y tiene destellos de sol.
  4. Óptica de cámara: viñeta, aberración cromática, ruido de sensor y compresión JPG.
  5. Capa de visión artificial como la de una herramienta real: máscara de segmentación, contornos, cajas con
     su confianza y un panel con detecciones, cobertura y biomasa estimada.
Cada cocha es la MISMA laguna en el tiempo: las colonias persisten, crecen y aparecen nuevas.
Uso: python twin/scripts/gen-fotos.py   (requiere numpy y Pillow). Correr después de gen-demo.mjs.
"""
import json
import math
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

DEMO = Path(__file__).resolve().parent.parent / "public" / "demo"
OUT_W, OUT_H = 960, 720          # tamaño final
CW, CH = 1440, 1080              # lienzo de la cámara (se reduce al final: antialias)
WW = WH = 1700                   # mundo visto desde arriba
HORIZONTE = 150                  # fila del horizonte en el lienzo de la cámara (cámara baja, mirando a la cocha)


def fuente(tam, negrita=False):
    for f in (("C:/Windows/Fonts/consolab.ttf" if negrita else "C:/Windows/Fonts/consola.ttf"), "C:/Windows/Fonts/cour.ttf"):
        try:
            return ImageFont.truetype(f, tam)
        except OSError:
            pass
    return ImageFont.load_default(tam)


def ruido(rng, w, h, escalas, pesos=None):
    pesos = pesos or [1 / (i + 1) for i in range(len(escalas))]
    z = np.zeros((h, w), np.float32)
    for e, p in zip(escalas, pesos):
        g = rng.random((max(2, int(h * e / w)), e)).astype(np.float32)
        z += p * np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), np.float32) / 255
    z -= z.min()
    return z / max(z.max(), 1e-6)


def mezcla(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]


def C(*v):
    return np.array(v, np.float32)


# ---------------------------------------------------------------- 1. el mundo visto desde arriba
def mundo(rng, con_agua=True):
    yy, xx = np.mgrid[0:WH, 0:WW].astype(np.float32)
    cx, cy, rx, ry = WW * 0.5, WH * 0.55, WW * 0.40, WH * 0.36
    ang = np.arctan2((yy - cy) / ry, (xx - cx) / rx)
    dist = np.hypot((xx - cx) / rx, (yy - cy) / ry)
    borde = 1 + 0.08 * np.sin(3 * ang + rng.uniform(0, 6)) + 0.05 * np.sin(5 * ang + rng.uniform(0, 6))
    borde += 0.07 * (ruido(rng, WW, WH, (6, 12, 24)) - 0.5)
    agua = np.clip((borde - dist) * 22, 0, 1) if con_agua else np.zeros_like(dist)

    # orilla y bofedal
    n1 = ruido(rng, WW, WH, (32, 64, 128, 256), [1, .8, .6, .5])
    suelo = mezcla(C(48, 74, 32), C(104, 122, 50), n1)
    suelo = mezcla(suelo, C(150, 132, 84), np.clip((ruido(rng, WW, WH, (8, 16, 32)) - .6) * 3, 0, 1))
    orilla = np.clip(1 - np.abs(dist - borde) * 7, 0, 1) ** 1.4 * (1 if con_agua else 0)
    suelo = mezcla(suelo, C(62, 50, 36), orilla * .9)
    # fondo de la cocha: turba, piedras y algas vistos a través del agua
    turba = mezcla(C(58, 48, 30), C(98, 96, 56), ruido(rng, WW, WH, (8, 16, 32, 64, 128)))
    prof = np.clip(1 - dist / borde, 0, 1)
    aguac = mezcla(turba * .55 + C(30, 70, 72) * .45, C(18, 44, 52), prof ** .7)
    img = mezcla(suelo, aguac, agua)
    img = cojines(rng, img, agua)
    return img, agua, (cx, cy, rx, ry)


def cojines(rng, arr, agua):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    capa = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    for _ in range(9000):
        x, y = rng.uniform(0, WW), rng.uniform(0, WH)
        if agua[int(y) % WH, int(x) % WW] > .05:
            continue
        r = rng.uniform(4, 13)
        if rng.random() < .2:  # matas de ichu
            c = tuple(int(v) for v in rng.uniform((150, 128, 74), (210, 186, 118)))
            for _ in range(7):
                a = rng.uniform(-2.5, -.6)
                d.line([x, y, x + math.cos(a) * r * 2.6, y + math.sin(a) * r * 2.6], fill=c + (180,), width=2)
            continue
        g = rng.uniform(0, 1)
        base = (int(38 + 62 * g), int(66 + 62 * g), int(24 + 24 * g))
        d.ellipse([x - r + 2, y - r * .8 + 3, x + r + 2, y + r * .8 + 3], fill=(16, 24, 10, 100))
        d.ellipse([x - r, y - r * .85, x + r, y + r * .85], fill=base + (240,))
        d.ellipse([x - r * .55, y - r * .6, x + r * .2, y - r * .05], fill=(min(255, base[0] + 48), min(255, base[1] + 52), base[2] + 22, 150))
    im.alpha_composite(capa.filter(ImageFilter.GaussianBlur(.7)))
    return np.asarray(im.convert("RGB"), np.float32)


def colonias_base(rng, geo, n=190):
    """Posiciones fijas y forma propia de cada colonia; aparecen desde unos manchones hacia afuera."""
    cx, cy, rx, ry = geo
    grupos = [(cx + rng.uniform(-.55, .55) * rx, cy + rng.uniform(-.5, .5) * ry) for _ in range(4)]
    pts, dmin = [], rx * .07
    for _ in range(25000):
        if len(pts) >= n:
            break
        x, y = cx + rng.uniform(-1, 1) * rx * .88, cy + rng.uniform(-1, 1) * ry * .88
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > .76:
            continue
        if any((x - px) ** 2 + (y - py) ** 2 < dmin * dmin for px, py, *_ in pts):
            continue
        forma = rng.normal(0, 1, 4)  # deformación propia (armónicos 2..5)
        pts.append((x, y, .35 + rng.beta(1.5, 2.6) * 1.4, rng.uniform(0, 1), forma, rng.random() < .22))
    cerca = lambda p: min(math.hypot(p[0] - gx, p[1] - gy) for gx, gy in grupos) * rng.uniform(.8, 1.25)
    return sorted(pts, key=cerca)


def dibujar_colonias(img, etiquetas, usadas, escala):
    """Colonias irregulares con volumen, borde gelatinoso translúcido, brillo y sombra; etiqueta de cada una."""
    base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).convert("RGBA")
    sombra = Image.new("L", base.size, 0)
    sd = ImageDraw.Draw(sombra)
    capa = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ed = ImageDraw.Draw(etiquetas)
    for k, (x, y, s, tono, forma, sumergida) in enumerate(usadas, start=1):
        ky = estirar(x, y) * .96  # esferas redondas en la cámara (apenas achatadas por flotar)
        r = max(3.0, s * escala / math.sqrt(ky))  # misma área en el mundo: la cobertura no cambia
        ang = np.linspace(0, 2 * math.pi, 28, endpoint=False)
        rr = r * (1 + .07 * forma[0] * np.sin(2 * ang) + .05 * forma[1] * np.cos(3 * ang) + .04 * forma[2] * np.sin(5 * ang + forma[3]))
        poli = [(x + math.cos(a) * q, y + math.sin(a) * q * ky) for a, q in zip(ang, rr)]
        sd.polygon([(px + r * .3, py + r * .5 * ky) for px, py in poli], fill=150)
        ed.polygon(poli, fill=min(k, 255))
        # cuerpo: degradado radial con luz desde arriba a la izquierda
        s2 = int(r * 2.4 * ky) + 4
        m = Image.new("L", (s2, s2), 0)
        ImageDraw.Draw(m).polygon([(px - x + s2 / 2, py - y + s2 / 2) for px, py in poli], fill=255)
        m = m.filter(ImageFilter.GaussianBlur(.8))
        yy, xx = np.mgrid[0:s2, 0:s2].astype(np.float32)
        luz = np.hypot(xx - s2 / 2 + r * .38, (yy - s2 / 2) / ky + r * .42) / r
        oscuro = C(18 + 16 * tono, 28 + 6 * tono, 10 + 4 * tono)
        claro = C(78 + 34 * tono, 100 + 8 * tono, 30 + 10 * tono)
        cuerpo = mezcla(claro, oscuro, np.clip(luz / 1.55, 0, 1) ** 1.15)
        borde = np.asarray(m, np.float32) / 255
        gel = np.clip((1 - borde) * 3.5, 0, 1) * (borde > .02)
        cuerpo = mezcla(cuerpo, C(120, 140, 80), gel * .5)
        alfa = borde * (1 - gel * .35) * (.62 if sumergida else 1) * 255
        capa.alpha_composite(Image.fromarray(np.dstack([np.clip(cuerpo, 0, 255), alfa]).astype(np.uint8), "RGBA"), (int(x - s2 / 2), int(y - s2 / 2)))
        if not sumergida:
            hd = ImageDraw.Draw(capa)
            hx, hy, hr = x - r * .36, y - r * .4 * ky, max(1.6, r * .2)
            hd.ellipse([hx - hr * 1.4, hy - hr * .8 * ky, hx + hr * 1.4, hy + hr * .8 * ky], fill=(240, 250, 230, 110))
            hd.ellipse([hx - hr * .5, hy - hr * .32 * ky, hx + hr * .5, hy + hr * .32 * ky], fill=(255, 255, 255, 235))
    sombra = sombra.filter(ImageFilter.GaussianBlur(6))
    base = Image.composite(Image.new("RGBA", base.size, (8, 18, 16, 255)), base, sombra.point(lambda v: int(v * .5)))
    base.alpha_composite(capa)
    return np.asarray(base.convert("RGB"), np.float32)


# ---------------------------------------------------------------- 2. perspectiva de la cámara
def homografia(src, dst):
    """Coeficientes de PIL (salida → entrada) que llevan los puntos dst (cámara) a src (mundo)."""
    A, b = [], []
    for (X, Y), (x, y) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -X * x, -X * y], [0, 0, 0, x, y, 1, -Y * x, -Y * y]]
        b += [X, Y]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()


MUNDO_Q = [(0, 0), (WW, 0), (WW, WH), (0, WH)]
CAMARA_Q = [(-CW * .05, HORIZONTE + 4), (CW * 1.05, HORIZONTE + 4), (CW * 1.95, CH * 1.12), (-CW * .95, CH * 1.12)]
COEF = homografia(MUNDO_Q, CAMARA_Q)
FWD = homografia(CAMARA_Q, MUNDO_Q)  # mundo → cámara


def proyectar(x, y):
    a, b, c, d, e, f, g, h = FWD
    w = g * x + h * y + 1
    return (a * x + b * y + c) / w, (d * x + e * y + f) / w


def estirar(x, y):
    """Cuánto hay que alargar en Y (en el mundo) para que una esfera se vea redonda en la cámara."""
    x0, y0 = proyectar(x, y)
    x1, _ = proyectar(x + 1, y)
    _, y2 = proyectar(x, y + 1)
    return max(1.0, min(4.0, abs(x1 - x0) / max(abs(y2 - y0), 1e-6)))
# Campo de bofedal alrededor (sin cocha), proyectado más ancho: llena el suelo hasta el horizonte
COEF_CAMPO = homografia(MUNDO_Q, [(-CW * 1.4, HORIZONTE + 2), (CW * 2.4, HORIZONTE + 2), (CW * 5, CH * 1.12), (-CW * 4, CH * 1.12)])
_gx, _gy = np.meshgrid(np.arange(WW), np.arange(WH))
_d = np.minimum.reduce([_gx, _gy, WW - 1 - _gx, WH - 1 - _gy])
BORDE_SUAVE = Image.fromarray((np.clip(_d / 260, 0, 1) ** 1.5 * 255).astype(np.uint8))  # el mundo se funde con el campo


def cielo_y_cerros(rng):
    yy = np.mgrid[0:CH, 0:CW][0].astype(np.float32)
    t = np.clip(yy / HORIZONTE, 0, 1)
    cielo = mezcla(C(118, 158, 206), C(218, 228, 236), t ** 1.6)
    im = Image.fromarray(cielo.astype(np.uint8))
    d = ImageDraw.Draw(im, "RGBA")
    for _ in range(9):  # nubes suaves
        x, y, w = rng.uniform(0, CW), rng.uniform(30, HORIZONTE * .55), rng.uniform(120, 340)
        for k in range(6):
            d.ellipse([x + k * w * .12, y - w * .07, x + k * w * .12 + w * .5, y + w * .09], fill=(250, 250, 252, 38))
    x = np.linspace(0, CW, 300)
    # cordillera lejana azulada con nieve y lomas cercanas pardas
    for base, alto, col, nieve in [(HORIZONTE - 18, 120, (142, 152, 172), True), (HORIZONTE + 4, 60, (112, 104, 86), False)]:
        y = base - alto * (.35 + .65 * np.abs(np.sin(x / CW * math.pi * rng.uniform(1.4, 2.6) + rng.uniform(0, 6))))
        y += np.cumsum(rng.normal(0, 1.4, len(x))) * .6
        d.polygon([(0, CH)] + list(zip(x, y)) + [(CW, CH)], fill=col + (255,))
        if nieve:
            tope = y.min() + 28
            d.polygon([(0, tope)] + list(zip(x, np.minimum(y, tope))) + [(CW, tope)], fill=(246, 248, 252, 230))
    return np.asarray(im, np.float32)


def a_camara(im, resample=Image.BICUBIC, coef=None):
    if not isinstance(im, Image.Image):
        im = Image.fromarray(im)
    return im.transform((CW, CH), Image.PERSPECTIVE, coef or COEF, resample=resample)


# ---------------------------------------------------------------- 3-5. render de una toma
def render(id_, n, total, v, mundo_img, agua, geo, pts, fondo, capa=True):
    cx, cy, rx, ry = geo
    area_agua = float(agua.sum())
    cob = v["cobertura_pct"]
    k = max(6, int(len(pts) * min(1, .06 + cob / 100 * .95)))
    usadas = pts[:k]
    suma = sum(math.pi * (p[2] ** 2) for p in usadas)
    escala = min(math.sqrt(cob / 100 * area_agua / max(suma, 1e-6)) * 1.05, rx * .07 * (.78 if cob < 70 else 1.25))
    etiquetas = Image.new("L", (WW, WH), 0)
    rng = np.random.default_rng(n * 101 + sum(map(ord, id_)))
    vista = dibujar_colonias(mundo_img, etiquetas, usadas, escala)

    # proyección a la cámara
    cam = np.asarray(a_camara(np.clip(vista, 0, 255).astype(np.uint8)), np.float32)
    cubierto = np.asarray(a_camara(BORDE_SUAVE, Image.BILINEAR), np.float32) / 255
    agua_c = np.asarray(a_camara(Image.fromarray((agua * 255).astype(np.uint8)), Image.BILINEAR), np.float32) / 255
    lab = np.asarray(a_camara(etiquetas, Image.NEAREST))

    yy, xx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    lejos = np.clip(1 - (yy - HORIZONTE) / (CH - HORIZONTE), 0, 1)  # 1 en el horizonte, 0 abajo
    # reflejo del cielo en el agua (más fuerte hacia el fondo) y destellos de sol
    refl = mezcla(np.broadcast_to(C(150, 180, 205), cam.shape), np.broadcast_to(C(215, 226, 234), cam.shape), lejos)
    # las colonias flotan en la superficie: no reflejan el cielo
    colonia = np.asarray(Image.fromarray(((lab > 0) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), np.float32) / 255
    cam = mezcla(cam, refl, agua_c * (1 - colonia) * (.08 + .5 * lejos ** 2.6))
    destellos = (rng.random((CH, CW)) > .99985) * agua_c * (1 - colonia) * (lejos > .35)
    cam = cam + (np.asarray(Image.fromarray((np.clip(destellos, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) * 2.2)[..., None]
    # neblina de distancia y desenfoque de lo lejano
    cam = mezcla(cam, np.broadcast_to(C(200, 210, 218), cam.shape), (lejos ** 4) * .5)
    lejano = np.asarray(Image.fromarray(np.clip(cam, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), np.float32)
    cam = mezcla(cam, lejano, np.clip((lejos - .45) * 2, 0, 1))
    img = mezcla(fondo, cam, np.clip(cubierto, 0, 1))

    # óptica: viñeta, aberración cromática, ruido de sensor
    vig = 1 - .42 * (((xx - CW / 2) / (CW / 2)) ** 2 + ((yy - CH / 2) / (CH / 2)) ** 2)
    img = img * vig[..., None]
    img[..., 0] = np.roll(img[..., 0], 2, axis=1)
    img[..., 2] = np.roll(img[..., 2], -2, axis=1)
    img = 255 * ((np.clip(img, 0, 255) / 255) ** .86) * 1.06  # exposición: más luminosa, como una toma de día
    img = img + rng.normal(0, 5, img.shape)
    foto = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((OUT_W, OUT_H), Image.LANCZOS)
    if not capa:  # foto "cruda", sin la capa de visión (para probar marcar-fotos.py)
        return foto

    # capa de visión: segmentación + contornos + cajas
    lab_s = np.asarray(Image.fromarray(lab).resize((OUT_W, OUT_H), Image.NEAREST))
    mascara = lab_s > 0
    borde = mascara & ((np.roll(lab_s, 1, 0) != lab_s) | (np.roll(lab_s, 1, 1) != lab_s) | (np.roll(lab_s, -1, 0) != lab_s) | (np.roll(lab_s, -1, 1) != lab_s))
    ov = np.zeros((OUT_H, OUT_W, 4), np.uint8)
    ov[mascara] = (199, 155, 212, 40)        # lila translúcido: color del pilar de visión en la app
    ov[borde] = (255, 225, 77, 255)
    foto = foto.convert("RGBA")
    foto.alpha_composite(Image.fromarray(ov, "RGBA"))
    d = ImageDraw.Draw(foto)
    ids, cuenta = np.unique(lab_s[mascara], return_counts=True)
    for e in ids[np.argsort(-cuenta)][:7]:
        ys, xs = np.nonzero(lab_s == e)
        x0, y0, x1, y1 = xs.min() - 3, ys.min() - 3, xs.max() + 3, ys.max() + 3
        txt = f"cushuro {.86 + .13 * rng.random():.2f}"
        tw = d.textlength(txt, font=fuente(12, True))
        d.rectangle([x0, y0, x1, y1], outline=(255, 225, 77, 255), width=2)
        d.rectangle([x0, y0 - 17, x0 + tw + 8, y0], fill=(255, 225, 77, 235))
        d.text((x0 + 4, y0 - 15), txt, font=fuente(12, True), fill=(20, 18, 30, 255))
    # panel de resultados
    filas = [("detecciones", f"{len(ids)}"), ("cobertura", f"{cob:.1f} %"), ("biomasa est.", f"{v['biomasa_kg']:.1f} kg")]
    px, py = OUT_W - 222, 14
    d.rounded_rectangle([px, py, OUT_W - 14, py + 30 + 21 * len(filas)], radius=8, fill=(14, 16, 34, 205))
    d.text((px + 12, py + 8), "SEGMENTACIÓN HSV v0.1", font=fuente(12, True), fill=(199, 155, 212, 255))
    for i, (a, b) in enumerate(filas):
        d.text((px + 12, py + 30 + 21 * i), a, font=fuente(14), fill=(244, 236, 220, 220))
        d.text((OUT_W - 26 - d.textlength(b, font=fuente(14, True)), py + 30 + 21 * i), b, font=fuente(14, True), fill=(255, 225, 77, 255))
    # texto de cámara trampa
    ts = datetime.fromisoformat(v["timestamp"])
    temp = 6 + 6 * math.sin((ts.hour - 8) / 24 * 2 * math.pi) + rng.normal(0, .4)
    d.rectangle([0, OUT_H - 28, OUT_W, OUT_H], fill=(0, 0, 0, 150))
    d.text((12, OUT_H - 22), f"QOCHA ÑAWI  CAM-01  {id_}", font=fuente(15, True), fill=(255, 255, 255, 235))
    fecha = f"{ts:%Y-%m-%d  %H:%M}   {temp:4.1f}°C   {n}/{total}"
    d.text((OUT_W - 12 - d.textlength(fecha, font=fuente(15)), OUT_H - 22), fecha, font=fuente(15), fill=(255, 255, 255, 235))
    return foto.convert("RGB")


def main():
    vision = json.loads((DEMO / "vision.json").read_text(encoding="utf-8"))
    por_cocha = defaultdict(list)
    for v in vision:
        por_cocha[v["cocha_id"]].append(v)
    (DEMO / "fotos").mkdir(parents=True, exist_ok=True)
    for id_, serie in por_cocha.items():
        rng = np.random.default_rng(sum(map(ord, id_)) * 7919)
        mundo_img, agua, geo = mundo(rng)
        pts = colonias_base(rng, geo)
        fondo = cielo_y_cerros(rng)
        campo, _, _ = mundo(rng, con_agua=False)
        campo_c = np.asarray(a_camara(np.clip(campo, 0, 255).astype(np.uint8), coef=COEF_CAMPO), np.float32)
        suelo = np.asarray(a_camara(Image.new("L", (WW, WH), 255), Image.BILINEAR, COEF_CAMPO), np.float32)[..., None] / 255
        fondo = fondo * (1 - suelo) + campo_c * suelo
        serie.sort(key=lambda v: v["timestamp"])
        for n, v in enumerate(serie, 1):
            img = render(id_, n, len(serie), v, mundo_img, agua, geo, pts, fondo)
            out = DEMO / v["foto"].removeprefix("demo/")
            img.save(out, quality=84, optimize=True, progressive=True)
            print(out.name, f"{out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
