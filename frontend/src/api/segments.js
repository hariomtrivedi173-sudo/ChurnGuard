import { apiRequest } from './client'

export async function getSegments() {
  return apiRequest('/ml/segments')
}
