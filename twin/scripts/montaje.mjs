// Video de presentación del gemelo (1920x1080, 30 fps, sin audio: la voz se agrega en la edición final).
// Cada toma corre dentro de una laptop o un celular, con su texto, un acercamiento lento y transiciones.
//
//   node twin/scripts/montaje.mjs [carpeta-tomas] [idioma: es|en] [30s]
//
// Con "30s": versión de exactamente 30 s (tramos más cortos) y, en cortes-30s-<idioma>/, los clips a pantalla
// completa con la duración exacta de cada bloque del video del equipo (docs/HANAN_QOCHA_PROYECTO.md §7).
//
// Antes: node twin/scripts/grabar-tomas.mjs <carpeta-tomas> <idioma>
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { abrir } from './lib/navegador.mjs'
import { capas, LAYOUTS, TEXTOS, W, H, zonaApp } from './lib/maqueta.mjs'

const TOMAS = resolve(process.argv[2] ?? 'tomas-gemelo')
const LANG = process.argv[3] ?? 'es'
const T = TEXTOS[LANG]
const CORTO = process.argv[4] === '30s'
const SUF = CORTO ? '-30s' : ''
const TMP = join(TOMAS, `.montaje-${LANG}${SUF}`)
const ESC = join(TOMAS, `escenas-${LANG}${SUF}`)
const SALIDA = join(TOMAS, `presentacion-gemelo-${LANG}${SUF}.mp4`)
const FPS = 30
const CRUCE = CORTO ? 0.4 : 0.7 // transición entre escenas (s)
const PAUSA = CORTO ? 0 : 0.9 // pausa final de cada toma (s)
const TOTAL_30 = 30, PORTADA_30 = 2.5

// Escenas en orden: toma, disposición, texto y [inicio, fin] del tramo para la versión de 30 s
const ESCENAS = [
  ['extra-mapa-vuelo', 'laptop-der', 'mapa', [0.2, 4.7]],
  ['extra-ficha', 'laptop-izq', 'ficha', [0.3, 3.3]],
  ['pax-3-colonias', 'laptop-der', 'colonias', [0.8, 3.3]],
  ['pax-1-curva', 'laptop-izq', 'curva', [3.6, 7.6]],
  ['pax-2-cosecha', 'laptop-der', 'cosecha', [3.0, 6.0]],
  ['extra-comparador', 'laptop-izq', 'comparador', [2.6, 8.1]],
  ['extra-movil', 'movil', 'movil', [0.5, 3.5]],
].filter(([toma]) => existsSync(join(TOMAS, `${toma}.mp4`)))

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'inherit'] })
const duracion = (f) => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString()
const X264 = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS)]
// Acercamiento lento de toda la escena (3,5 % en su duración), recortado al cuadro
const empuje = (d) => `scale=w='2*trunc(${W / 2}*(1+0.035*t/${d}))':h=-2:eval=frame:flags=bicubic,crop=${W}:${H}`

rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
mkdirSync(ESC, { recursive: true })

// ---------- 1. Capas gráficas (PNG con transparencia) ----------
const nav = await abrir({ ancho: W, alto: H, escala: 1 })
const png = async (nombre, html) => {
  const f = join(TMP, `${nombre}.html`)
  writeFileSync(f, html)
  await nav.ir(pathToFileURL(f).href)
  await nav.foto(join(TMP, `${nombre}.png`), { formato: 'png', transparente: true })
  return join(TMP, `${nombre}.png`)
}
try {
  await png('fondo', capas.fondo(null))
  await png('titulo', capas.titulo(T.titulo))
  await png('cierre', capas.cierre(T.cierre))
  for (const layout of Object.keys(LAYOUTS)) {
    await png(`fondo-${layout}`, capas.fondo(layout))
    await png(`marco-${layout}`, capas.marco(layout))
  }
  for (const [, layout, clave] of ESCENAS) await png(`texto-${clave}`, capas.texto(layout, T.escenas[clave]))
} finally {
  await nav.cerrar()
}
const P = (n) => join(TMP, `${n}.png`)
const imagen = (f) => ['-loop', '1', '-framerate', String(FPS), '-i', f]

