import api from './api'

// UC-26: Lấy danh sách hợp đồng đủ điều kiện gửi yêu cầu hỗ trợ (PR-51, PR-S2)
export async function getEligibleSupportContracts(customerId) {
  const res = await api.get('/support-requests/eligible-contracts', {
    params: { customerId }
  })
  return res.data
}

// UC-26 / PR-S9: Lấy danh sách ticket hỗ trợ của khách hàng
export async function getCustomerSupportTickets(customerId, { status, contractId } = {}) {
  const res = await api.get('/support-requests', {
    params: {
      customerId,
      status: status && status !== 'ALL' ? status : undefined,
      contractId: contractId || undefined
    }
  })
  return res.data
}

// UC-26 / PR-51, PR-S1, PR-S2: Tạo ticket hỗ trợ mới
export async function createSupportTicket(customerId, payload) {
  const res = await api.post('/support-requests', payload, {
    params: { customerId }
  })
  return res.data
}

// UC-26 / PR-S3: Khách hủy ticket còn ở trạng thái OPEN
// PR-S3a (22/11/2026): yêu cầu đang xử lý bắt buộc lý do 10–300 ký tự
export async function cancelSupportTicket(ticketId, customerId, reason) {
  const res = await api.post(`/support-requests/${ticketId}/cancel`, reason ? { reason } : null, {
    params: { customerId }
  })
  return res.data
}

// UC-26 / PR-52: Khách xác nhận "Đã ổn" khi ticket RESOLVED -> CLOSED
export async function confirmSupportTicket(ticketId, customerId) {
  const res = await api.post(`/support-requests/${ticketId}/confirm`, null, {
    params: { customerId }
  })
  return res.data
}

// UC-26 / PR-52: Khách báo "Chưa xong" (kèm lý do) -> OPEN + sinh task SUPPORT mới
export async function reopenSupportTicket(ticketId, customerId, reason) {
  const res = await api.post(`/support-requests/${ticketId}/reopen`, { reason }, {
    params: { customerId }
  })
  return res.data
}
