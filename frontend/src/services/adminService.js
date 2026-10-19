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
