import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { registerUser } from '../api/auth'
import { Shield, UserPlus, CheckCircle } from 'lucide-react'

function Register() {
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [success,   setSuccess]   = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await registerUser(email, password)
      setSuccess(true)
      toast.success('Account created! Redirecting to login…')
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left branding panel ── */}
      <div style={{
        width: '420px',
        minWidth: '380px',
        background: 'linear-gradient(160deg, #4c1d95 0%, #7c3aed 50%, #8b5cf6 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 44px',
        color: '#fff',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px', height: '42px',
            background: 'rgba(255,255,255,.15)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>ChurnGuard</p>
            <p style={{ fontSize: '12px', opacity: 0.7, lineHeight: 1.4 }}>AI Intelligence</p>
          </div>
        </div>

        {/* Hero text */}
        <div>
          <h2 style={{ fontSize: '30px', fontWeight: 800, lineHeight: 1.25, marginBottom: '16px' }}>
            Create your<br />account
          </h2>
          <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: 1.65, marginBottom: '32px' }}>
            Join ChurnGuard and start predicting customer churn with our AI-powered platform. Get access to 6 ML models, SHAP explanations, and retention recommendations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              'Access the full analytics dashboard',
              'Run batch predictions on 7,000+ customers',
              'Get AI-powered retention recommendations',
            ].map(text => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle size={16} color="#a78bfa" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', opacity: 0.9 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '12px', opacity: 0.5 }}>MCA Capstone · Hariom Trivedi</p>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex: 1,
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 32px',
      }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px',
                background: '#f0fdf4',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
              }}>
                <CheckCircle size={32} color="#16a34a" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Account Created!</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Redirecting you to login…</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <UserPlus size={22} color="var(--purple-600)" />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Create Account
                </h1>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>
                Already have an account?{' '}
                <Link to="/" style={{ color: 'var(--purple-600)', fontWeight: 600, textDecoration: 'none' }}>
                  Sign in
                </Link>
              </p>

              {error && (
                <div style={{
                  background: '#fff1f2', border: '1px solid #fecdd3',
                  color: '#e11d48', fontSize: '13px',
                  padding: '10px 14px', borderRadius: '10px', marginBottom: '20px',
                }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Email address
                  </label>
                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="input-base"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Password
                  </label>
                  <input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="At least 6 characters"
                    className="input-base"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Confirm password
                  </label>
                  <input
                    id="register-confirm"
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    placeholder="Re-enter password"
                    className="input-base"
                    style={confirm && confirm !== password ? { borderColor: '#f87171' } : {}}
                  />
                  {confirm && confirm !== password && (
                    <p style={{ fontSize: '12px', color: '#e11d48', marginTop: '4px' }}>Passwords don't match</p>
                  )}
                </div>

                <button
                  id="register-submit"
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}
                >
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Register
