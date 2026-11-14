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

export const DATA_SOURCE = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? 'processed'

async function load<T>(name: string): Promise<T[]> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: 'no-store' })
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
  return { sites, sensor, vision, recommendations }
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
