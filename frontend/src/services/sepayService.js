import axios from 'axios'

export async function createSepayPayment(reservationId) {
  const response = await axios.post(
    'http://localhost:8080/api/payments/sepay-pg/create',
    { reservationId },
  )
  return response.data
}
