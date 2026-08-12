import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Sun, Moon, Bell, Settings, LogOut } from 'lucide-react'
import { apiRequest } from '../api/client'

function Header({ title = "Dashboard", subtitle = "" }) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(2)
  const [profile, setProfile] = useState({ first_name: '', last_name: '', email: '' })

  const notifRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Load real user profile on mount
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token || token === 'null' || token === 'undefined') return
    apiRequest('/profile/me')
      .then(data => { if (data) setProfile(data) })
      .catch(() => {})
  }, [])

  const initials = [
    profile?.first_name?.[0] ?? '',
    profile?.last_name?.[0] ?? ''
  ].join('').toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'User'

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false)
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowNotifications(false)
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/')
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
          {title}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {subtitle}
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search customers, predictions, reports..."
            className="input-base"
            style={{ paddingLeft: '38px', paddingRight: '46px', borderRadius: '12px', fontSize: '12px' }}
          />
          <span style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'var(--border)', borderRadius: '6px',
            padding: '1px 6px', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600
          }}>
            ⌘K
          </span>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/predict')}
          className="btn-primary"
          style={{ padding: '9px 18px', fontSize: '13px' }}
        >
          <Plus size={16} /> New Prediction
        </button>

        {/* Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          
          <button
            onClick={toggleTheme}
            style={{
              width: '36px', height: '36px', borderRadius: '50%',
              border: '1px solid var(--border)', background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
              transition: 'all 150ms ease',
            }}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Sun size={17} /> : <Moon size={17} color="#a78bfa" />}
          </button>
          
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                border: '1px solid var(--border)', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)',
                position: 'relative', transition: 'all 150ms ease',
              }}
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '7px', height: '7px', background: '#e11d48', borderRadius: '50%'
                }} />
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute', top: '46px', right: '0', width: '320px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                padding: '16px', zIndex: 100,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</p>
                  <button
                    onClick={() => setUnreadCount(0)}
                    style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--purple-600)', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Mark all read
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: 'var(--surface-hover)', padding: '10px', borderRadius: '10px', fontSize: '12px' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>⚡ New Prediction Completed</p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '11px' }}>48 customers scored — 7 high risk</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>2 min ago</p>
                  </div>

                  <div style={{ background: 'var(--surface-hover)', padding: '10px', borderRadius: '10px', fontSize: '12px' }}>
                    <p style={{ fontWeight: 600, color: '#e11d48' }}>🚨 High Risk Alert: Vertex Retail</p>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '2px', fontSize: '11px' }}>Probability rose to 91% after support ticket</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>18 min ago</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div ref={profileRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                color: '#fff', fontWeight: 700, fontSize: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: '4px', cursor: 'pointer', userSelect: 'none',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)'
              }}
            >
              {initials}
            </div>

            {showProfileMenu && (
              <div style={{
                position: 'absolute', top: '46px', right: '0', width: '200px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                padding: '8px', zIndex: 100,
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{displayName}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{profile.email || '—'}</p>
                </div>

                <button
                  onClick={() => { navigate('/settings'); setShowProfileMenu(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent',
                    color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Settings size={14} /> Settings
                </button>

                <button
                  onClick={toggleTheme}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent',
                    color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />} {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>

                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                <button
                  onClick={handleLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent',
                    color: '#e11d48', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default Header
