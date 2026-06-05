// lib/syncManager.ts — Synchronisation offline → Supabase
import { pendingWrites, offlineCache, networkStatus } from './offlineDb'
import { supabase } from './supabase'

let isSyncing = false
let syncCallbacks: Array<(count: number) => void> = []

export const syncManager = {
  // Écouter les changements du nombre de pending writes
  onPendingChange: (cb: (count: number) => void) => {
    syncCallbacks.push(cb)
    return () => { syncCallbacks = syncCallbacks.filter(c => c !== cb) }
  },

  notifyPending: async () => {
    const count = await pendingWrites.count()
    syncCallbacks.forEach(cb => cb(count))
  },

  // Synchroniser toutes les écritures en attente
  sync: async (): Promise<{ synced: number; errors: number }> => {
    if (isSyncing || !networkStatus.isOnline()) return { synced: 0, errors: 0 }
    isSyncing = true

    let synced = 0
    let errors = 0

    try {
      const pending = await pendingWrites.getPending()
      console.log(`[Sync] ${pending.length} écritures en attente`)

      for (const write of pending) {
        try {
          await syncManager.applyWrite(write)
          await pendingWrites.markSynced(write.id)
          synced++
        } catch (e: any) {
          console.error(`[Sync] Erreur sur ${write.table}:`, e.message)
          errors++
        }
      }

      await pendingWrites.cleanup()
      await syncManager.notifyPending()
      console.log(`[Sync] ✅ ${synced} synchronisés, ${errors} erreurs`)
    } finally {
      isSyncing = false
    }

    return { synced, errors }
  },

  // Appliquer une écriture individuelle sur Supabase
  applyWrite: async (write: any) => {
    const { table, operation, payload } = write

    if (operation === 'insert') {
      // First-write-wins: vérifier si existe déjà
      const { data: existing } = await supabase
        .from(table).select('id, created_at').eq('id', payload.id).single()

      if (existing) {
        // Comparer les timestamps — garder le plus ancien
        const existingTime = new Date(existing.created_at).getTime()
        const localTime = new Date(write.created_at).getTime()
        if (localTime < existingTime) {
          // Notre version est plus ancienne → on écrase
          const { error } = await supabase.from(table).update(payload).eq('id', payload.id)
          if (error) throw error
        }
        // Sinon on garde la version serveur
        return
      }

      const { error } = await supabase.from(table).insert(payload)
      if (error) throw error
    }

    if (operation === 'update') {
      const { error } = await supabase.from(table).update(payload).eq('id', payload.id)
      if (error) throw error
    }

    if (operation === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', payload.id)
      if (error) throw error
    }
  },

  // Démarrer la synchronisation automatique
  startAutoSync: () => {
    if (typeof window === 'undefined') return

    // Sync quand réseau revient
    const unsubscribe = networkStatus.onChange(async (online) => {
      if (online) {
        console.log('[Sync] Réseau rétabli — synchronisation...')
        await syncManager.sync()
      }
    })

    // Sync toutes les 30 secondes si en ligne
    const interval = setInterval(async () => {
      if (networkStatus.isOnline()) {
        const count = await pendingWrites.count()
        if (count > 0) await syncManager.sync()
      }
    }, 30000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  },
}
