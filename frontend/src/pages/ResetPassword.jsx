import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { verifyResetToken, resetPassword } from '../api/auth'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import { useTheme } from '../components/useTheme'
import {
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight,
  Sun, Moon, ShieldCheck, KeyRound
} from 'lucide-react'

export default function ResetPassword() {
  const { theme, toggleTheme } = useTheme()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  // State
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  // Verify token on mount
  useEffect(() => {
    let active = true

    async function checkToken() {
      if (!token) {
        if (active) {
          setVerifying(false)
          setTokenValid(false)
          setTokenError('Missing password reset token. Please request a new link.')
        }
        return
      }

      try {
        const res = await verifyResetToken(token)
        if (active) {
          setTokenValid(true)
          setMaskedEmail(res.masked_email || '')
          setVerifying(false)
        }
      } catch (err) {
        if (active) {
          setTokenValid(false)
          setTokenError(err.message || 'This password reset link is invalid or has expired.')
          setVerifying(false)
        }
      }
    }

    checkToken()
    return () => { active = false }
  }, [token])

  // Password requirements validation
  const hasLength = newPassword.length >= 8 && newPassword.length <= 72
  const hasUpper = /[A-Z]/.test(newPassword)
  const hasLower = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const matches = newPassword && confirmPassword && newPassword === confirmPassword
  const isFormValid = hasLength && hasUpper && hasLower && hasNumber && matches

  async function handleSubmit(e) {
    e.preventDefault()
    if (!isFormValid || submitting) return

    setSubmitting(true)
    try {
      const res = await resetPassword({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setSuccess(true)
      toast.success(res.message || 'Password reset successfully!')
      setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (err) {
      toast.error(err.message || 'Failed to update password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page-wrapper" style={{ position: 'relative' }}>
      {/* Theme Toggle Button */}
      <div style={{ position: 'absolute', top: '20px', right: '24px' }}>
        <button
          id="reset-theme-toggle"
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

      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-header-block" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <ChurnGuardLogo size="md" showWordmark={true} linkTo="/" />
          </div>

          <h2 className="auth-header-title" style={{ fontSize: '20px' }}>
            {success ? 'Password Reset Complete' : 'Set New Password'}
          </h2>
          <p className="auth-header-subtitle">
            {success
              ? 'Your account security credentials have been updated successfully.'
              : maskedEmail
                ? `Enter a new password for ${maskedEmail}`
                : 'Create a new, strong password to secure your workspace account.'}
          </p>
        </div>

        {/* ── State 1: Verifying Token ──────────────────────────────── */}
        {verifying && (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--slate-200)',
                borderTopColor: 'var(--brand)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: '14px', color: 'var(--slate-600)', margin: 0 }}>
              Verifying security link…
            </p>
          </div>
        )}

        {/* ── State 2: Invalid or Expired Token ──────────────────────── */}
        {!verifying && !tokenValid && !success && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--danger-subtle)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertCircle size={26} />
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--slate-950)', margin: '0 0 8px' }}>
              Link Invalid or Expired
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--slate-600)', lineHeight: 1.5, margin: '0 0 24px' }}>
              {tokenError || 'This link is invalid or has expired. Please request a new link.'}
            </p>

            <Link
              to="/login"
              className="auth-button-primary"
              style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Request a new link
            </Link>
          </div>
        )}

        {/* ── State 3: Success Screen ────────────────────────────────── */}
        {!verifying && success && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <p style={{ fontSize: '14px', color: 'var(--slate-600)', lineHeight: 1.5, margin: '0 0 24px' }}>
              Your password has been securely updated. You will be redirected to the sign-in screen in a moment.
            </p>

            <Link
              to="/login"
              className="auth-button-primary"
              style={{ width: '100%', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Log In Now
              <ArrowRight size={15} style={{ marginLeft: '8px' }} />
            </Link>
          </div>
        )}

        {/* ── State 4: Valid Token Form ──────────────────────────────── */}
        {!verifying && tokenValid && !success && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* New Password */}
            <div className="auth-field-group">
              <label htmlFor="new-password" className="auth-field-label">
                <span>New Password</span>
                <span className="req">*</span>
              </label>
              <div className="auth-input-box">
                <span className="auth-input-icon">
                  <Lock size={15} />
                </span>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="auth-input-element with-left-icon"
                  style={{ paddingRight: '40px' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="auth-input-action-btn"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="auth-field-group">
              <label htmlFor="confirm-password" className="auth-field-label">
                <span>Confirm New Password</span>
                <span className="req">*</span>
              </label>
              <div className="auth-input-box">
                <span className="auth-input-icon">
                  <KeyRound size={15} />
                </span>
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="auth-input-element with-left-icon"
                  style={{ paddingRight: '40px' }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="auth-input-action-btn"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Password Validation Checklist */}
            <div
              style={{
                background: 'var(--brand-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasLength ? '#16a34a' : 'var(--slate-500)' }}>
                <ShieldCheck size={14} color={hasLength ? '#16a34a' : 'currentColor'} />
                <span>At least 8 characters</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasUpper ? '#16a34a' : 'var(--slate-500)' }}>
                <ShieldCheck size={14} color={hasUpper ? '#16a34a' : 'currentColor'} />
                <span>At least one uppercase letter (A-Z)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasLower ? '#16a34a' : 'var(--slate-500)' }}>
                <ShieldCheck size={14} color={hasLower ? '#16a34a' : 'currentColor'} />
                <span>At least one lowercase letter (a-z)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasNumber ? '#16a34a' : 'var(--slate-500)' }}>
                <ShieldCheck size={14} color={hasNumber ? '#16a34a' : 'currentColor'} />
                <span>At least one number (0-9)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: matches ? '#16a34a' : 'var(--slate-500)' }}>
                <ShieldCheck size={14} color={matches ? '#16a34a' : 'currentColor'} />
                <span>Passwords match</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className="auth-button-primary"
              style={{ marginTop: '8px', height: '44px' }}
            >
              {submitting ? 'Updating Password…' : 'Update Password'}
            </button>
          </form>
        )}

        {/* Back to Login link */}
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link
            to="/login"
            style={{ fontSize: '13px', color: 'var(--brand)', textDecoration: 'none', fontWeight: 600 }}
          >
            ← Back to Log In
          </Link>
        </div>
      </div>
    </div>
  )
}

