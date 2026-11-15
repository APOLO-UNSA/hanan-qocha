// Graba las tomas del gemelo (ver twin/GRABACION.md) como MP4 de 30 fps, con un cursor visible.
// Las tomas de escritorio salen en 1920x1080; la del celular, en 780x1688.
//
//   node twin/scripts/grabar-tomas.mjs [carpeta-salida] [idioma: en|es] [url-base]
//
// Por defecto: la app publicada, en inglés y en modo presentación (?video=1).
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { abrir, espera, CURSOR, DESPLAZAR, SLIDER, CLIC } from './lib/navegador.mjs'

const SALIDA = resolve(process.argv[2] ?? 'tomas-gemelo')
const LANG = process.argv[3] ?? 'en'
const BASE = process.argv[4] || `https://apolo-unsa.github.io/hanan-qocha/?lang=${LANG}&video=1`
const SOLO = process.env.TOMAS?.split(',') // p. ej. TOMAS=extra-comparador para grabar solo esa
mkdirSync(SALIDA, { recursive: true })

// Escritorio: 1600x900 CSS a escala 1,2 → 1920x1080 nítido y con textos grandes
const VW = 1600, VH = 900

const centro = (nav, sel, i = 0) =>
  nav.js(`(() => { const r = document.querySelectorAll(${JSON.stringify(sel)})[${i}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
const yDe = (nav, sel, margen = 20) =>
  nav.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return Math.max(0, e.getBoundingClientRect().top + scrollY - ${margen}) })()`)

