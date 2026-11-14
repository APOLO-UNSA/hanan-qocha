"""Simulador de Qocha Ñawi: lecturas SIMULADAS de agua propicia, media y débil.

Escribe lecturas con el formato de data/contracts/sensor.schema.json
(cocha_id, timestamp, tds_ppm, temp_agua_c, ph, uv_index). No hay sensor real:
todo es simulado y así debe presentarse.

Usos (solo biblioteca estándar de Python):

  python device/simulacion/simulador.py generar
      Escribe en device/simulacion/salidas/ los JSON de cada caso, el conjunto
      completo y sites_simulados.json.

  python device/simulacion/simulador.py resumen
      Imprime aptitud, índice in situ e IAC estimado de cada caso.

  python device/simulacion/simulador.py emitir [--caso propicia|media|debil|todas]
                                               [--secuencia mejora] [--cada 5]
      Modo "en vivo": reescribe data/live/sensor.json (y data/live/sites.json)
      cada N segundos, con la hora actual. data/live/ está en .gitignore.
      Pax: VITE_DATA_SOURCE=live  (el gemelo refresca solo).
"""
import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDAS = Path(__file__).with_name("salidas")
LIVE = RAIZ / "data" / "live"
TZ = timezone(timedelta(hours=-5))

# Copia de los rangos de aptitud de twin/src/model.ts (SUPUESTOS DEL MODELO).
RANGES = {
    "temp_agua_c": (0, 8, 15, 25),
    "uv_index": (0, 6, 11, 16),
    "tds_ppm": (0, 0, 100, 300),
}

# Cada caso: parámetros del agua y de la cocha (sites). Valores diurnos típicos.
CASOS = {
    "propicia": dict(
        cocha_id="SIM-01", nombre="Cocha simulada 01 · agua propicia",
        lat=-15.781, lon=-71.334, altitud_m=4385, indice_satelital=0.85,
        tds=40, tds_ruido=0.06, t_media=10.0, t_amp=2.5,
        ph=7.1, ph_amp=0.15, uv_pico=10.0),
    "media": dict(
        cocha_id="SIM-02", nombre="Cocha simulada 02 · agua medianamente apta",
        lat=-15.921, lon=-71.215, altitud_m=4220, indice_satelital=0.60,
        tds=180, tds_ruido=0.05, t_media=19.0, t_amp=3.0,
        ph=7.8, ph_amp=0.2, uv_pico=13.0),
    "debil": dict(
        cocha_id="SIM-03", nombre="Cocha simulada 03 · agua débil",
        lat=-16.261, lon=-71.152, altitud_m=3980, indice_satelital=0.30,
        tds=260, tds_ruido=0.04, t_media=22.0, t_amp=3.0,
        ph=8.7, ph_amp=0.2, uv_pico=15.5),
}

# Secuencia "mejora" (escenarios G → F → B → A de device/DISENO_QOCHA_NAWI.md).
MEJORA = [
    ("Detenido", dict(temp_agua_c=23.0, uv_index=15.0, tds_ppm=280, ph=8.8)),
    ("Lento", dict(temp_agua_c=19.0, uv_index=14.0, tds_ppm=100, ph=8.0)),
    ("Activo", dict(temp_agua_c=16.0, uv_index=12.0, tds_ppm=120, ph=7.5)),
    ("Óptimo", dict(temp_agua_c=11.0, uv_index=9.0, tds_ppm=40, ph=7.0)),
]


def aptitud(x, rango):
    mn, lo, hi, mx = rango
    if x < mn or x > mx:
        return 0.0
    if x < lo:
        return 1.0 if lo == mn else (x - mn) / (lo - mn)
    if x > hi:
        return 1.0 if hi == mx else (mx - x) / (mx - hi)
    return 1.0


def lectura(caso, ts, rng):
    """Una lectura simulada: ciclo diario de temperatura y UV, ruido pequeño."""
    p = CASOS[caso]
    h = ts.hour + ts.minute / 60
    # Más fría a las 4 h, más cálida a las 16 h.
    temp = p["t_media"] + p["t_amp"] * math.sin(2 * math.pi * (h - 10) / 24)
    # UV: de día (6–18 h) con pico al mediodía; 0 de noche.
    uv = p["uv_pico"] * max(0.0, math.sin(math.pi * (h - 6) / 12))
    tds = p["tds"] * (1 + rng.uniform(-p["tds_ruido"], p["tds_ruido"]))
    ph = p["ph"] + p["ph_amp"] * math.sin(2 * math.pi * (h - 12) / 24) + rng.uniform(-0.03, 0.03)
    return {
        "cocha_id": p["cocha_id"],
        "timestamp": ts.isoformat(timespec="seconds"),
        "tds_ppm": round(tds),
        "temp_agua_c": round(temp + rng.uniform(-0.2, 0.2), 1),
        "ph": round(ph, 1),
        "uv_index": round(uv, 1),
    }


