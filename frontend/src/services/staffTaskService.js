import api from './api'

// UC-16: Bảng công việc của 1 cơ sở (Staff + Facility Manager dùng chung)
// status / staffId không truyền → lấy tất cả
export async function getStaffTasks(facilityId, status, staffId) {
  const res = await api.get('/staff-tasks', { params: { facilityId, status, staffId } })
  return res.data
}

// UC-17: Staff nhận việc → trả task đã cập nhật (IN_PROGRESS + staffName)
export async function claimStaffTask(taskId, staffId) {
  const res = await api.post(`/staff-tasks/${taskId}/claim`, null, { params: { staffId } })
  return res.data
}

// Flow 5: Facility Manager giao task cho 1 nhân viên cùng cơ sở (hoặc đổi người đang làm)
// → trả task đã cập nhật (IN_PROGRESS + staffName). Người giao lấy từ token.
export async function assignStaffTask(taskId, staffId) {
  const res = await api.post(`/staff-tasks/${taskId}/assign`, null, { params: { staffId } })
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

export async function prepareCheckInHandover(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/prepare-check-in`, payload)
  return res.data
}

export async function withdrawCheckInHandover(taskId) {
  const res = await api.post(`/staff-tasks/${taskId}/withdraw-check-in`)
  return res.data
}

export async function reportCheckInBlocker(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/report-check-in-blocker`, payload)
  return res.data
}

export async function reopenCheckInHandover(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/reopen-check-in`, payload)
  return res.data
}

export async function confirmCheckInUnitIssue(taskId, note) {
  const res = await api.post(`/staff-tasks/${taskId}/confirm-unit-issue`, { note })
  return res.data
}

export async function startCheckInRepair(taskId) {
  const res = await api.post(`/staff-tasks/${taskId}/start-check-in-repair`)
  return res.data
}

export async function confirmCheckInRepair(taskId, note) {
  const res = await api.post(`/staff-tasks/${taskId}/confirm-check-in-repair`, { note })
  return res.data
}

export async function resolveCheckInIssues(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/resolve-check-in-issues`, payload)
  return res.data
}

// UC-23 & UC-24: Staff nghiệm thu trả kho + ghi nhận sự cố hư hỏng (nếu có) → trả chi tiết task đã COMPLETED
export async function checkOutStaffTask(taskId, staffId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/check-out`, payload, { params: { staffId } })
  return res.data
}

// UC-27 / PR-S5: Staff hoàn tất xử lý yêu cầu hỗ trợ (SUPPORT)
export async function resolveSupportTask(taskId, staffId, resolutionNote) {
  const body = typeof resolutionNote === 'string' ? { resolutionNote } : (resolutionNote || {})
  const res = await api.post(`/staff-tasks/${taskId}/resolve-support`, body, { params: { staffId } })
  return res.data
}

// PR-S5: Staff / Quản lý chỉnh sửa lại phản hồi hỗ trợ khi ticket đang RESOLVED (tránh nhầm lẫn)
export async function updateSupportResolution(taskId, staffId, payload) {
  const body = typeof payload === 'string' ? { resolutionNote: payload } : (payload || {})
  const res = await api.put(`/staff-tasks/${taskId}/update-support-resolution`, body, { params: { staffId } })
  return res.data
}

// PR-S5: Staff / Quản lý thu hồi kết quả và mở lại toàn bộ task hỗ trợ để xử lý lại từ đầu
export async function reopenSupportTask(taskId, staffId, reason) {
  const body = typeof reason === 'string' ? { reason } : (reason || {})
  const res = await api.post(`/staff-tasks/${taskId}/reopen-support`, body, { params: { staffId } })
  return res.data
}

// UC-27 / PR-S6: Staff cấp lại mã PIN 6 số cho ticket LOCK_ISSUE
export async function resetSupportContractPin(taskId, staffId) {
  const res = await api.post(`/staff-tasks/${taskId}/reset-pin`, null, { params: { staffId } })
  return res.data
}

// UC-27 / PR-S7: Staff cấp đổi thẻ từ RFID mới cho ticket LOCK_ISSUE
export async function reissueSupportContractRfid(taskId, staffId, rfidCardCode) {
  const payload = rfidCardCode ? { rfidCardCode } : {}
  const res = await api.post(`/staff-tasks/${taskId}/reissue-rfid`, payload, { params: { staffId } })
  return res.data
}

// UC-27 / PR-S4: Facility Manager gia hạn task SUPPORT đã quá hạn (giữ người nhận)
export async function extendSupportTask(taskId, managerId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/extend-support`, payload, { params: { managerId } })
  return res.data
}

// PR-S4 mở rộng: FM gia hạn task SUPPORT / MAINTENANCE quá hạn (tối đa 7 ngày). Người gia hạn lấy từ token.
export async function extendOverdueTask(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/extend`, payload)
  return res.data
}

// Vấn đề 6: Staff đang làm task MAINTENANCE báo cáo sửa kho kéo dài và yêu cầu FM chuyển HĐ sang ô tiêu chuẩn khác
export async function requestMaintenanceUnitTransfer(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/request-unit-transfer`, payload)
  return res.data
}

// Báo cáo kết quả liên hệ khách hàng (No-Show workflow)
export async function submitContactReport(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/contact-report`, payload)
  return res.data
}

// UC-25: Quản lý cơ sở hoàn tất hoàn trả tiền (REFUND) - PR-O15 & L-24
export async function completeRefundTask(taskId, userId, payload) {
  const body = typeof payload === 'string' ? { note: payload } : (payload || {})
  const res = await api.post(`/staff-tasks/${taskId}/complete-refund`, body, {
    params: { userId, managerId: userId }
  })
  return res.data
}

// PR-O10: Staff đang giữ task / FM bấm "Sửa xong" cho task bảo trì → ô quay về AVAILABLE
// payload: { note, evidenceImageUrl? }
export async function completeMaintenanceTask(taskId, payload) {
  const res = await api.post(`/staff-tasks/${taskId}/complete-maintenance`, payload)
  return res.data
}

// Upload file ảnh (biên lai hoàn cọc, nghiệm thu)
export async function uploadImageFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data // { url: '...', fileName: '...' }
}
