'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { MaintaFoodLogo } from '@/components/MaintaFoodLogo'
import { ROLE_CONFIG } from '@/types'

const NAV_ITEMS = [
  { href: '/dashboard',     label: 'Dashboard',      icon: 'dashboard', roles: ['admin','chef','technician'] },
  { href: '/plan',          label: 'Plan du site',   icon: 'plan',      roles: ['admin','chef','technician'] },
  { href: '/interventions', label: 'Interventions',  icon: 'tool',      roles: ['admin','chef','technician'] },
  { href: '/store',         label: 'Magasin',        icon: 'store',     roles: ['admin','chef','technician'] },
  { href: '/audit',         label: 'Audit',          icon: 'audit',     roles: ['admin','chef'] },
  { href: '/users',         label: 'Utilisateurs',   icon: 'users',     roles: ['admin','chef'] },
  { href: '/settings',      label: 'Paramètres',     icon: 'settings',  roles: ['admin'] },
]

const ICONS: Record<string, string> = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  plan: 'M3 5a2 2 0 012-2h3v18H5a2 2 0 01-2-2V5zm7-2h4a2 2 0 012 2v16a2 2 0 01-2 2h-4V3zm6 0h3a2 2 0 012 2v14a2 2 0 01-2 2h-3V3z',
  tool: 'M14.7 6.3a1 1 0 00-1.4 0l-1 1a1 1 0 000 1.4l3 3a1 1 0 001.4 0l1-1a1 1 0 000-1.4l-3-3zM2 20l6-2 9-9-4-4-9 9-2 6z',
  store: 'M4 7h16l-1 14H5L4 7zm2-4h12l1 4H5l1-4z',
  audit: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 3a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
}

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const d = ICONS[name]
  if (!d) return <span style={{ fontSize: 16 }}>{name}</span>
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, opacity: active ? 1 : 0.9 }}>
      <path d={d} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const handleSignOut = () => {
    // Nettoyage immédiat sans attendre Supabase
    Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
    sessionStorage.clear()
    window.location.href = '/auth'
  }

  useEffect(() => {
    if (!loading && !user) router.replace('/auth')
  }, [user, loading, router])

  useEffect(() => {
    // Intercepter ?logout=1 dans l'URL
    if (typeof window !== 'undefined' && window.location.search.includes('logout=1')) {
      Object.keys(localStorage).filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k))
      sessionStorage.clear()
      window.location.href = '/auth'
    }
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080909' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <MaintaFoodLogo size="lg" />
        <div style={{ color: '#00c896', fontSize: 12, fontFamily: 'var(--font-mono)', opacity: .6 }}>Chargement…</div>
      </div>
    </div>
  )

  if (!user) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#080909', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#0f1012', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Session détectée, profil manquant</div>
        <div style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>
          L'application n'arrive pas à charger votre profil. Cliquez sur "Reconnexion".
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={() => router.replace('/auth')}>Reconnexion</button>
          <button className="btn btn-primary" onClick={handleSignOut}>Déconnexion</button>
        </div>
      </div>
    </div>
  )

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role))
  const mobileNav = visibleNav.slice(0, 5)

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', fontFamily: 'var(--font-outfit)' }}>
      {/* ─ SIDEBAR DESKTOP ─ */}
      <aside style={{
        width: 220, minWidth: 220, background: '#0f1012',
        borderRight: '1px solid rgba(255,255,255,.04)',
        display: 'flex', flexDirection: 'column',
      }} className="hide-mobile">
        {/* Logo */}
        <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
          <MaintaFoodLogo size="md" />
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#3a4055', marginTop: 5, textTransform: 'uppercase', letterSpacing: '.6px' }}>
            GMAO Platform
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase', color: '#3a4055', padding: '10px 8px 4px' }}>
            Navigation
          </div>
          {visibleNav.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px',
                borderRadius: 6, fontSize: 13, fontWeight: 500, textDecoration: 'none',
                color: isActive ? '#e4e8f0' : '#7a8599',
                background: isActive ? 'rgba(255,255,255,.08)' : 'transparent',
                position: 'relative', transition: 'all .12s',
              }}>
                {isActive && <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 2.5, background: '#00c896', borderRadius: '0 2px 2px 0' }} />}
                <NavIcon name={item.icon} active={isActive} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div style={{ margin: 8, padding: 10, background: '#1e2023', borderRadius: 6, border: '1px solid rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
            flexShrink: 0, background: user.color + '22', color: user.color,
          }}>{user.avatar}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: ROLE_CONFIG[user.role].color }}>
              {ROLE_CONFIG[user.role].label}
            </div>
          </div>
          <button onClick={handleSignOut} title="Déconnexion" style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,.08)', borderRadius: 4,
            color: '#7a8599', cursor: 'pointer', padding: '4px 6px', fontSize: 12,
            position: 'relative', zIndex: 999, pointerEvents: 'all',
          }}>⇥</button>
        </div>
      </aside>

      {/* ─ MAIN ─ */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <div style={{
          height: 52, minHeight: 52, background: '#0f1012',
          borderBottom: '1px solid rgba(255,255,255,.04)',
          display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
        }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>
            {visibleNav.find(n => pathname.startsWith(n.href))?.label || 'MaintaFood'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: user.color + '22',
              color: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
            }}>{user.avatar}</div>
            <button onClick={handleSignOut} className="hide-mobile" style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 4, color: '#7a8599', cursor: 'pointer', padding: '5px 8px', fontSize: 12,
              position: 'relative', zIndex: 999, pointerEvents: 'all',
            }}>Déconnexion</button>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, paddingBottom: 80 }}>
          {children}
        </div>
      </main>

      {/* ─ MOBILE BOTTOM NAV ─ */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: '#0f1012', borderTop: '1px solid rgba(255,255,255,.08)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }} className="show-mobile">
        <div style={{ display: 'flex', minHeight: 64 }}>
          {mobileNav.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 4, padding: '10px 6px', textDecoration: 'none',
                color: isActive ? '#00c896' : '#7a8599', fontSize: 10,
                fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '.3px',
                transition: 'color .12s',
              }}>
                <NavIcon name={item.icon} active={isActive} />
                <span style={{ lineHeight: 1 }}>{item.label.slice(0, 8)}</span>
              </Link>
            )
          })}
          <button onClick={handleSignOut} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '10px 6px', border: 'none', background: 'none',
            color: '#7a8599', fontSize: 10, fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase', letterSpacing: '.3px', cursor: 'pointer',
          }}>
            <NavIcon name="logout" active={false} />
            Quitter
          </button>
        </div>
      </nav>
    </div>
  )
}
