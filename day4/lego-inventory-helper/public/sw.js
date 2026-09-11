const CACHE_NAME = 'lego-inventory-v2'
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './catalog/parts.csv',
  './catalog/colors.csv',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Piece photos are fetched at view time from Rebrickable's CDN (see
// public/catalog/CATALOG.md#images) — not bundled locally, since bundling ~100k
// actual images isn't practical. Caching them here opportunistically means a piece
// you've already viewed once stays visible offline; anything never viewed while
// online falls back to the placeholder (see components/pieceImage.js) until the
// device is back online. Every other allowed origin is same-origin — this is the
// one deliberate cross-origin exception.
const ALLOWED_CROSS_ORIGIN = ['cdn.rebrickable.com']

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin && !ALLOWED_CROSS_ORIGIN.includes(url.hostname)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          // Cross-origin <img> requests come back as "opaque" (status 0, ok:
          // false) since we never asked for CORS — still worth caching for reuse.
          if (response.ok || response.type === 'opaque') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached ?? caches.match('./index.html'))
      return cached ?? networkFetch
    }),
  )
})
