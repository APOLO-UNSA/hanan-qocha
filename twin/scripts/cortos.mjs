// Tomas cortas para el video de 30 s del equipo, grabadas a propósito para cada duración:
// encuadre cerrado sobre la función (grabado en alta resolución y recortado), la acción empieza en el primer cuadro,
// acercamiento lento y fundidos suaves entre planos (sin cortes secos).
//
//   node twin/scripts/cortos.mjs [carpeta-salida] [idioma: en|es]
//
// Salen, en <salida>/cortes-30s-<idioma>/:
//   gemelo-21-26s.mp4   5,00 s  curva que responde (forecasts growth) → colonias (when) → cosecha (how much)
//   mapa-3s.mp4         3,00 s  pines sobre la imagen satelital
//   comparador-5s.mp4   5,00 s  las prioridades reordenan las estrategias
// y <salida>/presentacion-gemelo-<idioma>-30s.mp4 (30,0 s): primeros planos con rótulos, portada y cierre.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { abrir, espera, CURSOR, DESPLAZAR, SLIDER } from './lib/navegador.mjs'
import { capas, TEXTOS, W, H, zonaApp } from './lib/maqueta.mjs'

const SAL = resolve(process.argv[2] ?? 'tomas-gemelo')
const LANG = process.argv[3] ?? 'en'
const BASE = `https://apolo-unsa.github.io/hanan-qocha/?lang=${LANG}&video=1`
const T = TEXTOS[LANG]
const PLANOS = join(SAL, `.planos-${LANG}`)
const CORTES = join(SAL, `cortes-30s-${LANG}`)
const TMP = join(SAL, `.cortos-${LANG}`)
for (const d of [PLANOS, CORTES, TMP]) mkdirSync(d, { recursive: true })

// Ventana más chica que la de escritorio (la interfaz se ve un 33 % más grande) y grabada al doble de resolución
const VW = 1200, VH = 675, ESC = 2, FPS = 30
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
const X264 = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-an']

