"""Datos NASA con token Earthdata: ECOSTRESS (temperatura de superficie 70 m), SMAP (humedad del suelo 9 km),
HLS (NDWI/NDVI 30 m), GPM IMERG (lluvia) y OMI (UV).

TOKEN: variable de entorno EARTHDATA_TOKEN (urs.earthdata.nasa.gov -> perfil -> Generate Token). NUNCA en el repo.
  PowerShell:  $env:EARTHDATA_TOKEN = "..."        bash:  export EARTHDATA_TOKEN=...
Requiere: pip install requests numpy rasterio h5py fsspec aiohttp

  python satellite/earthdata.py ecostress [--dias 30]
  python satellite/earthdata.py smap      [--dias 10]
  python satellite/earthdata.py hls       [--dias 60]
  python satellite/earthdata.py gpm|omiuv [--dias 30]    (GES DISC: aceptar antes el EULA, ver mensaje de error)

Puntos: satellite/datos/cochas_candidatas.csv (salida de detectar_cochas.py). Salidas: satellite/datos/<producto>.csv

LÍMITES: ECOSTRESS mide la temperatura de la SUPERFICIE del agua (piel, ~1 mm), no la columna; pasa de forma irregular
(no todos los días) y a distintas horas. SMAP tiene 9 km: no distingue una cocha, es contexto regional.
"""
import argparse
import csv
import json
import os
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.warp import transform as warp_transform

DATOS = Path(__file__).with_name("datos")
CMR = "https://cmr.earthdata.nasa.gov/search/granules.json"


def token():
    t = os.environ.get("EARTHDATA_TOKEN")
    if not t:
        sys.exit("Falta la variable EARTHDATA_TOKEN (ver el encabezado de este archivo).")
    return t


def puntos():
    ruta = DATOS / "cochas_candidatas.csv"
    if not ruta.exists():
        sys.exit("Falta satellite/datos/cochas_candidatas.csv: corre antes satellite/detectar_cochas.py")
    return [(r["id"], float(r["lat"]), float(r["lon"])) for r in csv.DictReader(open(ruta, encoding="utf-8"))]


def granulos(corto, ver, dias, bbox, n=200):
    ini = (date.today() - timedelta(days=dias)).isoformat()
    r = requests.get(CMR, params=dict(short_name=corto, version=ver, bounding_box=bbox, page_size=n, sort_key="start_date",
                                      temporal=f"{ini}T00:00:00Z,{date.today().isoformat()}T23:59:59Z"), timeout=60)
    r.raise_for_status()
    return r.json()["feed"]["entry"]


def bbox_de(pts, margen=0.02):
    la = [p[1] for p in pts]
    lo = [p[2] for p in pts]
    return f"{min(lo) - margen},{min(la) - margen},{max(lo) + margen},{max(la) + margen}"


def enlace(g, sufijo):
    for l in g["links"]:
        if l.get("rel", "").endswith("/data#") and l["href"].endswith(sufijo):
            return l["href"]


def muestrear(url, H, pts):
    """Valor del ráster en cada punto (descarga el archivo, que aquí pesa < 1 MB)."""
    r = requests.get(url, headers=H, timeout=120)
    r.raise_for_status()
    with rasterio.MemoryFile(r.content) as mf, mf.open() as src:
        xs, ys = warp_transform("EPSG:4326", src.crs, [p[2] for p in pts], [p[1] for p in pts])
        return [v[0] for v in src.sample(zip(xs, ys))], src.nodata


def muestrear_cog(url, H, pts):
    """Lectura por ventanas de un COG grande (HLS, 27 MB): se resuelve la redirección con el token y GDAL lee
    solo los bloques necesarios del enlace firmado. Devuelve None por punto fuera de la escena."""
    r = requests.get(url, headers=H, stream=True, timeout=60)
    r.raise_for_status()
    final = r.url
    r.close()
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"), rasterio.open(final) as src:
        xs, ys = warp_transform("EPSG:4326", src.crs, [p[2] for p in pts], [p[1] for p in pts])
        b = src.bounds
        out = []
        for x, y in zip(xs, ys):
            out.append(float(next(src.sample([(x, y)]))[0]) if b.left <= x <= b.right and b.bottom <= y <= b.top else None)
        return out


def escribir(nombre, filas, cab):
    DATOS.mkdir(parents=True, exist_ok=True)
    ruta = DATOS / nombre
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(cab)
        w.writerows(filas)
    print(f"{len(filas)} filas -> {ruta}")


