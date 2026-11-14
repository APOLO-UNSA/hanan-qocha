// Textos de la interfaz en español e inglés. Idioma: ?lang=en|es en la URL, si no el último elegido, si no español.
export type Lang = 'es' | 'en'

function detect(): Lang {
  if (typeof location === 'undefined') return 'es' // fuera del navegador (pruebas)
  const q = new URLSearchParams(location.search).get('lang')
  if (q === 'es' || q === 'en') {
    try { localStorage.setItem('hq-lang', q) } catch { /* sin almacenamiento */ }
    return q
  }
  try {
    const s = localStorage.getItem('hq-lang')
    if (s === 'es' || s === 'en') return s
  } catch { /* sin almacenamiento */ }
  return 'es'
}

export const LANG: Lang = detect()

/** URL de la página actual en el otro idioma. */
export function langUrl(l: Lang): string {
  const u = new URL(location.href)
  u.searchParams.set('lang', l)
  return u.toString()
}

const es = {
  dataSource: 'Fuente de datos',
  data: 'datos',
  seeDemo: 'ver demo',
  exitDemo: 'salir de la demo',
  demoBanner: 'Datos de demostración: cochas, lecturas y fotos ficticias.',
  demoChip: 'Datos de demostración',
  offline: 'Sin conexión · mostrando los últimos datos guardados',
  loading: 'Cargando datos…',

  // mapa
  mapKicker: 'Salinas y Aguada Blanca · Arequipa',
  candidates: 'Cochas candidatas',
  mapIntro: 'Bofedales de Salinas y Aguada Blanca, coloreados según el Índice de Aptitud Cushuro (IAC).',
  noSites: 'Aún no hay cochas en sites.json.',
  satellite: 'Satélite',
  relief: 'Relieve',

  // estados
  apta: 'Apta',
  condicional: 'Condicional',
  noApta: 'No apta',
  aptaMsg: 'Buena cocha para sembrar o manejar',
  condicionalMsg: 'Mejorar: sombra, profundidad o flujo de agua',
  noAptaMsg: 'Buscar otra cocha',

  // ficha
  notFound: (id: string) => `No se encontró la cocha <b>${id}</b>. <a href="#/">Volver al mapa</a>`,
  backToMap: '← Mapa',
  pondKicker: 'Cocha candidata',
  optimal: 'óptimo',
  tolerable: 'tolerable',
  outOfRange: 'fuera de rango',
  suitability: 'aptitud',
  masl: 'm s.n.m.',
  route: 'Ruta de cultivo',
  stageSown: 'Sembrada',
  stageSownSub: 'registro',
  stageGrowing: 'Creciendo',
  stageGrowingSub: 'sensor + curva + cámara',
  stageReady: 'Lista para cosechar',
  stageReadySub: (keep: number) => `cosechar, dejar el ${keep} %`,
  stageFitSub: 'satélite + sensor',
  idxSatellite: 'Satélite',
  idxInSitu: 'In situ',
  idxVision: 'Visión',
  twin: 'Gemelo de la cocha',
  lastReading: 'Qocha Ñawi · última lectura',
  live: 'en vivo',
  liveTitle: (s: number) => `Se actualiza cada ${s} s`,
  vision: 'Visión artificial',
  coloniesMarked: 'colonias marcadas',
  noPhotos: 'Sin fotos analizadas todavía.',
  photoAlt: 'Colonias de cushuro marcadas',
  photoMissing: 'Foto no disponible',
  coverage: 'Cobertura',
  curve: 'Curva de biomasa',
  curveSub: 'proyectada vs. real',
  whatIf: '¿Qué pasa si…?',
  sTemp: 'Temperatura del agua',
  sUv: 'Índice UV',
  sTds: 'Sólidos disueltos (TDS)',
  sDepth: 'Profundidad',
  resetSliders: 'Volver a la lectura real',
  action: 'Acción recomendada',
  assumptions: (o: { tLo: number; tHi: number; uvLo: number; uvHi: number; tds: number; dLo: number; dHi: number; r: number; k: string }) =>
    `Supuestos del modelo: óptimos T ${o.tLo}–${o.tHi} °C, UV ${o.uvLo}–${o.uvHi}, TDS ≤ ${o.tds} ppm,
     profundidad ${o.dLo}–${o.dHi} m; r<sub>max</sub> = ${o.r}/día; capacidad estimada ${o.k} kg. Se ajustan con datos de campo.`,

  // sensor
  noSensor: 'Sin lecturas del sensor todavía.',
  waterTemp: 'T° agua',
  secondsAgo: 'hace segundos',
  minAgo: (m: number) => `hace ${m} min`,
  stale: 'sin datos recientes',
  history: (h: number, n: number) => `Últimas ${h} h · ${n} lecturas`,

  // gráfico
  harvestPoint: 'punto de cosecha',
  today: 'hoy',
  dayUnit: 'd',
  legendScenario: 'Escenario (sliders)',
  legendBase: 'Proyección con la lectura real',
  legendReal: 'Medido por la cámara',
  legendFit: 'Ajuste recalibrado',
  calibNone: 'El modelo se recalibra cuando la cámara tenga al menos 2 fotos.',
  calibDone: (n: number, a: string, r: string, e0: string, e1: string, pct: number) =>
    pct < 5
      ? `<b>Modelo verificado con ${n} fotos:</b> ya coincidía con lo medido (error medio ${e1} kg), tasa ×${a}.`
      : `<b>Modelo recalibrado con ${n} fotos:</b> tasa ×${a} (r<sub>max</sub> efectivo ${r}/día). Error medio ${e0} → ${e1} kg (${pct} % menos).`,

  // acciones del modelo
  renewWater: 'Renovar agua',
  renewWaterDet: (tds: number) => `TDS de ${tds} ppm: buscar flujo de agua limpia.`,
  shade: 'Aumentar sombra',
  shadeDet: 'Temperatura o radiación UV por encima del óptimo.',
  depth: 'Subir el nivel del agua',
  depthDet: (m: string) => `Profundidad de ${m} m: la cocha puede secarse.`,
  harvest: (kg: string) => `Cosechar ${kg} kg`,
  harvestDet: (take: number, keep: number) => `Cosechar el ${take} % y dejar el ${keep} % para que se regenere.`,
  waitDays: (n: number) => `Esperar ${n} ${n === 1 ? 'día' : 'días'}`,
  waitWeeks: (n: number) => `Esperar ${n} semanas`,
  waitDet: (kg: string) => `Se proyecta llegar a ${kg} kg (punto de cosecha).`,
  noGrowth: 'Sin crecimiento proyectado',
  noGrowthDet: 'Con estas condiciones no se llega al punto de cosecha en un año.',
}

