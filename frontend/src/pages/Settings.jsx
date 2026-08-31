import { useState, useEffect, useMemo, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  fetchProfile, updateProfile,
  requestPasswordOtp, verifyPasswordOtp,
  uploadProfilePhoto, deleteProfilePhoto
} from '../api/profile'
import {
  User, Shield, Bell, Palette, Globe, Save, UploadCloud, Lock,
  Eye, EyeOff, Check, AlertCircle, CheckCircle2, Building2, Phone,
  Mail, Trash2, X, RefreshCw, KeyRound
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const COMPANY_TYPES = [
  'Private Limited',
  'Public Limited',
  'OPC',
  'LLP',
  'Partnership',
  'Sole Proprietorship',
  'Startup',
  'Other'
]

const INDUSTRIES = [
  'Information Technology',
  'Finance & Banking',
  'Healthcare',
  'Retail',
  'Telecommunications',
  'Education',
  'Manufacturing',
  'E-commerce',
  'Travel & Hospitality',
  'Other'
]

const ROLES = [
  'Analyst',
  'Data Analyst',
  'Data Scientist',
  'Business Analyst',
  'Manager',
  'Developer',
  'HR',
  'Marketing',
  'Sales',
  'Customer Success',
  'Executive',
  'Other'
]

const DEPARTMENTS = [
  'Analytics',
  'IT',
  'HR',
  'Sales',
  'Marketing',
  'Finance',
  'Customer Success',
  'Operations',
  'Management',
  'Other'
]

const COMPANY_SIZES = [
  '1–10',
  '11–50',
  '51–200',
  '201–500',
  '500–1000',
  '1000+'
]

const LANGUAGES = [
  { code: 'en', label: 'English (US)' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)' },
]

const COUNTRIES = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'Singapore',
  'Other'
]

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const PHONE_REGEX = /^[6-9][0-9]{9}$/
const NAME_REGEX  = /^[a-zA-Z\s'-]{2,50}$/

function maskEmailHelper(email) {
  if (!email || !email.includes('@')) return 'your registered email'
  const [user, domain] = email.split('@')
  const maskedUser = user.length <= 2 ? user[0] + '***' : user[0] + '***' + user[user.length - 1]
  return `${maskedUser}@${domain}`
}

function Settings() {
  const [activeTab, setActiveTab] = useState('Profile')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingProfile, setSavingProfile]   = useState(false)

  // Profile Form State
  const [profile, setProfile] = useState({
    first_name: '',
    last_name: '',
    email: '',
    role: 'Analyst',
    company: '',
    company_type: 'Private Limited',
    industry: 'Information Technology',
    department: 'Analytics',
    company_size: '11–50',
    phone: '',
    country: 'India',
    language: 'en',
    photo_url: null
  })

  // Staged Avatar Photo for Client-Side Preview
  const [stagedPhotoFile, setStagedPhotoFile] = useState(null)
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState(null)
  const [showRemovePhotoModal, setShowRemovePhotoModal] = useState(false)
  const fileInputRef = useRef(null)

  const [touched, setTouched] = useState({})

  // Security (Password Change & Email OTP) State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw,   setShowCurrentPw]   = useState(false)
  const [showNewPw,       setShowNewPw]       = useState(false)
  const [showConfirmPw,   setShowConfirmPw]   = useState(false)
  const [requestingOtp,   setRequestingOtp]   = useState(false)
  const [verifyingOtp,    setVerifyingOtp]    = useState(false)
  const [pwTouched,       setPwTouched]       = useState({})
  const [pwError,         setPwError]         = useState('')
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('')

  // OTP Verification Modal State
  const [showOtpModal,    setShowOtpModal]    = useState(false)
  const [otpDigits,       setOtpDigits]       = useState(['', '', '', '', '', ''])
  const [otpError,        setOtpError]        = useState('')
  const [maskedEmail,     setMaskedEmail]     = useState('')
  const [resendCooldown,  setResendCooldown]  = useState(0)
  const [resendingOtp,    setResendingOtp]    = useState(false)
  const otpInputRefs = useRef([])

  // Notifications State (persisted in localStorage)
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

  // Theme State
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('theme') || 'light')

  // Password Requirement Criteria
  const passwordCriteria = useMemo(() => ({
    length:    newPassword.length >= 8 && newPassword.length <= 72,
    hasUpper:  /[A-Z]/.test(newPassword),
    hasLower:  /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
  }), [newPassword])

  const isNewPasswordValid = Object.values(passwordCriteria).every(Boolean)

  // Profile Validation Errors
  const profileErrors = useMemo(() => {
    const errs = {}

    if (touched.first_name) {
      if (!profile.first_name.trim()) {
        errs.first_name = 'First name is required.'
      } else if (!NAME_REGEX.test(profile.first_name.trim())) {
        errs.first_name = 'First name can contain letters only (2–50 characters).'
      }
    }

    if (touched.last_name && profile.last_name.trim()) {
      if (!/^[a-zA-Z\s'-]{1,50}$/.test(profile.last_name.trim())) {
        errs.last_name = 'Last name can contain letters only.'
      }
    }

    if (touched.phone && profile.phone.trim()) {
      const cleanPhone = profile.phone.replace(/\D/g, '')
      if (!PHONE_REGEX.test(cleanPhone)) {
        errs.phone = 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.'
      }
    }

    if (touched.email && profile.email.trim()) {
      if (!EMAIL_REGEX.test(profile.email.trim())) {
        errs.email = 'Please enter a valid work email address.'
      }
    }

    return errs
  }, [profile, touched])

  // Password Validation Errors
  const passwordErrors = useMemo(() => {
    const errs = {}

    if (pwTouched.currentPassword && !currentPassword) {
      errs.currentPassword = 'Current password is required.'
    }

    if (pwTouched.newPassword) {
      if (!newPassword) {
        errs.newPassword = 'New password is required.'
      } else if (!isNewPasswordValid) {
        errs.newPassword = 'Password does not meet all security requirements.'
      }
    }

    if (pwTouched.confirmPassword) {
      if (!confirmPassword) {
        errs.confirmPassword = 'Confirmation password is required.'
      } else if (confirmPassword !== newPassword) {
        errs.confirmPassword = 'New passwords do not match.'
      }
    }

    return errs
  }, [currentPassword, newPassword, confirmPassword, isNewPasswordValid, pwTouched])

  // ── Keystroke Filters ──
  function handlePhoneKeyDown(e) {
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) ||
      e.ctrlKey || e.metaKey
    ) {
      return
    }
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      return
    }
    if (profile.phone.replace(/\D/g, '').length >= 10 && !window.getSelection().toString()) {
      e.preventDefault()
    }
  }

  function handlePhonePaste(e) {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData('text') || ''
    let cleaned = pasted.replace(/^(?:\+91|91|0)/, '').replace(/\D/g, '')
    cleaned = cleaned.slice(0, 10)
    setProfile(prev => ({ ...prev, phone: cleaned }))
    setTouched(prev => ({ ...prev, phone: true }))
  }

  function handleNameKeyDown(e) {
    if (
      ['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(e.key) ||
      e.ctrlKey || e.metaKey
    ) {
      return
    }
    if (!/^[a-zA-Z\s'-]$/.test(e.key)) {
      e.preventDefault()
    }
  }

  // ── Avatar Photo Staging & Preview ──
  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WEBP image under 5 MB.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please upload a JPG, PNG, or WEBP image under 5 MB.')
      return
    }

    setStagedPhotoFile(file)
    const previewUrl = URL.createObjectURL(file)
    setStagedPreviewUrl(previewUrl)
    toast.success('Photo preview ready. Click "Save Changes" to apply.')
  }

  async function handleConfirmRemovePhoto() {
    try {
      await deleteProfilePhoto()
      setProfile(prev => ({ ...prev, photo_url: null }))
      setStagedPhotoFile(null)
      if (stagedPreviewUrl) {
        URL.revokeObjectURL(stagedPreviewUrl)
        setStagedPreviewUrl(null)
      }
      setShowRemovePhotoModal(false)
      window.dispatchEvent(new Event('churnguard_profile_updated'))
      toast.success('Profile photo removed')
    } catch (err) {
      toast.error(err.message || 'Failed to remove photo')
    }
  }

  // Load User Profile on Mount
  useEffect(() => {
    loadUserProfile()
  }, [])

  async function loadUserProfile() {
    setLoadingProfile(true)
    try {
      const data = await fetchProfile()
      if (data) {
        setProfile({
          first_name:   data.first_name   || '',
          last_name:    data.last_name    || '',
          email:        data.email        || '',
          role:         data.role         || 'Analyst',
          company:      data.company      || '',
          company_type: data.company_type || 'Private Limited',
          industry:     data.industry     || 'Information Technology',
          department:   data.department   || 'Analytics',
          company_size: data.company_size || '11–50',
          phone:        data.phone        || '',
          country:      data.country      || 'India',
          language:     data.language     || 'en',
          photo_url:    data.photo_url    || null
        })
        localStorage.setItem('user_profile', JSON.stringify(data))
      }
    } catch {
      const saved = localStorage.getItem('user_profile')
      if (saved) {
        try { setProfile(JSON.parse(saved)) } catch {}
      }
    } finally {
      setLoadingProfile(false)
    }
  }

  async function handleSaveProfile(e) {
    e.preventDefault()

    setTouched({
      first_name: true,
      last_name:  true,
      phone:      true,
      email:      true
    })

    if (!profile.first_name.trim() || !NAME_REGEX.test(profile.first_name.trim())) {
      toast.error('Please resolve validation errors before saving.')
      return
    }

    if (profile.last_name.trim() && !/^[a-zA-Z\s'-]{1,50}$/.test(profile.last_name.trim())) {
      toast.error('Please resolve validation errors before saving.')
      return
    }

    if (profile.phone.trim() && !PHONE_REGEX.test(profile.phone.replace(/\D/g, ''))) {
      toast.error('Please enter a valid 10-digit mobile number.')
      return
    }

    setSavingProfile(true)
    try {
      // 1. Upload staged photo if one was chosen
      let updatedPhotoUrl = profile.photo_url
      if (stagedPhotoFile) {
        const uploadRes = await uploadProfilePhoto(stagedPhotoFile)
        if (uploadRes?.photo_url) {
          updatedPhotoUrl = uploadRes.photo_url
          setStagedPhotoFile(null)
        }
      }

      // 2. Commit profile fields
      const cleanData = {
        first_name:   profile.first_name.trim(),
        last_name:    profile.last_name.trim(),
        role:         profile.role,
        company:      profile.company.trim(),
        company_type: profile.company_type,
        industry:     profile.industry,
        department:   profile.department,
        company_size: profile.company_size,
        phone:        profile.phone.replace(/\D/g, ''),
        country:      profile.country,
        language:     profile.language
      }

      const res = await updateProfile(cleanData)
      toast.success('Profile updated successfully!')

      if (res.profile) {
        setProfile({ ...res.profile, photo_url: updatedPhotoUrl || res.profile.photo_url })
        localStorage.setItem('user_profile', JSON.stringify({ ...res.profile, photo_url: updatedPhotoUrl || res.profile.photo_url }))
      }

      // Broadcast event so Header updates avatar & name immediately
      window.dispatchEvent(new Event('churnguard_profile_updated'))
    } catch (err) {
      toast.error(err.message || 'Failed to update profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  // Cooldown countdown timer for OTP resend
  useEffect(() => {
    let timer
    if (showOtpModal && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => (prev > 0 ? prev - 1 : 0))
      }, 1000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [showOtpModal, resendCooldown])

  function handleOtpDigitChange(index, value) {
    const clean = value.replace(/\D/g, '')
    const digit = clean.slice(-1)

    const newDigits = [...otpDigits]
    newDigits[index] = digit
    setOtpDigits(newDigits)
    if (otpError) setOtpError('')

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        otpInputRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData('text') || ''
    const clean = pasted.replace(/\D/g, '').slice(0, 6)
    if (!clean) return

    const newDigits = ['', '', '', '', '', '']
    for (let i = 0; i < clean.length; i++) {
      newDigits[i] = clean[i]
    }
    setOtpDigits(newDigits)
    if (otpError) setOtpError('')

    const focusIndex = Math.min(clean.length, 5)
    otpInputRefs.current[focusIndex]?.focus()
  }

  async function handleInitiatePasswordChange(e) {
    e.preventDefault()
    setPwError('')
    setPasswordSuccessMsg('')

    setPwTouched({
      currentPassword: true,
      newPassword:     true,
      confirmPassword: true
    })

    if (!currentPassword) {
      setPwError('Please enter your current password.')
      return
    }

    if (!isNewPasswordValid) {
      setPwError('New password does not meet all security criteria.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.')
      return
    }

    setRequestingOtp(true)
    try {
      const res = await requestPasswordOtp({
        current_password: currentPassword,
        new_password:     newPassword,
        confirm_password: confirmPassword
      })

      setMaskedEmail(res?.masked_email || maskEmailHelper(profile.email))
      setOtpDigits(['', '', '', '', '', ''])
      setOtpError('')
      setResendCooldown(60)
      setShowOtpModal(true)
      toast.success('Verification code sent to your email!')

      setTimeout(() => {
        otpInputRefs.current[0]?.focus()
      }, 150)
    } catch (err) {
      const msg = err.message || 'Failed to send verification code.'
      setPwError(msg)
      toast.error(msg)
    } finally {
      setRequestingOtp(false)
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resendingOtp) return

    setResendingOtp(true)
    setOtpError('')
    try {
      const res = await requestPasswordOtp({
        current_password: currentPassword,
        new_password:     newPassword,
        confirm_password: confirmPassword
      })
      setMaskedEmail(res?.masked_email || maskEmailHelper(profile.email))
      setResendCooldown(60)
      setOtpDigits(['', '', '', '', '', ''])
      toast.success('New verification code sent!')
      setTimeout(() => {
        otpInputRefs.current[0]?.focus()
      }, 150)
    } catch (err) {
      const msg = err.message || 'Failed to resend verification code.'
      setOtpError(msg)
      toast.error(msg)
    } finally {
      setResendingOtp(false)
    }
  }

  async function handleConfirmVerifyOtp(e) {
    if (e) e.preventDefault()
    const otpCode = otpDigits.join('')

    if (otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setOtpError('Please enter the full 6-digit verification code.')
      return
    }

    setVerifyingOtp(true)
    setOtpError('')
    try {
      await verifyPasswordOtp({
        otp:              otpCode,
        new_password:     newPassword,
        current_password: currentPassword
      })

      setShowOtpModal(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwTouched({})
      setOtpDigits(['', '', '', '', '', ''])
      setPwError('')
      setPasswordSuccessMsg('Password updated successfully. Your new credentials are now active.')
      toast.success('Password updated successfully!')
    } catch (err) {
      const msg = err.message || 'Verification failed.'
      setOtpError(msg)
      toast.error(msg)
    } finally {
      setVerifyingOtp(false)
    }
  }

  function handleCancelOtpModal() {
    setShowOtpModal(false)
    setOtpDigits(['', '', '', '', '', ''])
    setOtpError('')
  }

  function toggleNotification(key) {
    const updated = { ...notifications, [key]: !notifications[key] }
    setNotifications(updated)
    localStorage.setItem('notification_settings', JSON.stringify(updated))
    toast.success('Notification preference updated')
  }

  function handleThemeChange(mode) {
    setCurrentTheme(mode)
    document.documentElement.setAttribute('data-theme', mode)
    localStorage.setItem('theme', mode)
    toast.success(`${mode === 'light' ? 'Light' : 'Dark'} mode activated`)
  }

  const initials = [
    profile?.first_name?.[0] ?? '',
    profile?.last_name?.[0] ?? ''
  ].join('').toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'

  const effectiveAvatarSrc = stagedPreviewUrl || (
    profile?.photo_url
      ? (profile.photo_url.startsWith('http') ? profile.photo_url : `${API_BASE}${profile.photo_url}`)
      : null
  )

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Settings" subtitle="Manage your profile, security, and workspace preferences." />

        {/* ── Settings Tab Bar ── */}
        <div style={{
          display: 'flex', gap: '8px', marginBottom: '24px',
          background: 'var(--surface)', padding: '6px', borderRadius: '14px',
          border: '1px solid var(--border)', maxWidth: 'fit-content'
        }}>
          {[
            { id: 'Profile',       label: 'Profile',       icon: User },
            { id: 'Security',      label: 'Security',      icon: Shield },
            { id: 'Notifications', label: 'Notifications', icon: Bell },
            { id: 'Appearance',    label: 'Appearance',    icon: Palette },
            { id: 'Language',      label: 'Language',      icon: Globe },
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

        {/* ── Tab 1: Profile ── */}
        {activeTab === 'Profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px' }}>

            {/* Left Card: Avatar Preview & Management */}
            <div className="card" style={{ padding: '28px 24px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left', marginBottom: '2px' }}>
                Profile Avatar
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'left', marginBottom: '24px' }}>
                Your enterprise identity photo
              </p>

              <div style={{
                width: '104px', height: '104px', borderRadius: '24px',
                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                color: '#ffffff', fontWeight: 800, fontSize: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(124, 58, 237, 0.25)',
                overflow: 'hidden'
              }}>
                {effectiveAvatarSrc ? (
                  <img
                    src={effectiveAvatarSrc}
                    alt="Profile Avatar Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  initials
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {profile.first_name ? `${profile.first_name} ${profile.last_name}` : profile.email || 'User Profile'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {profile.company || 'Enterprise Tenant'} · {profile.role}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                  style={{ cursor: 'pointer', padding: '8px 16px', fontSize: '12px', width: '100%', justifyContent: 'center' }}
                >
                  <UploadCloud size={14} /> Choose Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />

                {(profile.photo_url || stagedPreviewUrl) && (
                  <button
                    type="button"
                    onClick={() => setShowRemovePhotoModal(true)}
                    style={{
                      background: 'none', border: 'none', color: '#e11d48',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '4px'
                    }}
                  >
                    <Trash2 size={13} /> Remove Photo
                  </button>
                )}
              </div>

              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px' }}>
                JPG, PNG, or WEBP under 5 MB
              </p>
            </div>

            {/* Right Card: Personal Information Form */}
            <div className="card" style={{ padding: '28px 32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
                    Personal Information
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Update your account details and organizational profile
                  </p>
                </div>
                {loadingProfile && (
                  <span style={{ fontSize: '12px', color: 'var(--purple-600)', fontWeight: 600 }}>
                    Loading profile…
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveProfile} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Name Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="settings-fname" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      First Name <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input
                      id="settings-fname"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      value={profile.first_name}
                      onKeyDown={handleNameKeyDown}
                      onChange={e => setProfile({ ...profile, first_name: e.target.value })}
                      onBlur={() => setTouched(prev => ({ ...prev, first_name: true }))}
                      required
                      placeholder="First name"
                      className="input-base"
                      style={{ borderColor: profileErrors.first_name ? '#f87171' : undefined }}
                      aria-invalid={profileErrors.first_name ? 'true' : 'false'}
                      aria-describedby={profileErrors.first_name ? 'fname-err' : undefined}
                    />
                    {profileErrors.first_name && (
                      <p id="fname-err" style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                        {profileErrors.first_name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="settings-lname" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Last Name
                    </label>
                    <input
                      id="settings-lname"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      value={profile.last_name}
                      onKeyDown={handleNameKeyDown}
                      onChange={e => setProfile({ ...profile, last_name: e.target.value })}
                      onBlur={() => setTouched(prev => ({ ...prev, last_name: true }))}
                      placeholder="Last name"
                      className="input-base"
                      style={{ borderColor: profileErrors.last_name ? '#f87171' : undefined }}
                      aria-invalid={profileErrors.last_name ? 'true' : 'false'}
                      aria-describedby={profileErrors.last_name ? 'lname-err' : undefined}
                    />
                    {profileErrors.last_name && (
                      <p id="lname-err" style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                        {profileErrors.last_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email & Phone Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="settings-email" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Work Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
                      <input
                        id="settings-email"
                        type="email"
                        disabled
                        value={profile.email}
                        className="input-base"
                        style={{ paddingLeft: '38px', backgroundColor: 'var(--surface-hover)', cursor: 'not-allowed' }}
                        title="Work email address is locked to your tenant account."
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="settings-phone" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Mobile Number (10 digits)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={15} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
                      <input
                        id="settings-phone"
                        type="tel"
                        value={profile.phone}
                        onKeyDown={handlePhoneKeyDown}
                        onPaste={handlePhonePaste}
                        onChange={e => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                        onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                        placeholder="9876543210"
                        className="input-base"
                        style={{
                          paddingLeft: '38px',
                          borderColor: profileErrors.phone ? '#f87171' : undefined
                        }}
                        aria-invalid={profileErrors.phone ? 'true' : 'false'}
                        aria-describedby={profileErrors.phone ? 'phone-err' : undefined}
                      />
                    </div>
                    {profileErrors.phone && (
                      <p id="phone-err" style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                        {profileErrors.phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Company & Role Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="settings-company" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Company / Organisation
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={15} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
                      <input
                        id="settings-company"
                        type="text"
                        value={profile.company}
                        onChange={e => setProfile({ ...profile, company: e.target.value })}
                        placeholder="Company name"
                        className="input-base"
                        style={{ paddingLeft: '38px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="settings-role" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Role <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <select
                      id="settings-role"
                      value={profile.role}
                      onChange={e => setProfile({ ...profile, role: e.target.value })}
                      className="input-base"
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Company Type & Industry Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="settings-company-type" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Company Type
                    </label>
                    <select
                      id="settings-company-type"
                      value={profile.company_type}
                      onChange={e => setProfile({ ...profile, company_type: e.target.value })}
                      className="input-base"
                    >
                      {COMPANY_TYPES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="settings-industry" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Industry
                    </label>
                    <select
                      id="settings-industry"
                      value={profile.industry}
                      onChange={e => setProfile({ ...profile, industry: e.target.value })}
                      className="input-base"
                    >
                      {INDUSTRIES.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Department & Company Size Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="settings-dept" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Department
                    </label>
                    <select
                      id="settings-dept"
                      value={profile.department}
                      onChange={e => setProfile({ ...profile, department: e.target.value })}
                      className="input-base"
                    >
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="settings-size" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Company Size
                    </label>
                    <select
                      id="settings-size"
                      value={profile.company_size}
                      onChange={e => setProfile({ ...profile, company_size: e.target.value })}
                      className="input-base"
                    >
                      {COMPANY_SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Country & Language Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label htmlFor="settings-country" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Country
                    </label>
                    <select
                      id="settings-country"
                      value={profile.country}
                      onChange={e => setProfile({ ...profile, country: e.target.value })}
                      className="input-base"
                    >
                      {COUNTRIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="settings-lang" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '6px'
                    }}>
                      Language Preference
                    </label>
                    <select
                      id="settings-lang"
                      value={profile.language}
                      onChange={e => setProfile({ ...profile, language: e.target.value })}
                      className="input-base"
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.code} value={l.code}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="btn-primary"
                    style={{
                      padding: '10px 22px', fontSize: '13px', fontWeight: 700,
                      opacity: savingProfile ? 0.7 : 1, cursor: savingProfile ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Save size={15} /> {savingProfile ? 'Saving Changes…' : 'Save Changes'}
                  </button>
                </div>

              </form>
            </div>

          </div>
        )}

        {/* ── Tab 2: Security & Password Management ── */}
        {activeTab === 'Security' && (
          <div className="card" style={{ padding: '32px', maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'var(--purple-50)', color: 'var(--purple-600)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Lock size={18} />
              </div>
              <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Password & Security
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Update your account password via single-use email verification
            </p>

            {passwordSuccessMsg && (
              <div
                role="status"
                style={{
                  background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d',
                  fontSize: '13px', padding: '14px 16px', borderRadius: '12px',
                  marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{passwordSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordSuccessMsg('')}
                  aria-label="Dismiss success message"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803d', padding: '2px', display: 'flex' }}
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {pwError && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
                  fontSize: '13px', padding: '12px 14px', borderRadius: '10px',
                  marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '8px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{pwError}</span>
              </div>
            )}

            <form onSubmit={handleInitiatePasswordChange} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Current Password */}
              <div>
                <label htmlFor="settings-current-pw" style={{
                  display: 'block', fontSize: '12px', fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: '6px'
                }}>
                  Current Password <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="settings-current-pw"
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => {
                      setCurrentPassword(e.target.value)
                      if (pwError) setPwError('')
                      if (passwordSuccessMsg) setPasswordSuccessMsg('')
                    }}
                    onBlur={() => setPwTouched(prev => ({ ...prev, currentPassword: true }))}
                    placeholder="Enter current password"
                    className="input-base"
                    style={{
                      paddingLeft: '40px', paddingRight: '40px',
                      borderColor: passwordErrors.currentPassword ? '#f87171' : undefined
                    }}
                    aria-invalid={passwordErrors.currentPassword ? 'true' : 'false'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: '4px', display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <p style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                    {passwordErrors.currentPassword}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="settings-new-pw" style={{
                  display: 'block', fontSize: '12px', fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: '6px'
                }}>
                  New Password <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="settings-new-pw"
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value)
                      if (pwError) setPwError('')
                      if (passwordSuccessMsg) setPasswordSuccessMsg('')
                    }}
                    onBlur={() => setPwTouched(prev => ({ ...prev, newPassword: true }))}
                    placeholder="8–72 characters"
                    className="input-base"
                    style={{
                      paddingLeft: '40px', paddingRight: '40px',
                      borderColor: passwordErrors.newPassword && pwTouched.newPassword ? '#f87171' : undefined
                    }}
                    aria-invalid={passwordErrors.newPassword ? 'true' : 'false'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    aria-label={showNewPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: '4px', display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password Criteria Checklist */}
                <div style={{
                  background: 'var(--surface-hover)', borderRadius: '10px',
                  padding: '12px 14px', marginTop: '8px', border: '1px solid var(--border)'
                }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Password Complexity Requirements:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordCriteria.length ? '#16a34a' : 'var(--text-muted)' }}>
                      {passwordCriteria.length ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid currentColor', display: 'inline-block' }} />}
                      <span>8–72 characters</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordCriteria.hasUpper ? '#16a34a' : 'var(--text-muted)' }}>
                      {passwordCriteria.hasUpper ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid currentColor', display: 'inline-block' }} />}
                      <span>1+ Uppercase (A-Z)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordCriteria.hasLower ? '#16a34a' : 'var(--text-muted)' }}>
                      {passwordCriteria.hasLower ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid currentColor', display: 'inline-block' }} />}
                      <span>1+ Lowercase (a-z)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: passwordCriteria.hasNumber ? '#16a34a' : 'var(--text-muted)' }}>
                      {passwordCriteria.hasNumber ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid currentColor', display: 'inline-block' }} />}
                      <span>1+ Number (0-9)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label htmlFor="settings-confirm-pw" style={{
                  display: 'block', fontSize: '12px', fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: '6px'
                }}>
                  Confirm New Password <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="settings-confirm-pw"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value)
                      if (pwError) setPwError('')
                      if (passwordSuccessMsg) setPasswordSuccessMsg('')
                    }}
                    onBlur={() => setPwTouched(prev => ({ ...prev, confirmPassword: true }))}
                    placeholder="Re-enter new password"
                    className="input-base"
                    style={{
                      paddingLeft: '40px', paddingRight: '40px',
                      borderColor: passwordErrors.confirmPassword ? '#f87171' : undefined
                    }}
                    aria-invalid={passwordErrors.confirmPassword ? 'true' : 'false'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      padding: '4px', display: 'flex', alignItems: 'center'
                    }}
                  >
                    {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <p style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                    {passwordErrors.confirmPassword}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={requestingOtp}
                  className="btn-primary"
                  style={{
                    padding: '10px 22px', fontSize: '13px', fontWeight: 700,
                    opacity: requestingOtp ? 0.7 : 1, cursor: requestingOtp ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Shield size={15} /> {requestingOtp ? 'Sending Verification Code…' : 'Send Verification Code'}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* ── Tab 3: Notifications ── */}
        {activeTab === 'Notifications' && (
          <div className="card" style={{ padding: '28px 32px', maxWidth: '720px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Notification Preferences
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Choose what telemetry alerts and operational digests you want to receive
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { key: 'highRiskAlert',  title: 'High-risk churn alerts', sub: 'Receive instant alerts when an account churn probability exceeds 80%.' },
                { key: 'weeklyDigest',   title: 'Weekly retention digest', sub: 'Comprehensive summary of customer retention metrics every Monday morning.' },
                { key: 'reportReady',    title: 'Report generation alerts', sub: 'Notification when an executive batch analysis or CSV export completes.' },
                { key: 'productUpdates', title: 'Product & ML updates', sub: 'Receive notifications when new ML models and retention playbooks are released.' },
                { key: 'securityAlerts', title: 'Security & Access events', sub: 'Immediate alerts on new workspace logins and credential modifications.' },
              ].map((item) => (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px', background: 'var(--surface-hover)', borderRadius: '12px',
                  border: '1px solid var(--border)'
                }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.title}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sub}</p>
                  </div>
                  
                  <div
                    onClick={() => toggleNotification(item.key)}
                    role="switch"
                    aria-checked={notifications[item.key]}
                    style={{
                      width: '44px', height: '24px', borderRadius: '99px',
                      background: notifications[item.key] ? 'var(--purple-600)' : 'var(--border)',
                      padding: '2px', cursor: 'pointer', transition: 'background 200ms ease',
                      display: 'flex', alignItems: 'center'
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%', background: '#ffffff',
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
          <div className="card" style={{ padding: '28px 32px', maxWidth: '640px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Theme Appearance
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              Customize application theme and contrast mode
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div
                onClick={() => handleThemeChange('light')}
                style={{
                  padding: '22px', borderRadius: '14px',
                  border: currentTheme === 'light' ? '2px solid var(--purple-600)' : '1px solid var(--border)',
                  background: '#ffffff', cursor: 'pointer', textAlign: 'center',
                  boxShadow: currentTheme === 'light' ? '0 4px 16px rgba(124, 58, 237, 0.15)' : 'none'
                }}
              >
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#111827' }}>Light Mode ☀️</p>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Default enterprise theme</p>
                {currentTheme === 'light' && <span className="badge badge-purple" style={{ marginTop: '12px' }}>Active</span>}
              </div>

              <div
                onClick={() => handleThemeChange('dark')}
                style={{
                  padding: '22px', borderRadius: '14px',
                  border: currentTheme === 'dark' ? '2px solid var(--purple-600)' : '1px solid var(--border)',
                  background: '#181924', cursor: 'pointer', textAlign: 'center',
                  boxShadow: currentTheme === 'dark' ? '0 4px 16px rgba(124, 58, 237, 0.25)' : 'none'
                }}
              >
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>Dark Mode 🌙</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>High-contrast dark theme</p>
                {currentTheme === 'dark' && <span className="badge badge-purple" style={{ marginTop: '12px' }}>Active</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 5: Language Preference ── */}
        {activeTab === 'Language' && (
          <div className="card" style={{ padding: '28px 32px', maxWidth: '560px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Language Preference
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select preferred application display language
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="settings-language-select" style={{
                display: 'block', fontSize: '12px', fontWeight: 600,
                color: 'var(--text-secondary)', marginBottom: '6px'
              }}>
                Interface Language
              </label>
              <select
                id="settings-language-select"
                className="input-base"
                value={profile.language}
                onChange={async (e) => {
                  const newLang = e.target.value
                  setProfile(prev => ({ ...prev, language: newLang }))
                  try {
                    await updateProfile({ language: newLang })
                    localStorage.setItem('app_language', newLang)
                    toast.success('Language preference updated')
                  } catch {}
                }}
              >
                {LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            <div style={{
              background: 'var(--purple-50)', border: '1px solid var(--purple-200)',
              borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px'
            }}>
              <Globe size={18} color="var(--purple-600)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Multi-Lingual Localization Support
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  Full multi-lingual interface translation for Hindi and Gujarati is queued for an upcoming release. Your preference has been recorded and will automatically apply once available.
                </p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── REMOVE PHOTO CONFIRMATION MODAL ── */}
      {showRemovePhotoModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-photo-title"
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
              <h3 id="remove-photo-title" style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Remove profile photo?
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              This will revert your avatar to standard user initials across your dashboard and header.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowRemovePhotoModal(false)}
                className="btn-secondary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemovePhoto}
                style={{
                  background: '#e11d48', color: '#ffffff', border: 'none',
                  borderRadius: '10px', fontWeight: 700, fontSize: '13px',
                  padding: '8px 18px', cursor: 'pointer'
                }}
              >
                Remove Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EMAIL OTP VERIFICATION MODAL ── */}
      {showOtpModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="otp-modal-title"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 2000, padding: '20px'
          }}
        >
          <div className="card" style={{
            width: '100%', maxWidth: '460px', padding: '32px', borderRadius: '20px',
            background: 'var(--surface)', boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
          }}>
            {/* Header Row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  background: 'var(--purple-50)', color: 'var(--purple-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 id="otp-modal-title" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Verify Your Identity
                  </h3>
                  <span className="badge badge-purple" style={{ marginTop: '4px' }}>
                    Password Change OTP
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelOtpModal}
                disabled={verifyingOtp}
                aria-label="Close modal"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center',
                  transition: 'background 150ms ease'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Subtitle with Masked Email */}
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
              We sent a 6-digit verification code to your registered email{' '}
              <strong style={{ color: 'var(--purple-600)', background: 'var(--purple-50)', padding: '2px 8px', borderRadius: '6px', wordBreak: 'break-all' }}>
                {maskedEmail || 'your email'}
              </strong>.
              Please enter the code below to complete your password change.
            </p>

            {/* Modal Inline Error Alert */}
            {otpError && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
                  fontSize: '12px', padding: '10px 12px', borderRadius: '10px',
                  marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px'
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontWeight: 600 }}>{otpError}</span>
              </div>
            )}

            {/* 6-Digit Segmented OTP Input */}
            <form onSubmit={handleConfirmVerifyOtp}>
              <div style={{
                display: 'flex', justifyContent: 'center', gap: '8px',
                marginBottom: '20px'
              }}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => otpInputRefs.current[idx] = el}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    onPaste={handleOtpPaste}
                    autoComplete="one-time-code"
                    id={`otp-input-${idx}`}
                    aria-label={`Digit ${idx + 1}`}
                    style={{
                      width: '46px', height: '54px',
                      fontSize: '22px', fontWeight: 800, textAlign: 'center',
                      borderRadius: '12px', border: digit ? '2px solid var(--purple-500)' : '2px solid var(--border)',
                      background: 'var(--input-bg)', color: 'var(--text-primary)',
                      outline: 'none', transition: 'all 150ms ease',
                      boxShadow: digit ? '0 0 0 3px rgba(124, 58, 237, 0.12)' : 'none'
                    }}
                  />
                ))}
              </div>

              {/* Cooldown Timer & Resend Link */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px', gap: '6px'
              }}>
                {resendCooldown > 0 ? (
                  <span>
                    Resend code in <strong style={{ color: 'var(--text-primary)' }}>
                      00:{resendCooldown < 10 ? `0${resendCooldown}` : resendCooldown}
                    </strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendingOtp}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--purple-600)', fontWeight: 700, fontSize: '12px',
                      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: 0
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: resendingOtp ? 'spin 1s linear infinite' : 'none' }} />
                    {resendingOtp ? 'Resending Code…' : 'Resend Verification Code'}
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleCancelOtpModal}
                  disabled={verifyingOtp}
                  className="btn-secondary"
                  style={{ fontSize: '13px', padding: '9px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={otpDigits.join('').length !== 6 || verifyingOtp}
                  className="btn-primary"
                  style={{
                    fontSize: '13px', padding: '9px 20px', fontWeight: 700,
                    opacity: (otpDigits.join('').length !== 6 || verifyingOtp) ? 0.6 : 1,
                    cursor: (otpDigits.join('').length !== 6 || verifyingOtp) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <CheckCircle2 size={15} />
                  {verifyingOtp ? 'Updating Password…' : 'Confirm & Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default Settings
