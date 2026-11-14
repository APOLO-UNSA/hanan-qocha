"""Detecta y marca colonias de cushuro en fotos REALES o generadas con IA, con visión por computador clásica (OpenCV).

Por qué no solo color: en fotos reales el fondo de turba, las piedras y el pasto de la orilla tienen el mismo tono que el
cushuro. Lo que distingue a una colonia es la FORMA: una esfera gelatinosa con borde definido y un brillo de sol. Por eso:
  1. la foto se recorta al centro a 4:3 y se lleva a 960x720;
  2. se trabaja solo dentro del espejo de agua de esa cámara (roi-camaras.json: la cámara es fija, se define una vez);
  3. se buscan círculos (transformada de Hough) por franjas de profundidad, con el radio esperado por la perspectiva;
  4. cada candidato se verifica: color oliva/pardo, contorno nítido en la mayor parte del perímetro (= confianza),
     brillo especular en su interior y contraste con el agua que lo rodea; se quitan duplicados;
  5. se dibuja la capa de visión (máscara, contornos, cajas con la confianza y un panel) y se guarda en
     public/demo/fotos/ con el nombre que espera la app.
Las fotos sin imagen de entrada no se tocan (siguen las sintéticas).

Uso:
  python twin/scripts/marcar-fotos.py [--entrada twin/fotos-fuente] [--salida ...] [--etiqueta "..."] [--depurar]
"""
import argparse
import json
import math
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
DEMO = RAIZ / "public" / "demo"
W, H = 960, 720
AMARILLO, LILA, NOCHE = (77, 225, 255), (212, 155, 199), (34, 16, 14)  # BGR
# franjas de profundidad (y0, y1 en fracción de la altura) y radios esperados en píxeles
BANDAS = [(0.18, 0.36, 3, 9), (0.33, 0.50, 5, 13), (0.47, 0.64, 8, 19), (0.60, 0.80, 12, 28), (0.76, 1.0, 18, 42)]


