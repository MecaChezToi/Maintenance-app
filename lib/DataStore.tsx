// lib/DataStore.tsx — Store global avec support offline
'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'
import { interventionsApi, equipmentsApi, profilesApi, partsApi, siteConfigApi, preventiveApi } from '@/lib/supabase'
import { offlineCache, networkStatus, pendingWrites } from '@/lib/offlineDb'
import { syncManager } from '@/lib/syncManager'
import type { Intervention, Equipment, Profile, Part, SiteConfig } from '@/types'

interface DataState {
  interventions: Intervention[]
  equipments: Equipment[]
  technicians: Profile[]
  parts: Part[]
  siteConfig: SiteConfig | null
  loading: boolean
  lastLoad: number | null
  isOffline: boolean
}

interface DataContextType extends DataState {
  reload: (force?: boolean) => Promise<void>
  reloadInterventions: () => Promise<void>
  updateIntervention: (id: string, updates: Partial<Intervention>) => void
  addIntervention: (interv: Intervention) => void
  updateEquipment: (id: string, updates: Partial<Equipment>) => void
}

const DataContext = createContext<DataContextType>({
  interventions: [], equipments: [], technicians: [], parts: [], siteConfig: null,
  loading: true, lastLoad: null, isOffline: false,
  reload: async () => {},
  reloadInterventions: async () => {},
  updateIntervention: () => {},
  addIntervention: () => {},
  updateEquipment: () => {},
})

const CACHE_TTL = 5 * 60 * 1000
const TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
  ])
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    interventions: [], equipments: [], technicians: [], parts: [],
    siteConfig: null, loading: true, lastLoad: null, isOffline: false,
  })
  const loadingRef = useRef(false)
  const lastLoadRef = useRef<number | null>(null)

  // Charger depuis le cache IndexedDB (instant)
  const loadFromCache = useCallback(async () => {
    try {
      const [equipments, interventions] = await Promise.all([
        offlineCache.getEquipments(),
        offlineCache.getInterventions(),
      ])
      if (equipments.length > 0 || interventions.length > 0) {
        setState(s => ({
          ...s,
          equipments: equipments as Equipment[],
          interventions: interventions as Intervention[],
          loading: false,
          isOffline: !networkStatus.isOnline(),
        }))
        console.log('[DataStore] ✅ Cache offline chargé')
        return true
      }
    } catch (e) {
      console.warn('[DataStore] Cache vide ou erreur:', e)
    }
    return false
  }, [])

  // Charger depuis Supabase
  const loadFromNetwork = useCallback(async (force = false) => {
    if (!force && lastLoadRef.current && Date.now() - lastLoadRef.current < CACHE_TTL) return
    if (loadingRef.current) return
    if (!networkStatus.isOnline()) return

    loadingRef.current = true

    try {
      const [equipments, interventions, profiles, parts, siteConfig] = await Promise.all([
        withTimeout(equipmentsApi.getAll(), TIMEOUT_MS, []),
        withTimeout(interventionsApi.getAll(), TIMEOUT_MS, []),
        withTimeout(profilesApi.getAll(), TIMEOUT_MS, []),
        withTimeout(partsApi.getAll(), TIMEOUT_MS, []),
        withTimeout(siteConfigApi.get(), TIMEOUT_MS, null),
      ])

      lastLoadRef.current = Date.now()

      setState({
        equipments: equipments as Equipment[],
        interventions: interventions as Intervention[],
        technicians: (profiles as Profile[]).filter(p => p.active !== false),
        parts: parts as Part[],
        siteConfig: siteConfig as SiteConfig | null,
        loading: false,
        lastLoad: lastLoadRef.current,
        isOffline: false,
      })

      // Sauvegarder en cache offline
      if (equipments.length > 0) offlineCache.saveEquipments(equipments).catch(() => {})
      if (interventions.length > 0) offlineCache.saveInterventions(interventions).catch(() => {})

      // Lancer sync si pending writes
      const pending = await pendingWrites.count()
      if (pending > 0) syncManager.sync().catch(() => {})

    } catch (e) {
      console.error('[DataStore] Erreur réseau:', e)
      setState(s => ({ ...s, loading: false, isOffline: true }))
    } finally {
      loadingRef.current = false
    }
  }, [])

  const reload = useCallback(async (force = false) => {
    if (networkStatus.isOnline()) {
      await loadFromNetwork(force)
    } else {
      await loadFromCache()
    }
  }, [loadFromCache, loadFromNetwork])

  const reloadInterventions = useCallback(async () => {
    if (!networkStatus.isOnline()) {
      const interventions = await offlineCache.getInterventions()
      setState(s => ({ ...s, interventions: interventions as Intervention[] }))
      return
    }
    try {
      const interventions = await withTimeout(interventionsApi.getAll(), TIMEOUT_MS, [])
      setState(s => ({ ...s, interventions: interventions as Intervention[] }))
      offlineCache.saveInterventions(interventions).catch(() => {})
    } catch {}
  }, [])

  const updateIntervention = useCallback((id: string, updates: Partial<Intervention>) => {
    setState(s => ({
      ...s,
      interventions: s.interventions.map(i => i.id === id ? { ...i, ...updates } : i)
    }))
  }, [])

  const addIntervention = useCallback((interv: Intervention) => {
    setState(s => ({ ...s, interventions: [interv, ...s.interventions] }))
    // Sauvegarder en cache
    offlineCache.getInterventions().then(all => {
      offlineCache.saveInterventions([interv, ...all]).catch(() => {})
    })
  }, [])

  const updateEquipment = useCallback((id: string, updates: Partial<Equipment>) => {
    setState(s => ({
      ...s,
      equipments: s.equipments.map(e => e.id === id ? { ...e, ...updates } : e)
    }))
  }, [])

  useEffect(() => {
    // 1. Charger le cache immédiatement (affichage instantané)
    loadFromCache().then(hadCache => {
      // 2. Toujours essayer le réseau après
      loadFromNetwork(true)
    })

    // 3. Timeout de sécurité
    const t = setTimeout(() => {
      setState(s => s.loading ? { ...s, loading: false } : s)
    }, 10000)

    // 4. Sync quand réseau revient
    const unsubNetwork = networkStatus.onChange(async (online) => {
      if (online) {
        setState(s => ({ ...s, isOffline: false }))
        await loadFromNetwork(true)
      } else {
        setState(s => ({ ...s, isOffline: true }))
        await loadFromCache()
      }
    })

    return () => {
      clearTimeout(t)
      unsubNetwork()
    }
  }, [])

  return (
    <DataContext.Provider value={{ ...state, reload, reloadInterventions, updateIntervention, addIntervention, updateEquipment }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
