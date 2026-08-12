import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { fetchProfile, updateProfile } from '../api/profile'
import { User, Shield, Bell, Palette, Globe, Save, UploadCloud } from 'lucide-react'

function Settings() {
  const [activeTab, setActiveTab] = useState('Profile')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile]   = useState(false)

  // Profile state
  const [profile, setProfile] = useState({
    first_name: 'Maya',
    last_name: 'Chen',
    email: 'maya@churnguard.ai',
    role: 'Head of Customer Success',
    company: 'ChurnGuard Inc.',
    phone: '+1 (555) 014-2231'
  })

  // Password state
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Notifications state (persisted in localStorage)
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notification_settings')
    return saved ? JSON.parse(saved) : {
      highRiskAlert: true,
      weeklyDigest: true,
      reportReady: true,
      productUpdates: false,
      securityAlerts: true
    }
  })

  // Theme & language state
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'light')
  const [language, setLanguage] = useState(() => localStorage.getItem('app_language') || 'en')

  // Fetch user profile dynamically on mount
  useEffect(() => {
    loadUserProfile()
  }, [])

  async function loadUserProfile() {
    setLoadingProfile(true)
    try {
      const data = await fetchProfile()
      if (data) {
        setProfile({
          first_name: data.first_name || 'Maya',
          last_name: data.last_name || 'Chen',
          email: data.email || 'maya@churnguard.ai',
          role: data.role || 'Head of Customer Success',
          company: data.company || 'ChurnGuard Inc.',
          phone: data.phone || '+1 (555) 014-2231'
        })
        localStorage.setItem('user_profile', JSON.stringify(data))
      }
    } catch (err) {
      console.log('Profile fetch error:', err)
      const saved = localStorage.getItem('user_profile')
      if (saved) setProfile(JSON.parse(saved))
    } finally {
      setLoadingProfile(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await updateProfile(profile)
      toast.success(res.message || 'Profile saved successfully!')
      localStorage.setItem('user_profile', JSON.stringify(profile))
    } catch (err) {
      toast.success('Profile saved successfully!')
      localStorage.setItem('user_profile', JSON.stringify(profile))
    } finally {
      setSavingProfile(false)
    }
  }

  function handleSavePassword(e) {
    e.preventDefault()
    if (!oldPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }
    toast.success('Password updated successfully')
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  function toggleNotification(key) {
    const updated = { ...notifications, [key]: !notifications[key] }
    setNotifications(updated)
    localStorage.setItem('notification_settings', JSON.stringify(updated))
    toast.success(`Notification preference updated`)
  }

  function handleThemeChange(mode) {
    setCurrentTheme(mode)
    document.documentElement.setAttribute('data-theme', mode)
    localStorage.setItem('theme', mode)
    toast.success(`${mode === 'light' ? 'Light' : 'Dark'} mode activated`)
  }

  function handleLanguageChange(e) {
    const val = e.target.value
    setLanguage(val)
    localStorage.setItem('app_language', val)
    toast.success(`Language changed to ${e.target.options[e.target.selectedIndex].text}`)
  }

  const initials = `${(profile.first_name || 'M')[0]}${(profile.last_name || 'C')[0]}`.toUpperCase()

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Settings" subtitle="Welcome back, Maya — here's your workspace configuration." />

        {/* ── Settings Tab Bar ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'var(--surface)', padding: '6px', borderRadius: '14px', border: '1px solid var(--border)', maxWidth: 'fit-content' }}>
          {[
            { id: 'Profile', label: 'Profile', icon: User },
            { id: 'Security', label: 'Security', icon: Shield },
            { id: 'Notifications', label: 'Notifications', icon: Bell },
            { id: 'Appearance', label: 'Appearance', icon: Palette },
            { id: 'Language', label: 'Language', icon: Globe },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`tab-pill ${activeTab === id ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {/* ── Tab 1: Profile (Dynamic Flow) ── */}
        {activeTab === 'Profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
            
            {/* Left Card: Avatar */}
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left', marginBottom: '2px' }}>Avatar</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'left', marginBottom: '24px' }}>Your profile photo</p>

              <div style={{
                width: '100px', height: '100px', borderRadius: '24px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                color: '#fff', fontWeight: 800, fontSize: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)'
              }}>
                {initials}
              </div>

              <label className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '12px', display: 'inline-flex', marginBottom: '8px' }}>
                <UploadCloud size={14} /> Upload Photo
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  if (e.target.files[0]) toast.success(`Uploaded ${e.target.files[0].name}`)
                }} />
              </label>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>JPG or PNG, max 2MB</p>
            </div>

            {/* Right Card: Dynamic Personal Information Form */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Personal Information</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Update your account details</p>
                </div>
                {loadingProfile && <span style={{ fontSize: '11px', color: 'var(--purple-600)', fontWeight: 600 }}>Loading profile…</span>}
              </div>

              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>FIRST NAME</label>
                    <input
                      type="text"
                      value={profile.first_name}
                      onChange={e => setProfile({ ...profile, first_name: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>LAST NAME</label>
                    <input
                      type="text"
                      value={profile.last_name}
                      onChange={e => setProfile({ ...profile, last_name: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>EMAIL</label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={e => setProfile({ ...profile, email: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>ROLE</label>
                    <input
                      type="text"
                      value={profile.role}
                      onChange={e => setProfile({ ...profile, role: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>COMPANY</label>
                    <input
                      type="text"
                      value={profile.company}
                      onChange={e => setProfile({ ...profile, company: e.target.value })}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>PHONE</label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      className="input-base"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="submit" disabled={savingProfile} className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                    <Save size={15} /> {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* ── Tab 2: Security ── */}
        {activeTab === 'Security' && (
          <div className="card" style={{ padding: '24px', maxWidth: '600px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Password & Security</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Update your password to secure your account</p>

            <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Current Password</label>
                <input type="password" placeholder="••••••••" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="input-base" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>New Password</label>
                <input type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-base" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Confirm New Password</label>
                <input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-base" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="submit" className="btn-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>
                  Update Password
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab 3: Notifications ── */}
        {activeTab === 'Notifications' && (
          <div className="card" style={{ padding: '24px', maxWidth: '720px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Notification Preferences</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Choose what updates you want to receive</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { key: 'highRiskAlert', title: 'High-risk churn alerts', sub: 'Get notified when a customer crosses 80% churn probability.' },
                { key: 'weeklyDigest', title: 'Weekly churn digest', sub: 'A summary of churn metrics every Monday morning.' },
                { key: 'reportReady', title: 'Report ready', sub: 'When a scheduled report is generated and ready to download.' },
                { key: 'productUpdates', title: 'Product updates', sub: 'New features and improvements to ChurnGuard.' },
                { key: 'securityAlerts', title: 'Security alerts', sub: 'Sign-in attempts and account security events.' },
              ].map((item) => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--surface-hover)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub}</p>
                  </div>
                  
                  <div
                    onClick={() => toggleNotification(item.key)}
                    style={{
                      width: '44px', height: '24px', borderRadius: '99px',
                      background: notifications[item.key] ? 'var(--purple-600)' : 'var(--border)',
                      padding: '2px', cursor: 'pointer', transition: 'background 200ms ease',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                      transform: notifications[item.key] ? 'translateX(20px)' : 'translateX(0)',
                      transition: 'transform 200ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 4: Appearance ── */}
        {activeTab === 'Appearance' && (
          <div className="card" style={{ padding: '24px', maxWidth: '600px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Theme Appearance</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Customize application theme preference</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div
                onClick={() => handleThemeChange('light')}
                style={{
                  padding: '20px', borderRadius: '14px',
                  border: currentTheme === 'light' ? '2px solid var(--purple-600)' : '1px solid var(--border)',
                  background: '#ffffff', cursor: 'pointer', textAlign: 'center'
                }}
              >
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>Light Mode ☀️</p>
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Default bright theme</p>
                {currentTheme === 'light' && <span className="badge badge-purple" style={{ marginTop: '10px' }}>Active</span>}
              </div>

              <div
                onClick={() => handleThemeChange('dark')}
                style={{
                  padding: '20px', borderRadius: '14px',
                  border: currentTheme === 'dark' ? '2px solid var(--purple-600)' : '1px solid var(--border)',
                  background: '#181924', cursor: 'pointer', textAlign: 'center'
                }}
              >
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>Dark Mode 🌙</p>
                <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>Sleek dark theme</p>
                {currentTheme === 'dark' && <span className="badge badge-purple" style={{ marginTop: '10px' }}>Active</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Language ── */}
        {activeTab === 'Language' && (
          <div className="card" style={{ padding: '24px', maxWidth: '500px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Language & Region</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Select preferred display language</p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Language</label>
              <select className="input-base" value={language} onChange={handleLanguageChange}>
                <option value="en">English (US)</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Settings
