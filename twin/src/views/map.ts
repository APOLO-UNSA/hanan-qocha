// Pantalla 1: mapa de cochas coloreadas por IAC.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Dataset } from '../data'
import { cochaState, ESTADO_INFO } from '../model'
import { esc, pct } from '../ui'

let map: L.Map | undefined

export function renderMap(root: HTMLElement, d: Dataset) {
  map?.remove()
  const states = d.sites.map((s) => cochaState(d, s))

  root.innerHTML = `
    <section class="map-screen">
      <div id="map" class="map"></div>
      <aside class="panel">
        <h2>Cochas candidatas</h2>
        <p class="muted">Bofedales de Salinas y Aguada Blanca, coloreados según el Índice de Aptitud Cushuro (IAC).</p>
        <div class="legend">
          ${Object.values(ESTADO_INFO).map((e) => `<span><i style="background:${e.color}"></i>${e.label}</span>`).join('')}
        </div>
        ${states.length === 0 ? '<p class="muted">Aún no hay cochas en sites.json.</p>' : ''}
        <ul class="cocha-list">
          ${states
            .sort((a, b) => b.iac - a.iac)
            .map(
              (s) => `
            <li><a href="#/cocha/${encodeURIComponent(s.site.cocha_id)}">
              <span class="dot" style="background:${ESTADO_INFO[s.estado].color}"></span>
              <span class="name">${esc(s.site.nombre)}<small>${esc(s.site.cocha_id)} · ${s.site.altitud_m} m</small></span>
              <span class="iac">${pct(s.iac)}</span>
            </a></li>`,
            )
            .join('')}
        </ul>
      </aside>
    </section>`

  map = L.map(root.querySelector<HTMLElement>('#map')!, { zoomControl: true })
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: '© OpenStreetMap, SRTM | © OpenTopoMap',
  }).addTo(map)

  const bounds: L.LatLngTuple[] = []
  for (const s of states) {
    const { lat, lon } = s.site
    bounds.push([lat, lon])
    L.circleMarker([lat, lon], {
      radius: 11,
      color: '#fff',
      weight: 2,
      fillColor: ESTADO_INFO[s.estado].color,
      fillOpacity: 0.9,
    })
      .addTo(map)
      .bindTooltip(`${esc(s.site.nombre)} · IAC ${pct(s.iac)}`)
      .on('click', () => (location.hash = `#/cocha/${encodeURIComponent(s.site.cocha_id)}`))
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [60, 60], maxZoom: 12 })
  else map.setView([-16.25, -71.35], 10)
}
