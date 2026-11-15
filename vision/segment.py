#!/usr/bin/env python3
"""
Hanan Qocha - Módulo de visión: segmentación de colonias candidatas de cushuro
(Nostoc sphaericum) en fotografías de campo de cochas altoandinas.

Idea central
------------
Un umbral de color no distingue el cushuro del sedimento, las algas o el barro:
todos comparten tonos verde-amarillo-marrón. Lo que sí caracteriza a una
colonia es su GEOMETRÍA: una esfera lisa, delimitada por un borde cerrado, de
tamaño acotado. El algoritmo trabaja en dos etapas:

  Etapa 1 - Forma (alta confianza)
      Desde una rejilla de semillas se lanzan rayos radiales. Una colonia se
      acepta si existe un radio para el cual casi todos los rayos encuentran un
      borde orientado tangencialmente (contorno cerrado), el interior está
      libre de bordes (superficie lisa), el contorno se ajusta a una elipse
      poco excéntrica y el color medio es plausible (ni gris, ni azul, ni
      blanco, ni negro).

  Etapa 2 - Color aprendido en la propia foto (confianza media)
      Con los píxeles de las colonias de la etapa 1 se construye un modelo de
      color (histograma a*b* de CIELAB) y se compara contra el color de toda
      la imagen. Las candidatas redondas cuyo contorno quedó incompleto se
      aceptan solo si su color es característico de las colonias verificadas
      y están cerca de alguna (las colonias crecen agrupadas). Así el color
      se calibra solo para cada foto (ámbar sobre roca, verde oliva bajo el
      agua) en lugar de fijarse a mano, y nunca se añade una región sin forma.

Advertencias
------------
* `cobertura_pct` es el porcentaje de PÍXELES CANDIDATOS según este algoritmo.
  No es una medición biológica validada: no existen todavía máscaras de
  referencia etiquetadas a mano, por lo que no se reporta precisión/recall.
* `biomasa_kg` NO se estima a partir de la imagen. Requiere calibración
  experimental (ver calibration.py). 0.0 es un marcador provisional.

Uso
---
    python vision/segment.py fotos/cushuro2.jpg --cocha-id COCHA-01
    python vision/segment.py fotos/cushuro2.jpg fotos/cushuro3.jpg \
        --cocha-id COCHA-01 --cocha-id COCHA-02 \
        --output data/vision.json --results-dir resultados
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Sequence

import cv2
import numpy as np

ALGORITHM_NAME = "starburst-forma + color-adaptativo"
ALGORITHM_VERSION = "3.0.0"

COVERAGE_NOTE = (
    "cobertura_pct = pixeles_candidatos / pixeles_totales * 100. Es cobertura "
    "de píxeles candidatos según el algoritmo, NO una medición biológica "
    "validada ni una detección confirmada de Nostoc sphaericum."
)
BIOMASS_NOTE = (
    "biomasa_kg no se estima desde la imagen: requiere mediciones reales y "
    "calibración experimental. 0.0 es un marcador provisional, no significa "
    "biomasa nula."
)

# Campos del contrato data/contracts/vision.schema.json (no modificar sin
# coordinar con Qocha Twin).
CONTRACT_FIELDS = ("cocha_id", "timestamp", "foto", "cobertura_pct", "biomasa_kg")


# --------------------------------------------------------------------------- #
# Configuración
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class SegmentConfig:
    """Parámetros del algoritmo. Los radios son fracciones del lado corto de la
    imagen, de modo que el mismo ajuste sirve para distintas resoluciones
    (pero NO para distancias de toma muy distintas: ver README)."""

    # --- Resolución de trabajo ------------------------------------------- #
    work_max_side: int = 1700          # se reduce la foto si es más grande

    # --- Tamaño esperado de una colonia (fracción del lado corto) --------- #
    r_min_frac: float = 0.011
    r_max_frac: float = 0.062

    # --- Etapa A: reducción de ruido y brillos ---------------------------- #
    bilateral_d: int = 7
    bilateral_sigma_color: float = 30.0
    bilateral_sigma_space: float = 5.0
    spec_tophat_thr: int = 55          # realce local de V para brillo especular
    spec_s_max: int = 90               # un brillo es poco saturado...
    spec_v_min: int = 150              # ...y claro
    glare_l_min: float = 185.0         # velo/reflejo extenso: muy claro...
    glare_c_max: float = 14.0          # ...y casi sin croma
    grad_sigma: float = 1.6            # suavizado previo al gradiente

    # --- Compuerta de color amplia (CIELAB, L en 0-255, a/b centrados) ---- #
    # Solo descarta colores imposibles para el cushuro (gris roca, azul,
    # blanco, negro). No decide por sí sola qué es cushuro.
    gate_l_min: float = 30.0
    gate_l_max: float = 235.0
    gate_c_min: float = 7.0
    gate_b_min: float = 4.0
    gate_hue_min: float = 35.0         # grados: 35=naranja-rojizo
    gate_hue_max: float = 140.0        # 140=verde
    # Un objeto poco colorido (croma baja) solo se admite si tira a cálido
    # (amarillo/oliva). Gris-verdoso de baja croma = roca mojada, guijarro o
    # velo de agua. Ajustado con solo dos fotografías: revisar con más datos.
    gate_lowc_chroma: float = 22.0
    gate_lowc_hue_max: float = 105.0

    # --- Etapa 1: detector de esferas por rayos --------------------------- #
    tau_factor: float = 1.5            # umbral de borde = factor * mediana(grad)
    tau_min: float = 4.0
    tau_max: float = 7.0
    n_rays: int = 32
    align_min: float = 0.6             # el borde debe ser ~tangente al círculo
    radius_step: float = 1.1
    rim_tol: float = 0.2               # tolerancia radial del contorno
    rim_tol_min_px: float = 2.5
    interior_frac: float = 0.7         # zona interior que debe ser lisa
    seed_step_frac: float = 0.55       # paso de la rejilla de semillas (x r_min)
    pre_support: float = 0.6           # preselección
    pre_noise: float = 0.3
    # Residuo máximo de un punto de contorno respecto de la elipse ajustada.
    # Se acota en píxeles: una esfera grande no tiene el borde "más difuso".
    fit_tol: float = 0.10
    fit_tol_min_px: float = 1.5
    fit_tol_max_px: float = 3.0
    fit_tol_loose: float = 0.12        # tolerancia relativa (candidatas débiles)
    weak_support: float = 0.6          # soporte mínimo (laxo) para ser candidata
    strong_support: float = 0.70       # soporte estricto para "verificada"
    strong_quality: float = 0.5        # calidad mínima para "verificada"
    max_gap_frac: float = 0.3          # hueco angular máximo sin contorno
    max_aspect: float = 1.6            # excentricidad máxima (eje mayor/menor)
    max_interior_noise: float = 0.25   # fracción máx. de bordes en el interior
    nms_overlap: float = 0.3

    # --- Etapa 2: aceptación por color aprendido -------------------------- #
    enable_color_expansion: bool = True
    min_seeds_for_color: int = 4       # sin semillas suficientes no se aprende
    hist_bins: int = 48
    color_like_min: float = 0.6        # P(color | cushuro) relativo al fondo
    expand_max_dist_frac: float = 4.0  # distancia máx. a una verificada (x r_max)
    expand_max_ratio: float = 4.0      # si etapa2 > ratio * etapa1 -> aviso


# --------------------------------------------------------------------------- #
# Estructuras de datos
# --------------------------------------------------------------------------- #
@dataclass
class Colony:
    """Colonia candidata verificada por forma (coordenadas de trabajo)."""

    x: float
    y: float
    axis_major: float      # semieje mayor (px)
    axis_minor: float      # semieje menor (px)
    angle: float           # grados
    support: float         # fracción de rayos con contorno
    interior_noise: float  # fracción de bordes en el interior
    contrast: float        # fuerza del contorno relativa al umbral
    lab: tuple[float, float, float]  # color mediano (L, a, b centrados)
    quality: float
    rms_px: float = 0.0    # residuo del contorno respecto de la elipse (px)
    color_std: float = 0.0  # dispersión de croma en el interior
    support_loose: float = 0.0  # soporte con tolerancia relativa (laxa)
    color_like: float = 0.0     # parecido al color aprendido (etapa 2)
    level: str = "debil"   # "forma" (etapa 1), "color" (etapa 2) o "debil"

    @property
    def radius(self) -> float:
        return 0.5 * (self.axis_major + self.axis_minor)


@dataclass
class Prep:
    """Resultado del preprocesado (todo a resolución de trabajo)."""

    work: np.ndarray        # BGR de trabajo
    clean: np.ndarray       # BGR sin ruido y con brillos rellenados
    lab: np.ndarray         # CIELAB uint8 de `clean`
    gx: np.ndarray          # gradiente x por canal Lab (h, w, 3)
    gy: np.ndarray
    mag: np.ndarray         # magnitud del gradiente de color
    spec: np.ndarray        # máscara de brillo especular (bool)
    glare: np.ndarray       # máscara de reflejo/velo extenso (bool)
    plausible: np.ndarray   # compuerta de color amplia (bool)
    tau: float              # umbral de borde adaptado a la foto
    r_min: float
    r_max: float
    scale: float            # trabajo / original


@dataclass
class SegmentationResult:
    mask: np.ndarray                 # uint8 0/255, tamaño original
    mask_shape: np.ndarray           # solo etapa 1 (forma verificada)
    mask_color: np.ndarray           # solo etapa 2 (expansión por color)
    coverage_pct: float
    colonies: list[Colony]
    metrics: dict[str, Any]
    warnings: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #
def _disk(diameter: int) -> np.ndarray:
    diameter = max(1, int(diameter)) | 1  # impar
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (diameter, diameter))


def load_image(path: str | Path) -> np.ndarray:
    """Carga una fotografía como BGR uint8.

    Usa imdecode para tolerar rutas con tildes/espacios en Windows.
    Lanza FileNotFoundError si no existe y ValueError si no es una imagen.
    """
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"No existe la fotografía: {p}")
    data = np.fromfile(str(p), dtype=np.uint8)
    if data.size == 0:
        raise ValueError(f"El archivo está vacío: {p}")
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"El archivo no es una imagen válida: {p}")
    return image


def _validate_image(image: np.ndarray) -> None:
    if not isinstance(image, np.ndarray) or image.size == 0:
        raise ValueError("La imagen está vacía o no pudo cargarse.")
    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError("Se esperaba una imagen BGR de 3 canales.")
    if image.dtype != np.uint8:
        raise ValueError("Se esperaba una imagen de 8 bits (uint8).")
    if min(image.shape[:2]) < 32:
        raise ValueError("La imagen es demasiado pequeña (lado < 32 px).")


def _lab_centered(lab_u8: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """L (0-255), a y b centrados en 0, como float32."""
    lab = lab_u8.astype(np.float32)
    return lab[..., 0], lab[..., 1] - 128.0, lab[..., 2] - 128.0


def plausible_color(L, a, b, cfg: SegmentConfig):
    """Compuerta amplia: ¿este color PODRÍA ser cushuro (oliva a ámbar)?

    Funciona con escalares o con arreglos. Es deliberadamente permisiva:
    solo excluye gris/azul/blanco/negro. La decisión la toma la forma.
    """
    chroma = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a))
    hue_max = np.where(chroma < cfg.gate_lowc_chroma, cfg.gate_lowc_hue_max, cfg.gate_hue_max)
    return (
        (L >= cfg.gate_l_min)
        & (L <= cfg.gate_l_max)
        & (chroma >= cfg.gate_c_min)
        & (b >= cfg.gate_b_min)
        & (hue >= cfg.gate_hue_min)
        & (hue <= hue_max)
    )


# --------------------------------------------------------------------------- #
# Etapa A: preprocesado
# --------------------------------------------------------------------------- #
def preprocess(image: np.ndarray, cfg: SegmentConfig = SegmentConfig()) -> Prep:
    """Reduce ruido, rellena brillos especulares y calcula gradientes de color."""
    _validate_image(image)
    h0, w0 = image.shape[:2]
    scale = min(1.0, cfg.work_max_side / max(h0, w0))
    work = image
    if scale < 1.0:
        work = cv2.resize(
            image, (int(round(w0 * scale)), int(round(h0 * scale))),
            interpolation=cv2.INTER_AREA,
        )
    h, w = work.shape[:2]
    short = min(h, w)
    r_min = max(4.0, cfg.r_min_frac * short)
    r_max = max(r_min * 1.5, cfg.r_max_frac * short)

    # Filtro bilateral: quita ruido conservando los bordes de las colonias.
    den = cv2.bilateralFilter(
        work, cfg.bilateral_d, cfg.bilateral_sigma_color, cfg.bilateral_sigma_space
    )

    # Brillos especulares: puntos claros, poco saturados y más brillantes que
    # su entorno (top-hat de V). Se rellenan para que una esfera con reflejo
    # siga viéndose como una región lisa.
    hsv = cv2.cvtColor(den, cv2.COLOR_BGR2HSV)
    sat, val = hsv[..., 1], hsv[..., 2]
    tophat = cv2.morphologyEx(val, cv2.MORPH_TOPHAT, _disk(2 * round(r_min * 1.6) + 1))
    spec = (tophat > cfg.spec_tophat_thr) & (sat < cfg.spec_s_max) & (val > cfg.spec_v_min)
    spec_u8 = cv2.dilate(spec.astype(np.uint8) * 255, _disk(5))
    clean = cv2.inpaint(den, spec_u8, 5, cv2.INPAINT_TELEA) if spec.any() else den

    lab = cv2.cvtColor(clean, cv2.COLOR_BGR2LAB)
    L, a, b = _lab_centered(lab)

    # Reflejo/velo extenso (sol sobre el agua): muy claro y sin croma.
    glare = (L >= cfg.glare_l_min) & (np.hypot(a, b) <= cfg.glare_c_max)
    glare = cv2.morphologyEx(glare.astype(np.uint8), cv2.MORPH_OPEN, _disk(5)) > 0

    # Gradiente de color (L, a, b): un borde de colonia puede ser de brillo o
    # de tono, por eso se usan los tres canales.
    smooth = cv2.GaussianBlur(lab.astype(np.float32), (0, 0), cfg.grad_sigma)
    gx = np.dstack(
        [cv2.Sobel(smooth[..., c], cv2.CV_32F, 1, 0, ksize=3) / 8.0 for c in range(3)]
    )
    gy = np.dstack(
        [cv2.Sobel(smooth[..., c], cv2.CV_32F, 0, 1, ksize=3) / 8.0 for c in range(3)]
    )
    mag = np.sqrt((gx * gx + gy * gy).sum(axis=2))

    # Umbral de borde adaptado al contraste de cada foto.
    tau = float(np.clip(cfg.tau_factor * float(np.median(mag)), cfg.tau_min, cfg.tau_max))

    plaus = plausible_color(L, a, b, cfg) & ~glare
    return Prep(
        work=work, clean=clean, lab=lab, gx=gx, gy=gy, mag=mag,
        spec=spec_u8 > 0, glare=glare, plausible=plaus, tau=tau,
        r_min=r_min, r_max=r_max, scale=scale,
    )


# --------------------------------------------------------------------------- #
# Etapa 1: detector de esferas por rayos ("starburst")
# --------------------------------------------------------------------------- #
def _scan_rays(cx, cy, prep: Prep, rho, cos_t, sin_t, cfg: SegmentConfig):
    """Muestrea el gradiente a lo largo de rayos desde cada semilla.

    Devuelve, con forma (semillas, rayos, pasos):
      e     - derivada radial del color (fuerza del borde que cruza el rayo)
      hit   - borde fuerte y orientado ~perpendicular al rayo (contorno)
      noisy - cualquier borde fuerte (para medir si el interior es liso)
    """
    h, w = prep.mag.shape
    xi = np.rint(cx[:, None, None] + rho[None, None, :] * cos_t[None, :, None]).astype(np.intp)
    yi = np.rint(cy[:, None, None] + rho[None, None, :] * sin_t[None, :, None]).astype(np.intp)
    inb = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
    np.clip(xi, 0, w - 1, out=xi)
    np.clip(yi, 0, h - 1, out=yi)
    e2 = np.zeros(xi.shape, np.float32)
    ct = cos_t[None, :, None]
    st = sin_t[None, :, None]
    for c in range(3):
        d = prep.gx[yi, xi, c] * ct + prep.gy[yi, xi, c] * st
        e2 += d * d
    e = np.sqrt(e2)
    m = prep.mag[yi, xi]
    hit = (e > prep.tau) & (e >= cfg.align_min * m) & inb
    noisy = (m > prep.tau) & inb
    return e, hit, noisy


def _ellipse_roi(shape, x, y, ax_major, ax_minor, angle, scale=1.0):
    """ROI y máscara booleana de una elipse rellena (recortada a la imagen)."""
    h, w = shape
    r = ax_major * scale + 2
    x0, x1 = int(max(math.floor(x - r), 0)), int(min(math.ceil(x + r) + 1, w))
    y0, y1 = int(max(math.floor(y - r), 0)), int(min(math.ceil(y + r) + 1, h))
    if x1 <= x0 or y1 <= y0:
        return None
    tmp = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.ellipse(
        tmp,
        ((float(x - x0), float(y - y0)),
         (float(2 * ax_major * scale), float(2 * ax_minor * scale)), float(angle)),
        255, -1,
    )
    return (slice(y0, y1), slice(x0, x1)), tmp > 0


def _fit_candidate(x, y, e_j, hit_j, rho, window, cos_t, sin_t, prep: Prep,
                   cfg: SegmentConfig) -> Colony | None:
    """Ajusta una elipse al contorno hallado por los rayos y la verifica."""
    k0, k1 = window
    n_rays = cos_t.size
    ew = np.where(hit_j[:, k0:k1], e_j[:, k0:k1], 0.0)
    kk = ew.argmax(axis=1)
    strength = ew.max(axis=1)
    valid = strength > 0
    if valid.sum() < max(8, int(0.5 * n_rays)):
        return None
    rr = rho[k0 + kk]
    pts = np.stack([x + rr * cos_t, y + rr * sin_t], axis=1)[valid].astype(np.float32)
    try:
        (ex, ey), (d1, d2), ang = cv2.fitEllipse(pts)
    except cv2.error:
        return None
    if not all(map(math.isfinite, (ex, ey, d1, d2, ang))) or min(d1, d2) <= 1:
        return None
    ax1, ax2 = d1 / 2.0, d2 / 2.0
    r_e = 0.5 * (ax1 + ax2)
    if not (0.9 * prep.r_min <= r_e <= 1.1 * prep.r_max):
        return None
    if max(ax1, ax2) / min(ax1, ax2) > cfg.max_aspect:
        return None
    if math.hypot(ex - x, ey - y) > 0.6 * r_e:
        return None

    # Residuo de cada punto de contorno respecto de la elipse ajustada.
    t = math.radians(ang)
    ct, st = math.cos(t), math.sin(t)
    dx, dy = pts[:, 0] - ex, pts[:, 1] - ey
    u = dx * ct + dy * st
    v = -dx * st + dy * ct
    d = np.sqrt((u / ax1) ** 2 + (v / ax2) ** 2)
    tol_px = float(np.clip(cfg.fit_tol * r_e, cfg.fit_tol_min_px, cfg.fit_tol_max_px))
    res_px = np.abs(d - 1.0) * r_e
    inl_pts = res_px <= tol_px
    support = inl_pts.sum() / n_rays                 # estricto (px)
    loose_pts = np.abs(d - 1.0) <= cfg.fit_tol_loose  # laxo (relativo)
    inl = np.zeros(n_rays, bool)
    inl[np.nonzero(valid)[0][loose_pts]] = True
    support_loose = inl.sum() / n_rays
    if support_loose < cfg.weak_support or inl_pts.sum() < 5:
        return None
    # Hueco angular máximo sin contorno (evita "medias lunas").
    idx = np.nonzero(inl)[0]
    gaps = np.diff(np.concatenate([idx, idx[:1] + n_rays]))
    if gaps.max() - 1 > cfg.max_gap_frac * n_rays:
        return None

    # Interior liso: pocos bordes dentro de la elipse reducida.
    roi = _ellipse_roi(prep.mag.shape, ex, ey, max(ax1, ax2), min(ax1, ax2),
                       ang if ax1 >= ax2 else ang + 90.0, cfg.interior_frac)
    if roi is None:
        return None
    sl, m = roi
    if m.sum() < 5:
        return None
    noise = float((prep.mag[sl][m] > prep.tau).mean())
    if noise > cfg.max_interior_noise:
        return None

    # Color mediano del interior (robusto a restos de brillo) y compuerta.
    px = prep.lab[sl][m].astype(np.float32)
    L, a, b = np.median(px, axis=0)
    a -= 128.0
    b -= 128.0
    if not bool(plausible_color(L, a, b, cfg)):
        return None
    if prep.glare[sl][m].mean() > 0.3:
        return None

    contrast = float(strength[inl].mean() / prep.tau)
    rms_px = float(np.sqrt(np.mean(res_px[inl_pts] ** 2)))
    color_std = float(np.sqrt(px[:, 1].var() + px[:, 2].var()))
    quality = support * (1.0 - noise) * (1.0 - 0.5 * min(rms_px / tol_px, 1.0))
    major, minor = (ax1, ax2) if ax1 >= ax2 else (ax2, ax1)
    angle = ang if ax1 >= ax2 else ang + 90.0
    return Colony(
        x=float(ex), y=float(ey), axis_major=float(major), axis_minor=float(minor),
        angle=float(angle), support=float(support), interior_noise=noise,
        contrast=contrast, lab=(float(L), float(a), float(b)), quality=float(quality),
        rms_px=rms_px, color_std=color_std, support_loose=float(support_loose),
    )


def detect_colonies(prep: Prep, cfg: SegmentConfig = SegmentConfig()) -> list[Colony]:
    """Etapa 1: candidatas redondas (fuertes y débiles), sin duplicados.

    Use split_by_strength() para separar las verificadas por forma.
    """
    h, w = prep.mag.shape
    theta = np.linspace(0.0, 2.0 * np.pi, cfg.n_rays, endpoint=False)
    cos_t = np.cos(theta).astype(np.float32)
    sin_t = np.sin(theta).astype(np.float32)
    rho = np.arange(1.5, prep.r_max * (1.0 + cfg.rim_tol) + 2.0, 1.0, dtype=np.float32)

    # Radios a evaluar y, para cada uno, las ventanas de contorno e interior.
    radii, windows = [], []
    r = prep.r_min
    while r <= prep.r_max * 1.0001:
        tol = max(cfg.rim_tol * r, cfg.rim_tol_min_px)
        k0 = int(np.searchsorted(rho, r - tol))
        k1 = int(min(np.searchsorted(rho, r + tol, side="right"), rho.size))
        ki = int(max(np.searchsorted(rho, cfg.interior_frac * r), 1))
        radii.append(r)
        windows.append((k0, k1, ki))
        r *= cfg.radius_step

    # Semillas: rejilla densa restringida a zonas lisas y de color plausible.
    step = max(3, int(round(prep.r_min * cfg.seed_step_frac)))
    ys, xs = np.mgrid[step // 2:h:step, step // 2:w:step]
    quiet = cv2.GaussianBlur(prep.mag, (0, 0), 2.0) < prep.tau
    ok = quiet[ys, xs] & prep.plausible[ys, xs]
    cx = xs[ok].astype(np.float32)
    cy = ys[ok].astype(np.float32)

    candidates: list[Colony] = []
    batch = 1500
    n_r = cfg.n_rays
    for i in range(0, cx.size, batch):
        x, y = cx[i:i + batch], cy[i:i + batch]
        e, hit, noisy = _scan_rays(x, y, prep, rho, cos_t, sin_t, cfg)
        n = x.size
        zeros = np.zeros((n, n_r, 1), np.int32)
        cs_hit = np.concatenate([zeros, np.cumsum(hit, axis=2, dtype=np.int32)], axis=2)
        cs_noisy = np.concatenate([zeros, np.cumsum(noisy, axis=2, dtype=np.int32)], axis=2)
        support = np.empty((n, len(radii)), np.float32)
        noise = np.empty((n, len(radii)), np.float32)
        for m, (k0, k1, ki) in enumerate(windows):
            support[:, m] = ((cs_hit[:, :, k1] - cs_hit[:, :, k0]) > 0).mean(axis=1)
            noise[:, m] = cs_noisy[:, :, ki].sum(axis=1) / float(n_r * ki)
        best = (support - noise).argmax(axis=1)
        rows = np.arange(n)
        pre = (support[rows, best] >= cfg.pre_support) & (noise[rows, best] <= cfg.pre_noise)
        for j in np.nonzero(pre)[0]:
            k0, k1, _ = windows[best[j]]
            col = _fit_candidate(float(x[j]), float(y[j]), e[j], hit[j], rho,
                                 (k0, k1), cos_t, sin_t, prep, cfg)
            if col is not None:
                candidates.append(col)

    # Supresión de duplicados: se conserva la mejor hipótesis por colonia.
    candidates.sort(key=lambda c: -c.quality)
    acc = np.zeros((h, w), bool)
    kept: list[Colony] = []
    for col in candidates:
        roi = _ellipse_roi((h, w), col.x, col.y, col.axis_major, col.axis_minor, col.angle)
        if roi is None:
            continue
        sl, m = roi
        area = int(m.sum())
        if area == 0:
            continue
        if (acc[sl] & m).sum() / area > cfg.nms_overlap:
            continue
        acc[sl] |= m
        kept.append(col)
    return kept


def colonies_mask(shape: tuple[int, int], colonies: Sequence[Colony]) -> np.ndarray:
    """Máscara uint8 con las elipses de las colonias verificadas."""
    mask = np.zeros(shape, np.uint8)
    for c in colonies:
        cv2.ellipse(
            mask,
            ((c.x, c.y), (2 * c.axis_major, 2 * c.axis_minor), c.angle),
            255, -1,
        )
    return mask


# --------------------------------------------------------------------------- #
# Etapa 2: aceptación de candidatas débiles por color aprendido en la foto
# --------------------------------------------------------------------------- #
def split_by_strength(candidates: Sequence[Colony],
                      cfg: SegmentConfig = SegmentConfig()) -> tuple[list[Colony], list[Colony]]:
    """Separa las candidatas en verificadas por forma ("forma") y débiles."""
    strong: list[Colony] = []
    weak: list[Colony] = []
    for c in candidates:
        if c.support >= cfg.strong_support and c.quality >= cfg.strong_quality:
            c.level = "forma"
            strong.append(c)
        else:
            c.level = "debil"
            weak.append(c)
    return strong, weak


def accept_by_color(prep: Prep, strong: Sequence[Colony], weak: Sequence[Colony],
                    cfg: SegmentConfig = SegmentConfig()) -> tuple[list[Colony], dict[str, Any]]:
    """Acepta candidatas débiles cuyo color coincide con el de las verificadas.

    El modelo de color se aprende EN LA PROPIA FOTO: histograma a*b* (CIELAB)
    de las colonias verificadas por forma, comparado con el histograma de toda
    la imagen. Una candidata débil (redonda, pero con contorno incompleto) se
    acepta solo si su color es característico de las colonias y no del fondo,
    y si está cerca de alguna colonia verificada (las colonias se agrupan).

    Devuelve (candidatas aceptadas, información de diagnóstico).
    """
    info: dict[str, Any] = {"aplicada": False, "candidatas_debiles": len(weak)}
    if not cfg.enable_color_expansion:
        info["motivo"] = "desactivada por configuración"
        return [], info
    if len(strong) < cfg.min_seeds_for_color:
        info["motivo"] = (
            f"solo {len(strong)} colonias verificadas por forma (mínimo "
            f"{cfg.min_seeds_for_color}) para aprender el color"
        )
        return [], info

    h, w = prep.mag.shape
    # Muestras de color: interior (80 %) de cada colonia verificada.
    seed = np.zeros((h, w), np.uint8)
    for c in strong:
        cv2.ellipse(
            seed,
            ((c.x, c.y), (1.6 * c.axis_major, 1.6 * c.axis_minor), c.angle),
            255, -1,
        )
    bins = cfg.hist_bins
    rng = [0, 256, 0, 256]
    h_seed = cv2.calcHist([prep.lab], [1, 2], seed, [bins, bins], rng)
    h_all = cv2.calcHist([prep.lab], [1, 2], None, [bins, bins], rng)
    h_seed = cv2.GaussianBlur(h_seed, (0, 0), 1.0)
    h_all = cv2.GaussianBlur(h_all, (0, 0), 1.0)
    p_seed = h_seed / max(float(h_seed.sum()), 1.0)
    p_all = h_all / max(float(h_all.sum()), 1.0)
    # Verosimilitud relativa: 1 = color exclusivo de las colonias;
    # 0.5 = tan frecuente en las colonias como en el conjunto de la foto.
    ratio = p_seed / (p_seed + p_all + 1e-9)
    ai = (prep.lab[..., 1].astype(np.int32) * bins) // 256
    bi = (prep.lab[..., 2].astype(np.int32) * bins) // 256
    like = ratio[ai, bi]

    sx = np.array([c.x for c in strong], np.float32)
    sy = np.array([c.y for c in strong], np.float32)
    max_dist = cfg.expand_max_dist_frac * prep.r_max
    accepted: list[Colony] = []
    for c in list(strong) + list(weak):
        roi = _ellipse_roi((h, w), c.x, c.y, c.axis_major, c.axis_minor, c.angle, 0.8)
        if roi is None:
            continue
        sl, m = roi
        if not m.any():
            continue
        c.color_like = float(like[sl][m].mean())
        if c.level == "forma":
            continue
        if c.color_like < cfg.color_like_min:
            continue
        if float(np.hypot(sx - c.x, sy - c.y).min()) > max_dist:
            continue
        c.level = "color"
        accepted.append(c)
    info.update(aplicada=True, aceptadas=len(accepted))
    return accepted, info


# --------------------------------------------------------------------------- #
# Contexto: clasificación heurística del resto de la escena
# --------------------------------------------------------------------------- #
def classify_context(prep: Prep, candidate_mask: np.ndarray) -> dict[str, float]:
    """Porcentajes aproximados del resto de la escena (reglas simples).

    Sirve para interpretar el resultado y generar advertencias; NO es una
    clasificación validada de agua/sedimento/roca/vegetación.
    """
    L, a, b = _lab_centered(prep.lab)
    chroma = np.hypot(a, b)
    hue = np.degrees(np.arctan2(b, a))
    tex = cv2.GaussianBlur(prep.mag, (0, 0), max(0.5 * prep.r_min, 2.0))
    cand = candidate_mask > 0
    rest = ~cand
    reflejo = rest & (prep.glare | prep.spec)
    rest &= ~reflejo
    sombra = rest & (L < 45)
    rest &= ~sombra
    vegetacion = rest & (hue >= 100) & (hue <= 165) & (chroma >= 28) & (L >= 70)
    rest &= ~vegetacion
    neutro = rest & (chroma < 9)
    rest &= ~neutro
    rugoso = rest & (tex > prep.tau)
    otros = rest & ~rugoso
    total = float(cand.size)

    def pct(m):
        return round(float(m.sum()) / total * 100.0, 2)

    return {
        "candidato_cushuro": pct(cand),
        "reflejo_o_brillo": pct(reflejo),
        "sombra_o_agua_oscura": pct(sombra),
        "vegetacion_verde": pct(vegetacion),
        "roca_o_agua_neutra": pct(neutro),
        "sedimento_o_alga_rugosa": pct(rugoso),
        "otros_liso_con_color": pct(otros),
    }


# --------------------------------------------------------------------------- #
# Orquestación
# --------------------------------------------------------------------------- #
def coverage_percent(mask: np.ndarray) -> float:
    """cobertura_pct = pixeles_candidatos / pixeles_totales * 100."""
    if mask.size == 0:
        raise ValueError("La máscara está vacía.")
    return float(np.count_nonzero(mask)) / float(mask.size) * 100.0


def segment_cushuro(image: np.ndarray, cfg: SegmentConfig = SegmentConfig()) -> SegmentationResult:
    """Segmenta colonias candidatas de cushuro en una fotografía BGR."""
    prep = preprocess(image, cfg)
    candidates = detect_colonies(prep, cfg)
    strong, weak = split_by_strength(candidates, cfg)
    accepted, exp_info = accept_by_color(prep, strong, weak, cfg)
    colonies = strong + accepted

    wh = prep.mag.shape
    m_shape = colonies_mask(wh, strong)
    m_color = colonies_mask(wh, accepted)
    m_color[m_shape > 0] = 0  # solo lo que añade la etapa 2
    m_all = cv2.bitwise_or(m_shape, m_color)

    # De vuelta a la resolución original.
    h0, w0 = image.shape[:2]

    def up(m):
        if m.shape == (h0, w0):
            return m
        return cv2.resize(m, (w0, h0), interpolation=cv2.INTER_NEAREST)

    mask, mask_shape, mask_color = up(m_all), up(m_shape), up(m_color)
    cov = coverage_percent(mask)
    cov_shape = coverage_percent(mask_shape)
    cov_color = coverage_percent(mask_color)
    context = classify_context(prep, m_all)

    warnings: list[str] = []
    if not strong:
        warnings.append(
            "No se verificó ninguna colonia por forma: no hay detección "
            "confiable de cushuro en esta fotografía."
        )
    elif len(strong) < cfg.min_seeds_for_color:
        warnings.append(
            f"Solo {len(strong)} colonias verificadas por forma: resultado "
            "poco representativo y sin aceptación por color."
        )
    if exp_info.get("aplicada") and cov_color > cfg.expand_max_ratio * max(cov_shape, 1e-6):
        warnings.append(
            "La mayor parte de la cobertura proviene de candidatas de contorno "
            "incompleto aceptadas por color (no verificadas por forma): revise "
            "el overlay antes de usar el valor."
        )
    if context["reflejo_o_brillo"] > 10.0:
        warnings.append(
            f"{context['reflejo_o_brillo']:.0f} % de la imagen tiene reflejos o "
            "brillo: las colonias en esa zona no se detectan (falsos negativos)."
        )
    if context["sombra_o_agua_oscura"] > 25.0:
        warnings.append(
            f"{context['sombra_o_agua_oscura']:.0f} % de la imagen está en sombra "
            "o es agua/barro oscuro: las colonias en esa zona no se detectan."
        )
    warnings.append(
        "Resultado no validado: no existen máscaras de referencia etiquetadas "
        "manualmente, por lo que no se conoce la precisión real."
    )

    inv = 1.0 / prep.scale
    radii = np.array([c.radius for c in colonies], np.float32) * inv
    metrics: dict[str, Any] = {
        "algoritmo": {"nombre": ALGORITHM_NAME, "version": ALGORITHM_VERSION},
        "estado": "candidato_no_validado",
        "dimensiones_px": {"ancho": int(w0), "alto": int(h0)},
        "pixeles_totales": int(mask.size),
        "pixeles_candidatos": int(np.count_nonzero(mask)),
        "cobertura_pct": round(cov, 2),
        "cobertura_forma_verificada_pct": round(cov_shape, 2),
        "cobertura_aceptada_por_color_pct": round(cov_color, 2),
        "colonias_candidatas": len(colonies),
        "colonias_verificadas_por_forma": len(strong),
        "colonias_aceptadas_por_color": len(accepted),
        "candidatas_debiles_descartadas": len(weak) - len(accepted),
        "radio_colonia_px": (
            {
                "min": round(float(radii.min()), 1),
                "mediana": round(float(np.median(radii)), 1),
                "max": round(float(radii.max()), 1),
            }
            if len(colonies) else None
        ),
        "aceptacion_por_color": exp_info,
        "umbral_borde_tau": round(prep.tau, 2),
        "escala_trabajo": round(prep.scale, 4),
        "contexto_heuristico_pct": context,
        "advertencias": warnings,
        "nota_cobertura": COVERAGE_NOTE,
        "nota_biomasa": BIOMASS_NOTE,
        "colonias": [
            {
                "nivel": c.level,
                "x": round(c.x * inv, 1), "y": round(c.y * inv, 1),
                "semieje_mayor": round(c.axis_major * inv, 1),
                "semieje_menor": round(c.axis_minor * inv, 1),
                "angulo": round(c.angle, 1),
                "soporte_contorno": round(c.support, 3),
                "ruido_interior": round(c.interior_noise, 3),
                "contraste": round(c.contrast, 2),
                "calidad": round(c.quality, 3),
                "parecido_color": round(c.color_like, 3),
            }
            for c in colonies
        ],
        "parametros": asdict(cfg),
    }
    return SegmentationResult(
        mask=mask, mask_shape=mask_shape, mask_color=mask_color,
        coverage_pct=cov, colonies=colonies, metrics=metrics, warnings=warnings,
    )


# --------------------------------------------------------------------------- #
# Etapa C: salidas visuales
# --------------------------------------------------------------------------- #
COLOR_SHAPE = (255, 0, 255)   # magenta: colonia verificada por forma
COLOR_EXPAND = (255, 255, 0)  # cian: candidata aceptada por color aprendido


def make_overlay(image: np.ndarray, result: SegmentationResult, alpha: float = 0.5) -> np.ndarray:
    """Fotografía con las regiones candidatas teñidas (magenta/cian)."""
    out = image.copy()
    for m, color in ((result.mask_color, COLOR_EXPAND), (result.mask_shape, COLOR_SHAPE)):
        sel = m > 0
        if sel.any():
            tint = np.empty_like(image[sel])
            tint[:] = color
            out[sel] = cv2.addWeighted(image[sel], 1.0 - alpha, tint, alpha, 0)
    return out


def make_contours(image: np.ndarray, result: SegmentationResult) -> np.ndarray:
    """Fotografía con los contornos de las regiones detectadas."""
    out = image.copy()
    thick = max(1, int(round(min(image.shape[:2]) / 400)))
    for m, color in ((result.mask_color, COLOR_EXPAND), (result.mask_shape, COLOR_SHAPE)):
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(out, contours, -1, color, thick, cv2.LINE_AA)
    return out


def _label(img: np.ndarray, text: str) -> np.ndarray:
    out = img.copy()
    scale = max(0.5, min(img.shape[:2]) / 900.0)
    th = max(1, int(round(scale * 2)))
    (tw, tht), base = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, scale, th)
    cv2.rectangle(out, (0, 0), (tw + 16, tht + base + 14), (0, 0, 0), -1)
    cv2.putText(out, text, (8, tht + 8), cv2.FONT_HERSHEY_SIMPLEX, scale,
                (255, 255, 255), th, cv2.LINE_AA)
    return out


def make_panel(image: np.ndarray, result: SegmentationResult) -> np.ndarray:
    """Mosaico 2x2 para comparar: original | máscara / overlay | contornos."""
    mask_bgr = cv2.cvtColor(result.mask, cv2.COLOR_GRAY2BGR)
    cov = result.coverage_pct
    tiles = [
        _label(image, "Original"),
        _label(mask_bgr, f"Mascara candidatos ({cov:.1f} %)"),
        _label(make_overlay(image, result), "Overlay: magenta=forma, cian=color"),
        _label(make_contours(image, result), f"Contornos ({len(result.colonies)} colonias candidatas)"),
    ]
    return np.vstack([np.hstack(tiles[:2]), np.hstack(tiles[2:])])


def _imwrite(path: Path, image: np.ndarray) -> None:
    """imwrite tolerante a rutas con caracteres no ASCII."""
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, buf = cv2.imencode(path.suffix, image)
    if not ok:
        raise OSError(f"No se pudo codificar la imagen: {path}")
    buf.tofile(str(path))


# --------------------------------------------------------------------------- #
# Etapa D / integración: contrato JSON de Qocha Twin
# --------------------------------------------------------------------------- #
def now_iso() -> str:
    """Fecha y hora local en ISO 8601 con desfase horario (p. ej. -05:00)."""
    return datetime.now().astimezone().isoformat(timespec="seconds")


def build_record(cocha_id: str, photo_path: str, coverage_pct: float,
                 biomass_kg: float = 0.0, timestamp: str | None = None) -> dict[str, Any]:
    """Construye un registro que cumple data/contracts/vision.schema.json."""
    record = {
        "cocha_id": cocha_id,
        "timestamp": timestamp or now_iso(),
        "foto": photo_path,
        "cobertura_pct": round(float(coverage_pct), 2),
        "biomasa_kg": float(biomass_kg),
    }
    validate_record(record)
    return record


def validate_record(record: Any) -> None:
    """Valida un registro contra el contrato. Lanza ValueError si no cumple."""
    if not isinstance(record, dict):
        raise ValueError("Cada registro debe ser un objeto JSON.")
    missing = [k for k in CONTRACT_FIELDS if k not in record]
    if missing:
        raise ValueError(f"Faltan campos del contrato: {missing}")
    extra = [k for k in record if k not in CONTRACT_FIELDS]
    if extra:
        raise ValueError(f"Campos fuera del contrato: {extra}")
    if not isinstance(record["cocha_id"], str) or not record["cocha_id"].strip():
        raise ValueError("cocha_id debe ser un texto no vacío.")
    if not isinstance(record["foto"], str) or not record["foto"].strip():
        raise ValueError("foto debe ser una ruta no vacía.")
    ts = record["timestamp"]
    if not isinstance(ts, str):
        raise ValueError("timestamp debe ser un texto ISO 8601.")
    try:
        parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"timestamp no es ISO 8601: {ts!r}") from exc
    if parsed.tzinfo is None:
        raise ValueError("timestamp debe incluir zona horaria (p. ej. -05:00).")
    for key in ("cobertura_pct", "biomasa_kg"):
        value = record[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{key} debe ser numérico.")
        if not math.isfinite(value):
            raise ValueError(f"{key} debe ser finito.")
    if not 0.0 <= record["cobertura_pct"] <= 100.0:
        raise ValueError("cobertura_pct debe estar entre 0 y 100.")
    if record["biomasa_kg"] < 0.0:
        raise ValueError("biomasa_kg no puede ser negativa.")


def validate_records(records: Any) -> None:
    """Valida el arreglo completo (formato de data/vision.json)."""
    if not isinstance(records, list):
        raise ValueError("La salida debe ser un arreglo JSON de registros.")
    for rec in records:
        validate_record(rec)


def write_vision_json(records: Sequence[dict[str, Any]], path: str | Path) -> Path:
    """Escribe el arreglo JSON del contrato (UTF-8, con salto de línea final)."""
    validate_records(list(records))
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(list(records), ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    return out


def process_photo(photo: str | Path, cocha_id: str, results_dir: str | Path | None = None,
                  biomass_kg: float = 0.0, timestamp: str | None = None,
                  cfg: SegmentConfig = SegmentConfig()) -> tuple[dict[str, Any], SegmentationResult]:
    """Analiza una fotografía y, si se indica, guarda sus salidas visuales.

    Devuelve (registro del contrato, resultado completo).
    """
    photo = Path(photo)
    image = load_image(photo)
    result = segment_cushuro(image, cfg)
    record = build_record(cocha_id, photo.as_posix(), result.coverage_pct,
                          biomass_kg, timestamp)
    if results_dir is not None:
        out = Path(results_dir) / photo.stem
        _imwrite(out / "mascara.png", result.mask)
        _imwrite(out / "overlay.jpg", make_overlay(image, result))
        _imwrite(out / "contornos.jpg", make_contours(image, result))
        _imwrite(out / "comparativa.jpg", make_panel(image, result))
        metrics = {
            "foto": record["foto"],
            "cocha_id": record["cocha_id"],
            "timestamp": record["timestamp"],
            "biomasa_kg": record["biomasa_kg"],
            **result.metrics,
        }
        (out / "metrics.json").write_text(
            json.dumps(metrics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
    return record, result


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Segmenta colonias candidatas de cushuro en fotografías de cochas.",
        epilog="La cobertura es de píxeles candidatos; no es una medición validada.",
    )
    p.add_argument("images", nargs="+", help="Fotografías a analizar")
    p.add_argument(
        "--cocha-id", action="append", required=True,
        help="Identificador de la cocha. Uno para todas las fotos, o uno por foto "
             "(repetir la opción en el mismo orden).",
    )
    p.add_argument(
        "--biomasa-kg", type=float, default=0.0,
        help="Biomasa MEDIDA externamente (kg). 0.0 = marcador provisional.",
    )
    p.add_argument("--timestamp", default=None,
                   help="Fecha/hora ISO 8601 de la toma (por defecto, la hora actual).")
    p.add_argument("--output", default="data/vision.json",
                   help="Archivo JSON del contrato (por defecto data/vision.json)")
    p.add_argument("--results-dir", default="resultados",
                   help="Carpeta para máscaras, overlays y métricas")
    p.add_argument("--no-color-expansion", action="store_true",
                   help="Reporta solo las colonias verificadas por forma (más estricto)")
    p.add_argument("--r-min-frac", type=float, default=SegmentConfig.r_min_frac,
                   help="Radio mínimo de colonia como fracción del lado corto")
    p.add_argument("--r-max-frac", type=float, default=SegmentConfig.r_max_frac,
                   help="Radio máximo de colonia como fracción del lado corto")
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)
    ids = args.cocha_id
    if len(ids) == 1:
        ids = ids * len(args.images)
    if len(ids) != len(args.images):
        print("Error: indique un --cocha-id para todas las fotos o uno por foto.",
              file=sys.stderr)
        return 2
    if args.biomasa_kg < 0:
        print("Error: --biomasa-kg no puede ser negativa.", file=sys.stderr)
        return 2
    cfg = SegmentConfig(
        r_min_frac=args.r_min_frac, r_max_frac=args.r_max_frac,
        enable_color_expansion=not args.no_color_expansion,
    )

    records = []
    for photo, cocha_id in zip(args.images, ids):
        try:
            record, result = process_photo(photo, cocha_id, args.results_dir,
                                           args.biomasa_kg, args.timestamp, cfg)
        except (FileNotFoundError, ValueError) as exc:
            print(f"Error con {photo}: {exc}", file=sys.stderr)
            return 1
        records.append(record)
        m = result.metrics
        print(f"\n{photo}  ({cocha_id})")
        print(f"  cobertura candidata : {m['cobertura_pct']:.2f} %"
              f"  (forma {m['cobertura_forma_verificada_pct']:.2f} %"
              f" + color {m['cobertura_aceptada_por_color_pct']:.2f} %)")
        print(f"  colonias candidatas : {m['colonias_candidatas']}"
              f"  (forma {m['colonias_verificadas_por_forma']}"
              f" + color {m['colonias_aceptadas_por_color']})")
        for w in result.warnings:
            print(f"  AVISO: {w}")

    out = write_vision_json(records, args.output)
    print(f"\nJSON del contrato: {out}")
    print(f"Resultados visuales: {args.results_dir}/<foto>/")
    print("AVISO: cobertura de píxeles candidatos, no detección confirmada de cushuro.")
    print("AVISO: biomasa_kg es un dato externo; 0.0 es solo un marcador provisional.")
    return 0


if __name__ == "__main__":
    # Consolas de Windows antiguas no imprimen tildes con la codificación por defecto.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
