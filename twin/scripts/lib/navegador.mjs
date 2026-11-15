// Chrome sin ventana controlado por el protocolo DevTools (WebSocket nativo de Node ≥ 22).
// Lo usan grabar-tomas.mjs (video), capturas.mjs (imágenes) y montaje.mjs (gráficos del montaje).
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const espera = (ms) => new Promise((r) => setTimeout(r, ms))

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(existsSync)

/** Abre Chrome y devuelve un controlador de su primera pestaña. */
export async function abrir({ ancho = 1600, alto = 900, escala = 1, movil = false, puerto = 9300 + Math.floor(Math.random() * 400) } = {}) {
  if (!CHROME) throw new Error('No se encontró Chrome')
  const perfil = join(tmpdir(), `qt-chrome-${Date.now()}-${puerto}`)
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, `--window-size=${ancho},${alto}`,
    '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files',
    'about:blank',
  ], { stdio: 'ignore' })

  let ws, sig = 0
  const pend = new Map(), oyentes = new Map()
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const pag = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((t) => t.type === 'page')
      if (pag) {
        const s = new WebSocket(pag.webSocketDebuggerUrl)
        await new Promise((ok, mal) => ((s.onopen = ok), (s.onerror = mal)))
        s.onmessage = (ev) => {
          const m = JSON.parse(ev.data)
          if (m.id && pend.has(m.id)) {
            const { ok, mal } = pend.get(m.id)
            pend.delete(m.id)
            m.error ? mal(new Error(m.error.message)) : ok(m.result)
          } else if (m.method) oyentes.get(m.method)?.(m.params)
        }
        ws = s
      }
    } catch { /* Chrome todavía arrancando */ }
    if (!ws) await espera(200)
  }
  if (!ws) throw new Error('No se pudo conectar con Chrome')

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
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: ancho, height: alto, deviceScaleFactor: escala, mobile: movil })
  if (movil) await cdp('Emulation.setTouchEmulationEnabled', { enabled: false })

  const nav = {
    cdp, js, oyentes, ancho, alto, escala,
    /** Carga completa (pasar por about:blank fuerza el evento de carga aunque solo cambie el "#"). */
    async ir(url) {
      await cdp('Page.navigate', { url: 'about:blank' })
      await espera(150)
      const cargada = new Promise((ok) => oyentes.set('Page.loadEventFired', ok))
      await cdp('Page.navigate', { url })
      await cargada
      await js(`document.fonts.ready.then(() => true)`)
    },
    /** Espera a que carguen las imágenes visibles. */
    imagenes: () => js(`Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => (i.onload = i.onerror = r)))).then(() => true)`),
    /** Captura la vista actual. */
    async foto(ruta, { formato = 'jpeg', calidad = 92, transparente = false } = {}) {
      if (transparente) await cdp('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
      const { data } = await cdp('Page.captureScreenshot', { format: formato, ...(formato === 'jpeg' ? { quality: calidad } : {}) })
      writeFileSync(ruta, Buffer.from(data, 'base64'))
      if (transparente) await cdp('Emulation.setDefaultBackgroundColorOverride', {})
    },
    /** Graba lo que pasa durante `accion` como MP4 de 30 fps (ancho x alto en píxeles de salida). */
    async grabar(salida, accion, { w = ancho * escala, h = alto * escala } = {}) {
      const dir = `${salida}.cuadros`
      rmSync(dir, { recursive: true, force: true })
      mkdirSync(dir, { recursive: true })
      const cuadros = []
      oyentes.set('Page.screencastFrame', (p) => {
        const f = join(dir, `${String(cuadros.length).padStart(5, '0')}.jpg`)
        writeFileSync(f, Buffer.from(p.data, 'base64'))
        cuadros.push({ f, t: p.metadata.timestamp })
        cdp('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
      })
      await cdp('Page.startScreencast', { format: 'jpeg', quality: 93, maxWidth: w, maxHeight: h, everyNthFrame: 1 })
      // Un cambio mínimo en cada cuadro mantiene el flujo aunque la página esté quieta.
      await js(`(() => { const p = document.createElement('div'); p.id = '__tic'; p.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:.01;z-index:99998;pointer-events:none';
        document.body.appendChild(p); let k = 0; (function f() { p.style.background = (k++ % 2) ? '#000' : '#010101'; window.__ticRaf = requestAnimationFrame(f) })() })()`)
      await accion()
      await cdp('Page.stopScreencast')
      await js(`cancelAnimationFrame(window.__ticRaf); document.getElementById('__tic')?.remove()`)
      oyentes.delete('Page.screencastFrame')
      if (cuadros.length < 2) throw new Error(`${salida}: no se capturaron cuadros`)
      const lista = cuadros.map((c, i) => `file '${c.f.replaceAll('\\', '/')}'\nduration ${Math.max(0.001, (cuadros[i + 1]?.t ?? c.t + 1 / 30) - c.t).toFixed(4)}`)
      lista.push(`file '${cuadros.at(-1).f.replaceAll('\\', '/')}'`)
      writeFileSync(join(dir, 'lista.txt'), lista.join('\n'))
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'lista.txt'),
        '-vf', `fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
        '-movflags', '+faststart', salida])
      rmSync(dir, { recursive: true, force: true })
      return cuadros.length
    },
    async cerrar() {
      try { ws.close() } catch {}
      proc.kill()
      await espera(600)
      rmSync(perfil, { recursive: true, force: true, maxRetries: 5 })
    },
  }
  return nav
}

// ---------- Ayudas que se inyectan en la página ----------

/** Cursor visible (Chrome sin ventana no lo dibuja): se mueve con suavidad y "hace clic". */
export const CURSOR = `(() => {
  if (window.__cur) return true
  const c = document.createElement('div')
  c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2l15 10-6.5 1.4L16 21l-3 1.4-3.5-7.6L4 19z" fill="#fff" stroke="#11142a" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>'
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform:translate(-200px,-200px);filter:drop-shadow(0 3px 4px #0006)'
  const anillo = c.querySelector('i')
  anillo.style.cssText = 'position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:3px solid #d9a23f;opacity:0'
  document.body.appendChild(c)
  let x = -200, y = -200
  window.__cur = {
    a(nx, ny, ms) {
      c.style.transition = 'transform ' + ms + 'ms cubic-bezier(.45,.05,.25,1)'
      c.style.transform = 'translate(' + nx + 'px,' + ny + 'px)'; x = nx; y = ny
      // Que la página reciba el "hover" del cursor simulado
      setTimeout(() => {
        const el = document.elementFromPoint(nx, ny)
        if (el !== window.__hov) {
          window.__hov?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
          window.__hov?.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }))
          el?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: nx, clientY: ny }))
          window.__hov = el
        }
        el?.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: nx, clientY: ny }))
        el?.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: nx, clientY: ny }))
      }, ms)
      return new Promise(r => setTimeout(r, ms + 10))
    },
    clic() { anillo.animate([{ opacity: .95, transform: 'scale(.3)' }, { opacity: 0, transform: 'scale(1.7)' }], { duration: 480, easing: 'ease-out' }) },
    get pos() { return [x, y] }
  }
  return true
})()`

/** Desplazamiento suave con aceleración (scrollIntoView no deja controlar la duración). */
export const DESPLAZAR = `(y, ms) => new Promise((fin) => {
  const y0 = scrollY, t0 = performance.now()
  const paso = (t) => { const k = Math.min(1, (t - t0) / ms), e = k < .5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2
    scrollTo(0, y0 + (y - y0) * e); k < 1 ? requestAnimationFrame(paso) : fin() }
  requestAnimationFrame(paso)
})`

/** Mueve un slider "a mano": el cursor lo sigue y el valor cambia con aceleración suave. */
export const SLIDER = `async (sel, hasta, ms) => {
  const s = document.querySelector(sel)
  const r = s.getBoundingClientRect(), min = +s.min, max = +s.max, desde = +s.value, paso = +s.step || 1
  const px = (v) => r.left + 11 + (r.width - 22) * (v - min) / (max - min)
  await window.__cur.a(px(desde) - 4, r.top + r.height / 2 - 2, 650); window.__cur.clic()
  await new Promise((r2) => setTimeout(r2, 200))
  const t0 = performance.now()
  await new Promise((fin) => {
    const f = (ahora) => {
      const k = Math.min(1, (ahora - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      const v = Math.round((desde + (hasta - desde) * e) / paso) * paso
      if (+s.value !== v) { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })) }
      window.__cur.a(px(v) - 4, r.top + r.height / 2 - 2, 0)
      k < 1 ? requestAnimationFrame(f) : fin()
    }
    requestAnimationFrame(f)
  })
}`

/** Lleva el cursor al centro de un elemento y hace clic en él. */
export const CLIC = `async (sel, ms = 750, i = 0) => {
  const e = typeof sel === 'string' ? document.querySelectorAll(sel)[i] : sel
  const r = e.getBoundingClientRect()
  await window.__cur.a(r.left + r.width / 2, r.top + r.height / 2, ms)
  window.__cur.clic(); await new Promise((r2) => setTimeout(r2, 120)); e.click()
}`
