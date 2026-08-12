const API_URL = "http://127.0.0.1:8000"

export async function uploadDataset(file) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}/dataset/store`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'Upload failed')
  }
  return response.json()
}

export async function getDatasetInfo() {
  const { apiRequest } = await import('./client')
  return apiRequest('/dataset/info')
}

export async function getUploadHistory(limit = 10) {
  const { apiRequest } = await import('./client')
  return apiRequest(`/uploads/history?limit=${limit}`)
}