'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import AppLayout from '@/components/layout/AppLayout'
import { auditApi, filesApi, interventionsApi, preventiveApi } from '@/lib/supabase'
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
  const [interventions, setInterventions] = useState<any[]>([])
  const [preventivePlanning, setPreventivePlanning] = useState<any[]>([])

  const canUploadDocs = user?.role === 'admin' || user?.role === 'chef'

  const loadDocuments = async () => {
    setLoadingDocs(true)
    try {
      setDocuments(await filesApi.list('audit'))
      setError(null)
    } catch {
      setDocuments([])
    } finally {
      setLoadingDocs(false)
    }
  }

  useEffect(() => {
    // Timeout de sécurité 5s
    const t = setTimeout(() => setLoading(false), 5000)
    
    Promise.race([
      auditApi.getAll(),
      new Promise<AuditLog[]>(resolve => setTimeout(() => resolve([]), 5000))
    ]).then(data => {
      if (data.length > 0) setLogs(data)
      setLoading(false)
      clearTimeout(t)
    }).catch(() => {
      setLoading(false)
      clearTimeout(t)
    })

    loadDocuments()
    interventionsApi.getAll().then(data => setInterventions(data)).catch(() => {})
    preventiveApi.getUpcoming(365).then(data => setPreventivePlanning(data)).catch(() => {})
    return () => clearTimeout(t)
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

  const exportPDF = () => {
    const now = new Date().toLocaleDateString('fr-FR')
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Journal d'audit — MaintaFood</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 0; }
  .header { background: #0a0b0c; color: #fff; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
  .header-title { font-size: 20px; font-weight: 700; }
  .header-title span { color: #00d0d8; }
  .header-sub { font-size: 11px; color: #7a8599; margin-top: 4px; }
  .header-date { font-size: 11px; color: #7a8599; text-align: right; }
  .badge { background: #0a2a2b; border: 1px solid #00d0d8; color: #00d0d8; padding: 6px 16px; margin: 16px 32px; border-radius: 6px; font-size: 11px; display: inline-block; }
  .section { padding: 8px 32px; }
  .section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #1a1a1a; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f3f4f6; padding: 6px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .footer { margin-top: 24px; padding: 12px 32px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="header-title">MAINTA<span>FOOD</span></div>
    <div class="header-sub">GMAO Agroalimentaire · Journal d'audit</div>
  </div>
  <div class="header-date">
    Exporté le ${now}<br/>
    ${filtered.length} événement(s)${actionFilter !== 'all' ? ' · Filtre : ' + actionFilter : ''}${search ? ' · Recherche : "' + search + '"' : ''}
  </div>
</div>
<div class="badge">🛡️ Journal horodaté non modifiable — conforme IFS Food v8 · BRC · ISO 22000</div>
<div class="section">
  <table>
    <thead>
      <tr>
        <th style="width:130px">Date / Heure</th>
        <th style="width:160px">Action</th>
        <th>Cible</th>
        <th>Détail</th>
        <th style="width:80px">Utilisateur</th>
      </tr>
    </thead>
    <tbody>
      ${filtered.map(l => {
        const u = l.user as any
        const c = actionColor(l.action)
        return '<tr><td style="font-family:monospace;font-size:10px;color:#6b7280">' + fmtDT(l.created_at) + '</td><td><span class="dot" style="background:' + c + '"></span><strong style="color:' + c + '">' + l.action + '</strong></td><td>' + (l.target || '—') + '</td><td style="color:#6b7280">' + (l.detail || '—') + '</td><td style="font-size:10px">' + (u?.name?.split(' ')[0] || '—') + '</td></tr>'
      }).join('')}
    </tbody>
  </table>
</div>
<div class="footer">
  <span>MaintaFood GMAO · Agroalimentaire · Belgique 🇧🇪</span>
  <span>Document généré automatiquement — ${now}</span>
</div>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print() }, 500)
  }

  const exportRapportsPDF = () => {
    const now = new Date().toLocaleDateString('fr-FR')
    const signed = interventions.filter(i => i.signed_at && i.report_verdict)
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Rapports interventions — MaintaFood</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;margin:0;padding:0}
  .header{background:#0a0b0c;color:#fff;padding:24px 32px;display:flex;align-items:center;justify-content:space-between}
  .header-title{font-size:20px;font-weight:700}.header-title span{color:#00d0d8}
  .header-sub{font-size:11px;color:#7a8599;margin-top:4px}
  .badge{background:#0a2a2b;border:1px solid #00d0d8;color:#00d0d8;padding:6px 16px;margin:16px 32px;border-radius:6px;font-size:11px;display:inline-block}
  .section{padding:8px 32px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f3f4f6;padding:6px 10px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  .verdict-ok{color:#059669;font-weight:700}.verdict-warn{color:#d97706;font-weight:700}.verdict-ko{color:#dc2626;font-weight:700}
  .footer{margin-top:24px;padding:12px 32px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <div><div class="header-title">MAINTA<span>FOOD</span></div><div class="header-sub">GMAO Agroalimentaire · Rapports d'interventions signés</div></div>
  <div style="font-size:11px;color:#7a8599;text-align:right">Exporté le ${now}<br/>${signed.length} rapport(s) signé(s)</div>
</div>
<div class="badge">✅ Rapports signés numériquement — horodatés — conforme IFS Food v8 · BRC · ISO 22000</div>
<div class="section">
<table>
  <thead><tr>
    <th style="width:110px">Date signature</th>
    <th>Intervention</th>
    <th>Machine</th>
    <th style="width:80px">Technicien</th>
    <th style="width:80px">Durée</th>
    <th style="width:90px">Verdict</th>
    <th>Actions / Observations</th>
  </tr></thead>
  <tbody>
    ${signed.map((i: any) => {
      const verdict = i.report_verdict || '—'
      const vClass = verdict === 'conforme' ? 'verdict-ok' : verdict === 'a_surveiller' ? 'verdict-warn' : 'verdict-ko'
      const dur = i.report_duration ? Math.floor(i.report_duration/60)+'h'+String(i.report_duration%60).padStart(2,'0') : '—'
      return '<tr><td style="font-family:monospace;font-size:10px;color:#6b7280">' + fmtDT(i.signed_at) + '</td><td><strong>' + (i.title||'—') + '</strong><br/><span style="font-size:10px;color:#6b7280">Signé par: ' + (i.signed_by||'—') + '</span></td><td style="font-size:11px">' + (i.equipment?.name||'—') + '</td><td style="font-size:11px">' + (i.technician?.name?.split(' ')[0]||'—') + '</td><td style="font-family:monospace">' + dur + '</td><td class="' + vClass + '">' + verdict + '</td><td style="font-size:11px;color:#374151">' + (i.report_actions||'—') + (i.report_observations ? '<br/><em style="color:#6b7280">' + i.report_observations + '</em>' : '') + '</td></tr>'
    }).join('')}
  </tbody>
</table></div>
<div class="footer"><span>MaintaFood GMAO · Agroalimentaire · Belgique 🇧🇪</span><span>Document généré — ${now}</span></div>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus()
    setTimeout(() => win.print(), 500)
  }

  const exportPreventifPDF = () => {
    const now = new Date().toLocaleDateString('fr-FR')
    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Planning préventif — MaintaFood</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;margin:0;padding:0}
  .header{background:#0a0b0c;color:#fff;padding:24px 32px;display:flex;align-items:center;justify-content:space-between}
  .header-title{font-size:20px;font-weight:700}.header-title span{color:#00d0d8}
  .header-sub{font-size:11px;color:#7a8599;margin-top:4px}
  .badge{background:#0a2a2b;border:1px solid #00d0d8;color:#00d0d8;padding:6px 16px;margin:16px 32px;border-radius:6px;font-size:11px;display:inline-block}
  .section{padding:8px 32px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#f3f4f6;padding:6px 10px;text-align:left;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  .overdue{color:#dc2626;font-weight:700}.urgent{color:#d97706;font-weight:700}.soon{color:#2563eb;font-weight:700}.ok{color:#059669;font-weight:700}
  .footer{margin-top:24px;padding:12px 32px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <div><div class="header-title">MAINTA<span>FOOD</span></div><div class="header-sub">GMAO Agroalimentaire · Planning maintenance préventive</div></div>
  <div style="font-size:11px;color:#7a8599;text-align:right">Exporté le ${now}<br/>${preventivePlanning.length} tâche(s) planifiée(s)</div>
</div>
<div class="badge">🛠️ Planning préventif — conforme IFS Food v8 · BRC · ISO 22000</div>
<div class="section">
<table>
  <thead><tr>
    <th>Machine</th>
    <th>Zone</th>
    <th>Tâche</th>
    <th style="width:90px">Fréquence</th>
    <th style="width:100px">Dernière fois</th>
    <th style="width:100px">Prochaine</th>
    <th style="width:70px">Statut</th>
    <th style="width:60px">Durée est.</th>
  </tr></thead>
  <tbody>
    ${preventivePlanning.map((p: any) => {
      const urgencyClass = p.urgency || 'ok'
      const urgencyLabel = {overdue:'En retard',urgent:'Urgent',soon:'Bientôt',ok:'Planifié'}[p.urgency as string] || p.urgency
      const lastDone = p.last_done_at ? new Date(p.last_done_at).toLocaleDateString('fr-FR') : '—'
      const nextDue = p.next_due_at ? new Date(p.next_due_at).toLocaleDateString('fr-FR') : '—'
      const dur = p.estimated_minutes ? Math.floor(p.estimated_minutes/60)+'h'+String(p.estimated_minutes%60).padStart(2,'0') : '—'
      return '<tr><td><strong>' + (p.equipment_name||'—') + '</strong>' + (p.requires_stop ? '<br/><span style="color:#d97706;font-size:10px">⚠ Arrêt requis</span>' : '') + '</td><td style="font-family:monospace">Zone ' + (p.equipment_zone||'—') + '</td><td>' + (p.task_name||'—') + '</td><td style="font-family:monospace">/' + (p.interval_days||'?') + 'j</td><td style="color:#6b7280">' + lastDone + '</td><td style="font-weight:600">' + nextDue + '</td><td class="' + urgencyClass + '">' + urgencyLabel + '</td><td style="font-family:monospace">' + dur + '</td></tr>'
    }).join('')}
  </tbody>
</table></div>
<div class="footer"><span>MaintaFood GMAO · Agroalimentaire · Belgique 🇧🇪</span><span>Document généré — ${now}</span></div>
</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus()
    setTimeout(() => win.print(), 500)
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
      const msg = e.message || 'Impossible d\'envoyer le document.'
      setError(msg.includes('Bucket not found') ? 'Bucket introuvable. Créez le bucket "intervention-photos" dans Supabase → Storage.' : msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="page-title">Journal d'audit</div>
          <div className="page-sub">Traçabilité complète — conforme IFS Food v8 · BRC · ISO 22000</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {logs.length > 0 && (
            <button onClick={exportPDF} className="btn btn-ghost btn-sm">📋 Journal PDF</button>
          )}
          {interventions.filter((i: any) => i.signed_at).length > 0 && (
            <button onClick={exportRapportsPDF} className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(0,208,216,.3)', color: '#00d0d8' }}>✅ Rapports signés</button>
          )}
          {preventivePlanning.length > 0 && (
            <button onClick={exportPreventifPDF} className="btn btn-ghost btn-sm" style={{ borderColor: 'rgba(124,58,237,.3)', color: '#a855f7' }}>🛠️ Planning préventif</button>
          )}
        </div>
      </div>

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
            <div className="empty-state" style={{ padding: 22 }}><span>Aucun document chargé</span></div>
          ) : (
            <div className="grid-2">
              {documents.map(doc => (
                <a key={doc.path} href={doc.url} target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--s3)', border: '1px solid var(--b0)', borderRadius: 8, color: 'inherit', textDecoration: 'none' }}>
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
        <button className="btn btn-ghost btn-sm" onClick={() => setActionFilter('all')}
          style={actionFilter === 'all' ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : undefined}>
          Tous ({logs.length})
        </button>
        {actions.map(action => (
          <button key={action} className="btn btn-ghost btn-sm" onClick={() => setActionFilter(action)}
            style={actionFilter === action ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : undefined}>
            {action}
          </button>
        ))}
      </div>

      <div className="card">
        {loading && logs.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2)' }}>Chargement…</div>}
        {!loading && filtered.length === 0 && <div className="empty-state"><span style={{ fontSize: 28 }}>📋</span><span>Aucun événement</span></div>}
        {filtered.map(l => {
          const u = l.user as any
          const c = actionColor(l.action)
          return (
            <div key={l.id} style={{ display: 'flex', gap: 12, padding: '12px 18px', borderBottom: '1px solid rgba(255,255,255,.04)', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--t2)', whiteSpace: 'nowrap', paddingTop: 2, minWidth: 120 }}>
                {fmtDT(l.created_at)}
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0, marginTop: 4 }} />
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
      </div>
    </AppLayout>
  )
}
