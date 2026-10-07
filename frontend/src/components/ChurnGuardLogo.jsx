import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'

/**
 * ChurnGuardLogo
 *
 * Professional, motion-enabled ChurnGuard brand mark and wordmark.
 * Preserves the authentic ChurnGuard Shield identity while introducing
 * subtle, enterprise-grade motion and interactive states.
 *
 * Variants:
 * - 'landing': Slightly richer ambient signal flow communicating continuous customer analysis.
 * - 'navbar': Professional, mostly static, clean hover interaction.
 * - 'auth': Elegant gentle float and slow pulse.
 * - 'sidebar': Stable, collapses smoothly to icon-only when isCollapsed is true.
 */
export default function ChurnGuardLogo({
  variant = 'navbar', // 'navbar' | 'landing' | 'auth' | 'sidebar'
  size = 'md',        // 'sm' | 'md' | 'lg' | 'xl'
  showWordmark = true,
  showTagline = true,
  tagline = 'AI Churn Intelligence',
  isCollapsed = false,
  linkTo = null,
  inverse = false,    // For dark headers / hero panels where text is white
  className = '',
  style = {}
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Size configurations
  const dimensions = {
    sm: { iconBox: 30, iconSize: 16, titleSize: '14px', tagSize: '10px' },
    md: { iconBox: 36, iconSize: 20, titleSize: '16px', tagSize: '11px' },
    lg: { iconBox: 44, iconSize: 24, titleSize: '19px', tagSize: '12px' },
    xl: { iconBox: 52, iconSize: 28, titleSize: '24px', tagSize: '13px' },
  }[size] || { iconBox: 36, iconSize: 20, titleSize: '16px', tagSize: '11px' }

  // Decide motion class based on variant
  const getMotionClass = () => {
    switch (variant) {
      case 'landing':
        return 'churnguard-motion-landing'
      case 'auth':
        return 'churnguard-motion-auth'
      case 'sidebar':
        return 'churnguard-motion-sidebar'
      case 'navbar':
      default:
        return 'churnguard-motion-navbar'
    }
  }

  const content = (
    <div
      className={`churnguard-logo-container ${getMotionClass()} ${isHovered ? 'is-hovered' : ''} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? '8px' : size === 'xl' ? '14px' : '10px',
        textDecoration: 'none',
        userSelect: 'none',
        ...style,
      }}
      aria-label="ChurnGuard — AI Customer Retention Intelligence"
    >
      {/* ── Icon / Mark ── */}
      <div
        className="churnguard-logo-mark-wrap"
        style={{
          position: 'relative',
          width: `${dimensions.iconBox}px`,
          height: `${dimensions.iconBox}px`,
          flexShrink: 0,
        }}
      >
        {/* Subtle Ambient Pulse Ring (Landing and Auth variants only) */}
        {(variant === 'landing' || variant === 'auth') && (
          <span
            className="churnguard-pulse-ring"
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: size === 'sm' ? '10px' : size === 'xl' ? '16px' : '12px',
              border: '1.5px solid rgba(99, 102, 241, 0.35)',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Shield Icon Box */}
        <div
          className="churnguard-logo-mark"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: size === 'sm' ? '8px' : size === 'xl' ? '14px' : '10px',
            background: 'linear-gradient(135deg, #312E81 0%, #4338CA 50%, #4F46E5 100%)',
            border: '1px solid rgba(199, 210, 254, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.28)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Genuine ChurnGuard Shield */}
          <Shield
            size={dimensions.iconSize}
            color="#EEF2FF"
            strokeWidth={2.4}
            className="churnguard-shield-svg"
            style={{ position: 'relative', zIndex: 1 }}
          />

          {/* Micro Signal Beacon Dot (Indicates live active intelligence) */}
          <span
            className="churnguard-beacon-dot"
            aria-hidden="true"
            style={{
              position: 'absolute',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              backgroundColor: '#A5B4FC',
              boxShadow: '0 0 6px #818CF8',
              top: '28%',
              right: '28%',
              zIndex: 2,
            }}
          />
        </div>
      </div>

      {/* ── Stable Wordmark ── */}
      {showWordmark && !isCollapsed && (
        <div
          className="churnguard-wordmark-wrap"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className="churnguard-wordmark-title"
              style={{
                fontSize: dimensions.titleSize,
                fontWeight: 800,
                letterSpacing: '-0.025em',
                color: inverse ? '#FFFFFF' : 'var(--text-primary)',
              }}
            >
              ChurnGuard
            </span>
            {variant === 'landing' && (
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'var(--slate-100)',
                  color: 'var(--slate-700)',
                  border: '1px solid var(--slate-200)',
                }}
              >
                AI
              </span>
            )}
          </div>
          {showTagline && (
            <span
              className="churnguard-wordmark-tagline"
              style={{
                fontSize: dimensions.tagSize,
                fontWeight: 500,
                color: inverse ? 'rgba(255, 255, 255, 0.7)' : 'var(--text-muted)',
                marginTop: '2px',
              }}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    )
  }

  return content
}
