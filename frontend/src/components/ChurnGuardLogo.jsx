import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * ChurnGuardLogo (Linear Minimalist Edition)
 *
 * A modern, ultra-clean geometric vector mark inspired by Linear.app.
 * Minimalist geometric shield/aperture icon paired with high-contrast Inter typography.
 */
export default function ChurnGuardLogo({
  _variant = 'navbar',
  size = 'md',
  showWordmark = true,
  linkTo = '/',
  className = '',
}) {
  const [isHovered, setIsHovered] = useState(false)

  // Size specs
  const iconSizes = {
    sm: 18,
    md: 22,
    lg: 28,
  }[size] || 22

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size] || 'text-base'

  const content = (
    <div
      className={`inline-flex items-center gap-2.5 select-none transition-opacity duration-200 text-mauve-950 dark:text-mauve-50 ${
        isHovered ? 'opacity-90' : 'opacity-100'
      } ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label="ChurnGuard"
    >
      {/* ── Minimalist Geometric Mark ── */}
      <div className="relative flex items-center justify-center shrink-0">
        <svg
          width={iconSizes}
          height={iconSizes}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-current transition-transform duration-300 ease-out group-hover:scale-105"
        >
          {/* Geometric outer protective polygon */}
          <path
            d="M12 2.5L20 6.5V12C20 16.8 16.6 20.8 12 22C7.4 20.8 4 16.8 4 12V6.5L12 2.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Inner diagonal precision retention chevron */}
          <path
            d="M8.5 11.5L12 15L16 9"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Subtle micro-dot sensor */}
          <circle cx="12" cy="7" r="1.2" fill="currentColor" />
        </svg>
      </div>

      {/* ── Crisp Wordmark ── */}
      {showWordmark && (
        <span
          className={`font-semibold tracking-[-0.025em] text-inherit font-sans ${textSizes}`}
        >
          ChurnGuard
        </span>
      )}
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="no-underline text-inherit inline-flex items-center">
        {content}
      </Link>
    )
  }

  return content
}
