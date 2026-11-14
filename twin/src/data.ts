// Tipos que reflejan data/contracts/*.schema.json y carga de los JSON.

export interface Site {
  cocha_id: string
  nombre: string
  lat: number
  lon: number
  altitud_m: number
  indice_satelital: number
}

export interface SensorReading {
  cocha_id: string
  timestamp: string
  tds_ppm: number
  temp_agua_c: number
  ph?: number
  uv_index?: number
}

export interface VisionResult {
  cocha_id: string
  timestamp: string
  foto: string
  cobertura_pct: number
  biomasa_kg: number
}

export interface Recommendation {
  codigo: string
  condicion: string
  mensaje_es: string
  mensaje_en: string
}

export interface Dataset {
  sites: Site[]
  sensor: SensorReading[]
  vision: VisionResult[]
  recommendations: Recommendation[]
}

export type DataSource = 'processed' | 'live' | 'mock' | 'demo'
const SOURCES: DataSource[] = ['processed', 'live', 'mock', 'demo']

/** Fuente de datos: ?datos=demo en la URL manda; si no, VITE_DATA_SOURCE; si no, processed. */
export const DEFAULT_SOURCE: DataSource = SOURCES.includes(import.meta.env.VITE_DATA_SOURCE)
  ? import.meta.env.VITE_DATA_SOURCE
  : 'processed'
const fromUrl = new URLSearchParams(location.search).get('datos') as DataSource | null
export const DATA_SOURCE: DataSource = fromUrl && SOURCES.includes(fromUrl) ? fromUrl : DEFAULT_SOURCE

/** URL con la fuente cambiada (conserva el resto de la URL). */
export function sourceUrl(src: DataSource): string {
  const u = new URL(location.href)
  if (src === DEFAULT_SOURCE) u.searchParams.delete('datos')
  else u.searchParams.set('datos', src)
  return u.toString()
}

/**
 * Carga un archivo. Devuelve:
 *   - la lista (vacía si el archivo no existe: es normal que falten datos reales),
 *   - null si la carga FALLÓ (red caída, JSON a medio escribir…), para conservar los datos anteriores.
 */
async function load(name: string): Promise<unknown[] | null> {
  // demo: conjunto ficticio empaquetado en twin/public/demo (para video y pitch).
  const dir = DATA_SOURCE === 'demo' ? 'demo' : 'data'
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${dir}/${name}.json`, { cache: 'no-store' })
    if (res.status === 404) return []
    if (!res.ok) return null
    const json = JSON.parse(await res.text())
    if (!Array.isArray(json)) {
      console.warn(`[gemelo] ${name}.json no es una lista; se ignora`)
      return null
    }
    return json
  } catch (e) {
    console.warn(`[gemelo] no se pudo leer ${name}.json:`, e)
    return null
  }
}

// ---------- Saneamiento: un registro malo se descarta sin tumbar el gemelo ----------

const isObj = (o: unknown): o is Record<string, unknown> => typeof o === 'object' && o !== null
const str = (v: unknown) => typeof v === 'string' && v.trim() !== ''
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const optNum = (v: unknown) => v == null || num(v)
const date = (v: unknown) => str(v) && Number.isFinite(Date.parse(v as string))

const VALID = {
  sites: (o: Record<string, unknown>) =>
    str(o.cocha_id) && str(o.nombre) && num(o.lat) && num(o.lon) && Math.abs(o.lat as number) <= 90 &&
    Math.abs(o.lon as number) <= 180 && num(o.altitud_m) && num(o.indice_satelital),
  sensor: (o: Record<string, unknown>) =>
    str(o.cocha_id) && date(o.timestamp) && num(o.tds_ppm) && num(o.temp_agua_c) && optNum(o.ph) && optNum(o.uv_index),
  vision: (o: Record<string, unknown>) =>
    str(o.cocha_id) && date(o.timestamp) && typeof o.foto === 'string' && num(o.cobertura_pct) && num(o.biomasa_kg) &&
    (o.cobertura_pct as number) >= 0 && (o.biomasa_kg as number) >= 0,
  recommendations: (o: Record<string, unknown>) =>
    str(o.codigo) && typeof o.condicion === 'string' && typeof o.mensaje_es === 'string' && typeof o.mensaje_en === 'string',
}

function clean<T>(name: keyof typeof VALID, items: unknown[]): T[] {
  const ok = items.filter((o) => isObj(o) && VALID[name](o)) as T[]
  if (ok.length < items.length) console.warn(`[gemelo] ${name}.json: ${items.length - ok.length} registro(s) inválido(s) descartado(s)`)
  return ok
}

/**
 * Carga los cuatro archivos. Si alguno falla (no "falta": falla), se conserva su versión anterior en `prev`;
 * así una lectura en vivo a medio escribir no borra el sensor de la pantalla.
 */
export async function loadDataset(prev?: Dataset): Promise<Dataset> {
  const names = ['sites', 'sensor', 'vision', 'recommendations'] as const
  const raw = await Promise.all(names.map((n) => load(n)))
  const pick = <K extends (typeof names)[number]>(k: K, i: number): Dataset[K] =>
    raw[i] === null ? (prev?.[k] ?? []) : (clean(k, raw[i]!) as Dataset[K])
  const d: Dataset = {
    sites: pick('sites', 0),
    sensor: pick('sensor', 1),
    vision: pick('vision', 2),
    recommendations: pick('recommendations', 3),
  }
  // Un cocha_id repetido en sites.json: se queda el primero.
  const seen = new Set<string>()
  d.sites = d.sites.filter((s) => !seen.has(s.cocha_id) && seen.add(s.cocha_id))
  if (DATA_SOURCE === 'demo' && !prev) shiftToNow(d)
  return d
}

/** En la demo, desplaza todas las fechas para que la última lectura sea "ahora" (así nunca sale "sin datos recientes"). */
function shiftToNow(d: Dataset) {
  const last = Math.max(...d.sensor.map((s) => Date.parse(s.timestamp)))
  if (!Number.isFinite(last)) return
  const off = Date.now() - 60_000 - last
  const shift = (o: { timestamp: string }) => (o.timestamp = new Date(Date.parse(o.timestamp) + off).toISOString())
  d.sensor.forEach(shift)
  d.vision.forEach(shift)
}

const byTime = (a: { timestamp: string }, b: { timestamp: string }) =>
  Date.parse(a.timestamp) - Date.parse(b.timestamp)

/** Última lectura del sensor para una cocha. */
export function latestSensor(d: Dataset, id: string): SensorReading | undefined {
  return d.sensor.filter((s) => s.cocha_id === id).sort(byTime).at(-1)
}

/** Lecturas del sensor de una cocha en las últimas `horas` (contadas desde la más reciente), ordenadas. */
export function sensorHistory(d: Dataset, id: string, horas = 48): SensorReading[] {
  const serie = d.sensor.filter((s) => s.cocha_id === id).sort(byTime)
  const fin = Date.parse(serie.at(-1)?.timestamp ?? '')
  return Number.isFinite(fin) ? serie.filter((s) => fin - Date.parse(s.timestamp) <= horas * 3600e3) : []
}

/** Serie de visión ordenada en el tiempo para una cocha. */
export function visionSeries(d: Dataset, id: string): VisionResult[] {
  return d.vision.filter((v) => v.cocha_id === id).sort(byTime)
}
