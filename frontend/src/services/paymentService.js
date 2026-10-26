import api from './api'

// UC-20: tổng quan + khoản cần trả + toàn bộ giao dịch của khách đang đăng nhập (khách lấy từ token)
// trả { summary, debts, overdueContracts, transactions }
export async function getMyPayments() {
  const response = await api.get('/payments/my')
  return response.data
}
