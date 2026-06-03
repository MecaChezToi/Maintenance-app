// public/sw.js — Service Worker MaintaFood
const CACHE_NAME = 'maintafood-v1'
const STATIC_CACHE = 'maintafood-static-v1'

// Fichiers à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/interventions',
  '/plan',
  '/store',
  '/manifest.json',
]

// Installation — cache les assets statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {})
    }).then(() => self.skipWaiting())
  )
})

// Activation — nettoyer les anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Stratégie : Network First avec fallback cache
// Pour les pages → stale-while-revalidate
// Pour les assets → cache first
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorer les requêtes Supabase (pas de cache côté SW)
  if (url.hostname.includes('supabase.co')) return
  // Ignorer les requêtes API Next.js
  if (url.pathname.startsWith('/api/')) return
  // Ignorer les websockets
  if (request.mode === 'websocket') return

  // Assets statiques (_next/) → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Pages → Stale While Revalidate
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const networkFetch = fetch(request).then(response => {
            if (response.ok) cache.put(request, response.clone())
            return response
          }).catch(() => cached)
          // Retourner le cache immédiatement si disponible
          return cached || networkFetch
        })
      )
    )
    return
  }

  // Tout le reste → Network avec fallback cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// Message pour forcer le refresh du cache
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  }
})
