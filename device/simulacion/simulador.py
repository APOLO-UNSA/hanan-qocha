"""Simulador físico de Qocha Ñawi: lecturas SIMULADAS de agua propicia, media y débil.

NO hay sensor real: todo lo que sale de aquí es simulado y así debe presentarse.
Genera lecturas con el formato de data/contracts/sensor.schema.json
(cocha_id, timestamp, tds_ppm, temp_agua_c, ph, uv_index).

MODELO (cada variable sigue una ecuación, no un número al azar)
  UV        UVI = 12,5 · cos(z)^2,42 · (O3/300)^-1,23 · (1 + k_alt·altitud) · CMF
            cos(z) por geometría solar (declinación, ecuación del tiempo, longitud de la cocha);
            CMF = 1 − 0,75·nubes^3,4 (atenuación por nubosidad). Nubes = proceso AR(1) por hora.
  Temp.     Balance térmico de primer orden:  dTw/dt = (T_eq(t) − Tw)/τ
            T_eq = T_m + A_aire·sin(2π(h−9)/24) + B·G(t)   (G = radiación global normalizada, con nubes)
            Con τ ≈ 5 h el agua atenúa y retrasa el ciclo del aire, como un estanque somero.
            Variación de clima de varios días: proceso Ornstein-Uhlenbeck.
  TDS       C = C0 · (1 + 0,015·sin ciclo de evaporación) · exp(OU lento); error del sensor 4 % (SEN0244 ±10 % máx.).
  pH        pH = pH0 + A·sin(2π(h−9)/24) (fotosíntesis: máximo ~15 h, mínimo ~3 h) + OU; error de sonda 0,03.
  Sensores  Ruido gaussiano, cuantización (DS18B20 1/16 °C) y redondeo, como en el hardware real.

SUPUESTOS a verificar con literatura/datos de campo: O3 = 260 DU, k_alt = 6 %/km, τ, amplitudes y errores de sensor.

VERIFICACIÓN (python simulador.py verificar)
  1. Todas las lecturas cumplen los rangos del contrato.
  2. Media simulada vs. esperada analíticamente (la dinámica lineal conserva la media).
  3. Monte Carlo con N semillas: probabilidad de que cada caso caiga en la categoría pedida
     (alto = Óptimo, intermedio = Activo/Lento, bajo = Detenido) según las curvas del gemelo.

Usos (solo biblioteca estándar):
  generar                     JSON de cada caso en device/simulacion/salidas/ (+ sites_simulados.json)
  resumen                     aptitud, índice in situ e IAC estimado de cada caso
  verificar [--n 300]         pruebas anteriores, con tabla de resultados
  lote [--ids SAB-01,SAB-02,SAB-03] [--horas 48] [--cada 30] [--fin 2026-11-14T11:00]
                              escribe data/processed/sensor.json (lectura cada N min) y verifica
  emitir [--caso ...] [--secuencia mejora] [--cada 5]
                              reescribe data/live/sensor.json cada N segundos (Pax: VITE_DATA_SOURCE=live)
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
PROCESSED = RAIZ / "data" / "processed"
TZ = timezone(timedelta(hours=-5))
DT_MIN = 5  # paso de integración (min)

# Copia de los rangos de aptitud de twin/src/model.ts (SUPUESTOS DEL MODELO).
RANGES = {
    "temp_agua_c": (0, 8, 15, 25),
    "uv_index": (0, 6, 11, 16),
    "tds_ppm": (0, 0, 100, 300),
}
# Categorías del gemelo según f_total = f_T · f_UV · f_TDS (profundidad óptima asumida).
UMBRALES = [(0.75, "Óptimo"), (0.4, "Activo"), (0.1, "Lento"), (0.0, "Detenido")]

# Parámetros físicos comunes (SUPUESTOS).
O3_DU, K_ALT, TAU_H = 260.0, 0.06, 5.0
SENSOR = dict(temp_sigma=0.15, temp_q=1 / 16, tds_rel=0.04, ph_sigma=0.03, uv_rel=0.04)

# Cada caso = escenario físico distinto. "objetivo" = categorías aceptables del gemelo.
CASOS = {
    "propicia": dict(
        etiqueta="alto", objetivo={"Óptimo"},
        cocha_id="SIM-01", nombre="Cocha simulada 01 · agua propicia",
        lat=-15.781, lon=-71.334, altitud_m=4385, indice_satelital=0.85,
        nubes=0.90, nubes_sd=0.06,                 # estación lluviosa: cielo muy cubierto
        t_m=8.0, a_aire=2.5, b_rad=3.0, t_ou=0.5,  # agua fría
        tds=40, tds_ou=0.05, ph=7.1, ph_amp=0.15),
    "media": dict(
        etiqueta="intermedio", objetivo={"Activo", "Lento"},
        cocha_id="SIM-02", nombre="Cocha simulada 02 · agua medianamente apta",
        lat=-15.921, lon=-71.215, altitud_m=4220, indice_satelital=0.60,
        nubes=0.74, nubes_sd=0.04,
        t_m=14.5, a_aire=3.0, b_rad=4.0, t_ou=0.6,
        tds=170, tds_ou=0.03, ph=7.8, ph_amp=0.20),
    "debil": dict(
        etiqueta="bajo", objetivo={"Detenido"},
        cocha_id="SIM-03", nombre="Cocha simulada 03 · agua débil",
        lat=-16.261, lon=-71.152, altitud_m=3980, indice_satelital=0.30,
        nubes=0.25, nubes_sd=0.10,                 # cielo despejado: UV extremo
        t_m=18.0, a_aire=3.0, b_rad=5.0, t_ou=0.6,
        tds=265, tds_ou=0.04, ph=8.7, ph_amp=0.25),
}

# Secuencia "mejora" (escenarios G → F → B → A de device/DISENO_QOCHA_NAWI.md).
MEJORA = [
    ("Detenido", dict(temp_agua_c=23.0, uv_index=15.0, tds_ppm=280, ph=8.8)),
    ("Lento", dict(temp_agua_c=19.0, uv_index=14.0, tds_ppm=100, ph=8.0)),
    ("Activo", dict(temp_agua_c=16.0, uv_index=12.0, tds_ppm=120, ph=7.5)),
    ("Óptimo", dict(temp_agua_c=11.0, uv_index=9.0, tds_ppm=40, ph=7.0)),
]


# ------------------------------------------------------------------ física

def aptitud(x, rango):
    mn, lo, hi, mx = rango
    if x < mn or x > mx:
        return 0.0
    if x < lo:
        return 1.0 if lo == mn else (x - mn) / (lo - mn)
    if x > hi:
        return 1.0 if hi == mx else (mx - x) / (mx - hi)
    return 1.0


def f_total(temp, uv, tds):
    return aptitud(temp, RANGES["temp_agua_c"]) * aptitud(uv, RANGES["uv_index"]) * aptitud(tds, RANGES["tds_ppm"])


def categoria(f):
    return next(n for u, n in UMBRALES if f >= u)


def cos_cenit(ts, lat, lon):
    """Coseno del ángulo cenital solar (declinación, ecuación del tiempo y longitud)."""
    n = ts.timetuple().tm_yday
    dec = math.radians(23.44) * math.sin(2 * math.pi * (284 + n) / 365)
    b = 2 * math.pi * (n - 81) / 364
    eot_min = 9.87 * math.sin(2 * b) - 7.53 * math.cos(b) - 1.5 * math.sin(b)
    reloj = ts.hour + ts.minute / 60 + ts.second / 3600
    solar = reloj + (lon + 75) / 15 + eot_min / 60  # huso -05:00 = meridiano -75°
    h = math.radians(15 * (solar - 12))
    p = math.radians(lat)
    return max(0.0, math.sin(p) * math.sin(dec) + math.cos(p) * math.cos(dec) * math.cos(h))


def uvi_claro(cz, alt_m):
    return 12.5 * cz ** 2.42 * (O3_DU / 300) ** -1.23 * (1 + K_ALT * alt_m / 1000)


def cmf(nubes):
    return 1 - 0.75 * nubes ** 3.4


def _ou(x, theta_h, sigma, rng):
    a = math.exp(-DT_MIN / 60 / theta_h)
    return x * a + sigma * math.sqrt(1 - a * a) * rng.gauss(0, 1)


def trayectoria(caso, semilla, inicio, pasos):
    """Estado físico verdadero (sin error de sensor) cada DT_MIN minutos desde `inicio`."""
    p = CASOS[caso]
    rng = random.Random(f"{caso}-{semilla}")
    nubes, ou_t, ou_c, ou_p = p["nubes"], 0.0, 0.0, 0.0
    tw = p["t_m"]  # arranca en equilibrio; el calentamiento previo (spin-up) lo asienta
    out = []
    for i in range(pasos):
        ts = inicio + timedelta(minutes=DT_MIN * i)
        h = ts.hour + ts.minute / 60
        nubes = min(1.0, max(0.0, p["nubes"] + _ou(nubes - p["nubes"], 3.0, p["nubes_sd"], rng)))
        ou_t = _ou(ou_t, 36.0, p["t_ou"], rng)
        ou_c = _ou(ou_c, 72.0, p["tds_ou"], rng)
        ou_p = _ou(ou_p, 48.0, 0.05, rng)
        cz = cos_cenit(ts, p["lat"], p["lon"])
        g = cz * (1 - 0.6 * nubes)  # radiación global normalizada
        t_eq = p["t_m"] + p["a_aire"] * math.sin(2 * math.pi * (h - 9) / 24) + p["b_rad"] * g + ou_t
        tw += (t_eq - tw) * (DT_MIN / 60) / TAU_H
        out.append(dict(
            ts=ts, temp=tw, g=g,
            uv=uvi_claro(cz, p["altitud_m"]) * cmf(nubes),
            tds=p["tds"] * (1 + 0.015 * math.sin(2 * math.pi * (h - 17) / 24)) * math.exp(ou_c),
            ph=p["ph"] + p["ph_amp"] * math.sin(2 * math.pi * (h - 9) / 24) + ou_p,
        ))
    return out


def medir(estado, rng, ids):
    """Aplica el error del sensor real a un estado verdadero y arma la lectura del contrato."""
    s = SENSOR
    temp = estado["temp"] + rng.gauss(0, s["temp_sigma"])
    temp = round(temp / s["temp_q"]) * s["temp_q"]
    return {
        "cocha_id": ids,
        "timestamp": estado["ts"].isoformat(timespec="seconds"),
        "tds_ppm": max(0, round(estado["tds"] * (1 + rng.gauss(0, s["tds_rel"])))),
        "temp_agua_c": round(min(40, max(-5, temp)), 2),
        "ph": round(min(14, max(0, estado["ph"] + rng.gauss(0, s["ph_sigma"]))), 2),
        "uv_index": round(max(0.0, estado["uv"] * (1 + rng.gauss(0, s["uv_rel"]))), 1),
    }


SPINUP_H = 96  # horas de calentamiento previo: borra la condición inicial


def serie(caso, fin, horas=48, cada_min=30, semilla=1, cocha_id=None):
    """Lecturas simuladas cada `cada_min` minutos en las `horas` previas a `fin`."""
    inicio = fin - timedelta(hours=horas + SPINUP_H)
    tray = trayectoria(caso, semilla, inicio, int((horas + SPINUP_H) * 60 / DT_MIN) + 1)
    rng = random.Random(f"sensor-{caso}-{semilla}")
    paso = max(1, cada_min // DT_MIN)
    desde = int(SPINUP_H * 60 / DT_MIN)
    cid = cocha_id or CASOS[caso]["cocha_id"]
    return [medir(e, rng, cid) for e in tray[desde::paso]], tray[desde:]


def ultimo_11h(ahora=None):
    """Último instante 11:00 (hora local) ya pasado: la lectura final cae cerca del pico solar."""
    ahora = ahora or datetime.now(TZ)
    fin = ahora.replace(hour=11, minute=0, second=0, microsecond=0)
    return fin if fin <= ahora else fin - timedelta(days=1)


# ------------------------------------------------------------------ salidas

def sites():
    claves = ("cocha_id", "nombre", "lat", "lon", "altitud_m", "indice_satelital")
    return [{k: CASOS[c][k] for k in claves} for c in ("propicia", "media", "debil")]


def escribir(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    tmp = ruta.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    tmp.replace(ruta)  # escritura atómica: el gemelo nunca lee un archivo a medias


def generar(args=None):
    fin = datetime(2026, 11, 14, 11, 0, tzinfo=TZ)
    todas = []
    for caso in CASOS:
        s, _ = serie(caso, fin)
        escribir(SALIDAS / f"sensor_{caso}.json", s)
        todas += s
    escribir(SALIDAS / "sensor_todas.json", todas)
    escribir(SALIDAS / "sites_simulados.json", sites())
    print(f"OK: {len(todas)} lecturas en {SALIDAS}")


def resumen(args=None):
    fin = datetime(2026, 11, 14, 11, 0, tzinfo=TZ)
    print(f"{'caso':10} {'T':>5} {'UV':>5} {'TDS':>5} {'f_total':>8} {'in situ':>8} {'IAC*':>6}  estado de crecimiento")
    for caso, p in CASOS.items():
        u = serie(caso, fin)[0][-1]
        f = {k: aptitud(u[k], RANGES[k]) for k in RANGES}
        ft = f["temp_agua_c"] * f["uv_index"] * f["tds_ppm"]
        insitu = sum(f.values()) / 3
        iac = 0.5 * p["indice_satelital"] + 0.5 * insitu
        print(f"{caso:10} {u['temp_agua_c']:5.1f} {u['uv_index']:5.1f} {u['tds_ppm']:5d} {ft:8.2f} {insitu:8.2f} {iac:6.2f}  {categoria(ft)}")
    print("* IAC sin visión: 0,5·satélite + 0,5·in situ (el peso de la visión se reparte).")


def cumple_contrato(l):
    return (l["tds_ppm"] >= 0 and -5 <= l["temp_agua_c"] <= 40 and 0 <= l["ph"] <= 14
            and l["uv_index"] >= 0 and set(l) == {"cocha_id", "timestamp", "tds_ppm", "temp_agua_c", "ph", "uv_index"})


def verificar(args):
    fin = datetime(2026, 11, 14, 11, 0, tzinfo=TZ)
    ok_global = True
    print(f"Verificación con {args.n} semillas (Monte Carlo). Lectura final = 11:00 hora local.\n")
    print(f"{'caso':10} {'objetivo':14} {'P(categoría)':>13} {'Tmed sim/esp':>14} {'TDSmed sim/esp':>16} {'pHmed sim/esp':>15}  contrato")
    for caso, p in CASOS.items():
        aciertos, dif_t, dif_c, dif_p, bien = 0, [], [], [], True
        sim_t = esp_t = sim_c = esp_c = sim_p = esp_p = 0.0
        for sem in range(args.n):
            lect, tray = serie(caso, fin, semilla=sem)
            u = lect[-1]
            aciertos += categoria(f_total(u["temp_agua_c"], u["uv_index"], u["tds_ppm"])) in p["objetivo"]
            bien &= all(cumple_contrato(l) for l in lect)
            if sem < 50:  # medias sobre 48 h: simulada (con error de sensor) vs. verdadera del modelo
                sim_t += sum(l["temp_agua_c"] for l in lect) / len(lect)
                esp_t += sum(e["temp"] for e in tray) / len(tray)
                sim_c += sum(l["tds_ppm"] for l in lect) / len(lect)
                esp_c += sum(e["tds"] for e in tray) / len(tray)
                sim_p += sum(l["ph"] for l in lect) / len(lect)
                esp_p += sum(e["ph"] for e in tray) / len(tray)
        m = min(args.n, 50)
        prob = aciertos / args.n
        ok = prob >= 0.90 and bien and abs(sim_t - esp_t) / m < 0.2 and abs(sim_c - esp_c) / m < 0.05 * p["tds"] and abs(sim_p - esp_p) / m < 0.05
        ok_global &= ok
        print(f"{p['etiqueta']:10} {'/'.join(sorted(p['objetivo'])):14} {prob:12.0%} {sim_t/m:6.1f}/{esp_t/m:<6.1f}  {sim_c/m:7.0f}/{esp_c/m:<7.0f}  {sim_p/m:6.2f}/{esp_p/m:<6.2f}   {'OK' if bien else 'FALLA'}  {'✔' if ok else '✘'}")
    print("\nCriterio: P(categoría) ≥ 90 %, lecturas dentro del contrato y media simulada = esperada.")
    print("RESULTADO:", "TODO CONSISTENTE" if ok_global else "HAY CASOS QUE AJUSTAR")
    return 0 if ok_global else 1


def lote(args):
    ids = [i.strip() for i in args.ids.split(",")]
    if len(ids) != len(CASOS):
        sys.exit(f"--ids necesita {len(CASOS)} códigos (alto, intermedio, bajo), recibí {len(ids)}")
    fin = datetime.fromisoformat(args.fin).replace(tzinfo=TZ) if args.fin else ultimo_11h()
    todas = []
    for (caso, p), cid in zip(CASOS.items(), ids):
        s, _ = serie(caso, fin, horas=args.horas, cada_min=args.cada, semilla=args.semilla, cocha_id=cid)
        u = s[-1]
        ft = f_total(u["temp_agua_c"], u["uv_index"], u["tds_ppm"])
        print(f"{cid}  {p['etiqueta']:10} última lectura {u['timestamp'][:16]}  T={u['temp_agua_c']:.1f} UV={u['uv_index']:.1f} "
              f"TDS={u['tds_ppm']} pH={u['ph']:.2f}  f={ft:.2f} -> {categoria(ft)}")
        todas += s
    salida = Path(args.salida)
    escribir(salida, todas)
    print(f"\n{len(todas)} lecturas SIMULADAS -> {salida}")
    print("Antes de publicar: python device/simulacion/simulador.py verificar  y  bash scripts/validate_data.sh")


def emitir(args):
    LIVE.mkdir(parents=True, exist_ok=True)
    escribir(LIVE / "sites.json", sites())
    casos = list(CASOS) if args.caso == "todas" else [args.caso]
    epoca = datetime(2026, 11, 1, tzinfo=TZ)
    dias = 56
    trayec = {c: trayectoria(c, 7, epoca, dias * 24 * 60 // DT_MIN) for c in casos}
    rng, historial, paso = random.Random(7), [], 0
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
                # Se lee la trayectoria física a la hora 10–11 de un día equivalente (UV distinto de 0 en la demo).
                dia = (ahora.date() - epoca.date()).days % dias
                idx = (dia * 24 * 60 + 10 * 60 + ahora.minute) // DT_MIN
                nuevas = []
                for c in casos:
                    r = medir(trayec[c][idx], rng, CASOS[c]["cocha_id"])
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
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("modo", choices=["generar", "resumen", "verificar", "lote", "emitir"])
    ap.add_argument("--caso", choices=[*CASOS, "todas"], default="todas")
    ap.add_argument("--secuencia", choices=["mejora"])
    ap.add_argument("--cada", type=float, default=None, help="emitir: segundos; lote: minutos entre lecturas")
    ap.add_argument("--n", type=int, default=300, help="verificar: nº de semillas")
    ap.add_argument("--ids", default="SAB-01,SAB-02,SAB-03", help="lote: cocha_id de alto, intermedio y bajo")
    ap.add_argument("--horas", type=float, default=48)
    ap.add_argument("--fin", default=None, help="lote: ISO sin zona, p. ej. 2026-11-14T11:00 (por defecto, el último 11:00)")
    ap.add_argument("--semilla", type=int, default=1)
    ap.add_argument("--salida", default=str(PROCESSED / "sensor.json"))
    a = ap.parse_args()
    if a.modo == "lote":
        a.cada = int(a.cada or 30)
    elif a.modo == "emitir":
        a.cada = a.cada or 5
    sys.exit({"generar": generar, "resumen": resumen, "verificar": verificar, "lote": lote, "emitir": emitir}[a.modo](a))
