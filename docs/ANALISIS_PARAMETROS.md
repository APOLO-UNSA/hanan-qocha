# Análisis integral de parámetros del cushuro y de sus fuentes de datos

> Fecha: 14 nov 2026 · Solo lo marcado **[obtenido]** se descargó y probó hoy; lo demás es plan.
> Los rangos del modelo (`twin/src/model.ts`) son **supuestos**, no valores de la literatura (así lo declara el código).

## 1. Parámetros del modelo y su respaldo

| Parámetro | Rango del modelo (óptimo / tolerable) | Fuente real | Estado | ¿Clave o token? |
|---|---|---|---|---|
| Temperatura del agua | 8–15 °C / 0–25 °C | Qocha Ñawi (DS18B20); POWER `T2M` y `TS` como contexto regional | **[obtenido]** POWER (aire ~7,5 °C y suelo ~11 °C en nov 2025) | No |
| UV | 6–11 / 0–16 | Qocha Ñawi (LTR390); POWER `ALLSKY_SFC_UV_INDEX` | **[obtenido]** pero es promedio DIARIO (~3,4), no pico; válido solo hasta fines de ago 2026 | No (OMI UV: Earthdata) |
| TDS | 0–100 / 0–300 ppm | Solo in situ (Qocha Ñawi). **Ningún satélite lo mide.** | Simulado hasta tener sensor | — |
| Profundidad | 0,2–0,6 / 0,05–1,5 m | Solo in situ | Simulado | — |
| pH | (solo recomendaciones) | Solo in situ | Simulado | — |
| Altitud | 3 000–5 000 m (plan §3) | **SRTM 30 m (NASA)** vía OpenTopoData | **[obtenido]** 4 295–4 325 m en las candidatas | No |
| Pendiente | acumulación de agua | SRTM (4 vecinos a 60 m) | **[obtenido]** | No |
| Agua superficial / tamaño | cocha existente | **Sentinel-2 L2A** (ESA, 10 m): NDWI y MNDWI | **[obtenido]** 6 cochas candidatas | No |
| Vegetación del bofedal | anillo de la cocha | Sentinel-2 NDVI | **[obtenido]** | No |
| Lluvia | temporada de lluvias | POWER `PRECTOTCORR` | **[obtenido]** 3,2 mm/día en nov 2026 | No |
| Humedad del suelo | estrategias §4.4 | POWER `GWETTOP` (reanálisis) como sustituto de SMAP | **[obtenido]** (~0,28–0,34) | No. **SMAP real: Earthdata** |
| Radiación solar | luz | POWER `ALLSKY_SFC_SW_DWN` | **[obtenido]** | No |

**Alerta de coherencia:** una búsqueda rápida de literatura sobre *Nostoc* (otras especies) da óptimos de crecimiento de **15–25 °C**
(*N. commune*, *N. spongiaeforme*, *N. sphaeroides* en cultivo), y ninguna fuente que hallé trae el óptimo de *N. sphaericum* silvestre.
El modelo usa **8–15 °C**. Hay que justificar ese rango con una fuente específica del cushuro (Corpus-Gomez et al. 2021, la revisión
principal) o declararlo explícitamente como supuesto. No lo confirmé.

## 2. Fuentes proporcionadas: qué sí se obtuvo y qué pide cuenta

| Fuente (docs/RECURSOS.md) | Acceso probado hoy | Qué falta |
|---|---|---|
| **NASA POWER** | Datos reales descargados sin clave (`satellite/power_clima.py`) | Nada |
| **SRTM / NASADEM** | SRTM sí (OpenTopoData, sin clave). NASADEM no está en esa API. | NASADEM oficial: Earthdata (AppEEARS) |
| **Sentinel-2 (Copernicus)** | Sí, vía STAC Earth Search + COG en AWS, sin cuenta | Cuenta Copernicus solo para su navegador |
| **HLS (Landsat+S2, NASA)** | Metadatos sí (CMR). **Descarga: no probada** | **Token Earthdata** |
| **AppEEARS** | Catálogo público (HTTP 200); crear tareas devuelve **403** | **Cuenta/token Earthdata** |
| **SMAP, GPM IMERG, OMI UV, ECOSTRESS, MODIS LST** | Catálogos en CMR visibles | **Token Earthdata** (GES DISC y LP DAAC) |
| **Giovanni** | Portal responde | Inicio de sesión Earthdata |
| **Worldview / GIBS** | WMTS responde sin clave | Nada (solo imágenes) |

## 3. Qué necesito de ustedes
1. **Token Earthdata** (cuenta en <https://urs.earthdata.nasa.gov> → perfil → *Generate Token*). Con él automatizo HLS, SMAP, GPM, ECOSTRESS y MODIS LST. No lo pongan en el repo ni me lo peguen en el chat; guárdenlo como variable de entorno `EARTHDATA_TOKEN`.
2. Que Adrián confirme las coordenadas reales de las cochas (las del simulador `SAB-0x` son de ejemplo).
3. Confirmar el rango de temperatura óptima del cushuro con su fuente.

## 4. Procesamiento de imágenes de cuerpos de agua

- **Satélite** (`satellite/detectar_cochas.py`): NDWI > 0,05 y MNDWI > 0 y NIR < 0,12, con máscara de nubes (SCL). **[obtenido]** Escena S2B 2026-10-30, 1 % de nubes, 11 cuerpos de agua; excluí un embalse de 233 ha. Quedan 6 candidatas de 0,12 a 3,6 ha. `indice_satelital_prelim` es un promedio de aptitudes **supuesto**.
- **Cámara** (Pax, `twin/scripts/marcar-fotos.py`): Hough + HSV con OpenCV sobre fotos de cámara fija. Es una simulación para la demo (fotos generadas con IA); no se evaluó con colonias reales, así que no hay precisión que reportar.
- **Límites:** una sola fecha no distingue cochas permanentes de charcos; con 10–11 m por píxel las colonias de 1–4 cm no se ven desde el satélite (solo la cocha).
