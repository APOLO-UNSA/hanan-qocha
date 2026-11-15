"""Puente Qocha Ñawi -> gemelo digital.

Recibe lecturas del ESP32 y mantiene:
  data/live/sensor.json        última lectura de cada cocha (el gemelo la relee cada 10 s)
  data/live/historial.jsonl    todas las lecturas (para armar el lote)
  data/processed/sensor.json   lote validado para publicar (comando "lote")

Formato de salida = data/contracts/sensor.schema.json:
  cocha_id, timestamp (ISO -05:00), tds_ppm, temp_agua_c, [ph], [uv_index]

Orígenes de datos (solo biblioteca estándar; "serial" necesita pyserial):

  python device/bridge/puente.py serial --puerto COM5 --cocha SAB-01
      El ESP32 por USB. Cada línea puede ser JSON  {"tds_ppm":42,"temp_agua_c":9.5,"ph":7.1,"uv_index":11}
      o CSV  tds_ppm,temp_agua_c[,ph[,uv_index]]. Las demás líneas (logs) se ignoran.

  python device/bridge/puente.py http --puerto 8080 --cocha SAB-01
      El ESP32 por WiFi: POST http://<IP-PC>:8080/lectura con el mismo JSON.
      (Si el JSON trae "cocha_id" se respeta; si no, se usa --cocha.)

  python device/bridge/puente.py demo --cocha SAB-01 --cada 5
      Lecturas simuladas, para probar el gemelo sin hardware. NO son datos reales.

  python device/bridge/puente.py lote [--horas 48] [--cada 30] [--cocha SAB-01]
      Toma el historial, deja una lectura cada N minutos y escribe data/processed/sensor.json.

Valida igual que el CI: una lectura fuera de rango se descarta (con aviso) y nunca llega al gemelo.
Escribe a un archivo temporal y lo renombra, para que el gemelo nunca lea un JSON a medias.
"""
import argparse
import json
import math
import os
import random
import sys
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
LIVE = RAIZ / "data" / "live"
PROCESSED = RAIZ / "data" / "processed"
SENSOR_LIVE = LIVE / "sensor.json"
HISTORIAL = LIVE / "historial.jsonl"
TZ = timezone(timedelta(hours=-5))

# Rangos del contrato (data/contracts/sensor.schema.json).
CAMPOS = {
    "tds_ppm": (0, None, True),
    "temp_agua_c": (-5, 40, True),
    "ph": (0, 14, False),
    "uv_index": (0, None, False),
}
ORDEN = ["tds_ppm", "temp_agua_c", "ph", "uv_index"]

_lock = threading.Lock()
_ultimas = {}  # cocha_id -> lectura


def ahora():
    return datetime.now(TZ).replace(microsecond=0).isoformat()


def normalizar(crudo, cocha_default):
    """Convierte lo recibido en una lectura válida o lanza ValueError."""
    if not isinstance(crudo, dict):
        raise ValueError("no es un objeto")
    cocha = str(crudo.get("cocha_id") or cocha_default)
    lectura = {"cocha_id": cocha, "timestamp": ahora()}
    ts = crudo.get("timestamp")
    if isinstance(ts, str):
        try:
            datetime.fromisoformat(ts)
            lectura["timestamp"] = ts
        except ValueError:
            pass  # reloj del ESP32 sin hora: usamos la del PC
    for campo, (minimo, maximo, obligatorio) in CAMPOS.items():
        valor = crudo.get(campo)
        if isinstance(valor, bool) or valor is None:
            if obligatorio:
                raise ValueError(f"falta {campo}")
            continue
        if isinstance(valor, str):
            try:
                valor = float(valor.replace(",", "."))
            except ValueError:
                if obligatorio:
                    raise ValueError(f"{campo} no es número")
                continue
        if not isinstance(valor, (int, float)) or math.isnan(valor) or math.isinf(valor):
            if obligatorio:
                raise ValueError(f"{campo} no es número")
            continue
        if valor < minimo or (maximo is not None and valor > maximo):
            if obligatorio:
                raise ValueError(f"{campo}={valor} fuera de rango")
            continue  # opcional fuera de rango: se omite (sensor desconectado, etc.)
        lectura[campo] = round(float(valor), 2)
    return lectura


