// public/sw.js — MaintaFood PWA Service Worker v3
// Stratégie: Cache-first pour assets, Network-first pour données
const CACHE_NAME = 'maintafood-v3'
const OFFLINE_URL = '/offline'

// Assets à précacher au démarrage
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/dashboard',
  '/plan',
  '/interventions',
  '/preventive',
  '/manifest.json',
]

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS).catch(() => {})
    }).then(() => self.skipWaiting())
  )
})

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // ❌ Ne JAMAIS intercepter Supabase
  if (url.hostname.includes('supabase.co')) return

  // ❌ Ne pas intercepter les API routes Next.js
  if (url.pathname.startsWith('/api/')) return

  // ❌ Ne pas intercepter WebSocket
  if (request.mode === 'websocket') return

  // ✅ Assets statiques _next/static → Cache First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // ✅ Images et icons → Cache First
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|gif)$/)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        }).catch(() => new Response('', { status: 404 }))
      })
    )
    return
  }

  // ✅ Pages de navigation → Network First avec fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
        }
        return response
      }).catch(async () => {
        // Offline : retourner la page cachée ou la page offline
        const cached = await caches.match(request)
        if (cached) return cached
        const offline = await caches.match(OFFLINE_URL)
        return offline || new Response('<h1>Hors ligne</h1>', { headers: { 'Content-Type': 'text/html' } })
      })
    )
    return
  }
})

// ─── MESSAGES ────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  }
})
