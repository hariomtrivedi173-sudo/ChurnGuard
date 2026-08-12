import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  BrainCircuit,
  BarChart3,
  Upload,
  LogOut,
  Shield,
} from 'lucide-react'

const navItems = [
  { label: 'Dashboard',    path: '/dashboard',  icon: LayoutDashboard },
  { label: 'Customers',    path: '/customers',  icon: Users },
  { label: 'Predictions',  path: '/predict',    icon: BrainCircuit },
  { label: 'Analytics',    path: '/analytics',  icon: BarChart3 },
  { label: 'Upload',       path: '/upload',     icon: Upload },
]

function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <aside style={{
      width: '240px',
      minWidth: '240px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 12px',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '8px 12px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(124,58,237,.35)',
          flexShrink: 0,
        }}>
          <Shield size={18} color="#fff" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.2 }}>ChurnGuard</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.2 }}>AI Intelligence</p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
        {navItems.map(({ label, path, icon: Icon }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: active ? 600 : 500,
                fontFamily: 'inherit',
                color: active ? '#7c3aed' : '#6b7280',
                background: active ? '#ede9fe' : 'transparent',
                transition: 'all 200ms ease',
                width: '100%',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = '#f5f3ff'
                  e.currentTarget.style.color = '#7c3aed'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = '#6b7280'
                }
              }}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '10px',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'inherit',
          color: '#9ca3af',
          background: 'transparent',
          transition: 'all 200ms ease',
          width: '100%',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = '#fff1f2'
          e.currentTarget.style.color = '#e11d48'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = '#9ca3af'
        }}
      >
        <LogOut size={17} strokeWidth={2} />
        Log out
      </button>
    </aside>
  )
}

export default Sidebar