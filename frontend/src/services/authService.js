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
  const { token, userId, fullName, role } = loginResponse
  const email = loginResponse.email || emailInput

  localStorage.setItem('accessToken', token)
  localStorage.setItem('user', JSON.stringify({ userId, fullName, email, role }))
}

export function clearSession() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
}

export async function getMyReservations(customerId) {
  const response = await api.get('/reservations/my', { params: { customerId } })
  return response.data
}

export async function getPendingReservations(facilityId) {
  const response = await api.get('/reservations/pending', { params: { facilityId } })
  return response.data
}