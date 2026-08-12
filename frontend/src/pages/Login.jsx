import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { loginUser } from '../api/auth'
import { Shield, TrendingDown, Users, BarChart3 } from 'lucide-react'

const features = [
  { icon: TrendingDown, text: 'Predict churn before it happens' },
  { icon: Users,        text: 'Manage 18-field customer profiles' },
  { icon: BarChart3,    text: 'ML metrics — AUC 94.7%' },
]

function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginUser(email, password)
      localStorage.setItem('token', data.access_token)
      toast.success('Welcome back!')
      navigate('/dashboard')
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
            backdropFilter: 'blur(4px)',
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
            Predict churn.<br />Retain customers.
          </h2>
          <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: 1.65, marginBottom: '36px' }}>
            An AI-powered churn intelligence platform built for your MCA capstone — 6 ML models, SHAP explanations, and real-time retention recommendations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {features.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px', height: '32px',
                  background: 'rgba(255,255,255,.15)',
                  borderRadius: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color="#fff" />
                </div>
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
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            Sign in to ChurnGuard
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '32px' }}>
            Enter your credentials to access the dashboard
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
                id="login-email"
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
                id="login-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input-base"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: 'var(--purple-600)', fontWeight: 600, textDecoration: 'none' }}>
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login