def parsear_linea(linea, cocha):
    """JSON o CSV -> lectura. Devuelve None si la línea no es una lectura (log)."""
    linea = linea.strip()
    if not linea:
        return None
    if linea.startswith("{"):
        return normalizar(json.loads(linea), cocha)
    partes = [p.strip() for p in linea.split(",")]
    if 2 <= len(partes) <= 4 and all(_es_numero(p) for p in partes):
        return normalizar(dict(zip(ORDEN, partes)), cocha)
    return None


def _es_numero(texto):
    try:
        float(texto.replace(",", "."))
        return True
    except ValueError:
        return False


def escribir_atomico(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=ruta.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)
        f.write("\n")
    for intento in range(10):  # Windows: el gemelo puede tener el archivo abierto un instante
        try:
            os.replace(tmp, ruta)
            return
        except PermissionError:
            time.sleep(0.05)
    os.replace(tmp, ruta)


def registrar(lectura):
    with _lock:
        _ultimas[lectura["cocha_id"]] = lectura
        escribir_atomico(SENSOR_LIVE, list(_ultimas.values()))
        HISTORIAL.parent.mkdir(parents=True, exist_ok=True)
        with open(HISTORIAL, "a", encoding="utf-8") as f:
            f.write(json.dumps(lectura, ensure_ascii=False) + "\n")
    resumen = "  ".join(f"{k}={lectura[k]}" for k in ORDEN if k in lectura)
    print(f"[{lectura['timestamp'][11:19]}] {lectura['cocha_id']}  {resumen}", flush=True)


def procesar(linea, cocha):
    try:
        lectura = parsear_linea(linea, cocha)
    except (ValueError, json.JSONDecodeError) as e:
        print(f"  descartada ({e}): {linea.strip()[:80]}", file=sys.stderr, flush=True)
        return
    if lectura:
        registrar(lectura)


def cargar_ultimas():
    """Al arrancar, retoma las últimas lecturas del historial para no vaciar el gemelo."""
    if not HISTORIAL.exists():
        return
    for linea in HISTORIAL.read_text(encoding="utf-8").splitlines():
        try:
            l = json.loads(linea)
            _ultimas[l["cocha_id"]] = l
        except (json.JSONDecodeError, KeyError):
            pass


# ---------------------------------------------------------------- orígenes

def modo_serial(a):
    try:
        import serial
    except ImportError:
        sys.exit("Falta pyserial:  pip install pyserial")
    print(f"Escuchando {a.puerto} a {a.baud} baudios -> {SENSOR_LIVE}  (Ctrl+C para salir)")
    while True:  # reconecta si se desenchufa el USB
        try:
            with serial.Serial(a.puerto, a.baud, timeout=2) as s:
                while True:
                    raw = s.readline()
                    if raw:
                        procesar(raw.decode("utf-8", errors="replace"), a.cocha)
        except serial.SerialException as e:
            print(f"  puerto no disponible ({e}); reintento en 3 s", file=sys.stderr, flush=True)
            time.sleep(3)


