// lib/DataStore.tsx — Store global centralisé v2
'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'
import { interventionsApi, equipmentsApi, profilesApi, partsApi, siteConfigApi } from '@/lib/supabase'
import type { Intervention, Equipment, Profile, Part, SiteConfig } from '@/types'

interface DataState {
  interventions: Intervention[]
  equipments: Equipment[]
  technicians: Profile[]
  parts: Part[]
  siteConfig: SiteConfig | null
  loading: boolean
  lastLoad: number | null
}

interface DataContextType extends DataState {
  reload: (force?: boolean) => Promise<void>
  reloadInterventions: () => Promise<void>
  updateIntervention: (id: string, updates: Partial<Intervention>) => void
  addIntervention: (interv: Intervention) => void
}

const DataContext = createContext<DataContextType>({
  interventions: [], equipments: [], technicians: [], parts: [], siteConfig: null,
  loading: true, lastLoad: null,
  reload: async () => {},
  reloadInterventions: async () => {},
  updateIntervention: () => {},
  addIntervention: () => {},
})

const CACHE_TTL = 5 * 60 * 1000
const TIMEOUT_MS = 8000 // 8s max par requête

// Helper: requête avec timeout
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))
  ])
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    interventions: [], equipments: [], technicians: [], parts: [],
    siteConfig: null, loading: true, lastLoad: null,
  })
  const loadingRef = useRef(false)
  const lastLoadRef = useRef<number | null>(null)

  const reload = useCallback(async (force = false) => {
    if (!force && lastLoadRef.current && Date.now() - lastLoadRef.current < CACHE_TTL) return
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      // Charger tout en parallèle avec timeout — plus rapide et plus fiable
      const [equipments, interventions, profiles, parts, siteConfig] = await Promise.all([
        withTimeout(equipmentsApi.getAll(), TIMEOUT_MS, []),
        withTimeout(interventionsApi.getAll(), TIMEOUT_MS, []),
        withTimeout(profilesApi.getAll(), TIMEOUT_MS, []),
        withTimeout(partsApi.getAll(), TIMEOUT_MS, []),
        withTimeout(siteConfigApi.get(), TIMEOUT_MS, null),
      ])

      lastLoadRef.current = Date.now()
      setState({
        equipments,
        interventions,
        technicians: (profiles as Profile[]).filter(p => p.role === 'technician'),
        parts,
        siteConfig,
        loading: false,
        lastLoad: lastLoadRef.current,
      })
    } catch (e) {
      console.error('[DataStore] Erreur:', e)
      setState(s => ({ ...s, loading: false }))
    } finally {
      loadingRef.current = false
    }
  }, [])

  const reloadInterventions = useCallback(async () => {
    try {
      const interventions = await withTimeout(interventionsApi.getAll(), TIMEOUT_MS, [])
      setState(s => ({ ...s, interventions }))
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
  }, [])

  useEffect(() => {
    reload(true)
    // Timeout de sécurité — débloquer après 10s même si Supabase ne répond pas
    const t = setTimeout(() => {
      setState(s => s.loading ? { ...s, loading: false } : s)
    }, 10000)
    return () => clearTimeout(t)
  }, [])

  return (
    <DataContext.Provider value={{ ...state, reload, reloadInterventions, updateIntervention, addIntervention }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
