import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { registerUser } from '../api/auth'
import { Shield, UserPlus, CheckCircle, ArrowRight, Building2, Phone, Briefcase } from 'lucide-react'

function Register() {
  const [step, setStep] = useState(1)

  // Step 1 fields
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')

  // Step 2 fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [company,   setCompany]   = useState('')
  const [phone,     setPhone]     = useState('')
  const [role,      setRole]      = useState('Analyst')

  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  function handleStep1(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setStep(2)
  }

  async function handleStep2(e) {
    e.preventDefault()
    setError('')
    if (!firstName.trim()) { setError('First name is required'); return }
    setLoading(true)
    try {
      await registerUser(email, password, { first_name: firstName, last_name: lastName, company, phone, role })
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

  const panelContent = [
    'Full AI-powered churn predictions',
    'Real-time risk scoring on 7,000+ customers',
    'SHAP explanations and retention recommendations',
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Left branding panel ── */}
      <div style={{
        width: '420px', minWidth: '380px',
        background: 'linear-gradient(160deg, #4c1d95 0%, #7c3aed 50%, #8b5cf6 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '48px 44px', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', background: 'rgba(255,255,255,.15)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>ChurnGuard</p>
            <p style={{ fontSize: '12px', opacity: 0.7, lineHeight: 1.4 }}>AI Intelligence</p>
          </div>
        </div>

        <div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
            {[1, 2].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', border: '2px solid',
                  borderColor: step >= s ? '#fff' : 'rgba(255,255,255,0.3)',
                  background: step > s ? '#fff' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: step > s ? '#7c3aed' : step === s ? '#fff' : 'rgba(255,255,255,0.4)'
                }}>
                  {step > s ? <CheckCircle size={14} color="#7c3aed" /> : s}
                </div>
                <span style={{ fontSize: '12px', opacity: step >= s ? 1 : 0.4, fontWeight: step === s ? 700 : 400 }}>
                  {s === 1 ? 'Account' : 'Profile'}
                </span>
                {s < 2 && <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.3)' }} />}
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: '28px', fontWeight: 800, lineHeight: 1.25, marginBottom: '14px' }}>
            {step === 1 ? 'Create your\naccount' : 'Tell us about\nyourself'}
          </h2>
          <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: 1.65, marginBottom: '28px' }}>
            {step === 1
              ? 'Join ChurnGuard and get AI-powered churn intelligence for your business.'
              : 'Help us personalise your dashboard experience.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {panelContent.map(text => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle size={16} color="#a78bfa" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', opacity: 0.9 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: '12px', opacity: 0.5 }}>MCA Capstone · Hariom Trivedi</p>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex: 1, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {success ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <CheckCircle size={32} color="#16a34a" />
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Account Created!</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Redirecting you to login…</p>
            </div>

          ) : step === 1 ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <UserPlus size={22} color="var(--purple-600)" />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Create Account</h1>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px' }}>
                Already have an account?{' '}
                <Link to="/" style={{ color: 'var(--purple-600)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
              </p>

              {error && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '10px 14px', borderRadius: '10px', marginBottom: '20px' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email address</label>
                  <input id="register-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" className="input-base" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
                  <input id="register-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 6 characters" className="input-base" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Confirm password</label>
                  <input id="register-confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter password" className="input-base"
                    style={confirm && confirm !== password ? { borderColor: '#f87171' } : {}} />
                  {confirm && confirm !== password && <p style={{ fontSize: '12px', color: '#e11d48', marginTop: '4px' }}>Passwords don't match</p>}
                </div>
                <button id="register-next" type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}>
                  Continue <ArrowRight size={16} />
                </button>
              </form>
            </>

          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <Briefcase size={22} color="var(--purple-600)" />
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Your Profile</h1>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '28px' }}>
                This info will appear in your dashboard and avatar.{' '}
                <button onClick={() => { setStep(1); setError('') }} style={{ background: 'none', border: 'none', color: 'var(--purple-600)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: '14px' }}>
                  ← Back
                </button>
              </p>

              {error && (
                <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '10px 14px', borderRadius: '10px', marginBottom: '20px' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      First name <span style={{ color: '#e11d48' }}>*</span>
                    </label>
                    <input id="register-fname" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Hariom" className="input-base" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Last name</label>
                    <input id="register-lname" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Trivedi" className="input-base" />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <Building2 size={13} style={{ display: 'inline', marginRight: '4px' }} />Company / Organisation
                  </label>
                  <input id="register-company" type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Your company name" className="input-base" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Role</label>
                  <select id="register-role" value={role} onChange={e => setRole(e.target.value)} className="input-base">
                    <option>Analyst</option>
                    <option>Data Scientist</option>
                    <option>Head of Customer Success</option>
                    <option>Product Manager</option>
                    <option>Marketing Manager</option>
                    <option>CEO / Founder</option>
                    <option>Developer</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    <Phone size={13} style={{ display: 'inline', marginRight: '4px' }} />Phone (optional)
                  </label>
                  <input id="register-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" className="input-base" />
                </div>

                <button id="register-submit" type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}>
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
