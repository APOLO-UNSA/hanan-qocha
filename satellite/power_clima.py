"""Descarga clima REAL de NASA POWER (https://power.larc.nasa.gov) para las cochas candidatas.

Sin clave ni cuenta. Solo biblioteca estándar. Guarda CSV en satellite/datos/ y resume.

  python satellite/power_clima.py                       # 3 sitios por defecto, últimos 14 días horario + 2025-2026 diario
  python satellite/power_clima.py --sitio SAB-01,-15.781,-71.334 --dias 30

Variables (POWER, comunidad AG):
  horario: T2M (aire 2 m, °C), TS (temperatura de superficie, °C), RH2M (%), PRECTOTCORR (mm/h)
  diario : T2M, T2M_MAX, T2M_MIN, TS, PRECTOTCORR (mm/día), ALLSKY/CLRSKY_SFC_SW_DWN (MJ/m²/día),
           ALLSKY_SFC_UV_INDEX (promedio DIARIO, no el pico de mediodía), RH2M, GWETTOP (humedad del suelo, 0–1)

LÍMITES (importantes para el pitch):
  * POWER es reanálisis/satélite en malla de ~0,5° (≈ 50 km): es clima REGIONAL, no la medición de una cocha.
  * -999 = sin dato. El UV y la radiación llevan semanas de retraso (aquí: UV válido solo hasta fines de agosto).
  * TS es temperatura de la superficie del suelo, no del agua: el agua de una cocha somera queda entre T2M y TS.
"""
import argparse
import csv
import json
import sys
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SALIDA = Path(__file__).with_name("datos")
BASE = "https://power.larc.nasa.gov/api/temporal"
SITIOS = [("SAB-01", -15.781, -71.334), ("SAB-02", -15.921, -71.215), ("SAB-03", -16.261, -71.152)]
HORARIO = ["T2M", "TS", "RH2M", "PRECTOTCORR"]
DIARIO = ["T2M", "T2M_MAX", "T2M_MIN", "TS", "PRECTOTCORR", "ALLSKY_SFC_SW_DWN",
          "CLRSKY_SFC_SW_DWN", "ALLSKY_SFC_UV_INDEX", "RH2M", "GWETTOP"]


def pedir(modo, params, lat, lon, ini, fin):
    q = urllib.parse.urlencode(dict(parameters=",".join(params), community="AG", longitude=lon,
                                    latitude=lat, start=ini.strftime("%Y%m%d"), end=fin.strftime("%Y%m%d"),
                                    format="JSON"))
    with urllib.request.urlopen(f"{BASE}/{modo}/point?{q}", timeout=90) as r:
        d = json.load(r)
    return d["properties"]["parameter"]


def a_csv(ruta, param, nombres, hora):
    claves = sorted(next(iter(param.values())))
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["timestamp" if hora else "fecha", *nombres])
        for k in claves:
            t = f"{k[:4]}-{k[4:6]}-{k[6:8]}T{k[8:10]}:00:00-05:00" if hora else f"{k[:4]}-{k[4:6]}-{k[6:8]}"
            w.writerow([t, *("" if param[n][k] == -999 else param[n][k] for n in nombres)])
    return len(claves)


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sitio", action="append", help="ID,lat,lon (repetible)")
    ap.add_argument("--dias", type=int, default=14, help="días de serie horaria")
    ap.add_argument("--desde", default="2025-01-01", help="inicio de la serie diaria")
    a = ap.parse_args()
    sitios = [(s.split(",")[0], float(s.split(",")[1]), float(s.split(",")[2])) for s in a.sitio] if a.sitio else SITIOS
    fin = date.today() - timedelta(days=2)  # POWER publica con ~2 días de retraso
    for cid, lat, lon in sitios:
        try:
            h = pedir("hourly", HORARIO, lat, lon, fin - timedelta(days=a.dias), fin)
            d = pedir("daily", DIARIO, lat, lon, date.fromisoformat(a.desde), fin)
        except Exception as e:  # red caída, API en mantenimiento...
            sys.exit(f"{cid}: no se pudo consultar POWER ({e})")
        nh = a_csv(SALIDA / f"{cid}_horario.csv", h, HORARIO, True)
        nd = a_csv(SALIDA / f"{cid}_diario.csv", d, DIARIO, False)
        t2m = [v for v in h["T2M"].values() if v != -999]
        print(f"{cid} ({lat}, {lon}): {nh} filas horarias, {nd} diarias · T2M horaria {min(t2m):.1f} a {max(t2m):.1f} °C")
    print(f"CSV en {SALIDA}. Fuente: NASA POWER (reanálisis ~0,5°): clima regional, no medición de la cocha.")


if __name__ == "__main__":
    main()
