// Datos satelitales REALES de la zona piloto (frente Campo y Satélite), resumidos en public/nasa/zona.json
// por scripts/gen-nasa.mjs a partir de satellite/datos/*.csv. Si el archivo no está, la app sigue con estimaciones.

export interface CochaDetectada {
  id: string
  lat: number
  lon: number
  altitud_m: number
  pendiente_deg: number
  area_ha: number
  ndwi: number
  ndvi_anillo: number
  indice_prelim: number
  fecha: string | null
}
export interface ClimaPunto {
  id: string
  lat: number
  lon: number
  hasta: string
  lluvia_temporada_mm: number
  temporada: string
  lluvia_30d_mm: number
  heladas_anio: number
  heladas_temporada: number
  t_aire_30d: number | null
  humedad_suelo_power: number | null
}
export interface Zona {
  generado: string
  detectadas: CochaDetectada[]
  ecostress: Record<string, { lst_c: number; fecha: string }>
  hls: Record<string, { fecha: string; ndwi: number }[]>
  smap: { humedad: number; fecha: string; media: number; n: number } | null
  clima: ClimaPunto[]
}

export let ZONA: Zona | null = null

export async function cargarZona(): Promise<Zona | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}nasa/zona.json`)
    ZONA = res.ok ? ((await res.json()) as Zona) : null
  } catch {
    ZONA = null
  }
  return ZONA
}

/** Distancia aproximada en km (suficiente a esta escala). */
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dy = (a.lat - b.lat) * 111.2
  const dx = (a.lon - b.lon) * 111.2 * Math.cos((a.lat * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

/** El elemento más cercano a un punto, si está a menos de `max` km. */
export function cercano<T extends { lat: number; lon: number }>(p: { lat: number; lon: number }, lista: T[], max = Infinity): T | undefined {
  let mejor: T | undefined, dmin = max
  for (const x of lista) {
    const dd = km(p, x)
    if (dd <= dmin) (dmin = dd), (mejor = x)
  }
  return mejor
}

/** Fecha corta legible (14 nov 2026 / Nov 14, 2026). */
export const fechaCorta = (iso: string, lang: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
