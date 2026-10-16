import api from './api'

// Lấy danh sách hợp đồng theo managerId (tự động lọc theo cơ sở của manager đó)
export async function getContractsByManager(managerId) {
  const res = await api.get('/contracts', { params: { managerId } })
  return res.data
}

// Lấy danh sách hợp đồng theo facilityId
export async function getContractsByFacility(facilityId) {
  const res = await api.get('/contracts', { params: { facilityId } })
  return res.data
}

// Customer: lấy HĐ theo reservationId (1 đơn → 1 HĐ)
export async function getContractByReservation(reservationId) {
  const res = await api.get('/contracts', { params: { reservationId } })
  return res.data
}

// Lấy chi tiết 1 hợp đồng theo id
export async function getContractDetail(contractId) {
  const res = await api.get(`/contracts/${contractId}`)
  return res.data
}

// UC-21: Khách hàng gia hạn hợp đồng thuê
export async function renewContract(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/renew`, data)
  return res.data
}

// UC-22: Khách hàng yêu cầu trả kho & hẹn ngày checkout
export async function requestCheckout(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/request-checkout`, data)
  return res.data
}