def modo_http(a):
    class H(BaseHTTPRequestHandler):
        def do_POST(self):
            n = int(self.headers.get("Content-Length") or 0)
            cuerpo = self.rfile.read(n).decode("utf-8", errors="replace")
            try:
                lectura = parsear_linea(cuerpo, a.cocha)
                if not lectura:
                    raise ValueError("cuerpo no reconocido")
                registrar(lectura)
                self.send_response(200)
            except (ValueError, json.JSONDecodeError) as e:
                print(f"  descartada ({e}): {cuerpo[:80]}", file=sys.stderr, flush=True)
                self.send_response(400)
            self.end_headers()

        def do_GET(self):  # prueba rápida desde el navegador del celular
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Puente Qocha Nawi activo. POST /lectura con JSON.\n")

        def log_message(self, *_):
            pass

    print(f"Servidor en http://0.0.0.0:{a.puerto}/lectura -> {SENSOR_LIVE}  (Ctrl+C para salir)")
    ThreadingHTTPServer(("0.0.0.0", a.puerto), H).serve_forever()


def modo_demo(a):
    print("MODO DEMO: lecturas SIMULADAS, no son datos reales.")
    t0 = time.time()
    while True:
        x = (time.time() - t0) / 60
        procesar(json.dumps({
            "tds_ppm": 45 + 6 * math.sin(x) + random.uniform(-2, 2),
            "temp_agua_c": 10 + 2.5 * math.sin(x / 3) + random.uniform(-0.2, 0.2),
            "ph": 7.1 + 0.15 * math.sin(x / 2),
            "uv_index": max(0, 10 + 2 * math.sin(x / 4)),
        }), a.cocha)
        time.sleep(a.cada)


def modo_lote(a):
    if not HISTORIAL.exists():
        sys.exit(f"No hay historial en {HISTORIAL}. Corre antes el puente (serial, http o demo).")
    desde = datetime.now(TZ) - timedelta(hours=a.horas)
    lecturas = []
    for linea in HISTORIAL.read_text(encoding="utf-8").splitlines():
        try:
            l = json.loads(linea)
            if a.cocha and l["cocha_id"] != a.cocha:
                continue
            if datetime.fromisoformat(l["timestamp"]) >= desde:
                lecturas.append(l)
        except (json.JSONDecodeError, KeyError, ValueError):
            pass
    lecturas.sort(key=lambda l: l["timestamp"])
    paso, ultimo, lote = timedelta(minutes=a.cada), {}, []
    for l in lecturas:  # una lectura por cocha cada N minutos
        t = datetime.fromisoformat(l["timestamp"])
        if l["cocha_id"] not in ultimo or t - ultimo[l["cocha_id"]] >= paso:
            lote.append(l)
            ultimo[l["cocha_id"]] = t
    if not lote:
        sys.exit("No hay lecturas en esa ventana de tiempo.")
    salida = Path(a.salida)
    escribir_atomico(salida, lote)
    cochas = sorted({l["cocha_id"] for l in lote})
    print(f"{len(lote)} lecturas de {', '.join(cochas)} -> {salida}")
    print("Ahora:  bash scripts/validate_data.sh  y abre el PR con data/processed/sensor.json")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="modo", required=True)
    for nombre in ("serial", "http", "demo"):
        s = sub.add_parser(nombre)
        s.add_argument("--cocha", default="SAB-01", help="cocha_id si la lectura no lo trae")
        if nombre == "serial":
            s.add_argument("--puerto", required=True, help="COM5, /dev/ttyUSB0...")
            s.add_argument("--baud", type=int, default=115200)
        if nombre == "http":
            s.add_argument("--puerto", type=int, default=8080)
        if nombre == "demo":
            s.add_argument("--cada", type=float, default=5, help="segundos entre lecturas")
    s = sub.add_parser("lote")
    s.add_argument("--horas", type=float, default=48)
    s.add_argument("--cada", type=float, default=30, help="minutos entre lecturas del lote")
    s.add_argument("--cocha", default=None)
    s.add_argument("--salida", default=str(PROCESSED / "sensor.json"))
    a = p.parse_args()
    if a.modo != "lote":
        cargar_ultimas()
    try:
        {"serial": modo_serial, "http": modo_http, "demo": modo_demo, "lote": modo_lote}[a.modo](a)
    except KeyboardInterrupt:
        print("\nPuente detenido.")


if __name__ == "__main__":
    main()
