// public/sw.js — Service Worker MaintaFood v2
const CACHE_NAME = 'maintafood-v2'

// Seulement cacher les assets statiques Next.js
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ne JAMAIS cacher les requêtes Supabase
  if (url.hostname.includes('supabase.co')) return
  // Ne pas cacher les API routes
  if (url.pathname.startsWith('/api/')) return
  // Ne pas cacher les pages (navigation)
  if (request.mode === 'navigate') return
  // Ne pas cacher les websockets
  if (request.mode === 'websocket') return

  // Seulement cacher les assets statiques _next/static
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
        })
      )
    )
  }
})

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  }
})
