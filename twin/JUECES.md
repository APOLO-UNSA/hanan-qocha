# Machete para los jueces · Qocha Twin (Pax)

Respuestas cortas sobre el gemelo. Regla de oro: **decir qué es supuesto y qué es medido**. Los números de abajo salen
del código (`src/model.ts`) y de la demo; si cambian, actualízalos aquí.

## En 20 segundos

> **ES:** El gemelo es una copia digital de cada cocha. Junta el satélite (dónde), el sensor (cómo está el agua) y la cámara (cuánto cushuro hay), proyecta cuánto va a crecer y le dice al productor qué hacer y cuándo cosechar. Con cada foto nueva se recalibra solo.
>
> **EN:** The twin is a digital copy of each pond. It combines satellite (where), sensor (water quality now) and camera (how much cushuro there is), forecasts growth, and tells the grower what to do and when to harvest. Every new photo recalibrates it.

## El modelo en 3 frases

1. **Aptitud por variable:** temperatura, UV, TDS y profundidad tienen cada una una curva de 0 a 1: vale 1 en el óptimo y baja a 0 fuera del rango tolerable.
2. **Tasa diaria** = `r_max × f(T) × f(UV) × f(TDS) × f(profundidad)`, con `r_max = 0,06/día`.
3. **Crecimiento logístico:** `b + r·b·(1 − b/K)`. Crece rápido al inicio y se frena al acercarse a la capacidad `K` de la cocha.

| Variable | Óptimo (supuesto) | Tolerable |
|---|---|---|
| Temperatura del agua | 8–15 °C | 0–25 °C |
| UV | 6–11 | 0–16 |
| TDS | ≤ 100 ppm | ≤ 300 ppm |
| Profundidad | 0,2–0,6 m | 0,05–1,5 m |

- **Capacidad K:** biomasa medida ÷ cobertura de la foto (si 12 kg cubren el 30 %, K ≈ 40 kg). Con cobertura < 5 % se usa 40 kg.
- **Cosecha:** se recomienda al llegar al **80 % de K**. Cosechar el **70 %** y **dejar el 30 %** para que se regenere.

## Índice de Aptitud Cushuro (IAC)

`IAC = 0,4 · satélite + 0,4 · in situ + 0,2 · visión`

- **In situ:** promedio de las curvas de aptitud de lo que mide el sensor.
- **Visión:** crecimiento observado frente al proyectado entre las dos últimas fotos.
- **≥ 0,7:** apta. **0,4–0,7:** condicional. **< 0,4:** no apta.
- **Si falta una fuente,** su peso se reparte entre las otras (no se castiga a una cocha sin cámara).
- Los **pesos son iniciales**: se ajustan con datos de campo. Decirlo así.

## Recalibración ("cierra el ciclo")

- Con **2 o más fotos**, el gemelo busca el factor **α** (0,05–3) que hace que el modelo reproduzca lo medido por la cámara. Desde ahí proyecta con esa tasa ajustada.
- **Demo:** DEMO-01 → tasa ×1,76, error medio **2,9 → 0,5 kg (84 % menos)** con 8 fotos. DEMO-02 → ×1,55, **64 % menos** con 6 fotos.
- **Frase:** *"El modelo no pretende saberlo todo de entrada: arranca con la literatura y cada temporada la cámara lo corrige."*

## Preguntas probables

**¿Los datos son reales?**
Decir exactamente lo que se mostró. Si es la demo: *"Es un prototipo con datos simulados; el sensor ya mide [X] y el flujo está listo para los datos reales sin cambiar código."* La app lo indica con el aviso "Datos de demostración".

**¿De dónde salen los rangos óptimos?**
Son **supuestos del modelo** basados en lo que se sabe del cushuro (agua limpia, poca sal, 3 000–5 000 m). Están marcados así en la app y se ajustan con datos de campo y con la recalibración.

**¿Está validado el modelo?**
No todavía en campo. Es un modelo inicial; la visión artificial lo recalibra con cada serie de fotos y la app muestra cuánto baja el error.

**¿Qué pasa si se cae el sensor o no hay internet?**
- **Sin internet:** la app funciona offline (instalable en el celular) con los últimos datos guardados y lo avisa.
- **Lectura rota o incompleta:** se conserva la última buena.
- **Datos viejos:** se muestra la antigüedad ("hace X min") y la alerta *"sin datos recientes"*.

**¿No fomenta la sobrecosecha?**
Al contrario: recomienda **cuánto dejar (30 %)** y cuándo esperar. Hoy se cosecha sin ningún criterio.

**¿Cómo lo usa un productor que no lee mucho?**
- Colores (verde, ámbar, rojo) y una sola acción clara ("Esperar 4 semanas", "Cosechar 33 kg").
- Los mensajes los escribe el frente de negocio en lenguaje del productor (español e inglés), sin tocar código.

**¿Qué tecnología usa?**
- **App:** web estática (Vite + TypeScript + Leaflet), sin servidor: corre en GitHub Pages y offline.
- **Datos:** archivos JSON con contratos validados en cada PR.
- **Calidad:** 25 pruebas automáticas del modelo en el CI.

**¿Escala?**
Cada cocha nueva es una fila más en `sites.json`; el modelo es el mismo. El mismo esquema (sensor + modelo + cámara) sirve para un fotobiorreactor de cianobacterias en un hábitat lunar o marciano.

## Límites (decirlos antes de que los pregunten)

- **Profundidad:** el sensor del prototipo aún no mide nivel; se **asume 0,4 m** (el slider permite simular otros valores).
- **Proyección:** usa la **última lectura** como condición constante; no pronostica el clima.
- **Recalibración:** un solo factor α por cocha; con pocas fotos es aproximado.
- **Capacidad:** se estima a partir de la cobertura de la foto, no de una medición directa.
- **Metales pesados:** el sensor no los detecta; eso requiere laboratorio. Las alertas de calidad de agua (TDS, pH) sirven para decidir qué cochas conviene analizar.
