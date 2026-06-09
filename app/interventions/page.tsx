'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'

export default function AuthPage() {
  const { signIn, user, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard')
  }, [user, loading, router])

  const handleLogin = async () => {
    if (!email || !password) { setError('Remplissez tous les champs.'); return }
    setSigningIn(true)
    setError('')
    try {
      const result = await signIn(email, password)
      const err = result?.error ?? null
      if (err) {
        const msg = typeof err === 'string' ? err : (err as any)?.message ?? ''
        if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password')) {
          setError('Email ou mot de passe incorrect.')
        } else if (msg.toLowerCase().includes('email')) {
          setError('Adresse email non reconnue.')
        } else if (msg) {
          setError(`Erreur : ${msg}`)
        } else {
          setError('Connexion impossible. Vérifiez vos identifiants.')
        }
        setSigningIn(false)
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erreur inattendue. Réessayez.')
      setSigningIn(false)
    }
  }

  if (!loading && user) return null

  return (
    <div className="auth" style={{ background: '#080909' }}>
      <div style={{ position: 'fixed', top: -200, left: -200, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,200,150,.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -150, right: 200, width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(120,60,220,.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          <div style={{ marginBottom: 32 }}>
            <img src="/logo.png" alt="MaintaFood" style={{ height: 48, objectFit: 'contain', objectPosition: 'left' }} />
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 8, fontFamily: 'var(--font-mono)', letterSpacing: '2px', textTransform: 'uppercase' }}>
              GMAO · Industrie Alimentaire
            </div>
          </div>
          <p style={{ color: '#9ca3af', maxWidth: 520, fontSize: 15, lineHeight: 1.7, marginBottom: 26 }}>
            Réduisez les arrêts de ligne, simplifiez vos audits HACCP et centralisez votre maintenance sur une seule plateforme moderne.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Conformité IFS Food v8 · BRC · ISO 22000',
              'Rapports signés et horodatés',
              'KPIs de maintenance en temps réel',
              'Traçabilité complète pour les audits',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(0,200,150,.12)', background: 'rgba(0,200,150,.04)' }}>
                <span style={{ width: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: 'rgba(0,200,150,.15)', color: '#00d0d8', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: '#cbd5e1' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-box" style={{ border: '1px solid rgba(0,200,150,.1)', boxShadow: '0 0 60px rgba(0,200,150,.05)' }}>
          <div style={{ marginBottom: 22, display: 'flex', justifyContent: 'center' }}>
            <img src="/icon-192.png" alt="MaintaFood" style={{ height: 52, width: 52, objectFit: 'contain', borderRadius: 14 }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>Connexion</div>
          <div style={{ fontSize: 12.5, color: 'var(--t2)', marginBottom: 24, textAlign: 'center' }}>
            Connectez-vous à votre espace MaintaFood.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Email</label>
              <input
                className="form-input" type="email" placeholder="votre@email.fr"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="email"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Mot de passe</label>
              <input
                className="form-input" type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.2)', color: '#ff4757', fontSize: 13 }}>
                <span style={{ flexShrink: 0 }}>⚠</span> {error}
              </div>
            )}

            <button className="btn btn-primary" onClick={handleLogin} disabled={signingIn}
              style={{ opacity: signingIn ? .7 : 1, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {signingIn
                ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(0,0,0,.3)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin .7s linear infinite' }} /> Connexion en cours…</>
                : 'Se connecter →'}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
