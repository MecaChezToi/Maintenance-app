'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import AppLayout from '@/components/layout/AppLayout'
import { interventionsApi, equipmentsApi, auditApi, photosApi, profilesApi, siteConfigApi } from '@/lib/supabase'
import type { Intervention, Equipment, Profile, SiteConfig } from '@/types'
import { STATUS_CONFIG, PRIORITY_CONFIG, EQ_STATUS_CONFIG } from '@/types'

const fmt   = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const fmtDT = (d: string) => d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'

const openPdf = (interv: Intervention, cfg: SiteConfig | null) => {
  const equipmentName = (interv.equipment as any)?.name || '—'
  const techName = (interv.technician as any)?.name || '—'
  const creatorName = (interv.creator as any)?.name || '—'
  const html = `
  <html><head><meta charset="utf-8" /><title>Rapport ${interv.id}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit',sans-serif;background:#fff;color:#111}
    .wrap{padding:36px}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #00c896}
    .logo{font-size:20px;font-weight:800;color:#00c896}
    .mut{font-size:10px;color:#777}
    .sec{margin-bottom:18px}
    .st{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:10px;padding-bottom:5px;border-bottom:1px solid #eee}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .f{background:#f8f9fa;border-radius:8px;padding:11px}
    .fl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
    .fv{font-size:13px;font-weight:700;color:#111}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:700}
    .b-ok{background:rgba(0,200,150,.12);color:#00c896}
    .b-w{background:rgba(255,165,2,.12);color:#ffa502}
    .b-r{background:rgba(255,71,87,.12);color:#ff4757}
    .txt{white-space:pre-wrap;line-height:1.6;font-size:13px;color:#222}
    .sign{border:1px solid #ddd;border-radius:10px;padding:16px;text-align:center}
    .sign .nm{font-size:18px;font-weight:800;color:#00c896;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;margin:8px 0}
    @media print{@page{margin:12mm}}
  </style></head><body>
    <div class="wrap">
      <div class="hdr">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <div class="logo">FixOps</div>
          </div>
          <div class="mut">RAPPORT D'INTERVENTION — GMAO</div>
        </div>
        <div style="text-align:right;font-size:11px;color:#666;line-height:1.6">
          <div style="font-weight:800;font-size:12px;color:#111">${cfg?.name || ''}</div>
          <div>${cfg?.address || ''}</div>
          <div>${cfg?.siret ? `SIRET : ${cfg.siret}` : ''}</div>
          <div style="color:#00c896;font-weight:700;margin-top:2px">${cfg?.certifications || ''}</div>
        </div>
      </div>

      <div style="font-size:18px;font-weight:900;margin-bottom:10px">${interv.title}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <span class="badge b-ok">● ${interv.status}</span>
        <span class="badge b-w">● ${interv.priority}</span>
        ${interv.production_stopped ? '<span class="badge b-r">⚠ Production arrêtée</span>' : ''}
        ${interv.food_impact ? '<span class="badge b-w">🛡 Impact alimentaire</span>' : ''}
      </div>

      <div class="sec">
        <div class="st">Informations</div>
        <div class="grid">
          <div class="f"><div class="fl">Équipement</div><div class="fv">${equipmentName}</div></div>
          <div class="f"><div class="fl">Créé le</div><div class="fv">${new Date(interv.created_at).toLocaleString('fr-FR')}</div></div>
          <div class="f"><div class="fl">Créé par</div><div class="fv">${creatorName}</div></div>
          <div class="f"><div class="fl">Technicien</div><div class="fv">${techName}</div></div>
        </div>
      </div>

      ${interv.description ? `
      <div class="sec">
        <div class="st">Description</div>
        <div class="txt">${interv.description}</div>
      </div>` : ''}

      <div class="sec">
        <div class="st">Rapport</div>
        <div class="grid">
          <div class="f"><div class="fl">Durée</div><div class="fv">${interv.report_duration ?? '—'} min</div></div>
          <div class="f"><div class="fl">Verdict</div><div class="fv">${interv.report_verdict ?? '—'}</div></div>
        </div>
        <div style="height:12px"></div>
        <div class="grid">
          <div class="f"><div class="fl">Hygiène</div><div class="fv">${interv.report_hygiene ? 'Oui' : 'Non'}</div></div>
          <div class="f"><div class="fl">Nettoyage</div><div class="fv">${interv.report_cleaning ? 'Oui' : 'Non'}</div></div>
        </div>
        <div style="height:12px"></div>
        <div class="f">
          <div class="fl">Travaux effectués</div>
          <div class="txt">${interv.report_actions ?? ''}</div>
        </div>
        <div style="height:10px"></div>
        <div class="f">
          <div class="fl">Observations</div>
          <div class="txt">${interv.report_observations ?? ''}</div>
        </div>
      </div>

      <div class="sec">
        <div class="st">Signature</div>
        <div class="grid">
          <div class="sign">
            <div class="mut">Technicien responsable</div>
            <div class="nm">${techName}</div>
            <div class="mut">${interv.signed_at ? new Date(interv.signed_at).toLocaleString('fr-FR') : ''}</div>
          </div>
          <div class="f" style="background:#f8fffe;border:1px solid rgba(0,200,150,.18)">
            <div class="fl">Certification</div>
            <div style="font-size:12px;color:#555;line-height:1.6">
              Je certifie que les informations sont exactes et que les procédures de sécurité alimentaire ont été respectées.
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top:28px;padding-top:14px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:10px;color:#aaa">
        <span>FixOps GMAO · Généré le ${new Date().toLocaleString('fr-FR')}</span>
        <span>${cfg?.certifications || ''}</span>
        <span>Page 1/1</span>
      </div>
    </div>
  </body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

// ─── REPORT FORM (4 étapes) ─────────────────────────────────
function ReportForm({ interv, equipment, user, onSave, onClose }: any) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    actions: interv.report_actions || '',
    observations: interv.report_observations || '',
    duration: interv.report_duration || '',
    verdict: interv.report_verdict || '',
    hygiene: interv.report_hygiene || false,
    cleaning: interv.report_cleaning || false,
    foodImpact: interv.food_impact || false,
    productionStopped: interv.production_stopped || false,
    photos: [] as File[],
  })
  const s = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const steps = ['Travaux', 'Hygiène', 'Vérification', 'Signature']

  const submit = async () => {
    if (!form.actions || !form.verdict) return
    setSaving(true)
    try {
      await interventionsApi.submitReport(interv.id, {
        actions: form.actions, observations: form.observations,
        duration: Number(form.duration), verdict: form.verdict,
        hygiene: form.hygiene, cleaning: form.cleaning, signed_by: user.id,
      })
      // Upload photos si présentes
      for (const file of form.photos) {
        await photosApi.upload(file, interv.id, user.id)
      }
      await auditApi.log(user.id, 'Rapport signé', interv.title, `Verdict: ${form.verdict}`)
      onSave()
      onClose()
    } finally { setSaving(false) }
  }

  const styles: Record<string, React.CSSProperties> = {
    overlay: { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
    modal: { background: '#161719', border: '1px solid rgba(255,255,255,.08)', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 640, maxHeight: '92dvh', display: 'flex', flexDirection: 'column' },
    header: { padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
    body: { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 },
    footer: { padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 },
    stepRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,.04)', overflowX: 'auto', flexShrink: 0 },
    section: { background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
    checkRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 6, cursor: 'pointer' },
  }

  return (
    <div style={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>Rapport d'intervention</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{equipment?.name} · {fmt(new Date().toISOString())}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>×</button>
        </div>

        {/* Indicateur étapes */}
        <div style={styles.stepRow}>
          {steps.map((st, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: i < steps.length - 1 ? 1 : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0, background: i < step ? '#00c896' : i === step ? 'rgba(0,200,150,.12)' : 'rgba(255,255,255,.04)', border: `2px solid ${i <= step ? '#00c896' : 'rgba(255,255,255,.08)'}`, color: i < step ? '#000' : i === step ? '#00c896' : 'var(--t2)' }}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? '#00c896' : 'rgba(255,255,255,.08)' }} />}
            </div>
          ))}
        </div>

        <div style={styles.body}>
          {/* ÉTAPE 0 — Travaux */}
          {step === 0 && <>
            <div style={styles.section}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)' }}>Travaux effectués *</div>
              <textarea className="form-input" placeholder="Décrivez précisément les travaux réalisés..." value={form.actions} onChange={e => s('actions', e.target.value)} style={{ minHeight: 100, resize: 'vertical' }} />
            </div>
            <div style={styles.section}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)' }}>Observations / Anomalies</div>
              <textarea className="form-input" placeholder="Anomalies constatées, points d'attention..." value={form.observations} onChange={e => s('observations', e.target.value)} style={{ minHeight: 70 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Durée (minutes)</label>
                <input className="form-input" type="number" placeholder="ex: 90" value={form.duration} onChange={e => s('duration', e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Impact</label>
                <label style={styles.checkRow}>
                  <input type="checkbox" checked={form.productionStopped} onChange={e => s('productionStopped', e.target.checked)} style={{ accentColor: '#00c896' }} />
                  <span style={{ fontSize: 13 }}>Production arrêtée</span>
                </label>
              </div>
            </div>
            {/* Photos */}
            <div style={styles.section}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)' }}>Photos ({form.photos.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {form.photos.map((f, i) => (
                  <div key={i} style={{ aspectRatio: '1', background: 'rgba(255,255,255,.04)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--font-mono)', gap: 4 }}>
                    📷<span>{f.name.slice(0, 8)}</span>
                  </div>
                ))}
                <label style={{ aspectRatio: '1', background: 'rgba(255,255,255,.02)', border: '1px dashed rgba(255,255,255,.12)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--t2)' }}>
                  <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) s('photos', [...form.photos, ...Array.from(e.target.files)]) }} />
                  <span style={{ fontSize: 22 }}>📷</span>
                  <span style={{ fontSize: 10 }}>Ajouter</span>
                </label>
              </div>
            </div>
          </>}

          {/* ÉTAPE 1 — Hygiène */}
          {step === 1 && <>
            <div style={{ ...styles.section, background: 'rgba(0,200,150,.06)', border: '1px solid rgba(0,200,150,.2)' }}>
              <div style={{ color: '#00c896', fontWeight: 600, fontSize: 13 }}>🛡️ Zone alimentaire — Vérifications obligatoires (IFS/BRC)</div>
            </div>
            <div style={styles.section}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)', marginBottom: 6 }}>Check-list hygiène</div>
              {[
                ['hygiene', 'Tenue et hygiène personnelle respectées (charlotte, gants…)'],
                ['cleaning', 'Nettoyage / désinfection post-intervention effectué'],
                ['foodImpact', 'Risque de contamination alimentaire identifié ⚠️'],
              ].map(([key, label]) => (
                <label key={key} style={styles.checkRow}>
                  <input type="checkbox" checked={(form as any)[key]} onChange={e => s(key, e.target.checked)} style={{ accentColor: '#00c896', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13 }}>{label}</span>
                </label>
              ))}
            </div>
            {form.foodImpact && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 13, color: '#ff4757' }}>
                ⚠️ Risque alimentaire déclaré — le responsable qualité sera informé.
              </div>
            )}
            <div style={styles.section}>
              <label style={styles.checkRow}>
                <input type="checkbox" defaultChecked style={{ accentColor: '#00c896', width: 16, height: 16 }} />
                <span style={{ fontSize: 13 }}>Tous les outils et pièces ont été récupérés de la zone</span>
              </label>
            </div>
          </>}

          {/* ÉTAPE 2 — Vérification */}
          {step === 2 && <>
            <div style={styles.section}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)', marginBottom: 10 }}>Verdict de l'intervention *</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['conforme','✅ Conforme','#00c896'], ['non_conforme','❌ Non conforme','#ff4757'], ['a_surveiller','⚠️ À surveiller','#ffa502']].map(([v, l, c]) => (
                  <button key={v} onClick={() => s('verdict', v)} style={{ flex: 1, padding: '12px 8px', borderRadius: 8, border: `1px solid ${form.verdict === v ? c : 'rgba(255,255,255,.08)'}`, background: form.verdict === v ? c + '18' : 'transparent', color: form.verdict === v ? c : 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div style={styles.section}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.8px', color: 'var(--t2)', marginBottom: 10 }}>Récapitulatif</div>
              {[
                ['Durée', form.duration ? `${form.duration} min` : '—'],
                ['Photos', `${form.photos.length} photo(s)`],
                ['Hygiène', form.hygiene ? '✅ Respectée' : '⚠️ Non confirmée'],
                ['Nettoyage', form.cleaning ? '✅ Effectué' : '⚠️ Non effectué'],
                ['Risque alim.', form.foodImpact ? '⚠️ Oui' : '✅ Non'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.04)', fontSize: 13 }}>
                  <span style={{ color: 'var(--t2)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </>}

          {/* ÉTAPE 3 — Signature */}
          {step === 3 && <>
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 8 }}>Rapport certifié par</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#00c896', margin: '8px 0' }}>{user.name}</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-mono)' }}>{fmtDT(new Date().toISOString())}</div>
              <div style={{ marginTop: 14, padding: 12, background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
                En signant ce rapport, je certifie que les informations sont exactes et que l'intervention a été réalisée conformément aux procédures en vigueur.
              </div>
            </div>
            {(!form.verdict || !form.actions) && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,165,2,.08)', border: '1px solid rgba(255,165,2,.25)', borderRadius: 8, fontSize: 13, color: '#ffa502' }}>
                ⚠️ Veuillez compléter les étapes précédentes (travaux + verdict obligatoires).
              </div>
            )}
          </>}
        </div>

        <div style={styles.footer}>
          {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '8px 14px', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>← Retour</button>}
          <div style={{ flex: 1 }} />
          {step < steps.length - 1
            ? <button onClick={() => setStep(s => s + 1)} style={{ background: '#00c896', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>Suivant →</button>
            : <button onClick={submit} disabled={!form.verdict || !form.actions || saving} style={{ background: (!form.verdict || !form.actions) ? 'rgba(255,255,255,.1)' : '#00c896', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)', opacity: saving ? .7 : 1 }}>
                {saving ? 'Enregistrement...' : '✓ Signer et clôturer'}
              </button>}
        </div>
      </div>
    </div>
  )
}

// ─── NOUVELLE INTERVENTION ───────────────────────────────────
function NewIntModal({ equipments, technicians, user, onClose, onSave, error }: any) {
  const [form, setForm] = useState<{
    title: string;
    equipment_id: string;
    technician_id: string;
    priority: 'normale' | 'haute' | 'critique';
    description: string;
    food_impact: boolean;
    production_stopped: boolean;
  }>({ 
    title: '', 
    equipment_id: '', 
    technician_id: user.role === 'technician' ? user.id : '', 
    priority: 'normale', 
    description: '', 
    food_impact: false, 
    production_stopped: false 
  })
  const [saving, setSaving] = useState(false)
  const s = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const eq = equipments.find((e: Equipment) => e.id === form.equipment_id)

  const save = async () => {
    if (!form.title || !form.equipment_id) return
    setSaving(true)
    try {
      await onSave({ ...form, created_by: user.id })
      await auditApi.log(user.id, 'Intervention créée', form.title, `Équipement: ${eq?.name}`)
      onClose()
    } finally { setSaving(false) }
  }

  const iS: React.CSSProperties = { background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '8px 14px', fontFamily: 'var(--font-outfit)', fontSize: 13 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#161719', border: '1px solid rgba(255,255,255,.08)', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 600, maxHeight: '90dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Nouvelle intervention</div>
          <button onClick={onClose} style={{ ...iS, padding: '4px 8px', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Titre *</label>
            <input className="form-input" placeholder="ex: Remplacement joint doseuse" value={form.title} onChange={e => s('title', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label className="form-label">Équipement *</label>
              <select className="form-input" value={form.equipment_id} onChange={e => s('equipment_id', e.target.value)}>
                <option value="">Sélectionner...</option>
                {equipments.map((e: Equipment) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            {user.role !== 'technician' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label className="form-label">Technicien</label>
                <select className="form-input" value={form.technician_id} onChange={e => s('technician_id', e.target.value)}>
                  <option value="">Non assigné</option>
                  {technicians.map((tech: Profile) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Priorité</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['normale','Normale','#8b9bb4'],['haute','Haute','#ffa502'],['critique','Critique','#ff4757']].map(([k,l,c]) => (
                <button key={k} onClick={() => s('priority', k)} style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${form.priority === k ? c : 'rgba(255,255,255,.08)'}`, background: form.priority === k ? c + '18' : 'transparent', color: form.priority === k ? c : 'var(--t2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label className="form-label">Description</label>
            <textarea className="form-input" placeholder="Décrire le problème ou les travaux à effectuer..." value={form.description} onChange={e => s('description', e.target.value)} style={{ minHeight: 80 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['production_stopped','Production arrêtée'],['food_impact','Risque alimentaire']].map(([k,l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,.03)', borderRadius: 6, cursor: 'pointer' }}>
                <input type="checkbox" checked={(form as any)[k]} onChange={e => s(k, e.target.checked)} style={{ accentColor: '#00c896', width: 15, height: 15 }} />
                <span style={{ fontSize: 13 }}>{l}</span>
              </label>
            ))}
          </div>
          {eq?.food_safe && <div style={{ padding: '8px 12px', background: 'rgba(0,200,150,.06)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 6, fontSize: 12, color: '#00c896' }}>🛡️ Équipement en zone alimentaire — rapport hygiène obligatoire</div>}
          {error && <div style={{ padding: '10px 12px', background: 'rgba(255,71,87,.08)', border: '1px solid rgba(255,71,87,.25)', borderRadius: 8, fontSize: 12.5, color: '#ff4757' }}>{error}</div>}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={iS}>Annuler</button>
          <button onClick={save} disabled={!form.title || !form.equipment_id || saving} style={{ background: (!form.title || !form.equipment_id) ? 'rgba(255,255,255,.1)' : '#00c896', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
            {saving ? 'Création...' : '✓ Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PAGE PRINCIPALE ─────────────────────────────────────────
export default function InterventionsPage() {
  const { user } = useAuth()
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [technicians, setTechnicians] = useState<Profile[]>([])
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Intervention | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [ints, eqs, profiles, cfg] = await Promise.all([interventionsApi.getAll(), equipmentsApi.getAll(), profilesApi.getAll(), siteConfigApi.get()])
    setInterventions(ints)
    setEquipments(eqs)
    setTechnicians(profiles.filter(profile => profile.role === 'technician'))
    setSiteConfig(cfg)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (!user) return null

  const isTech = user.role === 'technician'
  const list = isTech ? interventions.filter(i => i.technician_id === user.id || i.created_by === user.id) : interventions
  const filtered = filter === 'all' ? list : list.filter(i => i.status === filter)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const updateStatus = async (interv: Intervention, status: 'a_faire' | 'en_cours' | 'termine' | 'valide') => {
    await interventionsApi.updateStatus(interv.id, status)
    await auditApi.log(user.id, 'Statut modifié', interv.title, `→ ${STATUS_CONFIG[status].label}`)
    load()
  }

  const createIntervention = async (payload: any) => {
    setError(null)
    try {
      await interventionsApi.create(payload)
      await load()
      showToast('Intervention créée')
      setShowNew(false)
    } catch (e: any) {
      setError(e.message || 'Impossible de créer l’intervention.')
      throw e
    }
  }

  return (
    <AppLayout>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 999, background: 'var(--acc)', color: '#000', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          ✓ {toast}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="page-title">{isTech ? 'Mes ordres de travail' : 'Interventions'}</div>
          <div className="page-sub">{list.length} OT au total</div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn btn-primary"><span>+</span> Nouveau</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'Tous', list.length], ...(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, typeof STATUS_CONFIG.a_faire][]).map(([k,v]) => [k, v.label, list.filter(i => i.status === k).length])].map(([k, l, c]) => {
          const sc = k !== 'all' ? STATUS_CONFIG[k as keyof typeof STATUS_CONFIG] : null
          return (
            <button key={k as string} onClick={() => setFilter(k as string)} className="btn btn-ghost btn-sm" style={filter === k ? { borderColor: sc?.color || '#00c896', color: sc?.color || '#00c896', background: sc?.bg || 'rgba(0,200,150,.12)' } : {}}>
              {l as string} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: .7 }}>{c as number}</span>
            </button>
          )
        })}
      </div>

      {/* Liste mobile (cartes) */}
      <div className="show-mobile" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
        {filtered.map(i => {
          const eq = equipments.find(e => e.id === i.equipment_id)
          const sc = STATUS_CONFIG[i.status]
          const pc = PRIORITY_CONFIG[i.priority]
          const isMine = i.technician_id === user.id
          return (
            <div key={i.id} style={{ background: '#161719', border: '1px solid rgba(255,255,255,.06)', borderRadius: 12, overflow: 'hidden' }} onClick={() => setSelected(i)}>
              <div style={{ height: 3, background: sc.color }} />
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: sc.bg, color: sc.color }}>{sc.label}</span>
                  <span style={{ fontSize: 10, color: pc.color, fontFamily: 'var(--font-mono)' }}>{pc.label.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{i.title}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>{eq?.name} · {fmt(i.created_at)}</div>
                {i.production_stopped && <div style={{ color: '#ff4757', fontSize: 11, marginTop: 4 }}>⚠️ Production arrêtée</div>}
                {isMine && i.status !== 'termine' && i.status !== 'valide' && !i.report_verdict && (
                  <button onClick={e => { e.stopPropagation(); setSelected(i); setShowReport(true) }} style={{ marginTop: 10, background: '#00c896', color: '#000', border: 'none', borderRadius: 6, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                    📝 Remplir le rapport
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && !loading && <div className="empty-state"><div>✅</div><span>Aucune intervention</span></div>}
      </div>

      {/* Tableau desktop */}
      <div className="card hide-mobile">
        <table className="tbl">
          <thead>
            <tr>
              <th>Titre</th><th>Équipement</th><th>Priorité</th><th>Statut</th><th>Rapport</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--t2)' }}>Chargement…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state"><span>✅</span><span>Aucune intervention</span></div></td></tr>}
            {filtered.map(i => {
              const eq = equipments.find(e => e.id === i.equipment_id)
              const sc = STATUS_CONFIG[i.status]
              const pc = PRIORITY_CONFIG[i.priority]
              return (
                <tr key={i.id} onClick={() => setSelected(i)}>
                  <td>
                    <div style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</div>
                    {i.production_stopped && <div style={{ fontSize: 10, color: '#ff4757' }}>⚠️ Prod. arrêtée</div>}
                    {i.food_impact && <div style={{ fontSize: 10, color: '#00c896' }}>🛡️ Impact alim.</div>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--t2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq?.name || '—'}</td>
                  <td><span style={{ fontSize: 12, color: pc.color, fontWeight: 600 }}>{pc.label}</span></td>
                  <td><span className="badge" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span></td>
                  <td>{i.report_verdict ? <span style={{ color: '#00c896', fontSize: 12 }}>✅ Signé</span> : <span style={{ color: 'var(--t3)', fontSize: 12 }}>En attente</span>}</td>
                  <td style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--t2)' }}>{fmt(i.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal détail */}
      {selected && !showReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div style={{ background: '#161719', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, width: '100%', maxWidth: 640, maxHeight: '90dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{selected.title}</div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>#{selected.id.slice(0,8).toUpperCase()} · {fmtDT(selected.created_at)}</div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, color: 'var(--t2)', cursor: 'pointer', padding: '4px 8px', fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
            <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Statut */}
              <div>
                <div className="form-label" style={{ marginBottom: 8, display: 'block' }}>Statut</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Object.entries(STATUS_CONFIG) as [keyof typeof STATUS_CONFIG, typeof STATUS_CONFIG.a_faire][]).map(([k, v]) => (
                    <button key={k} onClick={() => { updateStatus(selected, k); setSelected({ ...selected, status: k }) }} style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${selected.status === k ? v.color : 'rgba(255,255,255,.08)'}`, background: selected.status === k ? v.bg : 'transparent', color: selected.status === k ? v.color : 'var(--t2)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Description */}
              {selected.description && <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,.03)', borderRadius: 8, fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{selected.description}</div>}
              {/* Rapport */}
              {selected.report_verdict && (
                <div style={{ padding: 14, background: 'rgba(0,200,150,.06)', border: '1px solid rgba(0,200,150,.2)', borderRadius: 10 }}>
                  <div style={{ fontWeight: 600, color: '#00c896', marginBottom: 8 }}>✅ Rapport complété</div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 8 }}>{selected.report_actions}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>Verdict : <strong>{selected.report_verdict}</strong> · Durée : {selected.report_duration} min</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6, fontFamily: 'var(--font-mono)' }}>Signé le {fmtDT(selected.signed_at || '')}</div>
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openPdf(selected, siteConfig)}
                      style={{ borderColor: 'rgba(0,200,150,.25)', color: '#00c896' }}
                    >
                      Imprimer / PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,.04)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {selected.technician_id === user.id && selected.status !== 'valide' && !selected.report_verdict && (
                <button onClick={() => setShowReport(true)} style={{ background: '#00c896', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                  📝 Remplir le rapport
                </button>
              )}
              {(user.role === 'admin' || user.role === 'chef') && selected.status === 'termine' && (
                <button onClick={() => updateStatus(selected, 'valide')} style={{ background: '#a855f7', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                  ⭐ Valider
                </button>
              )}
              <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 6, padding: '8px 14px', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {showNew && <NewIntModal equipments={equipments} technicians={technicians} user={user} error={error} onClose={() => { setShowNew(false); setError(null) }} onSave={createIntervention} />}
      {selected && showReport && <ReportForm interv={selected} equipment={equipments.find(e => e.id === selected.equipment_id)} user={user} onSave={() => { setShowReport(false); load() }} onClose={() => setShowReport(false)} />}
    </AppLayout>
  )
}
