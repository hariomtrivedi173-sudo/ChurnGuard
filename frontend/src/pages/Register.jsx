import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { registerUser, verifyRegistrationOtp, resendRegistrationOtp } from '../api/auth'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import { useTheme } from '../components/useTheme'
import { getValidToken } from '../utils/auth'
import {
  UserPlus, CheckCircle2, ArrowRight, Building2,
  Mail, Lock, Eye, EyeOff, ArrowLeft, Phone,
  Check, AlertCircle, RefreshCw, Sun, Moon
} from 'lucide-react'

// Dropdown options matching the exact specification
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

// RFC 5322 regex for email validation
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Exactly 10 digits starting with 6, 7, 8, or 9
const PHONE_REGEX = /^[6-9][0-9]{9}$/

// 2–50 characters, letters, spaces, hyphens, and apostrophes only
const NAME_REGEX = /^[a-zA-Z\s'-]{2,50}$/

function Register() {
  const { theme, toggleTheme } = useTheme()
  const [step, setStep] = useState(1)

  // Step 1: Account fields
  const [email,           setEmail]           = useState('')
  const [phone,           setPhone]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)

  // Step 2: Profile fields
  const [firstName,       setFirstName]       = useState('')
  const [lastName,        setLastName]        = useState('')
  const [companyName,     setCompanyName]     = useState('')
  const [companyType,     setCompanyType]     = useState(COMPANY_TYPES[0])
  const [industry,        setIndustry]        = useState(INDUSTRIES[0])
  const [role,            setRole]            = useState(ROLES[0])
  const [department,      setDepartment]      = useState(DEPARTMENTS[0])
  const [companySize,     setCompanySize]     = useState(COMPANY_SIZES[1])

  // Touched state for field validation
  const [touched, setTouched] = useState({})

  // General state
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  // ── Step 3: OTP Verification ──
  const [otpDigits,      setOtpDigits]      = useState(['', '', '', '', '', ''])
  const [maskedEmail,    setMaskedEmail]    = useState('')
  const [otpError,       setOtpError]       = useState('')
  const [otpLoading,     setOtpLoading]     = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading,  setResendLoading]  = useState(false)
  const otpRefs = useRef([])

  useEffect(() => {
    if (getValidToken()) {
      navigate('/dashboard', { replace: true })
      return
    }

    function handlePageShow() {
      if (getValidToken()) {
        navigate('/dashboard', { replace: true })
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [navigate])

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // ── Password Requirement Criteria ──
  const passwordCriteria = useMemo(() => ({
    length:    password.length >= 8 && password.length <= 72,
    hasUpper:  /[A-Z]/.test(password),
    hasLower:  /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }), [password])

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean)

  // ── Field Validation Checks ──
  const errors = useMemo(() => {
    const errs = {}

    // Email
    if (touched.email || step === 2) {
      if (!email.trim()) {
        errs.email = 'Work email address is required.'
      } else if (!EMAIL_REGEX.test(email.trim())) {
        errs.email = 'Please enter a valid work email address.'
      }
    }

    // Phone
    if (touched.phone || step === 2) {
      const cleanPhone = phone.replace(/\D/g, '')
      if (!cleanPhone) {
        errs.phone = 'Mobile number is required.'
      } else if (!PHONE_REGEX.test(cleanPhone)) {
        errs.phone = 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.'
      }
    }

    // Password
    if (touched.password || step === 2) {
      if (!password) {
        errs.password = 'Password is required.'
      } else if (!isPasswordValid) {
        errs.password = 'Password does not meet all security requirements.'
      }
    }

    // Confirm Password
    if (touched.confirmPassword || step === 2) {
      if (!confirmPassword) {
        errs.confirmPassword = 'Confirmation password is required.'
      } else if (confirmPassword !== password) {
        errs.confirmPassword = 'Passwords do not match.'
      }
    }

    // Step 2 validations
    if (step === 2) {
      if (touched.firstName) {
        if (!firstName.trim()) {
          errs.firstName = 'First name is required.'
        } else if (!NAME_REGEX.test(firstName.trim())) {
          errs.firstName = 'First name can contain letters only (2–50 characters).'
        }
      }

      if (touched.lastName) {
        if (!lastName.trim()) {
          errs.lastName = 'Last name is required.'
        } else if (!/^[a-zA-Z\s'-]{1,50}$/.test(lastName.trim())) {
          errs.lastName = 'Last name can contain letters only.'
        }
      }

      if (touched.companyName && !companyName.trim()) {
        errs.companyName = 'Company name is required.'
      }
    }

    return errs
  }, [
    email, phone, password, confirmPassword, isPasswordValid,
    firstName, lastName, companyName, touched, step
  ])

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
    if (phone.replace(/\D/g, '').length >= 10 && !window.getSelection().toString()) {
      e.preventDefault()
    }
  }

  function handlePhonePaste(e) {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData('text') || ''
    let cleaned = pasted.replace(/^(?:\+91|91|0)/, '').replace(/\D/g, '')
    cleaned = cleaned.slice(0, 10)
    setPhone(cleaned)
    setTouched(prev => ({ ...prev, phone: true }))
  }

  function handlePhoneChange(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10)
    setPhone(val)
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

  // ── Step Navigation & Submission ──
  function handleContinueToStep2(e) {
    e.preventDefault()
    setError('')

    setTouched(prev => ({
      ...prev,
      email: true,
      phone: true,
      password: true,
      confirmPassword: true
    }))

    const cleanEmail = email.trim()
    const cleanPhone = phone.replace(/\D/g, '')

    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid work email address.')
      return
    }
    if (!cleanPhone || !PHONE_REGEX.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.')
      return
    }
    if (!isPasswordValid) {
      setError('Password does not satisfy all security criteria.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setStep(2)
  }

  async function handleFinalSubmit(e) {
    e.preventDefault()
    setError('')

    setTouched(prev => ({
      ...prev,
      firstName: true,
      lastName: true,
      companyName: true
    }))

    if (!firstName.trim() || !NAME_REGEX.test(firstName.trim())) {
      setError('First name must contain letters only (2–50 characters).')
      return
    }
    if (!lastName.trim()) {
      setError('Last name is required.')
      return
    }
    if (!/^[a-zA-Z\s'-]{1,50}$/.test(lastName.trim())) {
      setError('Last name can contain letters only.')
      return
    }
    if (!companyName.trim()) {
      setError('Company name is required.')
      return
    }

    setLoading(true)
    try {
      const data = await registerUser(
        email.trim().toLowerCase(),
        password,
        {
          first_name:   firstName.trim(),
          last_name:    lastName.trim(),
          company:      companyName.trim(),
          company_type: companyType,
          industry:     industry,
          department:   department,
          company_size: companySize,
          phone:        phone.trim(),
          role:         role,
          country:      'India',
        }
      )

      localStorage.setItem('pending_verify_email', email.trim().toLowerCase())
      setMaskedEmail(data.masked_email || email.trim().toLowerCase())
      setResendCooldown(60)
      setStep(3)
      setOtpDigits(['', '', '', '', '', ''])
      setOtpError('')
      setTimeout(() => otpRefs.current[0]?.focus(), 100)

    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.')
      toast.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // ── OTP input handlers ──
  function handleOtpChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    setOtpError('')
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && index > 0)  otpRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''))
      setOtpError('')
      otpRefs.current[5]?.focus()
    }
  }

  async function handleOtpVerify(e) {
    e.preventDefault()
    const otp = otpDigits.join('')
    if (otp.length < 6) {
      setOtpError('Please enter all 6 digits of the verification code.')
      return
    }
    setOtpLoading(true)
    setOtpError('')
    try {
      await verifyRegistrationOtp({ email: email.trim().toLowerCase(), otp })
      localStorage.removeItem('pending_verify_email')
      setSuccess(true)
      toast.success('Email verified! Welcome to ChurnGuard.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const msg = err.message || 'Invalid or expired OTP. Please try again.'
      setOtpError(msg)
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } finally {
      setOtpLoading(false)
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setOtpError('')
    try {
      await resendRegistrationOtp({ email: email.trim().toLowerCase() })
      toast.success('A new verification code has been sent to your email.')
      setResendCooldown(60)
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err) {
      const msg = err.message || 'Could not resend code. Please try again.'
      setOtpError(msg)
      if (err.message?.includes('wait')) {
        const match = err.message.match(/(\d+)\s*seconds?/)
        if (match) setResendCooldown(parseInt(match[1], 10))
      }
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '20px', right: '24px' }}>
        <button
          id="register-theme-toggle"
          type="button"
          onClick={toggleTheme}
          className="navbar-icon-btn theme-btn"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-pressed={theme === 'dark'}
          style={{ width: '36px', height: '36px' }}
        >
          {theme === 'light' ? (
            <Moon size={16} className="theme-switch-icon moon-icon" />
          ) : (
            <Sun size={16} className="theme-switch-icon sun-icon" />
          )}
        </button>
      </div>

      {/* ── Brand Logo Header ── */}
      <header className="auth-brand-header">
        <ChurnGuardLogo
          variant="auth"
          size="lg"
          linkTo="/"
          showWordmark={true}
          showTagline={true}
          tagline="AI Churn Intelligence"
        />
      </header>

      {/* ── Main Auth Card (Clear, uncluttered layout) ── */}
      <main className="auth-card-container auth-card-wide">

        {/* Success Screen */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'var(--success-subtle)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '1px solid var(--success-border)'
            }}>
              <CheckCircle2 size={36} color="var(--success)" />
            </div>
            <h2 className="auth-header-title">
              Email Verified!
            </h2>
            <p className="auth-header-subtitle">
              Your organization account is active. Redirecting to sign in…
            </p>
          </div>

        ) : step === 3 ? (
          /* ── STEP 3: OTP VERIFICATION FLOW ── */
          <form onSubmit={handleOtpVerify} noValidate>
            {/* Step Tracker */}
            <div className="auth-step-tracker">
              <div className="auth-step-item">
                <div className="auth-step-badge completed"><Check size={14} strokeWidth={3} /></div>
                <span className="auth-step-name">Account</span>
              </div>
              <div className="auth-step-divider" />
              <div className="auth-step-item">
                <div className="auth-step-badge completed"><Check size={14} strokeWidth={3} /></div>
                <span className="auth-step-name">Profile</span>
              </div>
              <div className="auth-step-divider" />
              <div className="auth-step-item">
                <div className="auth-step-badge active">3</div>
                <span className="auth-step-name active">Verify</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '52px',
                height: '52px',
                background: 'var(--brand-subtle)',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
                border: '1px solid var(--brand-border)'
              }}>
                <Mail size={24} color="var(--brand)" strokeWidth={2} />
              </div>
              <h2 className="auth-header-title">Verify your email address</h2>
              <p className="auth-header-subtitle">
                We sent a 6-digit verification code to<br />
                <strong style={{ color: 'var(--slate-950)' }}>{maskedEmail}</strong>
              </p>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '6px' }}>
                Check your inbox and spam folder. The code expires in 10 minutes.
              </p>
            </div>

            {/* OTP Digit Boxes */}
            <div className="auth-otp-row">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-digit-${i}`}
                  ref={el => { otpRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={digit}
                  autoComplete="one-time-code"
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  className={`auth-otp-box ${digit ? 'filled' : ''} ${otpError ? 'error' : ''}`}
                />
              ))}
            </div>

            {/* Error Message */}
            {otpError && (
              <div className="auth-alert-banner" style={{ justifyContent: 'center' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
                <span>{otpError}</span>
              </div>
            )}

            {/* Verify Button */}
            <button
              id="verify-otp-btn"
              type="submit"
              disabled={otpLoading || otpDigits.join('').length < 6}
              className="auth-button-primary"
              style={{ marginBottom: '16px' }}
            >
              {otpLoading ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block'
                  }} />
                  Verifying…
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} /> Verify Email & Launch
                </>
              )}
            </button>

            {/* Resend Cooldown */}
            <div style={{ textAlign: 'center' }}>
              {resendCooldown > 0 ? (
                <p style={{ fontSize: '12.5px', color: 'var(--slate-500)', margin: 0 }}>
                  Resend code available in{' '}
                  <strong style={{ color: 'var(--slate-950)', fontVariantNumeric: 'tabular-nums' }}>
                    {resendCooldown}s
                  </strong>
                </p>
              ) : (
                <button
                  id="resend-otp-btn"
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: 'var(--brand)',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}
                >
                  {resendLoading ? (
                    <><RefreshCw size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending code…</>
                  ) : (
                    <><RefreshCw size={13} /> Resend verification code</>
                  )}
                </button>
              )}
            </div>

            {/* Back to Step 2 */}
            <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--slate-200)' }}>
              <button
                type="button"
                onClick={() => { setStep(2); setOtpError('') }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  color: 'var(--slate-500)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowLeft size={13} /> Wrong email? Go back
              </button>
            </div>
          </form>

        ) : step === 1 ? (
          /* ── STEP 1: ACCOUNT INFORMATION ── */
          <>
            {/* Step Progress Tracker */}
            <div className="auth-step-tracker">
              <div className="auth-step-item">
                <div className="auth-step-badge active">1</div>
                <span className="auth-step-name active">Account</span>
              </div>
              <div className="auth-step-divider" />
              <div className="auth-step-item">
                <div className="auth-step-badge pending">2</div>
                <span className="auth-step-name">Profile</span>
              </div>
              <div className="auth-step-divider" />
              <div className="auth-step-item">
                <div className="auth-step-badge pending">3</div>
                <span className="auth-step-name">Verify</span>
              </div>
            </div>

            {/* Header */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--brand-subtle)',
                  color: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <UserPlus size={16} />
                </div>
                <h1 className="auth-header-title">Create your account</h1>
              </div>
              <p className="auth-header-subtitle">
                Step 1 of 3 · Set up your credentials and security settings.
              </p>
            </div>

            {/* Top Alert Error */}
            {error && (
              <div className="auth-alert-banner" role="alert" aria-live="assertive">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleContinueToStep2} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Work Email Address */}
              <div className="auth-field-group">
                <label htmlFor="register-email" className="auth-field-label">
                  <span>Work Email Address <span className="req">*</span></span>
                </label>
                <div className="auth-input-box">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="register-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value)
                      if (error) setError('')
                    }}
                    onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
                    required
                    placeholder="name@company.com"
                    className={`auth-input-element with-left-icon ${errors.email ? 'has-error' : ''}`}
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && <p id="email-error" className="auth-error-text">{errors.email}</p>}
              </div>

              {/* Phone Number */}
              <div className="auth-field-group">
                <label htmlFor="register-phone" className="auth-field-label">
                  <span>Mobile Phone Number <span className="req">*</span></span>
                </label>
                <div className="auth-input-box">
                  <Phone size={16} className="auth-input-icon" />
                  <input
                    id="register-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onKeyDown={handlePhoneKeyDown}
                    onPaste={handlePhonePaste}
                    onChange={handlePhoneChange}
                    onBlur={() => setTouched(prev => ({ ...prev, phone: true }))}
                    required
                    placeholder="9876543210 (10 digits)"
                    className={`auth-input-element with-left-icon ${errors.phone ? 'has-error' : ''}`}
                    aria-invalid={errors.phone ? 'true' : 'false'}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                </div>
                {errors.phone && <p id="phone-error" className="auth-error-text">{errors.phone}</p>}
              </div>

              {/* Password & Confirmation side-by-side or stacked with breathing room */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                {/* Password */}
                <div className="auth-field-group">
                  <label htmlFor="register-password" className="auth-field-label">
                    <span>Password <span className="req">*</span></span>
                  </label>
                  <div className="auth-input-box">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      onChange={e => {
                        setPassword(e.target.value)
                        if (error) setError('')
                      }}
                      onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                      required
                      placeholder="8–72 characters"
                      className={`auth-input-element with-left-icon ${errors.password && touched.password ? 'has-error' : ''}`}
                      style={{ paddingRight: '40px' }}
                      aria-invalid={errors.password ? 'true' : 'false'}
                      aria-describedby="password-criteria"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="auth-input-action-btn"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="auth-field-group">
                  <label htmlFor="register-confirm" className="auth-field-label">
                    <span>Confirm Password <span className="req">*</span></span>
                  </label>
                  <div className="auth-input-box">
                    <Lock size={16} className="auth-input-icon" />
                    <input
                      id="register-confirm"
                      name="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
                      required
                      placeholder="Re-enter password"
                      className={`auth-input-element with-left-icon ${errors.confirmPassword ? 'has-error' : ''}`}
                      style={{ paddingRight: '40px' }}
                      aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                      aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                      className="auth-input-action-btn"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p id="confirm-error" className="auth-error-text">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>

              {/* Password Checklist Grid */}
              <div id="password-criteria" className="auth-password-criteria-grid">
                <div className={`auth-password-criterion ${passwordCriteria.length ? 'valid' : ''}`}>
                  {passwordCriteria.length ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--slate-300)' }} />}
                  <span>8–72 characters</span>
                </div>
                <div className={`auth-password-criterion ${passwordCriteria.hasUpper ? 'valid' : ''}`}>
                  {passwordCriteria.hasUpper ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--slate-300)' }} />}
                  <span>1+ Uppercase (A-Z)</span>
                </div>
                <div className={`auth-password-criterion ${passwordCriteria.hasLower ? 'valid' : ''}`}>
                  {passwordCriteria.hasLower ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--slate-300)' }} />}
                  <span>1+ Lowercase (a-z)</span>
                </div>
                <div className={`auth-password-criterion ${passwordCriteria.hasNumber ? 'valid' : ''}`}>
                  {passwordCriteria.hasNumber ? <Check size={12} strokeWidth={3} /> : <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--slate-300)' }} />}
                  <span>1+ Number (0-9)</span>
                </div>
              </div>

              {/* Continue Button */}
              <button
                id="register-continue-btn"
                type="submit"
                className="auth-button-primary"
                style={{ marginTop: '8px' }}
              >
                Continue to Organization <ArrowRight size={16} />
              </button>
            </form>
          </>

        ) : (
          /* ── STEP 2: PROFILE & ORGANISATION INFORMATION ── */
          <>
            {/* Step Progress Tracker */}
            <div className="auth-step-tracker">
              <div className="auth-step-item">
                <div className="auth-step-badge completed"><Check size={14} strokeWidth={3} /></div>
                <span className="auth-step-name">Account</span>
              </div>
              <div className="auth-step-divider" />
              <div className="auth-step-item">
                <div className="auth-step-badge active">2</div>
                <span className="auth-step-name active">Profile</span>
              </div>
              <div className="auth-step-divider" />
              <div className="auth-step-item">
                <div className="auth-step-badge pending">3</div>
                <span className="auth-step-name">Verify</span>
              </div>
            </div>

            {/* Header with Back Action */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
              <div>
                <h1 className="auth-header-title">Tell us about your organization</h1>
                <p className="auth-header-subtitle">
                  Step 2 of 3 · Personalize your churn prediction models.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '6px'
                }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            </div>

            {error && (
              <div className="auth-alert-banner" role="alert" aria-live="assertive">
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleFinalSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Name Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="auth-field-group">
                  <label htmlFor="register-fname" className="auth-field-label">
                    <span>First Name <span className="req">*</span></span>
                  </label>
                  <input
                    id="register-fname"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={firstName}
                    onKeyDown={handleNameKeyDown}
                    onChange={e => setFirstName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))}
                    required
                    placeholder="Jane"
                    className={`auth-input-element ${errors.firstName ? 'has-error' : ''}`}
                    aria-invalid={errors.firstName ? 'true' : 'false'}
                    aria-describedby={errors.firstName ? 'fname-error' : undefined}
                  />
                  {errors.firstName && <p id="fname-error" className="auth-error-text">{errors.firstName}</p>}
                </div>

                <div className="auth-field-group">
                  <label htmlFor="register-lname" className="auth-field-label">
                    <span>Last Name <span className="req">*</span></span>
                  </label>
                  <input
                    id="register-lname"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={lastName}
                    onKeyDown={handleNameKeyDown}
                    onChange={e => setLastName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))}
                    placeholder="Doe"
                    className={`auth-input-element ${errors.lastName ? 'has-error' : ''}`}
                    aria-invalid={errors.lastName ? 'true' : 'false'}
                    aria-describedby={errors.lastName ? 'lname-error' : undefined}
                  />
                  {errors.lastName && <p id="lname-error" className="auth-error-text">{errors.lastName}</p>}
                </div>
              </div>

              {/* Company Name */}
              <div className="auth-field-group">
                <label htmlFor="register-company" className="auth-field-label">
                  <span>Company / Organisation <span className="req">*</span></span>
                </label>
                <div className="auth-input-box">
                  <Building2 size={16} className="auth-input-icon" />
                  <input
                    id="register-company"
                    name="companyName"
                    type="text"
                    autoComplete="organization"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    onBlur={() => setTouched(prev => ({ ...prev, companyName: true }))}
                    required
                    placeholder="Acme Corp"
                    className={`auth-input-element with-left-icon ${errors.companyName ? 'has-error' : ''}`}
                    aria-invalid={errors.companyName ? 'true' : 'false'}
                    aria-describedby={errors.companyName ? 'company-error' : undefined}
                  />
                </div>
                {errors.companyName && <p id="company-error" className="auth-error-text">{errors.companyName}</p>}
              </div>

              {/* Company Type & Industry */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="auth-field-group">
                  <label htmlFor="register-company-type" className="auth-field-label">
                    <span>Company Type <span className="req">*</span></span>
                  </label>
                  <select
                    id="register-company-type"
                    name="companyType"
                    value={companyType}
                    onChange={e => setCompanyType(e.target.value)}
                    className="auth-input-element"
                  >
                    {COMPANY_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="auth-field-group">
                  <label htmlFor="register-industry" className="auth-field-label">
                    <span>Industry <span className="req">*</span></span>
                  </label>
                  <select
                    id="register-industry"
                    name="industry"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="auth-input-element"
                  >
                    {INDUSTRIES.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role & Department */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="auth-field-group">
                  <label htmlFor="register-role" className="auth-field-label">
                    <span>Your Role <span className="req">*</span></span>
                  </label>
                  <select
                    id="register-role"
                    name="role"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="auth-input-element"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="auth-field-group">
                  <label htmlFor="register-department" className="auth-field-label">
                    <span>Department</span>
                  </label>
                  <select
                    id="register-department"
                    name="department"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="auth-input-element"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Company Size */}
              <div className="auth-field-group">
                <label htmlFor="register-size" className="auth-field-label">
                  <span>Organization Size (Employees)</span>
                </label>
                <select
                  id="register-size"
                  name="companySize"
                  value={companySize}
                  onChange={e => setCompanySize(e.target.value)}
                  className="auth-input-element"
                >
                  {COMPANY_SIZES.map(s => (
                    <option key={s} value={s}>{s} employees</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(''); }}
                  className="auth-button-secondary"
                  style={{ width: 'auto' }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  id="register-submit"
                  type="submit"
                  disabled={loading}
                  className="auth-button-primary"
                  style={{ flex: 1 }}
                >
                  {loading ? (
                    <>
                      <span style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255,255,255,0.4)',
                        borderTopColor: '#ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                        display: 'inline-block'
                      }} />
                      Creating Account…
                    </>
                  ) : (
                    <>
                      Create Account & Send Code <Check size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Footer Link */}
        <div className="auth-footer-divider">
          Already have an organisation account?{' '}
          <Link to="/login" className="auth-footer-link">
            Sign in
          </Link>
        </div>
      </main>

      {/* Trust & Security Note */}
      <p className="auth-trust-note">
        Protected by enterprise encryption & multi-tenant isolation.
      </p>
    </div>
  )
}

export default Register
