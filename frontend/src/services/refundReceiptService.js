import api from './api'

// D-22 (PR-O25 → PR-O27): khách xác nhận đã nhận tiền hoàn

// Các khoản hoàn của khách (mới nhất trước), contractId để lọc theo hợp đồng
export async function getMyRefundReceipts(contractId) {
  const res = await api.get('/refunds/my', { params: contractId ? { contractId } : {} })
  return res.data
}

export async function confirmRefundReceipt(taskId) {
  const res = await api.post(`/refunds/${taskId}/confirm`, {})
  return res.data
}

// reason 10–500 ký tự
export async function disputeRefundReceipt(taskId, reason) {
  const res = await api.post(`/refunds/${taskId}/dispute`, { reason })
  return res.data
}
