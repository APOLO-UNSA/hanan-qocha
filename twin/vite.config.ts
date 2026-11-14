import { defineConfig, loadEnv, type Plugin } from 'vite'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DATA_ROOT = resolve(import.meta.dirname, '../data')

const TYPES: Record<string, string> = {
  json: 'application/json', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml',
}

/**
 * En desarrollo sirve /data/<nombre>.json y /data/fotos/<imagen> desde la carpeta data/ del repo.
 * Orden según VITE_DATA_SOURCE:
 *   live      → data/live → data/processed → data/mock
 *   processed → data/processed → data/mock   (por defecto)
 *   mock      → data/mock
 * En producción el workflow deploy.yml copia mock + processed a dist/data/.
 */
function repoData(source: string): Plugin {
  const order =
    source === 'live' ? ['live', 'processed', 'mock'] : source === 'mock' ? ['mock'] : ['processed', 'mock']
  return {
    name: 'hanan-qocha-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // /data/<nombre>.json o /data/fotos/<imagen> (sin subir de carpeta)
        const m = req.url?.match(/\/data\/((?:fotos\/)?[\w-]+(?:\.[\w-]+)*\.(json|jpe?g|png|webp|svg))(\?.*)?$/i)
        if (!m) return next()
        for (const dir of order) {
          const file = resolve(DATA_ROOT, dir, m[1])
          if (existsSync(file)) {
            res.setHeader('Content-Type', TYPES[m[2].toLowerCase()] ?? 'application/octet-stream')
            res.setHeader('Cache-Control', 'no-store')
            res.setHeader('X-Data-Source', dir)
            res.end(readFileSync(file))
            return
          }
        }
        res.statusCode = 404
        res.end('[]')
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname)
  return {
    base: '/hanan-qocha/',
    plugins: [repoData(env.VITE_DATA_SOURCE ?? 'processed')],
  }
})
