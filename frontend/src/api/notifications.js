import { apiRequest } from './client'

export async function fetchNotifications() {
  return await apiRequest('/notifications')
}

export async function markAllNotificationsRead() {
  return await apiRequest('/notifications/mark-read', {
    method: 'PATCH',
  })
}

export async function markSingleNotificationRead(id) {
  return await apiRequest(`/notifications/${id}/read`, {
    method: 'PATCH',
  })
}

export async function clearAllNotifications() {
  return await apiRequest('/notifications', {
    method: 'DELETE',
  })
}
