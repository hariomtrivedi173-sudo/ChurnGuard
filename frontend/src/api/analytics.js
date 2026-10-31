import { apiRequest } from './client'

export async function getRevenueAtRisk() {
  return apiRequest('/analytics/revenue-at-risk')
}

