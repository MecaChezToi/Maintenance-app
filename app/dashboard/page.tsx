'use client'

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
              background: 'rgba(0,200,150,.55)',
              border: '1px solid rgba(0,200,150,.25)',
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

  // Calcul conformité
  const done = interventions.filter(i => i.report_verdict)
  const conforme = done.filter(i => i.report_verdict === 'conforme').length
  const conformRate = done.length ? Math.round((conforme / done.length) * 100) : 0

  // Durée moyenne
  const withDuration = interventions.filter(i => i.report_duration && i.report_duration > 0)
  const avgDur = withDuration.length
    ? Math.round(withDuration.reduce((s, i) => s + (i.report_duration || 0), 0) / withDuration.length)
    : 0

  // Valeur stock
  const stockVal = stock.reduce((s, p) => s + (p.qty * (p.price || 0)), 0)

  // KPIs selon rôle
  const kpis = isTech ? [
    { value: myOT.length, label: 'Mes interventions', sub: `${myOT.filter(i => i.status === 'a_faire').length} à faire`, color: '#00c896', icon: '🔧' },
    { value: myOT.filter(i => i.status === 'en_cours').length, label: 'En cours', sub: 'interventions actives', color: '#3c82e8', icon: '⚡' },
    { value: myOT.filter(i => ['termine','valide'].includes(i.status)).length, label: 'Terminées', sub: 'rapports complétés', color: '#a855f7', icon: '✅' },
    { value: myOT.filter(i => i.report_verdict).length, label: 'Rapports signés', sub: 'documents PDF', color: '#f59e0b', icon: '📄' },
  ] : [
    { value: equipments.length, label: 'Équipements', sub: `${pannes.length} en panne`, color: '#00c896', icon: '⚙️' },
    { value: conformRate ? `${conformRate}%` : '—', label: 'Conformité', sub: 'IFS/BRC · obj ≥95%', color: conformRate >= 90 ? '#00c896' : '#f59e0b', icon: '🛡️' },
    { value: interventions.filter(i => i.status === 'a_faire').length, label: 'OT en attente', sub: 'à planifier', color: '#f59e0b', icon: '📋' },
    { value: foodAlerts.length, label: 'Alertes alim.', sub: 'risques non clôturés', color: foodAlerts.length > 0 ? '#ff4757' : '#00c896', icon: '🚨' },
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
    { label: 'Terminé',  value: myOT.filter(i => i.status === 'termine').length,  color: '#00c896' },
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
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 2 }}>
          Bonjour, {user.name.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--t2)' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {siteConfig && <span style={{ marginLeft: 8, color: 'var(--t3)' }}>· {siteConfig.name}</span>}
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 96, borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid var(--b0)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
        </div>
      )}

      {/* Ligne principale */}
      <div style={{ display: 'grid', gridTemplateColumns: !isTech ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>

        {/* Interventions récentes */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b0)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{isTech ? 'Mes ordres de travail' : 'Interventions récentes'}</span>
            <a href="/interventions" style={{ fontSize: 11, color: '#00c896', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Voir tout →</a>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2)', fontSize: 13 }}>Chargement…</div>
          ) : myOT.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2)', opacity: .5 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 13 }}>Aucune intervention</div>
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
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}>Aucune donnée</div>
                ) : (
                  <>
                    <MiniBarChart data={monthly} />
                    <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
                        <div style={{ width: 8, height: 8, background: 'rgba(0,200,150,.55)', borderRadius: 2 }} />Total
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
                  <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}>Aucune donnée</div>
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
                { label: 'Rapports signés', value: done.length, color: '#a855f7' },
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
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Aucun équipement</div>
            ) : upcoming.map(eq => {
              const days = Math.floor((new Date(eq.next_inspection).getTime() - Date.now()) / 86400000)
              const overdue = days < 0
              const urgent = days < 30
              return (
                <div key={eq.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--b0)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: overdue ? '#ff4757' : urgent ? '#f59e0b' : '#00c896', flexShrink: 0 }} />
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
          <div style={{ background: 'rgba(0,200,150,.03)', border: '1px solid rgba(0,200,150,.15)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#00c896' }}>
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
                { label: 'Opérationnels', count: equipments.filter(e => e.status === 'ok').length, color: '#00c896' },
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
