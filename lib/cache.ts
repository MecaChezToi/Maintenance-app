// ============================================================
// lib/cache.ts — Cache mémoire léger pour réduire les appels Supabase
// Importez les fonctions cachées à la place de supabase.ts
// ============================================================

type CacheEntry<T> = { data: T; ts: number }
const store = new Map<string, CacheEntry<any>>()

const TTL = {
  equipments: 60_000,   // 1 min — change rarement
  parts:      60_000,   // 1 min
  profiles:   120_000,  // 2 min
  siteConfig: 300_000,  // 5 min — change très rarement
  interventions: 15_000 // 15s — change souvent
}

function get<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > (TTL as any)[key.split(':')[0]] ?? 30_000) {
    store.delete(key)
    return null
  }
  return entry.data
}

function set<T>(key: string, data: T): T {
  store.set(key, { data, ts: Date.now() })
  return data
}

export function invalidate(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

// ─── API AVEC CACHE ──────────────────────────────────────────
import {
  equipmentsApi as _eq,
  partsApi as _parts,
  profilesApi as _profiles,
  interventionsApi as _int,
  siteConfigApi as _cfg,
  organizationsApi as _org,
} from '@/lib/supabase'
import type { Equipment, Part, Profile, Intervention, SiteConfig, Organization } from '@/types'

export const cachedEquipments = {
  getAll: async (): Promise<Equipment[]> => {
    const cached = get<Equipment[]>('equipments:all')
    if (cached) return cached
    const data = await _eq.getAll()
    return set('equipments:all', data)
  },
  invalidate: () => invalidate('equipments'),
}

export const cachedParts = {
  getAll: async (): Promise<Part[]> => {
    const cached = get<Part[]>('parts:all')
    if (cached) return cached
    const data = await _parts.getAll()
    return set('parts:all', data)
  },
  invalidate: () => invalidate('parts'),
}

export const cachedProfiles = {
  getAll: async (): Promise<Profile[]> => {
    const cached = get<Profile[]>('profiles:all')
    if (cached) return cached
    const data = await _profiles.getAll()
    return set('profiles:all', data)
  },
  invalidate: () => invalidate('profiles'),
}

export const cachedInterventions = {
  getAll: async (): Promise<Intervention[]> => {
    const cached = get<Intervention[]>('interventions:all')
    if (cached) return cached
    const data = await _int.getAll()
    return set('interventions:all', data)
  },
  invalidate: () => invalidate('interventions'),
}

export const cachedSiteConfig = {
  get: async (): Promise<SiteConfig | null> => {
    const cached = get<SiteConfig>('siteConfig:main')
    if (cached) return cached
    const data = await _cfg.get()
    if (data) set('siteConfig:main', data)
    return data
  },
  invalidate: () => invalidate('siteConfig'),
}

export const cachedOrg = {
  get: async (): Promise<Organization | null> => {
    const cached = get<Organization>('profiles:org')
    if (cached) return cached
    const data = await _org.getCurrent()
    if (data) set('profiles:org', data)
    return data
  },
  invalidate: () => invalidate('profiles:org'),
}
