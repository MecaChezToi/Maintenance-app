'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { useData } from '@/lib/DataStore'
import AppLayout from '@/components/layout/AppLayout'
import type { Equipment, Intervention, Part, SiteConfig } from '@/types'
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/types'

const fmt = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const monthKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function MiniBarChart({ data }: { data: { label: string; v: number; crit: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.v))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 96 }}>
            <div style={{ flex: 1, borderRadius: '4px 4px 0 0', height: `${Math.max(4, (d.v / max) * 96)}px`, background: 'rgba(0,208,216,.55)', border: '1px solid rgba(0,208,216,.25)', transition: 'height .4s ease' }} />
            {d.crit > 0 && <div style={{ flex: 1, borderRadius: '4px 4px 0 0', height: `${Math.max(4, (d.crit / max) * 96)}px`, background: 'rgba(255,71,87,.7)', border: '1px solid rgba(255,71,87,.3)', transition: 'height .4s ease' }} />}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  const r = 36
  const circ = 2 * Math.PI * r
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,.04)" strokeWidth={14} />
        {segments.filter(s => s.value > 0).map((seg, i) => {
          const pct = seg.value / total
          const dash = pct * circ
          const gap = circ - dash
          const el = (
            <circle key={i} cx={48} cy={48} r={r} fill="none"
              stroke={seg.color} strokeWidth={14}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circ}
              strokeLinecap="butt"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '48px 48px', transition: 'all .5s ease' }}
            />
          )
          offset += pct
          return el
        })}
        <text x={48} y={52} textAnchor="middle" fill="var(--t1)" fontSize={18} fontWeight={800} fontFamily="var(--font-mono)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--t2)', flex: 1 }}>{s.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EquipmentCarousel({ equipments, interventions }: { equipments: Equipment[]; interventions: Intervention[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const eqs = equipments.slice(0, 12)

  useEffect(() => {
    if (eqs.length <= 1 || paused) return
    timerRef.current = setInterval(() => { setCurrent(c => (c + 1) % eqs.length) }, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [eqs.length, paused])

  if (eqs.length === 0) return null

  const eq = eqs[current]
  const eqInts = interventions.filter(i => i.equipment_id === eq.id)
  const done = eqInts.filter(i => i.report_duration && i.report_duration > 0)
  const mttrMin = done.length ? Math.round(done.reduce((s, i) => s + (i.report_duration || 0), 0) / done.length) : null
  const mttrStr = mttrMin ? `${Math.floor(mttrMin / 60)}h${String(mttrMin % 60).padStart(2, '0')}` : '—'
  const sortedDates = eqInts.map(i => new Date(i.created_at).getTime()).sort((a, b) => a - b)
  let mtbfDays: number | null = null
  if (sortedDates.length >= 2) {
    const gaps = sortedDates.slice(1).map((t, i) => (t - sortedDates[i]) / 86400000)
    mtbfDays = Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length)
  }
  const open = eqInts.filter(i => !['termine','valide'].includes(i.status))
  const late = open.filter(i => (Date.now() - new Date(i.created_at).getTime()) / 86400000 > 7)
  const totalDownMin = done.reduce((s, i) => s + (i.report_duration || 0), 0)
  const dispo = Math.min(100, Math.round((1 - totalDownMin / (90 * 24 * 60)) * 1000) / 10)
  const dispoColor = dispo >= 98 ? '#00d0d8' : dispo >= 90 ? '#f59e0b' : '#ff4757'
  const mtbfColor = !mtbfDays ? 'var(--t3)' : mtbfDays >= 60 ? '#00d0d8' : mtbfDays >= 30 ? '#f59e0b' : '#ff4757'
  const statusColors: Record<string, string> = { ok: '#00d0d8', maintenance: '#f59e0b', panne: '#ff4757', inactif: '#7a8599' }
  const statusLabels: Record<string, string> = { ok: 'Opérationnel', maintenance: 'Maintenance', panne: 'En panne', inactif: 'Inactif' }
  const sc = statusColors[eq.status] || 'var(--t3)'

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>⚙️ Machines</span>
          <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-mono)' }}>{current + 1}/{eqs.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => { setCurrent(c => (c - 1 + eqs.length) % eqs.length); setPaused(true) }}
            style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--b0)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => { setCurrent(c => (c + 1) % eqs.length); setPaused(true) }}
            style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--b0)', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          <a href={`/eq/${eq.id}`} style={{ fontSize: 11, color: '#00d0d8', textDecoration: 'none', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>Fiche →</a>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{eq.name}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{eq.location || '—'}{eq.zone ? ` · Zone ${eq.zone}` : ''}</div>
          </div>
          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: `${sc}18`, color: sc, fontWeight: 600, flexShrink: 0, border: `1px solid ${sc}33` }}>
            {statusLabels[eq.status] || eq.status}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'MTBF', value: mtbfDays !== null ? `${mtbfDays}j` : '—', color: mtbfColor },
            { label: 'MTTR', value: mttrStr, color: '#3c82e8' },
            { label: 'OT ouverts', value: open.length, color: open.length > 0 ? '#f59e0b' : '#00d0d8' },
            { label: 'En retard', value: late.length, color: late.length > 0 ? '#ff4757' : '#00d0d8' },
            { label: 'Dispo.', value: `${dispo}%`, color: dispoColor },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: 'rgba(255,255,255,.03)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 8, color: 'var(--t3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${dispo}%`, background: dispoColor, borderRadius: 2, transition: 'width .4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
          {eqs.map((_, i) => (
            <button key={i} onClick={() => { setCurrent(i); setPaused(true) }}
              style={{ width: i === current ? 16 : 5, height: 5, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#00d0d8' : 'rgba(255,255,255,.12)', transition: 'all .25s ease' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ value, label, sub, color, icon }: { value: string | number; label: string; sub?: string; color: string; icon: string }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, padding: 18, position: 'relative', overflow: 'hidden', transition: 'border-color .15s, transform .15s', cursor: 'default' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b1)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b0)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}>
      <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 28, opacity: .08 }}>{icon}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { equipments, interventions, parts: stock, siteConfig, loading } = useData()

  // ── Scanner QR — tous les hooks avant tout return conditionnel ──
  const [showScanner, setShowScanner] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleQRResult = useCallback((raw: string) => {
    stopCamera()
    setShowScanner(false)
    const match = raw.match(/\/eq\/([a-zA-Z0-9-]+)/) || raw.match(/^([a-f0-9-]{36})$/)
    if (match) {
      window.location.href = `/eq/${match[1]}`
    } else {
      setScanError(`QR non reconnu : ${raw}`)
    }
  }, [stopCamera])

  const scanFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(scanFrame); return }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      detector.detect(canvas).then((codes: any[]) => {
        if (codes.length > 0) handleQRResult(codes[0].rawValue)
        else rafRef.current = requestAnimationFrame(scanFrame)
      }).catch(() => { rafRef.current = requestAnimationFrame(scanFrame) })
    } else {
      import('jsqr').then(({ default: jsQR }) => {
        const code = jsQR(imageData.data, canvas.width, canvas.height)
        if (code) handleQRResult(code.data)
        else rafRef.current = requestAnimationFrame(scanFrame)
      })
    }
  }, [handleQRResult])

  const startScanner = useCallback(async () => {
    setScanError(null)
    setShowScanner(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanFrame()
      }
    } catch {
      setScanError('Caméra inaccessible. Vérifiez les permissions.')
    }
  }, [scanFrame])

  useEffect(() => {
    if (!showScanner) stopCamera()
    return () => stopCamera()
  }, [showScanner, stopCamera])

  if (!user) return null

  const isTech = user.role === 'technician'
  const myOT = isTech ? interventions.filter(i => i.technician_id === user.id) : interventions
  const lowStock = stock.filter(p => p.qty <= p.min_qty)
  const foodAlerts = interventions.filter(i => i.food_impact && i.status !== 'valide')
  const pannes = equipments.filter(e => e.status === 'panne')

  const withDuration = interventions.filter(i => i.report_duration && i.report_duration > 0)
  const avgDur = withDuration.length ? Math.round(withDuration.reduce((s, i) => s + (i.report_duration || 0), 0) / withDuration.length) : 0
  const stockVal = stock.reduce((s, p) => s + (p.qty * (p.price || 0)), 0)

  const kpis = isTech ? [
    { value: myOT.length, label: 'Mes interventions', sub: `${myOT.filter(i => i.status === 'a_faire').length} à faire`, color: '#00d0d8', icon: '🔧' },
    { value: myOT.filter(i => i.status === 'en_cours').length, label: 'En cours', sub: 'interventions actives', color: '#3c82e8', icon: '⚡' },
    { value: myOT.filter(i => ['termine','valide'].includes(i.status)).length, label: 'Terminées', sub: 'rapports complétés', color: '#a855f7', icon: '✅' },
    { value: myOT.filter(i => i.report_verdict).length, label: 'Rapports signés', sub: 'documents PDF', color: '#f59e0b', icon: '📄' },
  ] : [
    { value: equipments.length, label: 'Équipements', sub: `${pannes.length} en panne`, color: '#00d0d8', icon: '⚙️' },
    { value: interventions.filter(i => i.status === 'a_faire').length, label: 'OT en attente', sub: 'à planifier', color: '#f59e0b', icon: '📋' },
    { value: foodAlerts.length, label: 'Alertes alim.', sub: 'risques non clôturés', color: foodAlerts.length > 0 ? '#ff4757' : '#00d0d8', icon: '🚨' },
    { value: interventions.filter(i => i.report_verdict).length, label: 'Rapports signés', sub: 'PDF générés', color: '#a855f7', icon: '📄' },
  ]

  const monthly = (() => {
    const map = new Map<string, { total: number; crit: number }>()
    myOT.forEach(i => {
      const k = monthKey(i.created_at)
      const cur = map.get(k) || { total: 0, crit: 0 }
      map.set(k, { total: cur.total + 1, crit: cur.crit + (i.priority === 'critique' ? 1 : 0) })
    })
    const keys = Array.from(map.keys()).sort().slice(-6)
    return keys.map(k => ({ label: new Date(k + '-01').toLocaleDateString('fr-FR', { month: 'short' }), v: map.get(k)?.total || 0, crit: map.get(k)?.crit || 0 }))
  })()

  const donutData = [
    { label: 'À faire',  value: myOT.filter(i => i.status === 'a_faire').length,  color: '#f59e0b' },
    { label: 'En cours', value: myOT.filter(i => i.status === 'en_cours').length, color: '#3c82e8' },
    { label: 'Terminé',  value: myOT.filter(i => i.status === 'termine').length,  color: '#00d0d8' },
    { label: 'Validé',   value: myOT.filter(i => i.status === 'valide').length,   color: '#a855f7' },
  ]

  const upcoming = equipments
    .filter(e => e.next_inspection)
    .sort((a, b) => new Date(a.next_inspection).getTime() - new Date(b.next_inspection).getTime())
    .slice(0, 5)

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 2 }}>
            Bonjour, {user.name.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--t2)' }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {siteConfig && <span style={{ marginLeft: 8, color: 'var(--t3)' }}>· {siteConfig.name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={startScanner} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'rgba(0,208,216,.1)', border: '1px solid rgba(0,208,216,.3)', borderRadius: 10, color: '#00d0d8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/>
              <rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>
            </svg>
            Scanner
          </button>
          <a href="/interventions" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#00d0d8', color: '#000', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, textDecoration: 'none', boxShadow: '0 0 20px rgba(0,208,216,.25)' }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nouvel OT
          </a>
        </div>
      </div>

      {/* Erreur scan */}
      {scanError && !showScanner && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 13, color: '#ff4757', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {scanError}
          <button onClick={() => setScanError(null)} style={{ background: 'none', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Modal Scanner */}
      {showScanner && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Scanner une machine</div>
          <div style={{ position: 'relative', width: 300, height: 300, borderRadius: 16, overflow: 'hidden', border: '2px solid rgba(0,208,216,.5)' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} playsInline muted />
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {(['top-left','top-right','bottom-left','bottom-right'] as const).map(pos => (
                <div key={pos} style={{
                  position: 'absolute', width: 28, height: 28,
                  ...(pos.includes('top') ? { top: 16 } : { bottom: 16 }),
                  ...(pos.includes('left') ? { left: 16 } : { right: 16 }),
                  borderTop: pos.includes('top') ? '3px solid #00d0d8' : 'none',
                  borderBottom: pos.includes('bottom') ? '3px solid #00d0d8' : 'none',
                  borderLeft: pos.includes('left') ? '3px solid #00d0d8' : 'none',
                  borderRight: pos.includes('right') ? '3px solid #00d0d8' : 'none',
                }} />
              ))}
              <div style={{ position: 'absolute', left: 28, right: 28, top: '50%', height: 2, background: 'rgba(0,208,216,.6)', animation: 'scan-line 2s ease-in-out infinite' }} />
            </div>
            {scanError && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.7)', padding: 16, textAlign: 'center', fontSize: 13, color: '#ff4757' }}>{scanError}</div>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>Pointez la caméra vers le QR code de la machine</div>
          <button onClick={() => setShowScanner(false)} className="btn btn-ghost">Annuler</button>
          <style>{`@keyframes scan-line { 0%,100% { transform: translateY(-60px); opacity: .4 } 50% { transform: translateY(60px); opacity: 1 } }`}</style>
        </div>
      )}

      {/* Alertes */}
      {foodAlerts.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.2)', borderRadius: 8, fontSize: 13, color: '#ff4757', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          🛡️ <strong>{foodAlerts.length}</strong> intervention(s) avec risque alimentaire non validée(s) — action requise
        </div>
      )}
      {lowStock.length > 0 && !isTech && (
        <div style={{ padding: '10px 14px', background: 'rgba(255,165,2,.08)', border: '1px solid rgba(255,165,2,.2)', borderRadius: 8, fontSize: 13, color: '#ffa502', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          📦 <strong>{lowStock.length}</strong> pièce(s) en stock critique
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 100, background: 'var(--s1)', borderRadius: 12, border: '1px solid var(--b0)', animation: 'pulse 1.5s infinite' }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
        </div>
      )}

      {/* Carousel machines */}
      {!loading && equipments.length > 0 && <EquipmentCarousel equipments={equipments} interventions={interventions} />}

      {/* Zone technicien */}
      {isTech && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>📊 Activité mensuelle</span>
            </div>
            <div style={{ padding: '14px 18px' }}>
              {monthly.length === 0 ? (
                <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>Aucune donnée</div>
              ) : <MiniBarChart data={monthly} />}
            </div>
          </div>
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>🥧 Répartition</div>
            {myOT.length === 0 ? (
              <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>Répartition disponible dès le 1er OT</div>
              </div>
            ) : <DonutChart segments={donutData} />}
          </div>
        </div>
      )}

      {/* Zone admin/chef */}
      {!isTech && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>📊 Activité mensuelle</span>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ width: 8, height: 8, background: 'rgba(0,208,216,.55)', borderRadius: 2 }} />Total
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ width: 8, height: 8, background: 'rgba(255,71,87,.7)', borderRadius: 2 }} />Critiques
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 18px' }}>
                {monthly.length === 0 ? (
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>Aucune donnée</div>
                ) : <MiniBarChart data={monthly} />}
              </div>
            </div>
            <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>🥧 Répartition</div>
              {myOT.length === 0 ? (
                <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', lineHeight: 1.4 }}>Répartition disponible<br />dès le 1er OT créé</div>
                </div>
              ) : <DonutChart segments={donutData} />}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[
              { label: 'Durée moy.', value: avgDur ? `${avgDur}min` : '—', color: '#3c82e8' },
              { label: 'Valeur stock', value: stockVal ? `${stockVal.toFixed(0)}€` : '—', color: '#f59e0b' },
              { label: 'Rapports signés', value: interventions.filter(i => i.report_verdict).length, color: '#a855f7' },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--s2)', border: '1px solid var(--b0)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.6px', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ligne basse */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🕐 Prochaines inspections</span>
          </div>
          <div style={{ padding: '8px 18px' }}>
            {upcoming.length === 0 ? (
              <div style={{ padding: '28px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Aucune inspection planifiée</div>
                <div style={{ fontSize: 11, color: 'var(--t3)', maxWidth: 180, lineHeight: 1.5 }}>Ajoutez une date d'inspection à vos équipements</div>
                <a href="/equipments" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(59,130,232,.1)', border: '1px solid rgba(59,130,232,.25)', color: '#3c82e8', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                  Gérer les équipements
                </a>
              </div>
            ) : upcoming.map(eq => {
              const days = Math.floor((new Date(eq.next_inspection).getTime() - Date.now()) / 86400000)
              const overdue = days < 0
              const urgent = days < 30
              return (
                <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--b0)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: overdue ? '#ff4757' : urgent ? '#f59e0b' : '#00d0d8', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{fmt(eq.next_inspection)}</div>
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4, flexShrink: 0, color: overdue ? '#ff4757' : urgent ? '#f59e0b' : 'var(--t2)', background: overdue ? 'rgba(255,71,87,.1)' : urgent ? 'rgba(255,165,2,.1)' : 'var(--s3)' }}>
                    {overdue ? 'Dépassé' : `J−${days}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'rgba(0,208,216,.03)', border: '1px solid rgba(0,208,216,.15)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#00d0d8' }}>
              <span>🛡️</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Certifications actives</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7 }}>
              {siteConfig?.certifications || 'IFS Food v8 · BRC · ISO 22000 · HACCP'}
            </div>
            {siteConfig?.siret && (
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>SIRET : {siteConfig.siret}</div>
            )}
          </div>
          {!isTech && (
            <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>⚙️ Statut équipements</div>
              {[
                { label: 'Opérationnels', count: equipments.filter(e => e.status === 'ok').length, color: '#00d0d8' },
                { label: 'En maintenance', count: equipments.filter(e => e.status === 'maintenance').length, color: '#f59e0b' },
                { label: 'En panne', count: equipments.filter(e => e.status === 'panne').length, color: '#ff4757' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--t2)' }}>{s.label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color }}>{s.count}</span>
                  <div style={{ width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${equipments.length ? (s.count / equipments.length) * 100 : 0}%`, background: s.color, borderRadius: 2 }} />
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
