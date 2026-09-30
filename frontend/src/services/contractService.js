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
