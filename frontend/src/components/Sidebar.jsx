import { useState } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Zap, UploadCloud, BarChart2, FileText,
  Settings as SettingsIcon, LogOut, Shield, X,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { useSidebar } from './useSidebar'

const navMenu = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/predict', label: 'Predict Churn', icon: Zap },
  { path: '/upload', label: 'Upload Dataset', icon: UploadCloud },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/reports', label: 'Reports', icon: FileText },
]

const accountMenu = [
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Sidebar() {
  const navigate = useNavigate()
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  function handleConfirmLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('company_id')
    localStorage.removeItem('user_profile')
    setShowLogoutModal(false)
    if (isMobileOpen) closeMobileSidebar()
    toast.success('You have been logged out.')
    navigate('/')
  }

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. DESKTOP SIDEBAR (Sticky, Collapsible 256px ↔ 80px)
         ───────────────────────────────────────────────────────────── */}
      <aside
        className={`sidebar desktop-sidebar ${isCollapsed ? 'collapsed' : ''}`}
        aria-label="Main sidebar navigation"
      >
        {/* Brand & Toggle Header */}
        <div
          style={{
            padding: isCollapsed ? '8px 8px 10px 8px' : '18px 16px',
            display: 'flex',
            flexDirection: isCollapsed ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: isCollapsed ? '6px' : '10px',
            borderBottom: '1px solid var(--border)',
            minHeight: '73px',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          {/* Logo & Brand text (Clickable -> /dashboard) */}
          <Link
            to="/dashboard"
            className="sidebar-brand"
            aria-label="ChurnGuard - Go to Dashboard"
            title="ChurnGuard Dashboard"
            style={{
              order: isCollapsed ? 2 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'inherit',
              overflow: 'hidden',
              borderRadius: '10px',
              maxWidth: isCollapsed ? '36px' : 'calc(100% - 36px)',
              flexShrink: 0,
            }}
          >
            <div
              className="sidebar-brand-icon"
              style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #7C3AED 100%)',
                borderRadius: '10px',
                border: '1px solid rgba(167, 139, 250, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)',
                flexShrink: 0,
              }}
            >
              <Shield size={20} color="#EDE9FE" />
            </div>

            {!isCollapsed && (
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <h1 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.15, margin: 0 }}>
                  ChurnGuard
                </h1>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, margin: 0, marginTop: '2px' }}>
                  AI Churn Intelligence
                </p>
              </div>
            )}
          </Link>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleSidebar()
            }}
            className="sidebar-toggle-btn"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              order: isCollapsed ? 1 : 2,
              flexShrink: 0,
            }}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Navigation Section */}
        <div
          className="sidebar-nav-container"
          style={{
            flex: 1,
            padding: isCollapsed ? '16px 8px' : '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            overflowY: isCollapsed ? 'visible' : 'auto',
            overflowX: 'visible',
          }}
        >
          {/* MENU Group */}
          <div>
            {!isCollapsed && <p className="sidebar-group-title">MENU</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navMenu.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'icon-only' : ''}`
                    }
                    aria-label={item.label}
                  >
                    <Icon size={18} />
                    {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
                    {isCollapsed && (
                      <span className="sidebar-tooltip" role="tooltip">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* ACCOUNT Group */}
          <div>
            {!isCollapsed && <p className="sidebar-group-title">ACCOUNT</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {accountMenu.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'icon-only' : ''}`
                    }
                    aria-label={item.label}
                  >
                    <Icon size={18} />
                    {!isCollapsed && <span className="sidebar-nav-label">{item.label}</span>}
                    {isCollapsed && (
                      <span className="sidebar-tooltip" role="tooltip">
                        {item.label}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer Logout */}
        <div
          style={{
            padding: isCollapsed ? '14px 8px' : '14px 12px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className={`sidebar-nav-item logout-nav-item ${isCollapsed ? 'icon-only' : ''}`}
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#e11d48',
            }}
            aria-label="Logout"
          >
            <LogOut size={18} />
            {!isCollapsed && <span className="sidebar-nav-label">Logout</span>}
            {isCollapsed && (
              <span className="sidebar-tooltip" role="tooltip">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────
          2. MOBILE DRAWER SIDEBAR (Slide-over for screens < 1024px)
         ───────────────────────────────────────────────────────────── */}
      {isMobileOpen && (
        <div
          className={`mobile-sidebar-backdrop ${isMobileOpen ? 'open' : ''}`}
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <div
        className={`mobile-sidebar-drawer ${isMobileOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation drawer"
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <Link
            to="/dashboard"
            onClick={closeMobileSidebar}
            className="sidebar-brand"
            aria-label="ChurnGuard - Go to Dashboard"
            title="ChurnGuard Dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
              color: 'inherit',
              borderRadius: '10px',
            }}
          >
            <div
              className="sidebar-brand-icon"
              style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #7C3AED 100%)',
                borderRadius: '10px',
                border: '1px solid rgba(167, 139, 250, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)',
                flexShrink: 0,
              }}
            >
              <Shield size={20} color="#EDE9FE" />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                ChurnGuard
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                AI Churn Intelligence
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={closeMobileSidebar}
            className="sidebar-toggle-btn"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Links */}
        <div style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto' }}>
          <div>
            <p className="sidebar-group-title">MENU</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navMenu.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileSidebar}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>

          <div>
            <p className="sidebar-group-title">ACCOUNT</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {accountMenu.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={closeMobileSidebar}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer Logout */}
        <div style={{ padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setShowLogoutModal(true)}
            className="sidebar-nav-item logout-nav-item"
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#e11d48' }}
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. LOGOUT CONFIRMATION MODAL
         ───────────────────────────────────────────────────────────── */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sidebar-logout-dialog-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2500,
            padding: '20px',
            backdropFilter: 'blur(2px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogoutModal(false)
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '28px',
              borderRadius: '16px',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: '#fff1f2',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LogOut size={20} />
              </div>
              <h3
                id="sidebar-logout-dialog-title"
                style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}
              >
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
                onClick={handleConfirmLogout}
                style={{
                  background: '#e11d48',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '13px',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(225, 29, 72, 0.3)',
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar