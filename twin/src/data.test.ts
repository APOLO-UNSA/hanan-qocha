import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDataset, sensorHistory } from './data'

/** Simula el servidor: cada archivo devuelve un texto o un código de error. */
function serve(files: Record<string, string | number>) {
  vi.stubGlobal('fetch', async (url: string) => {
    const name = url.split('/').pop()!.replace('.json', '')
    const f = files[name]
    if (f === undefined) return new Response('', { status: 404 })
    if (typeof f === 'number') return new Response('', { status: f })
    return new Response(f, { status: 200 })
  })
}
afterEach(() => vi.unstubAllGlobals())

const SITE = { cocha_id: 'A', nombre: 'A', lat: -16, lon: -71, altitud_m: 4300, indice_satelital: 0.5 }
const READ = { cocha_id: 'A', timestamp: '2026-11-14T10:00:00-05:00', tds_ppm: 40, temp_agua_c: 10 }

describe('loadDataset', () => {
  it('un archivo que falta queda vacío', async () => {
    serve({ sites: JSON.stringify([SITE]) })
    const d = await loadDataset()
    expect(d.sites).toHaveLength(1)
    expect(d.sensor).toEqual([])
  })

  it('descarta registros inválidos y cocha_id duplicados', async () => {
    serve({
      sites: JSON.stringify([SITE, { ...SITE, nombre: 'dup' }, { ...SITE, cocha_id: 'B', lat: 'abc' }]),
      sensor: JSON.stringify([READ, { ...READ, tds_ppm: 'alto' }, { ...READ, timestamp: 'ayer' }, null, 3]),
    })
    const d = await loadDataset()
    expect(d.sites.map((s) => s.nombre)).toEqual(['A'])
    expect(d.sensor).toHaveLength(1)
  })

  it('un JSON roto o un error conserva los datos anteriores (modo en vivo)', async () => {
    serve({ sites: JSON.stringify([SITE]), sensor: JSON.stringify([READ]) })
    const prev = await loadDataset()
    serve({ sites: 500, sensor: '[{ "cocha_id": "A", "timest' })
    const d = await loadDataset(prev)
    expect(d.sites).toEqual(prev.sites)
    expect(d.sensor).toEqual(prev.sensor)
  })

  it('un JSON que no es lista se ignora', async () => {
    serve({ sites: '{"cocha_id":"A"}' })
    expect((await loadDataset()).sites).toEqual([])
  })
})

describe('sensorHistory', () => {
  it('devuelve solo las últimas horas de esa cocha, ordenadas', () => {
    const t = (h: number) => new Date(Date.UTC(2026, 10, 14, 12) - h * 3600e3).toISOString()
    const sensor = [
      { ...READ, timestamp: t(0) },
      { ...READ, timestamp: t(72) },
      { ...READ, timestamp: t(24) },
      { ...READ, cocha_id: 'B', timestamp: t(1) },
    ]
    const h = sensorHistory({ sites: [], sensor, vision: [], recommendations: [] }, 'A', 48)
    expect(h.map((r) => r.timestamp)).toEqual([t(24), t(0)])
  })
})
