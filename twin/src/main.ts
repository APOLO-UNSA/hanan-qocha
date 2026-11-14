import './style.css'
import { DATA_SOURCE, DEFAULT_SOURCE, loadDataset, sourceUrl, type Dataset } from './data'
import { renderMap } from './views/map'
import { renderCocha, type Refresh } from './views/cocha'
import { LANG, langUrl, t } from './i18n'
import { VIDEO } from './ui'
import { LOGO } from './art'

document.documentElement.lang = LANG
if (VIDEO) document.documentElement.classList.add('video')

const LIVE = DATA_SOURCE === 'live'
const POLL_MS = Number(import.meta.env.VITE_POLL_MS ?? 10_000)

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <header class="topbar">
    <a href="#/" class="brand">${LOGO}<span class="brand-name">Hanan Qocha</span><small>Qocha Twin</small></a>
    <nav class="top-right">
      <span class="src" title="${t.dataSource}"><span class="src-label">${t.data}: ${DATA_SOURCE} ·</span>
        <a href="${sourceUrl(DATA_SOURCE === 'demo' ? DEFAULT_SOURCE : 'demo')}">${DATA_SOURCE === 'demo' ? t.exitDemo : t.seeDemo}</a></span>
      <span class="lang">${LANG === 'es' ? '<b>ES</b>' : `<a href="${langUrl('es')}">ES</a>`} · ${LANG === 'en' ? '<b>EN</b>' : `<a href="${langUrl('en')}">EN</a>`}</span>
    </nav>
  </header>
  ${DATA_SOURCE === 'demo' ? (VIDEO ? `<div class="demo-chip">${t.demoChip}</div>` : `<div class="demo-banner">${t.demoBanner}</div>`) : ''}
  <div id="offline" class="offline" hidden>${t.offline}</div>
  <main id="view"></main>`
const view = app.querySelector<HTMLElement>('#view')!

let data: Dataset
let refreshCocha: Refresh | undefined

function route() {
  const m = location.hash.match(/^#\/cocha\/([^/]+)/)
  refreshCocha = undefined
  if (m) refreshCocha = renderCocha(view, data, decodeURIComponent(m[1]), LIVE, POLL_MS / 1000)
  else renderMap(view, data)
  window.scrollTo(0, 0)
}

async function poll() {
  data = await loadDataset(data)
  // En la ficha se actualiza en su sitio (no reinicia sliders); el mapa se vuelve a dibujar.
  if (refreshCocha) refreshCocha(data)
  else if (!location.hash.startsWith('#/cocha/')) route()
}

async function start() {
  view.innerHTML = `<p class="page muted">${t.loading}</p>`
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

// Sin señal en el bofedal: aviso visible y la app sigue con lo último guardado (ver public/sw.js).
const offlineEl = app.querySelector<HTMLElement>('#offline')!
const syncOnline = () => (offlineEl.hidden = navigator.onLine)
window.addEventListener('online', syncOnline)
window.addEventListener('offline', syncOnline)
syncOnline()

// El service worker solo en producción: en desarrollo interferiría con el modo en vivo.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((e) => console.warn('[gemelo] sin modo offline:', e))
}
