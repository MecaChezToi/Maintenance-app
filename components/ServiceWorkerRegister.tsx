// components/ServiceWorkerRegister.tsx
// Service Worker désactivé — cause des problèmes de cache
'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Désinstaller tous les Service Workers existants
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(reg => {
          reg.unregister()
          console.log('[SW] Désinstallé')
        })
      })
    }
  }, [])

  return null
}
