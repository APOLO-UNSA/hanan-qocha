// Pantalla 2 (ruta de cultivo) y Pantalla 3 (gemelo de la cocha).
import type { Dataset, SensorReading } from '../data'
import { visionSeries } from '../data'
import {
  cochaState,
  conditionsFrom,
  ESTADO_INFO,
  factors,
  PARAMS,
  project,
  RANGES,
  recommend,
  type Conditions,
} from '../model'
import { esc, fmtTime, pct } from '../ui'

const ETAPAS = [
  { t: 'Apta', s: 'satélite' },
  { t: 'Sembrada', s: 'registro' },
  { t: 'Creciendo', s: 'sensor + curva + cámara' },
  { t: 'Lista para cosechar', s: `cosechar, dejar el ${100 - PARAMS.fraccion_cosecha * 100} %` },
]

const SLIDERS: { key: keyof Conditions; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: 'temp_agua_c', label: 'Temperatura del agua', unit: '°C', min: 0, max: 30, step: 0.5 },
  { key: 'uv_index', label: 'Índice UV', unit: '', min: 0, max: 18, step: 0.5 },
  { key: 'tds_ppm', label: 'Sólidos disueltos (TDS)', unit: 'ppm', min: 0, max: 400, step: 5 },
  { key: 'profundidad_m', label: 'Profundidad', unit: 'm', min: 0, max: 2, step: 0.05 },
]

const HORIZON_DAYS = 90
const DAY = 864e5

/** Función que la vista devuelve para refrescarse con datos nuevos sin perder el estado de los sliders. */
export type Refresh = (d: Dataset) => void

