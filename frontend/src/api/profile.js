import { apiRequest, apiFormData } from './client'

export async function fetchProfile() {
  return await apiRequest('/profile/me')
}

export async function updateProfile(data) {
  return await apiRequest('/profile/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function changePassword({ current_password, new_password }) {
  return await apiRequest('/profile/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password }),
  })
}

export async function requestPasswordOtp({ current_password, new_password, confirm_password }) {
  return await apiRequest('/api/settings/password/request-otp', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password, confirm_password }),
  })
}

export async function verifyPasswordOtp({ otp, new_password, current_password }) {
  return await apiRequest('/api/settings/password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ otp, new_password, current_password }),
  })
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData()
  formData.append('file', file)
  return await apiFormData('/profile/photo', formData)
}

export async function deleteProfilePhoto() {
  return await apiRequest('/profile/photo', {
    method: 'DELETE',
  })
}
