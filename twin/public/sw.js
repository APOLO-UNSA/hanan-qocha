// Service worker de Qocha Twin: la app sigue funcionando sin señal en el bofedal.
// Escrito a mano (sin dependencias). Estrategias:
//   - Página:            red primero; sin red, la última versión guardada.
//   - Datos (*.json):    red primero; sin red, los últimos datos guardados.
//   - JS/CSS/imágenes:   caché primero (los archivos de Vite llevan hash, no cambian).
//   - Mapa (Esri):       caché primero, con un máximo de teselas guardadas.
const VERSION = 'v2'
const APP = `qt-app-${VERSION}`
const DATA = `qt-data-${VERSION}`
const TILES = `qt-tiles-${VERSION}`
const MAX_TILES = 400

const scope = new URL(self.registration.scope)

self.addEventListener('install', (e) => {
  // Lo mínimo para arrancar sin red; el resto se guarda al usarse.
  e.waitUntil(caches.open(APP).then((c) => c.addAll(['./', 'favicon.svg', 'manifest.webmanifest', 'icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![APP, DATA, TILES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(req, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(req)
    if (res.ok) cache.put(fallbackUrl ?? req, res.clone())
    return res
  } catch {
    const hit = (await cache.match(fallbackUrl ?? req, { ignoreSearch: true })) ?? (await caches.match(req, { ignoreSearch: true }))
    return hit ?? Response.error()
  }
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(req)
  if (hit) return hit
  try {
    const res = await fetch(req)
    // Las teselas de otro dominio llegan "opacas" (status 0): igual sirven para mostrarlas.
    if (res.ok || res.type === 'opaque') {
      await cache.put(req, res.clone())
      if (max) trim(cache, max)
    }
    return res
  } catch {
    return Response.error()
  }
}

async function trim(cache, max) {
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.hostname === 'server.arcgisonline.com') {
    e.respondWith(cacheFirst(req, TILES, MAX_TILES))
    return
  }
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return

  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req, APP, './'))
  } else if (url.pathname.endsWith('.json')) {
    e.respondWith(networkFirst(req, DATA))
  } else {
    e.respondWith(cacheFirst(req, APP))
  }
})
