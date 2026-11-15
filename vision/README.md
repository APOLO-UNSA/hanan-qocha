# Hanan Qocha · Módulo de visión

Segmenta **colonias candidatas de cushuro** (*Nostoc sphaericum*) en fotografías
tomadas en cochas altoandinas y publica la cobertura para el gemelo digital
**Qocha Twin**.

> **Estado: experimental, no validado.** `cobertura_pct` es el porcentaje de
> píxeles candidatos según el algoritmo. No es una medición biológica ni una
> detección confirmada: todavía no existen máscaras de referencia etiquetadas a
> mano, así que **no se conoce la precisión real** y no se reporta
> precisión/recall/F1. `biomasa_kg` vale `0.0` como marcador provisional.

## Uso rápido (terminal de VS Code, PowerShell)

Desde la raíz del proyecto:

```powershell
py -m pip install -r vision/requirements.txt
py vision/segment.py fotos/cushuro2.jpg fotos/cushuro3.jpg --cocha-id COCHA-01 --cocha-id COCHA-02
py -m pytest vision -v
```

(En Linux/macOS use `python3` en lugar de `py`.)

Las fotografías no están en el repositorio. Las pruebas que las usan las buscan
en `fotos/` o en la carpeta indicada por la variable de entorno
`HANAN_QOCHA_FOTOS`; si no las encuentran se omiten. En el CI corren las
pruebas de mecánica, incluida una con discos sintéticos.

Opciones principales de `segment.py`:

| Opción | Para qué sirve |
|---|---|
| `--cocha-id` | Uno para todas las fotos, o uno por foto en el mismo orden. |
| `--timestamp` | Fecha/hora ISO 8601 **de la toma**. Si se omite se usa la hora de procesamiento. |
| `--output` | JSON del contrato. Por defecto `data/vision.json`, que el gemelo **no** lee (ver "Publicar en Qocha Twin"). |
| `--results-dir` | Carpeta de salidas visuales. Por defecto `resultados/`. |
| `--biomasa-kg` | Biomasa **medida externamente**. Por defecto `0.0`. |
| `--no-color-expansion` | Reporta solo las colonias verificadas por forma (más estricto). |
| `--r-min-frac`, `--r-max-frac` | Radio esperado de una colonia, como fracción del lado corto de la foto. |

## Qué genera

```
resultados/<foto>/
    mascara.png       máscara binaria (255 = candidato), tamaño de la foto
    overlay.jpg       foto con las regiones teñidas
    contornos.jpg     foto con los contornos
    comparativa.jpg   mosaico original | máscara | overlay | contornos
    metrics.json      métricas, advertencias, parámetros y lista de colonias
data/vision.json      arreglo JSON del contrato de Qocha Twin
```

Colores: **magenta** = colonia verificada por forma; **cian** = candidata de
contorno incompleto aceptada por color.

### Contrato JSON

`data/vision.json` contiene exactamente los cinco campos del contrato
(`data/contracts/vision.schema.json` en el repositorio), sin añadir ninguno:

```json
[
  {
    "cocha_id": "COCHA-01",
    "timestamp": "2026-11-14T15:25:59-05:00",
    "foto": "fotos/cushuro2.jpg",
    "cobertura_pct": 12.5,
    "biomasa_kg": 0.0
  }
]
```

Todo lo demás (advertencias, desglose, colonias) va a `metrics.json`, que **no**
forma parte del contrato.

## Cómo funciona

Un umbral de color no sirve: cushuro, sedimento, algas y barro comparten tonos
verde-amarillo-marrón (el prototipo HSV anterior marcaba el 68,8 % de
`cushuro3.jpg`). Lo que distingue a una colonia es su **geometría**: una esfera
lisa, de borde cerrado y tamaño acotado.

| Etapa | Qué hace |
|---|---|
| **A. Preprocesado** | Filtro bilateral; detección de brillos especulares (top-hat de V + baja saturación) y relleno por *inpainting*; conversión a CIELAB; gradiente de color en L, a y b; umbral de borde adaptado al contraste de la foto. |
| **1. Forma** | Desde una rejilla de semillas en zonas lisas se lanzan 32 rayos. Se busca un radio en el que casi todos los rayos crucen un borde tangente (contorno cerrado) y el interior no tenga bordes (superficie lisa). Se ajusta una elipse al contorno y se exige: residuo pequeño, poca excentricidad, sin huecos angulares grandes, tamaño dentro de rango y color plausible. Se eliminan duplicados. |
| **2. Color aprendido** | Con las colonias verificadas se construye un histograma a\*b\* **de esa misma foto** y se compara con el de la imagen completa. Una candidata redonda pero de contorno incompleto se acepta solo si su color es característico de las colonias y está cerca de alguna verificada. |
| **Contexto** | Reglas simples para estimar reflejos, sombra, vegetación, roca y sedimento. Solo se usa para advertencias. |

