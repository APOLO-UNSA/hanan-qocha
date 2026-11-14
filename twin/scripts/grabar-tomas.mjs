// Graba las tomas del gemelo para el video (ver twin/GRABACION.md) como MP4 1920x1080 a 30 fps.
// Usa Chrome sin ventana controlado por el protocolo DevTools (WebSocket nativo de Node ≥ 22) y ffmpeg.
//
//   node twin/scripts/grabar-tomas.mjs [carpeta-salida] [url-base]
//
// Por defecto graba la app publicada con datos de demo, en inglés y en modo presentación.
// Para grabar datos reales: pasar una url-base sin "datos=demo".
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const SALIDA = resolve(process.argv[2] ?? 'tomas-gemelo')
const BASE = process.argv[3] ?? 'https://apolo-unsa.github.io/hanan-qocha/?datos=demo&lang=en&video=1'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync)
if (!CHROME) throw new Error('No se encontró Chrome')
// Viewport CSS de 1600x900 a escala 1,2 → video de 1920x1080 nítido y con textos grandes
const VW = 1600, VH = 900, DSF = 1.2, W = 1920, H = 1080, PUERTO = 9333
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- Chrome + DevTools ----------
const perfil = join(tmpdir(), `qt-grabar-${Date.now()}`)
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PUERTO}`, `--user-data-dir=${perfil}`,
  `--window-size=${VW},${VH}`, '--hide-scrollbars', '--mute-audio',
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore' })

let ws, sig = 0
const pend = new Map(), oyentes = new Map()
async function conectar() {
  for (let i = 0; i < 50; i++) {
    try {
      const lista = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()
      const pag = lista.find((t) => t.type === 'page')
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

async function ir(url) {
  // Pasar por about:blank fuerza una carga completa aunque solo cambie el "#" (si no, no hay evento de carga).
  await cdp('Page.navigate', { url: 'about:blank' })
  await espera(150)
  const cargada = new Promise((ok) => oyentes.set('Page.loadEventFired', ok))
  await cdp('Page.navigate', { url })
  await cargada
  await js(`document.fonts.ready.then(() => true)`)
}

// Cursor visible (los navegadores sin ventana no lo dibujan): flecha que se mueve y "hace clic".
const CURSOR = `(() => {
  if (window.__cur) return
  const c = document.createElement('div')
  c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 10-6.5 1.4L16 21l-3 1.4-3.5-7.6L4 19z" fill="#fff" stroke="#11142a" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>'
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(-200px,-200px);transition:transform 0s;filter:drop-shadow(0 3px 4px #0006)'
  const anillo = c.querySelector('i')
  anillo.style.cssText = 'position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #d9a23f;opacity:0;transform:scale(.3)'
  document.body.appendChild(c)
  let x = -200, y = -200
  window.__cur = {
    a(nx, ny, ms) { c.style.transition = 'transform ' + ms + 'ms cubic-bezier(.45,.05,.25,1)'; c.style.transform = 'translate(' + nx + 'px,' + ny + 'px)'; x = nx; y = ny; return new Promise(r => setTimeout(r, ms)) },
    clic() { anillo.animate([{ opacity: .9, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.6)' }], { duration: 450 }); },
    get pos() { return [x, y] }
  }
})()`

// ---------- Grabación con screencast ----------
async function grabar(nombre, accion) {
  const dir = join(SALIDA, `.cuadros-${nombre}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const cuadros = []
  oyentes.set('Page.screencastFrame', async (p) => {
    const f = join(dir, `${String(cuadros.length).padStart(5, '0')}.jpg`)
    writeFileSync(f, Buffer.from(p.data, 'base64'))
    cuadros.push({ f, t: p.metadata.timestamp })
    cdp('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
  })
  await cdp('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 })
  // Un cambio mínimo cada cuadro mantiene el flujo de cuadros aunque la página esté quieta.
  await js(`(() => { const p = document.createElement('div'); p.id = '__tic'; p.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:.01;z-index:99998';
    document.body.appendChild(p); let k = 0; (function f() { p.style.background = (k++ % 2) ? '#000' : '#010101'; window.__ticRaf = requestAnimationFrame(f) })() })()`)
  const t0 = Date.now()
  await accion()
  await cdp('Page.stopScreencast')
  await js(`cancelAnimationFrame(window.__ticRaf); document.getElementById('__tic')?.remove()`)
  oyentes.delete('Page.screencastFrame')
  if (cuadros.length < 2) throw new Error(`${nombre}: no se capturaron cuadros`)

  // Duración real de cada cuadro → video de 30 fps constantes
  const lista = cuadros.map((c, i) => {
    const sig = cuadros[i + 1]?.t ?? c.t + 1 / 30
    return `file '${c.f.replaceAll('\\', '/')}'\nduration ${Math.max(0.001, sig - c.t).toFixed(4)}`
  })
  lista.push(`file '${cuadros.at(-1).f.replaceAll('\\', '/')}'`)
  writeFileSync(join(dir, 'lista.txt'), lista.join('\n'))
  const out = join(SALIDA, `${nombre}.mp4`)
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'lista.txt'),
    '-vf', `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17',
    '-movflags', '+faststart', out])
  rmSync(dir, { recursive: true, force: true })
  console.log(`✓ ${nombre}.mp4  (${((Date.now() - t0) / 1000).toFixed(1)} s, ${cuadros.length} cuadros)`)
}

// Mueve un slider con "mano": el cursor lo sigue y el valor cambia con aceleración suave.
const SLIDER = `async (nombre, desde, hasta, ms) => {
  const s = document.querySelector('input[name=' + nombre + ']')
  const r = s.getBoundingClientRect(), min = +s.min, max = +s.max
  const px = (v) => r.left + 11 + (r.width - 22) * (v - min) / (max - min)
  const t0 = performance.now()
  await new Promise((fin) => {
    const paso = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      const v = Math.round((desde + (hasta - desde) * e) / +s.step) * +s.step
      if (+s.value !== v) { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })) }
      window.__cur.a(px(v) - 4, r.top + r.height / 2 - 2, 0)
      k < 1 ? requestAnimationFrame(paso) : fin()
    }
    requestAnimationFrame(paso)
  })
}`

const centro = (sel) => js(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
const url = (hash) => `${BASE}${hash}`

// ---------- Tomas ----------
async function main() {
  mkdirSync(SALIDA, { recursive: true })
  await conectar()
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DSF, mobile: false })

  // 1 · "forecasts growth": la curva responde al slider de TDS (DEMO-02)
  await ir(url('#/cocha/DEMO-02'))
  await js(CURSOR)
  await espera(2800)
  await js(`(() => { document.querySelector('.panel-instrumento').scrollIntoView({ block: 'start' }); scrollBy(0, -14) })()`)
  await espera(1500)
  await js(`(async () => { const s = document.querySelector('input[name=tds_ppm]'); const r = s.getBoundingClientRect(); await window.__cur.a(r.left + 40, r.top + 60, 0) })()`)
  await grabar('pax-1-curva', async () => {
    await espera(500)
    await js(`(async () => { const s = document.querySelector('input[name=tds_ppm]'); const r = s.getBoundingClientRect();
      const x = r.left + 11 + (r.width - 22) * (+s.value - +s.min) / (+s.max - +s.min); await window.__cur.a(x - 4, r.top + r.height / 2 - 2, 600); window.__cur.clic() })()`)
    await espera(250)
    await js(`(${SLIDER})('tds_ppm', ${await js(`+document.querySelector('input[name=tds_ppm]').value`)}, 250, 2300)`)
    await espera(1300)
    await js(`(${SLIDER})('tds_ppm', 250, 30, 1500)`)
    await espera(900)
  })

  // 2 · "how much to harvest": la curva se dibuja y se ve la acción de cosecha (DEMO-01)
  await ir(url('#/cocha/DEMO-01'))
  await js(CURSOR)
  await espera(2600)
  // Se posiciona en la curva justo antes de grabar: así se graba cómo se dibuja al aparecer.
  await js(`(() => { const c = document.querySelector('.panel-instrumento'); c.scrollIntoView({ block: 'start' }); scrollBy(0, -16) })()`)
  await grabar('pax-2-cosecha', async () => {
    await espera(3600)
    const [x, y] = await centro('.k-accion .actions li:last-child')
    await js(`window.__cur.a(${VW * 0.55}, ${VH * 0.85}, 0)`)
    await js(`window.__cur.a(${x - 60}, ${y}, 1100)`)
    await espera(1500)
  })

  // 3 · "colonias marcadas": la serie de fotos de la cámara (DEMO-01)
  await js(`(() => { document.querySelector('.k-vision').scrollIntoView({ block: 'center' }) })()`)
  await espera(1200)
  await js(`document.querySelector('.thumbs').scrollLeft = 0`)
  await js(`document.querySelector('.thumbs button').click()`)
  await espera(500)
  await grabar('pax-3-colonias', async () => {
    await espera(400)
    const n = await js(`document.querySelectorAll('.thumbs button').length`)
    for (let i = 0; i < n; i++) {
      const [x, y] = await js(`(() => { const b = document.querySelectorAll('.thumbs button')[${i}]; b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
      await js(`window.__cur.a(${x}, ${y}, ${i ? 260 : 600})`)
      await js(`(() => { window.__cur.clic(); document.querySelectorAll('.thumbs button')[${i}].click() })()`)
      await espera(i === n - 1 ? 1600 : 420)
    }
  })

  // Extra · mapa: caen los pines, clic en una cocha, vuelo y entrada a su ficha
  // Primero se cargan las teselas del mapa; luego se vuelve a abrir la vista (desde caché) para grabar la caída de los pines.
  await ir(url('#/'))
  await espera(4000)
  await js(`location.hash = '#/_'`)
  await espera(300)
  await js(CURSOR)
  await grabar('extra-mapa-vuelo', async () => {
    await js(`location.hash = '#/'`)
    await espera(2600)
    const [x, y] = await js(`(() => { const p = [...document.querySelectorAll('.leaflet-marker-icon')].find(m => m.title.includes('01')) ?? document.querySelector('.leaflet-marker-icon'); const r = p.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
    await js(`window.__cur.a(${VW * 0.62}, ${VH * 0.7}, 0)`)
    await js(`window.__cur.a(${x}, ${y}, 1100)`)
    await espera(250)
    await js(`(() => { window.__cur.clic(); const p = [...document.querySelectorAll('.leaflet-marker-icon')].find(m => m.title.includes('01')) ?? document.querySelector('.leaflet-marker-icon'); p.click(); setTimeout(() => window.__cur.a(-200, -200, 400), 500) })()`)
    await espera(5200)
  })
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exitCode = 1 })
  .finally(() => { try { ws?.close() } catch {} chrome.kill(); setTimeout(() => rmSync(perfil, { recursive: true, force: true }), 800) })
