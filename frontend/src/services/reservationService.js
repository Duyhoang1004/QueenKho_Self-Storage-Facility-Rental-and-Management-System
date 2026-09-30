import api from './api'

export async function createReservation(data) {
  const response = await api.post('/reservations', data)
  return response.data
}

// UC-12: khách hàng xem đơn đặt chỗ của mình
export async function getMyReservations(customerId) {
  const response = await api.get('/reservations/my', { params: { customerId } })
  return response.data
}

// UC-13: FM xem đơn đã cọc, chờ gán ô. Truyền facilityId hoặc managerId
export async function getPendingReservations({ facilityId, managerId } = {}) {
  const response = await api.get('/reservations/pending', { params: { facilityId, managerId } })
  return response.data
}

// UC-14: Lấy danh sách ô kho trống phù hợp để cấp quyền
export async function getAvailableUnits(reservationId) {
  const response = await api.get(`/reservations/${reservationId}/available-units`)
  return response.data
}

// UC-14: Quản lý xác nhận gán ô kho
export async function assignStorageUnit(reservationId, data) {
  const response = await api.post(`/reservations/${reservationId}/assign`, data)
  return response.data
}

