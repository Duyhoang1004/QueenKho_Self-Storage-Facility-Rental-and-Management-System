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

export function clearSession() {
  sessionStorage.removeItem('accessToken')
  sessionStorage.removeItem('user')
}
