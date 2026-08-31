import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { loginUser } from '../api/auth'
import {
  Shield, TrendingDown, Users, BarChart3, Lock, Mail, Eye, EyeOff,
  CheckCircle2, Zap, ArrowRight, X, AlertCircle, HelpCircle, Check
} from 'lucide-react'

const bulletPoints = [
  'AI-powered churn predictions',
  'Real-time customer risk scoring',
  'Explainable AI insights',
  'Retention recommendations',
]

function Login() {
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
      // Standard generic error on failure
      const msg = 'Invalid email or password.'
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
        background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 35%, #4c1d95 70%, #6d28d9 100%)',
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
          background: 'radial-gradient(circle, rgba(167,139,250,0.35) 0%, rgba(124,58,237,0) 70%)',
          borderRadius: '50%', pointerEvents: 'none', filter: 'blur(35px)',
        }} />

        {/* Brand Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          <div style={{
            width: '44px', height: '44px',
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            backdropFilter: 'blur(8px)',
          }}>
            <Shield size={24} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.02em', color: '#ffffff' }}>ChurnGuard</span>
              <span style={{
                fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                background: 'rgba(167, 139, 250, 0.25)', color: '#ddd6fe', padding: '2px 8px',
                borderRadius: '99px', border: '1px solid rgba(196, 181, 253, 0.3)'
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
        <div style={{ zIndex: 1, margin: '40px 0' }}>
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
                  <Check size={14} color="#ddd6fe" strokeWidth={2.5} />
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
      }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>

          {/* Form Card */}
          <div className="card" style={{
            padding: '40px 36px',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-md)',
            background: 'var(--surface)',
            border: '1px solid var(--border)'
          }}>

            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '10px',
                  background: 'var(--purple-50)', color: 'var(--purple-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Lock size={18} />
                </div>
                <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  Sign in to ChurnGuard
                </h1>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                Enter your work credentials to access your tenant dashboard.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                aria-live="assertive"
                style={{
                  background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
                  fontSize: '13px', padding: '12px 14px', borderRadius: '10px',
                  marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Work Email Address */}
              <div>
                <label htmlFor="login-email" style={{
                  display: 'block', fontSize: '12px', fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: '6px'
                }}>
                  Work Email Address <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="input-base"
                    style={{ paddingLeft: '40px' }}
                    aria-required="true"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label htmlFor="login-password" style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)'
                  }}>
                    Password <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotSent(false); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--purple-600)',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', pointerEvents: 'none'
                  }} />
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="input-base"
                    style={{ paddingLeft: '40px', paddingRight: '40px' }}
                    aria-required="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', padding: '4px'
                    }}
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
                    width: '16px', height: '16px', accentColor: 'var(--purple-600)',
                    cursor: 'pointer', borderRadius: '4px'
                  }}
                />
                <label htmlFor="remember-me" style={{
                  fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none'
                }}>
                  Remember my email on this device
                </label>
              </div>

              {/* Submit Button */}
              <button
                id="login-submit"
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
                    Signing In…
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight size={16} />
                  </>
                )}
              </button>

            </form>

            {/* Registration Link */}
            <div style={{
              marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)',
              textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)'
            }}>
              New to ChurnGuard?{' '}
              <Link
                to="/register"
                style={{
                  color: 'var(--purple-600)', fontWeight: 700, textDecoration: 'none'
                }}
              >
                Create an organisation account
              </Link>
            </div>

          </div>

          <p style={{
            textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)',
            marginTop: '20px', lineHeight: 1.4
          }}>
            Protected by enterprise encryption & multi-tenant isolation.
          </p>

        </div>
      </main>

      {/* ── FORGOT PASSWORD MODAL ── */}
      {showForgot && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="forgot-title"
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}
        >
          <div className="card" style={{
            width: '100%', maxWidth: '440px', padding: '28px', borderRadius: '16px',
            background: 'var(--surface)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'var(--purple-50)', color: 'var(--purple-600)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <HelpCircle size={18} />
                </div>
                <h3 id="forgot-title" style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Password Recovery
                </h3>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {forgotSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle2 size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  Instructions Sent
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
                  If an account exists for <strong style={{ color: 'var(--text-primary)' }}>{forgotEmail}</strong>, an enterprise reset link has been dispatched to your inbox.
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                >
                  Return to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                  Enter your registered work email. We will send a secure password reset link to verify your identity.
                </p>
                <div>
                  <label htmlFor="forgot-email" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Work Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="input-base"
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="btn-secondary"
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ fontSize: '13px', padding: '8px 18px' }}
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