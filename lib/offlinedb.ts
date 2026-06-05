// lib/offlineDb.ts — IndexedDB via idb
import { openDB, DBSchema, IDBPDatabase } from 'idb'

interface MaintaFoodDB extends DBSchema {
  equipments: {
    key: string
    value: any
    indexes: { 'by-org': string; 'by-zone': string }
  }
  interventions: {
    key: string
    value: any
    indexes: { 'by-org': string; 'by-equipment': string; 'by-status': string }
  }
  preventive_plans: {
    key: string
    value: any
    indexes: { 'by-org': string; 'by-equipment': string }
  }
  preventive_upcoming: {
    key: string
    value: any
    indexes: { 'by-org': string }
  }
  pending_writes: {
    key: string
    value: {
      id: string
      table: string
      operation: 'insert' | 'update' | 'delete'
      payload: any
      created_at: string // timestamp local pour first-write-wins
      synced: boolean
    }
    indexes: { 'by-synced': number; 'by-created': string }
  }
  meta: {
    key: string
    value: { key: string; value: any }
  }
}

let dbInstance: IDBPDatabase<MaintaFoodDB> | null = null

export async function getDB(): Promise<IDBPDatabase<MaintaFoodDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB<MaintaFoodDB>('maintafood-offline', 1, {
    upgrade(db) {
      // Equipments
      const eqStore = db.createObjectStore('equipments', { keyPath: 'id' })
      eqStore.createIndex('by-org', 'organization_id')
      eqStore.createIndex('by-zone', 'zone')

      // Interventions
      const intStore = db.createObjectStore('interventions', { keyPath: 'id' })
      intStore.createIndex('by-org', 'organization_id')
      intStore.createIndex('by-equipment', 'equipment_id')
      intStore.createIndex('by-status', 'status')

      // Preventive plans
      const prevStore = db.createObjectStore('preventive_plans', { keyPath: 'id' })
      prevStore.createIndex('by-org', 'organization_id')
      prevStore.createIndex('by-equipment', 'equipment_id')

      // Preventive upcoming
      const upStore = db.createObjectStore('preventive_upcoming', { keyPath: 'id' })
      upStore.createIndex('by-org', 'organization_id')

      // Pending writes queue
      const pwStore = db.createObjectStore('pending_writes', { keyPath: 'id' })
      pwStore.createIndex('by-synced', 'synced')
      pwStore.createIndex('by-created', 'created_at')

      // Meta
      db.createObjectStore('meta', { keyPath: 'key' })
    },
  })

  return dbInstance
}

// ─── CACHE HELPERS ───────────────────────────────────────────
export const offlineCache = {
  // Sauvegarder des données en cache
  saveEquipments: async (items: any[]) => {
    const db = await getDB()
    const tx = db.transaction('equipments', 'readwrite')
    await Promise.all(items.map(item => tx.store.put(item)))
    await tx.done
    await offlineCache.setMeta('equipments_cached_at', new Date().toISOString())
  },

  saveInterventions: async (items: any[]) => {
    const db = await getDB()
    const tx = db.transaction('interventions', 'readwrite')
    await Promise.all(items.map(item => tx.store.put(item)))
    await tx.done
    await offlineCache.setMeta('interventions_cached_at', new Date().toISOString())
  },

  savePreventivePlans: async (items: any[]) => {
    const db = await getDB()
    const tx = db.transaction('preventive_plans', 'readwrite')
    await Promise.all(items.map(item => tx.store.put(item)))
    await tx.done
  },

  savePreventiveUpcoming: async (items: any[]) => {
    const db = await getDB()
    const tx = db.transaction('preventive_upcoming', 'readwrite')
    // Clear old data first
    await tx.store.clear()
    await Promise.all(items.map(item => tx.store.put(item)))
    await tx.done
  },

  // Lire depuis le cache
  getEquipments: async (): Promise<any[]> => {
    const db = await getDB()
    return db.getAll('equipments')
  },

  getInterventions: async (): Promise<any[]> => {
    const db = await getDB()
    const all = await db.getAll('interventions')
    return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  },

  getPreventivePlans: async (equipmentId?: string): Promise<any[]> => {
    const db = await getDB()
    if (equipmentId) {
      return db.getAllFromIndex('preventive_plans', 'by-equipment', equipmentId)
    }
    return db.getAll('preventive_plans')
  },

  getPreventiveUpcoming: async (): Promise<any[]> => {
    const db = await getDB()
    const all = await db.getAll('preventive_upcoming')
    return all.sort((a, b) => new Date(a.next_due_at).getTime() - new Date(b.next_due_at).getTime())
  },

  // Meta
  setMeta: async (key: string, value: any) => {
    const db = await getDB()
    await db.put('meta', { key, value })
  },

  getMeta: async (key: string): Promise<any> => {
    const db = await getDB()
    const record = await db.get('meta', key)
    return record?.value
  },
}

// ─── PENDING WRITES ──────────────────────────────────────────
export const pendingWrites = {
  // Ajouter une écriture en attente
  add: async (table: string, operation: 'insert' | 'update' | 'delete', payload: any): Promise<string> => {
    const db = await getDB()
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const created_at = new Date().toISOString()
    await db.put('pending_writes', { id, table, operation, payload, created_at, synced: false })
    return id
  },

  // Récupérer toutes les écritures non synchronisées (triées par date)
  getPending: async () => {
    const db = await getDB()
    const all = await db.getAllFromIndex('pending_writes', 'by-synced', 0)
    return all.sort((a, b) => a.created_at.localeCompare(b.created_at)) // first-write-wins
  },

  // Marquer comme synchronisé
  markSynced: async (id: string) => {
    const db = await getDB()
    const item = await db.get('pending_writes', id)
    if (item) await db.put('pending_writes', { ...item, synced: true })
  },

  // Supprimer les anciens synced
  cleanup: async () => {
    const db = await getDB()
    const synced = await db.getAllFromIndex('pending_writes', 'by-synced', 1)
    const tx = db.transaction('pending_writes', 'readwrite')
    await Promise.all(synced.map(item => tx.store.delete(item.id)))
    await tx.done
  },

  // Compter les en attente
  count: async (): Promise<number> => {
    const db = await getDB()
    const pending = await db.getAllFromIndex('pending_writes', 'by-synced', 0)
    return pending.length
  },
}

// ─── DÉTECTION RÉSEAU ────────────────────────────────────────
export const networkStatus = {
  isOnline: (): boolean => typeof navigator !== 'undefined' ? navigator.onLine : true,

  onChange: (cb: (online: boolean) => void) => {
    if (typeof window === 'undefined') return () => {}
    const onOnline = () => cb(true)
    const onOffline = () => cb(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  },
}
