import { describe, expect, it } from 'vitest'
import type { Dataset } from './data'
import { datosFinca, evaluar } from './estrategias'
import type { Zona } from './zona'

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
    expect(datosFinca(d.sites[0], { lluvia: 0.4, temp: 0 }).gpm.v).toBeGreaterThan(datosFinca(d.sites[0], normal).gpm.v)
    expect(datosFinca(d.sites[0], { lluvia: 0, temp: 2 }).heladas.v).toBeLessThan(datosFinca(d.sites[0], normal).heladas.v)
  })
  it('con datos satelitales reales, parte de lo medido y lo marca como real', () => {
    const zona: Zona = {
      generado: '2026-11-15',
      detectadas: [{ id: 'C-01', lat: -16.001, lon: -71.001, altitud_m: 4300, pendiente_deg: 2, area_ha: 1, ndwi: 0.1, ndvi_anillo: 0.19, indice_prelim: 0.8, fecha: '2026-10-30' }],
      ecostress: { 'C-01': { lst_c: 21.3, fecha: '2026-10-16' } },
      hls: {},
      smap: { humedad: 0.27, fecha: '2026-11-13', media: 0.25, n: 6 },
      clima: [{ id: 'P', lat: -16, lon: -71, hasta: '2026-11-11', lluvia_temporada_mm: 239, temporada: 'dic 2025 – mar 2026', lluvia_30d_mm: 65, heladas_anio: 156, heladas_temporada: 12, t_aire_30d: 9, humedad_suelo_power: 0.4 }],
    }
    const sitio = { ...d.sites[0], lat: -16, lon: -71 }
    const n = datosFinca(sitio, normal, zona)
    expect(n.smap).toMatchObject({ v: 0.27, real: true })
    expect(n.lst).toMatchObject({ v: 21.3, real: true })
    expect(n.ndvi.v).toBe(0.19)
    expect(n.gpm.v).toBe(239)
    expect(datosFinca(sitio, { lluvia: -0.4, temp: 0 }, zona).gpm.v).toBeLessThan(239)
    // Lejos de las cochas detectadas, la vegetación y la temperatura de superficie son estimadas
    expect(datosFinca({ ...sitio, lat: -16.5 }, normal, zona).lst.real).toBe(false)
  })
})
