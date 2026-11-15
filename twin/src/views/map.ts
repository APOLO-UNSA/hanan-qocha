// Pantalla 1: mapa de la zona piloto con las cochas coloreadas por IAC, resumen, filtros y próximas cosechas.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Dataset } from '../data'
import { visionSeries } from '../data'
import { cochaState, conditionsFrom, ESTADO_INFO, PARAMS, project, type CochaState } from '../model'
import { esc, pct, VIDEO } from '../ui'
import { IAC, LANG, t } from '../i18n'
import { iacRing, miniRing, pinHtml } from '../art'
import { fechaCorta, ZONA } from '../zona'

let map: L.Map | undefined

type Estado = CochaState['estado']
const ESTADOS: Estado[] = ['apta', 'condicional', 'no-apta']

/** Días hasta el punto de cosecha según el modelo (recalibrado si hay fotos); null si no crece o no hay cámara. */
function diasACosecha(s: CochaState): number | null {
  if (s.etapa === 0) return null
  if (s.etapa === 3) return 0
  const serie = project(s.biomasa_kg, s.capacidad_kg, conditionsFrom(s.sensor), 365, s.calib?.alpha ?? 1)
  const d = serie.findIndex((b) => b >= PARAMS.umbral_cosecha * s.capacidad_kg)
  return d > 0 ? d : null
}

const ROSA = `<svg viewBox="0 0 64 64" aria-hidden="true">
  <circle cx="32" cy="32" r="29" fill="#fbf7eee6" stroke="#221f2e" stroke-width="1.2"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#d9caa9" stroke-dasharray="2 3"/>
  <path d="M32 6 37 32 32 29 27 32Z" fill="#c4552d"/><path d="M32 58 27 32 32 35 37 32Z" fill="#221f2e"/>
  <path d="M6 32 32 27 29 32 32 37Z" fill="#635d6e"/><path d="M58 32 32 37 35 32 32 27Z" fill="#635d6e"/>
  <text x="32" y="5.5" text-anchor="middle">N</text></svg>`

