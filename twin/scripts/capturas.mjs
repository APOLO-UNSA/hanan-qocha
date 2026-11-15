// Capturas fijas del gemelo para las diapositivas del pitch (3200x1800, 16:9, nítidas al proyectar).
// Chrome sin ventana por el protocolo DevTools, con esperas reales para que terminen las animaciones.
//
//   node twin/scripts/capturas.mjs [carpeta-salida] [url-base] [idioma]
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const SALIDA = resolve(process.argv[2] ?? 'twin/capturas')
const LANG = process.argv[4] ?? 'es'
const BASE = process.argv[3] || `https://apolo-unsa.github.io/hanan-qocha/?lang=${LANG}`
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync)
if (!CHROME) throw new Error('No se encontró Chrome')
const VW = 1600, VH = 900, DSF = 2, PUERTO = 9334
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const perfil = join(tmpdir(), `qt-capturas-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  `--window-size=${VW},${VH}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })

let ws, sig = 0
const pend = new Map(), oyentes = new Map()
async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const pag = (await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()).find((t) => t.type === 'page')
      if (pag) {
        ws = new WebSocket(pag.webSocketDebuggerUrl)
        await new Promise((ok, mal) => ((ws.onopen = ok), (ws.onerror = mal)))
        ws.onmessage = (ev) => {
          const m = JSON.parse(ev.data)
          if (m.id && pend.has(m.id)) {
            const { ok, mal } = pend.get(m.id)
            pend.delete(m.id)
            m.error ? mal(new Error(m.error.message)) : ok(m.result)
          } else if (m.method) oyentes.get(m.method)?.(m.params)
        }
        return
      }
    } catch { /* Chrome todavía arrancando */ }
    await espera(200)
  }
  throw new Error('No se pudo conectar con Chrome')
}
const cdp = (method, params = {}) =>
  new Promise((ok, mal) => {
    const id = ++sig
    pend.set(id, { ok, mal })
    ws.send(JSON.stringify({ id, method, params }))
  })
const js = async (expr) => {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'error en la página')
  return r.result.value
}
async function ir(ruta) {
  await cdp('Page.navigate', { url: 'about:blank' })
  await espera(150)
  const cargada = new Promise((ok) => oyentes.set('Page.loadEventFired', ok))
  await cdp('Page.navigate', { url: BASE + ruta })
  await cargada
  await js(`document.fonts.ready.then(() => true)`)
}
/** Lleva un elemento cerca del borde superior y espera a que se revele y anime. */
async function a(selector, margen = 24) {
  await js(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); scrollTo(0, e.getBoundingClientRect().top + scrollY - ${margen}); return true })()`)
  await espera(2600)
}
async function foto(nombre) {
  await js(`Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r)))).then(() => true)`)
  const { data } = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
  writeFileSync(join(SALIDA, `${nombre}.jpg`), Buffer.from(data, 'base64'))
  console.log(`  ${nombre}.jpg`)
}

const TOMAS = [
  ['01-mapa', async () => { await ir('#/'); await espera(5000) }],
  ['02-ficha', async () => { await ir('#/cocha/QC-01'); await espera(3500) }],
  ['03-ficha-sensor-y-camara', async () => { await ir('#/cocha/QC-01'); await espera(1500); await a('#sensor', 140) }],
  ['04-ficha-curva-y-accion', async () => { await ir('#/cocha/QC-01'); await espera(1500); await a('.k-curva') }],
  ['05-comparador', async () => { await ir('#/finca/QC-01'); await espera(3500) }],
  ['06-comparador-estrategias', async () => { await ir('#/finca/QC-01'); await espera(1500); await a('.finca-grid', 40) }],
  ['07-comparador-cocha-no-apta', async () => { await ir('#/finca/QC-10'); await espera(1500); await a('.finca-grid', 40) }],
]

mkdirSync(SALIDA, { recursive: true })
try {
  await conectar()
  await cdp('Page.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DSF, mobile: false })
  for (const [nombre, preparar] of TOMAS) {
    await preparar()
    await foto(nombre)
  }
} finally {
  ws?.close()
  chrome.kill()
  await espera(500)
  rmSync(perfil, { recursive: true, force: true, maxRetries: 5 })
}
