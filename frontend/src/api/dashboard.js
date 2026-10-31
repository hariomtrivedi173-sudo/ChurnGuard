import { apiRequest } from './client'

export async function getDashboardStats() {
  return apiRequest('/dashboard/stats')
}

export async function runBatchAnalysis() {
  return apiRequest('/predict/batch-all', { method: 'POST' })
}

export async function getRevenueAtRisk() {
  return apiRequest('/analytics/revenue-at-risk')
}
