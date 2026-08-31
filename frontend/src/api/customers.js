import { apiRequest } from './client'

export async function getAllCustomers() {
  return apiRequest('/customers/all')
}

export async function createCustomer(customerData) {
  return apiRequest('/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  })
}

export async function getCustomer(id) {
  return apiRequest(`/customers/${id}`)
}

export async function updateCustomer(id, customerData) {
  return apiRequest(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  })
}

export async function deleteCustomer(id) {
  return apiRequest(`/customers/${id}`, { method: 'DELETE' })
}

// ── Telco collection (CSV-uploaded dataset) — paginated ──

export async function getTelcoCustomers(page = 1, limit = 50, search = '', signal = null) {
  const params = new URLSearchParams({ page, limit, search })
  return apiRequest(`/telco/customers?${params}`, { signal })
}

export async function getTelcoCustomer(customerId) {
  return apiRequest(`/telco/customers/${encodeURIComponent(customerId)}`)
}

export async function addTelcoCustomer(customerData) {
  return apiRequest('/telco/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  })
}

export async function updateTelcoCustomer(customerId, customerData) {
  return apiRequest(`/telco/customers/${encodeURIComponent(customerId)}`, {
    method: 'PUT',
    body: JSON.stringify(customerData),
  })
}

export async function deleteTelcoCustomer(customerId) {
  return apiRequest(`/telco/customers/${encodeURIComponent(customerId)}`, {
    method: 'DELETE',
  })
}