import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Zap, UploadCloud, BarChart2, FileText,
  Settings as SettingsIcon, LogOut, X, Database,
  ChevronLeft, ChevronRight
} from 'lucide-react'
import { useSidebar } from './useSidebar'
import ChurnGuardLogo from './ChurnGuardLogo'
import { clearAuth } from '../utils/auth'
import { logoutUser } from '../api/auth'

const navMenu = [
  { path: '/dashboard', key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/customers', key: 'customers', label: 'Customers', icon: Users },
  { path: '/predict', key: 'predict', label: 'Predict Churn', icon: Zap },
  { path: '/upload', key: 'upload', label: 'Upload Dataset', icon: UploadCloud },
  { path: '/datasets', key: 'datasets', label: 'Dataset Management', icon: Database },
  { path: '/analytics', key: 'analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/reports', key: 'reports', label: 'Reports', icon: FileText },
]

const accountMenu = [
  { path: '/settings', key: 'settings', label: 'Settings', icon: SettingsIcon },
]

function Sidebar() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobileSidebar } = useSidebar()
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  async function handleConfirmLogout() {
    await logoutUser()
    clearAuth()
    setShowLogoutModal(false)
    if (isMobileOpen) closeMobileSidebar()
    toast.success(t('settings.toasts.loggedOut'))
    navigate('/login')
  }

  const logoutLabel = t('sidebar.logout')
  const toggleLabel = isCollapsed ? t('sidebar.expandSidebar') : t('sidebar.collapseSidebar')

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. DESKTOP SIDEBAR (Sticky, Collapsible 256px ↔ 80px)
         ───────────────────────────────────────────────────────────── */}
      <aside
        className={`sidebar desktop-sidebar ${isCollapsed ? 'collapsed' : ''}`}
        aria-label={t('sidebar.mainNavAria')}
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
          <div
            style={{
              order: isCollapsed ? 2 : 1,
              overflow: 'hidden',
              maxWidth: isCollapsed ? '36px' : 'calc(100% - 36px)',
              flexShrink: 0,
            }}
          >
            <ChurnGuardLogo
              variant="sidebar"
              size="md"
              linkTo="/dashboard"
              isCollapsed={isCollapsed}
              showWordmark={!isCollapsed}
              showTagline={!isCollapsed}
              tagline="AI Churn Intelligence"
            />
          </div>

          {/* Toggle Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggleSidebar()
            }}
            className="sidebar-toggle-btn"
            title={toggleLabel}
            aria-label={toggleLabel}
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
            {!isCollapsed && <p className="sidebar-group-title">{t('sidebar.menu')}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navMenu.map(item => {
                const Icon = item.icon
                const labelText = t('sidebar.' + item.key)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'icon-only' : ''}`
                    }
                    aria-label={labelText}
                  >
                    <Icon size={18} />
                    {!isCollapsed && <span className="sidebar-nav-label">{labelText}</span>}
                    {isCollapsed && (
                      <span className="sidebar-tooltip" role="tooltip">
                        {labelText}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* ACCOUNT Group */}
          <div>
            {!isCollapsed && <p className="sidebar-group-title">{t('sidebar.account')}</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {accountMenu.map(item => {
                const Icon = item.icon
                const labelText = t('sidebar.' + item.key)
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `sidebar-nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'icon-only' : ''}`
                    }
                    aria-label={labelText}
                  >
                    <Icon size={18} />
                    {!isCollapsed && <span className="sidebar-nav-label">{labelText}</span>}
                    {isCollapsed && (
                      <span className="sidebar-tooltip" role="tooltip">
                        {labelText}
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
            }}
            aria-label={logoutLabel}
          >
            <LogOut size={18} />
            {!isCollapsed && <span className="sidebar-nav-label">{logoutLabel}</span>}
            {isCollapsed && (
              <span className="sidebar-tooltip" role="tooltip">
                {logoutLabel}
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
          <div onClick={closeMobileSidebar}>
            <ChurnGuardLogo
              variant="sidebar"
              size="md"
              linkTo="/dashboard"
              showWordmark={true}
              showTagline={true}
              tagline="AI Churn Intelligence"
            />
          </div>

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
            <p className="sidebar-group-title">{t('sidebar.menu')}</p>
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
                    <span>{t('sidebar.' + item.key)}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>

          <div>
            <p className="sidebar-group-title">{t('sidebar.account')}</p>
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
                    <span>{t('sidebar.' + item.key)}</span>
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
            style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <LogOut size={18} />
            <span>{logoutLabel}</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. LOGOUT CONFIRMATION MODAL (Strictly English)
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
                  background: 'var(--danger-subtle)',
                  color: 'var(--danger)',
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
                {t('sidebar.logoutModalTitle')}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              {t('sidebar.logoutModalDesc')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                id="sidebar-logout-cancel-btn"
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                {t('common.cancel')}
              </button>
              <button
                id="sidebar-logout-confirm-btn"
                type="button"
                onClick={handleConfirmLogout}
                style={{
                  background: 'var(--danger)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '13px',
                  padding: '8px 18px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px var(--danger-border)',
                }}
              >
                {t('sidebar.logoutConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
