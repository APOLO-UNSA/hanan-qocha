// Comparador de estrategias de manejo de la finca (docs/HANAN_QOCHA_PROYECTO.md §4.4, Pantalla 4).
// Indicadores simples y explicables de 0 a 100. TODO es un ESQUEMA por validar con productores y con Ortega:
// las rotaciones, las especies y los pesos son supuestos del modelo, no datos.

import type { Dataset, Site } from './data'
import { cochaState, conditionsFrom, PARAMS, project, type CochaState } from './model'

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

/** Datos NASA de la finca en una grilla común (agregados a la finca). Simulados a partir de la cocha y del escenario. */
export interface DatosFinca {
  smap: number // humedad del suelo SMAP (m³/m³)
  gpm: number // lluvia de la temporada GPM IMERG (mm)
  lst: number // temperatura de superficie ECOSTRESS/MODIS (°C, mediodía)
  ndvi: number // vegetación Landsat/MODIS
  heladas: number // noches con helada en la temporada
}

const clamp = (x: number, a = 0, b = 100) => Math.max(a, Math.min(b, x))
const ind = (v: number, inc: number, hip?: number): Indicador => ({
  valor: clamp(v),
  lo: clamp(v - inc),
  hi: clamp(v + inc),
  ...(hip ? { hipotesis: hip } : {}),
})

export function datosFinca(site: Site, e: Escenario): DatosFinca {
  return {
    smap: +((0.2 + 0.1 * site.indice_satelital) * (1 + 0.8 * e.lluvia)).toFixed(2),
    gpm: Math.round(520 * (1 + e.lluvia)),
    lst: +(16 - (site.altitud_m - 4000) / 120 + e.temp).toFixed(1),
    ndvi: +(0.25 + 0.2 * site.indice_satelital - 0.08 * Math.max(0, -e.lluvia)).toFixed(2),
    heladas: Math.max(0, Math.round(60 + (site.altitud_m - 4300) / 25 - 8 * e.temp)),
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
