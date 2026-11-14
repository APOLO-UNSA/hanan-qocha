# Fotos de la demo generadas con IA

Las fotos de la demo (`public/demo/fotos/`) hoy son sintéticas, dibujadas por `scripts/gen-fotos.py`. Para que se vean
naturales se pueden reemplazar por imágenes de un generador (ChatGPT/DALL·E, Gemini, Midjourney, Firefly, Ideogram…) y
marcarlas con **segmentación HSV real** usando `scripts/marcar-fotos.py` (OpenCV). Es el mismo flujo que usará la visión
de Victor con las fotos reales de la cámara.

## 1. Qué fotos hacen falta

| Cocha | Fotos | Cobertura aproximada (de la primera a la última) |
|---|---|---|
| DEMO-01 | `DEMO-01-01.jpg` … `DEMO-01-08.jpg` | 9 % → 89 % (llega a cosecha) |
| DEMO-02 | `DEMO-02-01.jpg` … `DEMO-02-06.jpg` | 7 % → 66 % |
| DEMO-03 | `DEMO-03-01.jpg` … `DEMO-03-05.jpg` | 7 % → 16 % (crece lento) |
| DEMO-04 | `DEMO-04-01.jpg` | 6 % (recién sembrada) |
| DEMO-05 | `DEMO-05-01.jpg` … `DEMO-05-04.jpg` | 8 % → 35 % |

**Mínimo recomendado:** DEMO-01 (8) y DEMO-02 (6), que son las que salen en las tomas del video. Las que falten se quedan
con la versión sintética.

## 2. Prompt base (en inglés: los generadores responden mejor)

> Photograph from a trail camera mounted on a short pole at the edge of a small high-Andean wetland pond (bofedal) at
> 4,400 m in southern Peru, looking diagonally down at the water. Clear, shallow, slightly tea-colored water with a peaty
> bottom. Floating on the surface: spherical gelatinous colonies of the cyanobacterium *Nostoc sphaericum* ("cushuro"),
> olive-green to dark brownish-green, glossy and translucent, 1–4 cm in diameter, in loose clusters. Shore of cushion
> plants (Distichia) and dry ichu grass tufts. In the background, low brown hills and a distant snow-capped peak under a
> pale blue sky with thin clouds. Morning light, natural colors, realistic camera noise, 4:3, no text, no watermark.

**Para la serie de una misma cocha** (que se vea la misma laguna en el tiempo):

1. Genera la **última** foto primero (la más llena), por ejemplo para DEMO-01: *"…the surface is about 85 % covered by
   colonies…"*.
2. Con la función de **edición / variación / inpainting** de la herramienta, pide sobre esa misma imagen: *"same scene,
   same camera angle, fewer cushuro colonies: about 60 % of the surface"*, luego 40 %, 25 %, 15 %, 9 %.
3. Si la herramienta no permite editar, usa siempre el mismo prompt y la misma semilla, cambiando solo el porcentaje.

## 3. Marcar las fotos con la visión

```bash
# 1. Guarda las imágenes con el nombre exacto en twin/fotos-fuente/ (jpg, png o webp; se recortan a 4:3)
# 2. Márcalas: segmenta las colonias dentro del agua y dibuja máscara, contornos, cajas y panel
python twin/scripts/marcar-fotos.py --roi-arriba 0.15 --depurar
# 3. Revisa las máscaras (*-mascara.png) y ajusta el rango de color si hace falta:
python twin/scripts/marcar-fotos.py --h 12 50 --s 50 --v 20 220 --agua-h 70 120
```

- `--h`, `--s`, `--v`: rango HSV de OpenCV del cushuro (tono 0–179). Si marca poco, ensancha `--h` o baja `--s`.
- `--agua-h`: tono del agua; la búsqueda se limita al espejo de agua para no marcar el pasto de la orilla.
- `--roi-arriba`: fracción superior de la foto que se ignora (cielo y cerros).
- `--etiqueta`: aviso visible en la foto. Por defecto dice **"IMAGEN GENERADA CON IA, DEMO DE CONCEPTO"**; con fotos
  reales de la cámara usa `--etiqueta ""`.

El script imprime cuántas colonias detectó y la cobertura medida sobre el agua de cada foto, junto al valor que tiene
`vision.json`. Si se quiere que la app use lo medido, hay que llevar esos valores a `vision.json`.

## 4. Antes de publicar

- Las fotos deben decir que son generadas con IA (lo hace la etiqueta) y el video o el pitch debe mencionarlo.
- Revisa la licencia de uso de la herramienta para imágenes en un concurso público.
- Después de marcar: `npm run build` (en `twin/`) y, si cambian las tomas, `node twin/scripts/grabar-tomas.mjs`.
