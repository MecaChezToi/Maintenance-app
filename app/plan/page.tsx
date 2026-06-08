'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/components/layout/AuthProvider'
import { auditApi, equipmentsApi, filesApi, interventionsApi, partsApi, preventiveApi } from '@/lib/supabase'
import { networkStatus, pendingWrites } from '@/lib/offlineDb'
import { syncManager } from '@/lib/syncManager'
import { useData } from '@/lib/DataStore'
import type { Equipment, EqStatus, Part, Priority, Profile, PreventivePlan } from '@/types'
import { EQ_STATUS_CONFIG, PRIORITY_CONFIG, URGENCY_CONFIG as UC } from '@/types'

type ZoneKey = 'A' | 'B' | 'C' | 'D'
type StatusFilter = 'all' | EqStatus

const fmt = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtDT = (d?: string | null) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const sizeLabel = (size?: number | null) => size ? `${(size / 1024).toFixed(1)} Ko` : '—'
const addDays = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const ZONE_CONFIG: Record<ZoneKey, { label: string; desc: string; color: string; x: number; y: number; w: number; h: number }> = {
  A: { label: 'Lignes 1R', desc: 'Emballage & conditionnement', color: '#e8643c', x: 4,  y: 58, w: 24, h: 30 },
  B: { label: 'Atelier 2R-3R', desc: 'SIG · Hacos · Stockage',   color: '#00d0d8', x: 4,  y: 30, w: 46, h: 26 },
  C: { label: 'Production 3R-4R', desc: 'Stim · Écomec · Sapal', color: '#a855f7', x: 4,  y: 6,  w: 52, h: 22 },
  D: { label: 'Lignes 4R droite', desc: 'Bosch · Sapal · Frigo', color: '#f59e0b', x: 58, y: 6,  w: 36, h: 52 },
}

const PREVENTIVE_TYPES = ['nettoyage', 'vidange', 'changement tapis', 'graissage', 'inspection'] as const

