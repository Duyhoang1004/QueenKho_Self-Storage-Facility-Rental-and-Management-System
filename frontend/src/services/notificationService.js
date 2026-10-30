import api from './api';

export async function getMyNotifications(limit = 30) {
  const res = await api.get('/notifications', { params: { limit } });
  return res.data;
}

export async function getUnreadCount() {
  const res = await api.get('/notifications/unread-count');
  return res.data?.count || 0;
}

export async function markAsRead(id) {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllAsRead() {
  const res = await api.post('/notifications/read-all');
  return res.data;
}
