"""Detecta cuerpos de agua (cochas candidatas) con Sentinel-2 L2A y les asigna altitud, pendiente y vegetación.

Sin cuenta ni clave: imágenes COG públicas (STAC Earth Search, AWS) y altitud SRTM (NASA) vía OpenTopoData.
Requiere: pip install rasterio numpy scipy pillow matplotlib

  python satellite/detectar_cochas.py --bbox -71.40,-15.85,-71.25,-15.70

Método (todo explicable):
  1. Escena Sentinel-2 L2A más reciente con poca nube que cubra el bbox.
  2. Máscara de nubes/sombras con la banda SCL (3, 8, 9, 10 y 11 = sombra, nube, cirros, nieve).
  3. Agua = NDWI = (Verde−NIR)/(Verde+NIR) > 0,05  Y  MNDWI = (Verde−SWIR1)/(Verde+SWIR1) > 0  Y  NIR < 0,12.
  4. Componentes conectados -> área, centroide (lat/lon WGS84).
  5. Para cada cuerpo: altitud y pendiente (SRTM 30 m), NDVI del anillo de 30–150 m (bofedal alrededor).
  6. indice_satelital PRELIMINAR = promedio de aptitudes (altitud, tamaño, vegetación del anillo, pendiente).
     SUPUESTO del modelo: ajustar con Adrián; no es una medición.

LÍMITES: una sola fecha (no distingue cochas permanentes de charcos de lluvia); la sombra del relieve puede dar falsos
positivos (se filtra con NIR y pendiente); la escena puede estar lejos de la temporada de lluvias.
"""
import argparse
import csv
import json
import sys
import time
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import rasterio
from rasterio.transform import xy
from rasterio.warp import transform as warp_transform, transform_bounds
from rasterio.windows import from_bounds
from scipy import ndimage

SALIDA = Path(__file__).with_name("datos")
STAC = "https://earth-search.aws.element84.com/v1/search"


