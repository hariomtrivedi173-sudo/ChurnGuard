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

export async function deleteCustomer(id) {
  return apiRequest(`/customers/${id}`, { method: 'DELETE' })
}