// ============================================================
// FIXOPS — Types TypeScript
// ============================================================

export type UserRole =
  | 'admin'
  | 'manager'
  | 'chef'
  | 'technician'
export type EqStatus = 'ok' | 'panne' | 'maintenance'
export type IntStatus = 'a_faire' | 'en_cours' | 'termine' | 'valide'
export type Priority = 'normale' | 'haute' | 'critique'

// ─── UTILISATEUR ────────────────────────────────────────────
export interface Profile {
  id: string
  name: string
  role: UserRole
  avatar: string
  color: string
  active: boolean
  created_at: string
  updated_at: string
}

// ─── ÉQUIPEMENT ─────────────────────────────────────────────
export interface Equipment {
  id: string
  name: string
  location: string
  zone: string
  category: string
  status: EqStatus
  serial: string
  color: string
  pos_x: number
  pos_y: number
  pos_w: number
  pos_h: number
  schema_desc: string
  manual_ref: string
  food_safe: boolean
  last_inspection: string
  next_inspection: string
  preventive_interval_days?: number | null
  preventive_tasks?: string[] | null
  next_preventive?: string | null
  created_at: string
  updated_at: string
  // Relations
  parts?: Part[]
}

// ─── PIÈCE DE RECHANGE ──────────────────────────────────────
export interface Part {
  id: string
  ref: string
  name: string
  category: string
  unit: string
  qty: number
  min_qty: number
  price: number
  supplier: string
  supplier_ref: string
  supplier_contact: string
  location: string
  location_detail: string
  created_at: string
  updated_at: string
  // Relations
  equipment_ids?: string[]
  equipments?: Array<{ id: string; name: string }>
}

// ─── INTERVENTION ────────────────────────────────────────────
export interface Intervention {
  id: string
  title: string
  description: string
  equipment_id: string
  technician_id: string
  created_by: string
  status: IntStatus
  priority: Priority
  food_impact: boolean
  production_stopped: boolean
  // Rapport
  report_actions: string | null
  report_observations: string | null
  report_duration: number | null
  report_verdict: 'conforme' | 'non_conforme' | 'a_surveiller' | null
  report_hygiene: boolean
  report_cleaning: boolean
  signed_at: string | null
  signed_by: string | null
  created_at: string
  updated_at: string
  // Relations jointes
  equipment?: Equipment
  technician?: Profile
  creator?: Profile
  photos?: InterventionPhoto[]
  comments?: InterventionComment[]
  parts_used?: InterventionPart[]
}

// ─── PHOTO ──────────────────────────────────────────────────
export interface InterventionPhoto {
  id: string
  intervention_id: string
  url: string
  filename: string
  uploaded_by: string
  created_at: string
  uploader?: Profile
}

// ─── COMMENTAIRE ────────────────────────────────────────────
export interface InterventionComment {
  id: string
  intervention_id: string
  text: string
  author_id: string
  created_at: string
  author?: Profile
}

// ─── PIÈCE UTILISÉE ─────────────────────────────────────────
export interface InterventionPart {
  id: string
  intervention_id: string
  part_id: string
  qty_used: number
  created_at: string
  part?: Part
}

// ─── AUDIT ──────────────────────────────────────────────────
export interface AuditLog {
  id: string
  user_id: string
  action: string
  target: string
  detail: string
  created_at: string
  user?: Profile
}

// ─── CONFIG SITE ────────────────────────────────────────────
export interface SiteConfig {
  id: number
  name: string
  address: string
  siret: string
  certifications: string
  updated_at: string
}

// ─── CONSTANTES UI ──────────────────────────────────────────
export const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  admin:      { label: 'Administrateur', color: '#e8643c' },
  manager:    { label: 'Manager',        color: '#14b8a6' },
  chef:       { label: 'Chef technique', color: '#a855f7' },
  technician: { label: 'Technicien',     color: '#3c82e8' },
}
}

export const STATUS_CONFIG: Record<IntStatus, { label: string; color: string; bg: string }> = {
  a_faire:  { label: 'À faire',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  en_cours: { label: 'En cours', color: '#3c82e8', bg: 'rgba(60,130,232,.12)' },
  termine:  { label: 'Terminé',  color: '#3cb87a', bg: 'rgba(60,184,122,.12)' },
  valide:   { label: 'Validé',   color: '#a855f7', bg: 'rgba(168,85,247,.12)' },
}

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string }> = {
  normale:  { label: 'Normale',  color: '#8b9bb4' },
  haute:    { label: 'Haute',    color: '#f59e0b' },
  critique: { label: 'Critique', color: '#ef4444' },
}

export const EQ_STATUS_CONFIG: Record<EqStatus, { label: string; color: string }> = {
  ok:          { label: 'Opérationnel', color: '#3cb87a' },
  panne:       { label: 'En panne',     color: '#ef4444' },
  maintenance: { label: 'Maintenance',  color: '#f59e0b' },
}
