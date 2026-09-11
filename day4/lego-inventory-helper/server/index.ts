import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApiHandler } from './api.ts'
import { DB_PATH } from './db.ts'

/**
 * The production server: serves the built app from dist/ and the API from the
 * same origin, so the whole thing is one `npm start` on your own machine and
 * the data never leaves it.
 *
 * In development this file isn't used at all — the API is mounted straight into
 * the Vite dev server (see vite.config.ts), so there's only one process.
 */

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(projectRoot, 'dist')
const port = Number(process.env.PORT) || 4173
const host = process.env.HOST ?? '127.0.0.1'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const api = createApiHandler()

const server = createServer((req, res) => {
  if ((req.url ?? '').startsWith('/api/')) {
    api(req, res)
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  // normalize() collapses any ../ before it can escape dist/.
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '')
  let filePath = join(distDir, relative)

  if (!filePath.startsWith(distDir)) {
    res.writeHead(403).end()
    return
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html')
  }
  // The app is a single page (hash routing), so anything unknown is the app.
  if (!existsSync(filePath)) filePath = join(distDir, 'index.html')

  if (!existsSync(filePath)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Run `npm run build` first.')
    return
  }

  res.writeHead(200, {
    'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
    // Vite fingerprints assets; index.html must never be cached.
    'cache-control': filePath.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable',
  })
  if (req.method === 'HEAD') return void res.end()
  createReadStream(filePath).pipe(res)
})

server.listen(port, host, () => {
  console.log(`LEGO Inventory running at http://${host}:${port}`)
  console.log(`Database: ${DB_PATH}`)
})
