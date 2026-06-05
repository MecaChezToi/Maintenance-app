'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
import { supabase, profilesApi, organizationsApi } from '@/lib/supabase'
import type { Profile, Organization } from '@/types'

interface AuthContextType {
  user: Profile | null
  organization: Organization | null
  session: any
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, organization: null, session: null, loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
})

// Nettoyer tous les tokens Supabase
const clearAllTokens = () => {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
    sessionStorage.clear()
  } catch {}
}

// Vérifier si un token est expiré
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

// Vérifier et nettoyer les tokens expirés au démarrage
const checkAndCleanExpiredTokens = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const data = JSON.parse(raw)
      const accessToken = data?.access_token
      if (accessToken && isTokenExpired(accessToken)) {
        console.log('[Auth] Token expiré détecté — nettoyage automatique')
        clearAllTokens()
        return true // token était expiré
      }
    }
  } catch {}
  return false
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null)

  const startKeepAlive = () => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    keepAliveRef.current = setInterval(() => {
      supabase.from('profiles').select('id').limit(1).then(() => {}, () => {})
    }, 4 * 60 * 1000)
  }

  const stopKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }

  const loadProfile = async (userId: string, accessToken: string) => {
    try {
      const cached = sessionStorage.getItem(`profile:${userId}`)
      if (cached) setUser(JSON.parse(cached))
      const cachedOrg = sessionStorage.getItem(`org:${userId}`)
      if (cachedOrg) setOrganization(JSON.parse(cachedOrg))
    } catch {}

    try {
      const profile = await profilesApi.getById(userId)
      if (profile) {
        sessionStorage.setItem(`profile:${userId}`, JSON.stringify(profile))
        setUser(profile)
        const org = await organizationsApi.getCurrent()
        if (org) {
          sessionStorage.setItem(`org:${userId}`, JSON.stringify(org))
          setOrganization(org)
        }
        startKeepAlive()
        return
      }
      const res = await fetch('/api/profile/ensure', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const ensured = await res.json()
        if (ensured?.id) {
          sessionStorage.setItem(`profile:${userId}`, JSON.stringify(ensured))
          setUser(ensured)
          startKeepAlive()
        }
      }
    } catch (e) {
      console.warn('[Auth] Erreur chargement profil:', e)
    }
  }

  useEffect(() => {
    // Nettoyer les tokens expirés dès le démarrage
    checkAndCleanExpiredTokens()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setOrganization(null)
        clearAllTokens()
        stopKeepAlive()
        setLoading(false)
        return
      }
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] ✅ Token rafraîchi')
      }
      setSession(session)
      if (session?.user) {
        await loadProfile(session.user.id, session.access_token)
      } else {
        setUser(null)
        setOrganization(null)
        sessionStorage.clear()
        stopKeepAlive()
      }
      setLoading(false)
    })

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.warn('[Auth] Erreur session:', error.message)
        clearAllTokens()
        setLoading(false)
        return
      }
      if (session?.user) {
        setSession(session)
        await loadProfile(session.user.id, session.access_token)
      }
      setLoading(false)
    }).catch(() => {
      // Erreur réseau — conserver le token
      setLoading(false)
    })

    const t = setTimeout(() => setLoading(false), 4000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(t)
      stopKeepAlive()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    // Toujours nettoyer avant de se connecter
    clearAllTokens()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  const signOut = async () => {
    stopKeepAlive()
    await supabase.auth.signOut()
    setUser(null)
    setOrganization(null)
    setSession(null)
    clearAllTokens()
  }

  return (
    <AuthContext.Provider value={{ user, organization, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
