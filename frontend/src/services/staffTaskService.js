import api from './api'

// UC-16: Bảng công việc của 1 cơ sở (Staff + Facility Manager dùng chung)
// status không truyền → lấy tất cả
export async function getStaffTasks(facilityId, status) {
  const res = await api.get('/staff-tasks', { params: { facilityId, status } })
  return res.data
}

// UC-17: Staff nhận việc → trả task đã cập nhật (IN_PROGRESS + staffName)
export async function claimStaffTask(taskId, staffId) {
  const res = await api.post(`/staff-tasks/${taskId}/claim`, null, { params: { staffId } })
  return res.data
}

// UC-17: Facility Manager gỡ người nhận → task về OPEN
export async function unassignStaffTask(taskId, managerId) {
  const res = await api.post(`/staff-tasks/${taskId}/unassign`, null, { params: { managerId } })
  return res.data
}

// UC-18: Chi tiết 1 task (kèm biên bản nếu đã check-in). userId = người đang xem (Staff / FM)
export async function getStaffTaskDetail(taskId, userId) {
  const res = await api.get(`/staff-tasks/${taskId}`, { params: { userId } })
  return res.data
}

// UC-18: Gợi ý mã PIN 6 số chưa bị dùng → { accessPinCode }
export async function suggestAccessPin() {
  const res = await api.get('/staff-tasks/pin-suggestion')
  return res.data
}

// UC-18: Staff check-in + lập biên bản bàn giao → trả chi tiết task đã COMPLETED (kèm PIN, RFID, biên bản)
export async function checkInStaffTask(taskId, staffId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/check-in`, payload, { params: { staffId } })
  return res.data
}

// UC-23 & UC-24: Staff nghiệm thu trả kho + ghi nhận sự cố hư hỏng (nếu có) → trả chi tiết task đã COMPLETED
export async function checkOutStaffTask(taskId, staffId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/check-out`, payload, { params: { staffId } })
  return res.data
}

// Báo cáo kết quả liên hệ khách hàng (No-Show workflow)
export async function submitContactReport(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/contact-report`, payload)
  return res.data
}

// Manager hoàn thành task hoàn tiền (REFUND) - PR-O15 & L-24
export async function completeRefundTask(taskId, managerId, payload) {
  const body = typeof payload === 'string' ? { note: payload } : (payload || {})
  const res = await api.post(`/staff-tasks/${taskId}/complete-refund`, body, { params: { managerId } })
  return res.data
}

