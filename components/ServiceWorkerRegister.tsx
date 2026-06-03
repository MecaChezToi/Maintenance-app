// components/ServiceWorkerRegister.tsx
// À ajouter dans app/layout.tsx
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[SW] Enregistré', reg.scope)
          // Vérifier les mises à jour toutes les 60s
          setInterval(() => reg.update(), 60_000)
        })
        .catch(err => console.warn('[SW] Erreur:', err))
    }
  }, [])

  return null
}