// ---------- 2. Escenas ----------
const clips = []
// Portada: el nombre sube y aparece
{
  const d = CORTO ? PORTADA_30 : 4.2, out = join(ESC, '00-portada.mp4')
  ff([...imagen(P('fondo')), ...imagen(P('titulo')), '-filter_complex',
    `[1:v]format=rgba,fade=t=in:st=0.3:d=1.1:alpha=1[t];[0:v][t]overlay=x=0:y='46*pow(max(0,1-max(0,t-0.3)/1.3),3)'[c];[c]${empuje(d)},format=yuv420p`,
    '-t', String(d), ...X264, out])
  clips.push({ f: out, d })
}
for (const [i, [toma, layout, clave, tramo]] of ESCENAS.entries()) {
  const z = zonaApp(layout)
  const d = CORTO ? +(tramo[1] - tramo[0]).toFixed(3) : +(duracion(join(TOMAS, `${toma}.mp4`)) + PAUSA).toFixed(3)
  // En la versión corta el texto entra antes y más rápido
  const [tIn, tDur, tSlide] = CORTO ? [0.1, 0.45, 0.6] : [0.35, 0.8, 1.0]
  const out = join(ESC, `${String(i + 1).padStart(2, '0')}-${clave}.mp4`)
  ff([...imagen(P(`fondo-${layout}`)), ...(CORTO ? ['-ss', String(tramo[0]), '-t', String(d)] : []), '-i', join(TOMAS, `${toma}.mp4`), ...imagen(P(`marco-${layout}`)), ...imagen(P(`texto-${clave}`)),
    '-filter_complex', [
      `[1:v]scale=${z.w}:${z.h}:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=${PAUSA}[v]`,
      `[0:v][v]overlay=${z.x}:${z.y}[a]`,
      `[a][2:v]overlay=0:0[b]`,
      // El texto entra deslizándose desde su lado
      `[3:v]format=rgba,fade=t=in:st=${tIn}:d=${tDur}:alpha=1[t]`,
      `[b][t]overlay=x='${LAYOUTS[layout].texto.x > 900 ? '' : '-'}70*pow(max(0,1-max(0,t-${tIn})/${tSlide}),3)':y=0[c]`,
      `[c]${empuje(d)},format=yuv420p`,
    ].join(';'), '-t', String(d), ...X264, out])
  clips.push({ f: out, d })
  console.log(`  escena ${clave} (${d.toFixed(1)} s)`)
}
{
  // En la versión corta el cierre completa exactamente 30 s
  const usado = clips.reduce((a, c) => a + c.d, 0) - CRUCE * clips.length
  const d = CORTO ? +(TOTAL_30 - usado).toFixed(3) : 5
  if (d < 2) throw new Error(`Los tramos no caben en ${TOTAL_30} s (queda ${d.toFixed(1)} s para el cierre)`)
  const out = join(ESC, `${String(ESCENAS.length + 1).padStart(2, '0')}-cierre.mp4`)
  ff([...imagen(P('fondo')), ...imagen(P('cierre')), '-filter_complex',
    `[1:v]format=rgba,fade=t=in:st=0.4:d=1.1:alpha=1[t];[0:v][t]overlay=x=0:y='40*pow(max(0,1-max(0,t-0.4)/1.3),3)'[c];[c]${empuje(d)},fade=t=out:st=${d - 0.8}:d=0.8,format=yuv420p`,
    '-t', String(d), ...X264, out])
  clips.push({ f: out, d })
}

// ---------- 3. Unión con transiciones ----------
const entradas = clips.flatMap((c) => ['-i', c.f])
let filtro = '', previo = '[0:v]', t = clips[0].d
for (let k = 1; k < clips.length; k++) {
  const tipo = k === 1 || k === clips.length - 1 ? 'fade' : 'smoothleft'
  const etiqueta = k === clips.length - 1 ? '[final]' : `[x${k}]`
  filtro += `${previo}[${k}:v]xfade=transition=${tipo}:duration=${CRUCE}:offset=${(t - CRUCE).toFixed(3)}${etiqueta};`
  previo = etiqueta
  t += clips[k].d - CRUCE
}
ff([...entradas, '-filter_complex', filtro.slice(0, -1), '-map', '[final]', ...X264.map((x) => (x === '17' ? '18' : x)), '-movflags', '+faststart', SALIDA])
rmSync(TMP, { recursive: true, force: true })
console.log(`✓ ${SALIDA} (${t.toFixed(1)} s)`)

// ---------- 4. Cortes exactos para el video de 30 s del equipo (pantalla completa, sin textos) ----------
if (CORTO) {
  const CORTES = join(TOMAS, `cortes-30s-${LANG}`)
  mkdirSync(CORTES, { recursive: true })
  const tramo = (toma, ini, dur, out) =>
    ff(['-ss', String(ini), '-t', String(dur), '-i', join(TOMAS, `${toma}.mp4`), '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS}`, ...X264, '-an', out])
  const unir = (partes, out) => {
    const lista = join(CORTES, '.lista.txt')
    writeFileSync(lista, partes.map((f) => `file '${f.replaceAll('\\', '/')}'`).join('\n'))
    ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', out])
    partes.forEach((f) => rmSync(f))
    rmSync(lista)
  }
  // 21–26 s: "forecasts growth (2 s) … when (1,5 s) … how much to harvest (1,5 s)", cortes secos
  const p = [['pax-1-curva', 4.0, 2.0], ['pax-3-colonias', 1.0, 1.5], ['pax-2-cosecha', 4.0, 1.5]].map(([toma, ini, dur], k) => {
    const f = join(CORTES, `.p${k}.mp4`)
    tramo(toma, ini, dur, f)
    return f
  })
  unir(p, join(CORTES, 'gemelo-21-26s.mp4'))
  tramo('extra-mapa-vuelo', 0.2, 3, join(CORTES, 'mapa-3s.mp4'))
  tramo('extra-comparador', 2.6, 5, join(CORTES, 'comparador-5s.mp4'))
  for (const f of ['gemelo-21-26s.mp4', 'mapa-3s.mp4', 'comparador-5s.mp4']) console.log(`✓ ${f} (${duracion(join(CORTES, f)).toFixed(2)} s)`)
}
