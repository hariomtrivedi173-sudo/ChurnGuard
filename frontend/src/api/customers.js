import { apiRequest } from './client'

// ── Paginated customer endpoints (MongoDB real company records) ──

export async function getCustomers(page = 1, limit = 50, search = '', signal = null) {
  const params = new URLSearchParams({ page, limit, search })
  return apiRequest(`/customers?${params}`, { signal })
}

export async function getTelcoCustomers(page = 1, limit = 50, search = '', risk_level = '', upload_id = '', signal = null) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search) params.append('search', search)
  if (risk_level && risk_level !== 'all') params.append('risk_level', risk_level)
  if (upload_id && upload_id !== 'all') params.append('upload_id', upload_id)
  return apiRequest(`/telco/customers?${params.toString()}`, { signal })
}

export async function getCustomer(id) {
  return apiRequest(`/telco/customers/${encodeURIComponent(id)}`)
}

export async function getTelcoCustomer(customerId) {
  return apiRequest(`/telco/customers/${encodeURIComponent(customerId)}`)
}

export async function createCustomer(customerData) {
  return apiRequest('/telco/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  })
}

export async function addTelcoCustomer(customerData) {
  return apiRequest('/telco/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  })
}

export async function updateCustomer(id, customerData) {
  return apiRequest(`/telco/customers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  })
}

export async function updateTelcoCustomer(customerId, customerData) {
  return apiRequest(`/telco/customers/${encodeURIComponent(customerId)}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  })
}

export async function deleteCustomer(id) {
  return apiRequest(`/customers/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deleteTelcoCustomer(customerId) {
  return apiRequest(`/telco/customers/${encodeURIComponent(customerId)}`, {
    method: 'DELETE',
  })
}

export async function getAllCustomers() {
  return apiRequest('/customers/all')
}