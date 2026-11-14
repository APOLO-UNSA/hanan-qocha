"""Marca colonias de cushuro en fotos REALES o generadas con IA, con segmentación HSV de verdad (OpenCV).

Para cada foto de public/demo/vision.json busca una imagen con el mismo nombre en la carpeta de entrada
(por ejemplo fotos-fuente/DEMO-01-01.jpg o .png/.webp). Si la encuentra:
  1. la recorta al centro a 4:3 y la lleva a 960x720;
  2. convierte a HSV y se queda con los tonos oliva/pardos del cushuro (rango ajustable);
  3. limpia la máscara (apertura y cierre morfológicos) y separa cada colonia (componentes conexas);
  3b. limita la búsqueda al espejo de agua (el pasto de la orilla tiene el mismo tono que el cushuro);
  4. dibuja la capa de visión: máscara translúcida, contornos, cajas con la redondez de cada colonia
     (4πA/P², 1 = círculo perfecto) y un panel con detecciones y área segmentada;
  5. guarda el resultado en public/demo/fotos/ con el nombre que espera la app.
Las fotos sin imagen de entrada no se tocan (siguen las sintéticas).

Uso:
  python twin/scripts/marcar-fotos.py [--entrada twin/fotos-fuente] [--h 15 45] [--s 60] [--v 25 210]
                                      [--min-area 80] [--roi-arriba 0.0] [--depurar]
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


def recortar_4_3(img):
    h, w = img.shape[:2]
    if w / h > 4 / 3:
        nw = int(h * 4 / 3)
        img = img[:, (w - nw) // 2:(w - nw) // 2 + nw]
    else:
        nh = int(w * 3 / 4)
        img = img[(h - nh) // 2:(h - nh) // 2 + nh]
    return cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)


def espejo_de_agua(hsv, a):
    """Región de la cocha: el área azulada más grande, con sus huecos rellenos (las colonias quedan dentro)."""
    agua = cv2.inRange(hsv, (a.agua_h[0], 8, 50), (a.agua_h[1], 255, 255))
    if a.roi_arriba > 0:
        agua[: int(H * a.roi_arriba)] = 0
    agua = cv2.morphologyEx(agua, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    cont, _ = cv2.findContours(agua, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not cont:
        return None
    mayor = max(cont, key=cv2.contourArea)
    if cv2.contourArea(mayor) < H * W * .05:
        return None
    region = np.zeros((H, W), np.uint8)
    cv2.drawContours(region, [cv2.convexHull(mayor)], -1, 255, -1)
    return cv2.erode(region, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))


def segmentar(img, a):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mascara = cv2.inRange(hsv, (a.h[0], a.s, a.v[0]), (a.h[1], 255, a.v[1]))
    if a.roi_arriba > 0:  # ignorar cielo y cerros
        mascara[: int(H * a.roi_arriba)] = 0
    region = None if a.sin_agua else espejo_de_agua(hsv, a)
    if region is not None:  # solo colonias dentro de la cocha: el pasto de la orilla tiene el mismo tono
        mascara = cv2.bitwise_and(mascara, region)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mascara = cv2.morphologyEx(mascara, cv2.MORPH_OPEN, k, iterations=2)
    mascara = cv2.morphologyEx(mascara, cv2.MORPH_CLOSE, k, iterations=1)
    n, etiquetas, stats, _ = cv2.connectedComponentsWithStats(mascara, 8)
    colonias = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < a.min_area:
            etiquetas[etiquetas == i] = 0
            continue
        comp = (etiquetas == i).astype(np.uint8)
        cont, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        per = cv2.arcLength(cont[0], True)
        redondez = min(1.0, 4 * math.pi * area / max(per * per, 1))
        colonias.append({"caja": (x, y, w, h), "area": int(area), "redondez": redondez, "contorno": cont[0]})
    return (etiquetas > 0).astype(np.uint8), colonias, region


def capa(img, mascara, colonias, region, v, id_, n, total, etiqueta):
    out = img.copy()
    tinte = out.copy()
    tinte[mascara > 0] = LILA
    out = cv2.addWeighted(tinte, .22, out, .78, 0)
    cv2.drawContours(out, [c["contorno"] for c in colonias], -1, AMARILLO, 2, cv2.LINE_AA)
    fuente = cv2.FONT_HERSHEY_SIMPLEX
    for c in sorted(colonias, key=lambda c: -c["area"])[:7]:
        x, y, w, h = c["caja"]
        cv2.rectangle(out, (x - 3, y - 3), (x + w + 3, y + h + 3), AMARILLO, 2, cv2.LINE_AA)
        txt = f"cushuro {c['redondez']:.2f}"
        (tw, th), _ = cv2.getTextSize(txt, fuente, .45, 1)
        cv2.rectangle(out, (x - 3, y - 20), (x + tw + 5, y - 3), AMARILLO, -1)
        cv2.putText(out, txt, (x + 1, y - 8), fuente, .45, NOCHE, 1, cv2.LINE_AA)
    # cobertura sobre el espejo de agua (comparable con cobertura_pct de vision.json); si no se halló el agua, sobre la foto
    area_pct = 100 * mascara.sum() / max(1, (region > 0).sum()) if region is not None else 100 * mascara.mean()
    # panel de resultados
    px, py = W - 236, 14
    panel = out.copy()
    cv2.rectangle(panel, (px, py), (W - 14, py + 96), (34, 16, 14), -1)
    out = cv2.addWeighted(panel, .82, out, .18, 0)
    cv2.putText(out, "SEGMENTACION HSV (OpenCV)", (px + 12, py + 22), fuente, .45, LILA, 1, cv2.LINE_AA)
    for i, (a_, b_) in enumerate([("detecciones", f"{len(colonias)}"), ("cobertura agua", f"{area_pct:.1f} %"), ("biomasa est.", f"{v['biomasa_kg']:.1f} kg")]):
        y = py + 46 + 20 * i
        cv2.putText(out, a_, (px + 12, y), fuente, .48, (220, 236, 244), 1, cv2.LINE_AA)
        (tw, _), _ = cv2.getTextSize(b_, fuente, .5, 2)
        cv2.putText(out, b_, (W - 26 - tw, y), fuente, .5, AMARILLO, 2, cv2.LINE_AA)
    # texto de cámara
    ts = datetime.fromisoformat(v["timestamp"])
    franja = out.copy()
    cv2.rectangle(franja, (0, H - 28), (W, H), (0, 0, 0), -1)
    out = cv2.addWeighted(franja, .6, out, .4, 0)
    cv2.putText(out, f"QOCHA NAWI  CAM-01  {id_}", (12, H - 9), fuente, .52, (255, 255, 255), 1, cv2.LINE_AA)
    fecha = f"{ts:%Y-%m-%d  %H:%M}   {n}/{total}"
    (tw, _), _ = cv2.getTextSize(fecha, fuente, .52, 1)
    cv2.putText(out, fecha, (W - 12 - tw, H - 9), fuente, .52, (255, 255, 255), 1, cv2.LINE_AA)
    if etiqueta:
        cv2.putText(out, etiqueta, (12, 22), fuente, .45, (0, 0, 0), 3, cv2.LINE_AA)
        cv2.putText(out, etiqueta, (12, 22), fuente, .45, (255, 255, 255), 1, cv2.LINE_AA)
    return out, area_pct


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default=str(RAIZ / "fotos-fuente"))
    ap.add_argument("--salida", default=str(DEMO / "fotos"))
    ap.add_argument("--h", type=int, nargs=2, default=(15, 45), help="tono HSV de OpenCV (0-179)")
    ap.add_argument("--s", type=int, default=60, help="saturación mínima")
    ap.add_argument("--v", type=int, nargs=2, default=(25, 210), help="brillo mínimo y máximo")
    ap.add_argument("--min-area", type=int, default=80, help="área mínima de una colonia (px)")
    ap.add_argument("--roi-arriba", type=float, default=0.0, help="fracción superior a ignorar (cielo)")
    ap.add_argument("--agua-h", type=int, nargs=2, default=(75, 115), help="tono HSV del agua (para limitar a la cocha)")
    ap.add_argument("--sin-agua", action="store_true", help="no limitar la búsqueda al espejo de agua")
    ap.add_argument("--etiqueta", default="IMAGEN GENERADA CON IA, DEMO DE CONCEPTO", help="aviso visible en la foto ('' para quitarlo, p. ej. con fotos reales)")
    ap.add_argument("--depurar", action="store_true", help="guarda también la máscara en blanco y negro")
    a = ap.parse_args()

    vision = json.loads((DEMO / "vision.json").read_text(encoding="utf-8"))
    por_cocha = {}
    for v in sorted(vision, key=lambda v: v["timestamp"]):
        por_cocha.setdefault(v["cocha_id"], []).append(v)
    entrada, salida = Path(a.entrada), Path(a.salida)
    salida.mkdir(parents=True, exist_ok=True)
    hechas = 0
    for id_, serie in por_cocha.items():
        for n, v in enumerate(serie, 1):
            nombre = Path(v["foto"]).name
            fuente = next((p for p in (entrada / Path(nombre).with_suffix(e).name for e in (".jpg", ".jpeg", ".png", ".webp")) if p.exists()), None)
            if not fuente:
                continue
            img = recortar_4_3(cv2.imread(str(fuente)))
            mascara, colonias, region = segmentar(img, a)
            out, area = capa(img, mascara, colonias, region, v, id_, n, len(serie), a.etiqueta)
            cv2.imwrite(str(salida / nombre), out, [cv2.IMWRITE_JPEG_QUALITY, 86])
            if a.depurar:
                cv2.imwrite(str(salida / f"{Path(nombre).stem}-mascara.png"), mascara * 255)
            print(f"{nombre}: {len(colonias)} colonias, cobertura del agua {area:.1f} % (vision.json dice {v['cobertura_pct']} %)")
            hechas += 1
    print(f"{hechas} foto(s) marcadas" if hechas else f"No hay fotos de entrada en {entrada} (nombres esperados: DEMO-01-01.jpg, ...)")


if __name__ == "__main__":
    main()
