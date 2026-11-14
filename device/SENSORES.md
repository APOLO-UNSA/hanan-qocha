# Qocha Ñawi: lista de sensores y componentes

Para armar el diseño 3D propio. **Los datos técnicos están escritos de memoria y no los comprobé en las hojas de datos**: verificar tensión, rango y dimensiones del fabricante antes de modelar o comprar. No incluyo precios porque no los verifiqué.

Nombres de la columna **ID** = nombres sugeridos para las piezas en el CAD.

## 1. Controlador y comunicación

| ID | Componente | Datos clave | Notas |
|---|---|---|---|
| `MCU` | **ESP32-WROOM-32 DevKit** (30 pines) | 3,3 V lógicos, WiFi/BT, ADC de 12 bits | Usar pines **ADC1** (GPIO 32–39): los ADC2 no funcionan con WiFi activo. |
| `MCU+LORA` (alternativa) | **Heltec WiFi LoRa 32 V3** (ESP32-S3 + SX1262 + OLED) | Todo en una placa | Reduce piezas y cableado. Su distribución de pines es distinta a la tabla de la sección 4. |
| `LORA` | **SX1276** (módulo RFM95W) | 915 MHz | **Verificar la banda permitida en Perú** antes de elegir la frecuencia. Con la alternativa Heltec no hace falta. |
| `ANT` | Antena LoRa tipo látigo con conector SMA | ≈ 18 cm | Va sobre la caja, en vertical. |

## 2. Sensores de agua (sumergidos)

| ID | Sensor | Mide | Interfaz y tensión | Rango / precisión | Notas |
|---|---|---|---|---|---|
| `S_TDS` | **DFRobot Gravity Analog TDS Sensor (SEN0244)** | Sólidos disueltos → `tds_ppm` | Analógica, 3,3–5,5 V | 0–1000 ppm, ≈ ±10 % | Necesita **compensación por temperatura** con `S_TEMP`. Calibrar con solución patrón. |
| `S_TEMP` | **DS18B20 con cable impermeable** | Temperatura del agua → `temp_agua_c` | 1-Wire, 3–5,5 V, resistencia de 4,7 kΩ a 3,3 V | −55 a +125 °C, ≈ ±0,5 °C | El más simple y robusto de todos. |
| `S_PH` | **DFRobot Gravity Analog pH Meter V2 (SEN0161-V2)** | pH → `ph` | Analógica, 3,3–5,5 V | 0–14, ≈ ±0,1 | Calibrar con buffers pH 4 y 7. **Esta sonda no está hecha para inmersión continua**: para dejarla puesta, usar la versión industrial **SEN0169-V2**. |
| `S_PRES` | **Blue Robotics Bar30 (MS5837-30BA)** | Profundidad del agua → `profundidad_m` (propuesto) | I2C, 3,3 V | Resolución del orden de milímetros | Va **en el ancla, sobre el fondo**, con cable al flotador. Ver la corrección de la sección 5. |
| `S_TURB` (opcional) | **DFRobot Gravity Turbidity Sensor (SEN0189)** | Turbidez | Analógica, 5 V | — | Solo si sobra tiempo. Su sonda no es totalmente sumergible. |

## 3. Sensores de aire y suelo

| ID | Sensor | Mide | Interfaz y tensión | Notas |
|---|---|---|---|---|
| `S_UV` | **Adafruit LTR390** (recomendado) | UV, índice UV → `uv_index` | I2C, 3,3 V | Digital y ya entrega un valor de índice UV. |
| `S_UV` (alternativa) | **GUVA-S12SD** | UV | Analógica, 3,3–5 V | Más barato; hay que convertir tensión a índice UV y calibrar. |
| `S_SUELO` | **DFRobot Capacitive Soil Moisture Sensor (SEN0193)** | Humedad del suelo → `humedad_suelo_pct` (propuesto) | Analógica, 3,3–5,5 V | Calibrar en seco y en saturado. Diseño anticorrosión. Estaca en la orilla. |

## 4. Cámara, posición y energía

| ID | Componente | Datos clave | Notas |
|---|---|---|---|
| `CAM` | **ESP32-CAM (AI-Thinker, OV2640 de 2 MP)** | 5 V; consume del orden de 200–300 mA al capturar | Placa **aparte** del `MCU`. En el hackathon la visión es simulada: es un elemento de diseño. |
| `GPS` | **u-blox NEO-6M (módulo GY-NEO6MV2)** | UART, 3,3–5 V | Arranque en frío del orden de medio minuto. |
| `PANEL` | Panel solar **6 V, ≈ 3 W** | ≈ 15 × 15 cm (según fabricante) | Ajustar el tamaño al modelo real que se compre. |
| `CARGA` | Módulo cargador solar para Li-ion (**CN3791** MPPT, o **TP4056** con protección) | Entrada 6 V | El CN3791 aprovecha mejor un panel pequeño. |
| `BAT` | **Celda 18650 protegida, ≈ 3000 mAh** | 3,7 V | Con portapilas. |
| `REG` | Regulador a 5 V y 3,3 V (por ejemplo boost **MT3608** + el regulador de la placa) | — | La cámara pide 5 V; el resto funciona a 3,3 V. |
| `DIV` | Divisor de tensión (2 resistencias) a un pin ADC1 | — | Para medir la batería y avisar de poca carga. |

## 5. Corrección importante sobre el nivel de agua

En la versión anterior del diseño puse un **sensor ultrasónico apuntando al agua desde la estación flotante**. Eso está mal: la estación sube y baja con el agua, así que esa distancia **siempre es la misma** y no mide el nivel. Además, el JSN-SR04T tiene una zona ciega de unos 20–25 cm, y mi brazo lo dejaba más cerca que eso.

Opciones que sí funcionan:
1. **Sensor de presión en el ancla (`S_PRES`)**, recomendado: mide la columna de agua sobre él, que es la profundidad real.
2. Un **ultrasónico en un poste fijo** en la orilla, que mida la distancia a la superficie.

Si eliges la opción 1, retira del diseño el brazo y el cabezal de nivel, y coloca el sensor en el ancla.

## 6. Carcasa y mecánica

| ID | Pieza | Notas |
|---|---|---|
| `CAJA` | Caja estanca **IP67**, ABS, ≈ 115 × 90 × 55 mm | El modelo de referencia usaba 110 × 90 × 70 mm. |
| `PRENSA` | Prensaestopas **PG7 / PG9** | Uno por cable que entra a la caja. |
| `CONEC` | Conectores de aviación **GX12 de 4 pines** | Para desconectar sondas y panel sin abrir la caja. |
| `MASTIL` | Tubo de PVC de 20 mm de diámetro, ≈ 80 cm | — |
| `FLOT` | Flotador de ≈ 30 cm de diámetro (espuma de polietileno cerrada o boya rígida) | Debe soportar el peso de caja, panel y mástil. |
| `ANCLA` | Bloque de concreto o saco de arena, con cuerda | La cocha de referencia tiene unos 0,4 m de profundidad. |

## 7. Conexión sugerida al ESP32 DevKit

| Señal | Pin | Tipo |
|---|---|---|
| `S_TDS` | GPIO 34 | Entrada analógica (ADC1) |
| `S_PH` | GPIO 35 | Entrada analógica (ADC1) |
| `S_SUELO` | GPIO 32 | Entrada analógica (ADC1) |
| Batería (divisor) | GPIO 33 | Entrada analógica (ADC1) |
| `S_TEMP` | GPIO 4 | 1-Wire |
| `S_UV` (LTR390) y `S_PRES` | GPIO 21 (SDA), GPIO 22 (SCL) | I2C, direcciones distintas |
| `GPS` | GPIO 16 (RX2), GPIO 17 (TX2) | UART |
| `LORA` (SX1276) | SPI: GPIO 18, 19, 23 y selección en GPIO 5 | SPI |

## 8. Cómo se relaciona con los datos

| Campo del contrato | Sensor | Estado en el contrato |
|---|---|---|
| `tds_ppm` | `S_TDS` (compensado con `S_TEMP`) | Existe |
| `temp_agua_c` | `S_TEMP` | Existe |
| `ph` | `S_PH` | Existe (opcional) |
| `uv_index` | `S_UV` | Existe (opcional) |
| `profundidad_m` | `S_PRES` | **Propuesto**, necesita aprobación de Pax |
| `humedad_suelo_pct` | `S_SUELO` | **Propuesto**, necesita aprobación de Pax |
