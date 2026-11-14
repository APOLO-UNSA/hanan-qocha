# Recursos de datos: qué usar y para qué

Lista entregada por la organización, filtrada para *Adapting Farms with NASA Data* y ordenada por frente.

> **Cómo leer la practicidad.** Es un juicio mío sobre el hackathon (tiempo de arranque, necesidad de programar, cuenta o credenciales).
>
> **Qué se comprobó (14 nov 2026).** Leí la portada de varios portales y, de POWER y AppEEARS, su documentación o catálogo. Marco como **[comprobado]** lo que vi y como **[sin confirmar]** lo que no pude ver. Giovanni y Worldview cargan con JavaScript y su portada no mostró nada útil, así que de ellos no confirmé qué datos tienen ni si piden cuenta. De AppEEARS leí solo parte del catálogo (los primeros 100 000 caracteres).

## Los más útiles (el resto es opcional o se descarta)

| Prioridad | Recurso | Frente | Para qué |
|---|---|---|---|
| 1 | **Earthdata (cuenta)** | Campo y Satélite | Es requisito para casi todo lo demás. |
| 2 | **NASA POWER** | Campo y Satélite, Gemelo | Clima por coordenada con histórico; alimenta los sliders y la comparación. |
| 3 | **AppEEARS** | Campo y Satélite | Series de humedad del suelo, vegetación y temperatura por zona, listas para `sites.json`. |
| 4 | **Giovanni** | Campo y Satélite, Video | Tendencias de lluvia y humedad sin programar; buenas tomas para el video. |
| 5 | **Worldview** | Video, Gemelo | Capturas del mapa para el pitch. |
| 6 | **Copernicus (Sentinel-2)** | Campo y Satélite | Solo si da tiempo: más detalle para cochas pequeñas. |

**Se descartan:** FIRMS, NISAR, JAXA, Moon/Mars Trek, PDS, HiRISE, NSSDC, SPHEREx, HRP, PSI, CSA, Chandra. **Solo para el pitch:** OSDR.

## 0. Antes de nada

| Acción | Quién | Por qué |
|---|---|---|
| Crear cuenta Earthdata: <https://urs.earthdata.nasa.gov> | **Paolo y Adrián, hoy** | Giovanni, AppEEARS y las descargas de SMAP, MODIS y Landsat la piden. |
| Crear cuenta Copernicus: <https://dataspace.copernicus.eu> | Adrián, si da tiempo | Opcional: el navegador se usa sin cuenta, pero la cuenta da una experiencia más completa. |

## 1. Campo y Satélite (Adrián, con Paolo)

