# Qocha Twin (`twin/`)

App web del gemelo digital. Vite + TypeScript, sin framework; mapa con Leaflet.

```bash
cd twin
npm install
npm run dev        # http://localhost:5173/hanan-qocha/
npm test           # pruebas del modelo y de la carga de datos (vitest)
npm run build      # corre las pruebas y genera dist/ (lo publica deploy.yml en GitHub Pages)
```

## Datos

La app solo lee `data/<nombre>.json` (`sites`, `sensor`, `vision`, `recommendations`).

- **Desarrollo:** Vite los sirve desde la carpeta `data/` del repo según `VITE_DATA_SOURCE`
  (en un `.env.local` o en la línea de comandos):
  - `processed` (por defecto): `data/processed` y, si falta el archivo, `data/mock`
  - `live`: `data/live` → `processed` → `mock`; refresca cada 10 s (`VITE_POLL_MS`).
    En la ficha de la cocha se actualizan sensor, IAC, curva y acciones sin reiniciar
    los sliders que el productor haya movido ("Volver a la lectura real" los reengancha).
  - `mock`: solo `data/mock`
- **Producción:** `deploy.yml` copia `data/mock` y encima `data/processed` a `dist/data/`.

Si un archivo **falta**, la app lo trata como vacío. Si **falla** al cargar (JSON a medio escribir, red), conserva los datos
anteriores. Los registros que no cumplen el contrato se descartan con un aviso en la consola.

## Pantallas

1. **Mapa** (`#/`): cochas coloreadas por IAC.
2. **Ruta de cultivo** y 3. **Gemelo** (`#/cocha/<id>`): lectura del sensor, foto de visión,
   curva proyectada vs. real, sliders "¿qué pasa si…?" y acción recomendada.

## Modelo (`src/model.ts`)

- Aptitud trapezoidal por variable (T, UV, TDS, profundidad) y `tasa = r_max · Πf`.
- Crecimiento logístico discreto `b + r·b·(1 − b/K)`; `K` se estima con `biomasa_kg / cobertura`.
- `IAC = 0,4·satélite + 0,4·in situ + 0,2·visión`; si falta una fuente, su peso se reparte.
- **Recalibración (cierra el ciclo):** con ≥ 2 fotos de visión se ajusta un factor α sobre la tasa
  (0,05–3) que minimiza el error entre lo proyectado y lo medido; curva, "esperar N semanas" y cosecha usan esa tasa.
- `recommendations.json`: la `condicion` admite comparaciones simples unidas con `&&`
  (variables: `tds_ppm`, `temp_agua_c`, `ph`, `uv_index`, `profundidad_m`, `biomasa_kg`, `capacidad_kg`, `biomasa_pct`).

Los rangos y parámetros en `RANGES` / `PARAMS` son **supuestos del modelo**.

## Modo demo

El sitio publicado abre **por defecto** con este conjunto (`?datos=demo` también funciona); los datos que
entrega el equipo en `data/processed/` se ven con **`?datos=processed`**. En desarrollo el defecto sigue siendo
`processed`. Es un conjunto **ficticio** de 12 cochas,
lecturas y series de fotos sintéticas con colonias marcadas, empaquetado en `public/demo/`. Sirve para grabar
el video y el pitch aunque falten datos reales; las fechas se desplazan para que la última lectura sea "ahora".
Se regenera con `node scripts/gen-demo.mjs` (determinista) y cumple los contratos de `data/contracts/`.

## Idioma

Español o inglés con el selector **ES · EN** de la barra, o con `?lang=en` / `?lang=es` en la URL (se recuerda en el
navegador). Los textos están en `src/i18n.ts`; las recomendaciones usan `mensaje_es` / `mensaje_en` de
`recommendations.json`. En inglés el IAC se muestra como **CSI** (Cushuro Suitability Index).

## Sin conexión (instalable)

En la app publicada, `public/sw.js` (service worker escrito a mano, sin dependencias) guarda la app, los últimos
datos y las teselas del mapa ya vistas (hasta 400). Sin señal, la app abre igual con lo último guardado y muestra
el aviso "Sin conexión". `public/manifest.webmanifest` permite **instalarla** en el celular ("Agregar a pantalla de
inicio"). En desarrollo (`npm run dev`) el service worker no se registra, para no interferir con el modo en vivo.
Si se cambia la estrategia de caché, subir `VERSION` en `sw.js`.

## Sensor simulado (Qocha Ñawi)

Las lecturas de la demo salen del modelo del simulador de Paolo (`device/simulacion/simulador.py`): tres casos de agua
(propicia, media, débil) con ciclo diario de temperatura, UV de día y pH; cada cocha toma uno según su perfil, con una
pequeña variación propia. Para la toma "en vivo", el mismo simulador puede escribir `data/live/`:

```bash
python device/simulacion/simulador.py emitir --caso todas --cada 5     # o --secuencia mejora
cd twin && VITE_DATA_SOURCE=live npm run dev                             # el gemelo refresca solo
```

## Datos satelitales reales de la zona

`node scripts/gen-nasa.mjs` resume los CSV del frente Campo y Satélite (`satellite/datos/`: Sentinel-2 + SRTM,
ECOSTRESS, HLS, SMAP y NASA POWER) en `public/nasa/zona.json`. El mapa dibuja los cuerpos de agua detectados y un
bloque con los datos de la zona; el comparador parte de esos valores medidos (y marca "medido", "escenario" o
"estimado"). Volver a correrlo cuando se actualicen los CSV.

## Presentación: tomas, capturas y montaje

```bash
node twin/scripts/grabar-tomas.mjs ../tomas-gemelo/es es   # tomas en bruto (MP4 1080p; la del celular, vertical)
node twin/scripts/montaje.mjs ../tomas-gemelo/es es        # video con laptop y celular, textos y transiciones
node twin/scripts/capturas.mjs twin/capturas es            # imágenes 4K montadas en dispositivos
```
Comparten `scripts/lib/navegador.mjs` (Chrome por DevTools) y `scripts/lib/maqueta.mjs` (diseño y textos ES/EN).