/** Rectángulo 16:9 que contiene a los elementos (con margen), dentro de la ventana. */
const RECORTE = `(sels, pad) => {
  let l = 1e9, t = 1e9, r = -1e9, b = -1e9
  for (const s of sels) for (const el of document.querySelectorAll(s)) { const e = el.getBoundingClientRect(); l = Math.min(l, e.left); t = Math.min(t, e.top); r = Math.max(r, e.right); b = Math.max(b, e.bottom) }
  l -= pad; t -= pad; r += pad; b += pad
  let w = r - l, h = b - t
  if (w / h > 16 / 9) { const nh = w * 9 / 16; t -= (nh - h) / 2; h = nh } else { const nw = h * 16 / 9; l -= (nw - w) / 2; w = nw }
  if (w > innerWidth) { w = innerWidth; h = w * 9 / 16 }
  if (h > innerHeight) { h = innerHeight; w = h * 16 / 9 }
  l = Math.max(0, Math.min(l, innerWidth - w)); t = Math.max(0, Math.min(t, innerHeight - h))
  return [l, t, w, h]
}`
const yDe = (nav, sel, margen) => nav.js(`Math.max(0, document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect().top + scrollY - ${margen})`)
const centro = (nav, sel, i = 0) => nav.js(`(() => { const r = document.querySelectorAll(${JSON.stringify(sel)})[${i}].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
const destacar = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); e.animate([{ boxShadow: '0 0 0 0 #d9a23f00' }, { boxShadow: '0 0 0 6px #d9a23fcc' }, { boxShadow: '0 0 0 3px #d9a23f88' }], { duration: 700, fill: 'forwards', easing: 'ease-out' }); return true })()`

// ---------- Planos: preparar (sin grabar), qué recortar y la acción (que empieza al grabar) ----------
const PLANOS_DEF = {
  async mapa(nav) {
    await nav.ir(`${BASE}#/`)
    await espera(4500) // teselas en caché
    await nav.js(`location.hash = '#/_'`)
    await espera(300)
    return {
      recorte: null, // se calcula al volver al mapa
      async accion() {
        await nav.js(`location.hash = '#/'`)
        await espera(400)
        this.recorte = await nav.js(`(${RECORTE})(['#map'], 0)`)
        await espera(4800)
      },
    }
  },
  async ficha(nav) {
    await nav.ir(`${BASE}#/cocha/QC-01`)
    await nav.imagenes()
    await espera(2500)
    // Se sale a otra vista y se vuelve con solo cambiar el "#": la ficha (en caché) entra con el anillo llenándose
    await nav.js(`location.hash = '#/finca/QC-01'`)
    await espera(1500)
    const r = { recorte: null }
    r.accion = async () => {
      await nav.js(`location.hash = '#/cocha/QC-01'`)
      await espera(60)
      r.recorte = await nav.js(`(${RECORTE})(['.hero', '#ruta'], 14)`)
      await espera(3600)
    }
    return r
  },
  async colonias(nav) {
    await nav.ir(`${BASE}#/cocha/QC-01`)
    await espera(2200)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.k-vision', 90)}, 10)`)
    await nav.js(`document.querySelector('.thumbs').scrollLeft = 0; document.querySelector('.thumbs button').click(); true`)
    await nav.imagenes()
    // Precarga de las 8 fotos para que el cambio sea instantáneo
    await nav.js(`Promise.all([...document.querySelectorAll('.thumbs img')].map((i) => new Promise((r) => { const im = new Image(); im.onload = im.onerror = r; im.src = i.src.replace('/miniaturas/', '/') }))).then(() => true)`)
    await espera(1200)
    const recorte = await nav.js(`(${RECORTE})(['.k-vision .foto', '.k-vision .thumbs'], 10)`)
    return {
      recorte,
      async accion() {
        const n = await nav.js(`document.querySelectorAll('.thumbs button').length`)
        for (let i = 1; i < n; i++) {
          await espera(300)
          await nav.js(`document.querySelectorAll('.thumbs button')[${i}].click(); true`)
        }
        await espera(1200)
      },
    }
  },
  async curva(nav) {
    await nav.ir(`${BASE}#/cocha/QC-02`)
    await nav.js(CURSOR)
    await espera(2600)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.panel-instrumento', 14)}, 10)`)
    await espera(3200)
    const recorte = await nav.js(`(${RECORTE})(['.panel-instrumento', '.k-whatif'], 12)`)
    // El cursor ya está sobre el slider de TDS al empezar
    await nav.js(`(() => { const s = document.querySelector('input[name=tds_ppm]'); const r = s.getBoundingClientRect(); const x = r.left + 11 + (r.width - 22) * (+s.value - +s.min) / (+s.max - +s.min); return window.__cur.a(x - 4, r.top + r.height / 2 - 2, 0) })()`)
    return {
      recorte,
      async accion() {
        await espera(200)
        await nav.js(`(${SLIDER})('input[name=tds_ppm]', 250, 1500)`.replace('await window.__cur.a(px(desde) - 4, r.top + r.height / 2 - 2, 650); window.__cur.clic()', 'window.__cur.clic()'))
        await espera(2300)
      },
    }
  },
  async cosecha(nav) {
    await vista(nav, 1600, 900) // la curva y la tarjeta de acción tienen que caber juntas
    await nav.ir(`${BASE}#/cocha/QC-01`)
    await nav.js(CURSOR)
    await espera(2600)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.panel-instrumento', 14)}, 10)`)
    await espera(150)
    const recorte = await nav.js(`(${RECORTE})(['.panel-instrumento', '.k-accion'], 12)`)
    const cerca = await nav.js(`(${RECORTE})(['.k-accion'], 40)`)
    const [x, y] = await centro(nav, '.k-accion .actions li:last-child')
    await nav.js(`window.__cur.a(${x + 120}, ${y + 160}, 0)`)
    return {
      recorte,
      camara: { hasta: cerca, t0: 1.75, t1: 2.55 }, // acercamiento a "Cosechar 30,9 kg"
      async accion() {
        await espera(1700) // la curva se dibuja hasta la zona de cosecha
        await nav.js(`window.__cur.a(${x - 70}, ${y + 6}, 700)`)
        await nav.js(`window.__cur.clic(); ${destacar('.k-accion .actions li:last-child')}`)
        await espera(1400)
      },
    }
  },
  async comparador(nav) {
    await vista(nav, 1440, 810)
    await nav.ir(`${BASE}#/finca/QC-01`)
    await espera(2500)
    await nav.ir(`${BASE}#/finca/QC-01`)
    await nav.js(CURSOR)
    await espera(2800)
    await nav.js(`(${DESPLAZAR})(${await yDe(nav, '.finca-grid', 16)}, 10)`)
    await espera(600)
    const recorte = await nav.js(`(${RECORTE})(['.finca-lado .k-whatif', '.estr-badge', '.estr-cab', '.estr .ind'], 14)`)
    const pos = async (k, v) => centro(nav, `.prio[data-k="${k}"] button[data-v="${v}"]`)
    const [sx, sy] = await pos('suelo', 2)
    await nav.js(`window.__cur.a(${sx - 30}, ${sy + 40}, 0)`)
    const ir = async (k, v, ms) => {
      const [x, y] = await pos(k, v)
      await nav.js(`window.__cur.a(${x}, ${y}, ${ms})`)
      await nav.js(`window.__cur.clic(); document.querySelector('.prio[data-k="${k}"] button[data-v="${v}"]').click(); true`)
    }
    return {
      recorte,
      async accion() {
        await espera(150)
        await ir('suelo', 2, 450) // importa el suelo → la leguminosa sube
        await espera(1500)
        await ir('suelo', 0, 380)
        await ir('ingreso', 2, 420) // importa el ingreso → el cushuro sube
        await espera(2300)
      },
    }
  },
}

// Tamaño de la ventana para el plano siguiente
let VISTA = [VW, VH]
async function vista(nav, w, h) {
  VISTA = [w, h]
  await nav.cdp('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: ESC, mobile: false })
}

// Graba un plano y lo deja recortado a 1920x1080. Con `camara`, el encuadre pasa con suavidad de `recorte` a
// `camara.hasta` entre t0 y t1 (como una cámara que se acerca).
async function grabarPlano(nav, nombre) {
  await vista(nav, VW, VH)
  const p = await PLANOS_DEF[nombre](nav)
  const [vw, vh] = VISTA
  const bruto = join(TMP, `${nombre}-bruto.mp4`)
  await nav.grabar(bruto, () => p.accion(), { w: vw * ESC, h: vh * ESC })
  const A = p.recorte.map((v) => v * ESC)
  let vf
  if (!p.camara) {
    const [x, y, w, h] = A.map(Math.round)
    vf = `crop=${w - (w % 2)}:${h - (h % 2)}:${x}:${y},scale=${W}:${H}:flags=lanczos`
  } else {
    const B = p.camara.hasta.map((v) => v * ESC)
    const { t0, t1 } = p.camara
    // zoompan: tamaño de salida fijo (un scale variable reinicia los filtros siguientes en cada cuadro).
    // Ventana visible de ancho rw (px de la grabación) centrada en (cx, cy); 'in' = número de cuadro de entrada.
    const k = `clip((in/${FPS}-${t0})/${t1 - t0},0,1)`
    const e = `(${k}*${k}*(3-2*${k}))`
    const lerp = (a, b) => `(${a.toFixed(2)}+(${(b - a).toFixed(2)})*${e})`
    const rw = lerp(A[2], B[2]), cx = lerp(A[0] + A[2] / 2, B[0] + B[2] / 2), cy = lerp(A[1] + A[3] / 2, B[1] + B[3] / 2)
    vf = `zoompan=z='${vw * ESC}/${rw}':x='max(0,min(iw-iw/zoom,${cx}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,${cy}-ih/zoom/2))':d=1:s=${W}x${H}:fps=${FPS}`
  }
  const out = join(PLANOS, `${nombre}.mp4`)
  ff(['-i', bruto, '-vf', `${vf},setsar=1`, ...X264, out])
  rmSync(bruto)
  console.log(`  plano ${nombre} (encuadre ${Math.round(A[2])} px${p.camara ? ` → ${Math.round(p.camara.hasta[2] * ESC)} px` : ''})`)
  return out
}

// Celular: la ficha de arriba hacia la curva, en un solo desplazamiento continuo
async function grabarMovil() {
  const nav = await abrir({ ancho: 390, alto: 804, escala: 2, movil: true })
  try {
    const base = BASE.replace('&video=1', '')
    await nav.ir(`${base}#/cocha/QC-01`)
    await nav.imagenes()
    await espera(2500)
    await nav.ir(`${base}#/cocha/QC-01`)
    await espera(2600)
    const hasta = await yDe(nav, '.k-sensor', 60)
    const out = join(PLANOS, 'movil.mp4')
    await nav.grabar(out, async () => {
      await espera(300)
      await nav.js(`(${DESPLAZAR})(${hasta}, 3000)`)
      await espera(700)
    }, { w: 780, h: 1608 })
    console.log('  plano movil')
    return out
  } finally {
    await nav.cerrar()
  }
}

// ---------- 1. Grabar los planos ----------
// REUSAR=1: usa los planos ya grabados (para cambiar solo el montaje)
const P = {}
const reusar = (n) => process.env.REUSAR && existsSync(join(PLANOS, `${n}.mp4`)) && (P[n] = join(PLANOS, `${n}.mp4`))
const faltan = Object.keys(PLANOS_DEF).filter((n) => !reusar(n))
if (faltan.length) {
  const nav = await abrir({ ancho: VW, alto: VH, escala: ESC })
  try {
    for (const n of faltan) P[n] = await grabarPlano(nav, n)
  } finally {
    await nav.cerrar()
  }
}
if (!reusar('movil')) P.movil = await grabarMovil()

// ---------- 2. Piezas ----------
// Un tramo de un plano, con acercamiento lento (3 %) para que nunca quede quieto
const empuje = (d, z = 0.03) => `scale=w='2*trunc(${W / 2}*(1+${z}*t/${d}))':h=-2:eval=frame:flags=bicubic,crop=${W}:${H}`
function tramo(plano, desde, dur, out, extra = '') {
  ff(['-ss', String(desde), '-t', String(dur), '-i', plano, '-vf', `${empuje(dur)}${extra},setsar=1`, ...X264, out])
  return { f: out, d: dur }
}
// Une piezas con fundidos de `cruce` s; la duración total es la suma menos los cruces
function unir(piezas, cruce, out, tipo = 'fade') {
  let filtro = '', previo = '[0:v]', t = piezas[0].d
  for (let k = 1; k < piezas.length; k++) {
    const et = k === piezas.length - 1 ? '[v]' : `[x${k}]`
    filtro += `${previo}[${k}:v]xfade=transition=${tipo}:duration=${cruce}:offset=${(t - cruce).toFixed(3)}${et};`
    previo = et
    t += piezas[k].d - cruce
  }
  ff([...piezas.flatMap((p) => ['-i', p.f]), '-filter_complex', filtro.slice(0, -1), '-map', '[v]', ...X264, '-movflags', '+faststart', out])
  return t
}
const dur = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()

// Video del equipo, 21–26 s: tres frases de la voz, tres planos con fundidos (2,4 + 1,8 + 1,6 − 2 × 0,4 = 5,0 s)
const g = unir([
  tramo(P.curva, 0, 2.4, join(TMP, 'g1.mp4')),
  tramo(P.colonias, 0.2, 1.8, join(TMP, 'g2.mp4')),
  tramo(P.cosecha, 1.55, 1.6, join(TMP, 'g3.mp4')),
], 0.4, join(CORTES, 'gemelo-21-26s.mp4'))
tramo(P.mapa, 0.2, 3, join(CORTES, 'mapa-3s.mp4'))
tramo(P.comparador, 0, 5, join(CORTES, 'comparador-5s.mp4'))
for (const f of ['gemelo-21-26s.mp4', 'mapa-3s.mp4', 'comparador-5s.mp4']) console.log(`✓ ${f} (${dur(join(CORTES, f)).toFixed(2)} s)`)

// ---------- 3. Versión de 30 s: primeros planos con rótulos ----------
const nav2 = await abrir({ ancho: W, alto: H, escala: 1 })
const png = async (nombre, html) => {
  const f = join(TMP, `${nombre}.html`)
  writeFileSync(f, html)
  await nav2.ir(pathToFileURL(f).href)
  await nav2.foto(join(TMP, `${nombre}.png`), { formato: 'png', transparente: true })
  return join(TMP, `${nombre}.png`)
}
const E = T.escenas
try {
  await png('fondo', capas.fondo(null))
  await png('titulo', capas.titulo(T.titulo))
  await png('cierre', capas.cierre(T.cierre))
  await png('fondo-movil', capas.fondo('movil'))
  await png('marco-movil', capas.marco('movil'))
  await png('texto-movil', capas.texto('movil', E.movil))
  for (const k of ['mapa', 'iac', 'colonias', 'curva', 'cosecha', 'comparador']) await png(`rotulo-${k}`, capas.rotulo(E[k]))
} finally {
  await nav2.cerrar()
}
const I = (n) => join(TMP, `${n}.png`)
const img = (f) => ['-loop', '1', '-framerate', String(FPS), '-i', f]
const CRUCE = 0.4
const piezas = []
// Portada y cierre: el texto sube y aparece
const tarjeta = (png_, d, out, salida = false) => {
  ff([...img(I('fondo')), ...img(I(png_)), '-filter_complex',
    `[1:v]format=rgba,fade=t=in:st=0.2:d=0.8:alpha=1[t];[0:v][t]overlay=x=0:y='40*pow(max(0,1-max(0,t-0.2)/1.0),3)'[c];[c]${empuje(d)}${salida ? `,fade=t=out:st=${d - 0.6}:d=0.6` : ''},format=yuv420p`,
    '-t', String(d), ...X264, out])
  return { f: out, d }
}
// Primer plano con rótulo
const conRotulo = (plano, desde, d, rotulo, out) => {
  ff(['-ss', String(desde), '-t', String(d), '-i', plano, ...img(I(rotulo)), '-filter_complex',
    `[0:v]${empuje(d)},setsar=1[v];[1:v]format=rgba,fade=t=in:st=0.15:d=0.45:alpha=1[r];[v][r]overlay=x=0:y='24*pow(max(0,1-max(0,t-0.15)/0.6),3)',format=yuv420p`,
    '-t', String(d), ...X264, out])
  return { f: out, d }
}
piezas.push(tarjeta('titulo', 2.6, join(TMP, 's0.mp4')))
piezas.push(conRotulo(P.mapa, 0.2, 4.0, 'rotulo-mapa', join(TMP, 's1.mp4')))
piezas.push(conRotulo(P.ficha, 0.1, 3.4, 'rotulo-iac', join(TMP, 's2.mp4')))
piezas.push(conRotulo(P.colonias, 0.1, 3.0, 'rotulo-colonias', join(TMP, 's3.mp4')))
piezas.push(conRotulo(P.curva, 0, 4.2, 'rotulo-curva', join(TMP, 's4.mp4')))
piezas.push(conRotulo(P.cosecha, 0.6, 3.4, 'rotulo-cosecha', join(TMP, 's5.mp4')))
piezas.push(conRotulo(P.comparador, 0, 5.6, 'rotulo-comparador', join(TMP, 's6.mp4')))
{ // Celular dentro de su marco, con el texto al lado
  const d = 3.6, z = zonaApp('movil'), out = join(TMP, 's7.mp4')
  ff([...img(I('fondo-movil')), '-t', String(d), '-i', P.movil, ...img(I('marco-movil')), ...img(I('texto-movil')), '-filter_complex',
    [`[1:v]scale=${z.w}:${z.h}:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=1[v]`, `[0:v][v]overlay=${z.x}:${z.y}[a]`, `[a][2:v]overlay=0:0[b]`,
      `[3:v]format=rgba,fade=t=in:st=0.1:d=0.45:alpha=1[t]`, `[b][t]overlay=x='-60*pow(max(0,1-max(0,t-0.1)/0.6),3)':y=0[c]`, `[c]${empuje(d)},format=yuv420p`].join(';'),
    '-t', String(d), ...X264, out])
  piezas.push({ f: out, d })
}
const usado = piezas.reduce((a, p) => a + p.d, 0) - CRUCE * piezas.length
piezas.push(tarjeta('cierre', +(30 - usado).toFixed(3), join(TMP, 's8.mp4'), true))
const total = unir(piezas, CRUCE, join(SAL, `presentacion-gemelo-${LANG}-30s.mp4`))
console.log(`✓ presentacion-gemelo-${LANG}-30s.mp4 (${total.toFixed(2)} s)`)
rmSync(TMP, { recursive: true, force: true })
