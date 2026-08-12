function StatCard({ label, value, icon: Icon, color = 'purple', subtitle }) {
  const palette = {
    purple: { bg: '#f5f3ff', accent: '#7c3aed', iconBg: '#ede9fe', text: '#5b21b6' },
    rose:   { bg: '#fff1f2', accent: '#e11d48', iconBg: '#ffe4e6', text: '#be123c' },
    amber:  { bg: '#fffbeb', accent: '#d97706', iconBg: '#fef3c7', text: '#b45309' },
    green:  { bg: '#f0fdf4', accent: '#16a34a', iconBg: '#dcfce7', text: '#15803d' },
    blue:   { bg: '#eff6ff', accent: '#2563eb', iconBg: '#dbeafe', text: '#1d4ed8' },
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