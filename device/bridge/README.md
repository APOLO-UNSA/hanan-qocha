# Puente Qocha Ñawi → gemelo (Paolo)

`puente.py` recibe lecturas del ESP32, las valida con las reglas del contrato y mantiene
`data/live/sensor.json` (última lectura por cocha) para el gemelo de Pax. Solo biblioteca estándar
(el modo `serial` necesita `pip install pyserial`).

## Prueba rápida sin hardware (3 pasos)
```bash
python device/bridge/puente.py demo --cocha SAB-01 --cada 5      # terminal 1 (lecturas SIMULADAS)
cd twin && $env:VITE_DATA_SOURCE='live'; npm run dev              # terminal 2 (PowerShell)
```
Abrir http://localhost:5173/hanan-qocha/: la ficha muestra **● EN VIVO**.

## Con el ESP32
| Conexión | Comando |
|---|---|
| USB | `python device/bridge/puente.py serial --puerto COM5 --cocha SAB-01` |
| WiFi | `python device/bridge/puente.py http --puerto 8080 --cocha SAB-01` y el ESP32 hace POST a `http://<IP-del-PC>:8080/lectura` |

El firmware de ejemplo (`device/firmware/qocha_nawi/qocha_nawi.ino`) imprime una línea JSON cada 5 s.
Formatos aceptados: JSON `{"tds_ppm":42,"temp_agua_c":9.5,"ph":7.1,"uv_index":11}` o CSV `tds,temp[,ph[,uv]]`.
Las líneas que no son lecturas (logs) se ignoran.

## Lote para publicar (`data/processed/sensor.json`)
```bash
python device/bridge/puente.py lote --horas 48 --cada 30     # una lectura por cocha cada 30 min
bash scripts/validate_data.sh
git add data/processed/sensor.json   # y abrir PR
```
El lote sale del historial `data/live/historial.jsonl`, que el puente va llenando.

## Reglas de validación
- Obligatorios: `tds_ppm` ≥ 0 y `temp_agua_c` entre −5 y 40; si faltan o están fuera de rango, la lectura se descarta con aviso.
- Opcionales: `ph` (0–14) y `uv_index` (≥ 0); si están mal se **omiten**, no se manda `null`.
- Sin campos extra. La hora es la del PC (−05:00) salvo que la lectura traiga una válida.
- La escritura es atómica (archivo temporal + renombrar): el gemelo nunca lee un JSON a medias.
- Si hay lecturas simuladas (`demo`), **no las publiques como reales**.
