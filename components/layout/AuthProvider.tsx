'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, profilesApi } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextType {
  user: Profile | null
  session: any
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  signIn: async () => ({ error: null }),
  signOut: async () => {},
})

// Race entre Supabase et un timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms))
  ])
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        // Race : Supabase a 3 secondes max pour répondre
        const result = await withTimeout(supabase.auth.getSession(), 3000)

        if (result === null) {
          // Timeout — on débloque sans session
          console.warn('[Auth] getSession timeout')
          setLoading(false)
          return
        }

        const { data: { session } } = result
        setSession(session)

        if (session?.user) {
          // Cache local d'abord pour affichage instantané
          const cached = sessionStorage.getItem(`profile:${session.user.id}`)
          if (cached) {
            try { setUser(JSON.parse(cached)) } catch {}
          }

          // Chargement profil avec timeout aussi
          const profile = await withTimeout(profilesApi.getById(session.user.id), 3000)
          if (profile) {
            sessionStorage.setItem(`profile:${session.user.id}`, JSON.stringify(profile))
            setUser(profile)
          }
        }
      } catch (e) {
        console.error('[Auth] Erreur init:', e)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        try {
          const profile = await withTimeout(profilesApi.getById(session.user.id), 3000)
          if (profile) {
            sessionStorage.setItem(`profile:${session.user.id}`, JSON.stringify(profile))
            setUser(profile)
          } else {
            setUser(null)
          }
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
        sessionStorage.clear()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message || null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    sessionStorage.clear()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
