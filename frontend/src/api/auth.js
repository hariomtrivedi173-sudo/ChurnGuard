import { apiRequest } from './client'

export async function loginUser(email, password) {
  return apiRequest('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function registerUser(email, password, profileData = {}) {
  return apiRequest('/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      confirm_password: profileData.confirm_password || password,
      first_name: profileData.first_name || '',
      last_name: profileData.last_name || '',
      company: profileData.company || '',
      company_type: profileData.company_type || 'Private Limited Company',
      industry: profileData.industry || 'Information Technology',
      department: profileData.department || 'Analytics',
      company_size: profileData.company_size || '11–50 employees',
      phone: profileData.phone || '',
      role: profileData.role || 'Analyst',
      country: profileData.country || 'India',
    }),
  })
}

/** Verify registration OTP — activates the user account */
export async function verifyRegistrationOtp({ email, otp }) {
  return apiRequest('/auth/verify-registration', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  })
}

/** Resend registration OTP — rate-limited to 60 s by backend */
export async function resendRegistrationOtp({ email }) {
  return apiRequest('/auth/resend-registration-otp', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** Request password reset recovery link */
export async function forgotPassword(email) {
  return apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

/** Verify validity and expiration of password reset token */
export async function verifyResetToken(token) {
  return apiRequest(`/auth/verify-reset-token?token=${encodeURIComponent(token)}`, {
    method: 'GET',
  })
}

/** Reset password using single-use reset token */
export async function resetPassword({ token, new_password, confirm_password }) {
  return apiRequest('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password, confirm_password }),
  })
}

/** Revoke session on backend and blacklist token in MongoDB */
export async function logoutUser() {
  try {
    return await apiRequest('/auth/logout', { method: 'POST' })
  } catch (err) {
    // Non-blocking fallback: ensure local cleanup always finishes
    return { success: false, error: err.message }
  }
}