// ─── QR CODE GENERATOR (sans lib externe) ──────────────────
function QRCodeDisplay({ equipment }: { equipment: Equipment }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/eq/${equipment.id}`
    : `/eq/${equipment.id}`

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Simple QR-like visual avec data URL
    const size = 200
    canvas.width = size
    canvas.height = size
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)

    // Encode l'URL en pattern visuel (pas un vrai QR mais lisible par redirection)
    // Pour un vrai QR code, on génère un lien vers api.qrserver.com
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=000000&margin=10`
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
    }
    img.onerror = () => {
      // Fallback : afficher juste l'ID
      ctx.fillStyle = '#000'
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('QR Code', size/2, size/2)
      ctx.fillText(equipment.id.slice(0,8), size/2, size/2 + 20)
    }
  }, [equipment.id, url])

  const downloadQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.download = `QR-${equipment.name.replace(/\s+/g, '-')}.png`
    a.href = canvas.toDataURL('image/png')
    a.click()
  }

  const printQR = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR — ${equipment.name}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px;} h2{color:#000;} p{color:#555;font-size:13px;}</style>
      </head><body>
      <h2>${equipment.name}</h2>
      <p>N° série : ${equipment.serial || '—'} · Zone ${equipment.zone || '—'}</p>
      <img src="${canvas.toDataURL()}" style="width:200px;height:200px;border:1px solid #eee;" />
      <p style="font-size:11px;color:#999;margin-top:10px;">${url}</p>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ padding: 12, background: '#fff', borderRadius: 12, boxShadow: '0 0 0 1px rgba(255,255,255,.08)' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: 180, height: 180 }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{equipment.name}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', maxWidth: 260 }}>{url}</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={downloadQR} style={{ padding: '8px 16px', background: 'rgba(0,208,216,.15)', border: '1px solid rgba(0,208,216,.3)', borderRadius: 8, color: '#00d0d8', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ⬇ Télécharger
        </button>
        <button onClick={printQR} style={{ padding: '8px 16px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: 'var(--t1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          🖨 Imprimer
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
        Scanner ce QR code ouvre directement la fiche machine et permet de créer une intervention.
      </div>
    </div>
  )
}

function EquipmentDetailModal({
  equipment,
  canManage,
  onClose,
  onCreateIntervention,
  interventions = [],
  onStatusChange,
  onLinkPart,
  onUnlinkPart,
  onUploadFiles,
  onUpdateMaintenance,
  onDelete,
  onArchive,
  onEdit,
  organizationId,
}: {
  equipment: Equipment
  canManage: boolean
  onClose: () => void
  onCreateIntervention: (equipment: Equipment) => void
  interventions?: any[]
  onStatusChange: (equipment: Equipment, status: EqStatus) => Promise<void>
  onLinkPart: (equipment: Equipment, partId: string) => Promise<void>
  onUnlinkPart: (equipment: Equipment, partId: string) => Promise<void>
  onUploadFiles: (equipment: Equipment, files: File[]) => Promise<void>
  onUpdateMaintenance: (equipment: Equipment, updates: Partial<Equipment>) => Promise<void>
  onDelete?: (equipment: Equipment) => Promise<void>
  onArchive?: (equipment: Equipment) => Promise<void>
  onEdit?: (equipment: Equipment) => void
  organizationId?: string
}) {
  const [parts, setParts] = useState<Part[]>([])
  const [allParts, setAllParts] = useState<Part[]>([])
  const [equipmentFiles, setEquipmentFiles] = useState<Array<{ name: string; path: string; url: string; created_at: string | null; size: number | null }>>([])
  const [loadingParts, setLoadingParts] = useState(true)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [selectedPartId, setSelectedPartId] = useState('')
  const [linking, setLinking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingMaintenance, setSavingMaintenance] = useState(false)
  const [intervalDays, setIntervalDays] = useState<number>(Number(equipment.preventive_interval_days || 0))
  const [tasksText, setTasksText] = useState<string>((equipment.preventive_tasks || []).join(', '))
  const [nextPreventive, setNextPreventive] = useState<string>(equipment.next_preventive ? String(equipment.next_preventive) : '')
  const [plans, setPlans] = useState<PreventivePlan[]>([])
  const [plansLoading, setPlansLoading] = useState(false)
  const [showAddPlan, setShowAddPlan] = useState(false)
  const [newPlan, setNewPlan] = useState({ name: '', interval_days: 90, estimated_minutes: 30, requires_stop: false, description: '' })
  const statusCfg = EQ_STATUS_CONFIG[equipment.status]

  const loadParts = async () => {
    setLoadingParts(true)
    try {
      const [linkedParts, availableParts] = await Promise.all([
        equipmentsApi.getParts(equipment.id),
        canManage ? partsApi.getAll() : Promise.resolve([] as Part[]),
      ])
      setParts(linkedParts.filter(Boolean))
      setAllParts(availableParts)
    } finally {
      setLoadingParts(false)
    }
  }

  const loadFiles = async () => {
    setLoadingFiles(true)
    try {
      setEquipmentFiles(await filesApi.list(`equipments/${equipment.id}`))
    } catch {
      setEquipmentFiles([])
      setError('Stockage Supabase indisponible. Créez le bucket Storage \"intervention-photos\" (non public) dans Supabase → Storage.')
    } finally {
      setLoadingFiles(false)
    }
  }

  useEffect(() => {
    Promise.all([loadParts(), loadFiles()]).catch(() => undefined)
    // Charger les plans préventifs
    setPlansLoading(true)
    preventiveApi.getPlans(equipment.id).then(setPlans).finally(() => setPlansLoading(false))
  }, [equipment.id])

  const availableParts = useMemo(() => (
    allParts.filter(part => !parts.some(linked => linked.id === part.id))
  ), [allParts, parts])

  const handleLinkPart = async () => {
    if (!selectedPartId) return
    setLinking(true)
    setError(null)
    try {
      await onLinkPart(equipment, selectedPartId)
      setSelectedPartId('')
      await loadParts()
    } catch (e: any) {
      setError(e.message || 'Impossible d’associer la piece.')
    } finally {
      setLinking(false)
    }
  }

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      await onUploadFiles(equipment, Array.from(files))
      await loadFiles()
    } catch (e: any) {
      const msg = e.message || 'Impossible d’envoyer le fichier.'
      setError(msg.includes('Bucket not found') ? 'Bucket introuvable. Créez le bucket \"intervention-photos\" dans Supabase → Storage.' : msg)
    } finally {
      setUploading(false)
    }
  }

  const saveMaintenance = async () => {
    if (!canManage) return
    setSavingMaintenance(true)
    setError(null)
    try {
      const parsedTasks = tasksText
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const days = Number(intervalDays || 0)
      const next = nextPreventive || (days > 0 ? addDays(days) : null)

      await onUpdateMaintenance(equipment, {
        preventive_interval_days: days > 0 ? days : null,
        preventive_tasks: parsedTasks.length > 0 ? parsedTasks : null,
        next_preventive: next ? next : null,
      })
    } catch (e: any) {
      setError(e.message || 'Impossible de sauvegarder la maintenance.')
    } finally {
      setSavingMaintenance(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(6px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' as any }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ maxWidth: 760, margin: '20px auto', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 14, minHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', gap: 12, position: 'sticky', top: 0, background: 'var(--s2)', zIndex: 1, borderRadius: '14px 14px 0 0' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{equipment.name}</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
              {equipment.serial || 'Sans n° de série'} · Zone {equipment.zone || '—'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>

          {/* ── KPI Maintenance ── */}
          {(() => {
            const eqInts = (interventions || []).filter((i: any) => i.equipment_id === equipment.id)
            const done = eqInts.filter((i: any) => i.report_duration && i.report_duration > 0)
            const mttrMin = done.length ? Math.round(done.reduce((s: number, i: any) => s + (i.report_duration || 0), 0) / done.length) : null
            const mttrStr = mttrMin ? `${Math.floor(mttrMin / 60)}h${String(mttrMin % 60).padStart(2,'0')}` : '—'
            const sortedDates = eqInts.map((i: any) => new Date(i.created_at).getTime()).sort((a: number, b: number) => a - b)
            let mtbfDays: number | null = null
            if (sortedDates.length >= 2) {
              const gaps = sortedDates.slice(1).map((t: number, i: number) => (t - sortedDates[i]) / 86400000)
              mtbfDays = Math.round(gaps.reduce((s: number, g: number) => s + g, 0) / gaps.length)
            }
            const open = eqInts.filter((i: any) => !['termine','valide'].includes(i.status))
            const late = open.filter((i: any) => (Date.now() - new Date(i.created_at).getTime()) / 86400000 > 7)
            const pannes = eqInts.filter((i: any) => i.priority === 'critique' || i.priority === 'haute')
            const totalDownMin = done.reduce((s: number, i: any) => s + (i.report_duration || 0), 0)
            const dispo = Math.min(100, Math.round((1 - totalDownMin / (90 * 24 * 60)) * 1000) / 10)
            const dispoColor = dispo >= 98 ? '#00d0d8' : dispo >= 90 ? '#f59e0b' : '#ff4757'
            const mtbfColor = !mtbfDays ? 'var(--t3)' : mtbfDays >= 60 ? '#00d0d8' : mtbfDays >= 30 ? '#f59e0b' : '#ff4757'
            return (
              <div style={{ background: 'var(--s3)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📊 Résumé maintenance · {eqInts.length} intervention{eqInts.length > 1 ? 's' : ''} au total
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'MTBF', value: mtbfDays !== null ? `${mtbfDays}j` : '—', color: mtbfColor, sub: 'moy. entre pannes' },
                    { label: 'MTTR', value: mttrStr, color: '#3c82e8', sub: 'moy. réparation' },
                    { label: 'OT ouverts', value: open.length, color: open.length > 0 ? '#f59e0b' : '#00d0d8', sub: 'en cours' },
                    { label: 'En retard', value: late.length, color: late.length > 0 ? '#ff4757' : '#00d0d8', sub: '> 7 jours' },
                    { label: 'Dispo.', value: `${dispo}%`, color: dispoColor, sub: 'sur 90j' },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 8, color: 'var(--t3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${dispo}%`, background: dispoColor, borderRadius: 2, transition: 'width .4s' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>
                  <span>0%</span><span style={{ color: dispo >= 95 ? dispoColor : 'var(--t3)' }}>Objectif 95%</span><span>100%</span>
                </div>
              </div>
            )
          })()}

          <div style={{ background: 'var(--s3)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <span className="badge" style={{ background: `${statusCfg.color}18`, color: statusCfg.color }}>
                {statusCfg.label}
              </span>
              {equipment.category && <span className="badge" style={{ background: 'var(--s4)', color: 'var(--t2)' }}>{equipment.category}</span>}
              {equipment.food_safe && <span className="badge" style={{ background: 'rgba(0,208,216,.12)', color: 'var(--acc)' }}>Zone alimentaire</span>}
            </div>

            {canManage && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(EQ_STATUS_CONFIG) as EqStatus[]).map(status => {
                  const cfg = EQ_STATUS_CONFIG[status]
                  return (
                    <button
                      key={status}
                      className="btn btn-ghost btn-sm"
                      onClick={() => onStatusChange(equipment, status)}
                      style={equipment.status === status ? {
                        borderColor: cfg.color,
                        color: cfg.color,
                        background: `${cfg.color}18`,
                      } : undefined}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid-2">
            <div className="card">
              <div style={{ padding: 14 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>Fiche Technique</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>Localisation</div>
                    <div style={{ fontSize: 13 }}>{equipment.location || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>Réf. manuel</div>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: equipment.manual_ref ? 'var(--acc)' : 'var(--t1)' }}>
                      {equipment.manual_ref || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>Dernière inspection</div>
                    <div style={{ fontSize: 13 }}>{fmt(equipment.last_inspection)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>Prochaine inspection</div>
                    <div style={{ fontSize: 13, color: equipment.next_inspection && new Date(equipment.next_inspection) < new Date() ? 'var(--red)' : 'var(--t1)' }}>
                      {fmt(equipment.next_inspection)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div style={{ padding: 14 }}>
                <div className="form-label" style={{ marginBottom: 10 }}>Schema / Description</div>
                <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7 }}>
                  {equipment.schema_desc || 'Aucune description technique renseignée.'}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', fontSize: 15, fontWeight: 700 }}>
              Pieces compatibles
            </div>
            <div style={{ padding: 14 }}>
              {error && <div style={{ marginBottom: 12, padding: '10px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 12.5, color: '#ff4757' }}>{error}</div>}
              {canManage && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <select className="form-select" value={selectedPartId} onChange={e => setSelectedPartId(e.target.value)} style={{ flex: 1, minWidth: 220 }}>
                    <option value="">Associer une piece du magasin…</option>
                    {availableParts.map(part => (
                      <option key={part.id} value={part.id}>{part.ref} · {part.name}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" disabled={!selectedPartId || linking} onClick={handleLinkPart}>
                    {linking ? 'Ajout...' : '+ Associer'}
                  </button>
                </div>
              )}
              {loadingParts ? (
                <div style={{ color: 'var(--t2)', fontSize: 13 }}>Chargement…</div>
              ) : parts.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <span>Aucune piece referencee</span>
                </div>
              ) : (
                <div className="grid-2">
                  {parts.map(part => {
                    const low = part.qty <= part.min_qty
                    return (
                      <div key={part.id} style={{ background: 'var(--s3)', border: `1px solid ${low ? 'rgba(255,71,87,.25)' : 'var(--b0)'}`, borderRadius: 8, padding: 12, display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{part.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--acc)', fontFamily: 'var(--font-mono)' }}>{part.ref}</div>
                          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 6 }}>{part.location || '—'} · {part.location_detail || 'Emplacement non renseigne'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: low ? 'var(--red)' : 'var(--t1)' }}>{part.qty}</div>
                          <div style={{ fontSize: 10, color: 'var(--t2)' }}>{part.unit}</div>
                          {canManage && (
                            <button className="btn btn-ghost btn-xs" style={{ marginTop: 8 }} onClick={() => onUnlinkPart(equipment, part.id).then(loadParts).catch((e: any) => setError(e.message || 'Impossible de retirer la piece.'))}>
                              Retirer
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Photos / documents machine</div>
              <label className="btn btn-ghost btn-sm" style={{ cursor: uploading ? 'progress' : 'pointer', opacity: uploading ? .7 : 1 }}>
                {uploading ? 'Envoi...' : '+ Ajouter'}
                <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style={{ display: 'none' }} onChange={e => handleUploadFiles(e.target.files)} />
              </label>
            </div>
            <div style={{ padding: 14 }}>
              {loadingFiles ? (
                <div style={{ color: 'var(--t2)', fontSize: 13 }}>Chargement…</div>
              ) : equipmentFiles.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <span>Aucun document sur cette machine</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                  {equipmentFiles.map(file => {
                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
                    return isImage ? (
                      <a key={file.path} href={file.url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--b0)', background: 'var(--s3)' }}>
                        <img src={file.url} alt={file.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <div style={{ padding: '6px 8px', fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      </a>
                    ) : (
                      <a key={file.path} href={file.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s3)', border: '1px solid var(--b0)', borderRadius: 8, padding: 12, color: 'inherit', textDecoration: 'none' }}>
                        <div style={{ fontSize: 20 }}>📎</div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{fmtDT(file.created_at)} · {sizeLabel(file.size)}</div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Maintenance préventive</span>
              {canManage && (
                <button onClick={() => setShowAddPlan(true)} className="btn btn-primary btn-sm">+ Ajouter</button>
              )}
            </div>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plansLoading && <div style={{ color: 'var(--t2)', fontSize: 12, textAlign: 'center' }}>Chargement...</div>}

              {!plansLoading && plans.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--t3)', fontSize: 13 }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>🔧</div>
                  Aucune tâche préventive définie
                </div>
              )}

              {plans.map(plan => {
                const urgency = !plan.next_due_at ? 'ok'
                  : new Date(plan.next_due_at) < new Date() ? 'overdue'
                  : new Date(plan.next_due_at) <= new Date(Date.now() + 7*86400000) ? 'urgent'
                  : new Date(plan.next_due_at) <= new Date(Date.now() + 30*86400000) ? 'soon' : 'ok'
                const uc = UC[urgency as keyof typeof UC]
                return (
                  <div key={plan.id} style={{ background: 'var(--s3)', borderRadius: 8, padding: 12, border: `1px solid ${uc.color}33` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{plan.name}</div>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: uc.bg, color: uc.color, flexShrink: 0 }}>{uc.label}</span>
                    </div>
                    {plan.description && <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>{plan.description}</div>}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--t2)', flexWrap: 'wrap' }}>
                      <span>🔄 Tous les {plan.interval_days}j</span>
                      {plan.estimated_minutes && <span>⏱ {plan.estimated_minutes} min</span>}
                      {plan.requires_stop && <span style={{ color: '#f59e0b' }}>⚠️ Arrêt requis</span>}
                      <span>📅 Prochaine : <strong style={{ color: uc.color }}>{plan.next_due_at ? fmt(plan.next_due_at) : '—'}</strong></span>
                      {plan.last_done_at && <span>✅ Dernière : {fmt(plan.last_done_at)}</span>}
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={async () => {
                            if (!confirm('Supprimer cette tâche ?')) return
                            await preventiveApi.deletePlan(plan.id)
                            setPlans(prev => prev.filter(p => p.id !== plan.id))
                          }}
                          style={{ fontSize: 11, padding: '3px 8px', background: 'rgba(255,71,87,.1)', border: '1px solid rgba(255,71,87,.2)', borderRadius: 4, color: '#ff4757', cursor: 'pointer' }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Formulaire ajout plan */}
              {showAddPlan && (
                <div style={{ background: 'var(--s3)', borderRadius: 8, padding: 12, border: '1px solid var(--b1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Nouvelle tâche préventive</div>
                  <input className="form-input" placeholder="Nom de la tâche *" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} />
                  <textarea className="form-input" placeholder="Description (optionnel)" value={newPlan.description} onChange={e => setNewPlan(p => ({ ...p, description: e.target.value }))} style={{ minHeight: 60 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label className="form-label">Fréquence (jours)</label>
                      <input className="form-input" type="number" value={newPlan.interval_days} onChange={e => setNewPlan(p => ({ ...p, interval_days: parseInt(e.target.value) || 90 }))} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label className="form-label">Durée estimée (min)</label>
                      <input className="form-input" type="number" value={newPlan.estimated_minutes} onChange={e => setNewPlan(p => ({ ...p, estimated_minutes: parseInt(e.target.value) || 30 }))} />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={newPlan.requires_stop} onChange={e => setNewPlan(p => ({ ...p, requires_stop: e.target.checked }))} style={{ accentColor: '#f59e0b' }} />
                    Arrêt production requis
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddPlan(false)}>Annuler</button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={!newPlan.name.trim()}
                      onClick={async () => {
                        const created = await preventiveApi.createPlan({
                          ...newPlan,
                          equipment_id: equipment.id,
                          organization_id: organizationId || '',
                          active: true,
                        })
                        if (created) {
                          setPlans(prev => [...prev, created])
                          setNewPlan({ name: '', interval_days: 90, estimated_minutes: 30, requires_stop: false, description: '' })
                          setShowAddPlan(false)
                        }
                      }}
                    >
                      ✓ Créer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QR Code section */}
          <div className="card">
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', fontSize: 15, fontWeight: 700 }}>
              QR Code machine
            </div>
            <div style={{ padding: 14 }}>
              <QRCodeDisplay equipment={equipment} />
            </div>
          </div>

        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, position: 'sticky', bottom: 0, background: 'var(--s2)', borderRadius: '0 0 14px 14px' }}>
          {canManage && onEdit && (
            <button onClick={() => onEdit(equipment)} style={{ padding: '7px 14px', background: 'rgba(60,130,232,.1)', border: '1px solid rgba(60,130,232,.25)', borderRadius: 6, color: '#3c82e8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              ✏️ Modifier
            </button>
          )}
          {canManage && onArchive && (
            <button onClick={() => onArchive(equipment)} style={{ padding: '7px 14px', background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.25)', borderRadius: 6, color: '#f59e0b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              📦 Archiver
            </button>
          )}
          {canManage && onDelete && (
            <button onClick={() => onDelete(equipment)} style={{ padding: '7px 14px', background: 'rgba(255,71,87,.1)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 6, color: '#ff4757', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              🗑 Supprimer
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
            <button className="btn btn-primary" onClick={() => onCreateIntervention(equipment)}>Nouvelle intervention</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AddEquipmentModal({
  onClose,
  onSave,
  error,
}: {
  onClose: () => void
  onSave: (equipment: Partial<Equipment>, files: File[]) => Promise<void>
  error?: string | null
}) {
  const [form, setForm] = useState({
    name: '',
    serial: '',
    manufacturer: '',
    installation_date: '',
    location: '',
    zone: 'A' as ZoneKey,
    category: 'Machine-outil',
    color: '#3c82e8',
    schema_desc: '',
    manual_ref: '',
    food_safe: false,
    next_inspection: '',
    preventive_days: 0,
    preventive_tasks: [] as string[],
    files: [] as File[],
  })
  const [saving, setSaving] = useState(false)
  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(prev => ({ ...prev, [key]: value }))

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const zone = ZONE_CONFIG[form.zone]
      const preventiveDays = Number(form.preventive_days || 0)
      await onSave({
        name: form.name.trim(),
        serial: form.serial.trim(),
        location: form.location.trim(),
        zone: form.zone,
        category: form.category,
        color: form.color,
        schema_desc: form.schema_desc.trim(),
        manual_ref: form.manual_ref.trim(),
        food_safe: form.food_safe,
        status: 'ok',
        pos_x: zone.x + zone.w / 2 - 5,
        pos_y: zone.y + zone.h / 2 - 4,
        pos_w: 10,
        pos_h: 8,
        last_inspection: new Date().toISOString().split('T')[0],
        manufacturer: form.manufacturer.trim() || null as never,
        installation_date: form.installation_date || null as never,
        next_inspection: form.next_inspection || null as never,
        preventive_interval_days: preventiveDays > 0 ? preventiveDays : null as never,
        preventive_tasks: form.preventive_tasks.length > 0 ? form.preventive_tasks : null as never,
        next_preventive: preventiveDays > 0 ? addDays(preventiveDays) : null as never,
      }, form.files)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Ajouter une machine</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        </div>

        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="ex: Compresseur Atlas #4" />
          </div>

          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">N° de serie</label>
              <input className="form-input" value={form.serial} onChange={e => setField('serial', e.target.value)} placeholder="ex: ATL-2026-004" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Zone</label>
              <select className="form-select" value={form.zone} onChange={e => setField('zone', e.target.value as ZoneKey)}>
                {(Object.keys(ZONE_CONFIG) as ZoneKey[]).map(zone => (
                  <option key={zone} value={zone}>Zone {zone} — {ZONE_CONFIG[zone].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Fabricant</label>
              <input className="form-input" value={form.manufacturer} onChange={e => setField('manufacturer', e.target.value)} placeholder="ex: Bosch, Sapal..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Date d'installation</label>
              <input className="form-input" type="date" value={form.installation_date} onChange={e => setField('installation_date', e.target.value)} />
            </div>
          </div>

          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Localisation</label>
              <input className="form-input" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="ex: Atelier B, cote nord" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Categorie</label>
              <input className="form-input" value={form.category} onChange={e => setField('category', e.target.value)} placeholder="ex: Pneumatique" />
            </div>
          </div>

          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Manuel technique</label>
              <input className="form-input" value={form.manual_ref} onChange={e => setField('manual_ref', e.target.value)} placeholder="ex: ATL-15KW-2026" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Prochaine inspection</label>
              <input className="form-input" type="date" value={form.next_inspection} onChange={e => setField('next_inspection', e.target.value)} />
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: 'var(--s3)' }}>
            <div className="form-label" style={{ marginBottom: 10 }}>Maintenance preventive</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Dans (jours)</label>
                <input className="form-input" type="number" value={form.preventive_days} onChange={e => setField('preventive_days', Math.max(0, parseInt(e.target.value) || 0))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Prochaine</label>
                <input className="form-input" type="date" value={form.preventive_days > 0 ? addDays(form.preventive_days) : ''} readOnly />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PREVENTIVE_TYPES.map(t => {
                const active = form.preventive_tasks.includes(t)
                return (
                  <button
                    key={t}
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setField('preventive_tasks', active ? form.preventive_tasks.filter(x => x !== t) : [...form.preventive_tasks, t])}
                    style={active ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : undefined}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Autres (separes par virgules)</label>
              <input
                className="form-input"
                placeholder="ex: controle courroies, graissage chaine"
                onBlur={(e) => {
                  const extras = e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                  const merged = [...new Set([...form.preventive_tasks, ...extras])]
                  setField('preventive_tasks', merged)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Description technique</label>
            <textarea className="form-textarea" value={form.schema_desc} onChange={e => setField('schema_desc', e.target.value)} placeholder="Fonctionnement, schema, points d'attention..." />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--s3)', borderRadius: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.food_safe} onChange={e => setField('food_safe', e.target.checked)} style={{ accentColor: 'var(--acc)' }} />
            <span style={{ fontSize: 13 }}>Machine en zone alimentaire</span>
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="form-label">Photos / documents</label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 12px', background: 'var(--s3)', borderRadius: 8, cursor: 'pointer', border: '1px dashed var(--b1)' }}>
              <span style={{ fontSize: 13, color: 'var(--t2)' }}>{form.files.length > 0 ? `${form.files.length} fichier(s) selectionne(s)` : 'Ajouter des photos ou documents'}</span>
              <span className="btn btn-ghost btn-xs">Choisir</span>
              <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" multiple style={{ display: 'none' }} onChange={e => setField('files', e.target.files ? Array.from(e.target.files) : [])} />
            </label>
          </div>

          {error && <div style={{ padding: '10px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 12.5, color: '#ff4757' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.name.trim() || saving} onClick={save}>
            {saving ? 'Ajout...' : 'Ajouter la machine'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewInterventionModal({
  equipment,
  user,
  technicians,
  onClose,
  onSave,
  error,
}: {
  equipment: Equipment
  user: Profile
  technicians: Profile[]
  onClose: () => void
  onSave: (payload: { title: string; description: string; priority: Priority; technician_id: string }) => Promise<void>
  error?: string | null
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'normale' as Priority,
    technician_id: user.role === 'technician' ? user.id : '',
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 600 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Nouvelle intervention</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{equipment.name}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Titre *</label>
            <input className="form-input" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} placeholder="ex: Diagnostic fuite hydraulique" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Decrire le probleme ou l'action a realiser..." />
          </div>

          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Priorite</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(Object.keys(PRIORITY_CONFIG) as Priority[]).map(priority => {
                  const cfg = PRIORITY_CONFIG[priority]
                  return (
                    <button
                      key={priority}
                      className="btn btn-ghost btn-sm"
                      onClick={() => setForm(prev => ({ ...prev, priority }))}
                      style={form.priority === priority ? {
                        borderColor: cfg.color,
                        color: cfg.color,
                        background: `${cfg.color}18`,
                      } : undefined}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {user.role !== 'technician' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Technicien</label>
                <select className="form-select" value={form.technician_id} onChange={e => setForm(prev => ({ ...prev, technician_id: e.target.value }))}>
                  <option value="">Non assigne</option>
                  {technicians.map(tech => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && <div style={{ padding: '10px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 12.5, color: '#ff4757' }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!form.title.trim() || saving} onClick={save}>
            {saving ? 'Creation...' : 'Creer l’intervention'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ─── EDIT MACHINE MODAL ──────────────────────────────────────
function EditMachineModal({ equipment, onClose, onSave }: { equipment: Equipment; onClose: () => void; onSave: (updates: Partial<Equipment>) => Promise<void> }) {
  const [form, setForm] = useState({
    name: equipment.name || '',
    serial: equipment.serial || '',
    manufacturer: (equipment as any).manufacturer || '',
    installation_date: (equipment as any).installation_date || '',
    location: equipment.location || '',
    category: equipment.category || '',
    zone: (equipment.zone || 'A') as ZoneKey,
    schema_desc: equipment.schema_desc || '',
    manual_ref: equipment.manual_ref || '',
    food_safe: equipment.food_safe || false,
    next_inspection: equipment.next_inspection || '',
  })
  const [saving, setSaving] = useState(false)
  const s = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(p => ({ ...p, [k]: v }))
  const save = async () => {
    setSaving(true)
    try {
      await onSave({
        name: form.name.trim(), serial: form.serial.trim(),
        manufacturer: form.manufacturer.trim() || null as never,
        installation_date: form.installation_date || null as never,
        location: form.location.trim(), category: form.category.trim(),
        zone: form.zone, schema_desc: form.schema_desc.trim(),
        manual_ref: form.manual_ref.trim(), food_safe: form.food_safe,
        next_inspection: form.next_inspection || null as never,
      })
    } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 620 }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Modifier — {equipment.name}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.name} onChange={e => s('name', e.target.value)} />
          </div>
          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">N° de série</label>
              <input className="form-input" value={form.serial} onChange={e => s('serial', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Zone</label>
              <select className="form-select" value={form.zone} onChange={e => s('zone', e.target.value as ZoneKey)}>
                {(Object.keys(ZONE_CONFIG) as ZoneKey[]).map(z => (
                  <option key={z} value={z}>Zone {z} — {ZONE_CONFIG[z].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Fabricant</label>
              <input className="form-input" value={form.manufacturer} onChange={e => s('manufacturer', e.target.value)} placeholder="ex: Bosch, Sapal..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Date d'installation</label>
              <input className="form-input" type="date" value={form.installation_date} onChange={e => s('installation_date', e.target.value)} />
            </div>
          </div>
          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Localisation</label>
              <input className="form-input" value={form.location} onChange={e => s('location', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Catégorie</label>
              <input className="form-input" value={form.category} onChange={e => s('category', e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" value={form.schema_desc} onChange={e => s('schema_desc', e.target.value)} style={{ minHeight: 70 }} />
          </div>
          <div className="grid-2">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Réf. manuel</label>
              <input className="form-input" value={form.manual_ref} onChange={e => s('manual_ref', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Prochaine inspection</label>
              <input className="form-input" type="date" value={form.next_inspection} onChange={e => s('next_inspection', e.target.value)} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.food_safe} onChange={e => s('food_safe', e.target.checked)} style={{ accentColor: '#00d0d8', width: 15, height: 15 }} />
            <span style={{ fontSize: 13 }}>Zone alimentaire</span>
          </label>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button onClick={save} disabled={saving || !form.name.trim()} className="btn btn-primary">
            {saving ? 'Enregistrement…' : '✓ Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlanPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { equipments, interventions: allInterventions, technicians, loading, reload, reloadInterventions, updateEquipment } = useData()
  const [localEq, setLocalEq] = useState<Equipment[]>([])
  const displayEquipments = localEq.length > 0 ? localEq : equipments
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Equipment | null>(null)
  const [planMode, setPlanMode] = useState<'schema' | 'photo'>('schema')
  const [showAddMachine, setShowAddMachine] = useState(false)
  const [editMachine, setEditMachine] = useState<Equipment | null>(null)
  const [createFor, setCreateFor] = useState<Equipment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const load = async () => {
    // Recharger uniquement les équipements — pas tout le DataStore
    const eqs = await equipmentsApi.getAll()
    setLocalEq(eqs)
  }

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(() => (
    statusFilter === 'all' ? displayEquipments : displayEquipments.filter(eq => eq.status === statusFilter)
  ), [equipments, statusFilter])

  const groupedByZone = useMemo(() => {
    const grouped: Record<ZoneKey, Equipment[]> = { A: [], B: [], C: [], D: [] }
    filtered.forEach(eq => {
      const zone = (eq.zone || 'A') as ZoneKey
      if (grouped[zone]) grouped[zone].push(eq)
    })
    return grouped
  }, [filtered])

  if (!user) {
  return (
    <AppLayout>
      <div className="empty-state">
        <span>Chargement utilisateur...</span>
      </div>
    </AppLayout>
  )
}

  const handleAddEquipment = async (payload: Partial<Equipment>, files: File[]) => {
    setError(null)
    const created = await equipmentsApi.create({ ...payload, organization_id: user.organization_id })
    if (!created) throw new Error('La machine n’a pas pu etre creee.')
    if (files.length > 0) {
      await Promise.all(files.map(file => filesApi.upload(`equipments/${created.id}`, file)))
    }
    await auditApi.log(user.id, 'Equipement cree', created.name, `Zone ${created.zone || '—'}`)
    await load()
    showToast('Machine ajoutée')
  }

  const handleCreateIntervention = async (equipment: Equipment, payload: { title: string; description: string; priority: Priority; technician_id: string }) => {
    setError(null)
    const created = await interventionsApi.create({
      title: payload.title,
      description: payload.description,
      equipment_id: equipment.id,
      technician_id: payload.technician_id || null as never,
      created_by: user.id,
      priority: payload.priority,
      status: 'a_faire',
      organization_id: user.organization_id,
    })
    if (!created) throw new Error('L’intervention n’a pas pu etre creee.')
    await auditApi.log(user.id, 'Intervention creee', payload.title, `Equipement: ${equipment.name}`)
    showToast('Intervention creee')
    router.push('/interventions')
  }

  const handleEdit = (equipment: Equipment) => {
    setEditMachine(equipment)
    setSelected(null)
  }

  const handleArchive = async (equipment: Equipment) => {
    if (!confirm(`Archiver "${equipment.name}" ?

La machine sera masquée mais ses données et interventions seront conservées.`)) return
    try {
      await equipmentsApi.update(equipment.id, { status: 'maintenance', color: '#4a4a4a', name: `[ARCHIVÉ] ${equipment.name}` })
      setLocalEq(prev => (prev.length > 0 ? prev : equipments).map(e => e.id === equipment.id ? { ...e, status: 'maintenance' as any, name: `[ARCHIVÉ] ${equipment.name}` } : e))
      setSelected(null)
      showToast('Machine archivée')
      auditApi.log(user!.id, 'Machine archivée', equipment.name, `Zone ${equipment.zone}`)
    } catch (e: any) {
      alert('Erreur : ' + (e.message || 'Archivage échoué'))
    }
  }

  const handleDelete = async (equipment: Equipment) => {
    if (!confirm(`Supprimer "${equipment.name}" ?

Cette action est irréversible.`)) return
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.from('equipments').delete().eq('id', equipment.id)
      if (error) throw error
      setLocalEq(prev => (prev.length > 0 ? prev : equipments).filter(e => e.id !== equipment.id))
      setSelected(null)
      showToast('Machine supprimée')
      auditApi.log(user!.id, 'Machine supprimée', equipment.name, `Zone ${equipment.zone}`)
    } catch (e: any) {
      alert('Erreur : ' + (e.message || 'Suppression échouée'))
    }
  }

  const handleStatusChange = async (equipment: Equipment, status: EqStatus) => {
    if (!canManage) return
    // Mise à jour optimiste locale immédiate
    setLocalEq(prev => (prev.length > 0 ? prev : equipments).map(e => e.id === equipment.id ? { ...e, status } : e))
    setSelected(prev => prev ? { ...prev, status } : prev)
    updateEquipment(equipment.id, { status })

    const now = new Date().toISOString()
    if (!networkStatus.isOnline()) {
      // Offline → sauvegarder en queue
      await pendingWrites.add('equipments', 'update', { id: equipment.id, status, updated_at: now })
      await syncManager.notifyPending()
      showToast(`Statut → ${EQ_STATUS_CONFIG[status].label} (hors ligne)`)
      return
    }

    try {
      const updated = await equipmentsApi.update(equipment.id, { status })
      if (!updated) throw new Error('Pas de retour Supabase')
      auditApi.log(user.id, 'Statut equipement modifie', equipment.name, `→ ${EQ_STATUS_CONFIG[status].label}`)
      showToast(`Statut → ${EQ_STATUS_CONFIG[status].label}`)
    } catch (e: any) {
      console.error('[Plan] Erreur statut:', e)
      // Sauvegarder offline en cas d'erreur réseau
      await pendingWrites.add('equipments', 'update', { id: equipment.id, status, updated_at: now })
      await syncManager.notifyPending()
      showToast(`Statut sauvegardé hors ligne`)
    }
  }

  const handleLinkPart = async (equipment: Equipment, partId: string) => {
    await equipmentsApi.linkPart(equipment.id, partId)
    showToast('Piece associee a la machine')
  }

  const handleUnlinkPart = async (equipment: Equipment, partId: string) => {
    await equipmentsApi.unlinkPart(equipment.id, partId)
    showToast('Piece retiree de la compatibilite')
  }

  const handleUploadEquipmentFiles = async (equipment: Equipment, files: File[]) => {
    if (files.length > 0) {
      await Promise.all(files.map(file => filesApi.upload(`equipments/${equipment.id}`, file)))
    }
    showToast('Fichier(s) machine ajoute(s)')
  }

  const handleUpdateMaintenance = async (equipment: Equipment, updates: Partial<Equipment>) => {
    if (!canManage) return
    await equipmentsApi.update(equipment.id, updates)
    await auditApi.log(user.id, 'Maintenance preventive modifiee', equipment.name, `Prochaine: ${updates.next_preventive || equipment.next_preventive || '—'}`)
    await load()
    setSelected(prev => prev ? { ...prev, ...updates } : prev)
    showToast('Maintenance sauvegardee')
  }

  return (
    <AppLayout>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--acc)', color: '#000', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          ✓ {toast}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 12 }}>
        <div>
          <div className="page-title">Plan du site</div>
          <div className="page-sub">Vue machines reliee a Supabase, par zone et par statut</div>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowAddMachine(true)}>
            + Ajouter une machine
          </button>
        )}
      </div>

      {error && (
        <div className="alert-bar" style={{ background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', color: '#ff4757' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setStatusFilter('all')}
          style={statusFilter === 'all' ? { borderColor: 'var(--acc)', color: 'var(--acc)', background: 'var(--acc-dim)' } : undefined}
        >
          Tous
        </button>
        {(Object.keys(EQ_STATUS_CONFIG) as EqStatus[]).map(status => {
          const cfg = EQ_STATUS_CONFIG[status]
          return (
            <button
              key={status}
              className="btn btn-ghost btn-sm"
              onClick={() => setStatusFilter(status)}
              style={statusFilter === status ? {
                borderColor: cfg.color,
                color: cfg.color,
                background: `${cfg.color}18`,
              } : undefined}
            >
              {cfg.label}
            </button>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
          {filtered.length} equipement(s)
        </span>
      </div>

      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700 }}>Cartographie machines</span>
          <span style={{ fontSize: 11, color: 'var(--t2)' }}>Cliquez sur une machine pour ouvrir sa fiche</span>
        </div>

        <div style={{ padding: 16 }}>
          {/* Toggle plan photo / plan schématique */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setPlanMode('schema')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: planMode === 'schema' ? 'rgba(0,208,216,.15)' : 'transparent', color: planMode === 'schema' ? '#00d0d8' : 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>Schématique</button>
            <button onClick={() => setPlanMode('photo')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', background: planMode === 'photo' ? 'rgba(0,208,216,.15)' : 'transparent', color: planMode === 'photo' ? '#00d0d8' : 'var(--t2)', fontSize: 12, cursor: 'pointer' }}>Plan réel</button>
          </div>

          <div style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', background: '#080909' }}>
            {/* Image du plan réel en fond */}
            {planMode === 'photo' && (
              <img
                src="/plan-site.png"
                alt="Plan du site"
                style={{ width: '100%', display: 'block', opacity: 0.85, filter: 'brightness(0.9) contrast(1.1)' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}

          <svg viewBox="0 0 100 100" style={{ width: '100%', minHeight: planMode === 'photo' ? 0 : 180, position: planMode === 'photo' ? 'absolute' : 'relative', top: 0, left: 0, display: 'block', background: planMode === 'photo' ? 'transparent' : '#080909' }}>
            {planMode === 'schema' && <>
            <rect width="100" height="100" fill="#080909" />
            <defs>
              <pattern id="grid-plan" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M5 0L0 0 0 5" fill="none" stroke="rgba(255,255,255,.025)" strokeWidth=".3" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid-plan)" />

            {(Object.entries(ZONE_CONFIG) as [ZoneKey, typeof ZONE_CONFIG[ZoneKey]][]).map(([zone, cfg]) => (
              <g key={zone}>
                <rect x={cfg.x} y={cfg.y} width={cfg.w} height={cfg.h} rx="2" fill={`${cfg.color}10`} stroke={`${cfg.color}55`} strokeWidth=".5" />
                <text x={cfg.x + 2} y={cfg.y + 4} fill={cfg.color} fontSize="2.4" fontFamily="JetBrains Mono" fontWeight="700">Zone {zone}</text>
                <text x={cfg.x + 2} y={cfg.y + 7} fill={`${cfg.color}bb`} fontSize="1.9" fontFamily="JetBrains Mono">{cfg.label}</text>
              </g>
            ))}
            </>}

            {filtered.map(eq => {
              const statusCfg = EQ_STATUS_CONFIG[eq.status]
              const active = selected?.id === eq.id
              const x = Number(eq.pos_x ?? 50)
              const y = Number(eq.pos_y ?? 50)
              const w = Number(eq.pos_w ?? 10)
              const h = Number(eq.pos_h ?? 8)

              return (
                <g key={eq.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(eq)}>
                  <rect
                    x={x} y={y} width={w} height={h} rx="1.5"
                    fill={active ? `${eq.color}30` : `${eq.color}16`}
                    stroke={active ? eq.color : `${eq.color}88`}
                    strokeWidth={active ? '.8' : '.45'}
                    style={{ filter: active ? `drop-shadow(0 0 4px ${eq.color}88)` : 'none', transition: 'all .12s' }}
                  />
                  {/* Icône machine générique */}
                  <rect x={x+1} y={y+1.5} width={3} height={h-3} rx=".5" fill={`${eq.color}40`} />
                  <rect x={x+1.3} y={y+1.8} width={2.4} height={1.2} rx=".3" fill={eq.color} opacity=".6" />
                  {/* Pastille statut */}
                  <circle cx={x + w - 1.4} cy={y + 1.4} r="1.1" fill={statusCfg.color} />
                  {/* Badge alimentaire */}
                  {eq.food_safe && <text x={x + 1} y={y + 2.8} fill="rgba(0,208,216,.85)" fontSize="1.7" fontFamily="JetBrains Mono">✓</text>}
                  {/* Nom machine */}
                  <text
                    x={x + w / 2 + 1}
                    y={y + h / 2 + .6}
                    textAnchor="middle"
                    fill={active ? eq.color : 'rgba(255,255,255,.85)'}
                    fontSize="1.9"
                    fontFamily="JetBrains Mono"
                    fontWeight="700"
                  >
                    {eq.name.length > 12 ? `${eq.name.slice(0, 11)}…` : eq.name}
                  </text>
                  {/* Indicateur QR */}
                  <text x={x + w - 2.8} y={y + h - 1} fill={`${eq.color}99`} fontSize="1.5" fontFamily="JetBrains Mono">QR</text>
                </g>
              )
            })}

            {planMode === 'schema' && (
              <g transform="translate(95,6)">
                <circle cx="0" cy="0" r="2.8" fill="#111315" stroke="rgba(255,255,255,.08)" strokeWidth=".4" />
                <text x="0" y=".8" textAnchor="middle" fill="#e4e8f0" fontSize="2.5" fontFamily="JetBrains Mono" fontWeight="700">N</text>
              </g>
            )}
          </svg>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><span>Chargement…</span></div>
      ) : (
        (Object.entries(groupedByZone) as [ZoneKey, Equipment[]][]).map(([zone, zoneEquipments]) => {
          if (zoneEquipments.length === 0) return null
          const zoneCfg = ZONE_CONFIG[zone]
          return (
            <div key={zone} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: zoneCfg.color }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: zoneCfg.color }}>Zone {zone}</span>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{zoneCfg.label}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{zoneEquipments.length} machine(s)</span>
              </div>

              <div className="grid-3">
                {zoneEquipments.map(eq => {
                  const statusCfg = EQ_STATUS_CONFIG[eq.status]
                  return (
                    <div key={eq.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(eq)}>
                      <div style={{ height: 3, background: eq.color || zoneCfg.color }} />
                      <div style={{ padding: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          <span className="badge" style={{ background: `${statusCfg.color}18`, color: statusCfg.color }}>{statusCfg.label}</span>
                          {eq.food_safe && <span className="badge" style={{ background: 'rgba(0,208,216,.12)', color: 'var(--acc)' }}>Alim.</span>}
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{eq.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>{eq.location || 'Localisation non renseignee'}</div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{eq.serial || 'Sans n° de serie'}</div>
                        <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 8 }}>
                          Inspection : <span style={{ color: eq.next_inspection && new Date(eq.next_inspection) < new Date() ? 'var(--red)' : 'var(--t1)' }}>{fmt(eq.next_inspection)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {selected && (
        <EquipmentDetailModal
          equipment={selected}
          canManage={canManage}
          interventions={allInterventions}
          onClose={() => setSelected(null)}
          onCreateIntervention={(equipment) => {
            setSelected(null)
            setCreateFor(equipment)
          }}
          onStatusChange={handleStatusChange}
          onLinkPart={handleLinkPart}
          onUnlinkPart={handleUnlinkPart}
          onUploadFiles={handleUploadEquipmentFiles}
          onUpdateMaintenance={handleUpdateMaintenance}
          onDelete={handleDelete}
          onArchive={handleArchive}
          onEdit={handleEdit}
          organizationId={user?.organization_id}
        />
      )}

      {editMachine && (
        <EditMachineModal
          equipment={editMachine}
          onClose={() => setEditMachine(null)}
          onSave={async (updates) => {
            await equipmentsApi.update(editMachine.id, updates)
            setLocalEq(prev => (prev.length > 0 ? prev : equipments).map(e => e.id === editMachine.id ? { ...e, ...updates } : e))
            setEditMachine(null)
            showToast('Machine mise à jour ✓')
            auditApi.log(user!.id, 'Machine modifiée', editMachine.name, '')
          }}
        />
      )}

      {showAddMachine && (
        <AddEquipmentModal
          error={error}
          onClose={() => setShowAddMachine(false)}
          onSave={async (payload, files) => {
            try {
              await handleAddEquipment(payload, files)
              setShowAddMachine(false)
            } catch (e: any) {
              setError(e.message || 'Impossible d’ajouter la machine.')
              throw e
            }
          }}
        />
      )}

      {createFor && (
        <NewInterventionModal
          equipment={createFor}
          user={user}
          technicians={technicians}
          error={error}
          onClose={() => setCreateFor(null)}
          onSave={async payload => {
            try {
              await handleCreateIntervention(createFor, payload)
              setCreateFor(null)
            } catch (e: any) {
              setError(e.message || 'Impossible de creer l’intervention.')
              throw e
            }
          }}
        />
      )}
    </AppLayout>
  )
}
