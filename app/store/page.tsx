'use client'

import { useEffect, useState, useMemo } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import { useAuth } from '@/components/layout/AuthProvider'
import { partsApi, auditApi } from '@/lib/supabase'
import { useData } from '@/lib/DataStore'
import type { Part } from '@/types'

const today = () => new Date().toISOString().split('T')[0]
const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR')
const VAT_RATE = 0.21

// ─── ZONE CONFIG ──────────────────────────────────────────────
const ZONES: Record<string, { color: string; label: string; desc: string }> = {
  A: { color: '#3c82e8', label: 'Zone A', desc: 'Électrique · Filtration · Instrumentation' },
  B: { color: '#3cb87a', label: 'Zone B', desc: 'Joints · Pneumatique · Visserie' },
  C: { color: '#a855f7', label: 'Zone C', desc: 'Convoyage · Transmission · Mécanique' },
  D: { color: '#f59e0b', label: 'Zone D', desc: 'Local technique · Lubrifiants · Fluides' },
}

const CATEGORIES = ['Filtration','Joints','Roulements','Convoyage','Lubrifiants','Électrique','Pneumatique','Transmission','Instrumentation']

function zoneColor(loc: string | undefined) {
  if (!loc) return '#7a8599'
  return ZONES[loc[0]]?.color || '#7a8599'
}

// ─── LOCATION BADGE ───────────────────────────────────────────
function LocBadge({ loc, shelf, size = 'sm' }: { loc?: string; shelf?: string; size?: string }) {
  if (!loc) return <span style={{ color: 'var(--t3)', fontSize: 11 }}>—</span>
  const c = zoneColor(loc)
  const large = size === 'lg'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: large ? '4px 10px' : '2px 8px',
      borderRadius: 5, fontFamily: 'var(--font-mono)',
      fontSize: large ? 13 : 11, fontWeight: 600,
      background: c + '18', border: `1px solid ${c}44`, color: c,
    }}>
      {loc}{shelf && shelf !== 'SOL' ? <><span style={{ color: c + '88', margin: '0 2px' }}>·</span>{shelf}</> : shelf === 'SOL' ? <><span style={{ color: c + '88', margin: '0 2px' }}>·</span>Sol</> : null}
    </span>
  )
}

// ─── STOCK BAR ────────────────────────────────────────────────
function StockBar({ qty, minQty }: { qty: number; minQty: number }) {
  const pct = Math.min(100, qty / Math.max(minQty * 3, 1) * 100)
  const low = qty <= minQty
  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', width: 48, marginTop: 3 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: low ? 'var(--red)' : 'var(--acc)', borderRadius: 2, transition: 'width .4s' }} />
    </div>
  )
}

