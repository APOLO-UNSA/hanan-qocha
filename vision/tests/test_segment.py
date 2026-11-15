"""
Pruebas del módulo de visión de Hanan Qocha.

    python -m pytest vision -v

Notas
-----
* Las pruebas "de campo" usan las fotografías reales `cushuro2.jpg` y
  `cushuro3.jpg`. Los originales no están en el repositorio (solo sus imágenes
  de resultado, en `vision/resultados/`): se buscan en `fotos/` o en la carpeta
  que indique la variable de entorno `HANAN_QOCHA_FOTOS`. Si no están, esas
  pruebas se omiten (skip), no fallan.
* Algunas pruebas usan arreglos sintéticos (una imagen lisa, discos dibujados,
  pares numéricos inventados). Sirven únicamente para comprobar la mecánica
  del código; no son fotografías reales ni mediciones de campo y no validan
  la detección de cushuro.
* No se comprueba precisión/recall: no existen máscaras de referencia.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import pytest

VISION_DIR = Path(__file__).resolve().parents[1]
ROOT = VISION_DIR.parent
sys.path.insert(0, str(VISION_DIR))

import calibration as cal  # noqa: E402
import segment as seg  # noqa: E402

FOTOS_DIR = Path(os.environ.get("HANAN_QOCHA_FOTOS") or ROOT / "fotos")
PHOTOS = {
    "cushuro2": FOTOS_DIR / "cushuro2.jpg",
    "cushuro3": FOTOS_DIR / "cushuro3.jpg",
}


def _require(name: str) -> Path:
    path = PHOTOS[name]
    if not path.is_file():
        pytest.skip(f"No está la fotografía de referencia: {path}")
    return path


@pytest.fixture(scope="session")
def results() -> dict:
    """Segmenta cada fotografía real una sola vez para toda la sesión."""
    cache: dict = {}

    def get(name: str):
        if name not in cache:
            image = seg.load_image(_require(name))
            cache[name] = (image, seg.segment_cushuro(image))
        return cache[name]

    return {"get": get}


# --------------------------------------------------------------------------- #
# Carga de imágenes
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("name", list(PHOTOS))
def test_carga_correcta_de_fotografias(name):
    image = seg.load_image(_require(name))
    assert image.ndim == 3 and image.shape[2] == 3
    assert image.dtype == np.uint8
    assert min(image.shape[:2]) > 100


def test_carga_archivo_inexistente(tmp_path):
    with pytest.raises(FileNotFoundError):
        seg.load_image(tmp_path / "no_existe.jpg")


def test_carga_archivo_que_no_es_imagen(tmp_path):
    fake = tmp_path / "texto.jpg"
    fake.write_text("esto no es una imagen", encoding="utf-8")
    with pytest.raises(ValueError):
        seg.load_image(fake)


def test_carga_archivo_vacio(tmp_path):
    empty = tmp_path / "vacio.jpg"
    empty.write_bytes(b"")
    with pytest.raises(ValueError):
        seg.load_image(empty)


@pytest.mark.parametrize(
    "bad",
    [
        None,
        np.zeros((0, 0, 3), np.uint8),            # vacía
        np.zeros((200, 200), np.uint8),           # escala de grises
        np.zeros((200, 200, 4), np.uint8),        # 4 canales
        np.zeros((200, 200, 3), np.float32),      # no es de 8 bits
        np.zeros((8, 8, 3), np.uint8),            # demasiado pequeña
    ],
)
def test_segmentacion_rechaza_imagenes_invalidas(bad):
    with pytest.raises(ValueError):
        seg.segment_cushuro(bad)


# --------------------------------------------------------------------------- #
# Máscaras y cobertura
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("name", list(PHOTOS))
def test_mascara_binaria_del_tamano_de_la_foto(results, name):
    image, res = results["get"](name)
    assert res.mask.shape == image.shape[:2]
    assert res.mask.dtype == np.uint8
    assert set(np.unique(res.mask)).issubset({0, 255})
    # La máscara total es la unión de forma verificada + aceptadas por color.
    union = cv2.bitwise_or(res.mask_shape, res.mask_color)
    assert np.array_equal(res.mask, union)
    assert not np.any((res.mask_shape > 0) & (res.mask_color > 0))


@pytest.mark.parametrize("name", list(PHOTOS))
def test_cobertura_entre_0_y_100_y_segun_formula(results, name):
    _, res = results["get"](name)
    assert 0.0 <= res.coverage_pct <= 100.0
    expected = np.count_nonzero(res.mask) / res.mask.size * 100.0
    assert res.coverage_pct == pytest.approx(expected)
    m = res.metrics
    assert m["pixeles_totales"] == res.mask.size
    assert m["pixeles_candidatos"] == np.count_nonzero(res.mask)
    assert m["cobertura_pct"] == pytest.approx(expected, abs=0.01)


@pytest.mark.parametrize("name", list(PHOTOS))
def test_no_marca_la_escena_completa(results, name):
    """Regresión frente al umbral HSV puro, que marcaba >60 % de la foto.

    No mide exactitud: solo que el algoritmo selecciona colonias y no el fondo
    entero, y que encuentra alguna colonia en fotos que sí contienen cushuro.
    """
    _, res = results["get"](name)
    assert 0.0 < res.coverage_pct < 40.0
    assert len(res.colonies) >= 5
    assert res.metrics["colonias_verificadas_por_forma"] >= 1


@pytest.mark.parametrize("name", list(PHOTOS))
def test_resultado_declarado_como_no_validado(results, name):
    _, res = results["get"](name)
    assert res.metrics["estado"] == "candidato_no_validado"
    assert any("no validado" in w.lower() for w in res.warnings)
    assert "biomasa" in res.metrics["nota_biomasa"].lower()


def test_imagen_lisa_no_produce_candidatos():
    """Arreglo sintético (mecánica): sin bordes ni forma no hay detección."""
    flat = np.full((240, 320, 3), 120, np.uint8)
    res = seg.segment_cushuro(flat)
    assert res.coverage_pct == 0.0
    assert res.colonies == []
    assert not res.mask.any()
    assert any("ninguna colonia" in w for w in res.warnings)


def test_detector_encuentra_discos_sinteticos():
    """Imagen SINTÉTICA (mecánica; no es una foto ni valida la detección real).

    Cuatro discos lisos de color oliva sobre un fondo rugoso. Comprueba que el
    detector de forma funciona en cualquier entorno (p. ej. el CI, donde no
    hay fotografías): encuentra los discos y no marca el fondo.
    """
    rng = np.random.default_rng(7)
    h, w = 400, 520
    noise = rng.integers(-45, 46, size=(h, w, 1)).astype(np.int16)
    image = np.clip(np.array([70, 150, 190], np.int16) + noise, 0, 255).astype(np.uint8)
    centers = [(110, 110), (300, 120), (190, 280), (410, 290)]
    discs = np.zeros((h, w), np.uint8)
    for cx, cy in centers:
        cv2.circle(image, (cx, cy), 17, (60, 130, 120), -1, cv2.LINE_AA)
        cv2.circle(discs, (cx, cy), 21, 255, -1)

    res = seg.segment_cushuro(image)
    found = sum(1 for cx, cy in centers if res.mask[cy, cx] > 0)
    assert found >= 3, f"solo {found} de 4 discos detectados"
    assert res.metrics["colonias_verificadas_por_forma"] >= 3
    outside = np.count_nonzero((res.mask > 0) & (discs == 0))
    assert outside <= 0.1 * np.count_nonzero(res.mask)
    assert res.coverage_pct < 10.0


def test_cobertura_de_mascaras_conocidas():
    mask = np.zeros((10, 10), np.uint8)
    assert seg.coverage_percent(mask) == 0.0
    mask[:5] = 255
    assert seg.coverage_percent(mask) == pytest.approx(50.0)
    mask[:] = 255
    assert seg.coverage_percent(mask) == pytest.approx(100.0)


def test_segmentacion_es_determinista(results):
    image, res = results["get"]("cushuro3")
    again = seg.segment_cushuro(image)
    assert np.array_equal(res.mask, again.mask)


# --------------------------------------------------------------------------- #
# Contrato JSON
# --------------------------------------------------------------------------- #
def test_registro_cumple_el_contrato():
    rec = seg.build_record("COCHA-01", "fotos/cushuro2.jpg", 35.456)
    assert tuple(rec) == seg.CONTRACT_FIELDS
    assert rec["cocha_id"] == "COCHA-01"
    assert rec["foto"] == "fotos/cushuro2.jpg"
    assert rec["cobertura_pct"] == 35.46
    assert rec["biomasa_kg"] == 0.0 and isinstance(rec["biomasa_kg"], float)
    ts = datetime.fromisoformat(rec["timestamp"])
    assert ts.tzinfo is not None  # ISO 8601 con zona horaria


def test_registro_acepta_timestamp_explicito():
    rec = seg.build_record("COCHA-01", "f.jpg", 1.0, timestamp="2026-11-14T14:00:00-05:00")
    assert rec["timestamp"] == "2026-11-14T14:00:00-05:00"


@pytest.mark.parametrize(
    "changes",
    [
        {"cobertura_pct": 100.01},
        {"cobertura_pct": -0.1},
        {"cobertura_pct": float("nan")},
        {"cobertura_pct": "35"},
        {"cobertura_pct": True},
        {"biomasa_kg": -1.0},
        {"biomasa_kg": None},
        {"cocha_id": ""},
        {"foto": "  "},
        {"timestamp": "14/11/2026 14:00"},
        {"timestamp": "2026-11-14T14:00:00"},   # sin zona horaria
        {"extra": 1},                           # campo fuera del contrato
    ],
)
def test_validacion_rechaza_registros_invalidos(changes):
    rec = seg.build_record("COCHA-01", "f.jpg", 10.0, timestamp="2026-11-14T14:00:00-05:00")
    rec.update(changes)
    with pytest.raises(ValueError):
        seg.validate_record(rec)


def test_validacion_rechaza_campo_faltante():
    rec = seg.build_record("COCHA-01", "f.jpg", 10.0)
    del rec["biomasa_kg"]
    with pytest.raises(ValueError):
        seg.validate_record(rec)


def test_la_salida_debe_ser_un_arreglo():
    with pytest.raises(ValueError):
        seg.validate_records({"cocha_id": "COCHA-01"})


def test_escritura_del_json(tmp_path):
    records = [
        seg.build_record("COCHA-01", "fotos/a.jpg", 12.5),
        seg.build_record("COCHA-02", "fotos/b.jpg", 0.0),
    ]
    out = seg.write_vision_json(records, tmp_path / "data" / "vision.json")
    text = out.read_text(encoding="utf-8")
    assert text.endswith("\n")
    loaded = json.loads(text)
    assert isinstance(loaded, list) and loaded == records
    seg.validate_records(loaded)


def test_vision_json_del_proyecto_cumple_el_contrato():
    """Valida los vision.json que existan (salida local, processed y mock)."""
    candidates = [
        ROOT / "data" / "vision.json",
        ROOT / "data" / "processed" / "vision.json",
        ROOT / "data" / "mock" / "vision.json",
    ]
    present = [p for p in candidates if p.is_file()]
    if not present:
        pytest.skip("No hay ningún vision.json en data/")
    for path in present:
        seg.validate_records(json.loads(path.read_text(encoding="utf-8")))


def test_validador_coincide_con_el_esquema_del_repositorio():
    """El validador interno debe reflejar data/contracts/vision.schema.json."""
    schema_path = ROOT / "data" / "contracts" / "vision.schema.json"
    if not schema_path.is_file():
        pytest.skip("data/contracts/vision.schema.json no está en esta carpeta")
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    assert schema["type"] == "array"
    item = schema["items"]
    assert set(item["required"]) == set(seg.CONTRACT_FIELDS)
    assert set(item["properties"]) == set(seg.CONTRACT_FIELDS)
    assert item.get("additionalProperties") is False
    cobertura = item["properties"]["cobertura_pct"]
    assert (cobertura["minimum"], cobertura["maximum"]) == (0, 100)
    assert item["properties"]["biomasa_kg"]["minimum"] == 0

    records = [seg.build_record("SAB-01", "data/fotos/SAB-01-2026-11-14.jpg", 35.5,
                                timestamp="2026-11-14T14:00:00-05:00")]
    try:
        import jsonschema
    except ImportError:
        return  # la comprobación estructural anterior ya se hizo
    jsonschema.validate(records, schema)


# --------------------------------------------------------------------------- #
# Flujo completo y CLI
# --------------------------------------------------------------------------- #
def test_process_photo_genera_las_salidas_sin_tocar_el_original(tmp_path):
    photo = _require("cushuro3")
    before = hashlib.sha256(photo.read_bytes()).hexdigest()
    record, res = seg.process_photo(photo, "COCHA-02", tmp_path)
    assert hashlib.sha256(photo.read_bytes()).hexdigest() == before

    out = tmp_path / "cushuro3"
    for name in ("mascara.png", "overlay.jpg", "contornos.jpg", "metrics.json"):
        assert (out / name).is_file(), name
    image = seg.load_image(photo)
    mask = cv2.imdecode(np.fromfile(str(out / "mascara.png"), np.uint8), cv2.IMREAD_GRAYSCALE)
    assert mask.shape == image.shape[:2]
    assert np.array_equal(mask, res.mask)
    for name in ("overlay.jpg", "contornos.jpg"):
        assert seg.load_image(out / name).shape == image.shape

    metrics = json.loads((out / "metrics.json").read_text(encoding="utf-8"))
    assert metrics["cobertura_pct"] == record["cobertura_pct"]
    assert metrics["biomasa_kg"] == 0.0
    assert metrics["estado"] == "candidato_no_validado"
    seg.validate_record(record)


def test_cli_genera_json_valido(tmp_path):
    photo = _require("cushuro3")
    out_json = tmp_path / "vision.json"
    code = seg.main([str(photo), "--cocha-id", "COCHA-02",
                     "--timestamp", "2026-11-14T14:00:00-05:00",
                     "--output", str(out_json), "--results-dir", str(tmp_path / "res")])
    assert code == 0
    records = json.loads(out_json.read_text(encoding="utf-8"))
    seg.validate_records(records)
    assert len(records) == 1
    assert records[0]["cocha_id"] == "COCHA-02"
    assert records[0]["timestamp"] == "2026-11-14T14:00:00-05:00"
    assert records[0]["biomasa_kg"] == 0.0


def test_cli_imagen_invalida(tmp_path):
    fake = tmp_path / "rota.jpg"
    fake.write_bytes(b"\x00\x01\x02")
    out_json = tmp_path / "vision.json"
    code = seg.main([str(fake), "--cocha-id", "COCHA-01", "--output", str(out_json),
                     "--results-dir", str(tmp_path / "res")])
    assert code == 1
    assert not out_json.exists()


def test_cli_ids_que_no_coinciden_con_las_fotos(tmp_path):
    code = seg.main(["a.jpg", "b.jpg", "c.jpg", "--cocha-id", "A", "--cocha-id", "B",
                     "--output", str(tmp_path / "v.json")])
    assert code == 2


# --------------------------------------------------------------------------- #
# Calibración (mecánica; los números son sintéticos, no mediciones)
# --------------------------------------------------------------------------- #
def test_sin_calibracion_no_se_estima_biomasa():
    with pytest.raises(cal.CalibrationError):
        cal.estimate_biomass(12.5, None)


def test_calibracion_exige_suficientes_mediciones():
    with pytest.raises(cal.CalibrationError):
        cal.fit_biomass_calibration([(10.0, 0.2), (20.0, 0.4)])


def test_calibracion_no_extrapola(tmp_path):
    pairs = [(float(c), 0.02 * c + 0.1) for c in range(5, 45, 5)]  # sintético
    fitted = cal.fit_biomass_calibration(pairs)
    assert fitted.pendiente_kg_por_pct == pytest.approx(0.02)
    assert fitted.predict(20.0) == pytest.approx(0.5)
    with pytest.raises(cal.CalibrationError):
        fitted.predict(80.0)
    saved = fitted.save(tmp_path / "cal.json")
    assert cal.BiomassCalibration.load(saved) == fitted


def test_evaluacion_contra_mascara_de_referencia():
    ref = np.zeros((10, 10), np.uint8)
    ref[:, :5] = 255
    pred = np.zeros((10, 10), np.uint8)
    pred[:, 3:7] = 255
    m = cal.evaluate_mask(pred, ref)
    assert (m["tp_px"], m["fp_px"], m["fn_px"]) == (20, 20, 30)
    assert m["precision"] == pytest.approx(0.5)
    assert m["recall"] == pytest.approx(0.4)
    with pytest.raises(ValueError):
        cal.evaluate_mask(pred, np.zeros((5, 5), np.uint8))
