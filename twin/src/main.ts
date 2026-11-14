import './style.css'
import { DATA_SOURCE, loadDataset, type Dataset } from './data'
import { renderMap } from './views/map'
import { renderCocha } from './views/cocha'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <a href="#/" class="brand"><img src="${import.meta.env.BASE_URL}favicon.svg" alt=""> Hanan Qocha <small>Qocha Twin</small></a>
    <span class="src" title="Fuente de datos">datos: ${DATA_SOURCE}</span>
  </header>
  <main id="view"></main>`
const view = app.querySelector<HTMLElement>('#view')!

let data: Dataset

function route() {
  const m = location.hash.match(/^#\/cocha\/([^/]+)/)
  if (m) renderCocha(view, data, decodeURIComponent(m[1]))
  else renderMap(view, data)
  window.scrollTo(0, 0)
}

async function start() {
  view.innerHTML = '<p class="page muted">Cargando datos…</p>'
  data = await loadDataset()
  route()
  window.addEventListener('hashchange', route)

  // Modo en vivo: refresca las lecturas del sensor cada 10 s (solo en el mapa, para no reiniciar los sliders).
  if (DATA_SOURCE === 'live') {
    setInterval(async () => {
      data = await loadDataset()
      if (!location.hash.startsWith('#/cocha/')) route()
    }, 10_000)
  }
}

start()
