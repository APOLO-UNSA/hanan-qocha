// Video de presentación del gemelo (1920x1080, 30 fps, sin audio: la voz se agrega en la edición final).
// Cada toma corre dentro de una laptop o un celular, con su texto, un acercamiento lento y transiciones.
//
//   node twin/scripts/montaje.mjs [carpeta-tomas] [idioma: es|en]
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
const TMP = join(TOMAS, `.montaje-${LANG}`)
const ESC = join(TOMAS, `escenas-${LANG}`)
const SALIDA = join(TOMAS, `presentacion-gemelo-${LANG}.mp4`)
const FPS = 30, CRUCE = 0.7, PAUSA = 0.9 // segundos: transición y pausa final de cada toma

// Escenas en orden: toma, disposición y texto
const ESCENAS = [
  ['extra-mapa-vuelo', 'laptop-der', 'mapa'],
  ['extra-ficha', 'laptop-izq', 'ficha'],
  ['pax-3-colonias', 'laptop-der', 'colonias'],
  ['pax-1-curva', 'laptop-izq', 'curva'],
  ['pax-2-cosecha', 'laptop-der', 'cosecha'],
  ['extra-comparador', 'laptop-izq', 'comparador'],
  ['extra-movil', 'movil', 'movil'],
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
  const d = 4.2, out = join(ESC, '00-portada.mp4')
  ff([...imagen(P('fondo')), ...imagen(P('titulo')), '-filter_complex',
    `[1:v]format=rgba,fade=t=in:st=0.3:d=1.1:alpha=1[t];[0:v][t]overlay=x=0:y='46*pow(max(0,1-max(0,t-0.3)/1.3),3)'[c];[c]${empuje(d)},format=yuv420p`,
    '-t', String(d), ...X264, out])
  clips.push({ f: out, d })
}
for (const [i, [toma, layout, clave]] of ESCENAS.entries()) {
  const z = zonaApp(layout)
  const d = +(duracion(join(TOMAS, `${toma}.mp4`)) + PAUSA).toFixed(3)
  const out = join(ESC, `${String(i + 1).padStart(2, '0')}-${clave}.mp4`)
  ff([...imagen(P(`fondo-${layout}`)), '-i', join(TOMAS, `${toma}.mp4`), ...imagen(P(`marco-${layout}`)), ...imagen(P(`texto-${clave}`)),
    '-filter_complex', [
      `[1:v]scale=${z.w}:${z.h}:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=${PAUSA}[v]`,
      `[0:v][v]overlay=${z.x}:${z.y}[a]`,
      `[a][2:v]overlay=0:0[b]`,
      // El texto entra deslizándose desde su lado
      `[3:v]format=rgba,fade=t=in:st=0.35:d=0.8:alpha=1[t]`,
      `[b][t]overlay=x='${LAYOUTS[layout].texto.x > 900 ? '' : '-'}70*pow(max(0,1-max(0,t-0.35)/1.0),3)':y=0[c]`,
      `[c]${empuje(d)},format=yuv420p`,
    ].join(';'), '-t', String(d), ...X264, out])
  clips.push({ f: out, d })
  console.log(`  escena ${clave} (${d.toFixed(1)} s)`)
}
{
  const d = 5, out = join(ESC, `${String(ESCENAS.length + 1).padStart(2, '0')}-cierre.mp4`)
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
