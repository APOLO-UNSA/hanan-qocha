// Pantalla 2 (ruta de cultivo) y Pantalla 3 (gemelo de la cocha).
import type { Dataset, SensorReading } from '../data'
import { sensorHistory, visionSeries } from '../data'
import {
  cochaState,
  conditionsFrom,
  ESTADO_INFO,
  factors,
  PARAMS,
  project,
  RANGES,
  recommend,
  type Calibration,
  type Conditions,
} from '../model'
import { esc, fmtTime, pct } from '../ui'
import { IAC, t } from '../i18n'
import { gauge, iacRing, ICONS, sliderBand } from '../art'

const ETAPAS = [
  { t: '', s: '' }, // la primera etapa muestra la aptitud real (ver renderState)
  { t: t.stageSown, s: t.stageSownSub },
  { t: t.stageGrowing, s: t.stageGrowingSub },
  { t: t.stageReady, s: t.stageReadySub(100 - PARAMS.fraccion_cosecha * 100) },
]

const SLIDERS: { key: keyof Conditions; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: 'temp_agua_c', label: t.sTemp, unit: '°C', min: 0, max: 30, step: 0.5 },
  { key: 'uv_index', label: t.sUv, unit: '', min: 0, max: 18, step: 0.5 },
  { key: 'tds_ppm', label: t.sTds, unit: 'ppm', min: 0, max: 400, step: 5 },
  { key: 'profundidad_m', label: t.sDepth, unit: 'm', min: 0, max: 2, step: 0.05 },
]

const HORIZON_DAYS = 90
const DAY = 864e5

/** Función que la vista devuelve para refrescarse con datos nuevos sin perder el estado de los sliders. */
export type Refresh = (d: Dataset) => void

