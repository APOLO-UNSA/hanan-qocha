#!/usr/bin/env python3
"""
Hanan Qocha - Calibración y validación del módulo de visión.

Este archivo NO contiene datos ni coeficientes: solo las herramientas para
obtenerlos cuando existan mediciones reales. Mientras tanto:

  * `biomasa_kg` se publica como 0.0 (marcador provisional).
  * No se reporta precisión/recall/F1, porque no hay máscaras de referencia.

Herramientas
------------
1. Biomasa  -> `fit_biomass_calibration()` ajusta biomasa = a * cobertura + b
   con pares (cobertura_pct, biomasa_kg) MEDIDOS en campo sobre un mismo
   cuadrante. `estimate_biomass()` se niega a estimar sin calibración.
2. Validación -> `evaluate_mask()` compara una máscara del algoritmo con una
   máscara etiquetada a mano y entonces sí calcula precisión, recall, F1, IoU.
3. Color -> `sample_color_stats()` resume el color (CIELAB) de una región
   etiquetada, para reajustar la compuerta de color de segment.py.

Uso
---
    python vision/calibration.py evaluar --pred resultados/cushuro2/mascara.png \
        --ref etiquetas/cushuro2_ref.png
    python vision/calibration.py ajustar-biomasa --csv data/mediciones_biomasa.csv \
        --out data/calibracion_biomasa.json
    python vision/calibration.py estimar --cobertura 12.5 \
        --calibracion data/calibracion_biomasa.json
    python vision/calibration.py color --foto fotos/cushuro2.jpg \
        --mascara etiquetas/cushuro2_ref.png
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence

import cv2
import numpy as np

# Con menos pares que esto, una recta cobertura->biomasa no es defendible.
MIN_SAMPLES = 8


class CalibrationError(RuntimeError):
    """No hay calibración válida para lo que se pide."""


# --------------------------------------------------------------------------- #
# 1. Biomasa
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class BiomassCalibration:
    """Recta biomasa_kg = pendiente * cobertura_pct + intercepto.

    Válida solo para el protocolo con que se midió (mismo cuadrante, misma
    altura de cámara) y dentro del rango de cobertura observado.
    """

    pendiente_kg_por_pct: float
    intercepto_kg: float
    n_muestras: int
    r2: float
    cobertura_min: float
    cobertura_max: float
    creado: str
    protocolo: str = ""

    def predict(self, coverage_pct: float) -> float:
        """Biomasa estimada (kg) en el área fotografiada del protocolo."""
        if not 0.0 <= coverage_pct <= 100.0:
            raise ValueError("cobertura_pct debe estar entre 0 y 100.")
        if not self.cobertura_min <= coverage_pct <= self.cobertura_max:
            raise CalibrationError(
                f"Cobertura {coverage_pct:.2f} % fuera del rango calibrado "
                f"[{self.cobertura_min:.2f}, {self.cobertura_max:.2f}] %: "
                "no se extrapola."
            )
        return max(0.0, self.pendiente_kg_por_pct * coverage_pct + self.intercepto_kg)

    def save(self, path: str | Path) -> Path:
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8")
        return out

    @classmethod
    def load(cls, path: str | Path) -> "BiomassCalibration":
        p = Path(path)
        if not p.is_file():
            raise CalibrationError(f"No existe el archivo de calibración: {p}")
        try:
            return cls(**json.loads(p.read_text(encoding="utf-8")))
        except (TypeError, ValueError) as exc:
            raise CalibrationError(f"Archivo de calibración inválido: {p}") from exc


def fit_biomass_calibration(samples: Sequence[tuple[float, float]],
                            protocolo: str = "",
                            min_samples: int = MIN_SAMPLES) -> BiomassCalibration:
    """Ajusta la recta por mínimos cuadrados con pares MEDIDOS en campo.

    `samples`: (cobertura_pct del algoritmo, biomasa_kg pesada) del mismo
    cuadrante. Lanza CalibrationError si los datos no alcanzan.
    """
    if len(samples) < min_samples:
        raise CalibrationError(
            f"Se necesitan al menos {min_samples} pares cobertura/biomasa "
            f"medidos en campo; hay {len(samples)}."
        )
    x = np.array([s[0] for s in samples], np.float64)
    y = np.array([s[1] for s in samples], np.float64)
    if not (np.isfinite(x).all() and np.isfinite(y).all()):
        raise CalibrationError("Hay valores no numéricos en las muestras.")
    if (x < 0).any() or (x > 100).any() or (y < 0).any():
        raise CalibrationError("Cobertura fuera de 0-100 o biomasa negativa.")
    if np.ptp(x) < 1e-9:
        raise CalibrationError("Todas las muestras tienen la misma cobertura.")
    slope, intercept = np.polyfit(x, y, 1)
    pred = slope * x + intercept
    ss_res = float(((y - pred) ** 2).sum())
    ss_tot = float(((y - y.mean()) ** 2).sum())
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return BiomassCalibration(
        pendiente_kg_por_pct=float(slope), intercepto_kg=float(intercept),
        n_muestras=int(x.size), r2=float(r2),
        cobertura_min=float(x.min()), cobertura_max=float(x.max()),
        creado=datetime.now().astimezone().isoformat(timespec="seconds"),
        protocolo=protocolo,
    )


def load_samples_csv(path: str | Path) -> list[tuple[float, float]]:
    """Lee un CSV con columnas `cobertura_pct` y `biomasa_kg`."""
    p = Path(path)
    if not p.is_file():
        raise CalibrationError(f"No existe el CSV de mediciones: {p}")
    samples: list[tuple[float, float]] = []
    with p.open(newline="", encoding="utf-8-sig") as fh:
        reader = csv.DictReader(fh)
        needed = {"cobertura_pct", "biomasa_kg"}
        if not reader.fieldnames or not needed.issubset(reader.fieldnames):
            raise CalibrationError(f"El CSV debe tener las columnas {sorted(needed)}.")
        for row in reader:
            try:
                samples.append((float(row["cobertura_pct"]), float(row["biomasa_kg"])))
            except (TypeError, ValueError) as exc:
                raise CalibrationError(f"Fila inválida en {p}: {row}") from exc
    return samples


def estimate_biomass(coverage_pct: float,
                     calibration: BiomassCalibration | None) -> float:
    """Biomasa estimada. Sin calibración experimental NO se estima."""
    if calibration is None:
        raise CalibrationError(
            "No hay calibración experimental de biomasa. Use 0.0 como marcador "
            "provisional en vision.json; no derive la biomasa de la cobertura."
        )
    return calibration.predict(coverage_pct)


# --------------------------------------------------------------------------- #
# 2. Validación contra máscaras de referencia
# --------------------------------------------------------------------------- #
def evaluate_mask(pred: np.ndarray, ref: np.ndarray) -> dict[str, Any]:
    """Compara la máscara del algoritmo con una etiquetada A MANO.

    Ambas: 2D, mismo tamaño, cualquier valor > 0 cuenta como cushuro.
    """
    if pred.ndim != 2 or ref.ndim != 2:
        raise ValueError("Las máscaras deben ser imágenes de un canal.")
    if pred.shape != ref.shape:
        raise ValueError(f"Tamaños distintos: {pred.shape} vs {ref.shape}.")
    p, r = pred > 0, ref > 0
    tp = int((p & r).sum())
    fp = int((p & ~r).sum())
    fn = int((~p & r).sum())

    def ratio(num: int, den: int) -> float | None:
        return round(num / den, 4) if den else None

    precision = ratio(tp, tp + fp)
    recall = ratio(tp, tp + fn)
    f1 = ratio(2 * tp, 2 * tp + fp + fn)
    return {
        "tp_px": tp, "fp_px": fp, "fn_px": fn,
        "precision": precision, "recall": recall, "f1": f1,
        "iou": ratio(tp, tp + fp + fn),
        "cobertura_pred_pct": round(float(p.mean()) * 100.0, 2),
        "cobertura_ref_pct": round(float(r.mean()) * 100.0, 2),
    }


# --------------------------------------------------------------------------- #
# 3. Estadísticas de color para reajustar la compuerta de segment.py
# --------------------------------------------------------------------------- #
def sample_color_stats(image_bgr: np.ndarray, mask: np.ndarray) -> dict[str, Any]:
    """Percentiles de L, croma y tono (CIELAB) dentro de una región etiquetada.

    Los valores usan las mismas unidades que SegmentConfig (L en 0-255,
    croma en unidades a*b*, tono en grados).
    """
    if image_bgr.ndim != 3 or image_bgr.shape[:2] != mask.shape[:2]:
        raise ValueError("La imagen y la máscara deben tener el mismo tamaño.")
    sel = mask > 0
    if not sel.any():
        raise ValueError("La máscara no selecciona ningún píxel.")
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)[sel]
    L, a, b = lab[:, 0], lab[:, 1] - 128.0, lab[:, 2] - 128.0
    chroma = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a))
    q = [5, 25, 50, 75, 95]

    def pcts(v: np.ndarray) -> dict[str, float]:
        return {f"p{k}": round(float(x), 1) for k, x in zip(q, np.percentile(v, q))}

    return {"pixeles": int(sel.sum()), "L": pcts(L), "croma": pcts(chroma), "tono_grados": pcts(hue)}


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _read(path: str, flags: int) -> np.ndarray:
    data = np.fromfile(path, dtype=np.uint8) if Path(path).is_file() else np.empty(0, np.uint8)
    img = cv2.imdecode(data, flags) if data.size else None
    if img is None:
        raise CalibrationError(f"No se pudo leer la imagen: {path}")
    return img


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Calibración y validación del módulo de visión.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    ev = sub.add_parser("evaluar", help="Compara una máscara con su referencia manual")
    ev.add_argument("--pred", required=True)
    ev.add_argument("--ref", required=True)

    fit = sub.add_parser("ajustar-biomasa", help="Ajusta cobertura->biomasa con mediciones reales")
    fit.add_argument("--csv", required=True, help="CSV con cobertura_pct,biomasa_kg")
    fit.add_argument("--out", default="data/calibracion_biomasa.json")
    fit.add_argument("--protocolo", default="", help="Descripción del protocolo de muestreo")

    est = sub.add_parser("estimar", help="Estima biomasa con una calibración existente")
    est.add_argument("--cobertura", type=float, required=True)
    est.add_argument("--calibracion", required=True)

    col = sub.add_parser("color", help="Estadísticas de color dentro de una máscara")
    col.add_argument("--foto", required=True)
    col.add_argument("--mascara", required=True)

    args = parser.parse_args(argv)
    try:
        if args.cmd == "evaluar":
            out: Any = evaluate_mask(_read(args.pred, cv2.IMREAD_GRAYSCALE),
                                     _read(args.ref, cv2.IMREAD_GRAYSCALE))
        elif args.cmd == "ajustar-biomasa":
            cal = fit_biomass_calibration(load_samples_csv(args.csv), args.protocolo)
            cal.save(args.out)
            out = asdict(cal)
        elif args.cmd == "estimar":
            kg = estimate_biomass(args.cobertura, BiomassCalibration.load(args.calibracion))
            out = {"cobertura_pct": args.cobertura, "biomasa_kg": round(kg, 4)}
        else:
            out = sample_color_stats(_read(args.foto, cv2.IMREAD_COLOR),
                                     _read(args.mascara, cv2.IMREAD_GRAYSCALE))
    except (CalibrationError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
