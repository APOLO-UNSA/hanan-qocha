// Comparador de estrategias de manejo de la finca (docs/HANAN_QOCHA_PROYECTO.md §4.4, Pantalla 4).
// Indicadores simples y explicables de 0 a 100. TODO es un ESQUEMA por validar con productores y con Ortega:
// las rotaciones, las especies y los pesos son supuestos del modelo, no datos.

import type { Dataset, Site } from './data'
import { cochaState, conditionsFrom, PARAMS, project, type CochaState } from './model'
import { cercano, type Zona } from './zona'

export type EstrategiaId = 'actual' | 'leguminosa' | 'cushuro'

/** Escenario de clima de la temporada: lluvia relativa a lo normal (−0,4 a +0,4) y calentamiento (0 a 3 °C). */
export interface Escenario {
  lluvia: number
  temp: number
}

/** Prioridades del productor: 0 poco, 1 medio, 2 mucho. Reordenan las estrategias, no cambian la evidencia. */
export interface Prioridades {
  agua: number
  ingreso: number
  suelo: number
}

export interface Indicador {
  valor: number // 0–100, más es mejor
  lo: number // incertidumbre (rango)
  hi: number
  hipotesis?: number // parte no confirmada (se muestra aparte y NO suma)
}

export interface Evaluacion {
  id: EstrategiaId
  agua: Indicador
  suelo: Indicador
  ingreso: Indicador
  total: number
  recomendada: boolean
  cosechaKg?: number
}

/** Un dato de la finca: valor, de dónde sale y si es medido (real) o estimado por el modelo. */
export interface Dato {
  v: number
  fuente: string
  fecha?: string // fecha o periodo del dato real
  real: boolean
}

/**
 * Datos NASA de la finca en una grilla común. Con zona.json (datos reales del frente Campo y Satélite) parten de lo
 * medido; sin él, se estiman. El escenario (lluvia, temperatura) se aplica encima en los dos casos.
 */
export interface DatosFinca {
  smap: Dato // humedad del suelo (m³/m³)
  gpm: Dato // lluvia de la temporada (mm)
  lst: Dato // temperatura de superficie (°C)
  ndvi: Dato // vegetación alrededor de la cocha
  heladas: Dato // noches con helada en el año
}

const clamp = (x: number, a = 0, b = 100) => Math.max(a, Math.min(b, x))
const ind = (v: number, inc: number, hip?: number): Indicador => ({
  valor: clamp(v),
  lo: clamp(v - inc),
  hi: clamp(v + inc),
  ...(hip ? { hipotesis: hip } : {}),
})

export function datosFinca(site: Site, e: Escenario, zona?: Zona | null): DatosFinca {
  const seca = Math.max(0, -e.lluvia)
  const clima = zona ? cercano(site, zona.clima, 40) : undefined
  // La cocha detectada por satélite más cercana (a menos de 5 km) da la temperatura de superficie y la vegetación
  const det = zona ? cercano(site, zona.detectadas, 5) : undefined
  const eco = det && zona?.ecostress[det.id]
  const smap = zona?.smap
  return {
    smap: smap
      ? { v: +(smap.humedad * (1 + 0.8 * e.lluvia)).toFixed(2), fuente: 'SMAP', fecha: smap.fecha, real: true }
      : { v: +((0.2 + 0.1 * site.indice_satelital) * (1 + 0.8 * e.lluvia)).toFixed(2), fuente: 'SMAP', real: false },
    gpm: clima
      ? { v: Math.round(clima.lluvia_temporada_mm * (1 + e.lluvia)), fuente: 'NASA POWER', fecha: clima.temporada, real: true }
      : { v: Math.round(520 * (1 + e.lluvia)), fuente: 'GPM IMERG', real: false },
    lst: eco
      ? { v: +(eco.lst_c + e.temp).toFixed(1), fuente: `ECOSTRESS, ${det!.id}`, fecha: eco.fecha, real: true }
      : { v: +(16 - (site.altitud_m - 4000) / 120 + e.temp).toFixed(1), fuente: 'ECOSTRESS, MODIS', real: false },
    ndvi: det
      ? { v: +(det.ndvi_anillo - 0.08 * seca).toFixed(2), fuente: `Sentinel-2, ${det.id}`, fecha: det.fecha ?? undefined, real: true }
      : { v: +(0.25 + 0.2 * site.indice_satelital - 0.08 * seca).toFixed(2), fuente: 'Landsat, MODIS', real: false },
    heladas: clima
      ? { v: Math.max(0, Math.round(clima.heladas_anio * (1 - 0.18 * e.temp))), fuente: 'NASA POWER', fecha: `${clima.hasta.slice(0, 4)}`, real: true }
      : { v: Math.max(0, Math.round(60 + (site.altitud_m - 4300) / 25 - 8 * e.temp)), fuente: 'MODIS LST', real: false },
  }
}