| Recurso | Para qué tarea del plan | Practicidad | Verificar |
|---|---|---|---|
| **NASA POWER** <https://power.larc.nasa.gov> | Temperatura, lluvia, radiación y humedad por coordenada, con serie histórica. Es la base del clima de cada finca y cocha (sección 4.1). | **Alta.** [Comprobado] API diaria por punto (`/api/temporal/daily/point`) con latitud, longitud y fechas, desde 1981 hasta casi tiempo real. Tiene comunidad agroclimática (AG), más de 300 parámetros y datos gratuitos. | [Sin confirmar] si pide clave. La malla que nombra es de 0,5° (~50 km): sirve para clima regional, no para una cocha. Los parámetros exactos de lluvia y humedad hay que mirarlos en su diccionario. |
| **AppEEARS** <https://appeears.earthdatacloud.nasa.gov> | Extraer series por punto o zona y llevarlas a `sites.json`. | **Alta.** [Comprobado] su catálogo trae: humedad del suelo SMAP (9 y 36 km), temperatura de superficie ECOSTRESS (70 m) y MODIS (1 km), NDVI MODIS (250 m–1 km), **evapotranspiración MODIS MOD16 (500 m)**, elevación NASADEM/SRTM (30 m), HLS y Landsat (30 m). La evapotranspiración y el NDVI aparecen en el reto. | [Sin confirmar] cuenta requerida (lo esperable es Earthdata). **GPM no apareció en la parte que leí**, así que no cuenten con él aquí. |
| **Giovanni** <https://giovanni.gsfc.nasa.gov> | Gráficos de tendencia de lluvia (GPM) y humedad del suelo (SMAP) sin programar; tomas para el video. | **Media**, hasta probarlo. | [Sin confirmar] todo: su portada solo mostró el lema y enlaces a la guía. Probar con GPM IMERG y SMAP en Arequipa antes de planificar con él. |
| **Earthdata Search** <https://search.earthdata.nasa.gov> | Encontrar el producto concreto y su enlace de descarga. | **Media.** Ayuda a localizar, pero la descarga es manual. | No lo abrí. |
| **Copernicus (Sentinel-2)** <https://dataspace.copernicus.eu> | Agua superficial y vegetación a 10 m, más fino que los 30 m de HLS: útil para cochas pequeñas (sección 13). | **Media.** [Comprobado] navegador web, uso básico **sin cuenta** y APIs (STAC, openEO). | La resolución de Sentinel-2 no la vi en su portada (los 10 m son de mi conocimiento). Es un dato de ESA, no de NASA: citarlo así. |
| **SMAP** <https://smap.jpl.nasa.gov> | Humedad del suelo, evidencia de las estrategias. | **Media.** [Comprobado] mide la capa superficial del suelo (unos 5 cm) y el USDA la usa para monitorear cultivos. Los datos se bajan por AppEEARS. | Su portada no da la resolución; el catálogo de AppEEARS dice 9 y 36 km, así que **no distingue una finca**. |
| **Worldview** <https://worldview.earthdata.nasa.gov> | Mirar capas rápido y capturar imágenes para el video y el pitch. | **Alta** para visualización, según lo esperado. | [Sin confirmar]: su portada no cargó contenido. |
| **USGS EarthExplorer** <https://earthexplorer.usgs.gov> | Landsat y relieve (SRTM) de la zona. | **Media.** Descarga manual de escenas. | Duplica lo que da AppEEARS. |
| **FIRMS** <https://firms.modaps.eosdis.nasa.gov> | Incendios. | **Baja.** No responde a ninguna tarea nuestra. | — |
| **NISAR** (<https://search.asf.alaska.edu>, <https://nisar.jpl.nasa.gov>) | Radar de humedad y agua. | **Baja.** Procesamiento pesado para un día. | Fuera de alcance; mencionarlo como visión futura. |
| **JAXA G-Portal** <https://gportal.jaxa.jp> | Lluvia alternativa (GPM). | **Baja.** Giovanni ya cubre la lluvia. | — |

**Ruta mínima para hoy:** cuenta Earthdata → POWER para clima por coordenada → AppEEARS o Giovanni para humedad del suelo, vegetación y temperatura → `data/processed/sites.json`.

## 2. Gemelo (Pax)

| Recurso | Uso | Practicidad |
|---|---|---|
| **POWER (API)** | Cargar clima por coordenada en el comparador y mover los sliders de lluvia y temperatura con valores reales. | **Alta**, si Pax prefiere consultar en vivo. Mejor leer del JSON que genera Adrián para no depender de la red en la demo. |
| **Worldview, Giovanni** | Capas o imágenes de fondo para el mapa. | **Media.** Para la demo basta con capturas. |

El gemelo sigue leyendo solo `data/`. Ningún portal de arriba debe llamarse directo desde `twin/`.

## 3. Visión artificial (Victor)

Ningún recurso de la lista aporta algo directo, y no hace falta. **La visión se simula**: no se entrena ningún modelo. Para la demo se prepara una foto del bofedal con las colonias marcadas (una máscara dibujada o una segmentación por color muy simple con OpenCV) y un `vision.json` de ejemplo, y se muestra unos segundos en el video. Detalle en la sección 4.3 del plan.

## 4. Negocio y territorio (Ortega)

| Recurso | Uso | Practicidad |
|---|---|---|
| Ninguno de la lista | Los cultivos y rotaciones de la zona **no están** en estos portales. | — |

La estrategia actual y los cultivos de la comparación se definen con productores y expertos locales.

**Datos de suelo y agua in situ:** los aporta **Qocha Ñawi**, el dispositivo de tierra (sección 4.2 del plan), no un portal. Es la parte del proyecto que cubre lo que el reto llama "información local de suelos", y conviene decirlo así en el pitch.

## 5. Ángulo espacial y video (Jefry)

| Recurso | Uso | Practicidad |
|---|---|---|
| **NASA OSDR** <https://osdr.nasa.gov> | Buscar experimentos de biología con cianobacterias en el espacio, para respaldar la frase del fotobiorreactor en la sección 6. | **Media** para el pitch. No es necesario para el prototipo. |
| **Worldview** y **images.nasa.gov** <https://images.nasa.gov> | Imágenes para el video (cuidar los derechos de uso de cada archivo). | **Alta.** |
| **Moon Trek, Mars Trek, PDS, HiRISE, NSSDC, SPHEREx, HRP, PSI, CSA, Chandra** | — | **Baja.** No aportan al planteamiento actual. |

## 6. Lo que falta para cerrar el marco

- **Datos de suelo:** el reto pide información local de suelos. La parte medida en campo la cubre Qocha Ñawi; falta decidir qué variables de suelo mide el dispositivo (ver sección 4.2 del plan). Un mapa de suelos regional no está en la lista.
- **GRACE y GRACE-FO** (almacenamiento de agua), mencionados por el reto, no figuran en la lista. Son opcionales.
- **Earth Engine**, que cité en el plan inicial, no está en la lista. Si se usa, es decisión de Adrián y requiere cuenta propia.
