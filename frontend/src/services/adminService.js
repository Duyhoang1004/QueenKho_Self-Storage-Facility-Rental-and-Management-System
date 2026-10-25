import api from './api'

// UC-03: danh sách 5 vai trò + số người dùng
export async function getRoles() {
  const response = await api.get('/admin/roles')
  return response.data
}

// UC-03: sửa mô tả vai trò (actorUserId = Admin đang đăng nhập)
export async function updateRoleDescription(roleId, description, actorUserId) {
  const response = await api.put(`/admin/roles/${roleId}`, { description }, { params: { actorUserId } })
  return response.data
}

// UC-08: danh sách người dùng — params { keyword, role, status, facilityId, page, size }
// trả { content, page, size, totalElements, totalPages }
export async function getUsers(params) {
  const response = await api.get('/admin/users', { params })
  return response.data
}

// UC-08: dropdown cơ sở [{ id, code, name, status, managerId, managerName }]
export async function getUserFacilityOptions() {
  const response = await api.get('/admin/users/facility-options')
  return response.data
}

// UC-08: các thao tác ghi trả { user, warning }
export async function createUser(body, actorUserId) {
  const response = await api.post('/admin/users', body, { params: { actorUserId } })
  return response.data
}

export async function updateUser(userId, body, actorUserId) {
  const response = await api.put(`/admin/users/${userId}`, body, { params: { actorUserId } })
  return response.data
}

// status: ACTIVE (mở lại) / LOCKED / DISABLED — reason bắt buộc khi khoá / vô hiệu
export async function changeUserStatus(userId, status, reason, actorUserId) {
  const response = await api.patch(`/admin/users/${userId}/status`, { status, reason }, { params: { actorUserId } })
  return response.data
}

export async function resetUserPassword(userId, newPassword, actorUserId) {
  const response = await api.put(`/admin/users/${userId}/password`, { newPassword }, { params: { actorUserId } })
  return response.data
}

// UC-31: nhật ký hoạt động — params { userId, actor, role, targetEntity, targetId, keyword, from, to, page, size }
// (from / to dạng YYYY-MM-DD) → trả { content, page, size, totalElements, totalPages }
export async function getActivityLogs(params, actorUserId) {
  const response = await api.get('/admin/activity-logs', { params: { ...params, actorUserId } })
  return response.data
}

// UC-31: các loại đối tượng có trong log ["users", "reservations", ...]
export async function getActivityLogTargetEntities(actorUserId) {
  const response = await api.get('/admin/activity-logs/target-entities', { params: { actorUserId } })
  return response.data
}

// UC-31: số liệu trang tổng quan /admin
export async function getAdminDashboard(actorUserId) {
  const response = await api.get('/admin/dashboard', { params: { actorUserId } })
  return response.data
}