/** Cosecha de cushuro de una temporada de lluvias (120 días) con el gemelo de la cocha, bajo el escenario. */
export function cosechaTemporada(st: CochaState, e: Escenario): number {
  if (st.estado === 'no-apta') return 0
  const base = conditionsFrom(st.sensor)
  const c = { ...base, temp_agua_c: base.temp_agua_c + e.temp, profundidad_m: base.profundidad_m * (1 + 1.2 * e.lluvia) }
  const K = st.capacidad_kg
  const fin = project(K * 0.08, K, c, 120, st.calib?.alpha ?? 1).at(-1)!
  return fin >= PARAMS.umbral_cosecha * K * 0.5 ? fin * PARAMS.fraccion_cosecha : 0
}

export function evaluar(d: Dataset, site: Site, e: Escenario, p: Prioridades): { evals: Evaluacion[]; st: CochaState } {
  const st = cochaState(d, site)
  const seca = Math.max(0, -e.lluvia), humeda = Math.max(0, e.lluvia)
  const kg = cosechaTemporada(st, e)
  const extra = 40 * Math.min(1, kg / 25) * st.iac

  const evals: Omit<Evaluacion, 'total'>[] = [
    {
      id: 'actual',
      agua: ind(55 - 50 * seca + 10 * humeda - 4 * e.temp, 8 + 20 * seca),
      suelo: ind(45 - 5 * e.temp, 6),
      ingreso: ind(50 - 30 * seca - 3 * e.temp, 8),
      recomendada: true,
    },
    {
      id: 'leguminosa',
      agua: ind(62 - 35 * seca + 8 * humeda - 3 * e.temp, 9 + 18 * seca),
      suelo: ind(74 - 4 * e.temp, 9),
      ingreso: ind(54 - 25 * seca - 2 * e.temp, 12),
      recomendada: true,
    },
    {
      id: 'cushuro',
      agua: ind(58 - 60 * seca + 15 * humeda - 5 * e.temp, 10 + 25 * seca),
      suelo: ind(47 - 5 * e.temp, 7, 12), // aporte al suelo vecino: HIPÓTESIS, no suma
      ingreso: ind(50 - 30 * seca - 3 * e.temp + extra, 12 + 15 * seca),
      recomendada: st.iac >= 0.4 && kg > 0,
      cosechaKg: kg,
    },
  ]
  const w = [p.agua, p.ingreso, p.suelo].map((x) => [0.5, 1, 2][x] ?? 1)
  const evaluadas = evals.map((ev) => ({
    ...ev,
    total: Math.round((w[0] * ev.agua.valor + w[1] * ev.ingreso.valor + w[2] * ev.suelo.valor) / (w[0] + w[1] + w[2])),
  }))
  // Más alineada primero; una estrategia no recomendada va al final
  evaluadas.sort((a, b) => Number(b.recomendada) - Number(a.recomendada) || b.total - a.total)
  return { evals: evaluadas, st }
}
