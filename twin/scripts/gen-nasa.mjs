// Resume los datos satelitales REALES del frente Campo y Satélite (satellite/datos/*.csv) en
// twin/public/nasa/zona.json, que leen el mapa y el comparador de estrategias.
//
//   node twin/scripts/gen-nasa.mjs
//
// Fuentes: Sentinel-2 + SRTM (cochas detectadas), ECOSTRESS (temperatura de superficie), HLS (NDWI),
// SMAP (humedad del suelo) y NASA POWER (clima diario). Volver a correrlo cuando Paolo o Adrián actualicen los CSV.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const DATOS = resolve(import.meta.dirname, '../../satellite/datos')
const OUT = resolve(import.meta.dirname, '../public/nasa')

function csv(nombre) {
  const f = resolve(DATOS, nombre)
  if (!existsSync(f)) return []
  const [cab, ...filas] = readFileSync(f, 'utf8').replace(/\r/g, '').trim().split('\n')
  const k = cab.split(',')
  return filas.map((l) => Object.fromEntries(l.split(',').map((v, i) => [k[i], v === '' ? null : isNaN(+v) ? v : +v])))
}
const r = (x, n = 2) => (x == null ? null : +x.toFixed(n))
const suma = (a) => a.reduce((s, x) => s + x, 0)
const media = (a) => (a.length ? suma(a) / a.length : null)

// Cochas detectadas con Sentinel-2 (fecha de la escena desde su nombre)
const detectadas = csv('cochas_candidatas.csv').map((c) => ({
  id: c.id, lat: c.lat, lon: c.lon, altitud_m: c.altitud_m, pendiente_deg: c.pendiente_deg, area_ha: c.area_ha,
  ndwi: c.ndwi, ndvi_anillo: c.ndvi_anillo, indice_prelim: c.indice_satelital_prelim,
  fecha: String(c.escena).match(/_(\d{4})(\d{2})(\d{2})_/)?.slice(1).join('-') ?? null,
}))

// ECOSTRESS: última pasada sin nubes por cocha
const ecostress = {}
for (const f of csv('ecostress_lst.csv').filter((f) => f.nube_flag === 0 && f.lst_c != null).sort((a, b) => a.utc.localeCompare(b.utc)))
  ecostress[f.cocha] = { lst_c: f.lst_c, fecha: f.utc.slice(0, 10) }

// HLS: NDWI válido por cocha (serie)
const hls = {}
for (const f of csv('hls_ndwi.csv').filter((f) => f.ndwi != null && f.ndwi > -1 && f.ndwi < 1)) (hls[f.cocha] ??= []).push({ fecha: f.fecha, ndwi: f.ndwi })

// SMAP: lecturas válidas (9 km), la más reciente
const smapV = csv('smap_humedad_suelo.csv').filter((f) => f.humedad_m3m3 != null).sort((a, b) => a.fecha.localeCompare(b.fecha))
const smap = smapV.length ? { humedad: smapV.at(-1).humedad_m3m3, fecha: smapV.at(-1).fecha, media: r(media(smapV.map((f) => f.humedad_m3m3)), 3), n: smapV.length } : null

// NASA POWER: clima por punto (coordenadas en satellite/power_clima.py)
const PUNTOS = [...readFileSync(resolve(DATOS, '../power_clima.py'), 'utf8').matchAll(/\("(\w+-\d+)", (-?[\d.]+), (-?[\d.]+)\)/g)].map((m) => ({ id: m[1], lat: +m[2], lon: +m[3] }))
const clima = PUNTOS.map((p) => {
  const d = csv(`${p.id}_diario.csv`).filter((f) => f.T2M != null)
  if (!d.length) return null
  const ultima = d.at(-1).fecha
  const hace = (dias) => new Date(Date.parse(ultima) - dias * 864e5).toISOString().slice(0, 10)
  const anio = d.filter((f) => f.fecha > hace(365))
  const mes = d.filter((f) => f.fecha > hace(30))
  // Última temporada de lluvias completa (dic–mar)
  const y = +ultima.slice(0, 4) - (ultima.slice(5, 7) >= '04' ? 0 : 1) // la temporada que terminó en marzo de y
  const temporada = d.filter((f) => f.fecha >= `${y - 1}-12-01` && f.fecha <= `${y}-03-31`)
  return {
    id: p.id, lat: p.lat, lon: p.lon, hasta: ultima,
    lluvia_temporada_mm: Math.round(suma(temporada.map((f) => f.PRECTOTCORR ?? 0))),
    temporada: `dic ${y - 1} – mar ${y}`,
    lluvia_30d_mm: Math.round(suma(mes.map((f) => f.PRECTOTCORR ?? 0))),
    heladas_anio: anio.filter((f) => f.T2M_MIN != null && f.T2M_MIN < 0).length,
    heladas_temporada: temporada.filter((f) => f.T2M_MIN != null && f.T2M_MIN < 0).length,
    t_aire_30d: r(media(mes.map((f) => f.T2M)), 1),
    humedad_suelo_power: r(d.filter((f) => f.GWETTOP != null).at(-1)?.GWETTOP),
  }
}).filter(Boolean)

const zona = { generado: new Date().toISOString().slice(0, 10), detectadas, ecostress, hls, smap, clima }
mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'zona.json'), JSON.stringify(zona, null, 1) + '\n')
console.log(`zona.json: ${detectadas.length} cochas detectadas, ECOSTRESS ${Object.keys(ecostress).length}, HLS ${Object.keys(hls).length}, SMAP ${smap ? 'sí' : 'no'}, clima ${clima.length} puntos`)
console.log(JSON.stringify({ smap, clima }, null, 1))
