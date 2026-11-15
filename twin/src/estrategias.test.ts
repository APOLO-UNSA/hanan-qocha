import { describe, expect, it } from 'vitest'
import type { Dataset } from './data'
import { datosFinca, evaluar } from './estrategias'

const ahora = '2026-11-14T10:00:00-05:00'
const sitio = (id: string, sat: number) => ({ cocha_id: id, nombre: id, lat: -16, lon: -71, altitud_m: 4300, indice_satelital: sat })
const d: Dataset = {
  sites: [sitio('BUENA', 0.85), sitio('MALA', 0.1)],
  sensor: [
    { cocha_id: 'BUENA', timestamp: ahora, tds_ppm: 40, temp_agua_c: 10, ph: 7, uv_index: 9 },
    { cocha_id: 'MALA', timestamp: ahora, tds_ppm: 290, temp_agua_c: 24, ph: 8.8, uv_index: 15 },
  ],
  vision: [
    { cocha_id: 'BUENA', timestamp: '2026-11-07T10:00:00-05:00', foto: '', cobertura_pct: 20, biomasa_kg: 8 },
    { cocha_id: 'BUENA', timestamp: ahora, foto: '', cobertura_pct: 30, biomasa_kg: 12 },
  ],
  recommendations: [],
}
const normal = { lluvia: 0, temp: 0 }
const medio = { agua: 1, ingreso: 1, suelo: 1 }

describe('comparador de estrategias', () => {
  it('las prioridades reordenan: si importa el suelo, primero la leguminosa', () => {
    const { evals } = evaluar(d, d.sites[0], normal, { agua: 0, ingreso: 0, suelo: 2 })
    expect(evals[0].id).toBe('leguminosa')
  })
  it('si importa el ingreso y la cocha es buena, primero el cushuro', () => {
    const { evals } = evaluar(d, d.sites[0], normal, { agua: 0, ingreso: 2, suelo: 0 })
    expect(evals[0].id).toBe('cushuro')
    expect(evals[0].cosechaKg).toBeGreaterThan(0)
  })
  it('con una cocha no apta, el cushuro no se recomienda y va al final', () => {
    const { evals } = evaluar(d, d.sites[1], normal, { agua: 0, ingreso: 2, suelo: 0 })
    const c = evals.find((e) => e.id === 'cushuro')!
    expect(c.recomendada).toBe(false)
    expect(evals.at(-1)!.id).toBe('cushuro')
  })
  it('la sequía baja el agua de todas y agranda la incertidumbre', () => {
    const a = evaluar(d, d.sites[0], normal, medio).evals.find((e) => e.id === 'actual')!
    const b = evaluar(d, d.sites[0], { lluvia: -0.4, temp: 0 }, medio).evals.find((e) => e.id === 'actual')!
    expect(b.agua.valor).toBeLessThan(a.agua.valor)
    expect(b.agua.hi - b.agua.lo).toBeGreaterThan(a.agua.hi - a.agua.lo)
  })
  it('el aporte del cushuro al suelo es hipótesis y no suma', () => {
    const c = evaluar(d, d.sites[0], normal, medio).evals.find((e) => e.id === 'cushuro')!
    expect(c.suelo.hipotesis).toBeGreaterThan(0)
    expect(c.suelo.valor).toBeLessThan(60)
  })
  it('los datos NASA responden al escenario', () => {
    expect(datosFinca(d.sites[0], { lluvia: 0.4, temp: 0 }).gpm).toBeGreaterThan(datosFinca(d.sites[0], normal).gpm)
    expect(datosFinca(d.sites[0], { lluvia: 0, temp: 2 }).heladas).toBeLessThan(datosFinca(d.sites[0], normal).heladas)
  })
})
