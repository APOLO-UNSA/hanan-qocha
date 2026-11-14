# Fotos de la demo generadas con IA

Las fotos de la demo (`public/demo/fotos/`) hoy son sintéticas, dibujadas por `scripts/gen-fotos.py`. Para que se vean
naturales se pueden reemplazar por imágenes de un generador (ChatGPT/DALL·E, Gemini, Midjourney, Firefly, Ideogram…) y
marcarlas con **segmentación HSV real** usando `scripts/marcar-fotos.py` (OpenCV). Es el mismo flujo que usará la visión
de Victor con las fotos reales de la cámara.

## 1. Qué fotos hacen falta

| Cocha | Fotos | Cobertura aproximada (de la primera a la última) |
|---|---|---|
| QC-01 | `QC-01-01.jpg` … `QC-01-08.jpg` | 9 % → 89 % (llega a cosecha) |
| QC-02 | `QC-02-01.jpg` … `QC-02-06.jpg` | 7 % → 66 % |
| QC-03 | `QC-03-01.jpg` … `QC-03-05.jpg` | 7 % → 16 % (crece lento) |
| QC-04 | `QC-04-01.jpg` | 6 % (recién sembrada) |
| QC-05 | `QC-05-01.jpg` … `QC-05-04.jpg` | 8 % → 35 % |

**Mínimo recomendado:** QC-01 (8) y QC-02 (6), que son las que salen en las tomas del video. Las que falten se quedan
con la versión sintética.

## 2. Prompt base (en inglés: los generadores responden mejor)

> Photograph from a trail camera mounted on a short pole at the edge of a small high-Andean wetland pond (bofedal) at
> 4,400 m in southern Peru, looking diagonally down at the water. Clear, shallow, slightly tea-colored water with a peaty
> bottom. Floating on the surface: spherical gelatinous colonies of the cyanobacterium *Nostoc sphaericum* ("cushuro"),
> olive-green to dark brownish-green, glossy and translucent, 1–4 cm in diameter, in loose clusters. Shore of cushion
> plants (Distichia) and dry ichu grass tufts. In the background, low brown hills and a distant snow-capped peak under a
> pale blue sky with thin clouds. Morning light, natural colors, realistic camera noise, 4:3, no text, no watermark.

**Para la serie de una misma cocha** (que se vea la misma laguna en el tiempo):

1. Genera la **última** foto primero (la más llena), por ejemplo para QC-01: *"…the surface is about 85 % covered by
   colonies…"*.
2. Con la función de **edición / variación / inpainting** de la herramienta, pide sobre esa misma imagen: *"same scene,
   same camera angle, fewer cushuro colonies: about 60 % of the surface"*, luego 40 %, 25 %, 15 %, 9 %.
3. Si la herramienta no permite editar, usa siempre el mismo prompt y la misma semilla, cambiando solo el porcentaje.

## 3. Marcar las fotos con la visión

```bash
# 1. Guarda las imágenes con el nombre exacto en twin/fotos-fuente/ (jpg, png o webp; se recortan a 4:3).
#    Esa carpeta no se sube al repo (pesa mucho): solo se publican las fotos marcadas.
# 2. Si es una cámara nueva, traza el contorno del agua en scripts/roi-camaras.json (coordenadas 0–1 de la foto 4:3).
# 3. Márcalas:
python twin/scripts/marcar-fotos.py --depurar      # --depurar dibuja el contorno del agua usado
```

**Cómo detecta.** En fotos reales, el color solo no alcanza: el fondo de turba, las piedras y el pasto tienen el mismo
tono que el cushuro. El script busca la **forma**: círculos (transformada de Hough) dentro del espejo de agua, por franjas
de profundidad con el radio esperado por la perspectiva, y verifica cada uno por color oliva/pardo, borde nítido en la
mayor parte del contorno (ese valor es la confianza que aparece en las cajas), brillo especular y contraste con el agua.

Ajustes: `--h`, `--s`, `--v` (rango HSV de OpenCV del cushuro), `--min-soporte` (borde mínimo, 0–1) y `--etiqueta`
(texto opcional en la franja inferior de la foto; por defecto no se pone ninguno).

El script imprime cuántas colonias detectó y la cobertura medida sobre el agua. En la foto solo se muestran las colonias
detectadas y la biomasa de `vision.json`, para no contradecir la cobertura que muestra la app. Si se quiere que la app use
lo medido, hay que llevar esos valores a `vision.json`.

> **Hecho el 14/11:** las series de QC-01 (8) y QC-02 (6) se generaron con Gemini (imagen base + ediciones "la misma
> cocha unos días antes") y se marcaron con este script.

## 4. Antes de publicar

- Las fotos ya no llevan aviso: si alguien pregunta, son imágenes generadas con IA para el concepto (dilo en el pitch o en la descripción de la entrega).
- Revisa la licencia de uso de la herramienta para imágenes en un concurso público.
- Después de marcar: `npm run build` (en `twin/`) y, si cambian las tomas, `node twin/scripts/grabar-tomas.mjs`.
