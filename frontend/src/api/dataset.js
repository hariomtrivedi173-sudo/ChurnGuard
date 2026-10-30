import { apiRequest, apiFormData } from './client'

// Upload and store a CSV dataset. Calls /dataset/store which validates,
// cleans, deduplicates, inserts, and auto-refreshes the dashboard cache.
export async function uploadDataset(file, signal) {
  const formData = new FormData()
  formData.append('file', file)
  return apiFormData('/dataset/store', formData, { signal })
}

export async function getDatasetInfo() {
  return apiRequest('/dataset/info')
}

export async function getUploadHistory(limit = 10) {
  return apiRequest(`/uploads/history?limit=${limit}`)
}

export async function getDatasetManagementOverview() {
  return apiRequest('/dataset/management/overview')
}

export async function getDatasetUploadRecords(uploadId, page = 1, limit = 50, search = '', signal = null) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.append('search', search)
  return apiRequest(`/dataset/uploads/${encodeURIComponent(uploadId)}/records?${params.toString()}`, { signal })
}

export async function deleteDatasetUpload(uploadId, force = false) {
  const url = force ? `/dataset/upload/${encodeURIComponent(uploadId)}?force=true` : `/dataset/upload/${encodeURIComponent(uploadId)}`
  return apiRequest(url, {
    method: 'DELETE',
  })
}

export async function clearAllDatasetData(confirmPhrase = 'CLEAR ALL MY DATA') {
  return apiRequest('/dataset/clear-all', {
    method: 'POST',
    body: JSON.stringify({ confirm_phrase: confirmPhrase }),
  })
}
