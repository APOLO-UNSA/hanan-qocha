// Modelo del gemelo digital (docs/HANAN_QOCHA_PROYECTO.md §4.3 y §5).
// TODOS los rangos y parámetros son SUPUESTOS DEL MODELO, a ajustar con literatura y datos de campo.

import type { Dataset, Recommendation, SensorReading, Site } from './data'
import { latestSensor, visionSeries } from './data'
import { recMsg, t } from './i18n'

/** Curva de aptitud trapezoidal: 0 fuera de [min,max], 1 entre [optLo,optHi], lineal en medio. */
export interface Range {
  min: number
  optLo: number
  optHi: number
  max: number
}

export const RANGES = {
  temp_agua_c: { min: 0, optLo: 8, optHi: 15, max: 25 },
  uv_index: { min: 0, optLo: 6, optHi: 11, max: 16 },
  tds_ppm: { min: 0, optLo: 0, optHi: 100, max: 300 },
  profundidad_m: { min: 0.05, optLo: 0.2, optHi: 0.6, max: 1.5 },
} satisfies Record<string, Range>

export const PARAMS = {
  r_max: 0.06, // tasa máxima diaria
  capacidad_default_kg: 40, // si no hay visión para estimarla
  umbral_cosecha: 0.8, // fracción de la capacidad a la que se recomienda cosechar
  fraccion_cosecha: 0.7, // cosechar 70 %, dejar 30 %
  biomasa_inicial_default_kg: 2,
}

export function suitability(x: number, r: Range): number {
  if (x < r.min || x > r.max) return 0
  if (x < r.optLo) return r.optLo === r.min ? 1 : (x - r.min) / (r.optLo - r.min)
  if (x > r.optHi) return r.optHi === r.max ? 1 : (r.max - x) / (r.max - r.optHi)
  return 1
}

export interface Conditions {
  temp_agua_c: number
  uv_index: number
  tds_ppm: number
  profundidad_m: number
}

export function factors(c: Conditions) {
  return {
    temp_agua_c: suitability(c.temp_agua_c, RANGES.temp_agua_c),
    uv_index: suitability(c.uv_index, RANGES.uv_index),
    tds_ppm: suitability(c.tds_ppm, RANGES.tds_ppm),
    profundidad_m: suitability(c.profundidad_m, RANGES.profundidad_m),
  }
}

export function dailyRate(c: Conditions): number {
  const f = factors(c)
  return PARAMS.r_max * f.temp_agua_c * f.uv_index * f.tds_ppm * f.profundidad_m
}

/**
 * Crecimiento logístico estándar: b(t+1) = b + r·b·(1 − b/K).
 * (La fórmula del documento multiplica (1+r)·(1−b/K), lo que haría decrecer la biomasa;
 * aquí se usa la forma logística discreta habitual.)
 */
export function project(b0: number, K: number, c: Conditions, days: number, alpha = 1): number[] {
  const r = alpha * dailyRate(c)
  const out = [b0]
  let b = b0
  for (let t = 0; t < days; t++) {
    b = b + r * b * (1 - b / K)
    out.push(b)
  }
  return out
}

// ---------- Estado de una cocha ----------

// ---------- Recalibración con la visión ----------

export interface Calibration {
  alpha: number // factor sobre la tasa del modelo (1 = sin cambio)
  n: number // nº de fotos usadas
  errAntes: number // error medio (kg) del modelo original
  errDespues: number // error medio (kg) del modelo recalibrado
}

/**
 * Cierra el ciclo: ajusta un factor α sobre la tasa diaria para que el modelo reproduzca la serie
 * medida por la cámara. Para cada par de fotos consecutivas proyecta desde la primera y compara con
 * la segunda; elige el α (0,05–3) con menor error cuadrático. Necesita al menos 2 fotos.
 */
export function calibrate(vis: { timestamp: string; biomasa_kg: number }[], K: number, c: Conditions): Calibration | null {
  if (vis.length < 2 || dailyRate(c) <= 0) return null
  const pairs = vis.slice(1).map((v, i) => ({
    b0: vis[i].biomasa_kg,
    b1: v.biomasa_kg,
    days: Math.max(1, Math.round((Date.parse(v.timestamp) - Date.parse(vis[i].timestamp)) / 864e5)),
  }))
  const err = (alpha: number) => {
    const sq = pairs.map((p) => (project(p.b0, K, c, p.days, alpha).at(-1)! - p.b1) ** 2)
    return Math.sqrt(sq.reduce((a, b) => a + b, 0) / sq.length)
  }
  let best = 1, bestErr = err(1)
  for (let a = 0.05; a <= 3.0001; a += 0.01) {
    const e = err(a)
    if (e < bestErr) [best, bestErr] = [a, e]
  }
  return { alpha: Math.round(best * 100) / 100, n: vis.length, errAntes: err(1), errDespues: bestErr }
}

