import api from './api'

export async function login(credentials) {
  const response = await api.post('/auth/login', credentials)
  return response.data
}

export async function register(userData) {
  const response = await api.post('/auth/register', userData)
  return response.data
}

export function saveSession(loginResponse, emailInput = '') {
  const { token, userId, fullName, role, facilityId, facilityName, phone, cccd } = loginResponse
  const email = loginResponse.email || emailInput

  sessionStorage.setItem('accessToken', token)
  sessionStorage.setItem('user', JSON.stringify({ userId, fullName, email, role, facilityId, facilityName, phone, cccd }))
}

// Trang chủ của từng role — dùng chung cho Login và các Layout khi vào sai portal.
// BOM chưa có portal riêng → rơi về '/', CustomerLayout sẽ báo không có quyền.
const HOME_PATH_BY_ROLE = {
  CUSTOMER: '/',
  STAFF: '/staff',
  FACILITY_MANAGER: '/manager',
  ADMIN: '/admin',
  BOM: '/bom',
}

const PROFILE_PATH_BY_ROLE = {
  CUSTOMER: '/ho-so',
  STAFF: '/staff/profile',
  FACILITY_MANAGER: '/manager/profile',
  ADMIN: '/admin/profile',
  BOM: '/bom/profile',
}

export function getHomePath(role) {
  return HOME_PATH_BY_ROLE[role] || '/'
}

export function getProfilePath(role) {
  return PROFILE_PATH_BY_ROLE[role] || '/ho-so'
}

export async function getMyProfile() {
  const response = await api.get('/auth/profile')
  return response.data
}

export async function updateMyProfile(payload) {
  const response = await api.put('/auth/profile', payload)
  const data = response.data
  try {
    const current = JSON.parse(sessionStorage.getItem('user') || '{}')
    const updated = {
      ...current,
      fullName: data.fullName ?? current.fullName,
      phone: data.phone ?? current.phone,
      cccd: data.cccd ?? current.cccd,
      email: data.email ?? current.email,
    }
    sessionStorage.setItem('user', JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent('queenkho:user-updated', { detail: updated }))
  } catch {
    // ignore storage errors
  }
  return data
}

export async function changeMyPassword(payload) {
  const response = await api.post('/auth/change-password', payload)
  return response.data
}

// Người dùng bấm Đăng xuất: báo backend huỷ token + ghi lịch sử đăng nhập (không chờ, lỗi mạng cũng bỏ qua)
export function clearSession() {
  const token = sessionStorage.getItem('accessToken')
  if (token) {
    // Gắn token trực tiếp: interceptor chạy bất đồng bộ, lúc đó sessionStorage đã bị xoá ở dòng dưới
    api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
  }
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('user')
}
