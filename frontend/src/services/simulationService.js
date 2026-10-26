import api from './api'

// Demo: "tua thời gian" để trình diễn quy tắc phụ thuộc thời gian (backend: DemoSimulationService)
// Mỗi hàm trả { message, ... }

let statusPromise = null

// Hỏi 1 lần mỗi phiên trang: backend có bật giả lập không (tắt → ẩn mọi nút)
export function getSimulationEnabled() {
  if (!statusPromise) {
    statusPromise = api.get('/dev/simulation/status')
      .then((res) => Boolean(res.data?.enabled))
      .catch(() => {
        statusPromise = null
        return false
      })
  }
  return statusPromise
}

// Flow 2: khách tới nhận kho hôm nay (task CHECK_IN)
export async function simulateArriveToday(taskId) {
  return (await api.post(`/dev/simulation/tasks/${taskId}/arrive-today`)).data
}

// Flow 1: đơn chưa cọc quá 15 phút giữ chỗ
export async function simulateExpireHold(reservationId) {
  return (await api.post(`/dev/simulation/reservations/${reservationId}/expire-hold`)).data
}

// Flow 2: khách bùng hẹn, đủ điều kiện No-Show
export async function simulateNoShow(reservationId) {
  return (await api.post(`/dev/simulation/reservations/${reservationId}/trigger-noshow`)).data
}

// Flow 6: hợp đồng quá hạn N ngày (3 = phí trễ, 31 = thanh lý)
export async function simulateOverdue(contractId, days) {
  return (await api.post(`/dev/simulation/contracts/${contractId}/make-overdue`, null, { params: { days } })).data
}

// Flow 7: ticket đã xử lý quá 3 ngày → tự đóng
export async function simulateTicketAutoClose(ticketId) {
  return (await api.post(`/dev/simulation/support-requests/${ticketId}/auto-close`)).data
}
