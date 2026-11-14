# Hanan Qocha: plan del proyecto

**NASA Space Apps Challenge 2026 · Sede Arequipa · 14–15 de noviembre**
Desafío base: *Adapting Farms with NASA Data*: una herramienta de apoyo a la decisión que use observaciones NASA para que los agricultores exploren estrategias de rotación que mejoren la salud del suelo y los adapten al clima cambiante.
Plan de respaldo: *Field Shift* (datos in situ en tierras andinas áridas), si no se logra sustentar el planteamiento de la sección 1.1.

> Documento de trabajo del equipo. Las cifras llevan su fuente al final. Los valores marcados **[completar]** solo se ponen si son reales.

---

## Índice

1. [Resumen](#1-resumen)
2. [El problema](#2-el-problema)
3. [El cushuro](#3-el-cushuro)
4. [La solución: tres pilares tecnológicos](#4-la-solución-tres-pilares-tecnológicos)
5. [Índice de Aptitud Cushuro (IAC)](#5-índice-de-aptitud-cushuro-iac)
6. [Cómo se ve el prototipo: la app del productor](#6-cómo-se-ve-el-prototipo-la-app-del-productor)
7. [Video de 30 segundos](#7-video-de-30-segundos)
8. [Equipo y reparto de tareas](#8-equipo-y-reparto-de-tareas)
9. [Contratos de datos](#9-contratos-de-datos)
10. [Flujo DevOps en GitHub (sin bloquear a Pax)](#10-flujo-devops-en-github-sin-bloquear-a-pax)
11. [Guía paso a paso para crear el repositorio](#11-guía-paso-a-paso-para-crear-el-repositorio)
12. [Cronograma del hackathon](#12-cronograma-del-hackathon)
13. [Riesgos y límites (para responder a los jueces)](#13-riesgos-y-límites-para-responder-a-los-jueces)
14. [Fuentes](#14-fuentes)

---

## 1. Resumen

En los Andes altos es difícil que la carne fresca o los suplementos de hierro lleguen a los niños que los necesitan. Las rutas de altura los encarecen y, además, se perciben como medicina ajena a la dieta. Sin embargo, en los propios bofedales crece el **cushuro** (*Nostoc sphaericum*), una cianobacteria que se come desde hace siglos y que es rica en proteína, hierro y calcio. Hoy solo se recolecta silvestre, únicamente en temporada de lluvias y sin ningún manejo.

**Hanan Qocha** (quechua: "laguna de arriba") ayuda a los **productores de cushuro** a encontrar las cochas donde mejor crece y a manejarlas. Combina tres fuentes:

1. **Satélite NASA**: dónde están las cochas aptas.
2. **Qocha Ñawi**, un sensor in situ: cómo está el agua ahora.
3. **Qocha Twin**, un gemelo digital con visión artificial: cuánto va a crecer, qué hacer y cuándo cosechar.

**Usuario principal:** el productor altoandino, dueño de una finca con terrenos de cultivo y, cuando la tiene, una cocha. Quien maneja el cushuro lo llamamos "acuicultor".
**Zona piloto:** bofedales de la Reserva Nacional de Salinas y Aguada Blanca (Arequipa).
**Ángulo espacial:** el mismo conjunto de sensores, modelo y cámara serviría para monitorear un fotobiorreactor de cianobacterias en un hábitat lunar o marciano.

### 1.1 Pregunta del proyecto y alineación con el reto

**Pregunta central:** ¿puede el cushuro entrar como componente en el sistema de manejo de una finca altoandina, junto a sus cultivos y su descanso de terreno, y qué estrategia combina mejor agua, nitrógeno e ingreso según el clima?

Hanan Qocha mantiene su identidad (cochas, cushuro, Qocha Ñawi, Qocha Twin) y suma un nivel superior: la **finca** como unidad de decisión. La pregunta anterior, *¿en qué ambientes acuáticos puede crecer el cushuro y cómo monitorear y mejorar su producción?*, pasa a ser el módulo que responde si la cocha puede sumar a la rotación.

| El reto pide | Cómo lo cubrimos | Dónde |
|---|---|---|
| Datos NASA (SMAP, ECOSTRESS, GPM, Landsat/MODIS, SRTM) | Pilar 1 satélite; NASA POWER y GRACE son opcionales | 4.1 |
| Armonizar resoluciones en una grilla común | Agregado por finca y por cocha | 4.1 |
| Comparar al menos 3 estrategias, incluida la actual | Módulo de estrategias de manejo | 4.4 |
| Por qué, evidencia, beneficios, vacíos y riesgos de cada estrategia | Ficha de estrategia | 4.4 |
| Prioridades del agricultor (agua, ingreso, nitrógeno) | Entradas del productor en el comparador | 4.4, 6 |
| Sliders de escenario (lluvia, temperatura) | Sliders del gemelo | 4.3 |
| Datos de campo frente a satélite, y su incertidumbre | Qocha Ñawi y visión validan al satélite | 4.2, 13 |
| Apoyar, no reemplazar al agricultor | Aviso en cada ficha y sección 13 | 4.4, 13 |

**Alcance honesto:** el aporte del cushuro al suelo de los terrenos vecinos es una **hipótesis**, no un hecho: es un organismo acuático y no hay evidencia confirmada de ese uso. La herramienta lo declara como vacío de información en lugar de darlo por cierto.

---

## 2. El problema

| Indicador (ENDES 2025, niños de 6 a 35 meses) | Nacional | Rural | Urbano |
|---|---|---|---|
| Anemia, criterio OMS 2024 | 34,9 % | **43,2 %** | 31,5 % |
| Anemia, criterio anterior | 43,4 % | 50,4 % | 40,5 % |
| Desnutrición crónica (menores de 5 años) | 12,1 % | 21,7 % | — |

- **Puno y Arequipa:** dato departamental pendiente **[completar]**.
- **Obstáculos para llevar hierro a la altura:** la logística (rutas largas, cadena de frío) y la aceptación cultural de los suplementos.
- **El cushuro hoy:** se recolecta silvestre, solo de diciembre a marzo, sin manejo y con riesgo de sobrecosecha.

## 3. El cushuro

| Componente (por 100 g de peso seco) | Rango reportado |
|---|---|
| Proteína | 25–30 g |
| Hierro | 15,7–83,6 mg (varía mucho según la fuente) |
| Calcio | 145–1 224 mg |

**Biología relevante**
- Se reproduce por **fragmentación** y por **hormogonios**. Los **acinetos** son células de resistencia y los **heterocistos** fijan nitrógeno, así que no necesita fertilizante nitrogenado.
- Necesita agua limpia con **pocos sólidos disueltos (TDS bajo)**, a 3 000–5 000 m de altitud, y aparece en la temporada de lluvias.
- **Estado del cultivo:**
  - En laboratorio se obtiene biomasa filamentosa, pero todavía no colonias esféricas.
  - Hay un precedente de semi-cultivo en cochas en Cátac, Áncash (Adrián, 2018, citado en la revisión de Corpus-Gomez et al. 2021).
  - Por eso hablamos de **"encontrar y potenciar cochas"**, no de "cultivo masivo".

**Nombres locales:** cushuro, llullucha, murmunta, crespito.

---

## 4. La solución: tres pilares tecnológicos

```
 ┌────────────────────┐   ┌────────────────────┐   ┌──────────────────────────────┐
 │ 1. SATÉLITE NASA   │   │ 2. QOCHA ÑAWI      │   │ 3. QOCHA TWIN                │
 │ ¿Dónde?            │──▶│ ¿Cómo está el agua?│──▶│ ¿Cuánto crecerá? ¿Qué hago?  │
 │ HLS, NASADEM, IMERG│   │ TDS, T°, pH, UV,   │   │ Gemelo digital + visión      │
 │ MODIS/ECOSTRESS    │   │ nivel, cámara      │   │ artificial sobre la cámara   │
 └────────────────────┘   └────────────────────┘   └──────────────────────────────┘
            └───────────────── Índice de Aptitud Cushuro (IAC) ─────────────────┘
```

### 4.1 Pilar 1: satélite (¿dónde?)

| Capa NASA | Qué aporta | Resolución |
|---|---|---|
| HLS (Landsat + Sentinel-2): NDWI, NDVI | Agua superficial y vegetación de bofedal | 30 m |
| NASADEM | Altitud (3 000–5 000 m) y pendiente (dónde se acumula el agua) | 30 m |
| GPM IMERG | Lluvia y duración de la temporada | ~10 km |
| MODIS LST / ECOSTRESS | Temperatura de superficie | 1 km / 70 m |
| SMAP | Humedad del suelo | ~9 km |
| OMI UV | Radiación UV | ~13 km |

**Salida:** la lista de cochas candidatas, cada una con un `indice_satelital` entre 0 y 1.

### 4.2 Pilar 2: dispositivo Qocha Ñawi (¿cómo está el agua?)

| Módulo | Para qué |
|---|---|
| Sensor de TDS o conductividad | Variable clave: el cushuro exige agua con pocos sólidos disueltos |
| Turbidez | Claridad del agua y luz disponible (reutiliza la experiencia del sensor de turbidez autónomo de Paolo) |
| pH, temperatura del agua y del aire | Condiciones de crecimiento |
| Humedad del suelo (en terreno y orilla de la cocha) | Dato de suelo in situ: valida a SMAP, que no distingue una finca (9 km), y alimenta las estrategias de la sección 4.4 |
| Sensor UV o PAR | Radiación |
| Nivel de agua | Si la cocha se seca o se desborda |
| Cámara time-lapse | Insumo de la visión artificial |
| GPS, LoRa con almacenamiento offline, panel solar | Despliegue autónomo en el bofedal |

**En el hackathon:** un ESP32 con TDS y temperatura enviando lecturas reales. Se suman pH o UV si da el tiempo.

### 4.3 Pilar 3: Qocha Twin, gemelo digital + visión artificial (¿cuánto crecerá y qué hago?)

**Gemelo digital**: modelo simple de crecimiento por cocha:

```
tasa_diaria = r_max · f(T) · f(UV) · f(TDS) · f(profundidad)

f(x) = curva de aptitud entre 0 y 1: vale 1 en el óptimo y baja a 0 fuera del rango tolerable
biomasa(t+1) = biomasa(t) · (1 + tasa_diaria) · (1 − biomasa(t)/capacidad)   ← crecimiento logístico
```

- Los rangos óptimos salen de la literatura y se marcan como **supuestos del modelo**.
- En pantalla, el productor mueve sliders (temperatura, UV, TDS, profundidad) y ve cómo cambia la curva proyectada.
- El modelo devuelve una **acción recomendada**: "aumentar sombra", "renovar agua", "cosechar el 70 % y dejar el 30 %", "esperar 2 semanas".

**Visión artificial (simulada en el hackathon):**
- No se entrena ningún modelo. La demo muestra una foto con las colonias marcadas (máscara dibujada o segmentación simple por color en HSV con OpenCV) y un `vision.json` de ejemplo con `cobertura_pct` y `biomasa_kg`.
- Es solo una escena de unos segundos en el video: el esfuerzo debe ser mínimo.
- **Idea que se presenta (no implementada):** una cámara mediría el crecimiento real y lo compararía con la curva **proyectada** para recalibrar el modelo. Se declara como trabajo futuro.

### 4.4 Módulo de estrategias de manejo (comparador de rotación)

El gemelo de cada cocha alimenta una comparación **a nivel de finca**. Se comparan tres estrategias:

| # | Estrategia | Papel del cushuro |
|---|---|---|
| 1 | **Actual:** la rotación que el productor ya practica | Ninguno |
| 2 | **Con leguminosa:** suma una especie fijadora de nitrógeno en los terrenos | Ninguno |
| 3 | **Con cushuro:** suma el manejo de la cocha en temporada de lluvias | Ingreso extra y, como hipótesis, aporte de nitrógeno |

> Las especies y la rotación actual concretas **se definen con Ortega y con productores de la zona**. Esta tabla es un esquema, no un dato.

**Ficha por estrategia** (lo que muestra la app):
- **Por qué se sugiere** y qué evidencia la respalda (dato NASA, lectura del sensor, literatura).
- **Beneficios esperados:** uso de agua, nitrógeno, cobertura del terreno, ingreso.
- **Vacíos de información** y **riesgos** que requieren revisión local.
- Aviso: *"Esta herramienta apoya la decisión; no reemplaza el criterio del productor ni de un experto agrícola."*

**Prioridades del productor** (entradas): ahorrar agua, ingreso extra, mejorar el suelo. Reordenan las estrategias sin cambiar la evidencia.

**Evidencia por estrategia:** indicadores simples y explicables a partir de la grilla común: humedad del suelo (SMAP), lluvia (GPM), temperatura y estrés térmico (ECOSTRESS/MODIS), vegetación (Landsat/MODIS, NDVI) y riesgo de helada. La incertidumbre se muestra como rango, no como cifra única.

---

## 5. Índice de Aptitud Cushuro (IAC)

```
IAC = 0,4 · indice_satelital + 0,4 · indice_in_situ + 0,2 · indice_vision
```

- **`indice_in_situ`:** promedio de las curvas de aptitud de las variables que mide el sensor.
- **`indice_vision`:** crecimiento observado frente al proyectado.
- **Pesos:** son iniciales y se ajustan con datos de campo. Hay que decirlo así ante los jueces.

| IAC | Estado | Mensaje al productor |
|---|---|---|
| ≥ 0,7 | Apta | "Buena cocha para sembrar o manejar" |
| 0,4–0,7 | Condicional | "Mejorar: sombra, profundidad o flujo de agua" |
| < 0,4 | No apta | "Buscar otra cocha" |

**Papel del IAC en el comparador:** es la evidencia de la estrategia 3. Con IAC bajo, la estrategia con cushuro se marca como no recomendada para esa finca.

---

## 6. Cómo se ve el prototipo: la app del productor

**Pantalla 1: Mapa.** Los bofedales de Salinas y Aguada Blanca coloreados según el IAC. Al tocar una cocha se abre su ficha.

**Pantalla 2: Ruta de cultivo de la cocha.**

```
[ Apta ] ──▶ [ Sembrada ] ──▶ [ Creciendo ] ──▶ [ Lista para cosechar ]
 satélite      registro        sensor + curva     alerta: cosechar X kg,
                               + cámara           dejar el 30 %
```

**Pantalla 3: Gemelo de la cocha.**
- Lecturas en vivo del sensor.
- Curva proyectada frente a la real.
- Foto con las colonias marcadas.
- Sliders "¿qué pasa si...?" y tarjeta de acción recomendada.

**Pantalla 4: Comparador de estrategias de la finca.**
- El productor marca sus prioridades (agua, ingreso, suelo).
- Ve las tres estrategias lado a lado, cada una con su ficha: por qué, evidencia, beneficios, vacíos y riesgos.
- Los sliders de lluvia y temperatura muestran cómo cambia cada estrategia.

**Visión a futuro, solo en el cierre o el pitch:** un fotobiorreactor semillero que produzca inóculo fuera de temporada. Es el puente con un hábitat espacial.

---

## 7. Video de 30 segundos

Modelo de referencia: el campeón de 2025, **Queñaris**, con la estructura presentación → problema → tecnología → resultado concreto.

| Tiempo | Voz en off (inglés, ~80 palabras) | Imagen | Responsable de la toma |
|---|---|---|---|
| 0–7 s | *"In the high Andes, iron supplements and fresh meat rarely reach the children who need them. Four in ten rural toddlers in Peru live with anemia."* | Logo → toma de la app → ruta de altura, niño andino | Jefry |
| 7–14 s | *"Yet in their own wetlands grows cushuro, an ancestral food rich in iron and protein, harvested only in the wild, and never managed."* | Bofedal, manos con cushuro, tabla de nutrientes animada | Ortega |
| 14–21 s | *"Hanan Qocha combines NASA satellite data and our in-situ Qocha Ñawi sensor…"* | Mapa satelital (3 s) → sensor en el agua (4 s) | Paolo + Adrián |
| 21–26 s | *"…with a digital twin of each pond that forecasts growth and tells growers when and how much to harvest."* | Curva moviéndose con los sliders y colonias marcadas por la visión (2 s) | Pax + Victor |
| 26–30 s | *"[Logro real]. From the wetland to the table: local iron, no trucks, no cold chain."* | Plato con cushuro → logo | Jefry |

- **Logro real, ejemplo:** *"Our prototype is already measuring in Salinas y Aguada Blanca, with [N] candidate ponds mapped."* Va solo si es verdad **[completar]**.
- **Prueba de tiempo:** leer el guion en voz alta con cronómetro. Si pasa de 30 s, se recorta el bloque de 7–14 s.

---

## 8. Equipo y reparto de tareas

Cinco frentes. Paolo y Adrián forman un solo frente, **Campo y Satélite**, porque los dos alimentan el gemelo con datos de entrada y se revisan mutuamente.

| Frente | Miembros | Entregables | Carpeta en el repo |
|---|---|---|---|
| **Liderazgo e integración** | **Jefry** | Coordinación, administración del repo, merges, guion, locución, edición del video, pitch | `docs/`, `media/` |
| **Gemelo digital** | **Pax** | App web: mapa, ruta de cultivo, gemelo con sliders, IAC, recomendaciones | `twin/` (exclusiva de Pax) |
| **Campo y Satélite** | **Paolo + Adrián** | Paolo: firmware del ESP32, puente de datos al gemelo, toma del sensor en el agua. Adrián: mapa de aptitud satelital, `sites.json`, auditoría de cifras y fuentes. Juntos: los contratos `sensor` y `sites`; cada uno revisa los PR del otro. | `device/`, `satellite/` |
| **Visión artificial** | **Victor** | Simulación para la demo: una foto con colonias marcadas y un `vision.json` de ejemplo (sección 4.3). Sin entrenamiento; una tarea breve que se adapta a su tiempo limitado. | `vision/` |
| **Productor, negocio y territorio** | **Ortega** | Perfil del acuicultor, modelo de negocio, textos de recomendaciones en lenguaje de productor (`recommendations.json`), imágenes reales del bofedal, respuestas sobre adopción | `business/`, `data/processed/recommendations.json` |

**Respaldo:** si Victor no termina la visión, la toma Paolo; con segmentación por color se resuelve en pocas horas.

**Por qué funciona este reparto:**
- **Pax** no espera a nadie, porque trabaja con datos de ejemplo desde el minuto 0.
- **Adrián**, con su precisión, valida tanto los datos del sensor como las cifras del pitch.
- **Paolo** aporta el hardware real que le da credibilidad a la demo.

---

## 9. Contratos de datos

El gemelo **solo lee archivos JSON** con un formato fijo. Cada frente produce su archivo y GitHub Actions valida que cumpla el esquema. Si un archivo falla, falla el PR de quien lo envió, **nunca el trabajo de Pax**.

| Archivo | Lo produce | Campos |
|---|---|---|
| `sensor.json` | Paolo | `cocha_id, timestamp, tds_ppm, temp_agua_c, ph?, uv_index?` |
| `sites.json` | Adrián | `cocha_id, nombre, lat, lon, altitud_m, indice_satelital` |
| `vision.json` | Victor | `cocha_id, timestamp, foto, cobertura_pct, biomasa_kg` |
| `recommendations.json` | Ortega | `codigo, condicion, mensaje_es, mensaje_en` |

Los esquemas viven en `data/contracts/*.schema.json`. Los datos de ejemplo están en `data/mock/` y los reales en `data/processed/`.

**Ejemplo `data/contracts/sensor.schema.json`:**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Lecturas Qocha Ñawi",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["cocha_id", "timestamp", "tds_ppm", "temp_agua_c"],
    "properties": {
      "cocha_id":    { "type": "string" },
      "timestamp":   { "type": "string", "format": "date-time" },
      "tds_ppm":     { "type": "number", "minimum": 0 },
      "temp_agua_c": { "type": "number", "minimum": -5, "maximum": 40 },
      "ph":          { "type": "number", "minimum": 0, "maximum": 14 },
      "uv_index":    { "type": "number", "minimum": 0 }
    },
    "additionalProperties": false
  }
}
```

**Ejemplo `data/mock/sensor.json`:**

```json
[
  { "cocha_id": "SAB-01", "timestamp": "2026-11-14T10:00:00-05:00", "tds_ppm": 42, "temp_agua_c": 9.5, "ph": 7.1, "uv_index": 11 },
  { "cocha_id": "SAB-02", "timestamp": "2026-11-14T10:00:00-05:00", "tds_ppm": 180, "temp_agua_c": 12.0 }
]
```

Los esquemas de `sites`, `vision` y `recommendations` siguen el mismo patrón: un arreglo de objetos con los campos de la tabla.

---

## 10. Flujo DevOps en GitHub (sin bloquear a Pax)

### 10.1 Principios

1. **Contratos primero:** los esquemas y los datos de ejemplo se suben antes de que nadie programe. Pax construye contra ellos desde el inicio.
2. **Cada frente tiene su carpeta:** nadie toca `twin/` salvo Pax. Un archivo `CODEOWNERS` lo hace cumplir.
3. **Integración solo por datos:** los demás entregan archivos JSON validados por el CI, nunca cambios en el código del gemelo.
4. **El gemelo nunca se rompe:** si falta un archivo real, usa el de `data/mock/`.
5. **CI por carpetas:** en un PR solo corren los trabajos de la carpeta que cambió. Un fallo de visión no frena un PR del gemelo.
6. **Pax puede saltarse la protección de `main`:** está en la lista de bypass, así que si hace falta empuja directo.
7. **Pax no administra:** Jefry gestiona issues, revisa y fusiona los PR de los demás, y crea el tag del video.
8. **Ramas cortas:** cada tarea va en una rama que dura horas, no días, y se fusiona rápido para evitar conflictos.

### 10.2 Estructura del repositorio

```
hanan-qocha/
├── README.md
├── .gitignore
├── .github/
│   ├── CODEOWNERS
│   ├── pull_request_template.md
│   └── workflows/
│       ├── ci.yml          ← valida contratos + build/tests por carpeta
│       └── deploy.yml      ← publica el gemelo en GitHub Pages
├── data/
│   ├── contracts/          ← *.schema.json (Paolo+Adrián, Victor, Ortega)
│   ├── mock/               ← datos de ejemplo (nunca se borran)
│   ├── processed/          ← datos reales validados
│   └── live/               ← lecturas en vivo del sensor (en .gitignore)
├── twin/                   ← Pax: app web (Vite + JS/TS, o lo que elija)
├── device/
│   ├── firmware/           ← Paolo: código ESP32 (secrets.h fuera del repo)
│   └── bridge/             ← Paolo: puente serial/HTTP → data/live/sensor.json
├── satellite/              ← Adrián: notebooks / scripts de Earth Engine → sites.json
├── vision/                 ← Victor: segmentación → vision.json (+ tests)
├── business/               ← Ortega: modelo de negocio, perfil del productor
├── scripts/
│   └── validate_data.sh
├── docs/                   ← este documento, guion, fuentes
└── media/                  ← tomas del video (pesadas → usar Git LFS o Drive)
```

### 10.3 Ramas y nombres

| Rama | Uso | Ejemplo |
|---|---|---|
| `main` | Siempre funciona y se publica sola en Pages | — |
| `twin/<tarea>` | Pax | `twin/sliders` |
| `device/<tarea>` | Paolo | `device/tds-calibracion` |
| `sat/<tarea>` | Adrián | `sat/ndwi-sab` |
| `vision/<tarea>` | Victor | `vision/hsv-segmentacion` |
| `biz/<tarea>` | Ortega | `biz/recomendaciones` |
| `docs/<tarea>` | Jefry | `docs/guion-v2` |

**Commits:** usar un prefijo, por ejemplo `feat(twin): slider de TDS`, `fix(device): offset del sensor` o `data(sat): sites.json con 12 cochas`.

### 10.4 Quién aprueba qué

| Cambio en | Revisión | Fusiona |
|---|---|---|
| `twin/` | No requiere; Pax decide | Pax (o push directo) |
| `device/`, `satellite/` | Paolo y Adrián se revisan entre ellos | Jefry o el autor |
| `vision/` | Paolo (o Victor si el PR es de Paolo) | Jefry o el autor |
| `data/contracts/` | **Pax debe aprobar**, porque cambiar un contrato le afecta | Jefry |
| `business/` | Jefry u Ortega | Jefry o el autor |
| `data/processed/`, `docs/` | No requiere; el CI valida los datos | El autor |

### 10.5 Archivos de configuración

**`.github/CODEOWNERS`** (reemplazar `@usuario-*` por los usuarios reales de GitHub):

```
# Sin dueño por defecto: lo que no está listado no exige revisión
# (si se pusiera "* @usuario-jefry", Jefry tendría que aprobar cada PR)

# Exclusivo de Pax
/twin/                @usuario-pax

# Contratos: cualquier cambio necesita el visto bueno de Pax
/data/contracts/      @usuario-pax

# Campo y Satélite
/device/              @usuario-paolo @usuario-adrian
/satellite/           @usuario-adrian @usuario-paolo

# Visión (dos dueños: nadie puede aprobar su propio PR)
/vision/              @usuario-victor @usuario-paolo

# Negocio
/business/            @usuario-ortega @usuario-jefry
```

> Cada carpeta tiene **dos dueños** porque GitHub no deja que el autor apruebe su propio PR. Con un solo dueño, ese miembro quedaría bloqueado. La excepción es Pax: está en el bypass y no necesita aprobación.

**`scripts/validate_data.sh`:**

```bash
#!/usr/bin/env bash
# Valida cada archivo de datos contra su esquema. Sale con error si alguno no cumple.
set -euo pipefail
status=0
for name in sensor sites vision recommendations; do
  schema="data/contracts/${name}.schema.json"
  [ -f "$schema" ] || continue
  for dir in data/mock data/processed; do
    file="${dir}/${name}.json"
    if [ -f "$file" ]; then
      echo "Validando $file"
      check-jsonschema --schemafile "$schema" "$file" || status=1
    fi
  done
done
exit $status
```

**`.github/workflows/ci.yml`:**

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      twin: ${{ steps.filter.outputs.twin }}
      vision: ${{ steps.filter.outputs.vision }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            twin:
              - 'twin/**'
            vision:
              - 'vision/**'

  contracts:            # siempre corre, tarda segundos
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install check-jsonschema
      - run: bash scripts/validate_data.sh

  twin:                 # solo si cambió twin/
    needs: changes
    if: needs.changes.outputs.twin == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: twin
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build

  vision:               # solo si cambió vision/
    needs: changes
    if: needs.changes.outputs.vision == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r vision/requirements.txt pytest
      - run: pytest vision -q

  ci-gate:              # ÚNICO check obligatorio en main
    if: always()
    needs: [contracts, twin, vision]
    runs-on: ubuntu-latest
    steps:
      - run: |
          if [ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" = "true" ]; then
            echo "Algún trabajo falló"; exit 1
          fi
          echo "Todo OK (los trabajos omitidos no bloquean)"
```

> **Por qué existe `ci-gate`:** si se marcan como obligatorios los trabajos que solo corren cuando cambia su carpeta, GitHub los deja en "pendiente" en los PR que no tocan esa carpeta y bloquea el merge. Con un solo check obligatorio que siempre corre, eso no pasa.

**`.github/workflows/deploy.yml`** (publica el gemelo en `https://<usuario-u-org>.github.io/hanan-qocha/`):

```yaml
name: deploy
on:
  push:
    branches: [main]
    paths: ['twin/**', 'data/**']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci && npm run build
        working-directory: twin
      - name: Copiar datos al sitio
        run: |
          mkdir -p twin/dist/data
          cp data/mock/*.json twin/dist/data/ 2>/dev/null || true
          cp data/processed/*.json twin/dist/data/ 2>/dev/null || true   # los reales sobrescriben a los mock
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: twin/dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> Si Pax usa Vite, debe poner `base: '/hanan-qocha/'` en `vite.config.js` para que funcione en Pages. Si elige otro stack (Streamlit, Next, etc.), solo hay que adaptar los pasos de build de `ci.yml` y `deploy.yml`, y él decide.

**`.gitignore`** (mínimo):

```
node_modules/
dist/
__pycache__/
.venv/
.env
data/live/
device/firmware/**/secrets.h
*.mp4
*.mov
```

**`.github/pull_request_template.md`:**

```markdown
## Qué cambia
-

## Frente
- [ ] Gemelo  - [ ] Campo/Satélite  - [ ] Visión  - [ ] Negocio  - [ ] Docs/Video

## Checklist
- [ ] Si toca datos: cumple el contrato en data/contracts/
- [ ] No toca carpetas de otro frente
- [ ] Probado localmente
```

### 10.6 Datos en vivo del sensor durante la demo

```
ESP32 ──(serial USB o HTTP por WiFi)──▶ device/bridge/bridge.py ──▶ data/live/sensor.json
                                                                      │
twin (modo local) lee data/live/ si existe ─────────────────────────────┘
                 si no existe → data/processed/ → data/mock/
```

- `data/live/` **no se sube** al repo: está en `.gitignore`. Para la grabación del video se corre todo en local.
- Cuando haya una tanda de lecturas buena, Paolo la copia a `data/processed/sensor.json` y abre un PR. Así queda publicada en Pages.
- El gemelo elige la fuente con una variable, por ejemplo `VITE_DATA_SOURCE=live|processed|mock`. La implementación la decide Pax.

### 10.7 Tablero de tareas (GitHub Projects)

- **Columnas:** `Por hacer` → `En curso` → `En revisión` → `Hecho`.
- **Etiquetas:** `twin`, `campo-satelite`, `vision`, `negocio`, `video`, `bloqueante`.
- **Milestones**, uno por punto de control (sección 12): `M1 Contratos + mocks`, `M2 Datos reales`, `M3 Grabación`, `M4 Entrega`.
- **Regla:** quien esté bloqueado pone la etiqueta `bloqueante` y avisa a Jefry por el grupo. Jefry decide en 10 minutos.

### 10.8 Congelar la versión del video

Antes de grabar, Jefry crea un tag. Si alguien rompe algo después, se vuelve a esa versión para regrabar:

```bash
git checkout main && git pull
git tag -a v0.1-video -m "Versión usada para grabar el video"
git push origin v0.1-video
```

---

## 11. Guía paso a paso para crear el repositorio

> **Lo hace Jefry**, como líder y administrador, **antes de las 9:00 del sábado**. Toma unos 30 minutos. Cada miembro necesita una cuenta de GitHub y debe enviar su usuario por el grupo.

### Paso 1: crear una organización (recomendado)

1. Entrar a <https://github.com/organizations/plan> y elegir el plan **Free**.
2. Nombre: `hanan-qocha` (o `hananqocha` si el primero está ocupado). Correo de contacto: el de Jefry.
3. **Invite members:** agregar los usuarios de los 5 compañeros.

> **Por qué una organización:** permite crear un *team* solo para Pax y darle bypass, y el repo no queda en la cuenta personal de nadie. Si prefieren no crearla, se puede crear el repo en la cuenta de Jefry y agregar colaboradores en *Settings → Collaborators*. En ese caso se le da a Pax el rol **Admin** para que pueda hacer bypass.

### Paso 2: crear el repositorio

1. En la organización: **New repository**.
2. Configurar:
   - Nombre: `hanan-qocha`.
   - Visibilidad: **Public**, porque Space Apps pide un enlace al proyecto y Pages gratis requiere repo público en organizaciones Free.
   - Marcar **Add a README**.
   - En *.gitignore template* elegir `Python`; después se completa con el de la sección 10.5.
   - Licencia: **MIT**.
3. **Create repository**.

### Paso 3: crear equipos y dar permisos

1. Organización → **Teams → New team**:
   - `twin`: Pax.
   - `campo-satelite`: Paolo y Adrián.
   - `equipo`: los seis.
2. Repo → **Settings → Collaborators and teams → Add teams**:
   - `equipo` con rol **Write**.
   - `twin` con rol **Maintain**.
   - Jefry ya es **Admin** como dueño de la organización.

### Paso 4: subir la estructura inicial (desde la PC de Jefry)

Se necesita Git instalado: <https://git-scm.com/downloads>. Abrir una terminal (Git Bash en Windows) y correr:

```bash
git clone https://github.com/hanan-qocha/hanan-qocha.git
cd hanan-qocha

# Carpetas
mkdir -p .github/workflows data/{contracts,mock,processed,live} twin \
         device/{firmware,bridge} satellite vision business scripts docs media
touch twin/.gitkeep device/firmware/.gitkeep device/bridge/.gitkeep \
      satellite/.gitkeep vision/.gitkeep business/.gitkeep media/.gitkeep data/processed/.gitkeep

# Crear los archivos de la sección 10.5 y 9:
#   .github/CODEOWNERS, .github/workflows/ci.yml, .github/workflows/deploy.yml,
#   .github/pull_request_template.md, scripts/validate_data.sh, .gitignore,
#   data/contracts/sensor.schema.json (+ sites, vision, recommendations),
#   data/mock/sensor.json (+ sites, vision, recommendations)
# y copiar este documento a docs/HANAN_QOCHA_PROYECTO.md

chmod +x scripts/validate_data.sh
git add .
git commit -m "chore: estructura inicial, contratos y CI"
git push origin main
```

> **Nota:** el trabajo `twin` del CI y `deploy.yml` necesitan que exista `twin/package.json`. Hasta que Pax suba su proyecto, el deploy fallará: es normal y no bloquea a nadie. Otra opción es que Pax haga `npm create vite@latest twin` como primer commit.

### Paso 5: proteger `main` con un ruleset

Repo → **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.

1. **Ruleset name:** `proteger-main`. **Enforcement status:** `Active`.
2. **Bypass list → Add bypass:** agregar el team **`twin`** (Pax) y el rol **Repository admin** (Jefry). Elegir *Always allow*.
3. **Target branches → Add target → Include default branch**.
4. Marcar:
   - ✅ **Restrict deletions**.
   - ✅ **Block force pushes**.
   - ✅ **Require a pull request before merging**:
     - *Required approvals:* **0**, para no frenar el hackathon.
     - ✅ *Require review from Code Owners*. Con 0 aprobaciones, esto solo obliga a pedir aprobación cuando se tocan carpetas con dueño: protege `twin/` y `data/contracts/`.
   - ✅ **Require status checks to pass** → *Add checks* → escribir `ci-gate`. El check aparece en la lista después de que el CI haya corrido al menos una vez, en el push del paso 4.
5. **Create**.

> **Resultado:** Pax puede empujar directo a `main` o fusionar sus PR sin esperar a nadie. Los demás trabajan con PR y el CI valida sus datos. Si alguien intenta tocar `twin/` o los contratos, GitHub pide la aprobación de Pax.
>
> **Si el bloqueo resulta molesto**, por ejemplo para Victor por su poco tiempo, se le puede agregar al bypass o subir las aprobaciones requeridas a 0 sin Code Owners. Es preferible relajar reglas a perder horas.

### Paso 6: activar GitHub Pages

Repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**. El sitio aparecerá en `https://hanan-qocha.github.io/hanan-qocha/` después del primer deploy exitoso.

### Paso 7: crear el tablero

1. Organización → **Projects → New project → Board**. Nombre: `Hackathon Hanan Qocha`.
2. Configurar las columnas de la sección 10.7.
3. Repo → **Issues → Labels**: crear las etiquetas.
4. Repo → **Issues → Milestones**: crear M1–M4.
5. Crear un issue por entregable de la sección 8, asignarlo a su dueño y vincularlo al Project.

### Paso 8: flujo diario de cada miembro (no Pax)

```bash
# 1. Primera vez
git clone https://github.com/hanan-qocha/hanan-qocha.git
cd hanan-qocha

# 2. Cada tarea nueva: partir de main actualizado
git checkout main
git pull
git checkout -b sat/ndwi-sab          # usar el prefijo de tu frente

# 3. Trabajar, luego guardar
git add satellite/ data/processed/sites.json
git commit -m "data(sat): sites.json con 12 cochas candidatas"
git push -u origin sat/ndwi-sab

# 4. En GitHub aparece el botón "Compare & pull request" → crear PR
#    Esperar a que ci-gate esté en verde → Jefry (o tú) hace "Squash and merge"

# 5. Volver a main para la siguiente tarea
git checkout main && git pull
```

Validar los datos localmente antes de subirlos:

```bash
pip install check-jsonschema
bash scripts/validate_data.sh
```

### Paso 9: flujo de Pax

```bash
git checkout main && git pull
git checkout -b twin/sliders
# ... trabajar en twin/ ...
git commit -am "feat(twin): sliders de T, UV y TDS"
git push -u origin twin/sliders
# Abrir PR y fusionarlo él mismo apenas el CI esté en verde,
# o, si tiene prisa, trabajar directo en main:
git checkout main && git pull && git commit -am "..." && git push   # permitido por el bypass
```

Pax **nunca** tiene que esperar datos reales: lee `data/mock/` desde el primer minuto, y cuando llegan los archivos reales a `data/processed/`, el gemelo los usa sin cambiar código.

### Paso 10: resolver un conflicto (por si pasa)

```bash
git checkout mi-rama
git pull origin main          # trae lo último de main
# Git marca los archivos en conflicto con <<<<<<< ======= >>>>>>>
# Editar, quedarse con lo correcto, borrar las marcas
git add archivo-resuelto
git commit
git push
```

Con una carpeta por frente, los conflictos deberían ser raros. Casi siempre ocurrirán en `docs/` o `README.md`.

---

## 12. Cronograma del hackathon

| Momento | Hito | Milestone | Detalle |
|---|---|---|---|
| Sábado 8:00–9:00 | Repo listo | — | Jefry crea el repo (pasos 1–7) y todos clonan |
| Sábado 9:00–11:00 | **M1** | Contratos + mocks | Esquemas y mocks en `main`. Pax arranca el gemelo. Cada frente con su primer avance. |
| Sábado 12:00 | Sincronización | — | 15 min: cada uno muestra lo que tiene y se marcan los bloqueos |
| Sábado 20:00 | **M2** | Datos reales | Sensor enviando datos al gemelo, `sites.json` real, Victor entrega `vision.json` antes de irse |
| Domingo 8:00–11:00 | **M3** | Grabación | Tag `v0.1-video`. Tomas: mapa, sensor, gemelo, visión, bofedal. |
| Domingo 11:00–14:00 | **M4** | Entrega | Jefry edita el video, Adrián audita las cifras, Ortega y Jefry ensayan el pitch, se suben el enlace del repo y el video a Space Apps |

> Los horarios exactos dependen del cronograma oficial de la sede; ajustarlos cuando se publique. **El cierre de entrega lo fija la organización, no este documento.**

---

## 13. Riesgos y límites (para responder a los jueces)

| Pregunta probable | Respuesta honesta |
|---|---|
| ¿Ya se cultiva el cushuro? | No de forma controlada: en laboratorio solo se obtiene biomasa filamentosa. Hay un precedente de semi-cultivo en cochas (Cátac, 2018). Nosotros ayudamos a encontrar y manejar las cochas donde ya crece o puede crecer. |
| ¿El modelo de crecimiento está validado? | Es un modelo inicial con supuestos tomados de la literatura. La visión artificial mide el crecimiento real y lo recalibra con cada temporada. |
| ¿El sensor detecta metales pesados? | No: eso requiere análisis de laboratorio. El sensor marca las cochas que conviene enviar a analizar. |
| ¿El satélite ve cochas pequeñas? | Con 30 m no siempre. Por eso hacen falta el sensor y la cámara a escala de cocha. |
| ¿No causará sobrecosecha? | Al contrario: el gemelo recomienda cuánto dejar para que se regenere. |
| ¿El hierro es confiable? | Los valores reportados varían mucho entre fuentes (15,7–83,6 mg por 100 g en peso seco). Habría que medir el producto local. |
| ¿Hubo proyectos parecidos? | Bio Peruvian Tech (Space Apps 2021) trabajó con cushuro. Nuestro aporte es el manejo productivo con satélite, sensor y gemelo digital. |
| ¿El cushuro mejora el suelo? | No lo afirmamos. Fija nitrógeno, pero es acuático y no hay evidencia confirmada de que beneficie los terrenos vecinos. Lo declaramos como hipótesis y vacío de información, y se validaría con expertos y ensayos locales. |
| ¿Es una herramienta de rotación o de cushuro? | Es de apoyo a la decisión de la finca. El cushuro es una de las tres estrategias comparadas, no la única. |
| ¿De dónde salen las rotaciones y los cultivos? | De productores y expertos de la zona, a cargo de Ortega. Los ejemplos del documento son esquemas por validar. |
| ¿Quién paga? | **[completar con Ortega]**: modelo de negocio, costo por unidad Qocha Ñawi, número de unidades del piloto. |

---

## 14. Fuentes

- Corpus-Gomez, A. et al. (2021). Revisión sobre *Nostoc sphaericum* (cushuro). *Agroindustrial Science* 11(2): 231–238. Es la fuente principal: nutrición, estado del cultivo y las citas a Adrián (2018) y Gutiérrez (2010). Esas dos tesis se citan de segunda mano.
- INEI, ENDES 2025: anemia y desnutrición crónica infantil.
- Ciclo de vida de *Nostoc*: *Research, Society and Development*, <https://rsdjournal.org/index.php/rsd/article/view/34391>
- Tesis UPCH sobre *Nostoc sphaericum* en San Pedro de Cajas: <https://repositorio.upch.edu.pe/handle/20.500.12866/18422>
- Cultivo de *Nostoc* sp. en laboratorio, Huancavelica (*Llamkasun*, 2021): <https://alicia.concytec.gob.pe/vufind/Record/REVLLAM_57ce75c1b82d635b35009b9b8ebfed04>
- Mouga et al. (2024), *Nostoc* sp. en laboratorio, *Biology* (MDPI): <https://www.mdpi.com/2079-7737/13/5/306/htm>
- Datos NASA: HLS, NASADEM, GPM IMERG, MODIS LST, ECOSTRESS, SMAP, OMI. Disponibles en Earthdata y Google Earth Engine.
- Recursos de datos del reto, ordenados por frente y con su practicidad: [RECURSOS.md](RECURSOS.md).
- Reto NASA Space Apps 2026, *Adapting Farms with NASA Data*: <https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/>
- Documentación de GitHub: rulesets, CODEOWNERS, Pages con Actions (<https://docs.github.com>).

**Material del equipo ya creado:**
- Documento "Hanan Qocha — Cushuro: impacto, cultivo y monitoreo".
- Logo y paleta en el canvas de diseño.
- Anteproyecto (.pptx).
- Infografía de enfoque.

---
*Hanan Qocha · NASA Space Apps Challenge 2026 · Arequipa*
