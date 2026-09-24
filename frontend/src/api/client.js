const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Standard JSON request (GET / POST / PUT / DELETE) ──────────────────────
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token')

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    })
  } catch (networkError) {
    throw new Error(`Network error: ${networkError.message}`)
  }

  if (response.status === 401 && endpoint !== '/login') {
    localStorage.removeItem('token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please sign in again.')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Request failed: ${response.status}`)
  }

  return response.json()
}

// ── FormData request (file uploads) ────────────────────────────────────────
export async function apiFormData(endpoint, formData, options = {}) {
  const token = localStorage.getItem('token')

  const headers = {}
  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: options.signal,
    })
  } catch (networkError) {
    if (networkError.name === 'AbortError' || options?.signal?.aborted) {
      const abortErr = new Error('Upload cancelled')
      abortErr.name = 'AbortError'
      throw abortErr
    }
    throw new Error(`Network error: ${networkError.message}`)
  }

  if (response.status === 401) {
    localStorage.removeItem('token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please sign in again.')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Upload failed: ${response.status}`)
  }

  return response.json()
}

// ── Blob/file download request (CSV exports) ───────────────────────────────
export async function apiBlob(endpoint) {
  const token = localStorage.getItem('token')

  const headers = {}
  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`
  }

  let response
  try {
    response = await fetch(`${API_URL}${endpoint}`, { headers })
  } catch (networkError) {
    throw new Error(`Network error: ${networkError.message}`)
  }

  if (response.status === 401) {
    localStorage.removeItem('token')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please sign in again.')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Download failed: ${response.status}`)
  }

  return response.blob()
}