// ─── WAREHOUSE MAP ────────────────────────────────────────────
function WarehouseMap({ highlight, stock }: { highlight?: string; stock: Part[] }) {
  const ZONE_DEFS = [
    { id: 'A', x: 4,  y: 4,  w: 42, h: 90, color: '#3c82e8' },
    { id: 'B', x: 54, y: 4,  w: 42, h: 60, color: '#3cb87a' },
    { id: 'C', x: 4,  y: 64, w: 42, h: 30, color: '#a855f7' },
    { id: 'D', x: 54, y: 72, w: 42, h: 22, color: '#f59e0b' },
  ]
  const partsInZone = (id: string) => stock.filter(p => p.location?.startsWith(id))

  return (
    <svg viewBox="0 0 100 100" style={{ width: '100%', display: 'block', minHeight: 240 }}>
      <rect width="100" height="100" fill="#080909" />
      <defs>
        <pattern id="wg" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0L0 0 0 5" fill="none" stroke="rgba(255,255,255,.02)" strokeWidth=".3" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#wg)" />
      <rect x="0" y="62" width="100" height="4" fill="rgba(255,255,255,.015)" />
      <rect x="48" y="0" width="4" height="100" fill="rgba(255,255,255,.015)" />
      <text x="50" y="65" textAnchor="middle" fill="rgba(255,255,255,.08)" fontSize="2" fontFamily="JetBrains Mono">ALLÉE</text>
      {ZONE_DEFS.map(z => {
        const isHL = highlight ? highlight.startsWith(z.id) : false
        const count = partsInZone(z.id).length
        return (
          <g key={z.id}>
            <rect x={z.x} y={z.y} width={z.w} height={z.h}
              fill={isHL ? z.color + '25' : z.color + '08'}
              stroke={isHL ? z.color : z.color + '44'}
              strokeWidth={isHL ? '.8' : '.4'} rx="2"
              style={{ transition: 'all .25s', filter: isHL ? `drop-shadow(0 0 5px ${z.color}66)` : 'none' }} />
            <text x={z.x + z.w / 2} y={z.y + 8} textAnchor="middle"
              fill={isHL ? z.color : z.color + '99'}
              fontSize={isHL ? 7 : 5} fontFamily="JetBrains Mono" fontWeight="700"
              style={{ transition: 'all .25s' }}>{z.id}</text>
            {[0, 1, 2, 3].slice(0, Math.floor(z.h / 15)).map((_, i) => (
              <rect key={i} x={z.x + 2} y={z.y + 12 + i * 12} width={z.w - 4} height={8}
                fill={isHL ? z.color + '18' : z.color + '08'}
                stroke={isHL ? z.color + '66' : z.color + '22'}
                strokeWidth=".3" rx=".5" />
            ))}
            {count > 0 && (
              <g>
                <circle cx={z.x + z.w - 4} cy={z.y + 4} r="3.5" fill={isHL ? z.color : z.color + '66'} />
                <text x={z.x + z.w - 4} y={z.y + 5} textAnchor="middle" fill="#000" fontSize="2.8" fontFamily="JetBrains Mono" fontWeight="700">{count}</text>
              </g>
            )}
            {isHL && (
              <g>
                <circle cx={z.x + z.w / 2} cy={z.y + z.h - 8} r="4" fill={z.color} opacity=".9">
                  <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".9;.3;.9" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <text x={z.x + z.w / 2} y={z.y + z.h - 4} textAnchor="middle" fill="#000" fontSize="4">📍</text>
                <text x={z.x + z.w / 2} y={z.y + z.h - .5} textAnchor="middle" fill={z.color} fontSize="2.2" fontFamily="JetBrains Mono">{highlight}</text>
              </g>
            )}
          </g>
        )
      })}
      <rect x="40" y="95" width="20" height="5" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.06)" strokeWidth=".3" rx="1" />
      <text x="50" y="99" textAnchor="middle" fill="rgba(255,255,255,.12)" fontSize="2" fontFamily="JetBrains Mono">▼ ENTRÉE</text>
    </svg>
  )
}

