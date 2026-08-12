import { apiRequest } from './client'

export async function getMLMetrics() {
  return apiRequest('/ml/metrics')
}
