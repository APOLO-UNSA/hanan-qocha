// Piezas gráficas del gemelo: logo, íconos, anillo del IAC, medidores. Todo SVG en línea (funciona sin conexión).
import type { Range } from './model'

/** Logo: nevado sobre la laguna de arriba (hanan qocha) con colonias de cushuro. */
export const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true">
  <path d="M3 24 L14 9 L19 15 L24 8 L37 24 Z" fill="var(--ichu)"/>
  <path d="M14 9 L17.5 13.6 L15.8 13 L14 15 L12 12.6 Z M24 8 L28.2 13.4 L26 12.6 L24 14.5 L22 12.8 Z" fill="var(--papel)"/>
  <ellipse cx="20" cy="29" rx="17" ry="8" fill="var(--qocha)"/>
  <circle cx="14" cy="29" r="2.6" fill="var(--bofedal-claro)"/><circle cx="21" cy="31" r="3.2" fill="var(--bofedal-claro)"/><circle cx="27" cy="28" r="2" fill="var(--bofedal-claro)"/>
</svg>`

const ic = (body: string) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

/** Íconos de las acciones recomendadas (por código). */
export const ICONS: Record<string, string> = {
  OK: ic('<path d="M4 12.5 9.5 18 20 6.5"/>'),
  ESPERAR: ic('<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/><path d="M10 18h4" />'),
  COSECHAR: ic('<path d="M4 11h16l-2 9H6z"/><path d="M8 11c0-4 1.8-7 4-7s4 3 4 7"/><circle cx="10" cy="15" r="1"/><circle cx="14" cy="16" r="1"/>'),
  RENOVAR_AGUA: ic('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14.5a3 3 0 0 0 3 3"/>'),
  SOMBRA: ic('<circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M1.5 8H3M3.4 3.4l1 1M12.6 3.4l-1 1"/><path d="M7 19h11a4 4 0 0 0 0-8 5 5 0 0 0-9.6 1.5A3.3 3.3 0 0 0 7 19z"/>'),
  PROFUNDIDAD: ic('<path d="M3 9c2 0 2-1.5 4.5-1.5S9.5 9 12 9s2.5-1.5 4.5-1.5S19 9 21 9"/><path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2.5-1.5 4.5-1.5S19 15 21 15"/><path d="M12 3v3M12 18v3"/>'),
  SIN_CRECIMIENTO: ic('<path d="M3 17h18"/><path d="M5 13l4-3 4 2 6-5"/><path d="M15 7h4v4"/><path d="M4 4l16 16"/>'),
  ALERTA: ic('<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>'),
}

/**
 * Anillo del IAC: tres arcos con el peso de cada fuente (satélite 40 %, in situ 40 %, visión 20 %);
 * cada arco se rellena según su índice. En el centro, el IAC.
 */
export function iacRing(parts: { valor: number | null; peso: number; color: string }[], total: number, etiqueta: string, color: string, sigla = '', size = 168): string {
  const r = 64, c = 2 * Math.PI * r, gap = 6
  let off = 0
  const arcs = parts
    .map((p) => {
      const len = (p.peso / 1) * c - gap
      const lleno = Math.max(0, Math.min(1, p.valor ?? 0)) * len
      const seg = `
        <circle r="${r}" cx="80" cy="80" fill="none" stroke="${p.color}" stroke-opacity=".18" stroke-width="16"
          stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>
        ${p.valor == null ? '' : `<circle r="${r}" cx="80" cy="80" fill="none" stroke="${p.color}" stroke-width="16"
          stroke-dasharray="${lleno} ${c - lleno}" stroke-dashoffset="${-off}" transform="rotate(-90 80 80)"/>`}`
      off += len + gap
      return seg
    })
    .join('')
  return `<svg class="ring" viewBox="0 0 160 160" width="${size}" height="${size}" role="img" aria-label="${sigla} ${Math.round(total * 100)} · ${etiqueta}">
    ${arcs}
    <circle r="46" cx="80" cy="80" fill="${color}"/>
    <text x="80" y="62" text-anchor="middle" class="ring-lbl">${sigla}</text>
    <text x="80" y="94" text-anchor="middle" class="ring-num">${Math.round(total * 100)}</text>
    <text x="80" y="111" text-anchor="middle" class="ring-lbl ring-estado">${etiqueta}</text>
  </svg>`
}

/** Anillo pequeño para la lista del mapa. */
export function miniRing(v: number, color: string): string {
  const r = 15, c = 2 * Math.PI * r, l = Math.max(0, Math.min(1, v)) * c
  return `<svg class="mini-ring" viewBox="0 0 40 40" aria-hidden="true">
    <circle r="${r}" cx="20" cy="20" fill="none" stroke="${color}" stroke-opacity=".2" stroke-width="5"/>
    <circle r="${r}" cx="20" cy="20" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
      stroke-dasharray="${l} ${c - l}" transform="rotate(-90 20 20)"/>
    <text x="20" y="24.5" text-anchor="middle">${Math.round(v * 100)}</text></svg>`
}

/**
 * Medidor horizontal de una lectura: escala de 0 a `max`, la zona óptima resaltada y una marca en el valor.
 * El texto va fuera del SVG para que se lea igual en el celular.
 */
export function gauge(label: string, valor: number | undefined, unidad: string, rango: Range | null, max: number, nuevo = false, delta = ''): string {
  const pctOf = (x: number) => Math.max(0, Math.min(100, (x / max) * 100))
  const enRango = rango && valor != null && valor >= rango.optLo && valor <= rango.optHi
  const fuera = rango && valor != null && (valor < rango.min || valor > rango.max)
  const estado = valor == null ? 'nd' : !rango ? 'neutro' : enRango ? 'ok' : fuera ? 'mal' : 'medio'
  return `<div class="gauge ${estado}">
    <div class="g-head"><span class="g-label">${label}</span>
      <span class="g-val${nuevo ? ' flash' : ''}">${valor ?? '—'}<small>${valor != null ? unidad : ''}</small>${delta}</span></div>
    <div class="g-track">
      ${rango ? `<i class="g-opt" style="left:${pctOf(rango.optLo)}%;width:${pctOf(rango.optHi) - pctOf(rango.optLo)}%"></i>` : ''}
      ${valor != null ? `<i class="g-mark" style="left:${pctOf(valor)}%"></i>` : ''}
    </div>
  </div>`
}

/** Fondo del slider con la franja óptima pintada (en % del recorrido del slider). */
export function sliderBand(r: Range, min: number, max: number): string {
  const p = (x: number) => Math.max(0, Math.min(100, ((x - min) / (max - min)) * 100))
  return `--a:${p(r.min)}%;--b:${p(r.optLo)}%;--c:${p(r.optHi)}%;--d:${p(r.max)}%`
}
