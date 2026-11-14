// Curva de biomasa: panel oscuro tipo instrumento, con ejes titulados, zona de cosecha, marca de "hoy",
// cruce con el punto de cosecha, ajuste recalibrado y lectura al pasar el cursor.
import { PARAMS, project, type Conditions } from '../model'
import { t } from '../i18n'

const DAY = 864e5
export const HORIZON_DAYS = 90

interface Meta {
  x: (d: number) => number
  y: (kg: number) => number
  invX: (px: number) => number
  W: number
  H: number
  L: number
  R: number
  T: number
  B: number
  startDay: number
  maxDay: number
  scen: number[]
}

let uid = 0

export function chartSvg(
  vis: { timestamp: string; biomasa_kg: number }[],
  b0: number,
  K: number,
  base: Conditions,
  cond: Conditions,
  alpha = 1,
  width = 640,
  intro = false,
): { html: string; meta: Meta } {
  const W = Math.round(Math.min(Math.max(width || 640, 300), 1100))
  const angosto = W < 520
  const H = angosto ? 260 : 330
  const L = angosto ? 46 : 60, R = angosto ? 14 : 24, T = 26, B = angosto ? 44 : 50
  const t0 = vis.length ? Date.parse(vis[0].timestamp) : Date.now()
  const startDay = vis.length ? Math.round((Date.parse(vis.at(-1)!.timestamp) - t0) / DAY) : 0
  const maxDay = startDay + HORIZON_DAYS
  const yMax = niceMax(Math.max(K, ...vis.map((v) => v.biomasa_kg)) * 1.08)

  const x = (d: number) => L + (d / maxDay) * (W - L - R)
  const y = (kg: number) => T + (1 - kg / yMax) * (H - T - B)
  const invX = (px: number) => ((px - L) / (W - L - R)) * maxDay
  const line = (serie: number[], d0: number) => serie.map((b, i) => `${i ? 'L' : 'M'}${x(d0 + i).toFixed(1)},${y(b).toFixed(1)}`).join('')

  const pBase = project(b0, K, base, HORIZON_DAYS, alpha)
  const pScen = project(b0, K, cond, HORIZON_DAYS, alpha)
  const pFit = vis.length > 1 ? project(vis[0].biomasa_kg, K, base, startDay, alpha) : []
  const umbral = PARAMS.umbral_cosecha * K
  const cruce = pScen.findIndex((b) => b >= umbral)
  const id = `c${++uid}`

  // Ejes: 5 marcas en Y "redondas", marcas de X cada semana (o cada 15 días si el eje es corto)
  const yStep = yMax / 5
  const yTicks = Array.from({ length: 6 }, (_, i) => i * yStep)
  const xStep = maxDay > 60 ? 7 * Math.max(1, Math.round(maxDay / (angosto ? 4 : 7) / 7)) : 15
  const xTicks = Array.from({ length: Math.floor(maxDay / xStep) + 1 }, (_, i) => i * xStep)
  const xMinor = Array.from({ length: Math.floor(maxDay / 7) + 1 }, (_, i) => i * 7)

  const area = `${line(pScen, startDay)}L${x(maxDay).toFixed(1)},${y(0).toFixed(1)}L${x(startDay).toFixed(1)},${y(0).toFixed(1)}Z`
  const pathLen = Math.round(W * 1.6)

  const cruceSvg =
    cruce === 0
      ? `<g class="hito"><circle cx="${x(startDay)}" cy="${y(pScen[0])}" r="7"/><text x="${x(startDay) + 12}" y="${y(pScen[0]) - 10}">${t.readyNow}</text></g>`
      : cruce > 0
        ? `<g class="hito">
            <line x1="${x(startDay + cruce)}" x2="${x(startDay + cruce)}" y1="${y(umbral)}" y2="${H - B}"/>
            <circle cx="${x(startDay + cruce)}" cy="${y(umbral)}" r="6"/>
            <text x="${x(startDay + cruce) + (x(startDay + cruce) > W - 170 ? -10 : 10)}" y="${y(umbral) + 20}"
              text-anchor="${x(startDay + cruce) > W - 170 ? 'end' : 'start'}">${t.harvestIn(cruce)}</text>
          </g>`
        : ''

  const html = `
  <svg viewBox="0 0 ${W} ${H}" class="chart${intro ? ' intro' : ''}" role="img" aria-label="${t.curve}" style="--len:${pathLen}">
    <defs>
      <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8cc084" stop-opacity=".42"/><stop offset="1" stop-color="#8cc084" stop-opacity="0"/>
      </linearGradient>
      <pattern id="${id}h" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#d9a23f" stroke-opacity=".22" stroke-width="3"/>
      </pattern>
      <filter id="${id}g" x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter>
    </defs>

    <rect x="${L}" y="${y(yMax)}" width="${W - L - R}" height="${y(umbral) - y(yMax)}" fill="url(#${id}h)"/>
    <text x="${L + 8}" y="${y(yMax) + 14}" class="zona-lbl">${t.harvestZone}</text>

    ${xMinor.map((d) => `<line x1="${x(d)}" x2="${x(d)}" y1="${T}" y2="${H - B}" class="grid-min"/>`).join('')}
    ${yTicks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>
      <text x="${L - 10}" y="${y(v) + 4}" class="axis" text-anchor="end">${fmt(v)}</text>`).join('')}
    ${xTicks.map((d) => `<line x1="${x(d)}" x2="${x(d)}" y1="${H - B}" y2="${H - B + 5}" class="tick"/>
      <text x="${x(d)}" y="${H - B + 19}" class="axis" text-anchor="middle">${d}</text>`).join('')}
    <line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="eje"/>
    <line x1="${L}" x2="${L}" y1="${T}" y2="${H - B}" class="eje"/>
    <text x="${(L + W - R) / 2}" y="${H - 6}" class="axis-title" text-anchor="middle">${vis.length ? t.axisDays : t.axisDaysToday}</text>
    <text transform="translate(${angosto ? 11 : 15} ${(T + H - B) / 2}) rotate(-90)" class="axis-title" text-anchor="middle">${t.axisKg}</text>

    <line x1="${L}" x2="${W - R}" y1="${y(K)}" y2="${y(K)}" class="cap"/>
    <text x="${W - R - 4}" y="${y(K) - 6}" class="cap-lbl" text-anchor="end">${t.capacity(K.toFixed(1))}</text>
    <line x1="${L}" x2="${W - R}" y1="${y(umbral)}" y2="${y(umbral)}" class="umbral"/>
    <text x="${W - R - 4}" y="${y(umbral) + 15}" class="umbral-lbl" text-anchor="end">${t.harvestPoint} · ${umbral.toFixed(1)} kg</text>

    <rect x="${x(startDay)}" y="${T}" width="${W - R - x(startDay)}" height="${H - B - T}" class="futuro"/>
    <line x1="${x(startDay)}" x2="${x(startDay)}" y1="${T - 6}" y2="${H - B}" class="hoy"/>
    <text x="${x(startDay)}" y="${T - 10}" class="hoy-lbl" text-anchor="middle">${t.today}</text>

    <path d="${area}" fill="url(#${id}a)" class="area"/>
    ${pFit.length ? `<path d="${line(pFit, 0)}" class="fit"/>` : ''}
    <path d="${line(pBase, startDay)}" class="base"/>
    <path d="${line(pScen, startDay)}" class="scen-glow" filter="url(#${id}g)"/>
    <path d="${line(pScen, startDay)}" class="scen"/>
    ${cruceSvg}
    ${vis.map((v, i) => `<circle cx="${x((Date.parse(v.timestamp) - t0) / DAY)}" cy="${y(v.biomasa_kg)}" r="5.5" class="real" style="--i:${i}"><title>${v.biomasa_kg} kg</title></circle>`).join('')}

    <g class="cursor" visibility="hidden">
      <line class="cursor-v" y1="${T}" y2="${H - B}"/>
      <circle class="cursor-p" r="5"/>
      <g class="cursor-tip"><rect rx="5" width="128" height="40"/><text class="tip-1" x="10" y="17"></text><text class="tip-2" x="10" y="32"></text></g>
    </g>
    <rect class="hover" x="${L}" y="${T}" width="${W - L - R}" height="${H - B - T}"/>
  </svg>
  <div class="chart-legend">
    <span><i class="l-scen"></i>${t.legendScenario}</span>
    <span><i class="l-base"></i>${t.legendBase}</span>
    <span><i class="l-real"></i>${t.legendReal}</span>
    ${vis.length > 1 ? `<span><i class="l-fit"></i>${t.legendFit}</span>` : ''}
    <span><i class="l-zona"></i>${t.harvestZone}</span>
  </div>`

  return { html, meta: { x, y, invX, W, H, L, R, T, B, startDay, maxDay, scen: pScen } }
}

/** Lectura al pasar el cursor (o el dedo) sobre la proyección. */
export function attachChartHover(host: HTMLElement, m: Meta) {
  const svg = host.querySelector<SVGSVGElement>('svg.chart')
  if (!svg) return
  const cur = svg.querySelector<SVGGElement>('.cursor')!
  const vline = svg.querySelector<SVGLineElement>('.cursor-v')!
  const dot = svg.querySelector<SVGCircleElement>('.cursor-p')!
  const tip = svg.querySelector<SVGGElement>('.cursor-tip')!
  const t1 = svg.querySelector<SVGTextElement>('.tip-1')!
  const t2 = svg.querySelector<SVGTextElement>('.tip-2')!
  const move = (ev: PointerEvent) => {
    const r = svg.getBoundingClientRect()
    const px = ((ev.clientX - r.left) / r.width) * m.W
    const d = Math.round(Math.min(m.maxDay, Math.max(m.startDay, m.invX(px))))
    const kg = m.scen[d - m.startDay]
    if (kg == null) return
    const cx = m.x(d), cy = m.y(kg)
    vline.setAttribute('x1', String(cx)); vline.setAttribute('x2', String(cx))
    dot.setAttribute('cx', String(cx)); dot.setAttribute('cy', String(cy))
    const tx = cx + 140 > m.W - m.R ? cx - 138 : cx + 10
    tip.setAttribute('transform', `translate(${tx} ${Math.max(m.T, cy - 50)})`)
    t1.textContent = `${kg.toFixed(1)} kg`
    t2.textContent = t.dayIn(d - m.startDay)
    cur.setAttribute('visibility', 'visible')
  }
  const hover = svg.querySelector<SVGRectElement>('.hover')!
  hover.addEventListener('pointermove', move)
  hover.addEventListener('pointerdown', move)
  hover.addEventListener('pointerleave', () => cur.setAttribute('visibility', 'hidden'))
}

function niceMax(v: number) {
  const p = 10 ** Math.floor(Math.log10(v))
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * p >= v) return k * p
  return 10 * p
}
const fmt = (v: number) => (v >= 10 || v === 0 ? v.toFixed(0) : v.toFixed(1))