def recortar_4_3(img):
    h, w = img.shape[:2]
    if w / h > 4 / 3:
        nw = int(h * 4 / 3)
        img = img[:, (w - nw) // 2:(w - nw) // 2 + nw]
    else:
        nh = int(w * 3 / 4)
        img = img[(h - nh) // 2:(h - nh) // 2 + nh]
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


def region_agua(cam, rois):
    roi = np.zeros((H, W), np.uint8)
    pts = rois.get(cam)
    if pts:
        cv2.fillPoly(roi, [np.array([(int(x * W), int(y * H)) for x, y in pts], np.int32)], 255)
    else:
        roi[int(H * .2):] = 255  # sin contorno: todo menos la franja del cielo
    return roi


def detectar(img, roi, a):
    gris = cv2.createCLAHE(2.0, (8, 8)).apply(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY))
    suave = cv2.GaussianBlur(gris, (5, 5), 1.2)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mag = cv2.magnitude(cv2.Sobel(suave, cv2.CV_32F, 1, 0), cv2.Sobel(suave, cv2.CV_32F, 0, 1))
    cand = []
    for y0, y1, rmin, rmax in BANDAS:
        ya, yb = int(y0 * H), int(y1 * H)
        c = cv2.HoughCircles(suave[ya:yb], cv2.HOUGH_GRADIENT, dp=1.2, minDist=rmin * 1.6, param1=70,
                             param2=max(10, rmin * 1.4), minRadius=rmin, maxRadius=rmax)
        if c is None:
            continue
        for x, y, r in c[0]:
            y += ya
            xi, yi = int(min(W - 1, x)), int(min(H - 1, y))
            if roi[yi, xi] == 0:
                continue
            m = np.zeros((H, W), np.uint8)
            cv2.circle(m, (xi, yi), max(2, int(r * .8)), 255, -1)
            hh, ss, vv = cv2.mean(hsv, mask=m)[:3]
            if not (a.h[0] <= hh <= a.h[1] and ss >= a.s and a.v[0] <= vv <= a.v[1]):
                continue
            ang = np.linspace(0, 2 * np.pi, 48, endpoint=False)
            px = np.clip((x + r * np.cos(ang)).astype(int), 0, W - 1)
            py = np.clip((y + r * np.sin(ang)).astype(int), 0, H - 1)
            soporte = float((mag[py, px] > 45).mean())  # fracción del contorno con borde nítido
            if soporte < a.min_soporte:
                continue
            mi = np.zeros((H, W), np.uint8)
            cv2.circle(mi, (xi, yi), max(2, int(r * .85)), 255, -1)
            dentro = hsv[mi > 0]
            brillo = float(((dentro[:, 2] > 185) & (dentro[:, 1] < 90)).mean())
            if not (.004 <= brillo <= .3):
                continue
            anillo = np.zeros((H, W), np.uint8)
            cv2.circle(anillo, (xi, yi), int(r * 1.5), 255, -1)
            cv2.circle(anillo, (xi, yi), int(r * 1.05), 0, -1)
            if abs(cv2.mean(gris, mask=m)[0] - cv2.mean(gris, mask=anillo)[0]) < 10:
                continue
            cand.append((float(x), float(y), float(r), soporte))
    cand.sort(key=lambda c: -c[3])
    colonias = []
    for c in cand:  # sin duplicados
        if all(math.hypot(c[0] - d[0], c[1] - d[1]) > .7 * max(c[2], d[2]) for d in colonias):
            colonias.append(c)
    mascara = np.zeros((H, W), np.uint8)
    for x, y, r, _ in colonias:
        cv2.circle(mascara, (int(x), int(y)), int(r), 1, -1)
    return mascara & (roi > 0), colonias


def capa(img, mascara, colonias, roi, v, id_, n, total, etiqueta):
    out = img.copy()
    tinte = out.copy()
    tinte[mascara > 0] = LILA
    out = cv2.addWeighted(tinte, .16, out, .84, 0)
    trazo = out.copy()
    for x, y, r, _ in colonias:
        cv2.circle(trazo, (int(x), int(y)), int(r), AMARILLO, 2 if r > 16 else 1, cv2.LINE_AA)
    out = cv2.addWeighted(trazo, .7, out, .3, 0)  # contornos translúcidos: se sigue viendo la colonia
    fuente = cv2.FONT_HERSHEY_SIMPLEX
    # cajas solo en algunas colonias grandes cuyas cajas (con su etiqueta) no se toquen
    elegidas = []
    for x, y, r, conf in sorted(colonias, key=lambda c: -c[2]):
        caja = (x - r - 3, y - r - 22, x + r + 70, y + r + 3)
        if all(caja[2] < e[0] or caja[0] > e[2] or caja[3] < e[1] or caja[1] > e[3] for e in (c[4] for c in elegidas)):
            elegidas.append((x, y, r, conf, caja))
        if len(elegidas) == 5:
            break
    for x, y, r, conf, _ in elegidas:
        x0, y0, x1, y1 = int(x - r) - 3, int(y - r) - 3, int(x + r) + 3, int(y + r) + 3
        cv2.rectangle(out, (x0, y0), (x1, y1), AMARILLO, 2, cv2.LINE_AA)
        txt = f"cushuro {conf:.2f}"
        (tw, _), _ = cv2.getTextSize(txt, fuente, .45, 1)
        cv2.rectangle(out, (x0, y0 - 18), (x0 + tw + 8, y0), AMARILLO, -1)
        cv2.putText(out, txt, (x0 + 4, y0 - 5), fuente, .45, NOCHE, 1, cv2.LINE_AA)
    cobertura = 100 * mascara.sum() / max(1, (roi > 0).sum())
    px, py = W - 250, 14
    panel = out.copy()
    cv2.rectangle(panel, (px, py), (W - 14, py + 76), NOCHE, -1)
    out = cv2.addWeighted(panel, .82, out, .18, 0)
    cv2.putText(out, "DETECCION HOUGH + COLOR", (px + 12, py + 22), fuente, .45, LILA, 1, cv2.LINE_AA)
    # La cobertura medida se imprime en consola; en la foto no, para no contradecir el valor de vision.json que muestra la app
    for i, (a_, b_) in enumerate([("colonias detectadas", f"{len(colonias)}"), ("biomasa est.", f"{v['biomasa_kg']:.1f} kg")]):
        yy = py + 46 + 20 * i
        cv2.putText(out, a_, (px + 12, yy), fuente, .48, (220, 236, 244), 1, cv2.LINE_AA)
        (tw, _), _ = cv2.getTextSize(b_, fuente, .5, 2)
        cv2.putText(out, b_, (W - 26 - tw, yy), fuente, .5, AMARILLO, 2, cv2.LINE_AA)
    ts = datetime.fromisoformat(v["timestamp"])
    franja = out.copy()
    cv2.rectangle(franja, (0, H - 28), (W, H), (0, 0, 0), -1)
    out = cv2.addWeighted(franja, .6, out, .4, 0)
    cv2.putText(out, f"QOCHA NAWI  CAM-01  {id_}", (12, H - 9), fuente, .52, (255, 255, 255), 1, cv2.LINE_AA)
    fecha = f"{ts:%Y-%m-%d  %H:%M}   {n}/{total}"
    (tw, _), _ = cv2.getTextSize(fecha, fuente, .52, 1)
    cv2.putText(out, fecha, (W - 12 - tw, H - 9), fuente, .52, (255, 255, 255), 1, cv2.LINE_AA)
    if etiqueta:  # aviso en la franja inferior, al centro
        (tw, _), _ = cv2.getTextSize(etiqueta, fuente, .42, 1)
        cv2.putText(out, etiqueta, ((W - tw) // 2, H - 10), fuente, .42, (255, 225, 77), 1, cv2.LINE_AA)
    return out, cobertura


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default=str(RAIZ / "fotos-fuente"))
    ap.add_argument("--salida", default=str(DEMO / "fotos"))
    ap.add_argument("--roi", default=str(Path(__file__).with_name("roi-camaras.json")), help="contorno del agua por cámara")
    ap.add_argument("--h", type=int, nargs=2, default=(8, 45), help="tono HSV de OpenCV (0-179) del cushuro")
    ap.add_argument("--s", type=int, default=45, help="saturación mínima")
    ap.add_argument("--v", type=int, nargs=2, default=(30, 215), help="brillo mínimo y máximo")
    ap.add_argument("--min-soporte", type=float, default=.55, help="fracción mínima del contorno con borde nítido")
    ap.add_argument("--etiqueta", default="", help="aviso opcional en la franja inferior de la foto")
    ap.add_argument("--depurar", action="store_true", help="dibuja también el contorno del agua usado")
    a = ap.parse_args()

    rois = json.loads(Path(a.roi).read_text(encoding="utf-8")) if Path(a.roi).exists() else {}
    vision = json.loads((DEMO / "vision.json").read_text(encoding="utf-8"))
    por_cocha = {}
    for v in sorted(vision, key=lambda v: v["timestamp"]):
        por_cocha.setdefault(v["cocha_id"], []).append(v)
    entrada, salida = Path(a.entrada), Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    hechas = 0
    for id_, serie in por_cocha.items():
        roi = region_agua(id_, rois)
        for n, v in enumerate(serie, 1):
            nombre = Path(v["foto"]).name
            fuente = next((p for p in (entrada / Path(nombre).with_suffix(e).name for e in (".jpg", ".jpeg", ".png", ".webp")) if p.exists()), None)
            if not fuente:
                continue
            img = recortar_4_3(cv2.imread(str(fuente)))
            mascara, colonias = detectar(img, roi, a)
            out, cob = capa(img, mascara, colonias, roi, v, id_, n, len(serie), a.etiqueta)
            if a.depurar:
                cnts, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cv2.drawContours(out, cnts, -1, (255, 200, 0), 1)
            cv2.imwrite(str(salida / nombre), out, [cv2.IMWRITE_JPEG_QUALITY, 86])
            print(f"{nombre}: {len(colonias)} colonias, cobertura del agua {cob:.1f} % (vision.json dice {v['cobertura_pct']} %)")
            hechas += 1
    print(f"{hechas} foto(s) marcadas" if hechas else f"No hay fotos de entrada en {entrada} (nombres esperados: QC-01-01.jpg, ...)")


if __name__ == "__main__":
    main()