La compuerta de color es deliberadamente amplia: solo descarta lo que no puede
ser cushuro (gris, azul, blanco, negro, gris-verdoso de baja croma). La decisión
la toma la forma. Técnicas descartadas tras probarlas con las dos fotos:
umbral HSV, círculos de Hough (detecta los reflejos, no las esferas), watershed
sobre gradiente, K-means de color+textura y simetría radial.

## Resultados con las dos fotografías de referencia

| Foto | `cobertura_pct` | Por forma | Por color | Colonias (forma + color) |
|---|---|---|---|---|
| `cushuro2.jpg` | 12,50 % | 3,13 % | 9,38 % | 195 (50 + 145) |
| `cushuro3.jpg` | 4,19 % | 0,76 % | 3,43 % | 38 (12 + 26) |

Lo que sigue es una **revisión visual** de los overlays, no una evaluación
cuantitativa.

**`cushuro2.jpg` (colonias sumergidas, sedimento, reflejo).**
- Identifica bien: las esferas verde-oliva y ámbar de la franja central y del
  grupo superior derecho. Las plantas acuáticas y casi todo el sedimento quedan
  fuera.
- Falsos positivos: algunos parches redondeados de sedimento o alga del mismo
  color que las colonias ámbar (unas pocas elipses, las más visibles arriba a la
  izquierda y a la derecha del centro).
- Falsos negativos (dominan): todo el tercio izquierdo bajo el reflejo del sol
  (el 23 % de la imagen se marca como reflejo y ahí no se detecta nada, aunque
  se ven colonias); colonias gris-verdosas poco saturadas; colonias pequeñas o
  semicubiertas por sedimento. **La cobertura real visible es mayor que la
  reportada.**

**`cushuro3.jpg` (colonias sobre roca, pasto, poca profundidad de campo).**
- Identifica bien: el racimo ámbar central y la colonia aislada sobre la roca
  de la derecha. Roca, guijarros y pasto quedan fuera.
- Falsos positivos probables: dos elipses sobre barro oscuro a la izquierda del
  racimo y varias pequeñas entre el pasto y los botones amarillos.
- Falsos negativos: colonias cortadas por el borde inferior, una pequeña sobre
  la roca, parte de algunas esferas del racimo (la elipse cubre menos que la
  esfera) y la masa oscura y burbujeante de abajo a la izquierda, que **no se
  puede decidir a simple vista** si es cushuro oscuro o barro.
- Solo 12 colonias se verifican por forma; el 82 % de la cobertura viene de la
  etapa de color y el programa lo advierte.

**Fotografía más difícil: `cushuro2.jpg`.** El sedimento tiene el mismo color
que parte de las colonias, un tercio de la imagen está velado por el reflejo y
hay cientos de colonias pequeñas parcialmente tapadas. `cushuro3.jpg` tiene
pocas colonias y un color muy distintivo, pero sus esferas no son elípticas
(gotas pegadas entre sí) y la forma sola verifica pocas.

### Parámetros que más conviene ajustar (`SegmentConfig`)

| Parámetro | Efecto |
|---|---|
| `r_min_frac`, `r_max_frac` | Tamaño de colonia. **Depende de la distancia de la cámara**; es el primero que hay que revisar con fotos nuevas. |
| `strong_support`, `strong_quality` | Exigencia para "verificada por forma". Subirlos reduce falsos positivos y semillas. |
| `color_like_min` | Exigencia de la etapa de color (0,5 = sin evidencia; 1 = color exclusivo). |
| `gate_lowc_chroma`, `gate_lowc_hue_max` | Separan colonias poco saturadas de roca/guijarros. Ajustados con solo dos fotos. |
| `glare_l_min`, `glare_c_max`, `spec_*` | Qué se considera reflejo o brillo. |
| `tau_factor`, `tau_min`, `tau_max` | Sensibilidad a bordes. |

