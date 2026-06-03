// lib/DataStore.tsx — Store global centralisé
// Les données sont chargées UNE SEULE FOIS et partagées entre toutes les pages
// Plus de rechargement à chaque navigation
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

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes — pas de rechargement avant ça

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DataState>({
    interventions: [], equipments: [], technicians: [], parts: [],
    siteConfig: null, loading: true, lastLoad: null,
  })
  const loadingRef = useRef(false)

  const reload = useCallback(async (force = false) => {
    // Ne pas recharger si données récentes (sauf force)
    if (!force && state.lastLoad && Date.now() - state.lastLoad < CACHE_TTL) return
    if (loadingRef.current) return
    loadingRef.current = true

    try {
      // 1. Interventions d'abord — visible immédiatement
      const interventions = await interventionsApi.getAll()
      setState(s => ({ ...s, interventions, loading: false, lastLoad: Date.now() }))

      // 2. Reste en arrière-plan — ne bloque pas l'UI
      const [equipments, profiles, parts, siteConfig] = await Promise.all([
        equipmentsApi.getAll(),
        profilesApi.getAll(),
        partsApi.getAll(),
        siteConfigApi.get(),
      ])
      setState(s => ({
        ...s,
        equipments,
        technicians: profiles.filter(p => p.role === 'technician'),
        parts,
        siteConfig,
      }))
    } catch (e) {
      console.error('[DataStore] Erreur chargement:', e)
      setState(s => ({ ...s, loading: false }))
    } finally {
      loadingRef.current = false
    }
  }, [state.lastLoad])

  // Rechargement interventions seules (après action)
  const reloadInterventions = useCallback(async () => {
    try {
      const interventions = await interventionsApi.getAll()
      setState(s => ({ ...s, interventions }))
    } catch {}
  }, [])

  // Mise à jour optimiste locale
  const updateIntervention = useCallback((id: string, updates: Partial<Intervention>) => {
    setState(s => ({
      ...s,
      interventions: s.interventions.map(i => i.id === id ? { ...i, ...updates } : i)
    }))
  }, [])

  const addIntervention = useCallback((interv: Intervention) => {
    setState(s => ({ ...s, interventions: [interv, ...s.interventions] }))
  }, [])

  // Chargement initial
  useEffect(() => { reload(true) }, [])

  return (
    <DataContext.Provider value={{ ...state, reload, reloadInterventions, updateIntervention, addIntervention }}>
      {children}
    </DataContext.Provider>
  )
}

export const useData = () => useContext(DataContext)
