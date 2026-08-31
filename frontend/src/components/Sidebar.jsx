import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Zap, UploadCloud, BarChart2, FileText,
  Settings as SettingsIcon, LogOut, Shield, Sparkles, X, Check
} from 'lucide-react'

const navMenu = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/customers', label: 'Customers', icon: Users },
  { path: '/predict', label: 'Predictions', icon: Zap },
  { path: '/upload', label: 'Upload Dataset', icon: UploadCloud },
  { path: '/analytics', label: 'Analytics', icon: BarChart2 },
  { path: '/reports', label: 'Reports', icon: FileText },
]

const accountMenu = [
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Sidebar() {
  const navigate = useNavigate()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showLogoutModal,  setShowLogoutModal]  = useState(false)

  function handleConfirmLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('company_id')
    localStorage.removeItem('user_profile')
    setShowLogoutModal(false)
    toast.success('You have been logged out.')
    navigate('/')
  }

  function handleUpgradePlan(planName) {
    toast.success(`Successfully upgraded to ${planName} Plan!`)
    setShowUpgradeModal(false)
  }

  return (
    <>
      <aside className="sidebar">
        
        {/* Brand Header */}
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)', flexShrink: 0
          }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              ChurnGuard
            </h1>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
              AI Churn Intelligence
            </p>
          </div>
        </div>

        {/* Navigation Sections */}
        <div style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          
          {/* MENU section */}
          <div>
            <p className="sidebar-group-title">MENU</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navMenu.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* ACCOUNT section */}
          <div>
            <p className="sidebar-group-title">ACCOUNT</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {accountMenu.map(item => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `sidebar-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>

          {/* Soft Purple Upgrade Card */}
          <div className="upgrade-card" style={{ marginTop: 'auto', marginBottom: '8px' }}>
            <p style={{ fontWeight: 700, fontSize: '13px', color: 'var(--purple-600)', marginBottom: '4px' }}>
              Need more power?
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.4 }}>
              Upgrade to Enterprise for unlimited predictions & live exports.
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="btn-primary"
              style={{ width: '100%', padding: '9px', fontSize: '12px', justifyContent: 'center' }}
            >
              Upgrade
            </button>
          </div>

        </div>

        {/* Footer Logout */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="sidebar-nav-item"
            style={{ width: '100%', color: '#e11d48', border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sidebar-logout-title"
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
              <h3 id="sidebar-logout-title" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
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

      {/* ── Upgrade Modal ── */}
      {showUpgradeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '640px', maxWidth: '100%', padding: '28px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Sparkles size={20} color="var(--purple-600)" />
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>Choose Your Plan</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Scale your churn intelligence with advanced AI features</p>
              </div>
              <button onClick={() => setShowUpgradeModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              
              {/* Pro Plan */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Pro Growth</h4>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '10px 0' }}>$49 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></p>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Up to 50,000 customers</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Automated daily predictions</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="#16a34a" /> Standard CSV & PDF reports</li>
                  </ul>
                </div>
                <button onClick={() => handleUpgradePlan('Pro Growth')} className="btn-secondary" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}>
                  Select Pro
                </button>
              </div>

              {/* Enterprise Plan */}
              <div style={{ border: '2px solid var(--purple-600)', borderRadius: '16px', padding: '20px', background: 'var(--purple-50)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Enterprise</h4>
                    <span className="badge badge-purple">Recommended</span>
                  </div>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--purple-600)', margin: '10px 0' }}>$199 <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/mo</span></p>
                  <ul style={{ listStyle: 'none', padding: 0, fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="var(--purple-600)" /> Unlimited customer records</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="var(--purple-600)" /> Custom ML model training</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Check size={14} color="var(--purple-600)" /> 24/7 Priority Support & API</li>
                  </ul>
                </div>
                <button onClick={() => handleUpgradePlan('Enterprise')} className="btn-primary" style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}>
                  Upgrade to Enterprise
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar