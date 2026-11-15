// Maquetas de presentación (lienzo 1920x1080): fondo con la identidad de la app, marcos de laptop y celular,
// y textos de cada escena. Las usan montaje.mjs (video, por capas) y capturas.mjs (imágenes fijas).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const RAIZ = resolve(import.meta.dirname, '../..')
const fuente = (paquete, archivo) => pathToFileURL(resolve(RAIZ, 'node_modules', paquete, 'files', archivo)).href
const TOPO = pathToFileURL(resolve(RAIZ, 'src/assets/topo.svg')).href
const CORDILLERA = pathToFileURL(resolve(RAIZ, 'src/assets/cordillera.svg')).href
const AWAYU = readFileSync(resolve(RAIZ, 'src/style.css'), 'utf8').match(/--awayu: (url\(".*?"\));/)[1]

export const W = 1920, H = 1080

const LOGO = (t = 64) => `<svg width="${t}" height="${t}" viewBox="0 0 40 40">
  <path d="M3 24 L14 9 L19 15 L24 8 L37 24 Z" fill="#d9a23f"/>
  <path d="M14 9 L17.5 13.6 L15.8 13 L14 15 L12 12.6 Z M24 8 L28.2 13.4 L26 12.6 L24 14.5 L22 12.8 Z" fill="#f4ecdc"/>
  <ellipse cx="20" cy="29" rx="17" ry="8" fill="#2c8c8f"/>
  <circle cx="14" cy="29" r="2.6" fill="#8cc084"/><circle cx="21" cy="31" r="3.2" fill="#8cc084"/><circle cx="27" cy="28" r="2" fill="#8cc084"/>
</svg>`

// ---------- Disposición de cada maqueta: dónde va la pantalla y dónde el texto ----------
// laptop: pantalla 16:9; movil: pantalla 390x844 escalada
export const LAYOUTS = {
  'laptop-der': { tipo: 'laptop', pantalla: { x: 744, y: 214, w: 1056, h: 594 }, texto: { x: 118, w: 540 } },
  'laptop-izq': { tipo: 'laptop', pantalla: { x: 120, y: 214, w: 1056, h: 594 }, texto: { x: 1290, w: 520 } },
  movil: { tipo: 'movil', pantalla: { x: 1218, y: 104, w: 390, h: 844 }, texto: { x: 170, w: 860 } },
}

const BISEL = 18, BASE_H = 30, VUELO = 74
/** Barra de estado del celular (la app empieza debajo, como en un teléfono real). */
export const BARRA_MOVIL = 40
/** Rectángulo donde va el contenido de la app (en el celular, debajo de la barra de estado). */
export const zonaApp = (layout) => {
  const L = LAYOUTS[layout], p = L.pantalla
  return L.tipo === 'movil' ? { x: p.x, y: p.y + BARRA_MOVIL, w: p.w, h: p.h - BARRA_MOVIL } : p
}

// ---------- Textos ----------
export const TEXTOS = {
  es: {
    titulo: { marca: 'Hanan Qocha', nombre: 'Qocha Twin', lema: 'El gemelo digital de las cochas de cushuro', pie: 'NASA Space Apps Challenge 2026, Arequipa' },
    cierre: { lema: 'Del bofedal a la mesa', sub: 'Datos NASA, sensor en la orilla y visión artificial para cada cocha altoandina.', url: 'apolo-unsa.github.io/hanan-qocha' },
    escenas: {
      mapa: { k: '¿Dónde?', t: 'Cada cocha con su Índice de Aptitud Cushuro', b: ['Satélite NASA, sensor en la orilla y cámara', 'Filtra las aptas y mira las próximas cosechas'] },
      iac: { k: '¿Sirve esta cocha?', t: 'Cada cocha con su ficha y su índice', b: ['Satélite, sensor y cámara en un solo IAC', 'Ruta de cultivo: de apta a lista para cosechar'] },
      agua: { k: 'El agua y las colonias', t: 'Medidas en la orilla y por la cámara', b: ['Sensor Qocha Ñawi: temperatura, sólidos, UV y pH', 'La visión artificial cuenta colonias y estima biomasa'] },
      ficha: { k: '¿Cómo está el agua?', t: 'El sensor Qocha Ñawi, lectura por lectura', b: ['Temperatura, sólidos disueltos, UV y pH', 'Historial de 48 h y ruta de cultivo'] },
      colonias: { k: '¿Cuánto hay?', t: 'La cámara cuenta las colonias', b: ['Visión artificial estima cobertura y biomasa', 'Cada foto recalibra el modelo'] },
      curva: { k: '¿Cuándo cosechar?', t: 'El gemelo proyecta el crecimiento', b: ['Cambia el agua y la curva responde', 'La proyección se contrasta con lo medido'] },
      cosecha: { k: '¿Cuánto cosechar?', t: 'Una acción clara para el productor', b: ['Cosechar 30,9 kg y dejar el 30 %', 'Para que la cocha se regenere'] },
      comparador: { k: '¿Qué le conviene a la finca?', t: 'Tres estrategias comparadas con datos NASA', b: ['SMAP, GPM, ECOSTRESS, MODIS y Landsat', 'Las prioridades reordenan; la evidencia no cambia', 'Si la cocha no es apta, el cushuro no se recomienda'] },
      movil: { k: 'En el campo', t: 'En el celular del productor', b: ['Se instala como app', 'Funciona sin conexión', 'En español y en inglés'] },
    },
  },
  en: {
    titulo: { marca: 'Hanan Qocha', nombre: 'Qocha Twin', lema: 'A digital twin for high-Andean cushuro ponds', pie: 'NASA Space Apps Challenge 2026, Arequipa' },
    cierre: { lema: 'From the wetland to the table', sub: 'NASA data, a shore sensor and computer vision for every high-Andean pond.', url: 'apolo-unsa.github.io/hanan-qocha' },
    escenas: {
      mapa: { k: 'Where?', t: 'Every pond scored for cushuro', b: ['NASA satellite, shore sensor and camera', 'Filter suitable ponds, see upcoming harvests'] },
      iac: { k: 'Is this pond suitable?', t: 'Every pond with its own page and index', b: ['Satellite, sensor and camera in one CSI', 'Growing path: from suitable to ready to harvest'] },
      agua: { k: 'Water and colonies', t: 'Measured on the shore and by the camera', b: ['Qocha Ñawi sensor: temperature, solids, UV and pH', 'Computer vision counts colonies and estimates biomass'] },
      ficha: { k: 'How is the water?', t: 'The Qocha Ñawi sensor, reading by reading', b: ['Temperature, dissolved solids, UV and pH', '48-hour history and growing path'] },
      colonias: { k: 'How much is there?', t: 'The camera counts the colonies', b: ['Computer vision estimates cover and biomass', 'Every photo recalibrates the model'] },
      curva: { k: 'When to harvest?', t: 'The twin forecasts growth', b: ['Change the water and the curve responds', 'Forecast checked against the camera'] },
      cosecha: { k: 'How much to harvest?', t: 'One clear action for the grower', b: ['Harvest 30.9 kg and leave 30 %', 'So the pond can regrow'] },
      comparador: { k: 'What suits the farm?', t: 'Three strategies compared with NASA data', b: ['SMAP, GPM, ECOSTRESS, MODIS and Landsat', 'Priorities reorder; the evidence stays', 'A poor pond rules cushuro out'] },
      movil: { k: 'In the field', t: "On the grower's phone", b: ['Installs as an app', 'Works offline', 'In Spanish and English'] },
    },
  },
}

// ---------- HTML ----------
const BASE_CSS = `
@font-face { font-family: Alegreya; font-weight: 700; src: url(${fuente('@fontsource/alegreya', 'alegreya-latin-700-normal.woff2')}); }
@font-face { font-family: Alegreya; font-weight: 800; src: url(${fuente('@fontsource/alegreya', 'alegreya-latin-800-normal.woff2')}); }
@font-face { font-family: Alegreya; font-weight: 700; font-style: italic; src: url(${fuente('@fontsource/alegreya', 'alegreya-latin-700-italic.woff2')}); }
@font-face { font-family: 'Alegreya Sans'; font-weight: 400; src: url(${fuente('@fontsource/alegreya-sans', 'alegreya-sans-latin-400-normal.woff2')}); }
@font-face { font-family: 'Alegreya Sans'; font-weight: 500; src: url(${fuente('@fontsource/alegreya-sans', 'alegreya-sans-latin-500-normal.woff2')}); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: 'Alegreya Sans', sans-serif; color: #f4ecdc; -webkit-font-smoothing: antialiased; }
.abs { position: absolute; }
`

/** Fondo: noche andina con curvas de nivel, cordillera y el borde de awayu; sombra del dispositivo. */
function capaFondo(layout) {
  const L = layout && LAYOUTS[layout]
  let sombra = ''
  if (L?.tipo === 'laptop') {
    const p = L.pantalla
    sombra = `<div class="abs" style="left:${p.x - 40}px;top:${p.y + p.h - 30}px;width:${p.w + 80}px;height:90px;border-radius:50%;background:#000;filter:blur(38px);opacity:.55"></div>`
  } else if (L?.tipo === 'movil') {
    const p = L.pantalla
    sombra = `<div class="abs" style="left:${p.x + 20}px;top:${p.y + 60}px;width:${p.w}px;height:${p.h}px;border-radius:60px;background:#000;filter:blur(45px);opacity:.55"></div>`
  }
  return `<div class="abs" style="inset:0;background:radial-gradient(ellipse 80% 70% at ${L?.texto.x > 900 ? '35%' : '62%'} 45%, #333b74 0%, #1d2242 55%, #12152b 100%)"></div>
  <div class="abs" style="inset:0;background:url(${TOPO}) center/cover;opacity:.24;mix-blend-mode:screen"></div>
  <div class="abs" style="left:0;right:0;bottom:6px;height:300px;background:url(${CORDILLERA}) bottom/cover no-repeat;opacity:.10;filter:brightness(2.4)"></div>
  <div class="abs" style="left:0;right:0;bottom:0;height:8px;background:${AWAYU} repeat-x;background-size:auto 8px"></div>
  ${sombra}`
}

/** Marco del dispositivo, con la pantalla transparente (encima del video) o con una imagen (fijas). */
function capaMarco(layout, img) {
  const L = LAYOUTS[layout], p = L.pantalla
  const contenido = img ? `<img src="${img}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:top">` : ''
  if (L.tipo === 'laptop') {
    const bx = p.x - BISEL, by = p.y - BISEL - 6, bw = p.w + BISEL * 2, bh = p.h + BISEL * 2 + 6
    return `
    <div class="abs" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;overflow:hidden">${contenido}</div>
    <div class="abs" style="left:${bx}px;top:${by}px;width:${bw}px;height:${bh}px;border-radius:20px 20px 6px 6px;
      border:solid #0b0d1a;border-width:${BISEL + 6}px ${BISEL}px ${BISEL}px;box-shadow:inset 0 0 0 1px #2a2f55, 0 0 0 1.5px #4a5180"></div>
    <div class="abs" style="left:${p.x + p.w / 2 - 4}px;top:${by + 9}px;width:8px;height:8px;border-radius:50%;background:#1f2440;box-shadow:inset 0 0 0 2px #2e3560"></div>
    <div class="abs" style="left:${bx - VUELO}px;top:${by + bh}px;width:${bw + VUELO * 2}px;height:${BASE_H}px;border-radius:3px 3px 22px 22px / 3px 3px 18px 18px;
      background:linear-gradient(#c9c6d4, #8e8aa0 55%, #5d5a70);box-shadow:inset 0 2px 0 #eeeaf6"></div>
    <div class="abs" style="left:${p.x + p.w / 2 - 90}px;top:${by + bh}px;width:180px;height:10px;border-radius:0 0 12px 12px;background:linear-gradient(#77738a,#a29fb2)"></div>`
  }
  const b = 14, r = 58, e = p.w / 390
  return `
    <div class="abs" style="left:${p.x}px;top:${p.y + BARRA_MOVIL * e}px;width:${p.w}px;height:${p.h - BARRA_MOVIL * e}px;overflow:hidden">${contenido}</div>
    <div class="abs" style="left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${BARRA_MOVIL * e}px;background:#1d2242;display:flex;align-items:center;justify-content:space-between;padding:${6 * e}px ${30 * e}px 0;
      font:500 ${15 * e}px/1 'Alegreya Sans', sans-serif;color:#f4ecdc">
      <span>9:41</span>
      <span style="display:flex;gap:${5 * e}px;align-items:center">
        <svg width="${17 * e}" height="${11 * e}" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="#f4ecdc"/><rect x="4.5" y="5" width="3" height="6" rx="1" fill="#f4ecdc"/><rect x="9" y="2.5" width="3" height="8.5" rx="1" fill="#f4ecdc"/><rect x="13.5" y="0" width="3" height="11" rx="1" fill="#f4ecdc"/></svg>
        <svg width="${24 * e}" height="${12 * e}" viewBox="0 0 24 12"><rect x=".5" y=".5" width="20" height="11" rx="3" fill="none" stroke="#f4ecdc" opacity=".6"/><rect x="2" y="2" width="15" height="8" rx="1.6" fill="#f4ecdc"/><rect x="21.5" y="4" width="1.6" height="4" rx=".8" fill="#f4ecdc" opacity=".6"/></svg>
      </span>
    </div>
    <div class="abs" style="left:${p.x - b}px;top:${p.y - b}px;width:${p.w + 2 * b}px;height:${p.h + 2 * b}px;border-radius:${r}px;border:${b}px solid #0b0d1a;
      box-shadow:0 0 0 2px #4a5180, inset 0 0 0 1px #2a2f55"></div>
    <div class="abs" style="left:${p.x + p.w / 2 - 46 * e}px;top:${p.y + 9 * e}px;width:${92 * e}px;height:${26 * e}px;border-radius:${14 * e}px;background:#0b0d1a"></div>
    <div class="abs" style="left:${p.x + p.w + b}px;top:${p.y + 170}px;width:4px;height:90px;border-radius:0 3px 3px 0;background:#3a4070"></div>`
}

/** Texto de la escena: pregunta (cursiva dorada), titular y puntos. */
function capaTexto(layout, t) {
  const L = LAYOUTS[layout], s = L.texto
  return `<div class="abs" style="left:${s.x}px;width:${s.w}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:0">
    <p style="font:italic 700 38px/1.1 Alegreya, serif;color:#d9a23f">${t.k}</p>
    <div style="width:132px;height:10px;margin:22px 0 26px;background:${AWAYU} repeat-x;background-size:auto 10px;border-radius:2px"></div>
    <h1 style="font:800 ${L.tipo === 'movil' ? 70 : 58}px/1.04 Alegreya, serif;letter-spacing:-.5px;color:#fbf7ee;text-wrap:balance">${t.t}</h1>
    <ul style="list-style:none;padding:0;margin-top:34px;display:grid;gap:16px">
      ${t.b.map((x, i) => `<li style="display:flex;gap:16px;align-items:baseline;font:500 29px/1.3 'Alegreya Sans', sans-serif;color:#e9dcc0">
        <i style="flex:none;width:12px;height:12px;transform:translateY(-3px) rotate(45deg);background:${['#2c8c8f', '#8cc084', '#d9a23f'][i % 3]}"></i>${x}</li>`).join('')}
    </ul>
  </div>`
}

function capaTitulo(t) {
  return `<div class="abs" style="inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
    ${LOGO(150)}
    <p style="margin-top:22px;font:italic 700 40px/1 Alegreya, serif;color:#d9a23f">${t.marca}</p>
    <h1 style="margin-top:10px;font:800 150px/1 Alegreya, serif;letter-spacing:-2px;color:#fbf7ee">${t.nombre}</h1>
    <div style="width:220px;height:12px;margin:34px 0 30px;background:${AWAYU} repeat-x;background-size:auto 12px"></div>
    <p style="font:500 40px/1.25 'Alegreya Sans', sans-serif;color:#e9dcc0">${t.lema}</p>
    <p style="margin-top:70px;font:400 26px/1 'Alegreya Sans', sans-serif;color:#9ea3c9;letter-spacing:.5px">${t.pie}</p>
  </div>`
}

function capaCierre(t) {
  return `<div class="abs" style="inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
    ${LOGO(120)}
    <h1 style="margin-top:26px;font:800 112px/1 Alegreya, serif;letter-spacing:-1.5px;color:#fbf7ee">${t.lema}</h1>
    <div style="width:200px;height:12px;margin:34px 0 30px;background:${AWAYU} repeat-x;background-size:auto 12px"></div>
    <p style="max-width:1100px;font:500 36px/1.3 'Alegreya Sans', sans-serif;color:#e9dcc0">${t.sub}</p>
    <p style="margin-top:56px;padding:14px 30px;border-radius:99px;border:2px solid #d9a23f;font:500 30px/1 'Alegreya Sans', sans-serif;color:#f3dfae">${t.url}</p>
  </div>`
}

const pagina = (cuerpo) => `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}</style><body>${cuerpo}</body>`

/** Capas sueltas para el video. */
export const capas = {
  fondo: (layout) => pagina(capaFondo(layout)),
  marco: (layout) => pagina(capaMarco(layout)),
  texto: (layout, t) => pagina(capaTexto(layout, t)),
  titulo: (t) => pagina(capaTitulo(t)),
  cierre: (t) => pagina(capaCierre(t)),
}

/** Maqueta fija completa (fondo + dispositivo con la captura + texto). */
export const fija = (layout, t, img) => pagina(capaFondo(layout) + capaMarco(layout, img) + capaTexto(layout, t))

/** Portada fija: laptop con el mapa, celular con la ficha y el nombre del proyecto. */
export function portada(t, imgLaptop, imgMovil) {
  const lap = { tipo: 'laptop', pantalla: { x: 760, y: 250, w: 900, h: 506 }, texto: { x: 1300, w: 0 } }
  const mov = { tipo: 'movil', pantalla: { x: 1500, y: 380, w: 290, h: 628 }, texto: { x: 0, w: 0 } }
  LAYOUTS.__lap = lap
  LAYOUTS.__mov = mov
  const html = pagina(`${capaFondo('__lap')}
    <div class="abs" style="left:${mov.pantalla.x + 10}px;top:${mov.pantalla.y + 40}px;width:${mov.pantalla.w}px;height:${mov.pantalla.h}px;border-radius:50px;background:#000;filter:blur(40px);opacity:.6"></div>
    ${capaMarco('__lap', imgLaptop)}${capaMarco('__mov', imgMovil)}
    <div class="abs" style="left:120px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center">
      <div style="display:flex;align-items:center;gap:18px">${LOGO(78)}<p style="font:italic 700 34px/1 Alegreya, serif;color:#d9a23f">${t.marca}</p></div>
      <h1 style="margin-top:26px;font:800 108px/1 Alegreya, serif;letter-spacing:-1.5px;color:#fbf7ee">${t.nombre}</h1>
      <div style="width:170px;height:11px;margin:28px 0 26px;background:${AWAYU} repeat-x;background-size:auto 11px"></div>
      <p style="font:500 34px/1.28 'Alegreya Sans', sans-serif;color:#e9dcc0;width:440px">${t.lema}</p>
    </div>`)
  delete LAYOUTS.__lap
  delete LAYOUTS.__mov
  return html
}