const TOMAS = {
  // Mapa: caen los pines, filtros, resaltado lista ↔ pin, tooltip y vuelo a la ficha
  async 'extra-mapa-vuelo'(nav, out) {
    await nav.ir(`${BASE}#/`)
    await espera(4500) // teselas en caché
    await nav.js(`location.hash = '#/_'`)
    await espera(300)
    await nav.js(CURSOR)
    await nav.grabar(out, async () => {
      await nav.js(`location.hash = '#/'`)
      await espera(2400)
      await nav.js(`window.__cur.a(${VW * 0.5}, ${VH * 0.75}, 0)`)
      await nav.js(`(${CLIC})('.filtros [data-f="apta"]', 900)`)
      await espera(1100)
      await nav.js(`(${CLIC})('.filtros [data-f="no-apta"]', 500)`)
      await espera(1100)
      await nav.js(`(${CLIC})('.filtros [data-f="todas"]', 600)`)
      await espera(700)
      for (const i of [0, 1, 2]) {
        const [x, y] = await centro(nav, '.cocha-list li', i)
        await nav.js(`window.__cur.a(${x - 60}, ${y}, ${i ? 380 : 800})`)
        await espera(650)
      }
      const [x, y] = await nav.js(`(() => { const p = [...document.querySelectorAll('.leaflet-marker-icon')].find(m => m.title.includes('01')); const r = p.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2 - 6] })()`)
      await nav.js(`window.__cur.a(${x}, ${y}, 1000)`)
      await espera(900)
      await nav.js(`(() => { window.__cur.clic(); [...document.querySelectorAll('.leaflet-marker-icon')].find(m => m.title.includes('01')).click(); setTimeout(() => window.__cur.a(${VW + 60}, ${VH * 0.6}, 500), 400) })()`)
      await espera(5200)
    })
  },

  // Ficha: anillo del IAC, ruta de cultivo y lectura del sensor con su historial
  async 'extra-ficha'(nav, out) {
    await nav.ir(`${BASE}#/cocha/QC-01`)
    await nav.imagenes()
    await espera(3000)
    await nav.ir(`${BASE}#/cocha/QC-01`) // segunda carga, todo en caché: la entrada se ve completa
    await nav.js(CURSOR)
    await nav.grabar(out, async () => {
      await espera(2600)
      const [x, y] = await centro(nav, '#iac-ring')
      await nav.js(`window.__cur.a(${VW * 0.45}, ${VH * 0.8}, 0)`)
      await nav.js(`window.__cur.a(${x}, ${y}, 900)`)
      await espera(900)
      await nav.js(`(${DESPLAZAR})(${await yDe(nav, '#ruta', 110)}, 1300)`)
      await espera(700)
      await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.k-sensor', 24)}, 1500)`)
      await espera(400)
      const [hx, hy] = await centro(nav, '.hist-svg', 1)
      await nav.js(`window.__cur.a(${hx}, ${hy}, 900)`)
      await espera(1400)
    })
  },

  // Visión: la serie de fotos con colonias marcadas (QC-01)
  async 'pax-3-colonias'(nav, out) {
    await nav.ir(`${BASE}#/cocha/QC-01`)
    await nav.js(CURSOR)
    await espera(2200)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.k-vision', 30)}, 10)`)
    await nav.js(`document.querySelector('.thumbs').scrollLeft = 0; document.querySelector('.thumbs button').click()`)
    await nav.imagenes()
    await espera(1200)
    await nav.grabar(out, async () => {
      await espera(400)
      const n = await nav.js(`document.querySelectorAll('.thumbs button').length`)
      for (let i = 0; i < n; i++) {
        await nav.js(`document.querySelectorAll('.thumbs button')[${i}].scrollIntoView({ block: 'nearest', inline: 'nearest' })`)
        await nav.js(`(${CLIC})('.thumbs button', ${i ? 300 : 700}, ${i})`)
        await espera(i === n - 1 ? 1800 : 520)
      }
    })
  },

  // Curva: el cursor recorre la proyección y el slider de TDS la cambia (QC-02)
  async 'pax-1-curva'(nav, out) {
    await nav.ir(`${BASE}#/cocha/QC-02`)
    await nav.js(CURSOR)
    await espera(2800)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.panel-instrumento', 14)}, 10)`)
    await espera(3200)
    await nav.grabar(out, async () => {
      const r = await nav.js(`(() => { const r = document.querySelector('.panel-instrumento svg').getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })()`)
      await nav.js(`window.__cur.a(${r[0] + r[2] * 0.15}, ${r[1] + r[3] * 0.55}, 0)`)
      await espera(300)
      for (const k of [0.3, 0.5, 0.7, 0.86]) {
        await nav.js(`window.__cur.a(${r[0] + r[2] * k}, ${r[1] + r[3] * 0.5}, 520)`)
        await espera(160)
      }
      await espera(400)
      const tds = await nav.js(`+document.querySelector('input[name=tds_ppm]').value`)
      await nav.js(`(${SLIDER})('input[name=tds_ppm]', 250, 2200)`)
      await espera(1300)
      await nav.js(`(${SLIDER})('input[name=tds_ppm]', ${tds}, 1500)`)
      await espera(900)
    })
  },

  // Cosecha: la curva se dibuja al aparecer y se señala la acción "Cosechar 30,9 kg" (QC-01)
  async 'pax-2-cosecha'(nav, out) {
    await nav.ir(`${BASE}#/cocha/QC-01`)
    await nav.js(CURSOR)
    await espera(2600)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.panel-instrumento', 16)}, 10)`)
    await nav.grabar(out, async () => {
      await espera(3400)
      const [x, y] = await centro(nav, '.k-accion .actions li:last-child')
      await nav.js(`window.__cur.a(${VW * 0.55}, ${VH * 0.85}, 0)`)
      await nav.js(`window.__cur.a(${x - 60}, ${y}, 1100)`)
      await espera(1700)
    })
  },

  // Comparador de estrategias: prioridades que reordenan, sequía y una cocha no apta
  async 'extra-comparador'(nav, out) {
    await nav.ir(`${BASE}#/finca/QC-01`)
    await espera(2500)
    await nav.ir(`${BASE}#/finca/QC-01`)
    await nav.js(CURSOR)
    await nav.grabar(out, async () => {
      await espera(1600)
      await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.finca-grid', 24)}, 1200)`)
      await nav.js(`window.__cur.a(${VW * 0.45}, ${VH * 0.7}, 0)`)
      await nav.js(`(${CLIC})('.prio[data-k="suelo"] button[data-v="2"]', 900)`)
      await espera(1500)
      await nav.js(`(${CLIC})('.prio[data-k="suelo"] button[data-v="0"]', 500)`)
      await nav.js(`(${CLIC})('.prio[data-k="ingreso"] button[data-v="2"]', 600)`)
      await espera(1500)
      await nav.js(`(${SLIDER})('#lluvia', -40, 1800)`)
      await espera(1300)
      await nav.js(`(${SLIDER})('#lluvia', 0, 1000)`)
      await espera(500)
      await nav.js(`(${DESPLAZAR})(0, 900)`)
      const [x, y] = await centro(nav, '#sel-cocha')
      await nav.js(`window.__cur.a(${x}, ${y}, 900)`)
      await nav.js(`(() => { window.__cur.clic(); const s = document.querySelector('#sel-cocha'); s.value = 'QC-10'; s.dispatchEvent(new Event('change')) })()`)
      await espera(900)
      await nav.js(`(${CURSOR})`) // la vista nueva reemplaza el contenido, el cursor sigue en <body>
      await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.finca-grid', 24)}, 1200)`)
      const [cx, cy] = await nav.js(`(() => { const e = document.querySelector('.estr.no-rec .estr-badge'); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
      await nav.js(`window.__cur.a(${cx}, ${cy + 4}, 900)`)
      await espera(1800)
    })
  },
}

// En el celular del productor: la ficha de arriba abajo (sin cursor: es táctil)
async function tomaMovil(out) {
  const nav = await abrir({ ancho: 390, alto: 804, escala: 2, movil: true }) // 844 menos la barra de estado de la maqueta
  try {
    const base = BASE.replace('&video=1', '').replace('?video=1&', '?').replace('?video=1', '')
    await nav.ir(`${base}#/cocha/QC-01`)
    await nav.imagenes()
    await espera(3000)
    await nav.ir(`${base}#/cocha/QC-01`)
    await nav.grabar(out, async () => {
      await espera(2600)
      for (const sel of ['#ruta', '.k-sensor', '.k-vision', '.panel-instrumento', '.k-accion']) {
        await nav.js(`(${DESPLAZAR})(${await yDe(nav, sel, 70)}, 1300)`)
        await espera(1100)
      }
    }, { w: 780, h: 1608 })
  } finally {
    await nav.cerrar()
  }
}

const nav = await abrir({ ancho: VW, alto: VH, escala: 1.2 })
try {
  for (const [nombre, toma] of Object.entries(TOMAS)) {
    if (SOLO && !SOLO.includes(nombre)) continue
    const t0 = Date.now()
    await toma(nav, join(SALIDA, `${nombre}.mp4`))
    console.log(`✓ ${nombre}.mp4  (${((Date.now() - t0) / 1000).toFixed(1)} s)`)
  }
} finally {
  await nav.cerrar()
}
if (!SOLO || SOLO.includes('extra-movil')) {
  await tomaMovil(join(SALIDA, 'extra-movil.mp4'))
  console.log('✓ extra-movil.mp4')
}
