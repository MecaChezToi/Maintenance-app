// components/ServiceWorkerRegister.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Enregistrer le Service Worker
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] Enregistré ✅', reg.scope)

        // Vérifier les mises à jour toutes les 60 secondes
        setInterval(() => reg.update(), 60 * 1000)

        // Activer immédiatement si une mise à jour est en attente
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage('SKIP_WAITING')
            }
          })
        })
      })
      .catch(err => console.warn('[SW] Erreur:', err))

    // Recharger quand le SW prend le contrôle
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        // Ne pas recharger automatiquement — juste logger
        console.log('[SW] Nouveau SW actif')
      }
    })
  }, [])

  return null
}
