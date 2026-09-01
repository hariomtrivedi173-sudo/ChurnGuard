import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Sun, Moon, Bell, Settings, LogOut, X,
  CheckCircle2, Info, ShieldAlert, Trash2, Menu,
  RefreshCw, Zap, User, ArrowRight, SearchX
} from 'lucide-react'
import { apiRequest } from '../api/client'
import {
  fetchNotifications, markAllNotificationsRead,
  markSingleNotificationRead, clearAllNotifications
} from '../api/notifications'
import { getSuggestions } from '../utils/searchIndex'
import toast from 'react-hot-toast'
import { useSidebar } from './useSidebar'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function Header({
  title = "Dashboard",
  subtitle = "",
  onRefresh,
  isRefreshing = false,
  loading = false,
  onRunAnalysis,
  isAnalyzing = false,
  analyzing = false,
  showRunAnalysis = true,
  hasData = true,
  extraActions = null,
  searchQuery = "",
  onSearchChange = null,
}) {
  const navigate = useNavigate()
  const { openMobileSidebar } = useSidebar()

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'light'
    } catch {
      return 'light'
    }
  })

  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu,   setShowProfileMenu]   = useState(false)
  const [showLogoutModal,   setShowLogoutModal]   = useState(false)
  const [showClearModal,    setShowClearModal]    = useState(false)

  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const [localSearch, setLocalSearch] = useState(searchQuery)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0)
  const [internalRefreshing, setInternalRefreshing] = useState(false)

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
  const searchInputRef = useRef(null)
  const searchContainerRef = useRef(null)

  const effectiveRefreshing = isRefreshing || loading || internalRefreshing
  const effectiveAnalyzing = isAnalyzing || analyzing

  const filteredSuggestions = getSuggestions(localSearch)

  // Sync theme to DOM
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {}
  }, [theme])

  // Load user profile & sync with storage events
  useEffect(() => {
    loadProfile()
    loadNotifs()

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

  // Keyboard shortcut for Search (⌘K / Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        setIsSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
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
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchOpen(false)
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setShowNotifications(false)
        setShowProfileMenu(false)
        setShowLogoutModal(false)
        setShowClearModal(false)
        setIsSearchOpen(false)
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

  async function handleRefreshClick() {
    if (effectiveRefreshing) return
    if (onRefresh) {
      onRefresh()
    } else {
      setInternalRefreshing(true)
      await Promise.all([loadProfile(), loadNotifs()])
      setTimeout(() => setInternalRefreshing(false), 600)
    }
  }

  function handleRunAnalysisClick() {
    if (onRunAnalysis) {
      onRunAnalysis()
    } else {
      navigate('/predict')
    }
  }

  function handleSelectSuggestion(suggestion) {
    setIsSearchOpen(false)
    setLocalSearch('')
    if (onSearchChange) onSearchChange('')

    if (suggestion.action === 'notifications') {
      setShowNotifications(true)
    } else if (suggestion.action === 'logout') {
      setShowLogoutModal(true)
    } else if (suggestion.path) {
      navigate(suggestion.path)
    }
  }

  function handleSearchKeyDown(e) {
    if (!isSearchOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsSearchOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredSuggestions.length > 0) {
        setSelectedSearchIndex(prev => (prev + 1) % filteredSuggestions.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredSuggestions.length > 0) {
        setSelectedSearchIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length)
      }
    } else if (e.key === 'Enter') {
      if (isSearchOpen && filteredSuggestions.length > 0 && selectedSearchIndex >= 0 && selectedSearchIndex < filteredSuggestions.length) {
        e.preventDefault()
        handleSelectSuggestion(filteredSuggestions[selectedSearchIndex])
      } else {
        const term = localSearch.trim()
        setIsSearchOpen(false)
        if (onSearchChange) {
          onSearchChange(term)
        } else if (term) {
          navigate(`/customers?search=${encodeURIComponent(term)}`)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsSearchOpen(false)
      searchInputRef.current?.blur()
    }
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
    } catch {
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
    setShowProfileMenu(false)
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
    <header className="dashboard-navbar" aria-label="Dashboard Top Navigation">
      {/* ─────────────────────────────────────────────────────────────
          LEFT GROUP: Mobile Hamburger, Page Title, Search Bar
         ───────────────────────────────────────────────────────────── */}
      <div className="navbar-left-group">
        {/* Mobile Hamburger Button */}
        <button
          type="button"
          onClick={openMobileSidebar}
          className="mobile-menu-btn"
          aria-label="Open sidebar menu"
        >
          <Menu size={20} />
        </button>

        {/* Page Title & Subtitle */}
        <div className="navbar-title-wrap">
          <h1 className="navbar-title">{title}</h1>
          {subtitle && <p className="navbar-subtitle">{subtitle}</p>}
        </div>

        {/* Search Bar Container with Smart Suggestions */}
        <div ref={searchContainerRef} className="navbar-search-container">
          <Search size={15} className="navbar-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search telemetry, customers, pages..."
            value={onSearchChange ? searchQuery : localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value)
              if (onSearchChange) onSearchChange(e.target.value)
              setIsSearchOpen(true)
              setSelectedSearchIndex(0)
            }}
            onFocus={() => {
              setIsSearchOpen(true)
              setSelectedSearchIndex(0)
            }}
            onKeyDown={handleSearchKeyDown}
            className="navbar-search-input"
            aria-label="Search telemetry, customers and pages"
            aria-expanded={isSearchOpen}
            aria-autocomplete="list"
            role="combobox"
          />
          <kbd className="navbar-search-kbd">⌘K</kbd>

          {/* Smart Suggestions Dropdown */}
          {isSearchOpen && (
            <div className="search-suggestions-dropdown" role="listbox">
              <div className="search-suggestions-header">
                <span>{localSearch.trim() ? 'Matching Results' : 'Suggested Pages & Actions'}</span>
                <span className="search-suggestions-count">
                  {filteredSuggestions.length} {filteredSuggestions.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              <div className="search-suggestions-list">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map((item, idx) => {
                    const Icon = item.icon
                    const isSelected = idx === selectedSearchIndex
                    return (
                      <div
                        key={item.id}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setSelectedSearchIndex(idx)}
                        onClick={() => handleSelectSuggestion(item)}
                        className={`search-suggestion-item ${isSelected ? 'selected' : ''}`}
                      >
                        <div className="search-suggestion-icon-wrap">
                          <Icon size={16} />
                        </div>
                        <div className="search-suggestion-info">
                          <div className="search-suggestion-title-row">
                            <span className="search-suggestion-label">{item.label}</span>
                            {item.category && (
                              <span className="search-suggestion-category">{item.category}</span>
                            )}
                          </div>
                          <p className="search-suggestion-desc">{item.description}</p>
                        </div>
                        <ArrowRight size={14} className="search-suggestion-arrow" />
                      </div>
                    )
                  })
                ) : (
                  <div className="search-suggestions-empty">
                    <SearchX size={26} className="search-empty-icon" />
                    <p className="search-empty-title">No results found</p>
                    <p className="search-empty-sub">
                      No matches found for &ldquo;<span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{localSearch}</span>&rdquo;. Try searching for <em>dashboard</em>, <em>customers</em>, or <em>predict</em>.
                    </p>
                  </div>
                )}
              </div>

              <div className="search-suggestions-footer">
                <div className="search-footer-hint">
                  <kbd>↑</kbd><kbd>↓</kbd> <span>navigate</span>
                  <kbd>↵</kbd> <span>select</span>
                  <kbd>esc</kbd> <span>close</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT GROUP: Actions, Divider, Theme/Notifs, Divider, Avatar
         ───────────────────────────────────────────────────────────── */}
      <div className="navbar-right-group">
        {/* Extra page-specific actions (e.g. Add Customer) */}
        {extraActions && <div className="navbar-extra-actions">{extraActions}</div>}

        {/* PRIMARY ACTION: + New Prediction */}
        <button
          type="button"
          onClick={() => navigate('/predict')}
          className="btn-primary navbar-action-primary"
          title="Create a new customer churn prediction"
        >
          <Plus size={16} />
          <span>New Prediction</span>
        </button>

        {/* SECONDARY ACTION: Run Analysis */}
        {showRunAnalysis && (
          <button
            type="button"
            onClick={handleRunAnalysisClick}
            disabled={effectiveAnalyzing || !hasData}
            className="navbar-action-secondary"
            title={!hasData ? 'Upload a dataset first' : 'Run batch ML churn analysis'}
          >
            {effectiveAnalyzing ? (
              <>
                <div className="btn-spinner" />
                <span>Analyzing…</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>Run Analysis</span>
              </>
            )}
          </button>
        )}

        {/* REFRESH ACTION: Icon-Only */}
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={effectiveRefreshing}
          className="navbar-icon-btn refresh-btn"
          title="Refresh dashboard data"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw size={16} className={effectiveRefreshing ? 'spin-animation' : ''} />
        </button>

        {/* Vertical Divider 1 */}
        <div className="navbar-divider" aria-hidden="true" />

        {/* THEME TOGGLE */}
        <button
          type="button"
          onClick={toggleTheme}
          className="navbar-icon-btn theme-btn"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          aria-label="Toggle application theme"
        >
          {theme === 'light' ? <Sun size={17} /> : <Moon size={17} color="#A78BFA" />}
        </button>

        {/* NOTIFICATIONS BELL & DRAWER */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications)
              if (!showNotifications) loadNotifs()
            }}
            className="navbar-icon-btn notif-btn"
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={showNotifications}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="notif-badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Drawer */}
          {showNotifications && (
            <div
              className="notification-drawer"
              role="region"
              aria-label="Notification drawer"
            >
              {/* Drawer Header */}
              <div className="drawer-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="drawer-title">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="drawer-text-action"
                      title="Mark all notifications as read"
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowClearModal(true)}
                      className="drawer-icon-action"
                      title="Clear all notifications"
                      aria-label="Clear all notifications"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    className="drawer-icon-action"
                    title="Close notifications"
                    aria-label="Close notifications"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="drawer-list">
                {loadingNotifs ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                    Loading notifications…
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={30} color="#10B981" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      No notifications
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      You are all caught up!
                    </p>
                  </div>
                ) : (
                  notifications.map(notif => {
                    const isUnread = !notif.read
                    return (
                      <div
                        key={notif.id}
                        onClick={() => { if (isUnread) handleMarkSingleRead(notif.id) }}
                        className={`notification-item ${isUnread ? 'unread' : ''}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          {notif.type === 'alert' && <ShieldAlert size={16} color="#EF4444" style={{ flexShrink: 0, marginTop: '2px' }} />}
                          {notif.type === 'success' && <CheckCircle2 size={16} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />}
                          {notif.type === 'info' && <Info size={16} color="#7C3AED" style={{ flexShrink: 0, marginTop: '2px' }} />}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <p className="notification-item-title">
                              {notif.title}
                            </p>
                            <p className="notification-item-msg">
                              {notif.message}
                            </p>
                          </div>
                          {isUnread && <span className="notification-unread-dot" />}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vertical Divider 2 */}
        <div className="navbar-divider" aria-hidden="true" />

        {/* FAR-RIGHT ELEMENT: USER AVATAR & DROPDOWN */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="navbar-avatar-btn"
            title={displayName}
            aria-label="User profile menu"
            aria-expanded={showProfileMenu}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                className="navbar-avatar-img"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            ) : (
              <span className="navbar-avatar-initials">{initials}</span>
            )}
          </button>

          {/* Profile Menu Dropdown */}
          {showProfileMenu && (
            <div className="profile-dropdown-menu" role="menu">
              <div className="profile-dropdown-header">
                <p className="profile-name">{displayName}</p>
                <p className="profile-meta">
                  {profile.company || 'Enterprise Workspace'} · {profile.role}
                </p>
                {profile.email && <p className="profile-email">{profile.email}</p>}
              </div>

              <button
                type="button"
                onClick={() => {
                  navigate('/settings')
                  setShowProfileMenu(false)
                }}
                className="profile-menu-item"
              >
                <User size={15} />
                <span>Profile & Account</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate('/settings')
                  setShowProfileMenu(false)
                }}
                className="profile-menu-item"
              >
                <Settings size={15} />
                <span>Settings</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="profile-menu-item"
              >
                {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              </button>

              <div className="dropdown-divider" />

              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false)
                  setShowLogoutModal(true)
                }}
                className="profile-menu-item logout-item"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          LOGOUT CONFIRMATION MODAL
         ───────────────────────────────────────────────────────────── */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="navbar-logout-dialog-title"
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutModal(false)
          }}
        >
          <div className="card modal-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="modal-icon-badge danger">
                <LogOut size={20} />
              </div>
              <h3 id="navbar-logout-dialog-title" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
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
                className="btn-danger"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          CLEAR ALL NOTIFICATIONS MODAL
         ───────────────────────────────────────────────────────────── */}
      {showClearModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-notifs-dialog-title"
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearModal(false)
          }}
        >
          <div className="card modal-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div className="modal-icon-badge danger">
                <Trash2 size={20} />
              </div>
              <h3 id="clear-notifs-dialog-title" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
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
                className="btn-danger"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
