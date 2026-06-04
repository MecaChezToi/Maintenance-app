// app/eq/[id]/page.tsx — Page de scan QR code équipement
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { equipmentsApi, interventionsApi } from '@/lib/supabase'
import { useAuth } from '@/components/layout/AuthProvider'
import { EQ_STATUS_CONFIG } from '@/types'
import type { Equipment } from '@/types'

const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

export default function EquipmentScanPage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showNewOT, setShowNewOT] = useState(false)
  const [otTitle, setOtTitle] = useState('')
  const [otDesc, setOtDesc] = useState('')

  useEffect(() => {
    if (!id) return
    equipmentsApi.getById(id as string).then(eq => {
      setEquipment(eq)
      setLoading(false)
    })
  }, [id])

  const createIntervention = async () => {
    if (!user || !equipment || !otTitle.trim()) return
    setCreating(true)
    try {
      await interventionsApi.create({
        title: otTitle,
        description: otDesc,
        equipment_id: equipment.id,
        technician_id: user.id,
        created_by: user.id,
        priority: 'normale',
        status: 'a_faire',
        organization_id: user.organization_id,
      })
      router.push('/interventions')
    } finally {
      setCreating(false)
    }
  }

  if (loading || authLoading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080909' }}>
      <div style={{ color: '#00c896', fontFamily: 'var(--font-mono)', fontSize: 13 }}>Chargement…</div>
    </div>
  )

  if (!user) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#080909', padding: 24, gap: 16 }}>
        <div style={{ fontSize: 40 }}>⚙️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Connexion requise</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', textAlign: 'center' }}>Connectez-vous pour accéder à la fiche machine.</div>
        <button onClick={() => router.push('/auth')} style={{ padding: '10px 24px', background: '#00c896', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
          Se connecter
        </button>
      </div>
    )
  }

  if (!equipment) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080909' }}>
      <div style={{ color: 'var(--t2)', fontSize: 13 }}>Équipement introuvable.</div>
    </div>
  )

  const statusCfg = EQ_STATUS_CONFIG[equipment.status]
  const inspectionOverdue = equipment.next_inspection && new Date(equipment.next_inspection) < new Date()

  return (
    <div style={{ minHeight: '100dvh', background: '#080909', fontFamily: 'var(--font-outfit)', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: '#0f1012', borderBottom: '1px solid rgba(255,255,255,.06)', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '5px 10px', fontSize: 13 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px' }}>Fiche machine · Scan QR</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>MaintaFood</div>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '5px 10px', fontSize: 12 }}>Dashboard</button>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* Statut bannière */}
        <div style={{ padding: '10px 14px', background: `${statusCfg.color}14`, border: `1px solid ${statusCfg.color}33`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusCfg.color, flexShrink: 0 }} />
          <span style={{ fontWeight: 600, color: statusCfg.color, fontSize: 13 }}>{statusCfg.label}</span>
          {equipment.food_safe && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#00c896', background: 'rgba(0,200,150,.12)', padding: '2px 8px', borderRadius: 10 }}>✓ Alimentaire</span>}
        </div>

        {/* Infos principales */}
        <div style={{ background: '#0f1012', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{equipment.name}</div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>{equipment.location || '—'} · Zone {equipment.zone || '—'}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'N° série', value: equipment.serial || '—' },
              { label: 'Catégorie', value: equipment.category || '—' },
              { label: 'Dernière inspection', value: fmt(equipment.last_inspection) },
              { label: 'Prochaine inspection', value: fmt(equipment.next_inspection) },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--t3)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {inspectionOverdue && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.2)', borderRadius: 8, fontSize: 12, color: '#ff4757' }}>
              ⚠️ Inspection en retard — action requise
            </div>
          )}
        </div>

        {/* Description */}
        {equipment.schema_desc && (
          <div style={{ background: '#0f1012', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--t3)', marginBottom: 8 }}>Description</div>
            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{equipment.schema_desc}</div>
          </div>
        )}

        {/* Créer intervention */}
        {!showNewOT ? (
          <button
            onClick={() => setShowNewOT(true)}
            style={{ width: '100%', padding: '14px', background: '#00c896', color: '#000', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: 'pointer', marginBottom: 10 }}
          >
            📝 Créer une intervention
          </button>
        ) : (
          <div style={{ background: '#0f1012', border: '1px solid rgba(0,200,150,.2)', borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Nouvelle intervention</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                placeholder="Titre de l'intervention *"
                value={otTitle}
                onChange={e => setOtTitle(e.target.value)}
                style={{ padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 14, outline: 'none' }}
              />
              <textarea
                placeholder="Description (optionnel)"
                value={otDesc}
                onChange={e => setOtDesc(e.target.value)}
                rows={3}
                style={{ padding: '10px 12px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13, outline: 'none', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowNewOT(false)} style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'var(--t2)', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button onClick={createIntervention} disabled={creating || !otTitle.trim()} style={{ flex: 2, padding: '10px', background: creating ? 'rgba(0,200,150,.4)' : '#00c896', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  {creating ? 'Création…' : 'Créer →'}
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/plan')}
          style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}
        >
          Voir sur le plan du site
        </button>
      </div>
    </div>
  )
}
