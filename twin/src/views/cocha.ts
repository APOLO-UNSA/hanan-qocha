// Pantalla 2 (ruta de cultivo) y Pantalla 3 (gemelo de la cocha).
import type { Dataset } from '../data'
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

export function renderCocha(root: HTMLElement, d: Dataset, id: string) {
  const site = d.sites.find((s) => s.cocha_id === id)
  if (!site) {
    root.innerHTML = `<section class="page"><p>No se encontró la cocha <b>${esc(id)}</b>. <a href="#/">Volver al mapa</a></p></section>`
    return
  }
  const st = cochaState(d, site)
  const vis = visionSeries(d, id)
  const base = conditionsFrom(st.sensor)
  const cond: Conditions = { ...base }
  const info = ESTADO_INFO[st.estado]
  const s = st.sensor
  const lastVis = vis.at(-1)

  root.innerHTML = `
    <section class="page">
      <a class="back" href="#/">← Mapa</a>
      <header class="cocha-head">
        <div>
          <h2>${esc(site.nombre)}</h2>
          <p class="muted">${esc(site.cocha_id)} · ${site.altitud_m} m s.n.m. · ${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}</p>
        </div>
        <div class="iac-badge" style="--c:${info.color}">
          <strong>${pct(st.iac)}</strong><span>IAC · ${info.label}</span>
        </div>
      </header>
      <p class="estado-msg" style="border-color:${info.color}">${info.msg}</p>

      <h3>Ruta de cultivo</h3>
      <ol class="ruta">
        ${ETAPAS.map((e, i) => `<li class="${i < st.etapa ? 'done' : i === st.etapa ? 'now' : ''}"><b>${e.t}</b><small>${e.s}</small></li>`).join('')}
      </ol>

      <div class="indices">
        <div><span>Satélite</span><b>${pct(site.indice_satelital)}</b><small>×0,4</small></div>
        <div><span>In situ</span><b>${pct(st.indice_in_situ)}</b><small>×0,4</small></div>
        <div><span>Visión</span><b>${pct(st.indice_vision)}</b><small>×0,2</small></div>
      </div>

      <h3>Gemelo de la cocha</h3>
      <div class="twin-grid">
        <div class="card">
          <h4>Qocha Ñawi · última lectura</h4>
          ${
            s
              ? `<dl class="readings">
                  <dt>TDS</dt><dd>${s.tds_ppm} ppm</dd>
                  <dt>T° agua</dt><dd>${s.temp_agua_c} °C</dd>
                  <dt>pH</dt><dd>${s.ph ?? '—'}</dd>
                  <dt>UV</dt><dd>${s.uv_index ?? '—'}</dd>
                </dl><p class="muted small">${fmtTime(s.timestamp)}</p>`
              : '<p class="muted">Sin lecturas del sensor todavía.</p>'
          }
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
      <p class="muted small supuestos">
        Supuestos del modelo: óptimos T ${RANGES.temp_agua_c.optLo}–${RANGES.temp_agua_c.optHi} °C,
        UV ${RANGES.uv_index.optLo}–${RANGES.uv_index.optHi}, TDS ≤ ${RANGES.tds_ppm.optHi} ppm,
        profundidad ${RANGES.profundidad_m.optLo}–${RANGES.profundidad_m.optHi} m; r<sub>max</sub> = ${PARAMS.r_max}/día;
        capacidad estimada ${st.capacidad_kg.toFixed(1)} kg. Se ajustan con datos de campo.
      </p>
    </section>`

  const form = root.querySelector<HTMLFormElement>('#sliders')!
  const chart = root.querySelector<HTMLElement>('#chart')!
  const actionsEl = root.querySelector<HTMLElement>('#actions')!

  const update = () => {
    const f = factors(cond)
    for (const sl of SLIDERS) {
      root.querySelector(`#o-${sl.key}`)!.textContent = `${cond[sl.key]} ${sl.unit}`
      const bar = root.querySelector<HTMLElement>(`#f-${sl.key}`)!
      bar.style.width = `${f[sl.key] * 100}%`
      bar.style.background = f[sl.key] >= 0.7 ? '#2e9d5b' : f[sl.key] >= 0.4 ? '#e0a526' : '#c8473b'
    }
    chart.innerHTML = chartSvg(vis, st.biomasa_kg, st.capacidad_kg, base, cond)
    actionsEl.innerHTML = recommend(cond, st.biomasa_kg, st.capacidad_kg, d.recommendations)
      .map((a) => `<li class="${a.nivel}"><b>${esc(a.titulo)}</b>${a.detalle ? `<small>${esc(a.detalle)}</small>` : ''}</li>`)
      .join('')
  }

  form.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement
    cond[el.name as keyof Conditions] = parseFloat(el.value)
    update()
  })
  form.addEventListener('reset', () => {
    Object.assign(cond, base)
    setTimeout(update)
  })
  update()
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
