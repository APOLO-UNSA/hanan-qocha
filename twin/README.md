# Qocha Twin (`twin/`)

App web del gemelo digital. Vite + TypeScript, sin framework; mapa con Leaflet.

```bash
cd twin
npm install
npm run dev        # http://localhost:5173/hanan-qocha/
npm run build      # genera dist/ (lo publica deploy.yml en GitHub Pages)
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

Si un archivo falta o está roto, la app lo trata como vacío y sigue funcionando.

## Pantallas

1. **Mapa** (`#/`): cochas coloreadas por IAC.
2. **Ruta de cultivo** y 3. **Gemelo** (`#/cocha/<id>`): lectura del sensor, foto de visión,
   curva proyectada vs. real, sliders "¿qué pasa si…?" y acción recomendada.

## Modelo (`src/model.ts`)

- Aptitud trapezoidal por variable (T, UV, TDS, profundidad) y `tasa = r_max · Πf`.
- Crecimiento logístico discreto `b + r·b·(1 − b/K)`; `K` se estima con `biomasa_kg / cobertura`.
- `IAC = 0,4·satélite + 0,4·in situ + 0,2·visión`; si falta una fuente, su peso se reparte.
- `recommendations.json`: la `condicion` admite comparaciones simples unidas con `&&`
  (variables: `tds_ppm`, `temp_agua_c`, `uv_index`, `profundidad_m`, `biomasa_kg`, `capacidad_kg`, `biomasa_pct`).

Los rangos y parámetros en `RANGES` / `PARAMS` son **supuestos del modelo**.
