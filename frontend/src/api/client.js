const API_URL = "http://127.0.0.1:8000"

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token')

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  }

  if (token && token !== 'null' && token !== 'undefined') {
    headers["Authorization"] = `Bearer ${token}`
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    if (window.location.pathname !== '/') {
      window.location.href = '/'
    }
    throw new Error('Session expired. Please sign in again.')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}