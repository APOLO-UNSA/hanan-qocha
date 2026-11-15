// Imágenes de presentación del gemelo (3840x2160, 16:9): pantallas reales de la app montadas en laptop y celular,
// con el texto de cada escena. También guarda las pantallas sueltas en <salida>/pantallas.
//
//   node twin/scripts/capturas.mjs [carpeta-salida] [idioma: es|en] [url-base]
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { abrir, espera } from './lib/navegador.mjs'
import { fija, portada, TEXTOS, W, H, BARRA_MOVIL } from './lib/maqueta.mjs'

const SALIDA = resolve(process.argv[2] ?? 'twin/capturas')
const LANG = process.argv[3] ?? 'es'
const BASE = process.argv[4] || `https://apolo-unsa.github.io/hanan-qocha/?lang=${LANG}&video=1`
const PANT = join(SALIDA, 'pantallas')
mkdirSync(PANT, { recursive: true })
const T = TEXTOS[LANG]

const subir = (nav, sel, margen) =>
  nav.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); scrollTo(0, e.getBoundingClientRect().top + scrollY - ${margen}); return true })()`)

// ---------- 1. Pantallas de la app ----------
const ESCRITORIO = [
  ['mapa', '#/', null],
  ['ficha', '#/cocha/QC-01', null],
  ['sensor', '#/cocha/QC-01', ['.k-sensor', 24]],
  ['curva', '#/cocha/QC-02', ['.panel-instrumento', 14]],
  ['comparador', '#/finca/QC-01', ['.finca-grid', 24]],
  ['comparador-no-apta', '#/finca/QC-10', ['.finca-grid', 24]],
]
let nav = await abrir({ ancho: 1600, alto: 900, escala: 2 })
try {
  for (const [nombre, ruta, desplazar] of ESCRITORIO) {
    await nav.ir(BASE + ruta)
    await espera(ruta === '#/' ? 5000 : 2800)
    if (desplazar) { await subir(nav, ...desplazar); await espera(2800) }
    await nav.imagenes()
    await nav.foto(join(PANT, `${nombre}.png`), { formato: 'png' })
    console.log(`  pantallas/${nombre}.png`)
  }
} finally { await nav.cerrar() }

nav = await abrir({ ancho: 390, alto: 844 - BARRA_MOVIL, escala: 3, movil: true })
try {
  const base = BASE.replace(/[?&]video=1/, '').replace('hanan-qocha/&', 'hanan-qocha/?')
  for (const [nombre, ruta, desplazar] of [['movil-ficha', '#/cocha/QC-01', null], ['movil-cosecha', '#/cocha/QC-01', ['.k-accion', 330]], ['movil-mapa', '#/', null]]) {
    await nav.ir(base + ruta)
    await espera(ruta === '#/' ? 5000 : 3000)
    if (desplazar) { await subir(nav, ...desplazar); await espera(2600) }
    await nav.imagenes()
    await nav.foto(join(PANT, `${nombre}.png`), { formato: 'png' })
    console.log(`  pantallas/${nombre}.png`)
  }
} finally { await nav.cerrar() }

// ---------- 2. Maquetas ----------
const img = (n) => pathToFileURL(join(PANT, `${n}.png`)).href
const E = T.escenas
const MAQUETAS = [
  ['00-portada', portada(T.titulo, img('mapa'), img('movil-ficha'))],
  ['01-mapa', fija('laptop-der', E.mapa, img('mapa'))],
  ['02-ficha', fija('laptop-izq', E.iac, img('ficha'))],
  ['03-agua-y-colonias', fija('laptop-der', E.agua, img('sensor'))],
  ['04-curva', fija('laptop-izq', E.curva, img('curva'))],
  ['05-cosecha', fija('movil', E.cosecha, img('movil-cosecha'))],
  ['06-comparador', fija('laptop-izq', E.comparador, img('comparador'))],
  ['07-celular', fija('movil', E.movil, img('movil-ficha'))],
]
const tmp = join(tmpdir(), `qt-maquetas-${Date.now()}`)
mkdirSync(tmp, { recursive: true })
nav = await abrir({ ancho: W, alto: H, escala: 2 })
try {
  for (const [nombre, html] of MAQUETAS) {
    const f = join(tmp, `${nombre}.html`)
    writeFileSync(f, html)
    await nav.ir(pathToFileURL(f).href)
    await nav.imagenes()
    await espera(300)
    await nav.foto(join(SALIDA, `${nombre}.jpg`), { calidad: 90 })
    console.log(`  ${nombre}.jpg`)
  }
} finally {
  await nav.cerrar()
  rmSync(tmp, { recursive: true, force: true })
}

// Las pantallas sueltas se guardan en JPG (los PNG solo hacían falta para componer las maquetas)
for (const f of readdirSync(PANT).filter((n) => n.endsWith('.png'))) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(PANT, f), '-q:v', '2', join(PANT, f.replace(/\.png$/, '.jpg'))])
  rmSync(join(PANT, f))
}
