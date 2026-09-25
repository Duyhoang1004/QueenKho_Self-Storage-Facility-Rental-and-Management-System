import api from './api'

export async function createReservation(data) {
  const response = await api.post('/reservations', data)
  return response.data
}