// ─── DETAIL PANEL ────────────────────────────────────────────
function DetailPanel({ part, stock, canEdit, onAdjust, onDeselect, isMobile }: {
  part: Part | null; stock: Part[]; canEdit: boolean;
  onAdjust: () => void; onDeselect: () => void;
  isMobile: boolean;
}) {
  if (!part) return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 10, overflow: 'hidden', position: isMobile ? 'static' : 'sticky', top: isMobile ? undefined : 20 }}>
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--t2)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
        <div style={{ fontSize: 13 }}>Sélectionnez une pièce<br />pour voir son emplacement</div>
      </div>
      <div style={{ padding: '0 16px 16px' }}>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--b0)', borderRadius: 8, overflow: 'hidden' }}>
          <WarehouseMap stock={stock} />
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(ZONES).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: v.color }} />
              {v.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const c = zoneColor(part.location)
  const low = part.qty <= part.min_qty
  const pct = Math.min(100, part.qty / Math.max(part.min_qty * 3, 1) * 100)

  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 10, overflow: 'hidden', position: isMobile ? 'static' : 'sticky', top: isMobile ? undefined : 20 }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--b0)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--acc)' }}>{part.ref}</span>
          <button onClick={onDeselect} style={{ background: 'transparent', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{part.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--s3)', color: 'var(--t2)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--b0)' }}>{part.category}</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--s3)', color: 'var(--t2)', padding: '2px 7px', borderRadius: 4, border: '1px solid var(--b0)' }}>{part.unit}</span>
          {low && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'rgba(255,71,87,.1)', color: 'var(--red)', padding: '2px 7px', borderRadius: 4 }}>STOCK CRITIQUE</span>}
        </div>
      </div>

      {/* Localisation */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b0)' }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)', marginBottom: 10 }}>📍 Localisation</div>
        <div style={{ background: 'var(--s3)', borderRadius: 8, padding: 14, marginBottom: 12, borderLeft: `3px solid ${c}`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: -8, top: -8, fontSize: 60, opacity: .05, fontFamily: 'var(--font-mono)', fontWeight: 800 }}>{part.location?.[0]}</div>
          <div style={{ fontSize: 38, fontWeight: 800, fontFamily: 'var(--font-mono)', color: c, lineHeight: 1, marginBottom: 4 }}>
            {part.location}{part.location_detail?.includes('Sol') ? '-Sol' : ''}
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{part.location_detail || 'Emplacement non renseigné'}</div>
        </div>
        <div style={{ background: 'var(--bg)', border: '1px solid var(--b0)', borderRadius: 8, overflow: 'hidden' }}>
          <WarehouseMap highlight={part.location || undefined} stock={stock} />
        </div>
      </div>

      {/* Stock */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b0)' }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)', marginBottom: 10 }}>📊 Stock</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 34, fontWeight: 800, fontFamily: 'var(--font-mono)', color: low ? 'var(--red)' : 'var(--acc)' }}>{part.qty}</span>
          <span style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{part.unit} / min. {part.min_qty}</span>
        </div>
        <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: low ? 'var(--red)' : 'var(--acc)', borderRadius: 3, transition: 'width .4s' }} />
        </div>
        <button onClick={onAdjust} style={{ background: 'var(--acc)', color: '#000', border: 'none', borderRadius: 6, padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)', width: '100%' }}>
          {canEdit ? '± Ajuster le stock' : '📤 Déclarer une consommation'}
        </button>
        {!canEdit && <div style={{ fontSize: 10, color: 'var(--t3)', textAlign: 'center', marginTop: 4, fontFamily: 'var(--font-mono)' }}>Réception & inventaire → chef technique</div>}
      </div>

      {/* Fournisseur */}
      <div style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--t3)', marginBottom: 10 }}>🏭 Fournisseur</div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{part.supplier || '—'}</div>
        {part.supplier_ref && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--acc)', marginBottom: 8 }}>Réf: {part.supplier_ref}</div>}
        {part.supplier_contact && (
          <a href={`tel:${part.supplier_contact}`} style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--t1)',
            textDecoration: 'none', padding: '8px 12px', background: 'var(--s3)',
            borderRadius: 8, border: '1px solid var(--b0)', fontWeight: 500,
          }}>
            📞 {part.supplier_contact}
          </a>
        )}
        {canEdit && typeof part.price === 'number' && part.price > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t2)' }}>
            Prix HTVA : <strong style={{ color: 'var(--t1)' }}>{Number(part.price).toFixed(2)} €</strong>
            <br />
            Prix TVAC : <strong style={{ color: 'var(--t1)' }}>{(Number(part.price) * (1 + VAT_RATE)).toFixed(2)} €</strong>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ADJUST MODAL ────────────────────────────────────────────
