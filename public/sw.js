const CACHE = 'nutrition-tracker-v1'
const ASSETS = [
  '/nutrition-tracker/',
  '/nutrition-tracker/index.html',
  '/nutrition-tracker/manifest.webmanifest',
  '/nutrition-tracker/icons/icon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (event.request.method !== 'GET') return

  if (url.pathname.startsWith('/nutrition-tracker/data/')) {
    return
  }

  // Hashed assets are immutable — cache-first is safe
  if (url.pathname.startsWith('/nutrition-tracker/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(event.request, copy))
          return res
        })
      }),
    )
    return
  }

  // Shell (index.html, navigation): network-first so rebuilds are picked up;
  // cache fallback keeps the PWA usable offline
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        return res
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached ?? caches.match('/nutrition-tracker/')),
      ),
  )
})
