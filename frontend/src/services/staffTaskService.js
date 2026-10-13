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
