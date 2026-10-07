function StatCard({ label, value, icon: Icon, color = 'brand', subtitle }) {
  const palette = {
    brand:     { bg: 'var(--brand-subtle)', accent: 'var(--brand)', iconBg: 'hsla(243, 75%, 59%, 0.12)', text: 'var(--text-primary)' },
    purple:    { bg: 'var(--brand-subtle)', accent: 'var(--brand)', iconBg: 'hsla(243, 75%, 59%, 0.12)', text: 'var(--text-primary)' },
    blue:      { bg: 'var(--info-subtle)', accent: 'var(--info)', iconBg: 'hsla(217, 91%, 60%, 0.12)', text: 'var(--text-primary)' },
    cyan:      { bg: 'var(--info-subtle)', accent: 'var(--info)', iconBg: 'hsla(217, 91%, 60%, 0.12)', text: 'var(--text-primary)' },
    aqua:      { bg: 'var(--info-subtle)', accent: 'var(--info)', iconBg: 'hsla(217, 91%, 60%, 0.12)', text: 'var(--text-primary)' },
    navy:      { bg: 'var(--surface-hover)', accent: 'var(--brand)', iconBg: 'var(--surface-hover)', text: 'var(--text-primary)' },
    burgundy:  { bg: 'var(--brand-subtle)', accent: 'var(--brand)', iconBg: 'hsla(243, 75%, 59%, 0.12)', text: 'var(--text-primary)' },
    champagne: { bg: 'var(--brand-subtle)', accent: 'var(--brand)', iconBg: 'hsla(243, 75%, 59%, 0.12)', text: 'var(--text-primary)' },
    rose:      { bg: 'var(--danger-subtle)', accent: 'var(--danger)', iconBg: 'hsla(0, 84%, 60%, 0.12)', text: 'var(--text-primary)' },
    amber:     { bg: 'var(--warning-subtle)', accent: 'var(--warning)', iconBg: 'hsla(38, 92%, 50%, 0.12)', text: 'var(--text-primary)' },
    green:     { bg: 'var(--success-subtle)', accent: 'var(--success)', iconBg: 'hsla(160, 84%, 39%, 0.12)', text: 'var(--text-primary)' },
  }
  const p = palette[color] || palette.brand

  return (
    <div
      className="card card-hover"
      style={{ padding: '20px 22px', position: 'relative', overflow: 'hidden', cursor: 'default' }}
    >
      {/* Colored left accent strip */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, bottom: 0,
        width: '4px',
        background: p.accent,
        borderRadius: '18px 0 0 18px',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </p>
          <p style={{ fontSize: '28px', fontWeight: 800, color: p.text, lineHeight: 1, marginBottom: subtitle ? '4px' : 0 }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div style={{
            width: '42px', height: '42px',
            borderRadius: '12px',
            background: p.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={20} color={p.accent} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  )
}

export default StatCard