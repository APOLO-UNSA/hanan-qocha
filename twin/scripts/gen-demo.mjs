// Genera el conjunto de DEMO del gemelo en twin/public/demo/ (datos ficticios para el video/pitch).
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
  { n: 'Cocha demo 01 · sector norte', lat: -15.781, lon: -71.334, alt: 4385, sat: 0.84, perfil: 'buena', fotos: 8, fase: 'lista' },
  { n: 'Cocha demo 02 · sector norte', lat: -15.803, lon: -71.298, alt: 4402, sat: 0.78, perfil: 'buena', fotos: 6, fase: 'creciendo' },
  { n: 'Cocha demo 03 · sector norte', lat: -15.842, lon: -71.362, alt: 4350, sat: 0.71, perfil: 'calida', fotos: 5, fase: 'lenta' },
  { n: 'Cocha demo 04 · sector centro', lat: -15.921, lon: -71.215, alt: 4420, sat: 0.66, perfil: 'buena', fotos: 1, fase: 'sembrada' },
  { n: 'Cocha demo 05 · sector centro', lat: -15.958, lon: -71.268, alt: 4310, sat: 0.58, perfil: 'media', fotos: 4, fase: 'creciendo' },
  { n: 'Cocha demo 06 · sector centro', lat: -16.012, lon: -71.181, alt: 4280, sat: 0.74, perfil: 'buena', fotos: 0 },
  { n: 'Cocha demo 07 · sector centro', lat: -16.054, lon: -71.322, alt: 4190, sat: 0.47, perfil: 'salina', fotos: 0 },
  { n: 'Cocha demo 08 · sector sur', lat: -16.118, lon: -71.243, alt: 4150, sat: 0.52, perfil: 'media', fotos: 0 },
  { n: 'Cocha demo 09 · sector sur', lat: -16.196, lon: -71.395, alt: 4300, sat: 0.62, perfil: 'buena', fotos: 0 },
  { n: 'Cocha demo 10 · sector sur', lat: -16.261, lon: -71.152, alt: 3980, sat: 0.28, perfil: 'salina', fotos: 0 },
  { n: 'Cocha demo 11 · sector sur', lat: -16.318, lon: -71.288, alt: 4060, sat: 0.36, perfil: 'calida', fotos: 0 },
  { n: 'Cocha demo 12 · sector norte', lat: -15.744, lon: -71.251, alt: 4460, sat: 0.69, perfil: 'media', fotos: 0 },
]

const PERFILES = {
  buena: { tds: [30, 80], temp: [8, 13], uv: [7, 11], ph: [6.8, 7.6] },
  media: { tds: [90, 140], temp: [10, 15], uv: [9, 13], ph: [7.0, 8.0] },
  calida: { tds: [60, 110], temp: [16, 20], uv: [12, 15], ph: [7.2, 8.2] },
  salina: { tds: [190, 280], temp: [11, 16], uv: [10, 14], ph: [7.8, 8.8] },
}
// Tasa efectiva diaria según la fase (coherente con el modelo del gemelo)
const FASES = { lista: 0.095, creciendo: 0.085, lenta: 0.03, sembrada: 0.05 }

const sites = [], sensor = [], vision = []

COCHAS.forEach((c, i) => {
  const id = `DEMO-${String(i + 1).padStart(2, '0')}`
  sites.push({ cocha_id: id, nombre: c.n, lat: c.lat, lon: c.lon, altitud_m: c.alt, indice_satelital: c.sat })

  // Sensor: una lectura cada 6 h durante los últimos 2 días, con ciclo diario de temperatura.
  const p = PERFILES[c.perfil]
  const base = { tds: between(...p.tds), temp: between(...p.temp), uv: between(...p.uv), ph: between(...p.ph) }
  for (let k = 8; k >= 0; k--) {
    const t = NOW - k * 6 * 3600e3
    const hour = new Date(t - 5 * 3600e3).getUTCHours()
    const dia = Math.sin(((hour - 8) / 24) * 2 * Math.PI) // pico a mediodía
    sensor.push({
      cocha_id: id,
      timestamp: iso(t),
      tds_ppm: round(base.tds + between(-6, 6), 0),
      temp_agua_c: round(base.temp + 2.5 * dia + between(-0.4, 0.4)),
      ph: round(base.ph + between(-0.1, 0.1)),
      uv_index: round(Math.max(0, base.uv * Math.max(0, dia + 0.2)), 1),
    })
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
      const foto = `demo/fotos/${id}-${String(n + 1).padStart(2, '0')}.svg`
      vision.push({ cocha_id: id, timestamp: iso(t), foto, cobertura_pct: round(cob), biomasa_kg: round(obs) })
      writeFileSync(resolve(OUT, 'fotos', foto.split('/').pop()), fotoSvg(cob, `${id} · foto ${n + 1}`))
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

/** Foto sintética de la cocha: agua, colonias según la cobertura y contornos "marcados" por la visión. */
function fotoSvg(coberturaPct, etiqueta) {
  const W = 400, H = 300
  const area = (coberturaPct / 100) * W * H * 0.9
  const blobs = []
  let acc = 0
  while (acc < area && blobs.length < 120) {
    const r = between(6, 7 + coberturaPct / 3)
    blobs.push({ x: between(r, W - r), y: between(r, H - r), r })
    acc += Math.PI * r * r * 0.8
  }
  const colonias = blobs
    .map(({ x, y, r }) => {
      const rx = round(r * between(0.85, 1.15)), ry = round(r * between(0.8, 1.1))
      return `<g><ellipse cx="${round(x)}" cy="${round(y)}" rx="${rx}" ry="${ry}" fill="url(#c)"/><ellipse cx="${round(x)}" cy="${round(y)}" rx="${round(rx + 2)}" ry="${round(ry + 2)}" fill="none" stroke="#ffd23f" stroke-width="1.5" stroke-dasharray="3 2"/></g>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
<defs>
<radialGradient id="w" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#5d8a8c"/><stop offset="1" stop-color="#2b4a4f"/></radialGradient>
<radialGradient id="c" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#9bbf4a"/><stop offset=".7" stop-color="#4f7a2a"/><stop offset="1" stop-color="#2f4f1c"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#w)"/>
<path d="M0 ${H - 18} Q ${W / 3} ${H - 30} ${W / 2} ${H - 14} T ${W} ${H - 22} V ${H} H 0 Z" fill="#6b5a3e" opacity=".7"/>
${colonias}
<rect x="0" y="0" width="${W}" height="22" fill="#000" opacity=".45"/>
<text x="8" y="15" font-family="monospace" font-size="11" fill="#fff">Qocha Ñawi · ${etiqueta}</text>
<text x="${W - 8}" y="15" font-family="monospace" font-size="11" fill="#ffd23f" text-anchor="end">${blobs.length} colonias · ${round(coberturaPct)} %</text>
<text x="8" y="${H - 6}" font-family="monospace" font-size="10" fill="#fff" opacity=".8">IMAGEN SINTÉTICA (DEMO)</text>
</svg>
`
}
