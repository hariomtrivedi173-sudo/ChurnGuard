import { apiRequest } from './client'

export async function predictChurn(customerData) {
  return apiRequest('/predict/full', {
    method: 'POST',
    body: JSON.stringify(customerData),
  })
}