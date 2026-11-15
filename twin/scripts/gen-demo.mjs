// Genera el conjunto de DEMO del gemelo en twin/public/demo/ (datos ficticios para el video/pitch).
// Las fotos (*.jpg) las dibuja después scripts/gen-fotos.py a partir de vision.json.
// Cumple los contratos de data/contracts/. Uso: node scripts/gen-demo.mjs
// Es determinista (semilla fija): volver a correrlo da los mismos archivos.
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const OUT = resolve(import.meta.dirname, '../public/demo')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(resolve(OUT, 'fotos'), { recursive: true })

// PRNG con semilla (mulberry32)
let seed = 20261114
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (a, b) => a + rnd() * (b - a)
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d

const NOW = Date.parse('2026-11-14T10:00:00-05:00')
const DAY = 864e5
const iso = (t) => new Date(t - 5 * 3600e3).toISOString().replace('Z', '-05:00').replace(/\.\d{3}/, '')

// Cochas ficticias repartidas por la zona de Salinas y Aguada Blanca.
// perfil: condiciones del agua; fotos: nº de fotos semanales (0 = sin cámara); fase: avance del crecimiento
const COCHAS = [
  { n: 'Cocha 01 (norte)', lat: -15.781, lon: -71.334, alt: 4385, sat: 0.84, perfil: 'buena', fotos: 8, fase: 'lista' },
  { n: 'Cocha 02 (norte)', lat: -15.803, lon: -71.298, alt: 4402, sat: 0.78, perfil: 'buena', fotos: 6, fase: 'creciendo' },
  { n: 'Cocha 03 (norte)', lat: -15.842, lon: -71.362, alt: 4350, sat: 0.71, perfil: 'calida', fotos: 5, fase: 'lenta' },
  { n: 'Cocha 04 (centro)', lat: -15.921, lon: -71.215, alt: 4420, sat: 0.66, perfil: 'buena', fotos: 1, fase: 'sembrada' },
  { n: 'Cocha 05 (centro)', lat: -15.958, lon: -71.268, alt: 4310, sat: 0.58, perfil: 'media', fotos: 4, fase: 'creciendo' },
  { n: 'Cocha 06 (centro)', lat: -16.012, lon: -71.181, alt: 4280, sat: 0.74, perfil: 'buena', fotos: 0 },
  { n: 'Cocha 07 (centro)', lat: -16.054, lon: -71.322, alt: 4190, sat: 0.47, perfil: 'salina', fotos: 0 },
  { n: 'Cocha 08 (sur)', lat: -16.118, lon: -71.243, alt: 4150, sat: 0.52, perfil: 'media', fotos: 0 },
  { n: 'Cocha 09 (sur)', lat: -16.196, lon: -71.395, alt: 4300, sat: 0.62, perfil: 'buena', fotos: 0 },
  { n: 'Cocha 10 (sur)', lat: -16.261, lon: -71.152, alt: 3980, sat: 0.28, perfil: 'salina', fotos: 0 },
  { n: 'Cocha 11 (sur)', lat: -16.318, lon: -71.288, alt: 4060, sat: 0.36, perfil: 'calida', fotos: 0 },
  { n: 'Cocha 12 (norte)', lat: -15.744, lon: -71.251, alt: 4460, sat: 0.69, perfil: 'media', fotos: 0 },
]

// Lecturas del sensor: modelo del simulador de Qocha Ñawi de Paolo (device/simulacion/simulador.py).
// Tres casos de agua; cada cocha toma uno según su perfil, con una pequeña variación propia.
const CASOS_SENSOR = {
  propicia: { tds: 40, tds_ruido: 0.06, t_media: 10.0, t_amp: 2.5, ph: 7.1, ph_amp: 0.15, uv_pico: 10.0 },
  media: { tds: 180, tds_ruido: 0.05, t_media: 19.0, t_amp: 3.0, ph: 7.8, ph_amp: 0.2, uv_pico: 13.0 },
  debil: { tds: 260, tds_ruido: 0.04, t_media: 22.0, t_amp: 3.0, ph: 8.7, ph_amp: 0.2, uv_pico: 15.5 },
}
const CASO_DE_PERFIL = { buena: 'propicia', media: 'media', calida: 'media', salina: 'debil' }