type Dict = typeof es

const en: Dict = {
  dataSource: 'Data source',
  data: 'data',
  seeDemo: 'see demo',
  exitDemo: 'exit demo',
  demoBanner: 'Demo data: fictitious ponds, readings and photos.',
  demoChip: 'Demo data',
  offline: 'Offline · showing last saved data',
  loading: 'Loading data…',

  mapKicker: 'Salinas y Aguada Blanca · Arequipa',
  candidates: 'Candidate ponds',
  mapIntro: 'Wetlands of Salinas y Aguada Blanca, colored by the Cushuro Suitability Index (CSI).',
  noSites: 'No ponds in sites.json yet.',
  satellite: 'Satellite',
  relief: 'Terrain',

  apta: 'Suitable',
  condicional: 'Conditional',
  noApta: 'Unsuitable',
  aptaMsg: 'Good pond to seed or manage',
  condicionalMsg: 'Improve: shade, depth or water flow',
  noAptaMsg: 'Look for another pond',

  notFound: (id) => `Pond <b>${id}</b> not found. <a href="#/">Back to map</a>`,
  backToMap: '← Map',
  pondKicker: 'Candidate pond',
  optimal: 'optimal',
  tolerable: 'tolerable',
  outOfRange: 'out of range',
  suitability: 'suitability',
  masl: 'm a.s.l.',
  route: 'Growing path',
  stageSown: 'Seeded',
  stageSownSub: 'registration',
  stageGrowing: 'Growing',
  stageGrowingSub: 'sensor + curve + camera',
  stageReady: 'Ready to harvest',
  stageReadySub: (keep) => `harvest, leave ${keep} %`,
  stageFitSub: 'satellite + sensor',
  idxSatellite: 'Satellite',
  idxInSitu: 'In situ',
  idxVision: 'Vision',
  twin: 'Pond digital twin',
  lastReading: 'Qocha Ñawi · latest reading',
  live: 'live',
  liveTitle: (s) => `Updates every ${s} s`,
  vision: 'Computer vision',
  coloniesMarked: 'colonies marked',
  noPhotos: 'No analyzed photos yet.',
  photoAlt: 'Marked cushuro colonies',
  photoMissing: 'Photo not available',
  coverage: 'Coverage',
  curve: 'Biomass curve',
  curveSub: 'projected vs. measured',
  whatIf: 'What if…?',
  sTemp: 'Water temperature',
  sUv: 'UV index',
  sTds: 'Dissolved solids (TDS)',
  sDepth: 'Depth',
  resetSliders: 'Back to real reading',
  action: 'Recommended action',
  assumptions: (o) =>
    `Model assumptions: optimal T ${o.tLo}–${o.tHi} °C, UV ${o.uvLo}–${o.uvHi}, TDS ≤ ${o.tds} ppm,
     depth ${o.dLo}–${o.dHi} m; r<sub>max</sub> = ${o.r}/day; estimated capacity ${o.k} kg. Tuned with field data.`,

  noSensor: 'No sensor readings yet.',
  waterTemp: 'Water T°',
  secondsAgo: 'seconds ago',
  minAgo: (m) => `${m} min ago`,
  stale: 'no recent data',
  history: (h, n) => `Last ${h} h · ${n} readings`,

  harvestPoint: 'harvest point',
  today: 'today',
  dayUnit: 'd',
  legendScenario: 'Scenario (sliders)',
  legendBase: 'Projection from real reading',
  legendReal: 'Measured by camera',
  legendFit: 'Recalibrated fit',
  calibNone: 'The model is recalibrated once the camera has at least 2 photos.',
  calibDone: (n, a, r, e0, e1, pct) =>
    pct < 5
      ? `<b>Model verified with ${n} photos:</b> it already matched the measurements (mean error ${e1} kg), rate ×${a}.`
      : `<b>Model recalibrated with ${n} photos:</b> rate ×${a} (effective r<sub>max</sub> ${r}/day). Mean error ${e0} → ${e1} kg (${pct} % lower).`,

  renewWater: 'Renew water',
  renewWaterDet: (tds) => `TDS of ${tds} ppm: look for clean water inflow.`,
  shade: 'Add shade',
  shadeDet: 'Temperature or UV radiation above optimum.',
  depth: 'Raise the water level',
  depthDet: (m) => `Depth of ${m} m: the pond may dry out.`,
  harvest: (kg) => `Harvest ${kg} kg`,
  harvestDet: (take, keep) => `Harvest ${take} % and leave ${keep} % so it regrows.`,
  waitDays: (n) => `Wait ${n} ${n === 1 ? 'day' : 'days'}`,
  waitWeeks: (n) => `Wait ${n} weeks`,
  waitDet: (kg) => `Projected to reach ${kg} kg (harvest point).`,
  noGrowth: 'No projected growth',
  noGrowthDet: 'Under these conditions the harvest point is not reached within a year.',
}

export const t: Dict = LANG === 'en' ? en : es

/** Nombre corto del índice: IAC en español, CSI en inglés. */
export const IAC = LANG === 'en' ? 'CSI' : 'IAC'

/** Mensaje de recommendations.json en el idioma activo. */
export const recMsg = (r: { mensaje_es: string; mensaje_en: string }) => (LANG === 'en' ? r.mensaje_en : r.mensaje_es)