def serie(caso, fin, puntos=9, paso_h=6, semilla=1):
    rng = random.Random(f"{caso}-{semilla}")
    inicio = fin - timedelta(hours=paso_h * (puntos - 1))
    return [lectura(caso, inicio + timedelta(hours=paso_h * i), rng) for i in range(puntos)]


def sites():
    claves = ("cocha_id", "nombre", "lat", "lon", "altitud_m", "indice_satelital")
    return [{k: CASOS[c][k] for k in claves} for c in ("propicia", "media", "debil")]


def escribir(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tmp = ruta.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(ruta)  # escritura atómica: el gemelo nunca lee un archivo a medias


def generar():
    fin = datetime(2026, 11, 14, 10, 0, tzinfo=TZ)  # última lectura de día
    todas = []
    for caso in CASOS:
        s = serie(caso, fin)
        escribir(SALIDAS / f"sensor_{caso}.json", s)
        todas += s
    escribir(SALIDAS / "sensor_todas.json", todas)
    escribir(SALIDAS / "sites_simulados.json", sites())
    print(f"OK: {len(todas)} lecturas en {SALIDAS}")


def resumen():
    fin = datetime(2026, 11, 14, 10, 0, tzinfo=TZ)
    print(f"{'caso':10} {'T':>5} {'UV':>5} {'TDS':>5} {'f_total':>8} {'in situ':>8} {'IAC*':>6}  estado de crecimiento")
    for caso, p in CASOS.items():
        u = serie(caso, fin)[-1]
        f = {k: aptitud(u[k], RANGES[k]) for k in RANGES}
        f_total = f["temp_agua_c"] * f["uv_index"] * f["tds_ppm"]  # profundidad óptima asumida
        insitu = sum(f.values()) / 3
        iac = 0.5 * p["indice_satelital"] + 0.5 * insitu  # sin visión: el peso se reparte
        est = "Óptimo" if f_total >= .75 else "Activo" if f_total >= .4 else "Lento" if f_total >= .1 else "Detenido"
        print(f"{caso:10} {u['temp_agua_c']:5.1f} {u['uv_index']:5.1f} {u['tds_ppm']:5d} {f_total:8.2f} {insitu:8.2f} {iac:6.2f}  {est}")
    print("* IAC sin visión: 0,5·satélite + 0,5·in situ (el peso de la visión se reparte).")


def emitir(args):
    rng = random.Random(7)
    LIVE.mkdir(parents=True, exist_ok=True)
    escribir(LIVE / "sites.json", sites())
    casos = list(CASOS) if args.caso == "todas" else [args.caso]
    historial, paso = [], 0
    print(f"Emitiendo a {LIVE} cada {args.cada} s (Ctrl+C para detener).")
    try:
        while True:
            ahora = datetime.now(TZ)
            if args.secuencia == "mejora":
                nombre, v = MEJORA[min(paso, len(MEJORA) - 1)]
                nuevas = [{"cocha_id": "SIM-02", "timestamp": ahora.isoformat(timespec="seconds"), **v}]
                print(f"  fase: {nombre}")
                paso += 1
            else:
                # Hora simulada = hora real, pero de día para que el UV no sea 0 en la demo.
                diurna = ahora.replace(hour=10, minute=ahora.minute, second=ahora.second)
                nuevas = []
                for c in casos:
                    r = lectura(c, diurna, rng)
                    r["timestamp"] = ahora.isoformat(timespec="seconds")
                    nuevas.append(r)
            historial = (historial + nuevas)[-60:]
            escribir(LIVE / "sensor.json", historial)
            time.sleep(args.cada)
    except KeyboardInterrupt:
        print("\nDetenido. Para limpiar: borrar data/live/")


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # tildes correctas en la consola de Windows
    ap =argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("modo", choices=["generar", "resumen", "emitir"])
    ap.add_argument("--caso", choices=[*CASOS, "todas"], default="todas")
    ap.add_argument("--secuencia", choices=["mejora"])
    ap.add_argument("--cada", type=float, default=5, help="segundos entre lecturas (emitir)")
    a = ap.parse_args()
    {"generar": generar, "resumen": resumen}.get(a.modo, lambda: emitir(a))()
