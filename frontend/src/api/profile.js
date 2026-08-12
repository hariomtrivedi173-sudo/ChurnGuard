import { apiRequest } from './client'

export async function fetchProfile() {
  return await apiRequest('/profile/me')
}

export async function updateProfile(data) {
  return await apiRequest('/profile/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}
