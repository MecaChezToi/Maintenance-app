'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/components/layout/AuthProvider'
import { siteConfigApi } from '@/lib/supabase'
import type { SiteConfig } from '@/types'

export default function SettingsPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<SiteConfig | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = user?.role === 'admin'

  useEffect(() => { siteConfigApi.get().then(setConfig) }, [])

  const save = async () => {
    if (!config || !isAdmin) return
    setSaving(true)
    setError(null)
    try {
      await siteConfigApi.update({ name: config.name, address: config.address, siret: config.siret, certifications: config.certifications })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      setError(e.message || 'Impossible de sauvegarder les parametres.')
    } finally {
      setSaving(false)
    }
  }

  const s = (k: keyof SiteConfig, v: string) => setConfig(c => c ? { ...c, [k]: v } : c)

  return (
    <AppLayout>
      <div className="page-title">Paramètres</div>
      <div className="page-sub">Configuration de la plateforme FixOps</div>

      <div className="grid-2" style={!isAdmin ? { gridTemplateColumns: '1fr' } : undefined}>
        {isAdmin && <div className="card">
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>⚙️ Informations du site</div>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {config ? <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Nom du site</label>
                <input className="form-input" value={config.name} onChange={e => s('name', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Adresse</label>
                <input className="form-input" value={config.address || ''} onChange={e => s('address', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">SIRET</label>
                <input className="form-input" value={config.siret || ''} onChange={e => s('siret', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Certifications</label>
                <input className="form-input" value={config.certifications || ''} onChange={e => s('certifications', e.target.value)} placeholder="ex: IFS Food v8 · BRC · ISO 22000" />
              </div>
              {saved && <div style={{ padding: '8px 12px', background: 'rgba(0,208,216,.08)', border: '1px solid rgba(0,208,216,.2)', borderRadius: 6, fontSize: 13, color: '#00d0d8' }}>✅ Sauvegardé !</div>}
              {error && <div style={{ padding: '8px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 6, fontSize: 13, color: '#ff4757' }}>{error}</div>}
              <button onClick={save} disabled={saving} style={{ background: '#00d0d8', color: '#000', border: 'none', borderRadius: 6, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                {saving ? 'Sauvegarde...' : '✓ Sauvegarder'}
              </button>
            </> : <div style={{ color: 'var(--t2)', fontSize: 13 }}>Chargement…</div>}
          </div>
        </div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🛡️ Sécurité & Conformité</div>
              {[
                'Authentification sécurisée via Supabase Auth',
                'Données chiffrées en transit (HTTPS)',
                'Row Level Security — chaque utilisateur voit ses données',
                'Journal d\'audit horodaté non modifiable',
                'Hébergement Europe (Ireland West)',
                'Conformité RGPD applicable',
              ].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#00d0d8', flexShrink: 0, marginTop: 1 }}>✓</span>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>📱 Installation PWA</div>
              <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7, marginBottom: 12 }}>
                Sur Android Chrome : menu ⋮ → "Ajouter à l'écran d'accueil". L'app s'ouvre en plein écran comme une application native.
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--t3)', lineHeight: 1.8 }}>
                URL de déploiement :<br/>
                <span style={{ color: '#00d0d8' }}>https://votre-app.vercel.app</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ border: '1px solid rgba(0,208,216,.15)', background: 'rgba(0,208,216,.03)' }}>
            <div style={{ padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00d0d8', marginBottom: 8 }}>Version</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[['FixOps GMAO','v1.0.0'],['Next.js','14.x'],['Supabase','2.x'],['Base de données','PostgreSQL 15']].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--t2)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--t1)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