export function renderCocha(root: HTMLElement, d: Dataset, id: string, live = false): Refresh | undefined {
  const site = d.sites.find((s) => s.cocha_id === id)
  if (!site) {
    root.innerHTML = `<section class="page"><p>No se encontró la cocha <b>${esc(id)}</b>. <a href="#/">Volver al mapa</a></p></section>`
    return
  }
  let st = cochaState(d, site)
  let vis = visionSeries(d, id)
  let base = conditionsFrom(st.sensor)
  const cond: Conditions = { ...base }
  let touched = false // el productor movió algún slider
  const lastVis = vis.at(-1)

  root.innerHTML = `
    <section class="page">
      <a class="back" href="#/">← Mapa</a>
      <header class="cocha-head">
        <div>
          <h2>${esc(site.nombre)}</h2>
          <p class="muted">${esc(site.cocha_id)} · ${site.altitud_m} m s.n.m. · ${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}</p>
        </div>
        <div id="iac-badge" class="iac-badge"></div>
      </header>
      <p id="estado-msg" class="estado-msg"></p>

      <h3>Ruta de cultivo</h3>
      <ol id="ruta" class="ruta"></ol>

      <div id="indices" class="indices"></div>

      <h3>Gemelo de la cocha</h3>
      <div class="twin-grid">
        <div class="card">
          <h4>Qocha Ñawi · última lectura ${live ? '<span class="live" title="Se actualiza cada 10 s">en vivo</span>' : ''}</h4>
          <div id="sensor"></div>
        </div>
        <div class="card">
          <h4>Visión artificial</h4>
          ${
            lastVis
              ? `<figure class="foto">
                  <img src="${esc(photoUrl(lastVis.foto))}" alt="Colonias de cushuro" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'foto-ph',textContent:'Foto no disponible'}))">
                  <figcaption>Cobertura ${lastVis.cobertura_pct} % · ${lastVis.biomasa_kg} kg</figcaption>
                </figure><p class="muted small">${fmtTime(lastVis.timestamp)}</p>`
              : '<p class="muted">Sin fotos analizadas todavía.</p>'
          }
        </div>
        <div class="card wide">
          <h4>Curva de biomasa <span class="muted small">proyectada vs. real</span></h4>
          <div id="chart"></div>
        </div>
        <div class="card">
          <h4>¿Qué pasa si…?</h4>
          <form id="sliders">
            ${SLIDERS.map(
              (sl) => `
              <label>
                <span>${sl.label}<output id="o-${sl.key}"></output></span>
                <input type="range" name="${sl.key}" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${cond[sl.key]}">
                <i class="fbar"><i id="f-${sl.key}"></i></i>
              </label>`,
            ).join('')}
            <button type="reset" class="btn-sec">Volver a la lectura real</button>
          </form>
        </div>
        <div class="card">
          <h4>Acción recomendada</h4>
          <ul id="actions" class="actions"></ul>
        </div>
      </div>
      <p id="supuestos" class="muted small supuestos"></p>
    </section>`

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const form = $<HTMLFormElement>('#sliders')

  /** Partes que dependen del estado de la cocha (IAC, sensor, ruta). */
  const renderState = (prevSensor?: SensorReading) => {
    const info = ESTADO_INFO[st.estado]
    const badge = $('#iac-badge')
    badge.style.setProperty('--c', info.color)
    badge.innerHTML = `<strong>${pct(st.iac)}</strong><span>IAC · ${info.label}</span>`
    const msg = $('#estado-msg')
    msg.style.borderColor = info.color
    msg.textContent = info.msg
    // La primera etapa muestra la aptitud real según el IAC (Apta / Condicional / No apta).
    $('#ruta').innerHTML = ETAPAS.map((e, i) => {
      const cls = i < st.etapa ? 'done' : i === st.etapa ? 'now' : ''
      if (i > 0) return `<li class="${cls}"><b>${e.t}</b><small>${e.s}</small></li>`
      return `<li class="${cls} aptitud ${st.estado}" style="--c:${info.color}"><b>${info.label}</b><small>IAC ${pct(st.iac)} · satélite + sensor</small></li>`
    }).join('')
    $('#indices').innerHTML = `
      <div><span>Satélite</span><b>${pct(site.indice_satelital)}</b><small>×0,4</small></div>
      <div><span>In situ</span><b>${pct(st.indice_in_situ)}</b><small>×0,4</small></div>
      <div><span>Visión</span><b>${pct(st.indice_vision)}</b><small>×0,2</small></div>`
    $('#sensor').innerHTML = sensorHtml(st.sensor, prevSensor)
    $('#supuestos').innerHTML = `
      Supuestos del modelo: óptimos T ${RANGES.temp_agua_c.optLo}–${RANGES.temp_agua_c.optHi} °C,
      UV ${RANGES.uv_index.optLo}–${RANGES.uv_index.optHi}, TDS ≤ ${RANGES.tds_ppm.optHi} ppm,
      profundidad ${RANGES.profundidad_m.optLo}–${RANGES.profundidad_m.optHi} m; r<sub>max</sub> = ${PARAMS.r_max}/día;
      capacidad estimada ${st.capacidad_kg.toFixed(1)} kg. Se ajustan con datos de campo.`
  }

  /** Partes que dependen de los sliders (curva y acciones). */
  const renderScenario = () => {
    const f = factors(cond)
    for (const sl of SLIDERS) {
      $(`#o-${sl.key}`).textContent = `${cond[sl.key]} ${sl.unit}`
      const bar = $(`#f-${sl.key}`)
      bar.style.width = `${f[sl.key] * 100}%`
      bar.style.background = f[sl.key] >= 0.7 ? '#2e9d5b' : f[sl.key] >= 0.4 ? '#e0a526' : '#c8473b'
    }
    $('#chart').innerHTML = chartSvg(vis, st.biomasa_kg, st.capacidad_kg, base, cond)
    $('#actions').innerHTML = recommend(cond, st.biomasa_kg, st.capacidad_kg, d.recommendations)
      .map((a) => `<li class="${a.nivel}"><b>${esc(a.titulo)}</b>${a.detalle ? `<small>${esc(a.detalle)}</small>` : ''}</li>`)
      .join('')
  }

  const syncSliders = () => {
    for (const sl of SLIDERS) form.querySelector<HTMLInputElement>(`[name="${sl.key}"]`)!.value = String(cond[sl.key])
  }

  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement
    cond[el.name as keyof Conditions] = parseFloat(el.value)
    touched = true
    renderScenario()
  })
  form.addEventListener('reset', (e) => {
    e.preventDefault()
    Object.assign(cond, base)
    touched = false
    syncSliders()
    renderScenario()
  })

  renderState()
  renderScenario()

  return (nd: Dataset) => {
    const ns = nd.sites.find((s) => s.cocha_id === id)
    if (!ns) return
    const prev = st.sensor
    d = nd
    st = cochaState(nd, ns)
    vis = visionSeries(nd, id)
    base = conditionsFrom(st.sensor)
    // Si el productor no tocó los sliders, siguen a la lectura en vivo.
    if (!touched) {
      Object.assign(cond, base)
      syncSliders()
    }
    renderState(prev)
    renderScenario()
  }
}

