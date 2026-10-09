/**
 * ChurnGuard Client-Side Auth Utilities
 *
 * Provides safe JWT parsing, expiration checking, and centralized auth cleanup.
 * Uses existing localStorage/sessionStorage mechanism.
 */

export function getValidToken() {
  try {
    const token = localStorage.getItem('token')
    if (!token || token === 'null' || token === 'undefined') {
      return null
    }

    const parts = token.split('.')
    if (parts.length !== 3) {
      localStorage.removeItem('token')
      return null
    }

    // Decode base64url payload
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )

    const payload = JSON.parse(jsonPayload)
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      localStorage.removeItem('token')
      return null
    }

    return token
  } catch {
    localStorage.removeItem('token')
    return null
  }
}

export function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('company_id')
  localStorage.removeItem('user_profile')
  sessionStorage.clear()
  window.dispatchEvent(new Event('churnguard_auth_changed'))
}