function AdjustModal({ part, canEdit, onClose, onConfirm }: {
  part: Part; canEdit: boolean; onClose: () => void;
  onConfirm: (delta: number, reason: string, type: string) => void
}) {
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState('')
  const [otRef, setOtRef] = useState('')
  const [type, setType] = useState(canEdit ? 'add' : 'remove')

  const delta = type === 'remove' ? -Math.abs(qty) : Math.abs(qty)
  const newQty = Math.max(0, part.qty + delta)
  const low = newQty <= part.min_qty

  const TYPES_ADMIN = [
    ['add', '📦 Réception', '#00d0d8'],
    ['remove', '📤 Retrait', '#ff4757'],
    ['order', '🔄 Inventaire', '#ffa502'],
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 14, width: '100%', maxWidth: 460, maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{canEdit ? 'Mouvement de stock' : 'Déclarer une consommation'}</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{part.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--b1)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {!canEdit && (
            <div style={{ padding: '10px 14px', background: 'rgba(0,208,216,.06)', border: '1px solid rgba(0,208,216,.2)', borderRadius: 8, fontSize: 12.5, color: 'var(--acc)' }}>
              🔧 Déclarez les pièces prélevées pour votre intervention. Le stock sera mis à jour automatiquement.
            </div>
          )}

          {canEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.6px', fontFamily: 'var(--font-mono)' }}>Type de mouvement</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {TYPES_ADMIN.map(([k, l, c]) => (
                  <button key={k} onClick={() => setType(k)} style={{
                    flex: 1, padding: '8px 6px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-outfit)',
                    border: `1px solid ${type === k ? c : 'rgba(255,255,255,.08)'}`,
                    background: type === k ? c + '18' : 'transparent',
                    color: type === k ? c : 'var(--t2)',
                  }}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Stock actuel */}
          <div style={{ background: 'var(--s3)', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>Stock actuel</span>
              <LocBadge loc={part.location || undefined} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 800, fontFamily: 'var(--font-mono)', color: part.qty <= part.min_qty ? 'var(--red)' : 'var(--acc)' }}>{part.qty}</span>
              <span style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{part.unit}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, part.qty / Math.max(part.min_qty * 3, 1) * 100)}%`, background: part.qty <= part.min_qty ? 'var(--red)' : 'var(--acc)', borderRadius: 2 }} />
            </div>
          </div>

          {/* Quantité stepper */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.6px', fontFamily: 'var(--font-mono)' }}>Quantité ({part.unit})</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--b1)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setQty(q => Math.max(0, q - 1))} style={{ width: 44, height: 44, background: 'var(--s3)', border: 'none', color: 'var(--t1)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <input type="number" value={qty} onChange={e => setQty(Math.max(0, parseInt(e.target.value) || 0))} style={{ flex: 1, background: 'var(--bg)', border: 'none', color: 'var(--t1)', fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, textAlign: 'center', padding: '0 8px', outline: 'none', height: 44 }} />
              <button onClick={() => setQty(q => q + 1)} style={{ width: 44, height: 44, background: 'var(--s3)', border: 'none', color: 'var(--t1)', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>

          {/* Référence OT (technicien) */}
          {!canEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.6px', fontFamily: 'var(--font-mono)' }}>Intervention liée *</label>
              <input style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 8, color: 'var(--t1)', fontFamily: 'var(--font-outfit)', fontSize: 13, padding: '10px 12px', outline: 'none' }} placeholder="ex: Remplacement joint doseuse, OT-042..." value={otRef} onChange={e => setOtRef(e.target.value)} />
            </div>
          )}

          {/* Motif (admin/chef) */}
          {canEdit && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.6px', fontFamily: 'var(--font-mono)' }}>Motif (optionnel)</label>
              <input style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 8, color: 'var(--t1)', fontFamily: 'var(--font-outfit)', fontSize: 13, padding: '10px 12px', outline: 'none' }} placeholder="ex: Commande BL-20250512, Retour intervention..." value={reason} onChange={e => setReason(e.target.value)} />
            </div>
          )}

          {/* Résultat */}
          {qty > 0 && (
            <div style={{ background: 'rgba(0,208,216,.06)', border: `1px solid ${low ? 'rgba(255,71,87,.3)' : 'rgba(0,208,216,.2)'}`, borderRadius: 8, padding: '12px 14px', fontSize: 12.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'var(--t2)' }}>Stock après {canEdit ? 'mouvement' : 'prélèvement'}</span>
                <strong style={{ color: low ? 'var(--red)' : 'var(--acc)', fontFamily: 'var(--font-mono)', fontSize: 16 }}>{newQty} {part.unit}</strong>
              </div>
              {low && <div style={{ fontSize: 11.5, color: 'var(--yel)' }}>⚠️ Stock sous le seuil minimum ({part.min_qty}) — le chef sera alerté.</div>}
              {newQty === 0 && <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 4 }}>🚨 Stock épuisé après ce prélèvement !</div>}
            </div>
          )}

          {/* Info fournisseur si réception */}
          {type === 'add' && canEdit && part.supplier && (
            <div style={{ padding: '10px 14px', background: 'var(--s3)', borderRadius: 8, fontSize: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t3)', marginBottom: 8 }}>Fournisseur habituel</div>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{part.supplier}</div>
              {part.supplier_ref && <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--acc)', fontSize: 11, marginBottom: 2 }}>{part.supplier_ref}</div>}
              {part.supplier_contact && <div style={{ color: 'var(--t2)' }}>{part.supplier_contact}</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--b1)', borderRadius: 6, padding: '8px 14px', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>Annuler</button>
          <button
            onClick={() => onConfirm(delta, canEdit ? (reason || 'Mouvement manuel') : (otRef || 'Consommation intervention'), type)}
            disabled={qty === 0 || (!canEdit && !otRef)}
            style={{ background: (qty === 0 || (!canEdit && !otRef)) ? 'rgba(255,255,255,.1)' : 'var(--acc)', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
            ✓ Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ADD PART MODAL ───────────────────────────────────────────
function AddPartModal({ onClose, onSave }: { onClose: () => void; onSave: (part: Partial<Part>) => void }) {
  const [f, setF] = useState({ ref: '', name: '', category: 'Filtration', unit: 'pcs', qty: 0, min_qty: 1, price: 0, supplier: '', supplier_ref: '', supplier_contact: '', location: 'A1', location_detail: '' })
  const s = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--s2)' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Nouvelle référence</div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--b1)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Référence *</label>
              <input className="form-input" placeholder="ex: FLT-001" value={f.ref} onChange={e => s('ref', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Catégorie</label>
              <select className="form-input" value={f.category} onChange={e => s('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Désignation *</label>
            <input className="form-input" placeholder="ex: Filtre à air 50µm" value={f.name} onChange={e => s('name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Qté initiale</label>
              <input className="form-input" type="number" value={f.qty} onChange={e => s('qty', parseInt(e.target.value) || 0)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Qté min.</label>
              <input className="form-input" type="number" value={f.min_qty} onChange={e => s('min_qty', parseInt(e.target.value) || 1)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Unité</label>
              <select className="form-input" value={f.unit} onChange={e => s('unit', e.target.value)}>
                {['pcs', 'm', 'L', 'kg', 'sac', 'boîte', 'lot'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div style={{ height: 1, background: 'var(--b0)', margin: '4px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Zone magasin</label>
              <select className="form-input" value={f.location} onChange={e => s('location', e.target.value)}>
                {Object.keys(ZONES).flatMap(z => [1, 2, 3, 4].map(n => `${z}${n}`)).map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Prix unitaire HTVA (€)</label>
              <input className="form-input" type="number" step="0.01" value={f.price} onChange={e => s('price', parseFloat(e.target.value) || 0)} />
              <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                TVAC estime : {(Number(f.price || 0) * (1 + VAT_RATE)).toFixed(2)} €
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Description emplacement</label>
            <input className="form-input" placeholder="ex: Armoire A1, étagère 3, bac rouge" value={f.location_detail} onChange={e => s('location_detail', e.target.value)} />
          </div>
          <div style={{ height: 1, background: 'var(--b0)', margin: '4px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Fournisseur</label>
            <input className="form-input" placeholder="ex: Atlas Copco" value={f.supplier} onChange={e => s('supplier', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Réf. fournisseur</label>
              <input className="form-input" placeholder="ex: REF-001" value={f.supplier_ref} onChange={e => s('supplier_ref', e.target.value)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Téléphone</label>
              <input className="form-input" placeholder="ex: 01 23 45 67 89" value={f.supplier_contact} onChange={e => s('supplier_contact', e.target.value)} />
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--b0)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid var(--b1)', borderRadius: 6, padding: '8px 14px', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>Annuler</button>
          <button onClick={() => onSave(f)} disabled={!f.ref || !f.name} style={{ background: (!f.ref || !f.name) ? 'rgba(255,255,255,.1)' : 'var(--acc)', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
            ✓ Créer la référence
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function StorePage() {
  const { user } = useAuth()
  const { parts: stockFromStore, interventions: allInterventions, loading } = useData()
  const [localStock, setLocalStock] = useState<Part[]>([])
  // Utiliser stock local si modifié, sinon DataStore
  const stock = localStock.length > 0 ? localStock : stockFromStore
  const [selected, setSelected] = useState<Part | null>(null)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [showAdj, setShowAdj] = useState<Part | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  if (!user) return null
  const canEdit = user.role === 'admin' || user.role === 'chef'

  // Mouvements calculés depuis les interventions du DataStore
  const moves = useMemo(() =>
    allInterventions.flatMap((i: any) =>
      (i.parts_used || []).map((p: any) => ({
        partName: p.part?.name || '—',
        qty: -(p.qty_used || 1),
        date: i.created_at?.split('T')[0] || today(),
        tech: i.technician?.name?.split(' ')[0] || '—',
        ot: i.title,
      }))
    ).sort((a: any, b: any) => b.date > a.date ? 1 : -1)
  , [allInterventions])

  const load = async () => { /* DataStore gère le rechargement */ }
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const apply = () => setIsMobile(mql.matches)
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const filtered = useMemo(() => stock.filter(p => {
    const q = search.toLowerCase()
    return (
      (catFilter === 'all' || p.category === catFilter) &&
      (zoneFilter === 'all' || p.location?.startsWith(zoneFilter)) &&
      (!search || p.name.toLowerCase().includes(q) || p.ref.toLowerCase().includes(q) ||
        (p.supplier || '').toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q) ||
        (p.location_detail || '').toLowerCase().includes(q))
    )
  }), [stock, search, catFilter, zoneFilter])

  const lowStock = stock.filter(p => p.qty <= p.min_qty)
  const totalVal = stock.reduce((s, p) => s + (p.qty * (p.price || 0)), 0)
  const cats = ['all', ...new Set(stock.map(p => p.category).filter(Boolean))]

  const handleAdjust = async (delta: number, reason: string, type: string) => {
    if (!showAdj) return
    // Mise à jour locale immédiate (optimistic)
    const newQty = Math.max(0, showAdj.qty + delta)
    setLocalStock(stock.map(p => p.id === showAdj.id ? { ...p, qty: newQty } : p))
    if (selected?.id === showAdj.id) setSelected(s => s ? { ...s, qty: newQty } : s)
    // Persistance Supabase
    await partsApi.adjustStock(showAdj.id, newQty)
    await auditApi.log(user.id, delta > 0 ? 'Réception stock' : delta < 0 ? 'Consommation stock' : 'Inventaire', showAdj.name, `${delta > 0 ? '+' : ''}${delta} ${showAdj.unit} · ${reason}`)
    setShowAdj(null)
    showToast(delta < 0 ? `${Math.abs(delta)} ${showAdj.unit} prélevé(s)` : `+${delta} ${showAdj.unit} ajouté(s)`)
  }

  const handleAddPart = async (part: Partial<Part>) => {
    const created = await partsApi.create(part)
    if (created) setLocalStock(prev => prev.length > 0 ? [...prev, created] : [...stockFromStore, created])
    await auditApi.log(user.id, 'Pièce créée', part.name || '', `Réf: ${part.ref}`)
    await load()
    setShowAdd(false)
    showToast('Référence créée avec succès !')
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 11px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
    fontFamily: 'var(--font-outfit)', transition: 'all .12s', whiteSpace: 'nowrap',
    border: `1px solid ${active ? 'rgba(0,208,216,.35)' : 'rgba(255,255,255,.08)'}`,
    background: active ? 'rgba(0,208,216,.1)' : 'transparent',
    color: active ? 'var(--acc)' : 'var(--t2)',
  })

  return (
    <AppLayout>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--acc)', color: '#000', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          ✓ {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <div className="page-title">📦 Magasin</div>
          <div className="page-sub">Pièces de rechange · Localisation · Fournisseurs</div>
        </div>
        {canEdit && <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Référence</button>}
      </div>

      {/* Alertes */}
      {lowStock.length > 0 && (
        <div className="alert-bar" style={{ background: 'rgba(255,71,87,.07)', border: '1px solid rgba(255,71,87,.25)', color: 'var(--red)' }}>
          ⚠️ <strong>{lowStock.length} pièce(s) en stock critique :</strong>{' '}
          {lowStock.map(p => `${p.name} (${p.qty} ${p.unit})`).join(' · ')}
        </div>
      )}
      {!canEdit && (
        <div className="alert-bar" style={{ background: 'rgba(0,208,216,.05)', border: '1px solid rgba(0,208,216,.15)', color: 'var(--acc)' }}>
          🔒 Vue technicien · Cliquez sur une pièce pour voir son emplacement et déclarer une consommation
        </div>
      )}

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { l: 'Références', v: stock.length, c: 'var(--acc)' },
          { l: 'Stock critique', v: lowStock.length, c: lowStock.length > 0 ? 'var(--red)' : 'var(--acc)' },
          ...(canEdit ? [{ l: 'Valeur stock', v: `${totalVal.toFixed(0)} €`, c: 'var(--t1)' }] : []),
          { l: 'Mouvements', v: moves.length, c: 'var(--t2)' },
        ].map(s => (
          <div key={s.l} className="stat-card">
            <div className="stat-value" style={{ color: s.c, fontSize: 26 }}>{s.v}</div>
            <div className="stat-label">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Recherche + filtres zones */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--t2)' }}>🔍</span>
          <input className="form-input" placeholder="Nom, réf., emplacement, fournisseur..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all', ...Object.keys(ZONES)].map(k => (
            <button key={k} onClick={() => setZoneFilter(k)} style={chipStyle(zoneFilter === k)}>
              {k === 'all' ? 'Toutes zones' : `Zone ${k}`}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres catégories */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {cats.map(c => (
          <button key={c} onClick={() => setCatFilter(c)} style={chipStyle(catFilter === c)}>
            {c === 'all' ? 'Toutes catégories' : c}
          </button>
        ))}
      </div>

      {/* Layout principal */}
      <div className="store-layout">

        {/* TABLE + HISTORIQUE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 580 }}>
                <thead>
                  <tr>
                    <th>📍 Emplacement</th>
                    <th>Référence</th>
                    <th>Désignation</th>
                    <th>Machines</th>
                    <th>Fournisseur</th>
                    <th>Stock</th>
                    {canEdit && <th>P.U. HTVA</th>}
                    {canEdit && <th>P.U. TVAC</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={canEdit ? 9 : 7} style={{ textAlign: 'center', padding: 40, color: 'var(--t2)' }}>Chargement…</td></tr>}
                  {!loading && filtered.length === 0 && <tr><td colSpan={canEdit ? 9 : 7}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '40px 20px', color: 'var(--t2)', opacity: .5 }}><span style={{ fontSize: 28 }}>🔍</span><span>Aucune pièce trouvée</span></div></td></tr>}
                  {filtered.map(p => {
                    const low = p.qty <= p.min_qty
                    const sel = selected?.id === p.id
                    const machines = (p.equipments ?? []).map(e => e.name)
                    const machinesLabel = machines.length > 0 ? machines.join(' · ') : '—'
                    return (
                      <tr key={p.id}
                        onClick={() => setSelected(sel ? null : p)}
                        style={{ background: sel ? 'rgba(0,208,216,.04)' : low ? 'rgba(255,71,87,.02)' : undefined }}>
                        <td><LocBadge loc={p.location || undefined} /></td>
                        <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--acc)' }}>{p.ref}</span></td>
                        <td>
                          <div style={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--t2)' }}>{p.category}</div>
                          {low && <div style={{ fontSize: 9, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>⚠ CRITIQUE</div>}
                        </td>
                        <td style={{ fontSize: 11.5, color: 'var(--t2)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {machinesLabel}
                        </td>
                        <td>
                          <div style={{ fontSize: 12.5, fontWeight: 500, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.supplier || '—'}</div>
                          {p.supplier_ref && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--t2)' }}>{p.supplier_ref}</div>}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                            <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: low ? 'var(--red)' : 'var(--t1)' }}>{p.qty}</span>
                            <span style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{p.unit}</span>
                          </div>
                          <StockBar qty={p.qty} minQty={p.min_qty} />
                        </td>
                        {canEdit && <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t2)' }} onClick={e => e.stopPropagation()}>{typeof p.price === 'number' && p.price > 0 ? `${Number(p.price).toFixed(2)} €` : '—'}</td>}
                        {canEdit && <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--t2)' }} onClick={e => e.stopPropagation()}>{typeof p.price === 'number' && p.price > 0 ? `${(Number(p.price) * (1 + VAT_RATE)).toFixed(2)} €` : '—'}</td>}
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => { setSelected(p); }} className="btn btn-ghost btn-xs">📍</button>
                            <button onClick={() => setShowAdj(p)} className="btn btn-ghost btn-xs">
                              {canEdit ? '±' : '📤'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historique mouvements */}
          <div className="card">
            <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>🔄 Historique des mouvements</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--t2)' }}>{moves.length} entrées</span>
            </div>
            <div style={{ padding: '0 18px' }}>
              {moves.slice(0, 12).map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--b0)', fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 500, flexShrink: 0, minWidth: 36, textAlign: 'center', background: m.qty < 0 ? 'rgba(255,71,87,.12)' : 'rgba(0,208,216,.12)', color: m.qty < 0 ? 'var(--red)' : 'var(--acc)' }}>
                    {m.qty > 0 ? '+' : ''}{m.qty}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.partName}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.ot} · {m.tech}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--t2)', flexShrink: 0 }}>{m.date}</span>
                </div>
              ))}
              {moves.length === 0 && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '30px 20px', color: 'var(--t2)', opacity: .5 }}>
                  <span>Aucun mouvement enregistré</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PANNEAU DÉTAIL */}
        <div className="store-detail">
          <DetailPanel
          part={selected}
          stock={stock}
          canEdit={canEdit}
          onAdjust={() => selected && setShowAdj(selected)}
          onDeselect={() => setSelected(null)}
          isMobile={isMobile}
        />
        </div>
      </div>

      {showAdj && <AdjustModal part={showAdj} canEdit={canEdit} onClose={() => setShowAdj(null)} onConfirm={handleAdjust} />}
      {showAdd && canEdit && <AddPartModal onClose={() => setShowAdd(false)} onSave={handleAddPart} />}
    </AppLayout>
  )
}