function sensorHtml(s?: SensorReading, prev?: SensorReading): string {
  if (!s) return '<p class="muted">Sin lecturas del sensor todavía.</p>'
  const isNew = prev != null && prev.timestamp !== s.timestamp
  const row = (label: string, v: number | undefined, unit: string, pv: number | undefined) => {
    const delta = isNew && v != null && pv != null && v !== pv ? (v > pv ? ' <i class="up">▲</i>' : ' <i class="down">▼</i>') : ''
    return `<dt>${label}</dt><dd${isNew ? ' class="flash"' : ''}>${v ?? '—'}${v != null && unit ? ` ${unit}` : ''}${delta}</dd>`
  }
  const ageMin = (Date.now() - Date.parse(s.timestamp)) / 60000
  const age = ageMin < 1 ? 'hace segundos' : ageMin < 60 ? `hace ${Math.round(ageMin)} min` : fmtTime(s.timestamp)
  return `<dl class="readings">
      ${row('TDS', s.tds_ppm, 'ppm', prev?.tds_ppm)}
      ${row('T° agua', s.temp_agua_c, '°C', prev?.temp_agua_c)}
      ${row('pH', s.ph, '', prev?.ph)}
      ${row('UV', s.uv_index, '', prev?.uv_index)}
    </dl><p class="muted small" title="${esc(s.timestamp)}">${age}${ageMin > 30 && ageMin < 60 * 24 * 365 ? ' · <span class="stale">sin datos recientes</span>' : ''}</p>`
}

function photoUrl(foto: string) {
  return /^(https?:|data:|\/)/.test(foto) ? foto : `${import.meta.env.BASE_URL}${foto}`
}

/** Gráfico SVG: curva con las condiciones reales (punteada), escenario de los sliders y puntos de la cámara. */
function chartSvg(
  vis: { timestamp: string; biomasa_kg: number }[],
  b0: number,
  K: number,
  base: Conditions,
  cond: Conditions,
): string {
  const W = 640, H = 260, L = 44, R = 12, T = 12, B = 30
  const t0 = vis.length ? Date.parse(vis[0].timestamp) : Date.now()
  const startDay = vis.length ? Math.round((Date.parse(vis.at(-1)!.timestamp) - t0) / DAY) : 0
  const maxDay = startDay + HORIZON_DAYS
  const yMax = Math.max(K, ...vis.map((v) => v.biomasa_kg)) * 1.1

  const x = (day: number) => L + (day / maxDay) * (W - L - R)
  const y = (kg: number) => T + (1 - kg / yMax) * (H - T - B)
  const path = (serie: number[]) => serie.map((b, i) => `${i ? 'L' : 'M'}${x(startDay + i).toFixed(1)},${y(b).toFixed(1)}`).join('')

  const pBase = project(b0, K, base, HORIZON_DAYS)
  const pScen = project(b0, K, cond, HORIZON_DAYS)
  const umbral = PARAMS.umbral_cosecha * K

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const xTicks = Array.from({ length: 7 }, (_, i) => Math.round((i * maxDay) / 6))

  return `
  <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Curva de biomasa">
    ${yTicks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v.toFixed(0)}</text>`).join('')}
    ${xTicks.map((d) => `<text x="${x(d)}" y="${H - 10}" class="axis" text-anchor="middle">${d} d</text>`).join('')}
    <text x="${L}" y="${T - 2}" class="axis">kg</text>
    <line x1="${L}" x2="${W - R}" y1="${y(umbral)}" y2="${y(umbral)}" class="umbral"/>
    <text x="${W - R}" y="${y(umbral) - 4}" class="axis" text-anchor="end">punto de cosecha</text>
    <line x1="${L}" x2="${W - R}" y1="${y(K)}" y2="${y(K)}" class="cap"/>
    <path d="${path(pBase)}" class="base"/>
    <path d="${path(pScen)}" class="scen"/>
    ${vis.map((v) => `<circle cx="${x((Date.parse(v.timestamp) - t0) / DAY)}" cy="${y(v.biomasa_kg)}" r="5" class="real"><title>${v.biomasa_kg} kg</title></circle>`).join('')}
  </svg>
  <div class="chart-legend">
    <span><i class="l-scen"></i>Escenario (sliders)</span>
    <span><i class="l-base"></i>Proyección con la lectura real</span>
    <span><i class="l-real"></i>Medido por la cámara</span>
  </div>`
}