// Generador propio para el sensor (la secuencia principal no cambia: la visión y sus fotos siguen iguales)
function prng(semilla) {
  let a = semilla
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Una lectura como la del simulador de Paolo: ciclo diario de temperatura (más fría a las 4 h), UV de día y pH. */
function lecturaSensor(p, hora, r) {
  const u = (a, b) => a + r() * (b - a)
  const temp = p.t_media + p.t_amp * Math.sin((2 * Math.PI * (hora - 10)) / 24)
  const uv = p.uv_pico * Math.max(0, Math.sin((Math.PI * (hora - 6)) / 12))
  const tds = p.tds * (1 + u(-p.tds_ruido, p.tds_ruido))
  const ph = p.ph + p.ph_amp * Math.sin((2 * Math.PI * (hora - 12)) / 24) + u(-0.03, 0.03)
  return { tds_ppm: round(tds, 0), temp_agua_c: round(temp + u(-0.2, 0.2)), ph: round(ph), uv_index: round(uv) }
}

// Tasa efectiva diaria según la fase (coherente con el modelo del gemelo)
const FASES = { lista: 0.095, creciendo: 0.085, lenta: 0.03, sembrada: 0.05 }

const sites = [], sensor = [], vision = []

COCHAS.forEach((c, i) => {
  const id = `QC-${String(i + 1).padStart(2, '0')}`
  sites.push({ cocha_id: id, nombre: c.n, lat: c.lat, lon: c.lon, altitud_m: c.alt, indice_satelital: c.sat })

  // Sensor: una lectura cada 6 h durante los últimos 2 días, con el modelo del simulador de Paolo.
  for (let k = 0; k < 4 + 9 * 3; k++) rnd() // misma cantidad de números que antes: no altera la serie de visión
  const rs = prng(1000 + i * 7919)
  const caso = CASOS_SENSOR[CASO_DE_PERFIL[c.perfil]]
  const p = { ...caso, tds: caso.tds * (0.85 + 0.3 * rs()), t_media: caso.t_media + (rs() - 0.5) * 2, uv_pico: caso.uv_pico * (0.9 + 0.2 * rs()) }
  for (let k = 8; k >= 0; k--) {
    const t = NOW - k * 6 * 3600e3
    const hora = new Date(t - 5 * 3600e3).getUTCHours()
    sensor.push({ cocha_id: id, timestamp: iso(t), ...lecturaSensor(p, hora, rs) })
  }

  // Visión: serie semanal con crecimiento logístico + ruido.
  if (c.fotos > 0) {
    const K = between(28, 55)
    const r = FASES[c.fase]
    const pesoInicial = c.fase === 'sembrada' ? 0.06 : between(0.06, 0.1)
    let b = K * pesoInicial
    for (let k = c.fotos - 1, n = 0; k >= 0; k--, n++) {
      const t = NOW - k * 7 * DAY
      if (n > 0) for (let d = 0; d < 7; d++) b = b + r * b * (1 - b / K)
      const obs = Math.max(0.2, b * between(0.94, 1.06))
      const cob = Math.min(100, (100 * obs) / K)
      const foto = `demo/fotos/${id}-${String(n + 1).padStart(2, '0')}.jpg`
      vision.push({ cocha_id: id, timestamp: iso(t), foto, cobertura_pct: round(cob), biomasa_kg: round(obs) })
    }
  }
})

const recommendations = [
  { codigo: 'TDS_ALTO', condicion: 'tds_ppm > 150', mensaje_es: 'El agua tiene muchos sólidos disueltos; evita cosechar aquí por ahora.', mensaje_en: 'Water has high dissolved solids; avoid harvesting here for now.' },
  { codigo: 'AGUA_CALIDA', condicion: 'temp_agua_c > 17', mensaje_es: 'El agua está muy tibia: da sombra con champas o paja en las horas de sol.', mensaje_en: 'Water is too warm: shade the pond with sod or straw during sunny hours.' },
  { codigo: 'PH_ALTO', condicion: 'ph > 8.5', mensaje_es: 'El agua es muy alcalina; conviene llevar una muestra a analizar.', mensaje_en: 'Water is too alkaline; take a sample for lab analysis.' },
  { codigo: 'OK', condicion: 'tds_ppm <= 150', mensaje_es: 'Las condiciones son buenas para el cushuro.', mensaje_en: 'Conditions are good for cushuro.' },
]

const write = (name, data) =>
  writeFileSync(resolve(OUT, `${name}.json`), '[\n' + data.map((d) => '  ' + JSON.stringify(d)).join(',\n') + '\n]\n')
write('sites', sites)
write('sensor', sensor)
write('vision', vision)
write('recommendations', recommendations)
console.log(`demo: ${sites.length} cochas, ${sensor.length} lecturas, ${vision.length} fotos → ${OUT}`)
