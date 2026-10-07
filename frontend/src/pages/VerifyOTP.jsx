import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { verifyRegistrationOtp, resendRegistrationOtp } from '../api/auth'
import { Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft, Sun, Moon } from 'lucide-react'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import { useTheme } from '../components/useTheme'

function VerifyOTP() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const [email,          setEmail]          = useState('')
  const [maskedEmail,    setMaskedEmail]    = useState('')
  const [otpDigits,      setOtpDigits]      = useState(['', '', '', '', '', ''])
  const [otpError,       setOtpError]       = useState('')
  const [otpLoading,     setOtpLoading]     = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading,  setResendLoading]  = useState(false)
  const [success,        setSuccess]        = useState(false)
  const otpRefs = useRef([])

  // Restore pending email from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pending_verify_email')
    if (!saved) {
      // No pending registration — send back to register
      navigate('/register')
      return
    }
    setEmail(saved)
    // Mask email for display
    const [user, domain] = saved.split('@')
    const masked = user.length <= 2
      ? user[0] + '***@' + domain
      : user[0] + '***' + user[user.length - 1] + '@' + domain
    setMaskedEmail(masked)
    // Focus first box
    setTimeout(() => otpRefs.current[0]?.focus(), 150)
  }, [navigate])

  // Countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // ── OTP handlers ──
  function handleOtpChange(index, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    setOtpError('')
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index, e) {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
    if (e.key === 'ArrowLeft'  && index > 0) otpRefs.current[index - 1]?.focus()
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

  async function handleVerify(e) {
    e.preventDefault()
    const otp = otpDigits.join('')
    if (otp.length < 6) {
      setOtpError('Please enter all 6 digits of the verification code.')
      return
    }
    setOtpLoading(true)
    setOtpError('')
    try {
      await verifyRegistrationOtp({ email, otp })
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

  async function handleResend() {
    if (resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setOtpError('')
    try {
      await resendRegistrationOtp({ email })
      toast.success('A new verification code has been sent.')
      setResendCooldown(60)
      setOtpDigits(['', '', '', '', '', ''])
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err) {
      const msg = err.message || 'Could not resend code.'
      setOtpError(msg)
      const match = msg.match(/(\d+)\s*seconds?/)
      if (match) setResendCooldown(parseInt(match[1], 10))
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="auth-page-wrapper" style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', top: '20px', right: '24px' }}>
        <button
          id="verify-otp-theme-toggle"
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

      {/* ── Verification Card ── */}
      <main className="auth-card-container">
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
        ) : (
          <form onSubmit={handleVerify} noValidate>
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
              <h1 className="auth-header-title">Verify your email address</h1>
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
                  id={`verify-otp-${i}`}
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

            {/* Submit Button */}
            <button
              id="verify-otp-submit"
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
                  <CheckCircle2 size={16} /> Verify Email & Access Dashboard
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
                  id="verify-resend-btn"
                  type="button"
                  onClick={handleResend}
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

            {/* Return to Registration */}
            <div className="auth-footer-divider">
              <Link
                to="/register"
                className="auth-footer-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12.5px' }}
              >
                <ArrowLeft size={13} /> Return to Registration
              </Link>
            </div>
          </form>
        )}
      </main>

      {/* Trust & Security Note */}
      <p className="auth-trust-note">
        Protected by enterprise encryption & multi-tenant isolation.
      </p>
    </div>
  )
}

export default VerifyOTP
