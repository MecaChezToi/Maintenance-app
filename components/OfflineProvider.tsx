// components/OfflineProvider.tsx — Provider global offline
'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { networkStatus, pendingWrites, offlineCache } from '@/lib/offlineDb'
import { syncManager } from '@/lib/syncManager'

interface OfflineContextType {
  isOnline: boolean
  pendingCount: number
  isSyncing: boolean
  sync: () => Promise<void>
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  sync: async () => {},
})

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // État réseau initial
    setIsOnline(networkStatus.isOnline())

    // Écouter les changements réseau
    const unsubNetwork = networkStatus.onChange(async (online) => {
      setIsOnline(online)
      if (online) {
        setIsSyncing(true)
        await syncManager.sync()
        setIsSyncing(false)
      }
    })

    // Écouter les pending writes
    const unsubPending = syncManager.onPendingChange(setPendingCount)

    // Initialiser le count
    pendingWrites.count().then(setPendingCount)

    // Démarrer l'auto-sync
    const stopAutoSync = syncManager.startAutoSync()

    return () => {
      unsubNetwork()
      unsubPending()
      stopAutoSync?.()
    }
  }, [])

  const sync = async () => {
    setIsSyncing(true)
    await syncManager.sync()
    const count = await pendingWrites.count()
    setPendingCount(count)
    setIsSyncing(false)
  }

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, sync }}>
      {/* Bannière offline */}
      {!isOnline && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#f59e0b', color: '#000',
          padding: '8px 16px', textAlign: 'center',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          📡 Hors ligne — Les données sont sauvegardées localement
        </div>
      )}

      {/* Bannière sync en cours */}
      {isOnline && isSyncing && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#3c82e8', color: '#fff',
          padding: '8px 16px', textAlign: 'center',
          fontSize: 13, fontWeight: 600,
        }}>
          🔄 Synchronisation en cours...
        </div>
      )}

      {/* Bouton sync si pending */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 9998,
        }}>
          <button onClick={sync} style={{
            background: '#f59e0b', color: '#000', border: 'none',
            borderRadius: 24, padding: '10px 16px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,.3)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            🔄 Synchroniser ({pendingCount})
          </button>
        </div>
      )}

      {children}
    </OfflineContext.Provider>
  )
}

export const useOffline = () => useContext(OfflineContext)
