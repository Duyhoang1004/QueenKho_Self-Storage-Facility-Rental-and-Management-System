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
  const { token, userId, fullName, role, facilityId, facilityName } = loginResponse
  const email = loginResponse.email || emailInput

  sessionStorage.setItem('accessToken', token)
  sessionStorage.setItem('user', JSON.stringify({ userId, fullName, email, role, facilityId, facilityName }))
}

// Trang chủ của từng role — dùng chung cho Login và các Layout khi vào sai portal.
// BOM chưa có portal riêng → rơi về '/', CustomerLayout sẽ báo không có quyền.
const HOME_PATH_BY_ROLE = {
  CUSTOMER: '/',
  STAFF: '/staff',
  FACILITY_MANAGER: '/manager',
  ADMIN: '/admin',
}

export function getHomePath(role) {
  return HOME_PATH_BY_ROLE[role] || '/'
}

export function clearSession() {
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('user')
}
