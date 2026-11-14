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

async function load<T>(name: string): Promise<T[]> {
  // demo: conjunto ficticio empaquetado en twin/public/demo (para video y pitch).
  const dir = DATA_SOURCE === 'demo' ? 'demo' : 'data'
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${dir}/${name}.json`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    return Array.isArray(json) ? json : []
  } catch {
    // Un archivo faltante o roto nunca debe tumbar el gemelo.
    return []
  }
}

export async function loadDataset(): Promise<Dataset> {
  const [sites, sensor, vision, recommendations] = await Promise.all([
    load<Site>('sites'),
    load<SensorReading>('sensor'),
    load<VisionResult>('vision'),
    load<Recommendation>('recommendations'),
  ])
  const d = { sites, sensor, vision, recommendations }
  if (DATA_SOURCE === 'demo') shiftToNow(d)
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

/** Serie de visión ordenada en el tiempo para una cocha. */
export function visionSeries(d: Dataset, id: string): VisionResult[] {
  return d.vision.filter((v) => v.cocha_id === id).sort(byTime)
}
