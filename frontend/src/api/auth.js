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
      first_name:   profileData.first_name   || '',
      last_name:    profileData.last_name    || '',
      company:      profileData.company      || '',
      company_type: profileData.company_type || 'Private Limited Company',
      industry:     profileData.industry     || 'Information Technology',
      department:   profileData.department   || 'Analytics',
      company_size: profileData.company_size || '11–50 employees',
      phone:        profileData.phone        || '',
      role:         profileData.role         || 'Analyst',
      country:      profileData.country      || 'India',
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

export async function requestPasswordOtp({ current_password, new_password, confirm_password }) {
  return apiRequest('/api/auth/password/request-otp', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password, confirm_password }),
  })
}

export async function verifyPasswordOtp({ otp, new_password, current_password }) {
  return apiRequest('/api/auth/password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otp, new_password, current_password }),
  })
}