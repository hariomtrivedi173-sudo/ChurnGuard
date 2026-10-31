import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, LayoutDashboard, LogIn, Home, ArrowLeft } from 'lucide-react'
import ChurnGuardLogo from '../components/ChurnGuardLogo'

export default function NotFound() {
  const navigate = useNavigate()
  const isAuthenticated = useMemo(() => {
    try {
      const token = localStorage.getItem('token')
      return Boolean(token && token !== 'null' && token !== 'undefined')
    } catch {
      return false
    }
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-base, #0b0f19)',
        color: 'var(--text-primary, #f8fafc)',
        padding: '24px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background ambient gradient glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(15, 23, 42, 0) 70%)',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: '480px', width: '100%', position: 'relative', zIndex: 1 }}>
        {/* Brand logo header */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'inline-flex' }}>
            <ChurnGuardLogo height={34} />
          </Link>
        </div>

        {/* 404 Hero badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--brand-subtle, rgba(124, 58, 237, 0.12))',
            color: 'var(--brand, #8b5cf6)',
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: '20px',
            border: '1px solid rgba(124, 58, 237, 0.25)',
          }}
        >
          <Compass size={14} /> 404 • Page Not Found
        </div>

        {/* Main 404 Title */}
        <h1
          style={{
            fontSize: 'clamp(48px, 8vw, 76px)',
            fontWeight: 900,
            margin: '0 0 12px 0',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, var(--text-primary, #ffffff) 30%, var(--brand, #a855f7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
          }}
        >
          404
        </h1>

        <h2
          style={{
            fontSize: '20px',
            fontWeight: 700,
            color: 'var(--text-primary, #f8fafc)',
            margin: '0 0 12px 0',
          }}
        >
          Lost in Telemetry Space
        </h2>

        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #94a3b8)',
            lineHeight: 1.6,
            margin: '0 0 32px 0',
          }}
        >
          The page or customer cohort you are searching for does not exist, has been archived, or was moved to another workspace partition.
        </p>

        {/* Primary and secondary navigation buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'stretch',
          }}
        >
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <LayoutDashboard size={17} /> Back to Dashboard
            </Link>
          ) : (
            <Link
              to="/login"
              className="btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <LogIn size={17} /> Go to Login
            </Link>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ArrowLeft size={15} /> Go Back
            </button>

            <Link
              to="/"
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 16px',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Home size={15} /> Return Home
            </Link>
          </div>
        </div>

        {/* Footer help note */}
        <p
          style={{
            fontSize: '11px',
            color: 'var(--text-muted, #64748b)',
            marginTop: '36px',
          }}
        >
          ChurnGuard Enterprise AI · Calibrated Risk Intelligence
        </p>
      </div>
    </div>
  )
}

