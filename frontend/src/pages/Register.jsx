import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { registerUser, verifyRegistrationOtp, resendRegistrationOtp } from '../api/auth'
import {
  Shield, UserPlus, CheckCircle2, ArrowRight, Building2,
  Briefcase, Mail, Lock, Eye, EyeOff, ArrowLeft, Phone,
  Check, AlertCircle, RefreshCw
} from 'lucide-react'

const bulletPoints = [
  'AI-powered churn predictions',
  'Real-time customer risk scoring',
  'Explainable AI insights',
  'Retention recommendations',
]

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
  const [step, setStep] = useState(1)

  // Step 1: Account fields
  const [email,           setEmail]           = useState('')
  const [phone,           setPhone]           = useState('')
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)

  // Step 2: Profile fields (Phone is strictly excluded here)
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

  // ── Step 3: OTP Verification ───────────────────────────────────────────────
  const [otpDigits,      setOtpDigits]      = useState(['', '', '', '', '', ''])
  const [maskedEmail,    setMaskedEmail]    = useState('')
  const [otpError,       setOtpError]       = useState('')
  const [otpLoading,     setOtpLoading]     = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading,  setResendLoading]  = useState(false)
  const otpRefs = useRef([])

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

      if (touched.lastName && lastName.trim()) {
        if (!/^[a-zA-Z\s'-]{1,50}$/.test(lastName.trim())) {
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
  // Phone: numbers only, max 10 digits
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

  // Name: letters, spaces, hyphens, apostrophes only (blocks numbers on keypress)
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
    if (lastName.trim() && !/^[a-zA-Z\s'-]{1,50}$/.test(lastName.trim())) {
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

      // Store email for VerifyOTP page fallback
      localStorage.setItem('pending_verify_email', email.trim().toLowerCase())
      setMaskedEmail(data.masked_email || email.trim().toLowerCase())
      setResendCooldown(60)
      setStep(3)       // ← Advance to OTP verification step
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

  // ── OTP input handlers ─────────────────────────────────────────────────────
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
      setTimeout(() => navigate('/'), 2000)
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
        // Extract seconds from backend message if present
        const match = err.message.match(/(\d+)\s*seconds?/)
        if (match) setResendCooldown(parseInt(match[1], 10))
      }
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'row',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      backgroundColor: 'var(--bg)',
      color: 'var(--text-primary)',
      overflowX: 'hidden',
    }}>

      {/* ── Left Hero Branding Panel (Desktop: 38–40% width) ── */}
      <aside className="auth-left-panel" style={{
        width: '39%',
        minWidth: '380px',
        maxWidth: '500px',
        background: 'linear-gradient(160deg, #1E1B4B 0%, #312E81 45%, #4C1D95 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 40px',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Ambient glow */}
        <div style={{
          position: 'absolute', top: '-10%', right: '-10%', width: '320px', height: '320px',
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, rgba(30, 27, 75, 0) 70%)',
          borderRadius: '50%', pointerEvents: 'none', filter: 'blur(35px)',
        }} />

        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          <div style={{
            width: '44px', height: '44px',
            background: 'linear-gradient(135deg, #312E81 0%, #4C1D95 100%)',
            border: '1px solid rgba(167, 139, 250, 0.4)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
          }}>
            <Shield size={24} color="#EDE9FE" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em', color: '#ffffff' }}>ChurnGuard</span>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                background: 'rgba(167, 139, 250, 0.2)', color: '#EDE9FE', padding: '2px 8px',
                borderRadius: '99px', border: '1px solid rgba(167, 139, 250, 0.4)'
              }}>
                AI Intelligence
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
              Enterprise Churn Prevention Platform
            </p>
          </div>
        </div>

        {/* Hero Value Prop & Bullet Points */}
        <div style={{ zIndex: 1, margin: '36px 0' }}>
          <h2 style={{
            fontSize: '30px', fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em',
            marginBottom: '16px', color: '#ffffff'
          }}>
            Build smarter customer retention.
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.82)', lineHeight: 1.6, marginBottom: '32px' }}>
            Use AI-powered insights to understand customer risk and take action before customers churn.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {bulletPoints.map(point => (
              <div key={point} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(255, 255, 255, 0.07)', border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px', padding: '12px 16px', backdropFilter: 'blur(4px)'
              }}>
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'rgba(167, 139, 250, 0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Check size={14} color="#EDE9FE" strokeWidth={2.5} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Security Badge */}
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '20px', zIndex: 1,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <span>256-bit TLS · Multi-Tenant Isolation</span>
          <span>© 2026 ChurnGuard Technologies</span>
        </div>
      </aside>

      {/* ── Right Form Container (Desktop: 60–62% width, centered form card max-width 520px) ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        backgroundColor: 'var(--bg)',
        overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: '500px' }}>

          {/* Form Card */}
          <div className="card" style={{
            padding: '36px 32px',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-md)',
            background: 'var(--surface)',
            border: '1px solid var(--border)'
          }}>

            {success ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{
                  width: '64px', height: '64px', background: '#F0FDF4', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', border: '1px solid #BBF7D0'
                }}>
                  <CheckCircle2 size={36} color="#22C55E" />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Email Verified!
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Your account is active. Redirecting to sign in…
                </p>
              </div>

            ) : step === 3 ? (
              /* ── STEP 3: OTP VERIFICATION ── */
              <form onSubmit={handleOtpVerify} noValidate>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <div style={{
                    width: '56px', height: '56px',
                    background: 'var(--soft-aqua)',
                    borderRadius: '16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: '1px solid var(--border)'
                  }}>
                    <Mail size={28} color="var(--accent)" strokeWidth={2} />
                  </div>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                    Verify your email
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                    We've sent a 6-digit code to<br />
                    <strong style={{ color: 'var(--text-primary)' }}>{maskedEmail}</strong>
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Check your inbox and spam folder. The code expires in 10 minutes.
                  </p>
                </div>

                {/* OTP Boxes */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-digit-${i}`}
                      ref={el => otpRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]"
                      maxLength={1}
                      value={digit}
                      autoComplete="one-time-code"
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      onPaste={i === 0 ? handleOtpPaste : undefined}
                      style={{
                        width: '48px', height: '56px',
                        textAlign: 'center',
                        fontSize: '22px', fontWeight: 700,
                        fontFamily: 'SFMono-Regular, Consolas, monospace',
                        border: `2px solid ${otpError ? 'var(--danger)' : digit ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '10px',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        boxShadow: digit ? '0 0 0 3px rgba(45, 212, 191, 0.25)' : 'none',
                        caretColor: 'var(--accent)',
                      }}
                    />
                  ))}
                </div>

                {/* Error */}
                {otpError && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.25)',
                    borderRadius: '10px', padding: '10px 14px',
                    marginBottom: '16px'
                  }}>
                    <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '13px', color: 'var(--danger)', lineHeight: 1.4 }}>{otpError}</span>
                  </div>
                )}

                {/* Verify Button */}
                <button
                  id="verify-otp-btn"
                  type="submit"
                  disabled={otpLoading || otpDigits.join('').length < 6}
                  style={{
                    width: '100%', padding: '13px 24px',
                    background: otpLoading || otpDigits.join('').length < 6
                      ? 'var(--border)'
                      : 'var(--accent)',
                    color: otpLoading || otpDigits.join('').length < 6 ? 'var(--text-muted)' : 'var(--bg)',
                    border: '1px solid var(--accent)', borderRadius: '10px',
                    fontSize: '15px', fontWeight: 700, cursor: otpLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.2s', marginBottom: '16px',
                    opacity: otpDigits.join('').length < 6 ? 0.6 : 1,
                  }}
                >
                  {otpLoading ? (
                    <>
                      <span style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        animation: 'spin 0.7s linear infinite',
                        display: 'inline-block'
                      }} />
                      Verifying…
                    </>
                  ) : (
                    <><CheckCircle2 size={18} /> Verify Email</>
                  )}
                </button>

                {/* Resend OTP */}
                <div style={{ textAlign: 'center' }}>
                  {resendCooldown > 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      Resend available in{' '}
                      <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
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
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '13px', color: 'var(--accent)', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 8px', borderRadius: '6px',
                        opacity: resendLoading ? 0.6 : 1,
                      }}
                    >
                      {resendLoading
                        ? <><RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending…</>
                        : <><RefreshCw size={14} /> Resend verification code</>
                      }
                    </button>
                  )}
                </div>

                {/* Back link */}
                <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => { setStep(2); setOtpError('') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '12px', color: 'var(--text-muted)',
                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <ArrowLeft size={12} /> Wrong email? Go back
                  </button>
                </div>
              </form>

            ) : step === 1 ? (
              /* ── STEP 1: ACCOUNT INFORMATION ── */
              <>
                {/* Step Indicator Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      padding: '4px 10px', borderRadius: '99px',
                      background: 'var(--purple-50)', color: 'var(--purple-600)',
                      fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <span>1</span> <span>Account</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>────────</span>
                    <div style={{
                      padding: '4px 10px', borderRadius: '99px',
                      background: 'transparent', color: 'var(--text-muted)',
                      fontSize: '12px', fontWeight: 600
                    }}>
                      <span>2</span> <span>Profile</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      background: 'var(--purple-50)', color: 'var(--purple-600)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <UserPlus size={16} />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Create Your Account
                    </h1>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                    Already have an account?{' '}
                    <Link to="/" style={{ color: 'var(--purple-600)', fontWeight: 700, textDecoration: 'none' }}>
                      Sign in
                    </Link>
                  </p>
                </div>

                {/* Top Alert Error */}
                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                      background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
                      fontSize: '13px', padding: '10px 14px', borderRadius: '10px',
                      marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '8px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleContinueToStep2} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Work Email Address */}
                  <div>
                    <label htmlFor="register-email" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '4px'
                    }}>
                      Work Email Address <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
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
                        className="input-base"
                        style={{
                          paddingLeft: '40px',
                          borderColor: errors.email ? '#f87171' : undefined
                        }}
                        aria-invalid={errors.email ? 'true' : 'false'}
                        aria-describedby={errors.email ? 'email-error' : undefined}
                      />
                    </div>
                    {errors.email && (
                      <p id="email-error" style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label htmlFor="register-phone" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '4px'
                    }}>
                      Phone Number <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Phone size={16} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
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
                        placeholder="9876543210"
                        className="input-base"
                        style={{
                          paddingLeft: '40px',
                          borderColor: errors.phone ? '#f87171' : undefined
                        }}
                        aria-invalid={errors.phone ? 'true' : 'false'}
                        aria-describedby={errors.phone ? 'phone-error' : undefined}
                      />
                    </div>
                    {errors.phone && (
                      <p id="phone-error" style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                        {errors.phone}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="register-password" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '4px'
                    }}>
                      Password <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
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
                        className="input-base"
                        style={{
                          paddingLeft: '40px', paddingRight: '40px',
                          borderColor: errors.password && touched.password ? '#f87171' : undefined
                        }}
                        aria-invalid={errors.password ? 'true' : 'false'}
                        aria-describedby="password-checklist"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                          padding: '4px', display: 'flex', alignItems: 'center'
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Live Password Requirement Checklist */}
                    <div id="password-checklist" style={{
                      background: 'var(--surface-hover)', borderRadius: '10px',
                      padding: '10px 14px', marginTop: '8px', border: '1px solid var(--border)'
                    }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Password Requirements:
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

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="register-confirm" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '4px'
                    }}>
                      Confirm Password <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
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
                        className="input-base"
                        style={{
                          paddingLeft: '40px', paddingRight: '40px',
                          borderColor: errors.confirmPassword ? '#f87171' : undefined
                        }}
                        aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                        aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
                        style={{
                          position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                          padding: '4px', display: 'flex', alignItems: 'center'
                        }}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p id="confirm-error" style={{ fontSize: '11px', color: '#e11d48', marginTop: '4px', fontWeight: 500 }}>
                        {errors.confirmPassword}
                      </p>
                    )}
                  </div>

                  <button
                    id="register-continue-btn"
                    type="submit"
                    className="btn-primary"
                    style={{
                      width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700,
                      justifyContent: 'center', marginTop: '6px'
                    }}
                  >
                    Continue to Profile <ArrowRight size={16} />
                  </button>

                </form>
              </>

            ) : (
              /* ── STEP 2: PROFILE & ORGANISATION INFORMATION ── */
              <>
                {/* Step Indicator Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      padding: '4px 10px', borderRadius: '99px',
                      background: 'rgba(34, 197, 94, 0.12)', color: '#16a34a',
                      fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      <Check size={12} strokeWidth={3} /> <span>Account</span>
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>────────</span>
                    <div style={{
                      padding: '4px 10px', borderRadius: '99px',
                      background: 'var(--purple-50)', color: 'var(--purple-600)',
                      fontSize: '12px', fontWeight: 700
                    }}>
                      <span>2</span> <span>Profile</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStep(1); setError(''); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--purple-600)',
                      fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px', padding: 0
                    }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                </div>

                <div style={{ marginBottom: '22px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      background: 'var(--purple-50)', color: 'var(--purple-600)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Briefcase size={16} />
                    </div>
                    <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Profile Information
                    </h1>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                    Configure your organization profile to personalize retention analytics.
                  </p>
                </div>

                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    style={{
                      background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
                      fontSize: '13px', padding: '10px 14px', borderRadius: '10px',
                      marginBottom: '18px', display: 'flex', alignItems: 'flex-start', gap: '8px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleFinalSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                  {/* Name Row (First Name + Last Name) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label htmlFor="register-fname" style={{
                        display: 'block', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-secondary)', marginBottom: '4px'
                      }}>
                        First Name <span style={{ color: '#e11d48' }}>*</span>
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
                        placeholder="First name"
                        className="input-base"
                        style={{ borderColor: errors.firstName ? '#f87171' : undefined }}
                        aria-invalid={errors.firstName ? 'true' : 'false'}
                        aria-describedby={errors.firstName ? 'fname-error' : undefined}
                      />
                      {errors.firstName && (
                        <p id="fname-error" style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px', fontWeight: 500 }}>
                          {errors.firstName}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="register-lname" style={{
                        display: 'block', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-secondary)', marginBottom: '4px'
                      }}>
                        Last Name
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
                        placeholder="Last name"
                        className="input-base"
                        style={{ borderColor: errors.lastName ? '#f87171' : undefined }}
                        aria-invalid={errors.lastName ? 'true' : 'false'}
                        aria-describedby={errors.lastName ? 'lname-error' : undefined}
                      />
                      {errors.lastName && (
                        <p id="lname-error" style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px', fontWeight: 500 }}>
                          {errors.lastName}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Company / Organisation */}
                  <div>
                    <label htmlFor="register-company" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '4px'
                    }}>
                      Company / Organisation <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Building2 size={16} style={{
                        position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--text-muted)', pointerEvents: 'none'
                      }} />
                      <input
                        id="register-company"
                        name="companyName"
                        type="text"
                        autoComplete="organization"
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        onBlur={() => setTouched(prev => ({ ...prev, companyName: true }))}
                        required
                        placeholder="Your company name"
                        className="input-base"
                        style={{
                          paddingLeft: '40px',
                          borderColor: errors.companyName ? '#f87171' : undefined
                        }}
                        aria-invalid={errors.companyName ? 'true' : 'false'}
                        aria-describedby={errors.companyName ? 'company-error' : undefined}
                      />
                    </div>
                    {errors.companyName && (
                      <p id="company-error" style={{ fontSize: '11px', color: '#e11d48', marginTop: '2px', fontWeight: 500 }}>
                        {errors.companyName}
                      </p>
                    )}
                  </div>

                  {/* Company Type & Industry */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label htmlFor="register-company-type" style={{
                        display: 'block', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-secondary)', marginBottom: '4px'
                      }}>
                        Company Type <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <select
                        id="register-company-type"
                        name="companyType"
                        value={companyType}
                        onChange={e => setCompanyType(e.target.value)}
                        className="input-base"
                      >
                        {COMPANY_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="register-industry" style={{
                        display: 'block', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-secondary)', marginBottom: '4px'
                      }}>
                        Industry <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <select
                        id="register-industry"
                        name="industry"
                        value={industry}
                        onChange={e => setIndustry(e.target.value)}
                        className="input-base"
                      >
                        {INDUSTRIES.map(ind => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Role & Department */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label htmlFor="register-role" style={{
                        display: 'block', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-secondary)', marginBottom: '4px'
                      }}>
                        Role <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <select
                        id="register-role"
                        name="role"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        className="input-base"
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="register-department" style={{
                        display: 'block', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-secondary)', marginBottom: '4px'
                      }}>
                        Department
                      </label>
                      <select
                        id="register-department"
                        name="department"
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        className="input-base"
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Company Size */}
                  <div>
                    <label htmlFor="register-size" style={{
                      display: 'block', fontSize: '12px', fontWeight: 600,
                      color: 'var(--text-secondary)', marginBottom: '4px'
                    }}>
                      Company Size
                    </label>
                    <select
                      id="register-size"
                      name="companySize"
                      value={companySize}
                      onChange={e => setCompanySize(e.target.value)}
                      className="input-base"
                    >
                      {COMPANY_SIZES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="register-submit"
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                    style={{
                      width: '100%', padding: '12px', fontSize: '14px', fontWeight: 700,
                      justifyContent: 'center', marginTop: '6px', opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? (
                      <>
                        <div style={{
                          width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)',
                          borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite'
                        }} />
                        Creating Account…
                      </>
                    ) : (
                      <>
                        Create Account <Check size={16} />
                      </>
                    )}
                  </button>

                </form>
              </>
            )}

          </div>

          <p style={{
            textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
            marginTop: '20px', lineHeight: 1.4
          }}>
            By creating an account, you agree to our Terms of Service & Enterprise SLA.
          </p>

        </div>
      </main>

    </div>
  )
}

export default Register
