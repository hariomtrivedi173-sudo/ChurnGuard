import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { loginUser, forgotPassword } from '../api/auth'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import { useTheme } from '../components/useTheme'
import { getValidToken } from '../utils/auth'
import {
  Lock, Mail, Eye, EyeOff,
  CheckCircle2, ArrowRight, X, AlertCircle, HelpCircle,
  Sun, Moon, RefreshCw, Loader2
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// ForgotPasswordModal
// Isolated component with its own state so the parent Login form never
// re-renders while the modal is open.
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_COOLDOWN_SECONDS = 60

function ForgotPasswordModal({ initialEmail, onClose }) {
  const [email,      setEmail]      = useState(initialEmail || '')
  const [emailError, setEmailError] = useState('')
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [alertMsg,   setAlertMsg]   = useState('')
  const [alertKind,  setAlertKind]  = useState('error') // 'error' | 'success'
  const [countdown,  setCountdown]  = useState(0)
  const timerRef = useRef(null)

  // Start the 60-second resend-cooldown countdown
  const startCooldown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN_SECONDS)
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  // Clean up timer on unmount
  useEffect(() => () => clearInterval(timerRef.current), [])

  function validateEmail(val) {
    if (!val.trim()) return 'Email address is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) return 'Please enter a valid email address.'
    return ''
  }

  // Map raw error message → user-friendly string
  function friendlyError(raw) {
    if (!raw) return 'Something went wrong. Please try again.'
    if (raw.includes('Network error') || raw.includes('Failed to fetch') || raw.includes('NetworkError'))
      return 'Cannot reach the server. Please check your connection and try again.'
    if (raw.includes('422') || raw.includes('valid email'))
      return 'Please enter a valid email address.'
    if (raw.includes('429') || raw.includes('Too many') || raw.includes('wait'))
      return 'Too many attempts. Please wait a few minutes and try again.'
    if (raw.includes('503') || raw.includes('could not send') || raw.includes('right now'))
      return 'We could not send the email right now. Please try again shortly.'
    if (raw.includes('404') || raw.includes('Not Found'))
      return 'Cannot reach the server. Please try again later.'
    return 'Something went wrong. Please try again.'
  }

  async function doSend(emailVal) {
    setSending(true)
    setAlertMsg('')
    try {
      await forgotPassword(emailVal)
      return true
    } catch (err) {
      const raw = err?.message || ''
      // API error handled cleanly by inline alert banner without leaking details
      setAlertKind('error')
      setAlertMsg(friendlyError(raw))
      return false
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    const err = validateEmail(cleanEmail)
    if (err) { setEmailError(err); return }
    setEmailError('')
    if (sending || countdown > 0) return

    const ok = await doSend(cleanEmail)
    if (ok) { setSent(true); startCooldown() }
  }

  async function handleResend() {
    if (sending || countdown > 0) return
    const ok = await doSend(email.trim().toLowerCase())
    if (ok) {
      startCooldown()
      setAlertKind('success')
      setAlertMsg('Reset link resent! Check your inbox and spam folder.')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="auth-modal-card" role="document">

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'var(--brand-subtle)', color: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <HelpCircle size={18} />
            </div>
            <div>
              <h3 id="forgot-title" className="auth-modal-title" style={{ margin: 0 }}>
                Forgot your password?
              </h3>
              {!sent && (
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0' }}>
                  Enter your registered work email and we will send you a secure reset link.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="auth-modal-close-btn"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Inline alert banner (errors + resend success) ── */}
        {alertMsg && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '13px',
              lineHeight: 1.5,
              background: alertKind === 'error' ? '#fef2f2' : '#f0fdf4',
              color: alertKind === 'error' ? '#dc2626' : '#16a34a',
              border: `1px solid ${alertKind === 'error' ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            {alertKind === 'error'
              ? <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              : <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
            }
            <span>{alertMsg}</span>
          </div>
        )}

        {/* ── SUCCESS SCREEN ── */}
        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: '#dcfce7', color: '#16a34a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h4 className="auth-modal-title" style={{ fontSize: '16px', marginBottom: '8px' }}>
              Check your email
            </h4>
            <p className="auth-modal-desc" style={{ marginBottom: '6px' }}>
              If an account exists for{' '}
              <strong style={{ color: 'var(--slate-900)' }}>
                {email.trim().toLowerCase()}
              </strong>
              , we have sent a password reset link.{' '}
              <strong>The link expires in 30 minutes.</strong>
            </p>
            <p className="auth-modal-desc" style={{ marginBottom: '20px', fontSize: '12px', color: 'var(--slate-500)' }}>
              Didn&apos;t get it? Check your spam or junk folder.
            </p>

            {/* Resend with countdown */}
            <button
              type="button"
              onClick={handleResend}
              disabled={sending || countdown > 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                height: '40px',
                marginBottom: '10px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid var(--border-color, #e2e8f0)',
                background: (countdown > 0 || sending) ? '#f1f5f9' : 'white',
                color: (countdown > 0 || sending) ? '#94a3b8' : 'var(--brand)',
                cursor: (countdown > 0 || sending) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {sending
                ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />&nbsp;Sending…</>
                : countdown > 0
                  ? <>Resend available in {countdown}s</>
                  : <><RefreshCw size={14} />&nbsp;Resend email</>
              }
            </button>

            <button
              type="button"
              onClick={onClose}
              className="auth-button-primary"
              style={{ width: '100%', height: '40px' }}
            >
              Back to Log In
            </button>
          </div>

        ) : (
          /* ── FORM ── */
          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="auth-field-group">
              <label htmlFor="forgot-email" className="auth-field-label">
                <span>Work Email Address <span className="req">*</span></span>
              </label>
              <div className="auth-input-box">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value)
                    if (emailError) setEmailError('')
                    if (alertMsg)   setAlertMsg('')
                  }}
                  placeholder="name@company.com"
                  className={`auth-input-element with-left-icon${emailError ? ' input-error' : ''}`}
                  aria-describedby={emailError ? 'forgot-email-err' : undefined}
                  aria-invalid={!!emailError}
                />
              </div>
              {emailError && (
                <p
                  id="forgot-email-err"
                  role="alert"
                  style={{
                    fontSize: '12px',
                    color: '#dc2626',
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertCircle size={12} /> {emailError}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={onClose}
                className="auth-button-secondary"
                style={{ height: '38px', fontSize: '13px', padding: '0 14px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="auth-button-primary"
                style={{
                  width: 'auto',
                  height: '38px',
                  fontSize: '13px',
                  padding: '0 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {sending
                  ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />&nbsp;Sending…</>
                  : <>Send reset link&nbsp;<ArrowRight size={14} /></>
                }
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Page
// ─────────────────────────────────────────────────────────────────────────────

function Login() {
  const { theme, toggleTheme } = useTheme()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showForgot,   setShowForgot]   = useState(false)
  const [forgotInitEmail, setForgotInitEmail] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (getValidToken()) {
      navigate('/dashboard', { replace: true })
      return
    }

    const savedEmail = localStorage.getItem('churnguard_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }

    function handlePageShow() {
      if (getValidToken()) navigate('/dashboard', { replace: true })
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) { setError('Please enter your work email address.'); return }
    if (!password)   { setError('Please enter your password.');          return }

    setLoading(true)
    try {
      const data = await loginUser(cleanEmail, password)
      localStorage.setItem('token', data.access_token)
      if (data.company_id) localStorage.setItem('company_id', data.company_id)

      if (rememberMe) localStorage.setItem('churnguard_remember_email', cleanEmail)
      else            localStorage.removeItem('churnguard_remember_email')

      window.dispatchEvent(new Event('churnguard_auth_changed'))
      toast.success('Welcome back! Loading dashboard…')
      navigate('/dashboard')
    } catch (err) {
      const msg = err?.message || 'Invalid email or password.'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function openForgot() {
    setForgotInitEmail(email)
    setShowForgot(true)
  }

  return (
    <div className="auth-page-wrapper" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '20px', right: '24px' }}>
        <button
          id="login-theme-toggle"
          type="button"
          onClick={toggleTheme}
          className="navbar-icon-btn theme-btn"
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          aria-pressed={theme === 'dark'}
          style={{ width: '36px', height: '36px' }}
        >
          {theme === 'light'
            ? <Moon size={16} className="theme-switch-icon moon-icon" />
            : <Sun  size={16} className="theme-switch-icon sun-icon"  />
          }
        </button>
      </div>

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

      <main className="auth-card-container">
        <div style={{ marginBottom: '24px' }}>
          <h1 className="auth-header-title">Welcome Back</h1>
          <p className="auth-header-subtitle">
            Enter your work credentials to access your tenant dashboard.
          </p>
        </div>

        {error && (
          <div className="auth-alert-banner" role="alert" aria-live="assertive">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email */}
          <div className="auth-field-group">
            <label htmlFor="login-email" className="auth-field-label">
              <span>Work Email Address <span className="req">*</span></span>
            </label>
            <div className="auth-input-box">
              <Mail size={16} className="auth-input-icon" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => { setEmail(e.target.value); if (error) setError('') }}
                required
                placeholder="name@company.com"
                className="auth-input-element with-left-icon"
                aria-required="true"
              />
            </div>
          </div>

          {/* Password */}
          <div className="auth-field-group">
            <div className="auth-field-label">
              <span>Password <span className="req">*</span></span>
              <button
                type="button"
                onClick={openForgot}
                style={{
                  background: 'none', border: 'none',
                  color: 'var(--brand)', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer', padding: 0,
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="auth-input-box">
              <Lock size={16} className="auth-input-icon" />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                required
                placeholder="••••••••"
                className="auth-input-element with-left-icon"
                style={{ paddingRight: '40px' }}
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="auth-input-action-btn"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              id="remember-me"
              name="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--brand)', cursor: 'pointer' }}
            />
            <label htmlFor="remember-me" style={{ fontSize: '12.5px', color: 'var(--slate-600)', cursor: 'pointer', userSelect: 'none' }}>
              Remember my email on this device
            </label>
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="auth-button-primary"
            style={{ marginTop: '4px' }}
          >
            {loading ? (
              <>
                <span style={{
                  width: '16px', height: '16px',
                  border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#ffffff',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block',
                }} />
                &nbsp;Logging In…
              </>
            ) : (
              <>Log In <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="auth-footer-divider">
          New to ChurnGuard?{' '}
          <Link to="/register" className="auth-footer-link">Sign Up</Link>
        </div>
      </main>

      <p className="auth-trust-note">
        Protected by enterprise encryption &amp; multi-tenant isolation.
      </p>

      {/* Forgot Password Modal */}
      {showForgot && (
        <ForgotPasswordModal
          initialEmail={forgotInitEmail}
          onClose={() => setShowForgot(false)}
        />
      )}
    </div>
  )
}

export default Login
