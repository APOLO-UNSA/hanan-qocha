# Integración con el gemelo (Qocha Twin)

> **Para todo el equipo.** El gemelo ya está funcionando y publicado. Solo necesita **sus archivos JSON** para mostrar datos reales.
> Escrito por Pax · sábado 14/11. **Fecha límite: M2, sábado 20:00.**

- **App publicada:** https://apolo-unsa.github.io/hanan-qocha/
- **Demo con datos ficticios** (12 cochas, para ver cómo se verá lo de ustedes): https://apolo-unsa.github.io/hanan-qocha/?datos=demo
- **En inglés:** agregar `&lang=en` a la URL.

## Cómo funciona

El gemelo **solo lee archivos** con el formato de `data/contracts/*.schema.json`. Nadie tiene que tocar `twin/`.

| Archivo | Lo produce | Va en |
|---|---|---|
| `sensor.json` | Paolo | `data/live/` (en vivo) y `data/processed/` (para publicar) |
| `sites.json` | Adrián | `data/processed/` |
| `vision.json` + fotos | Victor | `data/processed/` y `data/processed/fotos/` |
| `recommendations.json` | Ortega | `data/processed/` |

Si su archivo está en `data/processed/`, el gemelo lo usa **en lugar del mock**, sin cambiar código. Si falta, sigue mostrando el mock.

**Reglas para todos**

1. **`cocha_id` debe coincidir en los cuatro archivos.** Así se une el sensor, la visión y el satélite de una misma cocha. Propuesta: `SAB-01`, `SAB-02`… Adrián define la lista en `sites.json` y los demás usan esos códigos.
2. **Fechas** en ISO con zona horaria de Perú: `2026-11-14T10:00:00-05:00`.
3. **Nada de campos extra.** El contrato no los permite y el CI falla. Si necesitan un campo nuevo, pídanselo a Pax (los contratos los aprueba Pax).
4. Suban un **primer archivo aunque sea parcial**, ya. Así el CI valida el formato temprano y no a las 19:55.

## Ver sus datos en el gemelo (en su computadora)

```bash
git pull
cd twin
npm install          # solo la primera vez (Node 20.19 o superior; mejor 22)
npm run dev          # abrir http://localhost:5173/hanan-qocha/
```

Para validar el formato antes del PR (lo mismo que hace el CI):

```bash
pip install check-jsonschema
bash scripts/validate_data.sh
```

---

## Paolo · sensor Qocha Ñawi

- **Entrega:** el puente (`device/bridge/`) escribe **`data/live/sensor.json`** con cada lectura nueva. `data/live/` está en `.gitignore`: es solo para la demo en vivo.
- **Formato:** una lista; el gemelo toma la lectura más reciente de cada cocha.

```json
[
  { "cocha_id": "SAB-01", "timestamp": "2026-11-14T15:30:00-05:00", "tds_ppm": 42, "temp_agua_c": 9.5, "ph": 7.1, "uv_index": 11 }
]
```

- `ph` y `uv_index` son **opcionales**: si no hay sensor, se omite el campo (no poner `null`).
- **Probar en vivo:** `cd twin`, luego `VITE_DATA_SOURCE=live npm run dev` (en PowerShell: `$env:VITE_DATA_SOURCE='live'; npm run dev`). La ficha de la cocha se actualiza cada 10 s con el indicador **● EN VIVO**.
- **Recomendación:** escribir a un archivo temporal y luego renombrarlo, para que el gemelo nunca lea un JSON a medio escribir.
- Cuando tengas una tanda buena de lecturas, cópiala a **`data/processed/sensor.json`** y abre un PR para que salga en la app publicada.

## Adrián · satélite

- **Entrega:** **`data/processed/sites.json`** con las cochas candidatas reales de Salinas y Aguada Blanca.

```json
[
  { "cocha_id": "SAB-01", "nombre": "Cocha Chalhuanca 1", "lat": -15.781, "lon": -71.334, "altitud_m": 4385, "indice_satelital": 0.84 }
]
```

- `indice_satelital` **entre 0 y 1** (el contrato todavía no lo limita, pero el IAC lo asume).
- `lat`/`lon` en grados decimales (WGS84), con **3 o más decimales** para que caigan sobre la cocha en el mapa satelital.
- Tú defines los `cocha_id`: pásale la lista a Paolo y a Victor.

## Victor · visión artificial

- **Entrega:** **`data/processed/vision.json`** + las fotos en **`data/processed/fotos/`**.
- **La foto debe ir ya marcada** (contornos de las colonias dibujados encima). El gemelo la muestra tal cual en "Visión artificial · colonias marcadas".
- En `foto` va la ruta **`data/fotos/<archivo>`** (sin `processed/`):

```json
[
  { "cocha_id": "SAB-01", "timestamp": "2026-11-14T10:00:00-05:00", "foto": "data/fotos/SAB-01-2026-11-14.jpg", "cobertura_pct": 38.5, "biomasa_kg": 12.4 }
]
```

- Fotos en **JPG o PNG, máximo ~1600 px** de ancho y menos de 500 KB cada una (van al repo).
- **Varias fotos por cocha en el tiempo = mejor.** Con 2 o más, el gemelo **recalibra el modelo de crecimiento** con lo medido y lo muestra en la curva. Es el "cierre del ciclo" del pitch.
- `biomasa_kg / (cobertura_pct / 100)` se usa como capacidad de la cocha: que ambos valores sean coherentes.

## Ortega · recomendaciones

- **Entrega:** **`data/processed/recommendations.json`** con mensajes en lenguaje del productor, **en español y en inglés** (el video va en inglés).

```json
[
  { "codigo": "TDS_ALTO", "condicion": "tds_ppm > 150", "mensaje_es": "El agua tiene muchos sólidos disueltos; evita cosechar aquí por ahora.", "mensaje_en": "Water has high dissolved solids; avoid harvesting here for now." },
  { "codigo": "OK", "condicion": "tds_ppm <= 150", "mensaje_es": "Las condiciones son buenas para el cushuro.", "mensaje_en": "Conditions are good for cushuro." }
]
```

- **`condicion`** admite comparaciones simples (`<`, `<=`, `>`, `>=`, `==`, `!=`) unidas con `&&`, por ejemplo `temp_agua_c > 17 && uv_index > 12`.
- Variables disponibles: `tds_ppm`, `temp_agua_c`, `uv_index`, `profundidad_m`, `biomasa_kg`, `capacidad_kg`, `biomasa_pct`.
  (`ph` todavía no: si lo necesitas, avisa a Pax.)
- El código **`OK`** es especial: se muestra solo cuando no hay ninguna alerta.
- Hay ejemplos de redacción en `twin/public/demo/recommendations.json`.

## Jefry · coordinación

1. **`deploy.yml`:** para que las fotos de Victor salgan en la app publicada, agregar esta línea después de las dos `cp` de "Copiar datos al sitio":
   ```bash
   cp -r data/processed/fotos twin/dist/data/ 2>/dev/null || true
   ```
2. **Node en `ci.yml` y `deploy.yml`:** cambiar `node-version: '20'` por `'22'`. Node 20 ya no tiene soporte y GitHub muestra el aviso en cada ejecución.
3. **Fórmula del documento (§4.3):** `biomasa·(1 + tasa)·(1 − biomasa/capacidad)` hace que la biomasa **disminuya**. La forma logística correcta, que es la que usa el gemelo, es `biomasa + tasa·biomasa·(1 − biomasa/capacidad)`.
4. **README / documento:** agregar el enlace a la app publicada y reemplazar los `@usuario-*` de `.github/CODEOWNERS` por los usuarios reales.
5. **Para el video (M3):** grabar desde `?datos=demo` si faltan datos reales, y con `&lang=en`. Si se usa la demo, decirlo: la app muestra el aviso "datos de demostración".

---

¿Dudas sobre el formato o necesitan un campo nuevo? Hablen con **Pax** antes de cambiar un contrato.
