import { apiRequest } from './client'

export async function predictChurn(customerData) {
  return apiRequest('/predict/full', {
    method: 'POST',
    body: JSON.stringify(customerData),
  })
}

export async function predictSelectedCustomers(payload, signal = null) {
  return apiRequest('/predict/selected', {
    method: 'POST',
    body: JSON.stringify(payload),
    signal,
  })
}
