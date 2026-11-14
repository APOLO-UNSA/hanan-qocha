import './style.css'
import { DATA_SOURCE, loadDataset, type Dataset } from './data'
import { renderMap } from './views/map'
import { renderCocha, type Refresh } from './views/cocha'

const LIVE = DATA_SOURCE === 'live'
const POLL_MS = Number(import.meta.env.VITE_POLL_MS ?? 10_000)

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <a href="#/" class="brand"><img src="${import.meta.env.BASE_URL}favicon.svg" alt=""> Hanan Qocha <small>Qocha Twin</small></a>
    <span class="src" title="Fuente de datos">datos: ${DATA_SOURCE}</span>
  </header>
  <main id="view"></main>`
const view = app.querySelector<HTMLElement>('#view')!

let data: Dataset
let refreshCocha: Refresh | undefined

function route() {
  const m = location.hash.match(/^#\/cocha\/([^/]+)/)
  refreshCocha = undefined
  if (m) refreshCocha = renderCocha(view, data, decodeURIComponent(m[1]), LIVE)
  else renderMap(view, data)
  window.scrollTo(0, 0)
}

async function poll() {
  data = await loadDataset()
  // En la ficha se actualiza en su sitio (no reinicia sliders); el mapa se vuelve a dibujar.
  if (refreshCocha) refreshCocha(data)
  else if (!location.hash.startsWith('#/cocha/')) route()
}

async function start() {
  view.innerHTML = '<p class="page muted">Cargando datos…</p>'
  data = await loadDataset()
  route()
  window.addEventListener('hashchange', route)

  if (LIVE) {
    // Encadenado para no solapar peticiones si el puente tarda; pausa con la pestaña oculta.
    const tick = async () => {
      if (!document.hidden) await poll().catch(() => {})
      setTimeout(tick, POLL_MS)
    }
    setTimeout(tick, POLL_MS)
  }
}

start()