## Limitaciones

1. **Sin validación.** Dos fotografías y ninguna máscara de referencia. Los
   umbrales están ajustados a ojo sobre esas mismas dos fotos, así que el
   comportamiento con fotos nuevas es desconocido.
2. **Escala desconocida.** No hay referencia métrica en la imagen: el tamaño de
   colonia se asume como fracción del encuadre.
3. **Solo colonias esféricas individuales y visibles.** No detecta colonias
   bajo reflejo, en sombra, muy tapadas, aplastadas, en tapiz continuo ni
   cortadas por el borde.
4. **La cobertura es de la fotografía, no de la cocha.** Extrapolar a la cocha
   exige un diseño de muestreo.
5. **No identifica la especie.** Cualquier objeto redondo, liso y de color
   oliva-ámbar puede pasar (burbujas de barro, frutos, huevos de anfibio).
6. `timestamp` es la hora de procesamiento salvo que se pase `--timestamp`; no
   se lee EXIF.

## Qué falta para una detección confiable

1. **Máscaras de referencia**: etiquetar a mano 30–50 fotos variadas (luz,
   profundidad, cochas, también fotos sin cushuro). Con ellas
   `calibration.py evaluar` da precisión, recall, F1 e IoU reales.
2. **Protocolo de toma**: cámara perpendicular, altura fija, sombra sobre el
   agua o filtro polarizador para eliminar el reflejo, y un cuadrante o regla
   de referencia en el encuadre.
3. **Calibración de biomasa**: cuadrante fijo, foto, cosecha y pesado del
   cushuro de ese cuadrante, al menos 8 pares cubriendo todo el rango de
   cobertura. Luego `calibration.py ajustar-biomasa`.
4. **Modelo aprendido** (segmentación de instancias) cuando haya etiquetas
   suficientes; este módulo puede servir para pre-etiquetar.
5. **Confirmación en campo o laboratorio** de que lo detectado es *Nostoc*.

## `calibration.py`

No contiene datos ni coeficientes, solo las herramientas para cuando existan:

```powershell
py vision/calibration.py evaluar --pred resultados/cushuro2/mascara.png --ref etiquetas/cushuro2_ref.png
py vision/calibration.py ajustar-biomasa --csv data/mediciones_biomasa.csv --out data/calibracion_biomasa.json
py vision/calibration.py estimar --cobertura 12.5 --calibracion data/calibracion_biomasa.json
py vision/calibration.py color --foto fotos/cushuro2.jpg --mascara etiquetas/cushuro2_ref.png
```

`estimate_biomass()` se niega a estimar sin calibración y no extrapola fuera
del rango medido.

## Supuestos documentados

- `COCHA-01` y `COCHA-02` son identificadores provisionales: no se sabe a qué
  cocha pertenece cada foto.
- Solo se usaron dos fotografías de campo (`cushuro2.jpg`, `cushuro3.jpg`)
  para desarrollar y evaluar. No se publican en el repositorio.
- El validador interno rechaza campos fuera del contrato, igual que el esquema
  (`additionalProperties: false`). Una prueba comprueba que ambos coinciden.

## Publicar en Qocha Twin

Por defecto este módulo **no cambia lo que muestra el gemelo**: escribe en
`data/vision.json` y `resultados/`, que el gemelo no lee. Publicar es un paso
explícito, según `docs/INTEGRACION_GEMELO.md`:

1. `cocha_id` debe ser uno de los definidos en `sites.json` (`SAB-01`, …).
2. Copiar la foto **ya marcada** (`resultados/<foto>/contornos.jpg`) a
   `data/processed/fotos/`, con menos de ~1600 px de ancho y de 500 KB.
3. Generar el JSON con `--output data/processed/vision.json` y poner en `foto`
   la ruta `data/fotos/<archivo>` (sin `processed/`).
4. Validar con `bash scripts/validate_data.sh`.

**Antes de publicar hay que resolver la biomasa.** El gemelo calcula la
capacidad de la cocha como `biomasa_kg / (cobertura_pct / 100)`. Con el
marcador provisional `biomasa_kg = 0.0` esa capacidad sería 0, así que un
registro de este módulo no debe ir a `data/processed/` hasta tener una biomasa
medida (`--biomasa-kg`) o una calibración experimental (`calibration.py`).
Además, `data/processed/` está reservado a datos reales validados y este
resultado todavía no lo es.