export interface CochaState {
  site: Site
  sensor?: SensorReading
  capacidad_kg: number
  biomasa_kg: number
  indice_in_situ: number | null
  indice_vision: number | null
  iac: number
  estado: 'apta' | 'condicional' | 'no-apta'
  etapa: 0 | 1 | 2 | 3 // Apta, Sembrada, Creciendo, Lista para cosechar
  calib: Calibration | null
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

/** Condiciones de partida: lo que mide el sensor, y supuestos para lo que no mide. */
export function conditionsFrom(sensor?: SensorReading): Conditions {
  return {
    temp_agua_c: sensor?.temp_agua_c ?? 10,
    uv_index: sensor?.uv_index ?? 9,
    tds_ppm: sensor?.tds_ppm ?? 80,
    profundidad_m: 0.4, // el sensor aún no mide nivel
  }
}

export function cochaState(d: Dataset, site: Site): CochaState {
  const sensor = latestSensor(d, site.cocha_id)
  const vis = visionSeries(d, site.cocha_id)
  const last = vis.at(-1)

  // Capacidad: biomasa que habría con 100 % de cobertura, estimada desde la visión.
  // Con muy poca cobertura (< 5 %) la estimación se dispara (12 kg al 0,5 % → 2 400 kg): se usa el valor por defecto.
  // La capacidad nunca es menor que lo ya medido, y la biomasa de partida nunca es 0 (si no, el modelo no crece).
  const biomasa_kg = Math.max(last?.biomasa_kg ?? PARAMS.biomasa_inicial_default_kg, 0.1)
  const capacidad_kg = Math.max(
    last && last.cobertura_pct >= 5 ? last.biomasa_kg / (Math.min(last.cobertura_pct, 100) / 100) : PARAMS.capacidad_default_kg,
    biomasa_kg * 1.05,
  )

  // Índice in situ: promedio de las curvas de aptitud de lo que mide el sensor.
  let indice_in_situ: number | null = null
  if (sensor) {
    const f = [
      suitability(sensor.tds_ppm, RANGES.tds_ppm),
      suitability(sensor.temp_agua_c, RANGES.temp_agua_c),
    ]
    if (sensor.uv_index != null) f.push(suitability(sensor.uv_index, RANGES.uv_index))
    indice_in_situ = f.reduce((a, b) => a + b, 0) / f.length
  }

  // Índice de visión: crecimiento observado frente al proyectado entre las dos últimas fotos.
  let indice_vision: number | null = null
  if (vis.length >= 2) {
    const prev = vis.at(-2)!
    const days = Math.max(1, Math.round((Date.parse(last!.timestamp) - Date.parse(prev.timestamp)) / 864e5))
    const proj = project(prev.biomasa_kg, capacidad_kg, conditionsFrom(sensor), days).at(-1)!
    const projGrowth = proj - prev.biomasa_kg
    const realGrowth = last!.biomasa_kg - prev.biomasa_kg
    indice_vision = projGrowth > 0 ? clamp01(realGrowth / projGrowth) : realGrowth >= 0 ? 1 : 0
  } else if (last) {
    // Una sola foto: se usa la cobertura como aproximación (supuesto).
    indice_vision = clamp01(last.cobertura_pct / 100 / PARAMS.umbral_cosecha)
  }

  // IAC = 0,4·sat + 0,4·in situ + 0,2·visión; si falta una fuente, se reparte su peso.
  const parts: [number, number | null][] = [
    [0.4, site.indice_satelital],
    [0.4, indice_in_situ],
    [0.2, indice_vision],
  ]
  const avail = parts.filter(([, v]) => v != null) as [number, number][]
  const wsum = avail.reduce((a, [w]) => a + w, 0)
  const iac = wsum ? avail.reduce((a, [w, v]) => a + w * clamp01(v), 0) / wsum : 0

  const estado = iac >= 0.7 ? 'apta' : iac >= 0.4 ? 'condicional' : 'no-apta'
  const etapa: CochaState['etapa'] = !last
    ? 0
    : biomasa_kg >= PARAMS.umbral_cosecha * capacidad_kg
      ? 3
      : vis.length >= 2
        ? 2
        : 1

  const calib = calibrate(vis, capacidad_kg, conditionsFrom(sensor))
  return { site, sensor, capacidad_kg, biomasa_kg, indice_in_situ, indice_vision, iac, estado, etapa, calib }
}

export const ESTADO_INFO = {
  apta: { label: t.apta, color: '#3b7a4c', msg: t.aptaMsg },
  condicional: { label: t.condicional, color: '#d9a23f', msg: t.condicionalMsg },
  'no-apta': { label: t.noApta, color: '#c4552d', msg: t.noAptaMsg },
} as const

// ---------- Acción recomendada ----------

export interface Action {
  codigo: string
  titulo: string
  detalle: string
  nivel: 'ok' | 'aviso' | 'alerta'
}

/**
 * Evalúa la "condicion" de recommendations.json, p. ej. "tds_ppm > 150" o "tds_ppm <= 150 && temp_agua_c < 20".
 * Solo admite comparaciones simples unidas con && / "y"; nada de eval().
 */
export function evalCondition(cond: string, vars: Record<string, number | undefined>): boolean {
  const clauses = cond.split(/\s*(?:&&|\by\b|\band\b)\s*/i)
  return clauses.every((c) => {
    const m = c.trim().match(/^([a-z_]\w*)\s*(<=|>=|==|!=|<|>)\s*(-?\d+(?:[.,]\d+)?)$/i)
    if (!m) return false
    const v = vars[m[1]]
    if (v == null) return false
    const n = parseFloat(m[3].replace(',', '.'))
    switch (m[2]) {
      case '<': return v < n
      case '<=': return v <= n
      case '>': return v > n
      case '>=': return v >= n
      case '==': return v === n
      default: return v !== n
    }
  })
}

export function recommend(
  c: Conditions,
  biomasa_kg: number,
  capacidad_kg: number,
  recs: Recommendation[],
  alpha = 1,
  extra: Record<string, number | undefined> = {}, // variables medidas que no entran al modelo (p. ej. ph)
): Action[] {
  const actions: Action[] = []
  const f = factors(c)
  const vars = { ...extra, ...c, biomasa_kg, capacidad_kg, biomasa_pct: (100 * biomasa_kg) / capacidad_kg }

  // 1. Mensajes del equipo de negocio (recommendations.json) que se cumplan.
  for (const r of recs) {
    if (r.codigo === 'OK') continue
    if (evalCondition(r.condicion, vars)) actions.push({ codigo: r.codigo, titulo: recMsg(r), detalle: r.condicion, nivel: 'alerta' })
  }

  // 2. Reglas del modelo.
  if (c.tds_ppm > RANGES.tds_ppm.optHi && !actions.some((a) => a.codigo.startsWith('TDS')))
    actions.push({ codigo: 'RENOVAR_AGUA', titulo: t.renewWater, detalle: t.renewWaterDet(c.tds_ppm), nivel: f.tds_ppm < 0.3 ? 'alerta' : 'aviso' })
  if ((c.temp_agua_c > RANGES.temp_agua_c.optHi || c.uv_index > RANGES.uv_index.optHi) && !actions.some((a) => /CALID|TEMP|SOMBRA/.test(a.codigo)))
    actions.push({ codigo: 'SOMBRA', titulo: t.shade, detalle: t.shadeDet, nivel: 'aviso' })
  if (c.profundidad_m < RANGES.profundidad_m.optLo)
    actions.push({ codigo: 'PROFUNDIDAD', titulo: t.depth, detalle: t.depthDet(c.profundidad_m.toFixed(2)), nivel: 'aviso' })

  // 3. Cosecha.
  const umbral = PARAMS.umbral_cosecha * capacidad_kg
  if (biomasa_kg >= umbral) {
    const kg = biomasa_kg * PARAMS.fraccion_cosecha
    actions.push({
      codigo: 'COSECHAR',
      titulo: t.harvest(kg.toFixed(1)),
      detalle: t.harvestDet(PARAMS.fraccion_cosecha * 100, 100 - PARAMS.fraccion_cosecha * 100),
      nivel: 'ok',
    })
  } else {
    const serie = project(biomasa_kg, capacidad_kg, c, 365, alpha)
    const dia = serie.findIndex((b) => b >= umbral)
    actions.push(
      dia > 0
        ? { codigo: 'ESPERAR', titulo: dia < 14 ? t.waitDays(dia) : t.waitWeeks(Math.round(dia / 7)), detalle: t.waitDet(umbral.toFixed(1)), nivel: 'ok' }
        : { codigo: 'SIN_CRECIMIENTO', titulo: t.noGrowth, detalle: t.noGrowthDet, nivel: 'alerta' },
    )
  }

  if (!actions.some((a) => a.nivel !== 'ok')) {
    const ok = recs.find((r) => r.codigo === 'OK')
    if (ok) actions.unshift({ codigo: 'OK', titulo: recMsg(ok), detalle: '', nivel: 'ok' })
  }
  return actions
}
