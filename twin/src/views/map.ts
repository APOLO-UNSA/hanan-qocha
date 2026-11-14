// Pantalla 1: mapa de cochas coloreadas por IAC.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Dataset } from '../data'
import { cochaState, ESTADO_INFO } from '../model'
import { esc, pct, VIDEO } from '../ui'
import { IAC, t } from '../i18n'
import { miniRing } from '../art'

let map: L.Map | undefined

export function renderMap(root: HTMLElement, d: Dataset) {
  map?.remove()
  const states = d.sites.map((s) => cochaState(d, s))

  root.innerHTML = `
    <section class="map-screen">
      <div id="map" class="map"></div>
      <aside class="panel">
        <p class="kicker">${t.mapKicker}</p>
        <h2>${t.candidates}</h2>
        <p class="muted">${t.mapIntro}</p>
        <div class="legend">
          ${Object.values(ESTADO_INFO).map((e) => `<span><i style="background:${e.color}"></i>${e.label}</span>`).join('')}
        </div>
        ${states.length === 0 ? `<p class="muted">${t.noSites}</p>` : ''}
        <ul class="cocha-list">
          ${states
            .sort((a, b) => b.iac - a.iac)
            .map(
              (s) => `
            <li><a href="#/cocha/${encodeURIComponent(s.site.cocha_id)}" title="${IAC} ${pct(s.iac)} · ${ESTADO_INFO[s.estado].label}">
              ${miniRing(s.iac, ESTADO_INFO[s.estado].color)}
              <span class="name">${esc(s.site.nombre)}<small>${esc(s.site.cocha_id)} · ${s.site.altitud_m} m · ${ESTADO_INFO[s.estado].label}</small></span>
            </a></li>`,
            )
            .join('')}
        </ul>
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

  const bounds: L.LatLngTuple[] = []
  for (const s of states) {
    const { lat, lon } = s.site
    bounds.push([lat, lon])
    L.circleMarker([lat, lon], {
      radius: VIDEO ? 14 : 11,
      color: '#fbf7ee',
      weight: 3,
      fillColor: ESTADO_INFO[s.estado].color,
      fillOpacity: 0.95,
    })
      .addTo(map)
      .bindTooltip(`${esc(s.site.nombre)} · ${IAC} ${pct(s.iac)}`)
      .on('click', () => {
        const go = () => (location.hash = `#/cocha/${encodeURIComponent(s.site.cocha_id)}`)
        if (!VIDEO || !map) return go()
        // En el video: acercarse a la cocha antes de abrir su ficha.
        // Los círculos se escalan durante la animación: se ocultan y queda el nombre de la cocha.
        map.getPane('overlayPane')!.style.opacity = '0'
        map.once('moveend', () => setTimeout(go, 300))
        map.flyTo([lat, lon], 13, { duration: 1.6 })
      })
  }
  // Encuadre inicial; se repite tras el primer cuadro, cuando el contenedor ya tiene su tamaño final.
  const encuadrar = () => {
    if (!map) return
    map.invalidateSize()
    if (bounds.length) map.fitBounds(bounds, { padding: VIDEO ? [80, 80] : [60, 60], maxZoom: 12 })
    else map.setView([-16.25, -71.35], 10)
  }
  encuadrar()
  requestAnimationFrame(encuadrar)
}
