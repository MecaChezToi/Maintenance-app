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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const keepAliveRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Keep-alive : ping toutes les 4 min ──────────────────
  const startKeepAlive = () => {
    if (keepAliveRef.current) clearInterval(keepAliveRef.current)
    keepAliveRef.current = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) return
      const exp = currentSession.expires_at || 0
      const now = Math.floor(Date.now() / 1000)
      // Rafraîchir si le token expire dans moins de 30 minutes
      if (exp - now < 30 * 60) {
        const { data, error } = await supabase.auth.refreshSession()
        if (error) {
          console.warn('[Auth] Échec rafraîchissement — nettoyage')
          clearAllTokens()
        } else if (data.session) {
          setSession(data.session)
          console.log('[Auth] ✅ Token rafraîchi')
        }
      }
    }, 4 * 60 * 1000) // toutes les 4 minutes
  }

  const stopKeepAlive = () => {
    if (keepAliveRef.current) {
      clearInterval(keepAliveRef.current)
      keepAliveRef.current = null
    }
  }

  const loadProfile = async (userId: string, accessToken: string) => {
    // Cache immédiat
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
        startKeepAlive() // Démarrer le keep-alive dès que connecté
        return
      }
      // Profil manquant
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
    let initialized = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setOrganization(null)
        sessionStorage.clear()
        stopKeepAlive()
        Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
        setLoading(false)
        return
      }
      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] Token rafraîchi')
        if (session) setSession(session)
        return
      }

      // Skip si getSession() n'a pas encore initialisé
      if (!initialized) return

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

    // getSession() = seul point d'initialisation
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      initialized = true

      if (error) {
        console.warn('[Auth] Session invalide, nettoyage...')
        Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
        sessionStorage.clear()
        setLoading(false)
        return
      }
      if (session?.user) {
        setSession(session)
        await loadProfile(session.user.id, session.access_token)
      }
      setLoading(false)
    }).catch(() => {
      initialized = true
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  const signOut = async () => {
    stopKeepAlive()
    await supabase.auth.signOut()
    setUser(null)
    setOrganization(null)
    setSession(null)
    sessionStorage.clear()
  }

  return (
    <AuthContext.Provider value={{ user, organization, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
