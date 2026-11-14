# Hanan Qocha

**NASA Space Apps Challenge 2026 · Sede Arequipa** · Desafío *Field Shift*.

Hanan Qocha (quechua: "laguna de arriba") ayuda a los productores de cushuro (*Nostoc sphaericum*) a encontrar las cochas donde mejor crece y a manejarlas, combinando satélite NASA, el sensor in situ **Qocha Ñawi** y el gemelo digital **Qocha Twin**.

Plan completo: [docs/HANAN_QOCHA_PROYECTO.md](docs/HANAN_QOCHA_PROYECTO.md)

**App publicada:** https://apolo-unsa.github.io/hanan-qocha/ · [demo](https://apolo-unsa.github.io/hanan-qocha/?datos=demo)

> 📌 **Equipo: qué entrega cada uno al gemelo (antes de M2, sábado 20:00) → [docs/INTEGRACION_GEMELO.md](docs/INTEGRACION_GEMELO.md)**

## Estructura

| Carpeta | Contenido |
|---|---|
| `twin/` | App web del gemelo digital |
| `device/` | Firmware ESP32 y puente al sensor |
| `satellite/` | Scripts de Earth Engine → `sites.json` |
| `vision/` | Segmentación → `vision.json` |
| `business/` | Modelo de negocio y perfil del productor |
| `data/contracts/` | Esquemas JSON (contratos de datos) |
| `data/mock/` · `data/processed/` | Datos de ejemplo · datos reales validados |
| `docs/` | Documentación |

## Flujo de trabajo

Ramas cortas por frente (`twin/…`, `device/…`, `sat/…`, `vision/…`, `biz/…`, `docs/…`), PR hacia `main` y el check `ci-gate` en verde. Commits con prefijo: `feat(twin): …`, `fix(device): …`, `data(sat): …`.
