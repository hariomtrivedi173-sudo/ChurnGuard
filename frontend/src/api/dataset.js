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