export function renderMap(root: HTMLElement, d: Dataset) {
  map?.remove()
  const states = d.sites.map((s) => cochaState(d, s))
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, states.filter((s) => s.estado === e).length])) as Record<Estado, number>
  const conSensor = states.filter((s) => s.sensor).length
  const kgMedidos = states.reduce((a, s) => a + (visionSeries(d, s.site.cocha_id).at(-1)?.biomasa_kg ?? 0), 0)
  const cosechas = states
    .map((s) => ({ s, dias: diasACosecha(s) }))
    .filter((x): x is { s: CochaState; dias: number } => x.dias != null)
    .sort((a, b) => a.dias - b.dias)
    .slice(0, 3)
  const iacMedio = states.length ? states.reduce((a, s) => a + s.iac, 0) / states.length : 0

  root.innerHTML = `
    <section class="map-screen">
      <div class="map-wrap">
        <div id="map" class="map"></div>
        ${
          states.length
            ? `<div class="resumen">
          <p class="resumen-t">${t.pilotZone}</p>
          <div class="kpis">
            <div><b>${states.length}</b><span>${t.kpiPonds}</span></div>
            <div><b>${conSensor}</b><span>${t.kpiSensors}</span></div>
            <div><b>${d.vision.length}</b><span>${t.kpiPhotos}</span></div>
            <div><b>${kgMedidos.toFixed(0)}</b><span>${t.kpiBiomass}</span></div>
          </div>
          <div class="barra-aptitud" role="img" aria-label="${ESTADOS.map((e) => `${ESTADO_INFO[e].label} ${porEstado[e]}`).join(', ')}">
            ${ESTADOS.map((e) => (porEstado[e] ? `<i style="flex:${porEstado[e]};background:${ESTADO_INFO[e].color}" title="${ESTADO_INFO[e].label}: ${porEstado[e]}"></i>` : '')).join('')}
          </div>
          <p class="barra-ley">${ESTADOS.map((e) => `<span><i style="background:${ESTADO_INFO[e].color}"></i>${porEstado[e]} ${porEstado[e] === 1 ? ESTADO_INFO[e].label.toLowerCase() : t.estadoPlural[e]}</span>`).join('')}</p>
        </div>`
            : ''
        }
        <div class="rosa">${ROSA}</div>
      </div>
      <aside class="panel">
        <p class="kicker">${t.mapKicker}</p>
        <h2>${t.candidates}</h2>
        <p class="muted">${t.mapIntro}</p>
        ${states.length === 0 ? `<p class="muted">${t.noSites}</p>` : ''}

        <div class="filtros" role="group" aria-label="${t.filterBy}">
          <button type="button" class="on" data-f="todas">${t.filterAll} <b>${states.length}</b></button>
          ${ESTADOS.map((e) => `<button type="button" data-f="${e}" style="--c:${ESTADO_INFO[e].color}"><i></i>${ESTADO_INFO[e].label} <b>${porEstado[e]}</b></button>`).join('')}
        </div>

        <a class="btn-finca" href="#/finca/${encodeURIComponent([...states].sort((a, b) => b.iac - a.iac)[0]?.site.cocha_id ?? '')}">${t.compareFarm} →</a>

        ${
          cosechas.length
            ? `<h3 class="mini-h">${t.nextHarvests}</h3>
        <ol class="cosechas">
          ${cosechas
            .map(
              ({ s, dias }) => `<li><a href="#/cocha/${encodeURIComponent(s.site.cocha_id)}">
                <span class="cuando">${dias === 0 ? t.readyShort : `<b>${dias}</b> ${dias === 1 ? t.day : t.days}`}</span>
                <span class="quien">${esc(s.site.nombre)}<small>${s.biomasa_kg.toFixed(1)} kg ${t.measuredNow}</small></span></a></li>`,
            )
            .join('')}
        </ol>`
            : ''
        }

        <h3 class="mini-h">${t.allPonds}</h3>
        <ul class="cocha-list">
          ${[...states]
            .sort((a, b) => b.iac - a.iac)
            .map(
              (s, i) => `
            <li style="--i:${i}" data-e="${s.estado}" data-id="${esc(s.site.cocha_id)}"><a href="#/cocha/${encodeURIComponent(s.site.cocha_id)}" title="${IAC} ${pct(s.iac)}, ${ESTADO_INFO[s.estado].label}">
              ${miniRing(s.iac, ESTADO_INFO[s.estado].color)}
              <span class="name">${esc(s.site.nombre)}<small>${esc(s.site.cocha_id)}, ${s.site.altitud_m} m <em style="color:${ESTADO_INFO[s.estado].color}">${ESTADO_INFO[s.estado].label}</em></small></span>
            </a></li>`,
            )
            .join('')}
        </ul>

        ${zonaHtml()}

        <div class="iac-como">
          ${iacRing(
            [
              { valor: 1, peso: 0.4, color: '#8f9be0' },
              { valor: 1, peso: 0.4, color: '#4fc1bf' },
              { valor: 1, peso: 0.2, color: '#c79bd4' },
            ],
            iacMedio,
            t.average,
            '#333b74',
            IAC,
            92,
          )}
          <div><p class="mini-h">${t.iacHowTitle}</p><p>${t.iacHow}</p></div>
        </div>
      </aside>
    </section>`

  map = L.map(root.querySelector<HTMLElement>('#map')!, { zoomControl: true, zoomSnap: 0.25 })
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services'
  const satelite = L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 18,
    attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics y la comunidad de usuarios GIS',
  })
  const etiquetas = L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 18 })
  const relieve = L.tileLayer(`${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 18,
    attribution: 'Mapa © Esri y colaboradores',
  })
  const satGroup = L.layerGroup([satelite, etiquetas]).addTo(map)
  L.control
    .layers({ [t.satellite]: satGroup, [t.relief]: relieve }, undefined, { position: 'topright' })
    .addTo(map)
  L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map)

  // Cuerpos de agua detectados con Sentinel-2 + SRTM (datos reales del frente Campo y Satélite)
  for (const c of ZONA?.detectadas ?? []) {
    const eco = ZONA!.ecostress[c.id]
    L.circleMarker([c.lat, c.lon], { radius: 5 + Math.sqrt(c.area_ha) * 3, className: 'agua-det', interactive: true })
      .addTo(map)
      .bindTooltip(
        `<b>${t.detectedPond} ${c.id}</b><br>${c.area_ha} ha, ${c.altitud_m} m, NDWI ${c.ndwi}` +
          (eco ? `<br>ECOSTRESS ${eco.lst_c} °C (${fechaCorta(eco.fecha, LANG)})` : '') +
          `<br><small>Sentinel-2${c.fecha ? `, ${fechaCorta(c.fecha, LANG)}` : ''}</small>`,
        { direction: 'top' },
      )
  }

  const bounds: L.LatLngTuple[] = []
  // Las mejores cochas se dibujan encima; la animación de entrada va de la más apta a la menos.
  const orden = [...states].sort((a, b) => b.iac - a.iac)
  const m = map
  const marcadores = new Map<string, { mk: L.Marker; estado: Estado }>()
  const lista = root.querySelector<HTMLElement>('.cocha-list')!
  const resaltar = (id: string, on: boolean) => {
    marcadores.get(id)?.mk.getElement()?.querySelector('.pin')?.classList.toggle('hl', on)
    lista.querySelector(`li[data-id="${CSS.escape(id)}"]`)?.classList.toggle('hl', on)
  }
  orden.forEach((s, i) => {
    const { lat, lon } = s.site
    bounds.push([lat, lon])
    const icon = L.divIcon({
      className: 'pin-wrap',
      html: pinHtml(ESTADO_INFO[s.estado].color, s.iac, s.estado, i),
      iconSize: [40, 52],
      iconAnchor: [20, 50],
      tooltipAnchor: [0, -48],
    })
    const mk = L.marker([lat, lon], { icon, zIndexOffset: Math.round(s.iac * 1000), riseOnHover: true, title: s.site.nombre })
      .addTo(m)
      .bindTooltip(`<b>${esc(s.site.nombre)}</b><br>${IAC} ${pct(s.iac)}, ${ESTADO_INFO[s.estado].label}`, { direction: 'top' })
      .on('mouseover', () => resaltar(s.site.cocha_id, true))
      .on('mouseout', () => resaltar(s.site.cocha_id, false))
      .on('click', () => {
        const go = () => (location.hash = `#/cocha/${encodeURIComponent(s.site.cocha_id)}`)
        if (!VIDEO || !map) return go()
        // En el video: acercarse a la cocha antes de abrir su ficha.
        map.once('moveend', () => setTimeout(go, 300))
        map.flyTo([lat, lon], 13, { duration: 1.6 })
      })
    marcadores.set(s.site.cocha_id, { mk, estado: s.estado })
  })

  // Resaltado sincronizado lista ↔ pin
  lista.addEventListener('mouseover', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]')
    lista.querySelectorAll<HTMLElement>('li.hl').forEach((x) => x !== li && resaltar(x.dataset.id!, false))
    if (li) resaltar(li.dataset.id!, true)
  })
  lista.addEventListener('mouseleave', () => lista.querySelectorAll<HTMLElement>('li.hl').forEach((x) => resaltar(x.dataset.id!, false)))

  // Filtros por aptitud: lista y pines a la vez
  root.querySelector('.filtros')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-f]')
    if (!b) return
    const f = b.dataset.f!
    root.querySelectorAll('.filtros button').forEach((x) => x.classList.toggle('on', x === b))
    lista.querySelectorAll<HTMLElement>('li[data-e]').forEach((li) => (li.hidden = f !== 'todas' && li.dataset.e !== f))
    marcadores.forEach(({ mk, estado }) => mk.getElement()?.classList.toggle('pin-oculto', f !== 'todas' && estado !== f))
  })

  // Encuadre inicial; se repite tras el primer cuadro, cuando el contenedor ya tiene su tamaño final.
  const encuadrar = () => {
    if (!map) return
    map.invalidateSize()
    if (bounds.length) map.fitBounds(bounds, { padding: VIDEO ? [80, 80] : [70, 70], maxZoom: 12 })
    else map.setView([-16.25, -71.35], 10)
  }
  encuadrar()
  requestAnimationFrame(encuadrar)
}

/** Datos satelitales reales de la zona (zona.json); vacío si no hay. */
function zonaHtml(): string {
  const z = ZONA
  if (!z) return ''
  const clima = z.clima[0]
  const fila = (valor: string, texto: string, fuente: string) =>
    `<li><b>${valor}</b><span>${texto}<small>${fuente}</small></span></li>`
  const det = z.detectadas
  return `<div class="zona-nasa">
    <p class="mini-h">${t.zoneData}</p>
    <ul>
      ${det.length ? fila(String(det.length), t.zoneDetected, `Sentinel-2 + SRTM${det[0].fecha ? `, ${fechaCorta(det[0].fecha, LANG)}` : ''}`) : ''}
      ${z.smap ? fila(`${z.smap.humedad}`, t.zoneSoil, `SMAP, ${fechaCorta(z.smap.fecha, LANG)}`) : ''}
      ${clima ? fila(`${clima.lluvia_temporada_mm} mm`, t.zoneRain(clima.temporada), 'NASA POWER') : ''}
      ${clima ? fila(String(clima.heladas_anio), t.zoneFrost, 'NASA POWER') : ''}
    </ul>
  </div>`
}
