# Fotos de la demo (QC-01 a QC-12): origen y créditos

Las fotos de `twin/public/demo/fotos/QC-01-*` … `QC-12-*` **ilustran el concepto**: son paisajes reales de humedales
altoandinos a los que se les agregaron colonias de cushuro con IA (Gemini, modelo de imagen Pro), siguiendo reglas de
crecimiento tomadas de la literatura. No son fotos de campo de las cochas `SAB-xx`. Gemini agrega además la marca de
agua invisible SynthID.

## Paisajes base

| Cámara | Foto base | Autor / fuente | Licencia |
|---|---|---|---|
| QC-01 | Laguna de Quiullacocha, Huay-Huay, Yauli, Junín (orilla somera) | MINCETUR, Inventario Nacional de Recursos Turísticos, ficha 10225 | Sin licencia declarada; se cita la fuente |
| QC-02 | Bofedal con pozas | Alfredobi, Wikimedia Commons ("Bofedal.JPG") | CC BY-SA 3.0 |
| QC-03 | Humedal de Rontococha, Abancay (Apurímac) | water.alternatives, Flickr 30266372677 | CC BY-NC 2.0 |
| QC-04 | Pozas de Quiullacocha | MINCETUR, ficha 10225 | Sin licencia declarada; se cita la fuente |
| QC-05 | Reserva Nacional Salinas y Aguada Blanca (Arequipa) | Veronique Debord, Flickr 989591394 | CC BY-SA 2.0 |
| QC-06 | Borde de bofedal en Quiullacocha | MINCETUR, ficha 10225 | Sin licencia declarada; se cita la fuente |
| QC-07 | Charca en la puna, Reserva Salinas y Aguada Blanca (**no apta**: sin cushuro) | Marie Thérèse Héber, Flickr 9551943900 | CC BY-SA 2.0 |
| QC-08 | Canales del bofedal, Reserva Salinas y Aguada Blanca | Veronique Debord, Flickr 988737959 | CC BY-SA 2.0 |
| QC-09 | Laguna Patococha, Pachacoto, Áncash (cocha de cushuro estudiada por el INAIGEM) | INAIGEM, Boletín 2016, p. 73 | Publicación del Estado; se cita la fuente |
| QC-10 | Orilla salina de la Laguna de Salinas, Arequipa (**no apta**: sin cushuro) | Diego Delso, Wikimedia Commons ("Laguna de Salinas, Arequipa, Perú, 2015-08-02, DD 22") | CC BY-SA 4.0 |
| QC-11 | Orilla de la Laguna de Salinas, Arequipa | CNicole Silva, Wikimedia Commons | CC BY-SA 4.0 |
| QC-12 | Pequeña laguna altoandina | Irma Franke, Wikimedia Commons ("3 Pequeña laguna alto andina.JPG") | CC BY-SA 3.0 |

QC-06 a QC-12 son **fotos de inspección** (una por cocha, 14/11). Su cobertura en `twin/scripts/gen-demo.mjs`
(`inspeccion`) está elegida para que el IAC mantenga el estado de cada cocha.

Ficha MINCETUR: https://consultasenlinea.mincetur.gob.pe/fichaInventario/index.aspx?cod_Ficha=10225

## Referencias del aspecto del cushuro (solo para guiar al modelo)

- David F. Belmonte, bofedal de la C.C. Rupascca, Huancavelica. iNaturalist 244239689 (CC BY 4.0).
- Jorge Herreros de Lartundo, Parinacota, Chile. iNaturalist 194622493 (CC BY 4.0).
- INAIGEM, Boletín INAIGEM may–dic 2016, p. 71, "Nostoc sp en la superficie de la laguna" (Pachacoto, Áncash).

## Reglas de crecimiento usadas (fuente: Boletín INAIGEM 2016 y estudios peruanos)

- Colonias sumergidas en agua somera, clara y quieta de 10–20 cm, sobre el fondo de la orilla; nunca flotando ni en el agua profunda.
- Tamaño de 0,5 a 2,5 cm (de arveja a uva); verde oliva sano, pardo cuando el agua está estresada (TDS alto).
- Las series son semanales y hacia adelante: las colonias existentes se quedan en su sitio y crecen, y aparecen nuevas.

## Visión

- **Series (QC-01, 02, 03, 05):** `py twin/scripts/marcar-fotos.py --escala 0.4`, con la vista de cada cámara sin
  cushuro en `twin/fotos-fuente/referencia/` (no se sube al repo): sustracción de fondo + Hough.
- **Fotos sueltas (QC-04, QC-06 a QC-12):** sin referencia, Hough + color verde oliva:
  `py twin/scripts/marcar-fotos.py --entrada <carpeta con esas fotos> --escala 0.4 --h 18 45`.
  Menos de 5 detecciones se toman como ruido (QC-07 y QC-10 quedan en 0).
- La zona somera de cada cámara está en `twin/scripts/roi-camaras.json`.
