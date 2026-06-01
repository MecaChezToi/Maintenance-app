'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import LandingPage from '@/LandingPage'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Seulement rediriger si connecté — sinon afficher la landing
    if (!loading && user) {
      router.replace('/dashboard')
    }
  }, [user, loading, router])

  // Pendant le chargement : afficher la landing directement
  // plutôt qu'un spinner qui bloque
  if (loading) return <LandingPage />

  // Pas connecté → landing page
  if (!user) return <LandingPage />

  // Connecté → redirection en cours (le useEffect s'en charge)
  return <LandingPage />
}
