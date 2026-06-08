'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import AppLayout from '@/components/layout/AppLayout'
import { auditApi, filesApi } from '@/lib/supabase'
import type { AuditLog } from '@/types'

const fmtDT = (d: string) => d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'

export default function AuditPage() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [documents, setDocuments] = useState<Array<{ name: string; path: string; url: string; created_at: string | null; size: number | null }>>([])
  const [loading, setLoading] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)

  const canUploadDocs = user?.role === 'admin' || user?.role === 'chef'

  const loadDocuments = async () => {
    setLoadingDocs(true)
    try {
      setDocuments(await filesApi.list('audit'))
      setError(null)
    } catch {
      setDocuments([])
      setError('Stockage Supabase indisponible. Créez le bucket Storage \"intervention-photos\" (non public) dans Supabase → Storage.')
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => {
    auditApi.getAll().then(data => { setLogs(data); setLoading(false) })
    loadDocuments()
  }, [])

  const actions = useMemo(() => (
    [...new Set(logs.map(log => log.action).filter(Boolean))]
  ), [logs])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      l.action.toLowerCase().includes(q) ||
      (l.target || '').toLowerCase().includes(q) ||
      (l.detail || '').toLowerCase().includes(q) ||
      (l.user as any)?.name?.toLowerCase().includes(q)

    const matchesAction = actionFilter === 'all' || l.action === actionFilter
    return matchesSearch && matchesAction
  })

  const actionColor = (action: string) => {
    if (action.includes('Rapport') || action.includes('signé')) return '#00d0d8'
    if (action.includes('stock') || action.includes('Stock')) return '#ffa502'
    if (action.includes('créée') || action.includes('Création')) return '#3c82e8'
    if (action.includes('Connexion')) return '#a855f7'
    return '#7a8599'
  }

  const uploadDocuments = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await filesApi.upload('audit', file)
      }
      await loadDocuments()
    } catch (e: any) {
      const msg = e.message || 'Impossible d’envoyer le document.'
      setError(msg.includes('Bucket not found') ? 'Bucket introuvable. Créez le bucket \"intervention-photos\" dans Supabase → Storage.' : msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppLayout>
      <div className="page-title">Journal d'audit</div>
      <div className="page-sub">Traçabilité complète — conforme IFS Food v8 · BRC · ISO 22000</div>

      <div style={{ padding: '10px 14px', background: 'rgba(0,208,216,.06)', border: '1px solid rgba(0,208,216,.2)', borderRadius: 8, fontSize: 12.5, color: '#00d0d8', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        🛡️ Ce journal est horodaté et non modifiable — disponible pour inspection par les auditeurs qualité.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Documents audit / pièces / conformité</div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 4 }}>Ajoutez vos PDF, fiches techniques, certificats, bons de livraison et autres justificatifs.</div>
          </div>
          {canUploadDocs && (
            <label className="btn btn-primary" style={{ cursor: uploading ? 'progress' : 'pointer', opacity: uploading ? .7 : 1 }}>
              {uploading ? 'Envoi...' : '+ Ajouter un document'}
              <input type="file" multiple style={{ display: 'none' }} onChange={e => uploadDocuments(e.target.files)} />
            </label>
          )}
        </div>
        {error && <div style={{ margin: '14px 18px 0', padding: '10px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 13, color: '#ff4757' }}>{error}</div>}
        <div style={{ padding: 18 }}>
          {loadingDocs ? (
            <div style={{ color: 'var(--t2)', fontSize: 13 }}>Chargement des documents…</div>
          ) : documents.length === 0 ? (
            <div className="empty-state" style={{ padding: 22 }}>
              <span>Aucun document charge</span>
            </div>
          ) : (
            <div className="grid-2">
              {documents.map(doc => (
                <a
                  key={doc.path}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--s3)', border: '1px solid var(--b0)', borderRadius: 8, color: 'inherit', textDecoration: 'none' }}
                >
                  <div style={{ fontSize: 22 }}>📄</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
                      {doc.created_at ? fmtDT(doc.created_at) : 'Date inconnue'}{doc.size ? ` · ${(doc.size / 1024).toFixed(1)} Ko` : ''}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input className="form-input" placeholder="Rechercher une action, un utilisateur, une cible..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t2)' }}>🔍</span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setActionFilter('all')}
          style={actionFilter === 'all' ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : undefined}
        >
          Tous ({logs.length})
        </button>
        {actions.map(action => (
          <button
            key={action}
            className="btn btn-ghost btn-sm"
            onClick={() => setActionFilter(action)}
            style={actionFilter === action ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : undefined}
          >
            {action}
          </button>
        ))}
      </div>

      <div className="card">
        {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2)' }}>Chargement…</div>}
        {filtered.map(l => {
          const u = l.user as any
          const c = actionColor(l.action)
          return (
            <div key={l.id} style={{ display: 'flex', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--t2)', whiteSpace: 'nowrap', paddingTop: 2, minWidth: 120 }}>
                {fmtDT(l.created_at)}
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 4, boxShadow: `0 0 4px ${c}` }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: c }}>{l.action}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>
                  {l.target && <span>{l.target}</span>}
                  {l.detail && <span style={{ marginLeft: 8, color: 'var(--t3)' }}>· {l.detail}</span>}
                </div>
              </div>
              {u && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: (u.color || '#888') + '22', color: u.color || '#888', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {u.avatar || '?'}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{u.name?.split(' ')[0]}</span>
                </div>
              )}
            </div>
          )
        })}
        {!loading && filtered.length === 0 && (
          <div className="empty-state"><span style={{ fontSize: 28 }}>📋</span><span>Aucun événement</span></div>
        )}
      </div>
    </AppLayout>
  )
}
