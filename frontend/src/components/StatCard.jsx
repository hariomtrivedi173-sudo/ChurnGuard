function StatCard({ label, value, icon: Icon, color = 'purple', subtitle }) {
  const palette = {
    purple:    { bg: 'var(--purple-light)', accent: 'var(--purple-primary)', iconBg: 'rgba(124, 58, 237, 0.12)', text: 'var(--text-primary)' },
    blue:      { bg: 'var(--blue-soft)', accent: 'var(--blue-primary)', iconBg: 'rgba(59, 130, 246, 0.12)', text: 'var(--text-primary)' },
    cyan:      { bg: 'var(--blue-soft)', accent: 'var(--blue-primary)', iconBg: 'rgba(59, 130, 246, 0.12)', text: 'var(--text-primary)' },
    aqua:      { bg: 'var(--blue-soft)', accent: 'var(--blue-primary)', iconBg: 'rgba(59, 130, 246, 0.12)', text: 'var(--text-primary)' },
    navy:      { bg: 'var(--surface-hover)', accent: 'var(--purple-primary)', iconBg: 'var(--surface-hover)', text: 'var(--text-primary)' },
    burgundy:  { bg: 'var(--purple-light)', accent: 'var(--purple-primary)', iconBg: 'rgba(124, 58, 237, 0.12)', text: 'var(--text-primary)' },
    champagne: { bg: 'var(--purple-light)', accent: 'var(--purple-primary)', iconBg: 'rgba(124, 58, 237, 0.12)', text: 'var(--text-primary)' },
    rose:      { bg: 'rgba(239, 68, 68, 0.12)', accent: 'var(--danger)', iconBg: 'rgba(239, 68, 68, 0.15)', text: 'var(--text-primary)' },
    amber:     { bg: 'rgba(245, 158, 11, 0.12)', accent: 'var(--warning)', iconBg: 'rgba(245, 158, 11, 0.15)', text: 'var(--text-primary)' },
    green:     { bg: 'rgba(16, 185, 129, 0.12)', accent: 'var(--success)', iconBg: 'rgba(16, 185, 129, 0.15)', text: 'var(--text-primary)' },
  }
  const p = palette[color] || palette.purple

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