'use client'

import { useState, useEffect, useRef } from 'react'
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

// ── Mini bar chart SVG ──────────────────────────────────────
function MiniBarChart({ data }: { data: { label: string; v: number; crit: number }[] }) {
  const max = Math.max(1, ...data.map(d => d.v))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 96 }}>
            <div style={{
              flex: 1, borderRadius: '4px 4px 0 0',
              height: `${Math.max(4, (d.v / max) * 96)}px`,
              background: 'rgba(0,208,216,.55)',
              border: '1px solid rgba(0,208,216,.25)',
              transition: 'height .4s ease',
            }} />
            {d.crit > 0 && (
              <div style={{
                flex: 1, borderRadius: '4px 4px 0 0',
                height: `${Math.max(4, (d.crit / max) * 96)}px`,
                background: 'rgba(255,71,87,.7)',
                border: '1px solid rgba(255,71,87,.3)',
                transition: 'height .4s ease',
              }} />
            )}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{d.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Donut chart SVG ─────────────────────────────────────────
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
        <text x={48} y={52} textAnchor="middle" fill="var(--t1)"
          fontSize={18} fontWeight={800} fontFamily="var(--font-mono)">{total}</text>
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

// ── (conformité supprimée) ───────────────────────────────────

// ── Equipment Carousel ──────────────────────────────────────
function EquipmentCarousel({ equipments, interventions }: { equipments: Equipment[]; interventions: Intervention[] }) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const eqs = equipments.slice(0, 12) // max 12 machines

  useEffect(() => {
    if (eqs.length <= 1 || paused) return
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % eqs.length)
    }, 4000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [eqs.length, paused])

  if (eqs.length === 0) return null

  const eq = eqs[current]
  const eqInts = interventions.filter(i => i.equipment_id === eq.id)

  // KPIs calculés pour cette machine
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
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
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

      {/* Corps */}
      <div style={{ padding: '14px 16px' }}>
        {/* Nom + statut */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{eq.name}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>{eq.location || '—'}{eq.zone ? ` · Zone ${eq.zone}` : ''}</div>
          </div>
          <span style={{ fontSize: 10, padding: '3px 9px', borderRadius: 20, background: `${sc}18`, color: sc, fontWeight: 600, flexShrink: 0, border: `1px solid ${sc}33` }}>
            {statusLabels[eq.status] || eq.status}
          </span>
        </div>

        {/* KPIs grille */}
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

        {/* Barre dispo + points navigation */}
        <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${dispo}%`, background: dispoColor, borderRadius: 2, transition: 'width .4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
          {eqs.map((_, i) => (
            <button key={i} onClick={() => { setCurrent(i); setPaused(true) }}
              style={{ width: i === current ? 16 : 5, height: 5, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                background: i === current ? '#00d0d8' : 'rgba(255,255,255,.12)', transition: 'all .25s ease' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ────────────────────────────────────────────────
function KpiCard({ value, label, sub, color, icon }: {
  value: string | number; label: string; sub?: string; color: string; icon: string
}) {
  return (
    <div style={{
      background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12,
      padding: 18, position: 'relative', overflow: 'hidden',
      transition: 'border-color .15s, transform .15s', cursor: 'default',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b1)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--b0)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >
      <div style={{ position: 'absolute', right: 14, top: 14, fontSize: 28, opacity: .08 }}>{icon}</div>
      <div style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5, fontFamily: 'var(--font-mono)' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { equipments, interventions, parts: stock, siteConfig, loading } = useData()

  if (!user) return null

  const isTech = user.role === 'technician'
  const myOT = isTech ? interventions.filter(i => i.technician_id === user.id) : interventions
  const lowStock = stock.filter(p => p.qty <= p.min_qty)
  const foodAlerts = interventions.filter(i => i.food_impact && i.status !== 'valide')
  const pannes = equipments.filter(e => e.status === 'panne')

  // Durée moyenne
  const withDuration = interventions.filter(i => i.report_duration && i.report_duration > 0)
  const avgDur = withDuration.length
    ? Math.round(withDuration.reduce((s, i) => s + (i.report_duration || 0), 0) / withDuration.length)
    : 0

  // Valeur stock
  const stockVal = stock.reduce((s, p) => s + (p.qty * (p.price || 0)), 0)

  // KPIs
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

  // Barres mensuelles (6 derniers mois)
  const monthly = (() => {
    const map = new Map<string, { total: number; crit: number }>()
    myOT.forEach(i => {
      const k = monthKey(i.created_at)
      const cur = map.get(k) || { total: 0, crit: 0 }
      map.set(k, { total: cur.total + 1, crit: cur.crit + (i.priority === 'critique' ? 1 : 0) })
    })
    const keys = Array.from(map.keys()).sort().slice(-6)
    return keys.map(k => ({
      label: new Date(k + '-01').toLocaleDateString('fr-FR', { month: 'short' }),
      v: map.get(k)?.total || 0,
      crit: map.get(k)?.crit || 0,
    }))
  })()

  // Donut statuts
  const donutData = [
    { label: 'À faire',  value: myOT.filter(i => i.status === 'a_faire').length,  color: '#f59e0b' },
    { label: 'En cours', value: myOT.filter(i => i.status === 'en_cours').length, color: '#3c82e8' },
    { label: 'Terminé',  value: myOT.filter(i => i.status === 'termine').length,  color: '#00d0d8' },
    { label: 'Validé',   value: myOT.filter(i => i.status === 'valide').length,   color: '#a855f7' },
  ]

  // Prochaines inspections
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
        <a href="/interventions" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: '#00d0d8', color: '#000', borderRadius: 8,
          padding: '9px 16px', fontWeight: 700, fontSize: 13,
          textDecoration: 'none', flexShrink: 0,
          boxShadow: '0 0 20px rgba(0,208,216,.25)',
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Nouvel OT
        </a>
      </div>

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
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 96, borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid var(--b0)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
          
        </div>
      )}

      {/* Carrousel machines */}
      {!isTech && equipments.length > 0 && !loading && (
        <EquipmentCarousel equipments={equipments} interventions={interventions} />
      )}

      {/* Ligne principale */}
      <div style={{ display: 'grid', gridTemplateColumns: !isTech ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>

        {/* Interventions récentes */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{isTech ? 'Mes ordres de travail' : 'Interventions récentes'}</span>
            <a href="/interventions" style={{ fontSize: 11, color: '#00d0d8', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Voir tout →</a>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2)', fontSize: 13 }}>Chargement…</div>
          ) : myOT.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <svg width={56} height={56} viewBox="0 0 56 56" fill="none">
                <circle cx={28} cy={28} r={27} stroke="rgba(0,208,216,.15)" strokeWidth={1.5} />
                <rect x={16} y={18} width={24} height={4} rx={2} fill="rgba(0,208,216,.25)" />
                <rect x={16} y={26} width={18} height={3} rx={1.5} fill="rgba(0,208,216,.15)" />
                <rect x={16} y={33} width={20} height={3} rx={1.5} fill="rgba(0,208,216,.15)" />
                <circle cx={38} cy={38} r={8} fill="rgba(0,208,216,.12)" stroke="rgba(0,208,216,.3)" strokeWidth={1.5} />
                <text x={38} y={42} textAnchor="middle" fill="#00d0d8" fontSize={10} fontWeight={800}>+</text>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>Aucune intervention</div>
              <div style={{ fontSize: 12, color: 'var(--t3)', maxWidth: 200, lineHeight: 1.5 }}>Créez votre premier ordre de travail pour commencer le suivi</div>
              <a href="/interventions" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(0,208,216,.12)', border: '1px solid rgba(0,208,216,.25)', color: '#00d0d8', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                + Créer un OT
              </a>
            </div>
          ) : (
            myOT.slice(0, 7).map(i => {
              const sc = STATUS_CONFIG[i.status]
              const pc = PRIORITY_CONFIG[i.priority]
              return (
                <a key={i.id} href="/interventions" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid var(--b0)', transition: 'background .08s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,.015)'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                >
                  <div style={{ width: 3, height: 36, background: sc.color, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' }}>{i.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 1 }}>
                      {(i.equipment as any)?.name || '—'}
                      {i.production_stopped && <span style={{ color: '#ff4757', marginLeft: 6 }}>⚠ Prod.</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: sc.bg, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                    <span style={{ fontSize: 10, color: pc.color, fontFamily: 'var(--font-mono)' }}>{pc.label}</span>
                  </div>
                </a>
              )
            })
          )}
        </div>

        {/* Colonne droite — graphiques */}
        {!isTech && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Bar chart */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  📊 OT par mois
                  <span style={{ fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>6 mois</span>
                </div>
                {monthly.length === 0 ? (
                  <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                      <rect x={4} y={24} width={7} height={12} rx={2} fill="rgba(0,208,216,.2)" />
                      <rect x={14} y={16} width={7} height={20} rx={2} fill="rgba(0,208,216,.15)" />
                      <rect x={24} y={8} width={7} height={28} rx={2} fill="rgba(0,208,216,.1)" />
                      <path d="M4 24 L17 16 L27 8" stroke="rgba(0,208,216,.3)" strokeWidth={1.5} strokeDasharray="2 2" />
                    </svg>
                    <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', lineHeight: 1.4 }}>Les données s'afficheront<br />après vos premiers OT</div>
                  </div>
                ) : (
                  <>
                    <MiniBarChart data={monthly} />
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ width: 8, height: 8, background: 'rgba(0,208,216,.55)', borderRadius: 2 }} />Total
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ width: 8, height: 8, background: 'rgba(255,71,87,.7)', borderRadius: 2 }} />Critiques
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Donut */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>🥧 Répartition</div>
                {myOT.length === 0 ? (
                  <div style={{ height: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg width={48} height={48} viewBox="0 0 48 48" fill="none">
                      <circle cx={24} cy={24} r={18} stroke="rgba(255,255,255,.06)" strokeWidth={8} />
                      <circle cx={24} cy={24} r={18} stroke="rgba(0,208,216,.15)" strokeWidth={8} strokeDasharray="28 85" strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px' }} />
                      <circle cx={24} cy={24} r={18} stroke="rgba(59,130,232,.12)" strokeWidth={8} strokeDasharray="20 85" strokeDashoffset="-28" strokeLinecap="round" style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px' }} />
                    </svg>
                    <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', lineHeight: 1.4 }}>Répartition disponible<br />dès le 1er OT créé</div>
                  </div>
                ) : (
                  <DonutChart segments={donutData} />
                )}
              </div>
            </div>

            {/* Stats globales */}
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
      </div>

      {/* Ligne basse */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Prochaines inspections */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🕐 Prochaines inspections</span>
          </div>
          <div style={{ padding: '8px 18px' }}>
            {upcoming.length === 0 ? (
              <div style={{ padding: '28px 18px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <svg width={44} height={44} viewBox="0 0 44 44" fill="none">
                  <circle cx={22} cy={22} r={21} stroke="rgba(59,130,232,.15)" strokeWidth={1.5} />
                  <rect x={13} y={12} width={18} height={20} rx={3} stroke="rgba(59,130,232,.3)" strokeWidth={1.5} fill="none" />
                  <line x1={13} y1={18} x2={31} y2={18} stroke="rgba(59,130,232,.25)" strokeWidth={1} />
                  <line x1={17} y1={12} x2={17} y2={9} stroke="rgba(59,130,232,.3)" strokeWidth={1.5} strokeLinecap="round" />
                  <line x1={27} y1={12} x2={27} y2={9} stroke="rgba(59,130,232,.3)" strokeWidth={1.5} strokeLinecap="round" />
                  <rect x={17} y={22} width={4} height={4} rx={1} fill="rgba(59,130,232,.3)" />
                  <rect x={23} y={22} width={4} height={4} rx={1} fill="rgba(59,130,232,.2)" />
                </svg>
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
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                    color: overdue ? '#ff4757' : urgent ? '#f59e0b' : 'var(--t2)',
                    background: overdue ? 'rgba(255,71,87,.1)' : urgent ? 'rgba(255,165,2,.1)' : 'var(--s3)',
                  }}>
                    {overdue ? 'Dépassé' : `J−${days}`}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Certifications + équipements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Certifications */}
          <div style={{ background: 'rgba(0,208,216,.03)', border: '1px solid rgba(0,208,216,.15)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#00d0d8' }}>
              <span>🛡️</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Certifications actives</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7 }}>
              {siteConfig?.certifications || 'IFS Food v8 · BRC · ISO 22000 · HACCP'}
            </div>
            {siteConfig?.siret && (
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                SIRET : {siteConfig.siret}
              </div>
            )}
          </div>

          {/* Statut équipements */}
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
