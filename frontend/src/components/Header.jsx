import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Sun, Moon, Bell, Settings, LogOut, X,
  CheckCircle2, AlertCircle, Info, ShieldAlert, CheckCheck, Trash2
} from 'lucide-react'
import { apiRequest } from '../api/client'
import {
  fetchNotifications, markAllNotificationsRead,
  markSingleNotificationRead, clearAllNotifications
} from '../api/notifications'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Header({ title = "Dashboard", subtitle = "" }) {
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    photo_url: null,
    role: 'Analyst',
    company: ''
  })

  const notifRef = useRef(null)
  const profileRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  // Load user profile & sync with localStorage events
  useEffect(() => {
    loadProfile()
    loadNotifs()

    // Listen for custom profile update events
    function handleProfileSync() {
      loadProfile()
    }
    window.addEventListener('churnguard_profile_updated', handleProfileSync)
    window.addEventListener('storage', handleProfileSync)

    return () => {
      window.removeEventListener('churnguard_profile_updated', handleProfileSync)
      window.removeEventListener('storage', handleProfileSync)
    }
  }, [])

  async function loadProfile() {
    const token = localStorage.getItem('token')
    if (!token || token === 'null' || token === 'undefined') return
    try {
      const data = await apiRequest('/profile/me')
      if (data) setProfile(data)
    } catch {
      const saved = localStorage.getItem('user_profile')
      if (saved) {
        try { setProfile(JSON.parse(saved)) } catch {}
      }
    }
  }

  async function loadNotifs() {
    const token = localStorage.getItem('token')
    if (!token || token === 'null' || token === 'undefined') return
    setLoadingNotifs(true)
    try {
      const data = await fetchNotifications()
      if (data) {
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingNotifs(false)
    }
  }

  // Click outside & Escape key listeners
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfileMenu(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowNotifications(false)
        setShowProfileMenu(false)
        setShowLogoutModal(false)
        setShowClearModal(false)
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

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch (err) {
      toast.error(err.message || 'Failed to mark notifications as read')
    }
  }

  async function handleMarkSingleRead(id) {
    try {
      await markSingleNotificationRead(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      // Non-fatal
    }
  }

  async function handleConfirmClearAll() {
    try {
      await clearAllNotifications()
      setNotifications([])
      setUnreadCount(0)
      setShowClearModal(false)
      toast.success('All notifications cleared')
    } catch (err) {
      toast.error(err.message || 'Failed to clear notifications')
    }
  }

  function handleExecuteLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('company_id')
    localStorage.removeItem('user_profile')
    setShowLogoutModal(false)
    toast.success('You have been logged out.')
    navigate('/')
  }

  const initials = [
    profile?.first_name?.[0] ?? '',
    profile?.last_name?.[0] ?? ''
  ].join('').toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.email || 'User'

  const avatarSrc = profile?.photo_url
    ? (profile.photo_url.startsWith('http') ? profile.photo_url : `${API_BASE}${profile.photo_url}`)
    : null

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
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search telemetry, customers..."
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
          
          {/* Theme Toggle */}
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
            aria-label="Toggle application theme"
          >
            {theme === 'light' ? <Sun size={17} /> : <Moon size={17} color="#a78bfa" />}
          </button>
          
          {/* Notification Bell & Drawer */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications)
                if (!showNotifications) loadNotifs()
              }}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                border: '1px solid var(--border)', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-secondary)',
                position: 'relative', transition: 'all 150ms ease',
              }}
              aria-label="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-2px', right: '-2px',
                  background: '#e11d48', color: '#ffffff',
                  fontSize: '10px', fontWeight: 800, borderRadius: '99px',
                  minWidth: '18px', height: '18px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                  boxShadow: '0 2px 6px rgba(225, 29, 72, 0.4)'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                role="region"
                aria-label="Notification drawer"
                style={{
                  position: 'absolute', top: '48px', right: '0', width: '360px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '16px', boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                  padding: '16px', zIndex: 1000, maxHeight: '480px', display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Drawer Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Notifications
                    </p>
                    {unreadCount > 0 && (
                      <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        title="Mark all as read"
                        style={{
                          background: 'none', border: 'none', fontSize: '11px',
                          color: 'var(--purple-600)', cursor: 'pointer', fontWeight: 700,
                          padding: '2px 6px', borderRadius: '4px'
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        onClick={() => setShowClearModal(true)}
                        title="Clear all notifications"
                        style={{
                          background: 'none', border: 'none', fontSize: '11px',
                          color: 'var(--text-muted)', cursor: 'pointer', padding: '2px'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px' }}
                      aria-label="Close notification drawer"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                
                {/* Notification List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '360px' }}>
                  {loadingNotifs ? (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                      Loading notifications…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div style={{ padding: '36px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px', opacity: 0.7 }} />
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>No notifications</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>You are all caught up!</p>
                    </div>
                  ) : (
                    notifications.map(notif => {
                      const isUnread = !notif.read
                      return (
                        <div
                          key={notif.id}
                          onClick={() => { if (isUnread) handleMarkSingleRead(notif.id) }}
                          style={{
                            background: isUnread ? 'var(--purple-50)' : 'var(--surface-hover)',
                            border: `1px solid ${isUnread ? 'var(--purple-200)' : 'transparent'}`,
                            padding: '12px 14px', borderRadius: '12px', cursor: isUnread ? 'pointer' : 'default',
                            transition: 'all 150ms ease', position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            {notif.type === 'alert' && <ShieldAlert size={16} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />}
                            {notif.type === 'success' && <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: '2px' }} />}
                            {notif.type === 'info' && <Info size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: '2px' }} />}
                            <div style={{ flex: 1 }}>
                              <p style={{
                                fontSize: '12px',
                                fontWeight: isUnread ? 800 : 600,
                                color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                                margin: 0
                              }}>
                                {notif.title}
                              </p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>
                                {notif.message}
                              </p>
                            </div>
                            {isUnread && (
                              <span style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: '#7c3aed', flexShrink: 0, marginTop: '4px'
                              }} />
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar & Dropdown */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <div
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                color: '#fff', fontWeight: 700, fontSize: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: '4px', cursor: 'pointer', userSelect: 'none',
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.3)',
                overflow: 'hidden'
              }}
              title={displayName}
            >
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={displayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              ) : (
                initials
              )}
            </div>

            {showProfileMenu && (
              <div style={{
                position: 'absolute', top: '46px', right: '0', width: '220px',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '14px', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                padding: '8px', zIndex: 100,
              }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {displayName}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {profile.company || 'Enterprise Tenant'} · {profile.role}
                  </p>
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
                  onClick={() => {
                    setShowProfileMenu(false)
                    setShowLogoutModal(true)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none', background: 'transparent',
                    color: '#e11d48', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
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

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-dialog-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
          }}
        >
          <div className="card" style={{
            width: '100%', maxWidth: '420px', padding: '28px', borderRadius: '16px',
            background: 'var(--surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: '#fff1f2', color: '#e11d48',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <LogOut size={20} />
              </div>
              <h3 id="logout-dialog-title" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Log out of ChurnGuard?
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              You will need to sign in again to access your ChurnGuard dashboard and workspace.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteLogout}
                style={{
                  background: '#e11d48', color: '#ffffff', border: 'none',
                  borderRadius: '10px', fontWeight: 700, fontSize: '13px',
                  padding: '8px 18px', cursor: 'pointer'
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CLEAR NOTIFICATIONS CONFIRMATION MODAL ── */}
      {showClearModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
          }}
        >
          <div className="card" style={{
            width: '100%', maxWidth: '420px', padding: '28px', borderRadius: '16px',
            background: 'var(--surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '12px',
                background: '#fff1f2', color: '#e11d48',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Trash2 size={20} />
              </div>
              <h3 id="clear-dialog-title" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Clear all notifications?
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              This will permanently delete your notification history for this workspace.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                style={{
                  background: '#e11d48', color: '#ffffff', border: 'none',
                  borderRadius: '10px', fontWeight: 700, fontSize: '13px',
                  padding: '8px 18px', cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Header