export function renderCocha(root: HTMLElement, d: Dataset, id: string, live = false, pollSeconds = 10): Refresh | undefined {
  const site = d.sites.find((s) => s.cocha_id === id)
  if (!site) {
    root.innerHTML = `<section class="page"><p>${t.notFound(esc(id))}</p></section>`
    return
  }
  let st = cochaState(d, site)
  let vis = visionSeries(d, id)
  let base = conditionsFrom(st.sensor)
  const cond: Conditions = { ...base }
  let touched = false // el productor movió algún slider
  let fotoSel = -1 // índice de la foto elegida en la serie (-1 = la última)

  root.innerHTML = `
    <section class="page">
      <a class="back" href="#/">${t.backToMap}</a>
      <header class="hero">
        <div>
          <p class="kicker">${t.pondKicker} · ${esc(site.cocha_id)}</p>
          <h2>${esc(site.nombre)}</h2>
          <p class="meta"><span><b>▲</b> ${site.altitud_m} ${t.masl}</span><span>${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}</span></p>
          <p id="estado-msg" class="estado-pill"></p>
        </div>
        <div class="ring-wrap" id="iac-ring"></div>
      </header>

      <div class="sec"><span class="num">01</span><h3>${t.route}</h3></div>
      <ol id="ruta" class="trail"></ol>

      <div class="sec"><span class="num">02</span><h3>${t.twin}</h3></div>
      <div class="twin-grid">
        <div class="card k-sensor">
          <h4>${t.lastReading} ${live ? `<span class="live" title="${t.liveTitle(pollSeconds)}">${t.live}</span>` : ''}</h4>
          <div id="sensor"></div>
        </div>
        <div class="card k-vision">
          <h4>${t.vision} <span class="tag">${t.coloniesMarked}</span></h4>
          <div id="vision"></div>
        </div>
        <div class="card wide k-curva">
          <h4>${t.curve} <span class="tag">${t.curveSub}</span></h4>
          <div id="chart"></div>
        </div>
        <div class="card k-whatif">
          <h4>${t.whatIf}</h4>
          <form id="sliders">
            ${SLIDERS.map(
              (sl) => `
              <label>
                <span class="s-head"><span>${sl.label}</span><span><output id="o-${sl.key}"></output><span class="apt" id="f-${sl.key}"></span></span></span>
                <input type="range" name="${sl.key}" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${cond[sl.key]}" style="${sliderBand(RANGES[sl.key], sl.min, sl.max)}">
              </label>`,
            ).join('')}
            <p class="band-key"><span><i style="background:var(--bofedal)"></i>${t.optimal}</span><span><i style="background:var(--ichu)"></i>${t.tolerable}</span><span><i style="background:var(--arcilla)"></i>${t.outOfRange}</span></p>
            <button type="reset" class="btn-sec">${t.resetSliders}</button>
          </form>
        </div>
        <div class="card k-accion">
          <h4>${t.action}</h4>
          <ul id="actions" class="actions"></ul>
        </div>
      </div>
      <p id="supuestos" class="supuestos muted"></p>
    </section>`

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const form = $<HTMLFormElement>('#sliders')

  /** Partes que dependen del estado de la cocha (IAC, sensor, ruta). */
  const renderState = (prevSensor?: SensorReading) => {
    const info = ESTADO_INFO[st.estado]
    // Anillo del IAC: cada pilar con su color y su peso.
    const PILARES = [
      { valor: site.indice_satelital, peso: 0.4, color: '#8f9be0', label: t.idxSatellite },
      { valor: st.indice_in_situ, peso: 0.4, color: '#4fc1bf', label: t.idxInSitu },
      { valor: st.indice_vision, peso: 0.2, color: '#c79bd4', label: t.idxVision },
    ]
    $('#iac-ring').innerHTML =
      iacRing(PILARES, st.iac, info.label, info.color, IAC) +
      `<div class="ring-legend">${PILARES.map((p) => `<span><i style="background:${p.color}"></i>${p.label} <b>${pct(p.valor)}</b></span>`).join('')}</div>`
    const msg = $('#estado-msg')
    msg.style.setProperty('--c', info.color)
    msg.innerHTML = `<i>${st.estado === 'apta' ? '✓' : st.estado === 'condicional' ? '!' : '✕'}</i>${esc(info.msg)}`
    // Sendero: la primera estación muestra la aptitud real según el IAC (Apta / Condicional / No apta).
    $('#ruta').innerHTML = ETAPAS.map((e, i) => {
      const cls = i < st.etapa ? 'done' : i === st.etapa ? 'now' : ''
      const node = i < st.etapa ? '✓' : String(i + 1)
      if (i > 0) return `<li class="${cls}"><span class="node">${node}</span><b>${e.t}</b><small>${e.s}</small></li>`
      return `<li class="${cls} aptitud ${st.estado}" style="--c:${info.color}"><span class="node">${st.estado === 'apta' ? '✓' : st.estado === 'condicional' ? '!' : '✕'}</span><b>${info.label}</b><small>${IAC} ${pct(st.iac)} · ${t.stageFitSub}</small></li>`
    }).join('')
    $('#sensor').innerHTML = sensorHtml(st.sensor, prevSensor) + historyHtml(sensorHistory(d, id))
    renderVision()
    $('#supuestos').innerHTML = t.assumptions({
      tLo: RANGES.temp_agua_c.optLo, tHi: RANGES.temp_agua_c.optHi,
      uvLo: RANGES.uv_index.optLo, uvHi: RANGES.uv_index.optHi,
      tds: RANGES.tds_ppm.optHi,
      dLo: RANGES.profundidad_m.optLo, dHi: RANGES.profundidad_m.optHi,
      r: PARAMS.r_max, k: st.capacidad_kg.toFixed(1),
    })
  }

  /** Foto elegida + tira de miniaturas con la serie de la cámara. */
  const renderVision = () => {
    const el = $('#vision')
    if (!vis.length) {
      el.innerHTML = `<div class="empty">${CAMARA}<span>${t.noPhotos}</span></div>`
      return
    }
    const i = fotoSel >= 0 && fotoSel < vis.length ? fotoSel : vis.length - 1
    const v = vis[i]
    el.innerHTML = `
      <figure class="foto">
        <img src="${esc(photoUrl(v.foto))}" alt="${t.photoAlt}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'foto-ph',textContent:${esc(JSON.stringify(t.photoMissing))}}))">
        <figcaption><b>${v.biomasa_kg} kg · ${t.coverage.toLowerCase()} ${v.cobertura_pct} %</b><span>${fmtTime(v.timestamp)}</span></figcaption>
      </figure>
      ${
        vis.length > 1
          ? `<div class="thumbs" role="list">${vis
              .map(
                (x, k) => `<button type="button" data-k="${k}" class="${k === i ? 'sel' : ''}" title="${esc(fmtTime(x.timestamp))} · ${x.biomasa_kg} kg">
                  <img src="${esc(photoUrl(x.foto))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${x.biomasa_kg}</span></button>`,
              )
              .join('')}</div>`
          : ''
      }`
  }
  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.thumbs button')
    if (!b) return
    fotoSel = Number(b.dataset.k)
    renderVision()
  })

  /** Partes que dependen de los sliders (curva y acciones). */
  const renderScenario = () => {
    const f = factors(cond)
    for (const sl of SLIDERS) {
      $(`#o-${sl.key}`).textContent = `${cond[sl.key]} ${sl.unit}`
      const apt = $(`#f-${sl.key}`)
      apt.textContent = `${t.suitability} ${Math.round(f[sl.key] * 100)}%`
      apt.style.background = f[sl.key] >= 0.7 ? 'var(--bofedal)' : f[sl.key] >= 0.4 ? 'var(--ichu)' : 'var(--arcilla)'
    }
    const alpha = st.calib?.alpha ?? 1
    const chartEl = $('#chart')
    chartEl.innerHTML = chartSvg(vis, st.biomasa_kg, st.capacidad_kg, base, cond, alpha, chartEl.clientWidth) + calibHtml(st.calib)
    $('#actions').innerHTML = recommend(cond, st.biomasa_kg, st.capacidad_kg, d.recommendations, alpha, {
      ph: st.sensor?.ph,
    })
      .map((a) => `<li class="${a.nivel}"><span class="ic-box">${ICONS[a.codigo] ?? ICONS.ALERTA}</span><div><b>${esc(a.titulo)}</b>${a.detalle ? `<small>${esc(a.detalle)}</small>` : ''}</div></li>`)
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

  // Si cambia el ancho (giro del celular, ventana), se redibuja la curva a su nuevo tamaño.
  let lastW = $('#chart').clientWidth
  new ResizeObserver(() => {
    const w = $('#chart').clientWidth
    if (Math.abs(w - lastW) > 8) {
      lastW = w
      renderScenario()
    }
  }).observe($('#chart'))

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

const CAMARA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>'
const ONDA = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 12h3l2-5 3 10 3-7 2 2h5"/></svg>'

/** Lectura del sensor como medidores con su zona óptima (el pH no tiene rango en el modelo: se muestra sin zona). */
function sensorHtml(s?: SensorReading, prev?: SensorReading): string {
  if (!s) return `<div class="empty">${ONDA}<span>${t.noSensor}</span></div>`
  const isNew = prev != null && prev.timestamp !== s.timestamp
  const delta = (v: number | undefined, pv: number | undefined) =>
    isNew && v != null && pv != null && v !== pv ? (v > pv ? ' <i class="up">▲</i>' : ' <i class="down">▼</i>') : ''
  const ageMin = (Date.now() - Date.parse(s.timestamp)) / 60000
  const age = ageMin < 1 ? t.secondsAgo : ageMin < 60 ? t.minAgo(Math.round(ageMin)) : fmtTime(s.timestamp)
  return `<div class="gauges">
      ${gauge('TDS', s.tds_ppm, 'ppm', RANGES.tds_ppm, 400, isNew, delta(s.tds_ppm, prev?.tds_ppm))}
      ${gauge(t.waterTemp, s.temp_agua_c, '°C', RANGES.temp_agua_c, 30, isNew, delta(s.temp_agua_c, prev?.temp_agua_c))}
      ${gauge('UV', s.uv_index, '', RANGES.uv_index, 18, isNew, delta(s.uv_index, prev?.uv_index))}
      ${gauge('pH', s.ph, '', null, 14, isNew, delta(s.ph, prev?.ph))}
    </div><p class="age" title="${esc(s.timestamp)}">${age}${ageMin > 30 && ageMin < 60 * 24 * 365 ? ` · <span class="stale">${t.stale}</span>` : ''}</p>`
}

/** Línea bajo la curva: cómo la cámara recalibró el modelo. */
function calibHtml(c: Calibration | null): string {
  if (!c) return `<p class="calib muted small">${t.calibNone}</p>`
  const mejora = c.errAntes > 0 ? Math.round((1 - c.errDespues / c.errAntes) * 100) : 0
  return `<p class="calib small">${t.calibDone(c.n, c.alpha.toFixed(2), (PARAMS.r_max * c.alpha).toFixed(3), c.errAntes.toFixed(1), c.errDespues.toFixed(1), mejora)}</p>`
}

/** Minigráficos de TDS y temperatura en las últimas 48 h (el texto va fuera del SVG para que no se encoja). */
function historyHtml(serie: SensorReading[]): string {
  if (serie.length < 2) return ''
  const t0 = Date.parse(serie[0].timestamp)
  const t1 = Date.parse(serie.at(-1)!.timestamp)
  const horas = Math.max(1, Math.round((t1 - t0) / 3600e3))
  const spark = (vals: number[], color: string) => {
    const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1
    const pts = serie.map((s, i) => {
      const x = t1 > t0 ? ((Date.parse(s.timestamp) - t0) / (t1 - t0)) * 200 : (i / (serie.length - 1)) * 200
      const y = 36 - ((vals[i] - lo) / span) * 32
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    return `<svg viewBox="0 0 200 40" preserveAspectRatio="none" class="spark" aria-hidden="true">
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`
  }
  const row = (label: string, vals: number[], unit: string, color: string) => {
    const lo = Math.min(...vals), hi = Math.max(...vals)
    return `<div class="hist-row"><span class="hist-label">${label}</span>${spark(vals, color)}
      <span class="hist-range">${lo}–${hi} ${unit}</span></div>`
  }
  return `<div class="hist"><p class="muted small">${t.history(horas, serie.length)}</p>
    ${row('TDS', serie.map((s) => s.tds_ppm), 'ppm', '#2c8c8f')}
    ${row(t.waterTemp, serie.map((s) => s.temp_agua_c), '°C', '#c4552d')}</div>`
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
  alpha = 1,
  width = 640, // ancho real del contenedor: el SVG se dibuja a ese tamaño para que el texto no se encoja en el celular
): string {
  const W = Math.round(Math.min(Math.max(width || 640, 300), 640))
  const H = W < 480 ? 220 : 260, L = 40, R = 20, T = 12, B = 30
  const t0 = vis.length ? Date.parse(vis[0].timestamp) : Date.now()
  const startDay = vis.length ? Math.round((Date.parse(vis.at(-1)!.timestamp) - t0) / DAY) : 0
  const maxDay = startDay + HORIZON_DAYS
  const yMax = Math.max(K, ...vis.map((v) => v.biomasa_kg)) * 1.1

  const x = (day: number) => L + (day / maxDay) * (W - L - R)
  const y = (kg: number) => T + (1 - kg / yMax) * (H - T - B)
  const path = (serie: number[]) => serie.map((b, i) => `${i ? 'L' : 'M'}${x(startDay + i).toFixed(1)},${y(b).toFixed(1)}`).join('')

  const pBase = project(b0, K, base, HORIZON_DAYS, alpha)
  const pScen = project(b0, K, cond, HORIZON_DAYS, alpha)
  const area = `${path(pScen)}L${x(maxDay).toFixed(1)},${y(0).toFixed(1)}L${x(startDay).toFixed(1)},${y(0).toFixed(1)}Z`
  // Ajuste del modelo recalibrado sobre el periodo medido (desde la primera foto).
  const fitDays = startDay
  const pFit = vis.length > 1 ? project(vis[0].biomasa_kg, K, base, fitDays, alpha) : []
  const fitPath = pFit.map((b, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(b).toFixed(1)}`).join('')
  const umbral = PARAMS.umbral_cosecha * K

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)
  const nTicks = W < 480 ? 4 : 6
  const step = maxDay > 60 ? 7 * Math.ceil(maxDay / nTicks / 7) : 15 // semanas si el eje es largo
  const xTicks = Array.from({ length: Math.floor(maxDay / step) + 1 }, (_, i) => i * step)

  return `
  <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${t.curve}">
    <defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7a4c" stop-opacity=".28"/><stop offset="1" stop-color="#3b7a4c" stop-opacity="0"/></linearGradient></defs>
    ${yTicks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v.toFixed(0)}</text>`).join('')}
    <text x="${L + 4}" y="${y(yMax) + 4}" class="axis">kg</text>
    ${xTicks.map((d) => `<text x="${x(d)}" y="${H - 10}" class="axis" text-anchor="middle">${d} ${t.dayUnit}</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${y(umbral)}" y2="${y(umbral)}" class="umbral"/>
    <text x="${W - R}" y="${y(umbral) - 5}" class="axis umbral-lbl" text-anchor="end">${t.harvestPoint}</text>
    <line x1="${L}" x2="${W - R}" y1="${y(K)}" y2="${y(K)}" class="cap"/>
    ${fitPath ? `<path d="${fitPath}" class="fit"/>` : ''}
    <path d="${area}" class="area"/>
    <line x1="${x(startDay)}" x2="${x(startDay)}" y1="${T}" y2="${H - B}" class="hoy"/>
    <text x="${x(startDay) + 5}" y="${H - B - 5}" class="hoy-lbl">${t.today}</text>
    <path d="${path(pBase)}" class="base"/>
    <path d="${path(pScen)}" class="scen"/>
    ${vis.map((v) => `<circle cx="${x((Date.parse(v.timestamp) - t0) / DAY)}" cy="${y(v.biomasa_kg)}" r="5" class="real"><title>${v.biomasa_kg} kg</title></circle>`).join('')}
  </svg>
  <div class="chart-legend">
    <span><i class="l-scen"></i>${t.legendScenario}</span>
    <span><i class="l-base"></i>${t.legendBase}</span>
    <span><i class="l-real"></i>${t.legendReal}</span>
    ${vis.length > 1 ? `<span><i class="l-fit"></i>${t.legendFit}</span>` : ''}
  </div>`
}
