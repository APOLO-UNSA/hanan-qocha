import { describe, expect, it } from 'vitest'
import type { Dataset, Recommendation } from './data'
import {
  calibrate,
  cochaState,
  dailyRate,
  evalCondition,
  PARAMS,
  project,
  RANGES,
  recommend,
  suitability,
  type Conditions,
} from './model'

const OPT: Conditions = { temp_agua_c: 10, uv_index: 8, tds_ppm: 50, profundidad_m: 0.4 }
const day = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 864e5).toISOString()

describe('suitability (curva trapezoidal)', () => {
  const r = { min: 0, optLo: 10, optHi: 20, max: 30 }
  it('vale 1 en el óptimo y 0 fuera del rango', () => {
    expect(suitability(15, r)).toBe(1)
    expect(suitability(-1, r)).toBe(0)
    expect(suitability(31, r)).toBe(0)
  })
  it('es lineal en las rampas', () => {
    expect(suitability(5, r)).toBeCloseTo(0.5)
    expect(suitability(25, r)).toBeCloseTo(0.5)
  })
  it('TDS 0 es óptimo (rampa de subida vacía)', () => {
    expect(suitability(0, RANGES.tds_ppm)).toBe(1)
  })
})

describe('project (logística)', () => {
  it('crece, nunca supera la capacidad y empieza en b0', () => {
    const s = project(2, 40, OPT, 365)
    expect(s[0]).toBe(2)
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThanOrEqual(s[i - 1])
    expect(Math.max(...s)).toBeLessThanOrEqual(40)
    expect(s.at(-1)).toBeGreaterThan(39)
  })
  it('con condiciones fuera de rango no crece', () => {
    const s = project(5, 40, { ...OPT, tds_ppm: 999 }, 30)
    expect(s.at(-1)).toBe(5)
  })
  it('alpha escala la tasa', () => {
    expect(project(2, 40, OPT, 20, 2).at(-1)!).toBeGreaterThan(project(2, 40, OPT, 20, 1).at(-1)!)
    expect(project(2, 40, OPT, 20, 0).at(-1)).toBe(2)
  })
  it('la tasa máxima en el óptimo es r_max', () => {
    expect(dailyRate(OPT)).toBeCloseTo(PARAMS.r_max)
  })
})

describe('calibrate (cierre del ciclo con la visión)', () => {
  it('recupera el factor con que se generó la serie', () => {
    const K = 40
    const serie = project(2, K, OPT, 42, 1.5)
    const vis = [0, 7, 14, 21, 28, 35, 42].map((d) => ({ timestamp: day(d), biomasa_kg: serie[d] }))
    const c = calibrate(vis, K, OPT)!
    expect(c.alpha).toBeCloseTo(1.5, 1)
    expect(c.errDespues).toBeLessThan(c.errAntes)
    expect(c.n).toBe(7)
  })
  it('con menos de 2 fotos no calibra', () => {
    expect(calibrate([{ timestamp: day(0), biomasa_kg: 3 }], 40, OPT)).toBeNull()
  })
})

describe('evalCondition (recommendations.json)', () => {
  const v = { tds_ppm: 180, temp_agua_c: 12, ph: 8.7 }
  it('comparaciones simples', () => {
    expect(evalCondition('tds_ppm > 150', v)).toBe(true)
    expect(evalCondition('tds_ppm <= 150', v)).toBe(false)
    expect(evalCondition('temp_agua_c == 12', v)).toBe(true)
  })
  it('varias cláusulas con && o "y", decimales con coma', () => {
    expect(evalCondition('tds_ppm > 150 && ph > 8,5', v)).toBe(true)
    expect(evalCondition('tds_ppm > 150 y temp_agua_c > 20', v)).toBe(false)
  })
  it('variable ausente o texto raro: no se cumple (y nunca se ejecuta código)', () => {
    expect(evalCondition('uv_index > 1', v)).toBe(false)
    expect(evalCondition('tds_ppm > 1; alert(1)', v)).toBe(false)
    expect(evalCondition('', v)).toBe(false)
  })
})

describe('recommend', () => {
  const recs: Recommendation[] = [
    { codigo: 'PH_ALTO', condicion: 'ph > 8.5', mensaje_es: 'pH alto', mensaje_en: 'High pH' },
    { codigo: 'OK', condicion: 'tds_ppm <= 150', mensaje_es: 'Todo bien', mensaje_en: 'All good' },
  ]
  const codes = (a: { codigo: string }[]) => a.map((x) => x.codigo)

  it('cosecha el 70 % cuando pasa el umbral', () => {
    const a = recommend(OPT, 35, 40, recs).find((x) => x.codigo === 'COSECHAR')!
    expect(a.titulo).toContain((35 * PARAMS.fraccion_cosecha).toFixed(1))
  })
  it('si no, dice cuánto esperar', () => {
    expect(codes(recommend(OPT, 5, 40, recs))).toContain('ESPERAR')
  })
  it('TDS alto pide renovar agua y quita el OK', () => {
    const c = codes(recommend({ ...OPT, tds_ppm: 250 }, 5, 40, recs))
    expect(c).toContain('RENOVAR_AGUA')
    expect(c).not.toContain('OK')
  })
  it('usa variables extra como ph', () => {
    expect(codes(recommend(OPT, 5, 40, recs, 1, { ph: 9 }))).toContain('PH_ALTO')
    expect(codes(recommend(OPT, 5, 40, recs, 1, {}))).not.toContain('PH_ALTO')
  })
})

describe('cochaState', () => {
  const site = { cocha_id: 'A', nombre: 'A', lat: -16, lon: -71, altitud_m: 4300, indice_satelital: 0.5 }
  const base: Dataset = { sites: [site], sensor: [], vision: [], recommendations: [] }

  it('sin sensor ni visión, el IAC es solo el satélite', () => {
    const st = cochaState(base, site)
    expect(st.iac).toBeCloseTo(0.5)
    expect(st.indice_in_situ).toBeNull()
    expect(st.etapa).toBe(0)
  })
  it('estados según el IAC', () => {
    expect(cochaState(base, { ...site, indice_satelital: 0.9 }).estado).toBe('apta')
    expect(cochaState(base, { ...site, indice_satelital: 0.5 }).estado).toBe('condicional')
    expect(cochaState(base, { ...site, indice_satelital: 0.1 }).estado).toBe('no-apta')
  })
  it('cobertura mínima no dispara la capacidad', () => {
    const d = { ...base, vision: [{ cocha_id: 'A', timestamp: day(0), foto: '', cobertura_pct: 0.5, biomasa_kg: 12 }] }
    const st = cochaState(d, site)
    expect(st.capacidad_kg).toBeLessThan(100)
    expect(st.capacidad_kg).toBeGreaterThan(12)
  })
  it('biomasa 0 no bloquea el crecimiento', () => {
    const d = { ...base, vision: [{ cocha_id: 'A', timestamp: day(0), foto: '', cobertura_pct: 0, biomasa_kg: 0 }] }
    expect(cochaState(d, site).biomasa_kg).toBeGreaterThan(0)
  })
})
