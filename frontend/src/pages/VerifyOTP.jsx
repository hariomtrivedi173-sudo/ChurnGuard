import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { verifyRegistrationOtp, resendRegistrationOtp } from '../api/auth'
import { Shield, Mail, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react'

function VerifyOTP() {
  const navigate = useNavigate()

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

  // ── OTP handlers ──────────────────────────────────────────────────────────
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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'row',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      backgroundColor: 'var(--bg)',
      color: 'var(--text-primary)',
    }}>

      {/* ── Left Hero Panel ── */}
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

        {/* Brand */}
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

        {/* Explanatory copy */}
        <div style={{ zIndex: 1, margin: '36px 0' }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'rgba(167, 139, 250, 0.25)',
            border: '1px solid rgba(167, 139, 250, 0.4)',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '24px',
          }}>
            <Mail size={32} color="#EDE9FE" strokeWidth={1.5} />
          </div>
          <h2 style={{
            fontSize: '28px', fontWeight: 800, lineHeight: 1.25,
            letterSpacing: '-0.02em', marginBottom: '16px', color: '#ffffff'
          }}>
            One more step to get started.
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.82)', lineHeight: 1.6, marginBottom: '24px' }}>
            We sent a 6-digit code to your email to confirm your address and keep your account secure.
          </p>
          {[
            'Check your inbox and spam folder',
            'The code expires in 10 minutes',
            'Request a new code after 60 seconds',
          ].map(tip => (
            <div key={tip} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', marginBottom: '8px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
            }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: 'rgba(167, 139, 250, 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <CheckCircle2 size={13} color="#EDE9FE" />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{tip}</span>
            </div>
          ))}
        </div>

        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '20px', zIndex: 1,
          fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)'
        }}>
          © 2026 ChurnGuard Technologies
        </div>
      </aside>

      {/* ── Right Form Panel ── */}
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
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <div className="card" style={{
            padding: '40px 36px',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-md)',
            background: 'var(--surface)',
            border: '1px solid var(--border)'
          }}>

            {success ? (
              /* ── Success State ── */
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: '64px', height: '64px', background: '#f0fdf4', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px', border: '1px solid #bbf7d0'
                }}>
                  <CheckCircle2 size={36} color="#16a34a" />
                </div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                  Email Verified!
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  Your ChurnGuard account is now active. Redirecting to sign in…
                </p>
              </div>

            ) : (
              <form onSubmit={handleVerify} noValidate>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
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
                  <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                    Verify your email
                  </h1>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 4px' }}>
                    We've sent a 6-digit code to
                  </p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {maskedEmail}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Check your inbox and spam folder. The code expires in 10 minutes.
                  </p>
                </div>

                {/* OTP Digit Inputs */}
                <div style={{
                  display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px'
                }}>
                  {otpDigits.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-box-${i}`}
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
                        width: '52px', height: '60px',
                        textAlign: 'center',
                        fontSize: '24px', fontWeight: 700,
                        fontFamily: 'SFMono-Regular, Consolas, monospace',
                        border: `2px solid ${otpError ? 'var(--danger)' : digit ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: '12px',
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

                {/* Error Message */}
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
                  id="verify-email-btn"
                  type="submit"
                  disabled={otpLoading || otpDigits.join('').length < 6}
                  style={{
                    width: '100%', padding: '14px 24px',
                    background: otpLoading || otpDigits.join('').length < 6
                      ? 'var(--border)'
                      : 'var(--accent)',
                    color: otpLoading || otpDigits.join('').length < 6 ? 'var(--text-muted)' : 'var(--bg)',
                    border: '1px solid var(--accent)', borderRadius: '10px',
                    fontSize: '15px', fontWeight: 700,
                    cursor: otpLoading || otpDigits.join('').length < 6 ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.2s', marginBottom: '20px',
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

                {/* Resend Section */}
                <div style={{
                  textAlign: 'center',
                  padding: '16px 0 0',
                  borderTop: '1px solid var(--border)'
                }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                    Didn't receive the code?
                  </p>
                  {resendCooldown > 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                      Resend available in{' '}
                      <strong style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {resendCooldown}s
                      </strong>
                    </p>
                  ) : (
                    <button
                      id="resend-code-btn"
                      type="button"
                      onClick={handleResend}
                      disabled={resendLoading}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '13px', color: 'var(--accent)', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '6px 10px', borderRadius: '8px',
                        opacity: resendLoading ? 0.6 : 1,
                        transition: 'background 0.15s',
                      }}
                    >
                      {resendLoading
                        ? <><RefreshCw size={14} style={{ animation: 'spin 0.7s linear infinite' }} /> Sending…</>
                        : <><RefreshCw size={14} /> Resend verification code</>
                      }
                    </button>
                  )}
                </div>

                {/* Back to register */}
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Link
                    to="/register"
                    style={{
                      fontSize: '12px', color: 'var(--text-muted)',
                      textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <ArrowLeft size={12} /> Back to registration
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) { .auth-left-panel { display: none !important; } }
      `}</style>
    </div>
  )
}

export default VerifyOTP
