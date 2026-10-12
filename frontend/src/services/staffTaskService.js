import api from './api'

// UC-16: Bảng công việc của 1 cơ sở (Staff + Facility Manager dùng chung)
// status không truyền → lấy tất cả
export async function getStaffTasks(facilityId, status) {
  const res = await api.get('/staff-tasks', { params: { facilityId, status } })
  return res.data
}
