# Guion de grabación del gemelo (Pax)

Para el video de 30 s (`docs/HANAN_QOCHA_PROYECTO.md` §7). Tu bloque es el de **21–26 s**:

> *"…with a digital twin of each pond that **forecasts growth** and tells growers **when and how much to harvest**."*
> Imagen: curva moviéndose con los sliders y colonias marcadas por la visión.

Son 5 s de voz. Graba **tomas cortas por separado** (3–4 s cada una) y que Jefry las monte. No intentes hacerlo todo en una sola toma.

## Preparación (una vez)

1. **Fuente de datos**
   - Si ya hay datos reales en `data/processed/`, usa la app publicada **sin** `datos=demo`.
   - Si no, usa los datos de demostración (`datos=demo` en la URL); la interfaz no muestra avisos.
2. **Navegador:** Chrome a pantalla completa (**F11**), ventana de 1920×1080 y zoom del navegador al **110 %** (Ctrl +), para que el texto se lea en el video.
3. **Grabación:** OBS (captura de ventana) a 1080p y 60 fps, o la grabadora de Windows con **Win + Alt + R**.
4. **Cursor:** muévelo despacio y sin dudar. Ensaya cada toma 2 veces antes de grabar.

Todas las URL llevan `video=1` (modo presentación) y `lang=en` (el video va en inglés):

| Toma | URL |
|---|---|
| Mapa | https://apolo-unsa.github.io/hanan-qocha/?datos=demo&lang=en&video=1#/ |
| Gemelo (curva) | https://apolo-unsa.github.io/hanan-qocha/?datos=demo&lang=en&video=1#/cocha/QC-02 |
| Cosecha + visión | https://apolo-unsa.github.io/hanan-qocha/?datos=demo&lang=en&video=1#/cocha/QC-01 |

## Tomas

### Toma 1 · "forecasts growth" (3–4 s) — la principal
**URL:** Gemelo (curva), QC-02.
1. Desplázate hasta que se vean la **curva** y, debajo, **"What if…?"** y **"Recommended action"** en la misma pantalla.
2. **Graba.** Arrastra despacio el slider **Dissolved solids (TDS)** de ~30 a ~250 ppm (2 s).
   - La curva verde se aplana y el slider se pone rojo.
   - La acción pasa de *"Conditions are good… · Wait 9 days"* a la alerta roja *"Water has high dissolved solids…"* con *"Wait 5 weeks"*.
3. Vuelve a bajarlo a ~30 (1 s): la curva sube de nuevo.

> Para un movimiento más suave: haz clic en el slider y usa **← →** del teclado, manteniendo presionado.

### Toma 2 · "when and how much to harvest" (2 s)
**URL:** Cosecha + visión, QC-01.
1. Encuadra la curva (puntos naranjas de la cámara + línea recalibrada) y la tarjeta **"Recommended action"** con **"Harvest 30.9 kg"** y *"leave 30 %"*.
2. **Graba** quieto 2 s, o con un paneo lento hacia la acción.

### Toma 3 · "colonias marcadas por la visión" (2 s) — compartida con Victor
**URL:** Cosecha + visión, QC-01, tarjeta **Computer vision**.
1. **Graba** y haz clic en las miniaturas de izquierda a derecha (foto 1 → foto 8), una cada ~0,25 s: las colonias marcadas crecen.
2. Si Victor ya tiene una foto real marcada, esta toma la reemplaza o se intercala con ella.

### Toma extra · mapa (para el bloque 14–21 s de Paolo y Adrián, si la quieren)
**URL:** Mapa.
1. Mapa satelital a pantalla completa con las cochas coloreadas por aptitud.
2. **Graba** y haz clic en una cocha verde: la vista vuela hacia ella (1,6 s) y se abre su ficha.

## Después de grabar
- Pásale los clips a Jefry con el nombre de la toma (`pax-1-curva.mp4`, etc.).
- Si usaste la demo, avísale para que el video o el pitch lo mencione ("prototype with simulated data").

## Tomas grabadas automáticamente

`twin/scripts/grabar-tomas.mjs` graba las tomas como **MP4 1920×1080 a 30 fps**, con un cursor visible que usa la app
(filtros, pines, sliders, miniaturas, prioridades). La del celular sale vertical (780×1608).

```bash
node twin/scripts/grabar-tomas.mjs ../tomas-gemelo/en en     # app publicada, en inglés (para el video)
node twin/scripts/grabar-tomas.mjs ../tomas-gemelo/es es     # en español
node twin/scripts/montaje.mjs ../tomas-gemelo/en en          # video de presentación ya editado
```

| Toma | Qué se ve |
|---|---|
| `extra-mapa-vuelo.mp4` | Caen los pines, filtros (aptas / no aptas), resaltado lista ↔ pin, vuelo a la Cocha 01 |
| `extra-ficha.mp4` | Anillo del IAC, ruta de cultivo, lectura del sensor e historial de 48 h |
| `pax-3-colonias.mp4` | La serie de fotos con colonias marcadas |
| `pax-1-curva.mp4` | El cursor recorre la curva y el slider de TDS la cambia |
| `pax-2-cosecha.mp4` | La curva se dibuja y la acción "Cosechar 30,9 kg" |
| `extra-comparador.mp4` | Prioridades que reordenan las estrategias, sequía y una cocha no apta |
| `extra-movil.mp4` | La ficha en el celular, de arriba abajo |

`presentacion-gemelo-<idioma>.mp4` (~1:45, sin audio) monta todo con portada, laptop y celular, textos, transiciones y
cierre; `escenas-<idioma>/` tiene cada escena suelta para recortar. Para el bloque de 5 s del video de 30 s sirven
`escenas-en/04-curva.mp4` y `escenas-en/03-colonias.mp4`, o las tomas en bruto `pax-*`.
