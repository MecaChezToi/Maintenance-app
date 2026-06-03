// components/MaintaFoodLogo.tsx — Logo SVG MaintaFood
export function MaintaFoodLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const scales = { sm: 0.7, md: 1, lg: 1.4 }
  const s = scales[size]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(8 * s) }}>
      {/* Icône circulaire */}
      <svg width={Math.round(28 * s)} height={Math.round(28 * s)} viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="13" stroke="#00c896" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="4" fill="#00c896" opacity="0.3" />
        <circle cx="14" cy="14" r="2" fill="#00c896" />
        <path d="M14 4 L14 8 M14 20 L14 24 M4 14 L8 14 M20 14 L24 14" stroke="#00c896" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {/* Texte */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: Math.round(2 * s), lineHeight: 1 }}>
        <span style={{
          fontSize: Math.round(15 * s), fontWeight: 800, color: '#f1f5f9',
          letterSpacing: '-.3px', fontFamily: 'var(--font-outfit)',
        }}>MAINTA</span>
        <span style={{
          fontSize: Math.round(15 * s), fontWeight: 800, color: '#00c896',
          letterSpacing: '-.3px', fontFamily: 'var(--font-outfit)',
        }}>FOOD</span>
      </div>
    </div>
  )
}
