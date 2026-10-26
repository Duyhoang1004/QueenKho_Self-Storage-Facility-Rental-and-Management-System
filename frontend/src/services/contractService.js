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

// Flow 6: báo giá gia hạn 1/3/6/12 tháng (đúng số VNPAY sẽ thu)
// trả [{ months, discountPercent, subtotal, discountAmount, rentAmount, lateFeeAmount, lateFeeWaived, totalAmount }]
export async function getRenewalQuote(contractId) {
  const res = await api.get(`/contracts/${contractId}/renewal-quote`)
  return res.data
}

// Flow 6: FM miễn phí trễ cho hợp đồng quá hạn (lý do bắt buộc 5–400 ký tự)
export async function waiveLateFee(contractId, reason) {
  const res = await api.post(`/contracts/${contractId}/waive-late-fee`, { reason })
  return res.data
}

// Lấy chi tiết 1 hợp đồng theo id
export async function getContractDetail(contractId) {
  const res = await api.get(`/contracts/${contractId}`)
  return res.data
}

// UC-22: Khách hàng yêu cầu trả kho & hẹn ngày checkout
export async function requestCheckout(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/request-checkout`, data)
  return res.data
}

// UC-22: Khách hàng hủy yêu cầu trả kho (hủy chờ trả kho)
export async function cancelCheckout(contractId) {
  const res = await api.post(`/contracts/${contractId}/cancel-checkout`)
  return res.data
}

// UC-28: Lấy danh sách hợp đồng quá hạn / đã thanh lý cho FM
export async function getOverdueContracts(managerId, status = 'OVERDUE') {
  const res = await api.get('/contracts/manager/overdue', { params: { managerId, status } })
  return res.data
}

// UC-28: Ghi chú liên hệ khách hàng quá hạn
export async function addOverdueContact(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/overdue-contacts`, data)
  return res.data
}

// UC-28: Lấy lịch sử liên hệ khách hàng quá hạn
export async function getOverdueContactLogs(contractId, managerId) {
  const res = await api.get(`/contracts/${contractId}/overdue-contacts`, { params: { managerId } })
  return res.data
}

// UC-28: FM thanh lý hợp đồng quá hạn
export async function liquidateContract(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/liquidate`, data)
  return res.data
}

// UC-28: FM yêu cầu hoàn phần cọc còn lại sau thanh lý
export async function refundRemainingDeposit(contractId, data) {
  const res = await api.post(`/contracts/${contractId}/refund-remaining-deposit`, data)
  return res.data
}

