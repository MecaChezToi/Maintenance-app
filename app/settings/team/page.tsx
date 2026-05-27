'use client'

import { useEffect, useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/components/layout/AuthProvider'
import { supabase } from '@/lib/supabase'

type TeamMember = {
  id: string
  name: string
  role: 'admin' | 'manager' | 'technician'
  organization_id: string
}

export default function TeamSettingsPage() {
  const { user } = useAuth()

  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  const loadMembers = async () => {
    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name')

      if (error) throw error

      setMembers(data || [])
    } catch (e: any) {
      setError(e.message || 'Impossible de charger les membres.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  const updateRole = async (
    userId: string,
    role: 'admin' | 'manager' | 'technician'
  ) => {
    if (!isAdmin) return

    setSaving(userId)
    setError(null)

    try {
      const member = members.find(m => m.id === userId)

      if (!member) return

      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('user_id', userId)
        .eq('organization_id', member.organization_id)

      if (error) throw error

      setMembers(prev =>
        prev.map(m =>
          m.id === userId
            ? { ...m, role }
            : m
        )
      )

      setToast('Rôle mis à jour')

      setTimeout(() => {
        setToast(null)
      }, 3000)

    } catch (e: any) {
      setError(e.message || 'Impossible de modifier le rôle.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <AppLayout>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999,
            background: '#00c896',
            color: '#000',
            padding: '10px 18px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            boxShadow: '0 8px 24px rgba(0,0,0,.35)'
          }}
        >
          ✓ {toast}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 18
        }}
      >
        <div>
          <div className="page-title">Équipe</div>
          <div className="page-sub">
            Gestion des utilisateurs et des rôles
          </div>
        </div>
      </div>

      {!isAdmin && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'rgba(255,71,87,.08)',
            border: '1px solid rgba(255,71,87,.25)',
            color: '#ff4757',
            fontSize: 13,
            marginBottom: 16
          }}
        >
          Accès réservé aux administrateurs.
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'rgba(255,71,87,.08)',
            border: '1px solid rgba(255,71,87,.25)',
            color: '#ff4757',
            fontSize: 13,
            marginBottom: 16
          }}
        >
          {error}
        </div>
      )}

      <div className="card">
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
            fontSize: 15,
            fontWeight: 700
          }}
        >
          Membres de l'organisation
        </div>

        <div style={{ padding: 18 }}>
          {loading ? (
            <div
              style={{
                color: 'var(--t2)',
                fontSize: 13
              }}
            >
              Chargement...
            </div>
          ) : members.length === 0 ? (
            <div className="empty-state">
              <span>Aucun utilisateur</span>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}
            >
              {members.map(member => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,.02)',
                    border: '1px solid rgba(255,255,255,.04)'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600
                      }}
                    >
                      {member.name || 'Utilisateur'}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--t3)',
                        marginTop: 4,
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {member.id}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}
                  >
                    <select
                      className="form-select"
                      disabled={!isAdmin || saving === member.id}
                      value={member.role}
                      onChange={e =>
                        updateRole(
                          member.id,
                          e.target.value as
                            | 'admin'
                            | 'manager'
                            | 'technician'
                        )
                      }
                      style={{
                        minWidth: 160
                      }}
                    >
                      <option value="admin">
                        Admin
                      </option>

                      <option value="manager">
                        Manager
                      </option>

                      <option value="technician">
                        Technicien
                      </option>
                    </select>

                    {saving === member.id && (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--t2)'
                        }}
                      >
                        Sauvegarde...
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}