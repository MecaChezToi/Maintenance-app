'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/components/layout/AuthProvider'
import { preventiveApi } from '@/lib/supabase'
import type { PreventiveUpcoming, PreventiveRecord } from '@/types'
import { URGENCY_CONFIG } from '@/types'

const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtDT = (d?: string | null) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const URGENCY_ORDER = { overdue: 0, urgent: 1, soon: 2, ok: 3 }

// ─── MODAL MARQUER COMME FAIT ────────────────────────────────
function DoneModal({ item, user, onClose, onSave }: {
  item: PreventiveUpcoming
  user: any
  onClose: () => void
  onSave: () => void
}) {
  const [form, setForm] = useState({
    done_at: new Date().toISOString().split('T')[0],
    duration_min: item.estimated_minutes || 30,
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await preventiveApi.record({
        plan_id: item.id,
        equipment_id: item.equipment_id,
        organization_id: item.organization_id,
        done_by: user.id,
        done_at: form.done_at,
        duration_min: form.duration_min,
        notes: form.notes,
      })
      onSave()
      onClose()
    } catch (e: any) {
      alert('Erreur : ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>✅ Marquer comme effectuée</div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>{item.task_name} · {item.equipment_name}</div>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Date d'exécution</label>
              <input className="form-input" type="date" value={form.done_at} onChange={e => setForm(p => ({ ...p, done_at: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Durée réelle (min)</label>
              <input className="form-input" type="number" value={form.duration_min} onChange={e => setForm(p => ({ ...p, duration_min: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Notes / Observations</label>
            <textarea className="form-input" placeholder="Anomalies constatées, pièces remplacées..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ minHeight: 80 }} />
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(0,208,216,.06)', border: '1px solid rgba(0,208,216,.2)', borderRadius: 8, fontSize: 12, color: '#00d0d8' }}>
            ✓ Un enregistrement sera créé dans l'audit automatiquement
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Enregistrement...' : '✓ Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPALE ─────────────────────────────────────────
export default function PreventivePage() {
  const { user } = useAuth()
  const [upcoming, setUpcoming] = useState<PreventiveUpcoming[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'overdue' | 'urgent' | 'soon' | 'ok'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [doneModal, setDoneModal] = useState<PreventiveUpcoming | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await preventiveApi.getUpcoming(180)
    setUpcoming(data.sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = useMemo(() => {
    if (filter === 'all') return upcoming
    return upcoming.filter(u => u.urgency === filter)
  }, [upcoming, filter])

  // Grouper par mois pour la vue calendrier
  const byMonth = useMemo(() => {
    const groups: Record<string, PreventiveUpcoming[]> = {}
    filtered.forEach(item => {
      if (!item.next_due_at) return
      const month = item.next_due_at.slice(0, 7)
      if (!groups[month]) groups[month] = []
      groups[month].push(item)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const counts = useMemo(() => ({
    overdue: upcoming.filter(u => u.urgency === 'overdue').length,
    urgent:  upcoming.filter(u => u.urgency === 'urgent').length,
    soon:    upcoming.filter(u => u.urgency === 'soon').length,
    ok:      upcoming.filter(u => u.urgency === 'ok').length,
  }), [upcoming])

  if (!user) return null

  return (
    <AppLayout>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--acc)', color: '#000', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
          ✓ {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="page-title">Maintenance préventive</div>
          <div className="page-sub">{upcoming.length} tâches planifiées</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setViewMode('list')} className={`btn btn-ghost btn-sm ${viewMode === 'list' ? 'btn-active' : ''}`}
            style={viewMode === 'list' ? { borderColor: 'var(--acc)', color: 'var(--acc)' } : {}}>
            ☰ Liste
          </button>
          <button onClick={() => setViewMode('calendar')} className={`btn btn-ghost btn-sm`}
            style={viewMode === 'calendar' ? { borderColor: 'var(--acc)', color: 'var(--acc)' } : {}}>
            📅 Calendrier
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {(Object.entries(URGENCY_CONFIG) as any[]).map(([key, cfg]) => (
          <div key={key} className="stat-card" style={{ cursor: 'pointer', borderColor: filter === key ? cfg.color : undefined }}
            onClick={() => setFilter(filter === key ? 'all' : key as any)}>
            <div className="stat-value" style={{ color: cfg.color, fontSize: 28 }}>{counts[key as keyof typeof counts]}</div>
            <div className="stat-label">{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} className="btn btn-ghost btn-sm"
          style={filter === 'all' ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : {}}>
          Tous ({upcoming.length})
        </button>
        {(Object.entries(URGENCY_CONFIG) as any[]).map(([key, cfg]) => (
          counts[key as keyof typeof counts] > 0 && (
            <button key={key} onClick={() => setFilter(key as any)} className="btn btn-ghost btn-sm"
              style={filter === key ? { borderColor: cfg.color, color: cfg.color, background: cfg.bg } : {}}>
              {cfg.label} ({counts[key as keyof typeof counts]})
            </button>
          )
        ))}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--t2)' }}>Chargement...</div>}

      {/* Vue Liste */}
      {!loading && viewMode === 'list' && (
        <div className="card">
          <table className="tbl">
            <thead>
              <tr>
                <th>Machine</th>
                <th>Tâche</th>
                <th>Zone</th>
                <th>Fréquence</th>
                <th>Dernière fois</th>
                <th>Prochaine</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><span>✅</span><span>Aucune maintenance à venir</span></div></td></tr>
              )}
              {filtered.map(item => {
                const uc = URGENCY_CONFIG[item.urgency]
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{item.equipment_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--t2)' }}>{item.equipment_location}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 13 }}>{item.task_name}</div>
                      {item.requires_stop && <div style={{ fontSize: 10, color: '#f59e0b' }}>⚠️ Arrêt requis</div>}
                      {item.estimated_minutes && <div style={{ fontSize: 10, color: 'var(--t2)' }}>⏱ {item.estimated_minutes} min</div>}
                    </td>
                    <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Zone {item.equipment_zone}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--t2)' }}>tous les {item.interval_days}j</span></td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{fmt(item.last_done_at)}</td>
                    <td style={{ fontWeight: 600, color: uc.color, fontSize: 12 }}>{fmt(item.next_due_at)}</td>
                    <td><span className="badge" style={{ background: uc.bg, color: uc.color }}>{uc.label}</span></td>
                    <td>
                      <button
                        onClick={() => setDoneModal(item)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: 11 }}
                      >
                        ✓ Fait
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vue Calendrier */}
      {!loading && viewMode === 'calendar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {byMonth.length === 0 && (
            <div className="empty-state"><span>✅</span><span>Aucune maintenance planifiée</span></div>
          )}
          {byMonth.map(([month, items]) => {
            const date = new Date(month + '-01')
            const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
            return (
              <div key={month} className="card">
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, textTransform: 'capitalize' }}>📅 {monthLabel}</span>
                  <span style={{ fontSize: 12, color: 'var(--t2)' }}>{items.length} tâche{items.length > 1 ? 's' : ''}</span>
                </div>
                <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(item => {
                    const uc = URGENCY_CONFIG[item.urgency]
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--s3)', borderRadius: 8, border: `1px solid ${uc.color}22` }}>
                        <div style={{ width: 40, textAlign: 'center', flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: uc.color, fontFamily: 'var(--font-mono)' }}>
                            {item.next_due_at ? new Date(item.next_due_at).getDate() : '—'}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase' }}>
                            {item.next_due_at ? new Date(item.next_due_at).toLocaleDateString('fr-FR', { weekday: 'short' }) : ''}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{item.task_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--t2)' }}>{item.equipment_name} · Zone {item.equipment_zone}</div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            {item.requires_stop && <span style={{ fontSize: 10, color: '#f59e0b' }}>⚠️ Arrêt requis</span>}
                            {item.estimated_minutes && <span style={{ fontSize: 10, color: 'var(--t2)' }}>⏱ {item.estimated_minutes} min</span>}
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: uc.bg, color: uc.color }}>{uc.label}</span>
                          </div>
                        </div>
                        <button onClick={() => setDoneModal(item)} className="btn btn-primary btn-sm" style={{ flexShrink: 0, fontSize: 11 }}>
                          ✓ Fait
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {doneModal && (
        <DoneModal
          item={doneModal}
          user={user}
          onClose={() => setDoneModal(null)}
          onSave={() => {
            showToast('Maintenance enregistrée — audit mis à jour')
            load()
          }}
        />
      )}
    </AppLayout>
  )
}