def buscar_escena(bbox, dias, nube_max):
    ini = (date.today() - timedelta(days=dias)).isoformat()
    cuerpo = json.dumps({"collections": ["sentinel-2-l2a"], "bbox": bbox, "limit": 20,
                         "datetime": f"{ini}T00:00:00Z/{date.today().isoformat()}T23:59:59Z",
                         "query": {"eo:cloud_cover": {"lt": nube_max}},
                         "sortby": [{"field": "properties.datetime", "direction": "desc"}]}).encode()
    req = urllib.request.Request(STAC, cuerpo, {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        items = json.load(r)["features"]
    if not items:
        sys.exit("Sin escenas Sentinel-2 con esa nubosidad; sube --nube-max o --dias.")
    return items[0]


def leer(href, bbox, ancho_px, resampling=rasterio.enums.Resampling.bilinear):
    with rasterio.open(href) as src:
        b = transform_bounds("EPSG:4326", src.crs, *bbox)
        win = from_bounds(*b, transform=src.transform)
        alto_px = max(1, round(ancho_px * win.height / win.width))
        arr = src.read(1, window=win, out_shape=(alto_px, ancho_px), resampling=resampling, boundless=True, fill_value=0)
        tr = rasterio.transform.from_bounds(*b, ancho_px, alto_px)
        return arr.astype("float32"), tr, src.crs


def srtm(puntos):
    """Altitud SRTM 30 m (NASA) de una lista de (lat, lon); OpenTopoData: 100 puntos por llamada, 1 llamada/s."""
    out = []
    for i in range(0, len(puntos), 100):
        lote = puntos[i:i + 100]
        loc = "|".join(f"{la:.5f},{lo:.5f}" for la, lo in lote)
        with urllib.request.urlopen(f"https://api.opentopodata.org/v1/srtm30m?locations={loc}", timeout=60) as r:
            res = json.load(r)["results"]
        out += [x["elevation"] if x["elevation"] is not None else np.nan for x in res]
        time.sleep(1.1)
    return out


def aptitud_trap(x, mn, lo, hi, mx):
    if x is None or np.isnan(x) or x < mn or x > mx:
        return 0.0
    return 1.0 if lo <= x <= hi else (x - mn) / (lo - mn) if x < lo else (mx - x) / (mx - hi)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--bbox", default="-71.40,-15.85,-71.25,-15.70", help="oeste,sur,este,norte (WGS84)")
    ap.add_argument("--dias", type=int, default=75)
    ap.add_argument("--nube-max", type=float, default=30)
    ap.add_argument("--px", type=int, default=1500, help="ancho de lectura en píxeles (10 m por px si bbox ≈ 15 km)")
    ap.add_argument("--area-min-ha", type=float, default=0.1)
    ap.add_argument("--area-max-ha", type=float, default=20, help="más grande = embalse o laguna grande, no cocha")
    ap.add_argument("--max-cochas", type=int, default=40)
    a = ap.parse_args()
    bbox = [float(v) for v in a.bbox.split(",")]
    item = buscar_escena(bbox, a.dias, a.nube_max)
    fecha, nube = item["properties"]["datetime"][:10], item["properties"]["eo:cloud_cover"]
    print(f"Escena {item['id']} · {fecha} · nubes {nube:.0f} %")
    A = item["assets"]
    verde, tr, crs = leer(A["green"]["href"], bbox, a.px)
    nir, _, _ = leer(A["nir"]["href"], bbox, a.px)
    swir, _, _ = leer(A["swir16"]["href"], bbox, a.px)
    rojo, _, _ = leer(A["red"]["href"], bbox, a.px)
    scl, _, _ = leer(A["scl"]["href"], bbox, a.px, rasterio.enums.Resampling.nearest)
    verde, nir, swir, rojo = (x / 10000 for x in (verde, nir, swir, rojo))  # reflectancia
    valido = (verde > 0) & ~np.isin(scl, [0, 1, 3, 8, 9, 10, 11])
    with np.errstate(divide="ignore", invalid="ignore"):
        ndwi = (verde - nir) / (verde + nir)
        mndwi = (verde - swir) / (verde + swir)
        ndvi = (nir - rojo) / (nir + rojo)
    agua = valido & (ndwi > 0.05) & (mndwi > 0) & (nir < 0.12)
    agua = ndimage.binary_opening(agua, iterations=1)  # quita píxeles sueltos
    lab, n = ndimage.label(agua)
    px_m = abs(tr.a)
    ha_px = px_m * px_m / 1e4
    print(f"Píxel {px_m:.0f} m · {n} cuerpos de agua · {valido.mean():.0%} de la zona sin nube")

    cuerpos = []
    for i in range(1, n + 1):
        m = lab == i
        area = m.sum() * ha_px
        if area < a.area_min_ha:
            continue
        ys, xs = np.nonzero(m)
        xm, ym = xs.mean(), ys.mean()
        x_, y_ = xy(tr, ym, xm)
        lon, lat = warp_transform(crs, "EPSG:4326", [x_], [y_])
        anillo = ndimage.binary_dilation(m, iterations=max(1, round(150 / px_m))) & ~ndimage.binary_dilation(m, iterations=max(1, round(30 / px_m))) & valido & ~agua
        cuerpos.append(dict(i=i, lat=lat[0], lon=lon[0], area_ha=area, ndwi=float(ndwi[m].mean()),
                            ndvi_anillo=float(np.nanmean(ndvi[anillo])) if anillo.sum() > 5 else np.nan))
    for c in cuerpos:
        if c["area_ha"] > a.area_max_ha:
            print(f"  Excluido por tamaño: {c['lat']:.4f},{c['lon']:.4f} · {c['area_ha']:.0f} ha (embalse o laguna grande)")
    cuerpos = sorted((c for c in cuerpos if c["area_ha"] <= a.area_max_ha), key=lambda c: -c["area_ha"])[:a.max_cochas]
    if not cuerpos:
        sys.exit("No se detectaron cuerpos de agua con ese tamaño mínimo.")

    # altitud y pendiente SRTM: punto central y 4 vecinos a ~60 m
    d = 60 / 111000
    pts = []
    for c in cuerpos:
        pts += [(c["lat"], c["lon"]), (c["lat"] + d, c["lon"]), (c["lat"] - d, c["lon"]),
                (c["lat"], c["lon"] + d), (c["lat"], c["lon"] - d)]
    print(f"Consultando altitud SRTM de {len(pts)} puntos…")
    z = srtm(pts)
    for k, c in enumerate(cuerpos):
        z0, zn, zs, ze, zo = z[5 * k:5 * k + 5]
        c["altitud_m"] = z0
        c["pendiente_deg"] = float(np.degrees(np.arctan(np.hypot((ze - zo) / 120, (zn - zs) / 120))))
        f_alt = aptitud_trap(z0, 3000, 3800, 4800, 5200)
        f_area = min(1.0, c["area_ha"] / 1.0)  # 1 ha o más = 1
        f_veg = 0.0 if np.isnan(c["ndvi_anillo"]) else min(1.0, max(0.0, c["ndvi_anillo"] / 0.5))
        f_pen = 1.0 if c["pendiente_deg"] <= 5 else max(0.0, 1 - (c["pendiente_deg"] - 5) / 15)
        c["indice_satelital_prelim"] = round((f_alt + f_area + f_veg + f_pen) / 4, 2)

    cuerpos = [c for c in cuerpos if not np.isnan(c["altitud_m"]) and 3000 <= c["altitud_m"] <= 5200]
    cuerpos.sort(key=lambda c: -c["indice_satelital_prelim"])
    SALIDA.mkdir(parents=True, exist_ok=True)
    with open(SALIDA / "cochas_candidatas.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "lat", "lon", "altitud_m", "pendiente_deg", "area_ha", "ndwi", "ndvi_anillo", "indice_satelital_prelim", "escena"])
        for k, c in enumerate(cuerpos, 1):
            w.writerow([f"C-{k:02d}", f"{c['lat']:.5f}", f"{c['lon']:.5f}", round(c["altitud_m"]), f"{c['pendiente_deg']:.1f}",
                        f"{c['area_ha']:.2f}", f"{c['ndwi']:.2f}", "" if np.isnan(c["ndvi_anillo"]) else f"{c['ndvi_anillo']:.2f}",
                        c["indice_satelital_prelim"], f"{item['id']}"])
    print(f"\n{len(cuerpos)} cochas candidatas (3000–5200 m) -> {SALIDA / 'cochas_candidatas.csv'}")
    for k, c in enumerate(cuerpos[:10], 1):
        print(f"  C-{k:02d}  {c['lat']:.4f},{c['lon']:.4f}  {c['altitud_m']:.0f} m  {c['area_ha']:.2f} ha  NDWI {c['ndwi']:.2f}  índice {c['indice_satelital_prelim']}")

    # vista previa: color natural + agua detectada
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    rgb = np.clip(np.dstack([rojo, verde, leer(A["blue"]["href"], bbox, a.px)[0] / 10000]) * 3.5, 0, 1)
    fig, ax = plt.subplots(figsize=(9, 9 * rgb.shape[0] / rgb.shape[1]))
    ax.imshow(rgb)
    ax.contour(agua, levels=[0.5], colors="cyan", linewidths=0.6)
    for k, c in enumerate(cuerpos[:10], 1):
        x_, y_ = warp_transform("EPSG:4326", crs, [c["lon"]], [c["lat"]])
        col, row = ~tr * (x_[0], y_[0])
        ax.annotate(f"C-{k:02d}", (col, row), color="yellow", fontsize=8, xytext=(4, 4), textcoords="offset points")
    ax.set_title(f"Sentinel-2 {fecha} · agua detectada (NDWI/MNDWI) · datos ESA/Copernicus")
    ax.axis("off")
    fig.savefig(SALIDA / "cochas_vista_previa.png", dpi=130, bbox_inches="tight")
    print(f"Vista previa -> {SALIDA / 'cochas_vista_previa.png'}")


if __name__ == "__main__":
    main()
