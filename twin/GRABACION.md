# Video del gemelo: tomas, montaje y guía de edición (Pax → Jefry)

Para el video de 30 s (`docs/HANAN_QOCHA_PROYECTO.md` §7). El bloque del gemelo es el de **21–26 s**:

> *"…with a digital twin of each pond that **forecasts growth** and tells growers **when and how much to harvest**."*
> Imagen: curva moviéndose con los sliders y colonias marcadas por la visión.

Las tomas ya están grabadas y editadas; no hace falta grabar a mano.

## 1. Qué hay y dónde

Los videos **no están en el repo** (pesan ~150 MB). Pax los comparte aparte, en la carpeta `tomas-gemelo/`:

```
tomas-gemelo/
  en/                                   ← para el video (en inglés)
    presentacion-gemelo-en.mp4          video completo ya editado (1:45, 1080p 30 fps, sin audio)
    escenas-en/00-portada.mp4 … 08-cierre.mp4   cada escena del montaje, suelta
    pax-1-curva.mp4, pax-2-cosecha.mp4, pax-3-colonias.mp4, extra-*.mp4   tomas en bruto (pantalla completa)
    capturas/                           imágenes 4K en inglés
  es/                                   lo mismo en español (pitch, redes)
```

Las imágenes 4K en español para las diapositivas sí están en el repo: [`twin/capturas/`](capturas/LEEME.md).

- **Escenas** (`escenas-en/`): la app dentro de una laptop o un celular, con título y textos animados. Para un video
  "de producto" o el pitch.
- **Tomas en bruto**: la app a pantalla completa, sin textos. Para cortes rápidos con la voz del video de 30 s.
- Ninguno tiene audio. El texto de cada escena ya está en pantalla; si la voz dice lo mismo, se refuerzan.

## 2. Cortes sugeridos para el video de 30 s

Tiempos dentro de cada archivo (aproximados, ±0,5 s):

| Segundo del video | Voz | Archivo | Tramo |
|---|---|---|---|
| 14–17 s (bloque de Paolo y Adrián) | *"…NASA satellite data…"* | `escenas-en/01-mapa.mp4` | 0,5–3,5 s (caen los pines) o 13–18 s (vuelo a la cocha) |
| **21–23 s** | *"…a digital twin of each pond that forecasts growth…"* | `escenas-en/04-curva.mp4` | **3,5–6,5 s**: el slider de TDS sube, la curva se aplana y la acción se pone roja |
| **23–24,5 s** | *"…and tells growers when…"* | `escenas-en/03-colonias.mp4` | **1–3 s**: las fotos pasan y las colonias marcadas crecen |
| **24,5–26 s** | *"…and how much to harvest."* | `escenas-en/05-cosecha.mp4` | **4–5,5 s**: el cursor llega a "Harvest 30.9 kg" |

Si se prefiere sin marco ni textos, los mismos momentos están en las tomas en bruto `pax-1-curva`, `pax-3-colonias` y
`pax-2-cosecha` (empiezan ~0,4 s antes que las escenas).

### Con el nuevo enfoque *Adapting Farms with NASA Data*

El plan nuevo (§1.1 y §4.4) pone el **comparador de estrategias de la finca** en el centro. Si el guion cambia, la toma es:

| Voz sugerida | Archivo | Tramo |
|---|---|---|
| *"…and compares farm strategies with NASA data: if water matters, or income, the advice adapts."* | `escenas-en/06-comparador.mp4` | 2–7 s: el productor cambia sus prioridades y las estrategias se reordenan |
| *"…and when a pond is not suitable, cushuro is ruled out."* | `escenas-en/06-comparador.mp4` | 15–20 s: Cocha 10, "Not recommended for this farm" |

## 3. Escenas del montaje completo (`presentacion-gemelo-en.mp4`)

| Escena | Duración | Qué se ve | Texto en pantalla |
|---|---|---|---|
| 00 portada | 4 s | Logo y nombre | Qocha Twin, *A digital twin for high-Andean cushuro ponds* |
| 01 mapa | 20 s | Pines, filtros, lista ↔ pin, cuerpos de agua detectados por satélite, vuelo a la Cocha 01 | Where? Every pond scored for cushuro |
| 02 ficha | 12 s | Anillo del IAC, ruta de cultivo, sensor e historial de 48 h | How is the water? |
| 03 colonias | 11 s | Serie de fotos con colonias marcadas | How much is there? |
| 04 curva | 12 s | Tooltip sobre la curva y slider de TDS | When to harvest? |
| 05 cosecha | 7 s | La curva se dibuja y "Harvest 30.9 kg" | How much to harvest? |
| 06 comparador | 22 s | Prioridades, sequía, Cocha 10 no apta | What suits the farm? |
| 07 celular | 16 s | La ficha en el celular | In the field |
| 08 cierre | 5 s | Lema y enlace | From the wetland to the table |

Entre escenas hay transiciones de 0,7 s (ya incluidas en el video completo, no en las escenas sueltas).

## 4. Datos que se ven

- Las 12 cochas, sus fotos y lecturas son **ficticias** (conjunto de demostración). Las lecturas del sensor salen del
  simulador de Paolo (`device/simulacion/simulador.py`). Si el video lo requiere, decir *"prototype with simulated data"*.
- **Son reales**: los cuerpos de agua detectados con Sentinel-2, y SMAP, ECOSTRESS y NASA POWER en el mapa y el comparador
  (`satellite/datos/`, resumidos por `twin/scripts/gen-nasa.mjs`).

## 5. Volver a generarlo (si cambia la app)

Necesita Node ≥ 22, Chrome y ffmpeg. Usa la app publicada:

```bash
node twin/scripts/grabar-tomas.mjs ../tomas-gemelo/en en     # tomas en bruto (~4 min)
node twin/scripts/montaje.mjs ../tomas-gemelo/en en          # escenas + video completo (~6 min)
node twin/scripts/capturas.mjs ../tomas-gemelo/en/capturas en
```

Para grabar una sola toma: `TOMAS=extra-comparador node twin/scripts/grabar-tomas.mjs ../tomas-gemelo/en en`.

## 6. Grabar a mano (solo si hiciera falta)

Chrome a pantalla completa (F11), 1920×1080, zoom 110 %, OBS a 1080p. URLs (modo presentación, en inglés):

| Toma | URL |
|---|---|
| Mapa | https://apolo-unsa.github.io/hanan-qocha/?lang=en&video=1#/ |
| Curva (QC-02) | https://apolo-unsa.github.io/hanan-qocha/?lang=en&video=1#/cocha/QC-02 |
| Cosecha y visión (QC-01) | https://apolo-unsa.github.io/hanan-qocha/?lang=en&video=1#/cocha/QC-01 |
| Comparador | https://apolo-unsa.github.io/hanan-qocha/?lang=en&video=1#/finca/QC-01 |
