import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { loginUser } from '../api/auth'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import { useTheme } from '../components/useTheme'
import {
  Lock, Mail, Eye, EyeOff,
  CheckCircle2, ArrowRight, X, AlertCircle, HelpCircle,
  Sun, Moon
} from 'lucide-react'

function Login() {
  const { theme, toggleTheme } = useTheme()
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showForgot,   setShowForgot]   = useState(false)
  const [forgotEmail,  setForgotEmail]  = useState('')
  const [forgotSent,   setForgotSent]   = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const savedEmail = localStorage.getItem('churnguard_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError('')

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError('Please enter your work email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      const data = await loginUser(cleanEmail, password)
      localStorage.setItem('token', data.access_token)
      if (data.company_id) {
        localStorage.setItem('company_id', data.company_id)
      }

      if (rememberMe) {
        localStorage.setItem('churnguard_remember_email', cleanEmail)
      } else {
        localStorage.removeItem('churnguard_remember_email')
      }

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

  function handleForgotSubmit(e) {
    e.preventDefault()
    if (!forgotEmail) return
    setForgotSent(true)
    toast.success('Password reset instructions sent if account exists.')
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

      {/* ── Main Auth Card ── */}
      <main className="auth-card-container">
        {/* Card Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 className="auth-header-title">Sign in to ChurnGuard</h1>
          <p className="auth-header-subtitle">
            Enter your work credentials to access your tenant dashboard.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-alert-banner" role="alert" aria-live="assertive">
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Work Email Address */}
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
                onChange={e => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
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
                onClick={() => {
                  setShowForgot(true)
                  setForgotEmail(email)
                  setForgotSent(false)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'color var(--transition-fast)'
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
                onChange={e => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
                required
                placeholder="••••••••"
                className="auth-input-element with-left-icon"
                style={{ paddingRight: '40px' }}
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--brand)',
                cursor: 'pointer',
                borderRadius: '4px'
              }}
            />
            <label htmlFor="remember-me" style={{
              fontSize: '12.5px',
              color: 'var(--slate-600)',
              cursor: 'pointer',
              userSelect: 'none'
            }}>
              Remember my email on this device
            </label>
          </div>

          {/* Submit Button */}
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
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block'
                }} />
                Signing In…
              </>
            ) : (
              <>
                Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer Link to Register */}
        <div className="auth-footer-divider">
          New to ChurnGuard?{' '}
          <Link to="/register" className="auth-footer-link">
            Create an organisation account
          </Link>
        </div>
      </main>

      {/* Trust & Security Note */}
      <p className="auth-trust-note">
        Protected by enterprise encryption & multi-tenant isolation.
      </p>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: '440px',
            padding: '28px',
            borderRadius: '16px',
            background: '#ffffff',
            border: '1px solid var(--slate-200)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'var(--brand-subtle)',
                  color: 'var(--brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <HelpCircle size={18} />
                </div>
                <h3 id="forgot-title" style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--slate-950)' }}>
                  Password Recovery
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--slate-400)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px'
                }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {forgotSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle2 size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--slate-950)', marginBottom: '6px' }}>
                  Instructions Sent
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', lineHeight: 1.5, marginBottom: '20px' }}>
                  If an account exists for <strong style={{ color: 'var(--slate-900)' }}>{forgotEmail}</strong>, an enterprise reset link has been dispatched to your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="auth-button-primary"
                  style={{ width: '100%', height: '40px' }}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: 0, lineHeight: 1.5 }}>
                  Enter your registered work email. We will send a secure password reset link to verify your identity.
                </p>
                <div className="auth-field-group">
                  <label htmlFor="forgot-email" className="auth-field-label">
                    <span>Work Email Address</span>
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="auth-input-element"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="auth-button-secondary"
                    style={{ height: '38px', fontSize: '13px', padding: '0 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-button-primary"
                    style={{ width: 'auto', height: '38px', fontSize: '13px', padding: '0 18px' }}
                  >
                    Send Recovery Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Login