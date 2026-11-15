// Qocha Ñawi · firmware ESP32 (borrador)
// Imprime por USB una línea JSON por lectura; el puente (device/bridge/puente.py) la recoge.
// Pines según device/SENSORES.md sección 7. Calibrar TDS y pH con soluciones patrón.
//
// Bibliotecas: OneWire, DallasTemperature (DS18B20). Opcional: Adafruit LTR390 (UV).
#include <OneWire.h>
#include <DallasTemperature.h>

#define PIN_TDS 34
#define PIN_PH 35
#define PIN_TEMP 4
#define INTERVALO_MS 5000

// --- Calibración: ajustar con soluciones patrón ---
const float PH_PENDIENTE = -5.70;  // pH = PH_PENDIENTE * V + PH_OFFSET  (con buffers pH 4 y 7)
const float PH_OFFSET = 21.34;
const bool TIENE_PH = true;        // false si aún no hay sonda: el campo se omite

OneWire oneWire(PIN_TEMP);
DallasTemperature ds18b20(&oneWire);

float leerVoltaje(int pin) {
  long suma = 0;
  for (int i = 0; i < 30; i++) { suma += analogRead(pin); delay(2); }
  return (suma / 30.0) * 3.3 / 4095.0;
}

// Fórmula del SEN0244 con compensación por temperatura.
float leerTds(float tempC) {
  float v = leerVoltaje(PIN_TDS);
  float coef = 1.0 + 0.02 * (tempC - 25.0);
  float vc = v / coef;
  float tds = (133.42 * vc * vc * vc - 255.86 * vc * vc + 857.39 * vc) * 0.5;
  return tds < 0 ? 0 : tds;
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  ds18b20.begin();
}

void loop() {
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) {  // sensor de temperatura desconectado: no mandar lectura
    Serial.println("# DS18B20 desconectado");
    delay(INTERVALO_MS);
    return;
  }
  float tds = leerTds(t);
  Serial.print("{\"tds_ppm\":");
  Serial.print(tds, 1);
  Serial.print(",\"temp_agua_c\":");
  Serial.print(t, 2);
  if (TIENE_PH) {
    float ph = PH_PENDIENTE * leerVoltaje(PIN_PH) + PH_OFFSET;
    if (ph >= 0 && ph <= 14) { Serial.print(",\"ph\":"); Serial.print(ph, 2); }
  }
  Serial.println("}");
  delay(INTERVALO_MS);
}