def ecostress(a):
    pts = puntos()
    H = {"Authorization": f"Bearer {token()}"}
    gs = granulos("ECO_L2T_LSTE", "002", a.dias, bbox_de(pts))
    print(f"{len(gs)} pasadas de ECOSTRESS en {a.dias} días")
    filas = []
    for g in gs:
        base = g["title"]
        u_lst, u_cloud = enlace(g, "_LST.tif"), enlace(g, "_cloud.tif")
        if not u_lst:
            continue
        try:
            lst, nd = muestrear(u_lst, H, pts)
            nube, _ = muestrear(u_cloud, H, pts) if u_cloud else ([np.nan] * len(pts), None)
        except Exception as e:
            print(f"  {base}: {e}")
            continue
        for (cid, la, lo), v, c in zip(pts, lst, nube):
            if v is None or (nd is not None and v == nd) or not np.isfinite(v) or v <= 0:
                continue
            filas.append([g["time_start"], cid, f"{la:.5f}", f"{lo:.5f}", round(float(v) - 273.15, 2), int(c) if np.isfinite(c) else ""])
    escribir("ecostress_lst.csv", filas, ["utc", "cocha", "lat", "lon", "lst_c", "nube_flag"])


def smap(a):
    import fsspec  # noqa: lectura parcial por HTTP: el archivo diario pesa ~600 MB y solo hace falta un píxel
    import h5py
    pts = puntos()
    H = {"Authorization": f"Bearer {token()}"}
    gs = granulos("SPL3SMP_E", "006", a.dias, bbox_de(pts, 0.3), 60)
    filas = []
    for g in gs:
        url = enlace(g, ".h5")
        try:
            with fsspec.open(url, "rb", headers=H, block_size=4 * 2 ** 20).open() as fh, h5py.File(fh, "r") as f:
                for orb in ("AM", "PM"):
                    grp = f[f"Soil_Moisture_Retrieval_Data_{orb}"]
                    suf = "" if orb == "AM" else "_pm"
                    lat, lon = grp[f"latitude{suf}"][...], grp[f"longitude{suf}"][...]
                    sm = grp[f"soil_moisture{'' if orb == 'AM' else '_pm'}"]
                    for cid, la, lo in pts[:1]:  # un píxel de 9 km cubre todas las candidatas cercanas
                        d = (lat - la) ** 2 + (lon - lo) ** 2
                        d[(lat < -900) | (lon < -900)] = 1e9
                        i, j = np.unravel_index(np.argmin(d), d.shape)
                        v = float(sm[i, j])
                        if d[i, j] > 0.15 ** 2:  # el píxel más cercano está lejos: la órbita no cubrió el punto ese día
                            v = -1.0
                        filas.append([g["time_start"][:10], orb, round(float(lat[i, j]), 3), round(float(lon[i, j]), 3),
                                      "" if v < 0 else round(v, 3)])
        except Exception as e:
            print(f"  {g['title']}: {type(e).__name__}: {str(e)[:100]}")
    filas = [list(f) for f in dict.fromkeys(tuple(f) for f in filas)]  # granulos que se solapan
    escribir("smap_humedad_suelo.csv", filas, ["fecha", "pasada", "lat_pixel", "lon_pixel", "humedad_m3m3"])


def hls(a):
    pts = puntos()
    H = {"Authorization": f"Bearer {token()}"}
    gs = granulos("HLSS30", "2.0", a.dias, bbox_de(pts)) + granulos("HLSL30", "2.0", a.dias, bbox_de(pts))
    print(f"{len(gs)} escenas HLS en {a.dias} días")
    filas = []
    for g in sorted(gs, key=lambda x: x["time_start"]):
        l30 = g["title"].startswith("HLS.L30")
        bandas = {"verde": "B03.tif", "nir": "B05.tif" if l30 else "B8A.tif", "fmask": "Fmask.tif"}
        try:
            v = {k: muestrear_cog(enlace(g, s), H, pts) for k, s in bandas.items()}
        except Exception as e:
            print(f"  {g['title']}: {str(e)[:80]}")
            continue
        for k, (cid, la, lo) in enumerate(pts):
            if v["fmask"][k] is None:
                continue  # el punto no está en esta escena
            fm = int(v["fmask"][k])
            if fm & 0b1110:  # bits 1-3: nube, adyacente a nube, sombra
                continue
            gr, nr = v["verde"][k] / 1e4, v["nir"][k] / 1e4  # reflectancia (factor 0,0001)
            if gr <= 0 or gr + nr == 0 or gr > 1 or nr > 1:
                continue
            filas.append([g["time_start"][:10], g["title"][:7], cid, round((gr - nr) / (gr + nr), 3)])
    escribir("hls_ndwi.csv", filas, ["fecha", "sensor", "cocha", "ndwi"])


def ges(nombre, a):
    sys.exit(f"{nombre}: GES DISC pide aceptar el EULA. Abre https://urs.earthdata.nasa.gov/approve_app?client_id=e2WVk8Pw6weeLUKZYOxvTQ "
             "con tu sesión de Earthdata, pulsa 'Authorize' y repite el comando.")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("producto", choices=["ecostress", "smap", "hls", "gpm", "omiuv"])
    ap.add_argument("--dias", type=int, default=30)
    a = ap.parse_args()
    {"ecostress": ecostress, "smap": smap, "hls": hls,
     "gpm": lambda x: ges("gpm", x), "omiuv": lambda x: ges("omiuv", x)}[a.producto](a)
