// lib/offlineApi.ts — APIs avec support offline (first-write-wins)
import { networkStatus, offlineCache, pendingWrites } from '@/lib/offlineDb'
import { syncManager } from '@/lib/syncManager'
import { interventionsApi, preventiveApi, supabase } from '@/lib/supabase'
import type { Intervention } from '@/types'

// Générer un UUID v4 simple
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
})

// ─── INTERVENTIONS OFFLINE ───────────────────────────────────
export const offlineInterventionsApi = {
  create: async (payload: Partial<Intervention>): Promise<Intervention> => {
    const id = uuid()
    const now = new Date().toISOString()
    const intervention = {
      ...payload,
      id,
      created_at: now,
      updated_at: now,
      status: payload.status || 'a_faire',
    } as Intervention

    if (networkStatus.isOnline()) {
      // En ligne → Supabase directement
      try {
        const created = await interventionsApi.create(payload)
        if (created) {
          await offlineCache.saveInterventions([created])
          return created
        }
      } catch (e) {
        console.warn('[OfflineAPI] Supabase failed, saving offline')
      }
    }

    // Offline → sauvegarder localement + queue
    const cached = await offlineCache.getInterventions()
    await offlineCache.saveInterventions([intervention, ...cached])
    await pendingWrites.add('interventions', 'insert', intervention)
    await syncManager.notifyPending()

    return intervention
  },

  updateStatus: async (id: string, status: string): Promise<void> => {
    const now = new Date().toISOString()
    const update = { id, status, updated_at: now }

    if (networkStatus.isOnline()) {
      try {
        await interventionsApi.updateStatus(id, status)
        return
      } catch (e) {
        console.warn('[OfflineAPI] Supabase failed, saving offline')
      }
    }

    // Offline → queue
    await pendingWrites.add('interventions', 'update', update)
    await syncManager.notifyPending()
  },
}

// ─── PRÉVENTIF OFFLINE ───────────────────────────────────────
export const offlinePreventiveApi = {
  record: async (rec: {
    plan_id: string
    equipment_id: string
    organization_id: string
    done_by: string
    done_at?: string
    duration_min?: number
    notes?: string
  }): Promise<any> => {
    const id = uuid()
    const now = new Date().toISOString()
    const record = {
      ...rec,
      id,
      done_at: rec.done_at || now.split('T')[0],
      created_at: now,
    }

    if (networkStatus.isOnline()) {
      try {
        const created = await preventiveApi.record(rec)
        return created
      } catch (e) {
        console.warn('[OfflineAPI] Préventif Supabase failed, saving offline')
      }
    }

    // Offline → queue
    await pendingWrites.add('preventive_records', 'insert', record)
    await syncManager.notifyPending()

    // Mettre à jour le plan local
    const plans = await offlineCache.getPreventivePlans(rec.equipment_id)
    const plan = plans.find(p => p.id === rec.plan_id)
    if (plan) {
      const updatedPlan = {
        ...plan,
        last_done_at: record.done_at,
        next_due_at: new Date(new Date(record.done_at).getTime() + plan.interval_days * 86400000)
          .toISOString().split('T')[0],
      }
      await offlineCache.savePreventivePlans([updatedPlan])
    }

    return record
  },
}
